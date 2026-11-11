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
// terjangkau untuk AKUN RIIL, store memasuki mode "offline" DENGAN DATA
// KOSONG + banner retry — TIDAK PERNAH menyuntikkan dataset dummy (data
// simulasi 12 kamar HANYA untuk sesi demo via applyDemoSnapshot).
// ─────────────────────────────────────────────────────────────────────────────

import { api } from "@/lib/api-client";
import { ROOMS, type Room } from "@/lib/kost-data";
import { INVOICES, type Invoice } from "@/lib/kost-invoices";
import { CASH_ENTRIES, type CashEntry } from "@/lib/kost-cashflow";
import { saveTrialSession } from "@/lib/trial-session-store";

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

// ── Persistensi sesi TRIAL (per token) ───────────────────────────────────────
// Saat sesi trial aktif (dashboard ?trial=1), SETIAP mutasi kamar/tagihan/kas
// ikut disimpan ke localStorage per token trial (src/lib/trial-session-store.ts)
// sehingga data yang diketik owner trial bertahan antar reload. Non-trial
// (demo CTA / akun riil) → token null → tidak ada penulisan apa pun.

let trialSessionToken: string | null = null;

/** Aktif/nonaktifkan persistensi sesi trial — dipanggil aktivasi dashboard trial */
export function setDashboardTrialSession(token: string | null): void {
  const id = token?.trim() ?? "";
  trialSessionToken = id || null;
}

function persistTrialSnapshot(patch: {
  rooms?: Room[];
  invoices?: Invoice[];
  cashEntries?: CashEntry[];
}): void {
  if (!trialSessionToken) return;
  saveTrialSession(trialSessionToken, patch);
}

export function updateRooms(fn: (prev: Room[]) => Room[]): void {
  const rooms = fn(state.rooms);
  setState({ rooms });
  persistTrialSnapshot({ rooms });
}

export function updateInvoices(fn: (prev: Invoice[]) => Invoice[]): void {
  const invoices = fn(state.invoices);
  setState({ invoices });
  persistTrialSnapshot({ invoices });
}

export function updateCashEntries(fn: (prev: CashEntry[]) => CashEntry[]): void {
  const cashEntries = fn(state.cashEntries);
  setState({ cashEntries });
  persistTrialSnapshot({ cashEntries });
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

// ── Scope properti aktif (switcher multi-cabang) ─────────────────────────────
// Dashboard memuat kamar/tagihan/kas SESUAI properti yang sedang dikelola.
// Scope diset sebelum bootstrap/beralih cabang (setDashboardPropertyScope);
// null = perilaku lama (seluruh properti owner) — dipakai sesi demo/offline.

let propertyScopeId: string | null = null;

/** Set properti aktif untuk SEMUA fetch dashboard berikutnya (kamar, tagihan, kas) */
export function setDashboardPropertyScope(propertyId: string | null): void {
  propertyScopeId = propertyId;
}

async function fetchDashboardData(): Promise<{
  rooms: Room[];
  invoices: Invoice[];
  cashEntries: CashEntry[];
}> {
  const [r, i, c] = await Promise.all([
    api.getRooms(propertyScopeId),
    api.getInvoices(propertyScopeId),
    api.getCash(propertyScopeId),
  ]);
  // ?? [] — respons degraded/bentuk tak terduga (fallback server tanpa kunci
  // array) tidak boleh menyuntikkan undefined ke store: memo useMemo mana pun
  // yang memanggil rooms.find/invoices.filter akan menghancurkan seluruh
  // render dashboard ("Cannot read properties of undefined").
  return {
    rooms: r.rooms ?? [],
    invoices: i.invoices ?? [],
    cashEntries: c.entries ?? [],
  };
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
    commitReady({ ...data, syncedAt: nowLabel() });
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

// ── Jeda toleransi sebelum mode offline diumumkan (anti-banner-panik) ────────
// Alur muat awal yang gagal cepat (server cold-start, koneksi lambat, DB belum
// siap) TIDAK BOLEH langsung menampilkan banner kuning "Mode offline" —
// pengguna baru membuka aplikasi dan mengira dashboard rusak. Status "offline"
// (banner + polling pemulihan) baru diterbitkan setelah:
//   • 3 percobaan sinkron gagal DAN jeda toleransi OFFLINE_GRACE_MS berlalu,
//   • ATAU perangkat benar-benar putus (navigator.onLine === false — definitif,
//     tanpa jeda).
// Selama jeda, status tetap "loading" → skeleton/spinner sinkron yang tenang
// yang tampil, bukan peringatan panik. Begitu data berhasil dimuat
// (commitReady), jeda dibatalkan otomatis — banner tidak pernah muncul.

const OFFLINE_GRACE_MS = 6_000; // jeda toleransi (5-8 dtk) sebelum banner offline
let offlineGraceTimer: ReturnType<typeof setTimeout> | null = null;

function cancelOfflineGrace(): void {
  if (offlineGraceTimer !== null) {
    clearTimeout(offlineGraceTimer);
    offlineGraceTimer = null;
  }
}

function enterOfflineNow(): void {
  cancelOfflineGrace();
  setState({ status: "offline" });
  startRecoveryPolling();
}

/**
 * Jadwalkan penerbitan status "offline" — aman dipanggil berulang dari
 * markStalled / loadDashboard / retry manual: jeda hanya dijadwalkan sekali
 * dan dibatalkan otomatis oleh commitReady begitu data berhasil dimuat.
 */
function announceOffline(): void {
  if (state.status === "offline") {
    // Retry manual dari banner gagal lagi — pastikan polling pemulihan tetap hidup
    startRecoveryPolling();
    return;
  }
  if (state.status !== "loading") return; // "ready"/data hidup — jangan timpa
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    enterOfflineNow(); // perangkat memang putus koneksi — banner segera (jujur)
    return;
  }
  if (offlineGraceTimer !== null) return; // jeda toleransi sudah berjalan
  offlineGraceTimer = setTimeout(() => {
    offlineGraceTimer = null;
    if (state.status === "loading") enterOfflineNow();
  }, OFFLINE_GRACE_MS);
}

/** Terbitkan status "ready" (onSuccess) — batalkan jeda toleransi offline yang
 *  mungkin masih berjalan supaya banner tidak pernah muncul setelah data hidup. */
function commitReady(patch: Partial<DashboardState>): void {
  cancelOfflineGrace();
  setState({ ...patch, status: "ready" });
}

/**
 * Mode demo instan (?demo=1 — redirect dari GET /demo): pasang dataset
 * simulasi 12 kamar LANGSUNG tanpa satu pun panggilan API/database. Dashboard
 * tampil < 1 detik dan tidak pernah menunggu Supabase. HANYA untuk sesi demo —
 * akun riil tidak pernah melewati jalur ini.
 */
export function applyDemoSnapshot(): void {
  stopRecoveryPolling();
  commitReady({
    rooms: ROOMS,
    invoices: INVOICES,
    cashEntries: CASH_ENTRIES,
    syncedAt: null,
  });
}

/**
 * Snapshot sesi TRIAL — dashboard FRESH STATE: kamar/tagihan/kas KOSONG
 * (atau data milik owner trial yang sudah diketik sebelumnya, dipulihkan dari
 * persistensi per-token oleh pemanggil). TANPA dataset demo sama sekali —
 * pemilik trial harus memasukkan data kamar/kos mereka sendiri dari nol
 * layaknya akun riil baru. Status langsung "ready": trial tidak pernah
 * menunggu database (mutasinya murni lokal + persistensi perangkat).
 */
export function applyTrialSnapshot(
  rooms: Room[],
  invoices: Invoice[],
  cashEntries: CashEntry[],
): void {
  stopRecoveryPolling();
  commitReady({ rooms, invoices, cashEntries, syncedAt: null });
}

/**
 * Pengaman anti-hang (watchdog dashboard): bila status masih "loading" setelah
 * batas waktu — koneksi database tidak pernah menjawab — jadwalkan transisi ke
 * mode "offline" SETELAH JEDA TOLERANSI (announceOffline) DENGAN DATA TETAP
 * KOSONG + banner offline + polling pemulihan (data asli otomatis masuk saat
 * database merespons). Selama jeda, skeleton tenang tetap tampil.
 *
 * ARSITEKTUR DATA: akun riil TIDAK PERNAH diberi data dummy — menampilkan
 * dataset simulasi ke pemilik akun justru menyesatkan (bisa dianggap data
 * hilang/berubah). Simulasi 12 kamar eksklusif sesi demo (applyDemoSnapshot).
 * Aman dipanggil kapan saja: hanya bertindak saat status masih "loading".
 */
export function markStalled(): void {
  if (state.status !== "loading") return;
  console.warn(
    "[UnitKu] Database tidak merespons tepat waktu — mode offline dijadwalkan setelah jeda toleransi (watchdog, tanpa dummy).",
  );
  announceOffline();
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
 * percobaan gagal → JEDA TOLERANSI dulu, baru status "offline" + banner retry
 * + polling /api/health utk pemulihan otomatis — DATA TETAP KOSONG, TANPA
 * dataset dummy (akun riil tidak boleh melihat data simulasi seolah-olah
 * datanya hilang). Melempar error agar pemanggil menampilkan toast.
 *
 * Dijamin SELALU selesai: tiap fetch punya timeout, sehingga status tak
 * mungkin menggantung di "loading" — sukses ("ready") maupun kegagalan final
 * (jadwal "offline" via announceOffline) selalu ditangani sebelum kembali.
 */
export async function loadDashboard(): Promise<void> {
  // Saat mode offline, JANGAN balik ke skeleton — biarkan tampilan (kosong/
  // banner) tetap stabil selama percobaan ulang berjalan.
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
      commitReady({ ...data, syncedAt: nowLabel() });
      return;
    } catch (err) {
      lastError = err;
      console.warn(
        `[UnitKu] Percobaan sinkron ${n}/${attempts.length} gagal: ${describeError(err)}`,
      );
    }
  }
  // Benar-benar gagal → mode offline DENGAN DATA KOSONG (tanpa dummy) + log
  console.error(
    "[UnitKu] GAGAL SINKRON 3 PERCOBAAN — mode offline dijadwalkan setelah jeda toleransi (data tidak dimuat, tanpa dummy).",
    "\n  Penyebab:",
    describeError(lastError),
    "\n  (Detail permintaan gagal: lihat log [UnitKu API] di atas — network error / HTTP 4xx-5xx)",
  );
  // Cegah balapan: bila data sudah dipulihkan lewat jalur lain (watchdog +
  // polling kesehatan berhasil lebih dulu), jangan timpa status "ready".
  if (state.status === "ready") return;
  announceOffline(); // jeda toleransi dulu — banner hanya setelah gagal ±6 dtk
  throw lastError;
}

/**
 * Segerkan ulang data tanpa mengubah status (dipakai pemulihan error mutasi) —
 * data lama tetap tampil sampai data baru tiba; gagal dibiarkan senyap.
 */
export async function refreshDashboard(): Promise<void> {
  try {
    const data = await fetchDashboardData();
    commitReady({ ...data, syncedAt: nowLabel() });
  } catch (err) {
    /* biarkan data saat ini — caller sudah menampilkan toast error */
    console.warn(
      `[UnitKu] Refresh data gagal (data saat ini tetap dipakai): ${describeError(err)}`,
    );
  }
}

/**
 * Tarik ulang PENUH data dashboard (kamar + tagihan + kas) dari cloud untuk
 * tombol refresh manual "Segarkan Data Cloud" — TANPA memicu skeleton (data
 * lama tetap tampil sampai data baru tiba) dan sekaligus berfungsi sebagai
 * retry manual saat mode offline (polling pemulihan dihentikan saat sukses).
 * BERBEDA dari refreshDashboard: fungsi ini MELEMPAR error bila fetch gagal
 * agar pemanggil menampilkan toast — tidak pernah gagal senyap.
 */
export async function reloadDashboardData(): Promise<void> {
  const data = await fetchDashboardData(); // melempar bila semua percobaan fetch gagal
  stopRecoveryPolling();
  commitReady({ ...data, syncedAt: nowLabel() });
}
