"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  Building2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
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
import { PROPERTY_TYPE_META } from "@/lib/property-types";
import type { ManagedProperty } from "@/lib/property-store";
import { PROPERTY_IMAGE_PLACEHOLDER, resolvePropertyImage } from "@/lib/property-image";
import { cn } from "@/lib/utils";

export interface PropertyRoomStat {
  total: number;
  terisi: number;
  /** null = belum ada kamar terdaftar */
  okupansi: number | null;
}

interface PropertyListTabProps {
  properties: ManagedProperty[];
  activePropertyId: string;
  roomStats: Record<string, PropertyRoomStat>;
  onAdd: () => void;
  onEdit: (property: ManagedProperty) => void;
  onSwitch: (property: ManagedProperty) => void;
  onDelete: (property: ManagedProperty) => void;
}

function formatOkupansi(value: number | null): string {
  if (value === null) return "—";
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

/** Pill "Aktif" — titik emerald konsisten dengan semantik status hidup di aplikasi */
function ActiveBadge() {
  return (
    <span className="inline-flex h-[18px] items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-1.5 text-[10px] font-semibold text-zinc-600">
      <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      Aktif
    </span>
  );
}

/** Thumbnail foto fasad kecil — dipakai kartu mobile daftar properti */
function PropertyThumb({ property }: { property: ManagedProperty }) {
  return (
    <img
      src={resolvePropertyImage(property.imageUrl)}
      alt={`Foto fasad ${property.name}`}
      className="size-10 shrink-0 rounded-lg border border-border object-cover"
      onError={(e) => {
        e.currentTarget.src = PROPERTY_IMAGE_PLACEHOLDER;
      }}
    />
  );
}

function OkupansiCell({ stat, unitShort }: { stat: PropertyRoomStat | undefined; unitShort: string }) {
  const s = stat ?? { total: 0, terisi: 0, okupansi: null };
  return (
    <div className="space-y-1">
      <p className="text-[13px] tabular-nums text-zinc-800">
        {s.total > 0 ? (
          <>
            {s.terisi}/{s.total} {unitShort} · <span className="font-semibold">{formatOkupansi(s.okupansi)}</span>
          </>
        ) : (
          <span className="text-zinc-400">Belum ada {unitShort.toLowerCase()}</span>
        )}
      </p>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
        {s.total > 0 && (
          <div
            className="h-full rounded-full bg-zinc-900"
            style={{ width: `${Math.min(100, ((s.terisi / s.total) * 100))}%` }}
          />
        )}
      </div>
    </div>
  );
}

export function PropertyListTab({
  properties,
  activePropertyId,
  roomStats,
  onAdd,
  onEdit,
  onSwitch,
  onDelete,
}: PropertyListTabProps) {
  const [confirmTarget, setConfirmTarget] = useState<ManagedProperty | null>(null);
  const isLastProperty = properties.length <= 1;

  const rowMenu = (p: ManagedProperty) => {
    const active = p.id === activePropertyId;
    return (
      <>
        <DropdownMenuItem onClick={() => onEdit(p)} className="gap-2 text-[13px]">
          <Pencil className="size-4 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
          Edit Info Properti
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (!active) onSwitch(p);
          }}
          disabled={active}
          className="gap-2 text-[13px]"
        >
          <ArrowLeftRight className="size-4 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
          {active ? "Properti Aktif" : "Pindah Kelola"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            if (!isLastProperty) setConfirmTarget(p);
          }}
          disabled={isLastProperty}
          className="gap-2 text-[13px] text-red-600 focus:bg-red-50 focus:text-red-700"
        >
          <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Hapus Properti
        </DropdownMenuItem>
      </>
    );
  };

  return (
    <div className="space-y-3">
      {/* Kartu daftar properti */}
      <section className="overflow-hidden rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
            <h3 className="text-[13px] font-semibold text-zinc-900">Daftar Properti</h3>
            <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-zinc-100 px-1.5 text-[10px] font-semibold tabular-nums text-zinc-500">
              {properties.length}
            </span>
          </div>
          <Button
            variant="outline"
            onClick={onAdd}
            className="h-8 border-zinc-200 bg-white px-2.5 text-[12.5px] font-semibold text-zinc-800 shadow-none hover:bg-zinc-50"
          >
            <Plus className="size-4 text-zinc-500" strokeWidth={2} aria-hidden="true" />
            Tambah Properti
          </Button>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Nama Properti</th>
                <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Alamat &amp; Kota</th>
                <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Jumlah Unit &amp; Okupansi</th>
                <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Admin / Penjaga</th>
                <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-zinc-400">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => {
                const active = p.id === activePropertyId;
                return (
                  <tr
                    key={p.id}
                    className={cn("border-b border-border last:border-0 transition-colors", active ? "bg-zinc-50/60" : "hover:bg-zinc-50/60")}
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-zinc-900">{p.name}</span>
                        {active && <ActiveBadge />}
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        {p.floors > 0 ? `${p.floors} Lantai` : "Lantai —"}
                        {p.targetRooms > 0 ? ` · Target ${p.targetRooms} ${PROPERTY_TYPE_META[p.type].unitNoun}` : ""}
                        {p.jamMalam ? ` · Jam malam ${p.jamMalam}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[220px] truncate text-[12.5px] text-zinc-700">{p.address || "—"}</p>
                      <p className="max-w-[220px] truncate text-[11px] text-zinc-400">
                        {[p.kelurahan, p.city].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <OkupansiCell stat={roomStats[p.id]} unitShort={PROPERTY_TYPE_META[p.type].unitShort} />
                    </td>
                    <td className="px-4 py-3">
                      <p className={cn("text-[12.5px]", p.admin ? "text-zinc-700" : "text-zinc-300")}>{p.admin || "—"}</p>
                      {p.rekening && (
                        <p className="mt-0.5 text-[11px] tabular-nums text-zinc-400">
                          {p.rekening.bank} {p.rekening.number}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                            aria-label={`Aksi untuk ${p.name}`}
                          >
                            <MoreHorizontal className="size-4" strokeWidth={1.75} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {rowMenu(p)}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-border md:hidden">
          {properties.map((p) => {
            const active = p.id === activePropertyId;
            const s = roomStats[p.id] ?? { total: 0, terisi: 0, okupansi: null };
            return (
              <div key={p.id} className={cn("space-y-2 p-4", active && "bg-zinc-50/60")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <PropertyThumb property={p} />
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-[13px] font-semibold text-zinc-900">{p.name}</span>
                      {active && <ActiveBadge />}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="-mr-1.5 -mt-1 size-8 shrink-0 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                        aria-label={`Aksi untuk ${p.name}`}
                      >
                        <MoreHorizontal className="size-4" strokeWidth={1.75} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {rowMenu(p)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-[12.5px] text-zinc-700">{p.address || "—"}</p>
                <p className="text-[11px] text-zinc-400">{[p.kelurahan, p.city].filter(Boolean).join(" · ") || "—"}</p>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="tabular-nums text-zinc-600">
                    {s.total > 0 ? `${s.terisi}/${s.total} ${PROPERTY_TYPE_META[p.type].unitShort} · ${formatOkupansi(s.okupansi)}` : `Belum ada ${PROPERTY_TYPE_META[p.type].unitShort.toLowerCase()}`}
                  </span>
                  <span className={cn(p.admin ? "text-zinc-600" : "text-zinc-300")}>{p.admin || "Admin —"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-[11.5px] text-zinc-400">
        Profil tiap properti bersifat independen — aturan kost, jam malam, dan rekening penampung dapat berbeda antar cabang.
      </p>

      {/* Konfirmasi keamanan hapus properti */}
      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-[440px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">
              Hapus Properti {confirmTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12.5px] leading-5">
              Properti ini akan dikeluarkan dari daftar &amp; switcher beserta data kamar lokalnya
              {confirmTarget?.id === activePropertyId ? " — properti aktif otomatis berpindah ke properti lain." : "."}{" "}
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 border-zinc-200 bg-white text-[13px] text-zinc-700 shadow-none hover:bg-zinc-100">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-9 bg-red-600 text-[13px] font-semibold text-white shadow-none hover:bg-red-700"
              onClick={() => {
                if (confirmTarget) onDelete(confirmTarget);
                setConfirmTarget(null);
              }}
            >
              Ya, Hapus Properti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
