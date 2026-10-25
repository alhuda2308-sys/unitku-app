// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sitemap dinamis Next.js (Metadata Route: /sitemap.xml)
//
// Otomatis tersaji di https://unitku.my.id/sitemap.xml oleh App Router.
// HANYA halaman PUBLIK yang indeksable:
//   / (landing) · /demo (trial satu klik) · /checkout (iklan) · /legal/*
//   · /login · /register.
// RUTE PRIVAT SENGJA DIKECUALIKAN: /dashboard, /admin, /staff, /onboarding,
// /portal (token penyewa), /payment, /api/* — dibatasi via robots.ts dan/atau
// sifatnya personal per sesi (tak ada nilai indeks).
// Domain kanonik tetap SITE_URL di semua deployment (termasuk preview).
// ─────────────────────────────────────────────────────────────────────────────

import type { MetadataRoute } from "next";

import { LEGAL_DOCS } from "@/lib/legal-content";
import { SITE_URL } from "@/lib/landing-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    // Homepage — landing komersial (fitur, harga, legalitas — KYC Mayar)
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
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
