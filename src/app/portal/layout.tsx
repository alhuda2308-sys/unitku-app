import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal Penyewa — UnitKu",
  description:
    "Tagihan & pembayaran penyewa — akses tanpa login via magic token link. Didukung oleh UnitKu — Kelola Kost, Kontrakan & Unit Sewa Tanpa Ribet.",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
