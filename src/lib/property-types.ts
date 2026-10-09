// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Tipe Properti Sewa Multi-Kategori & Siklus Sewa Fleksibel
// Sumber tunggal untuk: metadata tipe properti (Kost / Kontrakan / Rusun),
// label unit dinamis di seluruh UI, dan mapping siklus tagihan → jumlah bulan.
// File ini SENGAJA tanpa dependency supaya aman diimpor lib mana pun
// (kost-data, kost-invoices, property-store, komponen) tanpa circular import.
// ─────────────────────────────────────────────────────────────────────────────

// ── Tipe properti ────────────────────────────────────────────────────────────

export type PropertyType = "kost" | "kontrakan" | "rusun";

export interface PropertyTypeMeta {
  /** Label dropdown "Tipe Properti" */
  label: string;
  /** Kata benda unit lengkap — dipakai label form & tabel: "Kamar" / "Pintu / Petak" / "Unit" */
  unitNoun: string;
  /** Kata benda unit ringkas — dipakai kartu & chip: "Kamar" / "Pintu" / "Unit" */
  unitShort: string;
  /** Judul halaman denah: "Denah Kamar" / "Denah Unit / Pintu" / "Denah Unit" */
  denahHeading: string;
  /** Frasa WA: "Kamar" / "Kontrakan Pintu" / "Unit" → "Tagihan Sewa Kamar 101" */
  waNoun: string;
  /** Nama kategori singkat — placeholder & copy: "Kost" / "Kontrakan" / "Rusun / Apartemen" */
  shortName: string;
  /** Contoh penamaan unit pada hint form */
  examples: string;
}

export const PROPERTY_TYPE_META: Record<PropertyType, PropertyTypeMeta> = {
  kost: {
    label: "Rumah Kost",
    unitNoun: "Kamar",
    unitShort: "Kamar",
    denahHeading: "Denah Kamar",
    waNoun: "Kamar",
    shortName: "Kost",
    examples: "Kamar 101 · Kamar 102",
  },
  kontrakan: {
    label: "Kontrakan / Rumah Petak",
    unitNoun: "Pintu / Petak",
    unitShort: "Pintu",
    denahHeading: "Denah Unit / Pintu",
    waNoun: "Kontrakan Pintu",
    shortName: "Kontrakan",
    examples: "Pintu 02 · Petak A",
  },
  rusun: {
    label: "Rusun / Paviliun / Apartemen",
    unitNoun: "Unit",
    unitShort: "Unit",
    denahHeading: "Denah Unit",
    waNoun: "Unit",
    shortName: "Rusun / Apartemen",
    examples: "Unit 3B · Unit 4A",
  },
};

/** Guard untuk storage lama / nilai tak dikenal → fallback "kost" */
export function isPropertyType(value: unknown): value is PropertyType {
  return value === "kost" || value === "kontrakan" || value === "rusun";
}

export function propertyTypeMeta(type: PropertyType): PropertyTypeMeta {
  return PROPERTY_TYPE_META[type];
}

/** Label satu unit: "Kamar 101" / "Pintu 02" / "Unit 3B" */
export function unitLabelOf(type: PropertyType, id: string): string {
  return `${PROPERTY_TYPE_META[type].unitShort} ${id}`;
}

// ── Siklus sewa (durasi pembayaran dalam kelipatan bulan) ────────────────────

export type BillingCycle = "Bulanan" | "Per 3 Bulan" | "Per 6 Bulan" | "Tahunan";

/** Kelipatan bulan per siklus — kunci kalkulasi total invoice & jatuh tempo berikutnya */
export const CYCLE_MONTHS: Record<BillingCycle, number> = {
  Bulanan: 1,
  "Per 3 Bulan": 3,
  "Per 6 Bulan": 6,
  Tahunan: 12,
};

export const CYCLE_OPTIONS: {
  value: BillingCycle;
  label: string;
  months: number;
  sub: string;
}[] = [
  { value: "Bulanan", label: "Bulanan", months: 1, sub: "1 Bulan" },
  { value: "Per 3 Bulan", label: "Per 3 Bulan", months: 3, sub: "Kuartalan · 3 Bulan" },
  { value: "Per 6 Bulan", label: "Per 6 Bulan", months: 6, sub: "Semesteran · 6 Bulan" },
  { value: "Tahunan", label: "Tahunan", months: 12, sub: "12 Bulan" },
];

export function cycleMonths(cycle: BillingCycle | undefined): number {
  return cycle ? CYCLE_MONTHS[cycle] ?? 1 : 1;
}
