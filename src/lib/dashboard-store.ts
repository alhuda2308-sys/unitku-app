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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Klasifikasi penyebab error untuk log console — network vs HTTP vs server */
function describeError(err: unknown): string {
  if (err instanceof Error) {
    const cause = err.cause instanceof Error ? ` (penyebab: ${err.cause.message})` : "";
    return `${err.message}${cause}`;
  }
  return String(err);
}

async function fetchDashboardData(): Promise<{
  rooms: Room[];
  invoices: Invoice[];
  cashEntries: CashEntry[];
}> {
  const [r, i, c] = await Promise.all([api.getRooms(), api.getInvoices(), api.getCash()]);
  return { rooms: r.rooms, invoices: i.invoices, cashEntries: c.entries };
}

// ── Auto-recovery mode offline ────────────────────────────────────────────────
// Saat masuk mode offline (DB benar-benar tak terjangkau setelah retry),
// polling murah ke /api/health mendeteksi kapan database kembali hidup →
// data dimuat ulang otomatis & banner menghilang tanpa sentuhan pengguna.

const RECOVERY_INTERVAL_MS = 8_000;
const RECOVERY_MAX_ATTEMPTS = 24; // ± 3 menit, lalu serahkan ke tombol retry

let recoveryTimer: ReturnType<typeof setInterval> | null = null;
let recoveryAttempts = 0;
let onlineListenerBound = false;

function stopRecoveryPolling(): void {
  if (recoveryTimer !== null) {
    clearInterval(recoveryTimer);
    recoveryTimer = null;
  }
}

/** Muat ulang data tanpa mengubah status (tanpa skeleton) — utk pemulihan otomatis */
async function recoverDashboard(): Promise<boolean> {
  try {
    const data = await fetchDashboardData();
    stopRecoveryPolling();
    console.info("[UnitKu] Database kembali terjangkau — dashboard disinkronkan ulang.");
    setState({ ...data, status: "ready", syncedAt: nowLabel() });
    return true;
  } catch {
    return false;
  }
}

async function pollHealthOnce(): Promise<boolean> {
  // Dengan pengaman waktu — probe yang menggantung tidak boleh menumpuk
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch("/api/health", {
      cache: "no-store",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function startRecoveryPolling(): void {
  if (recoveryTimer !== null) return;
  recoveryAttempts = 0;
  recoveryTimer = setInterval(() => {
    recoveryAttempts += 1;
    if (recoveryAttempts > RECOVERY_MAX_ATTEMPTS) {
      stopRecoveryPolling();
      console.info(
        `[UnitKu] Pemulihan otomatis dihentikan setelah ${RECOVERY_MAX_ATTEMPTS} percobaan — gunakan tombol "Coba Sambungkan Ulang".`,
      );
      return;
    }
    void pollHealthOnce().then((up) => {
      if (up) void recoverDashboard();
    });
  }, RECOVERY_INTERVAL_MS);

  // Browser baru saja online kembali (WiFi/kuota tersambung) → coba segera
  if (typeof window !== "undefined" && !onlineListenerBound) {
    onlineListenerBound = true;
    window.addEventListener("online", () => {
      if (state.status === "offline") {
        console.info("[UnitKu] Koneksi perangkat kembali online — mencoba sinkron…");
        void pollHealthOnce().then((up) => {
          if (up) void recoverDashboard();
        });
      }
    });
  }
}

/**
 * Mode demo instan (?demo=1 — redirect dari GET /demo): pasang dataset
 * simulasi 12 kamar LANGSUNG tanpa satu pun panggilan API/database. Dashboard
 * tampil < 1 detik dan tidak pernah menunggu Supabase. Mutasi berikutnya
 * tetap dapat dicoba lewat API bila database sehat.
 */
export function applyDemoSnapshot(): void {
  stopRecoveryPolling();
  setState({
    rooms: ROOMS,
    invoices: INVOICES,
    cashEntries: CASH_ENTRIES,
    status: "ready",
    syncedAt: null,
  });
}

/**
 * Pengaman anti-hang (watchdog dashboard): bila status masih "loading" setelah
 * batas waktu — koneksi database tidak pernah menjawab — lepaskan skeleton
 * dan tampilkan fallback data demo + banner offline. Polling pemulihan
 * berjalan sampai database merespons kembali (data asli otomatis masuk).
 * Aman dipanggil kapan saja: hanya bertindak saat status masih "loading".
 */
export function markStalled(): void {
  if (state.status !== "loading") return;
  console.warn(
    "[UnitKu] Database tidak merespons tepat waktu — fallback mode offline diaktifkan (watchdog).",
  );
  setState({
    rooms: ROOMS,
    invoices: INVOICES,
    cashEntries: CASH_ENTRIES,
    status: "offline",
  });
  startRecoveryPolling();
}

/**
 * Penyelamat sesi demo: /api/auth/me mendeteksi demo saat bootstrap masih
 * menggantung di database — pasang dataset simulasi instan (status "ready",
 * tanpa banner offline) supaya demo tidak pernah menunggu Supabase.
 * Hanya bertindak bila status masih "loading" (tidak menimpa data hidup).
 */
export function rescueDemoIfLoading(): void {
  if (state.status !== "loading") return;
  applyDemoSnapshot();
}

/**
 * Muat data dari cloud (kamar + tagihan + kas). Status "loading" → skeleton
 * in-place per kartu data (UI shell dashboard tetap tampil, layar penuh tidak
 * pernah diblokir); kegagalan sementara di-retry otomatis (warm-up server,
 * SQLITE_BUSY, dsb. tidak langsung menjatuhkan mode offline). Setelah 3
 * percobaan gagal → status "offline" + fallback dataset demo + polling
 * /api/health utk pemulihan otomatis. Melempar error agar pemanggil
 * menampilkan toast.
 *
 * Dijamin SELALU selesai: tiap fetch punya timeout, sehingga status tak
 * mungkin menggantung di "loading" — sukses ("ready") maupun gagal
 * ("offline") selalu dicatat sebelum fungsi kembali.
 */
export async function loadDashboard(): Promise<void> {
  // Saat mode offline (fallback sudah tampil), JANGAN balik ke skeleton —
  // biarkan data demo tetap terlihat selama percobaan ulang berjalan.
  if (state.status !== "offline") setState({ status: "loading" });
  const attempts: [number, number][] = [
    [1, 0],
    [2, 500],
    [3, 1_800],
  ];
  let lastError: unknown = null;
  for (const [n, waitMs] of attempts) {
    if (waitMs > 0) await delay(waitMs);
    try {
      const data = await fetchDashboardData();
      stopRecoveryPolling();
      if (n > 1) console.info(`[UnitKu] Sinkron berhasil pada percobaan ke-${n}.`);
      setState({ ...data, status: "ready", syncedAt: nowLabel() });
      return;
    } catch (err) {
      lastError = err;
      console.warn(
        `[UnitKu] Percobaan sinkron ${n}/${attempts.length} gagal: ${describeError(err)}`,
      );
    }
  }
  // Benar-benar gagal → mode offline + fallback demo + log akar masalah
  console.error(
    "[UnitKu] MODE OFFLINE diaktifkan — database tidak terjangkau setelah 3 percobaan.",
    "\n  Penyebab:",
    describeError(lastError),
    "\n  (Detail permintaan gagal: lihat log [UnitKu API] di atas — network error / HTTP 4xx-5xx)",
  );
  // Cegah balapan: bila data sudah dipulihkan lewat jalur lain (watchdog +
  // polling kesehatan berhasil lebih dulu), jangan timpa status "ready".
  if (state.status === "ready") return;
  setState({
    rooms: ROOMS,
    invoices: INVOICES,
    cashEntries: CASH_ENTRIES,
    status: "offline",
  });
  startRecoveryPolling();
  throw lastError;
}

/**
 * Segerkan ulang data tanpa mengubah status (dipakai pemulihan error mutasi) —
 * data lama tetap tampil sampai data baru tiba; gagal dibiarkan senyap.
 */
export async function refreshDashboard(): Promise<void> {
  try {
    const data = await fetchDashboardData();
    setState({
      ...data,
      status: "ready",
      syncedAt: nowLabel(),
    });
  } catch (err) {
    /* biarkan data saat ini — caller sudah menampilkan toast error */
    console.warn(
      `[UnitKu] Refresh data gagal (data saat ini tetap dipakai): ${describeError(err)}`,
    );
  }
}
