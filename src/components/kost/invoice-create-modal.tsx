"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Modal "Buat Tagihan Baru" (Generate Invoice)
// Fleksibilitas siklus sewa: Bulanan (default) · Per 3 Bulan · Per 6 Bulan ·
// Tahunan. Total invoice = harga sewa × jumlah bulan; periode & jatuh tempo
// berikutnya otomatis menyesuaikan kelipatan bulan yang dipilih.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { CalendarPlus, FileText, KeyRound, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addMonths, formatIDR, MONTH_NAMES, type Room } from "@/lib/kost-data";
import { cycleMonths, type BillingCycle } from "@/lib/property-types";
import { useUnitLabels } from "@/lib/property-store";
import { CyclePicker } from "./cycle-picker";

export interface InvoiceCreateDraft {
  roomId: string;
  /** Periode mulai — "2025-10" (yyyy-mm) */
  startKey: string;
  cycle: BillingCycle;
}

interface InvoiceCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Kamar berpenghuni yang bisa ditagih (status ≠ kosong) */
  billableRooms: Room[];
  onSubmit: (draft: InvoiceCreateDraft) => void;
}

/** Opsi periode mulai — 6 bulan ke depan dari Okt 2025 (snapshot demo: Sep 2025) */
const START_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const d = new Date(2025, 9 + i, 1); // Okt 2025 = index 9
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { key, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` };
});

function monthDate(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

const inputCls =
  "h-9 border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-zinc-900/5";

function SectionLabel({ icon: Icon, children }: { icon: typeof KeyRound; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-1.5">
      <Icon className="size-3.5 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{children}</h3>
    </div>
  );
}

export function InvoiceCreateModal({ open, onOpenChange, billableRooms, onSubmit }: InvoiceCreateModalProps) {
  const unit = useUnitLabels();
  const [roomId, setRoomId] = useState(billableRooms[0]?.id ?? "");
  const [startKey, setStartKey] = useState(START_OPTIONS[0].key);
  const [cycle, setCycle] = useState<BillingCycle>("Bulanan");

  const room = billableRooms.find((r) => r.id === roomId) ?? null;
  const months = cycleMonths(cycle);

  const start = monthDate(startKey);
  const periodEnd = addMonths(start, months);
  periodEnd.setDate(0); // hari terakhir bulan sebelumnya = akhir periode
  const periodLabel = `1 ${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()} – ${periodEnd.getDate()} ${MONTH_NAMES[periodEnd.getMonth()]} ${periodEnd.getFullYear()}`;

  // Jatuh tempo = tanggal 28 bulan pertama periode (aturan bayar paling lambat tgl 28)
  const dueDate = new Date(start.getFullYear(), start.getMonth(), 28);
  const nextDue = addMonths(dueDate, months);
  const dateLabel = (d: Date) => `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;

  const total = (room?.price ?? 0) * months;

  const valid = !!room && room.price > 0;

  const submit = () => {
    if (!valid || !room) return;
    onSubmit({ roomId, startKey, cycle });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-auto flex max-h-[88dvh] w-[calc(100%-2rem)] max-w-[560px] flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-900">
            <CalendarPlus className="size-4 text-zinc-600" strokeWidth={1.75} aria-hidden="true" />
            Buat Tagihan Baru
          </DialogTitle>
          <DialogDescription className="text-[12px] text-zinc-500">
            Terbitkan invoice sewa dengan periode fleksibel — bulanan hingga tahunan.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-zinc-50 p-5 scrollbar-thin">
          {/* ── Section 1: Unit & Penghuni ─────────────────────────────────── */}
          <section className="rounded-lg border border-border bg-white p-4">
            <SectionLabel icon={KeyRound}>Unit &amp; Penghuni</SectionLabel>
            <div className="space-y-1.5">
              <Label htmlFor="inv-unit" className="text-[12px] text-zinc-600">
                {unit.noun} yang Ditagih
              </Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger
                  id="inv-unit"
                  className="h-9 w-full border-zinc-200 text-[13px] focus:ring-zinc-900/5"
                  aria-label={`Pilih ${unit.noun} yang ditagih`}
                >
                  <SelectValue placeholder={`Pilih ${unit.noun}…`} />
                </SelectTrigger>
                <SelectContent>
                  {billableRooms.length === 0 && (
                    <div className="px-3 py-2.5 text-[12.5px] text-zinc-400">
                      Belum ada {unit.short.toLowerCase()} berpenghuni.
                    </div>
                  )}
                  {billableRooms.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="text-[13px]">
                      {unit.label(r.id)} — {r.tenant?.name ?? "Tanpa nama"} · {formatIDR(r.price)}/bln
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {room && (
                <p className="text-[11.5px] text-zinc-400">
                  Tarif dasar {formatIDR(room.price)}/bulan · kontrak{" "}
                  {room.contract?.duration ?? "Bulanan"}
                </p>
              )}
            </div>
          </section>

          {/* ── Section 2: Periode & Siklus ────────────────────────────────── */}
          <section className="rounded-lg border border-border bg-white p-4">
            <SectionLabel icon={FileText}>Periode &amp; Siklus Pembayaran</SectionLabel>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-start" className="text-[12px] text-zinc-600">
                  Periode Mulai
                </Label>
                <Select value={startKey} onValueChange={setStartKey}>
                  <SelectTrigger
                    id="inv-start"
                    className="h-9 w-full border-zinc-200 text-[13px] focus:ring-zinc-900/5"
                    aria-label="Pilih periode mulai tagihan"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {START_OPTIONS.map((o) => (
                      <SelectItem key={o.key} value={o.key} className="text-[13px]">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-zinc-600">Durasi Siklus</Label>
                <CyclePicker value={cycle} onChange={setCycle} idPrefix="inv" />
              </div>
            </div>
          </section>

          {/* ── Section 3: Ringkasan otomatis ──────────────────────────────── */}
          <section className="rounded-lg border border-border bg-white p-4">
            <SectionLabel icon={Wallet}>Ringkasan Invoice</SectionLabel>
            <dl className="space-y-2 text-[12.5px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Periode sewa</dt>
                <dd className="text-right font-medium tabular-nums text-zinc-800">{periodLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Jatuh tempo</dt>
                <dd className="text-right font-medium tabular-nums text-zinc-800">{dateLabel(dueDate)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Jatuh tempo berikutnya</dt>
                <dd className="text-right font-medium tabular-nums text-zinc-800">{dateLabel(nextDue)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">
                  Kalkulasi{room ? ` · ${formatIDR(room.price)} × ${months} bulan` : ""}
                </dt>
                <dd className="text-right text-zinc-400">×{months}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-2.5">
                <dt className="font-semibold text-zinc-700">Total Tagihan</dt>
                <dd className="text-[15px] font-bold tabular-nums text-zinc-900">{formatIDR(total)}</dd>
              </div>
            </dl>
          </section>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border bg-white px-5 py-3.5 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 border-zinc-200 bg-white text-[13px] text-zinc-700 shadow-none hover:bg-zinc-50"
          >
            Batal
          </Button>
          <Button
            onClick={submit}
            disabled={!valid}
            className="h-9 bg-zinc-900 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800 disabled:opacity-50"
          >
            <CalendarPlus className="size-4" strokeWidth={1.75} />
            Terbitkan Tagihan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
