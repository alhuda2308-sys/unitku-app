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
import { randomBytes } from "node:crypto";

import { sanitizeAffiliateRef } from "@/lib/affiliate";
import { ensureAffiliateTables } from "@/lib/affiliate-commission";
import { normalizeWaPhone } from "@/lib/checkout-validation";
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
  /** Rekening pencairan (terbaru dari dashboard mitra) — bisa null */
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  /** Magic-link portal mitra — null = baris legacy belum punya token */
  accessToken: string | null;
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
          bankName: true,
          bankAccountNo: true,
          bankAccountName: true,
          accessToken: true,
          createdAt: true,
        },
      }),
    ]);

    // Backfill lazy token portal utk baris legacy (dibuat sebelum kolom
    // accessToken ada) — agar tombol "Link Portal" selalu tersedia. Best
    // effort: kegagalan update tidak menggagalkan overview.
    const missingToken = partners.filter((p) => !p.accessToken);
    if (missingToken.length > 0) {
      await Promise.all(
        missingToken.map(async (p) => {
          try {
            await prisma.affiliate.update({
              where: { id: p.id },
              data: { accessToken: generateAffiliateAccessToken() },
            });
          } catch (error) {
            console.error(
              `[UnitKu Affiliate Admin] Backfill token portal gagal utk ${p.refCode}:`,
              error,
            );
          }
        }),
      );
      // Ambil ulang ringan utk baris yang barusan diisi tokennya
      const refreshed = await prisma.affiliate.findMany({
        where: { id: { in: missingToken.map((p) => p.id) } },
        select: { id: true, accessToken: true },
      });
      const tokenById = new Map(refreshed.map((r) => [r.id, r.accessToken]));
      for (const p of partners) {
        if (!p.accessToken) p.accessToken = tokenById.get(p.id) ?? null;
      }
    }

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
        bankName: p.bankName,
        bankAccountNo: p.bankAccountNo,
        bankAccountName: p.bankAccountName,
        accessToken: p.accessToken,
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

/** Domain fallback identifier — email sintetis utk mitra tanpa akun/email */
const AFFILIATE_FALLBACK_EMAIL_DOMAIN = "affiliate.unitku.my.id";

/**
 * Email fallback otomatis dari No. WhatsApp — identifier unik per mitra
 * (skema affiliates.email dipertahankan; mitra tanpa email memakai bentuk
 * ini, mis. 6281234567890@affiliate.unitku.my.id).
 */
export function affiliateFallbackEmail(normalizedPhone: string): string {
  return `${normalizedPhone}@${AFFILIATE_FALLBACK_EMAIL_DOMAIN}`;
}

/** Magic-link token portal mitra — "afk_" + 48 hex (pattern StaffMember) */
export function generateAffiliateAccessToken(): string {
  return `afk_${randomBytes(24).toString("hex")}`;
}

export interface CreateAffiliateInput {
  name: string;
  /** Kode referral untuk link ?ref= — [A-Za-z0-9_-], maks 64 (di-lowercase) */
  refCode: string;
  /** No. WhatsApp mitra — dinormalisasi ke 62xxxxxxxxxx (kunci identitas) */
  phone: string;
}

export type CreateAffiliateResult =
  | {
      ok: true;
      /** true = akun Supabase dengan No. WA itu ketemu → dashboard terhubung */
      linkedUser: boolean;
      /** No. WA ternormalisasi yang tersimpan */
      phone: string;
      /** Email efektif (asli dari akun, atau fallback sintetis) */
      email: string | null;
      /** Magic-link portal — untuk modal sukses di UI admin */
      accessToken: string;
      /** Baris mitra yang baru dibuat — untuk update state panel tanpa refetch */
      partner: AdminPartnerRow;
    }
  | {
      ok: false;
      reason:
        | "invalid-input"
        | "ref-code-taken"
        | "phone-taken"
        | "user-linked"
        | "error";
      /**
       * Kode + pesan error mentah (bila reason "error") — ditampilkan ke Super
       * Admin supaya penyebab DB yang sesungguhnya terbaca tanpa harus buka
       * server logs (mis. "Kode P2022 — column … does not exist").
       */
      detail?: string;
    };

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
 * Daftarkan mitra baru TANPA email & TANPA SQL manual — cukup Nama, Kode
 * Referral, dan No. WhatsApp:
 *   • No. WA dinormalisasi 62xxxxxxxxxx → identifier utama mitra.
 *   • Email diisi fallback otomatis `${phone}@affiliate.unitku.my.id` bila
 *     tidak ada akun Supabase yang cocok (skema tetap butuh identifier unik).
 *   • Bila akun Supabase dengan No. WA yang sama ditemukan, mitra langsung
 *     terhubung (userId) + memakai email asli akun tersebut.
 *   • accessToken (magic-link) dibuat → link portal mitra tanpa login.
 */
export async function createAffiliate(
  input: CreateAffiliateInput,
): Promise<CreateAffiliateResult> {
  try {
    const name = input.name?.trim().slice(0, 80) ?? "";
    const refCode = sanitizeAffiliateRef(input.refCode);
    const phone = normalizeWaPhone(input.phone ?? "");

    if (
      !name ||
      !refCode ||
      !/^62[0-9]{8,13}$/.test(phone)
    ) {
      return { ok: false, reason: "invalid-input" };
    }

    await ensureAffiliateTables();

    // Cegah duplikasi SEBELUM insert — satu No. WA = satu mitra, satu kode
    // referral = satu mitra. Perbandingan phone dinormalisasi dua sisi agar
    // baris legacy berformat 08… / +62… tetap terdeteksi.
    const existing = await prisma.affiliate.findMany({
      select: { id: true, phone: true, email: true, refCode: true },
      take: 1000,
    });
    if (existing.some((a) => a.refCode.toLowerCase() === refCode.toLowerCase())) {
      return { ok: false, reason: "ref-code-taken" };
    }
    const fallbackEmail = affiliateFallbackEmail(phone);
    const samePhone = existing.some(
      (a) =>
        (a.phone ? normalizeWaPhone(a.phone) === phone : false) ||
        a.email === fallbackEmail,
    );
    if (samePhone) return { ok: false, reason: "phone-taken" };

    // Resolve akun user dari Supabase Auth berdasarkan No. WhatsApp (+ email
    // asli akun bila ada) — bila tidak ketemu, buat baris tanpa keterkaitan
    // user dengan email fallback sintetis.
    let userId: string | null = null;
    let email: string | null = fallbackEmail;
    try {
      const users = await listAllSupabaseUsers();
      const match = users.find(
        (u) => u.phone && normalizeWaPhone(u.phone) === phone,
      );
      if (match) {
        userId = match.id;
        if (match.email) email = match.email;
      }
    } catch (error) {
      // Auth tidak terjangkau → tetap buat baris tanpa keterkaitan user
      console.error(
        "[UnitKu Affiliate Admin] Gagal resolve user Supabase (lanjut tanpa userId):",
        error,
      );
    }

    // Insert — P2002 accessToken (tabrakan acak yang nyaris mustahil) di-retry
    // dengan token baru; P2002 lain dipetakan ke alasan yang tepat.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const accessToken = generateAffiliateAccessToken();
      try {
        const created = await prisma.affiliate.create({
          data: {
            name,
            email,
            phone,
            refCode,
            userId,
            accessToken,
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
          bankName: created.bankName,
          bankAccountNo: created.bankAccountNo,
          bankAccountName: created.bankAccountName,
          accessToken: created.accessToken,
          createdAt: created.createdAt.toISOString(),
        };
        console.log(
          `[UnitKu Affiliate Admin] Mitra baru "${refCode}" (${name}, WA ${phone})` +
            `${userId ? " — terhubung user Supabase" : " — tanpa akun (akses portal via magic-link)"}.`,
        );
        return {
          ok: true,
          linkedUser: Boolean(userId),
          phone,
          email: created.email,
          accessToken: created.accessToken ?? accessToken,
          partner,
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const target = error.meta?.target;
          const targetText = Array.isArray(target)
            ? target.join(",")
            : typeof target === "string"
              ? target
              : "";
          if (/accesstoken|access_token/i.test(targetText) && attempt === 0) {
            continue; // tabrakan token — coba sekali lagi dgn token baru
          }
          if (/userid/i.test(targetText)) {
            return { ok: false, reason: "user-linked" };
          }
          return { ok: false, reason: "ref-code-taken" };
        }
        throw error;
      }
    }
    return { ok: false, reason: "error", detail: "Gagal membuat token portal." };
  } catch (error) {
    console.error("[UnitKu Affiliate Admin] Gagal mendaftarkan mitra:", error);
    const detail = describePrismaError(error);
    return { ok: false, reason: "error", ...(detail ? { detail } : {}) };
  }
}
