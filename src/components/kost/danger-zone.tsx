"use client";

import { useState } from "react";
import { Building2, TriangleAlert, Trash2, RotateCcw } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface DangerCounts {
  rooms: number;
  tenants: number;
  invoices: number;
  cash: number;
  tickets: number;
}

interface DangerZoneProps {
  counts: DangerCounts;
  onClearDemo: () => void;
  onFactoryReset: () => void;
}

type ResetMode = "demo" | "factory";

const CONFIRM_WORDS = ["RESET", "HAPUS DATA"];

/** Double-confirmation modal — red-bordered, type-to-confirm (RESET / HAPUS DATA) */
function ResetConfirmModal({
  mode,
  counts,
  open,
  onOpenChange,
  onConfirm,
}: {
  mode: ResetMode | null;
  counts: DangerCounts;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (mode: ResetMode) => void;
}) {
  const [text, setText] = useState("");
  const normalized = text.trim().toUpperCase();
  const matched = CONFIRM_WORDS.includes(normalized);
  const isFactory = mode === "factory";

  const close = (o: boolean) => {
    if (!o) setText("");
    onOpenChange(o);
  };

  return (
    <Dialog
      open={open && mode !== null}
      onOpenChange={close}
    >
      <DialogContent
        className="gap-0 border-red-200 p-0 ring-1 ring-red-100 sm:max-w-[460px]"
        aria-describedby={undefined}
      >
        {/* Red warning band */}
        <div className="flex items-start gap-2.5 border-b border-red-100 bg-red-50 px-5 py-3.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-500" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-[12.5px] leading-5 font-semibold text-red-700">
            Tindakan ini tidak dapat dibatalkan. Seluruh data sewa dan transaksi akan dihapus permanen dari UnitKu.
          </p>
        </div>

        <DialogHeader className="px-5 pt-4">
          <DialogTitle className="text-[15px] font-bold tracking-tight text-zinc-900">
            {isFactory ? "Reset ke Pengaturan Awal (Factory Reset)" : "Hapus Semua Data Dummy / Transaksi Demo"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Konfirmasi penghapusan data UnitKu dengan mengetik RESET atau HAPUS DATA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 py-3">
          <div className="rounded-md border border-border bg-zinc-50 px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-red-500">
              Yang akan dihapus
            </p>
            <ul className="mt-1.5 space-y-1 text-[12.5px] leading-5 text-zinc-700">
              <li className="flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-zinc-400" aria-hidden="true" />
                <span className="tabular-nums">{counts.cash} transaksi kas</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-zinc-400" aria-hidden="true" />
                <span className="tabular-nums">{counts.invoices} riwayat invoice</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-zinc-400" aria-hidden="true" />
                <span className="tabular-nums">{counts.tenants} data penyewa</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-zinc-400" aria-hidden="true" />
                <span className="tabular-nums">{counts.tickets} tiket komplain</span>
              </li>
              {isFactory && (
                <li className="flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-zinc-400" aria-hidden="true" />
                  <span className="tabular-nums font-medium">{counts.rooms} struktur kamar</span>
                </li>
              )}
            </ul>
            {!isFactory && (
              <>
                <p className="mt-2.5 text-xs font-bold uppercase tracking-wider text-emerald-600">
                  Yang dipertahankan
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[12.5px] leading-5 text-zinc-700">
                  <Building2 className="size-3.5 shrink-0 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
                  Struktur {counts.rooms} kamar &amp; profil properti
                </p>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="dz-confirm" className="text-[12.5px] font-medium text-zinc-700">
              Ketik <span className="rounded border border-red-200 bg-red-50 px-1 font-mono text-xs text-red-700">RESET</span>{" "}
              atau <span className="rounded border border-red-200 bg-red-50 px-1 font-mono text-xs text-red-700">HAPUS DATA</span>{" "}
              untuk mengonfirmasi
            </label>
            <Input
              id="dz-confirm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='Ketik "RESET" atau "HAPUS DATA"'
              autoComplete="off"
              className={cn(
                "h-9 border-zinc-200 bg-white font-mono text-[13px] tracking-wide text-zinc-900 placeholder:font-sans placeholder:tracking-normal placeholder:text-zinc-600 focus-visible:ring-red-900/10",
                text.length > 0 && !matched && "border-red-300"
              )}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border bg-zinc-50 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            className="h-9 border-zinc-200 bg-white px-3.5 text-[13px] font-medium text-zinc-700 shadow-none hover:bg-zinc-100"
            onClick={() => close(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            disabled={!matched}
            onClick={() => {
              if (!mode) return;
              onConfirm(mode);
              close(false);
            }}
            className="h-9 bg-red-600 px-3.5 text-[13px] font-semibold text-white shadow-none hover:bg-red-700 disabled:opacity-50"
          >
            {isFactory ? "Reset Permanen" : "Hapus Data Demo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Tab "Zona Berbahaya" — two destructive actions with double confirmation */
export function DangerZone({ counts, onClearDemo, onFactoryReset }: DangerZoneProps) {
  const [confirmMode, setConfirmMode] = useState<ResetMode | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const open = (mode: ResetMode) => {
    setConfirmMode(mode);
    setConfirmOpen(true);
  };

  return (
    <div className="max-w-[720px] space-y-4">
      <section className="overflow-hidden rounded-lg border border-red-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-red-100 px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <Trash2 className="mt-0.5 size-4 shrink-0 text-red-500" strokeWidth={1.75} aria-hidden="true" />
            <div>
              <h3 className="text-[13px] font-bold text-zinc-900">Hapus Semua Data Dummy / Transaksi Demo</h3>
              <p className="mt-0.5 max-w-[440px] text-[12.5px] leading-5 text-zinc-700">
                Mengosongkan data transaksi kas, riwayat invoice, log kas, data penyewa tiruan, dan tiket
                komplain. Struktur kamar &amp; profil kost tetap dipertahankan.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="h-8 shrink-0 border-red-200 bg-white px-3 text-[12.5px] font-semibold text-red-600 shadow-none hover:bg-red-50 hover:text-red-700"
            onClick={() => open("demo")}
          >
            Hapus Data Dummy
          </Button>
        </div>
        <p className="px-4 py-2.5 text-xs tabular-nums text-zinc-700">
          Saat ini: {counts.invoices} invoice · {counts.cash} transaksi kas · {counts.tenants} penyewa ·{" "}
          {counts.tickets} tiket
        </p>
      </section>

      <section className="overflow-hidden rounded-lg border border-red-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-red-100 px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <RotateCcw className="mt-0.5 size-4 shrink-0 text-red-500" strokeWidth={1.75} aria-hidden="true" />
            <div>
              <h3 className="text-[13px] font-bold text-zinc-900">Reset ke Pengaturan Awal (Factory Reset)</h3>
              <p className="mt-0.5 max-w-[440px] text-[12.5px] leading-5 text-zinc-700">
                Menghapus seluruh data kamar, penyewa, transaksi, dan invoice — kembali ke dashboard kosong
                bersih seperti baru mendaftar.
              </p>
            </div>
          </div>
          <Button
            className="h-8 shrink-0 bg-red-600 px-3 text-[12.5px] font-semibold text-white shadow-none hover:bg-red-700"
            onClick={() => open("factory")}
          >
            Factory Reset
          </Button>
        </div>
        <p className="px-4 py-2.5 text-xs tabular-nums text-zinc-700">
          Menghapus permanen {counts.rooms} kamar beserta seluruh isinya.
        </p>
      </section>

      <ResetConfirmModal
        mode={confirmMode}
        counts={counts}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={(m) => (m === "factory" ? onFactoryReset() : onClearDemo())}
      />
    </div>
  );
}
