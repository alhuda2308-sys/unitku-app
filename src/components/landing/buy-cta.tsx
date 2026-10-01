"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Tombol "Beli Akses Seumur Hidup" (landing)
//
// • NEXT_PUBLIC_MAYAR_CHECKOUT_URL terisi → tautan langsung ke checkout Mayar.
// • Belum terisi → fallback modal pembelian satu pintu via WhatsApp Admin:
//   konfirmasi pemesanan → admin kirim rekening/QRIS → aktivasi manual.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { ExternalLink, MessageCircle } from "lucide-react";

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
        className={`h-auto min-h-14 whitespace-normal px-5 py-3 text-base font-bold leading-snug sm:px-8 sm:py-4 sm:text-lg ${
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
        className={`h-auto min-h-14 whitespace-normal px-5 py-3 text-base font-bold leading-snug sm:px-8 sm:py-4 sm:text-lg ${
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
            <DialogDescription className="text-left text-sm leading-relaxed text-zinc-500">
              Satu kali bayar {LICENSE_PRICE_LABEL} — aktif selamanya tanpa
              biaya bulanan.
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left">
            <li className="flex gap-2.5 text-sm leading-relaxed text-zinc-600">
              <span className="font-semibold tabular-nums text-zinc-900">1.</span>
              <span>
                Klik tombol <span className="font-medium text-zinc-900">WhatsApp</span> di
                bawah untuk konfirmasi pemesanan.
              </span>
            </li>
            <li className="flex gap-2.5 text-sm leading-relaxed text-zinc-600">
              <span className="font-semibold tabular-nums text-zinc-900">2.</span>
              <span>
                Admin akan mengirimkan{" "}
                <span className="font-medium text-zinc-900">
                  nomor rekening / QRIS resmi
                </span>{" "}
                serta nominal transfer Rp 399.000.
              </span>
            </li>
            <li className="flex gap-2.5 text-sm leading-relaxed text-zinc-600">
              <span className="font-semibold tabular-nums text-zinc-900">3.</span>
              <span>
                Kirim <span className="font-medium text-zinc-900">bukti transfer</span>, dan
                akun lisensi UnitKu Anda akan langsung diaktifkan oleh admin.
              </span>
            </li>
          </ol>

          <DialogFooter>
            <Button asChild className="h-12 w-full text-sm font-semibold">
              <a href={SUPPORT_WA_PURCHASE_LINK} target="_blank" rel="noreferrer">
                <MessageCircle strokeWidth={1.75} aria-hidden="true" />
                Chat WhatsApp — Beli Sekarang
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
