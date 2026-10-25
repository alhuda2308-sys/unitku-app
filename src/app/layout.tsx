import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { MetaPixel } from "@/components/meta-pixel";
import { SITE_URL } from "@/lib/landing-config";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Domain kanonik absolut — anchor utk canonical (alternates), OG image &
  // metadata URL lain agar selalu resolve ke https://unitku.my.id
  metadataBase: new URL(SITE_URL),
  title: "UnitKu — Kelola Kost, Kontrakan & Unit Sewa Tanpa Ribet",
  description:
    "Kelola kost, kontrakan & unit sewa tanpa ribet: denah kamar, tagihan & invoice, data penghuni, buku kas, dan portal penyewa.",
  applicationName: "UnitKu",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "UnitKu",
  },
  icons: {
    icon: [
      {
        url: "/brand/icon.png",
        type: "image/png",
        sizes: "512x512",
      },
      {
        url: "/icons/icon-192.png",
        type: "image/png",
        sizes: "192x192",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${jakarta.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        {/* Meta Pixel situs-lebar — PageView otomatis di semua halaman */}
        <MetaPixel />
        {children}
        <Toaster position="bottom-right" theme="light" richColors />
        {/* Vercel Web Analytics — hanya aktif di deployment Vercel (produksi/preview),
            data terlihat di dashboard Vercel → tab Analytics */}
        <Analytics />
      </body>
    </html>
  );
}
