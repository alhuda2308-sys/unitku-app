"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Modal Pratinjau Kuitansi Digital (menu titik tiga "Lihat Kwitansi")
//
// • Layar: kuitansi bergaya kertas resmi — nomor invoice, pengelola & properti
//   (dari profil), penghuni & kamar, rincian pembayaran, status pelunasan,
//   stempel lunas + tanda tangan digital pengelola.
// • Aksi: "Cetak / Simpan PDF" (window.print() + portal cetak #kwitansi-print-
//   portal — pola sama dgn laporan buku kas), "Kirim via WhatsApp" (wa.me dgn
//   teks kwitansi), dan "Tutup".
// • Status sadar: lunas → stempel LUNAS emerald; verifikasi → stempel
//   VERIFIKASI violet; belum bayar → pratinjau tagihan BELUM LUNAS.
// ─────────────────────────────────────────────────────────────────────────────

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  BadgeCheck,
  CalendarClock,
  CircleAlert,
  Clock3,
  Printer,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatIDR, MONTH_NAMES, waLink } from "@/lib/kost-data";
import {
  buildBillingWaMessage,
  buildReceiptWaMessage,
  isInvoiceUnpaid,
  type Invoice,
  type WaBillingContext,
} from "@/lib/kost-invoices";
import { WaIcon } from "./wa-icon";

/** SSR-safe "sudah di browser?" — pola sama dengan KasView (portal cetak) */
const emptySubscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/** Tanggal hari ini → "26 Sep 2026" (gaya label tanggal dataset) */
function todayLabel(): string {
  const d = new Date();
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

type ReceiptMood = "lunas" | "verifikasi" | "belum";

/** Metadata stempel & status pelunasan per kondisi invoice */
const MOOD_META: Record<
  ReceiptMood,
  { stamp: string; stampIcon: typeof BadgeCheck; ring: string; chip: string }
> = {
  lunas: {
    stamp: "Lunas",
    stampIcon: BadgeCheck,
    ring: "border-emerald-600 text-emerald-700",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  verifikasi: {
    stamp: "Verifikasi",
    stampIcon: Clock3,
    ring: "border-violet-500 text-violet-700",
    chip: "border-violet-200 bg-violet-50 text-violet-800",
  },
  belum: {
    stamp: "Belum Lunas",
    stampIcon: CircleAlert,
    ring: "border-amber-500 text-amber-700",
    chip: "border-amber-200 bg-amber-50 text-amber-800",
  },
};

function moodOf(inv: Invoice): ReceiptMood {
  if (inv.status === "lunas") return "lunas";
  if (inv.status === "verifikasi") return "verifikasi";
  return "belum";
}

interface ReceiptProps {
  inv: Invoice;
  propertyName: string;
  ownerName: string;
}

/* ── Pratinjau layar: kuitansi bergaya kertas ─────────────────────────────── */

function ReceiptPaper({ inv, propertyName, ownerName }: ReceiptProps) {
  const mood = moodOf(inv);
  const meta = MOOD_META[mood];
  const StampIcon = meta.stampIcon;
  const paid = mood !== "belum";

  return (
    <div className="relative rounded-lg border border-zinc-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
      {/* Kepala kuitansi */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
            Kwitansi Digital
          </p>
          <p className="mt-1 font-mono text-[15px] font-bold tabular-nums text-zinc-900">
            {inv.id}
          </p>
          <p className="mt-0.5 text-[12.5px] tabular-nums text-zinc-500">
            Terbit {inv.paidAt ?? todayLabel()}
          </p>
        </div>
        {/* Stempel lunas — miring seperti cap kantor */}
        <span
          className={cn(
            "inline-flex shrink-0 rotate-[-6deg] items-center gap-1.5 rounded-md border-2 border-dashed px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.18em]",
            meta.ring,
          )}
          aria-label={`Stempel ${meta.stamp}`}
        >
          <StampIcon className="size-3.5" strokeWidth={2} aria-hidden="true" />
          {meta.stamp}
        </span>
      </div>

      {/* Identitas para pihak */}
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Pengelola
          </dt>
          <dd className="mt-0.5 truncate text-[13px] font-semibold text-zinc-900">
            {ownerName}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Properti
          </dt>
          <dd className="mt-0.5 truncate text-[13px] font-semibold text-zinc-900">
            {propertyName}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Diterima dari
          </dt>
          <dd
            className={cn(
              "mt-0.5 truncate text-[13px] font-semibold text-zinc-900",
              !inv.tenantName && "italic text-zinc-400",
            )}
          >
            {inv.tenantName ?? "Kamar kosong"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Kamar
          </dt>
          <dd className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-zinc-900">
            Kamar {inv.roomNomor ?? inv.roomId}
            <span className="block text-[12px] font-normal tabular-nums text-zinc-500">
              {inv.roomType}
            </span>
          </dd>
        </div>
      </dl>

      {/* Rincian pembayaran */}
      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-700">
          Rincian Pembayaran
        </p>
        <ul className="mt-2 space-y-1.5">
          {inv.lines.map((l) => (
            <li
              key={l.label}
              className="flex items-baseline justify-between gap-4 text-[13px] text-zinc-700"
            >
              <span className="min-w-0 truncate">{l.label}</span>
              <span className="shrink-0 font-medium tabular-nums text-zinc-900">
                {formatIDR(l.amount)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2.5 flex items-baseline justify-between gap-4 border-t-2 border-zinc-900 pt-2">
          <span className="text-[13px] font-bold text-zinc-900">
            {paid ? "Total Dibayar" : "Total Tagihan"}
          </span>
          <span className="text-[16px] font-black tabular-nums text-zinc-900">
            {formatIDR(inv.total)}
          </span>
        </div>
      </div>

      {/* Status pelunasan */}
      <div
        className={cn(
          "mt-4 flex items-start gap-2.5 rounded-lg border p-3",
          meta.chip,
        )}
      >
        {paid ? (
          <BadgeCheck className="mt-0.5 size-4.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <CalendarClock className="mt-0.5 size-4.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-tight">
            {mood === "lunas" && "Pembayaran Lunas"}
            {mood === "verifikasi" && "Menunggu Verifikasi Pembayaran"}
            {mood === "belum" && "Belum Melakukan Pembayaran"}
          </p>
          <p className="mt-0.5 text-[12.5px] tabular-nums leading-snug opacity-90">
            {mood === "belum"
              ? `Jatuh tempo ${inv.dueDate}`
              : `Diterima ${inv.paidAt ?? "—"}${mood === "verifikasi" ? " · menunggu konfirmasi owner" : ""}`}
          </p>
        </div>
      </div>

      {/* Tanda tangan digital pengelola */}
      <div className="mt-5 flex items-end justify-between gap-4">
        <span
          className={cn(
            "inline-block rotate-[-8deg] rounded-md border-2 border-dashed px-3 py-1.5 text-center opacity-80",
            meta.ring,
          )}
          aria-hidden="true"
        >
          <span className="block text-[10px] font-black uppercase tracking-[0.3em]">
            {meta.stamp}
          </span>
          <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.2em]">
            {propertyName}
          </span>
        </span>
        <div className="text-right">
          <p className="text-[12.5px] text-zinc-500">Hormat kami,</p>
          <p className="mt-1.5 font-serif text-[19px] italic leading-none text-zinc-900">
            {ownerName}
          </p>
          <p className="mt-1.5 border-t border-zinc-300 pt-1 text-[12px] font-medium text-zinc-700">
            Pengelola {propertyName}
          </p>
        </div>
      </div>

      {/* Catatan legalitas bawah */}
      <p className="mt-4 border-t border-dashed border-zinc-200 pt-2.5 text-center text-[11.5px] leading-snug text-zinc-500">
        Kuitansi digital sah — diterbitkan otomatis oleh UnitKu untuk {inv.id}
      </p>
    </div>
  );
}

/* ── Dokumen cetak (portal ke <body>, tampil hanya saat @media print) ─────── */

function ReceiptPrintDocument({ inv, propertyName, ownerName }: ReceiptProps) {
  const mood = moodOf(inv);
  const meta = MOOD_META[mood];
  const paid = mood !== "belum";

  return (
    <div id="kwitansi-print-portal" className="bg-white text-zinc-900">
      {/* Kepala kuitansi cetak */}
      <header className="border-b-2 border-zinc-900 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">{propertyName}</h1>
            <p className="mt-0.5 text-[12px]">Pengelola: {ownerName}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[18px] font-black uppercase tracking-[0.28em]">
              Kwitansi
            </p>
            <p className="mt-1 font-mono text-[12px] font-bold tabular-nums">
              {inv.id}
            </p>
          </div>
        </div>
      </header>

      {/* Identitas transaksi */}
      <section className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
        <p>
          <span className="font-semibold">Diterima dari:</span>{" "}
          {inv.tenantName ?? "Kamar kosong"}
        </p>
        <p className="tabular-nums">
          <span className="font-semibold">Kamar:</span> {inv.roomId} ({inv.roomType})
        </p>
        <p className="tabular-nums">
          <span className="font-semibold">Periode sewa:</span> {inv.periodLabel}
        </p>
        <p className="tabular-nums">
          <span className="font-semibold">
            {paid ? "Tanggal bayar:" : "Jatuh tempo:"}
          </span>{" "}
          {paid ? (inv.paidAt ?? todayLabel()) : inv.dueDate}
        </p>
      </section>

      {/* Rincian pembayaran */}
      <table className="mt-4 w-full border-collapse text-left text-[12px]">
        <caption className="sr-only">Rincian pembayaran {inv.id}</caption>
        <thead>
          <tr className="border-b-2 border-zinc-900">
            <th className="py-1.5 pr-2 font-semibold">Rincian Pembayaran</th>
            <th className="py-1.5 text-right font-semibold">Nominal</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l) => (
            <tr key={l.label} className="border-b border-zinc-300">
              <td className="py-1.5 pr-2">{l.label}</td>
              <td className="whitespace-nowrap py-1.5 text-right tabular-nums">
                {formatIDR(l.amount)}
              </td>
            </tr>
          ))}
          <tr className="border-b-2 border-zinc-900 font-bold">
            <td className="py-1.5 pr-2 uppercase">
              {paid ? "Total Dibayar" : "Total Tagihan"}
            </td>
            <td className="whitespace-nowrap py-1.5 text-right tabular-nums">
              {formatIDR(inv.total)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Status pelunasan */}
      <p className="mt-3 text-[12px]">
        <span className="font-semibold">Status:</span>{" "}
        {mood === "lunas" && "LUNAS — pembayaran diterima penuh"}
        {mood === "verifikasi" &&
          `MENUNGGU VERIFIKASI — diterima ${inv.paidAt ?? "—"}, menunggu konfirmasi pengelola`}
        {mood === "belum" && `BELUM LUNAS — jatuh tempo ${inv.dueDate}`}
      </p>

      {/* Stempel + tanda tangan */}
      <section className="mt-8 flex items-end justify-between gap-6">
        <span
          className="inline-block rotate-[-8deg] rounded border-2 border-dashed border-zinc-900 px-4 py-2 text-center"
          aria-hidden="true"
        >
          <span className="block text-[13px] font-black uppercase tracking-[0.3em]">
            {meta.stamp}
          </span>
          <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.2em]">
            {propertyName}
          </span>
        </span>
        <div className="text-center">
          <p className="text-[12px]">Hormat kami,</p>
          <p className="mt-8 border-t border-zinc-900 px-8 pt-1 text-[12px] font-semibold">
            {ownerName}
          </p>
          <p className="text-[11px]">Pengelola {propertyName}</p>
        </div>
      </section>

      {/* Footer legalitas */}
      <footer className="mt-6 border-t border-zinc-300 pt-2 text-[10.5px] text-zinc-600">
        Dicetak dari UnitKu — Kuitansi digital {inv.id} · {propertyName} ·{" "}
        {todayLabel()}
      </footer>
    </div>
  );
}

/* ── Modal utama ──────────────────────────────────────────────────────────── */

interface ReceiptPreviewModalProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nama properti aktif (dari profil pengelola) */
  propertyName: string;
  /** Nama pengelola — dari Pengaturan → Profil Saya (settings.owner.nama) */
  ownerName: string;
  /** Konteks pesan WA: rekening, link portal, QRIS */
  context: WaBillingContext | null;
}

export function ReceiptPreviewModal({
  invoice,
  open,
  onOpenChange,
  propertyName,
  ownerName,
  context,
}: ReceiptPreviewModalProps) {
  const mounted = useMounted();
  if (!invoice) return null;
  const paid = !isInvoiceUnpaid(invoice);

  /** Teks WA kwitansi (lunas) / tagihan (belum bayar) — template resmi UnitKu */
  const waMessage = context
    ? paid
      ? buildReceiptWaMessage(invoice, context)
      : buildBillingWaMessage(invoice, context)
    : "";

  const handlePrint = () => {
    toast.info("Menyiapkan cetak", {
      description: "Pilih \"Save as PDF\" pada dialog cetak untuk menyimpan kwitansi.",
    });
    // Beri tick agar toast render sebelum dialog cetak browser membuka
    window.setTimeout(() => window.print(), 150);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-[500px] gap-0 overflow-hidden p-0"
          aria-describedby={undefined}
        >
          <DialogHeader className="border-b border-border p-4 pr-12">
            <DialogTitle className="text-[15px] font-bold tracking-tight text-zinc-900">
              Pratinjau Kwitansi — Kamar {invoice.roomNomor ?? invoice.roomId}
            </DialogTitle>
            <DialogDescription className="text-[12.5px] tabular-nums text-zinc-700">
              {invoice.id} · Periode {invoice.periodLabel}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[62vh] overflow-y-auto bg-zinc-50 p-4">
            <ReceiptPaper
              inv={invoice}
              propertyName={propertyName}
              ownerName={ownerName}
            />
          </div>

          <DialogFooter className="gap-2 border-t border-border p-4 sm:items-center sm:justify-between">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="h-9 border-zinc-200 bg-white text-[13px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
            >
              <Printer className="size-3.5" strokeWidth={1.75} />
              Cetak / Simpan PDF
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <DialogClose asChild>
                <Button
                  variant="outline"
                  className="h-9 border-zinc-200 bg-white text-[13px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
                >
                  Tutup
                </Button>
              </DialogClose>
              <a
                href={`${waLink(invoice.tenantPhone ?? "")}?text=${encodeURIComponent(waMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                <WaIcon className="size-4" />
                Kirim via WhatsApp
              </a>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Portal cetak — tersembunyi di layar, tampil hanya saat window.print() */}
      {mounted && open && (
        createPortal(
          <ReceiptPrintDocument
            inv={invoice}
            propertyName={propertyName}
            ownerName={ownerName}
          />,
          document.body,
        )
      )}
    </>
  );
}
