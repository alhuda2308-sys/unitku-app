"use client";

import { useRef, useState } from "react";
import {
  Building2,
  ImagePlus,
  MessageSquareText,
  Plus,
  X,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { Room } from "@/lib/kost-data";
import {
  COMMON_AREAS,
  OWNER_REPORTER,
  TICKET_CATEGORIES,
  TICKET_STATUS_META,
  TICKET_URGENSI_META,
  type CreateTicketDraft,
  type TicketCategory,
  type TicketSource,
  type TicketUrgensi,
} from "@/lib/ticket-data";

interface CreateTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** All rooms — occupied ones (with tenant) populate the "Pilih Kamar & Penyewa" dropdown */
  rooms: Room[];
  /** Parent creates the ticket; returns the new ticket id */
  onCreateTicket: (draft: CreateTicketDraft) => string;
}

const MAX_PHOTOS = 3;
const CUSTOM_AREA = "__custom__";

const URGENSI_HINT: Record<TicketUrgensi, string> = {
  rendah: "Bisa menunggu jadwal rutin",
  sedang: "Ditindaklanjuti 1–2 hari",
  darurat: "Segera / hari ini juga",
};

export function CreateTicketModal({
  open,
  onOpenChange,
  rooms,
  onCreateTicket,
}: CreateTicketModalProps) {
  const [sumber, setSumber] = useState<TicketSource>("penyewa");
  const [roomId, setRoomId] = useState<string>("");
  const [lokasiPilihan, setLokasiPilihan] = useState<string>("");
  const [lokasiCustom, setLokasiCustom] = useState("");
  const [kategori, setKategori] = useState<TicketCategory | "">("");
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [urgensi, setUrgensi] = useState<TicketUrgensi>("sedang");
  const [photos, setPhotos] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const occupiedRooms = rooms.filter((r) => r.tenant);
  const selectedRoom = occupiedRooms.find((r) => r.id === roomId) ?? null;
  const isCustomArea = lokasiPilihan === CUSTOM_AREA;
  const lokasiFinal = isCustomArea ? lokasiCustom.trim() : lokasiPilihan;

  const valid =
    kategori !== "" &&
    judul.trim().length >= 3 &&
    deskripsi.trim().length >= 5 &&
    (sumber === "penyewa"
      ? roomId !== "" && selectedRoom?.tenant != null
      : lokasiFinal.length >= 3);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).slice(0, room);
    if (picked.length === 0) {
      return;
    }
    setPhotos((prev) => [...prev, ...picked.map((f) => URL.createObjectURL(f))]);
  };

  const removePhoto = (src: string) => {
    URL.revokeObjectURL(src);
    setPhotos((prev) => prev.filter((p) => p !== src));
  };

  const submit = () => {
    if (!valid) return;
    const draft: CreateTicketDraft =
      sumber === "penyewa" && selectedRoom?.tenant
        ? {
            sumber,
            roomId: selectedRoom.id,
            reporterName: selectedRoom.tenant.name,
            reporterPhone: selectedRoom.tenant.phone,
            kategori,
            judul: judul.trim(),
            deskripsi: deskripsi.trim(),
            urgensi,
            photos,
          }
        : {
            sumber: "fasilitas",
            lokasi: lokasiFinal,
            reporterName: OWNER_REPORTER.name,
            reporterPhone: OWNER_REPORTER.phone,
            kategori,
            judul: judul.trim(),
            deskripsi: deskripsi.trim(),
            urgensi,
            photos,
          };
    onCreateTicket(draft); // blob URLs stay alive — the ticket list still renders them
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto bg-white p-0 scrollbar-thin sm:max-w-[540px]">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-900">
            <Plus className="size-4 text-zinc-700" strokeWidth={2} aria-hidden="true" />
            Buat Tiket Komplain
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-zinc-700">
            Catat laporan penyewa atau jadwalkan pemeliharaan fasilitas umum — tiket baru
            otomatis berstatus <span className="font-medium text-zinc-700">Menunggu</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 bg-zinc-50 p-5">
          {/* ── 1. Sumber laporan ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] font-medium text-zinc-700">Sumber Laporan</Label>
            <div
              role="radiogroup"
              aria-label="Sumber laporan"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              <button
                type="button"
                role="radio"
                aria-checked={sumber === "penyewa"}
                onClick={() => setSumber("penyewa")}
                className={cn(
                  "flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20",
                  sumber === "penyewa"
                    ? "border-zinc-900 bg-white ring-1 ring-zinc-900"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                )}
              >
                <MessageSquareText
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    sumber === "penyewa" ? "text-zinc-900" : "text-zinc-700"
                  )}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-zinc-900">
                    Laporan Penyewa
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-zinc-700">
                    Keluhan dari kamar yang sedang terisi
                  </span>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={sumber === "fasilitas"}
                onClick={() => setSumber("fasilitas")}
                className={cn(
                  "flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20",
                  sumber === "fasilitas"
                    ? "border-zinc-900 bg-white ring-1 ring-zinc-900"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                )}
              >
                <Building2
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    sumber === "fasilitas" ? "text-zinc-900" : "text-zinc-700"
                  )}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-zinc-900">
                    Pemeliharaan Rutin / Fasilitas Umum
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-zinc-700">
                    Area non-kamar: parkir, dapur bersama, pompa air…
                  </span>
                </span>
              </button>
            </div>
          </div>

          {/* ── 2a. Pilih kamar & penyewa ─────────────────────────────────── */}
          {sumber === "penyewa" ? (
            <div className="space-y-1.5">
              <Label htmlFor="ctk-room" className="text-[12.5px] font-medium text-zinc-700">
                Pilih Kamar &amp; Penyewa
              </Label>
              {occupiedRooms.length === 0 ? (
                <div className="flex h-9 items-center rounded-md border border-dashed border-zinc-300 bg-white px-3 text-[12.5px] text-zinc-700">
                  Tidak ada kamar yang sedang terisi.
                </div>
              ) : (
                <>
                  <Select value={roomId} onValueChange={setRoomId}>
                    <SelectTrigger
                      id="ctk-room"
                      className="h-9 w-full border-zinc-200 bg-white text-[13px] shadow-none focus:ring-zinc-900/10"
                    >
                      <SelectValue placeholder="cth. Kamar 102 — Dimas Ardi" />
                    </SelectTrigger>
                    <SelectContent>
                      {occupiedRooms.map((r) => (
                        <SelectItem key={r.id} value={r.id} className="text-[13px]">
                          Kamar {r.id} — {r.tenant?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedRoom?.tenant && (
                    <p className="text-xs text-zinc-700">
                      Pelapor:{" "}
                      <span className="font-medium text-zinc-700">
                        {selectedRoom.tenant.name}
                      </span>{" "}
                      ·{" "}
                      <span className="tabular-nums text-emerald-600">
                        WA {selectedRoom.tenant.phone}
                      </span>
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
            /* ── 2b. Lokasi fasilitas umum ───────────────────────────────── */
            <div className="space-y-1.5">
              <Label htmlFor="ctk-lokasi" className="text-[12.5px] font-medium text-zinc-700">
                Lokasi Fasilitas
              </Label>
              <Select value={lokasiPilihan} onValueChange={setLokasiPilihan}>
                <SelectTrigger
                  id="ctk-lokasi"
                  className="h-9 w-full border-zinc-200 bg-white text-[13px] shadow-none focus:ring-zinc-900/10"
                >
                  <SelectValue placeholder="cth. Area Parkir / Pompa Air…" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_AREAS.map((area) => (
                    <SelectItem key={area} value={area} className="text-[13px]">
                      {area}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_AREA} className="text-[13px]">
                    Lainnya…
                  </SelectItem>
                </SelectContent>
              </Select>
              {isCustomArea && (
                <Input
                  value={lokasiCustom}
                  onChange={(e) => setLokasiCustom(e.target.value)}
                  placeholder="Tentukan lokasi, cth. Gudang Lantai 2"
                  aria-label="Lokasi fasilitas kustom"
                  className="h-9 border-zinc-200 bg-white text-[13px] placeholder:text-zinc-600 focus-visible:ring-zinc-900/10"
                />
              )}
              <p className="text-xs text-zinc-700">
                Pelapor otomatis tercatat sebagai{" "}
                <span className="font-medium text-zinc-700">Pengelola</span> (internal).
              </p>
            </div>
          )}

          {/* ── 3. Kategori kerusakan ─────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="ctk-kategori" className="text-[12.5px] font-medium text-zinc-700">
              Kategori Kerusakan
            </Label>
            <Select value={kategori} onValueChange={(v) => setKategori(v as TicketCategory)}>
              <SelectTrigger
                id="ctk-kategori"
                className="h-9 w-full border-zinc-200 bg-white text-[13px] shadow-none focus:ring-zinc-900/10"
              >
                <SelectValue placeholder="Pilih kategori…" />
              </SelectTrigger>
              <SelectContent>
                {TICKET_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="text-[13px]">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── 4. Judul & deskripsi ──────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="ctk-judul" className="text-[12.5px] font-medium text-zinc-700">
              Judul Keluhan
            </Label>
            <Input
              id="ctk-judul"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder="cth. AC kamar tidak dingin"
              className="h-9 border-zinc-200 bg-white text-[13px] placeholder:text-zinc-600 focus-visible:ring-zinc-900/10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctk-deskripsi" className="text-[12.5px] font-medium text-zinc-700">
              Deskripsi Keluhan
            </Label>
            <Textarea
              id="ctk-deskripsi"
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Jelaskan rincian masalah: kapan mulai, kondisi saat ini, bagian yang rusak…"
              rows={3}
              className="resize-none border-zinc-200 bg-white text-[13px] placeholder:text-zinc-600 focus-visible:ring-zinc-900/10"
            />
            <p className="text-xs text-zinc-700">Minimal 5 karakter.</p>
          </div>

          {/* ── 5. Tingkat urgensi ────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] font-medium text-zinc-700">Tingkat Urgensi</Label>
            <div
              role="radiogroup"
              aria-label="Tingkat urgensi"
              className="grid grid-cols-3 gap-2"
            >
              {(Object.keys(TICKET_URGENSI_META) as TicketUrgensi[]).map((u) => {
                const meta = TICKET_URGENSI_META[u];
                const active = urgensi === u;
                return (
                  <button
                    key={u}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setUrgensi(u)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20",
                      active
                        ? "border-zinc-900 bg-white ring-1 ring-zinc-900"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden="true" />
                      <span
                        className={cn(
                          "text-[12.5px] leading-none",
                          active ? "font-semibold text-zinc-900" : "text-zinc-600"
                        )}
                      >
                        {u === "darurat" ? "Darurat / Segera" : meta.label}
                      </span>
                    </span>
                    <span className="hidden text-xs leading-none text-zinc-700 sm:block">
                      {URGENSI_HINT[u]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 6. Upload foto lampiran ───────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] font-medium text-zinc-700">
              Upload Foto Lampiran{" "}
              <span className="font-normal text-zinc-700">(opsional, maks. {MAX_PHOTOS})</span>
            </Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
              aria-label="Unggah foto kerusakan"
            />
            <div className="flex gap-2">
              {photos.map((src) => (
                <div
                  key={src}
                  className="group relative size-[64px] shrink-0 overflow-hidden rounded-md border border-border bg-white"
                >
                  <img src={src} alt="Foto kerusakan yang diunggah" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(src)}
                    className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-zinc-900/80 text-white transition-colors hover:bg-zinc-900"
                    aria-label="Hapus foto"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-[64px] flex-1 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-zinc-300 bg-white text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20"
                >
                  <ImagePlus className="size-4" strokeWidth={1.75} />
                  <span className="text-xs font-medium">Unggah Foto</span>
                </button>
              )}
            </div>
          </div>

          {/* ── 7. Status awal ────────────────────────────────────────────── */}
          <div className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-2">
            <span className="text-[12.5px] text-zinc-700">Status awal tiket</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold",
                TICKET_STATUS_META.menunggu.pill
              )}
            >
              <span className={cn("size-1.5 rounded-full", TICKET_STATUS_META.menunggu.dot)} aria-hidden="true" />
              Menunggu (Pending)
            </span>
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
            Simpan &amp; Buat Tiket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
