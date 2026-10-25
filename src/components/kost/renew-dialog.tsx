"use client";

import { useState } from "react";
import { CalendarClock, Check } from "lucide-react";
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
import { formatDateLabel, formatIDR, parseDateLabel, roomNomor, type Room } from "@/lib/kost-data";
import { cn } from "@/lib/utils";
import { nextEndDate } from "./tenant-detail-drawer";

interface RenewDialogProps {
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (room: Room, newEndDate: string, months: number) => void;
}

// Pilihan durasi lengkap — +1 & +2 bulan ditambahkan atas masukan pengguna
const DURATIONS = [1, 2, 3, 6, 12];

const inputCls =
  "h-9 border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-600 focus-visible:ring-zinc-900/5";

export function RenewDialog({ room, open, onOpenChange, onSubmit }: RenewDialogProps) {
  const [months, setMonths] = useState(6);
  const [customEnd, setCustomEnd] = useState(() => (room ? nextEndDate(room, 6) : ""));

  if (!room) return null;

  const pick = (m: number) => {
    setMonths(m);
    setCustomEnd(nextEndDate(room, m));
  };

  const submit = () => {
    onSubmit(room, customEnd || nextEndDate(room, months), months);
    onOpenChange(false);
  };

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
            {room.contract?.endDate ? (
              <>
                kontrak berakhir <span className="tabular-nums">{room.contract.endDate}</span>
              </>
            ) : (
              "kontrak rolling bulanan"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 bg-zinc-50 p-5">
          <div className="space-y-2">
            <Label className="text-[12.5px] text-zinc-600">Durasi Perpanjangan</Label>
            <div className="grid grid-cols-5 gap-2" role="group" aria-label="Durasi perpanjangan">
              {DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={months === m}
                  onClick={() => pick(m)}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-0.5 rounded-md border text-center transition-colors",
                    months === m
                      ? "border-zinc-900 bg-white ring-1 ring-zinc-900"
                      : "border-border bg-white hover:border-zinc-300"
                  )}
                >
                  <span className="text-[15px] font-bold tabular-nums text-zinc-900">+{m}</span>
                  <span className="text-xs text-zinc-700">bulan</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rn-end" className="text-[12.5px] text-zinc-600">Kontrak Baru Berakhir</Label>
              <Input
                id="rn-end"
                type="date"
                value={toISO(customEnd)}
                onChange={(e) => setCustomEnd(fromISO(e.target.value))}
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

          <div className="rounded-md border border-border bg-white px-3 py-2.5">
            <p className="text-[12.5px] leading-5 text-zinc-700">
              Setelah disimpan, masa kontrak <span className="font-medium text-zinc-700">{room.tenant?.name}</span>{" "}
              diperpanjang hingga{" "}
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
