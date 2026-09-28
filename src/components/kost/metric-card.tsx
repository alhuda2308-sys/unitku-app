import { cn } from "@/lib/utils";

interface MetricCardProps {
  dot: string;
  label: string;
  /** Label singkat khusus layar ponsel (< sm) — fallback: label */
  mobileLabel?: string;
  value: string;
  unit?: string;
  sub: string;
  badge?: string;
  badgeClass?: string;
  valueClass?: string;
}

/** Stat card shared by Tagihan, Komplain, Pengumuman & Buku Kas views.
 *  Mobile (< sm): judul text-xs tanpa terpotong, nominal text-lg (anti tumpah),
 *  subteks text-[11px] leading-tight agar muat penuh. sm+ : skala penuh. */
export function MetricCard({
  dot,
  label,
  mobileLabel,
  value,
  unit,
  sub,
  badge,
  badgeClass,
  valueClass,
}: MetricCardProps) {
  return (
    <div className="rounded-lg border border-border bg-white p-3 sm:p-4">
      <div className="flex items-center gap-1.5">
        <span className={cn("size-1.5 shrink-0 rounded-full", dot)} aria-hidden="true" />
        <span className="min-w-0 text-xs font-medium leading-tight text-zinc-700 sm:truncate sm:text-sm sm:font-bold sm:leading-snug">
          <span className="sm:hidden">{mobileLabel ?? label}</span>
          <span className="hidden sm:inline">{label}</span>
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <span
          className={cn(
            "text-lg font-bold leading-none tracking-tight tabular-nums text-zinc-900 sm:text-2xl sm:font-black lg:text-3xl",
            valueClass
          )}
        >
          {value}
        </span>
        {unit && <span className="text-xs font-bold text-zinc-700 sm:text-sm">{unit}</span>}
        {badge && (
          <span
            className={cn(
              "ml-0.5 inline-flex h-5 items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 text-xs font-semibold tabular-nums text-emerald-700",
              badgeClass
            )}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[11px] font-medium leading-tight text-zinc-700 sm:text-xs sm:leading-snug">{sub}</p>
    </div>
  );
}
