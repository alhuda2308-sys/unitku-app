// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Konstanta & builder murni fitur Trial 3 Hari (client-safe)
//
// Dipakai BERSAMA oleh:
//   • src/lib/owner-trial.ts        (server-only: DB + API)
//   • src/components/affiliate/trial-generator-card.tsx (dashboard mitra)
//   • src/components/trial/*        (portal trial owner)
// TANPA import server (prisma dsb.) — aman untuk "use client".
// ─────────────────────────────────────────────────────────────────────────────

/** Durasi trial — 3 hari / 72 jam */
export const TRIAL_DURATION_HOURS = 72;

/** Basis URL publik halaman trial — dipakai di pesan WA & list dashboard */
export const TRIAL_PUBLIC_BASE_URL = "https://unitku.my.id/trial";

/** URL portal trial dari token (trial_id) — url-encoded agar aman dikirim */
export function buildTrialUrl(token: string): string {
  return `${TRIAL_PUBLIC_BASE_URL}?token=${encodeURIComponent(token)}`;
}

export type OwnerTrialStatus = "PENDING" | "ACTIVE" | "LOCKED";

/** Normalisasi status mentah DB → union type aman */
export function normalizeTrialStatus(raw: string): OwnerTrialStatus {
  const key = raw.trim().toUpperCase();
  return key === "ACTIVE" || key === "LOCKED" ? key : "PENDING";
}

/** Label + kelas badge status trial — konsisten dashboard & portal */
export const TRIAL_STATUS_META: Record<
  OwnerTrialStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Belum Dibuka",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  ACTIVE: {
    label: "Trial Aktif",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  LOCKED: {
    label: "Terkunci",
    className: "border-zinc-300 bg-zinc-100 text-zinc-600",
  },
};

/**
 * Draf pesan WA siap kirim ke owner — template resmi fitur trial:
 * "Halo Pak/Bu [Nama Owner], ini link akses uji coba gratis …"
 */
export function buildTrialWaMessage(params: {
  ownerName: string;
  propertyName: string | null;
  trialUrl: string;
}): string {
  const properti = params.propertyName?.trim() || "properti Anda";
  return `Halo Pak/Bu ${params.ownerName}, ini link akses uji coba gratis sistem UnitKu selama 3 hari khusus untuk ${properti}. Silakan dicoba login dan atur kamar di sini ya: ${params.trialUrl}`;
}
