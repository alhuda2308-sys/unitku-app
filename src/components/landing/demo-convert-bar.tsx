"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — DemoConvertBar: sticky bottom bar konversi di Dashboard Demo
//
// Tampil HANYA saat pengunjung berada di mode demo (instantDemo ?demo=1 atau
// sesi demo via cookie) — tujuan kampanye Meta Ads: demo → InitiateCheckout.
//
//  • Teks   : "Sedang mencoba demo UnitKu? Suka fiturnya? Amankan Lisensi
//             Seumur Hidup Rp 399.000"
//  • Tombol : "Beli Lisensi Sekarang" → membuka modal checkout (BuyCta) yang
//             otomatis menembakkan event fbq('track','InitiateCheckout').
//  • Bisa ditutup (X) — pilihan disimpan di sessionStorage agar tidak muncul
//    lagi sepanjang sesi tab.
//
// Posisi: menempel di bawah layar. Di mobile naik di atas MobileBottomBar
// (bottom 4.25rem + safe-area); di desktop menempel penuh di bawah (bottom 0).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";

import { BuyCta } from "@/components/landing/buy-cta";

/** sessionStorage key — bar tak muncul lagi sepanjang sesi tab ini */
const DISMISS_KEY = "unitku-demo-convert-bar-dismissed";

const emptySubscribe = () => () => {};

/** Shim mount aman SSR — render keputusan hanya setelah hydration (pola pwa-install) */
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function DemoConvertBar() {
  const mounted = useMounted();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false; // sessionStorage diblokir — bar tetap tampil
    }
  });

  if (dismissed || !mounted) return null;

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // sessionStorage diblokir — cukup sembunyikan untuk render ini
    }
    setDismissed(true);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 px-3 sm:bottom-0 sm:px-4 sm:pb-3"
      role="complementary"
      aria-label="Ajakan membeli lisensi dari mode demo"
    >
      {/* Mobile: teks + X di atas, tombol full-width di bawah.
          Desktop: satu baris — teks · tombol · X. */}
      <div className="relative mx-auto flex max-w-4xl flex-col gap-2.5 rounded-xl border border-zinc-700 bg-zinc-900 p-3 shadow-[0_16px_40px_rgba(15,23,42,0.35)] sm:flex-row sm:items-center sm:gap-4 sm:px-5">
        <p className="min-w-0 flex-1 pr-8 text-[12.5px] font-medium leading-snug text-zinc-200 sm:pr-0 sm:text-sm">
          Sedang mencoba demo UnitKu? Suka fiturnya?{" "}
          <span className="font-bold text-white">
            Amankan Lisensi Seumur Hidup Rp 399.000
          </span>
        </p>
        <BuyCta
          compact
          inverted
          className="w-full sm:order-2 sm:w-auto"
          label="Beli Lisensi Sekarang"
        />
        <button
          type="button"
          onClick={dismiss}
          aria-label="Tutup bar penawaran demo"
          className="absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 sm:order-3 sm:static sm:shrink-0"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
