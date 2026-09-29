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
// (Midtrans/Xendit). QRIS memakai gambar statis unggahan owner
// (Pengaturan → Rekening & Pembayaran → field `qrisImageUrl`).
// ─────────────────────────────────────────────────────────────────────────────

import { formatIDR, type Room } from "./kost-data";
import { INVOICE_STATUS_META, type Invoice } from "./kost-invoices";

/** Domain produksi (fallback SSR) untuk tautan "siap salin" & QR pintu.
 *  Di browser, portalLink() memakai origin dinamis (window.location.origin)
 *  sehingga tautan selalu mengikuti domain yang sedang aktif — bukan
 *  hardcode domain vendor lama. */
export const PORTAL_BASE_URL = "https://unitku.id/portal";

/** Tautan portal siap salin untuk sebuah token akses.
 *  @param origin opsional — origin aktif (window.location.origin) agar tautan
 *  mengikuti domain yang sedang dibuka (localhost / preview / unitku.id). */
export function portalLink(token: string, origin?: string): string {
  const base = (origin ?? "").trim().replace(/\/+$/, "");
  return `${base || PORTAL_BASE_URL}/portal?token=${token}`;
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

export const PORTAL_ISSUED_LABEL = "Diterbitkan 26 Sep 2026";

// ── Rekening & QRIS statis (kartu pembayaran portal) ────────────────────────

/** Rekening pembayaran owner + QRIS statis (Pengaturan → Rekening & Pembayaran).
 *  Sumber: cloud (GET /api/properties & /api/portal?token=…), fallback settings
 *  localStorage. `qrisImageUrl` berupa dataURL (PNG/JPG/WebP terkompresi). */
export interface PortalRekening {
  bank: string;
  noRek: string;
  atasNama: string;
  /** DataURL gambar QRIS statis — hadir = tab "Scan QRIS" tampil di portal */
  qrisImageUrl?: string;
  /** Nama Merchant / NMID QRIS (opsional) — contoh "Kost Griya Nyaman · NMID: ID1020…" */
  qrisNmid?: string;
}

/** Panduan scan QRIS — teks verbatim spesifikasi (ditampilkan di bawah gambar) */
export const QRIS_SCAN_GUIDE =
  "Buka aplikasi m-Banking atau e-Wallet (BCA, Mandiri, GoPay, OVO, ShopeePay), lalu scan kode di atas.";

/** Channel yang ditampilkan sebagai chips di bawah panduan scan */
export const QRIS_CHANNELS = ["BCA", "Mandiri", "GoPay", "OVO", "ShopeePay"];

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
    case "belumBayar":
      tone = "amber";
      text = `Tagihan diterbitkan — jatuh tempo ${inv.dueDate}.`;
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
