"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Tombol "Beli Akses Seumur Hidup" (landing)
//
// Modal checkout lisensi seumur hidup — dirancang ANTI-RAGU + ZERO FRICTION:
//   1. Header modal: "Aktivasi Lisensi Seumur Hidup — Rp 399.000" — calon
//      pembeli langsung tahu produk & nominal SEBELUM mengisi apa pun.
//   2. Ringkasan transparan: "Sekali Bayar • Tanpa Biaya Bulanan • Garansi 7
//      Hari Uang Kembali 100%" + badge metode bayar QRIS (Semua E-Wallet/
//      m-Banking) & Transfer Bank (BCA, Mandiri, BRI, BNI).
//   3. Form HANYA 2 input (email dihapus — zero friction): Nama Lengkap
//      (placeholder "Nama Anda / Nama Kost") + Nomor WhatsApp ("08123456789"),
//      validasi ramah (shared: src/lib/checkout-validation.ts).
//   4. Mikro-badge garansi tepat di atas tombol bayar.
//   5. Tombol sekunder di bawah tombol bayar: "Pesan Manual via WhatsApp
//      Admin" — kliknya memvalidasi form, menyimpan lead (POST /api/leads,
//      fire-and-forget) lalu membuka wa.me Admin dengan pesan promo (anchor
//      native, imun pop-up blocker). Tombol utama POST /api/checkout membuat
//      invoice Mayar per-pembeli (lead tersimpan di server SEBELUM redirect);
//      webhook /api/webhooks/mayar mengaktifkan lisensi.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type FormEvent, type MouseEvent } from "react";
import {
  Landmark,
  Loader2,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Wallet,
} from "lucide-react";

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
  validateCheckoutBuyer,
  type CheckoutFieldErrors,
  type CheckoutFormState,
} from "@/lib/checkout-validation";
import {
  LICENSE_AMOUNT_IDR,
  LICENSE_PRICE_LABEL,
  SUPPORT_WA_DISPLAY,
  SUPPORT_WA_MANUAL_PROMO_LINK,
} from "@/lib/landing-config";
import { toast } from "@/lib/toast";

/** "Rp399.000" → "Rp 399.000" — spasi setelah kode mata uang utk keterbacaan */
const PRICE_LABEL = LICENSE_PRICE_LABEL.startsWith("Rp")
  ? `Rp ${LICENSE_PRICE_LABEL.slice(2).trim()}`
  : LICENSE_PRICE_LABEL;

interface BuyCtaProps {
  className?: string;
  label?: string;
  inverted?: boolean; // dipakai di kartu gelap (bg-zinc-900) — tombol putih
  /** Bar sempit (sticky demo bar): tombol ramping satu baris */
  compact?: boolean;
}

export function BuyCta({
  className = "",
  label = "Beli Akses Seumur Hidup",
  inverted = false,
  compact = false,
}: BuyCtaProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CheckoutFormState>(EMPTY_CHECKOUT_FORM);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  /** Buka modal checkout + tembakkan event Meta Pixel InitiateCheckout.
   *  Ini konversi utama kampanye Meta Ads — semua tombol beli (hero, bento,
   *  testimoni, penawaran, final CTA, sticky demo bar) lewat pintu ini. */
  const openCheckout = () => {
    setOpen(true);
    window.fbq?.("track", "InitiateCheckout", {
      content_name: "Lisensi Seumur Hidup UnitKu",
      content_ids: ["unitku-lifetime"],
      content_type: "product",
      value: LICENSE_AMOUNT_IDR,
      currency: "IDR",
    });
  };

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

  /** Klik tombol sekunder "Pesan Manual via WhatsApp Admin" — simpan lead
   *  (Nama + No. WhatsApp) dulu (non-blocking), lalu buka WA Admin dengan
   *  pesan promo. Anchor native → imun pop-up blocker. */
  const handleManualOrder = (event: MouseEvent<HTMLAnchorElement>) => {
    const errors = validateCheckoutBuyer(form);
    if (Object.keys(errors).length > 0) {
      // Form belum lengkap — cegah navigasi & tampilkan error per field
      event.preventDefault();
      setFieldErrors(errors);
      toast.error("Isi dulu nama dan nomor WhatsApp Anda ya.");
      return;
    }

    // Simpan lead SEBELUM membuka WhatsApp — fire-and-forget agar anchor
    // native (imun pop-up blocker) tetap berjalan tanpa jeda.
    void fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
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
      // Zero friction — hanya nama + No. WhatsApp (email tidak dikumpulkan)
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
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
        onClick={openCheckout}
        className={`${
          compact
            ? "h-10 min-h-10 whitespace-nowrap px-4 py-2 text-[13px] font-bold leading-none sm:h-11 sm:min-h-11 sm:px-5 sm:text-sm"
            : "h-auto min-h-14 whitespace-normal px-5 py-3 text-base font-bold leading-snug sm:px-8 sm:py-4 sm:text-lg"
        } ${inverted ? "bg-white text-zinc-900 hover:bg-zinc-100" : ""} ${className}`}
      >
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto rounded-xl p-6 scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="text-left text-lg font-bold leading-snug text-zinc-900">
              Aktivasi Lisensi Seumur Hidup — {PRICE_LABEL}
            </DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed text-zinc-500">
              Cukup isi nama &amp; nomor WhatsApp — lisensi langsung aktif
              setelah pembayaran terkonfirmasi.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
            {/* ── Ringkasan transparan: nominal + jaminan + metode bayar ── */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-left">
              <p className="text-2xl font-extrabold tracking-tight text-zinc-900 tabular-nums">
                {PRICE_LABEL}
              </p>
              <p className="mt-0.5 text-[11.5px] font-bold leading-snug text-emerald-700">
                Sekali Bayar{" "}
                <span aria-hidden="true" className="font-normal text-zinc-400">
                  •
                </span>{" "}
                Tanpa Biaya Bulanan{" "}
                <span aria-hidden="true" className="font-normal text-zinc-400">
                  •
                </span>{" "}
                Garansi 7 Hari Uang Kembali 100%
              </p>

              {/* Metode bayar didukung — dua badge ringkas */}
              <div className="mt-3 grid grid-cols-1 gap-2 border-t border-zinc-200 pt-3 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white">
                    <QrCode
                      className="size-4 text-zinc-700"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-bold leading-tight text-zinc-900">
                      QRIS
                    </p>
                    <p className="text-[10.5px] leading-snug text-zinc-500">
                      Semua E-Wallet/m-Banking
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white">
                    <Landmark
                      className="size-4 text-zinc-700"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-bold leading-tight text-zinc-900">
                      Transfer Bank
                    </p>
                    <p className="text-[10.5px] leading-snug text-zinc-500">
                      BCA, Mandiri, BRI, BNI
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Nama Lengkap — placeholder sesuai audiens (pemilik kost) */}
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
                placeholder="Nama Anda / Nama Kost"
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

            {/* Nomor WhatsApp — satu-satunya kontak yang diminta */}
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
                placeholder="08123456789"
                value={form.phone}
                onChange={(e) => setField("phone")(e.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={
                  fieldErrors.phone ? "buy-phone-error" : "buy-phone-hint"
                }
                className="h-10 text-[13.5px]"
              />
              {fieldErrors.phone ? (
                <p id="buy-phone-error" role="alert" className="text-[12px] font-medium text-red-600">
                  {fieldErrors.phone}
                </p>
              ) : (
                <p id="buy-phone-hint" className="text-[12px] leading-snug text-zinc-500">
                  Dipakai Admin untuk konfirmasi &amp; aktivasi lisensi.
                </p>
              )}
            </div>

            {/* ── Mikro-badge garansi — tepat di atas tombol bayar (anti-ragu) ── */}
            <p className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-center text-[11.5px] font-semibold leading-snug text-emerald-800">
              <ShieldCheck
                className="size-3.5 shrink-0"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              Garansi 7 Hari Uang Kembali 100% jika tidak cocok
            </p>

            {/* Tombol bayar utama — lebar penuh, fokus satu aksi */}
            <Button
              type="submit"
              disabled={submitting}
              className="h-auto min-h-11 w-full whitespace-normal px-3 py-2.5 text-[13.5px] font-bold leading-snug"
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
                  Bayar Sekarang (QRIS / Transfer Bank)
                </>
              )}
            </Button>

            {/* ── Tombol sekunder — jalan keluar bagi yang ragu ──
                Simpan lead (Nama + No. WA) lalu buka WA Admin dgn pesan promo */}
            <Button
              asChild
              variant="outline"
              className="h-auto min-h-11 w-full whitespace-normal border-green-600 px-3 py-2.5 text-[13px] font-bold leading-snug text-green-700 hover:bg-green-50 hover:text-green-800"
            >
              <a
                href={SUPPORT_WA_MANUAL_PROMO_LINK}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleManualOrder}
              >
                <MessageCircle
                  className="size-4 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                Pesan Manual via WhatsApp Admin ({SUPPORT_WA_DISPLAY})
              </a>
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
