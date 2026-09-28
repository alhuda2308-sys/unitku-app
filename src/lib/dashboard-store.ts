// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Dashboard data store (external store via useSyncExternalStore)
//
// Data utama dashboard (kamar, tagihan, buku kas + status koneksi database)
// disimpan DI LUAR React (module-level) dan dibaca komponen lewat
// useSyncExternalStore — pola yang sama dengan app-settings & staff-access.
// Keuntungan: fetch bootstrap tidak memicu setState-in-effect (lint React
// Compiler bersih), snapshot stabil untuk render server & klien, dan mutasi
// dari handler mana pun cukup memanggil updateRooms/updateInvoices/….
//
// Sumber kebenaran: Route Handlers (Prisma → Supabase). Bila database tak
// terjangkau, store jatuh ke dataset demo lokal (mode "offline").
// ─────────────────────────────────────────────────────────────────────────────

import { api } from "@/lib/api-client";
import { ROOMS, type Room } from "@/lib/kost-data";
import { INVOICES, type Invoice } from "@/lib/kost-invoices";
import { CASH_ENTRIES, type CashEntry } from "@/lib/kost-cashflow";

export type DashboardStatus = "loading" | "ready" | "offline";

export interface DashboardState {
  rooms: Room[];
  invoices: Invoice[];
  cashEntries: CashEntry[];
  status: DashboardStatus;
  /** "08.32" — waktu sinkron terakhir dengan cloud (id-ID) */
  syncedAt: string | null;
}

const INITIAL: DashboardState = {
  rooms: [],
  invoices: [],
  cashEntries: [],
  status: "loading",
  syncedAt: null,
};

let state: DashboardState = INITIAL;
const listeners = new Set<() => void>();

function setState(patch: Partial<DashboardState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeDashboard(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot stabil — referensi berubah hanya saat state benar-benar berubah */
export function getDashboardSnapshot(): DashboardState {
  return state;
}

/** Snapshot server: status loading, data kosong (identik dgn render klien pertama) */
export function getServerDashboardSnapshot(): DashboardState {
  return INITIAL;
}

// ── Mutators (dipakai handler dashboard — menggantikan setState lokal) ───────

export function updateRooms(fn: (prev: Room[]) => Room[]): void {
  setState({ rooms: fn(state.rooms) });
}

export function updateInvoices(fn: (prev: Invoice[]) => Invoice[]): void {
  setState({ invoices: fn(state.invoices) });
}

export function updateCashEntries(fn: (prev: CashEntry[]) => CashEntry[]): void {
  setState({ cashEntries: fn(state.cashEntries) });
}

// ── Fetch bootstrap / refresh ────────────────────────────────────────────────

function nowLabel(): string {
  return new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Muat data dari cloud (kamar + tagihan + kas). Status "loading" → skeleton
 * layar penuh; gagal → status "offline" + fallback dataset demo. Melempar
 * error agar pemanggil menampilkan toast.
 */
export async function loadDashboard(): Promise<void> {
  setState({ status: "loading" });
  try {
    const [r, i, c] = await Promise.all([api.getRooms(), api.getInvoices(), api.getCash()]);
    setState({
      rooms: r.rooms,
      invoices: i.invoices,
      cashEntries: c.entries,
      status: "ready",
      syncedAt: nowLabel(),
    });
  } catch (err) {
    setState({
      rooms: ROOMS,
      invoices: INVOICES,
      cashEntries: CASH_ENTRIES,
      status: "offline",
    });
    throw err;
  }
}

/**
 * Segerkan ulang data tanpa mengubah status (dipakai pemulihan error mutasi) —
 * data lama tetap tampil sampai data baru tiba; gagal dibiarkan senyap.
 */
export async function refreshDashboard(): Promise<void> {
  try {
    const [r, i, c] = await Promise.all([api.getRooms(), api.getInvoices(), api.getCash()]);
    setState({
      rooms: r.rooms,
      invoices: i.invoices,
      cashEntries: c.entries,
      status: "ready",
      syncedAt: nowLabel(),
    });
  } catch {
    /* biarkan data saat ini — caller sudah menampilkan toast error */
  }
}
