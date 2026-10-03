import type { MetadataRoute } from "next";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Web App Manifest (Next.js Metadata API)
// Dilayani otomatis di /manifest.webmanifest + <link rel="manifest"> di <head>.
// ─────────────────────────────────────────────────────────────────────────────
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "UnitKu - Manajemen Properti & Kost",
    short_name: "UnitKu",
    description: "Kelola Kost, Kontrakan & Unit Sewa Tanpa Ribet",
    // PWA dipasang oleh owner — buka langsung ke dashboard (bukan landing publik)
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    lang: "id",
    dir: "ltr",
    categories: ["business", "productivity"],
    // Aset splash PWA: Android/Chrome merender splash screen dari ikon manifest
    // + background_color — ikon "any" memakai LOGO LENGKAP (rumah + tulisan
    // UnitKu) agar layar pembuka selalu menampilkan brand, bukan rumah saja.
    // Query ?v=2 = cache-busting: URL ikon berubah → WebAPK/splash terpasang
    // ikut memperbarui ke aset terbaru tanpa perlu lepas-pasang shortcut.
    icons: [
      { src: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
