"use client";

import { useState } from "react";
import { Check, DoorOpen, TriangleAlert, Wrench } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  distinctFloors,
  FACILITY_OPTIONS,
  formatIDR,
  OPERATIONAL_META,
  ROOM_TYPE_OPTIONS,
  roomNomor,
  type OperationalStatus,
  type Room,
} from "@/lib/kost-data";
import type { FacilityItem } from "@/lib/app-settings";
import { cn } from "@/lib/utils";
import { RupiahInput } from "./rupiah-input";

export interface RoomPatch {
  id: string;
  floor: number;
  type: string;
  price: number;
  facilities: string[];
  operational: OperationalStatus;
}

interface RoomManageModalProps {
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Full dataset — for duplicate-number validation & floor options */
  allRooms: Room[];
  onSave: (room: Room, patch: RoomPatch) => void;
  /** Only invoked for vacant rooms (occupied rooms show inline validation) */
  onDelete: (room: Room) => void;
  /** Katalog master fasilitas unit (dari Pengaturan → Katalog Fasilitas) */
  facilityCatalog?: FacilityItem[];
}

const inputCls =
  "h-9 border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-600 focus-visible:ring-zinc-900/5";

const OPS: OperationalStatus[] = ["siap", "perbaikan", "nonaktif"];

const OP_DOT: Record<OperationalStatus, string> = {
  siap: "bg-emerald-500",
  perbaikan: "bg-amber-500",
  nonaktif: "bg-zinc-400",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">{children}</h3>
  );
}

/** Checkbox pill — toggles a facility on/off */
function FacilityPill({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors select-none",
        checked
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-border bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="size-3.5 border-zinc-300 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-zinc-900"
        aria-label={label}
      />
      {label}
    </label>
  );
}

export function RoomManageModal({
  room,
  open,
  onOpenChange,
  allRooms,
  onSave,
  onDelete,
  facilityCatalog,
}: RoomManageModalProps) {
  // Parent remounts via `key` on open — initializers are safe here.
  // Katalog master + fasilitas legacy milik kamar ini (mis. dihapus dari katalog) tetap tampil.
  const baseCatalog: FacilityItem[] =
    facilityCatalog ?? FACILITY_OPTIONS.map((label) => ({ id: `def_${label}`, label }));
  const catalog: FacilityItem[] = [
    ...baseCatalog,
    ...(room?.facilities ?? [])
      .filter((f) => !baseCatalog.some((c) => c.label === f))
      .map((label) => ({ id: `legacy_${label}`, label })),
  ];
  // Nilai awal = NOMOR kamar murni (bukan kunci internal) — mengedit nomor
  // tidak pernah mengubah identitas kamar (id) di database.
  const [roomId, setRoomId] = useState(room ? roomNomor(room) : "");
  const [floor, setFloor] = useState<number>(room?.floor ?? 1);
  const [customFloor, setCustomFloor] = useState(String(room?.floor ?? 1));
  const [floorMode, setFloorMode] = useState<"select" | "custom">("select");
  const [type, setType] = useState(room?.type ?? "Tipe A - AC");
  const [price, setPrice] = useState(room?.price ?? 0);
  const [facilities, setFacilities] = useState<string[]>(room?.facilities ?? []);
  const [operational, setOperational] = useState<OperationalStatus>(room?.operational ?? "siap");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!room) return null;

  const occupied = room.status !== "kosong" && !!room.tenant;
  const trimmedId = roomId.trim();
  // Duplikat divalidasi PER PROPERTI lewat NOMOR tampilan (murni tanpa suffix)
  const duplicate = allRooms.some(
    (r) => r.id !== room.id && roomNomor(r).toLowerCase() === trimmedId.toLowerCase()
  );
  const idInvalid = trimmedId.length === 0 || duplicate;
  const customFloorNum = Number(customFloor);
  const floorInvalid = floorMode === "custom" && (!Number.isInteger(customFloorNum) || customFloorNum < 1);
  const valid = !idInvalid && !floorInvalid && price > 0;

  const existingFloors = distinctFloors(allRooms);
  const floorOptions = existingFloors.includes(room.floor)
    ? existingFloors
    : [...existingFloors, room.floor].sort((a, b) => a - b);
  const maxFloor = Math.max(...existingFloors, room.floor);

  const toggleFacility = (f: string) =>
    setFacilities((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const save = () => {
    if (!valid) return;
    onSave(room, {
      id: trimmedId,
      floor: floorMode === "custom" ? customFloorNum : floor,
      type,
      price,
      facilities,
      operational,
    });
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-[520px] scrollbar-thin">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-900">
              <span className="flex size-7 items-center justify-center rounded-md border border-border bg-zinc-50">
                <DoorOpen className="size-4 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
              </span>
              Kelola Kamar {roomNomor(room)}
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-zinc-700">
              Ubah nomor, tipe, tarif, fasilitas, atau status operasional kamar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-5 py-4">
            {/* Identitas */}
            <section>
              <SectionLabel>Identitas Kamar</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rm-nomor" className="text-[12.5px] text-zinc-600">
                    Nomor / Nama Kamar
                  </Label>
                  <Input
                    id="rm-nomor"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="mis. 101, A01, Paviliun Barat"
                    className={cn(inputCls, idInvalid && "border-red-300 focus-visible:ring-red-900/10")}
                    aria-invalid={idInvalid}
                  />
                  {duplicate ? (
                    <p className="text-xs font-medium text-red-600">
                      Nomor "{trimmedId}" sudah dipakai kamar lain.
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-700">Boleh angka atau nama unik (mis. "Paviliun Barat").</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12.5px] text-zinc-600">Posisi Lantai / Blok</Label>
                  {floorMode === "select" ? (
                    <Select
                      value={String(floor)}
                      onValueChange={(v) => {
                        if (v === "__custom") setFloorMode("custom");
                        else setFloor(Number(v));
                      }}
                    >
                      <SelectTrigger className="h-9 w-full border-zinc-200 text-[13px] focus:ring-zinc-900/5" aria-label="Posisi lantai">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {floorOptions.map((f) => (
                          <SelectItem key={f} value={String(f)} className="text-[13px]">
                            Lantai {f}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom" className="text-[13px] font-medium text-zinc-900">
                          + Lantai baru…
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-1.5">
                      <Input
                        autoFocus
                        type="number"
                        min={1}
                        max={30}
                        value={customFloor}
                        onChange={(e) => setCustomFloor(e.target.value)}
                        aria-label="Nomor lantai baru"
                        className={cn(inputCls, "tabular-nums", floorInvalid && "border-red-300")}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 shrink-0 border-zinc-200 px-2.5 text-[12.5px] text-zinc-700 shadow-none hover:bg-zinc-50"
                        onClick={() => {
                          setFloorMode("select");
                          setFloor(room.floor);
                        }}
                      >
                        Batal
                      </Button>
                    </div>
                  )}
                  {floorMode === "custom" && !floorInvalid && (
                    <p className="text-xs text-zinc-700">Kamar akan tampil pada seksi "Lantai {customFloorNum}".</p>
                  )}
                </div>
              </div>
            </section>

            {/* Spesifikasi & tarif */}
            <section>
              <SectionLabel>Spesifikasi &amp; Tarif</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[12.5px] text-zinc-600">Tipe Kamar</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-9 w-full border-zinc-200 text-[13px] focus:ring-zinc-900/5" aria-label="Tipe kamar">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROOM_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t} className="text-[13px]">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rm-harga" className="text-[12.5px] text-zinc-600">
                    Harga Dasar Sewa
                  </Label>
                  <RupiahInput
                    id="rm-harga"
                    ariaLabel="Harga dasar sewa per bulan"
                    value={price}
                    onChange={setPrice}
                  />
                  <p className="text-xs text-zinc-700">
                    {price > 0 ? `${formatIDR(price)} per bulan` : "Harga wajib diisi."}
                  </p>
                </div>
              </div>
            </section>

            {/* Fasilitas */}
            <section>
              <SectionLabel>Fasilitas</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {catalog.map((f) => (
                  <FacilityPill key={f.id} label={f.label} checked={facilities.includes(f.label)} onToggle={() => toggleFacility(f.label)} />
                ))}
              </div>
            </section>

            {/* Status operasional */}
            <section>
              <SectionLabel>Status Operasional</SectionLabel>
              <div
                role="radiogroup"
                aria-label="Status operasional kamar"
                className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-zinc-50 p-0.5"
              >
                {OPS.map((op) => {
                  const active = operational === op;
                  return (
                    <button
                      key={op}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setOperational(op)}
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[12.5px] font-medium transition-all",
                        active
                          ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-zinc-200"
                          : "text-zinc-700 hover:text-zinc-800"
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", OP_DOT[op])} aria-hidden="true" />
                      {OPERATIONAL_META[op].label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-5 text-zinc-700">
                <Wrench className="mt-0.5 size-3.5 shrink-0 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
                {OPERATIONAL_META[operational].hint}
              </p>
            </section>
          </div>

          {/* Footer — destructive left, actions right */}
          <DialogFooter className="flex-col gap-3 border-t border-border bg-zinc-50 px-5 py-4 sm:justify-between">
            <div className="mr-auto">
              {occupied ? (
                <div className="flex max-w-[300px] items-start gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-red-500" strokeWidth={1.75} aria-hidden="true" />
                  <p className="text-[12.5px] leading-4 font-medium text-red-700">
                    Kamar tidak bisa dihapus selama masih ada penghuni aktif. Lakukan check-out terlebih dahulu.
                  </p>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2.5 text-[12.5px] font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setConfirmDelete(true)}
                >
                  Hapus Kamar Ini
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 border-zinc-200 bg-white px-3.5 text-[13px] font-medium text-zinc-700 shadow-none hover:bg-zinc-100"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={!valid}
                onClick={save}
                className="h-9 bg-zinc-900 px-3.5 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800 disabled:opacity-50"
              >
                <Check className="size-3.5" strokeWidth={2} />
                Simpan Perubahan
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation (vacant rooms only) */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">Hapus Kamar {roomNomor(room)}?</AlertDialogTitle>
            <AlertDialogDescription className="text-[12.5px] leading-5">
              Kamar {roomNomor(room)} — {room.type} ({formatIDR(room.price)}/bln) akan dihapus permanen dari denah.
              Riwayat transaksi kas tetap tersimpan di UnitKu. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 border-zinc-200 bg-white text-[13px] text-zinc-700 shadow-none hover:bg-zinc-100">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-9 bg-red-600 text-[13px] font-semibold text-white shadow-none hover:bg-red-700"
              onClick={() => {
                setConfirmDelete(false);
                onOpenChange(false);
                onDelete(room);
              }}
            >
              Ya, Hapus Kamar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
