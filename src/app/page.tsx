// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Landing Page Komersial (publik, rute "/")
//
// Tujuan ganda: (1) memenuhi verifikasi KYC Mayar — informasi produk, harga,
// legalitas, dan kontak jelas; (2) mengonversi pengunjung menjadi pembeli
// lisensi seumur hidup. Dashboard owner pindah ke /dashboard.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import {
  Calculator,
  Camera,
  CheckCircle2,
  CreditCard,
  FileText,
  KeyRound,
  LayoutDashboard,
  QrCode,
  Zap,
} from "lucide-react";

import { getAuthUser } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { BuyCta } from "@/components/landing/buy-cta";
import { SiteFooter } from "@/components/landing/site-footer";
import {
  BRAND,
  LICENSE_PRICE_LABEL,
} from "@/lib/landing-config";

export const metadata: Metadata = {
  title: "UnitKu — Kelola Kost & Kontrakan Bebas Pusing | Elvindigital",
  description:
    "Platform manajemen kost lengkap: generator tagihan bulanan otomatis, tagih via WhatsApp sekali klik, dukung QRIS statis, dan buku kas laba bersih. Lisensi seumur hidup — sekali bayar.",
};

const FEATURES = [
  {
    icon: FileText,
    title: "Generator Invoice & Tagih WhatsApp",
    description:
      "Tagihan bulanan seluruh kamar dibuat sekali klik — lengkap dengan kwitansi digital.",
    bullets: ["Invoice massal per periode sewa", "Tombol tagih wa.me sekali klik"],
  },
  {
    icon: QrCode,
    title: "Rekening Mandiri & QRIS Statis",
    description:
      "Penyewa melihat rekening bank & QRIS milik Anda langsung di portal kwitansi — pembayaran jelas arahannya.",
    bullets: ["Rekening & QRIS tampil di portal penyewa", "Merchant/NMID ikut tercantum"],
  },
  {
    icon: Calculator,
    title: "Buku Kas & Laba Bersih Otomatis",
    description:
      "Pemasukan dan pengeluaran tercatat rapi, laba bersih properti dihitung otomatis.",
    bullets: ["Kategori masuk/keluar + bukti nota", "Ringkasan laba bersih real-time"],
  },
  {
    icon: Camera,
    title: "Portal Komplain dengan Foto Kamera",
    description:
      "Penyewa melaporkan kerusakan fasilitas langsung dari HP beserta foto — tiket masuk otomatis ke dashboard Anda.",
    bullets: ["Lapor via kamera HP, tanpa aplikasi", "Status tiket & penugasan teknisi"],
  },
  {
    icon: KeyRound,
    title: "Portal Staf berbasis PIN 6 Digit",
    description:
      "Berikan akses penjaga/teknisi lewat tautan undangan + PIN — tanpa membuka laporan saldo kas.",
    bullets: ["Akses terbatas sesuai peran", "Laporan kas tetap privat"],
  },
] as const;

const TRUST_ITEMS = [
  "Aktivasi otomatis setelah pembayaran",
  "Data terisolasi per pemilik properti",
  "Pasang di HP — dukungan PWA",
] as const;

const STEPS = [
  {
    icon: CreditCard,
    title: "Bayar Sekali",
    description: "Selesaikan pembayaran lisensi di checkout Mayar yang aman.",
  },
  {
    icon: Zap,
    title: "Aktif Otomatis",
    description: "Akun & lisensi seumur hidup terbuka otomatis via webhook — tanpa menunggu.",
  },
  {
    icon: LayoutDashboard,
    title: "Langsung Kelola",
    description: "Masuk, lengkapi profil properti, dan mulai kelola kamar Anda.",
  },
] as const;

const PRICE_POINTS = [
  "Tanpa biaya langganan bulanan — selamanya",
  "Bebas tambah unit/kamar sesuai kebutuhan",
  "Update fitur baru gratis",
  "Dukungan PWA — pasang seperti aplikasi di HP",
  "Generator tagihan, buku kas, portal penyewa & staf terbuka semua",
  "Garansi pengembalian dana 7 hari",
] as const;

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
              Fitur
            </a>
            <a href="#harga" className="text-[12.5px] font-medium text-zinc-600 hover:text-zinc-900">
              Harga
            </a>
            <a href="#aktivasi" className="text-[12.5px] font-medium text-zinc-600 hover:text-zinc-900">
              Cara Aktivasi
            </a>
          </nav>

          <Button asChild className="h-9 px-4 text-[12.5px] font-semibold">
            <Link href={authHref}>{authLabel}</Link>
          </Button>
        </div>
      </header>

      <div className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="border-b border-zinc-100 bg-[#f8fafc]">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-20">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {BRAND.vendor} presents {BRAND.product}
            </p>

            <p className="mx-auto mt-4 inline-flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-[12.5px] font-medium leading-snug text-amber-900">
              🎉 Lisensi Seumur Hidup — Sekali Bayar, Miliki Selamanya Tanpa
              Biaya Bulanan
            </p>

            <h1 className="mx-auto mt-5 max-w-3xl text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[42px]">
              Kelola Kost &amp; Kontrakan Bebas Pusing, Pembukuan dan Tagihan
              Beres Otomatis.
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-pretty text-[13px] leading-relaxed text-zinc-600 sm:text-[14.5px]">
              Platform manajemen kost lengkap: generator tagihan bulanan
              otomatis, tagih via WhatsApp sekali klik, dukung QRIS statis, dan
              buku kas laba bersih.
            </p>

            <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <BuyCta className="w-full sm:w-auto" />
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 w-full border-zinc-300 bg-white text-[13px] font-semibold hover:bg-zinc-50 sm:w-auto"
              >
                <a href="#fitur">Lihat Fitur</a>
              </Button>
            </div>

            <ul className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-center gap-x-6 gap-y-2 sm:flex-row sm:flex-wrap">
              {TRUST_ITEMS.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-600"
                >
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Fitur Unggulan ──────────────────────────────────────────────── */}
        <section id="fitur" className="scroll-mt-16">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-18">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight sm:text-[28px]">
                Fitur Unggulan
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-600 sm:text-[14.5px]">
                Semua yang dibutuhkan pengelola kost dan kontrakan — dari
                tagihan sampai kas — dalam satu aplikasi yang bisa dipakai dari
                HP maupun komputer.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <article
                  key={feature.title}
                  className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                    <feature.icon className="size-5 text-zinc-800" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3 className="mt-3.5 text-[15px] font-semibold leading-snug">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">
                    {feature.description}
                  </p>
                  <ul className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3">
                    {feature.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-1.5 text-[12.5px] leading-snug text-zinc-600"
                      >
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}

              {/* Kartu CTA menutup grid — konversi tanpa jeda */}
              <article className="flex flex-col justify-between rounded-xl bg-zinc-900 p-5 text-white">
                <div>
                  <h3 className="text-[15px] font-semibold leading-snug">
                    Siap berhenti ribet urusan tagihan &amp; pembukuan?
                  </h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-300">
                    Lisensi penuh seumur hidup — sekali bayar,{" "}
                    <span className="font-semibold tabular-nums text-white">
                      {LICENSE_PRICE_LABEL}
                    </span>
                    , tanpa biaya bulanan.
                  </p>
                </div>
                <BuyCta inverted className="mt-5 w-full" />
              </article>
            </div>
          </div>
        </section>

        {/* ── Cara Aktivasi ───────────────────────────────────────────────── */}
        <section id="aktivasi" className="scroll-mt-16 border-y border-zinc-100 bg-[#f8fafc]">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-[28px]">
              Cara Aktivasi — Otomatis, Tanpa Menunggu
            </h2>
            <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-xl border border-zinc-200 bg-white p-5 text-center"
                >
                  <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-zinc-900 text-white">
                    <step.icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-[12.5px] font-semibold uppercase tracking-wide text-zinc-400 tabular-nums">
                    Langkah {index + 1}
                  </p>
                  <h3 className="mt-1 text-[15px] font-semibold">{step.title}</h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-600">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Harga ───────────────────────────────────────────────────────── */}
        <section id="harga" className="scroll-mt-16">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-18">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-[28px]">
                Harga — Sekali Bayar, Selamanya
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-600 sm:text-[14.5px]">
                Tidak ada langganan. Tidak ada biaya tersembunyi. Satu
                pembayaran untuk seluruh fitur, selamanya.
              </p>
            </div>

            <div className="mx-auto mt-8 max-w-md">
              <div className="rounded-2xl border-2 border-zinc-900 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[15px] font-semibold leading-snug">
                    Lisensi Penuh Seumur Hidup
                  </h3>
                  <span className="shrink-0 rounded-full bg-zinc-900 px-2.5 py-1 text-[12.5px] font-semibold text-white">
                    Lifetime
                  </span>
                </div>

                <p className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight tabular-nums">
                    {LICENSE_PRICE_LABEL}
                  </span>
                  <span className="text-[12.5px] font-medium text-zinc-500">
                    sekali bayar
                  </span>
                </p>

                <ul className="mt-5 space-y-2.5 border-t border-zinc-100 pt-5">
                  {PRICE_POINTS.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-[12.5px] leading-snug text-zinc-600">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>

                <BuyCta className="mt-6 w-full" />

                <p className="mt-3 text-center text-[12.5px] text-zinc-500">
                  Pembayaran diproses aman oleh Mayar · Aktivasi otomatis setelah
                  pembayaran terverifikasi
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Footer legalitas (KYC) ────────────────────────────────────────── */}
      <SiteFooter />
    </main>
  );
}
