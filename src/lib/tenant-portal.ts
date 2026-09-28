// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Tenant Public Web Portal dataset ("Magic Token Link & QR")
//
// Setiap penghuni terdaftar otomatis memegang `portalToken` unik
// (lihat kost-data.ts → seededPortalToken / newPortalToken). Halaman publik
// /portal?token=… me-resolve token tersebut ke SATU kamar — menampilkan
// identitas kamar & tagihan milik token tersebut saja, tanpa login.
//
// Integration seam: ganti resolvePortalRoom/portalInvoiceView dengan
// `GET /api/portal?token=…` dan pembayaran dengan webhook payment gateway
// (Midtrans/Xendit). QRIS payload mengikuti standar EMVCo (dynamic, amount-bound).
// ─────────────────────────────────────────────────────────────────────────────

import { formatIDR, type Room } from "./kost-data";
import { INVOICE_STATUS_META, type Invoice } from "./kost-invoices";

/** Domain produksi untuk tautan "siap salin" & QR pintu */
export const PORTAL_BASE_URL = "https://indokost.id/portal";

/** Tautan portal siap salin untuk sebuah token akses */
export function portalLink(token: string): string {
  return `${PORTAL_BASE_URL}?token=${token}`;
}

/** Deep-link internal (tab baru dari dashboard owner, relative → works di sandbox) */
export function portalLocalPath(token: string): string {
  return `/portal?token=${token}`;
}

/**
 * Magic-link resolver: token → kamar & penyewa pemilik token.
 * Token tidak dikenal / kamar sudah dihapus → null (portal menampilkan
 * state "Tautan tidak valid" — tidak ada data lain yang bocor).
 */
export function resolvePortalRoom(token: string, rooms: Room[]): Room | null {
  if (!token) return null;
  return rooms.find((r) => r.tenant?.portalToken === token) ?? null;
}

export const PORTAL_ISSUED_LABEL = "Diterbitkan 26 Sep 2025";

// ── Virtual Account options ──────────────────────────────────────────────────

export interface VaAccount {
  bank: string;
  va: string; // display format, spaced
}

export const VA_ACCOUNTS: VaAccount[] = [
  { bank: "BCA", va: "8801 2938 1029 3844" },
  { bank: "Mandiri", va: "8951 0011 2233 4455" },
  { bank: "BRI", va: "2620 1099 8877 6655" },
];

// ── QRIS dynamic payload (EMVCo TLV, mock merchant) ──────────────────────────

/** CRC-16/CCITT-FALSE — required trailing checksum of an EMVCo QRIS payload */
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const tlv = (id: string, value: string) => id + String(value.length).padStart(2, "0") + value;

const MERCHANT_PAN = "936009140000001230";
const MERCHANT_ID = "10940318210303403";

/** Nama merchant EMVCo dari nama properti — uppercase ASCII alnum, maks 25 char */
export function qrisMerchantName(propertyName: string): string {
  const clean = propertyName
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .trim();
  return clean.length > 0 ? clean.slice(0, 25) : "UNITKU";
}

export const QRIS_NMID = "NMID: 936009140000001230";

/** Payload QRIS dinamis terikat nominal & referensi tagihan */
export function buildQrisPayload(
  total: number,
  billRef: string,
  propertyName = "Kost Griya Pratama"
): string {
  const merchantAccount =
    tlv("00", "ID.CO.QRIS.WWW") + tlv("01", MERCHANT_PAN) + tlv("02", MERCHANT_ID) + tlv("03", "UMI");
  const body =
    tlv("00", "01") +
    tlv("01", "12") + // 12 = dynamic QR (amount bound)
    tlv("26", merchantAccount) +
    tlv("51", merchantAccount) +
    tlv("52", "5812") + // MCC: food/housing services proxy
    tlv("53", "360") + // IDR
    tlv("54", String(total)) +
    tlv("58", "ID") +
    tlv("59", qrisMerchantName(propertyName)) +
    tlv("60", "JAKARTA") +
    tlv("61", "12340") +
    tlv("62", tlv("07", billRef.replace("#", ""))) + // bill reference
    "6304";
  return body + crc16(body);
}

/** Payment channels shown under the QR ("Scan via …") */
export const QRIS_CHANNELS = ["BCA", "Gojek", "ShopeePay"];

export const AUTO_VERIFY_NOTE =
  "Status pembayaran akan otomatis terverifikasi dalam 1–2 menit setelah transfer berhasil.";

// ── Invoice → tampilan publik portal ─────────────────────────────────────────

export interface PortalInvoiceLine {
  label: string;
  sub: string;
  amount: number;
}

export type PortalBannerTone = "amber" | "rose" | "emerald" | "violet";

export interface PortalInvoiceView {
  id: string;
  statusLabel: string;
  pillClass: string;
  bannerTone: PortalBannerTone;
  bannerText: string;
  issuedLabel: string;
  lines: PortalInvoiceLine[];
  total: number;
}

function portalLineSub(label: string, periodLabel: string): string {
  if (label === "Sewa Kamar") return periodLabel;
  if (label.startsWith("Listrik")) return "Pemakaian bulan berjalan";
  if (label.startsWith("Parkir")) return "Add-on parkir bulanan";
  return "Add-on bulanan";
}

/** Invoice owner → kartu tagihan publik (status, banner, rincian, total) */
export function portalInvoiceView(inv: Invoice): PortalInvoiceView {
  const meta = INVOICE_STATUS_META[inv.status];
  let tone: PortalBannerTone;
  let text: string;
  switch (inv.status) {
    case "lunas":
      tone = "emerald";
      text = `Pembayaran diterima ${inv.paidAt ?? "—"} — terima kasih.`;
      break;
    case "verifikasi":
      tone = "violet";
      text = "Pembayaran sedang diverifikasi otomatis (1–2 menit).";
      break;
    case "menunggak":
      tone = "rose";
      text = `Menunggak — jatuh tempo ${inv.dueDate}. Segera lakukan pembayaran.`;
      break;
    default: // jatuhTempo
      tone = "amber";
      text = `Menunggu Pembayaran — jatuh tempo ${inv.dueDate}.`;
  }
  return {
    id: inv.id,
    statusLabel: meta.label,
    pillClass: meta.pill,
    bannerTone: tone,
    bannerText: text,
    issuedLabel: PORTAL_ISSUED_LABEL,
    lines: inv.lines.map((l) => ({
      label: l.label,
      sub: portalLineSub(l.label, inv.periodLabel),
      amount: l.amount,
    })),
    total: inv.total,
  };
}

// ── Issue report categories (portal → owner ticketing) ───────────────────────

export const ISSUE_CATEGORIES = [
  "AC",
  "Kelistrikan/Lampu",
  "Sanitasi/Air/Plumbing",
  "Kebocoran/Atap",
  "Kunci/Pintu",
  "Lainnya",
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

/** Format IDR singkat untuk total portal (dipakai lintas komponen portal) */
export function portalTotalLabel(total: number): string {
  return formatIDR(total);
}
