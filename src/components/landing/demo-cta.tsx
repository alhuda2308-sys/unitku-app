"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — CTA "Coba Demo Gratis (Tanpa Daftar)" (→ /demo → /dashboard?demo=1)
//
// Tombol eksplorasi landing: membuka Dashboard Demo interaktif TANPA daftar.
// Jalur wajib via GET /demo (bukan langsung /dashboard?demo=1) karena /demo
// menyetel cookie sesi demo terlebih dahulu — tanpa cookie, guard auth
// /dashboard melempar pengunjung baru ke /login (funnel putus). Setelah
// redirect, pengunjung mendarat di /dashboard?demo=1 dgn dataset simulasi
// 12 kamar instan.
// Setiap klik tetap tercatat sebagai konversi 'Lead' (content_name:
// "Coba Demo UnitKu") di Meta Ads — funnel: demo → sticky demo bar →
// InitiateCheckout → Purchase.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface DemoCtaProps {
  /** outline = sekunder di samping tombol beli (hero); solid = gaya lama */
  variant?: "solid" | "outline";
  className?: string;
}

export function DemoCta({ variant = "solid", className = "" }: DemoCtaProps) {
  const trackLead = () => {
    window.fbq?.("track", "Lead", { content_name: "Coba Demo UnitKu" });
  };

  const base =
    "inline-flex h-14 w-full items-center justify-center gap-2 rounded-md px-8 py-4 text-base font-bold transition-colors sm:w-auto sm:text-lg";
  const tone =
    variant === "outline"
      ? "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
      : "bg-zinc-900 text-white hover:bg-zinc-800";

  return (
    <Link
      href="/demo"
      onClick={trackLead}
      className={`${base} ${tone} ${className}`}
    >
      Coba Demo Gratis (Tanpa Daftar)
      <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}
