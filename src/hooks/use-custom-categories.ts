"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — master daftar kategori kustom (Buku Kas)
// Persisted per "kind" (income/expense) in localStorage so custom categories
// survive modal reopen & reload. Backed by useSyncExternalStore: an in-memory
// cache keeps snapshot identity stable and an in-session pub/sub keeps every
// mounted modal instance in sync without waiting for a storage event.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useSyncExternalStore } from "react";

export type CategoryKind = "income" | "expense";

const STORAGE_KEY = "indokost:custom-categories:v1";
const MAX_LEN = 48;

interface CategoryStore {
  income: string[];
  expense: string[];
}

const EMPTY_STORE: CategoryStore = { income: [], expense: [] };

// ── In-memory cache over localStorage (stable snapshot identity for React) ──
let cache: CategoryStore = EMPTY_STORE;
let cacheValid = false;

function readStore(): CategoryStore {
  if (typeof window === "undefined") return EMPTY_STORE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Partial<CategoryStore>;
    const clean = (value: unknown): string[] =>
      Array.isArray(value)
        ? value
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
            .map((s) => s.trim().slice(0, MAX_LEN))
        : [];
    return { income: clean(parsed.income), expense: clean(parsed.expense) };
  } catch {
    return EMPTY_STORE;
  }
}

function getSnapshot(): CategoryStore {
  if (!cacheValid) {
    cache = readStore();
    cacheValid = true;
  }
  return cache;
}

const getServerSnapshot = (): CategoryStore => EMPTY_STORE;

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

function writeStore(next: CategoryStore): void {
  cache = next;
  cacheValid = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // private mode / quota exceeded — in-memory state still works this session
  }
  publish();
}

/** Trim + collapse inner whitespace + hard length cap ("  Iuran   Sampah " → "Iuran Sampah") */
export function normalizeCategoryName(input: string): string {
  return input.replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
}

export function useCustomCategories(kind: CategoryKind) {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /** Add (or return the existing canonical name, case-insensitive). */
  const addCustom = useCallback(
    (rawName: string): string => {
      const name = normalizeCategoryName(rawName);
      if (!name) return "";
      const store = getSnapshot();
      const current = store[kind]; // always read the latest, not a closure
      const existing = current.find((c) => c.toLowerCase() === name.toLowerCase());
      if (existing) return existing;
      const next: CategoryStore =
        kind === "income"
          ? { income: [...current, name], expense: store.expense }
          : { income: store.income, expense: [...current, name] };
      writeStore(next);
      return name;
    },
    [kind]
  );

  /** Remove by exact name; historical transactions keep their stored category string. */
  const removeCustom = useCallback(
    (name: string): void => {
      const store = getSnapshot();
      const current = store[kind];
      const next: CategoryStore =
        kind === "income"
          ? { income: current.filter((c) => c !== name), expense: store.expense }
          : { income: store.income, expense: current.filter((c) => c !== name) };
      writeStore(next);
    },
    [kind]
  );

  return { customCategories: store[kind], addCustom, removeCustom };
}
