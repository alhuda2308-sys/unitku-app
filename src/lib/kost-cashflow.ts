// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Buku Kas dataset (Cashflow & Finansial)
// Period: Sep 2026 (bulan berjalan). Snapshot: 26 Sep 2026.
//
// Numbers reconcile exactly with the spec:
//   Total Pemasukan  : Rp32.500.000 (23 transaksi masuk)
//   Total Pengeluaran: Rp 6.200.000 (11 transaksi keluar)
//   Laba Bersih      : Rp26.300.000 (margin 80,9%)
// ─────────────────────────────────────────────────────────────────────────────

import { MONTH_NAMES } from "./kost-data";

export type CashType = "masuk" | "keluar";

/** Kategori pengeluaran operasional — dropdown praktis modal "Catat Pengeluaran" */
export const EXPENSE_CATEGORIES = [
  "Listrik & Air (Fasilitas Umum / Pompa)",
  "Kebersihan & Sampah RT",
  "Pemeliharaan / Servis (AC, Genteng, Pipa, Pompa)",
  "Perlengkapan Kost (Sapu, Pel, Bohlam, Deterjen)",
  "Gaji / Upah Staf & Penjaga",
  "Internet / WiFi",
  "Lain-lain",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Income categories (masuk) — dipakai dataset seed */
export const INCOME_CATEGORIES = ["Sewa Kamar", "Deposit", "Parkir", "Denda", "Lainnya"] as const;

/** Kategori pemasukan manual — dropdown modal "+ Tambah Pemasukan" (Buku Kas) */
export const MANUAL_INCOME_CATEGORIES = [
  "Pelunasan Sewa Manual / Tunai",
  "Denda Keterlambatan",
  "Deposit / Jaminan Masuk",
  "Layanan Tambahan (Laundry / Galon / Parkir Tambahan)",
  "Lain-lain",
] as const;
export type ManualIncomeCategory = (typeof MANUAL_INCOME_CATEGORIES)[number];

/** Metode pembayaran modal pemasukan — label UI → nilai kanonik sumber dana (CASH_SOURCES) */
export const INCOME_METHODS = [
  { label: "Tunai (Cash)", value: "Kas Tunai" },
  { label: "Transfer Rekening", value: "Transfer Rekening Bank" },
] as const;

/** Sumber dana / metode pembayaran transaksi kas */
export const CASH_SOURCES = ["Kas Tunai", "Transfer Rekening Bank"] as const;
export type CashSource = (typeof CASH_SOURCES)[number];

export interface CashEntry {
  id: string;
  dateLabel: string; // "01 Sep 2026"
  dateSort: number; // 20260901 — newest-first ordering
  type: CashType;
  category: string;
  description: string;
  amount: number; // always positive; sign comes from `type`
  source?: string; // "Kas Tunai" | "Transfer Rekening Bank"
  attachment?: string; // bukti nota / bukti transfer (dataURL gambar / referensi file)
}

/** "01 Sep 2026" → 20260901 */
export function dateSortFromLabel(label: string): number {
  const [d, m, y] = label.split(" ");
  const month = MONTH_NAMES.indexOf((m ?? "Jan") as (typeof MONTH_NAMES)[number]) + 1;
  return Number(`${y}${String(month).padStart(2, "0")}${String(Number(d)).padStart(2, "0")}`);
}

const entry = (
  id: string,
  dateLabel: string,
  type: CashType,
  category: string,
  description: string,
  amount: number,
  attachment?: string,
  source?: CashSource
): CashEntry => ({
  id,
  dateLabel,
  dateSort: dateSortFromLabel(dateLabel),
  type,
  category,
  description,
  amount,
  ...(attachment ? { attachment } : {}),
  ...(source ? { source } : {}),
});

export const CASH_ENTRIES: CashEntry[] = [
  // ── Pemasukan — sewa Okt 2026 dibayar dimuka selama Sep (Rp32.500.000) ────
  entry("KS-LN1", "01 Sep 2026", "masuk", "Lainnya", "Sewa mesin laundry — Vendor CleanUp (kwartalan Sep–Nov)", 900_000, undefined, "Transfer Rekening Bank"),
  entry("KS-101", "01 Sep 2026", "masuk", "Sewa Kamar", "Kamar 101 · Budi Santoso — Sewa Okt 2026", 1_500_000, "tf-bca-101.jpg", "Transfer Rekening Bank"),
  entry("KS-102", "02 Sep 2026", "masuk", "Sewa Kamar", "Kamar 102 · Dimas Ardi — Sewa Okt 2026", 1_500_000, "tf-bca-102.jpg", "Transfer Rekening Bank"),
  entry("KS-105", "03 Sep 2026", "masuk", "Sewa Kamar", "Kamar 105 · Rizky Pratama — Sewa Okt 2026", 1_500_000, undefined, "Transfer Rekening Bank"),
  entry("KS-107", "03 Sep 2026", "masuk", "Sewa Kamar", "Kamar 107 · Maya Anggraini — Sewa Okt 2026", 1_100_000, undefined, "Transfer Rekening Bank"),
  entry("KS-108", "04 Sep 2026", "masuk", "Sewa Kamar", "Kamar 108 · Doni Kusnadi — Sewa Okt 2026", 1_500_000, "tf-mandiri-108.jpg", "Transfer Rekening Bank"),
  entry("KS-109", "06 Sep 2026", "masuk", "Sewa Kamar", "Kamar 109 · Putri Handayani — Sewa Okt–Des 2026 (3 bulan)", 5_250_000, "tf-bca-109.jpg", "Transfer Rekening Bank"),
  entry("KS-110", "07 Sep 2026", "masuk", "Sewa Kamar", "Kamar 110 · Agus Setiawan — Sewa Okt 2026", 1_100_000, undefined, "Transfer Rekening Bank"),
  entry("KS-112", "08 Sep 2026", "masuk", "Sewa Kamar", "Kamar 112 · Fajar Nugroho — Sewa Okt 2026", 1_500_000, undefined, "Transfer Rekening Bank"),
  entry("KS-201", "09 Sep 2026", "masuk", "Sewa Kamar", "Kamar 201 · Rina Marlina — Sewa Okt 2026", 1_500_000, undefined, "Transfer Rekening Bank"),
  entry("KS-202", "10 Sep 2026", "masuk", "Sewa Kamar", "Kamar 202 · Joko Prasetyo — Sewa Okt 2026", 1_100_000, undefined, "Transfer Rekening Bank"),
  entry("KS-203", "11 Sep 2026", "masuk", "Sewa Kamar", "Kamar 203 · Ayu Kartika — Sewa Okt 2026", 1_500_000, undefined, "Transfer Rekening Bank"),
  entry("KS-204", "12 Sep 2026", "masuk", "Sewa Kamar", "Kamar 204 · Hendra Gunawan — Sewa Okt 2026", 1_750_000, "tf-bca-204.jpg", "Transfer Rekening Bank"),
  entry("KS-207", "15 Sep 2026", "masuk", "Sewa Kamar", "Kamar 207 · Bagus Wicaksono — Sewa Okt 2026", 1_500_000, undefined, "Transfer Rekening Bank"),
  entry("KS-208", "16 Sep 2026", "masuk", "Sewa Kamar", "Kamar 208 · Novi Suryani — Sewa Okt 2026", 1_750_000, undefined, "Transfer Rekening Bank"),
  entry("KS-PM1", "15 Sep 2026", "masuk", "Parkir", "Parkir motor — 6 unit · Sep 2026", 300_000, undefined, "Kas Tunai"),
  entry("KS-PM2", "15 Sep 2026", "masuk", "Parkir", "Parkir mobil — 2 unit · Sep 2026", 300_000, undefined, "Kas Tunai"),
  entry("KS-209", "17 Sep 2026", "masuk", "Sewa Kamar", "Kamar 209 · Eko Purnomo — Sewa Okt 2026", 1_100_000, undefined, "Transfer Rekening Bank"),
  entry("KS-210", "18 Sep 2026", "masuk", "Sewa Kamar", "Kamar 210 · Lestari Ningsih — Sewa Okt 2026", 1_500_000, undefined, "Transfer Rekening Bank"),
  entry("KS-211", "19 Sep 2026", "masuk", "Sewa Kamar", "Kamar 211 · Rudi Hartono — Sewa Okt 2026", 1_750_000, undefined, "Transfer Rekening Bank"),
  entry("KS-DD1", "20 Sep 2026", "masuk", "Denda", "Denda keterlambatan — 2 penyewa", 100_000, undefined, "Kas Tunai"),
  entry("KS-106", "25 Sep 2026", "masuk", "Deposit", "Kamar 106 · Deposit penghuni baru — Sinta Rahmawati (masuk 1 Okt)", 1_000_000, "tf-bri-106.jpg", "Transfer Rekening Bank"),
  entry("KS-106b", "25 Sep 2026", "masuk", "Sewa Kamar", "Kamar 106 · Sinta Rahmawati — Sewa Okt 2026 (dibayar dimuka)", 1_500_000, undefined, "Transfer Rekening Bank"),

  // ── Pengeluaran operasional (Rp6.200.000) ──────────────────────────────────
  entry("KX-001", "01 Sep 2026", "keluar", "Listrik & Air (Fasilitas Umum / Pompa)", "Tagihan air PDAM — periode Agustus 2026", 850_000, "nota-pdam-agu.jpg", "Transfer Rekening Bank"),
  entry("KX-002", "03 Sep 2026", "keluar", "Gaji / Upah Staf & Penjaga", "Gaji penjaga — Pak Slamet · Sep 2026", 1_500_000, undefined, "Transfer Rekening Bank"),
  entry("KX-003", "05 Sep 2026", "keluar", "Listrik & Air (Fasilitas Umum / Pompa)", "Token listrik meteran utama", 1_200_000, "struk-token-pln.jpg", "Kas Tunai"),
  entry("KX-004", "08 Sep 2026", "keluar", "Pemeliharaan / Servis (AC, Genteng, Pipa, Pompa)", "Ganti pompa air taman", 750_000, "nota-pompa.jpg", "Kas Tunai"),
  entry("KX-005", "10 Sep 2026", "keluar", "Perlengkapan Kost (Sapu, Pel, Bohlam, Deterjen)", "Alat & bahan kebersihan (sapu, pel, deterjen)", 320_000, undefined, "Kas Tunai"),
  entry("KX-006", "12 Sep 2026", "keluar", "Pemeliharaan / Servis (AC, Genteng, Pipa, Pompa)", "Servis AC Kamar 109 (tiket #TKT-038)", 450_000, "nota-servis-ac.jpg", "Kas Tunai"),
  entry("KX-007", "15 Sep 2026", "keluar", "Listrik & Air (Fasilitas Umum / Pompa)", "Top-up token kedua — Sep 2026", 250_000, undefined, "Transfer Rekening Bank"),
  entry("KX-008", "18 Sep 2026", "keluar", "Gaji / Upah Staf & Penjaga", "Upah kebersihan — Bu Yati · Sep 2026", 300_000, undefined, "Kas Tunai"),
  entry("KX-009", "22 Sep 2026", "keluar", "Perlengkapan Kost (Sapu, Pel, Bohlam, Deterjen)", "Lampu LED & kabel koridor Lt. 2", 180_000, undefined, "Kas Tunai"),
  entry("KX-010", "24 Sep 2026", "keluar", "Pemeliharaan / Servis (AC, Genteng, Pipa, Pompa)", "Perbaikan kran & shower Kamar 205", 100_000, undefined, "Kas Tunai"),
  entry("KX-011", "26 Sep 2026", "keluar", "Perlengkapan Kost (Sapu, Pel, Bohlam, Deterjen)", "Dispenser galon & filter air", 300_000, "nota-dispenser.jpg", "Transfer Rekening Bank"),
];

// ── Derived stats ────────────────────────────────────────────────────────────

export interface CashStats {
  masuk: number;
  keluar: number;
  net: number;
  masukCount: number;
  keluarCount: number;
  marginPct: string;
}

export function computeCashStats(entries: CashEntry[]): CashStats {
  const masuk = entries.filter((e) => e.type === "masuk").reduce((a, e) => a + e.amount, 0);
  const keluar = entries.filter((e) => e.type === "keluar").reduce((a, e) => a + e.amount, 0);
  return {
    masuk,
    keluar,
    net: masuk - keluar,
    masukCount: entries.filter((e) => e.type === "masuk").length,
    keluarCount: entries.filter((e) => e.type === "keluar").length,
    marginPct: masuk ? (((masuk - keluar) / masuk) * 100).toFixed(1).replace(".", ",") : "0,0",
  };
}

/** Next expense id: "KX-012", "KX-013", … */
export function nextExpenseId(entries: CashEntry[]): string {
  const max = entries.reduce((m, e) => {
    const match = /^KX-(\d+)$/.exec(e.id);
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return `KX-${String(max + 1).padStart(3, "0")}`;
}
