"use client";

import { useState } from "react";
import { AlertTriangle, LogOut } from "lucide-react";
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
import { formatIDR, type Room } from "@/lib/kost-data";
import { RupiahInput } from "./rupiah-input";

export interface CheckoutPayload {
  refund: number;
  tanggal: string; // ISO
  alasan: string;
}

interface CheckoutDialogProps {
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (room: Room, payload: CheckoutPayload) => void;
}

const REASONS = ["Kontrak selesai", "Pindah kost", "Keluar kota", "Lainnya"];

const inputCls =
  "h-9 border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-600 focus-visible:ring-zinc-900/5";

export function CheckoutDialog({ room, open, onOpenChange, onSubmit }: CheckoutDialogProps) {
  const [refund, setRefund] = useState(() => (room?.contract?.depositHeld ? room.contract.deposit : 0));
  const [tanggal, setTanggal] = useState("2025-09-30");
  const [alasan, setAlasan] = useState(REASONS[0]);

  if (!room) return null;

  const submit = () => {
    onSubmit(room, { refund, tanggal, alasan });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 bg-white p-0 sm:max-w-[440px]">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-900">
            <LogOut className="size-4 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
            Proses Check-out
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-zinc-700">
            {room.tenant?.name} · Kamar {room.id} · sewa sejak{" "}
            <span className="tabular-nums">{room.tenant?.moveInDate}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 bg-zinc-50 p-5">
          <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-[12.5px] leading-5 text-amber-800">
              Check-out akan mengosongkan kamar <span className="font-semibold">Kamar {room.id}</span>,
              mengarsipkan data penyewa, dan mencatat refund deposit ke Buku Kas UnitKu.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="co-tanggal" className="text-[12.5px] text-zinc-600">Tanggal Check-out</Label>
              <Input
                id="co-tanggal"
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-zinc-600">Alasan Keluar</Label>
              <Select value={alasan} onValueChange={setAlasan}>
                <SelectTrigger className="h-9 w-full border-zinc-200 text-[13px] focus:ring-zinc-900/5" aria-label="Alasan keluar">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r} className="text-[13px]">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="co-refund" className="text-[12.5px] text-zinc-600">
              Refund Deposit{" "}
              <span className="font-normal text-zinc-700">
                (deposit ditahan: {formatIDR(room.contract?.deposit ?? 0)})
              </span>
            </Label>
            <RupiahInput
              id="co-refund"
              ariaLabel="Nominal refund deposit"
              value={refund}
              onChange={setRefund}
            />
            <p className="text-xs text-zinc-700">
              Setel Rp0 bila deposit tidak dikembalikan (cth. dipakai menutupi tagihan tertunggak).
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
            <LogOut className="size-4" strokeWidth={2} />
            Check-out &amp; Catat Refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
