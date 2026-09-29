"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Menu, Palette, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { THEME_KEYS, THEME_META, type ThemeKey } from "@/lib/app-settings";
import type { RoomStatus } from "@/lib/kost-data";
import { FILTER_OPTIONS } from "@/components/kost/topbar";

interface MobileBottomBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  activeStatus: RoomStatus | "all";
  onStatusChange: (s: RoomStatus | "all") => void;
  onCheckIn: () => void;
  /** false = peran tanpa izin check-in (Penjaga) — FAB disembunyikan */
  canCheckIn?: boolean;
  onOpenMobileNav: () => void;
  /** Tema aktif (sinkron TopBar & Pengaturan → Tema & Tampilan) */
  theme: ThemeKey;
  onThemeChange: (t: ThemeKey) => void;
}

/**
 * MobileBottomBar — bilah navigasi bawah tetap (sticky) untuk layar HP (<640px).
 * Menggantikan baris kontrol atas yang disembunyikan pada ponsel: menu drawer,
 * pencarian cepat, tombol utama "+" (aksen menonjol), pengganti tema, dan filter status.
 * Desktop (≥640px) tidak dirender — kontrol atas desktop tetap seperti semula.
 */
export function MobileBottomBar({
  query,
  onQueryChange,
  activeStatus,
  onStatusChange,
  onCheckIn,
  canCheckIn = true,
  onOpenMobileNav,
  theme,
  onThemeChange,
}: MobileBottomBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fokuskan input saat panel pencarian dibuka
  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    }, 60);
    return () => clearTimeout(t);
  }, [searchOpen]);

  // Escape menutup panel pencarian
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen]);

  const activeLabel = FILTER_OPTIONS.find((o) => o.value === activeStatus)?.label ?? "Semua Status";

  return (
    <div className="sm:hidden">
      {/* Panel pencarian cepat — melayang di atas bilah, hasil filter live di belakangnya */}
      {searchOpen && (
        <div
          className="mobile-bottombar-panel fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-1.5 rounded-xl border border-border bg-white p-2 shadow-[0_12px_32px_rgba(15,23,42,0.18)]"
          role="search"
        >
          <Search className="ml-1.5 size-4 shrink-0 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Cari penghuni / no. kamar…"
            aria-label="Cari penghuni atau nomor kamar"
            className="h-10 min-w-0 flex-1 bg-transparent px-1 text-[13px] text-zinc-900 placeholder:text-zinc-600 focus:outline-none"
          />
          {query.trim() !== "" && (
            <button
              type="button"
              onClick={() => {
                onQueryChange("");
                searchRef.current?.focus();
              }}
              aria-label="Bersihkan pencarian"
              className="barbtn flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setSearchOpen(false)}
            aria-label="Tutup pencarian"
            className="barbtn flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            <ChevronDown className="size-5" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Bilah navigasi bawah — tetap di dasar layar, mudah dijangkau jempol */}
      <nav
        aria-label="Navigasi bawah"
        className="mobile-bottombar fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          {/* 1. Drawer menu (navigasi sidebar) */}
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Buka menu navigasi"
            className="barbtn flex size-11 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100 active:bg-zinc-200"
          >
            <Menu className="size-5" strokeWidth={1.75} />
          </button>

          {/* 2. Pencarian cepat */}
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Cari penghuni atau nomor kamar"
            aria-expanded={searchOpen}
            className={cn(
              "barbtn flex size-11 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100 active:bg-zinc-200",
              searchOpen && "bg-zinc-100"
            )}
          >
            <Search className="size-5" strokeWidth={1.75} />
          </button>

          {/* 3. Tombol utama "+" di tengah — aksen menonjol (check-in penghuni / catat transaksi) */}
          {canCheckIn ? (
          <button
            type="button"
            onClick={onCheckIn}
            aria-label="Check-in Penghuni Baru"
            className="flex size-14 -translate-y-4 shrink-0 items-center justify-center rounded-full bg-[var(--ik-accent)] text-[var(--ik-accent-fg)] shadow-[0_10px_24px_rgba(15,23,42,0.28)] transition-transform hover:bg-[var(--ik-accent-hover)] active:scale-95"
          >
            <Plus className="size-6" strokeWidth={2.25} aria-hidden="true" />
          </button>
          ) : (
          <span className="size-14 shrink-0" aria-hidden="true" />
          )}

          {/* 4. Palet tema (Theme Switcher 12 tema) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Ganti tema tampilan"
                title={THEME_META[theme].desc}
                className="barbtn flex size-11 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100 active:bg-zinc-200"
              >
                <Palette className="size-5" strokeWidth={1.75} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="end"
              className="max-h-[min(64vh,480px)] w-64 overflow-y-auto scrollbar-thin"
            >
              <DropdownMenuLabel className="text-xs text-zinc-700">Tema &amp; Tampilan</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {THEME_KEYS.map((key) => {
                const meta = THEME_META[key];
                return (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => onThemeChange(key)}
                    title={meta.desc}
                    className="justify-between text-[13px]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn("size-3 shrink-0 rounded-full ring-1 ring-zinc-950/10", meta.dot)}
                        aria-hidden="true"
                      />
                      <span className="truncate">{meta.label}</span>
                    </span>
                    {theme === key && <Check className="size-3.5" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 5. Filter status */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={activeStatus === "all" ? "Filter status" : `Filter: ${activeLabel}`}
                title={activeStatus === "all" ? "Filter Status" : activeLabel}
                className="barbtn relative flex size-11 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100 active:bg-zinc-200"
              >
                <SlidersHorizontal className="size-5" strokeWidth={1.75} />
                {activeStatus !== "all" && (
                  <span
                    className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[var(--ik-accent)] ring-2 ring-white"
                    aria-hidden="true"
                  />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-44">
              <DropdownMenuLabel className="text-xs text-zinc-700">Status Tagihan</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {FILTER_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => onStatusChange(opt.value)}
                  className="justify-between text-[13px]"
                >
                  {opt.label}
                  {activeStatus === opt.value && <Check className="size-3.5 text-zinc-900" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </div>
  );
}
