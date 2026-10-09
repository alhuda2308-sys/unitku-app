"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — master daftar fasilitas kustom properti (modal kamar)
// Custom facilities created from "+ Fasilitas Lain" (room add/manage modals)
// persist in localStorage so they always appear as checkbox options for the
// next rooms. Backed by useSyncExternalStore: an in-memory cache keeps snapshot
// identity stable and an in-session pub/sub keeps every mounted modal instance
// in sync without waiting for a storage event.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "indokost:custom-facilities:v1";
const MAX_LEN = 40;

const EMPTY: string[] = [];

// ── In-memory cache over localStorage (stable snapshot identity for React) ──
let cache: string[] = EMPTY;
let cacheValid = false;

function readStore(): string[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s) => s.trim().slice(0, MAX_LEN))
      : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): string[] {
  if (!cacheValid) {
    cache = readStore();
    cacheValid = true;
  }
  return cache;
}

const getServerSnapshot = (): string[] => EMPTY;

// ── In-session + cross-tab sync ──────────────────────────────────────────────
const listeners = new Set<() => void>();

function publish(): void {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cacheValid = false;
      publish();
    }
  });
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function writeStore(next: string[]): void {
  cache = next;
  cacheValid = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // private mode / quota exceeded — in-memory state still works this session
  }
  publish();
}

/** Trim + collapse inner whitespace + hard length cap ("  Water  Heater " → "Water Heater") */
export function normalizeFacilityName(input: string): string {
  return input.replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
}

export function useCustomFacilities() {
  const customFacilities = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /** Add (or return the existing canonical name, case-insensitive). */
  const addCustomFacility = useCallback((rawName: string): string => {
    const name = normalizeFacilityName(rawName);
    if (!name) return "";
    const current = getSnapshot(); // always read the latest, not a closure
    const existing = current.find((f) => f.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    writeStore([...current, name]);
    return name;
  }, []);

  /** Remove by exact name; rooms already saved keep their stored facility string. */
  const removeCustomFacility = useCallback((name: string): void => {
    writeStore(getSnapshot().filter((f) => f !== name));
  }, []);

  return { customFacilities, addCustomFacility, removeCustomFacility };
}
