"use client";

import { useRef, useState } from "react";
import { ImagePlus, Send, X } from "lucide-react";
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

export interface IssueDraft {
  kategori: IssueCategory;
  catatan: string;
  /** Object URLs of locally uploaded photos (max 3) */
  photos: string[];
}

interface ReportIssueDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Parent creates the owner-side ticket; returns the new ticket id */
  onSubmit: (draft: IssueDraft) => string;
  /** Label kamar pelapor — "Kamar 104" (token-driven, dari portal) */
  roomLabel?: string;
}

const MAX_PHOTOS = 3;

export function ReportIssueDrawer({ open, onOpenChange, onSubmit, roomLabel }: ReportIssueDrawerProps) {
  const [kategori, setKategori] = useState<IssueCategory | "">("");
  const [catatan, setCatatan] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
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
    setPhotos((prev) => [...prev, ...picked.map((f) => URL.createObjectURL(f))]);
  };

  const removePhoto = (src: string) => {
    URL.revokeObjectURL(src);
    setPhotos((prev) => prev.filter((p) => p !== src));
  };

  const canSubmit = kategori !== "" && catatan.trim().length >= 5;

  const handleSubmit = () => {
    if (!kategori) return;
    onSubmit({ kategori, catatan: catatan.trim(), photos });
    // Blob URLs stay alive — the owner ticket list still renders them
    setKategori("");
    setCatatan("");
    setPhotos([]);
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

          {/* Foto kerusakan */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] font-medium text-zinc-700">
              Foto Kerusakan{" "}
              <span className="font-normal text-zinc-700">
                (opsional, maks. {MAX_PHOTOS})
              </span>
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
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-[68px] flex-1 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-white hover:text-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20"
                >
                  <ImagePlus className="size-4" strokeWidth={1.75} />
                  <span className="text-xs font-medium">Unggah Foto</span>
                </button>
              )}
            </div>
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
            <Send className="size-4" />
            Kirim Laporan ke Pengelola
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
