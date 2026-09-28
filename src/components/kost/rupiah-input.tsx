"use client";

import { cn } from "@/lib/utils";

interface RupiahInputProps {
  value: number;
  onChange: (value: number) => void;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const grouping = new Intl.NumberFormat("id-ID");

/** Currency input with fixed "Rp" prefix and id-ID thousand separators. Fully controlled. */
export function RupiahInput({
  value,
  onChange,
  id,
  ariaLabel,
  placeholder = "0",
  className,
  disabled,
}: RupiahInputProps) {
  return (
    <div
      className={cn(
        "flex h-9 items-center rounded-md border border-border bg-white transition-colors focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-zinc-900/5",
        disabled && "opacity-60",
        className
      )}
    >
      <span className="select-none border-r border-border px-2.5 text-[12.5px] font-medium text-zinc-700">
        Rp
      </span>
      <input
        id={id}
        aria-label={ariaLabel}
        inputMode="numeric"
        disabled={disabled}
        value={value ? grouping.format(value) : ""}
        placeholder={placeholder}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
          onChange(digits ? Number(digits) : 0);
        }}
        className="h-full w-full min-w-0 bg-transparent px-2.5 text-[13px] font-medium tabular-nums text-zinc-900 placeholder:font-normal placeholder:text-zinc-600 focus:outline-none"
      />
    </div>
  );
}
