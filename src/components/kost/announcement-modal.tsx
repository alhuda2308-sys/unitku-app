"use client";

import { useState } from "react";
import {
  Building2,
  CalendarRange,
  Copy,
  DoorOpen,
  Layers,
  Megaphone,
  Pencil,
  Send,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { distinctFloors, type Room } from "@/lib/kost-data";
import {
  ANNOUNCEMENT_KATEGORI,
  ANNOUNCEMENT_KATEGORI_META,
  targetLabel,
  waBroadcastText,
  type Announcement,
  type AnnouncementDraft,
  type AnnouncementKategori,
} from "@/lib/announcement-data";

interface AnnouncementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rooms menyediakan opsi lantai (Target Penerima) */
  rooms: Room[];
  propertyName: string;
  /** Tidak null = mode Edit Pengumuman */
  editing: Announcement | null;
  onSave: (draft: AnnouncementDraft, editing: Announcement | null) => void;
  /** Snapshot "hari ini" untuk default periode tayang (ISO) */
  todayISO: string;
}

type TargetValue = "semua" | number;

/**
 * "+ Buat Pengumuman Baru" / Edit — modal lengkap per spec:
 * Judul, Kategori/Urgensi (3 tingkat warna), Target Penerima (semua / per
 * lantai), Isi Pesan, Periode Tayang (mulai–berakhir, otomatis turun dari
 * portal), plus dua tombol aksi: pasang di portal & salin format grup WA.
 */
export function AnnouncementModal({
  open,
  onOpenChange,
  rooms,
  propertyName,
  editing,
  onSave,
  todayISO,
}: AnnouncementModalProps) {
  const [judul, setJudul] = useState(editing?.judul ?? "");
  const [kategori, setKategori] = useState<AnnouncementKategori>(
    editing?.kategori ?? "info"
  );
  const [target, setTarget] = useState<TargetValue>(
    editing ? (editing.targetFloor ?? "semua") : "semua"
  );
  const [isi, setIsi] = useState(editing?.isi ?? "");
  const [mulai, setMulai] = useState(editing?.tanggalMulai ?? todayISO);
  const [berakhir, setBerakhir] = useState(
    editing?.tanggalBerakhir ?? todayISO
  );

  const floors = distinctFloors(rooms);
  const judulValid = judul.trim().length >= 4;
  const isiValid = isi.trim().length >= 10;
  const tanggalValid =
    mulai.length > 0 && berakhir.length > 0 && berakhir >= mulai;
  const valid = judulValid && isiValid && tanggalValid;

  const draft = (): AnnouncementDraft => ({
    judul: judul.trim(),
    kategori,
    targetFloor: target === "semua" ? null : Number(target),
    isi: isi.trim(),
    tanggalMulai: mulai,
    tanggalBerakhir: berakhir,
  });

  const handleSubmit = () => {
    if (!valid) return;
    onSave(draft(), editing);
    onOpenChange(false);
  };

  /** Susun teks rapi header *[PENGUMUMAN KOST]* dari kondisi form saat ini */
  const copyWaFormat = async () => {
    if (!judulValid || !isiValid) {
      toast.error("Lengkapi judul & isi pesan", {
        description: "Format WhatsApp disusun dari judul, isi, dan periode tayang.",
      });
      return;
    }
    const text = waBroadcastText(draft(), propertyName);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Format WhatsApp disalin", {
        description: `Header [PENGUMUMAN KOST] + isi — siap paste ke grup WA ${targetLabel(
          target === "semua" ? null : Number(target)
        )}.`,
      });
    } catch {
      toast.error("Gagal menyalin", {
        description: "Clipboard tidak tersedia di browser ini.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Ponsel: w calc(100%-2rem) = margin 16px tiap sisi (anti bocor/terpotong ke samping),
          wrapper overflow-hidden + body scroll sendiri (header & footer terkunci) —
          pola flex kolom yang sama dengan modal Check-in. box-sizing border-box via preflight. */}
      <DialogContent className="flex max-h-[85vh] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 overflow-hidden bg-white p-0 shadow-2xl supports-[height:100dvh]:max-h-[85dvh] sm:max-w-[560px]">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-900">
            {editing ? (
              <Pencil className="size-4 text-zinc-700" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Megaphone className="size-4 text-zinc-700" strokeWidth={2} aria-hidden="true" />
            )}
            {editing ? "Edit Pengumuman" : "Buat Pengumuman Baru"}
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-zinc-700">
            {editing
              ? "Perubahan langsung tampil di Portal Penyewa selama masa tayang berjalan."
              : "Pengumuman tayang di Portal Penyewa sesuai periode — otomatis hilang saat masa tayang habis."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-zinc-50 p-5 scrollbar-thin">
          {/* ── 1. Judul pengumuman ───────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="pgm-judul" className="text-[12.5px] font-medium text-zinc-700">
              Judul Pengumuman
            </Label>
            <Input
              id="pgm-judul"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder="cth. Jadwal Pengurasan Toren Air & Mati Lampu Sementara"
              className="h-9 border-zinc-200 bg-white text-[13px] shadow-none focus:ring-zinc-900/10"
            />
            {!judulValid && judul.length > 0 && (
              <p className="text-xs text-amber-600">
                Judul minimal 4 karakter.
              </p>
            )}
          </div>

          {/* ── 2. Kategori / urgensi ─────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] font-medium text-zinc-700">
              Kategori / Urgensi
            </Label>
            <div
              role="radiogroup"
              aria-label="Kategori atau urgensi pengumuman"
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              {ANNOUNCEMENT_KATEGORI.map((k) => {
                const meta = ANNOUNCEMENT_KATEGORI_META[k];
                const active = kategori === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setKategori(k)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20",
                      active
                        ? "border-zinc-900 bg-white ring-1 ring-zinc-900"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    )}
                  >
                    <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} aria-hidden="true" />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block truncate text-[12.5px] font-semibold",
                          active ? "text-zinc-900" : "text-zinc-600"
                        )}
                      >
                        {k === "info" ? "Info Rutin" : k === "penting" ? "Penting" : "Darurat / Urgent"}
                      </span>
                      <span className="block text-xs leading-snug text-zinc-700">
                        {k === "info" ? "Netral" : k === "penting" ? "Kuning" : "Merah"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 3. Target penerima ────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] font-medium text-zinc-700">
              Target Penerima
            </Label>
            <div
              role="radiogroup"
              aria-label="Target penerima pengumuman"
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              <button
                type="button"
                role="radio"
                aria-checked={target === "semua"}
                onClick={() => setTarget("semua")}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20",
                  target === "semua"
                    ? "border-zinc-900 bg-white ring-1 ring-zinc-900"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                )}
              >
                {target === "semua" ? (
                  <DoorOpen className="size-4 shrink-0 text-zinc-900" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <DoorOpen className="size-4 shrink-0 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
                )}
                <span>
                  <span className="block text-[12.5px] font-semibold text-zinc-900">
                    Semua Kamar
                  </span>
                  <span className="block text-xs leading-snug text-zinc-700">
                    Seluruh penghuni
                  </span>
                </span>
              </button>

              {floors.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={target === f}
                  onClick={() => setTarget(f)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20",
                    target === f
                      ? "border-zinc-900 bg-white ring-1 ring-zinc-900"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  )}
                >
                  <Layers
                    className={cn(
                      "size-4 shrink-0",
                      target === f ? "text-zinc-900" : "text-zinc-700"
                    )}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span>
                    <span className="block text-[12.5px] font-semibold text-zinc-900">
                      Khusus Lantai {f}
                    </span>
                    <span className="block text-xs leading-snug text-zinc-700">
                      {rooms.filter((r) => r.floor === f).length} kamar
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <p className="flex items-center gap-1 text-xs text-zinc-700">
              <Building2 className="size-3" strokeWidth={1.75} aria-hidden="true" />
              Banner hanya tampil di portal kamar pada lantai yang dituju.
            </p>
          </div>

          {/* ── 4. Isi pesan ──────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="pgm-isi" className="text-[12.5px] font-medium text-zinc-700">
              Isi Pesan
            </Label>
            <Textarea
              id="pgm-isi"
              value={isi}
              onChange={(e) => setIsi(e.target.value)}
              rows={5}
              placeholder="Tulis isi pengumuman — jelaskan jadwal, alasan, dan instruksi khusus untuk penghuni…"
              className="border-zinc-200 bg-white text-[13px] leading-relaxed shadow-none focus:ring-zinc-900/10"
            />
            {!isiValid && isi.length > 0 && (
              <p className="text-xs text-amber-600">
                Isi pesan minimal 10 karakter.
              </p>
            )}
          </div>

          {/* ── 5. Periode tayang ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-700">
              <CalendarRange className="size-3.5 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
              Periode Tayang
            </Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="pgm-mulai" className="mb-1 block text-xs text-zinc-700">
                  Tanggal Mulai
                </Label>
                <Input
                  id="pgm-mulai"
                  type="date"
                  value={mulai}
                  onChange={(e) => setMulai(e.target.value)}
                  className="h-9 border-zinc-200 bg-white text-[13px] shadow-none focus:ring-zinc-900/10"
                />
              </div>
              <div>
                <Label htmlFor="pgm-berakhir" className="mb-1 block text-xs text-zinc-700">
                  Tanggal Berakhir
                </Label>
                <Input
                  id="pgm-berakhir"
                  type="date"
                  value={berakhir}
                  min={mulai || undefined}
                  onChange={(e) => setBerakhir(e.target.value)}
                  className="h-9 border-zinc-200 bg-white text-[13px] shadow-none focus:ring-zinc-900/10"
                />
              </div>
            </div>
            {!tanggalValid && (
              <p className="text-xs text-amber-600">
                Tanggal berakhir tidak boleh sebelum tanggal mulai.
              </p>
            )}
            <p className="text-xs leading-4 text-zinc-700">
              Pengumuman otomatis hilang dari portal setelah tanggal berakhir.
            </p>
          </div>
        </div>

        {/* ── Footer: 2 tombol aksi per spec ──────────────────────────────── */}
        <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-white p-4 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            onClick={copyWaFormat}
            className="h-9 gap-1.5 border-zinc-200 bg-white px-3 text-[12.5px] font-semibold text-zinc-700 shadow-none hover:bg-zinc-50"
          >
            <Copy className="size-3.5 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
            Salin Format Chat Grup WhatsApp
          </Button>
          <div className="flex flex-1 items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-700 shadow-none hover:bg-zinc-100"
            >
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!valid}
              className="h-9 gap-1.5 bg-zinc-900 px-3 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800 disabled:opacity-50"
            >
              <Send className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              {editing ? "Simpan Perubahan" : "Simpan & Pasang di Portal Penyewa"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
