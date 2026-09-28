"use client";

import { useMemo, useState } from "react";
import { ChevronDown, MoreHorizontal, Paperclip, ReceiptText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShieldAlert } from "lucide-react";
import { MetricCard } from "./metric-card";
import { ExpenseModal, type ExpenseDraft } from "./expense-modal";
import { computeCashStats, type CashEntry } from "@/lib/kost-cashflow";
import { formatIDR } from "@/lib/kost-data";
import { cn } from "@/lib/utils";

interface KasViewProps {
  entries: CashEntry[];
  onAddExpense: (draft: ExpenseDraft) => void;
  onDeleteEntry: (entry: CashEntry) => void;
  /** Sesi staf — laporan keuangan sensitif (metrik & pencatatan) disembunyikan */
  isStaffView?: boolean;
}

const MONTH_FILTERS = [
  { key: "2025-09", label: "Sep 2025", tag: "Bulan Berjalan" },
  { key: "2025-08", label: "Agu 2025" },
  { key: "2025-07", label: "Jul 2025" },
  { key: "2025-06", label: "Jun 2025" },
];

const HEAD_CELL =
  "h-9 bg-white px-3 text-xs font-semibold uppercase tracking-wide text-zinc-700 shadow-[inset_0_-1px_0_var(--border)]";

function typePill(type: CashEntry["type"]) {
  return type === "masuk"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";
}

export function KasView({ entries, onAddExpense, onDeleteEntry, isStaffView = false }: KasViewProps) {
  const [month, setMonth] = useState("2025-09");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [preview, setPreview] = useState<CashEntry | null>(null);

  const monthEntries = useMemo(
    () =>
      entries
        .filter((e) => e.dateSort.toString().startsWith(month.replace("-", "")))
        .sort((a, b) => b.dateSort - a.dateSort),
    [entries, month]
  );

  const stats = computeCashStats(monthEntries);
  const monthLabel = MONTH_FILTERS.find((m) => m.key === month)?.label ?? month;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">Buku Kas &amp; Arus Keuangan</h1>
          <p className="mt-0.5 text-[12.5px] text-zinc-700">
            Pencatatan kas masuk &amp; keluar · {monthLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-9 border-zinc-200 bg-white px-3 text-[13px] text-zinc-700 shadow-none hover:bg-zinc-50"
              >
                {monthLabel}
                <ChevronDown className="size-3.5 text-zinc-700" strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {MONTH_FILTERS.map((m) => (
                <DropdownMenuItem
                  key={m.key}
                  onClick={() => setMonth(m.key)}
                  className="justify-between text-[13px]"
                >
                  {m.label}
                  {m.tag && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 text-xs font-semibold text-emerald-700">
                      {m.tag}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => setExpenseOpen(true)}
            className="h-9 bg-zinc-900 px-3 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800"
          >
            + Catat Pengeluaran
          </Button>
        </div>
      </div>

      {/* Notice staf — laporan keuangan sensitif dibatasi */}
      {isStaffView && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-[12.5px] leading-4 text-amber-800">
            Akses staf — hanya riwayat kas harian yang ditampilkan. Ringkasan
            pemasukan, laba & laporan lengkap tersedia untuk owner.
          </p>
        </div>
      )}

      {/* Metrics */}
      {!isStaffView && (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          dot="bg-emerald-500"
          label="Total Pemasukan"
          value={formatIDR(stats.masuk)}
          badge={`${stats.masukCount} transaksi`}
          sub={`Sepanjang ${monthLabel}`}
        />
        <MetricCard
          dot="bg-red-500"
          label="Total Pengeluaran"
          value={formatIDR(stats.keluar)}
          badge={`${stats.keluarCount} transaksi`}
          badgeClass="border-red-200 bg-red-50 text-red-700"
          sub={`Operasional & maintenance`}
        />
        <MetricCard
          dot="bg-zinc-900"
          label="Laba Bersih"
          value={formatIDR(stats.net)}
          badge={`${stats.marginPct}% margin`}
          sub={`Pemasukan − pengeluaran`}
        />
      </div>
      )}

      {/* Transactions table */}
      <div className="max-h-[560px] overflow-auto overscroll-contain rounded-lg border border-border bg-white scrollbar-thin">
        <table className="w-full min-w-[860px] border-collapse text-[13px]">
          <caption className="sr-only">Transaksi kas masuk dan keluar</caption>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${HEAD_CELL} pl-4 text-left`}>Tanggal</th>
              <th className={`${HEAD_CELL} text-left`}>Tipe</th>
              <th className={`${HEAD_CELL} text-left`}>Kategori</th>
              <th className={`${HEAD_CELL} text-left`}>Deskripsi</th>
              <th className={`${HEAD_CELL} text-right`}>Nominal</th>
              <th className={`${HEAD_CELL} text-left`}>Lampiran Bukti</th>
              <th className={`${HEAD_CELL} pr-4 text-right`}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {monthEntries.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0 hover:bg-zinc-50/70">
                <td className="whitespace-nowrap py-2 pl-4 pr-3 text-[12.5px] tabular-nums text-zinc-700">
                  {e.dateLabel}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "inline-flex h-5 items-center rounded-full border px-1.5 text-xs font-semibold",
                      typePill(e.type)
                    )}
                  >
                    {e.type === "masuk" ? "Masuk" : "Keluar"}
                  </span>
                </td>
                <td className="max-w-[200px] truncate px-3 py-2 text-[12.5px] font-medium text-zinc-800">
                  {e.category}
                </td>
                <td className="max-w-[300px] truncate px-3 py-2 text-[12.5px] text-zinc-600">
                  {e.description}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-right text-[13px] font-semibold tabular-nums",
                    e.type === "masuk" ? "text-emerald-700" : "text-zinc-900"
                  )}
                >
                  {e.type === "masuk" ? "+" : "−"}
                  {formatIDR(e.amount)}
                </td>
                <td className="px-3 py-2">
                  {e.attachment ? (
                    <button
                      onClick={() => setPreview(e)}
                      className="inline-flex max-w-[170px] items-center gap-1.5 rounded-md border border-border bg-zinc-50 px-1.5 py-1 text-[12.5px] text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                      aria-label={`Lihat bukti ${e.attachment}`}
                    >
                      <Paperclip className="size-3 shrink-0 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
                      <span className="truncate">{e.attachment}</span>
                    </button>
                  ) : (
                    <span className="text-[12.5px] text-zinc-300">—</span>
                  )}
                </td>
                <td className="py-2 pl-3 pr-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-700"
                        aria-label={`Aksi untuk transaksi ${e.id}`}
                      >
                        <MoreHorizontal className="size-4" strokeWidth={1.75} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {e.attachment && (
                        <DropdownMenuItem onClick={() => setPreview(e)} className="text-[13px]">
                          <ReceiptText className="size-3.5 text-zinc-700" strokeWidth={1.75} />
                          Lihat Bukti
                        </DropdownMenuItem>
                      )}
                      {!isStaffView && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDeleteEntry(e)}
                            className="text-[13px] text-red-600 focus:text-red-700"
                          >
                            <Trash2 className="size-3.5" strokeWidth={1.75} />
                            Hapus Catatan
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {monthEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 border-t border-border px-6 py-12 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
              <ReceiptText className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <p className="text-[13px] font-semibold text-zinc-700">Belum ada transaksi</p>
            <p className="max-w-[280px] text-[12.5px] leading-5 text-zinc-700">
              Tidak ada catatan kas untuk {monthLabel}. Data demo tersedia pada Sep 2025.
            </p>
          </div>
        )}
      </div>

      {/* Attachment preview */}
      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="gap-0 bg-white p-0 sm:max-w-[380px]">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="text-[14px] font-bold tracking-tight text-zinc-900">
              Bukti Transaksi
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-zinc-700">{preview?.id}</DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-3 bg-zinc-50 p-5">
              {/* Mock preview surface — real asset lands here via API */}
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-white text-center">
                <ReceiptText className="size-8 text-zinc-300" strokeWidth={1.25} aria-hidden="true" />
                <p className="font-mono text-[12.5px] font-medium text-zinc-700">{preview.attachment}</p>
                <p className="text-xs text-zinc-300">Pratinjau lampiran</p>
              </div>
              <div className="rounded-md border border-border bg-white px-3 py-2.5 text-[12.5px]">
                <p className="font-medium text-zinc-800">{preview.description}</p>
                <p className="mt-0.5 text-zinc-700">
                  {preview.category} · <span className="tabular-nums">{preview.dateLabel}</span>
                </p>
                <p
                  className={cn(
                    "mt-1 text-[14px] font-bold tabular-nums",
                    preview.type === "masuk" ? "text-emerald-700" : "text-zinc-900"
                  )}
                >
                  {preview.type === "masuk" ? "+" : "−"}
                  {formatIDR(preview.amount)}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add expense modal */}
      <ExpenseModal
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        onSubmit={(draft) => onAddExpense(draft)}
      />
    </div>
  );
}
