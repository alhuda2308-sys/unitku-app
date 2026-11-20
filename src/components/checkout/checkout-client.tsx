"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Halaman checkout khusus iklan Facebook Ads (/checkout)
//
// Desain ringkas, mobile-first, fokus konversi — tanpa header/footer landing.
//   1. Ringkasan penawaran: badge, judul, harga coret Rp 799.000 → Rp 399.000,
//      4 poin manfaat utama (checklist hijau).
//   2. Form ZERO FRICTION — HANYA 2 input (email dihapus sepenuhnya):
//      Nama Lengkap + Nomor WhatsApp. Validasi SHARED yang sama dengan modal
//      checkout (src/lib/checkout-validation.ts, cermin validasi server).
//   3. Dua aksi seimbang — tombol sekunder TARGET DINAMIS:
//      - Primary  : "Bayar Otomatis (QRIS / VA / E-Wallet)" → POST /api/checkout
//                   (Route Handler internal — SUMBER TUNGGAL invoice Mayar):
//                   server menyimpan lead dulu, membuat invoice per-pembeli
//                   via Mayar API dgn extraData.affiliate_ref (kode referral
//                   divalidasi ke tabel affiliates), lalu client redirect ke
//                   {paymentUrl}. FALLBACK MULUS: bila invoice gagal dibuat
//                   (Mayar 409/timeout/503 — apapun), server mengembalikan
//                   `fallbackUrl` = payment link statis UnitKu dgn query
//                   param referral (?ref=…&affiliate_ref=…) dan client
//                   LANGSUNG me-redirect pembeli ke sana — tidak pernah
//                   terhenti di layar error.
//      - Sekunder : selalu tampil, target mengikuti status referral:
//          • Referral AKTIF + mitra punya No. WA terdaftar → wa.me MITRA
//            (bukan Admin pusat) — calon pembeli dilayani mitra pemilik link
//            (laporan mitra: komisi/jualan tidak lepas ke chat Admin). Kode
//            referral tetap diteruskan eksplisit ke POST /api/leads (source
//            "Referral: <kode>") dan POST /api/checkout.
//          • Organik / mitra tanpa No. WA → wa.me Admin pusat.
//          WHITE-LABEL: label tombol & isi pesan WA SERAGAM "Admin UnitKu"
//          (MANUAL_ORDER_BUTTON_LABEL & buildOrderWaMessage) — TANPA kata
//          "Mitra"/"Affiliate"/nama mitra/kode referral di mata pembeli;
//          routing nomor di belakang layar tidak terlihat.
//          Keduanya: VALIDASI form → POST /api/leads (simpan kontak —
//          fire-and-forget) → wa.me (anchor native, imun pop-up blocker).
//   4. Catatan jaminan di bawah tombol.
//
// DOCTRINE META PIXEL (akurat, tidak bias — identik dgn modal checkout):
//   - Pixel menembakkan 'PageView' saja saat halaman dibuka (facebook-pixel).
//   - fbq('track','InitiateCheckout') ditembakkan TEPAT SEKALI per klik
//     tombol bayar dan HANYA pada dua momen sah: (a) invoice /api/checkout
//     sukses dibuat — pembeli memasuki checkout Mayar; ATAU (b) tombol
//     manual (Admin/Mitra) diklik dgn form valid.
// ─────────────────────────────────────────────────────────────────────────────

import {
  useRef,
  useState,
  type MouseEvent,
} from "react";
import Image from "next/image";
import {
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Loader2,
  LockKeyhole,
  MessageCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EMPTY_CHECKOUT_FORM,
  MANUAL_ORDER_BUTTON_LABEL,
  buildManualOrderWaLink,
  buildMitraOrderWaLink,
  validateCheckoutBuyer,
  type CheckoutFieldErrors,
  type CheckoutFormState,
  type MitraReferralInfo,
} from "@/lib/checkout-validation";
import { sanitizeAffiliateRef } from "@/lib/affiliate";
import { LICENSE_AMOUNT_IDR } from "@/lib/landing-config";
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

export function CheckoutClient({
  initialRef,
  mitraWa = null,
}: {
  /** Kode referral dari ?ref=/ref_code= URL — dibaca Server Component page */
  initialRef?: string | null;
  /** Info mitra pemilik referral AKTIF (nama + No. WA ternormalisasi 62…) —
   *  sudah divalidasi & dinormalisasi Server Component page; waPhone "" =
   *  mitra tidak punya nomor WA sah → tombol jatuh ke fallback WA Admin. */
  mitraWa?: MitraReferralInfo | null;
}) {
  const [form, setForm] = useState<CheckoutFormState>(EMPTY_CHECKOUT_FORM);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  /** Kode referral mitra — null = organik.
   *  Server Component page SUDAH memvalidasi kedua sumber ke DB (URL ?ref= /
   *  ?ref_code= DAN cookie unitku_ref via resolveActiveAffiliate) lalu
   *  meneruskan kode kanonik milik mitra AKTIF sebagai initialRef — render
   *  pertama sudah tahu status referral (tanpa layout shift). TANPA fallback
   *  cookie di client: kode milik mitra yang sudah dihapus tidak boleh
   *  "hidup kembali" dari cookie basi — konsisten dengan validasi server
   *  di POST /api/checkout (komisi aman di kedua lapisan). */
  const [referral] = useState<string | null>(() =>
    sanitizeAffiliateRef(initialRef),
  );

  /** Mode MITRA: referral aktif DAN mitra punya No. WA sah → tombol sekunder
   *  menuju wa.me MITRA (bukan Admin pusat) — calon pembeli dilayani langsung
   *  oleh pemilik link referral. Tanpa salah satu syarat → fallback Admin.
   *  (mitraWa hanya non-null bila referral SUDAH tervalidasi aktif di server,
   *  jadi cukup cek nomor WA-nya.) WHITE-LABEL: perbedaan ini TIDAK terlihat
   *  pembeli — label & pesan seragam "Admin UnitKu" (lihat tombol sekunder). */
  const mitraMode = mitraWa?.waPhone ? mitraWa : null;

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

  // Link WA manual mengikuti isi form (draft pesan terisi otomatis — baris
  // Nama/No. WA menyusul saat diisi). Kedua jalur memakai pesan resmi identik
  // (buildOrderWaMessage); hanya TUJUAN nomor yang berbeda: WA mitra saat
  // referral aktif + No. WA sah, selain itu WA Admin pusat. Link valid sejak
  // form kosong; klik sebelum lengkap tetap dicegah handleManualOrder.
  const manualWaHref = mitraMode
    ? buildMitraOrderWaLink(form, mitraMode)
    : buildManualOrderWaLink(form);

  /** Klik tombol sekunder "Pesan Manual via WhatsApp Admin" (label seragam
   *  white-label; tujuan nomor di belakang layar bisa WA mitra saat referral
   *  aktif) — simpan lead dulu (non-blocking), lalu buka WhatsApp.
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
    // native (imun pop-up blocker) tetap berjalan tanpa jeda. Kode referral
    // diteruskan EKSPLISIT bila ada — server memvalidasi ke DB → source lead
    // "Referral: <kode>" (atribusi mitra tercatat utk pesanan manual).
    void fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        phone: form.phone,
        source: "PESAN_MANUAL",
        ...(referral ? { ref: referral } : {}),
      }),
    })
      .then(async (res) => {
        if (res.ok) {
          // WHITE-LABEL: toast seragam "Admin" — mitra tak pernah tersingkap
          // di UI pembeli meski routing nomor menuju WA mitra.
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

  /** Klik "Bayar Otomatis" — buat invoice Mayar per-pembeli via Route Handler
   *  internal POST /api/checkout (lead tersimpan di server SEBELUM redirect;
   *  metadata.affiliate_ref dari cookie `unitku_ref` dikirim ke Mayar untuk
   *  atribusi komisi afiliasi via webhook). Form wajib valid (invoice butuh
   *  Nama + No. WhatsApp). Momen sah (a) InitiateCheckout: sebelum redirect
   *  ke halaman bayar — event ditembakkan tepat sekali. FALLBACK MULUS:
   *  invoice gagal (Mayar 409/timeout/503) → server kirim `fallbackUrl`
   *  (payment link statis + param referral) → redirect otomatis, pembeli
   *  tidak pernah terhenti di layar error. */
  const handleAutoPay = async () => {
    if (submitting) return;
    // Percobaan submit baru → reset guard
    initiateCheckoutFiredRef.current = false;

    const errors = validateCheckoutBuyer(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Isi dulu nama dan nomor WhatsApp Anda ya.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone,
          // Kode referral diteruskan EKSPLISIT di body — server memprioritaskan
          // body.ref di atas cookie (atribusi 100% meski cookie tidak terbawa).
          ...(referral ? { ref: referral } : {}),
        }),
      });
      const data: {
        paymentUrl?: string;
        fallbackUrl?: string;
        error?: string;
        field?: string;
      } = await response.json().catch(() => ({}));

      if (response.ok && typeof data.paymentUrl === "string") {
        fireInitiateCheckoutOnce();
        toast.success("Invoice dibuat — membuka halaman pembayaran…");
        // Redirect tab yang sama: Mayar → kembali ke /payment/success
        window.location.assign(data.paymentUrl);
        return;
      }

      // Fallback mulus — invoice gagal dibuat (Mayar menolak / gangguan /
      // belum aktif) → payment link langsung UnitKu (server sudah menempel
      // query param referral dari cookie `unitku_ref`). Pembeli tetap jalan.
      if (typeof data.fallbackUrl === "string" && data.fallbackUrl) {
        fireInitiateCheckoutOnce();
        toast.info(
          "Checkout otomatis sedang terkendala — membuka pembayaran langsung…",
        );
        window.location.assign(data.fallbackUrl);
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
  };

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

            <form
              onSubmit={(event) => event.preventDefault()}
              noValidate
              className="mt-4 space-y-3.5"
            >
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

              {/* Aksi: dua tombol seimbang — sekunder berlabel seragam
                  white-label; tujuan WA dinamis (mitra saat referral aktif
                  + No. WA tersedia, selain itu Admin pusat) */}
              <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={() => void handleAutoPay()}
                  disabled={submitting}
                  className="h-auto min-h-12 w-full whitespace-normal px-3 py-2.5 text-[13px] font-bold leading-snug"
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
                      <CreditCard
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
                    {MANUAL_ORDER_BUTTON_LABEL}
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
