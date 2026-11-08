// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Manajemen afiliasi untuk Super Admin (server-only)
//
// Dipakai halaman /admin/affiliates + API /api/admin/affiliate/*.
// Semua fungsi WAJIB dipanggil setelah requireSuperAdminUser() lolos —
// lib ini sendiri TIDAK memeriksa role (gerbang ada di halaman/route).
//
// Sumber data: tabel affiliates & affiliate_commissions (model Affiliate /
// AffiliateCommission). Status komisi:
//   approved = menunggu transfer admin (Payout Queue)
//   paid     = sudah ditransfer (paidAt terisi)
//   reversed = dibatalkan (tidak masuk keduanya)
//
// Self-heal tabel selalu dijalankan dulu (ensureAffiliateTables) agar kolom
// produksi dijamin lengkap — termasuk paidAt yang baru ditambahkan.
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from "@prisma/client";

import { sanitizeAffiliateRef } from "@/lib/affiliate";
import { ensureAffiliateTables } from "@/lib/affiliate-commission";
import { prisma } from "@/lib/prisma";
import { listAllSupabaseUsers } from "@/lib/supabase-admin";

// ── Tipe data panel ──────────────────────────────────────────────────────────

/** Satu baris Payout Queue — komisi approved menunggu transfer admin */
export interface AdminPayoutRow {
  id: string;
  orderId: string;
  commissionAmount: number;
  /** ISO — tanggal komisi tercatat (webhook) */
  createdAt: string;
  affiliateName: string;
  refCode: string;
  affiliatePhone: string | null;
  /** Rekening pencairan mitra — bisa null bila belum diisi di dashboardnya */
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
}

/** Satu baris daftar mitra affiliator */
export interface AdminPartnerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  refCode: string;
  /** Saldo akumulasi (IDR) — increment webhook per penjualan */
  totalEarnings: number;
  isActive: boolean;
  /** true = terhubung akun user → bisa buka /affiliate/dashboard sendiri */
  hasUser: boolean;
  createdAt: string;
}

export interface AffiliateAdminStats {
  /** Nominal wajib ditransfer admin ke mitra (sum komisi approved) */
  pendingAmount: number;
  pendingCount: number;
  /** Nominal sudah ditransfer (sum komisi paid) */
  paidAmount: number;
  paidCount: number;
  partnersTotal: number;
  partnersActive: number;
}

export interface AffiliateAdminOverview {
  stats: AffiliateAdminStats;
  /** Komisi approved — paling lama menunggu di atas */
  payoutQueue: AdminPayoutRow[];
  /** Seluruh mitra — terbaru dulu */
  partners: AdminPartnerRow[];
}

// ── Overview (stats + payout queue + daftar mitra) ───────────────────────────

/**
 * Data lengkap panel manajemen afiliasi. Mengembalikan null bila DB gagal —
 * halaman menampilkan kartu error rapi (fail-graceful, pola portal affiliator).
 */
export async function getAffiliateAdminOverview(): Promise<AffiliateAdminOverview | null> {
  try {
    await ensureAffiliateTables();

    const [statusGroups, queue, partners] = await Promise.all([
      prisma.affiliateCommission.groupBy({
        by: ["status"],
        _sum: { commissionAmount: true },
        _count: { _all: true },
      }),
      prisma.affiliateCommission.findMany({
        where: { status: "approved" },
        orderBy: { createdAt: "asc" }, // paling lama menunggu → paling atas
        take: 200,
        include: {
          affiliate: {
            select: {
              name: true,
              refCode: true,
              phone: true,
              bankName: true,
              bankAccountNo: true,
              bankAccountName: true,
            },
          },
        },
      }),
      prisma.affiliate.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          refCode: true,
          totalEarnings: true,
          isActive: true,
          userId: true,
          createdAt: true,
        },
      }),
    ]);

    const sumOf = (status: string) => {
      const row = statusGroups.find((g) => g.status === status);
      return {
        amount: row?._sum.commissionAmount ?? 0,
        count: row?._count._all ?? 0,
      };
    };
    const pending = sumOf("approved");
    const paid = sumOf("paid");

    return {
      stats: {
        pendingAmount: pending.amount,
        pendingCount: pending.count,
        paidAmount: paid.amount,
        paidCount: paid.count,
        partnersTotal: partners.length,
        partnersActive: partners.filter((p) => p.isActive).length,
      },
      payoutQueue: queue.map((c) => ({
        id: c.id,
        orderId: c.orderId,
        commissionAmount: c.commissionAmount,
        createdAt: c.createdAt.toISOString(),
        affiliateName: c.affiliate.name,
        refCode: c.affiliate.refCode,
        affiliatePhone: c.affiliate.phone,
        bankName: c.affiliate.bankName,
        bankAccountNo: c.affiliate.bankAccountNo,
        bankAccountName: c.affiliate.bankAccountName,
      })),
      partners: partners.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        refCode: p.refCode,
        totalEarnings: p.totalEarnings,
        isActive: p.isActive,
        hasUser: Boolean(p.userId),
        createdAt: p.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("[UnitKu Affiliate Admin] Gagal memuat overview:", error);
    return null;
  }
}

// ── Aksi: tandai komisi sudah ditransfer ─────────────────────────────────────

export type MarkCommissionPaidResult =
  | { ok: true; alreadyPaid: boolean }
  | { ok: false; reason: "not-found" | "error" };

/**
 * Tandai satu komisi sudah ditransfer: status → "paid" + paidAt = now().
 * Idempoten: komisi yang sudah paid dianggap sukses tanpa menimpa timestamp
 * pertama (audit payout tetap akurat).
 */
export async function markCommissionPaid(
  commissionId: string,
): Promise<MarkCommissionPaidResult> {
  try {
    await ensureAffiliateTables();
    const existing = await prisma.affiliateCommission.findUnique({
      where: { id: commissionId },
      select: { status: true },
    });
    if (!existing) return { ok: false, reason: "not-found" };
    if (existing.status === "paid") return { ok: true, alreadyPaid: true };

    await prisma.affiliateCommission.update({
      where: { id: commissionId },
      data: { status: "paid", paidAt: new Date() },
    });
    console.log(
      `[UnitKu Affiliate Admin] Komisi ${commissionId} ditandai PAID (ditransfer ke mitra).`,
    );
    return { ok: true, alreadyPaid: false };
  } catch (error) {
    console.error(
      "[UnitKu Affiliate Admin] Gagal menandai komisi paid:",
      error,
    );
    return { ok: false, reason: "error" };
  }
}

// ── Aksi: aktifkan / nonaktifkan kode referral mitra ─────────────────────────

export type SetAffiliateActiveResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "error" };

/**
 * Toggle status mitra. Nonaktif = kode masih mengikuti cookie calon pembeli,
 * tetapi webhook TIDAK lagi mencatat komisi baru untuk kode tersebut
 * (recordAffiliateCommissionIfNew melewati affiliator isActive=false).
 */
export async function setAffiliateActive(
  affiliateId: string,
  isActive: boolean,
): Promise<SetAffiliateActiveResult> {
  try {
    await ensureAffiliateTables();
    const existing = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: { id: true },
    });
    if (!existing) return { ok: false, reason: "not-found" };
    await prisma.affiliate.update({
      where: { id: affiliateId },
      data: { isActive },
    });
    return { ok: true };
  } catch (error) {
    console.error(
      "[UnitKu Affiliate Admin] Gagal mengubah status mitra:",
      error,
    );
    return { ok: false, reason: "error" };
  }
}

// ── Aksi: daftarkan mitra baru dari UI admin ─────────────────────────────────

export interface CreateAffiliateInput {
  /** Email akun user (auth.users) pemilik kode — kunci akses dashboard */
  email: string;
  name: string;
  /** Kode referral untuk link ?ref= — [A-Za-z0-9_-], maks 64 */
  refCode: string;
}

export type CreateAffiliateResult =
  | {
      ok: true;
      /** true = ketemu di Supabase Auth → dashboard affiliator langsung aktif */
      linkedUser: boolean;
      /** No. WA dari user_metadata bila tersedia (otomatis tersimpan) */
      phone: string | null;
      /** Baris mitra yang baru dibuat — untuk update state panel tanpa refetch */
      partner: AdminPartnerRow;
    }
  | {
      ok: false;
      reason:
        | "invalid-input"
        | "ref-code-taken"
        | "email-taken"
        | "user-linked"
        | "error";
      /**
       * Kode + pesan error mentah (bila reason "error") — ditampilkan ke Super
       * Admin supaya penyebab DB yang sesungguhnya terbaca tanpa harus buka
       * server logs (mis. "Kode P2022 — column … does not exist").
       */
      detail?: string;
    };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ringkasan error Prisma/postgres — satu baris pendek untuk ditampilkan */
function describePrismaError(error: unknown): string | undefined {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const firstLine = (error.message.split("\n")[0] ?? "").trim();
    const short = firstLine.replace(/^\s*(Invalid|Error)[^:]*:\s*/i, "").slice(0, 160);
    return `Kode ${error.code}${short && !short.includes(error.code) ? ` — ${short}` : ""}`;
  }
  if (error instanceof Error && error.message) {
    return error.message.split("\n")[0]?.slice(0, 160);
  }
  return undefined;
}

/**
 * Daftarkan mitra baru tanpa SQL manual. userId di-resolve dari Supabase Auth
 * berdasarkan email — bila user belum ada, baris tetap dibuat (userId null,
 * email tersimpan) dan dashboard affiliator baru terhubung setelah user
 * terdaftar + admin menjalankan ulang pendaftaran.
 */
export async function createAffiliate(
  input: CreateAffiliateInput,
): Promise<CreateAffiliateResult> {
  try {
    const name = input.name?.trim().slice(0, 80) ?? "";
    const email = input.email?.trim().toLowerCase() ?? "";
    const refCode = sanitizeAffiliateRef(input.refCode);

    if (!name || !EMAIL_RE.test(email) || !refCode) {
      return { ok: false, reason: "invalid-input" };
    }

    await ensureAffiliateTables();

    // Cegah duplikasi email sebelum insert (email tidak UNIQUE di DB —
    // duplikat baris per email bikin payout rancu, jadi ditegakkan di sini)
    const sameEmail = await prisma.affiliate.findFirst({
      where: { email },
      select: { refCode: true },
    });
    if (sameEmail) return { ok: false, reason: "email-taken" };

    // Resolve akun user dari Supabase Auth (+ ambil No. WA bila ada)
    let userId: string | null = null;
    let phone: string | null = null;
    try {
      const users = await listAllSupabaseUsers();
      const match = users.find((u) => u.email === email);
      if (match) {
        userId = match.id;
        phone = match.phone;
      }
    } catch (error) {
      // Auth tidak terjangkau → tetap buat baris tanpa keterkaitan user
      console.error(
        "[UnitKu Affiliate Admin] Gagal resolve user Supabase (lanjut tanpa userId):",
        error,
      );
    }

    try {
      const created = await prisma.affiliate.create({
        data: {
          name,
          email,
          phone,
          refCode,
          userId,
          isActive: true,
        },
      });
      const partner: AdminPartnerRow = {
        id: created.id,
        name: created.name,
        email: created.email,
        phone: created.phone,
        refCode: created.refCode,
        totalEarnings: created.totalEarnings,
        isActive: created.isActive,
        hasUser: Boolean(created.userId),
        createdAt: created.createdAt.toISOString(),
      };
      console.log(
        `[UnitKu Affiliate Admin] Mitra baru "${refCode}" (${name}, ${email})` +
          `${userId ? " — terhubung user Supabase" : " — user belum ketemu (tanpa userId)"}.`,
      );
      return { ok: true, linkedUser: Boolean(userId), phone, partner };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // P2002 — bentrok UNIQUE. Bedakan constraint yang dilanggar dari
        // meta.target agar pesan ke admin akurat (bukan selalu refCode):
        //   • affiliates_userId_key → email sudah jadi pemilik mitra lain
        //     (satu akun user = satu affiliator — lihat schema Affiliate)
        //   • selain itu → refCode sudah dipakai mitra lain
        const target = error.meta?.target;
        const targetText = Array.isArray(target)
          ? target.join(",")
          : typeof target === "string"
            ? target
            : "";
        if (/userid/i.test(targetText)) {
          return { ok: false, reason: "user-linked" };
        }
        return { ok: false, reason: "ref-code-taken" };
      }
      throw error;
    }
  } catch (error) {
    console.error("[UnitKu Affiliate Admin] Gagal mendaftarkan mitra:", error);
    const detail = describePrismaError(error);
    return { ok: false, reason: "error", ...(detail ? { detail } : {}) };
  }
}
