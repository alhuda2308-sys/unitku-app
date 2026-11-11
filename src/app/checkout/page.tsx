// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Halaman checkout khusus iklan Facebook Ads (/checkout)
//
// Landing page one-off untuk kampanye Facebook Ads: ringkas, mobile-first,
// fokus konversi, TANPA header/navigasi/footer landing page yang panjang.
//
// Referral: ?ref=<kode> (link mitra, fallback ?ref_code=) DIVALIDASI DI SERVER
// terhadap DB via resolveActiveAffiliate — hanya kode milik mitra AKTIF yang
// diteruskan ke CheckoutClient (initialRef versi kanonik). Sumber kode: URL
// dulu (?ref= — klik terkini), fallback cookie unitku_ref (masuk via landing
// /?ref= lalu navigasi; middleware menempel cookie pada request yang sama).
// Konsekuensi penting: link referral milik mitra yang DIHAPUS/dinonaktifkan
// langsung MATI — halaman tampil organik (tidak ada lagi mode referral untuk
// kode mati), konsisten dgn validasi yang sama di POST /api/checkout.
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
import { resolveActiveAffiliate } from "@/lib/affiliate-resolve";
import { getAffiliateRefServer } from "@/lib/affiliate-server";

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
  // Kode referral mentah dari URL — ?ref= (link mitra) lalu ?ref_code= (warisan);
  // fallback cookie unitku_ref (navigasi dari landing — cookie sudah menempel
  // pada request ini via middleware). Hanya string pertama yang dipakai.
  const rawRef =
    typeof params.ref === "string"
      ? params.ref
      : typeof params.ref_code === "string"
        ? params.ref_code
        : (await getAffiliateRefServer()) ?? null;

  // VALIDASI SERVER ke DB — satu pintu dengan POST /api/checkout: hanya kode
  // milik mitra AKTIF yang lolos (mitra dihapus/nonaktif → null → organik).
  // Nilai yang diteruskan selalu versi KANONIK di DB (pencocokan case-insensitive).
  const resolved = await resolveActiveAffiliate(rawRef);
  const initialRef = resolved?.refCode ?? null;

  return (
    <>
      <FacebookPixel />
      <CheckoutClient initialRef={initialRef} />
    </>
  );
}
