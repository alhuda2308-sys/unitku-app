// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Mock data & domain types (Phase 1: Room Matrix & Tenant Overview)
// Snapshot date: 26 Sep 2026 (fixed for deterministic mock rendering)
// ─────────────────────────────────────────────────────────────────────────────

export type RoomStatus = "lunas" | "jatuhTempo" | "menunggak" | "kosong";

/** Status operasional kamar — terpisah dari status tagihan (RoomStatus) */
export type OperationalStatus = "siap" | "perbaikan" | "nonaktif";

export const OPERATIONAL_META: Record<
  OperationalStatus,
  { label: string; hint: string }
> = {
  siap: { label: "Siap Huni", hint: "Kamar dapat di-check-in seperti biasa." },
  perbaikan: { label: "Sedang Perbaikan", hint: "Tidak muncul pada daftar check-in sampai dinyatakan siap." },
  nonaktif: { label: "Nonaktif", hint: "Kamar dinonaktifkan (dijual/gabung) — tidak bisa diisi." },
};

/** Checkbox pills fasilitas (modal kelola/tambah kamar) */
export const FACILITY_OPTIONS = [
  "AC",
  "Kamar Mandi Dalam",
  "Kasur Queen",
  "Lemari",
  "Meteran Listrik Terpisah",
] as const;

/** Dropdown Tipe Kamar — tipe existing + opsi spec (Standar, AC Deluxe, VIP) */
export const ROOM_TYPE_OPTIONS = [
  "Tipe A - AC",
  "Tipe B - Kipas",
  "Tipe AC Deluxe",
  "Standar",
  "VIP",
] as const;

/** Fasilitas default saat kamar baru dibuat per tipe */
export const DEFAULT_FACILITIES_BY_TYPE: Record<string, string[]> = {
  "Tipe A - AC": ["AC", "Kamar Mandi Dalam", "Kasur Queen", "Lemari"],
  "Tipe B - Kipas": ["Kamar Mandi Dalam", "Kasur Queen", "Lemari"],
  "Tipe AC Deluxe": ["AC", "Kamar Mandi Dalam", "Kasur Queen", "Lemari", "Meteran Listrik Terpisah"],
  Standar: ["Kasur Queen", "Lemari"],
  VIP: ["AC", "Kamar Mandi Dalam", "Kasur Queen", "Lemari", "Meteran Listrik Terpisah"],
};

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface Tenant {
  name: string;
  phone: string;
  moveInDate: string; // already formatted, e.g. "12 Jan 2026"
  emergencyContact: EmergencyContact;
  /** Magic-link token akses Portal Penyewa (unik per penghuni) — "tok_102_98ad2f" */
  portalToken: string;
}

export interface Invoice {
  amount: number;
  periodLabel: string; // e.g. "Sewa Okt 2026" / "Sewa Sep 2026"
  dueLabel: string; // e.g. "Tempo: 28 Sep"
  /** Negative = due in N days (H-N), positive = overdue N days (H+N) */
  dayOffset?: number;
}

export interface Room {
  id: string; // "101", "A-01", "Paviliun Barat"
  floor: number;
  type: string; // "Tipe A - AC"
  price: number; // monthly rent, IDR
  status: RoomStatus;
  facilities?: string[];
  operational?: OperationalStatus; // undefined = "siap"
  tenant?: Tenant;
  invoice?: Invoice;
  contract?: {
    duration: "Bulanan" | "Per 3 Bulan" | "Tahunan";
    startDate: string;
    /** Kontrak berakhir — undefined = rolling (auto-renew bulanan). Used by Data Penghuni. */
    endDate?: string;
    deposit: number;
    depositHeld: boolean;
  };
}

export interface Property {
  id: string;
  name: string;
  roomCount: number;
}

// ── Formatting helpers ───────────────────────────────────────────────────────

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatIDR(value: number): string {
  return idr.format(value).replace(/\s/g, "");
}

/** "1500000" -> "Rp1,5 jt" — compact label for empty-room cards */
export function formatIDRShort(value: number): string {
  if (value >= 1_000_000) {
    const juta = value / 1_000_000;
    const txt = Number.isInteger(juta) ? juta.toString() : juta.toFixed(1).replace(".", ",");
    return `Rp${txt} jt`;
  }
  return formatIDR(value);
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function waLink(phone: string): string {
  // Normalisasi nomor Indonesia utk wa.me — "0813…" / "813…" → "62813…"
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return `https://wa.me/${digits}`;
}

// ── Portal Penyewa — magic token link ───────────────────────────────────────

/** Slug aman-URL dari nomor/nama kamar: "102" → "102", "Paviliun Barat" → "paviliunbarat" */
function portalTokenSlug(roomId: string): string {
  return roomId.toLowerCase().replace(/[^a-z0-9]/g, "") || "kamar";
}

/** Digest FNV-1a 6-hex — token seed yang stabil antar-reload (mock master data) */
function fnv6Hex(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 6);
}

/** Token portal deterministik untuk seed data — "tok_102_98ad2f" */
export function seededPortalToken(roomId: string): string {
  return `tok_${portalTokenSlug(roomId)}_${fnv6Hex(`indokost-portal-${roomId}`)}`;
}

/** Token portal acak untuk penghuni baru (check-in) — format sama, selalu unik */
export function newPortalToken(roomId: string): string {
  const hex = Array.from(
    { length: 6 },
    () => "0123456789abcdef"[(Math.random() * 16) | 0]
  ).join("");
  return `tok_${portalTokenSlug(roomId)}_${hex}`;
}

// ── Status metadata (badge labels, pill classes) ────────────────────────────

export const STATUS_META: Record<
  RoomStatus,
  { label: string; dot: string; pill: string; tabLabel: string }
> = {
  lunas: {
    label: "Lunas",
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
    tabLabel: "Lunas",
  },
  jatuhTempo: {
    label: "Jatuh Tempo",
    dot: "bg-amber-500",
    pill: "bg-amber-50 text-amber-700 border-amber-200",
    tabLabel: "Jatuh Tempo",
  },
  menunggak: {
    label: "Menunggak",
    dot: "bg-red-500",
    pill: "bg-red-50 text-red-700 border-red-200",
    tabLabel: "Menunggak",
  },
  kosong: {
    label: "Kosong",
    dot: "bg-zinc-400",
    pill: "bg-zinc-100 text-zinc-700 border-zinc-200",
    tabLabel: "Kosong",
  },
};

/** Badge text on a room card: "Lunas", "H-2", "H+3", "Kosong" */
export function invoiceBadgeText(room: Room): string {
  if (room.status === "kosong") return "Kosong";
  const off = room.invoice?.dayOffset;
  if (room.status === "jatuhTempo" && off !== undefined) return `H-${off}`;
  if (room.status === "menunggak" && off !== undefined) return `H+${off}`;
  return STATUS_META[room.status].label;
}

// ── Date helpers (Indonesian short labels, e.g. "1 Okt 2026") ───────────────

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"] as const;

/** ISO "2026-10-01" → "1 Okt 2026" */
export function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

/** "1 Okt 2026" → Date */
export function parseDateLabel(label: string): Date {
  const [d, m, y] = label.split(" ");
  return new Date(Number(y), MONTH_NAMES.indexOf((m ?? "Jan") as (typeof MONTH_NAMES)[number]), Number(d));
}

export function dateToLabel(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Today as ISO "yyyy-mm-dd" (local time) — default tanggal untuk input transaksi/penyewa baru */
export function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export const PROPERTIES: Property[] = [
  { id: "kgp", name: "Kost Griya Pratama", roomCount: 24 },
  { id: "kmi", name: "Kost Melati Indah", roomCount: 16 },
];

// ── Mock rooms ───────────────────────────────────────────────────────────────
// Floor 1: 12 rooms — 8 lunas, 1 jatuh tempo, 1 menunggak, 2 kosong
// Floor 2: 12 rooms — 9 lunas, 1 jatuh tempo, 2 kosong
// Total: 24 rooms — 17 lunas, 2 jatuh tempo, 1 menunggak, 4 kosong (20 terisi = 83.3%)

export const ROOMS: Room[] = seedRoomData([
  // ── Lantai 1 ──────────────────────────────────────────────────────────────
  {
    id: "101", floor: 1, type: "Tipe A - AC", price: 1_500_000, status: "lunas",
    tenant: {
      name: "Budi Santoso",
      phone: "+62 812-1101-2210",
      moveInDate: "12 Jan 2026",
      emergencyContact: { name: "Rina Santoso (Istri)", phone: "+62 813-2201-7788" },
    },
    invoice: { amount: 1_500_000, periodLabel: "Sewa Okt 2026", dueLabel: "Tempo: 28 Okt" },
    contract: { duration: "Bulanan", startDate: "12 Jan 2026", deposit: 1_000_000, depositHeld: true },
  },
  {
    id: "102", floor: 1, type: "Tipe A - AC", price: 1_500_000, status: "lunas",
    tenant: {
      name: "Dimas Ardi",
      phone: "+62 812-3456-7890",
      moveInDate: "05 Mar 2026",
      emergencyContact: { name: "Bpk. Surya (Ayah)", phone: "+62 815-6102-9911" },
    },
    invoice: { amount: 1_500_000, periodLabel: "Sewa Okt 2026", dueLabel: "Tempo: 05 Okt" },
    contract: { duration: "Bulanan", startDate: "05 Mar 2026", deposit: 1_000_000, depositHeld: true },
  },
  {
    id: "103", floor: 1, type: "Tipe B - Kipas", price: 1_100_000, status: "jatuhTempo",
    tenant: {
      name: "Ahmad Fauzi",
      phone: "+62 813-8821-5502",
      moveInDate: "20 Jun 2026",
      emergencyContact: { name: "Ibu Halimah (Ibu)", phone: "+62 812-9931-2245" },
    },
    invoice: { amount: 1_100_000, periodLabel: "Sewa Sep 2026", dueLabel: "Tempo: 28 Sep", dayOffset: 2 },
    contract: { duration: "Bulanan", startDate: "20 Jun 2026", endDate: "30 Sep 2026", deposit: 500_000, depositHeld: true },
  },
  {
    id: "104", floor: 1, type: "Tipe AC Deluxe", price: 1_750_000, status: "menunggak",
    tenant: {
      name: "Dewi Lestari",
      phone: "+62 812-9902-3367",
      moveInDate: "14 Feb 2026",
      emergencyContact: { name: "Andi Wijaya (Suami)", phone: "+62 811-2245-8890" },
    },
    invoice: { amount: 1_750_000, periodLabel: "Sewa Sep 2026", dueLabel: "Tempo: 24 Sep", dayOffset: -2 },
    contract: { duration: "Bulanan", startDate: "14 Feb 2026", deposit: 1_000_000, depositHeld: true },
  },
  {
    id: "105", floor: 1, type: "Tipe A - AC", price: 1_500_000, status: "lunas",
    tenant: {
      name: "Rizky Pratama",
      phone: "+62 878-2210-6634",
      moveInDate: "01 Sep 2026",
      emergencyContact: { name: "Bpk. Hartono (Ayah)", phone: "+62 813-5510-2214" },
    },
    invoice: { amount: 1_500_000, periodLabel: "Sewa Okt 2026", dueLabel: "Tempo: 10 Okt" },
    contract: { duration: "Bulanan", startDate: "01 Sep 2026", deposit: 1_000_000, depositHeld: true },
  },
  { id: "106", floor: 1, type: "Tipe A - AC", price: 1_500_000, status: "kosong" },
  {
    id: "107", floor: 1, type: "Tipe B - Kipas", price: 1_100_000, status: "lunas",
    tenant: {
      name: "Maya Anggraini",
      phone: "+62 812-6675-0119",
      moveInDate: "03 Jul 2026",
      emergencyContact: { name: "Dita Anggraini (Saudara)", phone: "+62 819-3320-7715" },
    },
    invoice: { amount: 1_100_000, periodLabel: "Sewa Okt 2026", dueLabel: "Tempo: 03 Okt" },
    contract: { duration: "Bulanan", startDate: "03 Jul 2026", deposit: 500_000, depositHeld: true },
  },
  {
    id: "108", floor: 1, type: "Tipe A - AC", price: 1_500_000, status: "lunas",
    tenant: {
      name: "Doni Kusnadi",
      phone: "+62 856-4410-8823",
      moveInDate: "18 Agu 2026",
      emergencyContact: { name: "Ibu Sumi (Ibu)", phone: "+62 812-8890-1023" },
    },
    invoice: { amount: 1_500_000, periodLabel: "Sewa Okt 2026", dueLabel: "Tempo: 18 Okt" },
    contract: { duration: "Bulanan", startDate: "18 Agu 2026", deposit: 1_000_000, depositHeld: false },
  },
  {
    id: "109", floor: 1, type: "Tipe AC Deluxe", price: 1_750_000, status: "lunas",
    tenant: {
      name: "Putri Handayani",
      phone: "+62 813-2299-4405",
      moveInDate: "07 Mei 2026",
      emergencyContact: { name: "Rudi Handayani (Ayah)", phone: "+62 815-7712-3390" },
    },
    invoice: { amount: 1_750_000, periodLabel: "Sewa Okt 2026", dueLabel: "Tempo: 07 Okt" },
    contract: { duration: "Bulanan", startDate: "07 Mei 2026", deposit: 1_000_000, depositHeld: true },
  },
  {
    id: "110", floor: 1, type: "Tipe B - Kipas", price: 1_100_000, status: "lunas",
    tenant: {
      name: "Agus Setiawan",
      phone: "+62 812-3358-9907",
      moveInDate: "15 Jan 2026",
      emergencyContact: { name: "Ibu Wati (Ibu)", phone: "+62 813-9920-4418" },
    },
    invoice: { amount: 1_100_000, periodLabel: "Sewa Okt 2026", dueLabel: "Tempo: 15 Okt" },
    contract: { duration: "Bulanan", startDate: "15 Jan 2026", deposit: 500_000, depositHeld: true },
  },
  { id: "111", floor: 1, type: "Tipe AC Deluxe", price: 1_750_000, status: "kosong" },
  {
    id: "112", floor: 1, type: "Tipe A - AC", price: 1_500_000, status: "lunas",
    tenant: {
      name: "Fajar Nugroho",
      phone: "+62 878-9920-1145",
      moveInDate: "21 Apr 2026",
      emergencyContact: { name: "Sari Nugroho (Istri)", phone: "+62 812-1104-6678" },
    },
    invoice: { amount: 1_500_000, periodLabel: "Sewa Okt 2026", dueLabel: "Tempo: 21 Okt" },
    contract: { duration: "Bulanan", startDate: "21 Apr 2026", deposit: 1_000_000, depositHeld: true },
  },
]);

/** Room literal saat seed — token portal belum ditulis (diisi otomatis seeder) */
type SeedRoom = Omit<Room, "tenant"> & {
  tenant?: Omit<Tenant, "portalToken">;
};

/** Fill `facilities` + auto-assign `portal_token` on first load (mock master data) */
function seedRoomData(rooms: SeedRoom[]): Room[] {
  return rooms.map((r) => ({
    ...r,
    facilities: r.facilities ?? DEFAULT_FACILITIES_BY_TYPE[r.type] ?? [],
    // Setiap penghuni terdaftar otomatis memegang token portal unik & stabil
    tenant: r.tenant ? { ...r.tenant, portalToken: seededPortalToken(r.id) } : undefined,
  }));
}

// ── Derived stats ────────────────────────────────────────────────────────────

export interface KostStats {
  total: number;
  occupied: number;
  occupancyPct: string;
  dueSoon: number; // jatuh tempo
  overdue: number; // menunggak
  empty: number;
  paid: number;
}

/** Sorted unique floors present in the dataset (1, 2, 3, …) */
export function distinctFloors(rooms: Room[]): number[] {
  return [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
}

export function computeStats(rooms: Room[]): KostStats {
  const total = rooms.length;
  const occupied = rooms.filter((r) => r.status !== "kosong").length;
  return {
    total,
    occupied,
    occupancyPct: total ? ((occupied / total) * 100).toFixed(1) : "0.0",
    dueSoon: rooms.filter((r) => r.status === "jatuhTempo").length,
    overdue: rooms.filter((r) => r.status === "menunggak").length,
    empty: rooms.filter((r) => r.status === "kosong").length,
    paid: rooms.filter((r) => r.status === "lunas").length,
  };
}
