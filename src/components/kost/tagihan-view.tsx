"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Download, FileSpreadsheet, FileText, Plus, Search } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatIDR } from "@/lib/kost-data";
import {
  computeInvoiceStats,
  CURRENT_PERIOD_KEY,
  invoiceBadgeLabel,
  MONTH_OPTIONS,
  type Invoice,
  type InvoiceStatus,
} from "@/lib/kost-invoices";
import { SegmentedTabs, type SegmentedTabItem } from "./segmented-tabs";
import { InvoiceTable } from "./invoice-table";
import { WaReminderModal } from "./wa-reminder-modal";
import { MetricCard } from "./metric-card";

type StatusTab = InvoiceStatus | "all";

interface TagihanViewProps {
  /** Lifted to the dashboard — updates live when rooms are deleted / data is reset */
  invoices: Invoice[];
  query: string;
  onQueryChange: (q: string) => void;
  propertyName: string;
  onMarkPaid: (inv: Invoice) => void;
  onCancelInvoice: (inv: Invoice) => void;
}

export function TagihanView({
  invoices,
  query,
  onQueryChange,
  propertyName,
  onMarkPaid,
  onCancelInvoice,
}: TagihanViewProps) {
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [monthKey, setMonthKey] = useState(CURRENT_PERIOD_KEY);
  const [waInvoice, setWaInvoice] = useState<Invoice | null>(null);
  const [waExtra, setWaExtra] = useState(0);
  // Base reminder count tracks the (possibly reset) dataset; extra bumps are session-local.
  const waCount = (invoices.length > 0 ? 18 : 0) + waExtra;

  // Metrics are pinned to the current month ("Bulan Berjalan")
  const stats = useMemo(
    () => computeInvoiceStats(invoices.filter((i) => i.periodKey === CURRENT_PERIOD_KEY)),
    [invoices]
  );

  // Tabs & table reflect the selected month
  const monthInvoices = useMemo(
    () => invoices.filter((i) => i.periodKey === monthKey),
    [invoices, monthKey]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return monthInvoices
      .filter((i) => (statusTab === "all" ? true : i.status === statusTab))
      .filter(
        (i) =>
          !q ||
          i.roomId.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q) ||
          (i.tenantName?.toLowerCase().includes(q) ?? false)
      )
      .sort((a, b) => a.roomId.localeCompare(b.roomId));
  }, [monthInvoices, statusTab, query]);

  const monthCounts = useMemo(
    () => ({
      all: monthInvoices.length,
      menunggak: monthInvoices.filter((i) => i.status === "menunggak").length,
      jatuhTempo: monthInvoices.filter((i) => i.status === "jatuhTempo").length,
      verifikasi: monthInvoices.filter((i) => i.status === "verifikasi").length,
      lunas: monthInvoices.filter((i) => i.status === "lunas").length,
    }),
    [monthInvoices]
  );

  const monthLabel = MONTH_OPTIONS.find((m) => m.key === monthKey)?.label ?? monthKey;
  const isCurrentMonth = monthKey === CURRENT_PERIOD_KEY;

  /** Satu sumber data tab status — dirender segmented (sm+) & pill geser (ponsel) */
  const statusTabs: SegmentedTabItem<StatusTab>[] = [
    { value: "all", label: "Semua", count: monthCounts.all },
    { value: "menunggak", label: "Menunggak", count: monthCounts.menunggak },
    { value: "jatuhTempo", label: "Jatuh Tempo H-3", count: monthCounts.jatuhTempo },
    { value: "verifikasi", label: "Menunggu Verifikasi", count: monthCounts.verifikasi },
    { value: "lunas", label: "Lunas", count: monthCounts.lunas },
  ];

  const handleMarkPaid = (inv: Invoice) => {
    onMarkPaid(inv);
  };

  const handleVerify = (inv: Invoice) => {
    onMarkPaid(inv);
    toast.info(`Pembayaran ${inv.id} dikonfirmasi`, {
      description: `Transfer ${inv.tenantName ?? "penyewa"} terverifikasi oleh owner.`,
    });
  };

  const handleCancel = (inv: Invoice) => {
    onCancelInvoice(inv);
  };

  const handleSent = (_inv: Invoice) => {
    setWaExtra((c) => c + 1);
  };

  const exportCsv = () => {
    const rows = invoices.filter((i) => i.periodKey === CURRENT_PERIOD_KEY);
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = rows.map((i) =>
      [i.id, i.roomId, i.tenantName ?? "Kamar kosong", i.periodLabel, i.dueDate, i.total, invoiceBadgeLabel(i)]
        .map(esc)
        .join(",")
    );
    const csv = "\uFEFF" + ["No Invoice,Kamar,Penghuni,Periode,Jatuh Tempo,Total (IDR),Status", ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "unitku-tagihan-sep-2026.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Laporan CSV diunduh", { description: `${rows.length} invoice · Sep 2026` });
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">Tagihan &amp; Pembayaran</h1>
          <p className="mt-0.5 max-w-xl text-[12.5px] text-zinc-700">
            Kelola invoice sewa bulanan, tagihan tambahan, dan pengingat WhatsApp
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-9 border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
              >
                <Download className="size-3.5 text-zinc-700" strokeWidth={1.75} />
                <span className="hidden sm:inline">Export Laporan (.CSV/.PDF)</span>
                <span className="sm:hidden">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs text-zinc-700">Unduh Laporan</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportCsv} className="text-[13px]">
                <FileSpreadsheet />
                Ekspor CSV
                <span className="ml-auto text-xs text-zinc-700">siap</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  toast.info("Ekspor PDF", {
                    description: "Render PDF server-side tersedia pada fase pengembangan berikutnya — gunakan CSV untuk saat ini.",
                  })
                }
                className="text-[13px]"
              >
                <FileText />
                Ekspor PDF
                <span className="ml-auto text-xs text-zinc-700">next</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={() =>
              toast.info(
                invoices.length > 0
                  ? `Semua ${invoices.length} kamar sudah ditagih untuk Sep 2026.`
                  : "Belum ada data tagihan — tambahkan kamar & penghuni terlebih dahulu.",
                {
                  description: "Tagihan tambahan (listrik, laundry, denda) dapat dibuat pada fase pengembangan berikutnya.",
                }
              )
            }
            className="h-9 bg-zinc-900 px-3 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800"
          >
            <Plus className="size-4" strokeWidth={2} />
            <span className="hidden sm:inline">Buat Tagihan Baru</span>
            <span className="sm:hidden">Tagihan</span>
          </Button>
        </div>
      </div>

      {/* Metric summary — ponsel: 2 kolom rapat dgn tipografi proporsional */}
      <section aria-label="Ringkasan tagihan" className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <MetricCard
          dot="bg-zinc-300"
          label="Total Tagihan Bulan Ini"
          mobileLabel="Total Tagihan"
          value={formatIDR(stats.totalBilled)}
          sub={`${stats.totalCount} invoice · ${stats.totalCount} kamar`}
        />
        <MetricCard
          dot="bg-emerald-500"
          label="Sudah Diterima"
          value={formatIDR(stats.received)}
          badge={`${stats.receivedPct}%`}
          sub={`${stats.byStatus.lunas} lunas + ${stats.byStatus.verifikasi} menunggu verifikasi`}
        />
        <MetricCard
          dot="bg-rose-500"
          label="Belum Bayar / Menunggak"
          mobileLabel="Belum Bayar"
          value={formatIDR(stats.unpaid)}
          sub={`${stats.unpaidCount} kamar · ${stats.byStatus.menunggak} menunggak · ${stats.byStatus.jatuhTempo} jatuh tempo`}
          valueClass="text-rose-600"
        />
        <MetricCard
          dot="bg-emerald-500"
          label="Pengingat Terkirim"
          mobileLabel="Pengingat WA"
          value={String(waCount)}
          unit="WA Sent"
          sub="via WhatsApp · Sep 2026"
        />
      </section>

      {/* Filter & control bar — ponsel: tiap kontrol satu baris penuh */}
      <section
        aria-label="Filter tagihan"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-white p-2"
      >
        {/* Pencarian — selebar penuh di ponsel */}
        <div className="relative w-full sm:min-w-[200px] sm:max-w-[280px] sm:flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-700"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Filter penghuni / no. kamar…"
            aria-label="Filter invoice berdasarkan penghuni atau nomor kamar"
            className="h-9 w-full rounded-md border border-border bg-zinc-50 pl-8 pr-3 text-[13px] text-zinc-900 placeholder:text-zinc-600 focus:border-zinc-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
          />
        </div>

        {/* Tab status — ponsel: pill geser horizontal tanpa scrollbar */}
        <div
          role="tablist"
          aria-label="Filter status invoice"
          className="flex w-full items-center gap-2 overflow-x-auto overscroll-x-contain no-scrollbar sm:hidden"
        >
          {statusTabs.map((tab) => {
            const active = statusTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusTab(tab.value)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium transition-all",
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                )}
              >
                {tab.label}
                <span className={cn("text-xs tabular-nums", active ? "text-zinc-300" : "text-zinc-700")}>
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab status — segmented control (sm+) */}
        <div className="order-3 hidden w-full sm:block lg:order-none lg:w-auto">
          <SegmentedTabs<StatusTab>
            ariaLabel="Filter status invoice"
            value={statusTab}
            onChange={setStatusTab}
            tabs={statusTabs}
          />
        </div>

        {/* Periode — ponsel: baris sendiri selebar penuh agar dropdown tidak sempit */}
        <div className="w-full sm:ml-auto sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-9 w-full justify-center border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50 sm:w-auto"
              >
                <CalendarDays className="size-3.5 text-zinc-700" strokeWidth={1.75} />
                {monthLabel}
                {isCurrentMonth && (
                  <span className="rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-xs font-semibold text-emerald-700">
                    Bulan Berjalan
                  </span>
                )}
                <ChevronDown className="size-3.5 text-zinc-700" strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs text-zinc-700">Periode Tagihan</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {MONTH_OPTIONS.map((m) => (
                <DropdownMenuItem
                  key={m.key}
                  onClick={() => setMonthKey(m.key)}
                  className="justify-between text-[13px]"
                >
                  <span className="flex items-center gap-2">
                    {m.label}
                    {m.tag && (
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-xs font-semibold text-emerald-700">
                        {m.tag}
                      </span>
                    )}
                  </span>
                  {monthKey === m.key && <span className="text-xs text-zinc-700">aktif</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>

      {/* Invoices table */}
      <InvoiceTable
        invoices={filtered}
        onSendWa={(inv) => setWaInvoice(inv)}
        onMarkPaid={handleMarkPaid}
        onVerify={handleVerify}
        onEdit={(inv) =>
          toast.info("Edit tagihan", { description: `${inv.id} — formulir edit tersedia di Phase 3.` })
        }
        onCancel={handleCancel}
        onReceipt={(inv) =>
          toast.info("Kwitansi", {
            description: `${inv.id} · ${formatIDR(inv.total)} — pratinjau kwitansi menyusul di Phase 3.`,
          })
        }
        emptyTitle={isCurrentMonth ? "Tidak ada invoice yang cocok" : `Tidak ada invoice untuk ${monthLabel}`}
        emptyDescription={
          isCurrentMonth
            ? "Coba ubah filter status atau kata kunci pencarian."
            : "Data mock hanya tersedia untuk Sep 2026 (bulan berjalan)."
        }
      />

      <p className="text-xs text-zinc-700">
        Menampilkan {filtered.length} dari {invoices.length} invoice · {monthLabel}
      </p>

      {/* WA reminder modal */}
      <WaReminderModal
        invoice={waInvoice}
        open={waInvoice !== null}
        onOpenChange={(o) => {
          if (!o) setWaInvoice(null);
        }}
        propertyName={propertyName}
        onSent={handleSent}
      />
    </div>
  );
}
