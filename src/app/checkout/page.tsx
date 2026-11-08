// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Halaman checkout khusus iklan Facebook Ads (/checkout)
//
// Landing page one-off untuk kampanye Facebook Ads: ringkas, mobile-first,
// fokus konversi, TANPA header/navigasi/footer landing page yang panjang.
//
// Tracking:
//   - Meta Pixel dimuat kondisional via NEXT_PUBLIC_FACEBOOK_PIXEL_ID
//     (kosong = tanpa pixel, tanpa error — lihat facebook-pixel.tsx).
//   - Saat pixel aktif: event 'PageView' otomatis; 'InitiateCheckout'
//     menyusul HANYA saat tombol bayar diklik (lihat checkout-client.tsx).
//
// Alur pembelian (lihat checkout-client.tsx):
//   Tombol "Bayar Otomatis" → POST /api/checkout (Route Handler internal):
//   server menyimpan lead, membuat invoice Mayar per-pembeli dgn
//   metadata.affiliate_ref dari cookie `unitku_ref` (atribusi afiliasi),
//   lalu redirect ke URL pembayaran Mayar. Fallback 503: link statis Mayar
//   dgn query param referral. Tombol "Pesan Manual via WhatsApp Admin" →
//   POST /api/leads → wa.me Admin.
//   Pembayaran sukses → webhook /api/webhooks/mayar → lisensi aktif otomatis
//   + komisi afiliasi Rp150.000 tercatat.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";

import { CheckoutClient } from "@/components/checkout/checkout-client";
import { FacebookPixel } from "@/components/checkout/facebook-pixel";

export const metadata: Metadata = {
  title: "Checkout Lisensi UnitKu - Sekali Bayar",
  description:
    "Lisensi Seumur Hidup UnitKu — sekali bayar Rp 399.000, tanpa biaya bulanan / biaya per kamar selamanya. Bayar otomatis via QRIS / VA / E-Wallet atau pesan manual via WhatsApp Admin.",
};

export default function CheckoutPage() {
  return (
    <>
      <FacebookPixel />
      <CheckoutClient />
    </>
  );
}
