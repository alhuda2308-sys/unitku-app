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
  /** "lg" = input angka besar (nyaman di layar ponsel) */
  size?: "sm" | "lg";
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
  size = "sm",
}: RupiahInputProps) {
  const lg = size === "lg";
  return (
    <div
      className={cn(
        "flex items-center rounded-md border border-border bg-white transition-colors focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-zinc-900/5",
        lg ? "h-12" : "h-9",
        disabled && "opacity-60",
        className
      )}
    >
      <span
        className={cn(
          "select-none border-r border-border font-medium text-zinc-700",
          lg ? "px-3 text-[13px]" : "px-2.5 text-[12.5px]"
        )}
      >
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
        className={cn(
          "h-full w-full min-w-0 bg-transparent font-medium tabular-nums text-zinc-900 placeholder:font-normal placeholder:text-zinc-600 focus:outline-none",
          lg ? "px-3 text-[16px]" : "px-2.5 text-[13px]"
        )}
      />
    </div>
  );
}
