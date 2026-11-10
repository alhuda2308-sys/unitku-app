"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — TrialBanner — banner "Mode Uji Coba" di dashboard utama (client)
//
// Dipasang di /dashboard tepat di bawah TopBar (flex column — selalu terlihat,
// tanpa konflik sticky dgn banner demo). Alur:
//   1. HANYA sesi demo (trial/demo) yang memicu banner — akun riil (pemilik
//      berlisensi) tidak pernah terganggu walau cookie trial masih menempel.
//   2. Cookie trial (unitku_trial) dibaca dari client → status trial diambil
//      dari /api/trial/state (server = sumber kebenaran; lazy-lock LOCKED
//      ditegakkan di DB, countdown client tidak bisa menipu paywall).
//   3. Trial ACTIVE → banner kecil: "🎁 Mode Uji Coba — Sisa trial: X hari"
//      + CTA "Aktifkan Lisensi" menuju checkout mitra pembuat (?ref=refCode).
//   4. Trial berakhir (status server LOCKED ATAU countdown mencapai nol) →
//      overlay peringatan penuh menutup dashboard + CTA lisensi (paywall).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import {
  Gift,
  Hourglass,
  Lock,
  Wallet,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAuthMeOnce } from "@/lib/api-client";
import {
  buildCheckoutUrl,
  formatTrialRemaining,
  readTrialTokenClient,
  TRIAL_COOKIE,
} from "@/lib/trial-shared";
import { cn } from "@/lib/utils";

interface TrialStatePayload {
  ownerName: string;
  propertyName: string | null;
  status: "PENDING" | "ACTIVE" | "LOCKED";
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  partnerRefCode: string;
}

type TrialPhase =
  | "checking" // memverifikasi sesi + status (belum ada UI)
  | "active" // banner countdown tampil
  | "locked" // paywall penuh
  | "off"; // bukan konteks trial — tanpa UI

/** Hapus cookie trial (dipakai saat paywall muncul agar sesi /demo berikutnya bersih) */
function clearTrialCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${TRIAL_COOKIE}=; path=/; max-age=0; sameSite=lax`;
}

export function TrialBanner() {
  const [phase, setPhase] = useState<TrialPhase>("checking");
  const [state, setState] = useState<TrialStatePayload | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // ── Bootstrap: sesi demo? cookie trial? → fetch status server ──────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      // Pemeriksaan sesi dulu: akun riil (berlisensi) TIDAK PERNAH melihat
      // banner/paywall trial — proteksi dari cookie basi setelah pembelian.
      try {
        const me = await getAuthMeOnce();
        if (!alive) return;
        if (!me.demo) {
          setPhase("off");
          return;
        }
      } catch {
        if (alive) setPhase("off"); // sesi tak terkonfirmasi → tanpa banner
        return;
      }
      const token = readTrialTokenClient();
      if (!token) {
        if (alive) setPhase("off"); // demo biasa (CTA /demo) — tanpa banner
        return;
      }
      try {
        const res = await fetch(
          `/api/trial/state?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as {
          success: boolean;
          state?: TrialStatePayload;
        };
        if (!alive) return;
        if (res.ok && json.success && json.state) {
          setState(json.state);
          setPhase(json.state.status === "LOCKED" ? "locked" : "active");
        } else {
          setPhase("off");
        }
      } catch {
        if (alive) setPhase("off"); // offline → dashboard demo tetap jalan
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ── Ticker countdown — banner cukup segar per 30 detik (format jam/hari) ───
  const expiresAtMs = state?.trialExpiresAt
    ? new Date(state.trialExpiresAt).getTime()
    : null;
  const hasCountdown = phase === "active" && expiresAtMs !== null;
  useEffect(() => {
    if (!hasCountdown) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [hasCountdown]);

  const checkoutHref = state
    ? buildCheckoutUrl(state.partnerRefCode)
    : "/checkout";

  // Paywall tampil bila server bilang LOCKED, ATAU countdown habis di client
  // (server tetap menegakkan LOCKED pada fetch berikutnya — sinkron aman).
  const remainingMs = hasCountdown
    ? Math.max(0, (expiresAtMs as number) - (now ?? Date.now()))
    : 0;
  const clientExpired = hasCountdown && remainingMs <= 0;
  const showPaywall = phase === "locked" || clientExpired;
  const showBanner = phase === "active" && !showPaywall && !dismissed;

  // ── PAYWALL penuh — trial berakhir, dashboard ditutup overlay ──────────────
  if (showPaywall) {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="trial-paywall-title"
        aria-describedby="trial-paywall-desc"
        className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-zinc-950/85 p-4 backdrop-blur-sm"
      >
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center shadow-2xl sm:p-8">
          <span
            className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 text-amber-400"
            aria-hidden="true"
          >
            <Lock className="size-7" strokeWidth={1.75} />
          </span>
          <h2
            id="trial-paywall-title"
            className="mt-4 text-xl font-black leading-snug tracking-tight text-white sm:text-2xl"
          >
            🔒 Masa Uji Coba 3 Hari Telah Berakhir
          </h2>
          <p
            id="trial-paywall-desc"
            className="mt-3 text-[13.5px] leading-relaxed text-zinc-300 sm:text-sm"
          >
            Data properti Anda aman tersimpan. Ingin melanjutkan kelola kost
            tanpa batas dan mengaktifkan sistem secara permanen? Silakan
            aktifkan lisensi seumur hidup melalui mitra resmi kami.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-6 h-12 w-full gap-2 bg-emerald-500 text-[15px] font-bold text-zinc-950 hover:bg-emerald-400"
          >
            <a href={checkoutHref}>
              <Wallet className="size-4.5" strokeWidth={2.25} aria-hidden="true" />
              Aktifkan Lisensi Sekarang
            </a>
          </Button>
          <p className="mt-3 text-[11.5px] leading-snug text-zinc-400">
            Lisensi seumur hidup — sekali bayar, tanpa biaya bulanan. Pembayaran
            memakai link resmi mitra yang membagikan trial ini.
          </p>
        </div>
      </div>
    );
  }

  // ── Banner kecil "Mode Uji Coba" — di atas konten, selalu terlihat ─────────
  if (!showBanner) return null;
  return (
    <div
      role="status"
      aria-label="Banner Mode Uji Coba"
      className="border-b border-amber-200 bg-amber-50 px-3.5 py-2 lg:px-6"
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex min-w-0 items-start gap-2 text-[12.5px] leading-snug text-amber-900">
          {hasCountdown ? (
            <Hourglass
              className="mt-0.5 size-4 shrink-0 text-amber-600"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          ) : (
            <Gift
              className="mt-0.5 size-4 shrink-0 text-amber-600"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          )}
          <span>
            <span className="font-bold">Mode Uji Coba</span>
            {hasCountdown ? (
              <>
                {" "}
                — Sisa trial:{" "}
                <span className="font-bold tabular-nums">
                  {formatTrialRemaining(remainingMs)}
                </span>
              </>
            ) : null}
            {" "}— bebas coba semua fitur di bawah ini.
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5 sm:pl-3">
          <Button
            asChild
            size="sm"
            className={cn(
              "h-8 min-h-0 gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-0 text-[12.5px] font-bold text-white hover:bg-emerald-700",
            )}
          >
            <a href={checkoutHref}>
              <Wallet className="size-3.5" strokeWidth={2} aria-hidden="true" />
              Aktifkan Lisensi
            </a>
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Tutup banner uji coba"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-900"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
