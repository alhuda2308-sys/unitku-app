import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

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
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%2318181b'/><text y='68' x='50' text-anchor='middle' font-size='56' font-family='sans-serif' font-weight='700' fill='white'>U</text></svg>",
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
        {children}
        <Toaster position="bottom-right" theme="light" richColors />
      </body>
    </html>
  );
}
