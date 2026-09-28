"use client";

import { useRef, useState } from "react";
import { ImagePlus, Plus, X } from "lucide-react";
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
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/kost-cashflow";
import { todayISO } from "@/lib/kost-data";
import { RupiahInput } from "./rupiah-input";

export interface ExpenseDraft {
  category: ExpenseCategory;
  amount: number;
  tanggal: string; // ISO
  description: string;
  attachment?: string;
}

interface ExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: ExpenseDraft) => void;
}

const inputCls =
  "h-9 border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-600 focus-visible:ring-zinc-900/5";

export function ExpenseModal({ open, onOpenChange, onSubmit }: ExpenseModalProps) {
  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [amount, setAmount] = useState(0);
  const [tanggal, setTanggal] = useState(todayISO);
  const [description, setDescription] = useState("");
  const [nota, setNota] = useState<{ name: string; size: string } | null>(null);
  const notaRef = useRef<HTMLInputElement>(null);

  const valid = !!category && amount > 0 && description.trim().length >= 3;

  const reset = () => {
    setCategory("");
    setAmount(0);
    setTanggal(todayISO());
    setDescription("");
    setNota(null);
  };

  const submit = () => {
    if (!valid) return;
    onSubmit({
      category,
      amount,
      tanggal,
      description: description.trim(),
      attachment: nota?.name,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 bg-white p-0 sm:max-w-[460px]">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-900">
            <Plus className="size-4 text-zinc-700" strokeWidth={2} aria-hidden="true" />
            Catat Pengeluaran
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-zinc-700">
            Pengeluaran langsung tercatat di Buku Kas bulan berjalan (Sep 2026).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 bg-zinc-50 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[12.5px] text-zinc-600">Kategori</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                <SelectTrigger className="h-9 w-full border-zinc-200 text-[13px] focus:ring-zinc-900/5" aria-label="Kategori pengeluaran">
                  <SelectValue placeholder="Pilih kategori…" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="text-[13px]">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-nominal" className="text-[12.5px] text-zinc-600">Nominal</Label>
              <RupiahInput id="ex-nominal" ariaLabel="Nominal pengeluaran" value={amount} onChange={setAmount} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-tanggal" className="text-[12.5px] text-zinc-600">Tanggal</Label>
              <Input
                id="ex-tanggal"
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ex-ket" className="text-[12.5px] text-zinc-600">Keterangan</Label>
              <Input
                id="ex-ket"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="cth. Token listrik meteran utama"
                className={inputCls}
              />
            </div>

            {/* Upload nota */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[12.5px] text-zinc-600">Upload Bukti Nota / Struk</Label>
              {nota ? (
                <div className="flex items-center gap-3 rounded-md border border-border bg-white p-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded border border-border bg-zinc-50 text-zinc-700">
                    <ImagePlus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-zinc-800">{nota.name}</p>
                    <p className="text-xs text-zinc-700">{nota.size} · siap dilampirkan</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-700"
                    onClick={() => setNota(null)}
                    aria-label="Hapus lampiran nota"
                  >
                    <X className="size-3.5" strokeWidth={1.75} />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => notaRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 bg-white px-3 py-2.5 text-[12.5px] text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-700"
                >
                  <ImagePlus className="size-4 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
                  Lampirkan foto nota (opsional)
                </button>
              )}
              <input
                ref={notaRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setNota({ name: f.name, size: `${Math.max(1, Math.round(f.size / 1024))} KB` });
                }}
                aria-label="Unggah bukti nota"
              />
            </div>
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
            disabled={!valid}
            className="h-9 bg-zinc-900 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800 disabled:opacity-50"
          >
            <Plus className="size-4" strokeWidth={2} />
            Simpan Pengeluaran
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
