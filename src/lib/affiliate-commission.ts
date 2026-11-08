// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sistem affiliate, Tahap 3: pencatatan komisi (server-only)
//
// Dipanggil webhook Mayar (payment.received). Idempoten / anti-komisi-ganda:
//   1. orderId (id transaksi Mayar) UNIQUE di affiliate_commissions — retry
//      webhook untuk transaksi yang sama gagal di P2002 → dianggap duplikat
//      (pola sama dengan LicensePurchase.transactionId).
//   2. Increment saldo HANYA terjadi bila baris komisi benar-benar BARU.
//
// Kegagalan pencatatan komisi TIDAK PERNAH melempar — provisioning lisensi
// (produk utama) harus tetap sukses; kegagalan cukup dicatat di log dan bisa
// direkonsiliasi manual lewat orderId yang unik.
//
// Self-heal tabel (pola ensureLicenseLeadTable): produksi yang belum menjalankan
// `prisma db push` tetap berfungsi — tabel dibuat idempoten saat pertama kali
// dipakai. Referensi SQL manual: supabase/affiliate-tables.sql.
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from "@prisma/client";

import {
  AFFILIATE_COMMISSION_IDR,
  sanitizeAffiliateRef,
} from "@/lib/affiliate";
import { prisma } from "@/lib/prisma";

let affiliateTablesReady: Promise<void> | null = null;

/**
 * Jaminan tabel `affiliates` & `affiliate_commissions` tersedia — idempoten,
 * dieksekusi sekali per proses; cache dibatalkan saat gagal agar dicoba ulang
 * di webhook berikutnya (pola sama dengan ensureLicenseLeadTable).
 */
async function ensureAffiliateTables(): Promise<void> {
  if (!affiliateTablesReady) {
    affiliateTablesReady = (async () => {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "affiliates" (
           "id"            TEXT        NOT NULL,
           "name"          TEXT        NOT NULL,
           "email"         TEXT,
           "phone"         TEXT,
           "refCode"       TEXT        NOT NULL,
           "totalEarnings" INTEGER     NOT NULL DEFAULT 0,
           "isActive"      BOOLEAN     NOT NULL DEFAULT true,
           "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
           "updatedAt"     TIMESTAMP(3) NOT NULL,
           CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
         )`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "affiliates_refCode_key"
           ON "affiliates"("refCode")`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "affiliate_commissions" (
           "id"               TEXT        NOT NULL,
           "affiliateId"      TEXT        NOT NULL,
           "orderId"          TEXT        NOT NULL,
           "customerEmail"    TEXT,
           "commissionAmount" INTEGER     NOT NULL,
           "status"           TEXT        NOT NULL DEFAULT 'approved',
           "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
           CONSTRAINT "affiliate_commissions_pkey" PRIMARY KEY ("id")
         )`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_commissions_orderId_key"
           ON "affiliate_commissions"("orderId")`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "affiliate_commissions_affiliateId_idx"
           ON "affiliate_commissions"("affiliateId")`,
      );
    })().catch((err) => {
      affiliateTablesReady = null; // izinkan retry pada request berikutnya
      throw err;
    });
  }
  await affiliateTablesReady;
}

export interface AffiliateCommissionInput {
  /** Kode referral dari metadata invoice Mayar (metadata.affiliate_ref) */
  refCode: string | null | undefined;
  /** Id transaksi/invoice Mayar — kunci idempotensi komisi */
  orderId: string;
  /** Email pembeli dari webhook (bisa turunan No. WhatsApp) */
  customerEmail?: string | null;
}

export interface AffiliateCommissionResult {
  /** true = komisi BARU dicatat + saldo affiliator ditambah */
  recorded: boolean;
  /** true = orderId sudah pernah dicatat (retry webhook) — saldo TIDAK ditambah */
  duplicate: boolean;
  /** Alasan komisi tidak dicatat (bila recorded & duplicate false) */
  reason?:
    | "no-ref"
    | "invalid-ref"
    | "affiliator-not-found"
    | "affiliator-inactive"
    | "error";
}

/**
 * Catat komisi afiliasi Rp150.000 untuk satu pembayaran Mayar — SEKALI per
 * orderId. Aman dipanggil berulang (webhook retry) untuk transaksi yang sama.
 */
export async function recordAffiliateCommissionIfNew(
  input: AffiliateCommissionInput,
): Promise<AffiliateCommissionResult> {
  const refCode = sanitizeAffiliateRef(input.refCode);
  if (!refCode) {
    // Tanpa ref → bukan traffic affiliate; invalid-ref → jangan risiko salah
    // atribusi, abaikan (cookie sudah menyaring di sisi middleware).
    return {
      recorded: false,
      duplicate: false,
      reason: input.refCode ? "invalid-ref" : "no-ref",
    };
  }

  try {
    await ensureAffiliateTables();

    // 1. Cari affiliator berdasarkan kode referral
    const affiliator = await prisma.affiliate.findUnique({
      where: { refCode },
      select: { id: true, isActive: true },
    });
    if (!affiliator) {
      console.error(
        `[UnitKu Affiliate] Kode referral "${refCode}" tidak terdaftar — komisi order ${input.orderId} dilewati.`,
      );
      return { recorded: false, duplicate: false, reason: "affiliator-not-found" };
    }
    if (!affiliator.isActive) {
      console.log(
        `[UnitKu Affiliate] Affiliator "${refCode}" nonaktif — komisi order ${input.orderId} dilewati.`,
      );
      return { recorded: false, duplicate: false, reason: "affiliator-inactive" };
    }

    // 2. Insert komisi — P2002 (orderId sudah ada) = retry webhook → duplikat
    const customerEmail = input.customerEmail?.trim().toLowerCase() || null;
    try {
      await prisma.affiliateCommission.create({
        data: {
          affiliateId: affiliator.id,
          orderId: input.orderId,
          customerEmail,
          commissionAmount: AFFILIATE_COMMISSION_IDR,
          status: "approved",
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        console.log(
          `[UnitKu Affiliate] Komisi order ${input.orderId} sudah pernah dicatat — duplikat diabaikan (idempoten).`,
        );
        return { recorded: false, duplicate: true };
      }
      throw error;
    }

    // 3. Baris komisi benar-benar baru → tambah saldo affiliator
    await prisma.affiliate.update({
      where: { id: affiliator.id },
      data: { totalEarnings: { increment: AFFILIATE_COMMISSION_IDR } },
    });

    console.log(
      `[UnitKu Affiliate] Komisi Rp${AFFILIATE_COMMISSION_IDR.toLocaleString("id-ID")} ` +
        `→ affiliator "${refCode}" (order ${input.orderId}, pembeli ${customerEmail ?? "-"}).`,
    );
    return { recorded: true, duplicate: false };
  } catch (error) {
    // Jangan pernah gagalkan webhook lisensi karena bookkeeping komisi
    console.error("[UnitKu Affiliate] Gagal mencatat komisi:", error);
    return { recorded: false, duplicate: false, reason: "error" };
  }
}

/** Ringkasan saldo affiliator (untuk dashboard afiliasi — Tahap 4) */
export async function getAffiliateSummaryByRef(refCode: string) {
  const code = sanitizeAffiliateRef(refCode);
  if (!code) return null;
  await ensureAffiliateTables();
  return prisma.affiliate.findUnique({
    where: { refCode: code },
    select: {
      id: true,
      name: true,
      refCode: true,
      totalEarnings: true,
      isActive: true,
      commissions: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          orderId: true,
          customerEmail: true,
          commissionAmount: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });
}
