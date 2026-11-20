"use client";

import { useRef, useState } from "react";
import { CircleAlert, ImagePlus, IdCard, PencilLine, Plus, Trash2, Wallet } from "lucide-react";
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
  DEPOSIT_STATUS_LABELS,
  MARITAL_STATUS_OPTIONS,
  depositStatusOf,
  roomNomor,
  type DepositStatus,
  type Room,
  type TenantCustomField,
  type TenantProfilePayload,
} from "@/lib/kost-data";
import { fileToCompressedDataUrl } from "@/lib/image-compress";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { RupiahInput } from "./rupiah-input";

interface TenantEditDialogProps {
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (room: Room, payload: TenantProfilePayload) => void;
}

const inputCls =
  "h-9 border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-zinc-900/5";

/** Opsi status deposit — urutan alur wajar: ditahan → dikembalikan → dipotong */
const DEPOSIT_STATUS_OPTIONS: DepositStatus[] = ["ditahan", "dikembalikan", "dipotong"];

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
  // ── Kontrak & deposit (baris "Uang Deposit" di Detail Penghuni) ──
  const [deposit, setDeposit] = useState(() => room?.contract?.deposit ?? 0);
  const [depositStatus, setDepositStatus] = useState<DepositStatus>(() =>
    depositStatusOf(room?.contract),
  );
  // ── Foto KTP — picked = gambar BARU dipilih di sesi ini (menimpa existing)
  const [ktpPicked, setKtpPicked] = useState<string | null>(null);
  const [ktpBusy, setKtpBusy] = useState(false);
  const ktpInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  if (!room || !room.tenant) return null;
  const tenant = room.tenant;
  // Foto yang ditampilkan: pilihan BARU di sesi ini, kalau tidak ada foto DB
  const ktpPreview = ktpPicked ?? tenant.ktpImage ?? null;

  const addRow = () => {
    if (rows.length >= 25) return;
    setRows((prev) => [...prev, { key: ++customRowSeq, label: "", value: "" }]);
  };
  const updateRow = (key: number, patch: Partial<Omit<CustomRow, "key">>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: number) => setRows((prev) => prev.filter((r) => r.key !== key));

  /** Pilih foto KTP → kompres sisi klien (≤1024px JPEG) → pratinjau;
   *  tersimpan saat "Simpan Perubahan" ditekan (bukan saat memilih). */
  const pickKtp = async (file: File | undefined) => {
    if (!file) return;
    setKtpBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setKtpPicked(dataUrl);
    } catch {
      toast.error("Gagal memproses foto", {
        description: "Coba file JPG/PNG lain atau ambil ulang foto KTP.",
      });
    } finally {
      setKtpBusy(false);
    }
  };

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
      // ── Kontrak & deposit — selalu dikirim (nilai terakhir di form) ──
      deposit,
      depositStatus,
      // ── Foto KTP — hanya bila dipilih baru di sesi ini (undefined = tetap) ──
      ...(ktpPicked ? { ktpImage: ktpPicked } : {}),
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

          {/* ── Kontrak & Deposit — nominal + status (baris "Uang Deposit") ── */}
          <div className="space-y-3 rounded-md border border-border bg-white p-3">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-zinc-800">
              <Wallet className="size-3.5 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
              Kontrak &amp; Deposit
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="te-deposit" className="text-[12.5px] text-zinc-600">
                  Uang Deposit (Rp)
                </Label>
                <RupiahInput
                  id="te-deposit"
                  ariaLabel="Nominal uang deposit dalam Rupiah"
                  value={deposit}
                  onChange={setDeposit}
                  className={inputCls}
                />
                <p className="text-[11.5px] leading-4 text-zinc-500">
                  Nominal terbaru langsung tampil di Detail Penghuni &amp; Portal Penyewa.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="te-deposit-status" className="text-[12.5px] text-zinc-600">
                  Status Deposit
                </Label>
                <Select value={depositStatus} onValueChange={(v) => setDepositStatus(v as DepositStatus)}>
                  <SelectTrigger id="te-deposit-status" className={cn(inputCls, "w-full justify-between")}>
                    <SelectValue placeholder="Pilih status deposit" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPOSIT_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-[13px]">
                        {DEPOSIT_STATUS_LABELS[opt]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11.5px] leading-4 text-zinc-500">
                  Ditahan = masih dijaminan · Dipotong = dipakai ganti kerusakan/tunggakan.
                </p>
              </div>
            </div>
          </div>

          {/* ── Foto KTP — dokumen identitas penyewa (persist ke database) ── */}
          <div className="space-y-2 rounded-md border border-border bg-white p-3">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-zinc-800">
              <IdCard className="size-3.5 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
              Foto KTP (Dokumen Identitas)
            </p>
            {ktpPreview ? (
              <div className="flex items-start gap-3">
                <img
                  src={ktpPreview}
                  alt={`Foto KTP ${tenant.name}`}
                  className="h-24 w-36 shrink-0 rounded-md border border-border object-cover"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-[12px] leading-4 text-zinc-700">
                    {ktpPicked
                      ? "Foto baru siap — tersimpan saat “Simpan Perubahan” ditekan."
                      : "Tersimpan di database — tampil di Detail Penghuni & ikut terlihat oleh penyewa di portal."}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => ktpInputRef.current?.click()}
                      disabled={ktpBusy}
                      className="h-7 border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
                    >
                      <ImagePlus className="size-3" strokeWidth={1.75} aria-hidden="true" />
                      {ktpPicked ? "Ganti Pilihan" : "Ganti Foto"}
                    </Button>
                    {ktpPicked && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setKtpPicked(null)}
                        className="h-7 px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        Batalkan
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => ktpInputRef.current?.click()}
                disabled={ktpBusy}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2.5 text-[12.5px] text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-white hover:text-zinc-700"
              >
                <ImagePlus className="size-4 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
                {ktpBusy ? "Memproses foto…" : "Unggah foto KTP penyewa (JPG/PNG)"}
              </button>
            )}
            <input
              ref={ktpInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void pickKtp(e.target.files?.[0])}
              aria-label="Unggah foto KTP"
            />
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
