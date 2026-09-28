"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface MobileFilterSelectProps<T extends string> {
  value: T;
  onValueChange: (v: T) => void;
  options: FilterOption<T>[];
  /** Label aksesibilitas & placeholder */
  ariaLabel: string;
  className?: string;
}

/** Dropdown filter ringkas pengganti deretan tab horizontal di layar ponsel (< sm).
 *  Desktop tetap memakai tab asli — wrapper ini otomatis tersembunyi di sm+. */
export function MobileFilterSelect<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
}: MobileFilterSelectProps<T>) {
  return (
    <div className={cn("w-full sm:hidden", className)}>
      <Select value={value} onValueChange={(v) => onValueChange(v as T)}>
        <SelectTrigger
          aria-label={ariaLabel}
          className="h-10 w-full justify-between border-zinc-200 bg-zinc-50 text-[13px] font-medium text-zinc-800 shadow-none hover:bg-zinc-100 focus-visible:ring-zinc-900/10 data-[placeholder]:text-zinc-600"
        >
          <SelectValue placeholder={ariaLabel} />
        </SelectTrigger>
        <SelectContent
          position="popper"
          className="max-h-[min(60vh,320px)] w-[var(--radix-select-trigger-width)]"
        >
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-[13px]">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
