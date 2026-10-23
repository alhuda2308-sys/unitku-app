"use client";

import { Megaphone, MoreVertical, PencilLine, Trash2, UserPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatIDRShort, OPERATIONAL_META, type Room } from "@/lib/kost-data";
import { isVillaType } from "@/lib/app-settings";
import { adCtaLabel, adPropertyScope } from "@/lib/ad-generator";
import { StatusBadge, STATUS_SKIN } from "./status-badge";

interface RoomCardProps {
  room: Room;
  onSelect: (room: Room) => void;
  onManage: (room: Room) => void;
  /** false = peran read-only (Penjaga) — menu opsi disembunyikan */
  onDelete: (room: Room) => void;
  onCheckin?: (room: Room) => void;
  /** Unit kosong siap huni → tombol aksen "Buat Iklan …" (Generator Iklan Sosmed) */
  onCreateAd?: (room: Room) => void;
  /** false = sembunyikan menu kebab Opsi (Penjaga) — default true */
  canManage?: boolean;
  /** Tipe properti aktif (kost/kontrakan/rusun) — label tombol adaptif:
  *  "Buat Iklan Kamar" (kost) / "Buat Iklan Kontrakan" / "Buat Iklan Unit" */
  propertyType?: string;
}

/**
 * Kartu kamar SOLID — seluruh permukaan terisi warna blok sesuai status
 * (lunas/jatuh tempo/menunggak/kosong) dan tema aktif. Tinggi seragam
 * h-[124px], tata letak 3 baris presisi (justify-between).
 */
export function RoomCard({ room, onSelect, onManage, onDelete, onCheckin, onCreateAd, canManage = true, propertyType }: RoomCardProps) {
  const isVacant = room.status === "kosong";
  const op = room.operational ?? "siap";
  /** Kamar kosong siap huni → tampilkan tombol aksen Generator Iklan Sosmed */
  const showAdCta = isVacant && op === "siap" && Boolean(onCreateAd);
  /** Label tombol iklan adaptif tipe properti aktif (Kamar/Kontrakan/Unit) */
  const adCta = adCtaLabel(adPropertyScope(propertyType));
  const skin = STATUS_SKIN[room.status] ?? STATUS_SKIN.kosong;
  const vacantLabel =
    op === "siap" ? (
      <span className="text-sm italic opacity-90">Tersedia</span>
    ) : (
      <span
        className={cn(
          "text-sm font-semibold",
          op === "perbaikan" ? "font-bold" : "italic opacity-90"
        )}
      >
        {OPERATIONAL_META[op].label}
      </span>
    );

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onSelect(room)}
        aria-label={
          isVacant
            ? `Kamar ${room.id}, ${OPERATIONAL_META[op].label}, ${room.type}, ${formatIDRShort(room.price)} per bulan`
            : `Kamar ${room.id}, ${room.tenant?.name}, ${room.invoice?.dueLabel ?? ""}`
        }
        className={cn(
          // ik-card: hook struktural tema karakter (brutalis/arsip/blueprint)
          "ik-card flex h-[124px] w-full cursor-pointer flex-col justify-between rounded-lg border p-3 text-left transition-all duration-100",
          "hover:shadow-[0_4px_14px_rgba(15,23,42,0.16)] hover:brightness-[0.97] active:brightness-[0.94]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ik-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          skin.card,
          isVacant && "border-dashed"
        )}
      >
        {/* Baris 1: nomor kamar + pill status solid di pojok kanan atas */}
        <div className="flex items-center justify-between gap-1.5 pr-6">
          <span className="ik-head truncate text-base font-extrabold leading-6 tabular-nums sm:text-lg sm:leading-7">{room.id}</span>
          <StatusBadge room={room} solid />
        </div>

        {/* Baris 2: nama penyewa / label kosong (kamar siap huni → area tombol iklan) */}
        <div className="flex-1 overflow-hidden pt-1">
          {isVacant ? (
            vacantLabel
          ) : (
            <span className="block truncate text-sm font-bold leading-5">
              {room.tenant?.name}
            </span>
          )}
        </div>

        {/* Baris 3: chip tipe + tanggal tempo / harga (kamar dgn CTA iklan →
            baris ini digantikan tombol aksen; tipe & harga tetap terbaca via
            aria-label kartu, drawer, & modal iklan) */}
        {showAdCta ? null : (
        <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1">
          <span
            className={cn(
              "ik-num inline-flex max-w-full min-w-0 items-center truncate rounded border px-2 py-0.5 text-xs font-semibold leading-4 whitespace-nowrap",
              skin.chip
            )}
          >
            <span className="truncate">{room.type}</span>
          </span>
          {isVacant ? (
            <span className="ik-num ml-auto text-xs font-bold tabular-nums whitespace-nowrap">
              {formatIDRShort(room.price)}{isVillaType(propertyType) ? "/hari" : "/bln"}
            </span>
          ) : (
            <span className="ik-num ml-auto truncate text-xs font-semibold tabular-nums whitespace-nowrap">
              {room.invoice?.dueLabel}
            </span>
          )}
        </div>
        )}
      </button>

      {/* Tombol aksen Generator Iklan — khusus kamar KOSONG siap huni,
          overlay di baris bawah kartu (info tipe/harga tetap ada di drawer).
          Sibling (bukan child) dari kartu <button> agar HTML tetap valid dan
          klik tengah kartu tetap membuka drawer detail. */}
      {showAdCta && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCreateAd?.(room);
          }}
          aria-label={`Buat iklan kamar ${room.id} untuk promosi sosmed`}
          className={cn(
            "absolute inset-x-2.5 bottom-2.5 z-10 flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded-md",
            "bg-gradient-to-r from-amber-500 to-orange-500 text-[11px] font-bold text-white shadow-sm",
            "transition-all hover:from-amber-600 hover:to-orange-600 hover:shadow-md active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          )}
        >
          <Megaphone className="size-3" strokeWidth={2.25} aria-hidden="true" />
          {adCta}
        </button>
      )}

      {/* Kebab: hover-reveal on pointer devices, always visible on touch */}
      {canManage && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Opsi kamar ${room.id}`}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "absolute top-[7px] right-[7px] z-10 flex size-6 items-center justify-center rounded-md",
              "opacity-0 transition-opacity group-hover:opacity-100",
              "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20",
              "data-[state=open]:opacity-100",
              "[@media(hover:none)]:opacity-100",
              skin.kebab
            )}
          >
            <MoreVertical className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => onManage(room)}
            className="text-[13px]"
          >
            <PencilLine className="size-3.5 text-zinc-700" strokeWidth={1.75} />
            Kelola Kamar…
          </DropdownMenuItem>
          {isVacant && op === "siap" && onCheckin && (
            <DropdownMenuItem onClick={() => onCheckin(room)} className="text-[13px]">
              <UserPlus className="size-3.5 text-zinc-700" strokeWidth={1.75} />
              {isVillaType(propertyType) ? "Check-in Tamu" : "Check-in Penghuni"}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(room)}
            className="text-[13px] text-red-600 focus:bg-red-50 focus:text-red-700"
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
            Hapus Kamar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      )}
    </div>
  );
}
