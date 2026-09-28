"use client";

import { cn } from "@/lib/utils";

export interface SegmentedTabItem<T extends string> {
  value: T;
  label: string;
  count: number;
}

interface SegmentedTabsProps<T extends string> {
  tabs: SegmentedTabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}

/** Linear-style segmented control with live counts (shared by Denah & Tagihan views) */
export function SegmentedTabs<T extends string>({ tabs, value, onChange, ariaLabel }: SegmentedTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-zinc-50 p-0.5 scrollbar-thin"
    >
      {tabs.map((tab) => {
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[6px] px-2.5 text-[12.5px] font-medium transition-all",
              active
                ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-zinc-200"
                : "text-zinc-700 hover:text-zinc-800"
            )}
          >
            {tab.label}
            <span className={cn("text-xs tabular-nums", active ? "text-zinc-700" : "text-zinc-700")}>
              ({tab.count})
            </span>
          </button>
        );
      })}
    </div>
  );
}
