"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Gerbang lisensi (layar gembok)
//
// Ditampilkan pada dashboard owner & onboarding bila akun masuk tetapi
// isLifetimeLicensed = false. Pembayaran dilunasi → webhook Mayar otomatis
// menandai lisensi → tombol "Periksa Ulang Status" memuat ulang halaman dan
// akses penuh terbuka selamanya (tanpa batasan).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/client";

interface LicenseGateProps {
  email?: string;
  checkoutUrl?: string;
}

export function LicenseGate({ email, checkoutUrl }: LicenseGateProps) {
  const [busy, setBusy] = useState<"check" | "logout" | null>(null);

  const handleCheckAgain = () => {
    setBusy("check");
    window.location.reload();
  };

  const handleLogout = async () => {
    setBusy("logout");
    await signOut();
    window.location.href = "/login";
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f8fafc] px-4 py-8">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="mb-5 flex items-center justify-center gap-3">
          <Image
            src="/brand/icon.png"
            alt="Logo UnitKu"
            width={40}
            height={40}
            priority
            className="size-10 shrink-0 rounded-xl object-contain ring-1 ring-zinc-200"
          />
          <div className="min-w-0">
            <p className="text-[17px] font-bold leading-tight text-zinc-900">UnitKu</p>
            <p className="text-[12.5px] leading-tight text-zinc-500">
              Kelola Kost, Kontrakan &amp; Unit Sewa
            </p>
          </div>
        </div>

        <div className="w-full rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-zinc-100">
            <Lock className="size-6 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
          </span>

          <h1 className="mt-4 text-lg font-bold text-zinc-900">
            Akses UnitKu Belum Aktif
          </h1>
          <p className="mt-1 text-[13px] leading-snug text-zinc-600">
            Silakan selesaikan pembayaran lisensi seumur hidup Anda untuk
            membuka semua fitur.
          </p>

          {email && (
            <p className="mt-2 break-all text-[12.5px] text-zinc-500">
              Akun: <span className="font-medium text-zinc-700">{email}</span>
            </p>
          )}

          <div className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left">
            <BadgeCheck className="size-4 shrink-0 text-zinc-600" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-[12.5px] leading-snug text-zinc-600">
              Sekali bayar — aktif selamanya, tanpa langganan bulanan.
            </p>
          </div>

          {checkoutUrl ? (
            <Button asChild className="mt-4 h-10 w-full text-[13px] font-semibold">
              <a href={checkoutUrl} target="_blank" rel="noreferrer">
                <ExternalLink strokeWidth={1.75} aria-hidden="true" />
                Selesaikan Pembayaran di Mayar
              </a>
            </Button>
          ) : (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left">
              <p className="text-[12.5px] leading-snug text-zinc-600">
                Tautan pembayaran (Checkout Mayar) belum dikonfigurasi — silakan
                hubungi admin UnitKu untuk menyelesaikan pembayaran.
              </p>
            </div>
          )}

          <Button
            variant="outline"
            onClick={handleCheckAgain}
            disabled={busy !== null}
            className="mt-2.5 h-10 w-full text-[13px] font-medium"
          >
            {busy === "check" ? (
              <Loader2 className="animate-spin" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <RefreshCw strokeWidth={1.75} aria-hidden="true" />
            )}
            Sudah Membayar? Periksa Ulang Status
          </Button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={busy !== null}
            className="mt-4 text-[12.5px] font-medium text-red-600 underline-offset-2 hover:underline disabled:opacity-60"
          >
            {busy === "logout" ? "Memproses…" : "Keluar dari akun ini"}
          </button>
        </div>
      </div>
    </div>
  );
}
