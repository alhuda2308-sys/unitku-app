// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — localStorage mirror: dashboard owner → halaman publik /portal
//
// Dashboard menyimpan snapshot state (rooms, invoices, announcements, nama
// properti) setiap kali berubah. Halaman /portal?token=… (tab baru) membaca
// mirror tersebut — sehingga link magic selalu menampilkan data TERKINI
// (status lunas, penghuni baru, banner pengumuman, reset) tanpa backend.
// Pembacaan memakai useSyncExternalStore (snapshot stabil + live update lintas
// tab via event `storage`).
//
// Integration seam: dengan REST API nyata, /portal cukup memanggil
// GET /api/portal?token=… dan modul ini dihapus.
// ─────────────────────────────────────────────────────────────────────────────

import { ROOMS, type Room } from "./kost-data";
import { INVOICES, type Invoice } from "./kost-invoices";
import { ANNOUNCEMENTS, type Announcement } from "./announcement-data";

export interface PortalMirror {
  rooms: Room[];
  invoices: Invoice[];
  announcements: Announcement[];
  propertyName: string;
}

const MIRROR_KEY = "indokost.portal-mirror.v2";

/** Seed fallback (referensi stabil — aman untuk snapshot useSyncExternalStore) */
const SEED_MIRROR: PortalMirror = {
  rooms: ROOMS,
  invoices: INVOICES,
  announcements: ANNOUNCEMENTS,
  propertyName: "Kost Griya Pratama",
};

export function getServerPortalMirror(): PortalMirror {
  return SEED_MIRROR;
}

/** Dipanggil dashboard owner setiap state berubah (best-effort, non-blocking) */
export function savePortalMirror(mirror: PortalMirror): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MIRROR_KEY, JSON.stringify(mirror));
  } catch {
    // Kuota penuh / private mode — portal publik jatuh ke data seed
  }
}

// ── Snapshot reader (cached by raw string agar referensinya stabil) ──────────

let cachedRaw: string | null = null;
let cachedMirror: PortalMirror | null = null;

export function getPortalMirror(): PortalMirror {
  if (typeof window === "undefined") return SEED_MIRROR;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(MIRROR_KEY);
  } catch {
    raw = null;
  }
  if (raw === null) return SEED_MIRROR;
  if (raw === cachedRaw && cachedMirror !== null) return cachedMirror;
  let next: PortalMirror = SEED_MIRROR;
  try {
    const parsed = JSON.parse(raw) as Partial<PortalMirror>;
    if (
      Array.isArray(parsed.rooms) &&
      Array.isArray(parsed.invoices) &&
      typeof parsed.propertyName === "string"
    ) {
      next = {
        rooms: parsed.rooms,
        invoices: parsed.invoices,
        // Mirror lama (v1) belum punya pengumuman — anggap kosong, bukan gagal
        announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
        propertyName: parsed.propertyName,
      };
    }
  } catch {
    next = SEED_MIRROR;
  }
  cachedRaw = raw;
  cachedMirror = next;
  return next;
}

/** Live update lintas tab: dashboard menulis → tab /portal ikut berubah */
export function subscribeMirror(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === MIRROR_KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
