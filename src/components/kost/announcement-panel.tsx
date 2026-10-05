"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Copy,
  Info,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type { Room } from "@/lib/kost-data";
import {
  ANNOUNCEMENT_KATEGORI_META,
  ANNOUNCEMENT_TODAY_ISO,
  announcementStatus,
  periodeLabel,
  targetLabel,
  waBroadcastText,
  type Announcement,
  type AnnouncementDraft,
  type AnnouncementStatus,
} from "@/lib/announcement-data";
import { MetricCard } from "./metric-card";
import { SegmentedTabs } from "./segmented-tabs";
import { MobileFilterSelect } from "./mobile-filter-select";
import { AnnouncementModal } from "./announcement-modal";

type StatusTab = "all" | "aktif" | "arsip";

interface AnnouncementPanelProps {
  announcements: Announcement[];
  rooms: Room[];
  query: string;
  onQueryChange: (q: string) => void;
  propertyName: string;
  /** "Hari ini" utk status tayang — akun riil memakai tanggal nyata;
   *  default = ISO snapshot demo (ANNOUNCEMENT_TODAY_ISO). */
  todayISO?: string;
  onCreate: (draft: AnnouncementDraft) => void;
  onUpdate: (a: Announcement, draft: AnnouncementDraft) => void;
  onToggleActive: (a: Announcement) => void;
  onDelete: (a: Announcement) => void;
}

const STATUS_META: Record<
  AnnouncementStatus,
  { label: string; pill: string }
> = {
  aktif: {
    label: "Aktif",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  terjadwal: {
    label: "Terjadwal",
    pill: "bg-violet-50 text-violet-700 border-violet-200",
  },
  berakhir: {
    label: "Berakhir",
    pill: "bg-zinc-100 text-zinc-700 border-zinc-200",
  },
  nonaktif: {
    label: "Nonaktif",
    pill: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

const HEAD_CELL =
  "h-9 bg-white px-3 text-xs font-semibold uppercase tracking-wide text-zinc-700 shadow-[inset_0_-1px_0_var(--border)]";

/** Kartu pengumuman mandiri untuk layar ponsel (< md):
 *  Judul + status — isi — kategori + target — periode + aksi titik-tiga. */
function MobileAnnouncementCard({
  a,
  status,
  targetCount,
  onEdit,
  onCopyWa,
  onToggle,
  onDelete,
}: {
  a: Announcement;
  status: AnnouncementStatus;
  targetCount: number;
  onEdit: () => void;
  onCopyWa: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const meta = ANNOUNCEMENT_KATEGORI_META[a.kategori];
  const statusMeta = STATUS_META[status];
  const canToggle = status === "aktif" || status === "terjadwal" || status === "nonaktif";
  return (
    <li className="rounded-lg border border-border bg-white p-3">
      {/* Atas: judul + status */}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[13px] font-semibold leading-snug text-zinc-900">{a.judul}</p>
        <span
          className={cn(
            "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-semibold leading-none whitespace-nowrap",
            statusMeta.pill
          )}
        >
          {status === "aktif" && <CheckCircle2 className="size-3" strokeWidth={2} aria-hidden="true" />}
          {(status === "berakhir" || status === "nonaktif") && (
            <Archive className="size-3" strokeWidth={2} aria-hidden="true" />
          )}
          {statusMeta.label}
        </span>
      </div>

      {/* Isi */}
      <p className="mt-1 line-clamp-2 text-[12.5px] leading-4 text-zinc-700">{a.isi}</p>

      {/* Kategori + target */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-full border px-2 text-xs font-semibold leading-none",
            meta.pill
          )}
        >
          {meta.label}
        </span>
        <span className="text-[12.5px] text-zinc-700">{targetLabel(a.targetFloor)}</span>
        <span className="text-xs tabular-nums text-zinc-700">· {targetCount} penyewa</span>
      </div>

      {/* Bawah: periode + aksi */}
      <div className="mt-2.5 flex items-end justify-between gap-2 border-t border-border pt-2.5">
        <div className="min-w-0">
          <p className="text-xs tabular-nums text-zinc-700">Tayang {periodeLabel(a)}</p>
          <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-zinc-700">
            {a.createdAtLabel} · {a.id.replace("#", "")}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-9 shrink-0 border-zinc-200 bg-white text-zinc-700 shadow-none hover:bg-zinc-50"
              aria-label={`Aksi untuk pengumuman ${a.judul}`}
            >
              <MoreHorizontal className="size-4" strokeWidth={2} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={onEdit} className="gap-2 text-[13px]">
              <Pencil className="size-3.5 text-zinc-700" strokeWidth={1.75} />
              Edit Pengumuman
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopyWa} className="gap-2 text-[13px]">
              <Copy className="size-3.5 text-zinc-700" strokeWidth={1.75} />
              Salin Format WhatsApp
            </DropdownMenuItem>
            {canToggle && (
              <DropdownMenuItem onClick={onToggle} className="gap-2 text-[13px]">
                <Power
                  className={cn(
                    "size-3.5",
                    status === "nonaktif" ? "text-emerald-500" : "text-amber-500"
                  )}
                  strokeWidth={1.75}
                />
                {status === "nonaktif" ? "Aktifkan Kembali" : "Nonaktifkan"}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="gap-2 text-[13px] text-red-600 focus:bg-red-50 focus:text-red-700"
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
              Hapus
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

/** Status tab grouping — aktif vs arsip (berakhir/nonaktif/terjadwal) */
function statusGroup(s: AnnouncementStatus): "aktif" | "arsip" {
  return s === "aktif" ? "aktif" : "arsip";
}

export function AnnouncementPanel({
  announcements,
  rooms,
  query,
  onQueryChange,
  propertyName,
  todayISO = ANNOUNCEMENT_TODAY_ISO,
  onCreate,
  onUpdate,
  onToggleActive,
  onDelete,
}: AnnouncementPanelProps) {
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);

  /** Newest first (sort key, lalu id terbesar) */
  const sorted = useMemo(
    () =>
      [...announcements].sort((a, b) => {
        if (b.createdAtSort !== a.createdAtSort) return b.createdAtSort - a.createdAtSort;
        return b.id.localeCompare(a.id);
      }),
    [announcements]
  );

  const stats = useMemo(() => {
    const withStatus = sorted.map((a) => ({
      a,
      status: announcementStatus(a, todayISO),
    }));
    return {
      aktif: withStatus.filter((r) => r.status === "aktif").length,
      arsip: withStatus.filter((r) => r.status !== "aktif").length,
      total: withStatus.length,
    };
  }, [sorted, todayISO]);

  const counts = useMemo(
    () => ({
      all: announcements.length,
      aktif: stats.aktif,
      arsip: stats.arsip,
    }),
    [announcements.length, stats]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted
      .map((a) => ({ a, status: announcementStatus(a, todayISO) }))
      .filter((r) => (statusTab === "all" ? true : statusGroup(r.status) === statusTab))
      .filter(
        (r) =>
          !q ||
          r.a.id.toLowerCase().includes(q) ||
          r.a.judul.toLowerCase().includes(q) ||
          r.a.isi.toLowerCase().includes(q) ||
          targetLabel(r.a.targetFloor).toLowerCase().includes(q) ||
          ANNOUNCEMENT_KATEGORI_META[r.a.kategori].label.toLowerCase().includes(q)
      );
  }, [sorted, statusTab, query, todayISO]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setModalOpen(true);
  };

  const handleSave = (draft: AnnouncementDraft, editingRow: Announcement | null) => {
    if (editingRow) onUpdate(editingRow, draft);
    else onCreate(draft);
  };

  const copyWa = async (a: Announcement) => {
    try {
      await navigator.clipboard.writeText(waBroadcastText(a, propertyName));
      toast.success("Format WhatsApp disalin", {
        description: `${a.id} — ${a.judul}`,
      });
    } catch {
      toast.error("Gagal menyalin", {
        description: "Clipboard tidak tersedia di browser ini.",
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Page header — title row with the primary create action per spec */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">
            Pengumuman &amp; Broadcast
          </h1>
          <p className="mt-0.5 max-w-xl text-[12.5px] text-zinc-700">
            Pasang info rutin, pemberitahuan penting, atau darurat ke Portal
            Penyewa &amp; siapkan broadcast grup WhatsApp
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="h-9 bg-zinc-900 px-3 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800"
        >
          <Plus className="size-4" strokeWidth={2.25} aria-hidden="true" />
          Buat Pengumuman Baru
        </Button>
      </div>

      {/* Metric summary — spec: Pengumuman Aktif & Arsip Pengumuman */}
      <section aria-label="Ringkasan pengumuman" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricCard
          dot="bg-emerald-500"
          label="Pengumuman Aktif"
          value={String(stats.aktif)}
          unit="Tayang"
          sub="Tampil di Portal Penyewa saat ini"
        />
        <MetricCard
          dot="bg-zinc-400"
          label="Arsip Pengumuman"
          value={String(stats.arsip)}
          unit="Arsip"
          sub="Berakhir, dinonaktifkan, atau terjadwal"
        />
      </section>

      {/* Filter & control bar */}
      <section
        aria-label="Filter pengumuman"
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
            placeholder="Cari judul / isi / target…"
            aria-label="Cari pengumuman berdasarkan judul, isi, atau target"
            className="h-9 w-full rounded-md border border-border bg-zinc-50 pl-8 pr-3 text-[13px] text-zinc-900 placeholder:text-zinc-600 focus:border-zinc-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
          />
        </div>

        {/* Filter status — ponsel: dropdown ringkas; sm+: segmented control */}
        <MobileFilterSelect<StatusTab>
          ariaLabel="Filter status pengumuman"
          value={statusTab}
          onValueChange={setStatusTab}
          options={[
            { value: "all", label: "Semua Pengumuman" },
            { value: "aktif", label: "Aktif" },
            { value: "arsip", label: "Arsip" },
          ]}
        />
        <div className="ml-auto hidden sm:block">
          <SegmentedTabs<StatusTab>
            ariaLabel="Filter status pengumuman"
            value={statusTab}
            onChange={setStatusTab}
            tabs={[
              { value: "all", label: "Semua", count: counts.all },
              { value: "aktif", label: "Aktif", count: counts.aktif },
              { value: "arsip", label: "Arsip", count: counts.arsip },
            ]}
          />
        </div>
      </section>

      {/* Riwayat pengumuman table — desktop/tablet (md+) */}
      <div className="hidden max-h-[640px] overflow-auto overscroll-contain rounded-lg border border-border bg-white scrollbar-thin md:block">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <caption className="sr-only">Riwayat pengumuman kost</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={`${HEAD_CELL} pl-4 text-left`}>Tanggal Dibuat</TableHead>
              <TableHead className={`${HEAD_CELL} text-left`}>Judul</TableHead>
              <TableHead className={`${HEAD_CELL} text-left`}>Kategori Urgensi</TableHead>
              <TableHead className={`${HEAD_CELL} text-left`}>Target Kamar</TableHead>
              <TableHead className={`${HEAD_CELL} text-left`}>Status</TableHead>
              <TableHead className={`${HEAD_CELL} pr-4 text-right`}>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-14 text-center">
                  {announcements.length === 0 ? (
                    <>
                      <Megaphone className="mx-auto size-5 text-zinc-300" strokeWidth={1.5} aria-hidden="true" />
                      <p className="mt-2 text-[13px] font-medium text-zinc-700">
                        Belum ada pengumuman
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-700">
                        Klik &quot;Buat Pengumuman Baru&quot; untuk memasang banner di Portal Penyewa.
                      </p>
                    </>
                  ) : (
                    <>
                      <Info className="mx-auto size-5 text-zinc-300" strokeWidth={1.5} aria-hidden="true" />
                      <p className="mt-2 text-[13px] font-medium text-zinc-700">
                        Tidak ada pengumuman yang cocok
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-700">
                        Coba ubah filter status atau kata kunci pencarian.
                      </p>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(({ a, status }) => {
                const meta = ANNOUNCEMENT_KATEGORI_META[a.kategori];
                const statusMeta = STATUS_META[status];
                const canToggle = status === "aktif" || status === "terjadwal" || status === "nonaktif";
                return (
                  <TableRow key={a.id} className="group">
                    {/* Tanggal dibuat */}
                    <TableCell className="pl-4 align-top">
                      <p className="whitespace-nowrap text-[12.5px] font-medium tabular-nums text-zinc-700">
                        {a.createdAtLabel}
                      </p>
                      <p className="mt-0.5 whitespace-nowrap font-mono text-xs tabular-nums text-zinc-700">
                        {a.id.replace("#", "")}
                      </p>
                    </TableCell>

                    {/* Judul + isi + periode */}
                    <TableCell className="max-w-[300px] align-top">
                      <p className="truncate font-semibold text-zinc-900" title={a.judul}>
                        {a.judul}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-4 text-zinc-700">
                        {a.isi}
                      </p>
                      <p className="mt-1 text-xs tabular-nums text-zinc-700">
                        Tayang {periodeLabel(a)}
                      </p>
                    </TableCell>

                    {/* Kategori urgensi */}
                    <TableCell className="align-top">
                      <span
                        className={cn(
                          "inline-flex h-5 items-center rounded-full border px-2 text-xs font-semibold leading-none",
                          meta.pill
                        )}
                      >
                        {meta.label}
                      </span>
                    </TableCell>

                    {/* Target kamar */}
                    <TableCell className="align-top">
                      <p className="whitespace-nowrap text-[12.5px] text-zinc-700">
                        {targetLabel(a.targetFloor)}
                      </p>
                      <p className="mt-0.5 whitespace-nowrap text-xs tabular-nums text-zinc-700">
                        {a.targetFloor === null
                          ? `${rooms.filter((r) => r.tenant && r.status !== "kosong").length} penyewa`
                          : `${rooms.filter((r) => r.floor === a.targetFloor && r.tenant && r.status !== "kosong").length} penyewa`}
                      </p>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="align-top">
                      <span
                        className={cn(
                          "inline-flex h-5 items-center gap-1 rounded-full border px-2 text-xs font-semibold leading-none",
                          statusMeta.pill
                        )}
                      >
                        {status === "aktif" && (
                          <CheckCircle2 className="size-3" strokeWidth={2} aria-hidden="true" />
                        )}
                        {(status === "berakhir" || status === "nonaktif") && (
                          <Archive className="size-3" strokeWidth={2} aria-hidden="true" />
                        )}
                        {statusMeta.label}
                      </span>
                    </TableCell>

                    {/* Aksi */}
                    <TableCell className="pr-4 text-right align-top">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-700"
                            aria-label={`Aksi untuk pengumuman ${a.judul}`}
                          >
                            <MoreHorizontal className="size-4" strokeWidth={2} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem
                            onClick={() => openEdit(a)}
                            className="gap-2 text-[13px]"
                          >
                            <Pencil className="size-3.5 text-zinc-700" strokeWidth={1.75} />
                            Edit Pengumuman
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => copyWa(a)}
                            className="gap-2 text-[13px]"
                          >
                            <Copy className="size-3.5 text-zinc-700" strokeWidth={1.75} />
                            Salin Format WhatsApp
                          </DropdownMenuItem>
                          {canToggle && (
                            <DropdownMenuItem
                              onClick={() => onToggleActive(a)}
                              className="gap-2 text-[13px]"
                            >
                              <Power
                                className={cn(
                                  "size-3.5",
                                  status === "nonaktif" ? "text-emerald-500" : "text-amber-500"
                                )}
                                strokeWidth={1.75}
                              />
                              {status === "nonaktif" ? "Aktifkan Kembali" : "Nonaktifkan"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setConfirmDelete(a)}
                            className="gap-2 text-[13px] text-red-600 focus:bg-red-50 focus:text-red-700"
                          >
                            <Trash2 className="size-3.5" strokeWidth={1.75} />
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </table>
      </div>

      {/* Mobile (< md): kartu pengumuman vertikal — anti scroll samping */}
      <div className="md:hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-white px-6 py-12 text-center">
            {announcements.length === 0 ? (
              <>
                <Megaphone className="size-5 text-zinc-300" strokeWidth={1.5} aria-hidden="true" />
                <p className="text-[13px] font-medium text-zinc-700">Belum ada pengumuman</p>
                <p className="max-w-[280px] text-xs leading-4 text-zinc-700">
                  Klik &quot;Buat Pengumuman Baru&quot; untuk memasang banner di Portal Penyewa.
                </p>
              </>
            ) : (
              <>
                <Info className="size-5 text-zinc-300" strokeWidth={1.5} aria-hidden="true" />
                <p className="text-[13px] font-medium text-zinc-700">Tidak ada pengumuman yang cocok</p>
                <p className="max-w-[280px] text-xs leading-4 text-zinc-700">
                  Coba ubah filter status atau kata kunci pencarian.
                </p>
              </>
            )}
          </div>
        ) : (
          <ul role="list" aria-label="Riwayat pengumuman" className="space-y-2.5">
            {filtered.map(({ a, status }) => {
              const tenantCount =
                a.targetFloor === null
                  ? rooms.filter((r) => r.tenant && r.status !== "kosong").length
                  : rooms.filter((r) => r.floor === a.targetFloor && r.tenant && r.status !== "kosong").length;
              return (
                <MobileAnnouncementCard
                  key={a.id}
                  a={a}
                  status={status}
                  targetCount={tenantCount}
                  onEdit={() => openEdit(a)}
                  onCopyWa={() => copyWa(a)}
                  onToggle={() => onToggleActive(a)}
                  onDelete={() => setConfirmDelete(a)}
                />
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs leading-4 text-zinc-700">
        Pengumuman aktif tampil sebagai banner di Portal Penyewa sesuai lantai
        target — hilang otomatis setelah tanggal berakhir atau saat dinonaktifkan.
      </p>

      {/* Create / edit modal — keyed remount resets form state */}
      <AnnouncementModal
        key={`pgm-${editing?.id ?? "new"}-${modalOpen}`}
        open={modalOpen}
        onOpenChange={setModalOpen}
        rooms={rooms}
        propertyName={propertyName}
        editing={editing}
        onSave={handleSave}
        todayISO={todayISO}
      />

      {/* Hapus confirmation */}
      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">
              Hapus Pengumuman?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12.5px] leading-5">
              {confirmDelete?.judul} ({confirmDelete?.id}) akan dihapus permanen
              dari riwayat dan langsung hilang dari Portal Penyewa UnitKu. Tindakan
              ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 border-zinc-200 bg-white text-[13px] text-zinc-700 shadow-none hover:bg-zinc-100">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-9 bg-red-600 text-[13px] font-semibold text-white shadow-none hover:bg-red-700"
              onClick={() => {
                if (confirmDelete) onDelete(confirmDelete);
                setConfirmDelete(null);
              }}
            >
              Ya, Hapus Pengumuman
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
