"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Cadangan & Keamanan Data (tab Pengaturan)
//
// Dua opsi ekspor + satu alur pemulihan:
//  A. 📊 Unduh Laporan Rekap (Excel / CSV) — dua tabel: Kamar & Penyewa,
//     Transaksi Keuangan. Delimiter ";" + BOM — rapi di Excel/Sheets/WPS.
//  B. 💾 Unduh Berkas Cadangan Sistem (JSON) — arsip komprehensif Properties,
//     Rooms, Tenants, Invoices, Cashflow untuk pemulihan sistem.
//  C. 📤 Pulihkan Data dari Berkas Cadangan (.json) — validasi struktur dulu,
//     modal konfirmasi keamanan, lalu sinkronisasi ke database via
//     POST /api/backup/restore (transaksi atomik di server).
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from "react";
import {
  FileJson,
  FileSpreadsheet,
  FileUp,
  Loader2,
  ShieldCheck,
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
import { toast } from "@/lib/toast";
import { api } from "@/lib/api-client";
import type { Room } from "@/lib/kost-data";
import type { Invoice } from "@/lib/kost-invoices";
import type { CashEntry } from "@/lib/kost-cashflow";
import {
  BackupValidationError,
  backupFileName,
  buildBackupPayload,
  buildRekapCsv,
  downloadTextFile,
  formatExportedAt,
  rekapFileName,
  validateBackupPayload,
  type BackupPayload,
  type BackupSummary,
} from "@/lib/backup";

const errMsg = (err: unknown): string =>
  err instanceof Error ? err.message : "Terjadi kesalahan tak terduga.";

interface BackupViewProps {
  propertyName: string;
  rooms: Room[];
  invoices: Invoice[];
  cashEntries: CashEntry[];
  /** Setelah pemulihan sukses — sinkronkan ulang data dashboard dari database */
  onRestored: () => void;
}

interface PendingRestore {
  fileName: string;
  payload: BackupPayload;
  summary: BackupSummary;
}

export function BackupView({
  propertyName,
  rooms,
  invoices,
  cashEntries,
  onRestored,
}: BackupViewProps) {
  const [busyExport, setBusyExport] = useState<"csv" | "json" | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [pending, setPending] = useState<PendingRestore | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── A. Ekspor rekap CSV ─────────────────────────────────────────────────────
  const handleExportCsv = () => {
    setBusyExport("csv");
    try {
      const csv = buildRekapCsv({ propertyName, rooms, cashEntries });
      downloadTextFile(rekapFileName(propertyName), csv, "text/csv;charset=utf-8");
      toast.success("Laporan rekap berhasil diunduh!", {
        description: `${rooms.length} kamar & ${cashEntries.length} transaksi kas — buka di Microsoft Excel, Google Sheets, atau WPS Office.`,
      });
    } catch (err) {
      toast.error("Gagal membuat laporan rekap", { description: errMsg(err) });
    } finally {
      setBusyExport(null);
    }
  };

  // ── B. Ekspor cadangan JSON ─────────────────────────────────────────────────
  const handleExportJson = () => {
    setBusyExport("json");
    try {
      const payload = buildBackupPayload({
        propertyName,
        rooms,
        invoices,
        cashEntries,
        propertyAlamat: null,
      });
      downloadTextFile(
        backupFileName(propertyName),
        JSON.stringify(payload, null, 2),
        "application/json",
      );
      toast.success("Berkas cadangan berhasil diunduh!", {
        description: `${payload.counts.rooms} kamar · ${payload.counts.tenants} penyewa · ${payload.counts.invoices} tagihan · ${payload.counts.cash} transaksi — simpan di tempat aman.`,
      });
    } catch (err) {
      toast.error("Gagal membuat berkas cadangan", { description: errMsg(err) });
    } finally {
      setBusyExport(null);
    }
  };

  // ── C. Pulihkan dari berkas ─────────────────────────────────────────────────
  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Berkas terlalu besar", {
        description: "Ukuran berkas cadangan maksimal 8 MB.",
      });
      return;
    }
    try {
      const text = await file.text();
      const parsed = validateBackupPayload(JSON.parse(text));
      // Valid lolos → tampilkan modal konfirmasi keamanan
      setPending({ fileName: file.name, ...parsed });
    } catch (err) {
      if (err instanceof SyntaxError) {
        toast.error("Berkas tidak dapat dibaca", {
          description: "Isi berkas bukan JSON yang benar — pastikan memilih berkas cadangan UnitKu (.json).",
        });
      } else if (err instanceof BackupValidationError) {
        toast.error("Struktur berkas tidak sesuai", { description: err.message });
      } else {
        toast.error("Gagal membaca berkas", { description: errMsg(err) });
      }
    } finally {
      // Reset agar berkas yang sama tetap bisa dipilih ulang
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmRestore = async () => {
    if (!pending || restoring) return;
    setRestoring(true);
    try {
      const res = await api.restoreBackup(pending.payload);
      const r = res.restored;
      toast.success("Data berhasil dipulihkan!", {
        description: `${r.roomsCreated + r.roomsUpdated} kamar, ${r.tenantsAligned} penyewa, ${
          r.invoicesCreated + r.invoicesUpdated
        } tagihan, ${r.cashCreated + r.cashUpdated} transaksi diselaraskan ke database${
          r.roomsSkipped + r.invoicesSkipped + r.cashSkipped > 0
            ? ` · ${r.roomsSkipped + r.invoicesSkipped + r.cashSkipped} data dilewati (bukan milik properti ini)`
            : ""
        }.`,
      });
      setPending(null);
      onRestored();
    } catch (err) {
      toast.error("Pemulihan data gagal", { description: errMsg(err) });
    } finally {
      setRestoring(false);
    }
  };

  const pendingTenants = pending?.summary.tenants ?? 0;

  return (
    <div className="max-w-[720px] space-y-4">
      {/* ── Header kartu utama ─────────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-white">
        <div className="flex items-start gap-2.5 border-b border-border px-4 py-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
            <ShieldCheck className="size-4.5 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[14px] font-bold text-zinc-900">Cadangan &amp; Keamanan Data</h2>
            <p className="mt-0.5 text-[12.5px] leading-5 text-zinc-700">
              Amankan seluruh catatan properti, kamar, penyewa, dan keuangan Anda. Data 100% milik
              Anda dan bisa diunduh kapan saja.
            </p>
          </div>
        </div>
        <p className="px-4 py-2.5 text-xs leading-5 text-zinc-700">
          Properti aktif: <span className="font-semibold text-zinc-900">{propertyName}</span> ·{" "}
          <span className="tabular-nums">{rooms.length} kamar</span> ·{" "}
          <span className="tabular-nums">{invoices.length} tagihan</span> ·{" "}
          <span className="tabular-nums">{cashEntries.length} transaksi kas</span>
        </p>
      </section>

      {/* ── A. Unduh Laporan Rekap (Excel / CSV) ───────────────────────────── */}
      <section className="overflow-hidden rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
              <FileSpreadsheet className="size-4.5 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-[13px] font-bold text-zinc-900">
                Laporan Rekap (Excel / CSV)
              </h3>
              <p className="mt-0.5 max-w-[440px] text-[12.5px] leading-5 text-zinc-700">
                Berkas tabular yang langsung terbaca oleh Microsoft Excel, Google Sheets, atau WPS
                Office — berisi tabel Kamar &amp; Penyewa (nomor, penghuni, WA, nominal, status,
                tempo) dan tabel Transaksi Keuangan.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            disabled={busyExport !== null}
            className="h-8 shrink-0 border-zinc-300 bg-white px-3 text-[12.5px] font-semibold text-zinc-700 shadow-none hover:bg-zinc-100"
            onClick={handleExportCsv}
          >
            {busyExport === "csv" ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : null}
            📊 Unduh Laporan Rekap (Excel / CSV)
          </Button>
        </div>
        <p className="px-4 py-2.5 text-xs tabular-nums text-zinc-700">
          Format berkas: <span className="font-mono">rekap-unitku-[nama-kost]-[tanggal].csv</span>
        </p>
      </section>

      {/* ── B. Unduh Berkas Cadangan Sistem (JSON) ─────────────────────────── */}
      <section className="overflow-hidden rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
              <FileJson className="size-4.5 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-[13px] font-bold text-zinc-900">
                Berkas Cadangan Sistem (JSON)
              </h3>
              <p className="mt-0.5 max-w-[440px] text-[12.5px] leading-5 text-zinc-700">
                Arsip komprehensif seluruh struktur data — properti, kamar, penyewa, tagihan, dan
                buku kas — untuk kebutuhan pemulihan data sistem. Gunakan berkas ini pada menu
                Pulihkan Data di bawah bila perlu memindahkan atau mengembalikan data Anda.
              </p>
            </div>
          </div>
          <Button
            disabled={busyExport !== null}
            className="h-8 shrink-0 bg-[var(--ik-accent)] px-3 text-[12.5px] font-semibold text-[var(--ik-accent-fg)] shadow-none hover:bg-[var(--ik-accent-hover)]"
            onClick={handleExportJson}
          >
            {busyExport === "json" ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : null}
            💾 Unduh Berkas Cadangan Sistem (JSON)
          </Button>
        </div>
        <p className="px-4 py-2.5 text-xs tabular-nums text-zinc-700">
          Format berkas: <span className="font-mono">backup-unitku-[nama-kost]-[tanggal].json</span>
          {" · "}
          lampiran foto transaksi tidak ikut diarsipkan agar berkas tetap ringan.
        </p>
      </section>

      {/* ── C. Pulihkan Data dari Berkas Cadangan ──────────────────────────── */}
      <section className="overflow-hidden rounded-lg border border-amber-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-amber-100 px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
              <FileUp className="size-4.5 text-amber-600" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-[13px] font-bold text-zinc-900">
                Pulihkan Data (Restore)
              </h3>
              <p className="mt-0.5 max-w-[440px] text-[12.5px] leading-5 text-zinc-700">
                Unggah berkas cadangan UnitKu (.json). Struktur berkas divalidasi terlebih dahulu —
                setelah konfirmasi, data lama akan diselaraskan dengan isi cadangan ke database
                Anda. Data milik properti lain tidak pernah tersentuh.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="h-8 shrink-0 border-amber-300 bg-amber-50 px-3 text-[12.5px] font-semibold text-amber-800 shadow-none hover:bg-amber-100"
            onClick={() => fileInputRef.current?.click()}
          >
            📤 Pulihkan Data dari Berkas Cadangan (.json)
          </Button>
        </div>
        <p className="px-4 py-2.5 text-xs leading-5 text-zinc-700">
          Aman diproses: validasi struktur dulu di perangkat Anda, konfirmasi eksplisit, lalu
          penulisan ke database dalam satu transaksi (berhasil penuh atau tidak sama sekali).
        </p>
      </section>

      {/* Input berkas tersembunyi */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label="Pilih berkas cadangan UnitKu (.json)"
        onChange={(e) => void handleFileSelected(e.target.files?.[0])}
      />

      {/* ── Modal konfirmasi keamanan pemulihan ────────────────────────────── */}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && !restoring && setPending(null)}>
        <DialogContent
          className="gap-0 border-amber-200 p-0 ring-1 ring-amber-100 sm:max-w-[480px]"
          aria-describedby={undefined}
        >
          <div className="flex items-start gap-2.5 border-b border-amber-100 bg-amber-50 px-5 py-3.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-600" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-[12.5px] font-semibold leading-5 text-amber-800">
              Apakah Anda yakin ingin memulihkan data dari berkas ini? Data lama akan diselaraskan
              dengan data cadangan yang diunggah.
            </p>
          </div>

          <DialogHeader className="px-5 pt-4">
            <DialogTitle className="text-[15px] font-bold tracking-tight text-zinc-900">
              Pulihkan Data dari Berkas Cadangan
            </DialogTitle>
            <DialogDescription className="sr-only">
              Konfirmasi pemulihan data dari berkas cadangan UnitKu.
            </DialogDescription>
          </DialogHeader>

          {pending && (
            <div className="space-y-3 px-5 py-3">
              <div className="rounded-md border border-border bg-zinc-50 px-3 py-2.5">
                <p className="truncate text-[12.5px] font-semibold text-zinc-900">
                  {pending.fileName}
                </p>
                <p className="mt-0.5 text-xs text-zinc-700">
                  Properti: <span className="font-medium">{pending.summary.propertyName}</span> ·
                  Diekspor: <span className="tabular-nums">{formatExportedAt(pending.summary.exportedAt)}</span>
                </p>
                <ul className="mt-2 space-y-1 text-[12.5px] leading-5 text-zinc-700">
                  <li className="flex items-center gap-1.5">
                    <span className="size-1 rounded-full bg-zinc-400" aria-hidden="true" />
                    <span className="tabular-nums">
                      {pending.summary.rooms} kamar ({pendingTenants} dengan penyewa aktif)
                    </span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="size-1 rounded-full bg-zinc-400" aria-hidden="true" />
                    <span className="tabular-nums">{pending.summary.invoices} riwayat tagihan</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="size-1 rounded-full bg-zinc-400" aria-hidden="true" />
                    <span className="tabular-nums">{pending.summary.cash} transaksi kas</span>
                  </li>
                </ul>
              </div>
              <p className="text-xs leading-5 text-zinc-700">
                Kamar &amp; data yang belum ada akan dibuat, data yang sudah ada diperbarui sesuai
                cadangan. Struktur berkas telah lolos validasi — penulisan dilakukan sekali jalan
                (gagal berarti tidak ada perubahan).
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 border-t border-border bg-zinc-50 px-5 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={restoring}
              className="h-9 border-zinc-200 bg-white px-3.5 text-[13px] font-medium text-zinc-700 shadow-none hover:bg-zinc-100"
              onClick={() => setPending(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={restoring}
              onClick={() => void confirmRestore()}
              className="h-9 bg-[var(--ik-accent)] px-3.5 text-[13px] font-semibold text-[var(--ik-accent-fg)] shadow-none hover:bg-[var(--ik-accent-hover)] disabled:opacity-50"
            >
              {restoring ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
                  Memulihkan…
                </>
              ) : (
                "Ya, Pulihkan Sekarang"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
