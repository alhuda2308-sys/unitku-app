// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Halaman checkout khusus iklan Facebook Ads (/checkout)
//
// Landing page one-off untuk kampanye Facebook Ads: ringkas, mobile-first,
// fokus konversi, TANPA header/navigasi/footer landing page yang panjang.
//
// Referral: ?ref=<kode> (link mitra, fallback ?ref_code=) dibaca DI SERVER
// via searchParams dan diteruskan sebagai initialRef ke CheckoutClient —
// render pertama sudah tahu status referral (tanpa layout shift). Fallback
// cookie `unitku_ref` (masuk via landing /?ref= lalu navigasi client-side)
// dibaca client setelah mount — lihat checkout-client.tsx.
//
// Tracking:
//   - Meta Pixel dimuat kondisional via NEXT_PUBLIC_FACEBOOK_PIXEL_ID
//     (kosong = tanpa pixel, tanpa error — lihat facebook-pixel.tsx).
//   - Saat pixel aktif: event 'PageView' otomatis; 'InitiateCheckout'
//     menyusul HANYA saat tombol bayar diklik (lihat checkout-client.tsx).
//
// Alur pembelian (lihat checkout-client.tsx):
//   Traffic REFERRAL MITRA: tombol "Pesan Manual via WhatsApp Admin"
//   disembunyikan, "Bayar Otomatis" tampil penuh — transaksi wajib via Mayar
//   agar komisi mitra tercatat (extraData.affiliate_ref).
//   Tombol "Bayar Otomatis" → POST /api/checkout (Route Handler internal):
//   server menyimpan lead (source "Referral: <kode>" bila mitra aktif),
//   membuat invoice Mayar per-pembeli dgn extraData.affiliate_ref, lalu
//   redirect ke URL pembayaran Mayar. Fallback 503: link statis Mayar dgn
//   query param referral. Tombol "Pesan Manual via WhatsApp Admin" (organik
//   saja) → POST /api/leads → wa.me Admin.
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

/** Next 16 — searchParams datang sebagai Promise di Server Component */
interface CheckoutPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  // Kode referral dari URL — ?ref= (link mitra) lalu ?ref_code= (warisan).
  // Hanya string pertama yang dipakai; sanitasi ketat dilakukan ulang di
  // client (sanitizeAffiliateRef) dan server (resolveActiveAffiliate).
  const initialRef =
    typeof params.ref === "string"
      ? params.ref
      : typeof params.ref_code === "string"
        ? params.ref_code
        : null;

  return (
    <>
      <FacebookPixel />
      <CheckoutClient initialRef={initialRef} />
    </>
  );
}
