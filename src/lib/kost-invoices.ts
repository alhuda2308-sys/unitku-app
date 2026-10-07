// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Tagihan & Invoice dataset (Phase 2)
// Billing period: Sep 2026 (bulan berjalan). Snapshot: 26 Sep 2026.
//
// Numbers reconcile exactly with the Phase 2 spec:
//   Total     : Rp19.350.000 (12 kamar)
//   Diterima  : Rp29.750.000 (18 invoice — 16 Lunas + 2 Menunggu Verifikasi) = 77%
//   Belum bayar: Rp8.750.000 (6 kamar — 3 Menunggak + 3 Jatuh Tempo H-3)
//   Pengingat WA terkirim: 18
// ─────────────────────────────────────────────────────────────────────────────

import { MONTH_NAMES } from "./kost-data";
import { BRAND_WA_FOOTER } from "./brand";

export type InvoiceStatus =
  | "belumBayar" // baru di-generate, belum jatuh tempo
  | "lunas"
  | "verifikasi"
  | "jatuhTempo"
  | "menunggak";

/** Status invoice yang masih menunggu pembayaran (tombol WA tagih aktif) */
export function isInvoiceUnpaid(inv: Invoice): boolean {
  return inv.status === "belumBayar" || inv.status === "jatuhTempo" || inv.status === "menunggak";
}

/** Sewa harian (Villa/Homestay) — invoice berisi rentang check-in → check-out */
export function isDailyStay(inv: Invoice): boolean {
  return typeof inv.nights === "number" && inv.nights > 0 && !!inv.checkIn && !!inv.checkOut;
}

export interface InvoiceLine {
  label: string;
  amount: number;
}

export interface Invoice {
  id: string; // "#INV-202609-101"
  roomId: string; // "101"
  tenantName: string | null; // null = kamar kosong (tagihan periode terakhir)
  tenantPhone: string | null;
  roomType: string;
  periodLabel: string; // "1 Sep – 30 Sep 2026"
  periodKey: string; // "2026-09"
  dueDate: string; // "24 Sep 2026"
  lines: InvoiceLine[];
  total: number;
  status: InvoiceStatus;
  /** menunggak = H+n (overdue), jatuhTempo = H-n (due in n days) */
  dayOffset?: number;
  paidAt?: string;
  // ── Sewa harian (Villa/Homestay) — terisi bila invoice lahir dari check-in harian
  checkIn?: string; // label "1 Okt 2026"
  checkOut?: string; // label "3 Okt 2026"
  nights?: number; // total durasi menginap (malam/hari)
}

export const CURRENT_PERIOD_KEY = "2026-09"; // periode dataset seed
export const CURRENT_PERIOD_LABEL = "1 Sep – 30 Sep 2026";

// ── Periode dinamis (mengikuti tanggal berjalan — new Date()) ───────────────

export const FULL_MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
] as const;

/** Date → periodKey "2026-09" */
export function periodKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Bulan & tahun berjalan (new Date()) — default selector periode generator */
export function currentPeriodKey(now: Date = new Date()): string {
  return periodKeyOf(now);
}

/** "2026-09" → "1 Sep – 30 Sep 2026" (label periode sewa) */
export function periodLabelFromKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  const lastDay = new Date(y, m, 0).getDate();
  return `1 ${MONTH_NAMES[m - 1]} – ${lastDay} ${MONTH_NAMES[m - 1]} ${y}`;
}

/** "2026-09" → "September 2026" (nama bulan penuh — template WA) */
export function periodFullLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return `${FULL_MONTH_NAMES[m - 1]} ${y}`;
}

/** "2026-09" → "Sep 2026" (label ringkas dropdown) */
export function periodShortLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Opsi periode dropdown: bulan berjalan ± (berikutnya & 3 lalu) — dinamis */
export function buildMonthOptions(now: Date = new Date()): { key: string; label: string; tag?: string }[] {
  const options: { key: string; label: string; tag?: string }[] = [];
  for (let offset = 1; offset >= -3; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const key = periodKeyOf(d);
    options.push({
      key,
      label: periodShortLabel(key),
      ...(offset === 0 ? { tag: "Bulan Berjalan" } : {}),
    });
  }
  return options;
}

export const BANK_ACCOUNT = {
  bank: "BCA",
  number: "1234567890",
  holder: "Hendra Wijaya",
};

// ── Status metadata ──────────────────────────────────────────────────────────

export const INVOICE_STATUS_META: Record<
  InvoiceStatus,
  { label: string; pill: string; tabLabel: string }
> = {
  belumBayar: {
    label: "Belum Bayar",
    pill: "bg-zinc-100 text-zinc-700 border-zinc-200",
    tabLabel: "Belum Bayar",
  },
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
    id: `#INV-202609-${roomId}`,
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
  make("101", "Budi Santoso", "+62 812-1101-2210", "Tipe A - AC", "1 Sep 2026",
    [sewa(1_500_000), listrik(180_000)], "lunas", { paidAt: "3 Sep 2026" }),
  make("102", "Dimas Ardi", "+62 812-3456-7890", "Tipe A - AC", "5 Sep 2026",
    [sewa(1_500_000), listrik(150_000)], "lunas", { paidAt: "2 Sep 2026" }),
  make("103", "Ahmad Fauzi", "+62 813-8821-5502", "Tipe B - Kipas", "22 Sep 2026",
    [sewa(1_100_000), listrik(50_000)], "menunggak", { dayOffset: 4 }),
  make("104", "Dewi Lestari", "+62 812-9902-3367", "Tipe AC Deluxe", "24 Sep 2026",
    [sewa(1_750_000), listrik(150_000)], "menunggak", { dayOffset: 2 }),
  make("105", "Rizky Pratama", "+62 878-2210-6634", "Tipe A - AC", "10 Sep 2026",
    [sewa(1_500_000), listrik(200_000)], "lunas", { paidAt: "9 Sep 2026" }),
  make("106", null, null, "Tipe A - AC", "4 Sep 2026",
    [sewa(1_500_000)], "lunas", { paidAt: "4 Sep 2026" }),
  make("107", "Maya Anggraini", "+62 812-6675-0119", "Tipe B - Kipas", "3 Sep 2026",
    [sewa(1_100_000), listrik(120_000)], "lunas", { paidAt: "3 Sep 2026" }),
  make("108", "Doni Kusnadi", "+62 856-4410-8823", "Tipe A - AC", "18 Sep 2026",
    [sewa(1_500_000), listrik(220_000)], "verifikasi", { paidAt: "25 Sep 2026" }),
  make("109", "Putri Handayani", "+62 813-2299-4405", "Tipe AC Deluxe", "7 Sep 2026",
    [sewa(1_750_000), listrik(250_000)], "lunas", { paidAt: "6 Sep 2026" }),
  make("110", "Agus Setiawan", "+62 812-3358-9907", "Tipe B - Kipas", "29 Sep 2026",
    [sewa(1_100_000), listrik(200_000)], "jatuhTempo", { dayOffset: 3 }),
  make("111", null, null, "Tipe AC Deluxe", "14 Sep 2026",
    [sewa(1_750_000)], "lunas", { paidAt: "12 Sep 2026" }),
  make("112", "Fajar Nugroho", "+62 878-9920-1145", "Tipe A - AC", "21 Sep 2026",
    [sewa(1_500_000), listrik(170_000)], "lunas", { paidAt: "19 Sep 2026" }),
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

/** "1500000" → "1.500.000" (tanpa prefiks Rp — untuk template WA "Rp {nominal}") */
function waAmount(amount: number): string {
  return amount.toLocaleString("id-ID");
}

export interface WaBillingContext {
  propertyName: string;
  bank: { bank: string; number: string; holder: string };
  /** URL absolut Portal Penyewa (window.location.origin saat klik) */
  portalUrl: string;
  /** true = QRIS statis sudah diunggah owner — pesan menyebut opsi QRIS
   *  dan header tautan menjadi "Kwitansi & Scan QRIS:" */
  qrisAvailable?: boolean;
}

/**
 * Template "Tagih via WhatsApp" — pesan penagihan tagihan belum bayar.
 * Format persis sesuai spesifikasi: sapaan, rincian periode, rekening, link portal.
 * Bila QRIS statis tersedia (ctx.qrisAvailable): tambah catatan QRIS setelah
 * rekening dan header tautan menjadi "Kwitansi & Scan QRIS:".
 */
export function buildBillingWaMessage(inv: Invoice, ctx: WaBillingContext): string {
  const nama = inv.tenantName ?? "Penyewa";
  const unitLabel = `Unit/Villa: *${inv.roomId}*${inv.roomType ? ` — ${inv.roomType}` : ""}`;

  // ── Sewa harian (Villa/Homestay) — rincian check-in/check-out & durasi ────
  if (isDailyStay(inv)) {
    const perDay = inv.lines.find((l) => l.label === "Sewa Harian")?.amount ?? 0;
    const nights = inv.nights ?? 0;
    return [
      `Halo Kak ${nama}, salam dari manajemen ${ctx.propertyName}. 🙏`,
      ``,
      `Berikut rincian tagihan sewa untuk masa menginap Anda:`,
      `- ${unitLabel}`,
      `- Tanggal Check-in: *${inv.checkIn}*`,
      `- Tanggal Check-out: *${inv.checkOut}*`,
      `- Total Durasi: *${nights} Malam/Hari*`,
      ...(perDay > 0
        ? [`- Biaya Sewa: Rp ${waAmount(perDay)}/hari × ${nights} hari`]
        : []),
      `- *Total Tagihan: Rp ${waAmount(inv.total)}*`,
      ``,
      `Pembayaran dapat ditransfer ke:`,
      `Bank: *${ctx.bank.bank}*`,
      `No. Rekening: *${ctx.bank.number}*`,
      `A/N: *${ctx.bank.holder}*`,
      ...(ctx.qrisAvailable
        ? [`(Tersedia juga pembayaran via QRIS pada tautan kwitansi di bawah)`]
        : []),
      ``,
      ctx.qrisAvailable ? `Kwitansi & Scan QRIS:` : `Kwitansi & rincian digital dapat diakses di:`,
      ctx.portalUrl,
      ``,
      `Mohon konfirmasi dan kirimkan bukti transfer setelah melakukan pembayaran. Terima kasih!`,
      ``,
      BRAND_WA_FOOTER,
    ].join("\n");
  }

  const sewa = inv.lines.find((l) => l.label === "Sewa Kamar")?.amount ?? inv.total;
  const addons = inv.lines.filter((l) => l.label !== "Sewa Kamar");
  const addonLines = addons.map((l) => `- ${l.label}: Rp ${waAmount(l.amount)}`).join("\n");
  return [
    `Halo Kak ${nama}, salam dari manajemen ${ctx.propertyName}. 🙏`,
    ``,
    `Berikut rincian tagihan sewa untuk periode *${periodFullLabel(inv.periodKey)}*:`,
    `- Unit/Kamar: *${inv.roomId}*`,
    `- Biaya Sewa: Rp ${waAmount(sewa)}`,
    ...(addons.length > 0 ? [addonLines] : []),
    `- *Total Tagihan: Rp ${waAmount(inv.total)}*`,
    `- Jatuh Tempo: *${inv.dueDate}*`,
    ``,
    `Pembayaran dapat ditransfer ke:`,
    `Bank: *${ctx.bank.bank}*`,
    `No. Rekening: *${ctx.bank.number}*`,
    `A/N: *${ctx.bank.holder}*`,
    ...(ctx.qrisAvailable
      ? [`(Tersedia juga pembayaran via QRIS pada tautan kwitansi di bawah)`]
      : []),
    ``,
    ctx.qrisAvailable ? `Kwitansi & Scan QRIS:` : `Kwitansi & rincian digital dapat diakses di:`,
    ctx.portalUrl,
    ``,
    `Mohon konfirmasi dan kirimkan bukti transfer setelah melakukan pembayaran. Terima kasih!`,
    ``,
    BRAND_WA_FOOTER,
  ].join("\n");
}

/** Pesan kwitansi LUNAS — pengganti tombol tagihan setelah pembayaran diterima */
export function buildReceiptWaMessage(inv: Invoice, ctx: WaBillingContext): string {
  const nama = inv.tenantName ?? "Penyewa";
  const unitLabel = `Unit/Villa: *${inv.roomId}*${inv.roomType ? ` — ${inv.roomType}` : ""}`;

  // ── Sewa harian (Villa/Homestay) — kwitansi memuat check-in/out & durasi ──
  if (isDailyStay(inv)) {
    return [
      `Halo Kak ${nama}, salam dari manajemen ${ctx.propertyName}. 🙏`,
      ``,
      `Pembayaran sewa untuk masa menginap Anda telah kami terima. ✅`,
      ``,
      `Berikut rincian kwitansi digital:`,
      `- ${unitLabel}`,
      `- Tanggal Check-in: *${inv.checkIn}*`,
      `- Tanggal Check-out: *${inv.checkOut}*`,
      `- Total Durasi: *${inv.nights} Malam/Hari*`,
      `- *Total Dibayar: Rp ${waAmount(inv.total)}*`,
      `- Tanggal Pembayaran: *${inv.paidAt ?? "hari ini"}*`,
      `- Status: *LUNAS*`,
      ``,
      `Kwitansi & rincian digital dapat diakses di:`,
      ctx.portalUrl,
      ``,
      `Terima kasih telah menginap. Selamat beristirahat! 🙏`,
      ``,
      BRAND_WA_FOOTER,
    ].join("\n");
  }

  return [
    `Halo Kak ${nama}, salam dari manajemen ${ctx.propertyName}. 🙏`,
    ``,
    `Pembayaran sewa untuk periode *${periodFullLabel(inv.periodKey)}* telah kami terima. ✅`,
    ``,
    `Berikut rincian kwitansi digital:`,
    `- Unit/Kamar: *${inv.roomId}*`,
    `- *Total Dibayar: Rp ${waAmount(inv.total)}*`,
    `- Tanggal Pembayaran: *${inv.paidAt ?? "hari ini"}*`,
    `- Status: *LUNAS*`,
    ``,
    `Kwitansi & rincian digital dapat diakses di:`,
    ctx.portalUrl,
    ``,
    `Terima kasih telah membayar tepat waktu. 🙏`,
    ``,
    BRAND_WA_FOOTER,
  ].join("\n");
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
    unpaidCount: invoices.filter(isInvoiceUnpaid).length,
    totalCount: invoices.length,
    byStatus: {
      belumBayar: invoices.filter((i) => i.status === "belumBayar").length,
      lunas: invoices.filter((i) => i.status === "lunas").length,
      verifikasi: invoices.filter((i) => i.status === "verifikasi").length,
      jatuhTempo: invoices.filter((i) => i.status === "jatuhTempo").length,
      menunggak: invoices.filter((i) => i.status === "menunggak").length,
    },
  };
}

// ── WhatsApp message template ────────────────────────────────────────────────
// Template lama buildWaMessage digantikan buildBillingWaMessage (tagihan) &
// buildReceiptWaMessage (kwitansi lunas) di atas — format spesifikasi WA baru.
