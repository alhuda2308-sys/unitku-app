// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sitemap dinamis Next.js (Metadata Route: /sitemap.xml)
//
// Otomatis tersaji di https://unitku.my.id/sitemap.xml oleh App Router.
// HANYA halaman PUBLIK yang indeksable:
//   / (landing) · /blog + /blog/[slug] (artikel otomatis dari Supabase)
//   · /demo (trial satu klik) · /checkout (iklan) · /legal/* · /login · /register.
// Artikel blog diambil dari tabel `articles` (listPublishedArticleSlugs) —
// fail-open: DB tak tersedia → sitemap tetap memuat halaman statis.
// Revalidasi tiap jam supaya artikel baru hasil cron harian cepat terindeks.
// RUTE PRIVAT SENGJA DIKECUALIKAN: /dashboard, /admin, /staff, /onboarding,
// /portal (token penyewa), /payment, /api/* — dibatasi via robots.ts dan/atau
// sifatnya personal per sesi (tak ada nilai indeks).
// Domain kanonik tetap SITE_URL di semua deployment (termasuk preview).
// ─────────────────────────────────────────────────────────────────────────────

import type { MetadataRoute } from "next";

import { listPublishedArticleSlugs } from "@/lib/blog-articles";
import { LEGAL_DOCS } from "@/lib/legal-content";
import { SITE_URL } from "@/lib/landing-config";

// Sitemap diperbarui maksimal 1 jam sekali (ISR) — mengejar artikel harian
// tanpa menekan database pada tiap request.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  // Slug artikel dari Supabase — [] bila DB gagal (fail-open)
  const articles = await listPublishedArticleSlugs();

  return [
    // Homepage — landing komersial (fitur, harga, legalitas — KYC Mayar)
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    // Blog listing + seluruh artikel SEO otomatis (changeFrequency weekly
    // sesuai spesifikasi cron artikel harian)
    {
      url: `${SITE_URL}/blog`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...articles.map((article) => ({
      url: `${SITE_URL}/blog/${article.slug}`,
      lastModified: new Date(article.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    // Demo instan tanpa registrasi — pintu utama trial produk
    {
      url: `${SITE_URL}/demo`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    // Checkout khusus iklan (Facebook Ads) — halaman konversi publik
    {
      url: `${SITE_URL}/checkout`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    // Halaman legalitas publik (statik — syarat-ketentuan, kebijakan-privasi,
    // kebijakan-refund) — turut dipakai peninjauan KYC Mayar
    ...LEGAL_DOCS.map((doc) => ({
      url: `${SITE_URL}/legal/${doc.slug}`,
      lastModified,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
    // Halaman auth publik
    {
      url: `${SITE_URL}/login`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/register`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
