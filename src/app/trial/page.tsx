// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — /trial : Gerbang Uji Coba 3 Hari → LANGSUNG ke dashboard utama
//
// Gerbang publik (middleware PUBLIC_PAGE_PREFIXES) — diakses owner TANPA
// login lewat link pribadi dari mitra: /trial?token=<OwnerTrial.id>.
//
// ALUR (direct-entry — tanpa halaman sambutan):
//   1. Owner klik link dari WhatsApp → halaman ini memverifikasi token ke DB
//      dan MENGAKTIFKAN trial pada klik PERTAMA (PENDING → ACTIVE,
//      trialStartedAt = sekarang, trialExpiresAt = +72 jam). Idempoten:
//      refresh berulang tidak pernah memperpanjang masa trial.
//   2. Token valid & aktif → redirect /api/trial/enter → sesi dashboard
//      dipasang (pola /demo) → OWNER LANGSUNG DIHADAPKAN KE DASHBOARD UTAMA
//      UnitKu (denah kamar, okupansi, menu kelola) dengan banner kecil
//      "Mode Uji Coba — Sisa trial: X hari" di bagian atas (TrialBanner).
//   3. Lewat 72 jam / token LOCKED (lazy-lock ditegakkan server setiap
//      pembacaan) → HALAMAN PEMBERITAHUAN "Masa Uji Coba Telah Berakhir"
//      dengan tombol menuju checkout lisensi milik MITRA pembuat
//      (?ref=<refCode>) — komisi Rp150.000 tetap tercatat untuk mitra.
//
// Token salah/tidak ada → kartu panduan rapi (bukan error mentah).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound, Lock, MessageCircle, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAuthUser } from "@/lib/auth/server";
import { SUPPORT_WA_LINK } from "@/lib/landing-config";
import { activateOwnerTrial } from "@/lib/owner-trial";
import { buildCheckoutUrl } from "@/lib/trial-shared";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Uji Coba Gratis 3 Hari — UnitKu",
  description:
    "Coba gratis sistem kelola kost, kontrakan & unit sewa UnitKu selama 3 hari — tagihan WA otomatis, kwitansi instan, pembukuan kas rapi. Sekali bayar lunas selamanya bila lanjut lisensi.",
};

/** Ambil nilai searchParams pertama (string | string[] | undefined) */
function firstParam(
  value: string | string[] | undefined,
): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === "string" && v.trim());
    return first?.trim() ?? null;
  }
  return null;
}

/** Kartu status generik utk kegagalan/token salah — konsisten gaya gerbang */
function TrialGateCard({
  icon,
  title,
  message,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  hint?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <span
          className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-600"
          aria-hidden="true"
        >
          {icon}
        </span>
        <h1 className="mt-4 text-lg font-black leading-snug tracking-tight text-zinc-950 sm:text-xl">
          {title}
        </h1>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-zinc-600">
          {message}
        </p>
        {hint ? (
          <p className="mt-2 text-[12px] leading-snug text-zinc-500">{hint}</p>
        ) : null}
        <div className="mt-5 flex flex-col items-center gap-2">
          <Button
            asChild
            className="h-11 gap-2 bg-emerald-600 px-5 text-[14px] font-bold text-white hover:bg-emerald-700"
          >
            <a href="/">Pelajari UnitKu di Beranda</a>
          </Button>
          <a
            href={SUPPORT_WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 underline-offset-2 transition-colors hover:text-emerald-700 hover:underline"
          >
            <MessageCircle
              className="size-3.5"
              strokeWidth={2}
              aria-hidden="true"
            />
            Butuh bantuan? Chat Admin via WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}

/**
 * Halaman PEMBERITAHUAN masa trial berakhir (token LOCKED / expired > 3 hari)
 * — sesuai alur: arahkan ke pemberitahuan + tombol menuju link pembelian
 * afiliasi MITRA pembuat (?ref=<refCode>) agar komisi tetap tercatat.
 */
function TrialExpiredCard({
  checkoutHref,
}: {
  checkoutHref: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10">
      <div
        role="alertdialog"
        aria-labelledby="trial-expired-title"
        aria-describedby="trial-expired-desc"
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center shadow-2xl sm:p-8"
      >
        <span
          className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 text-amber-400"
          aria-hidden="true"
        >
          <Lock className="size-7" strokeWidth={1.75} />
        </span>
        <h1
          id="trial-expired-title"
          className="mt-4 text-xl font-black leading-snug tracking-tight text-white sm:text-2xl"
        >
          🔒 Masa Uji Coba 3 Hari Telah Berakhir
        </h1>
        <p
          id="trial-expired-desc"
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
        <a
          href={SUPPORT_WA_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 underline-offset-2 transition-colors hover:text-emerald-400 hover:underline"
        >
          <MessageCircle
            className="size-3.5"
            strokeWidth={2}
            aria-hidden="true"
          />
          Butuh bantuan? Chat Admin via WhatsApp
        </a>
      </div>
    </main>
  );
}

export default async function TrialPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // ── Owner berlisensi yang sudah login tidak butuh trial → dashboard miliknya
  // (mencegah trial yang tidak pernah dipakai ikut terbakar 72 jamnya).
  const authUser = await getAuthUser();
  if (authUser && !authUser.demo) redirect("/dashboard");

  const params = await searchParams;
  const token = firstParam(params.token);

  if (!token) {
    return (
      <TrialGateCard
        icon={<KeyRound className="size-7" strokeWidth={1.75} />}
        title="Link Trial Tidak Lengkap"
        message="Halaman ini membutuhkan link pribadi dari mitra UnitKu Anda — biasanya berupa tautan yang dikirim lewat WhatsApp dengan kode unik di belakangnya."
        hint="Contoh bentuk link: unitku.my.id/trial?token=XXXX"
      />
    );
  }

  // Aktivasi klik pertama + baca status (idempoten, lazy-lock ditegakkan)
  const result = await activateOwnerTrial(token);

  if (!result.ok) {
    if (result.reason === "not-found") {
      return (
        <TrialGateCard
          icon={<Lock className="size-7" strokeWidth={1.75} />}
          title="Link Trial Tidak Valid"
          message="Link yang Anda buka tidak dikenali sistem atau sudah tidak berlaku. Silakan minta link uji coba terbaru dari mitra UnitKu yang menghubungi Anda."
        />
      );
    }
    return (
      <TrialGateCard
        icon={<Lock className="size-7" strokeWidth={1.75} />}
        title="Kendala Sistem"
        message="Terjadi kendala menghubungi database saat membuka trial Anda. Tunggu sebentar lalu muat ulang halaman — link Anda tetap berlaku."
      />
    );
  }

  // ── Trial habis (LOCKED) → halaman pemberitahuan + tombol checkout mitra ───
  if (result.state.status === "LOCKED") {
    return (
      <TrialExpiredCard
        checkoutHref={buildCheckoutUrl(result.state.partnerRefCode)}
      />
    );
  }

  // ── Trial aktif → LANGSUNG masuk dashboard utama (sesi dipasang API enter) ─
  redirect(`/api/trial/enter?token=${encodeURIComponent(token)}`);
}
