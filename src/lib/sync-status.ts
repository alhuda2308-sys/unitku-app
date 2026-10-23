// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Status sinkronisasi cloud (indikator global, pola external store)
//
// SATU sumber kebenaran untuk indikator "Tersinkron ke Cloud / Menyinkronkan /
// Belum tersinkron" di sidebar & header dashboard. Semua jalur ke Supabase
// (route handlers via api-client, push pengaturan) melaporkan aktivitasnya ke
// sini: notifySyncStart saat request dimulai, notifySyncSuccess / Error saat
// selesai. Status:
//   • "syncing" — ada permintaan cloud berjalan (awan berputar)
//   • "synced"  — operasi cloud terakhir BERHASIL (hijau + jam sinkron)
//   • "error"   — operasi cloud terakhir GAGAL (merah — jujur, tanpa pura-pura)
//   • "idle"    — belum ada aktivitas (ditampilkan sebagai menyinkronkan)
//
// Mode demo TIDAK pernah memanggil API → store tetap "idle" dan indikator
// tidak dirender di dashboard demo (banner demo sudah menjelaskan kondisi).
// ─────────────────────────────────────────────────────────────────────────────

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export interface SyncStatusState {
  status: SyncStatus;
  /** "08.32" — jam sinkron sukses terakhir (id-ID, tabular-nums) */
  syncedAt: string | null;
}

const INITIAL: SyncStatusState = { status: "idle", syncedAt: null };

let state: SyncStatusState = INITIAL;
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncStatusState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot stabil — referensi hanya berubah saat status benar-benar berubah */
export function getSyncStatusSnapshot(): SyncStatusState {
  return state;
}

/** Snapshot server = INITIAL (indikator mulai "menyinkronkan" di klien) */
export function getServerSyncStatusSnapshot(): SyncStatusState {
  return INITIAL;
}

// ── Pelaporan aktivitas (dipanggil api-client & app-settings) ────────────────

let inflight = 0;

/** Anti-kedip: bila total request < MIN_SYNCING_MS, biarkan ikon berputar
 *  terlihat sebentar sebelum berbalik hijau — transisi tidak terasa "kilat". */
const MIN_SYNCING_MS = 350;
let phaseStartedAt = 0;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

function clearSettleTimer(): void {
  if (settleTimer !== null) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }
}

function nowLabel(): string {
  return new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

/** Satu permintaan cloud MULAI — indikator berputar (dipanggil sebelum fetch) */
export function notifySyncStart(): void {
  inflight += 1;
  clearSettleTimer();
  if (state.status !== "syncing") {
    phaseStartedAt = Date.now();
    setState({ status: "syncing" });
  }
}

function settle(next: SyncStatus): void {
  inflight = Math.max(0, inflight - 1);
  if (inflight > 0) return; // masih ada permintaan lain berjalan
  const elapsed = Date.now() - phaseStartedAt;
  const commit = () => {
    settleTimer = null;
    if (inflight > 0) return; // permintaan baru masuk saat menunggu
    if (next === "synced") {
      setState({ status: "synced", syncedAt: nowLabel() });
    } else {
      setState({ status: "error" });
    }
  };
  const remaining = MIN_SYNCING_MS - (Date.now() - phaseStartedAt);
  if (state.status === "syncing" && remaining > 0) {
    clearSettleTimer();
    settleTimer = setTimeout(commit, remaining);
  } else {
    commit();
  }
}

/** Permintaan cloud SUKSES (2xx) — indikator hijau + jam sinkron terbaru */
export function notifySyncSuccess(): void {
  settle("synced");
}

/** Permintaan cloud GAGAL (network / timeout / HTTP 4xx-5xx) — indikator merah.
 *  Keadaan merah BUKAN palsu: data terakhir yang gagal memang belum sampai. */
export function notifySyncError(): void {
  settle("error");
}

/** Permintaan selesai dengan error LEVEL-PERMINTAAN (4xx selain 401/429 —
 *  validasi 400, tidak ditemukan 404, nomor kamar duplikat 409, dst.):
 *  server TERJANGKAU & menjawab, jadi kesehatan sinkron tidak jadi merah —
 *  cukup lepaskan permintaan ini dari penghitung inflight (anti bocor yang
 *  membuat indikator melekat di "Menyinkronkan..." selamanya) dan bila ini
 *  permintaan terakhir, kembali hijau TANPA memperbarui jam sinkron (bukan
 *  operasi data baru). Pesan penyebabnya ditampilkan toast merah di UI. */
export function notifySyncSettled(): void {
  inflight = Math.max(0, inflight - 1);
  if (inflight > 0) return; // masih ada permintaan lain berjalan
  clearSettleTimer();
  if (state.status === "syncing") {
    setState({ status: "synced" });
  }
}
