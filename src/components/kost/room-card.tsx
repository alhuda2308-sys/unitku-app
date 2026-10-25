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
import { formatIDR, OPERATIONAL_META, roomNomor, type Room } from "@/lib/kost-data";
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
 * h-[124px]; badge tarif sewa selalu tampil di area tengah kartu
 * (kosong/terisi/custom), CTA iklan → tarif tepat di atas tombol aksen.
 */
export function RoomCard({ room, onSelect, onManage, onDelete, onCheckin, onCreateAd, canManage = true, propertyType }: RoomCardProps) {
  const isVacant = room.status === "kosong";
  const op = room.operational ?? "siap";
  /** Kamar kosong siap huni → tampilkan tombol aksen Generator Iklan Sosmed */
  const showAdCta = isVacant && op === "siap" && Boolean(onCreateAd);
  /** Label tombol iklan adaptif tipe properti aktif (Kamar/Kontrakan/Unit) */
  const adCta = adCtaLabel(adPropertyScope(propertyType));
  const skin = STATUS_SKIN[room.status] ?? STATUS_SKIN.kosong;
  /** Periode tarif: harian utk properti Villa/Homestay & kontrak Harian,
   *  selain itu bulanan. room.price = tarif per periode tsb. */
  const sewaHarian = isVillaType(propertyType) || room.contract?.duration === "Harian";
  const perLabel = sewaHarian ? "per hari" : "per bulan";
  const periodeSuffix = sewaHarian ? " / hari" : " / bln";
  /** Tarif penuh format Indonesia — "Rp1.500.000 / bln" — tampil di SEMUA kartu
   *  (kosong/terisi/custom). Sumber: room.price (ikut ter-update saat kamar
   *  custom ditambah / tarif tipe diedit karena kartu murni render data room). */
  const priceLabel = `${formatIDR(room.price)}${periodeSuffix}`;
  /** Tanggal tempo ringkas utk baris bawah kartu ("28 Sep") — prefix "Tempo:"
   *  dilepas agar muat sebaris dgn chip tipe; pill status (H-1/H+3/Lunas) di
   *  atas sudah memberi konteks, label penuh tetap ada di drawer & aria-label. */
  const dueDateShort = room.invoice?.dueLabel?.replace(/^Tempo:\s*/i, "");
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
  /** Badge tarif — chip kontras mengikuti skin status kartu (tema-aktif).
   *  px-1.5 (bukan px-2): teks tarif 17-karakter hanya berlebih ~0.5px di kartu
   *  2-kolom mobile → padding tipis mencegah ellipsis fraksional. */
  const priceChip = (
    <span
      className={cn(
        "ik-num inline-flex max-w-full min-w-0 items-center rounded border px-1.5 py-0.5 text-xs font-bold leading-4 tabular-nums whitespace-nowrap",
        skin.chip
      )}
    >
      <span className="truncate">{priceLabel}</span>
    </span>
  );

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onSelect(room)}
        aria-label={
          isVacant
            ? `Kamar ${roomNomor(room)}, ${OPERATIONAL_META[op].label}, ${room.type}, ${formatIDR(room.price)} ${perLabel}`
            : `Kamar ${roomNomor(room)}, ${room.tenant?.name}, ${room.invoice?.dueLabel ?? ""}, ${formatIDR(room.price)} ${perLabel}`
        }
        className={cn(
          // ik-card: hook struktural tema karakter (brutalis/arsip/blueprint)
          "ik-card flex h-[124px] w-full cursor-pointer flex-col justify-between rounded-lg border p-3 text-left transition-all duration-100",
          // CTA iklan overlay di bawah → reserve ruang agar tarif tidak tertutup
          showAdCta && "pb-10",
          "hover:shadow-[0_4px_14px_rgba(15,23,42,0.16)] hover:brightness-[0.97] active:brightness-[0.94]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ik-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          skin.card,
          isVacant && "border-dashed"
        )}
      >
        {/* Baris 1: nomor kamar + pill status solid di pojok kanan atas */}
        <div className="flex items-center justify-between gap-1.5 pr-6">
          <span className="ik-head truncate text-base font-extrabold leading-6 tabular-nums sm:text-lg sm:leading-7">{roomNomor(room)}</span>
          <StatusBadge room={room} solid />
        </div>

        {/* Baris 2: tarif sewa — SELALU tampil (kosong/terisi/custom), area
            tengah kartu tepat di bawah nomor/status & di atas nama penyewa.
            Kartu dgn CTA iklan: tarif dipindah ke baris 3 (tepat di atas
            tombol "Buat Iklan"). */}
        {showAdCta ? (
          <div className="flex-1 overflow-hidden pt-1">{vacantLabel}</div>
        ) : (
          <div className="flex min-w-0 items-center pt-0.5">{priceChip}</div>
        )}

        {/* Baris 3 (CTA iklan): badge tarif tepat di atas tombol aksen */}
        {showAdCta && <div className="flex min-w-0 items-center">{priceChip}</div>}

        {/* Baris 3/4: nama penyewa (terisi) + chip tipe + tanggal tempo */}
        {showAdCta ? null : (
        <>
          {!isVacant && (
            <div className="flex-1 overflow-hidden pt-1">
              <span className="block truncate text-sm font-bold leading-5">
                {room.tenant?.name}
              </span>
            </div>
          )}
          {isVacant && <div className="flex-1 overflow-hidden pt-1">{vacantLabel}</div>}
          {/* nowrap + truncate: baris ini WAJIB satu baris — bila wrap,
              baris nama penyewa (flex-1) di atasnya tergenting & kolaps */}
          <div className="flex items-center justify-between gap-x-1.5">
            <span
              className={cn(
                "ik-num inline-flex min-w-0 items-center truncate rounded border px-2 py-0.5 text-xs font-semibold leading-4 whitespace-nowrap",
                skin.chip
              )}
            >
              <span className="truncate">{room.type}</span>
            </span>
            {!isVacant && dueDateShort && (
              <span className="ik-num ml-auto shrink-0 text-xs font-semibold tabular-nums whitespace-nowrap">
                {dueDateShort}
              </span>
            )}
          </div>
        </>
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
          aria-label={`Buat iklan kamar ${roomNomor(room)} untuk promosi sosmed`}
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
            aria-label={`Opsi kamar ${roomNomor(room)}`}
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
