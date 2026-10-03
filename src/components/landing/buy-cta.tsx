"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Tombol "Beli Akses Seumur Hidup" (landing)
//
// Modal checkout lisensi seumur hidup:
//   1. Form data pembeli (nama, email, No. WhatsApp) — divalidasi di client
//      & server (validasi shared di src/lib/checkout-validation.ts), lalu
//      POST /api/checkout membuat invoice Mayar per-pembeli (lead tersimpan
//      di server SEBELUM redirect ke Mayar).
//   2. Tombol utama "Bayar Otomatis (QRIS / VA / E-Wallet)" → redirect ke
//      paymentUrl Mayar; webhook /api/webhooks/mayar mengaktifkan lisensi.
//   3. Tombol kedua "Pesan Manual via WhatsApp Admin" → VALIDASI form →
//      POST /api/leads (simpan kontak — fire-and-forget, tidak memblokir
//      navigasi) → buka wa.me Admin dengan pesan pemesanan terisi Nama/Email/
//      No. WhatsApp (anchor native, imun pop-up blocker).
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState, type FormEvent, type MouseEvent } from "react";
import { Loader2, MessageCircle, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EMPTY_CHECKOUT_FORM,
  buildManualOrderWaLink,
  validateCheckoutBuyer,
  type CheckoutFieldErrors,
  type CheckoutFormState,
} from "@/lib/checkout-validation";
import {
  LICENSE_PRICE_LABEL,
  SUPPORT_WA_PURCHASE_LINK,
} from "@/lib/landing-config";
import { toast } from "@/lib/toast";

interface BuyCtaProps {
  className?: string;
  label?: string;
  inverted?: boolean; // dipakai di kartu gelap (bg-zinc-900) — tombol putih
}

export function BuyCta({
  className = "",
  label = "Beli Akses Seumur Hidup",
  inverted = false,
}: BuyCtaProps) {
  const [open, setOpen] = useState(false);
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

  // Link WA manual mengikuti isi form (pesan pemesanan terisi otomatis);
  // fallback ke link default selama form belum valid (tak pernah dinavigasi
  // karena klik tetap dicegah oleh handleManualOrder).
  const formValid = useMemo(
    () => Object.keys(validateCheckoutBuyer(form)).length === 0,
    [form],
  );
  const manualWaHref = formValid
    ? buildManualOrderWaLink(form)
    : SUPPORT_WA_PURCHASE_LINK;

  /** Klik "Pesan Manual" — simpan lead dulu (non-blocking), lalu buka WA Admin */
  const handleManualOrder = (event: MouseEvent<HTMLAnchorElement>) => {
    const errors = validateCheckoutBuyer(form);
    if (Object.keys(errors).length > 0) {
      // Form belum lengkap — cegah navigasi & tampilkan error per field
      event.preventDefault();
      setFieldErrors(errors);
      toast.error("Lengkapi data pemesan terlebih dahulu.");
      return;
    }

    // Simpan lead SEBELUM membuka WhatsApp — fire-and-forget agar anchor
    // native (imun pop-up blocker) tetap berjalan tanpa jeda.
    void fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone,
        source: "PESAN_MANUAL",
      }),
    })
      .then(async (res) => {
        if (res.ok) {
          toast.success("Data kontak tersimpan — membuka WhatsApp Admin…");
        } else {
          toast.warning(
            "Gagal menyimpan data ke server — chat WhatsApp tetap dibuka.",
          );
        }
      })
      .catch(() => {
        toast.warning(
          "Gagal menyimpan data ke server — chat WhatsApp tetap dibuka.",
        );
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
    <>
      <Button
        size="lg"
        onClick={() => setOpen(true)}
        className={`h-auto min-h-14 whitespace-normal px-5 py-3 text-base font-bold leading-snug sm:px-8 sm:py-4 sm:text-lg ${
          inverted ? "bg-white text-zinc-900 hover:bg-zinc-100" : ""
        } ${className}`}
      >
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-left text-lg font-bold text-zinc-900">
              Beli Lisensi Seumur Hidup UnitKu
            </DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed text-zinc-500">
              Satu kali bayar {LICENSE_PRICE_LABEL} — aktif selamanya tanpa
              biaya bulanan.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
            {/* Nama Lengkap */}
            <div className="space-y-1.5 text-left">
              <Label
                htmlFor="buy-name"
                className="text-[12.5px] font-semibold text-zinc-700"
              >
                Nama Lengkap <span aria-hidden="true" className="text-red-600">*</span>
                <span className="sr-only">(wajib)</span>
              </Label>
              <Input
                id="buy-name"
                name="name"
                autoComplete="name"
                placeholder="cth. Budi Santoso"
                value={form.name}
                onChange={(e) => setField("name")(e.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? "buy-name-error" : undefined}
                className="h-10 text-[13.5px]"
              />
              {fieldErrors.name && (
                <p id="buy-name-error" role="alert" className="text-[12px] font-medium text-red-600">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Alamat Email */}
            <div className="space-y-1.5 text-left">
              <Label
                htmlFor="buy-email"
                className="text-[12.5px] font-semibold text-zinc-700"
              >
                Alamat Email <span aria-hidden="true" className="text-red-600">*</span>
                <span className="sr-only">(wajib)</span>
              </Label>
              <Input
                id="buy-email"
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
                  fieldErrors.email ? "buy-email-error" : "buy-email-hint"
                }
                className="h-10 text-[13.5px]"
              />
              {fieldErrors.email ? (
                <p id="buy-email-error" role="alert" className="text-[12px] font-medium text-red-600">
                  {fieldErrors.email}
                </p>
              ) : (
                <p id="buy-email-hint" className="text-[12px] leading-snug text-zinc-500">
                  Untuk akses login akun &amp; pengiriman lisensi.
                </p>
              )}
            </div>

            {/* Nomor WhatsApp */}
            <div className="space-y-1.5 text-left">
              <Label
                htmlFor="buy-phone"
                className="text-[12.5px] font-semibold text-zinc-700"
              >
                Nomor WhatsApp <span aria-hidden="true" className="text-red-600">*</span>
                <span className="sr-only">(wajib)</span>
              </Label>
              <Input
                id="buy-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="08xxxxxxxxxx / 62xxxxxxxxxx"
                value={form.phone}
                onChange={(e) => setField("phone")(e.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? "buy-phone-error" : undefined}
                className="h-10 text-[13.5px]"
              />
              {fieldErrors.phone && (
                <p id="buy-phone-error" role="alert" className="text-[12px] font-medium text-red-600">
                  {fieldErrors.phone}
                </p>
              )}
            </div>

            {/* Dua aksi seimbang: checkout otomatis & manual via WA */}
            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
              <Button
                type="submit"
                disabled={submitting}
                className="h-auto min-h-11 whitespace-normal px-3 py-2.5 text-[13px] font-bold leading-snug"
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
                className="h-auto min-h-11 whitespace-normal border-green-600 px-3 py-2.5 text-[13px] font-bold leading-snug text-green-700 hover:bg-green-50 hover:text-green-800"
              >
                <a
                  href={manualWaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleManualOrder}
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

            {/* Trust badge — jaminan & dukungan (penguat konversi) */}
            <div className="space-y-1 pt-1.5 text-center">
              <p className="text-[11.5px] font-semibold leading-snug text-zinc-700">
                <span aria-hidden="true">🛡️</span> Garansi 7 Hari Uang Kembali
                Tanpa Ribet
              </p>
              <p className="text-[11.5px] leading-snug text-zinc-500">
                <span aria-hidden="true">💬</span> Support WhatsApp Siap Bantu —
                Fast response langsung dari tim pengembang
              </p>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
