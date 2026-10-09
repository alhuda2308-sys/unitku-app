"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Profil akun pengelola & identitas pengirim tagihan WhatsApp
//
// Dua sumber identitas akun yang sedang login:
//   1. Owner          → profil tersimpan di localStorage "indokost:owner-profile:v1"
//   2. Staf / Penjaga → nomor WhatsApp tersimpan pada StaffMember.phone (staff-store)
//
// Pola store sama dengan staff-store: in-memory cache (snapshot identity stabil),
// pub/sub in-session antar komponen, sinkron lintas-tab via storage event.
// Seed hanya ditulis saat key BELUM ada.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useSyncExternalStore } from "react";
import { waDigits } from "./kost-data";
import { STAFF_ROLE_META, type StaffMember } from "./staff-store";

export interface OwnerProfile {
  name: string;
  email: string;
  /** Nomor WhatsApp pengelola — identitas pengirim & narahubung tagihan */
  phone: string;
}

/** Identitas akun yang sedang login (Owner atau staf) — dipakai generator pesan WA */
export interface CurrentAccount {
  id: string; // "owner" | "st-1" | ...
  name: string;
  roleLabel: string;
  /** Nomor WhatsApp mentah seperti tersimpan (cth. "0812-8765-4321") */
  phone: string;
  /** Digit wa.me siap pakai (cth. "6281287654321") — "" bila nomor belum diisi */
  phoneDigits: string;
}

const PROFILE_KEY = "indokost:owner-profile:v1";
const MAX_NAME = 60;
const MAX_PHONE = 24;

const SEED_PROFILE: OwnerProfile = {
  name: "Hendra Wijaya",
  email: "hendra@indokost.id",
  phone: "0812-8765-4321",
};

// ── Sanitizers ───────────────────────────────────────────────────────────────

function asText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function sanitizeProfile(raw: unknown): OwnerProfile {
  if (!raw || typeof raw !== "object") return { ...SEED_PROFILE };
  const p = raw as Partial<OwnerProfile>;
  return {
    name: asText(p.name, MAX_NAME) || SEED_PROFILE.name,
    email: asText(p.email, 80) || SEED_PROFILE.email,
    phone: asText(p.phone, MAX_PHONE),
  };
}

// ── Owner profile store ──────────────────────────────────────────────────────

let profileCache: OwnerProfile = SEED_PROFILE;
let profileValid = false;

function readProfile(): OwnerProfile {
  if (typeof window === "undefined") return profileCache;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(SEED_PROFILE));
      return SEED_PROFILE;
    }
    return sanitizeProfile(JSON.parse(raw) as unknown);
  } catch {
    return profileCache;
  }
}

function getProfileSnapshot(): OwnerProfile {
  if (!profileValid) {
    profileCache = readProfile();
    profileValid = true;
  }
  return profileCache;
}

const getProfileServerSnapshot = (): OwnerProfile => SEED_PROFILE;

const profileListeners = new Set<() => void>();

function publishProfile(): void {
  profileListeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === PROFILE_KEY) {
      profileValid = false;
      publishProfile();
    }
  });
}

function subscribeProfile(callback: () => void): () => void {
  profileListeners.add(callback);
  return () => {
    profileListeners.delete(callback);
  };
}

function writeProfile(next: OwnerProfile): void {
  profileCache = next;
  profileValid = true;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    // private mode / quota exceeded — in-memory still works this session
  }
  publishProfile();
}

export function useOwnerProfile() {
  const profile = useSyncExternalStore(subscribeProfile, getProfileSnapshot, getProfileServerSnapshot);

  /** Simpan nomor WhatsApp pengelola (dipakai sebagai pengirim tagihan) */
  const updateOwnerPhone = useCallback((phone: string): void => {
    writeProfile({ ...getProfileSnapshot(), phone: phone.trim().slice(0, MAX_PHONE) });
  }, []);

  return { profile, updateOwnerPhone };
}

// ── Resolusi akun aktif ──────────────────────────────────────────────────────

/**
 * Identitas akun yang sedang login untuk draf pesan tagihan:
 * staf aktif → StaffMember.phone, selain itu → profil Owner.
 */
export function currentUserAccount(args: {
  sessionUserId: string;
  staff: StaffMember[];
  ownerProfile: OwnerProfile;
}): CurrentAccount {
  const active = args.staff.find((s) => s.id === args.sessionUserId && s.status === "aktif") ?? null;
  if (active) {
    return {
      id: active.id,
      name: active.name,
      roleLabel: STAFF_ROLE_META[active.role].label,
      phone: active.phone,
      phoneDigits: waDigits(active.phone),
    };
  }
  return {
    id: "owner",
    name: args.ownerProfile.name,
    roleLabel: "Owner · Admin",
    phone: args.ownerProfile.phone,
    phoneDigits: waDigits(args.ownerProfile.phone),
  };
}
