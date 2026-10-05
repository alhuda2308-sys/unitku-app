"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Halaman checkout khusus iklan Facebook Ads (/checkout)
//
// Desain ringkas, mobile-first, fokus konversi — tanpa header/footer landing.
//   1. Ringkasan penawaran: badge, judul, harga coret Rp 799.000 → Rp 399.000,
//      3 poin manfaat utama (checklist hijau).
//   2. Form ZERO FRICTION — HANYA 2 input (email dihapus sepenuhnya):
//      Nama Lengkap + Nomor WhatsApp. Validasi SHARED yang sama dengan modal
//      checkout (src/lib/checkout-validation.ts, cermin validasi server).
//   3. Dua aksi seimbang:
//      - Primary  : "Bayar Otomatis (QRIS / VA / E-Wallet)" → POST /api/checkout
//                   (loading state) → redirect ke payment link Mayar (lead
//                   tersimpan di server SEBELUM redirect).
//      - Sekunder : "Pesan Manual via WhatsApp Admin" → VALIDASI form →
//                   POST /api/leads (simpan kontak — fire-and-forget) → wa.me
//                   Admin dengan pesan draft pembelian terisi Nama/No. WA
//                   (anchor native, imun pop-up blocker).
//   4. Catatan jaminan di bawah tombol.
//
// DOCTRINE META PIXEL (akurat, tidak bias — identik dgn modal checkout):
//   - Pixel menembakkan 'PageView' saja saat halaman dibuka (facebook-pixel).
//   - fbq('track','InitiateCheckout') ditembakkan TEPAT SEKALI per submit
//     form dan HANYA pada dua momen sah: (a) tombol bayar utama sukses —
//     lead tersimpan di license_leads oleh server sebelum redirect; ATAU
//     (b) tombol "Pesan Manual via WhatsApp Admin" diklik dgn form valid.
// ─────────────────────────────────────────────────────────────────────────────

import {
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import Image from "next/image";
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
  buildManualOrderWaLink,
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
  "Generator iklan kamar siap sebar ke Facebook & WhatsApp",
  "Tanpa biaya bulanan / biaya per kamar selamanya",
] as const;

export function CheckoutClient() {
  const [form, setForm] = useState<CheckoutFormState>(EMPTY_CHECKOUT_FORM);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  /** Guard anti-dobel: InitiateCheckout TEPAT SEKALI per submit form.
   *  Ref di-reset di awal tiap percobaan submit baru, lalu event hanya
   *  ditembakkan pada satu titik sah — klik ganda / jalur async beruntun
   *  tak bisa menggandakan event. */
  const initiateCheckoutFiredRef = useRef(false);

  /** InitiateCheckout (standard event Meta) — momen SAH: form pembeli sudah
   *  lengkap & tersimpan (lead di license_leads), checkout benar-benar
   *  dimulai. Ditembakkan maksimal sekali per submit via ref guard. */
  const fireInitiateCheckoutOnce = () => {
    if (initiateCheckoutFiredRef.current) return;
    initiateCheckoutFiredRef.current = true;
    window.fbq?.("track", "InitiateCheckout", {
      content_name: "Lisensi Seumur Hidup UnitKu",
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

  // Link WA manual mengikuti isi form (draft pesan terisi otomatis);
  // fallback link default selama form belum valid (tak pernah dinavigasi —
  // klik dicegah handleManualOrder bila form belum lengkap).
  const formValid =
    Object.keys(validateCheckoutBuyer(form)).length === 0;
  const manualWaHref = formValid
    ? buildManualOrderWaLink(form)
    : SUPPORT_WA_PURCHASE_LINK;

  /** Klik "Pesan Manual" — simpan lead dulu (non-blocking), lalu buka WA Admin.
   *  Momen sah (b) InitiateCheckout: klik VALID ini = submit form manual →
   *  event ditembakkan tepat sekali untuk percobaan submit ini. */
  const handleManualOrder = (event: MouseEvent<HTMLAnchorElement>) => {
    const errors = validateCheckoutBuyer(form);
    if (Object.keys(errors).length > 0) {
      // Form belum lengkap — cegah navigasi & tampilkan error per field
      event.preventDefault();
      setFieldErrors(errors);
      toast.error("Isi dulu nama dan nomor WhatsApp Anda ya.");
      return;
    }

    // Submit manual baru → reset guard, lalu tembak InitiateCheckout sekali
    initiateCheckoutFiredRef.current = false;
    fireInitiateCheckoutOnce();

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
    // Submit baru → izinkan InitiateCheckout ditembakkan sekali utk percobaan ini
    initiateCheckoutFiredRef.current = false;
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
        // Momen sah (a) InitiateCheckout: /api/checkout sudah menyimpan lead
        // ke license_leads SEBELUM membuat invoice — event ditembakkan tepat
        // sekali (guard ref) sebelum redirect ke halaman pembayaran Mayar.
        fireInitiateCheckoutOnce();
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
            {/* Logo resmi UnitKu */}
            <div className="flex justify-center">
              <Image
                src="/brand/logo.png"
                alt="Logo UnitKu"
                width={72}
                height={72}
                priority
                className="size-[72px] shrink-0 object-contain"
              />
            </div>

            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-[12px] font-semibold text-green-700">
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
              Cukup 2 data — dipakai Admin untuk aktivasi lisensi Anda.
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
                  placeholder="Nama Anda / Nama Kost"
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
                  placeholder="08123456789"
                  value={form.phone}
                  onChange={(e) => setField("phone")(e.target.value)}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={
                    fieldErrors.phone
                      ? "checkout-phone-error"
                      : "checkout-phone-hint"
                  }
                  className="h-10 text-[13.5px]"
                />
                {fieldErrors.phone ? (
                  <p
                    id="checkout-phone-error"
                    role="alert"
                    className="text-[12px] font-medium text-red-600"
                  >
                    {fieldErrors.phone}
                  </p>
                ) : (
                  <p
                    id="checkout-phone-hint"
                    className="text-[12px] leading-snug text-zinc-500"
                  >
                    Dipakai Admin untuk konfirmasi &amp; aktivasi lisensi.
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

              {/* Jaminan & keamanan */}
              <p className="flex items-start justify-center gap-1.5 pt-1 text-center text-[11.5px] leading-snug text-zinc-500">
                <LockKeyhole
                  className="mt-0.5 size-3.5 shrink-0 text-green-600"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span>
                  Garansi 7 Hari Uang Kembali 100% • Transaksi aman via Mayar
                  Payment Gateway
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
