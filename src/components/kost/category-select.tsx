"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — shared kategori dropdown with self-service custom categories.
// Used by both "Tambah Pemasukan Manual" (kind="income") and
// "Catat Pengeluaran" (kind="expense") modals:
//   • "+ Tambah Kategori Baru..." action pinned after a divider
//   • inline input mode (Enter / check = simpan, X = kembali ke dropdown)
//   • custom rows carry a small trash action (Radix selection suppressed via
//     onPointerDown stopPropagation so the list stays open while deleting)
//   • custom list persisted via useCustomCategories (localStorage master list)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type PointerEvent as ReactPointerEvent } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  normalizeCategoryName,
  useCustomCategories,
  type CategoryKind,
} from "@/hooks/use-custom-categories";

const ADD_VALUE = "__tambah-kategori__";

const CREATE_PLACEHOLDER =
  "Tulis nama kategori kustom (misal: Iuran Sampah & Keamanan, Langganan Wi-Fi)...";

const inputCls =
  "h-9 min-w-0 flex-1 border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-zinc-900/5";

interface CategorySelectProps {
  kind: CategoryKind;
  baseCategories: readonly string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  /** confirm-button accent — matches each modal's submit button (emerald = pemasukan, zinc = pengeluaran) */
  accent?: "emerald" | "zinc";
  id?: string;
}

export function CategorySelect({
  kind,
  baseCategories,
  value,
  onChange,
  placeholder,
  ariaLabel,
  accent = "zinc",
  id,
}: CategorySelectProps) {
  const { customCategories, addCustom, removeCustom } = useCustomCategories(kind);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");

  const allNames = [...baseCategories, ...customCategories];

  const cancelCreate = () => {
    setCreating(false);
    setDraft("");
  };

  const commitCreate = () => {
    const name = normalizeCategoryName(draft);
    if (!name) {
      cancelCreate();
      return;
    }
    const existing = allNames.find((c) => c.toLowerCase() === name.toLowerCase());
    if (existing) {
      // dedupe: pick the canonical master-list entry instead of adding a twin
      onChange(existing);
      toast.info(`Kategori "${existing}" sudah ada`, {
        description: "Dipilih langsung untuk transaksi ini.",
      });
    } else {
      const saved = addCustom(name);
      onChange(saved);
      toast.success(`Kategori "${saved}" tersimpan`, {
        description: "Masuk daftar master kategori & otomatis terpilih.",
      });
    }
    cancelCreate();
  };

  const handleRemove = (name: string) => {
    removeCustom(name);
    if (value === name) onChange("");
    toast(`Kategori "${name}" dihapus`, {
      description: "Hanya dari daftar — transaksi lama tetap tersimpan.",
    });
  };

  // ── Inline create mode: dropdown becomes a compact text-input row ─────────
  if (creating) {
    return (
      <div className="flex items-center gap-1.5" role="group" aria-label="Tambah kategori kustom baru">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitCreate();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancelCreate();
            }
          }}
          placeholder={CREATE_PLACEHOLDER}
          className={inputCls}
          aria-label="Nama kategori kustom"
          maxLength={48}
        />
        <Button
          type="button"
          size="icon"
          onClick={commitCreate}
          disabled={!draft.trim()}
          aria-label="Simpan kategori baru (Enter)"
          className={
            accent === "emerald"
              ? "size-9 shrink-0 bg-emerald-600 text-white shadow-none hover:bg-emerald-700 disabled:opacity-50"
              : "size-9 shrink-0 bg-zinc-900 text-white shadow-none hover:bg-zinc-800 disabled:opacity-50"
          }
        >
          <Check className="size-4" strokeWidth={2} aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={cancelCreate}
          aria-label="Batal — kembali ke pilihan kategori"
          className="size-9 shrink-0 border-zinc-200 bg-white text-zinc-500 shadow-none hover:bg-zinc-50 hover:text-zinc-700"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </div>
    );
  }

  // ── Default dropdown mode ──────────────────────────────────────────────────
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v === ADD_VALUE) setCreating(true);
        else onChange(v);
      }}
    >
      <SelectTrigger
        id={id}
        className="h-9 w-full border-zinc-200 text-[13px] focus:ring-zinc-900/5"
        aria-label={ariaLabel}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {baseCategories.map((c) => (
          <SelectItem key={c} value={c} className="text-[13px]">
            {c}
          </SelectItem>
        ))}

        {customCategories.length > 0 && (
          <SelectGroup>
            <SelectSeparator />
            <SelectLabel className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Kategori Kustom
            </SelectLabel>
            {customCategories.map((c) => (
              <CustomCategoryItem key={c} name={c} onRemove={() => handleRemove(c)} />
            ))}
          </SelectGroup>
        )}

        <SelectSeparator />
        <SelectItem value={ADD_VALUE} className="text-[13px] font-medium text-zinc-600">
          <span className="flex items-center gap-1.5">
            <Plus className="size-3.5 text-zinc-400" strokeWidth={2} aria-hidden="true" />
            Tambah Kategori Baru...
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

/**
 * Custom category row with an inline delete action. The trash span swallows
 * the whole pointer sequence (down + up + click) so Radix never treats it as
 * item selection — the dropdown stays open after deleting. Only the name lives
 * inside ItemText, so the trigger label never shows the trash icon.
 */
function CustomCategoryItem({ name, onRemove }: { name: string; onRemove: () => void }) {
  const swallowPointer = (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <SelectPrimitive.Item
      value={name}
      className="focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-[13px] outline-hidden data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    >
      <SelectPrimitive.ItemText className="min-w-0 truncate">{name}</SelectPrimitive.ItemText>
      <span
        role="button"
        tabIndex={-1}
        aria-label={`Hapus kategori kustom "${name}"`}
        title="Hapus kategori"
        className="ml-auto flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-600"
        onPointerDown={swallowPointer}
        onPointerUp={swallowPointer}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }
        }}
      >
        <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}
