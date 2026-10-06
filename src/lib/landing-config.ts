// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Konfigurasi landing komersial (aman server & client)
//
// Nilai dapat dioverride via environment (lihat .env.example):
//   NEXT_PUBLIC_SUPPORT_WHATSAPP   nomor WhatsApp Admin, mis. 6285187813569
//   NEXT_PUBLIC_SUPPORT_EMAIL      email customer care
//   NEXT_PUBLIC_LICENSE_PRICE_LABEL label harga di landing, mis. "Rp399.000"
//   NEXT_PUBLIC_MAYAR_CHECKOUT_URL tautan checkout Mayar lisensi seumur hidup
// ─────────────────────────────────────────────────────────────────────────────

export const BRAND = {
  product: "UnitKu",
  vendor: "Elvindigital",
  tagline: "Kelola Kost, Kontrakan & Unit Sewa",
};

/** Nomor WhatsApp Admin UnitKu — pintu tunggal pembelian & bantuan */
export const SUPPORT_WA_NUMBER = (
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "6285187813569"
).replace(/[^\d]/g, "");

export const SUPPORT_WA_LINK = `https://wa.me/${SUPPORT_WA_NUMBER}`;

/** Nomor Admin dalam format tampilan lokal utk teks UI — "085187813569" */
export const SUPPORT_WA_DISPLAY = SUPPORT_WA_NUMBER.startsWith("62")
  ? `0${SUPPORT_WA_NUMBER.slice(2)}`
  : SUPPORT_WA_NUMBER;

export const SUPPORT_WA_PURCHASE_LINK = `${SUPPORT_WA_LINK}?text=${encodeURIComponent(
  "Halo Admin UnitKu, saya ingin membeli Lisensi Seumur Hidup (Rp 399.000). Mohon info rekening / panduan pembayarannya. Terima kasih!",
)}`;

/** Tautan bantuan "ragu cara bayar" — Admin memandu langkah demi langkah */
export const SUPPORT_WA_HELP_LINK = `${SUPPORT_WA_LINK}?text=${encodeURIComponent(
  "Halo Admin UnitKu, saya ragu cara pembayarannya. Mohon dipandu langkah demi langkah membeli Lisensi Seumur Hidup (Rp 399.000). Terima kasih!",
)}`;

/**
 * Tautan tombol sekunder "Pesan Manual via WhatsApp Admin" DI DALAM modal
 * checkout — pesan promo persis sesuai kampanye (data Nama & No. WhatsApp
 * pembeli disimpan ke license_leads via POST /api/leads SEBELUM chat dibuka).
 */
export const SUPPORT_WA_MANUAL_PROMO_LINK =
  `https://wa.me/${SUPPORT_WA_NUMBER}?text=` +
  "Halo%20Admin%20UnitKu,%20saya%20ingin%20ambil%20promo%20Lisensi%20Seumur%20Hidup%20Rp%20399.000.%20Mohon%20info%20rekening%20pembayarannya.";

export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@elvindigital.com";

export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
  "Pembelian Lisensi Seumur Hidup UnitKu",
)}`;

/** Label harga tampil di landing — sinkronkan dengan produk Mayar Anda */
export const LICENSE_PRICE_LABEL =
  process.env.NEXT_PUBLIC_LICENSE_PRICE_LABEL ?? "Rp399.000";

/** Nominal lisensi (IDR) yang dikirim ke API Mayar saat membuat invoice */
export const LICENSE_AMOUNT_IDR =
  Number(process.env.NEXT_PUBLIC_LICENSE_PRICE_IDR ?? "399000") || 399000;

/** Tautan checkout Mayar — kosong = tombol beli membuka modal bantuan CS */
export const MAYAR_CHECKOUT_URL =
  process.env.NEXT_PUBLIC_MAYAR_CHECKOUT_URL ?? "";

// ── Gerbang lisensi (layar gembok) — pembayaran & konfirmasi manual ─────────

/** Nomor WhatsApp Admin penerima konfirmasi pembayaran manual di gerbang
 *  lisensi (layar gembok "Akses UnitKu Belum Aktif") — env-overridable. */
export const ADMIN_PAYMENT_CONFIRM_WA_NUMBER = (
  process.env.NEXT_PUBLIC_ADMIN_PAYMENT_WHATSAPP || "6285169856256"
).replace(/[^\d]/g, "");

/** Rekening transfer manual di gerbang lisensi (tombol salin + data a.n.) —
 *  env-overridable agar mudah diganti tanpa deploy ulang kode. */
export const MANUAL_TRANSFER = {
  bank: process.env.NEXT_PUBLIC_MANUAL_BANK_NAME || "BCA",
  accountNumber: process.env.NEXT_PUBLIC_MANUAL_BANK_ACCOUNT || "0970545093",
  accountHolder: process.env.NEXT_PUBLIC_MANUAL_BANK_HOLDER || "Alburhanul Huda",
} as const;

/** Nominal lisensi tampil rapi — "Rp 399.000" (dari LICENSE_AMOUNT_IDR agar
 *  tetap sinkron dengan nominal yang dikirim ke Mayar). */
export const LICENSE_PRICE_DISPLAY = `Rp ${LICENSE_AMOUNT_IDR.toLocaleString("id-ID")}`;

/** Template pesan WA konfirmasi pembayaran — [EMAIL_USER] diganti dinamis
 *  dengan email akun yang sedang login di gerbang lisensi. */
const WA_PAYMENT_CONFIRM_TEMPLATE =
  "Halo%20Admin%20UnitKu,%20saya%20sudah%20mendaftar%20dengan%20akun%20[EMAIL_USER]%20dan%20ingin%20konfirmasi%20pembayaran%20lisensi.";

/** Tautan WA konfirmasi pembayaran milik pemilik akun `email` (wa.me ready) */
export function adminPaymentConfirmWaLink(
  email: string | null | undefined,
): string {
  const akun = email?.trim() ? email.trim() : "(akun saya)";
  return `https://wa.me/${ADMIN_PAYMENT_CONFIRM_WA_NUMBER}?text=${WA_PAYMENT_CONFIRM_TEMPLATE.replace(
    "[EMAIL_USER]",
    encodeURIComponent(akun),
  )}`;
}

export const COPYRIGHT_LINE =
  "© 2026 UnitKu by Elvindigital. All rights reserved.";
