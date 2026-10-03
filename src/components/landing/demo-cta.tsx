"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — CTA "Coba Denah Kost Saya" (→ /demo) dengan event Meta Pixel 'Lead'
//
// Tombol demo adalah konversi utama iklan UnitKu: setiap klik tercatat
// sebagai konversi 'Lead' (content_name: 'Coba Demo UnitKu') di Meta Ads.
//
// Komponen client karena butuh onClick — landing page (src/app/page.tsx)
// adalah server component. Guard window.fbq?. menjaga agar tidak error bila
// pixel belum termuat / diblokir ekstensi pemblokir iklan.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function DemoCta() {
  const trackLead = () => {
    window.fbq?.("track", "Lead", { content_name: "Coba Demo UnitKu" });
  };

  return (
    <Link
      href="/demo"
      onClick={trackLead}
      className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-8 py-4 text-base font-bold text-white transition-colors hover:bg-zinc-800 sm:w-auto sm:text-lg"
    >
      Coba Denah Kost Saya — Gratis
      <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}
