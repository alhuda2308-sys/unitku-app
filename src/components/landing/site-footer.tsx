// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Footer situs (landing komersial & halaman legal)
// Legalitas untuk KYC Mayar: copyright, tautan legal, dan kontak Customer Care.
// ─────────────────────────────────────────────────────────────────────────────

import Image from "next/image";
import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";

import { LEGAL_DOCS } from "@/lib/legal-content";
import {
  BRAND,
  COPYRIGHT_LINE,
  SUPPORT_EMAIL,
  SUPPORT_WA_LINK,
} from "@/lib/landing-config";

export function SiteFooter({ variant = "full" }: { variant?: "full" | "slim" }) {
  if (variant === "slim") {
    return (
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 sm:flex-row sm:px-6">
          <p className="text-[12.5px] text-zinc-500">{COPYRIGHT_LINE}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {LEGAL_DOCS.map((doc) => (
              <Link
                key={doc.slug}
                href={`/legal/${doc.slug}`}
                className="text-[12.5px] text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
              >
                {doc.title}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-zinc-200 bg-[#f8fafc]">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/brand/icon.png"
                alt="Logo UnitKu"
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-xl object-contain ring-1 ring-zinc-200"
              />
              <div className="min-w-0">
                <p className="text-[15px] font-bold leading-tight text-zinc-900">
                  {BRAND.product}{" "}
                  <span className="text-[12.5px] font-medium text-zinc-500">
                    by {BRAND.vendor}
                  </span>
                </p>
                <p className="text-[12.5px] leading-tight text-zinc-500">
                  {BRAND.tagline}
                </p>
              </div>
            </div>
            <p className="mt-3 max-w-xs text-[12.5px] leading-relaxed text-zinc-500">
              {BRAND.vendor} presents {BRAND.product} — platform manajemen
              properti sewa sekali bayar, milik selamanya.
            </p>
          </div>

          {/* Produk */}
          <nav aria-label="Tautan produk">
            <p className="text-[12.5px] font-semibold uppercase tracking-wide text-zinc-900">
              Produk
            </p>
            <ul className="mt-3 space-y-2 text-[12.5px]">
              <li>
                <a href="/#fitur" className="text-zinc-600 hover:text-zinc-900">
                  Fitur Unggulan
                </a>
              </li>
              <li>
                <a href="/#harga" className="text-zinc-600 hover:text-zinc-900">
                  Harga — Sekali Bayar
                </a>
              </li>
              <li>
                <Link href="/login" className="text-zinc-600 hover:text-zinc-900">
                  Masuk / Dashboard Owner
                </Link>
              </li>
              <li>
                <Link href="/payment/success" className="text-zinc-600 hover:text-zinc-900">
                  Konfirmasi Pembayaran Sukses
                </Link>
              </li>
            </ul>
          </nav>

          {/* Bantuan & Legal */}
          <nav aria-label="Bantuan dan legalitas">
            <p className="text-[12.5px] font-semibold uppercase tracking-wide text-zinc-900">
              Bantuan &amp; Legal
            </p>
            <ul className="mt-3 space-y-2 text-[12.5px]">
              <li>
                <a
                  href={SUPPORT_WA_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-900"
                >
                  <MessageCircle className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                  Customer Care — WhatsApp
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-900"
                >
                  <Mail className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                  {SUPPORT_EMAIL}
                </a>
              </li>
              {LEGAL_DOCS.map((doc) => (
                <li key={doc.slug}>
                  <Link
                    href={`/legal/${doc.slug}`}
                    className="text-zinc-600 hover:text-zinc-900"
                  >
                    {doc.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Trust badge — garansi & dukungan tim pengembang */}
        <ul className="mt-8 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <li className="inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3.5 py-1.5 text-center text-[12.5px] font-semibold leading-snug text-emerald-800">
            <span aria-hidden="true">🛡️</span> Garansi 7 Hari Uang Kembali Tanpa
            Ribet
          </li>
          <li className="inline-flex items-center justify-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-center text-[12.5px] font-semibold leading-snug text-zinc-700">
            <span aria-hidden="true">💬</span> Support WhatsApp Siap Bantu — Fast
            response langsung dari tim pengembang
          </li>
        </ul>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-zinc-200 pt-5 sm:flex-row">
          <p className="text-[12.5px] text-zinc-500">{COPYRIGHT_LINE}</p>
          <p className="text-[12.5px] text-zinc-500">
            Pembayaran diproses aman oleh{" "}
            <span className="font-medium text-zinc-700">Mayar</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
