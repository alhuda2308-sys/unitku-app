// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — robots.txt dinamis Next.js (Metadata Route: /robots.txt)
//
// Otomatis tersaji di https://unitku.my.id/robots.txt oleh App Router.
// Bot diizinkan merayapi halaman publik ("/"); rute privat dibatasi:
//   /dashboard (aplikasi owner — termasuk sesi demo /dashboard?demo=1),
//   /admin (panel admin), /api/* (endpoint data — isolasi 401 di route handler).
//
// Catatan pola: robots.txt mencocokkan PREFIX string — "/dashboard/" saja
// TIDAK memblokir "/dashboard" (tanpa trailing slash), makanya kedua varian
// didaftarkan. /api/ selalu berawalan slash sehingga satu pola cukup.
// ─────────────────────────────────────────────────────────────────────────────

import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/landing-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/dashboard/", "/admin", "/admin/", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
