// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — fetch dengan pengaman waktu (anti-hang)
//
// Masalah yang diselesaikan: bila server/API tidak pernah menjawab (database
// Supabase menggantung, serverless cold-start macet, koneksi "hitam"), fetch
// browser TIDAK pernah settle → UI terjebak loader selamanya (infinite
// loading). Helper ini membatalkan permintaan lewat AbortController setelah
// batas waktu, sehingga pemanggil SELALU menerima hasil atau error.
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchWithTimeoutOptions extends RequestInit {
  /** Batas waktu dalam ms (default 15.000) */
  timeoutMs?: number;
}

export const DEFAULT_TIMEOUT_MS = 15_000;

/** fetch yang dijamin settle: sukses, HTTP error, ATAU error timeout */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** true bila error berasal dari pembatalan timeout (AbortError) */
export function isTimeoutError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "AbortError" || err.name === "TimeoutError")
  );
}
