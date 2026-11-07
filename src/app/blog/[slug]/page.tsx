// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Detail Artikel Blog: /blog/[slug] (Server Component, publik & SEO)
//
// • Data: tabel Supabase `articles` by slug (is_published = true) — tidak ada
//   → notFound() (404 resmi).
// • generateMetadata: title + meta_description + Open Graph dinamis utk
//   Google indexing (canonical tetap domain produksi unitku.my.id).
// • Konten Markdown dirender react-markdown (sudah ada di dependencies)
//   dgn tipografi nyaman dibaca via pemetaan komponen (tanpa plugin prose).
// • JSON-LD BlogPosting + BreadcrumbList — peluang rich result Google.
// • Card CTA di bawah artikel → demo & landing https://unitku.my.id.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import Markdown from "react-markdown";

import { SiteFooter } from "@/components/landing/site-footer";
import { getPublishedArticleBySlug } from "@/lib/blog-articles";
import { SITE_URL } from "@/lib/landing-config";

// ISR 10 menit — artikel baru dari cron harian tampil tanpa deploy.
export const revalidate = 600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function fetchArticle(slug: string) {
  return getPublishedArticleBySlug(slug);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticle(slug);
  if (!article) return { title: "Artikel tidak ditemukan — UnitKu" };

  const canonical = `${SITE_URL}/blog/${article.slug}`;
  return {
    title: `${article.title} — Blog UnitKu`,
    description: article.meta_description,
    alternates: { canonical },
    openGraph: {
      title: article.title,
      description: article.meta_description,
      url: canonical,
      type: "article",
      publishedTime: article.created_at,
    },
  };
}

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

/** Tautan eksternal di konten dibuka di tab baru (aman & SEO-friendly) */
function isExternal(href?: string): boolean {
  return !!href && /^(https?:)?\/\//.test(href) && !href.includes("unitku.my.id");
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await fetchArticle(slug);
  if (!article) notFound();

  const canonical = `${SITE_URL}/blog/${article.slug}`;

  // JSON-LD: BlogPosting + BreadcrumbList — dibaca Google utk rich result
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: article.title,
        description: article.meta_description,
        datePublished: article.created_at,
        dateModified: article.created_at,
        mainEntityOfPage: canonical,
        author: { "@type": "Organization", name: "Elvindigital", url: SITE_URL },
        publisher: {
          "@type": "Organization",
          name: "UnitKu — Elvindigital",
          url: SITE_URL,
          logo: { "@type": "ImageObject", url: `${SITE_URL}/brand/icon.png` },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Beranda", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 3, name: article.title, item: canonical },
        ],
      },
    ],
  };

  return (
    <main className="flex min-h-dvh flex-col bg-[#f8fafc] text-zinc-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
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
          <Link
            href="/demo"
            className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Coba Demo Gratis
          </Link>
        </div>
      </header>

      <div className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Semua Artikel
          </Link>

          {/* ── Header artikel ─────────────────────────────────────────────── */}
          <header className="mt-5 border-b border-zinc-200 pb-6">
            <time
              dateTime={article.created_at}
              className="text-[12px] font-medium uppercase tracking-wide text-zinc-400"
            >
              {formatDate(article.created_at)}
            </time>
            <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              {article.title}
            </h1>
            <p className="mt-3 text-[14.5px] leading-relaxed text-zinc-600">
              {article.meta_description}
            </p>
          </header>

          {/* ── Konten Markdown ────────────────────────────────────────────── */}
          <div className="mt-6">
            <Markdown
              components={{
                h2: ({ children }) => (
                  <h2 className="mt-8 text-[18px] font-bold tracking-tight text-zinc-900 sm:text-xl">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mt-6 text-[15.5px] font-bold text-zinc-900">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="mt-3 text-[14px] leading-[1.85] text-zinc-700 sm:text-[14.5px]">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="mt-3 space-y-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="mt-3 list-decimal space-y-2 pl-5">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="flex gap-2 text-[14px] leading-[1.8] text-zinc-700 sm:text-[14.5px]">
                    <span
                      aria-hidden="true"
                      className="mt-[9px] size-1.5 shrink-0 rounded-full bg-emerald-500"
                    />
                    <span>{children}</span>
                  </li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-zinc-900">{children}</strong>
                ),
                em: ({ children }) => <em className="italic">{children}</em>,
                blockquote: ({ children }) => (
                  <blockquote className="mt-4 rounded-r-lg border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-[13.5px] leading-relaxed text-zinc-700">
                    {children}
                  </blockquote>
                ),
                hr: () => <hr className="my-8 border-zinc-200" />,
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target={isExternal(href) ? "_blank" : undefined}
                    rel={isExternal(href) ? "noopener noreferrer nofollow" : undefined}
                    className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {article.content}
            </Markdown>
          </div>

          {/* ── Card CTA → aplikasi UnitKu ─────────────────────────────────── */}
          <aside className="mt-10 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
            <div className="p-6 sm:p-8">
              <p className="inline-flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wide text-emerald-700">
                <Sparkles className="size-4" strokeWidth={1.75} aria-hidden="true" />
                Dari Blog UnitKu
              </p>
              <h2 className="mt-2 text-xl font-bold leading-snug">
                Kelola Kost Anda Seperti di Artikel Ini — Tanpa Ribet
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-600">
                UnitKu menyatukan denah kamar visual, tagihan &amp; invoice otomatis, buku
                kas, dan pengingat WhatsApp dalam satu aplikasi. Sekali bayar Rp399.000,
                milik selamanya — tanpa biaya bulanan.
              </p>
              <ul className="mt-4 space-y-2">
                {[
                  "Denah kamar interaktif — status terisi/jatuh tempo satu layar",
                  "Kuitansi & invoice digital otomatis saat tagihan lunas",
                  "Buku kas pemasukan-pengeluaran & laba bersih rekap otomatis",
                ].map((point) => (
                  <li key={point} className="flex gap-2 text-[13.5px] leading-relaxed text-zinc-700">
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-emerald-600"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                <Link
                  href="/demo"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  Coba Demo Interaktif Gratis
                  <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
                </Link>
                <Link
                  href="/#harga"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50"
                >
                  Lihat Harga Sekali Bayar
                </Link>
              </div>
              <p className="mt-3 text-[12px] text-zinc-500">
                unitku.my.id — aplikasi manajemen kost, kontrakan &amp; unit sewa oleh
                Elvindigital.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
