"use client";

import { Cloud, CloudOff } from "lucide-react";
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

/** Meta tampilan per status — ikon, kelas warna, dan label sesuai spec:
 *  🟢 hijau "Tersinkron ke Cloud • jam" · 🔄 berputar "Menyinkronkan..." ·
 *  🔴 merah "Belum tersinkron (Offline)". Status "idle" (belum ada aktivitas)
 *  ditampilkan sebagai menyinkronkan agar tidak pernah berbohong. */
const SYNC_META: Record<
  SyncStatus,
  { Icon: typeof Cloud; spin: boolean; pill: string; text: string; label: string }
> = {
  synced: {
    Icon: Cloud,
    spin: false,
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
    text: "text-emerald-700",
    label: "Tersinkron ke Cloud",
  },
  syncing: {
    Icon: Cloud,
    spin: true,
    pill: "border-amber-200 bg-amber-50 text-amber-700",
    text: "text-amber-600",
    label: "Menyinkronkan...",
  },
  error: {
    Icon: CloudOff,
    spin: false,
    pill: "border-red-200 bg-red-50 text-red-700",
    text: "text-red-600",
    label: "Belum tersinkron (Offline)",
  },
  idle: {
    Icon: Cloud,
    spin: true,
    pill: "border-zinc-200 bg-zinc-50 text-zinc-600",
    text: "text-zinc-600",
    label: "Menyinkronkan...",
  },
};

/**
 * CloudSyncBadge — indikator status sinkronisasi cloud UnitKu.
 *
 * Sumber kebenaran: store sync-status (semua permintaan API route handler +
 * push pengaturan dilaporkan ke sana). Hijau = operasi cloud terakhir sukses
 * (dengan jam sinkron), awan berputar = ada permintaan berjalan, merah =
 * operasi terakhir gagal (offline/DB tak terjangkau) — TANPA mengganggu
 * navigasi: satu baris mungil di kaki sidebar & header halaman.
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
  const { Icon, spin } = meta;

  /** Label lengkap — juga dipakai title/aria agar mode ciut tetap terbaca */
  const fullLabel =
    status === "synced" && syncedAt
      ? `${meta.label} · ${syncedAt}`
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
          "inline-flex items-center gap-1.5 text-[13px] font-medium",
          meta.text,
          className,
        )}
      >
        <Icon
          className={cn("size-3.5 shrink-0", spin && "animate-spin")}
          strokeWidth={2}
          aria-hidden="true"
        />
        <span className="whitespace-nowrap">
          {status === "synced" ? (
            <>
              {meta.label}
              <span className="tabular-nums text-zinc-500"> · {syncedAt}</span>
            </>
          ) : (
            meta.label
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
          className={cn(
            "flex size-7 items-center justify-center rounded-md border",
            meta.pill,
          )}
        >
          <Icon
            className={cn("size-3.5", spin && "animate-spin")}
            strokeWidth={2}
            aria-hidden="true"
          />
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
        "flex items-center gap-1.5 rounded-md border px-2 py-1.5",
        meta.pill,
        className,
      )}
    >
      <Icon
        className={cn("size-3.5 shrink-0", spin && "animate-spin")}
        strokeWidth={2}
        aria-hidden="true"
      />
      <span className="min-w-0 truncate text-[11px] font-medium leading-4">
        {status === "synced" ? (
          <>
            {meta.label}
            <span className="tabular-nums opacity-80"> · {syncedAt}</span>
          </>
        ) : (
          meta.label
        )}
      </span>
    </div>
  );
}
