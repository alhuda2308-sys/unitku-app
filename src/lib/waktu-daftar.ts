// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Format waktu pendaftaran (dipakai kolom "Tanggal Daftar"
// Panel Super Admin /admin)
//
// Semua format MEMBACA ZONA WAKTU LOKAL PERANGKAT (browser admin) — TANPA
// prop `timeZone` yang dipaksakan pada Intl. Dengan begitu tampilan otomatis
// mengikuti perangkat: admin di Kalimantan (WITA) melihat "WITA", admin di
// Jakarta (WIB) otomatis melihat "WIB", dst. — murni client-side dinamis.
// ─────────────────────────────────────────────────────────────────────────────

/** Baris 1 — "05 Okt 2026" (zona waktu lokal perangkat, bulan singkat id-ID) */
const tanggalFmt = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Baris 2 — jam:menit + singkatan zona waktu (via formatToParts).
 *  `hourCycle: "h23"` → 24-jam stabil ("00:31", bukan "24:31"); tanpa prop
 *  `timeZone` agar mengikuti zona lokal browser admin secara dinamis. */
const jamFmt = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZoneName: "short",
});

/** Peta IANA zona waktu Indonesia → singkatan resmi WIB/WITA/WIT.
 *  Fallback bila runtime hanya memberi "GMT+7" dari Intl (umum pada sebagian
 *  engine) padahal perangkat jelas berada di zona waktu Indonesia. */
const ZONA_INDONESIA: Record<string, string> = {
  "Asia/Jakarta": "WIB", // Jawa, Sumatra, Kalbar, Kalteng
  "Asia/Pontianak": "WIB",
  "Asia/Makassar": "WITA", // Kaltim/Kaltara/Kalsel, Bali, Nusa Tenggara, Sulawesi
  "Asia/Ujung_Pandang": "WITA", // alias lama Asia/Makassar
  "Asia/Jayapura": "WIT", // Maluku & Papua
};

function parseIso(iso: string | null): Date | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** Singkatan zona waktu LOKAL perangkat: "WIB"/"WITA"/"WIT" di Indonesia,
 *  singkatan Intl baku di luar negeri (mis. "GMT+7"), "" bila tak tersedia. */
function singkatanZonaLokal(date: Date): string {
  const zonaIntl = jamFmt
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  if (zonaIntl && !/^GMT/i.test(zonaIntl)) return zonaIntl;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  return ZONA_INDONESIA[tz] ?? zonaIntl ?? "";
}

/** Baris 1 — "05 Okt 2026" mengikuti zona lokal perangkat; null/invalid → "—" */
export function formatTanggalDaftar(iso: string | null): string {
  const date = parseIso(iso);
  return date ? tanggalFmt.format(date) : "—";
}

/** Baris 2 — "10:31 WITA": jam:menit + singkatan zona waktu LOKAL perangkat
 *  admin (dinamis, bukan hardcode). null/invalid → null ("—" di pemanggil). */
export function formatJamDaftar(iso: string | null): string | null {
  const date = parseIso(iso);
  if (!date) return null;
  const parts = jamFmt.formatToParts(date);
  const ambil = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  const jam = ambil("hour");
  const menit = ambil("minute");
  if (!jam || !menit) return null;
  const zona = singkatanZonaLokal(date);
  return `${jam}:${menit}${zona ? ` ${zona}` : ""}`;
}

/** Tooltip hover (atribut title) — timestamp lengkap id-ID, zona lokal:
 *  "5 Oktober 2026 pukul 10.31.22" (detik ikut tampil). null → undefined. */
export function timestampLengkap(iso: string | null): string | undefined {
  const date = parseIso(iso);
  return date ? date.toLocaleString("id-ID") : undefined;
}
