"use client";

import { useRef, useState } from "react";
import { CalendarDays, Check, ImagePlus, KeyRound, UserPlus, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatIDR, diffNights, roomNomor, todayISO, addDaysISO, type Room } from "@/lib/kost-data";
import { isVillaType, tenantTermFor } from "@/lib/app-settings";
import { cn } from "@/lib/utils";
import { RupiahInput } from "./rupiah-input";

export type BillingCycle = "Harian" | "Mingguan" | "Bulanan" | "Per 3 Bulan" | "Tahunan";

export interface CheckinPayload {
  roomId: string;
  nama: string;
  phone: string; // digits without +62
  nik: string;
  emergencyName: string;
  emergencyPhone: string;
  ktpFileName?: string;
  tanggalMasuk: string; // ISO yyyy-mm-dd — check-in (sewa harian) / tanggal masuk (kontrak)
  siklus: BillingCycle;
  hargaSewa: number; // per bulan (kontrak) / per hari (Harian)
  deposit: number;
  addons: string[];
  totalPerBulan: number; // sewa pokok + add-on per bulan (kontrak); harga per hari bila Harian
  // ── Sewa harian (Villa/Homestay / siklus Harian)
  tanggalCheckout?: string; // ISO yyyy-mm-dd
  durasiHari?: number; // jumlah malam menginap (check-out − check-in)
  totalTagihan?: number; // harga per hari × durasi
}

interface CheckinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vacantRooms: Room[];
  /** Room preselected (e.g. opened from a vacant room card / drawer) */
  preselectRoomId?: string | null;
  onSubmit: (payload: CheckinPayload) => void;
  /** Tipe properti aktif — Villa/Homestay → label "Tamu / Penyewa" + default siklus Harian */
  propertyType?: string;
}

const ADDONS: { label: string; price: number }[] = [
  { label: "Parkir Motor", price: 50_000 },
  { label: "Parkir Mobil", price: 150_000 },
  { label: "Orang Kedua", price: 200_000 },
];

// Urutan siklus — Mingguan (sewa kontrakan/kost mingguan) ditempatkan
// setelah Harian, sebelum siklus bulanan.
const CYCLES: BillingCycle[] = ["Harian", "Mingguan", "Bulanan", "Per 3 Bulan", "Tahunan"];

const inputCls =
  "h-9 border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-600 focus-visible:ring-zinc-900/5";

function SectionLabel({ icon: Icon, children }: { icon: typeof KeyRound; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-1.5">
      <Icon className="size-3.5 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">{children}</h3>
    </div>
  );
}

export function CheckinModal({
  open,
  onOpenChange,
  vacantRooms,
  preselectRoomId,
  onSubmit,
  propertyType,
}: CheckinModalProps) {
  const [ktpFile, setKtpFile] = useState<{ name: string; url: string } | null>(null);
  const [tanggalMasuk, setTanggalMasuk] = useState(todayISO);
  const [tanggalCheckout, setTanggalCheckout] = useState(() => addDaysISO(todayISO(), 1));
  const [siklus, setSiklus] = useState<BillingCycle>(isVillaType(propertyType) ? "Harian" : "Bulanan");
  const [rentTouched, setRentTouched] = useState(false);
  const [deposit, setDeposit] = useState(1_000_000);
  const [addons, setAddons] = useState<string[]>([]);
  const ktpInputRef = useRef<HTMLInputElement>(null);

  // Initial values resolved from props — parent remounts this component (key prop)
  // each time the dialog opens, so no reset effects are needed.
  const initialRoom =
    vacantRooms.find((r) => r.id === preselectRoomId) ?? vacantRooms[0];
  const [roomId, setRoomId] = useState(initialRoom?.id ?? "");
  const [hargaSewa, setHargaSewa] = useState(initialRoom?.price ?? 0);
  const [nama, setNama] = useState("");
  const [phone, setPhone] = useState("");
  const [nik, setNik] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  const room = vacantRooms.find((r) => r.id === roomId);

  const isHarian = siklus === "Harian";
  /** Siklus Mingguan — add-on rutin berorientasi bulanan tidak berlaku */
  const isMingguan = siklus === "Mingguan";
  /** Label orang yang menghuni — Villa/Homestay atau sewa harian → "Tamu / Penyewa" */
  const tenantTerm = tenantTermFor(propertyType, isHarian);

  const addonTotal = addons.reduce((a, label) => a + (ADDONS.find((x) => x.label === label)?.price ?? 0), 0);
  const totalPerBulan = hargaSewa + addonTotal;
  /** Durasi menginap — tgl 1 → tgl 3 = 2 malam/hari */
  const durasiHari = isHarian ? Math.max(0, diffNights(tanggalMasuk, tanggalCheckout)) : 0;
  const totalHarian = hargaSewa * durasiHari;

  const valid =
    !!roomId &&
    nama.trim().length >= 3 &&
    phone.replace(/\D/g, "").length >= 9 &&
    nik.replace(/\D/g, "").length === 16 &&
    !!tanggalMasuk &&
    hargaSewa > 0 &&
    (!isHarian || durasiHari >= 1);

  const pickKtp = (file: File | undefined) => {
    if (!file) return;
    if (ktpFile) URL.revokeObjectURL(ktpFile.url);
    setKtpFile({ name: file.name, url: URL.createObjectURL(file) });
  };

  const submit = () => {
    if (!valid) return;
    onSubmit({
      roomId,
      nama: nama.trim(),
      phone: phone.replace(/\D/g, ""),
      nik: nik.replace(/\D/g, ""),
      emergencyName: emergencyName.trim(),
      emergencyPhone: emergencyPhone.trim(),
      ktpFileName: ktpFile?.name,
      tanggalMasuk,
      siklus,
      hargaSewa,
      deposit,
      addons: isHarian || isMingguan ? [] : addons,
      totalPerBulan,
      ...(isHarian
        ? { tanggalCheckout, durasiHari, totalTagihan: totalHarian }
        : {}),
    });
    if (ktpFile) URL.revokeObjectURL(ktpFile.url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 shadow-2xl supports-[height:100dvh]:max-h-[90dvh]">
        <DialogHeader className="z-10 shrink-0 border-b border-zinc-100 bg-white p-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-900">
            <UserPlus className="size-4 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
            Check-in {tenantTerm === "Penyewa" ? "Penghuni Baru" : "Tamu Baru"}
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-zinc-700">
            {isHarian
              ? `Daftarkan tamu, rentang check-in/out, dan total tagihan menginap dalam satu langkah.`
              : `Daftarkan ${tenantTerm.toLowerCase()}, kontrak, dan pembayaran deposit dalam satu langkah.`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-zinc-50 p-4 scrollbar-thin">
          {/* ── Section 1: Pilih Kamar ─────────────────────────────────────────── */}
          <section className="rounded-lg border border-border bg-white p-4">
            <SectionLabel icon={KeyRound}>Pilih Kamar</SectionLabel>
            <Select
              value={roomId}
              onValueChange={(v) => {
                setRoomId(v);
                const r = vacantRooms.find((x) => x.id === v);
                if (r && !rentTouched) setHargaSewa(r.price);
              }}
            >
              <SelectTrigger className="h-9 w-full border-zinc-200 text-[13px] focus:ring-zinc-900/5" aria-label="Pilih kamar kosong">
                <SelectValue placeholder="Pilih kamar kosong…" />
              </SelectTrigger>
              <SelectContent>
                {vacantRooms.length === 0 && (
                  <div className="px-3 py-2.5 text-[12.5px] text-zinc-700">Tidak ada kamar kosong.</div>
                )}
                {vacantRooms.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-[13px]">
                    {isVillaType(propertyType) ? "Unit" : "Kamar"} {roomNomor(r)} — Lt {r.floor} · {r.type} · {formatIDR(r.price)}{isVillaType(propertyType) ? "/hari" : "/bln"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {room && (
              <p className="mt-2 text-[12.5px] text-zinc-700">
                Tersedia {vacantRooms.length} kamar kosong · kamar terpilih{" "}
                <span className="font-medium text-zinc-600">{room.type}</span>
              </p>
            )}
          </section>

          {/* ── Section 2: Data Penghuni / Tamu ───────────────────────────── */}
          <section className="rounded-lg border border-border bg-white p-4">
            <SectionLabel icon={UserPlus}>Data {tenantTerm}</SectionLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ck-nama" className="text-[12.5px] text-zinc-600">Nama Lengkap</Label>
                <Input
                  id="ck-nama"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="cth. Sinta Rahmawati"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ck-wa" className="text-[12.5px] text-zinc-600">No. WhatsApp</Label>
                <div className="flex h-9 items-center overflow-hidden rounded-md border border-border bg-white focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-zinc-900/5">
                  <span className="select-none border-r border-border bg-zinc-50 px-2.5 text-[12.5px] font-medium text-zinc-700">
                    +62
                  </span>
                  <input
                    id="ck-wa"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 13))}
                    placeholder="812-3456-7890"
                    className="h-full w-full min-w-0 px-2.5 text-[13px] tabular-nums text-zinc-900 placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ck-nik" className="text-[12.5px] text-zinc-600">NIK / No. KTP</Label>
                <Input
                  id="ck-nik"
                  inputMode="numeric"
                  value={nik}
                  onChange={(e) => setNik(e.target.value.replace(/\D/g, "").slice(0, 16))}
                  placeholder="16 digit sesuai KTP"
                  className={cn(inputCls, "tabular-nums")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ck-emg-nama" className="text-[12.5px] text-zinc-600">Kontak Darurat — Nama</Label>
                <Input
                  id="ck-emg-nama"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="cth. Bpk. Surya (Ayah)"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ck-emg-hp" className="text-[12.5px] text-zinc-600">Kontak Darurat — No. HP</Label>
                <Input
                  id="ck-emg-hp"
                  inputMode="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="cth. 0815-6102-9911"
                  className={cn(inputCls, "tabular-nums")}
                />
              </div>

              {/* Upload KTP */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[12.5px] text-zinc-600">Upload Foto KTP</Label>
                {ktpFile ? (
                  <div className="flex items-center gap-3 rounded-md border border-border bg-zinc-50 p-2">
                    <img
                      src={ktpFile.url}
                      alt={`Pratinjau ${ktpFile.name}`}
                      className="size-12 rounded border border-border object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-zinc-800">{ktpFile.name}</p>
                      <p className="text-xs text-zinc-700">Foto KTP siap diunggah</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-700"
                      onClick={() => {
                        URL.revokeObjectURL(ktpFile.url);
                        setKtpFile(null);
                      }}
                      aria-label="Hapus foto KTP"
                    >
                      <X className="size-3.5" strokeWidth={1.75} />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => ktpInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2.5 text-[12.5px] text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-white hover:text-zinc-700"
                  >
                    <ImagePlus className="size-4 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
                    Klik untuk unggah foto KTP (JPG/PNG)
                  </button>
                )}
                <input
                  ref={ktpInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pickKtp(e.target.files?.[0])}
                  aria-label="Unggah foto KTP"
                />
              </div>
            </div>
          </section>

          {/* ── Section 3: Detail Sewa & Keuangan ──────────────────────────────── */}
          <section className="rounded-lg border border-border bg-white p-4">
            <SectionLabel icon={Wallet}>{isHarian ? "Detail Menginap & Keuangan" : "Detail Sewa & Keuangan"}</SectionLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ck-masuk" className="text-[12.5px] text-zinc-600">
                  {isHarian ? "Tanggal Check-in" : "Tanggal Masuk"}
                </Label>
                <div className="relative">
                  <CalendarDays
                    className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-700"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <Input
                    id="ck-masuk"
                    type="date"
                    value={tanggalMasuk}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTanggalMasuk(v);
                      // Check-out ikut maju bila rentang menjadi tidak valid
                      if (isHarian && v && diffNights(v, tanggalCheckout) < 1) {
                        setTanggalCheckout(addDaysISO(v, 1));
                      }
                    }}
                    className={cn(inputCls, "tabular-nums")}
                  />
                </div>
              </div>
              {isHarian && (
                <div className="space-y-1.5">
                  <Label htmlFor="ck-checkout" className="text-[12.5px] text-zinc-600">Tanggal Check-out</Label>
                  <div className="relative">
                    <CalendarDays
                      className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-700"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <Input
                      id="ck-checkout"
                      type="date"
                      value={tanggalCheckout}
                      min={addDaysISO(tanggalMasuk || todayISO(), 1)}
                      onChange={(e) => setTanggalCheckout(e.target.value)}
                      className={cn(inputCls, "tabular-nums")}
                      aria-invalid={durasiHari < 1}
                    />
                  </div>
                  {durasiHari >= 1 ? (
                    <p className="text-xs text-zinc-700">
                      Durasi menginap: <span className="font-semibold text-zinc-900">{durasiHari} malam</span> ({durasiHari} hari)
                    </p>
                  ) : (
                    <p className="text-xs font-medium text-red-600">
                      Check-out harus setelah tanggal check-in (min. 1 malam).
                    </p>
                  )}
                </div>
              )}
              <div className={cn("space-y-1.5", isHarian && "sm:col-span-2")}>
                <Label className="text-[12.5px] text-zinc-600">Siklus Tagihan</Label>
                {/* 5 siklus (Harian · Mingguan · Bulanan · Per 3 Bulan · Tahunan)
                    — grid 3 kolom agar label "Per 3 Bulan" tetap utuh di
                    mobile sempit (baris 3+2, tinggi sentuh 32px tetap aman). */}
                <div className="grid w-full grid-cols-3 gap-0.5 rounded-md border border-border bg-zinc-50 p-0.5" role="group" aria-label="Siklus tagihan">
                  {CYCLES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={siklus === c}
                      onClick={() => setSiklus(c)}
                      className={cn(
                        "h-8 min-w-0 rounded-[6px] px-1 text-[12.5px] font-medium transition-all",
                        siklus === c
                          ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-zinc-200"
                          : "text-zinc-700 hover:text-zinc-800"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ck-sewa" className="text-[12.5px] text-zinc-600">Harga Sewa Pokok</Label>
                <RupiahInput
                  id="ck-sewa"
                  ariaLabel={isHarian ? "Harga sewa per hari" : isMingguan ? "Harga sewa per minggu" : "Harga sewa pokok per bulan"}
                  value={hargaSewa}
                  onChange={(v) => {
                    setRentTouched(true);
                    setHargaSewa(v);
                  }}
                />
                <p className="text-xs text-zinc-700">{isHarian ? "per hari" : "per bulan"}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ck-deposit" className="text-[12.5px] text-zinc-600">Uang Jaminan / Deposit</Label>
                <RupiahInput id="ck-deposit" ariaLabel="Uang jaminan deposit" value={deposit} onChange={setDeposit} />
                <p className="text-xs text-zinc-700">ditahan & dikembalikan saat check-out</p>
              </div>

              {/* Add-on Rutin — hanya utk kontrak periodik bulanan (harga add-on
                  per bulan; Harian & Mingguan tidak menghuninya) */}
              {!isHarian && !isMingguan && (
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-[12.5px] text-zinc-600">Add-on Rutin</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {ADDONS.map((a) => {
                    const checked = addons.includes(a.label);
                    return (
                      <label
                        key={a.label}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 transition-colors",
                          checked ? "border-zinc-300 bg-zinc-50" : "border-border bg-white hover:bg-zinc-50"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setAddons((prev) =>
                              prev.includes(a.label) ? prev.filter((x) => x !== a.label) : [...prev, a.label]
                            )
                          }
                          aria-label={`Add-on ${a.label}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium text-zinc-800">{a.label}</span>
                          <span className="block text-xs tabular-nums text-zinc-700">+{formatIDR(a.price)}/bln</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              )}

              {/* Live total — kontrak: per bulan · Harian: harga/hari × durasi */}
              {isHarian ? (
                <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 sm:col-span-2">
                  <span className="text-[12.5px] text-zinc-700">
                    Total Tagihan ({durasiHari} malam × {formatIDR(hargaSewa)}/hari)
                  </span>
                  <span className="text-[14px] font-bold tabular-nums text-zinc-900">{formatIDR(totalHarian)}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-md border border-border bg-zinc-50 px-3 py-2 sm:col-span-2">
                  <span className="text-[12.5px] text-zinc-700">Total sewa {isMingguan ? "per minggu" : "per bulan"}</span>
                  <span className="text-[14px] font-bold tabular-nums text-zinc-900">{formatIDR(totalPerBulan)}</span>
                </div>
              )}
            </div>
          </section>
        </div>

        <DialogFooter className="z-10 flex flex-row shrink-0 items-center justify-end gap-3 border-t border-zinc-100 bg-white p-4">
          <p className="hidden text-[12.5px] text-zinc-700 sm:block">
            {isHarian
              ? room
                ? `${formatIDR(totalHarian)} · ${durasiHari} malam — Unit ${roomNomor(room)} langsung berstatus terisi.`
                : "Pilih unit terlebih dahulu."
              : room
                ? `Kamar ${roomNomor(room)} akan langsung berstatus terisi.`
                : "Pilih kamar terlebih dahulu."}
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 flex-1 border-zinc-200 bg-white text-[13px] text-zinc-700 shadow-none hover:bg-zinc-50 sm:flex-none"
            >
              Batal
            </Button>
            <Button
              onClick={submit}
              disabled={!valid}
              className="h-9 flex-1 bg-zinc-900 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800 disabled:opacity-50 sm:flex-none"
            >
              <Check className="size-4" strokeWidth={2} />
              Simpan &amp; Check-in
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
