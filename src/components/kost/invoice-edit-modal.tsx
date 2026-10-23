"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Zap } from "lucide-react";
import { toast } from "@/lib/toast";
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
import { formatIDR } from "@/lib/kost-data";
import type { Invoice, InvoiceLine } from "@/lib/kost-invoices";

interface InvoiceEditModalProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Full lines (incl. Sewa Kamar) — dipanggil tombol "Simpan & Siap Ditagih" */
  onSave: (inv: Invoice, lines: InvoiceLine[]) => void;
  saving?: boolean;
}

const numeric = (v: string): number => {
  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Body di-key per invoice id — state form reset setiap kali modal dibuka */
function EditBody({
  invoice,
  onClose,
  onSave,
  saving,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSave: (inv: Invoice, lines: InvoiceLine[]) => void;
  saving?: boolean;
}) {
  const sewa = useMemo<InvoiceLine>(
    () => invoice.lines.find((l) => l.label === "Sewa Kamar") ?? { label: "Sewa Kamar", amount: invoice.total },
    [invoice],
  );
  // Rincian add-on awal (Listrik, Parkir, dll.) — salinan kerja yang dapat diedit
  const [addons, setAddons] = useState<InvoiceLine[]>(() =>
    invoice.lines.filter((l) => l.label !== "Sewa Kamar").map((l) => ({ ...l })),
  );

  // Kalkulator listrik: meteran awal → akhir × tarif/kWh
  const [meterStart, setMeterStart] = useState("");
  const [meterEnd, setMeterEnd] = useState("");
  const [tarif, setTarif] = useState("");
  const kwh = Math.max(0, numeric(meterEnd) - numeric(meterStart));
  const listrikSubtotal = kwh * numeric(tarif);

  // Biaya lain-lain manual
  const [otherName, setOtherName] = useState("");
  const [otherAmount, setOtherAmount] = useState("");

  const applyListrik = () => {
    if (kwh <= 0 || numeric(tarif) <= 0) {
      toast.error("Lengkapi meteran awal, akhir, dan tarif per kWh terlebih dahulu.");
      return;
    }
    setAddons((prev) => [
      ...prev.filter((l) => !l.label.startsWith("Listrik")),
      { label: "Listrik", amount: listrikSubtotal },
    ]);
    setMeterStart("");
    setMeterEnd("");
    setTarif("");
    toast.success(`Biaya listrik ditambahkan — ${kwh.toLocaleString("id-ID")} kWh`, {
      description: `Subtotal ${formatIDR(listrikSubtotal)} — tekan "Simpan & Siap Ditagih" untuk menerapkan.`,
    });
  };

  const addOther = () => {
    const name = otherName.trim();
    const amount = numeric(otherAmount);
    if (!name || amount <= 0) {
      toast.error("Isi nama biaya dan nominalnya terlebih dahulu.");
      return;
    }
    setAddons((prev) => [...prev, { label: name, amount }]);
    setOtherName("");
    setOtherAmount("");
    toast.success(`Biaya "${name}" ditambahkan`, {
      description: `${formatIDR(amount)} — tekan "Simpan & Siap Ditagih" untuk menerapkan.`,
    });
  };

  const removeAddon = (label: string) =>
    setAddons((prev) => prev.filter((l) => l.label !== label));

  const total = sewa.amount + addons.reduce((a, l) => a + l.amount, 0);

  const handleSave = () => {
    onSave(invoice, [sewa, ...addons]);
  };

  return (
    <>
      <DialogHeader className="border-b border-border p-4">
        <DialogTitle className="text-[15px] font-bold tracking-tight text-zinc-900">
          Edit / Tambah Biaya — Kamar {invoice.roomNomor ?? invoice.roomId}
        </DialogTitle>
        <DialogDescription className="text-[12.5px] text-zinc-700">
          {invoice.id} · Periode {invoice.periodLabel} — atur rincian sebelum tagihan dikirim
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4 scrollbar-thin">
        {/* Sewa pokok — terkunci sesuai harga kamar */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-zinc-50 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-zinc-900">{sewa.label}</p>
            <p className="text-xs text-zinc-700">Biaya sewa pokok — sesuai harga kamar</p>
          </div>
          <span className="shrink-0 text-[13px] font-bold tabular-nums text-zinc-900">
            {formatIDR(sewa.amount)}
          </span>
        </div>

        {/* Kalkulator biaya listrik */}
        <section className="rounded-lg border border-border bg-white p-3" aria-label="Biaya listrik">
          <div className="mb-2.5 flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded bg-amber-100 text-amber-700">
              <Zap className="size-3" strokeWidth={2} aria-hidden="true" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-700">Biaya Listrik</p>
            <span className="text-xs tabular-nums text-zinc-700">· meteran × tarif</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-700">Meteran Awal</span>
              <Input
                inputMode="numeric"
                value={meterStart}
                onChange={(e) => setMeterStart(e.target.value)}
                placeholder="0"
                className="h-9 bg-white text-[13px] tabular-nums"
                aria-label="Meteran awal (kWh)"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-700">Meteran Akhir</span>
              <Input
                inputMode="numeric"
                value={meterEnd}
                onChange={(e) => setMeterEnd(e.target.value)}
                placeholder="0"
                className="h-9 bg-white text-[13px] tabular-nums"
                aria-label="Meteran akhir (kWh)"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-700">Tarif / kWh</span>
              <Input
                inputMode="numeric"
                value={tarif}
                onChange={(e) => setTarif(e.target.value)}
                placeholder="1500"
                className="h-9 bg-white text-[13px] tabular-nums"
                aria-label="Tarif per kWh (rupiah)"
              />
            </label>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <p className="text-[12.5px] tabular-nums text-zinc-700">
              Pemakaian <span className="font-semibold text-zinc-900">{kwh.toLocaleString("id-ID")} kWh</span>
              {" · "}Subtotal{" "}
              <span className="font-bold tabular-nums text-zinc-900">{formatIDR(listrikSubtotal)}</span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyListrik}
              className="h-8 border-amber-200 bg-amber-50 px-2.5 text-[12.5px] font-medium text-amber-800 shadow-none hover:bg-amber-100"
            >
              <Plus className="size-3.5" strokeWidth={2} />
              Terapkan
            </Button>
          </div>
        </section>

        {/* Biaya lain-lain manual */}
        <section className="rounded-lg border border-border bg-white p-3" aria-label="Biaya lain-lain">
          <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">Biaya Lain-lain</p>
          <div className="flex gap-2">
            <Input
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
              placeholder="Nama biaya — mis. Parkir / Laundry"
              className="h-9 flex-1 bg-white text-[13px]"
              aria-label="Nama biaya tambahan"
            />
            <Input
              inputMode="numeric"
              value={otherAmount}
              onChange={(e) => setOtherAmount(e.target.value)}
              placeholder="Nominal (Rp)"
              className="h-9 w-32 bg-white text-[13px] tabular-nums sm:w-40"
              aria-label="Nominal biaya tambahan (rupiah)"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={addOther}
              className="size-9 shrink-0 border-zinc-200 bg-white text-zinc-700 shadow-none hover:bg-zinc-50"
              aria-label="Tambah biaya lain-lain"
            >
              <Plus className="size-4" strokeWidth={2} />
            </Button>
          </div>
        </section>

        {/* Daftar rincian tagihan */}
        <section aria-label="Rincian tagihan" className="rounded-lg border border-border bg-white p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-700">
            Rincian Tagihan ({addons.length + 1} baris)
          </p>
          <ul role="list" className="space-y-1.5">
            <li className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-2.5 py-2">
              <span className="text-[13px] font-medium text-zinc-800">{sewa.label}</span>
              <span className="text-[13px] font-semibold tabular-nums text-zinc-900">
                {formatIDR(sewa.amount)}
              </span>
            </li>
            {addons.map((l) => (
              <li
                key={l.label}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-2.5 py-2"
              >
                <span className="min-w-0 truncate text-[13px] font-medium text-zinc-800">{l.label}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[13px] font-semibold tabular-nums text-zinc-900">
                    {formatIDR(l.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAddon(l.label)}
                    className="rounded p-1 text-zinc-700 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Hapus biaya ${l.label}`}
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                  </button>
                </span>
              </li>
            ))}
            {addons.length === 0 && (
              <li className="rounded-md border border-dashed border-zinc-200 px-2.5 py-3 text-center text-xs text-zinc-700">
                Belum ada biaya tambahan — gunakan kalkulator listrik atau biaya lain-lain di atas.
              </li>
            )}
          </ul>
        </section>
      </div>

      <DialogFooter className="border-t border-border p-4 sm:justify-between">
        <div className="text-left">
          <p className="text-xs text-zinc-700">Total Tagihan</p>
          <p className="text-[15px] font-bold tabular-nums text-zinc-900">{formatIDR(total)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-9 border-zinc-200 bg-white text-[13px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
          >
            Batal
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "h-9 bg-zinc-900 px-4 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800",
              saving && "opacity-70",
            )}
          >
            {saving ? "Menyimpan…" : "Simpan & Siap Ditagih"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

export function InvoiceEditModal({ invoice, open, onOpenChange, onSave, saving }: InvoiceEditModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px] gap-0 p-0" aria-describedby={undefined}>
        {invoice && (
          <EditBody
            key={invoice.id}
            invoice={invoice}
            onClose={() => onOpenChange(false)}
            onSave={onSave}
            saving={saving}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
