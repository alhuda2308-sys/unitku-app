"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Form Pendaftaran Mitra Afiliasi publik (/affiliate/join)
//
// Mobile-first, tema emerald/zinc senada portal affiliator. Dua state:
//   1. FORM   — Nama, No. WA (sanitasi 08/62 otomatis), Kode Referral (huruf
//      kecil/angka/strip, auto-lowercase), rekening opsional (boleh nanti).
//   2. SUKSES — kartu selamat "Kak {nama}", link referral + checkout (tombol
//      Copy), tombol Buka Dashboard Mitra (magic-link token), dan tombol
//      "Kirim Link ke WhatsApp Saya" agar link tersimpan di chat pribadi.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Copy,
  Check,
  Gift,
  Landmark,
  Loader2,
  MessageCircle,
  PartyPopper,
  Send,
  ShieldCheck,
  User,
} from "lucide-react";

import { ReferralLinkCard } from "@/components/affiliate/referral-link-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeWaPhone } from "@/lib/checkout-validation";
import { SITE_URL } from "@/lib/landing-config";

/** Kebijakan kode referral — sinkron dengan POST /api/affiliate/join */
const REF_CODE_MIN = 3;
const REF_CODE_MAX = 30;

interface JoinFormValues {
  name: string;
  phone: string;
  refCode: string;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
}

interface JoinFieldErrors {
  name?: string;
  phone?: string;
  refCode?: string;
  form?: string;
}

interface JoinSuccess {
  name: string;
  refCode: string;
  phone: string;
  accessToken: string;
}

/** Salin teks ke clipboard — fallback utk browser/http non-secure */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // lanjut ke fallback
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** Tombol "Kirim Link ke WhatsApp Saya" dengan feedback salin cadangan */
function SendWaButton({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="contents">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-12 w-full gap-2 border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
        onClick={async () => {
          // Cadangan: bila pop-up WA diblokir, link tetap bisa disalin manual
          const ok = await copyToClipboard(href);
          if (!ok) return;
          setCopied(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 2000);
        }}
        aria-label="Kirim link referral ke WhatsApp saya"
      >
        {copied ? (
          <>
            <Check className="size-4.5" strokeWidth={2.25} aria-hidden="true" />
            Link tersalin — tempel di WhatsApp Kakak
          </>
        ) : (
          <>
            <Send className="size-4.5" strokeWidth={2} aria-hidden="true" />
            Kirim Link ke WhatsApp Saya
          </>
        )}
      </Button>
    </a>
  );
}

export function AffiliateJoinForm() {
  const [values, setValues] = useState<JoinFormValues>({
    name: "",
    phone: "",
    refCode: "",
    bankName: "",
    bankAccountNo: "",
    bankAccountName: "",
  });
  const [errors, setErrors] = useState<JoinFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<JoinSuccess | null>(null);

  // Naikkan layar ke kartu selamat saat pendaftaran berhasil
  useEffect(() => {
    if (result) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [result]);

  const setField = (key: keyof JoinFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));
  };

  const dashboardUrl = useMemo(() => {
    if (!result) return "";
    return `/affiliate/dashboard?ref=${encodeURIComponent(result.refCode)}&token=${encodeURIComponent(result.accessToken)}`;
  }, [result]);

  const dashboardAbsoluteUrl = useMemo(() => {
    if (!result) return "";
    return `${SITE_URL}/affiliate/dashboard?ref=${encodeURIComponent(result.refCode)}&token=${encodeURIComponent(result.accessToken)}`;
  }, [result]);

  /** Pesan ringkasan akun — disimpan mitra di chat pribadinya via WA */
  const waSummaryHref = useMemo(() => {
    if (!result) return "";
    const text = [
      `Halo Kak ${result.name}, berikut data akun afiliasi UnitKu Kakak:`,
      "",
      `• Kode Referral: ${result.refCode}`,
      `• Link Referral Utama: ${SITE_URL}/?ref=${result.refCode}`,
      `• Link Checkout Langsung: ${SITE_URL}/checkout?ref=${result.refCode}`,
      `• Dashboard Mitra: ${dashboardAbsoluteUrl}`,
      "",
      "Simpan pesan ini ya Kak — setiap penjualan lewat link Kakak dicatat komisi Rp150.000 otomatis. Semangat berpromosi!",
    ].join("\n");
    return `https://wa.me/${result.phone}?text=${encodeURIComponent(text)}`;
  }, [result, dashboardAbsoluteUrl]);

  // ── STATE SUKSES: kartu selamat menggantikan form ──────────────────────────
  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col items-center text-center">
          <span
            className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
            aria-hidden="true"
          >
            <PartyPopper className="size-7" strokeWidth={2} />
          </span>
          <h2 className="mt-4 text-xl font-extrabold leading-snug text-zinc-900 sm:text-2xl">
            Selamat Kak {result.name}, Akun Afiliasi Anda Sudah Aktif! 🎉
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-600">
            Akun kemitraan Kakak sudah aktif dengan kode referral{" "}
            <span className="font-bold text-emerald-700">{result.refCode}</span>.
            Bagikan link di bawah — setiap penjualan menghasilkan komisi{" "}
            <span className="font-semibold text-zinc-800">Rp150.000</span>.
          </p>
        </div>

        <div className="mt-5">
          <ReferralLinkCard refCode={result.refCode} />
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <Button
            asChild
            size="lg"
            className="h-12 w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Link href={dashboardUrl} aria-label="Buka Dashboard Mitra">
              <BadgeCheck className="size-4.5" strokeWidth={2} aria-hidden="true" />
              Buka Dashboard Mitra
              <ArrowRight className="size-4.5" strokeWidth={2} aria-hidden="true" />
            </Link>
          </Button>
          <SendWaButton href={waSummaryHref} />
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-zinc-500">
          Simpan link Dashboard Mitra di chat WhatsApp Kakak — tautan itu juga
          pintu masuk pribadi Kakak tanpa perlu password.
        </p>
      </div>
    );
  }

  // ── STATE FORM: pendaftaran mitra baru ─────────────────────────────────────
  const validate = (): JoinFieldErrors => {
    const next: JoinFieldErrors = {};
    if (values.name.trim().length < 2) {
      next.name = "Mohon isi nama lengkap Anda (minimal 2 huruf).";
    }
    if (!/^62[0-9]{8,13}$/.test(normalizeWaPhone(values.phone))) {
      next.phone =
        "Nomor WhatsApp tidak valid — gunakan awalan 08 atau 62 (contoh: 081234567890).";
    }
    const code = values.refCode.trim().toLowerCase();
    if (
      code.length < REF_CODE_MIN ||
      code.length > REF_CODE_MAX ||
      !/^[a-z0-9-]+$/.test(code)
    ) {
      next.refCode = `Kode referral hanya boleh huruf kecil, angka, dan tanda hubung (${REF_CODE_MIN}–${REF_CODE_MAX} karakter) — contoh: sukses2026.`;
    }
    return next;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      const res = await fetch("/api/affiliate/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          phone: normalizeWaPhone(values.phone),
          refCode: values.refCode.trim().toLowerCase(),
          bankName: values.bankName.trim() || null,
          bankAccountNo: values.bankAccountNo.trim() || null,
          bankAccountName: values.bankAccountName.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { success: boolean; error?: string; field?: string; name?: string; refCode?: string; phone?: string; accessToken?: string }
        | null;

      if (res.ok && data?.success && data.name && data.refCode && data.phone && data.accessToken) {
        setResult({
          name: data.name,
          refCode: data.refCode,
          phone: data.phone,
          accessToken: data.accessToken,
        });
        return;
      }

      const field =
        data?.field === "name" || data?.field === "phone" || data?.field === "refCode"
          ? data.field
          : undefined;
      if (field && data?.error) {
        // Error spesifik satu field (mis. kode referral sudah dipakai) — tampil
        // inline di bawah input terkait.
        setErrors({ [field]: data.error });
      } else {
        setErrors({
          form:
            data?.error ?? "Terjadi kendala — coba lagi sebentar ya, Kak.",
        });
      }
    } catch {
      setErrors({
        form: "Koneksi bermasalah — periksa internet Kakak lalu coba lagi ya.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const fieldSkin =
    "h-11 rounded-lg border-zinc-200 bg-white text-[15px] focus-visible:ring-emerald-200";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7"
      noValidate
    >
      <div className="flex items-center gap-2">
        <span
          className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
          aria-hidden="true"
        >
          <Gift className="size-4.5" strokeWidth={2} />
        </span>
        <div>
          <h2 className="text-base font-bold text-zinc-900 sm:text-lg">
            Form Pendaftaran Mitra
          </h2>
          <p className="text-xs text-zinc-500">
            Gratis — akun aktif langsung setelah form dikirim.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {/* 1. Nama Lengkap */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="join-name" className="text-[13px] font-semibold text-zinc-800">
            Nama Lengkap <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <User
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
              strokeWidth={2}
              aria-hidden="true"
            />
            <Input
              id="join-name"
              name="name"
              autoComplete="name"
              maxLength={80}
              placeholder="Contoh: Putri Rahmawati"
              value={values.name}
              onChange={(e) => setField("name", e.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "join-name-error" : undefined}
              className={`${fieldSkin} pl-9`}
            />
          </div>
          {errors.name ? (
            <p id="join-name-error" role="alert" className="text-xs font-medium text-red-600">
              {errors.name}
            </p>
          ) : null}
        </div>

        {/* 2. Nomor WhatsApp */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="join-phone" className="text-[13px] font-semibold text-zinc-800">
            Nomor WhatsApp <span className="text-red-500">*</span>
          </Label>
          <Input
            id="join-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            placeholder="081234567890 / 6281234567890"
            value={values.phone}
            onChange={(e) => setField("phone", e.target.value)}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "join-phone-error" : "join-phone-hint"}
            className={fieldSkin}
          />
          {errors.phone ? (
            <p id="join-phone-error" role="alert" className="text-xs font-medium text-red-600">
              {errors.phone}
            </p>
          ) : (
            <p id="join-phone-hint" className="text-xs text-zinc-500">
              Awalan 08 / 62 otomatis dirapikan — ini identitas akun & kanal
              komisi Kakak.
            </p>
          )}
        </div>

        {/* 3. Kode Referral Pilihan */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="join-ref" className="text-[13px] font-semibold text-zinc-800">
            Kode Referral Pilihan <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-zinc-400">
              {SITE_URL.replace("https://", "")}/?ref=
            </span>
            <Input
              id="join-ref"
              name="refCode"
              autoComplete="off"
              spellCheck={false}
              maxLength={REF_CODE_MAX}
              placeholder="sukses2026"
              value={values.refCode}
              onChange={(e) =>
                setField("refCode", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              aria-invalid={Boolean(errors.refCode)}
              aria-describedby={errors.refCode ? "join-ref-error" : "join-ref-hint"}
              className={`${fieldSkin} pl-40 pr-3 sm:pl-48`}
            />
          </div>
          {errors.refCode ? (
            <p id="join-ref-error" role="alert" className="text-xs font-medium text-red-600">
              {errors.refCode}
            </p>
          ) : (
            <p id="join-ref-hint" className="text-xs text-zinc-500">
              Huruf kecil, angka, dan tanda hubung — pilih kode yang mudah
              Kakak sebutkan saat promosi.
            </p>
          )}
        </div>

        {/* 4–5. Rekening opsional */}
        <fieldset className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3.5">
          <legend className="flex items-center gap-1.5 px-1 text-[13px] font-semibold text-zinc-700">
            <Landmark className="size-4" strokeWidth={2} aria-hidden="true" />
            Rekening Pencairan (opsional)
          </legend>
          <p className="mt-1 text-xs leading-snug text-zinc-500">
            Boleh dikosongkan — bisa Kakak lengkapi kapan saja lewat Dashboard
            Mitra agar komisi bisa dicairkan.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="join-bank" className="text-[13px] font-medium text-zinc-700">
                Nama Bank / E-Wallet
              </Label>
              <Input
                id="join-bank"
                name="bankName"
                maxLength={80}
                placeholder="Contoh: BCA, Dana, GoPay"
                value={values.bankName}
                onChange={(e) => setField("bankName", e.target.value)}
                className={`${fieldSkin} bg-white`}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="join-bank-no" className="text-[13px] font-medium text-zinc-700">
                  Nomor Rekening
                </Label>
                <Input
                  id="join-bank-no"
                  name="bankAccountNo"
                  inputMode="numeric"
                  maxLength={60}
                  placeholder="1234567890"
                  value={values.bankAccountNo}
                  onChange={(e) => setField("bankAccountNo", e.target.value)}
                  className={`${fieldSkin} bg-white`}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="join-bank-holder" className="text-[13px] font-medium text-zinc-700">
                  Atas Nama
                </Label>
                <Input
                  id="join-bank-holder"
                  name="bankAccountName"
                  maxLength={80}
                  placeholder="Sesuai buku tabungan"
                  value={values.bankAccountName}
                  onChange={(e) => setField("bankAccountName", e.target.value)}
                  className={`${fieldSkin} bg-white`}
                />
              </div>
            </div>
          </div>
        </fieldset>

        {errors.form ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] font-medium leading-snug text-red-700"
          >
            {errors.form}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={submitting}
          className="h-12 w-full gap-2 bg-emerald-600 text-[15px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4.5 animate-spin" strokeWidth={2.25} aria-hidden="true" />
              Mengaktifkan akun…
            </>
          ) : (
            <>
              <ShieldCheck className="size-4.5" strokeWidth={2} aria-hidden="true" />
              Daftar & Aktifkan Akun Afiliasi
            </>
          )}
        </Button>

        <p className="text-center text-xs leading-relaxed text-zinc-500">
          Dengan mendaftar, Kakak menyetujui komisi flat{" "}
          <span className="font-semibold text-zinc-700">Rp150.000 per penjualan</span>{" "}
          yang tercatat otomatis saat pembayaran lisensi diterima.
        </p>
      </div>
    </form>
  );
}
