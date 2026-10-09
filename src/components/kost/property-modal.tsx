"use client";

import { useRef, useState } from "react";
import { Building2, Camera, ImagePlus, Link2, Trash2 } from "lucide-react";
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
import { toast } from "sonner";
import {
  PROPERTY_IMAGE_PLACEHOLDER,
  compressImageFile,
  hasCustomImage,
  resolvePropertyImage,
} from "@/lib/property-image";
import { PROPERTY_TYPE_META, type PropertyType } from "@/lib/property-types";
import type { ManagedProperty, PropertyDraft } from "@/lib/property-store";

interface PropertyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = mode "+ Tambah Properti Baru", terisi = mode "Edit Info Properti" */
  initial: ManagedProperty | null;
  onSubmit: (draft: PropertyDraft) => void;
}

const BANKS = ["BCA", "Mandiri", "BRI", "BNI", "CIMB Niaga", "Permata"];

const TYPE_OPTIONS = Object.entries(PROPERTY_TYPE_META).map(([value, meta]) => ({
  value: value as PropertyType,
  label: meta.label,
}));

/** Hint label unit otomatis per tipe — muncul live di bawah dropdown Tipe Properti */
const TYPE_HINTS: Record<PropertyType, string> = {
  kost: "Label unit otomatis: Kamar — cth. Kamar 101, Kamar 102.",
  kontrakan: "Label unit otomatis: Pintu / Petak — cth. Pintu 02, Petak A.",
  rusun: "Label unit otomatis: Unit — cth. Unit 3B, Unit 4A.",
};

const inputCls =
  "h-9 border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-zinc-900/5";

const sectionLabel =
  "text-[11px] font-bold uppercase tracking-wider text-zinc-400";

export function PropertyModal({ open, onOpenChange, initial, onSubmit }: PropertyModalProps) {
  const isEdit = initial !== null;

  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<PropertyType>(initial?.type ?? "kost");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [kelurahan, setKelurahan] = useState(initial?.kelurahan ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [urlInput, setUrlInput] = useState("");
  const [floors, setFloors] = useState(initial?.floors ? String(initial.floors) : "");
  const [targetRooms, setTargetRooms] = useState(initial?.targetRooms ? String(initial.targetRooms) : "");
  const [admin, setAdmin] = useState(initial?.admin ?? "");
  const [jamMalam, setJamMalam] = useState(initial?.jamMalam ?? "22:00");
  const [rules, setRules] = useState(initial?.rules ?? "");
  const [bank, setBank] = useState(initial?.rekening?.bank ?? "BCA");
  const [noRek, setNoRek] = useState(initial?.rekening?.number ?? "");
  const [atasNama, setAtasNama] = useState(initial?.rekening?.holder ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const valid = name.trim().length >= 3;

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const img = await compressImageFile(file);
      setImageUrl(img.dataUrl);
      toast.success("Foto siap disimpan", {
        description: `Fasad terkompresi ± ${img.sizeKb} KB — klik tombol simpan di bawah.`,
      });
    } catch (err) {
      toast.error("Foto gagal diunggah", {
        description: err instanceof Error ? err.message : "Coba berkas gambar lain.",
      });
    }
  };

  const applyUrl = () => {
    const v = urlInput.trim();
    if (!v) return;
    if (!/^(https?:\/\/|\/)/.test(v)) {
      toast.error("URL tidak valid", { description: "Gunakan awalan https:// atau path /…" });
      return;
    }
    setImageUrl(v);
    setUrlInput("");
  };

  const submit = () => {
    if (!valid) return;
    const hasRekening = noRek.trim().length > 0 || atasNama.trim().length > 0;
    onSubmit({
      name: name.trim(),
      type,
      address: address.trim(),
      kelurahan: kelurahan.trim(),
      city: city.trim(),
      imageUrl: imageUrl.trim(),
      floors: Number(floors) || 0,
      targetRooms: Number(targetRooms) || 0,
      admin: admin.trim(),
      rules: rules.trim(),
      jamMalam,
      rekening: hasRekening ? { bank, number: noRek.trim(), holder: atasNama.trim() } : null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 bg-white p-0 sm:max-w-[560px]">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-900">
            <Building2 className="size-4 text-zinc-600" strokeWidth={2} aria-hidden="true" />
            {isEdit ? "Edit Info Properti" : "Tambah Properti Baru"}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-zinc-500">
            {isEdit
              ? `Perbarui profil cabang "${initial.name}" — aturan & rekening penampung per properti bersifat independen.`
              : "Properti baru langsung masuk ke daftar switcher & terpilih aktif dengan status unit kosong."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[62vh] space-y-5 overflow-y-auto bg-zinc-50 p-5 scrollbar-thin">
          {/* ── Foto Fasad / Bangunan ── */}
          <section className="space-y-3">
            <h4 className={sectionLabel}>Foto Fasad / Bangunan</h4>
            <div className="flex items-start gap-3">
              <div className="relative size-20 shrink-0">
                <img
                  src={resolvePropertyImage(imageUrl)}
                  alt="Pratinjau foto fasad properti"
                  className="size-full rounded-xl border border-border object-cover"
                  onError={(e) => {
                    e.currentTarget.src = PROPERTY_IMAGE_PLACEHOLDER;
                  }}
                />
                {hasCustomImage(imageUrl) && (
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    title="Hapus foto"
                    aria-label="Hapus foto fasad"
                    className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-white bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700"
                  >
                    <Trash2 className="size-3" strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    className="h-8 border-zinc-200 bg-white px-2.5 text-[12.5px] font-semibold text-zinc-800 shadow-none hover:bg-zinc-50"
                  >
                    <ImagePlus className="size-3.5 text-zinc-500" strokeWidth={1.75} aria-hidden="true" />
                    Unggah Foto
                  </Button>
                  <p className="text-[11px] text-zinc-400">JPG/PNG · dikompresi otomatis · pratinjau instan</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-white px-2 focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-zinc-900/5">
                    <Link2 className="size-3.5 shrink-0 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
                    <input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyUrl();
                        }
                      }}
                      onBlur={applyUrl}
                      placeholder="atau tempel URL gambar (https://…)"
                      aria-label="URL gambar fasad properti"
                      className="h-full w-full min-w-0 bg-transparent text-[12.5px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                    />
                  </div>
                  {urlInput.trim() && (
                    <Button
                      type="button"
                      variant="outline"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={applyUrl}
                      className="h-8 border-zinc-200 bg-white px-2.5 text-[12px] font-semibold text-zinc-800 shadow-none hover:bg-zinc-50"
                    >
                      Terapkan
                    </Button>
                  )}
                </div>
                {!imageUrl && (
                  <p className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <Camera className="size-3" strokeWidth={1.75} aria-hidden="true" />
                    Belum ada foto — placeholder bangunan dipakai di banner identitas.
                  </p>
                )}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                pickPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
              aria-label="Unggah foto fasad properti"
            />
          </section>

          {/* ── Identitas & Lokasi ── */}
          <section className="space-y-3">
            <h4 className={sectionLabel}>Identitas &amp; Lokasi</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pr-tipe" className="text-[12px] text-zinc-600">
                  Tipe Properti
                </Label>
                <Select value={type} onValueChange={(v) => setType(v as PropertyType)}>
                  <SelectTrigger
                    id="pr-tipe"
                    className="h-9 w-full border-zinc-200 text-[13px] focus:ring-zinc-900/5"
                    aria-label="Tipe properti"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-[13px]">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] leading-4 text-zinc-400">{TYPE_HINTS[type]}</p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pr-nama" className="text-[12px] text-zinc-600">
                  Nama Properti <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="pr-nama"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    type === "kost"
                      ? "cth. Kost Griya Asri 3"
                      : type === "kontrakan"
                        ? "cth. Kontrakan Bukit Asri"
                        : "cth. Apartemen Green Palm"
                  }
                  className={inputCls}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pr-alamat" className="text-[12px] text-zinc-600">
                  Alamat Lengkap
                </Label>
                <Input
                  id="pr-alamat"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="cth. Jl. Kenanga Selatan No. 8"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-kel" className="text-[12px] text-zinc-600">
                  Kelurahan / Kecamatan
                </Label>
                <Input
                  id="pr-kel"
                  value={kelurahan}
                  onChange={(e) => setKelurahan(e.target.value)}
                  placeholder="cth. Kel. Sukamaju, Kec. Cibinong"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-kota" className="text-[12px] text-zinc-600">
                  Kota
                </Label>
                <Input
                  id="pr-kota"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="cth. Kab. Bogor"
                  className={inputCls}
                />
              </div>
            </div>
          </section>

          {/* ── Skala & Operasional ── */}
          <section className="space-y-3">
            <h4 className={sectionLabel}>Skala &amp; Operasional</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pr-lantai" className="text-[12px] text-zinc-600">
                  Jumlah Lantai
                </Label>
                <Input
                  id="pr-lantai"
                  type="number"
                  min={0}
                  max={10}
                  value={floors}
                  onChange={(e) => setFloors(e.target.value.replace(/\D/g, "").slice(0, 1))}
                  placeholder="cth. 2"
                  className={`${inputCls} tabular-nums`}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-target" className="text-[12px] text-zinc-600">
                  Target / Estimasi Jumlah {PROPERTY_TYPE_META[type].unitNoun}
                </Label>
                <Input
                  id="pr-target"
                  type="number"
                  min={0}
                  max={200}
                  value={targetRooms}
                  onChange={(e) => setTargetRooms(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder={type === "kontrakan" ? "cth. 10" : "cth. 18"}
                  className={`${inputCls} tabular-nums`}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pr-admin" className="text-[12px] text-zinc-600">
                  Admin / Penjaga yang Ditugaskan
                </Label>
                <Input
                  id="pr-admin"
                  value={admin}
                  onChange={(e) => setAdmin(e.target.value)}
                  placeholder="cth. Rudi Hartono (Penjaga)"
                  className={inputCls}
                />
              </div>
            </div>
          </section>

          {/* ── Aturan & Jam Malam ── */}
          <section className="space-y-3">
            <h4 className={sectionLabel}>Aturan Properti &amp; Jam Malam</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="pr-jam" className="text-[12px] text-zinc-600">
                  Jam Malam
                </Label>
                <Input
                  id="pr-jam"
                  type="time"
                  value={jamMalam}
                  onChange={(e) => setJamMalam(e.target.value)}
                  className={`${inputCls} tabular-nums`}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-aturan" className="text-[12px] text-zinc-600">
                  Aturan Kost
                </Label>
                <Textarea
                  id="pr-aturan"
                  rows={3}
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  placeholder={"cth. Pintu gerbang ditutup pukul 23:00 WIB.\nDilarang merokok di area umum."}
                  className="border-zinc-200 bg-white text-[12.5px] leading-5 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-zinc-900/5"
                />
              </div>
            </div>
          </section>

          {/* ── Rekening Penampung ── */}
          <section className="space-y-3">
            <h4 className={sectionLabel}>
              Rekening Penampung{" "}
              <span className="font-medium normal-case tracking-normal text-zinc-400">(opsional)</span>
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[110px_1fr_1fr]">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-zinc-600">Bank</Label>
                <Select value={bank} onValueChange={setBank}>
                  <SelectTrigger className="h-9 w-full border-zinc-200 text-[13px] focus:ring-zinc-900/5" aria-label="Bank rekening penampung">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {BANKS.map((b) => (
                      <SelectItem key={b} value={b} className="text-[13px]">
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-norek" className="text-[12px] text-zinc-600">
                  Nomor Rekening
                </Label>
                <Input
                  id="pr-norek"
                  inputMode="numeric"
                  value={noRek}
                  onChange={(e) => setNoRek(e.target.value.replace(/\D/g, "").slice(0, 18))}
                  placeholder="cth. 1234567890"
                  className={`${inputCls} tabular-nums`}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-an" className="text-[12px] text-zinc-600">
                  Atas Nama
                </Label>
                <Input
                  id="pr-an"
                  value={atasNama}
                  onChange={(e) => setAtasNama(e.target.value)}
                  placeholder="cth. Hendra Wijaya"
                  className={inputCls}
                />
              </div>
            </div>
          </section>
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
            {isEdit ? "Simpan Perubahan" : "Simpan & Buat Properti"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
