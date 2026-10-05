"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — CTA "Coba Demo Interaktif" (section Video Tur, landing)
//
// Tombol utama di bawah video YouTube: scroll halus ke section "Fitur Jagoan"
// (#fitur) — area fitur utama / demo interaktif di landing. Setiap klik juga
// tercatat sebagai konversi 'Lead' di Meta Ads (konsisten dengan DemoCta di
// hero: seluruh klik demo adalah sinyal konversi iklan).
//
// Komponen client karena butuh onClick — landing page (src/app/page.tsx)
// adalah server component. Guard window.fbq?. menjaga agar tidak error bila
// pixel belum termuat / diblokir ekstensi pemblokir iklan. href="#fitur"
// tetap disediakan sebagai fallback aksesibilitas & tanpa-JS.
// ─────────────────────────────────────────────────────────────────────────────

import type { MouseEvent } from "react";
import { ArrowRight } from "lucide-react";

export function VideoDemoCta() {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.fbq?.("track", "Lead", { content_name: "Coba Demo Interaktif" });
    document
      .getElementById("fitur")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <a
      href="#fitur"
      onClick={handleClick}
      className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-8 py-4 text-base font-bold text-white transition-colors hover:bg-zinc-800 sm:w-auto sm:text-lg"
    >
      Coba Demo Interaktif
      <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
    </a>
  );
}
