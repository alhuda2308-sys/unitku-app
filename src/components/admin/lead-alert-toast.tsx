"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Toast melayang "Pendaftar Baru Masuk" (sonner custom, kaya aksi)
//
// Tampil di dashboard & panel admin begitu lead baru terdeteksi realtime:
//   🔔 Pendaftar Baru Masuk: {name} ({phone})
//   [Chat WhatsApp] — wa.me/{phone}, tab baru, follow-up satu tap
//   [Buka Admin]    — lompat ke Panel Super Admin (/admin)
// Muncul 12 detik, bisa ditutup manual, tidak memblokir interaksi apa pun.
// ─────────────────────────────────────────────────────────────────────────────

import { BellRing, MessageCircle, ShieldCheck, X } from "lucide-react";

import type { LeadAlertInfo } from "@/lib/leads-alert-store";
import { toast } from "@/lib/toast";

const SOURCE_LABEL: Record<string, string> = {
  REGISTER: "Daftar akun baru",
  BAYAR_OTOMATIS: "Pembelian lisensi otomatis",
  PESAN_MANUAL: "Pemesanan manual via WhatsApp",
};

function LeadAlertToastContent({
  info,
  onDismiss,
}: {
  info: LeadAlertInfo;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-[min(92vw,340px)] rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.22)]"
    >
      <div className="flex items-start gap-2.5">
        <span className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
          <BellRing className="size-4" strokeWidth={1.75} aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-red-500 ring-2 ring-white"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold leading-snug text-zinc-900">
            Pendaftar Baru Masuk
          </p>
          <p className="mt-0.5 truncate text-[13px] leading-snug text-zinc-700">
            {info.name}{" "}
            <span className="font-medium text-zinc-500">({info.phone})</span>
          </p>
          {info.source && (
            <p className="mt-0.5 text-[12px] leading-snug text-zinc-500">
              {SOURCE_LABEL[info.source] ?? info.source}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup notifikasi pendaftar baru"
          className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
        >
          <X className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <a
          href={`https://wa.me/${info.phone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          <MessageCircle className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          Chat WhatsApp
        </a>
        <a
          href="/admin"
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-[12.5px] font-semibold text-zinc-800 transition-colors hover:bg-zinc-50"
        >
          <ShieldCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          Buka Admin
        </a>
      </div>
    </div>
  );
}

/** Tampilkan toast lead baru (dipanggil use-leads-alerts saat deteksi INSERT) */
export function showLeadAlertToast(info: LeadAlertInfo): void {
  toast.custom(
    (id: string | number) => (
      <LeadAlertToastContent info={info} onDismiss={() => toast.dismiss(id)} />
    ),
    { duration: 12_000 },
  );
}
