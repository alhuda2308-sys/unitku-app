"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Halaman checkout khusus iklan Facebook Ads (/checkout)
//
// Desain ringkas, mobile-first, fokus konversi — tanpa header/footer landing.
//   1. Ringkasan penawaran: badge, judul, harga coret Rp 799.000 → Rp 399.000,
//      3 poin manfaat utama (checklist hijau).
//   2. Form data pembeli — validasi SHARED yang sama dengan modal checkout
//      (src/lib/checkout-validation.ts, cermin validasi server /api/checkout).
//   3. Dua aksi seimbang:
//      - Primary  : "Bayar Otomatis (QRIS / VA / E-Wallet)" → POST /api/checkout
//                   (loading state) → redirect ke payment link Mayar.
//      - Sekunder : "Pesan Manual via WhatsApp Admin" → wa.me Admin dengan
//                   pesan draft pembelian (anchor native, imun pop-up blocker).
//   4. Catatan jaminan di bawah tombol.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type FormEvent } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EMPTY_CHECKOUT_FORM,
  validateCheckoutBuyer,
  type CheckoutFieldErrors,
  type CheckoutFormState,
} from "@/lib/checkout-validation";
import {
  LICENSE_AMOUNT_IDR,
  SUPPORT_WA_PURCHASE_LINK,
} from "@/lib/landing-config";
import { toast } from "@/lib/toast";

/** Harga referensi sebelum diskon (dicoret) — tampilan iklan early adopter */
const ORIGINAL_PRICE_LABEL = "Rp 799.000";
/** Harga aktif — selalu sinkron dengan nominal invoice Mayar (LICENSE_AMOUNT_IDR) */
const CURRENT_PRICE_LABEL = `Rp ${LICENSE_AMOUNT_IDR.toLocaleString("id-ID")}`;

const BENEFITS = [
  "Kelola denah kamar & status sewa real-time",
  "Kirim tagihan & kwitansi otomatis via WhatsApp",
  "Tanpa biaya bulanan / biaya per kamar selamanya",
] as const;

export function CheckoutClient() {
  const [form, setForm] = useState<CheckoutFormState>(EMPTY_CHECKOUT_FORM);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const setField = (key: keyof CheckoutFormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Hapus error field terkait saat pengguna mulai mengetik ulang
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const errors = validateCheckoutBuyer(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone,
        }),
      });
      const data: { paymentUrl?: string; error?: string; field?: string } =
        await response.json().catch(() => ({}));

      if (response.ok && typeof data.paymentUrl === "string") {
        toast.success("Invoice dibuat — membuka halaman pembayaran…");
        // Redirect tab yang sama: pembayaran Mayar → kembali ke /payment/success
        window.location.assign(data.paymentUrl);
        return;
      }

      const message =
        data.error ?? "Gagal memproses checkout — silakan coba lagi.";
      toast.error(message);
      if (typeof data.field === "string" && data.field) {
        setFieldErrors({ [data.field]: message } as CheckoutFieldErrors);
      }
    } catch {
      toast.error(
        "Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-zinc-50">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-8 pt-6 sm:pb-12 sm:pt-10">
        <div className="flex-1 space-y-4 sm:space-y-5">
          {/* ── Ringkasan Penawaran ─────────────────────────────────────── */}
          <section
            aria-labelledby="checkout-offer-title"
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-[12px] font-semibold text-green-700">
              <BadgeCheck
                className="size-3.5 shrink-0"
                strokeWidth={2}
                aria-hidden="true"
              />
              Akses Lisensi Penuh — Sekali Bayar
            </span>

            <h1
              id="checkout-offer-title"
              className="mt-3 text-xl font-extrabold leading-tight text-zinc-900 sm:text-2xl"
            >
              UnitKu — Kelola Kost &amp; Kontrakan Tanpa Pusing
            </h1>

            <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <s className="text-sm font-medium text-zinc-400">
                {ORIGINAL_PRICE_LABEL}
              </s>
              <span className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
                {CURRENT_PRICE_LABEL}
              </span>
            </div>
            <p className="mt-1 text-[13px] font-medium text-zinc-500">
              Lisensi Seumur Hidup / Early Adopter — sekali bayar, aktif
              selamanya.
            </p>

            <ul className="mt-4 space-y-2.5 border-t border-zinc-100 pt-4">
              {BENEFITS.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-start gap-2.5 text-[13.5px] font-medium leading-snug text-zinc-700"
                >
                  <CheckCircle2
                    className="mt-0.5 size-5 shrink-0 text-green-600"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Form Data Pembeli ───────────────────────────────────────── */}
          <section
            aria-labelledby="checkout-form-title"
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <h2
              id="checkout-form-title"
              className="text-base font-bold text-zinc-900"
            >
              Data Pembeli
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-snug text-zinc-500">
              Dipakai untuk pembuatan akun otomatis &amp; aktivasi lisensi
              Anda.
            </p>

            <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3.5">
              {/* Nama Lengkap */}
              <div className="space-y-1.5 text-left">
                <Label
                  htmlFor="checkout-name"
                  className="text-[12.5px] font-semibold text-zinc-700"
                >
                  Nama Lengkap{" "}
                  <span aria-hidden="true" className="text-red-600">
                    *
                  </span>
                  <span className="sr-only">(wajib)</span>
                </Label>
                <Input
                  id="checkout-name"
                  name="name"
                  autoComplete="name"
                  placeholder="cth. Budi Santoso"
                  value={form.name}
                  onChange={(e) => setField("name")(e.target.value)}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={
                    fieldErrors.name ? "checkout-name-error" : undefined
                  }
                  className="h-10 text-[13.5px]"
                />
                {fieldErrors.name && (
                  <p
                    id="checkout-name-error"
                    role="alert"
                    className="text-[12px] font-medium text-red-600"
                  >
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              {/* Alamat Email */}
              <div className="space-y-1.5 text-left">
                <Label
                  htmlFor="checkout-email"
                  className="text-[12.5px] font-semibold text-zinc-700"
                >
                  Alamat Email{" "}
                  <span aria-hidden="true" className="text-red-600">
                    *
                  </span>
                  <span className="sr-only">(wajib)</span>
                </Label>
                <Input
                  id="checkout-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="nama@email.com"
                  value={form.email}
                  onChange={(e) => setField("email")(e.target.value)}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={
                    fieldErrors.email
                      ? "checkout-email-error"
                      : "checkout-email-hint"
                  }
                  className="h-10 text-[13.5px]"
                />
                {fieldErrors.email ? (
                  <p
                    id="checkout-email-error"
                    role="alert"
                    className="text-[12px] font-medium text-red-600"
                  >
                    {fieldErrors.email}
                  </p>
                ) : (
                  <p
                    id="checkout-email-hint"
                    className="text-[12px] leading-snug text-zinc-500"
                  >
                    Wajib valid — untuk pembuatan akun otomatis &amp; pengiriman
                    lisensi.
                  </p>
                )}
              </div>

              {/* Nomor WhatsApp */}
              <div className="space-y-1.5 text-left">
                <Label
                  htmlFor="checkout-phone"
                  className="text-[12.5px] font-semibold text-zinc-700"
                >
                  Nomor WhatsApp{" "}
                  <span aria-hidden="true" className="text-red-600">
                    *
                  </span>
                  <span className="sr-only">(wajib)</span>
                </Label>
                <Input
                  id="checkout-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="08xxxxxxxxxx / 62xxxxxxxxxx"
                  value={form.phone}
                  onChange={(e) => setField("phone")(e.target.value)}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={
                    fieldErrors.phone ? "checkout-phone-error" : undefined
                  }
                  className="h-10 text-[13.5px]"
                />
                {fieldErrors.phone && (
                  <p
                    id="checkout-phone-error"
                    role="alert"
                    className="text-[12px] font-medium text-red-600"
                  >
                    {fieldErrors.phone}
                  </p>
                )}
              </div>

              {/* Dua aksi seimbang: checkout otomatis & manual via WA */}
              <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-auto min-h-12 whitespace-normal px-3 py-2.5 text-[13px] font-bold leading-snug"
                >
                  {submitting ? (
                    <>
                      <Loader2
                        className="size-4 shrink-0 animate-spin"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                      Memproses…
                    </>
                  ) : (
                    <>
                      <Wallet
                        className="size-4 shrink-0"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                      Bayar Otomatis (QRIS / VA / E-Wallet)
                    </>
                  )}
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-auto min-h-12 whitespace-normal border-green-600 px-3 py-2.5 text-[13px] font-bold leading-snug text-green-700 hover:bg-green-50 hover:text-green-800"
                >
                  <a
                    href={SUPPORT_WA_PURCHASE_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle
                      className="size-4 shrink-0"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    Pesan Manual via WhatsApp Admin
                  </a>
                </Button>
              </div>

              {/* Jaminan & keamanan */}
              <p className="flex items-start justify-center gap-1.5 pt-1 text-center text-[11.5px] leading-snug text-zinc-500">
                <LockKeyhole
                  className="mt-0.5 size-3.5 shrink-0 text-green-600"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span>
                  Garansi transaksi aman via Mayar Payment Gateway • Akses akun
                  instan
                </span>
              </p>
            </form>
          </section>
        </div>

        {/* Footer minimal satu baris — tanpa footer landing yang panjang */}
        <footer className="mt-auto pt-8 text-center">
          <p className="text-[11.5px] leading-relaxed text-zinc-400">
            UnitKu by Elvindigital ·{" "}
            <a
              href="/"
              className="font-medium underline-offset-2 hover:underline"
            >
              Kembali ke halaman utama
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
