"use client";

import { Check, Eye, Info, MessageSquareText, MoreHorizontal, Pencil, Wallet, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatIDR, initialsOf } from "@/lib/kost-data";
import { isInvoiceUnpaid, periodShortLabel, type Invoice } from "@/lib/kost-invoices";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { WaIcon } from "./wa-icon";

interface InvoiceTableProps {
  invoices: Invoice[];
  /** Tombol hijau "Tagih via WhatsApp" — buka wa.me langsung dgn template tagihan */
  onTagihWa: (inv: Invoice) => void;
  /** Kirim kwitansi lunas via WA (invoice berstatus Lunas/Verifikasi) */
  onReceiptWa: (inv: Invoice) => void;
  /** Pratinjau & edit pesan sebelum kirim (menu titik tiga) */
  onPreviewWa: (inv: Invoice) => void;
  onMarkPaid: (inv: Invoice) => void;
  onVerify: (inv: Invoice) => void;
  /** "Edit / Tambah Biaya" — modal rincian add-on sebelum tagihan dikirim */
  onEdit: (inv: Invoice) => void;
  onCancel: (inv: Invoice) => void;
  onReceipt: (inv: Invoice) => void;
  emptyTitle: string;
  emptyDescription: string;
}

/** Breakdown tooltip content for the Rincian Biaya cell */
function BreakdownTooltip({ invoice }: { invoice: Invoice }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex cursor-default items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10"
          aria-label={`Rincian biaya ${invoice.id}`}
        >
          <span className="text-[12.5px] text-zinc-600">
            {invoice.lines.length > 1 ? `Sewa + ${invoice.lines.length - 1} biaya` : "Sewa"}
          </span>
          <Info className="size-3 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="border border-zinc-200 bg-white p-0 text-zinc-700 shadow-md">
        <div className="min-w-[190px] px-3 py-2.5">
          <p className="mb-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-zinc-700">
            {invoice.id}
          </p>
          <div className="space-y-1">
            {invoice.lines.map((l) => (
              <div key={l.label} className="flex items-center justify-between gap-5 text-[12.5px]">
                <span className="text-zinc-700">{l.label}</span>
                <span className="font-medium tabular-nums text-zinc-800">{formatIDR(l.amount)}</span>
              </div>
            ))}
            <div className="mt-1.5 flex items-center justify-between gap-5 border-t border-zinc-100 pt-1.5 text-[12.5px]">
              <span className="font-medium text-zinc-600">Total</span>
              <span className="font-bold tabular-nums text-zinc-900">{formatIDR(invoice.total)}</span>
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

const HEAD_CELL =
  "h-9 bg-white px-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-700 shadow-[inset_0_-1px_0_var(--border)]";

interface MobileCardHandlers {
  onTagihWa: (inv: Invoice) => void;
  onReceiptWa: (inv: Invoice) => void;
  onPreviewWa: (inv: Invoice) => void;
  onMarkPaid: (inv: Invoice) => void;
  onVerify: (inv: Invoice) => void;
  onEdit: (inv: Invoice) => void;
  onCancel: (inv: Invoice) => void;
  onReceipt: (inv: Invoice) => void;
}

/** Kartu invoice ringkas untuk layar ponsel (< md):
 *  Tombol WA hijau besar selebar kartu (mudah dijangkau satu tangan ≥44px). */
function MobileInvoiceCard({ invoice: inv, ...handlers }: { invoice: Invoice } & MobileCardHandlers) {
  const paid = !isInvoiceUnpaid(inv);
  return (
    <li className="rounded-lg border border-border bg-white p-3">
      {/* Baris atas: kamar & penghuni + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-700"
            aria-hidden="true"
          >
            {inv.tenantName ? initialsOf(inv.tenantName) : "—"}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-semibold tabular-nums text-zinc-900">
              Kamar {inv.roomId}
            </span>
            <span
              className={cn(
                "block truncate text-[12.5px] text-zinc-700",
                !inv.tenantName && "italic"
              )}
            >
              {inv.tenantName ?? "Kamar kosong"}
            </span>
          </span>
        </div>
        <InvoiceStatusBadge invoice={inv} className="shrink-0" />
      </div>

      {/* Baris tengah: nomor invoice + periode sewa */}
      <div className="mt-2.5 flex items-center gap-1.5 text-[12.5px] text-zinc-600">
        <span className="shrink-0 font-mono font-medium tabular-nums">{inv.id}</span>
        <span aria-hidden="true">·</span>
        <span className="min-w-0 truncate tabular-nums">{inv.periodLabel}</span>
      </div>

      {/* Tombol aksi cepat WA — selebar kartu, target sentuh ≥44px */}
      <div className="mt-2.5 border-t border-border pt-2.5">
        {paid ? (
          <Button
            onClick={() => handlers.onReceiptWa(inv)}
            className="h-11 w-full bg-emerald-600 text-[13px] font-semibold text-white shadow-none hover:bg-emerald-700"
          >
            <WaIcon className="size-4" />
            Kirim Kwitansi Lunas via WA
          </Button>
        ) : (
          <Button
            onClick={() => handlers.onTagihWa(inv)}
            className="h-11 w-full bg-emerald-600 text-[13px] font-semibold text-white shadow-none hover:bg-emerald-700"
          >
            <WaIcon className="size-4" />
            Tagih via WhatsApp
          </Button>
        )}

        <div className="mt-2 flex items-center gap-1.5">
          {!paid && (
            <Button
              variant="outline"
              className="h-10 flex-1 border-emerald-200 bg-emerald-50 px-2 text-[12.5px] font-semibold text-emerald-700 shadow-none hover:bg-emerald-100"
              onClick={() => handlers.onMarkPaid(inv)}
            >
              <Check className="size-3.5" strokeWidth={2.25} />
              Tandai Lunas
            </Button>
          )}
          {!paid && (
            <Button
              variant="outline"
              className="h-10 flex-1 border-zinc-200 bg-white px-2 text-[12.5px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
              onClick={() => handlers.onEdit(inv)}
            >
              <Pencil className="size-3.5" strokeWidth={1.75} />
              Edit Biaya
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-10 shrink-0 rounded-md border-zinc-200 bg-white text-zinc-700 shadow-none hover:bg-zinc-50"
                aria-label={`Aksi lainnya untuk ${inv.id}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handlers.onPreviewWa(inv)} className="text-[13px]">
                <MessageSquareText />
                Pratinjau Pesan WA
              </DropdownMenuItem>
              {inv.status === "verifikasi" && (
                <DropdownMenuItem
                  onClick={() => handlers.onVerify(inv)}
                  className="text-[13px] [&_svg]:text-emerald-600"
                >
                  <Check />
                  Konfirmasi Pembayaran
                </DropdownMenuItem>
              )}
              {paid && (
                <DropdownMenuItem onClick={() => handlers.onEdit(inv)} className="text-[13px]">
                  <Pencil />
                  Edit Tagihan
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handlers.onReceipt(inv)} className="text-[13px]">
                <Eye />
                Lihat Kwitansi
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => handlers.onCancel(inv)}
                className="text-[13px]"
              >
                <XCircle />
                Batalkan Tagihan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Total nominal */}
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-bold tabular-nums text-zinc-900">{formatIDR(inv.total)}</p>
          {inv.paidAt && (
            <p className="mt-0.5 text-xs tabular-nums text-zinc-700">Diterima {inv.paidAt}</p>
          )}
        </div>
        <span className="shrink-0 text-xs tabular-nums text-zinc-700">Tempo {inv.dueDate}</span>
      </div>
    </li>
  );
}

export function InvoiceTable({
  invoices,
  onTagihWa,
  onReceiptWa,
  onPreviewWa,
  onMarkPaid,
  onVerify,
  onEdit,
  onCancel,
  onReceipt,
  emptyTitle,
  emptyDescription,
}: InvoiceTableProps) {
  const isPaid = (inv: Invoice) => !isInvoiceUnpaid(inv);

  return (
    <>
      {/* Desktop (md+): tabel scrollable dengan header sticky */}
      <div className="hidden max-h-[620px] overflow-auto overscroll-contain rounded-lg border border-border bg-white scrollbar-thin md:block">
      {/* Plain <table> so the scroll container is the direct ancestor (sticky header) */}
      <table className="w-full min-w-[1060px] border-collapse text-[13px]">
        <caption className="sr-only">Daftar tagihan sewa bulanan</caption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={`${HEAD_CELL} pl-4 text-left`}>No. Invoice</TableHead>
            <TableHead className={`${HEAD_CELL} text-left`}>Kamar &amp; Penghuni</TableHead>
            <TableHead className={`${HEAD_CELL} text-left`}>Periode</TableHead>
            <TableHead className={`${HEAD_CELL} text-left`}>Rincian Biaya</TableHead>
            <TableHead className={`${HEAD_CELL} text-right`}>Total</TableHead>
            <TableHead className={`${HEAD_CELL} text-left`}>Status</TableHead>
            <TableHead className={`${HEAD_CELL} pr-4 text-right`}>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="py-14 text-center">
                <Info className="mx-auto size-5 text-zinc-300" strokeWidth={1.5} aria-hidden="true" />
                <p className="mt-2 text-[13px] font-medium text-zinc-700">{emptyTitle}</p>
                <p className="mt-0.5 text-xs text-zinc-700">{emptyDescription}</p>
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((inv) => (
              <TableRow key={inv.id} className="border-border">
                {/* No. Invoice — mono */}
                <TableCell className="py-2 pl-4">
                  <span className="font-mono text-[12.5px] font-medium tabular-nums text-zinc-600">
                    {inv.id}
                  </span>
                </TableCell>

                {/* Kamar & Penghuni */}
                <TableCell className="py-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-700"
                      aria-hidden="true"
                    >
                      {inv.tenantName ? initialsOf(inv.tenantName) : "—"}
                    </span>
                    <span className="leading-tight">
                      <span className="block text-[13px] font-semibold tabular-nums text-zinc-900">
                        Kamar {inv.roomId}
                      </span>
                      <span
                        className={
                          inv.tenantName
                            ? "block text-[12.5px] text-zinc-700"
                            : "block text-[12.5px] italic text-zinc-700"
                        }
                      >
                        {inv.tenantName ?? "Kamar kosong"}
                      </span>
                    </span>
                  </div>
                </TableCell>

                {/* Periode Sewa — ringkas (label penuh ada di kartu mobile & CSV) */}
                <TableCell className="py-2 text-[12.5px] tabular-nums whitespace-nowrap text-zinc-600">
                  <span title={inv.periodLabel}>{periodShortLabel(inv.periodKey)}</span>
                </TableCell>

                {/* Rincian Biaya */}
                <TableCell className="py-2">
                  <BreakdownTooltip invoice={inv} />
                </TableCell>

                {/* Total Nominal */}
                <TableCell className="py-2 text-right">
                  <span className="text-[13px] font-bold tabular-nums text-zinc-900">
                    {formatIDR(inv.total)}
                  </span>
                </TableCell>

                {/* Status + tempo/pelunasan (kolom Jatuh Tempo digabung di sini) */}
                <TableCell className="py-2">
                  <div className="flex flex-col items-start gap-1">
                    <InvoiceStatusBadge invoice={inv} />
                    {inv.paidAt ? (
                      <span className="text-xs tabular-nums text-zinc-700">
                        Diterima {inv.paidAt}
                      </span>
                    ) : (
                      <span className="text-xs tabular-nums text-zinc-700">Tempo {inv.dueDate}</span>
                    )}
                  </div>
                </TableCell>

                {/* Aksi */}
                <TableCell className="py-2 pr-4">
                  <div className="flex items-center justify-end gap-1.5">
                    {isPaid(inv) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 border-emerald-200 bg-emerald-50 px-2 text-[12.5px] font-semibold text-emerald-700 shadow-none hover:bg-emerald-100"
                        onClick={() => onReceiptWa(inv)}
                      >
                        <WaIcon className="size-3" />
                        Kirim Kwitansi via WA
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-7 bg-emerald-600 px-2.5 text-[12.5px] font-semibold text-white shadow-none hover:bg-emerald-700"
                        onClick={() => onTagihWa(inv)}
                      >
                        <WaIcon className="size-3" />
                        Tagih via WhatsApp
                      </Button>
                    )}

                    {!isPaid(inv) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 border-zinc-200 bg-white px-2 text-[12.5px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
                        onClick={() => onMarkPaid(inv)}
                      >
                        <Check className="size-3" strokeWidth={2.25} />
                        Tandai Lunas
                      </Button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-700"
                          aria-label={`Aksi lainnya untuk ${inv.id}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => onPreviewWa(inv)} className="text-[13px]">
                          <MessageSquareText />
                          Pratinjau Pesan WA
                        </DropdownMenuItem>
                        {inv.status === "verifikasi" && (
                          <>
                            <DropdownMenuItem
                              onClick={() => onVerify(inv)}
                              className="text-[13px] [&_svg]:text-emerald-600"
                            >
                              <Check />
                              Konfirmasi Pembayaran
                            </DropdownMenuItem>
                          </>
                        )}
                        {!isPaid(inv) ? (
                          <DropdownMenuItem onClick={() => onEdit(inv)} className="text-[13px]">
                            <Wallet />
                            Edit / Tambah Biaya
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => onEdit(inv)} className="text-[13px]">
                            <Pencil />
                            Edit Tagihan
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onReceipt(inv)} className="text-[13px]">
                          <Eye />
                          Lihat Kwitansi
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onCancel(inv)}
                          className="text-[13px]"
                        >
                          <XCircle />
                          Batalkan Tagihan
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </table>
      </div>

      {/* Mobile (< md): daftar kartu vertikal menggantikan tabel */}
      <div className="md:hidden">
        {invoices.length === 0 ? (
          <div className="rounded-lg border border-border bg-white px-4 py-10 text-center">
            <Info className="mx-auto size-5 text-zinc-300" strokeWidth={1.5} aria-hidden="true" />
            <p className="mt-2 text-[13px] font-medium text-zinc-700">{emptyTitle}</p>
            <p className="mt-0.5 text-xs text-zinc-700">{emptyDescription}</p>
          </div>
        ) : (
          <ul role="list" aria-label="Daftar tagihan" className="space-y-2.5">
            {invoices.map((inv) => (
              <MobileInvoiceCard
                key={inv.id}
                invoice={inv}
                onTagihWa={onTagihWa}
                onReceiptWa={onReceiptWa}
                onPreviewWa={onPreviewWa}
                onMarkPaid={onMarkPaid}
                onVerify={onVerify}
                onEdit={onEdit}
                onCancel={onCancel}
                onReceipt={onReceipt}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
