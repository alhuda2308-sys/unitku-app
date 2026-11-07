// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Blog Listing: /blog (Server Component, publik & SEO)
//
// • Sumber data: tabel Supabase `articles` (is_published = true, terbaru dulu)
//   via listPublishedArticles() — fail-open: DB kosong/gagal → tampil
//   empty state yang ramah, halaman tetap hidup utk Googlebot.
// • Kartu responsif (judul, tanggal rilis, ringkasan, tombol baca → /blog/[slug])
// • CTA akhir mengarahkan pembaca ke demo & landing UnitKu.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Newspaper, Sparkles } from "lucide-react";

import { SiteFooter } from "@/components/landing/site-footer";
import { listPublishedArticles } from "@/lib/blog-articles";
import { SITE_URL } from "@/lib/landing-config";

// Revalidasi ISR 10 menit — artikel baru dari cron harian muncul tanpa deploy.
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Blog UnitKu — Tips Mengelola Kost, Kontrakan & Unit Sewa",
  description:
    "Kumpulan panduan & tips praktis mengelola bisnis kost: pembukuan arus kas, penagihan sewa via WhatsApp, denah kamar, perawatan fasilitas, dan strategi okupansi penuh.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: "Blog UnitKu — Tips Mengelola Kost, Kontrakan & Unit Sewa",
    description:
      "Panduan praktis mengelola bisnis kost & kontrakan: pembukuan, penagihan, denah kamar, dan perawatan fasilitas.",
    url: `${SITE_URL}/blog`,
    type: "website",
  },
};

/** "5 November 2026" — zona WIB, aman SSR/CSR identik (hanya dirender server) */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export default async function BlogListingPage() {
  const articles = await listPublishedArticles();

  return (
    <main className="flex min-h-dvh flex-col bg-[#f8fafc] text-zinc-900">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="UnitKu — beranda">
            <Image
              src="/brand/icon.png"
              alt="Logo UnitKu"
              width={36}
              height={36}
              className="size-9 shrink-0 rounded-xl object-contain ring-1 ring-zinc-200"
            />
            <span className="min-w-0">
              <span className="block text-[15px] font-bold leading-tight">UnitKu</span>
              <span className="block text-[12.5px] leading-tight text-zinc-500">by Elvindigital</span>
            </span>
          </Link>
          <nav aria-label="Navigasi blog" className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Beranda
            </Link>
            <Link
              href="/demo"
              className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Coba Demo Gratis
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex-1">
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="border-b border-zinc-100 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-10 text-center sm:px-6 sm:py-14">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-[#f8fafc] px-4 py-1.5 text-[13px] font-semibold text-zinc-700">
              <BookOpen className="size-4 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
              Blog UnitKu
            </p>
            <h1 className="mx-auto mt-4 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
              Tips &amp; Panduan Mengelola Kost, Kontrakan &amp; Unit Sewa
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-[14px] leading-relaxed text-zinc-600 sm:text-[15px]">
              Artikel praktis tiap hari: pembukuan arus kas, penagihan sewa yang sopan tapi
              tepat waktu, denah kamar digital, hingga perawatan fasilitas — langsung dari
              pengalaman pengelola properti sewa Indonesia.
            </p>
          </div>
        </section>

        {/* ── Grid artikel ──────────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          {articles.length === 0 ? (
            /* Empty state — DB belum diisi (tabel/seed/cron belum jalan) */
            <div className="mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-zinc-100">
                <Newspaper className="size-6 text-zinc-500" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-lg font-bold">Artikel Sedang Dalam Persiapan</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-600">
                Blog UnitKu baru saja diluncurkan — artikel panduan pengelolaan kost akan
                terbit rutin setiap hari. Sementara menunggu, jelajahi dulu fitur UnitKu
                lewat demo interaktif gratis berikut.
              </p>
              <Link
                href="/demo"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Coba Demo Interaktif Gratis
                <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <article
                  key={article.slug}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-1 flex-col p-5">
                    <time
                      dateTime={article.created_at}
                      className="text-[12px] font-medium uppercase tracking-wide text-zinc-400"
                    >
                      {formatDate(article.created_at)}
                    </time>
                    <h2 className="mt-2 text-[15.5px] font-bold leading-snug text-zinc-900">
                      <Link
                        href={`/blog/${article.slug}`}
                        className="after:absolute after:inset-0 hover:text-emerald-700"
                      >
                        {article.title}
                      </Link>
                    </h2>
                    <p className="mt-2 line-clamp-3 flex-1 text-[13px] leading-relaxed text-zinc-600">
                      {article.meta_description}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
                      Baca Artikel
                      <ArrowRight
                        className="size-4 transition-transform group-hover:translate-x-0.5"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ── CTA akhir → landing UnitKu ────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 p-6 sm:p-8">
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <p className="inline-flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wide text-emerald-700">
                  <Sparkles className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  Praktikkan Langsung
                </p>
                <h2 className="mt-2 text-lg font-bold leading-snug sm:text-xl">
                  Capek Catat Manual? Kelola Kost dari HP dengan UnitKu
                </h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-600">
                  Denah kamar visual, tagihan &amp; invoice otomatis, buku kas rapi, dan
                  pengingat WhatsApp — semua fitur yang dibahas di artikel ini sudah
                  tergabung dalam satu aplikasi. Sekali bayar, milik selamanya.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
                <Link
                  href="/demo"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  Coba Demo Gratis
                </Link>
                <Link
                  href="/#fitur"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50"
                >
                  Lihat Fitur Lengkap
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer situs — mt-auto menjaga footer menempel bawah saat konten pendek */}
      <SiteFooter />
    </main>
  );
}
