"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Form Login Portal Mitra (/affiliate/login)
//
// LOGIN OTOMATIS BERBASIS NOMOR WHATSAPP — tanpa kode akses manual: mitra
// cukup memasukkan No. WhatsApp terdaftar; bila nomor itu milik mitra aktif
// di database, server langsung menerbitkan cookie sesi mitra
// (POST /api/affiliate/login) → mitra dibawa ke ?next= atau dashboard mitra.
// Tema emerald/zinc senada portal affiliator; mobile-first.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, LogIn, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeWaPhone } from "@/lib/checkout-validation";
import { SUPPORT_WA_LINK } from "@/lib/landing-config";

interface PartnerLoginFormProps {
  /** Tujuan setelah login — SUDAH disanitasi halaman (hanya /affiliate/…) */
  nextPath?: string | null;
}

export function PartnerLoginForm({ nextPath }: PartnerLoginFormProps) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    // Validasi ringan client-side (server memvalidasi ulang — sumber kebenaran)
    if (!normalizeWaPhone(phone).match(/^62[0-9]{8,13}$/)) {
      setFieldError("Nomor WhatsApp belum sesuai — mulai dengan 08 atau 62 ya.");
      return;
    }
    setFieldError(null);

    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliate/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (res.ok && data?.success) {
        router.replace(nextPath || "/affiliate/dashboard");
        router.refresh();
        return;
      }
      setFormError(
        data?.error ??
          "Gagal masuk — periksa koneksi Anda lalu coba lagi sebentar.",
      );
    } catch {
      setFormError(
        "Gagal menghubungi server — periksa koneksi Anda lalu coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-7">
      <div className="text-center">
        <span
          className="mx-auto flex size-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"
          aria-hidden="true"
        >
          <LogIn className="size-6" strokeWidth={1.75} />
        </span>
        <h1 className="mt-4 text-xl font-black leading-tight tracking-tight text-zinc-900 sm:text-2xl">
          Masuk Portal Mitra
        </h1>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-snug text-zinc-600 sm:text-sm">
          Kelola link referral, komisi, dan rekening pencairan Anda dalam satu
          dashboard khusus mitra UnitKu.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="partner-phone">Nomor WhatsApp</Label>
          <Input
            id="partner-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="08xxxxxxxxxx / 62xxxxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={submitting}
            aria-invalid={Boolean(fieldError)}
            className="h-11"
          />
          <p className="text-xs leading-snug text-zinc-500">
            Gunakan nomor WhatsApp yang terdaftar sebagai mitra — sistem
            memeriksa otomatis, tanpa kode akses.
          </p>
        </div>

        {fieldError && (
          <p
            role="alert"
            className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium leading-snug text-red-700"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {fieldError}
          </p>
        )}
        {formError && (
          <p
            role="alert"
            className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium leading-snug text-red-700"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {formError}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={submitting}
          className="h-12 w-full gap-2 bg-emerald-600 text-[15px] font-bold text-white shadow-sm hover:bg-emerald-700"
        >
          {submitting ? (
            <Loader2 className="size-4.5 animate-spin" aria-hidden="true" />
          ) : (
            <LogIn className="size-4.5" aria-hidden="true" />
          )}
          {submitting ? "Memeriksa…" : "Masuk ke Portal Mitra"}
        </Button>
      </form>

      <div className="mt-5 border-t border-zinc-100 pt-4 text-center">
        <a
          href={SUPPORT_WA_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 underline-offset-2 transition-colors hover:text-emerald-700 hover:underline"
        >
          <MessageCircle className="size-3.5" aria-hidden="true" />
          Nomor belum terdaftar / ingin ganti nomor? Chat Admin via WhatsApp
        </a>
      </div>
    </div>
  );
}
