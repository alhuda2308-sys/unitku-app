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

// ── Toleransi DB utk pembacaan portal (anti banner-error saat cold-start) ────
// Query portal diulangi hingga 3x dengan jeda backoff — total upaya ±6,5 dtk —
// sehingga database yang lambat menyala (cold-start Supabase) tidak langsung
// dilaporkan "Gagal memuat data afiliasi". Selama upaya berjalan, App Router
// menampilkan loading.tsx (spinner "Memuat data, mohon tunggu..."); banner
// error HANYA muncul bila SEMUA percobaan benar-benar gagal (isLoading selesai).
const PORTAL_RETRY_DELAYS_MS = [0, 2_500, 4_000] as const;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withPortalDbRetry<T>(op: () => Promise<T>): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < PORTAL_RETRY_DELAYS_MS.length; attempt += 1) {
    if (PORTAL_RETRY_DELAYS_MS[attempt] > 0) await delay(PORTAL_RETRY_DELAYS_MS[attempt]);
    try {
      return await op();
    } catch (error) {
      lastError = error;
      console.warn(
        `[UnitKu Affiliate] Upaya DB ${attempt + 1}/${PORTAL_RETRY_DELAYS_MS.length} gagal:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  throw lastError;
}

/** Bentuk select bersama profil + riwayat komisi (dipakai by-user & by-token) */
const PORTAL_SELECT = {
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
} as const;

function toPortalData(affiliate: {
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
  commissions: Array<{
    id: string;
    orderId: string;
    customerEmail: string | null;
    commissionAmount: number;
    status: string;
    createdAt: Date;
  }>;
}): AffiliatePortalData {
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
}

/**
 * Data lengkap portal affiliator utk user yang sedang login.
 * Tidak pernah melempar — kegagalan DB menjadi { error: true } agar halaman
 * bisa menampilkan kartu error yang rapi (fail-graceful).
 */
export async function getAffiliatePortalData(
  userId: string,
): Promise<AffiliatePortalData> {
  try {
    const affiliate = await withPortalDbRetry(async () => {
      await ensureAffiliateTables();
      return prisma.affiliate.findUnique({
        where: { userId },
        select: PORTAL_SELECT,
      });
    });
    if (!affiliate) return { error: false, affiliate: null, commissions: [] };
    return toPortalData(affiliate);
  } catch (error) {
    console.error("[UnitKu Affiliate] Gagal memuat data portal:", error);
    return { error: true };
  }
}

/**
 * Data portal affiliator via id mitra — dipakai JALUR SESI PORTAL MITRA
 * (login khusus /affiliate/login). Ownership dijamin: id berasal dari payload
 * cookie HMAC yang diterbitkan server setelah verifikasi kredensial — TIDAK
 * pernah dari input client. Pola fail-graceful sama seperti getAffiliatePortalData.
 */
export async function getAffiliatePortalDataById(
  affiliateId: string,
): Promise<AffiliatePortalData> {
  try {
    const affiliate = await withPortalDbRetry(async () => {
      await ensureAffiliateTables();
      return prisma.affiliate.findUnique({
        where: { id: affiliateId },
        select: PORTAL_SELECT,
      });
    });
    if (!affiliate) return { error: false, affiliate: null, commissions: [] };
    return toPortalData(affiliate);
  } catch (error) {
    console.error(
      "[UnitKu Affiliate] Gagal memuat data portal (sesi mitra):",
      error,
    );
    return { error: true };
  }
}

/**
 * Data portal affiliator via MAGIC-LINK token (akses tanpa login) — mitra
 * baru didaftarkan admin tanpa email/akun Supabase, jadi portal diakses
 * lewat link pribadi /affiliate/dashboard?ref=<kode>&token=<accessToken>.
 * Token diverifikasi ketat di server (findUnique by accessToken) — tidak ada
 * kebocoran antar mitra; token salah → null (halaman redirect ke /login).
 */
export async function getAffiliatePortalDataByToken(
  rawToken: string | null | undefined,
): Promise<AffiliatePortalData | null> {
  const token = rawToken?.trim() ?? "";
  if (!token || token.length > 128) return null;
  try {
    const affiliate = await withPortalDbRetry(async () => {
      await ensureAffiliateTables();
      return prisma.affiliate.findUnique({
        where: { accessToken: token },
        select: PORTAL_SELECT,
      });
    });
    if (!affiliate) return null;
    return toPortalData(affiliate);
  } catch (error) {
    console.error("[UnitKu Affiliate] Gagal memuat data portal (token):", error);
    return null;
  }
}

/**
 * Fallback kontak user (Nama + No. WhatsApp) dari tabel lead license_leads
 * berdasarkan email — dipakai CTA "Aktifkan Program Afiliasi" di dashboard
 * ketika user_metadata Supabase tidak memuat profil (akun lama/mode lokal).
 * Kegagalan DB → null (CTA tetap tampil, hanya tanpa prefill).
 */
export async function getUserContactByEmail(
  email: string | null | undefined,
): Promise<{ name: string | null; phone: string | null } | null> {
  const key = email?.trim().toLowerCase() ?? "";
  if (!key) return null;
  try {
    const lead = await prisma.licenseLead.findFirst({
      where: { email: key },
      orderBy: { createdAt: "desc" },
      select: { name: true, phone: true },
    });
    if (!lead) return null;
    return {
      name: lead.name?.trim() || null,
      phone: lead.phone?.trim() || null,
    };
  } catch (error) {
    console.error(
      "[UnitKu Affiliate] Fallback kontak lead gagal (dilewati):",
      error,
    );
    return null;
  }
}

export type PayoutUpdateResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "error" };

/** Simpan rekening pencairan by id affiliator (ownership sudah divalidasi) */
async function saveAffiliatePayoutById(
  affiliateId: string,
  input: { bankName: string; bankAccountNo: string; bankAccountName: string },
): Promise<PayoutUpdateResult> {
  try {
    await ensureAffiliateTables();
    await prisma.affiliate.update({
      where: { id: affiliateId },
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
    return await saveAffiliatePayoutById(existing.id, input);
  } catch (error) {
    console.error("[UnitKu Affiliate] Gagal menyimpan rekening pencairan:", error);
    return { ok: false, reason: "error" };
  }
}

/**
 * Simpan rekening pencairan via MAGIC-LINK token (mitra tanpa akun login).
 * Ownership dijamin lewat pencarian by accessToken — token salah → not-found.
 */
export async function updateAffiliatePayoutByToken(
  rawToken: string | null | undefined,
  input: { bankName: string; bankAccountNo: string; bankAccountName: string },
): Promise<PayoutUpdateResult> {
  const token = rawToken?.trim() ?? "";
  if (!token || token.length > 128) return { ok: false, reason: "not-found" };
  try {
    await ensureAffiliateTables();
    const existing = await prisma.affiliate.findUnique({
      where: { accessToken: token },
      select: { id: true },
    });
    if (!existing) return { ok: false, reason: "not-found" };
    return await saveAffiliatePayoutById(existing.id, input);
  } catch (error) {
    console.error(
      "[UnitKu Affiliate] Gagal menyimpan rekening pencairan (token):",
      error,
    );
    return { ok: false, reason: "error" };
  }
}
