"use client";

import { useState } from "react";
import { CalendarClock, Check, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  addMonths,
  dateToLabel,
  formatDateLabel,
  formatIDR,
  parseDateLabel,
  roomNomor,
  type Room,
} from "@/lib/kost-data";
import { contractEndOf } from "@/lib/room-status";
import { cn } from "@/lib/utils";
import { nextEndDate, renewBaseDate } from "./tenant-detail-drawer";

interface RenewDialogProps {
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** durationLabel: "+6 bulan" / "+15 hari" (durasi kustom) / "hingga {tgl}"
   *  (tanggal akhir dipilih manual ≤ tanggal dasar) — untuk teks toast. */
  onSubmit: (room: Room, newEndDate: string, durationLabel: string) => void;
}

// Pilihan durasi lengkap — +1 & +2 bulan ditambahkan atas masukan pengguna
const DURATIONS = [1, 2, 3, 6, 12];

type DurUnit = "bulan" | "hari";

const inputCls =
  "h-9 border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-600 focus-visible:ring-zinc-900/5";

export function RenewDialog({ room, open, onOpenChange, onSubmit }: RenewDialogProps) {
  /** Preset terpilih (1/2/3/6/12) atau "custom" (atur bebas) */
  const [sel, setSel] = useState<number | "custom">(6);
  const [customVal, setCustomVal] = useState("1");
  const [customUnit, setCustomUnit] = useState<DurUnit>("bulan");
  const [customEnd, setCustomEnd] = useState(() => (room ? nextEndDate(room, 6) : ""));
  /** Tanggal dimodifikasi manual via datepicker → durasi dihitung MUNDUR dari
   *  tanggal agar toast & ringkasan selalu akurat di semua mode. */
  const [manualDate, setManualDate] = useState(false);

  if (!room) return null;

  const base = renewBaseDate(room);

  /** Durasi → tanggal akhir (kalkulasi maju, realtime). */
  const applyDuration = (n: number, unit: DurUnit) => {
    setManualDate(false);
    setCustomEnd(unit === "bulan" ? nextEndDate(room, n) : dateToLabel(addDays(base, n)));
  };

  const pick = (m: number) => {
    setSel(m);
    applyDuration(m, "bulan");
  };

  const pickCustom = () => {
    if (sel === "custom") return;
    setSel("custom");
    setCustomVal("1");
    setCustomUnit("bulan");
    applyDuration(1, "bulan");
  };

  const setDurationInput = (raw: string) => {
    setCustomVal(raw);
    const n = parseDur(raw);
    if (n !== null) applyDuration(n, customUnit);
  };

  const setUnit = (unit: DurUnit) => {
    setCustomUnit(unit);
    const n = parseDur(customVal);
    if (n !== null) applyDuration(n, unit);
  };

  /** Dua arah: tanggal akhir diedit manual di datepicker → durasi (custom mode)
   *  ikut dihitung mundur; ringkasan & toast selalu dari tanggal terpilih. */
  const setDate = (label: string) => {
    setCustomEnd(label);
    setManualDate(true);
    if (sel === "custom") {
      const back = durationFromEnd(base, label);
      if (back) {
        setCustomVal(String(back.n));
        setCustomUnit(back.unit);
      }
    }
  };

  /** Kuantifier durasi utk ringkasan & toast: "+6 bulan" / "+15 hari" /
   *  null (tanggal manual bukan perpanjangan valid — tampilkan "hingga {tgl}"). */
  const durationQuant = (): string | null => {
    if (manualDate) {
      const back = durationFromEnd(base, customEnd);
      return back ? quantOf(back) : null;
    }
    if (sel === "custom") {
      const n = parseDur(customVal);
      return n !== null ? `+${n} ${customUnit}` : null;
    }
    return `+${sel} bulan`;
  };

  const submit = () => {
    const end = customEnd || nextEndDate(room, 6);
    const quant = durationQuant();
    onSubmit(room, end, quant ?? `hingga ${end}`);
    onOpenChange(false);
  };

  const quant = durationQuant();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 bg-white p-0 sm:max-w-[420px]">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-900">
            <CalendarClock className="size-4 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
            Perpanjang Sewa
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-zinc-700">
            {room.tenant?.name} · Kamar {roomNomor(room)} ·{" "}
            {/* Tanggal habis KANONIK (endDate eksplisit ATAU fallback masuk +
                1 siklus sewa) — sejajar dgn Denah & direktori penghuni */}
            {(() => {
              const end = contractEndOf(room);
              return end.date ? (
                <>
                  kontrak berakhir <span className="tabular-nums">{end.label}</span>
                </>
              ) : (
                "kontrak rolling bulanan"
              );
            })()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 bg-zinc-50 p-5">
          <div className="space-y-2">
            <Label className="text-[12.5px] text-zinc-600">Durasi Perpanjangan</Label>
            {/* 6 opsi: 5 preset + atur bebas — 3 kolom di mobile, 6 di sm+ */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-label="Durasi perpanjangan">
              {DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={sel === m}
                  onClick={() => pick(m)}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-0.5 rounded-md border text-center transition-colors",
                    sel === m
                      ? "border-zinc-900 bg-white ring-1 ring-zinc-900"
                      : "border-border bg-white hover:border-zinc-300"
                  )}
                >
                  <span className="text-[15px] font-bold tabular-nums text-zinc-900">+{m}</span>
                  <span className="text-xs text-zinc-700">bulan</span>
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={sel === "custom"}
                title="Atur bebas — durasi kustom"
                onClick={pickCustom}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-0.5 rounded-md border text-center transition-colors",
                  sel === "custom"
                    ? "border-zinc-900 bg-white ring-1 ring-zinc-900"
                    : "border-border bg-white hover:border-zinc-300"
                )}
              >
                <SlidersHorizontal className="size-4 text-zinc-900" strokeWidth={2} aria-hidden="true" />
                <span className="text-xs text-zinc-700">Bebas</span>
              </button>
            </div>
          </div>

          {/* Form durasi kustom — muncul hanya saat "Bebas" aktif; isi durasi
              → tanggal berakhir terisi otomatis (realtime dua arah). */}
          {sel === "custom" && (
            <div className="rounded-md border border-zinc-200 bg-white p-3">
              <div className="grid grid-cols-[1fr_7.5rem] gap-2.5">
                <div className="space-y-1.5">
                  <Label htmlFor="rn-cdur" className="text-[12px] text-zinc-600">Durasi</Label>
                  <Input
                    id="rn-cdur"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    placeholder="misal: 4"
                    value={customVal}
                    onChange={(e) => setDurationInput(e.target.value)}
                    className={cn(inputCls, "tabular-nums")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rn-cunit" className="text-[12px] text-zinc-600">Satuan</Label>
                  <Select value={customUnit} onValueChange={(v) => setUnit(v as DurUnit)}>
                    <SelectTrigger id="rn-cunit" className={cn(inputCls, "w-full")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bulan">Bulan</SelectItem>
                      <SelectItem value="hari">Hari</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="mt-2 text-[11.5px] leading-4 text-zinc-500">
                Isi durasi bebas (misal 4 bulan, 15 hari) — kolom &quot;Kontrak Baru Berakhir&quot; terisi
                otomatis, atau pilih tanggalnya langsung di datepicker.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rn-end" className="text-[12.5px] text-zinc-600">Kontrak Baru Berakhir</Label>
              <Input
                id="rn-end"
                type="date"
                value={toISO(customEnd)}
                onChange={(e) => setDate(fromISO(e.target.value))}
                className={cn(inputCls, "tabular-nums")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-zinc-600">Tarif Saat Ini</Label>
              <div className="flex h-9 items-center rounded-md border border-border bg-zinc-50 px-2.5 text-[13px] font-semibold tabular-nums text-zinc-800">
                {formatIDR(room.price)} <span className="ml-1 font-normal text-zinc-700">/ bln</span>
              </div>
            </div>
          </div>

          {/* Ringkasan realtime — ikut berubah saat durasi kustom / tanggal manual berubah */}
          <div className="rounded-md border border-border bg-white px-3 py-2.5">
            <p className="text-[12.5px] leading-5 text-zinc-700">
              Setelah disimpan, masa kontrak <span className="font-medium text-zinc-700">{room.tenant?.name}</span>{" "}
              diperpanjang{quant ? ` ${quant}` : ""} hingga{" "}
              <span className="font-semibold tabular-nums text-zinc-900">{customEnd || "—"}</span>. Pengingat
              perpanjangan otomatis dikirim H-14 via WhatsApp.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border bg-white px-5 py-3.5 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 border-zinc-200 bg-white text-[13px] text-zinc-700 shadow-none hover:bg-zinc-50"
          >
            Batal
          </Button>
          <Button
            onClick={submit}
            className="h-9 bg-zinc-900 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800"
          >
            <Check className="size-4" strokeWidth={2} />
            Simpan Perpanjangan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* "1 Okt 2026" ⇄ "2026-10-01" */
function toISO(label: string): string {
  const d = parseDateLabel(label);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function fromISO(iso: string): string {
  return iso ? formatDateLabel(iso) : "";
}

/** Parse input durasi — valid bila bilangan bulat ≥ 1 */
function parseDur(raw: string): number | null {
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/** n hari kalender dari tanggal dasar (local midnight — deterministik) */
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function quantOf(q: { n: number; unit: DurUnit }): string {
  return `+${q.n} ${q.unit}`;
}

/** Dua arah (tanggal → durasi): kembalikan bulan utuh bila tanggal akhir
 *  persis hasil addMonths(base, k), selain itu jumlah hari kalender.
 *  null bila tanggal ≤ dasar (bukan perpanjangan) atau tak valid. */
function durationFromEnd(base: Date, endLabel: string): { n: number; unit: DurUnit } | null {
  if (!endLabel.trim()) return null;
  const end = parseDateLabel(endLabel);
  if (Number.isNaN(end.getTime())) return null;
  const days = Math.round((end.getTime() - base.getTime()) / 86_400_000);
  if (days <= 0) return null;
  // Kandidat bulan: selisih kalender ±1 (jaga kasus clamp ujung bulan,
  // mis. 31 Jan + 1 bulan → 28 Feb)
  const k0 = (end.getFullYear() - base.getFullYear()) * 12 + (end.getMonth() - base.getMonth());
  for (const k of [k0, k0 - 1, k0 + 1]) {
    if (k < 1) continue;
    const c = addMonths(base, k);
    if (
      c.getFullYear() === end.getFullYear() &&
      c.getMonth() === end.getMonth() &&
      c.getDate() === end.getDate()
    ) {
      return { n: k, unit: "bulan" };
    }
  }
  return { n: days, unit: "hari" };
}
