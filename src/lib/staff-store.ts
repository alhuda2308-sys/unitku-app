"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Kelola Tim & Admin Cabang (Role-Based Access Control, simulasi)
// Dua store localStorage:
//   1. "indokost:staff:v1"         → StaffMember[] (daftar staf & penjaga)
//   2. "indokost:session-user:v1"  → { userId }   ("owner" | staff id)
// Pola sama dengan property-store: in-memory cache (snapshot identity stabil),
// pub/sub in-session antar komponen, sinkron lintas-tab via storage event.
// Seed hanya ditulis saat key BELUM ada — staf yang dihapus Owner tidak muncul
// kembali setelah reload.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useSyncExternalStore } from "react";

export type StaffRole = "admin" | "caretaker";
export type StaffStatus = "aktif" | "menunggu" | "nonaktif";

export interface StaffMember {
  id: string; // "st-1"
  name: string;
  contact: string; // No. WhatsApp / Email (satu baris)
  /** Nomor WhatsApp AKTIF — identitas pengirim tagihan pada draf pesan WA */
  phone: string;
  role: StaffRole;
  propertyIds: string[]; // batasan akses properti
  status: StaffStatus;
  password: string; // mock — demo only, tidak untuk produksi
  createdAt: string; // ISO
}

/** Payload form "+ Tambah / Undang Admin Baru" & "Edit Izin Properti" */
export interface StaffDraft {
  name: string;
  contact: string;
  /** Nomor WhatsApp aktif staf — wajib, dipakai generator pesan tagihan */
  phone: string;
  role: StaffRole;
  propertyIds: string[];
}

export const STAFF_ROLE_META: Record<
  StaffRole,
  { label: string; description: string }
> = {
  admin: {
    label: "Admin Properti",
    description:
      "Bisa kelola kamar, check-in penghuni, buat tagihan, kirim WA, dan catat pengeluaran.",
  },
  caretaker: {
    label: "Penjaga / Caretaker",
    description:
      "Hanya bisa melihat status kamar dan mencatat tiket komplain/pemeliharaan fasilitas (tidak bisa melihat rekapan uang & rekening pemilik).",
  },
};

export const STAFF_STATUS_META: Record<
  StaffStatus,
  { label: string }
> = {
  aktif: { label: "Aktif" },
  menunggu: { label: "Menunggu Aktivasi" },
  nonaktif: { label: "Nonaktif" },
};

const STAFF_KEY = "indokost:staff:v1";
const SESSION_KEY = "indokost:session-user:v1";
const MAX_NAME = 60;
const MAX_CONTACT = 80;
const MAX_PHONE = 24;

const SEED_STAFF: StaffMember[] = [
  {
    id: "st-1",
    name: "Pak Yanto",
    contact: "0813-2468-1357",
    phone: "0813-2468-1357",
    role: "admin",
    propertyIds: ["kgp"],
    status: "aktif",
    password: "yanto123",
    createdAt: "2024-02-10T00:00:00.000Z",
  },
  {
    id: "st-2",
    name: "Sari Wulandari",
    contact: "sari.wulandari@gmail.com",
    phone: "0857-1122-3344",
    role: "caretaker",
    propertyIds: ["kmi"],
    status: "menunggu",
    password: "sari123",
    createdAt: "2024-08-03T00:00:00.000Z",
  },
];

// ── Sanitizers ───────────────────────────────────────────────────────────────

function asText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function sanitizeStaff(raw: unknown, index: number): StaffMember | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<StaffMember>;
  const name = asText(s.name, MAX_NAME);
  if (!name) return null;
  const role: StaffRole = s.role === "caretaker" ? "caretaker" : "admin";
  const status: StaffStatus =
    s.status === "menunggu" || s.status === "nonaktif" ? s.status : "aktif";
  const propertyIds = Array.isArray(s.propertyIds)
    ? s.propertyIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  // Migrasi data lama (sebelum kolom phone): turunkan dari contact bila bukan email
  const contact = asText(s.contact, MAX_CONTACT);
  const phone = asText(s.phone, MAX_PHONE) || (contact && !contact.includes("@") ? contact : "");
  return {
    id: asText(s.id, 24) || `st-${index + 1}`,
    name,
    contact,
    phone,
    role,
    propertyIds,
    status,
    password: typeof s.password === "string" ? s.password.slice(0, 60) : "",
    createdAt: typeof s.createdAt === "string" ? s.createdAt : new Date().toISOString(),
  };
}

// ── Staff store ──────────────────────────────────────────────────────────────

let staffCache: StaffMember[] = SEED_STAFF;
let staffValid = false;

function readStaff(): StaffMember[] {
  if (typeof window === "undefined") return staffCache;
  try {
    const raw = window.localStorage.getItem(STAFF_KEY);
    if (!raw) {
      // First run → tulis seed agar reload berikutnya membaca storage yang sama
      window.localStorage.setItem(STAFF_KEY, JSON.stringify(SEED_STAFF));
      return SEED_STAFF;
    }
    const parsed = JSON.parse(raw) as unknown;
    const list = (Array.isArray(parsed) ? parsed : [])
      .map(sanitizeStaff)
      .filter((s): s is StaffMember => s !== null);
    return list;
  } catch {
    return staffCache;
  }
}

function getStaffSnapshot(): StaffMember[] {
  if (!staffValid) {
    staffCache = readStaff();
    staffValid = true;
  }
  return staffCache;
}

const getStaffServerSnapshot = (): StaffMember[] => staffCache;

const staffListeners = new Set<() => void>();

function publishStaff(): void {
  staffListeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STAFF_KEY) {
      staffValid = false;
      publishStaff();
    }
  });
}

function subscribeStaff(callback: () => void): () => void {
  staffListeners.add(callback);
  return () => {
    staffListeners.delete(callback);
  };
}

function writeStaff(next: StaffMember[]): void {
  staffCache = next;
  staffValid = true;
  try {
    window.localStorage.setItem(STAFF_KEY, JSON.stringify(next));
  } catch {
    // private mode / quota exceeded — in-memory still works this session
  }
  publishStaff();
}

export function nextStaffId(staff: StaffMember[]): string {
  let max = 0;
  for (const s of staff) {
    const m = /^st-(\d+)$/.exec(s.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `st-${max + 1}`;
}

export function useStaff() {
  const staff = useSyncExternalStore(subscribeStaff, getStaffSnapshot, getStaffServerSnapshot);

  /** Buat akun staf baru — status langsung "aktif" (password sementara diset). */
  const addStaff = useCallback((draft: StaffDraft): StaffMember => {
    const current = getStaffSnapshot();
    const created: StaffMember = {
      id: nextStaffId(current),
      name: draft.name.trim().slice(0, MAX_NAME),
      contact: draft.contact.trim().slice(0, MAX_CONTACT),
      phone: draft.phone.trim().slice(0, MAX_PHONE),
      role: draft.role,
      propertyIds: [...new Set(draft.propertyIds)],
      status: "aktif",
      password: "indokost-demo",
      createdAt: new Date().toISOString(),
    };
    writeStaff([...current, created]);
    return created;
  }, []);

  const updateStaff = useCallback((id: string, draft: StaffDraft): void => {
    const current = getStaffSnapshot();
    writeStaff(
      current.map((s) =>
        s.id === id
          ? {
              ...s,
              name: draft.name.trim().slice(0, MAX_NAME),
              contact: draft.contact.trim().slice(0, MAX_CONTACT),
              phone: draft.phone.trim().slice(0, MAX_PHONE),
              role: draft.role,
              propertyIds: [...new Set(draft.propertyIds)],
            }
          : s
      )
    );
  }, []);

  /** Simpan nomor WhatsApp aktif staf — dipakai Profil Saya saat staf login */
  const setStaffPhone = useCallback((id: string, phone: string): void => {
    const current = getStaffSnapshot();
    writeStaff(current.map((s) => (s.id === id ? { ...s, phone: phone.trim().slice(0, MAX_PHONE) } : s)));
  }, []);

  const setStaffStatus = useCallback((id: string, status: StaffStatus): void => {
    const current = getStaffSnapshot();
    writeStaff(current.map((s) => (s.id === id ? { ...s, status } : s)));
  }, []);

  const setStaffPassword = useCallback((id: string, password: string): void => {
    const current = getStaffSnapshot();
    writeStaff(current.map((s) => (s.id === id ? { ...s, password: password.slice(0, 60) } : s)));
  }, []);

  const removeStaff = useCallback((id: string): void => {
    const current = getStaffSnapshot();
    writeStaff(current.filter((s) => s.id !== id));
  }, []);

  return { staff, addStaff, updateStaff, setStaffPhone, setStaffStatus, setStaffPassword, removeStaff };
}

// ── Session user ("owner" | staff id) ────────────────────────────────────────

interface SessionStore {
  userId: string;
}

const OWNER_ID = "owner";

let sessionCache: SessionStore = { userId: OWNER_ID };
let sessionValid = false;

function readSession(): SessionStore {
  if (typeof window === "undefined") return sessionCache;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return { userId: OWNER_ID };
    const parsed = JSON.parse(raw) as Partial<SessionStore>;
    const userId = typeof parsed.userId === "string" && parsed.userId ? parsed.userId : OWNER_ID;
    return { userId };
  } catch {
    return { userId: OWNER_ID };
  }
}

function getSessionSnapshot(): SessionStore {
  if (!sessionValid) {
    sessionCache = readSession();
    sessionValid = true;
  }
  return sessionCache;
}

const getSessionServerSnapshot = (): SessionStore => sessionCache;

const sessionListeners = new Set<() => void>();

function publishSession(): void {
  sessionListeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === SESSION_KEY) {
      sessionValid = false;
      publishSession();
    }
  });
}

function subscribeSession(callback: () => void): () => void {
  sessionListeners.add(callback);
  return () => {
    sessionListeners.delete(callback);
  };
}

export function useSessionUser() {
  const store = useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionServerSnapshot);

  const setSessionUser = useCallback((userId: string): void => {
    sessionCache = { userId: userId || OWNER_ID };
    sessionValid = true;
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessionCache));
    } catch {
      // ignore — in-memory still works
    }
    publishSession();
  }, []);

  return { sessionUserId: store.userId, setSessionUser };
}
