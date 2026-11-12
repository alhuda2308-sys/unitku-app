// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — /affiliate : Landing page promosi Program Partner & Afiliasi
//
// Gerbang utama program kemitraan — publik tanpa sesi (exact-match di
// middleware isPublicPage; /affiliate/dashboard TETAP terproteksi). Tugasnya
// menjual program ke calon mitra lalu mengarahkan ke /affiliate/join (form
// pendaftaran) atau /affiliate/dashboard (mitra lama).
//
// Gaya: santai & persuasif (cuan, rebahan, juragan kost) dengan layout
// Swiss-grid — tipografi hitam besar kontras tinggi, aksen emerald, grid
// rapi, whitespace lega. Server Component murni: FAQ memakai <details>
// native (aksesibel tanpa JS), tombol CTA anchor biasa.
//
// Struktur: Nav → Hero (+ kartu simulasi komisi) → Kalkulator Cuan (3 kartu
// proyeksi) → Alasan Gampang Ditawarkan (4 value) → Cara Kerja (3 langkah)
// → Fasilitas Mitra (bot generator iklan) → FAQ (accordion) → Bottom CTA
// (panel gelap) → Footer WA admin (sticky).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import {
  ArrowRight,
  BadgePercent,
  BellRing,
  Bot,
  CalendarX2,
  CheckCircle2,
  ChevronDown,
  Coffee,
  Copy,
  Gem,
  Home,
  Infinity as InfinityIcon,
  Link2,
  Megaphone,
  MessageCircle,
  PenLine,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  COPYRIGHT_LINE,
  SUPPORT_WA_DISPLAY,
  SUPPORT_WA_LINK,
} from "@/lib/landing-config";

export const metadata: Metadata = {
  title: "Program Partner & Afiliasi UnitKu — Komisi Rp150.000 per Lisensi",
  description:
    "Rebahan sambil sebar link, dapat cuan Rp150.000 per lisensi UnitKu. Daftar gratis 1 menit, langsung aktif, komisi flat tanpa batas kuota — cair ke rekening/e-wallet kamu.",
};

/** Proyeksi cuan — 1 kolom kartu kalkulator */
const CALCULATOR_ROWS = [
  {
    sales: "1",
    amount: "Rp150.000",
    note: "Cukup buat ngopi & jalan santai seminggu.",
  },
  {
    sales: "5",
    amount: "Rp750.000",
    note: "Bisa buat bayar internet & listrik rumah.",
  },
  {
    sales: "10",
    amount: "Rp1.500.000",
    note: "Penghasilan sampingan gurih tanpa ninggalin kerjaan utama.",
  },
] as const;

/** Alasan UnitKu gampang ditawarkan */
const VALUE_PROPS = [
  {
    icon: CalendarX2,
    title: "Tanpa Langganan Bulanan",
    detail:
      "Pemilik kost paling benci biaya bulanan. UnitKu cukup bayar sekali untuk selamanya — kamu gak perlu repot membujuk mereka bayar berkali-kali, produknya jauh lebih gampang closing.",
  },
  {
    icon: BadgePercent,
    title: "Harga Super Terjangkau",
    detail:
      "Harganya sangat murah, bahkan lebih murah dari tarif sewa 1 kamar kost per bulan! Pemilik kontrakan gak perlu mikir panjang buat beli karena sekali bayar langsung lunas selamanya.",
  },
  {
    icon: Gem,
    title: "Fitur Langsung Bikin Nyaman",
    detail:
      "Otomatisasi tagihan WA, kwitansi instan, pembukuan kas rapi, dan denah kamar anti-ribet — calon pembeli lihat demo, biasanya langsung klik beli.",
  },
  {
    icon: InfinityIcon,
    title: "Cookie Pelacak 30 Hari",
    detail:
      "Teman kamu ngeklik hari ini tapi baru beli 3 minggu kemudian? Tenang, komisinya tetap aman jadi milikmu — atribusi dicatat otomatis.",
  },
] as const;

/** Cara kerja 3 langkah */
const HOW_IT_WORKS = [
  {
    icon: PenLine,
    step: "01",
    title: "Daftar & Pilih Kode Referral",
    detail:
      "Isi nama, nomor WhatsApp, dan pilih kode referral unikmu sendiri di /affiliate/join. Gratis, 1 menit langsung aktif.",
  },
  {
    icon: Megaphone,
    step: "02",
    title: "Sebar Link Rekomendasi",
    detail:
      "Bagikan link berkode ke grup WhatsApp pengusaha kost, komunitas Facebook, status, atau bio medsos kamu — sante aja.",
  },
  {
    icon: BellRing,
    step: "03",
    title: "Terima Notifikasi & Cuan Cair",
    detail:
      "Ada penjualan lewat link kamu? Notifikasi langsung masuk, komisi Rp150.000 tercatat otomatis di dashboard — siap ditransfer.",
  },
] as const;

/** FAQ singkat — accordion native <details> (aksesibel tanpa JS) */
const FAQ_ITEMS = [
  {
    question: "Daftarnya beneran gratis?",
    answer:
      "100% gratis tanpa syarat aneh-aneh. Tidak ada deposit uang sepeser pun — kamu cuma perlu nama, nomor WhatsApp, dan ide kode referral.",
  },
  {
    question: "Kapan komisi saya bisa dicairkan?",
    answer:
      "Sangat transparan. Kamu punya dashboard pribadi untuk memantau lead dan riwayat penjualan yang siap dicairkan — terus tinggal koordinasi pencairan dengan Admin ke rekening/e-wallet kamu.",
  },
  {
    question: "Kalau calon pembeli beli manual lewat chat gimana?",
    answer:
      "Link checkout khusus mitra sudah otomatis mengunci sistem pembayaran resmi Mayar (QRIS/VA) — tombol chat manual disembunyikan, jadi hak komisimu selalu tercatat otomatis.",
  },
] as const;

export default function AffiliateLandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-950">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/85 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a href="/" className="flex items-center gap-2.5" aria-label="UnitKu — beranda">
            <span
              className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-[13px] font-black text-white"
              aria-hidden="true"
            >
              U
            </span>
            <span className="text-[15px] font-black tracking-tight text-zinc-950">
              UnitKu
            </span>
            <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 sm:inline-flex">
              Partner
            </span>
          </a>
          <a
            href="/affiliate/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-950"
          >
            Dashboard Mitra
            <ArrowRight className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
          </a>
        </div>
      </header>

      <main className="flex-1">
        {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
        <section className="border-b border-zinc-200">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-12 lg:gap-8 lg:py-20">
            {/* Kolom copy — 7/12 */}
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide text-emerald-700">
                🚀 Program Partner &amp; Afiliasi UnitKu
              </span>
              <h1 className="mt-4 text-[32px] font-black leading-[1.08] tracking-tight text-zinc-950 sm:text-5xl lg:text-[56px]">
                Rebahan Sambil Sebar Link, Dapat Cuan{" "}
                <span className="text-emerald-600">Rp150.000</span>{" "}
                per Lisensi!
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-600 sm:text-lg">
                Punya kenalan juragan kost, kontrakan, atau penginapan?
                Rekomendasiin UnitKu ke mereka. Sekali lisensi laku lewat link
                kamu, komisi bersih{" "}
                <span className="font-bold text-zinc-900">Rp150.000</span>{" "}
                langsung cair ke rekening/e-wallet.
              </p>

              {/* CTA utama */}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  asChild
                  size="lg"
                  className="h-auto min-h-14 whitespace-normal bg-emerald-600 px-6 py-3.5 text-base font-bold leading-snug text-white shadow-sm hover:bg-emerald-700"
                >
                  <a href="/affiliate/join">
                    👉 Daftar Jadi Mitra (100% Gratis)
                  </a>
                </Button>
                <a
                  href="#cara-kerja"
                  className="inline-flex items-center justify-center gap-1.5 text-[13.5px] font-bold text-zinc-700 underline-offset-4 transition-colors hover:text-emerald-700 hover:underline"
                >
                  Lihat cara kerjanya dulu
                  <ArrowRight className="size-4" strokeWidth={2.25} aria-hidden="true" />
                </a>
              </div>

              {/* Sub-copy jaminan */}
              <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="size-3.5 text-emerald-600" strokeWidth={2.25} aria-hidden="true" />
                  Tanpa biaya pendaftaran
                </span>
                <span aria-hidden="true" className="text-zinc-300">•</span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="size-3.5 text-emerald-600" strokeWidth={2.25} aria-hidden="true" />
                  Daftar 1 menit langsung aktif
                </span>
                <span aria-hidden="true" className="text-zinc-300">•</span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="size-3.5 text-emerald-600" strokeWidth={2.25} aria-hidden="true" />
                  Akses dashboard mandiri
                </span>
              </p>
            </div>

            {/* Kolom visual — 5/12: kartu simulasi komisi masuk */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto w-full max-w-sm lg:ml-auto lg:mr-0">
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_20px_50px_-24px_rgba(10,10,10,0.35)]">
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Saldo Komisi Kamu
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      <TrendingUp className="size-3" strokeWidth={2.5} aria-hidden="true" />
                      Naik terus
                    </span>
                  </div>
                  <p className="mt-3.5 text-3xl font-black tabular-nums tracking-tight text-zinc-950 sm:text-4xl">
                    Rp750.000
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    5 lisensi terjual lewat link kamu bulan ini
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {[
                      { icon: Home, label: "Kost Bu Ratna — lisensi aktif" },
                      { icon: Home, label: "Kontrakan Pak Dedi — lisensi aktif" },
                      { icon: Coffee, label: "Homestay Kak Sinta — lisensi aktif" },
                    ].map((row) => (
                      <li
                        key={row.label}
                        className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2.5"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <row.icon
                            className="size-4 shrink-0 text-emerald-600"
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                          <span className="truncate text-[12.5px] font-semibold text-zinc-700">
                            {row.label}
                          </span>
                        </span>
                        <span className="shrink-0 text-[12.5px] font-black tabular-nums text-emerald-700">
                          +Rp150.000
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-[12px] font-bold text-white">
                    <Wallet className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                    Komisi cair ke rekening / e-wallet kamu
                  </p>
                </div>
                {/* Aksen Swiss-grid */}
                <div
                  aria-hidden="true"
                  className="absolute -right-2 -top-2 -z-10 h-full w-full rounded-2xl border-2 border-emerald-600/25"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Kalkulator / Proyeksi Cuan ───────────────────────────────── */}
        <section aria-labelledby="calc-title" className="border-b border-zinc-200 bg-zinc-50">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                Kalkulator Cuan
              </p>
              <h2
                id="calc-title"
                className="mt-2 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl"
              >
                Kira-kira Bisa Dapat Berapa?
              </h2>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {CALCULATOR_ROWS.map((row, index) => (
                <div
                  key={row.sales}
                  className="relative rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6"
                >
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                    {row.sales} Penjualan
                  </p>
                  <p className="mt-2 text-[32px] font-black tabular-nums leading-none tracking-tight text-zinc-950 sm:text-[36px]">
                    {row.amount}
                  </p>
                  <p className="mt-3 text-[13px] leading-relaxed text-zinc-600">
                    {row.note}
                  </p>
                  {index === CALCULATOR_ROWS.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-1 rounded-b-2xl bg-emerald-600"
                    />
                  ) : null}
                </div>
              ))}
            </div>
            <p className="mt-6 inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[12.5px] font-bold text-emerald-800">
              <InfinityIcon className="size-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
              Komisi flat Rp150.000 per penjualan lisensi seumur hidup — tanpa batas kuota.
            </p>
          </div>
        </section>

        {/* ── 3. Alasan gampang ditawarkan ────────────────────────────────── */}
        <section aria-labelledby="why-title" className="border-b border-zinc-200">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                Kenapa Gampang Jual?
              </p>
              <h2
                id="why-title"
                className="mt-2 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl"
              >
                UnitKu Gampang Banget Ditawarkan
              </h2>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {VALUE_PROPS.map((prop) => (
                <article
                  key={prop.title}
                  className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-[0_16px_40px_-24px_rgba(10,10,10,0.3)] sm:p-6"
                >
                  <span
                    className="flex size-11 items-center justify-center rounded-xl bg-emerald-600 text-white"
                    aria-hidden="true"
                  >
                    <prop.icon className="size-5.5" strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-4 text-base font-black tracking-tight text-zinc-950 sm:text-lg">
                    {prop.title}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-600">
                    {prop.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── 4. Cara kerja 3 langkah ─────────────────────────────────────── */}
        <section id="cara-kerja" aria-labelledby="how-title" className="scroll-mt-16 border-b border-zinc-200 bg-zinc-50">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                Cara Kerja
              </p>
              <h2
                id="how-title"
                className="mt-2 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl"
              >
                Cuma 3 Langkah Gampang
              </h2>
            </div>
            <ol className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {HOW_IT_WORKS.map((step) => (
                <li
                  key={step.step}
                  className="relative rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="text-[40px] font-black leading-none tracking-tight text-zinc-100 sm:text-5xl"
                      aria-hidden="true"
                    >
                      {step.step}
                    </span>
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700"
                      aria-hidden="true"
                    >
                      <step.icon className="size-5" strokeWidth={1.75} />
                    </span>
                  </div>
                  <h3 className="mt-3 text-[15px] font-black tracking-tight text-zinc-950 sm:text-base">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
                    {step.detail}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-8">
              <Button
                asChild
                size="lg"
                className="h-auto min-h-12 whitespace-normal bg-emerald-600 px-6 py-3 text-[15px] font-bold leading-snug text-white shadow-sm hover:bg-emerald-700"
              >
                <a href="/affiliate/join">
                  Mulai Langkah 1 — Daftar Gratis
                  <ArrowRight className="size-4.5" strokeWidth={2.25} aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* ── 5. Fasilitas Mitra: bot generator iklan ────────────────────── */}
        <section aria-labelledby="fasilitas-title" className="border-b border-zinc-200">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                Fasilitas Mitra
              </p>
              <h2
                id="fasilitas-title"
                className="mt-2 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl"
              >
                Bingung Mau Posting Apa Hari Ini?
              </h2>
            </div>

            {/* Kartu lebar satu-grid: kiri copy, kanan mock tampilan bot */}
            <div className="mt-8 grid grid-cols-1 items-center gap-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_16px_40px_-24px_rgba(10,10,10,0.3)] sm:p-8 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <span
                  className="flex size-11 items-center justify-center rounded-xl bg-emerald-600 text-white"
                  aria-hidden="true"
                >
                  <Bot className="size-5.5" strokeWidth={1.75} />
                </span>
                <h3 className="mt-4 text-lg font-black tracking-tight text-zinc-950 sm:text-xl">
                  Bot Generator Iklan Otomatis
                </h3>
                <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-zinc-600 sm:text-[15px]">
                  Gak perlu pusing mikir kata-kata promosi. Setiap mitra dapat
                  akses gratis bot Telegram pembuat materi iklan tanpa batas
                  (jutaan variasi draf status medsos &amp; chat WA juragan
                  kost) siap sebar cukup 1-tap copy.
                </p>
                <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11.5px] font-bold text-emerald-700">
                  <CheckCircle2
                    className="size-3.5"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                  Gratis untuk semua mitra aktif
                </p>
                <p className="mt-3 text-[12.5px] text-zinc-500">
                  Akses instan dari Dashboard Mitra setelah aktivasi.
                </p>
              </div>

              {/* Mock tampilan bot — mengikuti gaya kartu simulasi di hero */}
              <div className="lg:col-span-5">
                <div className="relative mx-auto w-full max-w-sm lg:ml-auto lg:mr-0">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-center gap-2.5 border-b border-zinc-200 pb-3">
                      <span
                        className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white"
                        aria-hidden="true"
                      >
                        <Bot className="size-4" strokeWidth={2} />
                      </span>
                      <div>
                        <p className="text-[12.5px] font-black text-zinc-950">
                          UnitKu Partner Bot
                        </p>
                        <p className="text-[10.5px] font-bold text-emerald-600">
                          ● online — siap buat materi
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2" aria-hidden="true">
                      <p className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-[12.5px] font-bold text-zinc-800">
                        🏠 Iklan Produk (ke Pemilik Kost)
                      </p>
                      <p className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-[12.5px] font-bold text-zinc-800">
                        💬 Template Chat WA Pemilik Kost
                      </p>
                    </div>
                    <div className="mt-3 rounded-xl bg-zinc-950 p-3">
                      <p className="text-[11px] leading-relaxed text-zinc-300">
                        &ldquo;Lagi nyari tambahan penghasilan modal jempol
                        doang sambil rebahan di rumah? &hellip;&rdquo;
                      </p>
                      <p className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-400">
                        <Copy
                          className="size-3"
                          strokeWidth={2.25}
                          aria-hidden="true"
                        />
                        Tap 1x → langsung tersalin
                      </p>
                    </div>
                  </div>
                  {/* Aksen Swiss-grid */}
                  <div
                    aria-hidden="true"
                    className="absolute -right-2 -top-2 -z-10 h-full w-full rounded-2xl border-2 border-emerald-600/25"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. FAQ ──────────────────────────────────────────────────────── */}
        <section aria-labelledby="faq-title" className="border-b border-zinc-200 bg-zinc-50">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                FAQ
              </p>
              <h2
                id="faq-title"
                className="mt-2 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl"
              >
                Pertanyaan yang Sering Ditanya
              </h2>
              <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-600">
                Masih ragu? Tanya langsung ke Admin — dijawab manusia, bukan
                bot.
              </p>
              <a
                href={SUPPORT_WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-emerald-700 underline-offset-4 hover:underline"
              >
                <MessageCircle className="size-4" strokeWidth={2} aria-hidden="true" />
                Chat Admin via WhatsApp
              </a>
            </div>
            <div className="flex flex-col gap-3 lg:col-span-8">
              {FAQ_ITEMS.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-xl border border-zinc-200 bg-white open:shadow-[0_12px_32px_-20px_rgba(10,10,10,0.3)]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[14px] font-bold text-zinc-950 [&::-webkit-details-marker]:hidden sm:px-5 sm:text-[15px]">
                    {item.question}
                    <ChevronDown
                      className="size-4.5 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180"
                      strokeWidth={2.25}
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="border-t border-zinc-100 px-4 py-3.5 text-[13px] leading-relaxed text-zinc-600 sm:px-5">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── 7. Bottom CTA ───────────────────────────────────────────────── */}
        <section className="bg-zinc-950 text-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-14 text-center sm:px-6 sm:py-20">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide text-emerald-400">
              <Link2 className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
              Slot mitra selalu terbuka
            </span>
            <h2 className="mt-4 max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
              Siap Ubah Kontak WhatsApp Jadi{" "}
              <span className="text-emerald-400">Sumber Cuan?</span>
            </h2>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-zinc-400 sm:text-[15px]">
              Setiap pemilik kost, kontrakan petak, hingga pengelola rusun
              &amp; villa butuh sistem kelola properti praktis tanpa drama
              tagihan. Kamu cuma perlu jadi orang yang menyampaikannya —
              daftar sekarang, sebar link pertamamu hari ini juga.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3.5">
              <Button
                asChild
                size="lg"
                className="h-auto min-h-14 whitespace-normal bg-emerald-500 px-7 py-3.5 text-base font-bold leading-snug text-zinc-950 hover:bg-emerald-400"
              >
                <a href="/affiliate/join">
                  Daftar Jadi Mitra Sekarang — Gratis
                  <ArrowRight className="size-4.5" strokeWidth={2.5} aria-hidden="true" />
                </a>
              </Button>
              <a
                href="/affiliate/dashboard"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-zinc-400 underline-offset-4 transition-colors hover:text-emerald-400 hover:underline"
              >
                Sudah punya akun mitra? Buka Dashboard Afiliasi Anda
                <ArrowRight className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer (sticky ke dasar saat konten pendek — root min-h-screen
          flex flex-col + mt-auto) ─────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 py-6 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
          <p className="text-xs text-zinc-500">
            Butuh bantuan pendaftaran? Chat Admin UnitKu (WA{" "}
            {SUPPORT_WA_DISPLAY})
          </p>
          <div className="flex flex-col items-center gap-1 sm:items-end">
            <a
              href={SUPPORT_WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 underline-offset-2 hover:underline"
            >
              <MessageCircle className="size-3.5" strokeWidth={2} aria-hidden="true" />
              Tanya Admin via WhatsApp
            </a>
            <p className="text-[11px] text-zinc-400">{COPYRIGHT_LINE}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
