// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Store notifikasi lead baru (pola external store, spt sync-status)
//
// SATU sumber kebenaran untuk semua penanda "ada pendaftar baru yang belum
// ditinjau" di sisi klien:
//   • Badge angka merah di nav "Panel Super Admin" (sidebar desktop, bilah
//     bawah mobile, kartu Pengaturan)
//   • Badge ikon aplikasi PWA di HP via navigator.setAppBadge(count) —
//     tampil walau aplikasi tidak sedang dibuka (installed standalone);
//     dihapus otomatis saat admin meninjau (markLeadsSeen).
//   • latest + version dipakai efek samping (toast, suara, refresh tabel).
//
// Store ini sengaja TANPA persistensi: angka unread dihitung ulang dari server
// oleh use-leads-alerts (baseline = lead terbaru saat halaman dibuka), jadi
// refresh tab selalu mulai dari kondisi nyata.
// ─────────────────────────────────────────────────────────────────────────────

export interface LeadAlertInfo {
  id: string;
  name: string;
  /** Nomor WhatsApp ternormalisasi 62… — dipakai tombol [Chat WhatsApp] */
  phone: string;
  source: string | null;
  createdAt: string;
}

export interface LeadsAlertState {
  /** Jumlah lead baru yang belum ditinjau admin (badge merah) */
  unread: number;
  /** Lead terbaru yang memicu alert (untuk toast & follow-up) */
  latest: LeadAlertInfo | null;
  /** Naik setiap ada perubahan — pemicu efek samping di komponen */
  version: number;
}

const INITIAL: LeadsAlertState = { unread: 0, latest: null, version: 0 };

let state: LeadsAlertState = INITIAL;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

/** Badge ikon PWA di HP — feature-detect, diam bila tidak didukung (iOS Safari
 *  lama, browser desktop tanpa dukungan badge) */
function updateAppBadge(count: number): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0) {
      void nav.setAppBadge?.(count)?.catch(() => {});
    } else {
      void nav.clearAppBadge?.()?.catch(() => {});
    }
  } catch {
    /* badge tidak didukung — abaikan */
  }
}

export function subscribeLeadsAlert(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLeadsAlertSnapshot(): LeadsAlertState {
  return state;
}

/** Snapshot SSR = kondisi awal (belum ada data klien) */
export function getLeadsAlertServerSnapshot(): LeadsAlertState {
  return INITIAL;
}

/** Ada lead BARU terdeteksi — badge naik, ikon PWA ditandai */
export function reportNewLead(info: LeadAlertInfo): void {
  state = {
    unread: state.unread + 1,
    latest: info,
    version: state.version + 1,
  };
  notify();
  updateAppBadge(state.unread);
}

/** Admin sudah meninjau (membuka panel / tabel dimuat ulang) — badge dibersihkan */
export function markLeadsSeen(): void {
  if (state.unread === 0 && state.latest === null) return;
  state = { ...state, unread: 0, version: state.version + 1 };
  notify();
  updateAppBadge(0);
}
