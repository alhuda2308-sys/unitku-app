"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Download, ExternalLink, KeyRound, Printer, QrCode } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { portalLink, portalLocalPath } from "@/lib/tenant-portal";
import { cn } from "@/lib/utils";
import { roomNomor, type Room } from "@/lib/kost-data";

interface PortalAccessCardProps {
  room: Room;
  propertyName: string;
  className?: string;
}

/**
 * "Akses Portal Penyewa" — section magic token link & QR.
 * Dipakai di panel detail kamar (Denah) dan slide-over penghuni (Data Penghuni).
 * Token dibuat otomatis saat check-in & stabil meski nomor kamar di-rename.
 */
export function PortalAccessCard({ room, propertyName, className }: PortalAccessCardProps) {
  const [qrOpen, setQrOpen] = useState(false);
  const qrBoxRef = useRef<HTMLDivElement>(null);

  // Origin dinamis: tautan & QR mengikuti domain aktif (bukan hardcode vendor).
  // Aman dibaca langsung — komponen ini hanya di-mount di klien (dalam modal/sheet).
  const [origin] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.location.origin,
  );

  const tenant = room.tenant;
  const token = tenant?.portalToken ?? "";
  const link = portalLink(token, origin ?? undefined);

  // Kamar kosong tidak memiliki token — section disembunyikan
  if (!tenant || !token) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Tautan portal disalin", {
        description: `Kamar ${roomNomor(room)} — bagikan ke ${tenant.name} via WA atau tempel di kontrak sewa.`,
      });
    } catch {
      toast.error("Gagal menyalin", { description: "Salin manual dari kotak tautan." });
    }
  };

  const downloadQr = () => {
    const canvas = qrBoxRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `portal-qr-kamar-${roomNomor(room).toLowerCase().replace(/[^a-z0-9]/g, "-")}.png`;
    a.click();
    toast.success("QR portal diunduh", {
      description: `Kamar ${roomNomor(room)} — siap dicetak & ditempel di pintu kamar.`,
    });
  };

  /** Cetak QR sebagai stiker pintu (jendela print terpisah, QR saja) */
  const printQr = () => {
    const canvas = qrBoxRef.current?.querySelector("canvas");
    if (!canvas) return;
    const png = canvas.toDataURL("image/png");
    const w = window.open("", "_blank", "width=420,height=620");
    if (!w) {
      toast.error("Pop-up diblokir browser", {
        description: "Gunakan 'Unduh QR' lalu cetak file PNG secara manual.",
      });
      return;
    }
    w.document.write(
      `<!doctype html><html><head><title>QR Portal — Kamar ${roomNomor(room)}</title></head>` +
        `<body style="font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;` +
        `align-items:center;gap:14px;padding:36px 24px;text-align:center">` +
        `<p style="margin:0;font-size:12px;letter-spacing:.1em;font-weight:700;color:#71717A">${propertyName.toUpperCase()}</p>` +
        `<p style="margin:0;font-size:22px;font-weight:800;color:#0F172A">Kamar ${roomNomor(room)} — ${tenant.name}</p>` +
        `<img src="${png}" width="300" height="300" alt="QR Portal Penyewa" style="border:1px solid #E2E8F0;border-radius:12px;padding:10px"/>` +
        `<p style="margin:0;font-size:13px;color:#3F3F46">Scan untuk membuka tagihan &amp; pembayaran via UnitKu</p>` +
        `<p style="margin:0;font-size:10.5px;color:#A1A1AA;font-family:ui-monospace,monospace;word-break:break-all">${link}</p>` +
        `</body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <section className={cn("rounded-lg border border-border bg-white", className)}>
      <h3 className="border-b border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
        Akses Portal Penyewa
      </h3>
      <div className="p-4">
        {/* Token akses */}
        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 text-[12.5px] text-zinc-700">Token Akses</span>
          <span className="inline-flex h-6 min-w-0 items-center gap-1.5 rounded-md border border-border bg-zinc-50 px-2 font-mono text-xs font-semibold tabular-nums text-zinc-700">
            <KeyRound className="size-3 shrink-0 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
            <span className="truncate">{token}</span>
          </span>
        </div>

        {/* Tautan siap salin */}
        <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-zinc-50 px-3 py-2.5">
          <p className="min-w-0 flex-1 break-all font-mono text-xs leading-4 text-zinc-600">
            {link}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={copyLink}
            className="h-7 shrink-0 gap-1 border-zinc-200 bg-white px-2 text-[12.5px] font-semibold text-zinc-700 shadow-none hover:bg-zinc-100"
          >
            <Copy className="size-3" strokeWidth={2} aria-hidden="true" />
            Salin Tautan
          </Button>
        </div>

        {/* Aksi — 2 kolom seimbang, label ringkas agar tak bertabrakan di HP */}
        <div className="mt-3 grid w-full grid-cols-2 gap-2">
          <Button
            asChild
            variant="outline"
            className="h-auto rounded-xl border-zinc-300 px-3 py-2.5 text-sm font-medium text-zinc-700 shadow-none hover:bg-zinc-50 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-200 dark:hover:bg-zinc-800/40"
          >
            <a href={portalLocalPath(token)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              Buka Portal
            </a>
          </Button>
          <Button
            onClick={() => setQrOpen(true)}
            className="h-auto gap-1.5 rounded-xl bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white shadow-none hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <QrCode className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            QR Code
          </Button>
        </div>

        <p className="mt-3 text-xs leading-4 text-zinc-700">
          Penyewa membuka tagihan &amp; pembayaran tanpa login — QR siap dicetak &amp; ditempel di
          pintu kamar.
        </p>
      </div>

      {/* ── Modal QR (stiker pintu) ──────────────────────────────────────── */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">QR Portal Penyewa</DialogTitle>
            <DialogDescription className="text-[12.5px]">
              Kamar {roomNomor(room)} — {tenant.name} · {propertyName}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-zinc-50 p-5">
            <div
              ref={qrBoxRef}
              className="rounded-lg border border-border bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
            >
              <QRCodeCanvas
                value={link}
                size={180}
                marginSize={2}
                level="M"
                bgColor="#FFFFFF"
                fgColor="#0F172A"
                title={`Portal Penyewa — Kamar ${roomNomor(room)}`}
                className="block"
              />
            </div>
            <div className="text-center">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-700">
                {propertyName}
              </p>
              <p className="mt-0.5 text-[13.5px] font-bold tracking-tight text-zinc-900">
                Kamar {roomNomor(room)} — {tenant.name}
              </p>
              <p className="mt-1 text-[12.5px] text-zinc-700">
                Scan untuk membuka tagihan &amp; pembayaran
              </p>
            </div>
            <p className="max-w-full break-all text-center font-mono text-xs leading-4 text-zinc-700">
              {link}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={downloadQr}
              className="h-9 border-zinc-200 bg-white text-[12.5px] font-semibold text-zinc-700 shadow-none hover:bg-zinc-50"
            >
              <Download className="size-3.5 text-zinc-700" strokeWidth={1.75} />
              Unduh QR
            </Button>
            <Button
              onClick={printQr}
              className="h-9 bg-zinc-900 text-[12.5px] font-semibold text-white shadow-none hover:bg-zinc-800"
            >
              <Printer className="size-3.5" strokeWidth={1.75} />
              Cetak QR
            </Button>
          </div>

          <p className="text-center text-xs leading-4 text-zinc-700">
            Tempel QR di pintu kamar — tautan tetap aktif selama penyewa terdaftar, tanpa login.
          </p>
        </DialogContent>
      </Dialog>
    </section>
  );
}
