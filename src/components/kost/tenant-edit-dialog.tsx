"use client";

import { useState } from "react";
import { CircleAlert, PencilLine, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  MARITAL_STATUS_OPTIONS,
  roomNomor,
  type Room,
  type TenantCustomField,
  type TenantProfilePayload,
} from "@/lib/kost-data";
import { cn } from "@/lib/utils";

interface TenantEditDialogProps {
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (room: Room, payload: TenantProfilePayload) => void;
}

const inputCls =
  "h-9 border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-zinc-900/5";

interface CustomRow {
  key: number;
  label: string;
  value: string;
}

/** "+62 812-3456-7890" | "0812…" | "62812…" → digits "812…" (tanpa prefiks) */
function normalizeWaDigits(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("62")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return d;
}

let customRowSeq = 0;

export function TenantEditDialog({ room, open, onOpenChange, onSubmit }: TenantEditDialogProps) {
  const [nama, setNama] = useState(() => room?.tenant?.name ?? "");
  const [wa, setWa] = useState(() => normalizeWaDigits(room?.tenant?.phone ?? ""));
  const [pekerjaan, setPekerjaan] = useState(() => room?.tenant?.occupation ?? "");
  const [perkawinan, setPerkawinan] = useState(() => room?.tenant?.maritalStatus ?? "");
  const [wali, setWali] = useState(() => room?.tenant?.guardianName ?? "");
  const [kontak, setKontak] = useState(() => {
    const p = room?.tenant?.emergencyContact?.phone ?? "";
    return p === "—" ? "" : p;
  });
  const [alamat, setAlamat] = useState(() => room?.tenant?.addressKtp ?? "");
  const [catatan, setCatatan] = useState(() => room?.tenant?.notes ?? "");
  const [rows, setRows] = useState<CustomRow[]>(() =>
    (room?.tenant?.customFields ?? []).map((f: TenantCustomField) => ({
      key: ++customRowSeq,
      label: f.label,
      value: f.value,
    })),
  );
  const [error, setError] = useState("");

  if (!room || !room.tenant) return null;
  const tenant = room.tenant;

  const addRow = () => {
    if (rows.length >= 25) return;
    setRows((prev) => [...prev, { key: ++customRowSeq, label: "", value: "" }]);
  };
  const updateRow = (key: number, patch: Partial<Omit<CustomRow, "key">>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: number) => setRows((prev) => prev.filter((r) => r.key !== key));

  const submit = () => {
    const waDigits = normalizeWaDigits(wa);
    if (!nama.trim()) {
      setError("Nama lengkap penyewa wajib diisi.");
      return;
    }
    if (!waDigits) {
      setError("Nomor WhatsApp wajib diisi — contoh: 0812 3456 7890.");
      return;
    }
    setError("");
    onSubmit(room, {
      name: nama.trim(),
      phone: waDigits,
      occupation: pekerjaan.trim(),
      maritalStatus: perkawinan,
      guardianName: wali.trim(),
      emergencyPhone: kontak.trim(),
      addressKtp: alamat.trim(),
      notes: catatan.trim(),
      customFields: rows
        .filter((r) => r.label.trim())
        .map((r) => ({ label: r.label.trim(), value: r.value.trim() })),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-[480px]">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-900">
            <PencilLine className="size-4 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
            Edit Data Penghuni
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-zinc-700">
            {tenant.name} · Kamar {roomNomor(room)} — perubahan langsung tersimpan ke database.
          </DialogDescription>
        </DialogHeader>

        {/* Body — scroll saat konten melebihi tinggi layar */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-zinc-50 p-5 scrollbar-thin">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="te-nama" className="text-[12.5px] text-zinc-600">Nama Lengkap Penyewa *</Label>
              <Input
                id="te-nama"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="cth. Ahmad Fauzi"
                className={inputCls}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="te-wa" className="text-[12.5px] text-zinc-600">Nomor WhatsApp *</Label>
              <Input
                id="te-wa"
                value={wa}
                onChange={(e) => setWa(e.target.value)}
                inputMode="tel"
                placeholder="cth. 0812 3456 7890"
                className={cn(inputCls, "tabular-nums")}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="te-kerja" className="text-[12.5px] text-zinc-600">Pekerjaan / Profesi</Label>
              <Input
                id="te-kerja"
                value={pekerjaan}
                onChange={(e) => setPekerjaan(e.target.value)}
                placeholder="cth. Karyawan Swasta"
                className={inputCls}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="te-perkawinan" className="text-[12.5px] text-zinc-600">Status Perkawinan</Label>
              <Select value={perkawinan} onValueChange={setPerkawinan}>
                <SelectTrigger id="te-perkawinan" className={cn(inputCls, "w-full justify-between")}>
                  <SelectValue placeholder="Pilih status perkawinan" />
                </SelectTrigger>
                <SelectContent>
                  {MARITAL_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt} className="text-[13px]">
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="te-wali" className="text-[12.5px] text-zinc-600">Nama Orang Tua / Wali</Label>
              <Input
                id="te-wali"
                value={wali}
                onChange={(e) => setWali(e.target.value)}
                placeholder="cth. Budi Santoso"
                className={inputCls}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="te-darurat" className="text-[12.5px] text-zinc-600">Nomor Kontak Darurat</Label>
              <Input
                id="te-darurat"
                value={kontak}
                onChange={(e) => setKontak(e.target.value)}
                inputMode="tel"
                placeholder="cth. 0813 9999 8888"
                className={cn(inputCls, "tabular-nums")}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="te-alamat" className="text-[12.5px] text-zinc-600">Alamat Asal / Alamat KTP</Label>
              <Textarea
                id="te-alamat"
                value={alamat}
                onChange={(e) => setAlamat(e.target.value)}
                placeholder="Alamat sesuai KTP — cth. Jl. Merdeka No. 10, Depok, Jawa Barat"
                className="min-h-[64px] border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-zinc-900/5"
                rows={2}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="te-catatan" className="text-[12.5px] text-zinc-600">Catatan Tambahan</Label>
              <Textarea
                id="te-catatan"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="cth. Membawa 1 motor, jam malam 22.00, dikenali penjaga"
                className="min-h-[64px] border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-zinc-900/5"
                rows={2}
              />
            </div>
          </div>

          {/* ── Kolom kustom fleksibel: [Label] : [Isi] ── */}
          <div className="space-y-2 rounded-md border border-border bg-white p-3">
            <p className="text-[12.5px] font-semibold text-zinc-800">
              Keterangan Kustom{" "}
              <span className="font-normal text-zinc-500">(opsional — data fleksibel tambahan)</span>
            </p>
            {rows.length === 0 && (
              <p className="text-xs text-zinc-500">
                Belum ada keterangan kustom — mis. “Nomor Plat Motor : B 1234 CD”.
              </p>
            )}
            {rows.map((row) => (
              <div key={row.key} className="flex items-center gap-1.5">
                <Input
                  value={row.label}
                  onChange={(e) => updateRow(row.key, { label: e.target.value })}
                  placeholder="Nama keterangan"
                  aria-label="Nama keterangan kustom"
                  className={cn(inputCls, "min-w-0 flex-1")}
                  autoComplete="off"
                />
                <span className="shrink-0 text-zinc-400" aria-hidden="true">:</span>
                <Input
                  value={row.value}
                  onChange={(e) => updateRow(row.key, { value: e.target.value })}
                  placeholder="Isi keterangan"
                  aria-label="Isi keterangan kustom"
                  className={cn(inputCls, "min-w-0 flex-1")}
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(row.key)}
                  className="size-8 shrink-0 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Hapus keterangan ${row.label || "(tanpa nama)"}`}
                >
                  <Trash2 className="size-3.5" strokeWidth={1.75} />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={addRow}
              disabled={rows.length >= 25}
              className="h-8 w-full border-dashed border-zinc-300 bg-white text-[12.5px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
            >
              <Plus className="size-3.5" strokeWidth={2} />
              Tambah Keterangan / Kolom Kustom
            </Button>
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-red-600">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              {error}
            </p>
          )}
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
            className="h-9 bg-zinc-900 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800"
          >
            Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
