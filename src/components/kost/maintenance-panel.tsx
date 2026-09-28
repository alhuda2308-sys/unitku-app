"use client";

import { useMemo, useState } from "react";
import {
  AirVent,
  Building2,
  Check,
  Droplets,
  Hammer,
  ImageOff,
  Info,
  KeyRound,
  Phone,
  Plus,
  Search,
  ShowerHead,
  Wrench,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { initialsOf, waLink, type Room } from "@/lib/kost-data";
import { BRAND_WA_LINE } from "@/lib/brand";
import {
  ONCALL_TEKNISI,
  sortTicketsNewestFirst,
  ticketSubject,
  TICKET_STATUS_META,
  TICKET_STATUSES,
  TICKET_URGENSI_META,
  computeTicketStats,
  type CreateTicketDraft,
  type Ticket,
  type TicketCategory,
  type TicketContact,
  type TicketStatus,
} from "@/lib/ticket-data";
import { MetricCard } from "./metric-card";
import { SegmentedTabs } from "./segmented-tabs";
import { MobileFilterSelect } from "./mobile-filter-select";
import { WaIcon } from "./wa-icon";
import { CreateTicketModal } from "./create-ticket-modal";

type StatusTab = TicketStatus | "all";

interface MaintenancePanelProps {
  tickets: Ticket[];
  /** Rooms provide the "Pilih Kamar & Penyewa" dropdown in the create modal */
  rooms: Room[];
  query: string;
  onQueryChange: (q: string) => void;
  onStatusChange: (ticket: Ticket, status: TicketStatus) => void;
  /** Parent creates the ticket (live metric + sidebar badge update); returns the new id */
  onCreateTicket: (draft: CreateTicketDraft) => string;
}

const CATEGORY_ICON: Record<TicketCategory, typeof AirVent> = {
  AC: AirVent,
  "Kelistrikan/Lampu": Zap,
  "Sanitasi/Air/Plumbing": ShowerHead,
  "Kebocoran/Atap": Droplets,
  "Kunci/Pintu": KeyRound,
  Lainnya: Hammer,
};

function CategoryIcon({ kategori }: { kategori: TicketCategory }) {
  const Icon = CATEGORY_ICON[kategori];
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-zinc-50 text-zinc-700"
      aria-hidden="true"
    >
      <Icon className="size-3.5" strokeWidth={1.75} />
    </span>
  );
}

/** Build the prefilled WhatsApp text for penyewa / teknisi contact */
function buildWaText(ticket: Ticket, role: "penyewa" | "teknisi"): string {
  if (role === "penyewa") {
    return [
      `Halo ${ticket.reporterName},`,
      `menindaklanjuti laporan ${ticket.kategori} pada ${ticket.id} (${ticketSubject(ticket)}).`,
      `Laporan sudah kami terima dan akan segera dijadwalkan ke teknisi. Terima kasih atas laporannya.`,
      `${BRAND_WA_LINE}.`,
    ].join(" ");
  }
  const teknisi = ticket.teknisi ?? ONCALL_TEKNISI;
  return [
    `Halo ${teknisi.name}, saya Hendra (Owner Kost Griya Pratama).`,
    `Mohon bantuan penanganan ${ticket.id} — ${ticket.kategori} di ${ticketSubject(ticket)}:`,
    `"${ticket.deskripsi}"`,
    `Mohon konfirmasi jadwalnya. Terima kasih.`,
    `${BRAND_WA_LINE}.`,
  ].join(" ");
}

const HEAD_CELL =
  "h-9 bg-white px-3 text-xs font-semibold uppercase tracking-wide text-zinc-700 shadow-[inset_0_-1px_0_var(--border)]";

/** Kartu tiket komplain untuk layar ponsel (< md): pelapor + unit + status —
 *  keluhan (judul, urgensi, deskripsi, foto) — aksi Ubah Status & Chat WA. */
function MobileTicketCard({
  ticket,
  onStatusChange,
  onOpenWa,
  onZoom,
}: {
  ticket: Ticket;
  onStatusChange: (ticket: Ticket, status: TicketStatus) => void;
  onOpenWa: (ticket: Ticket, role: "penyewa" | "teknisi") => void;
  onZoom: (src: string, ticket: Ticket) => void;
}) {
  const meta = TICKET_STATUS_META[ticket.status];
  const urgensi = TICKET_URGENSI_META[ticket.urgensi];
  const isFasilitas = ticket.sumber === "fasilitas";
  return (
    <li className="rounded-lg border border-border bg-white p-3">
      {/* Header: pelapor + unit + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {isFasilitas ? (
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-zinc-50 text-zinc-700"
              aria-hidden="true"
            >
              <Building2 className="size-4" strokeWidth={1.75} />
            </span>
          ) : (
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-700"
              aria-hidden="true"
            >
              {initialsOf(ticket.reporterName)}
            </span>
          )}
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-semibold text-zinc-900">
              {isFasilitas ? ticket.lokasi : ticket.reporterName}
            </span>
            <span className="block truncate text-[12.5px] text-zinc-700">
              {ticketSubject(ticket)} · {isFasilitas ? "Pemeliharaan · Pengelola" : ticket.reportedLabel}
            </span>
          </span>
        </div>
        <span
          className={cn(
            "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full border px-2 text-xs font-semibold leading-none whitespace-nowrap",
            meta.pill
          )}
        >
          <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden="true" />
          {meta.label}
        </span>
      </div>

      {/* Keluhan */}
      <div className="mt-2.5 border-t border-border pt-2.5">
        <div className="flex items-center gap-2">
          <CategoryIcon kategori={ticket.kategori} />
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-zinc-900">
            {ticket.judul}
          </span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-xs font-semibold leading-none",
              urgensi.pill
            )}
          >
            <span className={cn("size-1 rounded-full", urgensi.dot)} aria-hidden="true" />
            {urgensi.label}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-4 text-zinc-700">
          {ticket.kategori} — {ticket.deskripsi}
        </p>
        {ticket.photos.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            {ticket.photos.slice(0, 3).map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => onZoom(src, ticket)}
                className="overflow-hidden rounded-md border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30"
                aria-label={`Perbesar foto lampiran ${ticket.id} #${i + 1}`}
              >
                <img
                  src={src}
                  alt={`Foto kerusakan ${ticket.kategori} ${ticketSubject(ticket)}`}
                  className="size-11 object-cover"
                />
              </button>
            ))}
            {ticket.photos.length > 3 && (
              <span className="inline-flex h-11 min-w-11 items-center justify-center rounded-md border border-border bg-zinc-50 px-1 text-xs font-semibold tabular-nums text-zinc-700">
                +{ticket.photos.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer: aksi */}
      <div className="mt-2.5 flex items-center gap-2 border-t border-border pt-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-8 flex-1 border-zinc-200 bg-white px-2 text-[12.5px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
              aria-label={`Ubah status tiket ${ticket.id}, saat ini ${meta.label}`}
            >
              <Check className="size-3.5" strokeWidth={2} />
              Ubah Status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-xs text-zinc-700">Ubah Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {TICKET_STATUSES.map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => onStatusChange(ticket, s)}
                className="justify-between text-[13px]"
              >
                <span className="flex items-center gap-2">
                  <span className={cn("size-1.5 rounded-full", TICKET_STATUS_META[s].dot)} />
                  {TICKET_STATUS_META[s].label}
                </span>
                {s === ticket.status && <Check className="size-3.5 text-zinc-900" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-8 flex-1 border-green-200 bg-green-50 px-2 text-[12.5px] font-medium text-green-700 shadow-none hover:bg-green-100 hover:text-green-800"
              aria-label={`Chat WhatsApp Penyewa atau Teknisi untuk ${ticket.id}`}
            >
              <WaIcon className="size-3.5" />
              Chat WA
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="text-xs text-zinc-700">
              Chat WA Penyewa / Teknisi
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {!isFasilitas && (
              <DropdownMenuItem onClick={() => onOpenWa(ticket, "penyewa")} className="text-[13px]">
                <WaIcon className="size-3.5 text-green-600" />
                <span className="min-w-0 flex-1 truncate">Chat Penyewa — {ticket.reporterName}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onOpenWa(ticket, "teknisi")} className="text-[13px]">
              <Wrench className="size-3.5 text-zinc-700" />
              <span className="min-w-0 flex-1 truncate">
                Chat Teknisi — {(ticket.teknisi ?? ONCALL_TEKNISI).name}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

export function MaintenancePanel({
  tickets,
  rooms,
  query,
  onQueryChange,
  onStatusChange,
  onCreateTicket,
}: MaintenancePanelProps) {
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [zoom, setZoom] = useState<{ src: string; ticket: Ticket } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const stats = useMemo(() => computeTicketStats(tickets), [tickets]);

  const counts = useMemo(
    () => ({
      all: tickets.length,
      menunggu: stats.byStatus.menunggu,
      dikerjakan: stats.byStatus.dikerjakan,
      selesai: stats.byStatus.selesai,
    }),
    [tickets.length, stats]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortTicketsNewestFirst(tickets)
      .filter((t) => (statusTab === "all" ? true : t.status === statusTab))
      .filter(
        (t) =>
          !q ||
          t.id.toLowerCase().includes(q) ||
          (t.roomId ?? "").toLowerCase().includes(q) ||
          (t.lokasi ?? "").toLowerCase().includes(q) ||
          t.judul.toLowerCase().includes(q) ||
          t.reporterName.toLowerCase().includes(q) ||
          t.kategori.toLowerCase().includes(q) ||
          t.deskripsi.toLowerCase().includes(q)
      );
  }, [tickets, statusTab, query]);

  const openWa = (ticket: Ticket, role: "penyewa" | "teknisi") => {
    const contact: TicketContact =
      role === "penyewa"
        ? { name: ticket.reporterName, phone: ticket.reporterPhone }
        : (ticket.teknisi ?? ONCALL_TEKNISI);
    const url = `${waLink(contact.phone)}?text=${encodeURIComponent(buildWaText(ticket, role))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-5">
      {/* Page header — title row with the primary create action per spec */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">Komplain &amp; Pemeliharaan</h1>
          <p className="mt-0.5 max-w-xl text-[12.5px] text-zinc-700">
            Kelola laporan fasilitas dari penyewa, penugasan teknisi, dan pemeliharaan properti
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1.5 text-[12.5px] text-zinc-600">
            <Phone className="size-3.5 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
            <span className="text-zinc-700">On-call:</span>
            <span className="font-medium text-zinc-800">{ONCALL_TEKNISI.name}</span>
            <span className="tabular-nums text-zinc-700">{ONCALL_TEKNISI.phone}</span>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="h-9 bg-zinc-900 px-3 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800"
          >
            <Plus className="size-4" strokeWidth={2.25} aria-hidden="true" />
            Buat Laporan Komplain / Maintenance
          </Button>
        </div>
      </div>

      {/* Metric summary */}
      <section aria-label="Ringkasan tiket" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          dot="bg-amber-500"
          label="Tiket Aktif"
          value={String(stats.aktif)}
          unit="Tiket"
          sub="Menunggu konfirmasi & penugasan teknisi"
        />
        <MetricCard
          dot="bg-violet-500"
          label="Sedang Dikerjakan"
          value={String(stats.dikerjakan)}
          unit="Tiket"
          sub="Teknisi on-site / dalam perbaikan"
        />
        <MetricCard
          dot="bg-emerald-500"
          label="Selesai Bulan Ini"
          value={String(stats.selesaiBulanIni)}
          unit="Tiket"
          sub="Sep 2026 · respons rata-rata < 1 hari"
        />
      </section>

      {/* Filter & control bar */}
      <section
        aria-label="Filter tiket"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-white p-2"
      >
        <div className="relative min-w-[200px] flex-1 sm:max-w-[280px]">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-700"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Cari no. tiket / kamar / pelapor…"
            aria-label="Cari tiket berdasarkan nomor, kamar, atau pelapor"
            className="h-9 w-full rounded-md border border-border bg-zinc-50 pl-8 pr-3 text-[13px] text-zinc-900 placeholder:text-zinc-600 focus:border-zinc-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
          />
        </div>

        {/* Filter status — ponsel: dropdown ringkas; sm+: segmented control */}
        <MobileFilterSelect<StatusTab>
          ariaLabel="Filter status tiket"
          value={statusTab}
          onValueChange={setStatusTab}
          options={[
            { value: "all", label: "Semua Komplain" },
            { value: "menunggu", label: "Menunggu Tindakan" },
            { value: "dikerjakan", label: "Sedang Dikerjakan" },
            { value: "selesai", label: "Selesai" },
          ]}
        />
        <div className="ml-auto hidden sm:block">
          <SegmentedTabs<StatusTab>
            ariaLabel="Filter status tiket"
            value={statusTab}
            onChange={setStatusTab}
            tabs={[
              { value: "all", label: "Semua", count: counts.all },
              { value: "menunggu", label: "Menunggu", count: counts.menunggu },
              { value: "dikerjakan", label: "Dikerjakan", count: counts.dikerjakan },
              { value: "selesai", label: "Selesai", count: counts.selesai },
            ]}
          />
        </div>
      </section>

      {/* Tickets table — desktop/tablet (md+) */}
      <div className="hidden max-h-[640px] overflow-auto overscroll-contain rounded-lg border border-border bg-white scrollbar-thin md:block">
        <table className="w-full min-w-[1020px] border-collapse text-[13px]">
          <caption className="sr-only">Daftar tiket komplain &amp; pemeliharaan</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={`${HEAD_CELL} pl-4 text-left`}>ID Tiket</TableHead>
              <TableHead className={`${HEAD_CELL} text-left`}>Lokasi &amp; Pelapor</TableHead>
              <TableHead className={`${HEAD_CELL} text-left`}>Keluhan</TableHead>
              <TableHead className={`${HEAD_CELL} text-left`}>Foto</TableHead>
              <TableHead className={`${HEAD_CELL} text-left`}>Status</TableHead>
              <TableHead className={`${HEAD_CELL} text-left`}>Tanggal Lapor</TableHead>
              <TableHead className={`${HEAD_CELL} pr-4 text-right`}>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="py-14 text-center">
                  <Info className="mx-auto size-5 text-zinc-300" strokeWidth={1.5} aria-hidden="true" />
                  <p className="mt-2 text-[13px] font-medium text-zinc-700">Tidak ada tiket yang cocok</p>
                  <p className="mt-0.5 text-xs text-zinc-700">
                    Coba ubah filter status atau kata kunci pencarian.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((ticket) => {
                const meta = TICKET_STATUS_META[ticket.status];
                const urgensi = TICKET_URGENSI_META[ticket.urgensi];
                const isFasilitas = ticket.sumber === "fasilitas";
                return (
                  <TableRow key={ticket.id} className="border-border">
                    {/* ID Tiket */}
                    <TableCell className="py-2.5 pl-4">
                      <span className="font-mono text-[12.5px] font-medium tabular-nums text-zinc-600">
                        {ticket.id}
                      </span>
                    </TableCell>

                    {/* Kamar / Lokasi & Pelapor */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        {isFasilitas ? (
                          <span
                            className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-zinc-50 text-zinc-700"
                            aria-hidden="true"
                          >
                            <Building2 className="size-3.5" strokeWidth={1.75} />
                          </span>
                        ) : (
                          <span
                            className="flex size-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-700"
                            aria-hidden="true"
                          >
                            {initialsOf(ticket.reporterName)}
                          </span>
                        )}
                        <span className="leading-tight">
                          <span className="block text-[13px] font-semibold text-zinc-900">
                            {isFasilitas ? (
                              <>
                                <span className="md:hidden">{ticket.lokasi}</span>
                                <span className="hidden md:inline">{ticketSubject(ticket)}</span>
                              </>
                            ) : (
                              ticketSubject(ticket)
                            )}
                          </span>
                          <span className="block text-[12.5px] text-zinc-700">
                            {isFasilitas ? "Pemeliharaan · Pengelola" : ticket.reporterName}
                          </span>
                        </span>
                      </div>
                    </TableCell>

                    {/* Keluhan: judul + urgensi pill, kategori — deskripsi */}
                    <TableCell className="max-w-[240px] py-2.5">
                      <div className="flex items-start gap-2">
                        <CategoryIcon kategori={ticket.kategori} />
                        <span className="min-w-0 leading-tight">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[12.5px] font-semibold text-zinc-900" title={ticket.judul}>
                              {ticket.judul}
                            </span>
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-xs font-semibold leading-none",
                                urgensi.pill
                              )}
                            >
                              <span className={cn("size-1 rounded-full", urgensi.dot)} aria-hidden="true" />
                              {urgensi.label}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[12.5px] text-zinc-700" title={`${ticket.kategori} — ${ticket.deskripsi}`}>
                            {ticket.kategori} — {ticket.deskripsi}
                          </span>
                        </span>
                      </div>
                    </TableCell>

                    {/* Foto Lampiran */}
                    <TableCell className="py-2.5">
                      {ticket.photos.length === 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-zinc-300">
                          <ImageOff className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                          Tidak ada
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {ticket.photos.slice(0, 3).map((src, i) => (
                            <Tooltip key={src}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => setZoom({ src, ticket })}
                                  className="group relative overflow-hidden rounded-md border border-border transition-shadow hover:ring-2 hover:ring-zinc-900/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30"
                                  aria-label={`Perbesar foto lampiran ${ticket.id} #${i + 1}`}
                                >
                                  <img
                                    src={src}
                                    alt={`Foto kerusakan ${ticket.kategori} ${ticketSubject(ticket)}`}
                                    className="size-9 object-cover transition-transform group-hover:scale-105"
                                  />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="border border-zinc-200 bg-white text-zinc-700 shadow-md"
                              >
                                Klik untuk perbesar
                              </TooltipContent>
                            </Tooltip>
                          ))}
                          {ticket.photos.length > 3 && (
                            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-border bg-zinc-50 px-1 text-xs font-semibold tabular-nums text-zinc-700">
                              +{ticket.photos.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    {/* Status pill (static — perubahan via Aksi → Ubah Status) */}
                    <TableCell className="py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold leading-none whitespace-nowrap",
                          meta.pill
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden="true" />
                        {meta.label}
                      </span>
                    </TableCell>

                    {/* Tanggal Lapor */}
                    <TableCell className="py-2.5">
                      <span className="block text-[12.5px] tabular-nums whitespace-nowrap text-zinc-600">
                        {ticket.reportedLabel}
                      </span>
                      {ticket.selesaiLabel && (
                        <span className="mt-0.5 block text-xs tabular-nums text-zinc-700">
                          {ticket.selesaiLabel}
                        </span>
                      )}
                    </TableCell>

                    {/* Aksi: Ubah Status + Chat WA Penyewa/Teknisi */}
                    <TableCell className="py-2.5 pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Ubah Status */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
                              aria-label={`Ubah status tiket ${ticket.id}, saat ini ${meta.label}`}
                            >
                              Ubah Status
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-xs text-zinc-700">
                              Ubah Status
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {TICKET_STATUSES.map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onClick={() => onStatusChange(ticket, s)}
                                className="justify-between text-[13px]"
                              >
                                <span className="flex items-center gap-2">
                                  <span className={cn("size-1.5 rounded-full", TICKET_STATUS_META[s].dot)} />
                                  {TICKET_STATUS_META[s].label}
                                </span>
                                {s === ticket.status && <Check className="size-3.5 text-zinc-900" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Chat WA Penyewa / Teknisi */}
                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1 border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700 shadow-none hover:bg-green-100 hover:text-green-800"
                                  aria-label={`Chat WhatsApp Penyewa atau Teknisi untuk ${ticket.id}`}
                                >
                                  <WaIcon className="size-3.5" />
                                  <span className="hidden lg:inline">Chat WA</span>
                                </Button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="border border-zinc-200 bg-white text-zinc-700 shadow-md md:hidden"
                            >
                              Chat WA Penyewa / Teknisi
                            </TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="end" className="w-60">
                            <DropdownMenuLabel className="text-xs text-zinc-700">
                              Chat WA Penyewa / Teknisi
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {!isFasilitas && (
                              <DropdownMenuItem
                                onClick={() => openWa(ticket, "penyewa")}
                                className="text-[13px]"
                              >
                                <WaIcon className="size-3.5 text-green-600" />
                                <span className="min-w-0 flex-1 truncate">
                                  Chat Penyewa — {ticket.reporterName}
                                </span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => openWa(ticket, "teknisi")}
                              className="text-[13px]"
                            >
                              <Wrench className="size-3.5 text-zinc-700" />
                              <span className="min-w-0 flex-1 truncate">
                                Chat Teknisi — {(ticket.teknisi ?? ONCALL_TEKNISI).name}
                              </span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </table>
      </div>

      {/* Mobile (< md): kartu tiket vertikal — anti scroll samping */}
      <div className="md:hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-white px-6 py-12 text-center">
            <Info className="size-5 text-zinc-300" strokeWidth={1.5} aria-hidden="true" />
            <p className="text-[13px] font-medium text-zinc-700">Tidak ada tiket yang cocok</p>
            <p className="max-w-[280px] text-xs leading-4 text-zinc-700">
              Coba ubah filter status atau kata kunci pencarian.
            </p>
          </div>
        ) : (
          <ul role="list" aria-label="Daftar tiket komplain" className="space-y-2.5">
            {filtered.map((ticket) => (
              <MobileTicketCard
                key={ticket.id}
                ticket={ticket}
                onStatusChange={onStatusChange}
                onOpenWa={openWa}
                onZoom={(src, t) => setZoom({ src, ticket: t })}
              />
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-zinc-700">
        Menampilkan {filtered.length} dari {tickets.length} tiket · laporan baru dari Portal Penyewa masuk otomatis
      </p>

      {/* Create ticket modal (state resets via keyed remount) */}
      <CreateTicketModal
        key={`ctk-${createOpen}`}
        open={createOpen}
        onOpenChange={setCreateOpen}
        rooms={rooms}
        onCreateTicket={onCreateTicket}
      />

      {/* Photo zoom dialog */}
      <Dialog open={zoom !== null} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
          {zoom && (
            <>
              <div className="bg-zinc-100">
                <img
                  src={zoom.src}
                  alt={`Foto kerusakan ${zoom.ticket.kategori} ${ticketSubject(zoom.ticket)}`}
                  className="mx-auto max-h-[62vh] w-full object-contain"
                />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 pr-12">
                <div className="min-w-0">
                  <DialogTitle className="truncate text-[13.5px] font-semibold text-zinc-900">
                    {zoom.ticket.judul} · {ticketSubject(zoom.ticket)}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 truncate text-[12.5px] text-zinc-700">
                    {zoom.ticket.id} · {zoom.ticket.kategori} — {zoom.ticket.deskripsi}
                  </DialogDescription>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
