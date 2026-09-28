"use client";

import { useState } from "react";
import { Check, Layers, Plus, X } from "lucide-react";
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
  DEFAULT_FACILITIES_BY_TYPE,
  FACILITY_OPTIONS,
  formatIDRShort,
  ROOM_TYPE_OPTIONS,
  type Room,
} from "@/lib/kost-data";
import type { FacilityItem } from "@/lib/app-settings";
import { cn } from "@/lib/utils";
import { RupiahInput } from "./rupiah-input";

interface RoomAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allRooms: Room[];
  onAdd: (rooms: Room[]) => void;
  /** Katalog master fasilitas unit (dari Pengaturan → Katalog Fasilitas) */
  facilityCatalog?: FacilityItem[];
  /** Simpan fasilitas custom baru ke katalog master properti */
  onAddCustomFacility?: (label: string) => void;
  /** Hapus fasilitas custom dari katalog master (salah ketik) */
  onRemoveCustomFacility?: (id: string) => void;
}

/** Sensible starting tariff per room type (mock master data) */
const DEFAULT_PRICE_BY_TYPE: Record<string, number> = {
  "Tipe A - AC": 1_500_000,
  "Tipe B - Kipas": 1_100_000,
  "Tipe AC Deluxe": 1_750_000,
  Standar: 900_000,
  VIP: 2_250_000,
};

type Mode = "satu" | "bulk";

const inputCls =
  "h-9 border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-600 focus-visible:ring-zinc-900/5";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">{children}</h3>
  );
}

function FacilityPill({
  label,
  checked,
  onToggle,
  onRemove,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  /** Hadir = pill buatan user — tampil tanda silang mikro (×) untuk hapus */
  onRemove?: () => void;
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
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="-mr-1 ml-px inline-flex size-4 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-zinc-200/70"
          aria-label={`Hapus fasilitas ${label} dari katalog`}
          title="Hapus dari katalog"
        >
          <X className="size-2.5" strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
    </label>
  );
}

export function RoomAddModal({
  open,
  onOpenChange,
  allRooms,
  onAdd,
  facilityCatalog,
  onAddCustomFacility,
  onRemoveCustomFacility,
}: RoomAddModalProps) {
  const [mode, setMode] = useState<Mode>("satu");

  // Katalog master — fallback ke daftar bawaan bila props tak diberikan
  const catalog: FacilityItem[] = facilityCatalog ?? FACILITY_OPTIONS.map((label) => ({ id: `def_${label}`, label }));

  // Shared spec fields
  const [type, setType] = useState<string>(ROOM_TYPE_OPTIONS[0]);
  const [price, setPrice] = useState<number>(DEFAULT_PRICE_BY_TYPE[ROOM_TYPE_OPTIONS[0]] ?? 0);
  const [facilities, setFacilities] = useState<string[]>(
    DEFAULT_FACILITIES_BY_TYPE[ROOM_TYPE_OPTIONS[0]] ?? []
  );
  const [priceTouched, setPriceTouched] = useState(false);
  const [facilityTouched, setFacilityTouched] = useState(false);

  // Tambah fasilitas custom — inline input di baris pill FASILITAS
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState("");

  // Single mode
  const [nomor, setNomor] = useState("");
  const [floor, setFloor] = useState(1);

  // Bulk mode
  const [prefix, setPrefix] = useState("A-");
  const [from, setFrom] = useState("101");
  const [to, setTo] = useState("110");
  const [bulkFloor, setBulkFloor] = useState(1);

  const existingIds = new Set(allRooms.map((r) => r.id.toLowerCase()));
  const maxFloor = allRooms.reduce((m, r) => Math.max(m, r.floor), 0);
  const floorChoices = Array.from({ length: maxFloor + 1 }, (_, i) => i + 1); // 1..max+1

  const changeType = (t: string) => {
    setType(t);
    if (!priceTouched) setPrice(DEFAULT_PRICE_BY_TYPE[t] ?? 0);
    if (!facilityTouched) setFacilities(DEFAULT_FACILITIES_BY_TYPE[t] ?? []);
  };

  // Single validation
  const singleId = nomor.trim();
  const singleDup = existingIds.has(singleId.toLowerCase());
  const singleValid = singleId.length > 0 && !singleDup && price > 0;

  // Bulk generation
  const fromN = Number(from);
  const toN = Number(to);
  const bulkRangeValid =
    prefix.trim().length > 0 &&
    Number.isInteger(fromN) && fromN >= 1 &&
    Number.isInteger(toN) && toN >= fromN && toN - fromN < 200;
  const bulkIds = bulkRangeValid
    ? Array.from({ length: toN - fromN + 1 }, (_, i) => `${prefix.trim()}${fromN + i}`)
    : [];
  const bulkNew = bulkIds.filter((id) => !existingIds.has(id.toLowerCase()));
  const bulkSkipped = bulkIds.length - bulkNew.length;
  const bulkValid = bulkNew.length > 0 && price > 0;

  // ── Fasilitas custom: validasi & submit (Enter / ikon centang) ──────────
  const catalogLabels = catalog.map((f) => f.label.toLowerCase());
  const customDraftTrimmed = customDraft.trim();
  const customDup =
    customDraftTrimmed.length > 0 && catalogLabels.includes(customDraftTrimmed.toLowerCase());
  const submitCustom = () => {
    const label = customDraft.trim();
    if (!label || customDup) return;
    // 1) tersimpan ke katalog master properti (muncul lagi saat tambah kamar berikutnya)
    onAddCustomFacility?.(label);
    // 2) langsung otomatis terpilih untuk kamar yang sedang dibuat
    setFacilityTouched(true);
    setFacilities((prev) => (prev.includes(label) ? prev : [...prev, label]));
    setCustomDraft("");
    setCustomOpen(false);
  };
  const removeCustom = (id: string, label: string) => {
    onRemoveCustomFacility?.(id);
    setFacilities((prev) => prev.filter((x) => x !== label));
  };

  const submit = () => {
    if (mode === "satu") {
      if (!singleValid) return;
      onAdd([
        {
          id: singleId,
          floor,
          type,
          price,
          status: "kosong",
          facilities,
          operational: "siap",
        },
      ]);
    } else {
      if (!bulkValid) return;
      onAdd(
        bulkNew.map((id) => ({
          id,
          floor: bulkFloor,
          type,
          price,
          status: "kosong" as const,
          facilities,
          operational: "siap" as const,
        }))
      );
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-[560px] scrollbar-thin">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-900">
            <span className="flex size-7 items-center justify-center rounded-md border border-border bg-zinc-50">
              <Plus className="size-4 text-zinc-700" strokeWidth={2} aria-hidden="true" />
            </span>
            Tambah Kamar Baru
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-zinc-700">
            Kamar baru masuk denah sebagai kosong &amp; langsung terhitung di metrik okupansi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-4">
          {/* Mode switch */}
          <div
            role="radiogroup"
            aria-label="Mode penambahan kamar"
            className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-zinc-50 p-0.5"
          >
            {(
              [
                { key: "satu", label: "Satu Kamar" },
                { key: "bulk", label: "Bulk Add" },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={mode === m.key}
                onClick={() => setMode(m.key)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[12.5px] font-medium transition-all",
                  mode === m.key
                    ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-zinc-200"
                    : "text-zinc-700 hover:text-zinc-800"
                )}
              >
                {m.key === "bulk" && <Layers className="size-3.5" strokeWidth={1.75} aria-hidden="true" />}
                {m.label}
              </button>
            ))}
          </div>

          {/* Nomor section */}
          <section>
            <SectionLabel>{mode === "satu" ? "Nomor Kamar" : "Rentang Nomor (Bulk Add)"}</SectionLabel>
            {mode === "satu" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ra-nomor" className="text-[12.5px] text-zinc-600">
                    Nomor / Nama Kamar
                  </Label>
                  <Input
                    id="ra-nomor"
                    value={nomor}
                    onChange={(e) => setNomor(e.target.value)}
                    placeholder="mis. 101, A01, Paviliun Barat"
                    className={cn(inputCls, singleDup && "border-red-300 focus-visible:ring-red-900/10")}
                    aria-invalid={singleDup}
                  />
                  {singleDup ? (
                    <p className="text-xs font-medium text-red-600">Nomor "{singleId}" sudah dipakai.</p>
                  ) : (
                    <p className="text-xs text-zinc-700">Gunakan nomor pintu atau nama blok unik.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12.5px] text-zinc-600">Pilih Lantai</Label>
                  <Select value={String(floor)} onValueChange={(v) => setFloor(Number(v))}>
                    <SelectTrigger className="h-9 w-full border-zinc-200 text-[13px] focus:ring-zinc-900/5" aria-label="Pilih lantai">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {floorChoices.map((f) => (
                        <SelectItem key={f} value={String(f)} className="text-[13px]">
                          Lantai {f}
                          {f > maxFloor && <span className="ml-1.5 text-xs text-emerald-600">lantai baru</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor="ra-prefix" className="text-[12.5px] text-zinc-600">
                    Prefix Nomor
                  </Label>
                  <Input
                    id="ra-prefix"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder='mis. "A-"'
                    className={cn(inputCls, "font-mono")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ra-from" className="text-[12.5px] text-zinc-600">
                      Dari
                    </Label>
                    <Input
                      id="ra-from"
                      type="number"
                      min={1}
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className={cn(inputCls, "tabular-nums")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ra-to" className="text-[12.5px] text-zinc-600">
                      Sampai
                    </Label>
                    <Input
                      id="ra-to"
                      type="number"
                      min={1}
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className={cn(inputCls, "tabular-nums")}
                    />
                  </div>
                </div>
              </div>
            )}
            {mode === "satu" ? null : (
              <div className="mt-3 space-y-1.5">
                <Label className="text-[12.5px] text-zinc-600">Lantai Untuk Semua Kamar</Label>
                <Select value={String(bulkFloor)} onValueChange={(v) => setBulkFloor(Number(v))}>
                  <SelectTrigger className="h-9 w-full border-zinc-200 text-[13px] focus:ring-zinc-900/5" aria-label="Lantai untuk semua kamar">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {floorChoices.map((f) => (
                      <SelectItem key={f} value={String(f)} className="text-[13px]">
                        Lantai {f}
                        {f > maxFloor && <span className="ml-1.5 text-xs text-emerald-600">lantai baru</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </section>

          {/* Spesifikasi & tarif */}
          <section>
            <SectionLabel>Spesifikasi &amp; Tarif</SectionLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[12.5px] text-zinc-600">Tipe Kamar</Label>
                <Select value={type} onValueChange={changeType}>
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
                <Label htmlFor="ra-harga" className="text-[12.5px] text-zinc-600">
                  Harga Sewa Pokok
                </Label>
                <RupiahInput
                  id="ra-harga"
                  ariaLabel="Harga sewa pokok per bulan"
                  value={price}
                  onChange={(v) => {
                    setPriceTouched(true);
                    setPrice(v);
                  }}
                />
                <p className="text-xs text-zinc-700">
                  {price > 0 ? `${formatIDRShort(price)}/bln · berlaku semua kamar baru` : "Harga wajib diisi."}
                </p>
              </div>
            </div>
          </section>

          {/* Fasilitas — katalog master + tambah fasilitas custom */}
          <section>
            <SectionLabel>Fasilitas</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {catalog.map((f) => (
                <FacilityPill
                  key={f.id}
                  label={f.label}
                  checked={facilities.includes(f.label)}
                  onToggle={() => {
                    setFacilityTouched(true);
                    setFacilities((prev) =>
                      prev.includes(f.label) ? prev.filter((x) => x !== f.label) : [...prev, f.label]
                    );
                  }}
                  onRemove={
                    f.custom && onRemoveCustomFacility
                      ? () => removeCustom(f.id, f.label)
                      : undefined
                  }
                />
              ))}

              {customOpen ? (
                <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto">
                  <Input
                    autoFocus
                    value={customDraft}
                    onChange={(e) => setCustomDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitCustom();
                      }
                      if (e.key === "Escape") {
                        setCustomOpen(false);
                        setCustomDraft("");
                      }
                    }}
                    placeholder="cth. Water Heater, Meja Kerja, Dapur Mini..."
                    aria-label="Nama fasilitas custom baru"
                    aria-invalid={customDup}
                    className={cn(
                      "h-7 min-w-0 flex-1 rounded-full border-zinc-200 bg-white px-3 text-[12.5px] shadow-none sm:w-[230px] sm:flex-none",
                      customDup && "border-red-300 focus-visible:ring-red-900/10"
                    )}
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={submitCustom}
                    disabled={!customDraftTrimmed || customDup}
                    className="size-7 shrink-0 rounded-full bg-emerald-600 text-white shadow-none hover:bg-emerald-700 disabled:opacity-40"
                    aria-label="Simpan fasilitas custom"
                  >
                    <Check className="size-3.5" strokeWidth={2.5} />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      setCustomOpen(false);
                      setCustomDraft("");
                    }}
                    className="size-7 shrink-0 rounded-full border-zinc-200 bg-white text-zinc-700 shadow-none hover:bg-zinc-50"
                    aria-label="Batal tambah fasilitas"
                  >
                    <X className="size-3.5" strokeWidth={2.25} />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCustomOpen(true)}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-zinc-300 bg-white px-2.5 text-[12.5px] font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-800"
                >
                  <Plus className="size-3" strokeWidth={2} aria-hidden="true" />
                  Tambah Fasilitas
                </button>
              )}
            </div>
            {customOpen && customDup && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                Fasilitas "{customDraftTrimmed}" sudah ada di katalog.
              </p>
            )}
            {customOpen && !customDup && customDraftTrimmed.length > 0 && (
              <p className="mt-1.5 text-xs text-zinc-700">
                Tekan Enter atau ikon centang — fasilitas masuk katalog master &amp; otomatis terpilih.
              </p>
            )}
          </section>

          {/* Bulk preview */}
          {mode === "bulk" && (
            <section className="rounded-lg border border-border bg-zinc-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-700">Pratinjau</p>
                <span className="text-[12.5px] font-semibold tabular-nums text-zinc-700">
                  {bulkNew.length} kamar akan ditambahkan
                </span>
              </div>
              {bulkRangeValid ? (
                <>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {bulkNew.slice(0, 12).map((id) => (
                      <span
                        key={id}
                        className="rounded border border-border bg-white px-1.5 py-0.5 font-mono text-xs tabular-nums text-zinc-700"
                      >
                        {id}
                      </span>
                    ))}
                    {bulkNew.length > 12 && (
                      <span className="rounded border border-border bg-white px-1.5 py-0.5 text-xs text-zinc-700">
                        +{bulkNew.length - 12} lagi
                      </span>
                    )}
                  </div>
                  {bulkSkipped > 0 && (
                    <p className="mt-2 text-xs font-medium text-amber-600">
                      {bulkSkipped} nomor sudah dipakai &amp; dilewati otomatis.
                    </p>
                  )}
                  {bulkNew.length === 0 && (
                    <p className="mt-2 text-xs font-medium text-red-600">
                      Semua nomor pada rentang ini sudah dipakai. Ubah prefix atau rentang angka.
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-[12.5px] text-zinc-700">
                  Isi prefix &amp; rentang angka (mis. prefix "A-", dari 101 sampai 110) untuk membuat banyak pintu sekaligus.
                </p>
              )}
            </section>
          )}
        </div>

        <DialogFooter className="border-t border-border bg-zinc-50 px-5 py-4">
          <div className="flex w-full items-center justify-end gap-2 sm:justify-end">
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
              disabled={mode === "satu" ? !singleValid : !bulkValid}
              onClick={submit}
              className="h-9 bg-zinc-900 px-3.5 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800 disabled:opacity-50"
            >
              <Plus className="size-3.5" strokeWidth={2} />
              {mode === "satu" ? "Tambah Kamar" : `Tambah ${bulkNew.length} Kamar`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
