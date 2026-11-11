// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Pembatas laju sederhana berbasis memori (server-only)
//
// Dipakai endpoint sensitif (mis. POST /api/affiliate/login): batasi jumlah
// percobaan per kunci (umumnya IP klien) dalam jendela waktu berjalan.
// Penyimpanan di memori proses — cukup untuk satu instansi Node/Vercel,
// tanpa dependensi eksternal; reset otomatis saat proses baru (deploy).
// ─────────────────────────────────────────────────────────────────────────────

interface RateBucket {
  count: number;
  /** Epoch ms — akhir jendela berjalan */
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

/** Jarak pembersihan bucket kedaluwarsa — hindari pertumbuhan Map tanpa batas */
const SWEEP_EVERY_MS = 5 * 60 * 1000;
let lastSweepAt = 0;

function sweepExpired(now: number): void {
  if (now - lastSweepAt < SWEEP_EVERY_MS) return;
  lastSweepAt = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Cek & catat satu percobaan untuk kunci tertentu.
 * `true`  → diizinkan (di bawah batas), hitungan bertambah.
 * `false` → diblokir (batas terlampaui dalam jendela berjalan).
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  sweepExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= maxAttempts) return false;
  bucket.count += 1;
  return true;
}
