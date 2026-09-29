"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ChevronDown,
  Landmark,
  MoreHorizontal,
  ReceiptText,
  ShieldAlert,
  Trash2,
  TrendingDown,
  TrendingUp,
  PencilLine,
} from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MetricCard } from "./metric-card";
import { SegmentedTabs } from "./segmented-tabs";
import { ExpenseModal, type ExpenseDraft } from "./expense-modal";
import { computeCashStats, type CashEntry } from "@/lib/kost-cashflow";
import {
  buildMonthOptions,
  currentPeriodKey,
  periodShortLabel,
} from "@/lib/kost-invoices";
import { formatIDR, MONTH_NAMES } from "@/lib/kost-data";
import type { StaffAccessRole } from "@/lib/staff-access";
import { cn } from "@/lib/utils";

interface KasViewProps {
  entries: CashEntry[];
  onAddExpense: (draft: ExpenseDraft) => void;
  onUpdateExpense: (entry: CashEntry, draft: ExpenseDraft) => void;
  onDeleteEntry: (entry: CashEntry) => void;
  /** Role sesi staf aktif — null/undefined = owner penuh */
  staffRole?: StaffAccessRole | null;
}

type FlowFilter = "semua" | "masuk" | "keluar";

const HEAD_CELL =
  "h-9 bg-white px-3 text-xs font-semibold uppercase tracking-wide text-zinc-700 shadow-[inset_0_-1px_0_var(--border)]";

/** "data:image/…" = nota asli terunggah; string lain = referensi file demo */
function isImageAttachment(attachment?: string): boolean {
  return !!attachment && attachment.startsWith("data:image/");
}

/** Ikon arus: panah masuk hijau / keluar merah */
function FlowIcon({ type, className }: { type: CashEntry["type"]; className?: string }) {
  return type === "masuk" ? (
    <ArrowDownLeft className={className} strokeWidth={2} aria-hidden="true" />
  ) : (
    <ArrowUpRight className={className} strokeWidth={2} aria-hidden="true" />
  );
}

function typePill(type: CashEntry["type"]) {
  return type === "masuk"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";
}

function SourceChip({ source }: { source?: string }) {
  if (!source) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600">
      {source === "Transfer Rekening Bank" ? (
        <Landmark className="size-3 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Banknote className="size-3 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      )}
      {source}
    </span>
  );
}

export function KasView({
  entries,
  onAddExpense,
  onUpdateExpense,
  onDeleteEntry,
  staffRole = null,
}: KasViewProps) {
  const isStaffView = staffRole !== null;
  /** Owner & Admin Operasional boleh mencatat pengeluaran harian */
  const canRecord = !isStaffView || staffRole === "ADMIN_OPERASIONAL";
  /** Edit/hapus catatan = owner saja */
  const canModify = !isStaffView;

  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [month, setMonth] = useState(() => currentPeriodKey());
  const [flow, setFlow] = useState<FlowFilter>("semua");
  const [category, setCategory] = useState("all");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editing, setEditing] = useState<CashEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CashEntry | null>(null);
  const [preview, setPreview] = useState<CashEntry | null>(null);

  const monthEntries = useMemo(
    () =>
      entries
        .filter((e) => e.dateSort.toString().startsWith(month.replace("-", "")))
        .sort((a, b) => b.dateSort - a.dateSort),
    [entries, month]
  );

  /** Filter kategori — kategori unik dari transaksi bulan terpilih (urut abjad) */
  const categoryOptions = useMemo(
    () => Array.from(new Set(monthEntries.map((e) => e.category))).sort((a, b) => a.localeCompare(b)),
    [monthEntries]
  );

  const filteredEntries = useMemo(
    () =>
      monthEntries.filter(
        (e) => (flow === "semua" || e.type === flow) && (category === "all" || e.category === category)
      ),
    [monthEntries, flow, category]
  );

  const stats = computeCashStats(monthEntries);
  const monthLabel = periodShortLabel(month);
  const monthTag = monthOptions.find((m) => m.key === month)?.tag;
  const netPositive = stats.net >= 0;

  /** Reset kategori bila pindah bulan/arus & kategori tidak lagi tersedia — via derived value */
  const categoryValue =
    category === "all" || categoryOptions.includes(category)
      ? category
      : "all";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">Buku Kas &amp; Arus Keuangan</h1>
          <p className="mt-0.5 text-[12.5px] text-zinc-700">
            Pencatatan kas masuk, pengeluaran operasional &amp; laba bersih · {monthLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Month filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-9 border-zinc-200 bg-white px-3 text-[13px] text-zinc-700 shadow-none hover:bg-zinc-50"
              >
                {monthLabel}
                {monthTag && (
                  <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-1.5 text-xs font-semibold text-emerald-700 sm:inline">
                    {monthTag}
                  </span>
                )}
                <ChevronDown className="size-3.5 text-zinc-700" strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {monthOptions.map((m) => (
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
          {canRecord && (
            <Button
              onClick={() => {
                setEditing(null);
                setExpenseOpen(true);
              }}
              className="h-9 bg-orange-600 px-3 text-[13px] font-semibold text-white shadow-none hover:bg-orange-700"
            >
              <span aria-hidden="true" className="text-[15px] leading-none">−</span>
              Catat Pengeluaran
            </Button>
          )}
        </div>
      </div>

      {/* Notice staf — laporan keuangan sensitif dibatasi */}
      {isStaffView && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-[12.5px] leading-4 text-amber-800">
            {staffRole === "ADMIN_OPERASIONAL"
              ? "Akses Admin Operasional — Anda dapat mencatat pengeluaran operasional harian. Ringkasan laba bersih & saldo hanya tampil untuk owner."
              : "Akses staf — hanya riwayat kas harian yang ditampilkan. Ringkasan pemasukan, laba & laporan lengkap tersedia untuk owner."}
          </p>
        </div>
      )}

      {/* Metrik bulan berjalan (khusus owner) */}
      {!isStaffView && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard
            dot="bg-emerald-500"
            label="Total Pemasukan"
            value={`+${formatIDR(stats.masuk)}`}
            valueClass="text-emerald-700"
            badge={`${stats.masukCount} transaksi`}
            sub={`Sewa kamar lunas & kas masuk · ${monthLabel}`}
          />
          <MetricCard
            dot="bg-red-500"
            label="Total Pengeluaran"
            value={`−${formatIDR(stats.keluar)}`}
            valueClass="text-red-600"
            badge={`${stats.keluarCount} transaksi`}
            badgeClass="border-red-200 bg-red-50 text-red-700"
            sub={`Akumulasi biaya operasional · ${monthLabel}`}
          />
          <MetricCard
            dot={netPositive ? "bg-sky-500" : "bg-red-500"}
            label="Laba Bersih / Arus Kas Bersih"
            value={`${netPositive ? "+" : "−"}${formatIDR(Math.abs(stats.net))}`}
            valueClass={netPositive ? "text-sky-700" : "text-red-600"}
            badge={
              stats.masuk > 0
                ? `${netPositive ? "Surplus" : "Defisit"} · ${stats.marginPct}% margin`
                : netPositive
                  ? "Belum ada transaksi"
                  : "Defisit"
            }
            badgeClass={
              netPositive
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : "border-red-200 bg-red-50 text-red-700"
            }
            sub={
              <span className="inline-flex items-center gap-1">
                {netPositive ? (
                  <TrendingUp className="size-3.5 text-emerald-600" strokeWidth={2} aria-hidden="true" />
                ) : (
                  <TrendingDown className="size-3.5 text-red-600" strokeWidth={2} aria-hidden="true" />
                )}
                {netPositive ? "Positif — pemasukan melebihi pengeluaran" : "Negatif — pengeluaran melebihi pemasukan"}
              </span>
            }
          />
        </div>
      )}

      {/* Filter cepat: arus transaksi + kategori */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedTabs
          tabs={[
            { value: "semua", label: "Semua Transaksi", count: monthEntries.length },
            { value: "masuk", label: "Pemasukan Saja", count: stats.masukCount },
            { value: "keluar", label: "Pengeluaran Saja", count: stats.keluarCount },
          ]}
          value={flow}
          onChange={(v) => setFlow(v as FlowFilter)}
          ariaLabel="Filter arus transaksi kas"
        />
        <Select value={categoryValue} onValueChange={setCategory}>
          <SelectTrigger
            className="h-8 w-full border-zinc-200 bg-white text-[12.5px] text-zinc-700 focus:ring-zinc-900/5 sm:w-64"
            aria-label="Filter kategori biaya"
          >
            <SelectValue placeholder="Semua Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[13px]">
              Semua Kategori
            </SelectItem>
            {categoryOptions.map((c) => (
              <SelectItem key={c} value={c} className="text-[13px]">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Desktop: tabel riwayat transaksi ── */}
      <div className="hidden max-h-[560px] overflow-auto overscroll-contain rounded-lg border border-border bg-white scrollbar-thin md:block">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <caption className="sr-only">Transaksi kas masuk dan keluar</caption>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${HEAD_CELL} pl-4 text-left`}>Tanggal</th>
              <th className={`${HEAD_CELL} text-left`}>Tipe</th>
              <th className={`${HEAD_CELL} text-left`}>Kategori</th>
              <th className={`${HEAD_CELL} text-left`}>Deskripsi</th>
              <th className={`${HEAD_CELL} text-right`}>Nominal</th>
              <th className={`${HEAD_CELL} text-left`}>Nota / Bukti</th>
              <th className={`${HEAD_CELL} pr-4 text-right`}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0 hover:bg-zinc-50/70">
                <td className="whitespace-nowrap py-2 pl-4 pr-3 text-[12.5px] tabular-nums text-zinc-700">
                  {e.dateLabel}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-xs font-semibold",
                      typePill(e.type)
                    )}
                  >
                    <FlowIcon type={e.type} className="size-3" />
                    {e.type === "masuk" ? "Masuk" : "Keluar"}
                  </span>
                  <SourceChip source={e.source} />
                </td>
                <td className="max-w-[220px] truncate px-3 py-2 text-[12.5px] font-medium text-zinc-800">
                  {e.category}
                </td>
                <td className="max-w-[300px] truncate px-3 py-2 text-[12.5px] text-zinc-600">
                  {e.description}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-right text-[13px] font-semibold tabular-nums",
                    e.type === "masuk" ? "text-emerald-700" : "text-red-600"
                  )}
                >
                  {e.type === "masuk" ? "+" : "−"}
                  {formatIDR(e.amount)}
                </td>
                <td className="px-3 py-2">
                  {e.attachment ? (
                    <button
                      onClick={() => setPreview(e)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-zinc-50 p-1 pr-2 text-[12.5px] text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                      aria-label={`Lihat nota transaksi ${e.id}`}
                    >
                      {isImageAttachment(e.attachment) ? (
                         
                        <img
                          src={e.attachment}
                          alt=""
                          className="size-6 shrink-0 rounded-sm border border-border object-cover"
                        />
                      ) : (
                        <ReceiptText className="size-4 shrink-0 text-zinc-700" strokeWidth={1.5} aria-hidden="true" />
                      )}
                      <span className="tabular-nums">{isImageAttachment(e.attachment) ? "Nota" : "Bukti"}</span>
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
                      {canModify && (
                        <>
                          {e.attachment && <DropdownMenuSeparator />}
                          {e.type === "keluar" && (
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(e);
                                setExpenseOpen(true);
                              }}
                              className="text-[13px]"
                            >
                              <PencilLine className="size-3.5 text-zinc-700" strokeWidth={1.75} />
                              Edit Pengeluaran
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => setConfirmDelete(e)}
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

        {filteredEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 border-t border-border px-6 py-12 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
              <ReceiptText className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <p className="text-[13px] font-semibold text-zinc-700">
              {monthEntries.length === 0 ? "Belum ada transaksi" : "Tidak ada transaksi yang cocok"}
            </p>
            <p className="max-w-[300px] text-[12.5px] leading-5 text-zinc-700">
              {monthEntries.length === 0
                ? `Tidak ada catatan kas untuk ${monthLabel}.`
                : "Coba ubah filter arus transaksi atau kategori biaya."}
            </p>
          </div>
        )}
      </div>

      {/* ── Mobile: kartu vertikal transaksi ── */}
      <div className="space-y-2.5 md:hidden">
        {filteredEntries.map((e) => (
          <div key={e.id} className="rounded-lg border border-border bg-white p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border",
                    typePill(e.type)
                  )}
                >
                  <FlowIcon type={e.type} className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-zinc-900">{e.category}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-4 text-zinc-600">
                    {e.description}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[11px] font-medium tabular-nums text-zinc-600">{e.dateLabel}</span>
                    <SourceChip source={e.source} />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <p
                  className={cn(
                    "whitespace-nowrap text-[14px] font-bold tabular-nums",
                    e.type === "masuk" ? "text-emerald-700" : "text-red-600"
                  )}
                >
                  {e.type === "masuk" ? "+" : "−"}
                  {formatIDR(e.amount)}
                </p>
                <div className="flex items-center gap-1">
                  {e.attachment && (
                    <button
                      onClick={() => setPreview(e)}
                      className="rounded-md border border-border bg-zinc-50 p-1 text-zinc-700 transition-colors hover:bg-zinc-100"
                      aria-label={`Lihat nota transaksi ${e.id}`}
                    >
                      {isImageAttachment(e.attachment) ? (
                         
                        <img src={e.attachment} alt="" className="size-6 rounded-sm object-cover" />
                      ) : (
                        <ReceiptText className="size-4" strokeWidth={1.5} aria-hidden="true" />
                      )}
                    </button>
                  )}
                  {(canModify || e.attachment) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-zinc-700 hover:bg-zinc-100"
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
                        {canModify && (
                          <>
                            {e.attachment && <DropdownMenuSeparator />}
                            {e.type === "keluar" && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(e);
                                  setExpenseOpen(true);
                                }}
                                className="text-[13px]"
                              >
                                <PencilLine className="size-3.5 text-zinc-700" strokeWidth={1.75} />
                                Edit Pengeluaran
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => setConfirmDelete(e)}
                              className="text-[13px] text-red-600 focus:text-red-700"
                            >
                              <Trash2 className="size-3.5" strokeWidth={1.75} />
                              Hapus Catatan
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-white px-6 py-10 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
              <ReceiptText className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <p className="text-[13px] font-semibold text-zinc-700">
              {monthEntries.length === 0 ? "Belum ada transaksi" : "Tidak ada transaksi yang cocok"}
            </p>
            <p className="max-w-[280px] text-[12.5px] leading-5 text-zinc-700">
              {monthEntries.length === 0
                ? `Tidak ada catatan kas untuk ${monthLabel}.`
                : "Coba ubah filter arus transaksi atau kategori biaya."}
            </p>
          </div>
        )}
      </div>

      {/* Preview bukti transaksi — nota asli (dataURL) atau referensi file demo */}
      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto bg-white p-0 sm:max-w-[380px] scrollbar-thin">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="text-[14px] font-bold tracking-tight text-zinc-900">
              Bukti Transaksi
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-zinc-700">{preview?.id}</DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-3 bg-zinc-50 p-5">
              {isImageAttachment(preview.attachment) ? (
                 
                <img
                  src={preview.attachment}
                  alt={`Foto nota — ${preview.description}`}
                  className="max-h-[420px] w-full rounded-lg border border-border object-contain bg-white"
                />
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-white text-center">
                  <ReceiptText className="size-8 text-zinc-300" strokeWidth={1.25} aria-hidden="true" />
                  <p className="font-mono text-[12.5px] font-medium text-zinc-700">{preview.attachment}</p>
                  <p className="text-xs text-zinc-300">Pratinjau lampiran</p>
                </div>
              )}
              <div className="rounded-md border border-border bg-white px-3 py-2.5 text-[12.5px]">
                <p className="font-medium text-zinc-800">{preview.description}</p>
                <p className="mt-0.5 text-zinc-700">
                  {preview.category} · <span className="tabular-nums">{preview.dateLabel}</span>
                </p>
                {preview.source && (
                  <p className="mt-0.5 text-zinc-700">
                    <SourceChip source={preview.source} />
                  </p>
                )}
                <p
                  className={cn(
                    "mt-1 text-[14px] font-bold tabular-nums",
                    preview.type === "masuk" ? "text-emerald-700" : "text-red-600"
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

      {/* Konfirmasi hapus transaksi */}
      <AlertDialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="max-w-[380px] gap-0 p-0">
          <AlertDialogHeader className="border-b border-border px-5 py-4">
            <AlertDialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-900">
              <span className="flex size-6 items-center justify-center rounded-md bg-red-100 text-red-600">
                <Trash2 className="size-3.5" strokeWidth={2} aria-hidden="true" />
              </span>
              Hapus Transaksi Ini?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12.5px] leading-5 text-zinc-700">
              {confirmDelete && (
                <>
                  Transaksi <span className="font-mono font-semibold text-zinc-800">{confirmDelete.id}</span> —{" "}
                  {confirmDelete.description} ({formatIDR(confirmDelete.amount)}) akan dihapus permanen dari
                  Buku Kas dan rekap laba bersih diperbarui otomatis.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 border-t border-border bg-zinc-50 px-5 py-3.5 sm:justify-end">
            <AlertDialogCancel className="h-9 border-zinc-200 bg-white text-[13px] text-zinc-700 shadow-none hover:bg-zinc-100">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) onDeleteEntry(confirmDelete);
                setConfirmDelete(null);
              }}
              className="h-9 bg-red-600 text-[13px] font-semibold text-white shadow-none hover:bg-red-700"
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal catat / edit pengeluaran — key remount agar prefill edit akurat */}
      <ExpenseModal
        key={editing?.id ?? "new"}
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        onSubmit={(draft) => {
          if (editing) onUpdateExpense(editing, draft);
          else onAddExpense(draft);
        }}
        initial={
          editing
            ? {
                category: editing.category as ExpenseDraft["category"],
                amount: editing.amount,
                tanggal: isoFromLabel(editing.dateLabel),
                description: editing.description,
                source: editing.source ?? "Kas Tunai",
                attachment: editing.attachment,
              }
            : null
        }
      />
    </div>
  );
}

/** "26 Sep 2026" → "2026-09-26" (input type=date) */
function isoFromLabel(label: string): string {
  const [d, m, y] = label.split(" ");
  const idx = MONTH_NAMES.indexOf((m ?? "") as (typeof MONTH_NAMES)[number]) + 1;
  if (!y || !idx) return "";
  return `${y}-${String(idx).padStart(2, "0")}-${String(Number(d)).padStart(2, "0")}`;
}
