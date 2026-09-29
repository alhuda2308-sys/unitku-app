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
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    lang: "id",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
