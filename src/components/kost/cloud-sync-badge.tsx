"use client";

import { Loader2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  getServerSyncStatusSnapshot,
  getSyncStatusSnapshot,
  subscribeSyncStatus,
  type SyncStatus,
} from "@/lib/sync-status";

interface CloudSyncBadgeProps {
  /** "sidebar" = pil kecil di kaki sidebar (rapi, ikut mode ciut);
   *  "inline"  = baris teks di header halaman (tanpa latar). */
  variant?: "sidebar" | "inline";
  collapsed?: boolean;
  className?: string;
}

/** Teks & warna teks per status. Ikon diganti DOT lingkaran minimalis
 *  (gaya status ping/live): hijau solid + pulse halus, spinner kecil saat
 *  menyinkronkan, merah solid saat offline/gagal. "idle" (belum ada
 *  aktivitas) ditampilkan sebagai menyinkronkan agar tidak pernah bohong. */
const SYNC_META: Record<SyncStatus, { label: string; text: string }> = {
  synced: { label: "Tersinkron ke Cloud", text: "text-zinc-600" },
  syncing: { label: "Menyinkronkan...", text: "text-zinc-600" },
  error: { label: "Belum tersinkron (Offline)", text: "text-rose-600" },
  idle: { label: "Menyinkronkan...", text: "text-zinc-600" },
};

/** Dot status minimalis — satu elemen kecil pembawa warna status:
 *  🟢 emerald solid (pulse halus) · 🔄 spinner kecil amber · 🔴 rose solid. */
function StatusDot({ status }: { status: SyncStatus }) {
  if (status === "syncing" || status === "idle") {
    return (
      <Loader2
        className="size-3 shrink-0 animate-spin text-amber-500"
        strokeWidth={2.25}
        aria-hidden="true"
      />
    );
  }
  if (status === "error") {
    return <span className="size-2 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />;
  }
  return (
    <span
      className="size-2 shrink-0 animate-pulse rounded-full bg-emerald-500"
      aria-hidden="true"
    />
  );
}

/**
 * CloudSyncBadge — indikator status sinkronisasi cloud UnitKu.
 *
 * Sumber kebenaran: store sync-status (semua permintaan API route handler +
 * push pengaturan dilaporkan ke sana). Dot hijau = operasi cloud terakhir
 * sukses (dengan jam sinkron), spinner kecil = ada permintaan berjalan, dot
 * merah = operasi terakhir gagal — ringkas, proporsional, tidak mendominasi.
 */
export function CloudSyncBadge({
  variant = "sidebar",
  collapsed = false,
  className,
}: CloudSyncBadgeProps) {
  const { status, syncedAt } = useSyncExternalStore(
    subscribeSyncStatus,
    getSyncStatusSnapshot,
    getServerSyncStatusSnapshot,
  );
  const meta = SYNC_META[status];

  /** Label lengkap — juga dipakai title/aria agar mode ciut tetap terbaca */
  const fullLabel =
    status === "synced" && syncedAt
      ? `${meta.label} • ${syncedAt}`
      : meta.label;

  if (variant === "inline") {
    return (
      <span
        role="status"
        aria-live="polite"
        aria-label={`Status sinkronisasi cloud: ${fullLabel}`}
        title={
          status === "error"
            ? "Operasi terakhir ke server gagal — periksa koneksi internet, lalu coba simpan ulang."
            : fullLabel
        }
        className={cn(
          "inline-flex items-center gap-2 whitespace-nowrap text-[12.5px] font-medium",
          meta.text,
          className,
        )}
      >
        <StatusDot status={status} />
        <span>
          {meta.label}
          {status === "synced" && syncedAt && (
            <span className="tabular-nums text-zinc-500"> • {syncedAt}</span>
          )}
        </span>
      </span>
    );
  }

  // ── Variant sidebar ────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className={cn("flex justify-center py-0.5", className)}>
        <span
          role="status"
          aria-live="polite"
          aria-label={`Status sinkronisasi cloud: ${fullLabel}`}
          title={fullLabel}
          className="flex size-7 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50"
        >
          <StatusDot status={status} />
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Status sinkronisasi cloud: ${fullLabel}`}
      title={
        status === "error"
          ? "Operasi terakhir ke server gagal — periksa koneksi internet, lalu coba simpan ulang."
          : fullLabel
      }
      className={cn(
        "flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5",
        className,
      )}
    >
      <StatusDot status={status} />
      <span className="min-w-0 truncate text-[11px] font-medium leading-4 text-zinc-600">
        {meta.label}
        {status === "synced" && syncedAt && (
          <span className="tabular-nums text-zinc-500"> • {syncedAt}</span>
        )}
      </span>
    </div>
  );
}
