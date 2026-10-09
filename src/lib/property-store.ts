"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Multi-Properti (Cabang Kost) master registry
// Daftar properti milik akun + properti aktif, persisted di localStorage
// ("indokost:properties:v1") supaya properti baru buatan pemilik tetap ada
// setelah reload. Pola sama dengan use-custom-categories: in-memory cache untuk
// snapshot identity yang stabil + pub/sub in-session antar komponen.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_FACILITIES_BY_TYPE, type Room } from "@/lib/kost-data";
import {
  PROPERTY_TYPE_META,
  isPropertyType,
  unitLabelOf,
  type BillingCycle,
  type PropertyType,
} from "@/lib/property-types";

export interface PropertyRekening {
  bank: string;
  number: string;
  holder: string;
}

/** Profil lengkap satu properti/cabang sewa (settings → Daftar & Kelola Properti) */
export interface ManagedProperty {
  id: string;
  name: string;
  /** Kategori properti — menentukan label unit di seluruh UI (Kamar / Pintu / Unit) */
  type: PropertyType;
  address: string; // Alamat Lengkap (jalan & nomor)
  kelurahan: string; // Kelurahan/Kecamatan
  city: string; // Kota
  /** Foto fasad/bangunan — path publik, URL eksternal, atau data URL. "" = pakai placeholder */
  imageUrl: string;
  floors: number; // Jumlah Lantai
  targetRooms: number; // Target / Estimasi Jumlah Unit
  admin: string; // Admin/Penjaga yang ditugaskan
  rules: string; // Aturan hunian (jam malam & lainnya)
  jamMalam: string; // "22:00"
  rekening: PropertyRekening | null; // Rekening penampung per properti
  createdAt: string; // ISO
}

/** Payload form "+ Tambah Properti Baru" / "Edit Info Properti" */
export interface PropertyDraft {
  name: string;
  type: PropertyType;
  address: string;
  kelurahan: string;
  city: string;
  imageUrl: string;
  floors: number;
  targetRooms: number;
  admin: string;
  rules: string;
  jamMalam: string;
  rekening: PropertyRekening | null;
}

const STORAGE_KEY = "indokost:properties:v1";
const MAX_NAME = 80;
const MAX_TEXT = 600;

interface PropertyStore {
  properties: ManagedProperty[];
  activeId: string;
}

const SEED_PROPERTIES: ManagedProperty[] = [
  {
    id: "kgp",
    name: "Kost Griya Pratama",
    type: "kost",
    address: "Jl. Cendana Raya No. 45",
    kelurahan: "Kel. Sukamaju, Kec. Cibinong",
    city: "Kab. Bogor",
    imageUrl: "/properties/kost-griya-pratama.png",
    floors: 2,
    targetRooms: 24,
    admin: "Slamet Riyadi (Penjaga)",
    rules:
      "1. Jam malam pukul 22.00 — tamu tidak boleh melewati jam tersebut.\n2. Dilarang merokok di dalam kamar & area umum.\n3. Tamu menginap wajib lapor penjaga (maks. 2 malam).\n4. Tagihan dibayar paling lambat tanggal 28 setiap bulan.",
    jamMalam: "22:00",
    rekening: { bank: "BCA", number: "1234567890", holder: "Hendra Wijaya" },
    createdAt: "2024-01-12T00:00:00.000Z",
  },
  {
    id: "kmi",
    name: "Kost Melati Indah",
    type: "kost",
    address: "Jl. Melati Indah Raya No. 12",
    kelurahan: "Kel. Paledang, Kec. Bogor Tengah",
    city: "Kota Bogor",
    imageUrl: "/properties/kost-melati-indah.png",
    floors: 2,
    targetRooms: 16,
    admin: "Siti Aminah (Penjaga)",
    rules:
      "1. Pintu gerbang ditutup pukul 23.00 WIB.\n2. Dilarang membawa hewan peliharaan.\n3. Tamu wajib lapor penjaga.\n4. Pembayaran sewa di awal tanggal.",
    jamMalam: "23:00",
    rekening: { bank: "Mandiri", number: "9876543210", holder: "Hendra Wijaya" },
    createdAt: "2024-06-01T00:00:00.000Z",
  },
];

// ── Sanitizers (toleran terhadap storage lama / manual edit) ─────────────────

function asText(value: unknown, max = MAX_NAME): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function asMultiline(value: unknown): string {
  return typeof value === "string" ? value.slice(0, MAX_TEXT) : "";
}

function asInt(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : 0;
}

function asRekening(value: unknown): PropertyRekening | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Partial<PropertyRekening>;
  const bank = asText(r.bank, 24);
  const number = asText(r.number, 24);
  const holder = asText(r.holder, 60);
  if (!bank && !number) return null;
  return { bank, number, holder };
}

/** Foto fasad: path publik ("/…"), URL http(s), atau data URL gambar — selain itu "" */
function asImageUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (!v || v.length > 400_000) return "";
  if (v.startsWith("data:image/") || v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/")) return v;
  return "";
}

function sanitizeProperty(raw: unknown, index: number): ManagedProperty | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<ManagedProperty>;
  const id = asText(p.id, 32) || `kp-${index + 1}`;
  const name = asText(p.name);
  if (!name) return null;
  return {
    id,
    name,
    type: isPropertyType(p.type) ? p.type : "kost",
    address: asText(p.address, 160),
    kelurahan: asText(p.kelurahan, 120),
    city: asText(p.city, 80),
    imageUrl: asImageUrl(p.imageUrl),
    floors: asInt(p.floors),
    targetRooms: asInt(p.targetRooms),
    admin: asText(p.admin, 80),
    rules: asMultiline(p.rules),
    jamMalam: /^\d{2}:\d{2}$/.test(String(p.jamMalam)) ? String(p.jamMalam) : "",
    rekening: asRekening(p.rekening),
    createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date().toISOString(),
  };
}

// ── In-memory cache over localStorage ────────────────────────────────────────

let cache: PropertyStore = { properties: SEED_PROPERTIES, activeId: "kgp" };
let cacheValid = false;

function readStore(): PropertyStore {
  if (typeof window === "undefined") return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cache;
    const parsed = JSON.parse(raw) as Partial<PropertyStore>;
    const properties = (Array.isArray(parsed.properties) ? parsed.properties : [])
      .map(sanitizeProperty)
      .filter((p): p is ManagedProperty => p !== null);
    // Seed properties always present (built-in demo portfolio)
    for (const seed of SEED_PROPERTIES) {
      if (!properties.some((p) => p.id === seed.id)) properties.push(seed);
    }
    const list = properties.length > 0 ? properties : SEED_PROPERTIES;
    const activeId = list.some((p) => p.id === parsed.activeId) ? (parsed.activeId as string) : list[0].id;
    return { properties: list, activeId };
  } catch {
    return cache;
  }
}

function getSnapshot(): PropertyStore {
  if (!cacheValid) {
    cache = readStore();
    cacheValid = true;
  }
  return cache;
}

const getServerSnapshot = (): PropertyStore => cache;

// ── In-session + cross-tab sync ──────────────────────────────────────────────

const listeners = new Set<() => void>();

function publish(): void {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cacheValid = false;
      publish();
    }
  });
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function writeStore(next: PropertyStore): void {
  cache = next;
  cacheValid = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // private mode / quota exceeded — in-memory state still works this session
  }
  publish();
}

// ── ID generator ("kp-1", "kp-2", …) ─────────────────────────────────────────

export function nextPropertyId(properties: ManagedProperty[]): string {
  let max = 0;
  for (const p of properties) {
    const m = /^kp-(\d+)$/.exec(p.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `kp-${max + 1}`;
}

// ── 16 kamar kosong untuk seed "Kost Melati Indah" (2 lantai × 8) ────────────

export function seedVacantRooms(count: number): Room[] {
  return Array.from({ length: count }, (_, i) => {
    const floor = Math.floor(i / 8) + 1;
    const id = `${floor}${String((i % 8) + 1).padStart(2, "0")}`;
    return {
      id,
      floor,
      type: "Tipe B - Kipas",
      price: 1_100_000,
      status: "kosong" as const,
      facilities: [...(DEFAULT_FACILITIES_BY_TYPE["Tipe B - Kipas"] ?? [])],
    };
  });
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useProperties() {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setActiveProperty = useCallback((id: string): void => {
    const current = getSnapshot();
    if (!current.properties.some((p) => p.id === id) || current.activeId === id) return;
    writeStore({ ...current, activeId: id });
  }, []);

  /** Buat properti baru → langsung masuk daftar & menjadi properti aktif. */
  const addProperty = useCallback((draft: PropertyDraft): ManagedProperty => {
    const current = getSnapshot();
    const created: ManagedProperty = {
      id: nextPropertyId(current.properties),
      name: draft.name.trim().slice(0, MAX_NAME),
      type: isPropertyType(draft.type) ? draft.type : "kost",
      address: asText(draft.address, 160),
      kelurahan: asText(draft.kelurahan, 120),
      city: asText(draft.city, 80),
      imageUrl: asImageUrl(draft.imageUrl),
      floors: asInt(draft.floors),
      targetRooms: asInt(draft.targetRooms),
      admin: asText(draft.admin, 80),
      rules: asMultiline(draft.rules),
      jamMalam: /^\d{2}:\d{2}$/.test(draft.jamMalam) ? draft.jamMalam : "",
      rekening: asRekening(draft.rekening),
      createdAt: new Date().toISOString(),
    };
    writeStore({
      properties: [...current.properties, created],
      activeId: created.id, // otomatis terpilih sebagai properti aktif
    });
    return created;
  }, []);

  const updateProperty = useCallback((id: string, draft: PropertyDraft): void => {
    const current = getSnapshot();
    writeStore({
      ...current,
      properties: current.properties.map((p) =>
        p.id === id
          ? {
              ...p,
              name: draft.name.trim().slice(0, MAX_NAME),
              type: isPropertyType(draft.type) ? draft.type : "kost",
              address: asText(draft.address, 160),
              kelurahan: asText(draft.kelurahan, 120),
              city: asText(draft.city, 80),
              imageUrl: asImageUrl(draft.imageUrl),
              floors: asInt(draft.floors),
              targetRooms: asInt(draft.targetRooms),
              admin: asText(draft.admin, 80),
              rules: asMultiline(draft.rules),
              jamMalam: /^\d{2}:\d{2}$/.test(draft.jamMalam) ? draft.jamMalam : "",
              rekening: asRekening(draft.rekening),
            }
          : p
      ),
    });
  }, []);

  /** Hapus properti; bila properti aktif terhapus → aktif pindah ke properti pertama. */
  const removeProperty = useCallback((id: string): void => {
    const current = getSnapshot();
    const properties = current.properties.filter((p) => p.id !== id);
    if (properties.length === current.properties.length) return;
    const activeId =
      current.activeId === id ? properties[0]?.id ?? "" : current.activeId;
    writeStore({ properties, activeId });
  }, []);

  /** Ganti/hapus foto fasad satu properti tanpa menyentuh field lain. */
  const updatePropertyImage = useCallback((id: string, imageUrl: string): void => {
    const current = getSnapshot();
    if (!current.properties.some((p) => p.id === id)) return;
    writeStore({
      ...current,
      properties: current.properties.map((p) => (p.id === id ? { ...p, imageUrl: asImageUrl(imageUrl) } : p)),
    });
  }, []);

  return {
    properties: store.properties,
    activeId: store.activeId,
    activeProperty: store.properties.find((p) => p.id === store.activeId) ?? store.properties[0] ?? null,
    setActiveProperty,
    addProperty,
    updateProperty,
    removeProperty,
    updatePropertyImage,
  };
}

// ── Label unit dinamis (Kamar / Pintu / Unit) mengikuti tipe properti aktif ─

export interface UnitLabels {
  type: PropertyType;
  /** Nama kategori singkat — "Kost" / "Kontrakan" / "Rusun / Apartemen" */
  shortName: string;
  /** Kata benda lengkap utk label form: "Kamar" / "Pintu / Petak" / "Unit" */
  noun: string;
  /** Kata benda ringkas utk chip/kartu: "Kamar" / "Pintu" / "Unit" */
  short: string;
  /** "Denah Kamar" / "Denah Unit / Pintu" / "Denah Unit" */
  denahHeading: string;
  /** Frasa WA: "Kamar" / "Kontrakan Pintu" / "Unit" */
  waNoun: string;
  /** Label satu unit: "Kamar 101" / "Pintu 02" / "Unit 3B" */
  label: (id: string) => string;
}

export function unitLabelsFor(type: PropertyType): UnitLabels {
  const meta = PROPERTY_TYPE_META[type];
  return {
    type,
    shortName: meta.shortName,
    noun: meta.unitNoun,
    short: meta.unitShort,
    denahHeading: meta.denahHeading,
    waNoun: meta.waNoun,
    label: (id: string) => unitLabelOf(type, id),
  };
}

/** Label unit mengikuti tipe properti AKTIF — gunakan di komponen UI mana pun */
export function useUnitLabels(): UnitLabels {
  const { activeProperty } = useProperties();
  const type = activeProperty?.type ?? "kost";
  return useMemo(() => unitLabelsFor(type), [type]);
}

export type { BillingCycle };
