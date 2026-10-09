"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — shared facility picker for "Tambah Kamar Baru" (satu + bulk)
// and "Edit / Kelola Kamar" modals.
// Fixed master options + persisted custom facilities ("+ Fasilitas Lain"
// inline pill input). Custom pills carry a small × to remove them from the
// option list permanently.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { FACILITY_OPTIONS } from "@/lib/kost-data";
import { useCustomFacilities } from "@/hooks/use-custom-facilities";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FacilityPillGridProps {
  /** Currently checked facilities for the room being created/edited */
  value: string[];
  onChange: (next: string[]) => void;
}

function FacilityPill({
  label,
  checked,
  custom,
  onToggle,
  onRemove,
}: {
  label: string;
  checked: boolean;
  custom: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors select-none",
        checked
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-border bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="size-3.5 border-zinc-300 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-zinc-900"
        aria-label={label}
      />
      {label}
      {custom && onRemove && (
        <button
          type="button"
          aria-label={`Hapus fasilitas kustom ${label} dari daftar pilihan`}
          className={cn(
            "-mr-1 flex size-4 cursor-pointer items-center justify-center rounded-full transition-colors",
            checked ? "text-white/60 hover:bg-white/20 hover:text-white" : "text-zinc-300 hover:bg-red-50 hover:text-red-600"
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <X className="size-3" strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
    </label>
  );
}

export function FacilityPillGrid({ value, onChange }: FacilityPillGridProps) {
  const { customFacilities, addCustomFacility, removeCustomFacility } = useCustomFacilities();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    if (!adding) return;
    // Escape must close ONLY the inline input, not the whole dialog.
    // Radix Dialog registers its Escape handler on `document` in CAPTURE phase,
    // which fires before any React bubble handler — so the only layer that can
    // intercept it first is a `window` capture listener (window precedes document).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setAdding(false);
        setDraft("");
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [adding]);

  const lower = (s: string) => s.toLowerCase();

  /** Master options + persisted custom + any selected value not present yet. */
  const options: string[] = [...FACILITY_OPTIONS];
  for (const f of [...customFacilities, ...value]) {
    if (!options.some((o) => lower(o) === lower(f))) options.push(f);
  }

  const toggle = (f: string) =>
    onChange(value.includes(f) ? value.filter((x) => x !== f) : [...value, f]);

  const cancel = () => {
    setAdding(false);
    setDraft("");
  };

  const commit = () => {
    const name = draft.trim();
    if (!name) {
      cancel();
      return;
    }
    // Detect duplicates BEFORE adding (case-insensitive against fixed + custom lists)
    const alreadyListed =
      FACILITY_OPTIONS.some((o) => lower(o) === lower(name)) ||
      customFacilities.some((f) => lower(f) === lower(name));
    const canonical = addCustomFacility(name); // normalizes + dedupes
    if (!value.some((v) => lower(v) === lower(canonical))) {
      onChange([...value, canonical]);
    }
    if (alreadyListed) {
      toast.info(`Fasilitas "${canonical}" sudah ada di daftar.`, {
        description: "Pilihan dipakai apa adanya — tidak ada duplikat dibuat.",
      });
    } else {
      toast.success(`Fasilitas "${canonical}" tersimpan ke daftar master.`, {
        description: "Aktif untuk kamar ini & tersedia pada kamar-kamar berikutnya.",
      });
    }
    cancel();
  };

  const removeCustom = (name: string) => {
    removeCustomFacility(name);
    if (value.some((v) => lower(v) === lower(name))) {
      onChange(value.filter((v) => lower(v) !== lower(name)));
    }
    toast(`Fasilitas "${name}" dihapus dari daftar pilihan.`, {
      description: "Kamar yang sudah tersimpan tetap memuat fasilitas ini.",
    });
  };

  return (
    <div role="group" aria-label="Fasilitas kamar" className="flex flex-wrap items-center gap-1.5">
      {options.map((f) => {
        const isCustom = !FACILITY_OPTIONS.some((o) => o === f);
        return (
          <FacilityPill
            key={f}
            label={f}
            checked={value.includes(f)}
            custom={isCustom}
            onToggle={() => toggle(f)}
            onRemove={isCustom ? () => removeCustom(f) : undefined}
          />
        );
      })}

      {adding ? (
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter commits here; Escape is intercepted by the window-capture
              // listener above (Radix would otherwise dismiss the whole dialog).
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                commit();
              }
            }}
            placeholder="Nama fasilitas (misal: Water Heater, Meja Kerja)..."
            aria-label="Nama fasilitas kustom baru"
            maxLength={40}
            className="h-8 w-[236px] max-w-full rounded-md border border-zinc-300 bg-white px-2.5 text-[12.5px] text-zinc-900 shadow-none outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900/5"
          />
          <button
            type="button"
            aria-label="Simpan fasilitas kustom"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md bg-zinc-900 text-white transition-colors hover:bg-zinc-800"
            onClick={commit}
          >
            <Check className="size-4" strokeWidth={2.25} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Batal menambah fasilitas"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800"
            onClick={cancel}
          >
            <X className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-dashed border-zinc-300 bg-white px-2.5 text-[12px] font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-800"
          onClick={() => setAdding(true)}
        >
          <Plus className="size-3" strokeWidth={2.25} aria-hidden="true" />
          Fasilitas Lain
        </button>
      )}
    </div>
  );
}
