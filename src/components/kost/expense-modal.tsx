"use client";

import { useRef, useState } from "react";
import { Banknote, ImagePlus, Landmark, Loader2, Minus, PencilLine, X } from "lucide-react";
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
  CASH_SOURCES,
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "@/lib/kost-cashflow";
import { formatIDR, todayISO } from "@/lib/kost-data";
import { fileToPhotoDataUrl } from "@/lib/app-settings";
import { cn } from "@/lib/utils";
import { RupiahInput } from "./rupiah-input";

export interface ExpenseDraft {
  category: ExpenseCategory;
  amount: number;
  tanggal: string; // ISO yyyy-mm-dd
  description: string;
  source: string; // "Kas Tunai" | "Transfer Rekening Bank"
  attachment?: string; // dataURL foto nota / referensi file
}

interface NotaFile {
  name: string;
  size: string;
  dataUrl: string;
}

interface ExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: ExpenseDraft) => void;
  /** Mode edit — prefill data pengeluaran yang sudah ada */
  initial?: ExpenseDraft | null;
}

const inputCls =
  "h-11 border-zinc-200 bg-white text-[14px] text-zinc-900 placeholder:text-zinc-600 focus-visible:ring-zinc-900/5 sm:h-9 sm:text-[13px]";

function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Ikon sumber dana */
function sourceIcon(source: string) {
  return source === "Transfer Rekening Bank" ? (
    <Landmark className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
  ) : (
    <Banknote className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
  );
}

export function ExpenseModal({ open, onOpenChange, onSubmit, initial = null }: ExpenseModalProps) {
  const isEdit = initial !== null;
  const [category, setCategory] = useState<ExpenseCategory | "">(initial?.category ?? "");
  const [amount, setAmount] = useState(initial?.amount ?? 0);
  const [tanggal, setTanggal] = useState(initial?.tanggal ?? todayISO());
  const [description, setDescription] = useState(initial?.description ?? "");
  const [source, setSource] = useState<string>(initial?.source ?? "Kas Tunai");
  const [nota, setNota] = useState<NotaFile | null>(null);
  const [notaBusy, setNotaBusy] = useState(false);
  const notaRef = useRef<HTMLInputElement>(null);
  /** Simpan nama file lama pada mode edit tanpa ganti nota (attachment awal = referensi file) */
  const initialAttachmentRef = useRef<string | undefined>(initial?.attachment);
  const notaRemovedRef = useRef(false);

  const valid = !!category && amount > 0 && description.trim().length >= 3 && !notaBusy;

  const reset = () => {
    setCategory("");
    setAmount(0);
    setTanggal(todayISO());
    setDescription("");
    setSource("Kas Tunai");
    setNota(null);
    notaRemovedRef.current = false;
  };

  const pickNota = (file: File | undefined) => {
    if (!file) return;
    setNotaBusy(true);
    fileToPhotoDataUrl(file, 900, 0.85)
      .then((dataUrl) => {
        setNota({ name: file.name, size: humanSize(file.size), dataUrl });
        notaRemovedRef.current = false;
      })
      .catch(() => setNota(null))
      .finally(() => setNotaBusy(false));
  };

  const removeNota = () => {
    setNota(null);
    notaRemovedRef.current = true;
  };

  const submit = () => {
    if (!valid || !category) return;
    // Prioritas: nota baru terunggah > nota awal mode edit (jika tidak dihapus) > kosong
    let attachment: string | undefined;
    if (nota) attachment = nota.dataUrl;
    else if (!notaRemovedRef.current) attachment = initialAttachmentRef.current;

    onSubmit({
      category,
      amount,
      tanggal,
      description: description.trim(),
      source,
      attachment,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto bg-white p-0 sm:max-w-[480px] scrollbar-thin">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-900">
            <span className="flex size-6 items-center justify-center rounded-md bg-orange-100 text-orange-600">
              {isEdit ? (
                <PencilLine className="size-3.5" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Minus className="size-4" strokeWidth={2.25} aria-hidden="true" />
              )}
            </span>
            {isEdit ? "Edit Pengeluaran" : "Catat Pengeluaran Baru"}
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-zinc-700">
            {isEdit
              ? "Perbarui rincian biaya operasional — perubahan langsung tersimpan ke cloud."
              : "Biaya operasional harian langsung tercatat di Buku Kas & memengaruhi laba bersih."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 bg-zinc-50 p-5">
          {/* Tanggal + Nominal */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ex-tanggal" className="text-[12.5px] text-zinc-600">
                Tanggal Transaksi
              </Label>
              <Input
                id="ex-tanggal"
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-nominal" className="text-[12.5px] text-zinc-600">
                Nominal Pengeluaran
              </Label>
              <RupiahInput
                id="ex-nominal"
                ariaLabel="Nominal pengeluaran"
                value={amount}
                onChange={setAmount}
                size="lg"
              />
            </div>
          </div>
          {amount > 0 && (
            <p className="text-[12.5px] font-medium text-orange-700">
              Akan tercatat keluar: −{formatIDR(amount)}
            </p>
          )}

          {/* Kategori */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] text-zinc-600">Kategori Pengeluaran</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as ExpenseCategory)}
            >
              <SelectTrigger
                className="h-11 w-full border-zinc-200 text-[14px] focus:ring-zinc-900/5 sm:h-9 sm:text-[13px]"
                aria-label="Kategori pengeluaran"
              >
                <SelectValue placeholder="Pilih kategori biaya…" />
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

          {/* Keterangan */}
          <div className="space-y-1.5">
            <Label htmlFor="ex-ket" className="text-[12.5px] text-zinc-600">
              Keterangan / Deskripsi Singkat
            </Label>
            <Input
              id="ex-ket"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="cth. Beli token pompa air 200rb · Ganti keran air km mandi 102"
              className={inputCls}
            />
          </div>

          {/* Sumber Dana */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] text-zinc-600">Sumber Dana / Pembayaran</Label>
            <div
              role="radiogroup"
              aria-label="Sumber dana"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {CASH_SOURCES.map((s) => {
                const active = source === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSource(s)}
                    className={cn(
                      "flex h-11 items-center gap-2 rounded-md border px-3 text-left text-[13px] font-medium transition-colors",
                      active
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                    )}
                  >
                    {sourceIcon(s)}
                    <span className="truncate">{s}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upload bukti / struk / nota */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] text-zinc-600">
              Upload Bukti / Struk / Nota <span className="font-normal text-zinc-500">(opsional)</span>
            </Label>
            {nota ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-white p-2.5">
                { }
                <img
                  src={nota.dataUrl}
                  alt={`Pratinjau nota ${nota.name}`}
                  className="size-10 shrink-0 rounded border border-border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-zinc-800">{nota.name}</p>
                  <p className="text-xs text-zinc-700">{nota.size} · siap dilampirkan</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-700"
                  onClick={removeNota}
                  aria-label="Hapus lampiran nota"
                >
                  <X className="size-3.5" strokeWidth={1.75} />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => notaRef.current?.click()}
                disabled={notaBusy}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 bg-white px-3 py-2.5 text-[12.5px] text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900 disabled:opacity-60"
              >
                {notaBusy ? (
                  <Loader2 className="size-4 animate-spin text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <ImagePlus className="size-4 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
                )}
                {notaBusy ? "Memproses gambar…" : "Lampirkan foto nota / struk"}
              </button>
            )}
            <input
              ref={notaRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                pickNota(e.target.files?.[0]);
                e.target.value = "";
              }}
              aria-label="Unggah bukti nota"
            />
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
            className="h-11 bg-orange-600 px-4 text-[13px] font-semibold text-white shadow-none hover:bg-orange-700 disabled:opacity-50 sm:h-9"
          >
            <Minus className="size-4" strokeWidth={2.25} />
            {isEdit ? "Simpan Perubahan" : "Simpan Pengeluaran"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
