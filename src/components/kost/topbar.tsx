"use client";

import { useEffect, useRef } from "react";
import { Check, ChevronDown, ChevronRight, Menu, Palette, Plus, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { STATUS_META, type RoomStatus } from "@/lib/kost-data";
import { THEME_KEYS, THEME_META, type ThemeKey } from "@/lib/app-settings";

interface TopBarProps {
  property: string;
  current: string;
  query: string;
  onQueryChange: (q: string) => void;
  activeStatus: RoomStatus | "all";
  onStatusChange: (s: RoomStatus | "all") => void;
  onCheckIn: () => void;
  /** false = peran tanpa izin check-in (Penjaga) — tombol disembunyikan */
  canCheckIn?: boolean;
  onOpenMobileNav: () => void;
  /** Tema aktif (sinkron Pengaturan → Tema & Tampilan) */
  theme: ThemeKey;
  onThemeChange: (t: ThemeKey) => void;
  /** Refresh manual data cloud — undefined = sembunyikan (mode demo) */
  onRefresh?: () => void;
  /** true selama re-fetch berlangsung — ikon berputar & tombol disabled */
  refreshing?: boolean;
}

/** Opsi filter status tagihan — dipakai TopBar (desktop) & MobileBottomBar (ponsel) */
export const FILTER_OPTIONS: { value: RoomStatus | "all"; label: string }[] = [
  { value: "all", label: "Semua Status" },
  { value: "lunas", label: STATUS_META.lunas.tabLabel },
  { value: "jatuhTempo", label: STATUS_META.jatuhTempo.tabLabel },
  { value: "menunggak", label: STATUS_META.menunggak.tabLabel },
  { value: "kosong", label: STATUS_META.kosong.tabLabel },
];

export function TopBar({
  property,
  current,
  query,
  onQueryChange,
  activeStatus,
  onStatusChange,
  onCheckIn,
  canCheckIn = true,
  onOpenMobileNav,
  theme,
  onThemeChange,
  onRefresh,
  refreshing = false,
}: TopBarProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses quick search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const activeLabel = FILTER_OPTIONS.find((o) => o.value === activeStatus)?.label ?? "Semua Status";

  return (
    <header className="hidden h-14 shrink-0 items-center gap-3 border-b border-border bg-white px-3 sm:flex lg:px-6">
      {/* Mobile nav trigger */}
      <Button
        variant="ghost"
        size="icon"
        className="size-9 lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Buka menu navigasi"
      >
        <Menu className="size-[18px]" strokeWidth={1.75} />
      </Button>

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-[13px] sm:flex">
        <span className="truncate text-zinc-700">{property}</span>
        <ChevronRight className="size-3.5 shrink-0 text-zinc-300" aria-hidden="true" />
        <span className="truncate font-semibold text-zinc-900">{current}</span>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {/* Refresh manual data cloud — tarik ulang semua dataset dari Supabase
            tanpa reload tab; ikon berputar & disabled selama proses fetch. */}
        {onRefresh && (
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Segarkan Data Cloud"
            title="Segarkan Data Cloud"
            className="size-9 border-zinc-200 bg-white p-0 text-zinc-700 shadow-none hover:bg-zinc-50"
          >
            <RefreshCw
              className={cn("size-3.5", refreshing && "animate-spin")}
              strokeWidth={1.75}
            />
          </Button>
        )}

        {/* Theme switcher cepat — sinkron dengan Pengaturan → Tema & Tampilan */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              aria-label="Ganti tema tampilan"
              title={THEME_META[theme].desc}
              className="h-9 border-zinc-200 bg-white px-2.5 text-[13px] text-zinc-700 shadow-none hover:bg-zinc-50"
            >
              <Palette className="size-3.5 text-zinc-700" strokeWidth={1.75} />
              <span className="hidden max-w-[210px] truncate xl:inline">{THEME_META[theme].label}</span>
              <ChevronDown className="size-3.5 text-zinc-700" strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
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

        {/* Quick search — ponsel: flex-1 memenuhi sisa lebar bar (tanpa ⌘K) */}
        <div className="relative min-w-0 w-full max-w-[220px] flex-1 sm:max-w-[260px] sm:flex-initial">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-700"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Cari penghuni / no. kamar…"
            aria-label="Cari penghuni atau nomor kamar"
            className="h-9 w-full rounded-md border border-border bg-zinc-50 pl-8 pr-3 text-[13px] text-zinc-900 placeholder:text-zinc-600 focus:border-zinc-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/5 sm:pr-10"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-white px-1 py-px font-sans text-xs font-medium text-zinc-700 sm:block">
            ⌘K
          </kbd>
        </div>

        {/* Filter status dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 border-zinc-200 bg-white px-2.5 text-[13px] text-zinc-700 shadow-none hover:bg-zinc-50 sm:px-3">
              <SlidersHorizontal className="size-3.5 text-zinc-700" strokeWidth={1.75} />
              <span className="hidden md:inline">{activeStatus === "all" ? "Filter Status" : activeLabel}</span>
              <ChevronDown className="size-3.5 text-zinc-700" strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
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

        {/* Primary action */}
        {canCheckIn && (
        <Button
          onClick={onCheckIn}
          aria-label="Check-in Penghuni Baru"
          className="h-9 bg-[var(--ik-accent)] px-2.5 text-[13px] font-semibold text-[var(--ik-accent-fg)] shadow-none hover:bg-[var(--ik-accent-hover)] sm:px-3"
        >
          <Plus className="size-4" strokeWidth={2} />
          <span className="hidden sm:inline">Check-in Penghuni</span>
        </Button>
        )}
      </div>
    </header>
  );
}
