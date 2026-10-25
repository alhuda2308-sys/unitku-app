"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Eye, LogOut, MoreHorizontal, MessageCircle, PencilLine, Search, UserX, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SegmentedTabs, type SegmentedTabItem } from "./segmented-tabs";
import { MobileFilterSelect } from "./mobile-filter-select";
import { TenantDetailDrawer } from "./tenant-detail-drawer";
import { RenewDialog } from "./renew-dialog";
import { TenantEditDialog } from "./tenant-edit-dialog";
import { CheckoutDialog, type CheckoutPayload } from "./checkout-dialog";
import {
  CURRENT_PERIOD_KEY,
  INVOICE_STATUS_META,
  type Invoice,
} from "@/lib/kost-invoices";
import {
  formatDateLabel,
  formatIDR,
  initialsOf,
  roomNomor,
  STATUS_META,
  todayISO,
  waLink,
  type Room,
  type TenantProfilePayload,
} from "@/lib/kost-data";
import { contractDaysLeft, contractEndOf } from "@/lib/room-status";
import { tenantTermFor } from "@/lib/app-settings";
import { cn } from "@/lib/utils";

interface PenghuniViewProps {
  rooms: Room[];
  /** Lifted invoice history for the detail drawer (live after resets/deletions) */
  invoices: Invoice[];
  query: string;
  onQueryChange: (q: string) => void;
  onRenew: (room: Room, newEndDate: string, months: number) => void;
  onCheckout: (room: Room, payload: CheckoutPayload) => void;
  /** Edit Data Penghuni — simpan profil penyewa (termasuk kolom kustom) */
  onEditTenant: (room: Room, payload: TenantProfilePayload) => void;
  /** Nama properti — tampil pada QR & tautan portal penyewa */
  propertyName: string;
  /** Tipe properti aktif — Villa/Homestay → sebutan "Tamu / Penyewa" */
  propertyType?: string;
}

type DirTab = "semua" | "aktif" | "keluar";

/**
 * Tanggal habis kontrak KANONIK + selisih hari vs HARI INI — SATU sumber dengan
 * kartu Denah (src/lib/room-status.ts): endDate eksplisit ATAU fallback kanonik
 * masuk + 1 siklus sewa. Menggantikan daysLeft() lokal yang hanya membaca
 * `contract.endDate` mentah (data kontrak rolling dulu tak pernah punya pill
 * & tak pernah masuk tab "Akan Keluar" — split-brain dengan Denah).
 * null = kamar memang tak dapat ditentukan tanggal habisnya.
 */
function contractInfo(room: Room): { end: string; dl: number } | null {
  const info = contractEndOf(room);
  if (!info.date) return null;
  return { end: info.label, dl: contractDaysLeft(info.date, new Date()) };
}

const TODAY_LABEL = formatDateLabel(todayISO());

/** Pill "Masa Habis Kontrak" — merah bila sudah lewat, kuning ≤30 hari lagi */
function ContractEndPill({ end, dl }: { end: string; dl: number }) {
  const expired = dl < 0;
  const soon = dl <= 30;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-xs font-semibold tabular-nums",
        expired
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : soon
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-zinc-200 bg-zinc-50 text-zinc-600"
      )}
    >
      {end}
      {expired ? ` · +${-dl} hr` : soon ? ` · H-${Math.max(dl, 0)}` : ""}
    </span>
  );
}

const HEAD_CELL =
  "h-9 bg-white px-3 text-xs font-semibold uppercase tracking-wide text-zinc-700 shadow-[inset_0_-1px_0_var(--border)]";

/** Kartu penghuni untuk layar ponsel (< md):
 *  Header: nama + unit + badge status pembayaran — Body: WA, masuk, sewa —
 *  Footer: aksi cepat (Chat WA, Detail, titik-tiga). */
function MobileTenantCard({
  room,
  invoice,
  onDetail,
  onRenew,
  onEdit,
  onCheckout,
}: {
  room: Room;
  invoice: Invoice | undefined;
  onDetail: () => void;
  onRenew: () => void;
  onEdit: () => void;
  onCheckout: () => void;
}) {
  const t = room.tenant!;
  // Tanggal habis & sisa hari KANONIK (fallback masuk + 1 siklus sewa) —
  // selalu sejajar dengan kartu Denah untuk kamar yang sama.
  const info = contractInfo(room);
  const end = info?.end;
  const dl = info?.dl;
  const soon = dl !== undefined && dl <= 30;
  // Status EFEKTIF kamar menang atas status tagihan (aturan global single
  // source of truth): kamar yang dinamis MENUNGGAK (kontrak lewat tanpa
  // pembayaran baru) TIDAK BOLEH tampil badge "Lunas" biru dari tagihan
  // bulan berjalan — owner harus melihat alarm yang sama di semua layar.
  const badge =
    room.status === "menunggak"
      ? STATUS_META.menunggak
      : invoice
        ? INVOICE_STATUS_META[invoice.status]
        : null;

  return (
    <li className="rounded-lg border border-border bg-white p-3">
      {/* Header: nama + unit + badge status pembayaran */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-bold text-zinc-600"
            aria-hidden="true"
          >
            {initialsOf(t.name)}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-semibold text-zinc-900">{t.name}</span>
            <span className="mt-1 flex items-center gap-1.5">
              <span className="inline-flex h-5 shrink-0 items-center rounded-md border border-border bg-zinc-50 px-1.5 text-xs font-semibold tabular-nums text-zinc-700">
                {roomNomor(room)}
              </span>
              <span className="truncate text-xs text-zinc-700">Lt {room.floor} · {room.type}</span>
            </span>
          </span>
        </div>
        {badge && (
          <span
            className={cn(
              "inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-xs font-semibold leading-none whitespace-nowrap",
              badge.pill
            )}
          >
            {badge.label}
          </span>
        )}
      </div>

      {/* Body: WA, masuk, sewa */}
      <div className="mt-2.5 space-y-1.5 border-t border-border pt-2.5">
        <a
          href={waLink(t.phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[12.5px] font-medium tabular-nums text-zinc-700 transition-colors hover:text-green-700"
          aria-label={`Chat WhatsApp ${t.name}`}
        >
          <MessageCircle className="size-3.5 shrink-0 text-green-600" strokeWidth={1.75} aria-hidden="true" />
          {t.phone}
        </a>
        <p className="flex items-center gap-1.5 text-[12.5px] tabular-nums text-zinc-700">
          <CalendarClock className="size-3.5 shrink-0 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
          Masuk {t.moveInDate}
        </p>
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium tabular-nums text-zinc-800">
          <Wallet className="size-3.5 shrink-0 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
          {formatIDR(room.price)}
          <span className="font-normal text-zinc-700">
            {room.contract?.duration === "Harian" ? "/hari" : "/bulan"}
          </span>
          {end && (
            <span
              className={cn(
                "ml-auto inline-flex h-5 shrink-0 items-center rounded-full border px-1.5 text-xs font-semibold tabular-nums",
                (dl ?? 0) < 0
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : soon
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-zinc-200 bg-zinc-50 text-zinc-600"
              )}
            >
              {(dl ?? 0) < 0
                ? `Habis ${end} · +${-(dl ?? 0)} hr`
                : soon
                  ? `Habis ${end} · H-${Math.max(dl ?? 0, 0)}`
                  : `s/d ${end}`}
            </span>
          )}
        </p>
      </div>

      {/* Footer: aksi cepat */}
      <div className="mt-2.5 flex items-center gap-2 border-t border-border pt-2.5">
        <Button
          asChild
          variant="outline"
          className="h-8 flex-1 border-green-200 bg-green-50 px-2 text-[12.5px] font-medium text-green-700 shadow-none hover:bg-green-100 hover:text-green-800"
        >
          <a
            href={waLink(t.phone)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Chat WhatsApp ${t.name}`}
          >
            <MessageCircle className="size-3.5" strokeWidth={1.75} />
            Chat WA
          </a>
        </Button>
        <Button
          variant="outline"
          onClick={onDetail}
          className="h-8 flex-1 border-zinc-200 bg-white px-2 text-[12.5px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
        >
          <Eye className="size-3.5" strokeWidth={1.75} />
          Detail
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-8 shrink-0 border-zinc-200 bg-white text-zinc-700 shadow-none hover:bg-zinc-50"
              aria-label={`Aksi lainnya untuk ${t.name}`}
            >
              <MoreHorizontal className="size-4" strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={onRenew} className="text-[13px]">
              <CalendarClock className="size-3.5 text-zinc-700" strokeWidth={1.75} />
              Perpanjang Sewa
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit} className="text-[13px]">
              <PencilLine className="size-3.5 text-zinc-700" strokeWidth={1.75} />
              Edit Penghuni
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onCheckout}
              className="text-[13px] text-red-600 focus:text-red-700"
            >
              <LogOut className="size-3.5" strokeWidth={1.75} />
              Proses Check-out / Refund Deposit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

export function PenghuniView({ rooms, invoices, query, onQueryChange, onRenew, onCheckout, onEditTenant, propertyName, propertyType }: PenghuniViewProps) {
  const [tab, setTab] = useState<DirTab>("semua");
  const [detailRoomId, setDetailRoomId] = useState<string | null>(null);
  const [renewRoomId, setRenewRoomId] = useState<string | null>(null);
  const [editRoomId, setEditRoomId] = useState<string | null>(null);
  const [checkoutRoomId, setCheckoutRoomId] = useState<string | null>(null);

  const tenants = useMemo(() => rooms.filter((r) => r.tenant && r.status !== "kosong"), [rooms]);

  const endingSoon = useMemo(
    () =>
      tenants.filter((r) => {
        const i = contractInfo(r);
        return i !== null && i.dl <= 30;
      }),
    [tenants]
  );

  const counts: Record<DirTab, number> = {
    semua: tenants.length,
    aktif: tenants.length - endingSoon.length,
    keluar: endingSoon.length,
  };

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    let list = tenants;
    // "Akan Keluar / Habis Kontrak" = kontrak berakhir ≤30 hari ATAU sudah
    // lewat — memakai tanggal KANONIK yang sama dengan Denah & statistik.
    if (tab === "aktif")
      list = list.filter((r) => {
        const i = contractInfo(r);
        return !(i !== null && i.dl <= 30);
      });
    if (tab === "keluar")
      list = list.filter((r) => {
        const i = contractInfo(r);
        return i !== null && i.dl <= 30;
      });
    if (q) {
      list = list.filter(
        (r) =>
          r.tenant!.name.toLowerCase().includes(q) ||
          roomNomor(r).toLowerCase().includes(q) ||
          r.tenant!.phone.replace(/[^0-9]/g, "").includes(q.replace(/[^0-9]/g, ""))
      );
    }
    return list;
  }, [tenants, tab, q]);

  /** Sebutan orang menghuni — Villa/Homestay → "Tamu / Penyewa" */
  const tenantTerm = tenantTermFor(propertyType);

  const tabs: SegmentedTabItem<DirTab>[] = [
    { value: "semua", label: tenantTerm === "Penyewa" ? "Semua Penghuni" : `Semua ${tenantTerm}`, count: counts.semua },
    { value: "aktif", label: "Aktif", count: counts.aktif },
    { value: "keluar", label: tenantTerm === "Penyewa" ? "Akan Keluar / Habis Kontrak" : "Akan Check-out", count: counts.keluar },
  ];

  /** Status pembayaran bulan berjalan per kamar (untuk badge kartu mobile) */
  const invoiceByRoom = useMemo(() => {
    const map = new Map<string, Invoice>();
    for (const inv of invoices) {
      if (inv.periodKey === CURRENT_PERIOD_KEY) map.set(inv.roomId, inv);
    }
    return map;
  }, [invoices]);

  const detailRoom = rooms.find((r) => r.id === detailRoomId) ?? null;
  const renewRoom = rooms.find((r) => r.id === renewRoomId) ?? null;
  const editRoom = rooms.find((r) => r.id === editRoomId) ?? null;
  const checkoutRoom = rooms.find((r) => r.id === checkoutRoomId) ?? null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">
            {tenantTerm === "Penyewa" ? "Direktori Penghuni" : "Direktori Tamu / Penyewa"}
          </h1>
          <p className="mt-0.5 text-[12.5px] text-zinc-700">
            {tenants.length} {tenantTerm === "Penyewa" ? "penghuni" : "tamu/penyewa"} terdaftar dari {rooms.length} kamar · data per {TODAY_LABEL}
          </p>
        </div>
        {/* Search */}
        <div className="relative w-full max-w-[260px]">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-700"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Cari nama / kamar / no. HP…"
            aria-label="Cari penghuni berdasarkan nama, kamar, atau nomor HP"
            className="h-9 w-full rounded-md border border-border bg-white pl-8 pr-3 text-[13px] text-zinc-900 placeholder:text-zinc-600 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
          />
        </div>
      </div>

      {/* Filter — ponsel: dropdown ringkas; sm+: segmented control */}
      <MobileFilterSelect<DirTab>
        ariaLabel="Filter direktori penghuni"
        value={tab}
        onValueChange={setTab}
        options={tabs.map((t) => ({ value: t.value, label: t.label }))}
      />
      <div className="hidden sm:block">
        <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Filter direktori penghuni" />
      </div>

      {/* Table — desktop/tablet (md+) */}
      <div className="hidden max-h-[620px] overflow-auto overscroll-contain rounded-lg border border-border bg-white scrollbar-thin md:block">
        <table className="w-full min-w-[940px] border-collapse text-[13px]">
          <caption className="sr-only">Direktori penghuni kost</caption>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${HEAD_CELL} pl-4 text-left`}>Nama {tenantTerm === "Penyewa" ? "Penghuni" : "Tamu"}</th>
              <th className={`${HEAD_CELL} text-left`}>No. Kamar</th>
              <th className={`${HEAD_CELL} text-left`}>No. WhatsApp</th>
              <th className={`${HEAD_CELL} text-left`}>Tanggal Masuk</th>
              <th className={`${HEAD_CELL} text-left`}>Masa Habis Kontrak</th>
              <th className={`${HEAD_CELL} text-left`}>Status Deposit</th>
              <th className={`${HEAD_CELL} pr-4 text-right`}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((room) => {
              const t = room.tenant!;
              // Tanggal habis & sisa hari KANONIK — sejajar dgn kartu Denah
              const info = contractInfo(room);
              const end = info?.end;
              const dl = info?.dl;
              const soon = dl !== undefined && dl <= 30;
              return (
                <tr key={room.id} className="border-b border-border last:border-0 hover:bg-zinc-50/70">
                  {/* Nama & avatar */}
                  <td className="py-2 pl-4 pr-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-bold text-zinc-600"
                        aria-hidden="true"
                      >
                        {initialsOf(t.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-zinc-900">{t.name}</p>
                        <p className="truncate text-xs text-zinc-700">{room.type}</p>
                      </div>
                    </div>
                  </td>
                  {/* Kamar */}
                  <td className="px-3 py-2">
                    <span className="inline-flex h-5 items-center rounded-md border border-border bg-zinc-50 px-1.5 text-xs font-semibold tabular-nums text-zinc-700">
                      {roomNomor(room)}
                    </span>
                    <span className="ml-1.5 text-xs text-zinc-700">Lt {room.floor}</span>
                  </td>
                  {/* WA */}
                  <td className="px-3 py-2">
                    <a
                      href={waLink(t.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[12.5px] font-medium tabular-nums text-zinc-700 transition-colors hover:text-green-700"
                      aria-label={`Chat WhatsApp ${t.name}`}
                    >
                      <MessageCircle className="size-3.5 shrink-0 text-green-600" strokeWidth={1.75} aria-hidden="true" />
                      {t.phone}
                    </a>
                  </td>
                  {/* Masuk */}
                  <td className="px-3 py-2 text-[12.5px] tabular-nums text-zinc-700">{t.moveInDate}</td>
                  {/* Habis kontrak */}
                  <td className="px-3 py-2">
                    {end ? (
                      <ContractEndPill end={end} dl={dl!} />
                    ) : (
                      <span className="text-[12.5px] text-zinc-700">Auto-renew</span>
                    )}
                  </td>
                  {/* Deposit */}
                  <td className="px-3 py-2">
                    <span className="text-[12.5px] font-medium tabular-nums text-zinc-800">
                      {formatIDR(room.contract?.deposit ?? 0)}
                    </span>{" "}
                    <span
                      className={cn(
                        "ml-0.5 inline-flex h-5 items-center rounded-full border px-1.5 text-xs font-semibold",
                        room.contract?.depositHeld
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-zinc-200 bg-zinc-100 text-zinc-700"
                      )}
                    >
                      {room.contract?.depositHeld ? "Ditahan" : "Dikembalikan"}
                    </span>
                  </td>
                  {/* Aksi */}
                  <td className="py-2 pl-3 pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-700"
                          aria-label={`Aksi untuk ${t.name}`}
                        >
                          <MoreHorizontal className="size-4" strokeWidth={1.75} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => setDetailRoomId(room.id)} className="text-[13px]">
                          <Eye className="size-3.5 text-zinc-700" strokeWidth={1.75} />
                          Lihat Detail
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRenewRoomId(room.id)} className="text-[13px]">
                          <CalendarClock className="size-3.5 text-zinc-700" strokeWidth={1.75} />
                          Perpanjang Sewa
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditRoomId(room.id)} className="text-[13px]">
                          <PencilLine className="size-3.5 text-zinc-700" strokeWidth={1.75} />
                          Edit Penghuni
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setCheckoutRoomId(room.id)}
                          className="text-[13px] text-red-600 focus:text-red-700"
                        >
                          <LogOut className="size-3.5" strokeWidth={1.75} />
                          Proses Check-out / Refund Deposit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 border-t border-border px-6 py-12 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
              <UserX className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <p className="text-[13px] font-semibold text-zinc-700">Tidak ada {tenantTerm === "Penyewa" ? "penghuni" : "tamu"} yang cocok</p>
            <p className="max-w-[280px] text-[12.5px] leading-5 text-zinc-700">
              {q
                ? `Tidak ditemukan hasil untuk "${query}". Coba kata kunci lain.`
                : "Belum ada penghuni pada filter ini."}
            </p>
          </div>
        )}
      </div>

      {/* Mobile (< md): kartu penghuni vertikal — anti scroll samping */}
      <div className="md:hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-white px-6 py-12 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
              <UserX className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <p className="text-[13px] font-semibold text-zinc-700">Tidak ada {tenantTerm === "Penyewa" ? "penghuni" : "tamu"} yang cocok</p>
            <p className="max-w-[280px] text-[12.5px] leading-5 text-zinc-700">
              {q
                ? `Tidak ditemukan hasil untuk "${query}". Coba kata kunci lain.`
                : "Belum ada penghuni pada filter ini."}
            </p>
          </div>
        ) : (
          <ul role="list" aria-label="Daftar penghuni" className="space-y-2.5">
            {filtered.map((room) => (
              <MobileTenantCard
                key={room.id}
                room={room}
                invoice={invoiceByRoom.get(room.id)}
                onDetail={() => setDetailRoomId(room.id)}
                onRenew={() => setRenewRoomId(room.id)}
                onEdit={() => setEditRoomId(room.id)}
                onCheckout={() => setCheckoutRoomId(room.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Row action targets */}
      <TenantDetailDrawer
        room={detailRoom}
        open={detailRoomId !== null && detailRoom?.tenant != null}
        onOpenChange={(o) => {
          if (!o) setDetailRoomId(null);
        }}
        onRenew={(room) => setRenewRoomId(room.id)}
        onCheckout={(room) => setCheckoutRoomId(room.id)}
        invoices={invoices}
        propertyName={propertyName}
      />
      <RenewDialog
        key={`renew-${renewRoomId ?? "none"}-${renewRoomId !== null && renewRoom?.tenant != null}`}
        room={renewRoom}
        open={renewRoomId !== null && renewRoom?.tenant != null}
        onOpenChange={(o) => {
          if (!o) setRenewRoomId(null);
        }}
        onSubmit={(room, end, months) => onRenew(room, end, months)}
      />
      <TenantEditDialog
        key={`edit-${editRoomId ?? "none"}`}
        room={editRoom}
        open={editRoomId !== null && editRoom?.tenant != null}
        onOpenChange={(o) => {
          if (!o) setEditRoomId(null);
        }}
        onSubmit={(room, payload) => onEditTenant(room, payload)}
      />
      <CheckoutDialog
        key={`co-${checkoutRoomId ?? "none"}-${checkoutRoomId !== null && checkoutRoom?.tenant != null}`}
        room={checkoutRoom}
        open={checkoutRoomId !== null && checkoutRoom?.tenant != null}
        onOpenChange={(o) => {
          if (!o) setCheckoutRoomId(null);
        }}
        onSubmit={(room, payload) => onCheckout(room, payload)}
      />
    </div>
  );
}
