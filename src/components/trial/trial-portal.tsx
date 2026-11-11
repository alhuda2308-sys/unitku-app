"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Portal Trial 3 Hari untuk owner kost/kontrakan (client)
//
// Dipakai halaman /trial?token=<id> — owner TANPA akun login. Isi:
//   • Sambutan personal (nama owner + properti) + badge "Mode Uji Coba"
//   • HITUNG MUNDUR live ke trialExpiresAt (detik per detik, sinkron awal
//     dengan serverNow agar hydration konsisten)
//   • Pratinjau fitur utama UnitKu yang bisa dicoba
//   • PAYWALL otomatis: saat lewat 72 jam (hari ke-4) — status LOCKED dari
//     server ATAU countdown mencapai nol di sisi client — seluruh portal
//     tertutup overlay peringatan penuh dengan CTA "Aktifkan Lisensi
//     Sekarang" → /checkout?ref=<refCode mitra pembuat> (komisi terjaga).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import {
  BellRing,
  Check,
  Home,
  LayoutGrid,
  Lock,
  ReceiptText,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TrialState {
  ownerName: string;
  propertyName: string | null;
  status: "PENDING" | "ACTIVE" | "LOCKED";
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  partnerRefCode: string;
}

/** Pratinjau fitur utama — cermin value props landing (konsisten copy) */
const FEATURE_PREVIEW = [
  {
    icon: BellRing,
    title: "Tagihan WA Otomatis",
    desc: "Tagihan sewa terkirim ke WhatsApp penghuni tepat jadwal, lengkap dengan pengingat jatuh tempo.",
  },
  {
    icon: ReceiptText,
    title: "Kwitansi Instan",
    desc: "Terima pembayaran → kwitansi rapi siap kirim dalam sekali tap, tanpa tulis manual.",
  },
  {
    icon: Wallet,
    title: "Pembukuan Kas Rapi",
    desc: "Pemasukan & pengeluaran kost tercatat otomatis — laporan keuangan selalu siap cek.",
  },
  {
    icon: LayoutGrid,
    title: "Denah Kamar Interaktif",
    desc: "Lihat status semua kamar (terisi/kosong/menunggak) dari satu layar denah visual.",
  },
] as const;

/** Format sisa waktu Indonesia — "2 hari 5 jam 12 menit" */
function formatRemaining(ms: number): string {
  if (ms <= 0) return "0 detik";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d} hari ${h} jam ${m} menit`;
  if (h > 0) return `${h} jam ${m} menit ${s} detik`;
  if (m > 0) return `${m} menit ${s} detik`;
  return `${s} detik`;
}

export function TrialPortal({
  state: initialState,
  token,
  serverNow,
}: {
  state: TrialState;
  token: string;
  serverNow: string; // ISO — sinkronisasi awal countdown (anti hydration shift)
}) {
  const [state, setState] = useState<TrialState>(initialState);
  // now awal = waktu server → render pertama client = render server (hydration aman)
  const [now, setNow] = useState(() => new Date(serverNow).getTime());

  const expiresAt = state.trialExpiresAt
    ? new Date(state.trialExpiresAt).getTime()
    : null;
  const startedAt = state.trialStartedAt
    ? new Date(state.trialStartedAt).getTime()
    : null;

  const locked = state.status === "LOCKED";
  const remainingMs = expiresAt ? expiresAt - now : 0;
  // Paywall tampil bila status server LOCKED ATAU waktu habis di sisi client
  // (server tetap menegakkan lazy-lock LOCKED pada pembacaan berikutnya —
  // sinkron tanpa perlu request konfirmasi tambahan dari client).
  const showPaywall = locked || (expiresAt !== null && remainingMs <= 0);

  // Interval detik — mulai SETELAH mount (tidak jalan saat hydration).
  // Berhenti saat sudah terkunci (tidak ada lagi hitungan yang berubah).
  useEffect(() => {
    if (state.status === "LOCKED") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.status]);

  // ── Link checkout paywall — atribusi komisi ke mitra pembuat ───────────────
  const checkoutHref = state.partnerRefCode
    ? `/checkout?ref=${encodeURIComponent(state.partnerRefCode)}`
    : "/checkout";

  // Persentase masa trial yang sudah berjalan (0–100, dijepit)
  const usedPercent =
    startedAt && expiresAt && expiresAt > startedAt
      ? Math.min(
          100,
          Math.max(0, ((now - startedAt) / (expiresAt - startedAt)) * 100),
        )
      : 0;

  return (
    <div className="relative min-h-screen bg-zinc-50">
      {/* ═══════════ Konten portal trial (tertutup overlay saat LOCKED) ══════ */}
      <div
        aria-hidden={showPaywall || undefined}
        className={cn(
          "min-h-screen transition-[filter] duration-300",
          showPaywall && "pointer-events-none select-none blur-[6px]",
        )}
      >
        {/* Header portal */}
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span
                className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-[13px] font-black text-white"
                aria-hidden="true"
              >
                U
              </span>
              <span className="text-[15px] font-black tracking-tight text-zinc-950">
                UnitKu
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                <Lock className="size-3" strokeWidth={2.5} aria-hidden="true" />
                Mode Uji Coba
              </span>
            </div>
            {/* Chip countdown live */}
            {state.status === "ACTIVE" && expiresAt ? (
              <p className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-bold tabular-nums text-emerald-800">
                ⏳ Sisa trial: {formatRemaining(Math.max(0, remainingMs))}
              </p>
            ) : null}
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
          {/* Sambutan */}
          <section aria-labelledby="trial-welcome">
            <h1
              id="trial-welcome"
              className="text-2xl font-black leading-tight tracking-tight text-zinc-950 sm:text-3xl"
            >
              Selamat datang, Pak/Bu{" "}
              <span className="text-emerald-700">{state.ownerName}</span>! 👋
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-zinc-600 sm:text-[15px]">
              Uji coba gratis 3 hari sistem kelola properti UnitKu
              {state.propertyName
                ? ` untuk ${state.propertyName}`
                : ""}
              {" "}telah aktif. Silakan jelajahi fitur-fitur utamanya di bawah
              ini — semua perubahan Anda{" "}
              <span className="font-semibold text-zinc-800">
                aman tersimpan
              </span>
              .
            </p>

            {/* Progres masa trial */}
            {state.status === "ACTIVE" && startedAt && expiresAt ? (
              <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-zinc-600">
                  <span>Masa uji coba berjalan</span>
                  <span className="tabular-nums text-emerald-700">
                    {formatRemaining(Math.max(0, remainingMs))} lagi
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={Math.round(usedPercent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progres masa uji coba 3 hari"
                  className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100"
                >
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-[width] duration-1000"
                    style={{ width: `${usedPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-snug text-zinc-500">
                  Setelah 3 hari, portal terkunci otomatis — data Anda tetap
                  aman dan bisa langsung dipakai lagi setelah aktivasi lisensi.
                </p>
              </div>
            ) : null}
          </section>

          {/* Pratinjau fitur */}
          <section aria-labelledby="trial-features" className="mt-8">
            <h2
              id="trial-features"
              className="text-lg font-black tracking-tight text-zinc-950 sm:text-xl"
            >
              Yang Bisa Anda Kelola di UnitKu
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FEATURE_PREVIEW.map((feature) => (
                <article
                  key={feature.title}
                  className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5"
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"
                    aria-hidden="true"
                  >
                    <feature.icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-black tracking-tight text-zinc-950 sm:text-[15px]">
                      {feature.title}
                    </h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
                      {feature.desc}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Poin aktivasinya */}
          <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
            <h2 className="text-[15px] font-black tracking-tight text-emerald-900 sm:text-base">
              Puas dengan uji cobanya?
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-emerald-800">
              Aktifkan lisensi seumur hidup —{" "}
              <span className="font-bold">sekali bayar</span>, tanpa biaya
              bulanan selamanya. Semua data uji coba Anda otomatis lanjut ke
              akun penuh.
            </p>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-3">
              {[
                "Sekali bayar lunas selamanya",
                "Tanpa biaya per kamar",
                "Data trial langsung dipakai",
              ].map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-1.5 text-[12.5px] font-semibold text-emerald-900"
                >
                  <Check
                    className="mt-0.5 size-3.5 shrink-0"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                  {point}
                </li>
              ))}
            </ul>
            <Button
              asChild
              className="mt-4 h-11 gap-2 bg-emerald-600 px-5 text-[14px] font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              <a href={checkoutHref}>
                <Home className="size-4" strokeWidth={2} aria-hidden="true" />
                Aktifkan Lisensi Sekarang
              </a>
            </Button>
          </section>
        </main>

        <footer className="border-t border-zinc-200 bg-white">
          <p className="mx-auto w-full max-w-4xl px-4 py-4 text-center text-[11px] text-zinc-400 sm:px-6">
            UnitKu — Kelola Kost, Kontrakan &amp; Unit Sewa Tanpa Ribet
          </p>
        </footer>
      </div>

      {/* ═══════════ PAYWALL — peringatan penuh saat trial berakhir ══════════ */}
      {showPaywall ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="paywall-title"
          aria-describedby="paywall-desc"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-950/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center shadow-2xl sm:p-8">
            <span
              className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 text-amber-400"
              aria-hidden="true"
            >
              <Lock className="size-7" strokeWidth={1.75} />
            </span>
            <h2
              id="paywall-title"
              className="mt-4 text-xl font-black leading-snug tracking-tight text-white sm:text-2xl"
            >
              🔒 Masa Uji Coba 3 Hari Telah Berakhir
            </h2>
            <p
              id="paywall-desc"
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
              Lisensi seumur hidup — sekali bayar, tanpa biaya bulanan.
              Pembayaran memakai link resmi mitra yang membagikan trial ini.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
