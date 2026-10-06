"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — CTA "Coba Demo Gratis" (section Video Tur, landing)
//
// Tombol utama di bawah video YouTube: LANGSUNG mengaktifkan Mode Demo
// Interaktif UnitKu tanpa perlu login/daftar — GET /demo menyetel cookie
// sesi demo lalu redirect ke /dashboard?demo=1 (dataset simulasi 12 kamar
// instan). Pola identik dengan DemoCta di hero: jalur WAJIB via /demo karena
// tanpa cookie sesi, guard auth /dashboard melempar pengunjung baru ke
// /login (funnel putus). Owner yang sudah login diarahkan ke dashboard
// miliknya (tidak dipaksa demo) — perilaku diatur penuh oleh /demo/route.ts.
//
// Setiap klik tercatat sebagai konversi 'Lead' di Meta Ads (content_name
// mengikuti label tombol) — funnel: demo → sticky demo bar →
// InitiateCheckout → Purchase. Komponen client karena butuh onClick —
// landing page (src/app/page.tsx) adalah server component. Guard
// window.fbq?. menjaga agar tidak error bila pixel belum termuat / diblokir
// ekstensi pemblokir iklan.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function VideoDemoCta() {
  return (
    <Link
      href="/demo"
      onClick={() =>
        window.fbq?.("track", "Lead", { content_name: "Coba Demo Gratis" })
      }
      className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-8 py-4 text-base font-bold text-white transition-colors hover:bg-zinc-800 sm:w-auto sm:text-lg"
    >
      Coba Demo Gratis
      <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}
