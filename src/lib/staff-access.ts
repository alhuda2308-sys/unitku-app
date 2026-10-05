// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Pendaftaran & Manajemen Akses Staf Mandiri
//
// Owner membuat staf + link akses unik (/staff?token=…) + PIN keamanan 6 digit.
// Staf membuka tautan → token diverifikasi SERVER (tabel staff_members,
// Supabase, via /api/staff) → layar kunci PIN → sesi "Staf Aktif (terverifikasi
// PIN)" disimpan di localStorage — dashboard lalu menyesuaikan identitas
// header & membatasi menu sesuai peran.
//
// ARSITEKTUR DATA (cloud-first):
//   • DATA staf (nama, WA, peran, token akses, PIN) — 100% tabel
//     `staff_members` via /api/staff (CRUD di staff-access-manager.tsx) →
//     tersinkron lintas perangkat. localStorage BUKAN penyimpanan data staf.
//   • SESI perangkat ("staf sedang login di browser ini") — localStorage
//     (STAFF_SESSION_KEY): ini kunci sesi, bukan data master — perilaku sama
//     dengan sesi login owner.
// ─────────────────────────────────────────────────────────────────────────────

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

// ── Util PIN (dipakai modal tambah staf & portal /staff) ─────────────────────

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

/** Mask PIN utk daftar owner: "123456" → "••••56" (2 digit akhir terlihat) */
export function maskPin(pin: string): string {
  if (!isValidPinFormat(pin)) return "——";
  return `••••${pin.slice(-2)}`;
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

