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
import {
  formatIDR,
  OPERATIONAL_META,
  roomNomor,
  type Room,
} from "@/lib/kost-data";
import { contractEndOf, isContractPastEnd } from "@/lib/room-status";
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
 * (lunas/jatuh tempo/menunggak/kosong) dan tema aktif. Tinggi h-[176px]
 * menampung susunan vertikal 5 baris kartu TERISI:
 *   1) nomor kamar + badge status   2) nama penyewa (text-sm font-bold)
 *   3) badge tarif sewa             4) tanggal sewa "Masuk:"/"Habis:" (text-xs)
 *   5) badge tipe kamar.
 * Kartu KOSONG menyembunyikan nama penyewa & baris tanggal; CTA iklan
 * menggantikan baris tipe (tarif tepat di atas tombol aksen).
 *
 * Status yang tampil adalah status DINAMIS (single source of truth di
 * src/lib/room-status.ts): dashboard sudah menggeser kamar kontraknya lewat
 * menjadi menunggak (merah/merah muda — bukan biru/hijau lunas), sehingga
 * baris "Habis" kamar lewat tempo tampil MERAH + sufiks "(Lewat Tempo)".
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

  // ── Baris 4: tanggal sewa — label Indonesia siap tampil dari SATU fungsi
  //    bersama contractEndOf (room-status.ts): endDate kontrak eksplisit,
  //    fallback kanonik masuk + 1 siklus sewa — fungsi yang sama dipakai
  //    kalkulasi status, sehingga tanggal tampil & status TIDAK mungkin
  //    berbeda sumber (tanpa split-brain). SEMUA kartu terisi (Lunas/Jatuh
  //    Tempo/Menunggak) selalu menampilkan baris Habis, bukan hanya lewat tempo.
  const masukLabel =
    room.contract?.startDate?.trim() ||
    (room.tenant?.moveInDate && room.tenant.moveInDate !== "—" ? room.tenant.moveInDate : "");
  const habisLabel = contractEndOf(room).label;
  /** Lewat tempo: status efektif "menunggak" — hari ini sudah melewati tanggal
   *  habis kontrak tanpa pembayaran baru (dihitung terpusat di room-status.ts
   *  oleh dashboard). Baris Habis tampil MERAH + sufiks "(Lewat Tempo)".
   *  Kamar "jatuhTempo" (jendela H-3..H+0) belum lewat — tanpa sufiks ini. */
  const isLewatTempo = !isVacant && room.status === "menunggak" && isContractPastEnd(room);
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
  /** Badge tipe kamar — baris 5 (paling bawah) kartu terisi/kosong non-CTA */
  const typeChip = (
    <span
      className={cn(
        "ik-num inline-flex max-w-full min-w-0 items-center rounded border px-2 py-0.5 text-xs font-semibold leading-4 whitespace-nowrap",
        skin.chip
      )}
    >
      <span className="truncate">{room.type}</span>
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
            : `Kamar ${roomNomor(room)}, ${room.tenant?.name ?? ""}, Masuk ${masukLabel || "—"}${
                habisLabel ? `, Habis ${habisLabel}${isLewatTempo ? " (Lewat Tempo)" : ""}` : ""
              }, ${formatIDR(room.price)} ${perLabel}`
        }
        className={cn(
          // ik-card: hook struktural tema karakter (brutalis/arsip/blueprint)
          // min-h (bukan h): kartu lewat tempo melar seadanya saat chip
          // "Lewat Tempo" turun baris di grid sempit — tinggi seragam per baris
          // grid tetap terjaga (align stretch).
          "ik-card flex h-full min-h-[176px] w-full cursor-pointer flex-col rounded-lg border p-3 text-left transition-all duration-100",
          // CTA iklan overlay di bawah → reserve ruang agar tarif tidak tertutup
          showAdCta && "pb-10",
          "hover:shadow-[0_4px_14px_rgba(15,23,42,0.16)] hover:brightness-[0.97] active:brightness-[0.94]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ik-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          skin.card,
          isVacant && "border-dashed"
        )}
      >
        {/* Baris 1: nomor kamar + pill status solid di pojok kanan atas.
            Nomor shrink-0 = tidak pernah menyusut/terpotong "…"; badge yang
            menyusut sendirian saat baris sempit — defect lama: nomor tergerus
            sampai hilang. Badge versi ringkas utk kartu (text-[11px], px-2,
            tanpa tracking) supaya label penuh "Jatuh Tempo"/"Menunggak" muat
            di grid 6 kolom desktop; mobile ekstrem terpotong rapi dgn "…"
            (status tetap jelas dr warna kartu + chip Lewat Tempo). */}
        <div className="flex items-center justify-between gap-1 pr-6">
          <span className="ik-head shrink-0 truncate text-base font-extrabold leading-6 tabular-nums sm:text-lg sm:leading-7">{roomNomor(room)}</span>
          {/* px-1 (bukan px-1.5): label penuh "Jatuh Tempo" (77px @11px) butuh
              ~2px lagi agar tidak ellipsis fraksional di grid 6 kolom desktop. */}
          <StatusBadge room={room} solid className="min-w-0 shrink px-1 text-[11px] tracking-normal" />
        </div>

        {isVacant ? (
          // ── Kartu KOSONG: nama penyewa & baris tanggal disembunyikan —
          //    label status operasional + tarif (+ tipe bila tanpa CTA iklan).
          <>
            <div className="min-h-0 flex-1 overflow-hidden pt-1">{vacantLabel}</div>
            <div className="flex min-w-0 items-center">{priceChip}</div>
            {!showAdCta && <div className="mt-1.5 flex min-w-0 items-center">{typeChip}</div>}
          </>
        ) : (
          <>
            {/* Baris 2: nama penyewa — text-sm font-bold, DI ATAS tarif agar
                pemilik langsung membaca siapa penghuninya sebelum tarif */}
            <div className="min-h-0 flex-1 overflow-hidden pt-1">
              <span className="block truncate text-sm font-bold leading-5">
                {room.tenant?.name ?? "—"}
              </span>
            </div>

            {/* Baris 3: badge tarif sewa */}
            <div className="flex min-w-0 items-center">{priceChip}</div>

            {/* Baris 4: tanggal sewa — Masuk & Habis, SATU baris per info
                (text-xs, tabular-nums). Lewat tempo → SELURUH baris MERAH tebal
                + sufiks "(Lewat Tempo)" persis teks spesifikasi:
                "Habis: 22 Okt 2026 (Lewat Tempo)". Warna merah via var tema
                --ik-card-late-alert agar terbaca di 12 tema (fallback fg kartu). */}
            {(masukLabel || habisLabel) && (
              <div className="mt-1.5 min-w-0 space-y-0.5">
                {masukLabel && (
                  <p className="ik-num truncate text-xs font-medium leading-4 tabular-nums opacity-90">
                    Masuk: {masukLabel}
                  </p>
                )}
                {habisLabel && (
                  // flex-wrap: sufiks "(Lewat Tempo)" turun ke baris kedua di
                  // kartu sempit (grid 6 kolom desktop / 2 kolom mobile) alih-alih
                  // memangkas tanggal — tanggal habis kontrak SELALU terbaca.
                  <p
                    className={cn(
                      "ik-num flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 text-xs leading-4 tabular-nums opacity-90",
                      isLewatTempo &&
                        "font-bold opacity-100 [color:var(--ik-card-late-alert,var(--ik-card-late-fg))]"
                    )}
                  >
                    <span className="truncate">Habis: {habisLabel}</span>
                    {isLewatTempo && (
                      <span className="shrink-0 whitespace-nowrap">(Lewat Tempo)</span>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Baris 5: badge tipe kamar */}
            <div className="mt-1.5 flex min-w-0 items-center">{typeChip}</div>
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
