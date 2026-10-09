"use client";

import { Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/lib/theme-store";
import { cn } from "@/lib/utils";

/** Klaster swatch mini: solid · canvas · aksen — identitas visual tiap tema */
function ThemeSwatches({
  solid,
  canvas,
  accent,
  active,
}: {
  solid: string;
  canvas: string;
  accent: string;
  active: boolean;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 overflow-hidden rounded border",
        active ? "border-zinc-400" : "border-zinc-200"
      )}
      aria-hidden="true"
    >
      <span className="size-4" style={{ background: solid }} />
      <span className="size-4" style={{ background: canvas }} />
      <span className="size-4" style={{ background: accent }} />
    </span>
  );
}

/**
 * Tombol ringkas pemilih tema di footer sidebar (ikon palet / swatch).
// Tersedia untuk semua peran — preferensi perangkat, tersimpan di localStorage.
 */
export function ThemeMenu({ collapsed }: { collapsed: boolean }) {
  const { theme, setTheme, themes, meta } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          title={collapsed ? `Tema: ${meta.label}` : undefined}
          className={cn(
            "h-8 w-full justify-start gap-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800",
            collapsed && "justify-center"
          )}
          aria-label={`Tema tampilan: ${meta.label} — ganti tema`}
        >
          <Palette className="size-[18px] shrink-0" strokeWidth={1.75} />
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate text-left text-[12.5px]">
              Tema: <span className="font-semibold text-zinc-700">{meta.label}</span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-64">
        <DropdownMenuLabel className="text-xs font-semibold text-zinc-700">
          Tema Tampilan
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themes.map((t) => {
          const active = t.id === theme;
          return (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setTheme(t.id)}
              className="justify-between gap-2 text-[13px]"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <ThemeSwatches solid={t.solid} canvas={t.canvas} accent={t.accent} active={active} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-zinc-800">{t.label}</span>
                  <span className="block truncate text-[11px] text-zinc-500">{t.tagline}</span>
                </span>
              </span>
              {active && <Check className="size-3.5 shrink-0 text-zinc-900" strokeWidth={2.25} aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10.5px] font-normal leading-4 text-zinc-400">
          Pilihan tersimpan otomatis di perangkat ini (localStorage).
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
