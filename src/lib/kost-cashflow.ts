// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Buku Kas dataset (Cashflow & Finansial)
//
// Dataset demo bersifat DINAMIS: tanggal transaksi selalu mengikuti bulan
// berjalan (jam perangkat) sehingga filter periode Buku Kas — yang defaultnya
// bulan berjalan — selalu menampilkan rekap hidup saat MODE DEMO / fallback
// offline. Angka rekonsiliasi persis dengan spec:
//   Total Pemasukan  : Rp 8.500.000 (8 transaksi masuk — 5 di antaranya sewa)
//   Total Pengeluaran: Rp 1.350.000 (4 transaksi keluar)
//   Laba Bersih      : Rp 7.150.000 (margin 84,1%)
// Tanggal di luar hari ini dijepit ke hari ini — tidak ada transaksi "masa
// depan" di awal bulan. Hanya dibaca klien (snapshot demo dipasang setelah
// mount → aman hydration) & server seed demo (seed.ts); akun riil tidak
// pernah menerima dataset ini.
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

interface DemoCashSpec {
  id: string;
  /** Tanggal dalam bulan berjalan — dijepit ≤ hari ini (tanpa transaksi masa depan) */
  day: number;
  type: CashType;
  category: string;
  description: string;
  amount: number;
  attachment?: string; // referensi file bukti (bukan dataURL — tampil sebagai chip "Bukti")
  source?: CashSource;
}

/**
 * Dataset transaksi kas untuk MODE DEMO & fallback offline — tanggal selalu
 * di bulan berjalan sehingga default filter periode Buku Kas langsung
 * menampilkan rekap lengkap (kartu ringkasan terisi + tabel berisi transaksi).
 * Dipakai ulang server saat seed/reset demo (label mengikuti jam server).
 */
export function buildDemoCashEntries(now: Date = new Date()): CashEntry[] {
  const year = now.getFullYear();
  const monthName = MONTH_NAMES[now.getMonth()];
  const labelOf = (day: number) => `${Math.min(day, now.getDate())} ${monthName} ${year}`;

  const specs: DemoCashSpec[] = [
    // ── Pemasukan — sewa kamar bulan berjalan + kas lain (Rp8.500.000) ───────
    { id: "KS-101", day: 1, type: "masuk", category: "Sewa Kamar", description: `Kamar 101 · Budi Santoso — Sewa ${monthName} ${year}`, amount: 1_500_000, attachment: "tf-bca-101.jpg", source: "Transfer Rekening Bank" },
    { id: "KS-102", day: 2, type: "masuk", category: "Sewa Kamar", description: `Kamar 102 · Dimas Ardi — Sewa ${monthName} ${year}`, amount: 1_500_000, attachment: "tf-bca-102.jpg", source: "Transfer Rekening Bank" },
    { id: "KS-105", day: 2, type: "masuk", category: "Sewa Kamar", description: `Kamar 105 · Rizky Pratama — Sewa ${monthName} ${year}`, amount: 1_500_000, source: "Transfer Rekening Bank" },
    { id: "KS-107", day: 3, type: "masuk", category: "Sewa Kamar", description: `Kamar 107 · Maya Anggraini — Sewa ${monthName} ${year}`, amount: 1_100_000, source: "Transfer Rekening Bank" },
    { id: "KS-109", day: 3, type: "masuk", category: "Sewa Kamar", description: `Kamar 109 · Putri Handayani — Sewa ${monthName} ${year}`, amount: 1_750_000, attachment: "tf-bca-109.jpg", source: "Transfer Rekening Bank" },
    { id: "KS-106", day: 5, type: "masuk", category: "Deposit", description: "Kamar 106 · Deposit penghuni baru — Sinta Rahmawati", amount: 750_000, attachment: "tf-bri-106.jpg", source: "Transfer Rekening Bank" },
    { id: "KS-PM1", day: 8, type: "masuk", category: "Parkir", description: `Parkir motor — 6 unit · ${monthName} ${year}`, amount: 300_000, source: "Kas Tunai" },
    { id: "KS-DD1", day: 10, type: "masuk", category: "Denda", description: "Denda keterlambatan — 2 penyewa", amount: 100_000, source: "Kas Tunai" },

    // ── Pengeluaran operasional (Rp1.350.000) ─────────────────────────────────
    { id: "KX-001", day: 1, type: "keluar", category: "Listrik & Air (Fasilitas Umum / Pompa)", description: "Token listrik meteran induk", amount: 450_000, attachment: "struk-token-pln.jpg", source: "Kas Tunai" },
    { id: "KX-002", day: 3, type: "keluar", category: "Internet / WiFi", description: `Langganan Wi-Fi kost (ISP) · ${monthName} ${year}`, amount: 300_000, source: "Transfer Rekening Bank" },
    { id: "KX-003", day: 5, type: "keluar", category: "Gaji / Upah Staf & Penjaga", description: "Upah pembersih lantai — Bu Yati", amount: 250_000, source: "Kas Tunai" },
    { id: "KX-004", day: 6, type: "keluar", category: "Pemeliharaan / Servis (AC, Genteng, Pipa, Pompa)", description: "Perbaikan pompa air sumur", amount: 350_000, attachment: "nota-pompa.jpg", source: "Kas Tunai" },
  ];

  return specs.map(({ id, day, type, category, description, amount, attachment, source }) => {
    const dateLabel = labelOf(day);
    return {
      id,
      dateLabel,
      dateSort: dateSortFromLabel(dateLabel),
      type,
      category,
      description,
      amount,
      ...(attachment ? { attachment } : {}),
      ...(source ? { source } : {}),
    };
  });
}

/** Snapshot bulan berjalan saat modul dimuat — demo & fallback offline di klien */
export const CASH_ENTRIES: CashEntry[] = buildDemoCashEntries();

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
