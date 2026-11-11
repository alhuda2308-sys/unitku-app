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

/** Basis URL publik halaman checkout lisensi — paywall & follow-up mitra */
export const CHECKOUT_PUBLIC_BASE_URL = "https://unitku.my.id/checkout";

/** URL checkout lisensi dengan atribusi mitra (?ref=<refCode>) — komisi aman */
export function buildCheckoutUrl(refCode: string): string {
  const code = refCode.trim();
  return code
    ? `${CHECKOUT_PUBLIC_BASE_URL}?ref=${encodeURIComponent(code)}`
    : CHECKOUT_PUBLIC_BASE_URL;
}

/**
 * Cookie sesi trial di browser (BUKAN cookie auth — akses /dashboard tetap
 * dijaga cookie sesi demo) — berisi token OwnerTrial. Dipakai untuk:
 *   1. Banner "Mode Uji Coba" + paywall di dashboard (fetch /api/trial/state).
 *   2. Kunci persistensi data sesi trial (rooms/tagihan/kas per token —
 *      src/lib/trial-session-store.ts) agar data yang diketik owner bertahan
 *      antar reload selama trial berjalan.
 * Tanpa cookie ini dashboard tampil normal (pemilik akun riil & pengunjung
 * /demo tak terpengaruh).
 */
export const TRIAL_COOKIE = "unitku_trial";

/** Umur cookie trial — 7 hari (72 jam trial + buffer) lalu hilang sendiri */
export const TRIAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * Tujuan masuk dashboard mode trial — penanda ?trial=1 (TANPA ?demo=1).
 * Dashboard trial = FRESH STATE: tanpa dataset demo (12 kamar "Kost Griya
 * Pratama" dsb.), pengaturan identitas bersih — owner memasukkan data kamar/
 * kos mereka sendiri dari nol layaknya akun riil baru. Dataset yang dibuat
 * owner tersimpan per-token di perangkat (lihat src/lib/trial-session-store.ts).
 */
export const TRIAL_DASHBOARD_URL = "/dashboard?trial=1";

/**
 * Email sesi demo khusus TRIAL — /api/trial/enter memasang cookie sesi demo
 * dengan email ini, sedangkan CTA /demo memakai "demo@unitku.id". Dashboard
 * memilah keduanya lewat /api/auth/me (email sesi) agar akun trial mendapat
 * dashboard kosong, bukan dataset demo.
 */
export const TRIAL_SESSION_EMAIL = "trial@unitku.id";

/** Apakah email sesi berasal dari sesi TRIAL (bukan demo CTA / akun riil)? */
export function isTrialSessionEmail(
  email: string | null | undefined,
): boolean {
  return (email ?? "").trim().toLowerCase() === TRIAL_SESSION_EMAIL;
}

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

/**
 * Label + kelas badge status trial — kolom status tabel riwayat dashboard
 * mitra. LOCKED memakai rose agar baris "perlu follow-up" langsung terlihat.
 */
export const TRIAL_STATUS_META: Record<
  OwnerTrialStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Pending",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  ACTIVE: {
    label: "Aktif",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  LOCKED: {
    label: "Terkunci / Expired",
    className: "border-rose-200 bg-rose-50 text-rose-700",
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

/**
 * Draf pesan WA FOLLOW-UP utk owner yang trialnya sudah berakhir (LOCKED):
 * "Halo Pak/Bu [Nama Owner], masa uji coba 3 hari aplikasi UnitKu untuk
 * properti [Nama Properti] sudah selesai dan saat ini sistem terkunci
 * sementara. Ingin data properti tetap aman dan melanjutkan kelola kost
 * tanpa batas? Silakan aktifkan lisensi permanennya lewat link khusus ini
 * ya: <checkoutUrl>"
 */
export function buildTrialFollowUpWaMessage(params: {
  ownerName: string;
  propertyName: string | null;
  checkoutUrl: string;
}): string {
  const properti = params.propertyName?.trim() || "properti Anda";
  return `Halo Pak/Bu ${params.ownerName}, masa uji coba 3 hari aplikasi UnitKu untuk properti ${properti} sudah selesai dan saat ini sistem terkunci sementara. Ingin data properti tetap aman dan melanjutkan kelola kost tanpa batas? Silakan aktifkan lisensi permanennya lewat link khusus ini ya: ${params.checkoutUrl}`;
}

/**
 * Link chat WhatsApp (wa.me) dgn draf pesan ter-encode — nomor disanitasi
 * ke digit internasional (0/8 → 62) agar deep-link selalu valid.
 */
export function buildWaChatLink(phone: string, message: string): string {
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Baca token trial dari cookie di sisi CLIENT — null bila tidak ada/beraksi
 * bukan browser (SSR). Dipakai TrialBanner di dashboard.
 */
export function readTrialTokenClient(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${TRIAL_COOKIE}=`));
  const value = match?.slice(TRIAL_COOKIE.length + 1).trim() ?? "";
  return value || null;
}

/**
 * Format sisa trial versi RINGKAS utk banner dashboard — "2 hari 5 jam",
 * "5 jam 12 menit", "12 menit", "43 detik" (tanpa detik di level jam/hari
 * agar teks banner pendek & tidak berkedip tiap detik).
 */
export function formatTrialRemaining(ms: number): string {
  if (ms <= 0) return "0 menit";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (d > 0) return `${d} hari ${h} jam`;
  if (h > 0) return `${h} jam ${m} menit`;
  if (m > 0) return `${m} menit`;
  return `${total} detik`;
}
