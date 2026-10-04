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

export const SUPPORT_WA_PURCHASE_LINK = `${SUPPORT_WA_LINK}?text=${encodeURIComponent(
  "Halo Admin UnitKu, saya ingin membeli Lisensi Seumur Hidup (Rp 399.000). Mohon info rekening / panduan pembayarannya. Terima kasih!",
)}`;

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

export const COPYRIGHT_LINE =
  "© 2026 UnitKu by Elvindigital. All rights reserved.";
