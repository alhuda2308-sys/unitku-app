"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Pemilih siklus sewa (durasi pembayaran)
// Dipakai bersama modal "Check-in Penghuni" & "Buat Tagihan Baru".
// 4 opsi: Bulanan (default) · Per 3 Bulan · Per 6 Bulan · Tahunan.
// Grid 2×2 kartu radio — muat di modal 560px maupun mobile 343px.
// ─────────────────────────────────────────────────────────────────────────────

import { CYCLE_OPTIONS, type BillingCycle } from "@/lib/property-types";
import { cn } from "@/lib/utils";

interface CyclePickerProps {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  ariaLabel?: string;
  idPrefix?: string;
}

export function CyclePicker({ value, onChange, ariaLabel = "Siklus pembayaran sewa", idPrefix = "cyc" }: CyclePickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid grid-cols-2 gap-2"
    >
      {CYCLE_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            id={`${idPrefix}-${opt.value}`}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex min-w-0 flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-all",
              active
                ? "border-zinc-900 bg-white ring-1 ring-zinc-900"
                : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
            )}
          >
            <span className="flex w-full min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  "size-3 shrink-0 rounded-full border-[4px] transition-colors",
                  active ? "border-zinc-900 bg-white" : "border-zinc-300 bg-white"
                )}
                aria-hidden="true"
              />
              <span className={cn("min-w-0 truncate text-[12.5px] font-semibold", active ? "text-zinc-900" : "text-zinc-700")}>
                {opt.label}
              </span>
            </span>
            <span className="pl-[18px] text-[10.5px] tabular-nums text-zinc-400">{opt.sub}</span>
          </button>
        );
      })}
    </div>
  );
}
