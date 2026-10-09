"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Theme Switcher store ("Theme Switcher & Status Contrast")
// 5 preset tema (1 default + 4 palet kustom) dipilih dari sidebar / Pengaturan.
// Pilihan tersimpan di localStorage (key: indokost:theme:v1, plain string id)
// sehingga tema bertahan saat halaman di-refresh. Script inline di layout.tsx
// membaca key yang sama SEBELUM paint (anti flash of default theme).
//
// Mekanisme pewarnaan: globals.css mendefinisikan blok [data-theme="…"] yang
// me-remap variabel palet Tailwind v4 (--color-zinc-*, --background, --primary,
// dst.) di <html data-theme>. Semua utility (bg-zinc-900, border-border, …)
// otomatis mengikuti tema tanpa mengubah class komponen.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useSyncExternalStore } from "react";

export type ThemeId = "default" | "ocean" | "forest" | "terracotta" | "nordic";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  tagline: string;
  /** Warna utama solid (tombol primer, brand logo) */
  solid: string;
  solidHover: string;
  /** Kanvas aplikasi */
  canvas: string;
  /** Permukaan kartu */
  card: string;
  /** Border 1px */
  border: string;
  /** Permukaan lembut (chip, hover) */
  soft: string;
  /** Aksen vivid/info tema */
  accent: string;
}

export const THEMES: ThemeMeta[] = [
  {
    id: "default",
    label: "Default Minimalist",
    tagline: "Netral & bersih — tampilan klasik IndoKost.",
    solid: "#18181b",
    solidHover: "#27272a",
    canvas: "#f8fafc",
    card: "#ffffff",
    border: "#e2e8f0",
    soft: "#f1f5f9",
    accent: "#18181b",
  },
  {
    id: "ocean",
    label: "Ocean Blue",
    tagline: "Biru laut tegas — fokus & profesional.",
    solid: "#2373f4",
    solidHover: "#578ef5",
    canvas: "#f2f6fc",
    card: "#ffffff",
    border: "#d9e2f1",
    soft: "#e9f0fb",
    accent: "#65d0f4",
  },
  {
    id: "forest",
    label: "Fresh Forest",
    tagline: "Hijau segar dengan kartu krem hangat.",
    solid: "#2a7c13",
    solidHover: "#3a9019",
    canvas: "#f4f8f0",
    card: "#ffffff",
    border: "#dce6d4",
    soft: "#ecf2e4",
    accent: "#76c457",
  },
  {
    id: "terracotta",
    label: "Warm Terracotta",
    tagline: "Earthy hangat, aksen oranye vibran.",
    solid: "#524646",
    solidHover: "#675a5a",
    canvas: "#fcf2e5",
    card: "#ffffff",
    border: "#eadcc4",
    soft: "#f5edde",
    accent: "#ec5b38",
  },
  {
    id: "nordic",
    label: "Nordic Slate",
    tagline: "Slate dingin yang tenang & modern.",
    solid: "#333446",
    solidHover: "#42445a",
    canvas: "#eaefef",
    card: "#ffffff",
    border: "#d8e0df",
    soft: "#e8eeed",
    accent: "#b8cfce",
  },
];

const STORAGE_KEY = "indokost:theme:v1";
const DEFAULT_THEME: ThemeId = "default";
const VALID_IDS: ThemeId[] = ["default", "ocean", "forest", "terracotta", "nordic"];

function sanitize(value: unknown): ThemeId {
  return typeof value === "string" && (VALID_IDS as string[]).includes(value)
    ? (value as ThemeId)
    : DEFAULT_THEME;
}

// ── In-memory cache over localStorage (stable snapshot identity for React) ──
let cache: ThemeId = DEFAULT_THEME;
let cacheValid = false;

function readStore(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    return sanitize(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

function getSnapshot(): ThemeId {
  if (!cacheValid) {
    cache = readStore();
    cacheValid = true;
  }
  return cache;
}

const getServerSnapshot = (): ThemeId => DEFAULT_THEME;

// ── In-session + cross-tab sync ──────────────────────────────────────────────
const listeners = new Set<() => void>();

function publish(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cacheValid = false;
      applyThemeAttr(getSnapshot());
      publish();
    }
  });
}

/** Sinkronkan atribut data-theme di <html> (dikonsumsi blok CSS di globals.css). */
export function applyThemeAttr(id: ThemeId): void {
  if (typeof document === "undefined") return;
  if (id === DEFAULT_THEME) {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", id);
  }
}

function writeStore(next: ThemeId): void {
  cache = next;
  cacheValid = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // private mode / quota — tema tetap aktif untuk sesi ini
  }
  applyThemeAttr(next);
  publish();
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((id: ThemeId) => {
    writeStore(sanitize(id));
  }, []);

  return {
    theme,
    setTheme,
    themes: THEMES,
    meta: THEMES.find((t) => t.id === theme) ?? THEMES[0]!,
  };
}
