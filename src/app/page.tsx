// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Landing Page Komersial (publik, rute "/")
//
// Gaya bahasa: lugas, praktis, hangat — sasaran juragan kost & pemilik
// kontrakan Indonesia. Layout Bento Grid + Tailwind, responsif mobile-first.
// Struktur: Hero → Masalah vs Solusi → Fitur Jagoan (Bento) → Penawaran
// Lifetime → FAQ → Final CTA → Footer legalitas (KYC Mayar).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  DoorOpen,
  FileDown,
  LayoutGrid,
  MessageCircle,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";

import { getAuthUser } from "@/lib/auth/server";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BuyCta } from "@/components/landing/buy-cta";
import { SiteFooter } from "@/components/landing/site-footer";
import {
  BRAND,
  LICENSE_PRICE_LABEL,
} from "@/lib/landing-config";

export const metadata: Metadata = {
  title: "UnitKu — Kelola Puluhan Pintu Sewa Tanpa Capek Nagih | Elvindigital",
  description:
    "Aplikasi pengelola kost, kontrakan & unit sewa paling praktis: denah kamar visual, tagihan WhatsApp otomatis, buku kas laba bersih, dan portal penyewa. Lisensi seumur hidup — sekali bayar Rp399.000, tanpa langganan bulanan.",
};

const OLD_PRICE_LABEL = "Rp899.000";

/* ── Data mockup ───────────────────────────────────────────────────────────── */

const HERO_STATS = [
  { label: "Total Kamar", value: "12", tone: "bg-zinc-900 text-white" },
  { label: "Terisi", value: "10", tone: "bg-white text-zinc-900" },
  { label: "Jatuh Tempo", value: "2", tone: "bg-white text-zinc-900" },
  { label: "Kosong", value: "2", tone: "bg-white text-zinc-900" },
] as const;

const HERO_ROOMS = [
  { id: "101", tenant: "Budi Santoso", badge: "Lunas", state: "lunas", meta: "Tempo 28 Sep" },
  { id: "102", tenant: "Dimas Ardi", badge: "Lunas", state: "lunas", meta: "Tempo 5 Sep" },
  { id: "103", tenant: "Ahmad Fauzi", badge: "H-3", state: "tempo", meta: "Tempo 22 Sep" },
  { id: "104", tenant: "Dewi Lestari", badge: "H+2", state: "tempo", meta: "Tempo 24 Sep" },
  { id: "105", tenant: null, badge: "Kosong", state: "kosong", meta: "Tipe A · AC" },
  { id: "106", tenant: "Rizky Pratama", badge: "Lunas", state: "lunas", meta: "Tempo 10 Sep" },
  { id: "107", tenant: null, badge: "Kosong", state: "kosong", meta: "Tipe B · Kipas" },
  { id: "108", tenant: "Maya Anggraini", badge: "Lunas", state: "lunas", meta: "Tempo 3 Sep" },
] as const;

const ROOM_TONE: Record<string, { card: string; badge: string }> = {
  lunas: { card: "border-emerald-200 bg-emerald-50", badge: "bg-emerald-600 text-white" },
  tempo: { card: "border-amber-300 bg-amber-50", badge: "bg-amber-400 text-amber-950" },
  kosong: { card: "border-zinc-200 bg-zinc-50", badge: "bg-zinc-200 text-zinc-600" },
};

const PAIN_POINTS = [
  "Nggak enakan tiap mau nagih sewa yang telat ke anak kost/penyewa.",
  "Catatan manual di buku sering keselip, kotor, atau rawan hilang.",
  "Harus bolak-balik cek mutasi m-banking nyocokin struk transferan.",
  "Uang sewa tahu-tahu habis karena biaya perbaikan kecil-kecil nggak tercatat.",
] as const;

const SOLUTION_POINTS = [
  "Pengingat WA sopan terkirim otomatis, nggak perlu drama tagih-menagih.",
  "Denah visual live: sekali buka HP langsung tahu mana kamar yang kosong/terisi.",
  "Penyewa dapat bukti invoice & kuitansi resmi otomatis, minim komplain.",
  "Catatan kas masuk dan keluar tercatat rapi per properti, laba bersih langsung kelihatan.",
] as const;

const OFFER_BENEFITS = [
  "Akses penuh tanpa batas waktu",
  "Bebas input berapa pun jumlah kamar / pintu kontrakan",
  "Denah visual, invoice WhatsApp, & pembukuan kas otomatis",
  "Support multi-cabang properti",
  "Gratis pembaruan fitur baru ke depannya",
] as const;

const FAQ_ITEMS = [
  {
    q: "Benar-benar nggak ada iuran bulanan lagi?",
    a: "Iya, betul. Anda cukup bayar satu kali saja saat aktivasi. Tidak ada tagihan bulanan atau biaya tahunan sama sekali.",
  },
  {
    q: "Gampang nggak dipakai dari HP?",
    a: "Sangat gampang dan ringan. Didesain ramah untuk dibuka langsung lewat browser smartphone Anda kapan saja.",
  },
  {
    q: "Bisa buat kontrakan petak atau ruko sewa?",
    a: "Bisa banget. Sistem UnitKu fleksibel untuk segala macam unit sewaan, baik kost, kontrakan, paviliun, kios, hingga ruko.",
  },
  {
    q: "Kalau saya gaptek ada panduannya?",
    a: "Tenang, tampilannya sangat simpel dan bersih. Ada panduan ringkas dan tim kami siap bantu jika ada kendala.",
  },
] as const;

/* ── Mockup denah (hero) ───────────────────────────────────────────────────── */

function HeroMockup() {
  return (
    <div className="relative mx-auto mt-12 w-full max-w-3xl sm:mt-14">
      {/* Bingkai jendela aplikasi */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-[0_24px_60px_-24px_rgba(15,23,42,0.28)]">
        {/* Bar browser */}
        <div className="flex items-center gap-1.5 border-b border-zinc-100 bg-zinc-50 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-zinc-300" aria-hidden="true" />
          <span className="size-2.5 rounded-full bg-zinc-300" aria-hidden="true" />
          <span className="size-2.5 rounded-full bg-zinc-300" aria-hidden="true" />
          <span className="mx-auto rounded-md border border-zinc-200 bg-white px-2.5 py-0.5 text-[12.5px] text-zinc-500">
            unitku.my.id/dashboard
          </span>
          <span className="w-10 shrink-0" aria-hidden="true" />
        </div>

        {/* Isi aplikasi */}
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold leading-tight">Kost Griya Pratama</p>
              <p className="text-[12.5px] leading-tight text-zinc-500">Denah Kamar · 2 lantai</p>
            </div>
            <span className="rounded-md bg-zinc-900 px-2.5 py-1.5 text-[12.5px] font-semibold text-white">
              + Check-in
            </span>
          </div>

          {/* Strip statistik */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {HERO_STATS.map((stat) => (
              <div
                key={stat.label}
                className={`rounded-lg border border-zinc-200 p-2.5 ${stat.tone}`}
              >
                <p className={`text-[12.5px] leading-tight ${stat.tone.includes("text-white") ? "text-zinc-300" : "text-zinc-500"}`}>
                  {stat.label}
                </p>
                <p className="mt-0.5 text-lg font-bold leading-tight tabular-nums">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Denah kamar — hijau terisi · kuning jatuh tempo · abu kosong */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {HERO_ROOMS.map((room) => {
              const tone = ROOM_TONE[room.state];
              return (
                <div key={room.id} className={`rounded-lg border p-2.5 ${tone.card}`}>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[13px] font-bold leading-none tabular-nums">{room.id}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[12.5px] font-semibold leading-none ${tone.badge}`}>
                      {room.badge}
                    </span>
                  </div>
                  <p className={`mt-1.5 truncate text-[12.5px] font-medium leading-tight ${room.tenant ? "text-zinc-800" : "italic text-zinc-400"}`}>
                    {room.tenant ?? "Tersedia"}
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] leading-tight text-zinc-500 tabular-nums">
                    {room.meta}
                  </p>
                </div>
              );
            })}
            <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-200 p-2.5 text-[12.5px] font-medium text-zinc-400 tabular-nums">
              +4 kamar
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Halaman ───────────────────────────────────────────────────────────────── */

export default async function LandingPage() {
  // Tombol navbar adaptif: pengunjung → Masuk, owner → Dashboard
  const user = await getAuthUser();
  const authHref = user ? "/dashboard" : "/login";
  const authLabel = user ? "Dashboard" : "Masuk";

  return (
    <main className="flex min-h-dvh flex-col bg-white text-zinc-900">
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="UnitKu — beranda">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-base font-bold text-white select-none">
              U
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold leading-tight">
                {BRAND.product}
              </span>
              <span className="block text-[12.5px] leading-tight text-zinc-500">
                by {BRAND.vendor}
              </span>
            </span>
          </Link>

          <nav aria-label="Navigasi utama" className="hidden items-center gap-6 md:flex">
            <a href="#fitur" className="text-[12.5px] font-medium text-zinc-600 hover:text-zinc-900">
              Fitur Jagoan
            </a>
            <a href="#penawaran" className="text-[12.5px] font-medium text-zinc-600 hover:text-zinc-900">
              Penawaran
            </a>
            <a href="#faq" className="text-[12.5px] font-medium text-zinc-600 hover:text-zinc-900">
              Tanya Jawab
            </a>
          </nav>

          <ButtonLink href={authHref}>
            {authLabel}
          </ButtonLink>
        </div>
      </header>

      <div className="flex-1">
        {/* ── 1. Hero ──────────────────────────────────────────────────────── */}
        <section className="border-b border-zinc-100 bg-[#f8fafc]">
          <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pb-20 sm:pt-20">
            <p className="mx-auto inline-flex max-w-full items-center justify-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold leading-snug text-zinc-700">
              <span aria-hidden="true">⚡</span>
              Aplikasi Pengelola Kost, Kontrakan &amp; Unit Sewa Paling Praktis
            </p>

            <h1 className="mx-auto mt-5 max-w-3xl text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[42px]">
              Kelola Puluhan Pintu Sewa Tanpa Capek Nagih &amp; Pusing Catatan
              Berantakan
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-pretty text-[13px] leading-relaxed text-zinc-600 sm:text-[14.5px]">
              Tinggalkan buku tulis atau Excel yang bikin mumet. Pantau kamar
              kosong sekilas pandang, kirim tagihan WhatsApp otomatis tanpa rasa
              segan, dan rekap pemasukan bersih langsung dari HP.
            </p>

            <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <BuyCta
                className="w-full sm:w-auto"
                label={`Miliki Akses Seumur Hidup — ${LICENSE_PRICE_LABEL}`}
              />
              <a
                href="#fitur"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-[13px] font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 sm:w-auto"
              >
                Lihat Demo Aplikasi
                <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </a>
            </div>

            <ul className="mx-auto mt-7 flex max-w-3xl flex-col items-center justify-center gap-x-6 gap-y-2 sm:flex-row sm:flex-wrap">
              {["Bayar sekali aktif selamanya", "Tanpa langganan bulanan", "Langsung aktif otomatis"].map(
                (item) => (
                  <li
                    key={item}
                    className="flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-600"
                  >
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
                    {item}
                  </li>
                ),
              )}
            </ul>

            <HeroMockup />
          </div>
        </section>

        {/* ── 2. Masalah nyata vs solusi ───────────────────────────────────── */}
        <section id="masalah" className="scroll-mt-16">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-18">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-[28px]">
                Kalau Ibaratnya Begini…
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-600 sm:text-[14.5px]">
                Mana yang paling sering Anda alami? Kalau kolom kiri bikin
                mengangguk, berarti UnitKu memang diciptakan untuk Anda.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {/* Cara lama */}
              <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                    <XCircle className="size-5 text-zinc-500" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3 className="text-[15px] font-bold leading-snug">
                    Cara Lama <span className="font-medium text-zinc-500">(Bikin Puyeng)</span>
                  </h3>
                </div>
                <ul className="mt-4 space-y-3">
                  {PAIN_POINTS.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-zinc-600">
                      <XCircle className="mt-0.5 size-4 shrink-0 text-rose-500" strokeWidth={1.75} aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>

              {/* Pakai UnitKu */}
              <article className="rounded-xl border-2 border-emerald-600 bg-white p-5 shadow-[0_8px_24px_rgba(5,150,105,0.10)]">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600">
                    <CheckCircle2 className="size-5 text-white" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3 className="text-[15px] font-bold leading-snug">
                    Pakai UnitKu <span className="font-medium text-emerald-700">(Serba Rapi &amp; Santai)</span>
                  </h3>
                </div>
                <ul className="mt-4 space-y-3">
                  {SOLUTION_POINTS.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-zinc-700">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* ── 3. Fitur Jagoan (Bento Grid) ─────────────────────────────────── */}
        <section id="fitur" className="scroll-mt-16 border-y border-zinc-100 bg-[#f8fafc]">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-18">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight sm:text-[28px]">
                Fitur Jagoan UnitKu
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-600 sm:text-[14.5px]">
                Bukan sekadar catatan digital — ini asisten ngurus properti yang
                kerjaannya beresin urusan capek Anda.
              </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {/* Bento 1 — BESAR: Denah Kamar Visual */}
              <article className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:col-span-2 lg:row-span-2">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                  <LayoutGrid className="size-5 text-zinc-800" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="mt-3.5 text-base font-bold leading-snug sm:text-lg">
                  Denah Kamar Visual — Cek Kondisi Kost Sekali Lirik
                </h3>
                <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-zinc-600">
                  Indikator warna intuitif: tahu kapan kamar jatuh tempo tanpa
                  perlu buka-buka buku catatan.
                </p>

                <div className="mt-5 grid flex-1 content-start gap-2 rounded-lg border border-zinc-100 bg-[#f8fafc] p-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[13px] font-bold leading-none tabular-nums">101</span>
                      <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[12.5px] font-semibold leading-none text-white">Lunas</span>
                    </div>
                    <p className="mt-1.5 truncate text-[12.5px] font-medium leading-tight">Budi Santoso</p>
                    <p className="mt-0.5 text-[12.5px] leading-tight text-zinc-500 tabular-nums">Tempo 28 Sep</p>
                  </div>
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[13px] font-bold leading-none tabular-nums">103</span>
                      <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[12.5px] font-semibold leading-none text-amber-950">H-3</span>
                    </div>
                    <p className="mt-1.5 truncate text-[12.5px] font-medium leading-tight">Ahmad Fauzi</p>
                    <p className="mt-0.5 text-[12.5px] leading-tight text-zinc-500 tabular-nums">Tempo 22 Sep</p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[13px] font-bold leading-none tabular-nums">105</span>
                      <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[12.5px] font-semibold leading-none text-zinc-600">Kosong</span>
                    </div>
                    <p className="mt-1.5 truncate text-[12.5px] font-medium italic leading-tight text-zinc-400">Tersedia</p>
                    <p className="mt-0.5 text-[12.5px] leading-tight text-zinc-500">Tipe A · AC</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[13px] font-bold leading-none tabular-nums">106</span>
                      <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[12.5px] font-semibold leading-none text-white">Lunas</span>
                    </div>
                    <p className="mt-1.5 truncate text-[12.5px] font-medium leading-tight">Rizky Pratama</p>
                    <p className="mt-0.5 text-[12.5px] leading-tight text-zinc-500 tabular-nums">Tempo 10 Sep</p>
                  </div>
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[13px] font-bold leading-none tabular-nums">104</span>
                      <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[12.5px] font-semibold leading-none text-amber-950">H+2</span>
                    </div>
                    <p className="mt-1.5 truncate text-[12.5px] font-medium leading-tight">Dewi Lestari</p>
                    <p className="mt-0.5 text-[12.5px] leading-tight text-zinc-500 tabular-nums">Tempo 24 Sep</p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[13px] font-bold leading-none tabular-nums">107</span>
                      <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[12.5px] font-semibold leading-none text-zinc-600">Kosong</span>
                    </div>
                    <p className="mt-1.5 truncate text-[12.5px] font-medium italic leading-tight text-zinc-400">Tersedia</p>
                    <p className="mt-0.5 text-[12.5px] leading-tight text-zinc-500">Tipe B · Kipas</p>
                  </div>
                </div>

                <p className="mt-4 flex items-center gap-2 text-[12.5px] font-medium text-zinc-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-emerald-500" aria-hidden="true" /> Terisi
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-amber-400" aria-hidden="true" /> Jatuh tempo
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-zinc-300" aria-hidden="true" /> Kosong
                  </span>
                </p>
              </article>

              {/* Bento 2 — Tagihan WhatsApp Otomatis */}
              <article className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                  <MessageCircle className="size-5 text-zinc-800" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="mt-3.5 text-[15px] font-bold leading-snug">
                  Tagihan WhatsApp Otomatis — Nagih Sopan Tanpa Bikin Canggung
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">
                  Template pesan tagihan rapi &amp; profesional langsung ke nomor
                  WhatsApp penyewa.
                </p>
                <div className="mt-4 rounded-xl rounded-tl-sm border border-emerald-100 bg-emerald-50 p-3">
                  <p className="text-[12.5px] leading-relaxed text-zinc-700">
                    Halo Budi, kami dari Kost Griya Pratama mengingatkan tagihan
                    Kamar 101 sebesar{" "}
                    <span className="font-semibold tabular-nums">Rp1.500.000</span>{" "}
                    jatuh tempo 28 Sep (H-3). Mohon dibayar sebelum tanggal
                    tersebut ya 🙏
                  </p>
                  <p className="mt-2 text-[12.5px] font-medium text-emerald-700">
                    ✓✓ Terkirim otomatis · 09.00
                  </p>
                </div>
              </article>

              {/* Bento 3 — Satu Akun Multi-Cabang */}
              <article className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                  <Building2 className="size-5 text-zinc-800" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="mt-3.5 text-[15px] font-bold leading-snug">
                  Satu Akun untuk Semua Cabang Properti
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">
                  Punya kost di lokasi A dan kontrakan di lokasi B? Atur semuanya
                  dalam satu genggaman tanpa gonta-ganti akun.
                </p>
                <ul className="mt-4 space-y-2">
                  {[
                    { nama: "Kost Griya Pratama", unit: "24 Kamar", aktif: true },
                    { nama: "Kost Melati Indah", unit: "16 Kamar", aktif: false },
                    { nama: "Kontrakan Permata Jaya", unit: "8 Unit", aktif: false },
                  ].map((p) => (
                    <li
                      key={p.nama}
                      className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 ${
                        p.aktif ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <DoorOpen className={`size-4 shrink-0 ${p.aktif ? "text-zinc-300" : "text-zinc-400"}`} strokeWidth={1.75} aria-hidden="true" />
                        <span className="truncate text-[12.5px] font-medium">{p.nama}</span>
                      </span>
                      <span className={`shrink-0 text-[12.5px] tabular-nums ${p.aktif ? "text-zinc-300" : "text-zinc-500"}`}>
                        {p.unit}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[12.5px] font-semibold text-zinc-500 tabular-nums">
                  1 akun · 48 pintu terkelola
                </p>
              </article>

              {/* Bento 4 — Buku Kas */}
              <article className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                  <Wallet className="size-5 text-zinc-800" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="mt-3.5 text-[15px] font-bold leading-snug">
                  Buku Kas &amp; Catatan Pengeluaran
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">
                  Catat biaya tukang, token listrik, hingga sampah. Laba rugi
                  terhitung otomatis.
                </p>
                <div className="mt-4 space-y-1.5 rounded-lg border border-zinc-100 bg-[#f8fafc] p-3">
                  <div className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="flex items-center gap-1.5 text-zinc-600">
                      <TrendingUp className="size-3.5 shrink-0 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
                      Sewa bulan ini
                    </span>
                    <span className="font-semibold text-emerald-700 tabular-nums">+Rp36.000.000</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="flex items-center gap-1.5 text-zinc-600">
                      <TrendingDown className="size-3.5 shrink-0 text-rose-500" strokeWidth={1.75} aria-hidden="true" />
                      Perbaikan pipa
                    </span>
                    <span className="font-medium text-rose-600 tabular-nums">−Rp1.200.000</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="flex items-center gap-1.5 text-zinc-600">
                      <TrendingDown className="size-3.5 shrink-0 text-rose-500" strokeWidth={1.75} aria-hidden="true" />
                      Token listrik
                    </span>
                    <span className="font-medium text-rose-600 tabular-nums">−Rp850.000</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-zinc-200 pt-2 text-[12.5px]">
                    <span className="font-bold">Laba bersih</span>
                    <span className="font-bold tabular-nums">Rp33.950.000</span>
                  </div>
                </div>
              </article>

              {/* Bento 5 — Portal Penghuni */}
              <article className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                  <Smartphone className="size-5 text-zinc-800" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="mt-3.5 text-[15px] font-bold leading-snug">
                  Portal Khusus Penghuni
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">
                  Penyewa bisa cek status tagihan dan simpan kuitansi sendiri,
                  juragan kost bebas repot.
                </p>
                <div className="mt-4 rounded-lg border border-zinc-100 bg-[#f8fafc] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[12.5px] font-semibold">Kamar 101 · Budi Santoso</span>
                    <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[12.5px] font-semibold leading-none text-white">Lunas</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[12.5px] font-medium text-zinc-700">
                      <FileDown className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                      Unduh Kuitansi
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[12.5px] font-medium text-zinc-700">
                      <Banknote className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                      Cek Tagihan
                    </span>
                  </div>
                </div>
              </article>

              {/* Kartu CTA menutup grid — konversi tanpa jeda */}
              <article className="flex flex-col justify-between rounded-xl bg-zinc-900 p-5 text-white">
                <div>
                  <h3 className="text-[15px] font-bold leading-snug">
                    Siap jadi juragan yang tenang?
                  </h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-300">
                    Semua fitur di atas terbuka dengan satu lisensi — sekali
                    bayar{" "}
                    <span className="font-semibold tabular-nums text-white">
                      {LICENSE_PRICE_LABEL}
                    </span>
                    , tanpa biaya bulanan.
                  </p>
                </div>
                <BuyCta inverted className="mt-5 w-full" label="Amankan Lisensi Sekarang" />
              </article>
            </div>
          </div>
        </section>

        {/* ── 4. Penawaran Khusus (Lifetime Deal) ──────────────────────────── */}
        <section id="penawaran" className="scroll-mt-16">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-18">
            <div className="mx-auto max-w-2xl">
              <div className="rounded-2xl border-2 border-zinc-900 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.10)] sm:p-8">
                <div className="text-center">
                  <p className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1.5 text-[12.5px] font-bold uppercase tracking-wide text-amber-900">
                    Penawaran Terbatas — Juragan Early Adopter
                  </p>

                  <div className="mt-5 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
                    <span className="text-xl font-medium text-zinc-400 line-through tabular-nums">
                      {OLD_PRICE_LABEL}
                    </span>
                    <span className="text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
                      {LICENSE_PRICE_LABEL}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[12.5px] font-bold text-emerald-800 tabular-nums">
                      Hemat Rp500.000
                    </span>
                  </div>

                  <p className="mt-3 text-[13px] font-semibold text-zinc-700 sm:text-[14.5px]">
                    Sekali Bayar — Bebas Pakai Seumur Hidup
                    <span className="block text-[12.5px] font-medium text-zinc-500">
                      (Tanpa Biaya Bulanan / Potongan Sewa)
                    </span>
                  </p>

                  <p className="mx-auto mt-4 max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12.5px] leading-relaxed text-amber-900 sm:text-[13px]">
                    Cuma 399 ribu sekali bayar. Nilainya bahkan lebih murah dari
                    harga sewa 1 kamar sebulan, tapi bikin tenang ngurus properti
                    Anda bertahun-tahun.
                  </p>
                </div>

                <ul className="mt-6 space-y-2.5 border-t border-zinc-100 pt-6">
                  {OFFER_BENEFITS.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2 text-[12.5px] leading-snug text-zinc-700 sm:text-[13px]">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
                      {benefit}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 border-t border-zinc-100 pt-6">
                  <BuyCta
                    className="w-full"
                    label={`Amankan Lisensi UnitKu Sekarang — ${LICENSE_PRICE_LABEL}`}
                  />
                  <p className="mt-3 text-center text-[12.5px] text-zinc-500">
                    Pembayaran aman via Mayar · Aktivasi otomatis setelah
                    pembayaran terverifikasi · Garansi uang kembali 7 hari
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. Tanya Jawab (FAQ) ─────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-16 border-t border-zinc-100 bg-[#f8fafc]">
          <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 sm:py-18">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-[28px]">
                Tanya Jawab yang Sering Ditanyakan Juragan
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-600 sm:text-[14.5px]">
                Masih ragu? Jawabannya mungkin ada di sini — atau langsung tanya
                tim kami via WhatsApp.
              </p>
            </div>

            <Accordion type="single" collapsible className="mt-8 space-y-3">
              {FAQ_ITEMS.map((item, index) => (
                <AccordionItem
                  key={item.q}
                  value={`faq-${index + 1}`}
                  className="rounded-xl border border-zinc-200 bg-white px-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] last:border-b"
                >
                  <AccordionTrigger className="py-4 text-left text-[13px] font-semibold hover:no-underline sm:text-[14.5px]">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 text-[12.5px] leading-relaxed text-zinc-600 sm:text-[13px]">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ── 6. Final CTA ─────────────────────────────────────────────────── */}
        <section className="bg-zinc-900 text-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-18">
            <h2 className="mx-auto max-w-2xl text-balance text-2xl font-bold tracking-tight sm:text-3xl">
              Waktunya Kelola Kost &amp; Kontrakan Lebih Tenang Tanpa Beban
              Pikiran.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[13px] leading-relaxed text-zinc-300 sm:text-[14.5px]">
              Sekali bayar {LICENSE_PRICE_LABEL}, langsung aktif otomatis. Besok
              pagi Anda sudah bisa nagih tagihan pakai WhatsApp — sopan, rapi,
              tanpa drama.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <BuyCta
                inverted
                className="w-full sm:w-auto"
                label={`Miliki Lisensi Seumur Hidup — ${LICENSE_PRICE_LABEL}`}
              />
              <a
                href={authHref}
                className="inline-flex h-11 w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-zinc-800 sm:w-auto"
              >
                {user ? "Buka Dashboard" : "Sudah Punya Akun? Masuk"}
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* ── Footer legalitas (KYC) ────────────────────────────────────────── */}
      <SiteFooter />
    </main>
  );
}

/* ── Helper kecil: link bergaya tombol navbar ─────────────────────────────── */

function ButtonLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-zinc-800"
    >
      {children}
    </Link>
  );
}
