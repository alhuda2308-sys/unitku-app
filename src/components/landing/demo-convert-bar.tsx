"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — DemoConvertBar: sticky bottom bar konversi di Dashboard Demo/Trial
//
// Tampil HANYA saat pengunjung berada di mode demo (instantDemo ?demo=1 atau
// sesi demo via cookie) ATAU sesi trial (?trial=1 dari link mitra) — tujuan
// kampanye: demo/trial → checkout.
//
//  • Teks demo : "Sedang mencoba demo UnitKu? Suka fiturnya? Amankan Lisensi
//                Seumur Hidup Rp 399.000"
//  • Teks trial: "Sedang mencoba gratis 3 hari? Suka fiturnya? …" (variant)
//  • Tombol demo  : "Beli Lisensi Sekarang" → membuka modal checkout (BuyCta)
//             yang menembakkan event custom fbq('trackCustom','ClickCTA_Beli')
//             — InitiateCheckout baru ditembakkan saat form disubmit (bukan
//             saat modal dibuka, agar event tak bias).
//  • Tombol trial : "Beli Lisensi Sekarang" → ANCHOR langsung ke checkout
//             milik MITRA pembuat trial (/checkout?ref=<refCode> via hook
//             useTrialCheckoutHref) — BUKAN checkout pusat admin, agar
//             komisi mitra tetap tercatat. Event ClickCTA_Beli tetap
//             ditembakkan saat anchor diklik (paritas pengukuran Meta Ads).
//             Selama refCode belum ter-resolve, bar DISEMBUNYIKAN — owner
//             trial tak pernah diarahkan ke checkout pusat.
//  • Bisa ditutup (X) — pilihan disimpan di sessionStorage agar tidak muncul
//    lagi sepanjang sesi tab.
//
// Posisi: menempel di bawah layar. Di mobile naik di atas MobileBottomBar
// (bottom 4.25rem + safe-area); di desktop menempel penuh di bawah (bottom 0).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";

import { BuyCta } from "@/components/landing/buy-cta";
import { Button } from "@/components/ui/button";
import { useTrialCheckoutHref } from "@/hooks/use-trial-checkout-href";

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

export function DemoConvertBar({
  variant = "demo",
}: {
  /** "trial" → copy uji coba 3 hari (dashboard ?trial=1); default copy demo */
  variant?: "demo" | "trial";
}) {
  const mounted = useMounted();
  // Trial: resolve URL checkout mitra pembuat (cookie trial → /api/trial/state).
  // null saat bukan trial / belum resolve → CTA disembunyikan (lihat di bawah).
  const isTrial = variant === "trial";
  const trialCheckoutHref = useTrialCheckoutHref(isTrial);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false; // sessionStorage diblokir — bar tetap tampil
    }
  });

  if (dismissed || !mounted) return null;
  // Mode trial tanpa URL mitra ter-resolve → jangan tampilkan apa pun:
  // fallback ke checkout pusat akan mencuri komisi mitra (dilarang).
  if (isTrial && !trialCheckoutHref) return null;

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
          {variant === "trial" ? (
            <>
              Sedang mencoba gratis 3 hari? Suka fiturnya?{" "}
              <span className="font-bold text-white">
                Amankan Lisensi Seumur Hidup Rp 399.000
              </span>
            </>
          ) : (
            <>
              Sedang mencoba demo UnitKu? Suka fiturnya?{" "}
              <span className="font-bold text-white">
                Amankan Lisensi Seumur Hidup Rp 399.000
              </span>
            </>
          )}
        </p>
        {/* TRIAL (href ter-resolve): anchor langsung ke checkout MITRA pembuat
            (?ref=<refCode>) — gaya identik dgn BuyCta compact+inverted.
            DEMO: modal checkout pusat (BuyCta). Guard awal sudah menyembunyikan
            seluruh bar saat trial & href belum resolve — jalur null di sini
            hanya terjadi di mode demo. */}
        {trialCheckoutHref ? (
          <Button
            asChild
            className="h-10 min-h-10 w-full whitespace-nowrap bg-white px-4 py-2 text-[13px] font-bold leading-none text-zinc-900 hover:bg-zinc-100 sm:order-2 sm:h-11 sm:min-h-11 sm:w-auto sm:px-5 sm:text-sm"
          >
            <a
              href={trialCheckoutHref}
              onClick={() => {
                // Paritas Meta Ads dgn jalur modal: sinyal minat, bukan konversi
                window.fbq?.("trackCustom", "ClickCTA_Beli");
              }}
            >
              Beli Lisensi Sekarang
            </a>
          </Button>
        ) : (
          <BuyCta
            compact
            inverted
            className="w-full sm:order-2 sm:w-auto"
            label="Beli Lisensi Sekarang"
          />
        )}
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
