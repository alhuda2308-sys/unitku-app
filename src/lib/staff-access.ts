// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Pendaftaran & Manajemen Akses Staf Mandiri
//
// Owner membuat staf + link akses unik (/staff?token=…) + PIN keamanan 6 digit.
// Staf membuka tautan → token diverifikasi → layar kunci PIN → sesi "Staf
// Aktif (terverifikasi PIN)" disimpan di localStorage — dashboard lalu
// menyesuaikan identitas header & membatasi menu sesuai peran.
//
// Integration seam (backend-ready): model Prisma `StaffMember` (staff_members)
// sudah di-deploy ke Supabase (termasuk kolom access_pin). Ganti
// resolveStaffToken()/verifyStaffPin()/CRUD localStorage dengan
// `GET /api/staff?token=…` + tabel Supabase saat API layer aktif — bentuk data
// & peran identik.
// ─────────────────────────────────────────────────────────────────────────────

import type { PropertyEntry } from "./app-settings";

// ── Tipe & konstanta ─────────────────────────────────────────────────────────

/** Dua peran staf mandiri (owner tetap identitas terpisah, bukan staf). */
export type StaffAccessRole = "ADMIN_OPERASIONAL" | "PENJAGA_TEKNISI";

export interface StaffAccessMember {
  id: string; // "stf_…"
  propertyId: string; // properti penugasan (id dari settings.properties)
  name: string;
  phone: string; // display "+62 813-…" / "08…"
  role: StaffAccessRole;
  accessToken: string; // "stk_<hex>" — unguessable
  accessPin: string; // PIN keamanan 6 digit — verifikasi kedua di portal
  isActive: boolean; // false = akses dicabut owner
  createdAt: string; // ISO
}

export interface StaffSession {
  id: string;
  name: string;
  role: StaffAccessRole;
  phone: string;
  propertyId: string;
  accessToken: string;
  /** true = pemilik sesi lolos verifikasi PIN 6 digit di portal /staff */
  pinVerified: boolean;
  startedAt: string; // ISO
}

export const STAFF_ACCESS_KEY = "unitku:staff-access:v1";
export const STAFF_SESSION_KEY = "unitku:staff-session:v1";
export const STAFF_EVENT = "unitku:staff-access-changed";

export const STAFF_ROLES: StaffAccessRole[] = ["ADMIN_OPERASIONAL", "PENJAGA_TEKNISI"];

export const STAFF_ROLE_META: Record<
  StaffAccessRole,
  { label: string; short: string; pill: string; desc: string; permissions: string[] }
> = {
  ADMIN_OPERASIONAL: {
    label: "Admin Operasional",
    short: "Staff Admin",
    pill: "bg-sky-600 text-white",
    desc: "Mendampingi owner mengelola operasional harian properti.",
    permissions: [
      "Input kamar & data unit",
      "Catat pembayaran & buku kas",
      "Ubah status sewa & kontrak",
      "Broadcast pengumuman",
      "Respon komplain & pemeliharaan",
    ],
  },
  PENJAGA_TEKNISI: {
    label: "Penjaga / Lapangan",
    short: "Penjaga",
    pill: "bg-amber-500 text-white",
    desc: "Fokus lapangan — pemantauan unit & pencatatan teknis.",
    permissions: [
      "Lihat status kamar (read-only)",
      "Catat komplain / pemeliharaan",
      "Catat meteran listrik",
    ],
  },
};

/** Label pill untuk banner identitas (dipakai page.tsx → property-banner) */
export function staffRoleLabel(role: StaffAccessRole): string {
  return STAFF_ROLE_META[role].short;
}

// ── Mini store (localStorage + custom event → useSyncExternalStore) ──────────

function readList(): StaffAccessMember[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STAFF_ACCESS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Migrasi senyap: staf lama (pra-PIN) diberi accessPin acak agar portal
    // tetap berfungsi — owner bisa melihatnya via tombol intip di daftar staf.
    let changed = false;
    const normalized = (parsed as StaffAccessMember[]).map((m) => {
      if (typeof m.accessPin === "string" && isValidPinFormat(m.accessPin)) return m;
      changed = true;
      return { ...m, accessPin: generatePin() };
    });
    if (changed) {
      // Tulis senyap tanpa dispatch event — hindari loop re-render snapshot.
      window.localStorage.setItem(STAFF_ACCESS_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return [];
  }
}

function writeList(members: StaffAccessMember[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STAFF_ACCESS_KEY, JSON.stringify(members));
  window.dispatchEvent(new Event(STAFF_EVENT));
}

let accessCache: StaffAccessMember[] | null = null;

/** useSyncExternalStore sinkron — selalu baca cache agar stabil */
export function subscribeStaffAccess(onChange: () => void): () => void {
  const handler = () => {
    accessCache = readList();
    onChange();
  };
  if (typeof window !== "undefined") window.addEventListener(STAFF_EVENT, handler);
  return () => {
    if (typeof window !== "undefined") window.removeEventListener(STAFF_EVENT, handler);
  };
}

export function getStaffAccessSnapshot(): StaffAccessMember[] {
  if (typeof window === "undefined") return EMPTY_STAFF;
  if (!accessCache) accessCache = readList();
  return accessCache;
}

export function getServerStaffAccessSnapshot(): StaffAccessMember[] {
  return EMPTY_STAFF;
}

const EMPTY_STAFF: StaffAccessMember[] = [];

// ── CRUD daftar staf (owner side) ────────────────────────────────────────────

function nextId(): string {
  if (typeof window !== "undefined" && "crypto" in window && crypto.randomUUID) {
    return `stf_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
  }
  return `stf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Token akses tak-tebak — "stk_" + 16 byte hex */
export function generateAccessToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof window !== "undefined" && "crypto" in window && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `stk_${hex}`;
}

/** PIN 6 digit acak — tiap digit 0-9 via crypto (fallback Math.random) */
export function generatePin(): string {
  const digits = new Uint8Array(6);
  if (typeof window !== "undefined" && "crypto" in window && crypto.getRandomValues) {
    crypto.getRandomValues(digits);
  } else {
    for (let i = 0; i < digits.length; i++) digits[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(digits, (b) => String(b % 10)).join("");
}

/** Format PIN valid: tepat 6 karakter angka */
export function isValidPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin.trim());
}

/** Bandingkan PIN masukan staf dengan PIN terdaftar */
export function verifyStaffPin(member: Pick<StaffAccessMember, "accessPin">, pin: string): boolean {
  return isValidPinFormat(member.accessPin) && member.accessPin === pin.trim();
}

/** Mask PIN utk daftar owner: "123456" → "••••56" (2 digit akhir terlihat) */
export function maskPin(pin: string): string {
  if (!isValidPinFormat(pin)) return "——";
  return `••••${pin.slice(-2)}`;
}

export interface AddStaffAccessInput {
  name: string;
  phone: string;
  role: StaffAccessRole;
  propertyId: string;
  accessPin: string;
}

export function addStaffAccess(input: AddStaffAccessInput): StaffAccessMember {
  if (!isValidPinFormat(input.accessPin)) {
    throw new Error("PIN harus tepat 6 digit angka.");
  }
  const member: StaffAccessMember = {
    id: nextId(),
    propertyId: input.propertyId,
    name: input.name.trim(),
    phone: input.phone.trim(),
    role: input.role,
    accessToken: generateAccessToken(),
    accessPin: input.accessPin.trim(),
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  const list = readList();
  writeList([...list, member]);
  accessCache = null;
  return member;
}

/** Cabut (nonaktifkan) / aktifkan kembali akses staf */
export function setStaffAccessActive(id: string, isActive: boolean): StaffAccessMember[] {
  const list = readList().map((m) => (m.id === id ? { ...m, isActive } : m));
  writeList(list);
  accessCache = null;
  // Token dicabut → sesi perangkat mana pun dengan token itu tidak valid lagi
  if (!isActive) {
    const revoked = list.find((m) => m.id === id);
    const session = readSession();
    if (revoked && session && session.accessToken === revoked.accessToken) {
      clearStaffSession();
    }
  }
  return list;
}

export function deleteStaffAccess(id: string): StaffAccessMember[] {
  const list = readList().filter((m) => m.id !== id);
  writeList(list);
  accessCache = null;
  const session = readSession();
  if (session && !list.some((m) => m.accessToken === session.accessToken)) {
    clearStaffSession();
  }
  return list;
}

// ── Verifikasi token & sesi staf (portal /staff) ─────────────────────────────

export type StaffTokenResolution =
  | { status: "valid"; member: StaffAccessMember }
  | { status: "revoked"; member: StaffAccessMember }
  | { status: "invalid" };

/** Token → staf (client-side atas daftar akses lokal; seam API siap di schema) */
export function resolveStaffToken(token: string): StaffTokenResolution {
  const clean = token.trim();
  if (!clean) return { status: "invalid" };
  const member = readList().find((m) => m.accessToken === clean);
  if (!member) return { status: "invalid" };
  return member.isActive ? { status: "valid", member } : { status: "revoked", member };
}

/**
 * Simpan sesi staf — HANYA dipanggil setelah PIN 6 digit terverifikasi
 * (kini diverifikasi server via GET /api/staff?token=…&pin=…).
 * `pinVerified` selalu true di sini.
 */
export function saveStaffSession(
  member: Pick<StaffAccessMember, "id" | "name" | "role" | "phone" | "propertyId" | "accessToken">,
): StaffSession {
  const session: StaffSession = {
    id: member.id,
    name: member.name,
    role: member.role,
    phone: member.phone,
    propertyId: member.propertyId,
    accessToken: member.accessToken,
    pinVerified: true,
    startedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new Event(STAFF_EVENT));
  }
  return session;
}

function readSession(): StaffSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STAFF_SESSION_KEY);
    return raw ? (JSON.parse(raw) as StaffSession) : null;
  } catch {
    return null;
  }
}

let sessionCache: StaffSession | null | undefined;

export function subscribeStaffSession(onChange: () => void): () => void {
  const handler = () => {
    sessionCache = readSession();
    onChange();
  };
  if (typeof window !== "undefined") window.addEventListener(STAFF_EVENT, handler);
  return () => {
    if (typeof window !== "undefined") window.removeEventListener(STAFF_EVENT, handler);
  };
}

export function getStaffSessionSnapshot(): StaffSession | null {
  if (typeof window === "undefined") return null;
  if (sessionCache === undefined) sessionCache = readSession();
  return sessionCache;
}

export function getServerStaffSessionSnapshot(): StaffSession | null {
  return null;
}

export function clearStaffSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STAFF_SESSION_KEY);
  sessionCache = undefined;
  window.dispatchEvent(new Event(STAFF_EVENT));
}

// ── Link & WhatsApp ──────────────────────────────────────────────────────────

/** Domain produksi fallback untuk tautan undangan staf */
export const STAFF_PORTAL_FALLBACK_ORIGIN = "https://unitku.vercel.app";

/** Tautan portal staf — origin dinamis (localhost/preview) fallback unitku.vercel.app */
export function staffPortalLink(token: string, origin?: string): string {
  const base = (origin ?? "").trim().replace(/\/+$/, "");
  return `${base || STAFF_PORTAL_FALLBACK_ORIGIN}/staff?token=${token}`;
}

/** Deep-link internal (tab baru dari dashboard, relative → works di sandbox) */
export function staffPortalPath(token: string): string {
  return `/staff?token=${token}`;
}

/** "0813-7710-4455" / "+62 813…" → "6281377104455" untuk wa.me */
export function normalizeWaDigits(phone: string): string {
  let d = phone.replace(/[^0-9]/g, "");
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  return d;
}

/** Template pesan undangan akses + PIN keamanan (spec) */
export function waInviteMessage(name: string, link: string, pin: string): string {
  return `Halo ${name}, berikut tautan kerja sistem UnitKu Anda: ${link}. PIN Keamanan Anda: ${pin}. Simpan pesan ini untuk login.`;
}

/** wa.me deep-link dengan pesan undangan (link + PIN) terisi */
export function waInviteLink(phone: string, name: string, link: string, pin: string): string {
  return `https://wa.me/${normalizeWaDigits(phone)}?text=${encodeURIComponent(
    waInviteMessage(name, link, pin),
  )}`;
}

// ── Util kecil ───────────────────────────────────────────────────────────────

/** Inisial nama — "Ratna Sari" → "RS" */
export function initialsOfStaff(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "S";
}

/** Pilih id properti default utk staf baru (properti aktif pertama) */
export function defaultStaffProperty(properties: PropertyEntry[]): string {
  return properties[0]?.id ?? "";
}
