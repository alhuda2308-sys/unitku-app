"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatIDR, initialsOf, waLink } from "@/lib/kost-data";
import { buildWaMessage, type Invoice } from "@/lib/kost-invoices";
import { WaIcon } from "./wa-icon";

interface WaReminderModalProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyName: string;
  onSent: (inv: Invoice) => void;
}

/** Inner body keyed by invoice id so the template state resets on every open */
function WaModalBody({
  invoice,
  propertyName,
  onSent,
}: {
  invoice: Invoice;
  propertyName: string;
  onSent: (inv: Invoice) => void;
}) {
  const [message, setMessage] = useState(() => buildWaMessage(invoice, propertyName));
  const [sent, setSent] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Pesan disalin ke clipboard");
    } catch {
      toast.error("Gagal menyalin pesan");
    }
  };

  const handleOpenWa = () => {
    onSent(invoice);
    setSent(true);
    toast.success(`Pengingat ditandai terkirim — Kamar ${invoice.roomId}`, {
      description: `${invoice.tenantName ?? "Penyewa"} · ${formatIDR(invoice.total)}`,
    });
  };

  return (
    <>
      <DialogHeader className="border-b border-border p-4">
        <DialogTitle className="text-[15px] font-bold tracking-tight text-zinc-900">
          Preview Tagihan WhatsApp — Kamar {invoice.roomId}
        </DialogTitle>
        <DialogDescription className="text-[12.5px] text-zinc-700">
          {invoice.id} · Periode {invoice.periodLabel}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 p-4">
        {/* Recipient */}
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-700">Kepada</p>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-bold text-zinc-600"
                aria-hidden="true"
              >
                {invoice.tenantName ? initialsOf(invoice.tenantName) : "—"}
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13px] font-semibold text-zinc-900">
                  {invoice.tenantName ?? "Kamar kosong"}
                </p>
                <p className="text-[12.5px] tabular-nums text-zinc-700">{invoice.tenantPhone ?? "—"}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium tabular-nums text-zinc-600">
              {formatIDR(invoice.total)}
            </span>
          </div>
        </div>

        {/* Message template */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="wa-message"
              className="text-xs font-bold uppercase tracking-wider text-zinc-700"
            >
              Pesan
            </label>
            <span className="text-xs tabular-nums text-zinc-700">{message.length} karakter</span>
          </div>
          <textarea
            id="wa-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={13}
            className="w-full resize-none rounded-lg border border-border bg-white p-3 font-sans text-[12.5px] leading-5 text-zinc-800 placeholder:text-zinc-600 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
            aria-label="Isi pesan WhatsApp"
          />
        </div>
      </div>

      <DialogFooter className="border-t border-border p-4 sm:justify-between">
        <Button
          variant="outline"
          onClick={handleCopy}
          className="h-9 border-zinc-200 bg-white text-[13px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
        >
          <Copy className="size-3.5" strokeWidth={1.75} />
          Salin Pesan
        </Button>
        <a
          href={`${waLink(invoice.tenantPhone ?? "")}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOpenWa}
          className={
            sent
              ? "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-[13px] font-semibold text-white opacity-90"
              : "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-700"
          }
        >
          <WaIcon className="size-4" />
          {sent ? "Terkirim ✓" : "Buka WhatsApp Web / App"}
        </a>
      </DialogFooter>
    </>
  );
}

export function WaReminderModal({ invoice, open, onOpenChange, propertyName, onSent }: WaReminderModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] gap-0 p-0" aria-describedby={undefined}>
        {invoice && (
          <WaModalBody key={invoice.id} invoice={invoice} propertyName={propertyName} onSent={onSent} />
        )}
      </DialogContent>
    </Dialog>
  );
}
