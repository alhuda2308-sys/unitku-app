// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sistem affiliate, Tahap 4: data portal affiliator (server-only)
//
// Dipakai halaman /affiliate/dashboard (Server Component) dan API
// /api/affiliate/payout. Profil affiliator dicari berdasarkan user yang
// sedang login (affiliates.userId = auth.users.id / OwnerAccount.id) —
// TIDAK PERNAH dari input client, sehingga satu affiliator tidak mungkin
// melihat/mengubah akun affiliator lain.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { ensureAffiliateTables } from "@/lib/affiliate-commission";

export interface AffiliateProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  refCode: string;
  totalEarnings: number;
  isActive: boolean;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
}

export interface AffiliateCommissionRow {
  id: string;
  orderId: string;
  customerEmail: string | null;
  commissionAmount: number;
  status: string;
  createdAt: string; // ISO
}

export type AffiliatePortalData =
  | {
      error: false;
      affiliate: AffiliateProfile | null; // null = user belum terdaftar sebagai affiliator
      commissions: AffiliateCommissionRow[]; // terbaru dulu
    }
  | { error: true };

/** Batas riwayat komisi yang ditampilkan — cukup utk dashboard, anti-berat */
const COMMISSION_LIMIT = 100;

/**
 * Data lengkap portal affiliator utk user yang sedang login.
 * Tidak pernah melempar — kegagalan DB menjadi { error: true } agar halaman
 * bisa menampilkan kartu error yang rapi (fail-graceful).
 */
export async function getAffiliatePortalData(
  userId: string,
): Promise<AffiliatePortalData> {
  try {
    await ensureAffiliateTables();
    const affiliate = await prisma.affiliate.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        refCode: true,
        totalEarnings: true,
        isActive: true,
        bankName: true,
        bankAccountNo: true,
        bankAccountName: true,
        commissions: {
          orderBy: { createdAt: "desc" },
          take: COMMISSION_LIMIT,
          select: {
            id: true,
            orderId: true,
            customerEmail: true,
            commissionAmount: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    if (!affiliate) return { error: false, affiliate: null, commissions: [] };
    return {
      error: false,
      affiliate: {
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        phone: affiliate.phone,
        refCode: affiliate.refCode,
        totalEarnings: affiliate.totalEarnings,
        isActive: affiliate.isActive,
        bankName: affiliate.bankName,
        bankAccountNo: affiliate.bankAccountNo,
        bankAccountName: affiliate.bankAccountName,
      },
      commissions: affiliate.commissions.map((c) => ({
        id: c.id,
        orderId: c.orderId,
        customerEmail: c.customerEmail,
        commissionAmount: c.commissionAmount,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("[UnitKu Affiliate] Gagal memuat data portal:", error);
    return { error: true };
  }
}

export type PayoutUpdateResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "error" };

/**
 * Simpan rekening pencairan milik affiliator yang sedang login.
 * Ownership dijamin lewat pencarian by userId (bukan id dari client).
 */
export async function updateAffiliatePayout(
  userId: string,
  input: { bankName: string; bankAccountNo: string; bankAccountName: string },
): Promise<PayoutUpdateResult> {
  try {
    await ensureAffiliateTables();
    const existing = await prisma.affiliate.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!existing) return { ok: false, reason: "not-found" };
    await prisma.affiliate.update({
      where: { id: existing.id },
      data: {
        bankName: input.bankName,
        bankAccountNo: input.bankAccountNo,
        bankAccountName: input.bankAccountName,
      },
    });
    return { ok: true };
  } catch (error) {
    console.error("[UnitKu Affiliate] Gagal menyimpan rekening pencairan:", error);
    return { ok: false, reason: "error" };
  }
}
