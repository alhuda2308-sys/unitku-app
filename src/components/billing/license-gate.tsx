"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Gerbang lisensi (layar gembok "Akses UnitKu Belum Aktif")
//
// Ditampilkan pada dashboard owner & onboarding bila akun masuk tetapi
// isLifetimeLicensed = false. Tiga jalur bayar agar pengguna baru tidak buntu:
//   1. Bayar otomatis Mayar (QRIS / VA / E-Wallet) — SATU tombol utama
//      "Bayar Otomatis (QRIS / VA / E-Wallet)" (ikon kartu kredit) yang
//      SELALU membuka URL checkout Mayar di tab baru (jangan pernah ke WA —
//      konfirmasi WA sudah ada di bawah). URL: API gerbang (server) →
//      NEXT_PUBLIC_MAYAR_CHECKOUT_URL → slot hard-coded
//      MAYAR_CHECKOUT_URL_FALLBACK; semua kosong → tombol disembunyikan
//      TANPA pesan error mentah yang membingungkan.
//   2. Transfer manual BCA — box rekening + tombol "Salin No Rekening"
//      (ikon berubah jadi centang + toast "Tersalin").
//   3. Konfirmasi / hubungi admin via WhatsApp — pesan otomatis berisi
//      email akun yang sedang login.
// Pembayaran dilunasi → webhook Mayar / konfirmasi admin menandai lisensi →
// tombol "Periksa Ulang Status" memuat ulang halaman dan akses penuh
// terbuka selamanya (tanpa batasan). "Keluar dari akun ini" tetap di bawah.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  Check,
  Copy,
  CreditCard,
  Landmark,
  Loader2,
  Lock,
  MessageCircle,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/client";
import { toast } from "@/lib/toast";
import {
  adminPaymentConfirmWaLink,
  LICENSE_PRICE_DISPLAY,
  MANUAL_TRANSFER,
  MAYAR_CHECKOUT_URL,
  MAYAR_CHECKOUT_URL_FALLBACK,
} from "@/lib/landing-config";

interface LicenseGateProps {
  email?: string;
  checkoutUrl?: string;
}

export function LicenseGate({ email, checkoutUrl }: LicenseGateProps) {
  const [busy, setBusy] = useState<"check" | "logout" | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  // URL checkout valid — prioritas: API gerbang (getMayarCheckoutUrl,
  // server) → NEXT_PUBLIC_MAYAR_CHECKOUT_URL → slot hard-coded
  // MAYAR_CHECKOUT_URL_FALLBACK. TIDAK ADA fallback WhatsApp di sini
  // (konfirmasi WA admin sudah tersedia sebagai tombol terpisah di bawah);
  // semua kosong → tombol Mayar disembunyikan (bukan tautan mati).
  const autoCheckoutUrl =
    (checkoutUrl ?? "").trim() ||
    MAYAR_CHECKOUT_URL.trim() ||
    MAYAR_CHECKOUT_URL_FALLBACK.trim();

  const handleCheckAgain = () => {
    setBusy("check");
    window.location.reload();
  };

  const handleLogout = async () => {
    setBusy("logout");
    await signOut();
    window.location.href = "/login";
  };

  const handleCopyAccount = async () => {
    try {
      await navigator.clipboard.writeText(MANUAL_TRANSFER.accountNumber);
    } catch {
      // Fallback browser lama / konteks non-secure — clipboard API tak tersedia.
      const textarea = document.createElement("textarea");
      textarea.value = MANUAL_TRANSFER.accountNumber;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    toast.success("Nomor rekening disalin", {
      description: `${MANUAL_TRANSFER.bank} ${MANUAL_TRANSFER.accountNumber} a.n. ${MANUAL_TRANSFER.accountHolder}`,
    });
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2_000);
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

        <div className="w-full rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-zinc-100">
            <Lock className="size-6 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
          </span>

          <h1 className="mt-4 text-center text-lg font-bold text-zinc-900">
            Akses UnitKu Belum Aktif
          </h1>
          <p className="mt-1 text-center text-[13px] leading-snug text-zinc-600">
            Silakan selesaikan pembayaran lisensi seumur hidup Anda untuk
            membuka semua fitur.
          </p>

          {email && (
            <p className="mt-2 break-all text-center text-[12.5px] text-zinc-500">
              Akun: <span className="font-medium text-zinc-700">{email}</span>
            </p>
          )}

          <div className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left">
            <BadgeCheck className="size-4 shrink-0 text-zinc-600" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-[12.5px] leading-snug text-zinc-600">
              Sekali bayar — aktif selamanya, tanpa langganan bulanan.
            </p>
          </div>

          {/* ── 1) Pembayaran otomatis (Mayar) — selalu ke checkout Mayar ─ */}
          {autoCheckoutUrl && (
            <Button asChild className="mt-4 h-11 w-full text-[13px] font-semibold">
              <a
                href={autoCheckoutUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Bayar otomatis via Mayar — QRIS, Virtual Account, atau E-Wallet (tab baru)"
              >
                <CreditCard strokeWidth={1.75} aria-hidden="true" />
                Bayar Otomatis (QRIS / VA / E-Wallet)
              </a>
            </Button>
          )}

          {/* ── Pembatas "atau transfer manual" ─────────────────────────── */}
          <div className="my-4 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-zinc-200" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              atau transfer manual
            </span>
            <span className="h-px flex-1 bg-zinc-200" />
          </div>

          {/* ── 2) Box transfer manual (BCA) ────────────────────────────── */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Landmark className="size-4 shrink-0 text-zinc-500" strokeWidth={1.75} aria-hidden="true" />
                <p className="text-[13px] font-semibold text-zinc-900">
                  Transfer Bank {MANUAL_TRANSFER.bank}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleCopyAccount()}
                aria-label={`Salin nomor rekening ${MANUAL_TRANSFER.bank} ${MANUAL_TRANSFER.accountNumber}`}
                className="h-7 gap-1 px-2 text-[11.5px] font-medium"
              >
                {copied ? (
                  <Check className="size-3.5 text-emerald-600" strokeWidth={2} aria-hidden="true" />
                ) : (
                  <Copy className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                )}
                {copied ? "Tersalin!" : "Salin No Rekening"}
              </Button>
            </div>

            <p className="mt-2.5 font-mono text-[19px] font-bold tracking-[0.08em] text-zinc-900 tabular-nums">
              {MANUAL_TRANSFER.accountNumber}
            </p>
            <p className="mt-0.5 text-[12.5px] text-zinc-600">
              a.n. <span className="font-medium text-zinc-800">{MANUAL_TRANSFER.accountHolder}</span>
            </p>

            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-[12.5px] leading-snug text-emerald-900">
                Nominal Lisensi: <span className="font-bold">{LICENSE_PRICE_DISPLAY}</span>{" "}
                <span className="font-medium text-emerald-700">(Sekali Bayar — Seumur Hidup)</span>
              </p>
            </div>

            <p className="mt-2.5 text-[11.5px] leading-snug text-zinc-500">
              Sudah transfer? Konfirmasi via WhatsApp di bawah agar lisensi
              Anda segera diaktifkan admin.
            </p>
          </div>

          {/* ── 3) Konfirmasi / hubungi admin via WhatsApp ──────────────── */}
          <Button
            asChild
            variant="outline"
            className="mt-3 h-10 w-full gap-1.5 border-emerald-300 bg-emerald-50 text-[13px] font-semibold text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900"
          >
            <a
              href={adminPaymentConfirmWaLink(email)}
              target="_blank"
              rel="noreferrer"
              aria-label="Konfirmasi atau hubungi Admin UnitKu via WhatsApp"
            >
              <MessageCircle className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Konfirmasi / Hubungi Admin via WhatsApp
            </a>
          </Button>

          {/* ── 4) Cek ulang status lisensi ─────────────────────────────── */}
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

          {/* ── 5) Keluar — paling bawah ────────────────────────────────── */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={busy !== null}
            className="mt-4 w-full text-center text-[12.5px] font-medium text-red-600 underline-offset-2 hover:underline disabled:opacity-60"
          >
            {busy === "logout" ? "Memproses…" : "Keluar dari akun ini"}
          </button>
        </div>
      </div>
    </div>
  );
}
