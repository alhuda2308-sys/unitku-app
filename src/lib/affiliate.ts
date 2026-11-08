// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sistem affiliate, Tahap 2: Referral Tracking (helper edge-safe)
//
// Alur atribusi:
//   1. Pemilik affiliate menyebarkan link  https://unitku.my.id/?ref=budi123
//   2. Middleware (src/middleware.ts) menangkap query `ref`, memvalidasinya
//      lewat sanitizeAffiliateRef(), lalu menyimpannya ke cookie `unitku_ref`
//      (path "/", umur 30 hari, httpOnly:false, sameSite "lax" — last-click).
//   3. Saat pengunjung checkout, kode referral dibaca lagi:
//        - Client (form checkout): getAffiliateRef()        ← file ini
//        - Server (route handler / RSC): getAffiliateRefServer()
//          → src/lib/affiliate-server.ts (next/headers, tidak edge-safe)
//
// File ini EDGE-SAFE (tanpa next/headers) — aman diimpor oleh middleware.
// ─────────────────────────────────────────────────────────────────────────────

/** Nama cookie yang menyimpan kode referral afiliasi. */
export const AFFILIATE_REF_COOKIE = "unitku_ref";

/** Masa aktif cookie referral: 30 hari (dalam detik). */
export const AFFILIATE_REF_MAX_AGE = 60 * 60 * 24 * 30;

/** Nama query parameter pada link referral. */
export const AFFILIATE_QUERY_PARAM = "ref";

/**
 * Komisi afiliasi per penjualan lisensi seumur hidup (IDR).
 * Dicatat webhook Mayar (payment.received) ke tabel affiliate_commissions
 * dan ditambahkan ke affiliates.totalEarnings — lihat affiliate-commission.ts.
 */
export const AFFILIATE_COMMISSION_IDR = 150_000;

/**
 * Validasi + normalisasi kode referral dari query param / cookie.
 *
 * Mengembalikan null bila kosong, lebih dari 64 karakter, atau memuat
 * karakter di luar [A-Za-z0-9_-] — mencegah cookie pollution, spoofing
 * berformat aneh, dan injection lewat header Set-Cookie.
 * Ref tidak valid TIDAK menghapus cookie lama yang masih sah.
 */
export function sanitizeAffiliateRef(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value || value.length > 64) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  return value;
}

/**
 * Tempel kode referral dari cookie `unitku_ref` sebagai query param pada URL
 * checkout Mayar STATIS (payment link) — dipakai tombol pembayaran yang TIDAK
 * melalui POST /api/checkout (fallback halaman /checkout & gerbang lisensi)
 * agar data referral tetap terbawa: …?ref=<kode>&affiliate_ref=<kode>.
 *
 * Tanpa ref (cookie kosong) → URL dikembalikan apa adanya. URL tidak valid /
 * relatif → dikembalikan apa adanya (helper TIDAK pernah melempar).
 */
export function appendAffiliateRefToUrl(
  url: string,
  ref?: string | null,
): string {
  const code = sanitizeAffiliateRef(ref === undefined ? getAffiliateRef() : ref);
  if (!code || !url) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set(AFFILIATE_QUERY_PARAM, code);
    parsed.searchParams.set("affiliate_ref", code);
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Baca kode referral afiliasi dari cookie — sisi CLIENT (browser).
 *
 * Cookie sengaja dibuat httpOnly:false oleh middleware agar form checkout
 * (client component) dapat membacanya langsung tanpa round-trip server.
 * Aman dipanggil saat SSR → mengembalikan null (tidak pernah melempar).
 *
 * Contoh:
 *   const ref = getAffiliateRef();
 *   if (ref) body.ref = ref; // kirim ke /api/checkout (Tahap 3)
 */
export function getAffiliateRef(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${AFFILIATE_REF_COOKIE}=([^;]*)`),
  );
  if (!match) return null;
  const value = match[1];
  try {
    return decodeURIComponent(value) || null;
  } catch {
    return value || null; // nilai mentah tetap valid — pakai apa adanya
  }
}
