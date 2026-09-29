"use client";

import { useRef, useState } from "react";
import { Camera, FolderOpen, ImagePlus, Loader2, Send, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ISSUE_CATEGORIES, type IssueCategory } from "@/lib/tenant-portal";
import { fileToCompressedDataUrl } from "@/lib/image-compress";

export interface IssueDraft {
  kategori: IssueCategory;
  catatan: string;
  /** DataURL foto terkompresi (kamera/galeri) — persist & pratinjau lintas perangkat */
  photos: string[];
}

interface ReportIssueDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Parent membuat tiket (API nyata / lokal) — resolve dengan id tiket, reject bila gagal */
  onSubmit: (draft: IssueDraft) => string | Promise<string>;
  /** Label kamar pelapor — "Kamar 104" (token-driven, dari portal) */
  roomLabel?: string;
}

const MAX_PHOTOS = 3;

const sourceButtonCls =
  "flex h-[68px] flex-1 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-white hover:text-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20";

export function ReportIssueDrawer({ open, onOpenChange, onSubmit, roomLabel }: ReportIssueDrawerProps) {
  const [kategori, setKategori] = useState<IssueCategory | "">("");
  const [catatan, setCatatan] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  /** Ref input kamera (kamera belakang HP) & galeri — dua pintu masuk berbeda */
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).slice(0, room);
    if (picked.length === 0) {
      toast.info(`Maksimal ${MAX_PHOTOS} foto lampiran`);
      return;
    }
    if (picked.length < files.length) {
      toast.info(`Maksimal ${MAX_PHOTOS} foto lampiran`, {
        description: `${files.length - picked.length} foto dilewati.`,
      });
    }
    try {
      const encoded = await Promise.all(picked.map((f) => fileToCompressedDataUrl(f)));
      setPhotos((prev) => [...prev, ...encoded]);
    } catch {
      toast.error("Gagal memproses foto", {
        description: "Coba ambil ulang foto atau pilih berkas lain.",
      });
    }
  };

  const removePhoto = (src: string) => {
    setPhotos((prev) => prev.filter((p) => p !== src));
  };

  const canSubmit = kategori !== "" && catatan.trim().length >= 5 && !submitting;

  const handleSubmit = () => {
    if (!kategori || submitting) return;
    const draft: IssueDraft = { kategori, catatan: catatan.trim(), photos };
    setSubmitting(true);
    Promise.resolve(onSubmit(draft))
      .then(() => {
        setKategori("");
        setCatatan("");
        setPhotos([]);
      })
      .catch(() => {
        /* toast error sudah ditampilkan parent — drawer tetap terbuka utk diulang */
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="pb-1 text-left">
          <DrawerTitle className="text-[15px] font-bold tracking-tight text-zinc-900">
            Lapor Masalah Fasilitas
          </DrawerTitle>
          <DrawerDescription className="text-[12.5px] text-zinc-700">
            Laporan langsung masuk ke dashboard pengelola · {roomLabel ?? "kamar Anda"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 overflow-y-auto px-4 pb-2 scrollbar-thin">
          {/* Kategori */}
          <div className="space-y-1.5">
            <Label htmlFor="issue-kategori" className="text-[12.5px] font-medium text-zinc-700">
              Kategori Masalah
            </Label>
            <Select
              value={kategori}
              onValueChange={(v) => setKategori(v as IssueCategory)}
            >
              <SelectTrigger id="issue-kategori" className="h-10 w-full border-border bg-white text-[13px] shadow-none focus:ring-zinc-900/10">
                <SelectValue placeholder="Pilih kategori…" />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="text-[13px]">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Foto kerusakan — kamera langsung & galeri */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] font-medium text-zinc-700">
              Foto Kerusakan{" "}
              <span className="font-normal text-zinc-700">
                (opsional, maks. {MAX_PHOTOS})
              </span>
            </Label>
            {/* Input kamera — capture=environment membuka kamera belakang di HP */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = "";
              }}
              aria-label="Ambil foto langsung dengan kamera"
            />
            {/* Input galeri — pilih berkas dari penyimpanan */}
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = "";
              }}
              aria-label="Pilih foto dari galeri"
            />
            <div className="flex gap-2">
              {photos.map((src) => (
                <div
                  key={src}
                  className="group relative size-[68px] shrink-0 overflow-hidden rounded-md border border-border"
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
                <>
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className={sourceButtonCls}
                  >
                    <Camera className="size-4" strokeWidth={1.75} />
                    <span className="text-xs font-medium leading-tight">Ambil Foto Langsung</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryRef.current?.click()}
                    className={sourceButtonCls}
                  >
                    <FolderOpen className="size-4" strokeWidth={1.75} />
                    <span className="text-xs font-medium leading-tight">Pilih dari Galeri</span>
                  </button>
                </>
              )}
            </div>
            <p className="flex items-center gap-1 text-xs text-zinc-700">
              <ImagePlus className="size-3" strokeWidth={1.75} aria-hidden="true" />
              Foto terkompresi otomatis — jelas dilihat pengelola &amp; teknisi.
            </p>
          </div>

          {/* Catatan */}
          <div className="space-y-1.5">
            <Label htmlFor="issue-catatan" className="text-[12.5px] font-medium text-zinc-700">
              Catatan Keluhan
            </Label>
            <Textarea
              id="issue-catatan"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Jelaskan masalahnya, mis. 'AC kurang dingin dan menetes sejak semalam…'"
              rows={4}
              className="resize-none border-border bg-white text-[13px] placeholder:text-zinc-600 focus-visible:ring-zinc-900/10"
            />
            <p className="text-xs text-zinc-700">
              Minimal 5 karakter · sertakan lokasi detail bila ada
            </p>
          </div>
        </div>

        <DrawerFooter className="pt-2">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-10 w-full bg-zinc-900 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-700"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" />
            )}
            {submitting ? "Mengirim laporan…" : "Kirim Laporan ke Pengelola"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
