"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Tabel Riwayat Trial (portal mitra, /affiliate/dashboard)
//
// Tabel/daftar klien trial yang pernah dibuatkan link oleh mitra:
//   • Kolom STATUS dengan indikator jelas: Pending (belum diklik), Aktif
//     (masa trial 3 hari berjalan), Terkunci / Expired (masa trial habis).
//   • Aksi per baris:
//       - PENDING / ACTIVE → tombol salin "Pesan WA" (draf undangan trial).
//       - LOCKED           → tombol "Follow-up WA": membuka wa.me dengan
//         draf persuasi aktivasi lisensi + link checkout ?ref= mitra —
//         komisi Rp150.000 tetap tercatat atas nama mitra pembuat.
// Presentational + interaksi lokal SAJA (tanpa fetch) — data dimuat oleh
// TrialGeneratorCard lalu diteruskan lewat props agar satu sumber kebenaran.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Clock3,
  Copy,
  Hourglass,
  Loader2,
  Lock,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  TRIAL_STATUS_META,
  buildCheckoutUrl,
  buildTrialFollowUpWaMessage,
  buildTrialWaMessage,
  buildWaChatLink,
  type OwnerTrialStatus,
} from "@/lib/trial-shared";
import { cn } from "@/lib/utils";

/** Baris trial dari API (ISO string) — mirror OwnerTrialRow di lib server */
export interface TrialRow {
  id: string;
  ownerName: string;
  ownerWhatsapp: string;
  propertyName: string | null;
  status: OwnerTrialStatus;
  partnerRefCode: string;
  createdAt: string;
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  trialUrl: string;
}

/** Salin teks ke clipboard — fallback utk browser/http non-secure lama */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // lanjut ke fallback
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** Tombol salin dengan feedback "Tersalin!" 2 detik (pola ReferralLinkCard) */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(value);
    if (!ok) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <Button
      type="button"
      size="sm"
      onClick={handleCopy}
      className={cn(
        "h-9 shrink-0 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700",
        copied && "bg-emerald-700",
        className,
      )}
      aria-label={`${label} — salin ke clipboard`}
    >
      {copied ? (
        <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
      ) : (
        <Copy className="size-4" strokeWidth={2} aria-hidden="true" />
      )}
      {copied ? "Tersalin!" : label}
    </Button>
  );
}

/** Label tanggal-waktu singkat Indonesia — utk riwayat */
function dateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Ikon per status — memperjelas indikator kolom status */
const STATUS_ICON: Record<OwnerTrialStatus, LucideIcon> = {
  PENDING: Hourglass,
  ACTIVE: Clock3,
  LOCKED: Lock,
};

function StatusBadge({ status }: { status: OwnerTrialStatus }) {
  const meta = TRIAL_STATUS_META[status] ?? TRIAL_STATUS_META.PENDING;
  const Icon = STATUS_ICON[status] ?? Hourglass;
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] font-bold leading-none",
        meta.className,
      )}
    >
      <Icon className="size-3" strokeWidth={2.5} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Logo WhatsApp (glyph brand, 24×24 — simple-icons) utk tombol Follow-up */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.246-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a11.855 11.855 0 0 1-8.213-3.574l-.005-.006c-2.215-2.215-3.436-5.158-3.434-8.286 0-6.46 5.259-11.719 11.72-11.719 3.13 0 6.072 1.219 8.284 3.431 2.212 2.213 3.43 5.155 3.43 8.286 0 6.46-5.26 11.719-11.719 11.719m9.818-21.537A13.89 13.89 0 0 0 12.04 0C5.394 0 .092 5.302.092 11.945c0 2.103.549 4.159 1.593 5.972L0 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.646 0 12.047-5.302 12.047-11.945 0-3.19-1.243-6.19-3.5-8.44z" />
    </svg>
  );
}

/** Sel kolom aksi — Follow-up WA utk LOCKED, salin draf undangan utk lainnya */
function RowAction({ trial }: { trial: TrialRow }) {
  if (trial.status === "LOCKED") {
    const message = buildTrialFollowUpWaMessage({
      ownerName: trial.ownerName,
      propertyName: trial.propertyName,
      checkoutUrl: buildCheckoutUrl(trial.partnerRefCode),
    });
    return (
      <Button
        asChild
        size="sm"
        className="h-8 gap-1.5 bg-emerald-600 px-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
      >
        <a
          href={buildWaChatLink(trial.ownerWhatsapp, message)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Follow-up ${trial.ownerName} via WhatsApp`}
        >
          <WhatsAppIcon className="size-3.5" />
          Follow-up WA
        </a>
      </Button>
    );
  }
  return (
    <CopyButton
      value={buildTrialWaMessage({
        ownerName: trial.ownerName,
        propertyName: trial.propertyName,
        trialUrl: trial.trialUrl,
      })}
      label="Pesan WA"
      className="h-8 px-2.5 text-xs"
    />
  );
}

/**
 * Blok "Riwayat Trial Anda" utuh (heading + tabel + state kosong/muat).
 * Semua data disuplai TrialGeneratorCard — refresh otomatis setelah mitra
 * membuat link baru tetap berjalan tanpa duplikasi logika fetch.
 */
export function TrialHistoryTable({
  loading,
  error,
  trials,
}: {
  loading: boolean;
  error: boolean;
  trials: TrialRow[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
          Riwayat Trial Anda
        </h3>
        {!loading && !error ? (
          <span className="inline-flex shrink-0 items-center rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
            {trials.length} trial
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs leading-snug text-zinc-500">
        Klien berstatus{" "}
        <span className="font-semibold text-rose-700">
          Terkunci / Expired
        </span>{" "}
        siap di-follow-up — tombol WA-nya membuka chat dengan draf penawaran
        lisensi + link checkout referral Anda.
      </p>

      {loading ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Memuat riwayat…
        </p>
      ) : error ? (
        <p className="mt-2 text-xs leading-snug text-amber-700">
          Riwayat trial belum dapat dimuat — muat ulang halaman nanti.
        </p>
      ) : trials.length === 0 ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-snug text-zinc-500">
          <UserRound
            className="mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          Belum ada trial. Buat link pertama Anda di atas lalu kirim ke
          pemilik kost lewat WhatsApp.
        </p>
      ) : (
        <div className="mt-2.5 max-h-96 overflow-x-auto overflow-y-auto pr-1 scrollbar-thin">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-zinc-50">
              <tr className="text-[11px] font-bold uppercase tracking-wide text-zinc-600">
                <th scope="col" className="px-3 py-2.5">Klien</th>
                <th scope="col" className="px-3 py-2.5">WhatsApp</th>
                <th scope="col" className="px-3 py-2.5">Status</th>
                <th scope="col" className="px-3 py-2.5">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((trial) => {
                const isExpired = trial.status === "LOCKED";
                const isActive = trial.status === "ACTIVE";
                const expiresNote =
                  (isActive || isExpired) && trial.trialExpiresAt
                    ? `berakhir ${dateLabel(trial.trialExpiresAt)}`
                    : null;
                return (
                  <tr
                    key={trial.id}
                    className={cn(
                      "border-t border-zinc-100 align-middle text-[13px] text-zinc-800",
                      isExpired && "bg-rose-50/40",
                    )}
                  >
                    <td className="max-w-[220px] px-3 py-3">
                      <span
                        className="block truncate font-bold"
                        title={trial.ownerName}
                      >
                        {trial.ownerName}
                      </span>
                      {trial.propertyName ? (
                        <span
                          className="block truncate text-[11px] text-zinc-500"
                          title={trial.propertyName}
                        >
                          {trial.propertyName}
                        </span>
                      ) : null}
                      <span className="block text-[11px] text-zinc-400">
                        Dibuat {dateLabel(trial.createdAt)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-medium tabular-nums">
                      {trial.ownerWhatsapp}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <StatusBadge status={trial.status} />
                      {expiresNote ? (
                        <span className="mt-1 block text-[11px] text-zinc-500">
                          {expiresNote}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <RowAction trial={trial} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
