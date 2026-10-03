// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Landing Page Komersial (publik, rute "/")
//
// Gaya bahasa: lugas, praktis, hangat — sasaran juragan kost & pemilik
// kontrakan Indonesia. Layout Bento Grid + Tailwind, responsif mobile-first.
// Struktur: Hero → Masalah vs Solusi → Fitur Jagoan (Bento) → Penawaran
// Lifetime → FAQ → Final CTA → Footer legalitas (KYC Mayar).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  DatabaseBackup,
  DoorOpen,
  FileDown,
  FileSpreadsheet,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  Notebook,
  Receipt,
  ShieldCheck,
  Smartphone,
  Star,
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

/** Harga referensi sebelum diskon early adopter — sinkron dgn /checkout */
const OLD_PRICE_LABEL = "Rp799.000";

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
  "Generator iklan kamar siap sebar ke Facebook & WhatsApp",
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

/* ── Data testimoni juragan (universal — tanpa nama kota/lokasi) ────────── */

const TESTIMONIALS = [
  {
    name: "Pak Hendra",
    role: "Juragan Kost 14 Pintu",
    initial: "H",
    tone: "bg-emerald-100 text-emerald-800",
    quote:
      "Paling males tuh tiap tanggal 1 kudu muter wa-in anak-anak kost satu-satu sambil ngetik tagihan manual. Sering gak enakan sendiri, disangka rewel. Pas pake UnitKu tinggal pencet kirim tagihan WA dari HP, beres sambil ngopi di teras. Uang sewa masuknya jadi jauh lebih tertib.",
  },
  {
    name: "Bu Ratna",
    role: "Pemilik 8 Pintu Kontrakan Petakan",
    initial: "R",
    tone: "bg-amber-100 text-amber-800",
    quote:
      "Biasanya rekap di buku folio tebel, pas ada yang nunggak atau tanya sisa token, catatannya sering keselip. Sekarang buka denah kamar di HP udah langsung keliatan mana yang kosong mana yang telat bayar. Nggak bikin pusing orang tua kayak saya.",
  },
  {
    name: "Mas Dimas",
    role: "Pengelola Kost Mahasiswa, 18 Kamar",
    initial: "D",
    tone: "bg-zinc-900 text-white",
    quote:
      "Awalnya sempat mikir kok murah amat 399rb sekali bayar seumur hidup, biasanya aplikasi ginian dipalak 100rb per bulan. Ternyata beneran lifetime dan fiturnya to the point. Fitur kwitansi otomatis via WA-nya bikin kost saya keliatan jauh lebih profesional di mata anak-anak.",
  },
  {
    name: "Hj. Farida",
    role: "Pengelola Kost Putri, 10 Kamar",
    initial: "F",
    tone: "bg-rose-100 text-rose-700",
    quote:
      "Anak kost sekarang kalau ditagih lisan suka pura-pura lupa. Giliran dikirimin rincian tagihan resmi dari UnitKu langsung ke WhatsApp-nya, sorenya langsung pada transfer. Gak perlu drama ribut nagih lagi tiap bulan.",
  },
  {
    name: "Bang Robby",
    role: "Kontrakan Karyawan, 6 Pintu",
    initial: "R",
    tone: "bg-teal-100 text-teal-800",
    quote:
      "Yang paling ngebantu ya bukti kwitansi digitalnya. Begitu mereka transfer, klik sekali kwitansi langsung kekirim ke WA penyewa. Jadi gak ada lagi debat 'perasaan saya udah bayar deh pak'. Semua riwayat pembayarannya rapi tersimpan di sistem.",
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
            <Image
              src="/brand/icon.png"
              alt="Logo UnitKu"
              width={36}
              height={36}
              priority
              className="size-9 shrink-0 rounded-xl object-contain ring-1 ring-zinc-200"
            />
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
            <a href="#fitur" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Fitur Jagoan
            </a>
            <a href="#perbandingan" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Cara Lama vs UnitKu
            </a>
            <a href="#testimoni" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Testimoni
            </a>
            <a href="#penawaran" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Penawaran
            </a>
            <a href="#faq" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
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
            <p className="mx-auto inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-semibold leading-snug text-zinc-700 sm:text-base">
              <Image
                src="/brand/icon.png"
                alt="Logo UnitKu"
                width={22}
                height={22}
                priority
                className="size-5 shrink-0 object-contain"
              />
              Solusi Cerdas Pemilik Kost &amp; Kontrakan
            </p>

            <h1 className="mx-auto mt-5 max-w-3xl text-balance text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-4xl lg:text-5xl">
              Stop Gak Enakan Nagih Sewa.{" "}
              <span className="text-emerald-700">
                Tagihan WA Terkirim Otomatis, Uang Masuk Tepat Waktu.
              </span>
            </h1>

            <p className="mx-auto mt-4 max-w-3xl text-pretty text-lg leading-relaxed text-slate-600 sm:text-xl lg:text-2xl">
              Pantau denah kamar, lacak jatuh tempo sewa, dan kirim tagihan
              serta kwitansi resmi langsung via WhatsApp tanpa biaya langganan
              bulanan.
            </p>

            <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <Link
                href="/demo"
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-8 py-4 text-base font-bold text-white transition-colors hover:bg-zinc-800 sm:w-auto sm:text-lg"
              >
                Coba Denah Kost Saya — Gratis
                <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </Link>
              <BuyCta
                className="w-full border border-zinc-300 bg-white text-zinc-900 shadow-none hover:bg-zinc-50 sm:w-auto"
                label="Amankan Lisensi Rp 399rb"
              />
            </div>

            <p className="mt-3.5 text-sm font-semibold text-orange-600 sm:text-base">
              <span aria-hidden="true">⚡</span> Hemat Rp 400.000 — Kuota Early
              Adopter tersisa 23 lisensi lagi.
            </p>

            <ul className="mx-auto mt-7 flex max-w-3xl flex-col items-center justify-center gap-x-6 gap-y-2 sm:flex-row sm:flex-wrap">
              {["Generator iklan kamar siap sebar ke Facebook & WhatsApp", "Bayar sekali aktif selamanya", "Tanpa langganan bulanan", "Langsung aktif otomatis"].map(
                (item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-sm font-medium text-zinc-700 sm:text-base"
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
              <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
                Kalau Ibaratnya Begini…
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
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
                  <h3 className="text-xl font-bold leading-snug sm:text-2xl">
                    Cara Lama <span className="font-medium text-zinc-500">(Bikin Puyeng)</span>
                  </h3>
                </div>
                <ul className="mt-4 space-y-3">
                  {PAIN_POINTS.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-base leading-relaxed text-slate-600 sm:text-lg">
                      <XCircle className="mt-1 size-5 shrink-0 text-rose-500" strokeWidth={1.75} aria-hidden="true" />
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
                  <h3 className="text-xl font-bold leading-snug sm:text-2xl">
                    Pakai UnitKu <span className="font-medium text-emerald-700">(Serba Rapi &amp; Santai)</span>
                  </h3>
                </div>
                <ul className="mt-4 space-y-3">
                  {SOLUTION_POINTS.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-base leading-relaxed text-slate-700 sm:text-lg">
                      <CheckCircle2 className="mt-1 size-5 shrink-0 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
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
              <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
                Fitur Jagoan UnitKu
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
                Bukan sekadar catatan digital — ini asisten ngurus properti yang
                kerjaannya beresin urusan capek Anda.
              </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-flow-dense lg:grid-cols-3">
              {/* Bento 1 — BESAR: Denah Kamar Visual */}
              <article className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:col-span-2 lg:row-span-2">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                  <LayoutGrid className="size-5 text-zinc-800" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="mt-3.5 text-xl font-bold leading-snug sm:text-2xl">
                  Denah Kamar Visual — Cek Kondisi Kost Sekali Lirik
                </h3>
                <p className="mt-2 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg">
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

                <p className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-500 sm:text-base">
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
                <h3 className="mt-3.5 text-xl font-bold leading-snug sm:text-2xl">
                  Tagihan WhatsApp Otomatis — Nagih Sopan Tanpa Bikin Canggung
                </h3>
                <p className="mt-2 text-base leading-relaxed text-slate-600 sm:text-lg">
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
                <h3 className="mt-3.5 text-xl font-bold leading-snug sm:text-2xl">
                  Satu Akun untuk Semua Cabang Properti
                </h3>
                <p className="mt-2 text-base leading-relaxed text-slate-600 sm:text-lg">
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
                <h3 className="mt-3.5 text-xl font-bold leading-snug sm:text-2xl">
                  Buku Kas &amp; Catatan Pengeluaran
                </h3>
                <p className="mt-2 text-base leading-relaxed text-slate-600 sm:text-lg">
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
                <h3 className="mt-3.5 text-xl font-bold leading-snug sm:text-2xl">
                  Portal Khusus Penghuni
                </h3>
                <p className="mt-2 text-base leading-relaxed text-slate-600 sm:text-lg">
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

              {/* Bento 5b — Cadangan & Keamanan Data (Data Milik Anda 100%) */}
              <article className="flex flex-col rounded-xl border border-emerald-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                  <ShieldCheck className="size-5 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="mt-3.5 text-xl font-bold leading-snug sm:text-2xl">
                  Data Milik Anda 100%
                </h3>
                <p className="mt-2 text-base leading-relaxed text-slate-600 sm:text-lg">
                  🛡️ Ekspor rekap ke Excel kapan saja &amp; backup sistem anti-hilang dalam satu
                  klik.
                </p>
                <div className="mt-4 space-y-1.5 rounded-lg border border-zinc-100 bg-[#f8fafc] p-3">
                  <div className="flex items-center gap-2 text-[12.5px] font-medium text-zinc-700">
                    <FileSpreadsheet className="size-3.5 shrink-0 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
                    Rekap Kamar, Penyewa &amp; Kas → Excel / CSV
                  </div>
                  <div className="flex items-center gap-2 text-[12.5px] font-medium text-zinc-700">
                    <DatabaseBackup className="size-3.5 shrink-0 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
                    Backup JSON lengkap + pulihkan kapan pun
                  </div>
                </div>
              </article>

              {/* Bento 6 — Auto-Iklan Sosmed (Fitur Eksklusif, Killer Feature) — full-width penutup grid */}
              <article className="relative flex flex-col overflow-hidden rounded-xl border-2 border-amber-400 bg-white p-5 shadow-[0_8px_24px_rgba(245,158,11,0.10)] lg:col-span-3">
                <span className="mb-3.5 inline-flex items-center self-start rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-950">
                  <Megaphone className="mr-1.5 size-3" strokeWidth={2.25} aria-hidden="true" />
                  Fitur Eksklusif — Bebas Pusing Promosi
                </span>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                  <Megaphone className="size-5 text-amber-700" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="mt-3.5 max-w-lg text-xl font-bold leading-snug sm:text-2xl">
                  Bantu Kamar Cepat Penuh (Auto-Iklan Sosmed)
                </h3>
                <p className="mt-2 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
                  Ada kamar kosong? Gak perlu pusing bikin kata-kata. Klik satu
                  tombol, sistem otomatis buatkan draf iklan menarik siap copas
                  ke Facebook Groups, Marketplace, &amp; Status WhatsApp lengkap
                  dengan link chat Anda.
                </p>

                <div className="mt-5 grid flex-1 content-start gap-3 rounded-lg border border-zinc-100 bg-[#f8fafc] p-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                  <div className="flex flex-col items-start gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-[12.5px] font-bold text-white shadow-sm">
                      <Megaphone className="size-3.5" strokeWidth={2} aria-hidden="true" />
                      Buat Iklan Kamar
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {["Grup Facebook", "Status WA", "Marketplace"].map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg rounded-tl-sm border border-emerald-100 bg-emerald-50 p-3">
                    <p className="text-[12.5px] leading-relaxed text-zinc-700">
                      📢 KAMAR KOSONG — KOST GRIYA PRATAMA 📢 … Harga sewa{" "}
                      <span className="font-semibold tabular-nums">Rp1.500.000</span>/bulan ·{" "}
                      ✅ AC ✅ Kamar Mandi Dalam ✅ Lemari …{" "}
                      <span className="font-semibold text-emerald-700">👉 wa.me/62812xxxx</span>
                    </p>
                    <p className="mt-2 text-[12.5px] font-medium text-emerald-700">
                      ✓ Siap copas ke sosmed — link chat otomatis nempel di iklan
                    </p>
                  </div>
                </div>
              </article>

              {/* Kartu CTA menutup grid — konversi tanpa jeda */}
              <article className="flex flex-col justify-between rounded-xl bg-zinc-900 p-5 text-white">
                <div>
                  <h3 className="text-xl font-bold leading-snug sm:text-2xl">
                    Siap jadi juragan yang tenang?
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-zinc-300 sm:text-lg">
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

        {/* ── 3b. Perbandingan visual: Cara Lama vs UnitKu ─────────────── */}
        <section id="perbandingan" className="scroll-mt-16">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-18">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
                Cara Lama vs UnitKu
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
                Bedanya nyata di sehari-hari: dari buku tulis coret-coret dan
                chat menagih yang canggung, jadi tagihan &amp; kwitansi resmi
                yang terkirim otomatis via WhatsApp.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {/* ── Kiri: buku tulis coret-coret + chat manual canggung ── */}
              <article className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                    <Notebook className="size-5 text-zinc-500" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3 className="text-lg font-bold leading-snug sm:text-xl">
                    Cara Lama{" "}
                    <span className="font-medium text-zinc-500">(buku tulis &amp; chat manual)</span>
                  </h3>
                </div>

                {/* Foto riil buku catatan manual */}
                <figure className="mt-4">
                  <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50 shadow-[0_2px_10px_rgba(15,23,42,0.07)]">
                    <Image
                      src="/images/cara-lama.jpg"
                      alt="Catatan sewa manual di buku tulis"
                      width={932}
                      height={1280}
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 576px"
                      className="h-48 w-full object-cover object-top sm:h-56"
                    />
                  </div>
                  <figcaption className="mt-2 text-[11.5px] italic leading-snug text-zinc-500">
                    Catatan manual di buku tulis: mudah keselip, coret-coretan,
                    dan rawan hilang.
                  </figcaption>
                </figure>

                {/* Mock chat menagih canggung */}
                <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-zinc-100 bg-white px-3 py-2 shadow-sm">
                    <p className="text-[12.5px] leading-relaxed text-zinc-700">
                      Pak, maaf nanya… bulan lalu udah bayar belum ya? Lupa 🙏
                    </p>
                    <p className="mt-1 text-right text-[10.5px] text-zinc-400">
                      21.14 ✓✓ Dibaca
                    </p>
                  </div>
                  <p className="mt-2 text-[11.5px] italic text-zinc-400">
                    Belum dibalas 3 hari — malu nanya lagi…
                  </p>
                </div>

                <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
                  {[
                    "Catatan gampang keselip, kotor, dan hilang.",
                    "Menagih lewat chat terasa canggung & tak enak.",
                    "Cek transfer masuk manual satu-satu.",
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-slate-600">
                      <XCircle className="mt-0.5 size-4 shrink-0 text-rose-500" strokeWidth={1.75} aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>

              {/* ── Kanan: invoice & kwitansi rapi UnitKu di WhatsApp ── */}
              <article className="flex flex-col rounded-xl border-2 border-emerald-600 bg-white p-5 shadow-[0_8px_24px_rgba(5,150,105,0.10)]">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600">
                    <Receipt className="size-5 text-white" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3 className="text-lg font-bold leading-snug sm:text-xl">
                    Pakai UnitKu{" "}
                    <span className="font-medium text-emerald-700">(tagihan &amp; kwitansi otomatis)</span>
                  </h3>
                </div>

                {/* Mock WhatsApp UnitKu */}
                <div className="mt-4 overflow-hidden rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-2.5 bg-emerald-700 px-3.5 py-2.5 text-white">
                    <Image
                      src="/brand/icon.png"
                      alt=""
                      width={28}
                      height={28}
                      className="size-7 shrink-0 rounded-full object-contain"
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-bold leading-tight">
                        UnitKu · Kost Griya Pratama
                      </span>
                      <span className="block text-[10.5px] leading-tight text-emerald-100">online</span>
                    </span>
                  </div>

                  <div className="space-y-2.5 bg-[#eef6f1] p-3">
                    {/* Bubble tagihan rapi */}
                    <div className="max-w-[95%] rounded-2xl rounded-tl-sm bg-white p-3 shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                        Tagihan Sewa — Sep 2026
                      </p>
                      <dl className="mt-1.5 space-y-1 text-[12.5px] leading-snug">
                        <div className="flex justify-between gap-3">
                          <dt className="text-zinc-500">Kamar</dt>
                          <dd className="font-semibold">101 · Budi Santoso</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-zinc-500">Jatuh tempo</dt>
                          <dd className="font-semibold">28 Sep 2026</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-zinc-500">Total</dt>
                          <dd className="font-bold tabular-nums">Rp1.500.000</dd>
                        </div>
                      </dl>
                      <p className="mt-2 border-t border-zinc-100 pt-1.5 text-[11px] leading-snug text-zinc-500">
                        Bayar ke BCA 1234567890 a/n Hendra Wijaya
                      </p>
                      <p className="mt-1 text-right text-[10.5px] text-emerald-600">
                        ✓✓ Terkirim otomatis · 09.00
                      </p>
                    </div>

                    {/* Bubble kwitansi lunas */}
                    <div className="max-w-[95%] rounded-2xl rounded-tl-sm bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                          Kwitansi Lunas
                        </p>
                        <span className="rounded border-2 border-emerald-600 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                          LUNAS
                        </span>
                      </div>
                      <p className="mt-1.5 text-[12.5px] leading-snug text-zinc-700">
                        Sudah diterima{" "}
                        <span className="font-bold tabular-nums">Rp1.500.000</span> dari Budi
                        Santoso (Kamar 101) — 28 Sep 2026.
                      </p>
                      <p className="mt-1 text-right text-[10.5px] text-emerald-600">
                        ✓✓ Terkirim otomatis · 19.02
                      </p>
                    </div>
                  </div>
                </div>

                <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
                  {[
                    "Tagihan & kwitansi resmi terkirim otomatis via WhatsApp.",
                    "Penyewa pegang bukti resmi — nggak ada debat “udah bayar, kok”.",
                    "Riwayat pembayaran rapi tersimpan di sistem.",
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-slate-700">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* ── 3c. Testimoni juragan ─────────────────────────────────────── */}
        <section id="testimoni" className="scroll-mt-16 border-y border-zinc-100 bg-[#f8fafc]">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-18">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
                Pengalaman Nyata Juragan Kost &amp; Kontrakan
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
                Dari catatan buku folio ke denah kamar di HP — ini kata mereka
                yang udah merasakan bedanya.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <figure
                  key={t.name}
                  className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                >
                  <div
                    className="flex items-center gap-0.5"
                    role="img"
                    aria-label="Rating 5 dari 5 bintang"
                  >
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                    ))}
                  </div>
                  <blockquote className="mt-3 flex-1 text-[13.5px] leading-relaxed text-zinc-700 sm:text-[14.5px]">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-3 border-t border-zinc-100 pt-3.5">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${t.tone}`}
                      aria-hidden="true"
                    >
                      {t.initial}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-bold leading-tight text-zinc-900">
                        {t.name}
                      </span>
                      <span className="block text-[12px] leading-tight text-zinc-500">{t.role}</span>
                    </span>
                  </figcaption>
                </figure>
              ))}

              {/* Tile CTA menutup grid — konversi tanpa jeda */}
              <article className="flex h-full flex-col justify-between rounded-xl bg-zinc-900 p-5 text-white">
                <div>
                  <h3 className="text-lg font-bold leading-snug sm:text-xl">
                    Giliran Anda yang tenang.
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-300 sm:text-[14.5px]">
                    Sekali bayar {LICENSE_PRICE_LABEL}, tanpa langganan bulanan —
                    besok pagi tagihan WhatsApp pertama Anda bisa langsung
                    terkirim.
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
                  <p className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-amber-900">
                    Penawaran Terbatas — Juragan Early Adopter
                  </p>

                  <div className="mt-5 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
                    <span className="text-2xl font-medium text-zinc-400 line-through tabular-nums sm:text-3xl">
                      {OLD_PRICE_LABEL}
                    </span>
                    <span className="text-4xl font-black tracking-tight tabular-nums sm:text-6xl">
                      {LICENSE_PRICE_LABEL}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800 tabular-nums">
                      Hemat Rp400.000
                    </span>
                  </div>

                  <p className="mt-3 text-base font-semibold text-zinc-700 sm:text-lg">
                    Sekali Bayar — Bebas Pakai Seumur Hidup
                    <span className="block text-sm font-medium text-zinc-500 sm:text-base">
                      (Tanpa Biaya Bulanan / Potongan Sewa)
                    </span>
                  </p>

                  <p className="mx-auto mt-4 max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-4 text-base leading-relaxed text-amber-900 sm:text-lg">
                    Cuma 399 ribu sekali bayar. Nilainya bahkan lebih murah dari
                    harga sewa 1 kamar sebulan, tapi bikin tenang ngurus properti
                    Anda bertahun-tahun.
                  </p>
                </div>

                <ul className="mt-6 space-y-2.5 border-t border-zinc-100 pt-6">
                  {OFFER_BENEFITS.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2.5 text-base leading-relaxed text-zinc-700 sm:text-lg">
                      <CheckCircle2 className="mt-1 size-5 shrink-0 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
                      {benefit}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 border-t border-zinc-100 pt-6">
                  <BuyCta
                    className="w-full"
                    label={`Amankan Lisensi UnitKu Sekarang — ${LICENSE_PRICE_LABEL}`}
                  />
                  <p className="mt-3 text-center text-sm text-zinc-500">
                    Pembayaran aman via Mayar · Aktivasi otomatis setelah
                    pembayaran terverifikasi · Garansi uang kembali 7 hari
                  </p>
                  <ul className="mt-4 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <li className="inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-center text-[12.5px] font-semibold leading-snug text-emerald-800">
                      <span aria-hidden="true">🛡️</span> Garansi 7 Hari Uang
                      Kembali Tanpa Ribet
                    </li>
                    <li className="inline-flex items-center justify-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-center text-[12.5px] font-semibold leading-snug text-zinc-700">
                      <span aria-hidden="true">💬</span> Support WhatsApp Siap
                      Bantu — Fast response langsung dari tim pengembang
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. Tanya Jawab (FAQ) ─────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-16 border-t border-zinc-100 bg-[#f8fafc]">
          <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 sm:py-18">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
                Tanya Jawab yang Sering Ditanyakan Juragan
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
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
                  <AccordionTrigger className="py-5 text-left text-lg font-semibold hover:no-underline sm:text-xl">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-base leading-relaxed text-slate-600 sm:text-lg">
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
            <h2 className="mx-auto max-w-2xl text-balance text-2xl font-bold tracking-tight sm:text-4xl">
              Waktunya Kelola Kost &amp; Kontrakan Lebih Tenang Tanpa Beban
              Pikiran.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg">
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
                className="inline-flex h-14 w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-8 py-4 text-base font-bold text-white transition-colors hover:bg-zinc-800 sm:w-auto sm:text-lg"
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
      className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-bold text-white transition-colors hover:bg-zinc-800"
    >
      {children}
    </Link>
  );
}
