// ── Rentang periode fleksibel Buku Kas (Task 153) ────────────────────────────
// Filter periode Buku Kas: preset cepat (hari/minggu/bulan/tahun), pilih bulan
// khusus, dan rentang tanggal kustom. Murni fungsi tanggal lokal (konsisten
// WIB dengan sisa aplikasi) — tanpa dependensi UI, aman untuk client component.

import { MONTH_NAMES } from "./kost-data";
import { periodLabelFromKey, periodShortLabel } from "./kost-invoices";

export type PeriodKind =
  | "hari-ini"
  | "7-hari"
  | "bulan-ini"
  | "bulan-lalu"
  | "tahun-ini"
  | "1-tahun"
  | "semua"
  | "bulan" // satu bulan spesifik (sub-menu "Pilih Bulan Khusus")
  | "kustom"; // rentang tanggal manual (Dari–Sampai)

export interface PeriodRange {
  kind: PeriodKind;
  /** Batas inklusif ISO "yyyy-mm-dd" — null = tanpa batas (Semua Waktu) */
  startISO: string | null;
  endISO: string | null;
  /** "yyyy-mm" — tersedia untuk semua rentang yang tepat satu bulan */
  monthKey?: string;
}

/** ISO "yyyy-mm-dd" → 20261106 (komparabel dengan CashEntry.dateSort) */
export function isoToSort(iso: string): number {
  return Number(iso.replace(/-/g, ""));
}

function dateFromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function isoFromDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function lastDayOfMonth(year: number, monthIdx: number): number {
  return new Date(year, monthIdx + 1, 0).getDate();
}

/** "2026-11-06" → "6 Nov" / "6 Nov 2026" */
function isoShort(iso: string, withYear: boolean): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTH_NAMES[m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** Dua tanggal → "6 Nov – 6 Des 2026" (tahun ditulis sekali bila sama) */
function spanLabel(aISO: string, bISO: string): string {
  const sameYear = aISO.slice(0, 4) === bISO.slice(0, 4);
  return `${isoShort(aISO, !sameYear)} – ${isoShort(bISO, true)}`;
}

/** Default Buku Kas: bulan berjalan (perilaku lama dipertahankan) */
export function defaultPeriod(now: Date = new Date()): PeriodRange {
  return presetRange("bulan-ini", now);
}

/** Preset cepat → rentang konkret (dihitung saat dipilih, bukan saat mount) */
export function presetRange(
  kind: Exclude<PeriodKind, "bulan" | "kustom">,
  now: Date = new Date(),
): PeriodRange {
  const today = isoFromDate(now);
  switch (kind) {
    case "hari-ini":
      return { kind, startISO: today, endISO: today };
    case "7-hari": {
      // 7 hari termasuk hari ini: today−6 … today
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      return { kind, startISO: isoFromDate(start), endISO: today };
    }
    case "bulan-ini": {
      const y = now.getFullYear();
      const m = now.getMonth(); // 0-based
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      return { kind, startISO: `${key}-01`, endISO: `${key}-${lastDayOfMonth(y, m)}`, monthKey: key };
    }
    case "bulan-lalu": {
      const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const m = (now.getMonth() + 11) % 12; // 0-based
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      return { kind, startISO: `${key}-01`, endISO: `${key}-${lastDayOfMonth(y, m)}`, monthKey: key };
    }
    case "tahun-ini":
      return { kind, startISO: `${now.getFullYear()}-01-01`, endISO: `${now.getFullYear()}-12-31` };
    case "1-tahun": {
      // 365 hari termasuk hari ini: today−364 … today
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 364);
      return { kind, startISO: isoFromDate(start), endISO: today };
    }
    case "semua":
      return { kind, startISO: null, endISO: null };
  }
}

/** Bulan spesifik "2026-11" → rentang 1 s/d akhir bulan */
export function periodFromMonthKey(monthKey: string): PeriodRange {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return defaultPeriod();
  const key = `${y}-${String(m).padStart(2, "0")}`;
  return { kind: "bulan", startISO: `${key}-01`, endISO: `${key}-${lastDayOfMonth(y, m - 1)}`, monthKey: key };
}

/** Rentang kustom — urutan Dari/Sampai dinormalisasi otomatis */
export function periodFromKustom(startISO: string, endISO: string): PeriodRange {
  return startISO <= endISO
    ? { kind: "kustom", startISO, endISO }
    : { kind: "kustom", startISO: endISO, endISO: startISO };
}

/** Batas sort inklusif utk memfilter CashEntry.dateSort (yyyyMMdd) */
export function periodSortBounds(range: PeriodRange): { startSort: number | null; endSort: number | null } {
  return {
    startSort: range.startISO ? isoToSort(range.startISO) : null,
    endSort: range.endISO ? isoToSort(range.endISO) : null,
  };
}

/** monthKey bila rentang tepat satu bulan — untuk menandai item bulan aktif */
export function periodMonthKey(range: PeriodRange): string | null {
  if (range.kind === "bulan" || range.kind === "bulan-ini" || range.kind === "bulan-lalu") {
    return range.monthKey ?? null;
  }
  return null;
}

/** Batas monthKey (inklusif) utk rentang bulan-granular — satu bulan spesifik,
 *  Bulan Ini/Lalu, Tahun Ini, dan 1 Tahun Terakhir. Dipakai filter Buku Kas
 *  utk atribusi pemasukan sewa otomatis menurut PERIODE TAGIHAN (bukan tanggal
 *  kas) sehingga total bulanan selaras dgn "Sudah Diterima" Tagihan & Invoice.
 *  Rentang hari-granular (Hari Ini, 7 Hari, Kustom) & "Semua Waktu" → null —
 *  filter tetap berbasis tanggal entri (kas riil). */
export function periodMonthBounds(range: PeriodRange): { start: string; end: string } | null {
  switch (range.kind) {
    case "bulan":
    case "bulan-ini":
    case "bulan-lalu":
      return range.monthKey ? { start: range.monthKey, end: range.monthKey } : null;
    case "tahun-ini":
      return range.startISO && range.endISO
        ? { start: range.startISO.slice(0, 7), end: range.endISO.slice(0, 7) }
        : null;
    case "1-tahun":
      return range.startISO && range.endISO
        ? { start: range.startISO.slice(0, 7), end: range.endISO.slice(0, 7) }
        : null;
    default:
      return null;
  }
}

/** Label pendek tombol trigger: "Nov 2026", "7 Hari", "Tahun 2026", "6 Nov – 6 Des" */
export function periodTriggerLabel(range: PeriodRange): string {
  switch (range.kind) {
    case "hari-ini":
      return "Hari Ini";
    case "7-hari":
      return "7 Hari";
    case "bulan-ini":
    case "bulan-lalu":
    case "bulan":
      return range.monthKey ? periodShortLabel(range.monthKey) : "…";
    case "tahun-ini":
      return `Tahun ${range.startISO?.slice(0, 4) ?? ""}`;
    case "1-tahun":
      return "1 Tahun";
    case "semua":
      return "Semua Waktu";
    case "kustom":
      return range.startISO && range.endISO ? spanLabel(range.startISO, range.endISO) : "Kustom";
  }
}

/** Periode konkret — sub kartu metrik, label ekspor, toast:
 *  "1 – 30 Nov 2026", "31 Okt – 6 Nov 2026", "Semua Waktu" */
export function periodCaption(range: PeriodRange): string {
  if (!range.startISO || !range.endISO) return "Semua Waktu";
  if (range.kind === "hari-ini") return isoShort(range.startISO, true);
  if (range.kind === "bulan") return periodLabelFromKey(range.monthKey ?? "");
  return spanLabel(range.startISO, range.endISO);
}

/** Label lengkap subtitle — nama preset + tanggal konkret:
 *  "Bulan Ini (1 – 30 Nov 2026)", "7 Hari Terakhir (31 Okt – 6 Nov 2026)" */
export function periodFullLabel(range: PeriodRange): string {
  const caption = periodCaption(range);
  switch (range.kind) {
    case "hari-ini":
      return `Hari Ini (${caption})`;
    case "7-hari":
      return `7 Hari Terakhir (${caption})`;
    case "bulan-ini":
      return `Bulan Ini (${caption})`;
    case "bulan-lalu":
      return `Bulan Lalu (${caption})`;
    case "tahun-ini":
      return `Tahun Ini (${caption})`;
    case "1-tahun":
      return `1 Tahun Terakhir (${caption})`;
    default:
      return caption;
  }
}

/** Slug nama file ekspor: "2026-11", "20261106-20261206", "20261106", "semua" */
export function periodSlug(range: PeriodRange): string {
  if (range.startISO && range.endISO && range.startISO !== range.endISO) {
    return `${range.startISO.replace(/-/g, "")}-${range.endISO.replace(/-/g, "")}`;
  }
  if (range.startISO) return range.startISO.replace(/-/g, "");
  return "semua";
}
