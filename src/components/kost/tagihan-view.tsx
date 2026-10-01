"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  Search,
  Users,
} from "lucide-react";
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
import { formatIDR, type Room } from "@/lib/kost-data";
import { portalLink } from "@/lib/tenant-portal";
import {
  buildMonthOptions,
  computeInvoiceStats,
  currentPeriodKey,
  invoiceBadgeLabel,
  periodShortLabel,
  type Invoice,
  type InvoiceLine,
  type InvoiceStatus,
  type WaBillingContext,
} from "@/lib/kost-invoices";
import { SegmentedTabs, type SegmentedTabItem } from "./segmented-tabs";
import { InvoiceTable } from "./invoice-table";
import { InvoiceEditModal } from "./invoice-edit-modal";
import { ReceiptPreviewModal } from "./receipt-preview-modal";
import { WaReminderModal } from "./wa-reminder-modal";
import { MetricCard } from "./metric-card";

type StatusTab = InvoiceStatus | "all";

interface TagihanViewProps {
  /** Lifted to the dashboard — updates live when rooms are deleted / data is reset */
  invoices: Invoice[];
  /** Kamar (utk hitungan kamar terisi & tautan portal penyewa di pesan WA) */
  rooms: Room[];
  query: string;
  onQueryChange: (q: string) => void;
  propertyName: string;
  /** Nama pengelola (dari profil) — tercantum di kwitansi digital */
  ownerName: string;
  /** Rekening pembayaran aktif (cloud) — dicantumkan di pesan tagihan WA */
  bank: { bank: string; number: string; holder: string };
  /** QRIS statis terunggah → pratinjau pesan WA menyebut opsi QRIS */
  qrisAvailable?: boolean;
  /** Generator tagihan bulanan — POST /api/invoices (anti-duplikat server-side) */
  onGenerate: (periodKey: string) => Promise<void>;
  onMarkPaid: (inv: Invoice) => void;
  /** "Simpan & Siap Ditagih" — PATCH rincian add-on */
  onUpdateLines: (inv: Invoice, lines: InvoiceLine[]) => void;
  /** Tombol hijau "Tagih via WhatsApp" — buka wa.me langsung (page handler) */
  onTagihWa: (inv: Invoice) => void;
  /** Kirim kwitansi lunas via WA (page handler) */
  onReceiptWa: (inv: Invoice) => void;
  onCancelInvoice: (inv: Invoice) => void;
}

export function TagihanView({
  invoices,
  rooms,
  query,
  onQueryChange,
  propertyName,
  ownerName,
  bank,
  qrisAvailable,
  onGenerate,
  onMarkPaid,
  onUpdateLines,
  onTagihWa,
  onReceiptWa,
  onCancelInvoice,
}: TagihanViewProps) {
  // Periode dinamis — default bulan & tahun berjalan (new Date())
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [monthKey, setMonthKey] = useState(currentPeriodKey);
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [generating, setGenerating] = useState(false);

  // Modal states
  const [waInvoice, setWaInvoice] = useState<Invoice | null>(null);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);
  const [savingLines, setSavingLines] = useState(false);
  const [waExtra, setWaExtra] = useState(0);
  const waCount = (invoices.length > 0 ? 18 : 0) + waExtra;

  const occupiedCount = useMemo(() => rooms.filter((r) => r.tenant).length, [rooms]);

  // Metrics & tabs reflect the selected period
  const stats = useMemo(
    () => computeInvoiceStats(invoices.filter((i) => i.periodKey === monthKey)),
    [invoices, monthKey]
  );

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
      belumBayar: monthInvoices.filter((i) => i.status === "belumBayar").length,
      menunggak: monthInvoices.filter((i) => i.status === "menunggak").length,
      jatuhTempo: monthInvoices.filter((i) => i.status === "jatuhTempo").length,
      verifikasi: monthInvoices.filter((i) => i.status === "verifikasi").length,
      lunas: monthInvoices.filter((i) => i.status === "lunas").length,
    }),
    [monthInvoices]
  );

  const monthLabel = periodShortLabel(monthKey);
  const isCurrentMonth = monthKey === currentPeriodKey();

  /** Satu sumber data tab status — dirender segmented (sm+) & pill geser (ponsel) */
  const statusTabs: SegmentedTabItem<StatusTab>[] = [
    { value: "all", label: "Semua", count: monthCounts.all },
    { value: "belumBayar", label: "Belum Bayar", count: monthCounts.belumBayar },
    { value: "menunggak", label: "Menunggak", count: monthCounts.menunggak },
    { value: "jatuhTempo", label: "Jatuh Tempo H-3", count: monthCounts.jatuhTempo },
    { value: "verifikasi", label: "Menunggu Verifikasi", count: monthCounts.verifikasi },
    { value: "lunas", label: "Lunas", count: monthCounts.lunas },
  ];

  /** Konteks pesan WA utk pratinjau — link portal mengikuti origin aktif */
  const waContextFor = (inv: Invoice): WaBillingContext => {
    const origin = typeof window === "undefined" ? undefined : window.location.origin;
    const token = rooms.find((r) => r.id === inv.roomId)?.tenant?.portalToken;
    return {
      propertyName,
      bank,
      portalUrl: token ? portalLink(token, origin) : `${origin ?? "https://unitku.id"}/portal`,
      qrisAvailable,
    };
  };

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      await onGenerate(monthKey);
    } finally {
      setGenerating(false);
    }
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

  const handleSaveLines = (inv: Invoice, lines: InvoiceLine[]) => {
    setSavingLines(true);
    try {
      onUpdateLines(inv, lines);
    } finally {
      setSavingLines(false);
      setEditInvoice(null);
    }
  };

  const exportCsv = () => {
    const rows = invoices.filter((i) => i.periodKey === monthKey);
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
    a.download = `unitku-tagihan-${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Laporan CSV diunduh", { description: `${rows.length} invoice · ${monthLabel}` });
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">Tagihan &amp; Pembayaran</h1>
          <p className="mt-0.5 max-w-xl text-[12.5px] text-zinc-700">
            Generator tagihan bulanan, tagih via WhatsApp, dan pantau pembayaran sewa
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
        </div>
      </div>

      {/* ── Generator Tagihan Bulanan — panel aksi atas ─────────────────────── */}
      <section
        aria-label="Generator tagihan bulanan"
        className="rounded-lg border border-border bg-white p-3 sm:p-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-[13px] font-bold tracking-tight text-zinc-900">
              Generator Tagihan Bulanan
            </h2>
            <p className="mt-0.5 text-[12.5px] text-zinc-700">
              Pindai semua kamar terisi &amp; terbitkan draft tagihan periode terpilih — duplikasi
              dicegah otomatis per kamar.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Selector periode bulan & tahun (default: bulan berjalan) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 w-full justify-between border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50 sm:w-auto sm:justify-center sm:gap-2 lg:w-[190px]"
                >
                  <span className="flex items-center gap-2">
                    <CalendarDays className="size-3.5 text-zinc-700" strokeWidth={1.75} />
                    {monthLabel}
                  </span>
                  {isCurrentMonth && (
                    <span className="rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-xs font-semibold text-emerald-700">
                      Bulan Berjalan
                    </span>
                  )}
                  <ChevronDown className="size-3.5 text-zinc-700 sm:hidden lg:inline" strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs text-zinc-700">Periode Tagihan</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {monthOptions.map((m) => (
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

            {/* Tombol utama generator */}
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="h-9 bg-zinc-900 px-3 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800 disabled:opacity-70"
            >
              {generating ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Plus className="size-4" strokeWidth={2} />
              )}
              {generating ? "Memindai kamar…" : "Generate Tagihan Bulan Ini"}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2.5 text-[12.5px] text-zinc-700">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
            {occupiedCount} kamar terisi siap ditagih
          </span>
          <span className="tabular-nums">
            {monthCounts.all} tagihan sudah terbit untuk {monthLabel}
          </span>
          <span className="tabular-nums text-zinc-700">
            {monthCounts.belumBayar + monthCounts.menunggak + monthCounts.jatuhTempo} belum bayar
          </span>
        </div>
      </section>

      {/* Metric summary — ponsel: 2 kolom rapat dgn tipografi proporsional */}
      <section aria-label="Ringkasan tagihan" className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <MetricCard
          dot="bg-zinc-300"
          label={`Total Tagihan ${monthLabel}`}
          mobileLabel="Total Tagihan"
          value={formatIDR(stats.totalBilled)}
          sub={`${stats.totalCount} invoice · ${monthLabel}`}
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
          sub={`${stats.unpaidCount} kamar · ${stats.byStatus.belumBayar} baru · ${stats.byStatus.menunggak} menunggak`}
          valueClass="text-rose-600"
        />
        <MetricCard
          dot="bg-emerald-500"
          label="Pengingat Terkirim"
          mobileLabel="Pengingat WA"
          value={String(waCount)}
          unit="WA Sent"
          sub={`via WhatsApp · ${monthLabel}`}
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

        {/* Info periode aktif (selector periode ada di panel Generator di atas) */}
        <div className="w-full sm:ml-auto sm:w-auto">
          <span className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-[13px] font-medium text-zinc-700 sm:w-auto">
            <CalendarDays className="size-3.5 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
            Periode {monthLabel}
            {isCurrentMonth && (
              <span className="rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-xs font-semibold text-emerald-700">
                Bulan Berjalan
              </span>
            )}
          </span>
        </div>
      </section>

      {/* Invoices table */}
      <InvoiceTable
        invoices={filtered}
        onTagihWa={onTagihWa}
        onReceiptWa={onReceiptWa}
        onPreviewWa={(inv) => setWaInvoice(inv)}
        onMarkPaid={onMarkPaid}
        onVerify={handleVerify}
        onEdit={(inv) => setEditInvoice(inv)}
        onCancel={handleCancel}
        onReceipt={(inv) => setReceiptInvoice(inv)}
        emptyTitle={isCurrentMonth ? "Tidak ada invoice yang cocok" : `Tidak ada tagihan untuk ${monthLabel}`}
        emptyDescription={
          isCurrentMonth
            ? "Coba ubah filter status atau kata kunci pencarian."
            : `Belum ada tagihan terbit untuk ${monthLabel} — gunakan Generator Tagihan Bulanan di atas.`
        }
      />

      <p className="text-xs text-zinc-700">
        Menampilkan {filtered.length} dari {invoices.length} invoice · {monthLabel}
      </p>

      {/* Modal Edit / Tambah Biaya (sebelum tagihan dikirim) */}
      <InvoiceEditModal
        invoice={editInvoice}
        open={editInvoice !== null}
        onOpenChange={(o) => {
          if (!o) setEditInvoice(null);
        }}
        onSave={handleSaveLines}
        saving={savingLines}
      />

      {/* Modal pratinjau kwitansi digital (menu titik tiga "Lihat Kwitansi") */}
      <ReceiptPreviewModal
        invoice={receiptInvoice}
        open={receiptInvoice !== null}
        onOpenChange={(o) => {
          if (!o) setReceiptInvoice(null);
        }}
        propertyName={propertyName}
        ownerName={ownerName}
        context={receiptInvoice ? waContextFor(receiptInvoice) : null}
      />

      {/* WA preview modal (pratinjau & salin pesan) */}
      <WaReminderModal
        invoice={waInvoice}
        open={waInvoice !== null}
        onOpenChange={(o) => {
          if (!o) setWaInvoice(null);
        }}
        context={waInvoice ? waContextFor(waInvoice) : null}
        onSent={handleSent}
      />
    </div>
  );
}
