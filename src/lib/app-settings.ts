/**
 * IndoKost — Pengaturan global store (localStorage-backed).
 *
 * Single source of truth untuk seluruh modul Pengaturan:
 *  1. Profil Saya          → owner
 *  2. Profil Properti      → propertyProfile (+ foto fasad)
 *  3. Daftar & Kelola Properti → properties (multi-cabang CRUD)
 *  4. Kelola Admin & Staf  → staff (peran + akses cabang + WA)
 *  5. Rekening & Pembayaran → rekening
 *  6. Template WhatsApp    → templates
 *  7. Tarif & Tipe Kamar   → tetap live dari rooms (settings tidak menyalin data kamar)
 *  8. Tema & Tampilan      → theme (12 tema: 5 palet solid + 7 tema karakter,
 *                             data-ik-theme di <html>)
 */

export const SETTINGS_KEY = "indokost:settings:v1";

/** Kunci localStorage khusus tema aktif (Task 34) — cerminan settings.theme
 *  agar tema bisa dibaca cepat lintas rute (dashboard & portal penyewa). */
export const ACTIVE_THEME_KEY = "unitku_active_theme";

/* ── Tipe Properti ─────────────────────────────────────────────────────────── */

export const PROPERTY_TYPES = ["kost", "kontrakan", "rusun"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_TYPE_META: Record<
  PropertyType,
  { label: string; unit: string; hint: string }
> = {
  kost: {
    label: "Rumah Kost",
    unit: "Kamar",
    hint: "Unit disewa per kamar — cocok untuk kost putra/putri/campur.",
  },
  kontrakan: {
    label: "Kontrakan Petak",
    unit: "Pintu",
    hint: "Unit disewa per petak/pintu (rumah atau ruko) dengan kontrak bulanan/tahunan.",
  },
  rusun: {
    label: "Rusun",
    unit: "Unit",
    hint: "Rumah susun — unit apartemen sederhana dengan layanan bulanan.",
  },
};

export interface PropertyEntry {
  id: string;
  name: string;
  type: PropertyType;
  unitCount: number;
  address: string;
  photoUrl?: string;
  /** Properti yang sedang dikelola di dashboard (tidak dapat dihapus) */
  aktif?: boolean;
}

/* ── Profil Saya ───────────────────────────────────────────────────────────── */

export interface OwnerProfile {
  nama: string;
  email: string;
  whatsapp: string;
}

/* ── Profil Properti ───────────────────────────────────────────────────────── */

export interface PropertyProfile {
  nama: string;
  tipe: PropertyType;
  alamat: string;
  lantai: string;
  jamMalam: string;
  aturan: string;
  /** Foto bangunan/fasad — dataURL (compressed) atau URL eksternal */
  fotoUrl?: string;
}

/* ── Kelola Admin & Staf ───────────────────────────────────────────────────── */

export const STAFF_ROLES = ["Owner", "Admin", "Penjaga"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_META: Record<
  StaffRole,
  { desc: string; pill: string }
> = {
  Owner: {
    desc: "Akses penuh — termasuk Zona Berbahaya, rekening, dan tarif.",
    pill: "bg-[var(--ik-accent)] text-[var(--ik-accent-fg)]",
  },
  Admin: {
    desc: "Kelola tagihan, penghuni, pengumuman & pengaturan — tanpa Zona Berbahaya.",
    pill: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  Penjaga: {
    desc: "Operasional harian: check-in/out, komplain & pengumuman harian.",
    pill: "border border-amber-200 bg-amber-50 text-amber-700",
  },
};

export interface StaffMember {
  id: string;
  nama: string;
  peran: StaffRole;
  whatsapp: string;
  /** Id properti yang bisa diakses — kosong = semua cabang */
  cabang: string[];
}

/* ── Rekening & Pembayaran ─────────────────────────────────────────────────── */

export interface RekeningConfig {
  bank: string;
  noRek: string;
  atasNama: string;
}

/* ── Template WhatsApp ─────────────────────────────────────────────────────── */

export interface WaTemplateConfig {
  h3: string;
  hariH: string;
  lunas: string;
}

export const DEFAULT_TEMPLATES: WaTemplateConfig = {
  h3: `Halo {nama},

Kami dari {kos} mengingatkan bahwa tagihan sewa Kamar {kamar} sebesar {nominal} akan jatuh tempo pada {tempo} (H-3).

Mohon lakukan pembayaran sebelum tanggal tersebut agar terhindar dari denda keterlambatan. Terima kasih.`,
  hariH: `Halo {nama},

Hari ini {tempo} adalah jatuh tempo tagihan Kamar {kamar} sebesar {nominal}.

Segera lakukan pembayaran agar layanan kamar tetap berjalan normal. Terima kasih.`,
  lunas: `Terima kasih {nama}!

Pembayaran sewa Kamar {kamar} sebesar {nominal} telah kami terima dan LUNAS.

Simpan pesan ini sebagai kwitansi resmi. Terima kasih atas kepercayaannya.`,
};

/* ── Tema & Tampilan — 12 tema (5 solid + 7 karakter) ──────────────────────── */

export const THEME_KEYS = [
  "zinc",
  "teal",
  "emerald",
  "amber",
  "rose",
  "industrial",
  "retro",
  "blueprint",
  "macaron",
  "matcha",
  "cyber",
  "coffee",
] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

/** Swatch UI memakai kelas Tailwind statis (warna harus terlihat apa pun tema aktif) */
export const THEME_META: Record<
  ThemeKey,
  { label: string; desc: string; dot: string; softDot: string; text: string }
> = {
  zinc: {
    label: "Default Clean",
    desc: "Blok warna solid status bawaan — netral & tegas.",
    dot: "bg-zinc-900",
    softDot: "bg-zinc-200",
    text: "text-zinc-900",
  },
  teal: {
    label: "Ocean Blue",
    desc: "Lunas solid cyan #65D0F4 · aksen biru #2373F4.",
    dot: "bg-[#2373f4]",
    softDot: "bg-[#65d0f4]",
    text: "text-[#1d4ed8]",
  },
  emerald: {
    label: "Fresh Forest",
    desc: "Hijau rimba #2A7C13 — kartu lunas solid #76C457.",
    dot: "bg-[#2a7c13]",
    softDot: "bg-[#76c457]",
    text: "text-[#1a5c0b]",
  },
  amber: {
    label: "Warm Terracotta",
    desc: "Terakota hangat — menunggak #EC5B38 sangat kontras.",
    dot: "bg-[#ec5b38]",
    softDot: "bg-[#fcf2e5]",
    text: "text-[#524646]",
  },
  rose: {
    label: "Nordic Slate",
    desc: "Slate utara — surface #333446, lunas #B8CFCE.",
    dot: "bg-[#333446]",
    softDot: "bg-[#b8cfce]",
    text: "text-[#333446]",
  },
  industrial: {
    label: "Industrial Utility (Soft Brutalism)",
    desc: "Struk kasir brutalis — border hitam 2px, hard shadow, aksen crimson #B91C1C.",
    dot: "bg-[#b91c1c]",
    softDot: "bg-[#fde68a]",
    text: "text-[#b91c1c]",
  },
  retro: {
    label: "Retro Ledger (Kartu Arsip & Stempel)",
    desc: "Kartu arsip klasik — kertas manila, cap karet LUNAS/NUNGGAK, serif & monospace.",
    dot: "bg-[#7c2d12]",
    softDot: "bg-[#e2d3b3]",
    text: "text-[#7c2d12]",
  },
  blueprint: {
    label: "Blueprint Studio (Denah Arsitek)",
    desc: "Cetak biru arsitek — navy gelap, kisi cyan 20px, tipografi drafting monospace.",
    dot: "bg-[#38bdf8]",
    softDot: "bg-[#0b1727]",
    text: "text-[#0369a1]",
  },
  macaron: {
    label: "Pastel Macaron (Korean Aesthetic)",
    desc: "Studio Korea manis — krem susu, border pink pastel, lunas mint sorbet, badge strawberry rose.",
    dot: "bg-[#fb7185]",
    softDot: "bg-[#d1fae5]",
    text: "text-[#e11d48]",
  },
  matcha: {
    label: "Matcha Sanctuary (Zen Villa)",
    desc: "Vila zen organik — stone greige, kartu krem matcha, lunas moss green solid, aksen oker emas.",
    dot: "bg-[#3f5e4d]",
    softDot: "bg-[#e2e8d5]",
    text: "text-[#3f5e4d]",
  },
  cyber: {
    label: "Cyber Terminal (OLED Neon)",
    desc: "Terminal OLED murni — hitam #09090B, neon emerald/rose, tombol putih monospace kontras tinggi.",
    dot: "bg-[#34d399]",
    softDot: "bg-[#09090b]",
    text: "text-[#059669]",
  },
  coffee: {
    label: "Coffee Roastery (Warm Espresso)",
    desc: "Oat milk hangat — krim oat, lunas olive cream, menunggak karamel toffee, tombol kopi sangrai.",
    dot: "bg-[#362217]",
    softDot: "bg-[#dce8d5]",
    text: "text-[#5f3a0e]",
  },
};

/* ── Root store ────────────────────────────────────────────────────────────── */

export interface IndoKostSettings {
  owner: OwnerProfile;
  propertyProfile: PropertyProfile;
  properties: PropertyEntry[];
  staff: StaffMember[];
  rekening: RekeningConfig;
  templates: WaTemplateConfig;
  /** Katalog fasilitas master (Pengaturan → Katalog Fasilitas + modal kamar) */
  facilities: FacilityCatalog;
  theme: ThemeKey;
}

/* ── Katalog Fasilitas ─────────────────────────────────────────────── */

export interface FacilityItem {
  id: string;
  label: string;
  /** true = ditambahkan pengelola (via "+ Tambah Fasilitas") — dapat dihapus saat salah ketik */
  custom?: boolean;
}

export interface FacilityCatalog {
  /** Fasilitas default unit (milik kamar) */
  unit: FacilityItem[];
  /** Fasilitas bersama properti (dipakai bersama seluruh penyewa) */
  shared: FacilityItem[];
}

/** id stabil & terbaca untuk item default — "CCTV 24 Jam" → "fac_cctv-24-jam" */
function facilityId(label: string): string {
  return `fac_${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

const DEFAULT_UNIT_FACILITY_LABELS = [
  "AC",
  "Kipas Angin",
  "Kasur Queen",
  "Kasur Single",
  "Lemari",
  "Meja Kerja",
  "Kamar Mandi Dalam",
  "Kamar Mandi Luar",
  "Kloset Duduk",
  "Kloset Jongkok",
  "Dapur Pribadi",
  "Meteran Listrik Terpisah",
  "Token Listrik Sendiri",
  "Water Heater",
  "Balkon",
];

const DEFAULT_SHARED_FACILITY_LABELS = [
  "Wi-Fi",
  "Dapur Bersama",
  "Kulkas Bersama",
  "Mesin Cuci Bersama",
  "Parkir Motor",
  "Parkir Mobil",
  "CCTV 24 Jam",
  "Gerbang 24 Jam",
];

export const DEFAULT_FACILITY_CATALOG: FacilityCatalog = {
  unit: DEFAULT_UNIT_FACILITY_LABELS.map((label) => ({ id: facilityId(label), label })),
  shared: DEFAULT_SHARED_FACILITY_LABELS.map((label) => ({ id: facilityId(label), label })),
};

/** Foto fasad bawaan — SVG inline ringan (≈1 KB), aman untuk localStorage */
export const DEFAULT_FACADE_PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'>` +
      `<rect width='96' height='96' fill='#e4e4e7'/>` +
      `<rect x='0' y='0' width='96' height='10' fill='#a1a1aa'/>` +
      `<rect x='14' y='26' width='68' height='58' fill='#f4f4f5' stroke='#a1a1aa' stroke-width='2'/>` +
      `<rect x='10' y='18' width='76' height='8' fill='#71717a'/>` +
      `<rect x='20' y='36' width='12' height='12' fill='#fff' stroke='#a1a1aa'/>` +
      `<rect x='38' y='36' width='12' height='12' fill='#fff' stroke='#a1a1aa'/>` +
      `<rect x='56' y='36' width='12' height='12' fill='#fff' stroke='#a1a1aa'/>` +
      `<rect x='20' y='54' width='12' height='12' fill='#fff' stroke='#a1a1aa'/>` +
      `<rect x='38' y='54' width='12' height='12' fill='#fff' stroke='#a1a1aa'/>` +
      `<rect x='56' y='54' width='12' height='12' fill='#fff' stroke='#a1a1aa'/>` +
      `<rect x='41' y='70' width='14' height='14' fill='#52525b'/>` +
      `<rect x='0' y='84' width='96' height='12' fill='#d4d4d8'/>` +
      `</svg>`,
  );

export const DEFAULT_SETTINGS: IndoKostSettings = {
  owner: {
    nama: "Hendra Wijaya",
    email: "hendra@indokost.id",
    whatsapp: "+62 812-9902-3367",
  },
  propertyProfile: {
    nama: "Kost Griya Pratama",
    tipe: "kost",
    alamat:
      "Jl. Cendana Raya No. 45, Kel. Sukamaju, Kec. Cibinong, Kab. Bogor, Jawa Barat 16913",
    lantai: "2",
    jamMalam: "22:00",
    aturan:
      "1. Jam malam pukul 22.00 — tamu tidak boleh melewati jam tersebut.\n2. Dilarang merokok di dalam kamar & area umum.\n3. Tamu menginap wajib lapor penjaga (maks. 2 malam).\n4. Tagihan dibayar paling lambat tanggal 28 setiap bulan.",
    fotoUrl: DEFAULT_FACADE_PHOTO,
  },
  properties: [
    {
      id: "kgp",
      name: "Kost Griya Pratama",
      type: "kost",
      unitCount: 24,
      address: "Jl. Cendana Raya No. 45, Cibinong, Bogor",
      aktif: true,
    },
    {
      id: "kmi",
      name: "Kost Melati Indah",
      type: "kost",
      unitCount: 16,
      address: "Jl. Melati Indah No. 12, Depok, Jawa Barat",
    },
    {
      id: "kpj",
      name: "Kontrakan Permata Jaya",
      type: "kontrakan",
      unitCount: 8,
      address: "Jl. Raya Permata No. 88, Cibubur, Jakarta Timur",
    },
  ],
  staff: [
    {
      id: "stf_owner",
      nama: "Hendra Wijaya",
      peran: "Owner",
      whatsapp: "+62 812-9902-3367",
      cabang: [],
    },
    {
      id: "stf_admin",
      nama: "Ratna Sari",
      peran: "Admin",
      whatsapp: "+62 813-7710-4455",
      cabang: ["kgp", "kmi"],
    },
    {
      id: "stf_jaga",
      nama: "Pak Slamet",
      peran: "Penjaga",
      whatsapp: "+62 815-2233-8890",
      cabang: ["kgp"],
    },
  ],
  rekening: {
    bank: "BCA",
    noRek: "1234567890",
    atasNama: "Hendra Wijaya",
  },
  templates: DEFAULT_TEMPLATES,
  facilities: DEFAULT_FACILITY_CATALOG,
  theme: "zinc",
};

/* ── Persistence ───────────────────────────────────────────────────────────── */

/** Baca kunci tema aktif `unitku_active_theme` — null jika tidak ada/tidak valid. */
function readActiveThemeKey(): ThemeKey | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_THEME_KEY);
    return raw && (THEME_KEYS as readonly string[]).includes(raw) ? (raw as ThemeKey) : null;
  } catch {
    return null;
  }
}

/** Tulis kunci tema aktif `unitku_active_theme` (dipanggil setiap tema berganti). */
function writeActiveThemeKey(theme: ThemeKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_THEME_KEY, theme);
  } catch {
    /* kuota penuh / private mode — abaikan secara diam */
  }
}

function mergeSettings(saved: Partial<IndoKostSettings>): IndoKostSettings {
  return {
    owner: { ...DEFAULT_SETTINGS.owner, ...(saved.owner ?? {}) },
    propertyProfile: {
      ...DEFAULT_SETTINGS.propertyProfile,
      ...(saved.propertyProfile ?? {}),
    },
    properties:
      Array.isArray(saved.properties) && saved.properties.length > 0
        ? saved.properties
        : DEFAULT_SETTINGS.properties,
    staff: Array.isArray(saved.staff) ? saved.staff : DEFAULT_SETTINGS.staff,
    rekening: { ...DEFAULT_SETTINGS.rekening, ...(saved.rekening ?? {}) },
    templates: { ...DEFAULT_SETTINGS.templates, ...(saved.templates ?? {}) },
    facilities: {
      unit: Array.isArray(saved.facilities?.unit)
        ? saved.facilities.unit
        : DEFAULT_FACILITY_CATALOG.unit,
      shared: Array.isArray(saved.facilities?.shared)
        ? saved.facilities.shared
        : DEFAULT_FACILITY_CATALOG.shared,
    },
    theme:
      saved.theme && (THEME_KEYS as readonly string[]).includes(saved.theme)
        ? saved.theme
        : DEFAULT_SETTINGS.theme,
  };
}

/** Baca pengaturan dari localStorage — toleran terhadap data lama/korup.
 *  Tema aktif diprioritaskan dari kunci `unitku_active_theme` (Task 34);
 *  fallback ke settings.theme lama agar migrasi pengguna lama mulus. */
export function loadSettings(): IndoKostSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    const settings = raw
      ? mergeSettings(JSON.parse(raw) as Partial<IndoKostSettings>)
      : DEFAULT_SETTINGS;
    const activeTheme = readActiveThemeKey();
    return activeTheme ? { ...settings, theme: activeTheme } : settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: IndoKostSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* kuota penuh / private mode — abaikan secara diam */
  }
  writeActiveThemeKey(settings.theme);
}

/* ── Store reaktif (useSyncExternalStore) — pola yang sama dengan portal-mirror ──
   localStorage adalah source of truth: setiap pembaruan ditulis dulu lalu
   memberi tahu subscriber. Tab lain ikut sinkron via event `storage`. */

let cachedSettings: IndoKostSettings | null = null;
const settingsListeners = new Set<() => void>();

function notifySettingsListeners(): void {
  settingsListeners.forEach((l) => l());
}

export function subscribeSettings(listener: () => void): () => void {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
}

export function getSettingsSnapshot(): IndoKostSettings {
  if (cachedSettings === null) cachedSettings = loadSettings();
  return cachedSettings;
}

export function getServerSettingsSnapshot(): IndoKostSettings {
  return DEFAULT_SETTINGS;
}

/** Terima patch biasa atau updater function (s = snapshot terkini). */
export function updateStoredSettings(
  patch: Partial<IndoKostSettings> | ((s: IndoKostSettings) => Partial<IndoKostSettings>)
): void {
  const base = getSettingsSnapshot();
  const part = typeof patch === "function" ? patch(base) : patch;
  cachedSettings = { ...base, ...part };
  saveSettings(cachedSettings);
  notifySettingsListeners();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === SETTINGS_KEY) {
      cachedSettings = null;
      notifySettingsListeners();
    }
  });
}

/* ── Foto helpers ──────────────────────────────────────────────────────────── */

/**
 * File gambar → dataURL JPEG terkompresi (sisi terpanjang ≤ maxSize).
 * Menjaga kuota localStorage tetap aman untuk foto fasad.
 */
export function fileToPhotoDataUrl(file: File, maxSize = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("File bukan gambar yang valid"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas tidak tersedia"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/* ── ID helpers ────────────────────────────────────────────────────────────── */

export function nextSettingsId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
