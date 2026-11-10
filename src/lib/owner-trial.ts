// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Generator Link Trial 3 Hari untuk Owner (server-only)
//
// Fitur portal mitra: affiliator membuat link trial pribadi utk pemilik
// kost/kontrakan → dikirim via WhatsApp → owner membuka /trial?token=<id>
// → trial 3 hari (72 jam) aktif otomatis → lewat batas → PAYWALL yang
// mengarah ke checkout mitra pembuat (?ref=<refCode>) sehingga komisi
// Rp150.000 tetap tercatat untuk mitra yang memulainya.
//
// Lifecycle status (model OwnerTrial — prisma/schema.prisma):
//   PENDING → ACTIVE (klik pertama owner; trialStartedAt dicatat SEKALI,
//   idempoten walau halaman di-refresh) → LOCKED (lewat 72 jam).
//
// Penguncian LAZY: tidak ada cron — status LOCKED ditegakkan SETIAP KALI
// data dibaca (portal & status API): ACTIVE + now > trialExpiresAt → di-update
// ke LOCKED. Aman untuk serverless (Vercel).
//
// Self-heal skema: produksi sering membuat tabel manual/terlambat, jadi
// ensureOwnerTrialTable() menjamin tabel + index ada (pola identik dengan
// ensureAffiliateTables di src/lib/affiliate-commission.ts) — CREATE TABLE
// IF NOT EXISTS + CREATE INDEX IF NOT EXISTS, idempoten, di-cache per proses.
// Nama kolom camelCase TANPA @map — identifier di-quote persis.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { normalizeWaPhone } from "@/lib/checkout-validation";
import {
  TRIAL_DURATION_HOURS,
  buildTrialUrl,
  normalizeTrialStatus,
  type OwnerTrialStatus,
} from "@/lib/trial-shared";

// ── Self-heal tabel owner_trials ─────────────────────────────────────────────

let ownerTrialTableReady: Promise<void> | null = null;

function bootstrapOwnerTrialTable(): Promise<void> {
  return (async () => {
    const steps: Array<{ label: string; sql: string }> = [
      {
        label: "create table owner_trials",
        sql: `CREATE TABLE IF NOT EXISTS "owner_trials" (
               "id"              TEXT         NOT NULL,
               "partnerId"       TEXT         NOT NULL,
               "ownerName"       TEXT         NOT NULL,
               "ownerWhatsapp"   TEXT         NOT NULL,
               "propertyName"    TEXT,
               "status"          TEXT         NOT NULL DEFAULT 'PENDING',
               "trialStartedAt"  TIMESTAMP(3),
               "trialExpiresAt"  TIMESTAMP(3),
               "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
               "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
               CONSTRAINT "owner_trials_pkey" PRIMARY KEY ("id")
             )`,
      },
      {
        label: "index owner_trials.partnerId",
        sql: `CREATE INDEX IF NOT EXISTS "owner_trials_partnerId_idx" ON "owner_trials"("partnerId")`,
      },
      {
        label: "index owner_trials.createdAt",
        sql: `CREATE INDEX IF NOT EXISTS "owner_trials_createdAt_idx" ON "owner_trials"("createdAt")`,
      },
    ];
    for (const step of steps) {
      try {
        await prisma.$executeRawUnsafe(step.sql);
      } catch (error) {
        console.error(
          `[UnitKu Trial] Self-heal skema gagal (${step.label}, dilewati):`,
          error,
        );
      }
    }
  })();
}

/** Jaminan tabel siap — di-cache per proses (pola ensureAffiliateTables). */
export async function ensureOwnerTrialTable(): Promise<void> {
  if (!ownerTrialTableReady) {
    ownerTrialTableReady = bootstrapOwnerTrialTable().catch((error) => {
      // Reset cache agar request berikutnya mencoba ulang (DB bisa pulih).
      ownerTrialTableReady = null;
      throw error;
    });
  }
  return ownerTrialTableReady;
}

// ── Tipe publik ──────────────────────────────────────────────────────────────

export type {
  OwnerTrialStatus,
} from "@/lib/trial-shared";
export {
  TRIAL_DURATION_HOURS,
  buildTrialWaMessage,
  buildTrialUrl,
} from "@/lib/trial-shared";

/** Baris trial utk list dashboard mitra (ISO string — aman dikirim ke client) */
export interface OwnerTrialRow {
  id: string; // token URL
  ownerName: string;
  // Nomor WA pemilik (62…) — dipakai tombol "Follow-up WA" di riwayat saat
  // status LOCKED: buka wa.me dgn draf persuasi aktivasi lisensi.
  ownerWhatsapp: string;
  propertyName: string | null;
  status: OwnerTrialStatus;
  // Kode referral mitra pembuat — tombol follow-up menyisipkan link checkout
  // /checkout?ref=<refCode> agar komisi tetap tercatat atas nama mitra.
  partnerRefCode: string;
  createdAt: string; // ISO
  trialStartedAt: string | null; // ISO
  trialExpiresAt: string | null; // ISO
  trialUrl: string;
}

/** Status trial utk portal /trial (halaman owner + API status) */
export interface OwnerTrialState {
  ownerName: string;
  propertyName: string | null;
  status: OwnerTrialStatus;
  trialStartedAt: string | null; // ISO
  trialExpiresAt: string | null; // ISO
  // Kode referral mitra pembuat — paywall memakainya utk link checkout
  // /checkout?ref=<refCode> agar komisi tercatat atas nama mitra tsb.
  partnerRefCode: string;
}

export interface CreateOwnerTrialInput {
  ownerName: string;
  ownerWhatsapp: string; // mentah dari form — dinormalisasi di sini
  propertyName?: string | null;
}

export type CreateOwnerTrialResult =
  | { ok: true; trial: OwnerTrialRow }
  | {
      ok: false;
      reason: "not-found" | "invalid" | "error";
      error?: string;
    };

export type OwnerTrialListResult =
  | { ok: true; trials: OwnerTrialRow[] }
  | { ok: false; reason: "not-found" | "error" };

export type OwnerTrialStateResult =
  | { ok: true; state: OwnerTrialState }
  | { ok: false; reason: "not-found" | "error" };

// ── Helper ───────────────────────────────────────────────────────────────────

/** Bentuk select bersama (satu tempat agar field tidak pernah meleset) */
const TRIAL_SELECT = {
  id: true,
  partnerId: true,
  ownerName: true,
  ownerWhatsapp: true,
  propertyName: true,
  status: true,
  trialStartedAt: true,
  trialExpiresAt: true,
  createdAt: true,
} as const;

type TrialDbRow = {
  id: string;
  partnerId: string;
  ownerName: string;
  ownerWhatsapp: string;
  propertyName: string | null;
  status: string;
  trialStartedAt: Date | null;
  trialExpiresAt: Date | null;
  createdAt: Date;
};

function toRow(trial: TrialDbRow, partnerRefCode: string): OwnerTrialRow {
  return {
    id: trial.id,
    ownerName: trial.ownerName,
    ownerWhatsapp: trial.ownerWhatsapp,
    propertyName: trial.propertyName,
    status: normalizeTrialStatus(trial.status),
    partnerRefCode,
    createdAt: trial.createdAt.toISOString(),
    trialStartedAt: trial.trialStartedAt?.toISOString() ?? null,
    trialExpiresAt: trial.trialExpiresAt?.toISOString() ?? null,
    trialUrl: buildTrialUrl(trial.id),
  };
}

/**
 * Lazy-lock: ACTIVE yang sudah lewat 72 jam dipaksa LOCKED (sekali, lalu
 * tersimpan). Dipanggil SETIAP pembacaan state — tanpa ini trial tak pernah
 * terkunci karena tidak ada cron di serverless.
 */
async function enforceLazyLock(
  trial: TrialDbRow,
): Promise<TrialDbRow> {
  if (
    normalizeTrialStatus(trial.status) === "ACTIVE" &&
    trial.trialExpiresAt &&
    trial.trialExpiresAt.getTime() <= Date.now()
  ) {
    try {
      await prisma.ownerTrial.update({
        where: { id: trial.id },
        data: { status: "LOCKED" },
      });
    } catch (error) {
      // Kegagalan update TIDAK menggagalkan pembacaan — status di memori
      // sudah LOCKED (pembacaan berikutnya mencoba lagi).
      console.error("[UnitKu Trial] Gagal mengunci trial lewat batas:", error);
    }
    return { ...trial, status: "LOCKED" };
  }
  return trial;
}

/** Validasi input form mitra — kembalikan pesan error ramah utk ditampilkan */
export function validateOwnerTrialInput(
  input: CreateOwnerTrialInput,
): string | null {
  const name = input.ownerName.trim();
  if (name.length < 2) {
    return "Nama pemilik wajib diisi (minimal 2 karakter).";
  }
  if (name.length > 80) return "Nama pemilik terlalu panjang (maks 80).";
  const phone = normalizeWaPhone(input.ownerWhatsapp);
  if (!/^62[0-9]{8,13}$/.test(phone)) {
    return "Nomor WhatsApp pemilik belum sesuai — mulai dengan 08 atau 62 ya.";
  }
  const prop = (input.propertyName ?? "").trim();
  if (prop.length > 120) return "Nama properti terlalu panjang (maks 120).";
  return null;
}

// ── Resolusi mitra (ownership server-side — pola affiliate-portal.ts) ────────

async function findAffiliateIdByUser(
  userId: string,
): Promise<string | null> {
  const affiliate = await prisma.affiliate.findUnique({
    where: { userId },
    select: { id: true },
  });
  return affiliate?.id ?? null;
}

async function findAffiliateIdByToken(
  rawToken: string | null | undefined,
): Promise<string | null> {
  const token = rawToken?.trim() ?? "";
  if (!token || token.length > 128) return null;
  const affiliate = await prisma.affiliate.findUnique({
    where: { accessToken: token },
    select: { id: true },
  });
  return affiliate?.id ?? null;
}

// ── Buat & daftar trial (dipakai API /api/affiliate/trial) ───────────────────

async function createOwnerTrialForPartner(
  partnerId: string,
  input: CreateOwnerTrialInput,
): Promise<CreateOwnerTrialResult> {
  const invalid = validateOwnerTrialInput(input);
  if (invalid) return { ok: false, reason: "invalid", error: invalid };
  try {
    await ensureOwnerTrialTable();
    const trial = await prisma.ownerTrial.create({
      data: {
        partnerId,
        ownerName: input.ownerName.trim().slice(0, 80),
        ownerWhatsapp: normalizeWaPhone(input.ownerWhatsapp),
        propertyName: (input.propertyName ?? "").trim().slice(0, 120) || null,
        // status default PENDING — startedAt/expiresAt diisi saat klik pertama
      },
      select: TRIAL_SELECT,
    });
    return {
      ok: true,
      trial: toRow(trial, await getPartnerRefCode(partnerId)),
    };
  } catch (error) {
    console.error("[UnitKu Trial] Gagal membuat trial:", error);
    return { ok: false, reason: "error" };
  }
}

/** Buat trial utk mitra yang sedang LOGIN (ownership by userId sesi). */
export async function createOwnerTrialForUser(
  userId: string,
  input: CreateOwnerTrialInput,
): Promise<CreateOwnerTrialResult> {
  try {
    await ensureOwnerTrialTable();
    const partnerId = await findAffiliateIdByUser(userId);
    if (!partnerId) return { ok: false, reason: "not-found" };
    return await createOwnerTrialForPartner(partnerId, input);
  } catch (error) {
    console.error("[UnitKu Trial] createOwnerTrialForUser gagal:", error);
    return { ok: false, reason: "error" };
  }
}

/** Buat trial via MAGIC-LINK token (mitra tanpa akun login). */
export async function createOwnerTrialForToken(
  rawToken: string | null | undefined,
  input: CreateOwnerTrialInput,
): Promise<CreateOwnerTrialResult> {
  try {
    await ensureOwnerTrialTable();
    const partnerId = await findAffiliateIdByToken(rawToken);
    if (!partnerId) return { ok: false, reason: "not-found" };
    return await createOwnerTrialForPartner(partnerId, input);
  } catch (error) {
    console.error("[UnitKu Trial] createOwnerTrialForToken gagal:", error);
    return { ok: false, reason: "error" };
  }
}

const TRIAL_LIST_LIMIT = 30;

async function listOwnerTrialsForPartner(
  partnerId: string,
): Promise<OwnerTrialListResult> {
  try {
    await ensureOwnerTrialTable();
    const trials = await prisma.ownerTrial.findMany({
      where: { partnerId },
      orderBy: { createdAt: "desc" },
      take: TRIAL_LIST_LIMIT,
      select: TRIAL_SELECT,
    });
    // Status di-read-back lewat lazy-lock ringan (tanpa update per baris —
    // cukup hitung efektif di memori agar badge dashboard selalu benar).
    const now = Date.now();
    const partnerRefCode = await getPartnerRefCode(partnerId);
    return {
      ok: true,
      trials: trials.map((t) => {
        const row = toRow(t, partnerRefCode);
        if (
          row.status === "ACTIVE" &&
          row.trialExpiresAt &&
          new Date(row.trialExpiresAt).getTime() <= now
        ) {
          row.status = "LOCKED";
        }
        return row;
      }),
    };
  } catch (error) {
    console.error("[UnitKu Trial] Gagal memuat daftar trial:", error);
    return { ok: false, reason: "error" };
  }
}

/** Daftar trial milik mitra yang sedang LOGIN. */
export async function listOwnerTrialsForUser(
  userId: string,
): Promise<OwnerTrialListResult> {
  try {
    await ensureOwnerTrialTable();
    const partnerId = await findAffiliateIdByUser(userId);
    if (!partnerId) return { ok: false, reason: "not-found" };
    return await listOwnerTrialsForPartner(partnerId);
  } catch (error) {
    console.error("[UnitKu Trial] listOwnerTrialsForUser gagal:", error);
    return { ok: false, reason: "error" };
  }
}

/** Daftar trial via MAGIC-LINK token. */
export async function listOwnerTrialsForToken(
  rawToken: string | null | undefined,
): Promise<OwnerTrialListResult> {
  try {
    await ensureOwnerTrialTable();
    const partnerId = await findAffiliateIdByToken(rawToken);
    if (!partnerId) return { ok: false, reason: "not-found" };
    return await listOwnerTrialsForPartner(partnerId);
  } catch (error) {
    console.error("[UnitKu Trial] listOwnerTrialsForToken gagal:", error);
    return { ok: false, reason: "error" };
  }
}

// ── Aktivasi & status (dipakai halaman /trial + API /api/trial) ──────────────

function toState(trial: TrialDbRow, partnerRefCode: string): OwnerTrialState {
  return {
    ownerName: trial.ownerName,
    propertyName: trial.propertyName,
    status: normalizeTrialStatus(trial.status),
    trialStartedAt: trial.trialStartedAt?.toISOString() ?? null,
    trialExpiresAt: trial.trialExpiresAt?.toISOString() ?? null,
    partnerRefCode,
  };
}

/**
 * RefCode mitra pembuat — lookup terpisah (tanpa relasi schema) agar query
 * tetap jalan di produksi yang tabelnya dibuat self-heal tanpa FK.
 */
async function getPartnerRefCode(
  partnerId: string,
): Promise<string> {
  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: partnerId },
      select: { refCode: true },
    });
    return affiliate?.refCode ?? "";
  } catch (error) {
    console.error(
      "[UnitKu Trial] Gagal membaca refCode mitra (dilewati):",
      error,
    );
    return "";
  }
}

/**
 * Aktivasi trial saat owner PERTAMA kali membuka link /trial?token=…
 * Idempoten: hanya baris PENDING yang mendapat startedAt/expiresAt baru —
 * refresh berulang TIDAK pernah memperpanjang masa trial. Trial LOCKED
 * tetap LOCKED. Selalu menjalankan lazy-lock sebelum mengembalikan status.
 */
export async function activateOwnerTrial(
  rawToken: string | null | undefined,
): Promise<OwnerTrialStateResult> {
  const token = rawToken?.trim() ?? "";
  if (!token || token.length > 64) return { ok: false, reason: "not-found" };
  try {
    await ensureOwnerTrialTable();
    const trial = await prisma.ownerTrial.findUnique({
      where: { id: token },
      select: TRIAL_SELECT,
    });
    if (!trial) return { ok: false, reason: "not-found" };

    let current: TrialDbRow = trial;
    if (normalizeTrialStatus(current.status) === "PENDING") {
      const now = new Date();
      const expires = new Date(
        now.getTime() + TRIAL_DURATION_HOURS * 60 * 60 * 1000,
      );
      try {
        current = await prisma.ownerTrial.update({
          where: { id: token, status: "PENDING" }, // guard anti-refresh: hanya PENDING
          data: {
            status: "ACTIVE",
            trialStartedAt: now,
            trialExpiresAt: expires,
          },
          select: TRIAL_SELECT,
        });
      } catch (error) {
        // Balapan dengan request lain (refresh cepat) — baris sudah aktif;
        // baca ulang kondisi terkini alih-alih gagal.
        console.error(
          "[UnitKu Trial] Aktivasi berlomba (dibaca ulang):",
          error,
        );
        const reread = await prisma.ownerTrial.findUnique({
          where: { id: token },
          select: TRIAL_SELECT,
        });
        if (!reread) return { ok: false, reason: "not-found" };
        current = reread;
      }
    }

    current = await enforceLazyLock(current);
    return {
      ok: true,
      state: toState(current, await getPartnerRefCode(trial.partnerId)),
    };
  } catch (error) {
    console.error("[UnitKu Trial] Gagal mengaktifkan trial:", error);
    return { ok: false, reason: "error" };
  }
}

/**
 * Baca status trial TANPA mengaktifkan (dipakai polling status) — lazy-lock
 * tetap ditegakkan agar countdown & paywall selalu sinkron dengan server.
 */
export async function getOwnerTrialState(
  rawToken: string | null | undefined,
): Promise<OwnerTrialStateResult> {
  const token = rawToken?.trim() ?? "";
  if (!token || token.length > 64) return { ok: false, reason: "not-found" };
  try {
    await ensureOwnerTrialTable();
    const trial = await prisma.ownerTrial.findUnique({
      where: { id: token },
      select: TRIAL_SELECT,
    });
    if (!trial) return { ok: false, reason: "not-found" };
    const current = await enforceLazyLock(trial);
    return {
      ok: true,
      state: toState(current, await getPartnerRefCode(trial.partnerId)),
    };
  } catch (error) {
    console.error("[UnitKu Trial] Gagal membaca status trial:", error);
    return { ok: false, reason: "error" };
  }
}
