"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Tombol "Beli Akses Seumur Hidup" (landing)
//
// • NEXT_PUBLIC_MAYAR_CHECKOUT_URL terisi → tautan langsung ke checkout Mayar.
// • Belum terisi → fallback modal pembelian: panduan singkat + kontak CS
//   (WhatsApp & email) supaya calon pembeli tidak pernah menemui jalan buntu.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { ExternalLink, MessageCircle, Mail, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LICENSE_PRICE_LABEL,
  MAYAR_CHECKOUT_URL,
  SUPPORT_MAILTO,
  SUPPORT_WA_PURCHASE_LINK,
} from "@/lib/landing-config";

interface BuyCtaProps {
  className?: string;
  label?: string;
  inverted?: boolean; // dipakai di kartu gelap (bg-zinc-900) — tombol putih
}

export function BuyCta({
  className = "",
  label = "Beli Akses Seumur Hidup",
  inverted = false,
}: BuyCtaProps) {
  const [open, setOpen] = useState(false);

  // Checkout Mayar aktif → langsung arahkan ke halaman pembayaran
  if (MAYAR_CHECKOUT_URL) {
    return (
      <Button
        asChild
        size="lg"
        className={`h-11 text-[13px] font-semibold ${
          inverted ? "bg-white text-zinc-900 hover:bg-zinc-100" : ""
        } ${className}`}
      >
        <a href={MAYAR_CHECKOUT_URL} target="_blank" rel="noreferrer">
          <ExternalLink strokeWidth={1.75} aria-hidden="true" />
          {label}
        </a>
      </Button>
    );
  }

  return (
    <>
      <Button
        size="lg"
        onClick={() => setOpen(true)}
        className={`h-11 text-[13px] font-semibold ${
          inverted ? "bg-white text-zinc-900 hover:bg-zinc-100" : ""
        } ${className}`}
      >
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-left text-lg font-bold text-zinc-900">
              Beli Lisensi Seumur Hidup
            </DialogTitle>
            <DialogDescription className="text-left text-[12.5px] leading-snug text-zinc-500">
              Satu kali bayar {LICENSE_PRICE_LABEL} — aktif selamanya tanpa
              biaya bulanan.
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left">
            <li className="flex gap-2.5 text-[12.5px] leading-snug text-zinc-600">
              <span className="font-semibold tabular-nums text-zinc-900">1.</span>
              <span>
                Klik tombol <span className="font-medium text-zinc-900">Chat WhatsApp</span> di
                bawah — kirim nama &amp; email yang ingin didaftarkan.
              </span>
            </li>
            <li className="flex gap-2.5 text-[12.5px] leading-snug text-zinc-600">
              <span className="font-semibold tabular-nums text-zinc-900">2.</span>
              <span>
                Tim kami mengirim tautan checkout Mayar yang aman (QRIS / transfer /
                e-wallet).
              </span>
            </li>
            <li className="flex gap-2.5 text-[12.5px] leading-snug text-zinc-600">
              <span className="font-semibold tabular-nums text-zinc-900">3.</span>
              <span>
                Setelah pembayaran terverifikasi, akun &amp; lisensi Anda aktif
                otomatis — tanpa menunggu konfirmasi manual.
              </span>
            </li>
          </ol>

          <p className="flex items-start gap-1.5 text-[12.5px] leading-snug text-zinc-500">
            <ShieldCheck
              className="mt-0.5 size-4 shrink-0 text-emerald-600"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            Pembayaran diproses oleh Mayar. Garansi pengembalian dana 7 hari —
            lihat Kebijakan Pengembalian Dana.
          </p>

          <DialogFooter className="gap-2 sm:flex-col sm:gap-2">
            <Button asChild className="h-10 w-full text-[13px] font-semibold">
              <a href={SUPPORT_WA_PURCHASE_LINK} target="_blank" rel="noreferrer">
                <MessageCircle strokeWidth={1.75} aria-hidden="true" />
                Chat WhatsApp — Beli Sekarang
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-10 w-full text-[13px] font-medium"
            >
              <a href={SUPPORT_MAILTO}>
                <Mail strokeWidth={1.75} aria-hidden="true" />
                Email Customer Care
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
