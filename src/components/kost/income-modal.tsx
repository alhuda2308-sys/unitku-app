"use client";

import { useState } from "react";
import { Banknote, Landmark, Plus } from "lucide-react";
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
  INCOME_METHODS,
  MANUAL_INCOME_CATEGORIES,
  type ManualIncomeCategory,
} from "@/lib/kost-cashflow";
import { formatIDR, todayISO } from "@/lib/kost-data";
import { cn } from "@/lib/utils";
import { RupiahInput } from "./rupiah-input";

export interface IncomeDraft {
  category: ManualIncomeCategory;
  amount: number;
  tanggal: string; // ISO yyyy-mm-dd
  description: string;
  source: string; // nilai kanonik "Kas Tunai" | "Transfer Rekening Bank"
}

interface IncomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: IncomeDraft) => void;
}

const inputCls =
  "h-11 border-zinc-200 bg-white text-[14px] text-zinc-900 placeholder:text-zinc-600 focus-visible:ring-zinc-900/5 sm:h-9 sm:text-[13px]";

/** Ikon metode pembayaran */
function methodIcon(value: string) {
  return value === "Transfer Rekening Bank" ? (
    <Landmark className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
  ) : (
    <Banknote className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
  );
}

export function IncomeModal({ open, onOpenChange, onSubmit }: IncomeModalProps) {
  const [category, setCategory] = useState<ManualIncomeCategory | "">("");
  const [amount, setAmount] = useState(0);
  const [tanggal, setTanggal] = useState(() => todayISO());
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<string>("Kas Tunai");

  const valid = !!category && amount > 0 && description.trim().length >= 3;

  const reset = () => {
    setCategory("");
    setAmount(0);
    setTanggal(todayISO());
    setDescription("");
    setMethod("Kas Tunai");
  };

  const submit = () => {
    if (!valid || !category) return;
    onSubmit({
      category,
      amount,
      tanggal,
      description: description.trim(),
      source: method,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto bg-white p-0 sm:max-w-[480px] scrollbar-thin">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-900">
            <span className="flex size-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-600">
              <Plus className="size-4" strokeWidth={2.25} aria-hidden="true" />
            </span>
            Tambah Pemasukan Manual
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-zinc-700">
            Pemasukan di luar tagihan otomatis — langsung tercatat di Buku Kas &amp; menambah laba
            bersih.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 bg-zinc-50 p-5">
          {/* Tanggal + Nominal */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="in-tanggal" className="text-[12.5px] text-zinc-600">
                Tanggal Transaksi
              </Label>
              <Input
                id="in-tanggal"
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="in-nominal" className="text-[12.5px] text-zinc-600">
                Nominal Pemasukan
              </Label>
              <RupiahInput
                id="in-nominal"
                ariaLabel="Nominal pemasukan"
                value={amount}
                onChange={setAmount}
                size="lg"
              />
            </div>
          </div>
          {amount > 0 && (
            <p className="text-[12.5px] font-medium text-emerald-700">
              Akan tercatat masuk: +{formatIDR(amount)}
            </p>
          )}

          {/* Kategori pemasukan */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] text-zinc-600">Kategori Pemasukan</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as ManualIncomeCategory)}
            >
              <SelectTrigger
                className="h-11 w-full border-zinc-200 text-[14px] focus:ring-zinc-900/5 sm:h-9 sm:text-[13px]"
                aria-label="Kategori pemasukan"
              >
                <SelectValue placeholder="Pilih kategori pemasukan…" />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_INCOME_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="text-[13px]">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Keterangan */}
          <div className="space-y-1.5">
            <Label htmlFor="in-ket" className="text-[12.5px] text-zinc-600">
              Keterangan / Deskripsi Transaksi
            </Label>
            <Input
              id="in-ket"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="cth. Pelunasan tunai kamar 104 · Beli galon air"
              className={inputCls}
            />
          </div>

          {/* Metode pembayaran */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] text-zinc-600">Metode Pembayaran</Label>
            <div
              role="radiogroup"
              aria-label="Metode pembayaran"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {INCOME_METHODS.map((m) => {
                const active = method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMethod(m.value)}
                    className={cn(
                      "flex h-11 items-center gap-2 rounded-md border px-3 text-left text-[13px] font-medium transition-colors",
                      active
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                    )}
                  >
                    {methodIcon(m.value)}
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border bg-white px-5 py-3.5 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 border-zinc-200 bg-white px-4 text-[13px] text-zinc-700 shadow-none hover:bg-zinc-50 sm:h-9"
          >
            Batal
          </Button>
          <Button
            onClick={submit}
            disabled={!valid}
            className="h-11 bg-emerald-600 px-4 text-[13px] font-semibold text-white shadow-none hover:bg-emerald-700 disabled:opacity-50 sm:h-9"
          >
            <Plus className="size-4" strokeWidth={2.25} />
            Simpan Pemasukan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
