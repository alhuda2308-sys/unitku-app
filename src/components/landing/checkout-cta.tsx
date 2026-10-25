"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — CTA sekunder hero "Miliki Akses Seumur Hidup" (→ /checkout)
//
// Link LANGSUNG ke halaman checkout iklan (/checkout) — bukan modal, sesuai
// spesifikasi CTA hero. Doktrin Meta Pixel tetap konsisten dgn BuyCta:
// klik menembakkan event custom ringan ClickCTA_Beli (sinyal minat, bukan
// konversi); InitiateCheckout ditembakkan di halaman /checkout pada momen
// submit form pembayaran (checkout-client.tsx).
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";

interface CheckoutCtaProps {
  className?: string;
  /** Label kustom — default "Miliki Akses Seumur Hidup" */
  label?: string;
}

export function CheckoutCta({
  className = "",
  label = "Miliki Akses Seumur Hidup",
}: CheckoutCtaProps) {
  return (
    <Link
      href="/checkout"
      onClick={() => window.fbq?.("trackCustom", "ClickCTA_Beli")}
      className={`inline-flex h-14 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-8 py-4 text-base font-bold text-zinc-900 transition-colors hover:bg-zinc-50 sm:w-auto sm:text-lg ${className}`}
    >
      {label}
    </Link>
  );
}
