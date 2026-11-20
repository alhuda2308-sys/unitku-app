"use client";

import { useRef, useState } from "react";
import { IdCard, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { fileToCompressedDataUrl } from "@/lib/image-compress";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { type Room } from "@/lib/kost-data";

interface KtpDocumentCardProps {
  room: Room;
  /** Owner memilih foto KTP baru (sudah terkompresi dataURL) — parent yang
   *  menyimpan ke API (PATCH /api/tenants) lalu memperbarui rooms. */
  onUpload?: (room: Room, ktpImage: string) => Promise<void> | void;
  /** Owner menghapus foto KTP — parent mengosongkan tenants.ktpImage
   *  (PATCH ktpImage "" → null di database) lalu memperbarui rooms. */
  onDelete?: (room: Room) => Promise<void> | void;
  /** false = peran read-only (Penjaga) — kartu hanya pratinjau & zoom */
  canManage?: boolean;
  /** Kelas tambahan kartu (mis. margin) */
  className?: string;
}

/**
 * Kartu "Dokumen Identitas (KTP)" — SATU komponen untuk SEMUA tampilan detail
 * penghuni (drawer Detail Penghuni di menu Penghuni & drawer klik kamar di
 * Denah): pratinjau foto (klik untuk zoom), tombol unggah/ganti/hapus foto
 * oleh owner, dan pesan kosong yang mengarahkan ke unggahan manual/Portal
 * Penyewa. Foto tersimpan di tenants.ktpImage dan ikut terlihat penyewa di
 * portal.
 */
export function KtpDocumentCard({ room, onUpload, onDelete, canManage = true, className }: KtpDocumentCardProps) {
  // Zoom KTP — pola foto tiket (maintenance-panel): klik thumbnail → Dialog
  const [zoom, setZoom] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ktpImage = room.tenant?.ktpImage ?? null;

  /** Pilih foto KTP baru → kompres sisi klien → simpan via handler parent */
  const pickKtp = async (file: File | undefined) => {
    if (!file || !room.tenant) return;
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      await onUpload?.(room, dataUrl);
    } catch {
      toast.error("Gagal memproses foto", {
        description: "Coba file JPG/PNG lain atau ambil ulang foto KTP.",
      });
    } finally {
      setBusy(false);
    }
  };

  /** Hapus foto KTP — konfirmasi dulu (window.confirm) agar tak sengaja
   *  tertekan; parent yang mengosongkan tenants.ktpImage via API. */
  const confirmRemove = () => {
    if (!room.tenant || !onDelete) return;
    const ok = window.confirm(
      `Hapus foto KTP ${room.tenant.name}? Kartu kembali kosong dan penyewa perlu mengunggah ulang.`,
    );
    if (!ok) return;
    setBusy(true);
    void (async () => {
      try {
        await onDelete(room);
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <section className={cn("rounded-lg border border-border bg-white", className)}>
      <h3 className="border-b border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
        Dokumen Identitas (KTP)
      </h3>
      <div className="p-4">
        {ktpImage ? (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => setZoom(true)}
              className="block w-full overflow-hidden rounded-md border border-border bg-white transition-shadow hover:shadow-md"
              aria-label="Perbesar foto KTP"
            >
              <img
                src={ktpImage}
                alt={`Foto KTP ${room.tenant?.name ?? "penyewa"}`}
                className="h-44 w-full object-cover"
              />
            </button>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11.5px] leading-4 text-zinc-500">
                Klik foto untuk perbesar.
              </p>
              {canManage && (onUpload || onDelete) && (
                <div className="flex shrink-0 gap-1.5">
                  {onDelete && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={confirmRemove}
                      disabled={busy}
                      className="h-7 border-rose-200 bg-white px-2 text-xs font-medium text-rose-600 shadow-none hover:bg-rose-50 hover:text-rose-700"
                      aria-label="Hapus foto KTP"
                    >
                      <Trash2 className="size-3" strokeWidth={1.75} aria-hidden="true" />
                      {busy ? "Menghapus…" : "Hapus"}
                    </Button>
                  )}
                  {onUpload && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => inputRef.current?.click()}
                      disabled={busy}
                      className="h-7 border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
                    >
                      <ImagePlus className="size-3" strokeWidth={1.75} aria-hidden="true" />
                      {busy ? "Memproses…" : "Ganti Foto"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3">
              <IdCard className="size-5 shrink-0 text-zinc-400" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-[12.5px] leading-snug text-zinc-700">
                Belum ada foto KTP — unggah manual di sini atau minta penyewa
                unggah lewat Portal Penyewa.
              </p>
            </div>
            {canManage && onUpload && (
              <Button
                type="button"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="h-8 w-full border-dashed border-zinc-300 bg-white text-[12.5px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
              >
                <ImagePlus className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                {busy ? "Memproses foto…" : "Unggah Foto KTP"}
              </Button>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void pickKtp(e.target.files?.[0])}
          aria-label="Unggah foto KTP"
        />
      </div>

      {/* Zoom foto KTP — klik thumbnail/kartu KTP → tampil penuh */}
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent
          className="max-w-[92vw] border-border bg-white p-2 sm:max-w-[560px]"
          aria-describedby={undefined}
        >
          <DialogTitle className="px-2 pt-1 text-[13.5px] font-bold tracking-tight text-zinc-900">
            Foto KTP — {room.tenant?.name ?? ""}
          </DialogTitle>
          {ktpImage && (
            <img
              src={ktpImage}
              alt={`Foto KTP ${room.tenant?.name ?? "penyewa"} ukuran penuh`}
              className="max-h-[70vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
