// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Tagihan & Invoice dataset (Phase 2)
// Billing period: Sep 2025 (bulan berjalan). Snapshot: 26 Sep 2025.
//
// Numbers reconcile exactly with the Phase 2 spec:
//   Total     : Rp38.500.000 (24 kamar)
//   Diterima  : Rp29.750.000 (18 invoice — 16 Lunas + 2 Menunggu Verifikasi) = 77%
//   Belum bayar: Rp8.750.000 (6 kamar — 3 Menunggak + 3 Jatuh Tempo H-3)
//   Pengingat WA terkirim: 18
// ─────────────────────────────────────────────────────────────────────────────

import { formatIDR } from "./kost-data";
import { BRAND_WA_FOOTER } from "./brand";

export type InvoiceStatus = "lunas" | "verifikasi" | "jatuhTempo" | "menunggak";

export interface InvoiceLine {
  label: string;
  amount: number;
}

export interface Invoice {
  id: string; // "#INV-202509-101"
  roomId: string; // "101"
  tenantName: string | null; // null = kamar kosong (tagihan periode terakhir)
  tenantPhone: string | null;
  roomType: string;
  periodLabel: string; // "1 Sep – 30 Sep 2025"
  periodKey: string; // "2025-09"
  dueDate: string; // "24 Sep 2025"
  lines: InvoiceLine[];
  total: number;
  status: InvoiceStatus;
  /** menunggak = H+n (overdue), jatuhTempo = H-n (due in n days) */
  dayOffset?: number;
  paidAt?: string;
}

export const CURRENT_PERIOD_KEY = "2025-09";
export const CURRENT_PERIOD_LABEL = "1 Sep – 30 Sep 2025";

export const BANK_ACCOUNT = {
  bank: "BCA",
  number: "1234567890",
  holder: "Hendra Wijaya",
};

export const MONTH_OPTIONS = [
  { key: "2025-10", label: "Okt 2025" },
  { key: "2025-09", label: "Sep 2025", tag: "Bulan Berjalan" },
  { key: "2025-08", label: "Agu 2025" },
  { key: "2025-07", label: "Jul 2025" },
  { key: "2025-06", label: "Jun 2025" },
];

// ── Status metadata ──────────────────────────────────────────────────────────

export const INVOICE_STATUS_META: Record<
  InvoiceStatus,
  { label: string; pill: string; tabLabel: string }
> = {
  lunas: {
    label: "Lunas",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
    tabLabel: "Lunas",
  },
  verifikasi: {
    label: "Verifikasi",
    pill: "bg-violet-50 text-violet-700 border-violet-200",
    tabLabel: "Menunggu Verifikasi",
  },
  jatuhTempo: {
    label: "Jatuh Tempo",
    pill: "bg-amber-50 text-amber-700 border-amber-200",
    tabLabel: "Jatuh Tempo",
  },
  menunggak: {
    label: "Menunggak",
    pill: "bg-rose-50 text-rose-700 border-rose-200",
    tabLabel: "Menunggak",
  },
};

/** Row badge text: "Lunas" / "Menunggak H+2" / "H-3" / "Verifikasi" */
export function invoiceBadgeLabel(inv: Invoice): string {
  if (inv.status === "menunggak" && inv.dayOffset !== undefined) return `Menunggak H+${inv.dayOffset}`;
  if (inv.status === "jatuhTempo" && inv.dayOffset !== undefined) return `H-${inv.dayOffset}`;
  return INVOICE_STATUS_META[inv.status].label;
}

// ── Dataset ──────────────────────────────────────────────────────────────────
// line helpers
const sewa = (amount: number): InvoiceLine => ({ label: "Sewa Kamar", amount });
const listrik = (amount: number): InvoiceLine => ({ label: "Listrik", amount });

function make(
  roomId: string,
  tenantName: string | null,
  tenantPhone: string | null,
  roomType: string,
  dueDate: string,
  lines: InvoiceLine[],
  status: InvoiceStatus,
  opts?: { dayOffset?: number; paidAt?: string }
): Invoice {
  return {
    id: `#INV-202509-${roomId}`,
    roomId,
    tenantName,
    tenantPhone,
    roomType,
    periodLabel: CURRENT_PERIOD_LABEL,
    periodKey: CURRENT_PERIOD_KEY,
    dueDate,
    lines,
    total: lines.reduce((a, l) => a + l.amount, 0),
    status,
    ...opts,
  };
}

export const INVOICES: Invoice[] = [
  // ── Lantai 1 ───────────────────────────────────────────────────────────────
  make("101", "Budi Santoso", "+62 812-1101-2210", "Tipe A - AC", "1 Sep 2025",
    [sewa(1_500_000), listrik(180_000)], "lunas", { paidAt: "3 Sep 2025" }),
  make("102", "Dimas Ardi", "+62 812-3456-7890", "Tipe A - AC", "5 Sep 2025",
    [sewa(1_500_000), listrik(150_000)], "lunas", { paidAt: "2 Sep 2025" }),
  make("103", "Ahmad Fauzi", "+62 813-8821-5502", "Tipe B - Kipas", "22 Sep 2025",
    [sewa(1_100_000), listrik(50_000)], "menunggak", { dayOffset: 4 }),
  make("104", "Dewi Lestari", "+62 812-9902-3367", "Tipe AC Deluxe", "24 Sep 2025",
    [sewa(1_750_000), listrik(150_000)], "menunggak", { dayOffset: 2 }),
  make("105", "Rizky Pratama", "+62 878-2210-6634", "Tipe A - AC", "10 Sep 2025",
    [sewa(1_500_000), listrik(200_000)], "lunas", { paidAt: "9 Sep 2025" }),
  make("106", null, null, "Tipe A - AC", "4 Sep 2025",
    [sewa(1_500_000)], "lunas", { paidAt: "4 Sep 2025" }),
  make("107", "Maya Anggraini", "+62 812-6675-0119", "Tipe B - Kipas", "3 Sep 2025",
    [sewa(1_100_000), listrik(120_000)], "lunas", { paidAt: "3 Sep 2025" }),
  make("108", "Doni Kusnadi", "+62 856-4410-8823", "Tipe A - AC", "18 Sep 2025",
    [sewa(1_500_000), listrik(220_000)], "verifikasi", { paidAt: "25 Sep 2025" }),
  make("109", "Putri Handayani", "+62 813-2299-4405", "Tipe AC Deluxe", "7 Sep 2025",
    [sewa(1_750_000), listrik(250_000)], "lunas", { paidAt: "6 Sep 2025" }),
  make("110", "Agus Setiawan", "+62 812-3358-9907", "Tipe B - Kipas", "29 Sep 2025",
    [sewa(1_100_000), listrik(200_000)], "jatuhTempo", { dayOffset: 3 }),
  make("111", null, null, "Tipe AC Deluxe", "14 Sep 2025",
    [sewa(1_750_000)], "lunas", { paidAt: "12 Sep 2025" }),
  make("112", "Fajar Nugroho", "+62 878-9920-1145", "Tipe A - AC", "21 Sep 2025",
    [sewa(1_500_000), listrik(170_000)], "lunas", { paidAt: "19 Sep 2025" }),

  // ── Lantai 2 ───────────────────────────────────────────────────────────────
  make("201", "Rina Marlina", "+62 812-4470-2238", "Tipe A - AC", "29 Sep 2025",
    [sewa(1_500_000), listrik(100_000)], "jatuhTempo", { dayOffset: 3 }),
  make("202", "Joko Prasetyo", "+62 856-7780-3312", "Tipe B - Kipas", "9 Sep 2025",
    [sewa(1_100_000), listrik(100_000)], "lunas", { paidAt: "8 Sep 2025" }),
  make("203", "Ayu Kartika", "+62 812-9915-7734", "Tipe A - AC", "29 Sep 2025",
    [sewa(1_500_000), listrik(100_000)], "jatuhTempo", { dayOffset: 3 }),
  make("204", "Hendra Gunawan", "+62 813-5521-8896", "Tipe AC Deluxe", "2 Sep 2025",
    [sewa(1_750_000), listrik(400_000)], "lunas", { paidAt: "1 Sep 2025" }),
  make("205", "Intan Permata", "+62 812-2245-9910", "Tipe B - Kipas", "25 Sep 2025",
    [sewa(1_100_000), listrik(100_000)], "menunggak", { dayOffset: 1 }),
  make("206", null, null, "Tipe B - Kipas", "6 Sep 2025",
    [sewa(1_100_000)], "lunas", { paidAt: "5 Sep 2025" }),
  make("207", "Bagus Wicaksono", "+62 878-3390-5521", "Tipe A - AC", "19 Sep 2025",
    [sewa(1_500_000), listrik(250_000)], "lunas", { paidAt: "17 Sep 2025" }),
  make("208", "Novi Suryani", "+62 812-6634-2219", "Tipe AC Deluxe", "25 Sep 2025",
    [sewa(1_750_000), listrik(350_000)], "lunas", { paidAt: "24 Sep 2025" }),
  make("209", "Eko Purnomo", "+62 856-2214-7789", "Tipe B - Kipas", "14 Sep 2025",
    [sewa(1_100_000), listrik(110_000)], "lunas", { paidAt: "13 Sep 2025" }),
  make("210", "Lestari Ningsih", "+62 812-8890-5541", "Tipe A - AC", "8 Sep 2025",
    [sewa(1_500_000), listrik(200_000)], "lunas", { paidAt: "7 Sep 2025" }),
  make("211", "Rudi Hartono", "+62 813-4470-9912", "Tipe AC Deluxe", "27 Sep 2025",
    [sewa(1_750_000), listrik(400_000)], "verifikasi", { paidAt: "24 Sep 2025" }),
  make("212", null, null, "Tipe A - AC", "16 Sep 2025",
    [sewa(1_500_000)], "lunas", { paidAt: "15 Sep 2025" }),
];

// ── Derived stats ────────────────────────────────────────────────────────────

export interface InvoiceStats {
  totalBilled: number;
  received: number;
  unpaid: number;
  receivedPct: number;
  unpaidCount: number;
  totalCount: number;
  byStatus: Record<InvoiceStatus, number>;
}

export function computeInvoiceStats(invoices: Invoice[]): InvoiceStats {
  const totalBilled = invoices.reduce((a, i) => a + i.total, 0);
  const received = invoices
    .filter((i) => i.status === "lunas" || i.status === "verifikasi")
    .reduce((a, i) => a + i.total, 0);
  const unpaid = totalBilled - received;
  return {
    totalBilled,
    received,
    unpaid,
    receivedPct: totalBilled ? Math.round((received / totalBilled) * 100) : 0,
    unpaidCount: invoices.filter((i) => i.status === "menunggak" || i.status === "jatuhTempo").length,
    totalCount: invoices.length,
    byStatus: {
      lunas: invoices.filter((i) => i.status === "lunas").length,
      verifikasi: invoices.filter((i) => i.status === "verifikasi").length,
      jatuhTempo: invoices.filter((i) => i.status === "jatuhTempo").length,
      menunggak: invoices.filter((i) => i.status === "menunggak").length,
    },
  };
}

// ── WhatsApp message template ────────────────────────────────────────────────

export function buildWaMessage(inv: Invoice, propertyName: string): string {
  const lines = inv.lines.map((l) => `• ${l.label}: ${formatIDR(l.amount)}`).join("\n");
  const salam = inv.tenantName ? `Yth. ${inv.tenantName} (Kamar ${inv.roomId}),` : `Kamar ${inv.roomId},`;
  return [
    `*${propertyName.toUpperCase()}*`,
    `Tagihan Sewa — Periode ${inv.periodLabel}`,
    ``,
    salam,
    ``,
    `Berikut rincian tagihan sewa bulan ini:`,
    lines,
    ``,
    `*Total: ${formatIDR(inv.total)}*`,
    `Jatuh tempo: *${inv.dueDate}*`,
    ``,
    `Pembayaran dapat dilakukan via transfer:`,
    `${BANK_ACCOUNT.bank} ${BANK_ACCOUNT.number}`,
    `a.n. ${BANK_ACCOUNT.holder}`,
    ``,
    `Setelah transfer, mohon kirim bukti pembayaran ke nomor ini agar dapat segera kami verifikasi. Terima kasih.`,
    ``,
    BRAND_WA_FOOTER,
  ].join("\n");
}
