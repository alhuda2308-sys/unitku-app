// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sistem affiliate: tabel + pencatatan komisi (server-only)
//
// Dipanggil webhook Mayar (payment.received), portal affiliator
// (src/lib/affiliate-portal.ts) dan dashboard /affiliate/dashboard.
// Idempoten / anti-komisi-ganda:
//   1. orderId (id transaksi Mayar) UNIQUE di affiliate_commissions — retry
//      webhook untuk transaksi yang sama gagal di P2002 → dianggap duplikat
//      (pola sama dengan LicensePurchase.transactionId).
//   2. Increment saldo HANYA terjadi bila baris komisi benar-benar BARU.
//
// Kegagalan pencatatan komisi TIDAK PERNAH melempar — provisioning lisensi
// (produk utama) harus tetap sukses; kegagalan cukup dicatat di log dan bisa
// direkonsiliasi manual lewat orderId yang unik.
//
// Self-heal skema (fix P2022 "column affiliates.xxx does not exist"):
// produksi yang tabelnya dibuat manual / dari versi SQL lama sering kali
// TIDAK lengkap — CREATE TABLE IF NOT EXISTS tidak menambah kolom ke tabel
// yang sudah ada. Karena itu ensureAffiliateTables() menjamin SETIAP kolom
// model Prisma (Affiliate & AffiliateCommission) benar-benar ada lewat
// ALTER TABLE ADD COLUMN IF NOT EXISTS untuk SEMUA kolom + backfill baris
// legacy, sehingga tidak perlu migrasi manual saat runtime. Referensi SQL
// manual (identik): supabase/affiliate-tables.sql.
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from "@prisma/client";

import {
  AFFILIATE_COMMISSION_IDR,
  sanitizeAffiliateRef,
} from "@/lib/affiliate";
import { prisma } from "@/lib/prisma";

let affiliateTablesReady: Promise<void> | null = null;

/**
 * Langkah bootstrap skema affiliate — SATU perintah SQL per elemen
 * ($executeRawUnsafe memakai prepared protocol Postgres yang melarang
 * multi-statement dalam satu string).
 *
 * bestEffort = kegagalan dilewati (hanya log) — mis. guard PK/FK pada tabel
 * yang sudah punya constraint berbeda, atau RLS pada role tanpa hak DDL.
 * Langkah wajib yang gagal membuat bootstrap dianggap gagal → cache di-reset
 * → dicoba ulang otomatis pada request berikutnya (pola ensureLicenseLeadTable).
 *
 * PENTING: nama kolom camelCase TANPA @map di prisma/schema.prisma — identifier
 * di-quote persis ("refCode", "totalEarnings", …) agar cocok dengan mapping.
 */
const AFFILIATE_SCHEMA_STEPS: Array<{
  label: string;
  sql: string;
  bestEffort?: boolean;
}> = [
  // ── a. Tabel baru (fresh install) — definisi lengkap versi FINAL ──────────
  {
    label: "create table affiliates",
    sql: `CREATE TABLE IF NOT EXISTS "affiliates" (
           "id"            TEXT         NOT NULL,
           "userId"        TEXT,
           "name"          TEXT         NOT NULL,
           "email"         TEXT,
           "phone"         TEXT,
           "refCode"       TEXT         NOT NULL,
           "totalEarnings" INTEGER      NOT NULL DEFAULT 0,
           "isActive"      BOOLEAN      NOT NULL DEFAULT true,
           "bankName"        TEXT,
           "bankAccountNo"   TEXT,
           "bankAccountName" TEXT,
           "accessToken"     TEXT,
           "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
           "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
           CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
         )`,
  },
  // ── b. Upgrade tabel LAMA — SEMUA kolom wajib dijamin ada (anti P2022) ────
  {
    label: "affiliates.userId",
    sql: `ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "userId" TEXT`,
  },
  {
    label: "affiliates.name",
    sql: `ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT ''`,
  },
  {
    label: "affiliates.email",
    sql: `ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "email" TEXT`,
  },
  {
    label: "affiliates.phone",
    sql: `ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "phone" TEXT`,
  },
  {
    label: "affiliates.refCode",
    sql: `ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "refCode" TEXT NOT NULL DEFAULT ''`,
  },
  {
    label: "affiliates.totalEarnings",
    sql: `ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "totalEarnings" INTEGER NOT NULL DEFAULT 0`,
  },
  {
    label: "affiliates.isActive",
    sql: `ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`,
  },
  {
    label: "affiliates.bankName",
    sql: `ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "bankName" TEXT`,
  },
  {
    label: "affiliates.bankAccountNo",
    sql: `ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "bankAccountNo" TEXT`,
  },
  {
    label: "affiliates.bankAccountName",
    sql: `ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "bankAccountName" TEXT`,
  },
  {
    label: "affiliates.accessToken",
    sql: `ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "accessToken" TEXT`,
  },
  {
    label: "affiliates.createdAt",
    sql: `ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  },
  {
    label: "affiliates.updatedAt",
    sql: `ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  },
  // ── c. Backfill baris legacy agar NOT NULL & unique index tetap valid ─────
  {
    label: "backfill affiliates.name",
    sql: `UPDATE "affiliates" SET "name" = 'Affiliator' WHERE "name" IS NULL OR "name" = ''`,
  },
  {
    label: "backfill affiliates.refCode",
    sql: `UPDATE "affiliates" SET "refCode" = 'aff_' || substr(md5("id" || random()::text), 1, 10)
             WHERE "refCode" IS NULL OR "refCode" = ''`,
  },
  // ── d. Primary key — tabel buatan manual bisa tanpa PK (best effort) ──────
  {
    label: "affiliates primary key",
    bestEffort: true,
    sql: `DO $$
           BEGIN
             ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id");
           EXCEPTION
             WHEN duplicate_object THEN NULL;            -- constraint sudah ada
             WHEN invalid_table_definition THEN NULL;    -- PK lain sudah ada
           END $$`,
  },
  // ── e. Unique index Prisma (AFTER backfill — duplikat kosong tak mungkin) ─
  {
    label: "index affiliates.refCode",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "affiliates_refCode_key" ON "affiliates"("refCode")`,
  },
  {
    label: "index affiliates.userId",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "affiliates_userId_key" ON "affiliates"("userId")`,
  },
  {
    label: "index affiliates.accessToken",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "affiliates_accessToken_key" ON "affiliates"("accessToken")`,
  },
  // ── affiliate_commissions ─────────────────────────────────────────────────
  {
    label: "create table affiliate_commissions",
    sql: `CREATE TABLE IF NOT EXISTS "affiliate_commissions" (
           "id"               TEXT         NOT NULL,
           "affiliateId"      TEXT         NOT NULL,
           "orderId"          TEXT         NOT NULL,
           "customerEmail"    TEXT,
           "commissionAmount" INTEGER      NOT NULL,
           "status"           TEXT         NOT NULL DEFAULT 'approved',
           "paidAt"           TIMESTAMP(3),
           "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
           CONSTRAINT "affiliate_commissions_pkey" PRIMARY KEY ("id")
         )`,
  },
  {
    label: "affiliate_commissions.affiliateId",
    sql: `ALTER TABLE "affiliate_commissions" ADD COLUMN IF NOT EXISTS "affiliateId" TEXT NOT NULL DEFAULT ''`,
  },
  {
    label: "affiliate_commissions.orderId",
    sql: `ALTER TABLE "affiliate_commissions" ADD COLUMN IF NOT EXISTS "orderId" TEXT NOT NULL DEFAULT ''`,
  },
  {
    label: "affiliate_commissions.customerEmail",
    sql: `ALTER TABLE "affiliate_commissions" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT`,
  },
  {
    label: "affiliate_commissions.commissionAmount",
    sql: `ALTER TABLE "affiliate_commissions" ADD COLUMN IF NOT EXISTS "commissionAmount" INTEGER NOT NULL DEFAULT 0`,
  },
  {
    label: "affiliate_commissions.status",
    sql: `ALTER TABLE "affiliate_commissions" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'approved'`,
  },
  {
    label: "affiliate_commissions.paidAt",
    sql: `ALTER TABLE "affiliate_commissions" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3)`,
  },
  {
    label: "affiliate_commissions.createdAt",
    sql: `ALTER TABLE "affiliate_commissions" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  },
  {
    label: "affiliate_commissions primary key",
    bestEffort: true,
    sql: `DO $$
           BEGIN
             ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_pkey" PRIMARY KEY ("id");
           EXCEPTION
             WHEN duplicate_object THEN NULL;
             WHEN invalid_table_definition THEN NULL;
           END $$`,
  },
  {
    label: "index affiliate_commissions.orderId",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_commissions_orderId_key" ON "affiliate_commissions"("orderId")`,
  },
  {
    label: "index affiliate_commissions.affiliateId",
    sql: `CREATE INDEX IF NOT EXISTS "affiliate_commissions_affiliateId_idx" ON "affiliate_commissions"("affiliateId")`,
  },
  // ── g. Perbaikan bentuk tabel LEGACY (hasil reproduksi bug "Gagal
  //       mendaftarkan mitra"): bootstrap lama hanya MENAMBAH kolom hilang,
  //       tetapi tidak memperbaiki deviasi bentuk tabel buatan manual yang
  //       membuat INSERT Prisma gagal (SELECT tetap normal):
  //         • id bertipe uuid/serial → Prisma mengirim cuid TEXT → P2023/22P02
  //         • kolom ekstra NOT NULL tanpa default yang tidak dikenal model →
  //           Prisma tidak mengirimnya → P2011 (null violates not-null)
  //       Semua langkah best-effort & idempoten — data lama TIDAK diubah. ────
  {
    label: "repair affiliates.id type (uuid/serial → text)",
    bestEffort: true,
    sql: `DO $$
           DECLARE t text;
           BEGIN
             SELECT data_type INTO t FROM information_schema.columns
              WHERE table_name = 'affiliates' AND column_name = 'id';
             IF t IS NOT NULL AND t <> 'text'
                AND t NOT IN ('character varying','character') THEN
               BEGIN
                 ALTER TABLE "affiliate_commissions"
                   DROP CONSTRAINT IF EXISTS "affiliate_commissions_affiliateId_fkey";
               EXCEPTION WHEN OTHERS THEN NULL; END;
               BEGIN
                 ALTER TABLE "affiliates" ALTER COLUMN "id" DROP DEFAULT;
                 ALTER TABLE "affiliates" ALTER COLUMN "id" TYPE TEXT USING "id"::text;
               EXCEPTION WHEN OTHERS THEN NULL; END;
             END IF;
           EXCEPTION WHEN OTHERS THEN NULL;
           END $$`,
  },
  {
    label: "repair affiliate_commissions.id type (uuid/serial → text)",
    bestEffort: true,
    sql: `DO $$
           DECLARE t text;
           BEGIN
             SELECT data_type INTO t FROM information_schema.columns
              WHERE table_name = 'affiliate_commissions' AND column_name = 'id';
             IF t IS NOT NULL AND t <> 'text'
                AND t NOT IN ('character varying','character') THEN
               BEGIN
                 ALTER TABLE "affiliate_commissions" ALTER COLUMN "id" DROP DEFAULT;
                 ALTER TABLE "affiliate_commissions" ALTER COLUMN "id" TYPE TEXT USING "id"::text;
               EXCEPTION WHEN OTHERS THEN NULL; END;
             END IF;
           EXCEPTION WHEN OTHERS THEN NULL;
           END $$`,
  },
  {
    label: "repair affiliate_commissions.affiliateId type (uuid/serial → text)",
    bestEffort: true,
    sql: `DO $$
           DECLARE t text;
           BEGIN
             SELECT data_type INTO t FROM information_schema.columns
              WHERE table_name = 'affiliate_commissions' AND column_name = 'affiliateId';
             IF t IS NOT NULL AND t <> 'text'
                AND t NOT IN ('character varying','character') THEN
               BEGIN
                 ALTER TABLE "affiliate_commissions"
                   DROP CONSTRAINT IF EXISTS "affiliate_commissions_affiliateId_fkey";
               EXCEPTION WHEN OTHERS THEN NULL; END;
               BEGIN
                 ALTER TABLE "affiliate_commissions" ALTER COLUMN "affiliateId" DROP DEFAULT;
                 ALTER TABLE "affiliate_commissions" ALTER COLUMN "affiliateId" TYPE TEXT USING "affiliateId"::text;
               EXCEPTION WHEN OTHERS THEN NULL; END;
             END IF;
           EXCEPTION WHEN OTHERS THEN NULL;
           END $$`,
  },
  {
    label: "repair affiliates extra NOT NULL columns (→ nullable)",
    bestEffort: true,
    sql: `DO $$
           DECLARE r record;
           BEGIN
             FOR r IN
               SELECT c.column_name
                 FROM information_schema.columns c
                WHERE c.table_name = 'affiliates'
                  AND c.table_schema = current_schema()
                  AND c.is_nullable = 'NO'
                  AND c.column_default IS NULL
                  AND c.column_name NOT IN ('id','userId','name','email','phone',
                      'refCode','totalEarnings','isActive','bankName',
                      'bankAccountNo','bankAccountName','accessToken',
                      'createdAt','updatedAt')
             LOOP
               BEGIN
                 EXECUTE format('ALTER TABLE "affiliates" ALTER COLUMN %I DROP NOT NULL', r.column_name);
               EXCEPTION WHEN OTHERS THEN NULL;
               END;
             END LOOP;
           EXCEPTION WHEN OTHERS THEN NULL;
           END $$`,
  },
  {
    label: "repair affiliate_commissions extra NOT NULL columns (→ nullable)",
    bestEffort: true,
    sql: `DO $$
           DECLARE r record;
           BEGIN
             FOR r IN
               SELECT c.column_name
                 FROM information_schema.columns c
                WHERE c.table_name = 'affiliate_commissions'
                  AND c.table_schema = current_schema()
                  AND c.is_nullable = 'NO'
                  AND c.column_default IS NULL
                  AND c.column_name NOT IN ('id','affiliateId','orderId',
                      'customerEmail','commissionAmount','status','paidAt','createdAt')
             LOOP
               BEGIN
                 EXECUTE format('ALTER TABLE "affiliate_commissions" ALTER COLUMN %I DROP NOT NULL', r.column_name);
               EXCEPTION WHEN OTHERS THEN NULL;
               END;
             END LOOP;
           EXCEPTION WHEN OTHERS THEN NULL;
           END $$`,
  },
  // ── f. Foreign key + RLS (best effort — tergantung hak role & data legacy) ─
  {
    label: "foreign key affiliate_commissions.affiliateId",
    bestEffort: true,
    sql: `DO $$
           BEGIN
             IF NOT EXISTS (
               SELECT 1 FROM pg_constraint
                WHERE conname = 'affiliate_commissions_affiliateId_fkey'
             ) THEN
               ALTER TABLE "affiliate_commissions"
                 ADD CONSTRAINT "affiliate_commissions_affiliateId_fkey"
                 FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id")
                 ON DELETE CASCADE;
             END IF;
           EXCEPTION WHEN OTHERS THEN NULL;
           END $$`,
  },
  {
    label: "RLS affiliates",
    bestEffort: true,
    sql: `ALTER TABLE "affiliates" ENABLE ROW LEVEL SECURITY`,
  },
  {
    label: "RLS affiliate_commissions",
    bestEffort: true,
    sql: `ALTER TABLE "affiliate_commissions" ENABLE ROW LEVEL SECURITY`,
  },
];

/** Jalankan seluruh langkah bootstrap; lempar bila ada langkah WAJIB gagal. */
async function runAffiliateSchemaBootstrap(): Promise<void> {
  let failedRequired = 0;
  for (const step of AFFILIATE_SCHEMA_STEPS) {
    try {
      await prisma.$executeRawUnsafe(step.sql);
    } catch (error) {
      if (step.bestEffort) {
        console.error(
          `[UnitKu Affiliate] Self-heal (best-effort) gagal pada "${step.label}" — dilewati:`,
          error,
        );
      } else {
        failedRequired += 1;
        console.error(
          `[UnitKu Affiliate] Self-heal GAGAL pada "${step.label}":`,
          error,
        );
      }
    }
  }
  if (failedRequired > 0) {
    throw new Error(
      `Self-heal skema affiliate: ${failedRequired} langkah wajib gagal (lihat log)`,
    );
  }
}

/**
 * Jaminan tabel `affiliates` & `affiliate_commissions` LENGKAP tersedia —
 * idempoten, dieksekusi sekali per proses; cache dibatalkan saat gagal agar
 * dicoba ulang di request berikutnya (pola sama dengan ensureLicenseLeadTable).
 * Menambah kolom yang hilang pada tabel lama secara otomatis — fix P2022.
 */
export async function ensureAffiliateTables(): Promise<void> {
  if (!affiliateTablesReady) {
    affiliateTablesReady = runAffiliateSchemaBootstrap().catch((err) => {
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
