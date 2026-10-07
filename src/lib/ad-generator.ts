// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Generator Iklan Unit Siap Copas ke Sosmed
//
// Smart string templating 100% client-side (tanpa biaya API tambahan):
// mengubah data unit (nama properti, nomor unit, harga, fasilitas, nomor WA
// owner) menjadi draf iklan promosi yang siap di-copy-paste ke:
//   1. "facebook"   — Grup Facebook / Komunitas (lengkap, ramah, emoji, link WA)
//   2. "whatsapp"   — Status / Story WhatsApp (singkat, kasual, padat)
//   3. "marketplace" — Deskripsi listing Marketplace (terstruktur, to the point)
//
// ADAPTIF TIPE PROPERTI (kost vs kontrakan/rumah sewa vs rusun vs villa):
//   - "kost"      → terminologi "Kamar" (template klasik kost)
//   - "house"     → Kontrakan / Rumah Sewa / Petakan — terminologi "Rumah
//                   Kontrakan / Unit Petakan", target keluarga kecil/pasutri,
//                   fasilitas diprioritaskan (dapur, ruang tamu, parkir, dst.)
//   - "unit"      → Rusun — terminologi "Unit Rusun", target pekerja/pasutri
//   - "villa"     → Villa / Homestay / Guesthouse — terminologi staycation
//                   ("Tamu", check-in/check-out, tarif per malam weekday &
//                   weekend, kapasitas tamu) + PRESET CEPAT caption siap
//                   pakai per platform (Instagram, Facebook Ads, WA Story)
//
// Setiap format punya 4 VARIASI GAYA (angle penulisan) agar tombol
// "Buat Ulang Draf Otomatis" selalu menghasilkan teks yang berbeda:
//   0. Urgensi     — sisa unit terakhir, siapa cepat dia dapat
//   1. Kenyamanan  — bersih & nyaman, siap huni, tinggal bawa koper
//   2. Hemat       — harga terjangkau, tanpa biaya tersembunyi
//   3. Santai      — ramah tetangga, lingkungan aman & kondusif
// Semua variasi tetap menyisipkan data unit aktual: nomor unit, harga,
// fasilitas yang dicentang, dan link WhatsApp owner.
// ─────────────────────────────────────────────────────────────────────────────

import { formatIDR, formatIDRShort, waLink } from "@/lib/kost-data";

export type AdFormatId = "facebook" | "whatsapp" | "marketplace";

export interface AdGeneratorInput {
  /** Nama properti/kost dari Pengaturan → Profil Properti */
  propertyName: string;
  roomId: string;
  floor: number;
  type: string;
  /** Harga sewa (IDR) — per bulan (kost/kontrakan/rusun) atau per malam
   *  (villa/homestay — sewa harian) */
  price: number;
  /** Daftar fasilitas aktif (dari checklist modal) */
  facilities: string[];
  /** Nomor WhatsApp owner (tampil mentah, dinormalisasi ke wa.me) */
  ownerWhatsapp: string;
  /** Tipe properti aktif ("kost" | "kontrakan" | "rusun" | "villa" / label
   *  bebas) — menentukan terminologi & struktur draf iklan */
  propertyType?: string;
  /** Villa/Homestay: kapasitas tamu per booking (opsional — input modal) */
  capacity?: number | null;
  /** Villa/Homestay: tarif akhir pekan (weekend) per malam (opsional) */
  weekendPrice?: number | null;
}

/** Jumlah variasi gaya per format (urgensi/kenyamanan/hemat/santai) */
export const AD_STYLE_COUNT = 4;

/** Label & deskripsi tiap variasi — dipakai modal utk indikator "Gaya: …" */
export const AD_STYLE_META: { label: string; description: string }[] = [
  { label: "Urgensi", description: "Sisa unit terakhir — siapa cepat dia dapat" },
  { label: "Kenyamanan", description: "Istirahat tenang, tinggal bawa koper" },
  { label: "Hemat", description: "Harga terjangkau, tanpa biaya tersembunyi" },
  { label: "Santai", description: "Ramah, lingkungan aman & kondusif" },
];

// ── Adaptasi tipe properti (Kost vs Kontrakan / Rumah Sewa vs Rusun) ─────────

export type AdPropertyScope = "kost" | "house" | "unit" | "villa";

/** Petakan nilai tipe properti (string bebas) → scope template iklan.
 *  "villa"/"homestay"/"guesthouse"/"penginapan" → villa; "kontrakan"/"rumah
 *  sewa"/"petakan"/"ruko" → house; "rusun"/"apartemen" → unit; kosong/tak
 *  dikenal → kost (perilaku lama). */
export function adPropertyScope(propertyType?: string): AdPropertyScope {
  const v = (propertyType ?? "").trim().toLowerCase();
  if (!v) return "kost";
  if (
    v.includes("villa") ||
    v.includes("homestay") ||
    v.includes("guest") ||
    v.includes("penginapan")
  ) {
    return "villa";
  }
  if (
    v.includes("kontra") ||
    v.includes("petak") ||
    v.includes("rumah") ||
    v.includes("sewa") ||
    v.includes("ruko")
  ) {
    return "house";
  }
  if (v.includes("rusun") || v.includes("apart") || v.includes("susun")) return "unit";
  return "kost";
}

/** Kata benda unit utk UI & template — kost "Kamar", lainnya "Unit" */
export function adUnitNoun(scope: AdPropertyScope): "Kamar" | "Unit" {
  return scope === "kost" ? "Kamar" : "Unit";
}

/** Label tombol aksen "Buat Iklan …" sesuai tipe properti aktif */
export function adCtaLabel(scope: AdPropertyScope): string {
  if (scope === "house") return "Buat Iklan Kontrakan";
  if (scope === "unit") return "Buat Iklan Unit";
  if (scope === "villa") return "Buat Iklan Villa";
  return "Buat Iklan Kamar";
}

/** Judul modal — mis. "Buat Iklan Kontrakan — Unit A-2" / "Buat Iklan Kamar — 101" */
export function adModalTitle(scope: AdPropertyScope, roomId: string): string {
  return `${adCtaLabel(scope)} — ${adUnitNoun(scope)} ${roomId}`;
}

/** Prioritas fasilitas checklist/draf utk kontrakan & rumah sewa */
export const HOUSE_FACILITY_PRIORITY = [
  "Dapur Pribadi",
  "Ruang Tamu",
  "Kamar Mandi Dalam",
  "Teras / Parkir Motor/Mobil",
  "Listrik Token Sendiri",
  "Air Bersih",
] as const;

const HOUSE_PRIORITY_KEYWORDS = [
  "dapur",
  "ruang tamu",
  "kamar mandi dalam",
  "teras",
  "parkir",
  "listrik",
  "air",
];

/** Urutkan fasilitas draf iklan rumah: item prioritas kontrakan dulu
 *  (urutan daftar), sisanya mempertahankan urutan asal (stable sort). */
export function sortFacilitiesForHouse(facilities: string[]): string[] {
  const score = (f: string): number => {
    const v = f.toLowerCase();
    const idx = HOUSE_PRIORITY_KEYWORDS.findIndex((k) => v.includes(k));
    return idx === -1 ? HOUSE_PRIORITY_KEYWORDS.length : idx;
  };
  return facilities
    .map((f, i) => ({ f, i, s: score(f) }))
    .sort((a, b) => (a.s !== b.s ? a.s - b.s : a.i - b.i))
    .map((x) => x.f);
}

/** Prioritas fasilitas checklist/draf utk villa / homestay / guesthouse —
 *  fasilitas liburan ditonjolkan duluan (kolam renang, dapur, view, BBQ…). */
export const VILLA_FACILITY_PRIORITY = [
  "Kolam Renang",
  "Dapur",
  "View / Pemandangan",
  "Area BBQ",
  "Ruang Keluarga",
  "Kamar Mandi Dalam",
  "Wifi",
  "AC",
  "Parkir Mobil",
] as const;

const VILLA_PRIORITY_KEYWORDS = [
  "kolam",
  "dapur",
  "view",
  "pemandangan",
  "bbq",
  "ruang keluarga",
  "wifi",
  "internet",
  "kamar mandi",
  "ac",
  "parkir",
  "balkon",
  "teras",
  "tv",
  "karaoke",
];

/** Urutkan fasilitas draf iklan villa: item prioritas liburan dulu
 *  (urutan daftar), sisanya mempertahankan urutan asal (stable sort). */
export function sortFacilitiesForVilla(facilities: string[]): string[] {
  const score = (f: string): number => {
    const v = f.toLowerCase();
    const idx = VILLA_PRIORITY_KEYWORDS.findIndex((k) => v.includes(k));
    return idx === -1 ? VILLA_PRIORITY_KEYWORDS.length : idx;
  };
  return facilities
    .map((f, i) => ({ f, i, s: score(f) }))
    .sort((a, b) => (a.s !== b.s ? a.s - b.s : a.i - b.i))
    .map((x) => x.f);
}

/** Terminologi & target penyewa utk scope non-kost */
interface HouseCopy {
  /** Terminologi listing — headline FB & judul Marketplace */
  listing: string;
  /** Kata benda kasual utk teks singkat WA ("kontrakan" / "unit rusun") */
  nounLower: string;
  /** Kalimat target penyewa (FB & Marketplace) */
  target: string;
  /** Target singkat utk Status WA */
  targetShort: string;
}

function houseCopy(scope: "house" | "unit"): HouseCopy {
  return scope === "unit"
    ? {
        listing: "Unit Rusun",
        nounLower: "unit rusun",
        target: "Cocok untuk pekerja aktif maupun pasutri baru.",
        targetShort: "Cocok untuk pekerja/pasutri.",
      }
    : {
        listing: "Rumah Kontrakan / Unit Petakan",
        nounLower: "kontrakan",
        target: "Cocok untuk keluarga kecil, pasutri baru, atau pekerja baik-baik.",
        targetShort: "Cocok untuk pasutri/keluarga kecil/pekerja.",
      };
}

/** Terminologi utk scope villa / homestay / guesthouse */
interface VillaCopy {
  /** Terminologi listing — headline FB & judul Marketplace */
  listing: string;
  /** Kata benda kasual utk teks singkat WA */
  nounLower: string;
}

function villaCopy(): VillaCopy {
  return { listing: "Villa / Homestay", nounLower: "villa" };
}

/** Pilih indeks variasi yang DIJAMIN BERBEDA dari yang sedang aktif. */
export function pickDifferentStyle(current: number, count = AD_STYLE_COUNT): number {
  if (count <= 1) return 0;
  return (current + 1 + Math.floor(Math.random() * (count - 1))) % count;
}

/** Link chat wa.me owner — null bila nomor belum diisi (iklan tanpa link chat) */
export function adContactLink(phone: string): string | null {
  const url = waLink(phone ?? "");
  return url === "https://wa.me/" ? null : url;
}

/** "f1, f2, f3" dalam satu baris (Status WA) */
function facilityInline(facilities: string[]): string {
  return facilities.join(", ");
}

/** Satu fasilitas per baris dgn prefix ("✅ " / "- ") */
function facilityLines(facilities: string[], prefix: string): string {
  return facilities.map((f) => `${prefix}${f}`).join("\n");
}

/** Konteks string turunan — dipakai bersama semua template */
interface AdContext {
  prop: string;
  type: string;
  price: string;
  priceShort: string;
  contact: string | null;
  facs: string[];
  /** "Kamar" (kost) / "Unit" (kontrakan/rusun) */
  unitWord: "Kamar" | "Unit";
}

/** Blok "Detail Unit/Kamar" (facebook & marketplace share struktur) */
function detailBlock(ctx: AdContext, roomId: string, floor: number, bullet: string): string[] {
  return [
    `${bullet} ${ctx.unitWord}: ${roomId}`,
    `${bullet} Tipe: ${ctx.type}`,
    `${bullet} Lantai: ${floor}`,
    `${bullet} Harga sewa: ${ctx.price}/bulan`,
  ];
}

/** Blok "Detail Unit" villa — terminologi staycation: kapasitas tamu &
 *  tarif per malam (weekday & weekend mengikuti input opsional modal). */
function villaDetailBlock(
  input: AdGeneratorInput,
  ctx: AdContext,
  bullet: string,
): string[] {
  const cap = input.capacity && input.capacity > 0 ? input.capacity : null;
  const weekend =
    input.weekendPrice && input.weekendPrice > 0 ? input.weekendPrice : null;
  const lines = [
    `${bullet} Unit/Villa: ${input.roomId}`,
    `${bullet} Tipe: ${ctx.type}`,
  ];
  if (cap) {
    lines.push(`${bullet} Kapasitas: ${cap} tamu — ideal untuk keluarga & gathering`);
  }
  if (weekend) {
    lines.push(
      `${bullet} Tarif Weekday (Sen–Kam): ${ctx.price}/malam`,
      `${bullet} Tarif Weekend (Jum–Min): ${formatIDR(weekend)}/malam`,
    );
  } else {
    lines.push(
      `${bullet} Tarif sewa: ${ctx.price}/malam — booking harian & weekend`,
    );
  }
  return lines;
}

/** Blok fasilitas — versi ada/tidak ada fasilitas tercentang */
function facilityBlock(
  ctx: AdContext,
  header: string,
  prefix: string,
  emptyNote: string,
): string[] {
  if (ctx.facs.length > 0) {
    return [header, facilityLines(ctx.facs, prefix), ""];
  }
  return [emptyNote, ""];
}

/** Konteks string turunan bersama — dipakai semua template & preset villa */
function buildContext(input: AdGeneratorInput): {
  scope: AdPropertyScope;
  ctx: AdContext;
} {
  const scope = adPropertyScope(input.propertyType);
  const ctx: AdContext = {
    prop: input.propertyName.trim() || "Kost & Kontrakan",
    type: input.type.trim() || (scope === "kost" ? "Kamar" : "Unit"),
    price: formatIDR(input.price),
    priceShort: formatIDRShort(input.price),
    contact: adContactLink(input.ownerWhatsapp),
    facs: input.facilities.map((f) => f.trim()).filter(Boolean),
    unitWord: adUnitNoun(scope),
  };
  // Urutan fasilitas mengikuti prioritas tipe: kontrakan (dapur, ruang tamu,
  // parkir…) / villa (kolam renang, dapur, view, BBQ…)
  if (scope === "house" || scope === "unit") ctx.facs = sortFacilitiesForHouse(ctx.facs);
  else if (scope === "villa") ctx.facs = sortFacilitiesForVilla(ctx.facs);
  return { scope, ctx };
}

/**
 * Bangun draf iklan sesuai format + variasi gaya pilihan. Murni string
 * templating — cepat dan gratis (client-side). `style` di luar 0..3 tetap
 * aman (di-normalisasi modulo). Struktur teks otomatis menyesuaikan tipe
 * properti aktif (Kamar kost vs Rumah Kontrakan / Unit Rusun vs Unit Villa
 * dengan terminologi staycation).
 */
export function generateAd(format: AdFormatId, input: AdGeneratorInput, style = 0): string {
  const s = ((Math.trunc(style) % AD_STYLE_COUNT) + AD_STYLE_COUNT) % AD_STYLE_COUNT;
  const { scope, ctx } = buildContext(input);

  if (scope === "villa") {
    const copy = villaCopy();
    if (format === "facebook") return generateFacebookVilla(s, input, ctx, copy);
    if (format === "whatsapp") return generateWhatsappVilla(s, input, ctx);
    return generateMarketplaceVilla(s, input, ctx, copy);
  }

  if (scope !== "kost") {
    const copy = houseCopy(scope);
    if (format === "facebook") return generateFacebookHouse(s, input, ctx, copy);
    if (format === "whatsapp") return generateWhatsappHouse(s, input, ctx, copy);
    return generateMarketplaceHouse(s, input, ctx, copy);
  }

  if (format === "facebook") {
    return generateFacebook(s, input, ctx);
  }
  if (format === "whatsapp") {
    return generateWhatsapp(s, input, ctx);
  }
  return generateMarketplace(s, input, ctx);
}

// ── Format 1: Grup Facebook / Komunitas (KOST — klasik) ──────────────────────

function generateFacebook(s: number, input: AdGeneratorInput, ctx: AdContext): string {
  const detail = () => ["🏠 Detail Kamar:", ...detailBlock(ctx, input.roomId, input.floor, "▪️"), ""];
  const facs = () =>
    facilityBlock(
      ctx,
      "✨ Fasilitas:",
      "✅ ",
      "✨ Chat saja untuk info fasilitas lengkapnya.",
    );
  const contact = (intro: string) =>
    ctx.contact ? [intro, `👉 ${ctx.contact}`, ""] : [];

  if (s === 0) {
    // Angle URGENSI — sisa unit terakhir, siapa cepat dia dapat
    const lines: string[] = [
      `🚨 SISA KAMAR TERBATAS — ${ctx.prop.toUpperCase()} 🚨`,
      "",
      "Perhatian! Baru saja ada penghuni pindah dan kamar ini langsung dilepas. Unit terakhir sebelum penuh — siapa cepat dia dapat! 🏃",
      "",
      ...detail(),
      ...facs(),
      ...contact(
        "📲 Jangan sampai keburu diambil orang lain — chat WhatsApp sekarang:",
      ),
      "Unit terbatas, pertama datang pertama dapat! 🙏",
    ];
    return lines.join("\n");
  }

  if (s === 1) {
    // Angle KENYAMANAN & FASILITAS — istirahat tenang, tinggal bawa koper
    const lines: string[] = [
      `🛏️ KAMAR NYAMAN UNTUK ISTIRAHAT TENANG — ${ctx.prop}`,
      "",
      "Setelah seharian beraktivitas, semua orang butuh tempat istirahat yang tenang. Kamar ini bersih, terawat, dan siap huni — tinggal bawa koper! 🧳",
      "",
      ...detail(),
      ...facs(),
      ...contact("📲 Mau lihat langsung kondisi kamar? Jadwalkan survey via WhatsApp:"),
      "Kenyamanan Anda prioritas kami — sampai jumpa di " + ctx.prop + "! 🙏",
    ];
    return lines.join("\n");
  }

  if (s === 2) {
    // Angle HEMAT / TRANSPARAN — tanpa biaya tersembunyi
    const lines: string[] = [
      `💰 KAMAR SESUAI KANTONG — ${ctx.prop} 💰`,
      "",
      "Cari tempat tinggal nyaman tanpa bikin dompet tipis? Harga di sini terjangkau dan TRANSPARAN — tanpa biaya tersembunyi, harga di iklan = harga yang Anda bayar.",
      "",
      ...detail(),
      ...(ctx.facs.length > 0
        ? facilityBlock(ctx, "✨ Sudah termasuk fasilitas:", "✅ ", "")
        : ["✨ Harga sudah termasuk fasilitas pokok — chat untuk detailnya.", ""]),
      ...contact("📲 Tanya-tanya harga & syarat sewa? Langsung chat WhatsApp:"),
      "Harga bersahabat, kualitas tetap terjaga. Salam hemat! 💸",
    ];
    return lines.join("\n");
  }

  // Angle SANTAI / PENYEWA BAIK — ramah tetangga, aman & kondusif
  const lines: string[] = [
    `👋 HALO SEMUA! ADA KAMAR KOSONG DI ${ctx.prop}`,
    "",
    "Santai dulu, jangan panik 😄 — ada kamar kosong yang siap jadi rumah baru Anda. Lingkungannya aman, kondusif, dan penghuninya ramah-ramah. Cocok buat yang mau pindah tanpa drama.",
    "",
    ...detail(),
    ...facs(),
    ...contact("📲 Minat — atau cuma mau tanya-tanya dulu juga boleh banget? Chat aja:"),
    "Sampai ketemu di lingkungan baru yang nyaman! 🏡",
  ];
  return lines.join("\n");
}

// ── Format 1: Grup Facebook / Komunitas (KONTRAKAN / RUSUN — adaptif) ────────

function generateFacebookHouse(
  s: number,
  input: AdGeneratorInput,
  ctx: AdContext,
  copy: HouseCopy,
): string {
  const detail = () => [
    `🏠 Detail ${ctx.unitWord}:`,
    ...detailBlock(ctx, input.roomId, input.floor, "▪️"),
    "",
  ];
  const facs = () =>
    facilityBlock(
      ctx,
      "✨ Fasilitas:",
      "✅ ",
      "✨ Chat saja untuk info fasilitas lengkapnya.",
    );
  const contact = (intro: string) =>
    ctx.contact ? [intro, `👉 ${ctx.contact}`, ""] : [];

  if (s === 0) {
    // Angle URGENSI — unit baru dilepas, siapa cepat dia dapat
    const lines: string[] = [
      `🚨 DISEWAKAN CEPAT: ${copy.listing.toUpperCase()} — ${ctx.prop.toUpperCase()} 🚨`,
      "",
      `Tersedia unit kosong: ${input.roomId} — baru saja dilepas dan siap huni. Unit terbatas, siapa cepat dia dapat! 🏃`,
      "",
      ...detail(),
      ...facs(),
      copy.target,
      "",
      ...contact(
        "📲 Jangan sampai keburu diambil orang lain — chat WhatsApp sekarang:",
      ),
      "Unit terbatas, pertama datang pertama dapat! 🙏",
    ];
    return lines.join("\n");
  }

  if (s === 1) {
    // Angle KENYAMANAN — bersih & nyaman, siap huni (headline sesuai spek)
    const lines: string[] = [
      `🏠 DISEWAKAN: ${copy.listing} Bersih & Nyaman — Siap Huni!`,
      "",
      `Tersedia unit kosong: ${input.roomId} — bersih, terawat, dan tinggal bawa koper. Lingkungan tenang, ideal untuk istirahat keluarga setelah seharian beraktivitas. 🧳`,
      "",
      ...detail(),
      ...facs(),
      "",
      copy.target,
      "",
      ...contact("📲 Mau lihat langsung kondisi unitnya? Jadwalkan survey via WhatsApp:"),
      `Kenyamanan Anda prioritas kami — sampai jumpa di ${ctx.prop}! 🙏`,
    ];
    return lines.join("\n");
  }

  if (s === 2) {
    // Angle HEMAT / TRANSPARAN — tanpa biaya tersembunyi
    const lines: string[] = [
      `💰 ${copy.listing.toUpperCase()} SESUAI KANTONG — ${ctx.prop} 💰`,
      "",
      "Cari hunian nyaman tanpa bikin dompet tipis? Harga sewa di sini terjangkau dan TRANSPARAN — tanpa biaya tersembunyi, harga di iklan = harga yang Anda bayar.",
      "",
      ...detail(),
      ...(ctx.facs.length > 0
        ? facilityBlock(ctx, "✨ Sudah termasuk fasilitas:", "✅ ", "")
        : ["✨ Harga sudah termasuk fasilitas pokok — chat untuk detailnya.", ""]),
      "",
      copy.target,
      "",
      ...contact("📲 Tanya-tanya harga & syarat sewa? Langsung chat WhatsApp:"),
      "Harga bersahabat, kualitas tetap terjaga. Salam hemat! 💸",
    ];
    return lines.join("\n");
  }

  // Angle SANTAI / PENYEWA BAIK — ramah, aman & kondusif
  const lines: string[] = [
    `👋 HALO SEMUA! ADA UNIT KOSONG DI ${ctx.prop}`,
    "",
    "Santai dulu, jangan panik 😄 — ada unit yang siap jadi rumah baru Anda. Lingkungannya aman, bersih, dan kondusif untuk keluarga.",
    "",
    ...detail(),
    ...facs(),
    "",
    copy.target,
    "",
    ...contact("📲 Minat — atau cuma mau tanya-tanya dulu juga boleh banget? Chat aja:"),
    "Sampai ketemu di lingkungan baru yang nyaman! 🏡",
  ];
  return lines.join("\n");
}

// ── Format 2: Status / Story WhatsApp (KOST — klasik) ────────────────────────

function generateWhatsapp(s: number, input: AdGeneratorInput, ctx: AdContext): string {
  const head = () => [`Kamar ${input.roomId} · ${ctx.type}`, `💰 ${ctx.priceShort}/bln`];
  const facs = () => (ctx.facs.length > 0 ? [`✅ ${facilityInline(ctx.facs)}`] : []);
  const cta = (label: string) => (ctx.contact ? [`${label}: ${ctx.contact}`] : []);

  if (s === 0) {
    return [
      `🚨 SISA KAMAR TERBATAS di ${ctx.prop}!`,
      "",
      ...head(),
      ...facs(),
      "",
      "Siapa cepat dia dapat — unit bisa habis kapan saja! ⚡",
      ...cta("Chat sekarang 📲"),
    ].join("\n");
  }

  if (s === 1) {
    return [
      `😴 Kamar nyaman, istirahat tenang di ${ctx.prop}`,
      "",
      ...head(),
      ...facs(),
      "",
      "Bersih & siap huni — tinggal bawa koper 🧳",
      ...cta("Minat? Chat 📲"),
    ].join("\n");
  }

  if (s === 2) {
    return [
      `💰 Kamar ekonomis di ${ctx.prop}!`,
      "",
      ...head(),
      ...facs(),
      "",
      "Tanpa biaya tersembunyi — harga bersahabat",
      ...cta("Tanya-tanya? Chat 📲"),
    ].join("\n");
  }

  return [
    `👋 Halo! Ada kamar kosong di ${ctx.prop} nih`,
    "",
    ...head(),
    ...facs(),
    "",
    "Lingkungan aman & kondusif — dijamin betah 🏡",
    ...cta("Mampir & survey? Chat 📲"),
  ].join("\n");
}

// ── Format 2: Status / Story WhatsApp (KONTRAKAN / RUSUN — adaptif) ──────────

function generateWhatsappHouse(
  s: number,
  input: AdGeneratorInput,
  ctx: AdContext,
  copy: HouseCopy,
): string {
  const facsLine = ctx.facs.length > 0 ? `Fasilitas: ${facilityInline(ctx.facs)}` : null;
  const waLine = ctx.contact ? `WA: ${ctx.contact}` : null;
  const unitRef = `(${ctx.unitWord} ${input.roomId})`;

  if (s === 0) {
    // Angle URGENSI
    return [
      `🚨 Buruan! Ada 1 ${copy.nounLower} kosong nih di ${ctx.prop} ${unitRef}! 🏠⚡`,
      ...(facsLine ? [facsLine] : []),
      `Harga: ${ctx.priceShort}/bln.`,
      "Siapa cepat dia dapat — unit bisa habis kapan saja!",
      `${copy.targetShort} Yang cari sewa langsung japri yaa 👇`,
      ...(waLine ? [waLine] : []),
    ].join("\n");
  }

  if (s === 1) {
    // Angle KENYAMANAN — siap huni, tinggal bawa koper
    return [
      `Ada 1 ${copy.nounLower} bersih & siap huni nih di ${ctx.prop} ${unitRef}! 🏠✨`,
      ...(facsLine ? [facsLine] : []),
      `Harga: ${ctx.priceShort}/bln. Tinggal bawa koper — langsung nyaman huni 🧳`,
      `${copy.targetShort} Yang minat langsung japri yaa 👇`,
      ...(waLine ? [waLine] : []),
    ].join("\n");
  }

  if (s === 2) {
    // Angle HEMAT — tanpa biaya tersembunyi
    return [
      `💰 ${copy.nounLower.charAt(0).toUpperCase() + copy.nounLower.slice(1)} ekonomis kosong di ${ctx.prop} ${unitRef}!`,
      ...(facsLine ? [facsLine] : []),
      `Harga: ${ctx.priceShort}/bln. Tanpa biaya tersembunyi — harga bersahabat.`,
      `${copy.targetShort} Tanya-tanya dulu juga boleh, langsung japri yaa 👇`,
      ...(waLine ? [waLine] : []),
    ].join("\n");
  }

  // Angle SANTAI — struktur persis spek: singkat, kasual, padat
  return [
    `Ada 1 ${copy.nounLower} kosong nih di ${ctx.prop} ${unitRef}! 🏠✨`,
    ...(facsLine ? [facsLine] : []),
    `Harga: ${ctx.priceShort}/bln. Lingkungan aman, bersih & tenang.`,
    `${copy.targetShort} Yang cari sewa langsung japri yaa 👇`,
    ...(waLine ? [waLine] : []),
  ].join("\n");
}

// ── Format 3: Marketplace (KOST — klasik) ────────────────────────────────────

function generateMarketplace(s: number, input: AdGeneratorInput, ctx: AdContext): string {
  const spec = (judul: string) => [
    judul,
    "",
    "Spesifikasi:",
    ...detailBlock(ctx, input.roomId, input.floor, "-"),
    "",
  ];
  const facs = () =>
    facilityBlock(ctx, "Fasilitas:", "- ", "Fasilitas lengkap — silakan tanya via chat.");
  const contact = (intro: string) =>
    ctx.contact ? ["", intro, ctx.contact] : [];

  if (s === 0) {
    return [
      ...spec(`Disewa Cepat — Kamar ${ctx.type} ${ctx.prop} (Unit Terbatas)`),
      ...facs(),
      "Kondisi: siap huni. Unit terbatas — siapa cepat dia dapat, booking cepat sebelum habis.",
      ...contact("Survey & booking cepat? Hubungi via WhatsApp:"),
    ].join("\n");
  }

  if (s === 1) {
    return [
      ...spec(`Kamar Nyaman Siap Huni — ${ctx.prop}`),
      ...facs(),
      "Kondisi: bersih & terawat, tinggal bawa koper. Cocok untuk pekerja/mahasiswa yang butuh tempat istirahat tenang.",
      ...contact("Mau survey dulu? Hubungi via WhatsApp:"),
    ].join("\n");
  }

  if (s === 2) {
    return [
      ...spec(`Kamar Ekonomis Tanpa Biaya Tersembunyi — ${ctx.prop}`),
      ...facs(),
      "Kondisi: harga transparan sesuai iklan — tanpa biaya kejutan, sudah termasuk fasilitas yang tercantum.",
      ...contact("Tanya harga & syarat? Hubungi via WhatsApp:"),
    ].join("\n");
  }

  return [
    ...spec(`Kamar di Lingkungan Aman & Kondusif — ${ctx.prop}`),
    ...facs(),
    "Kondisi: siap huni, lingkungan ramah & kondusif untuk mahasiswa maupun pekerja.",
    ...contact("Tanya-tanya dulu juga boleh — hubungi via WhatsApp:"),
  ].join("\n");
}

// ── Format 3: Marketplace (KONTRAKAN / RUSUN — adaptif) ──────────────────────

function generateMarketplaceHouse(
  s: number,
  input: AdGeneratorInput,
  ctx: AdContext,
  copy: HouseCopy,
): string {
  const spec = (judul: string) => [
    judul,
    "",
    "Spesifikasi:",
    ...detailBlock(ctx, input.roomId, input.floor, "-"),
    "",
  ];
  const facs = () =>
    facilityBlock(ctx, "Fasilitas:", "- ", "Fasilitas lengkap — silakan tanya via chat.");
  const contact = (intro: string) =>
    ctx.contact ? ["", intro, ctx.contact] : [];

  if (s === 0) {
    return [
      ...spec(`Disewa Cepat — ${copy.listing} di ${ctx.prop} (Unit Terbatas)`),
      ...facs(),
      `Kondisi: siap huni. Unit kosong: ${input.roomId} — unit terbatas, siapa cepat dia dapat, booking cepat sebelum habis.`,
      ...contact("Survey & booking cepat? Hubungi via WhatsApp:"),
    ].join("\n");
  }

  if (s === 1) {
    return [
      ...spec(`${copy.listing} Bersih & Siap Huni — ${ctx.prop}`),
      ...facs(),
      "Kondisi: bersih & terawat, tinggal bawa koper. Cocok untuk keluarga kecil, pasutri baru, atau pekerja baik-baik yang butuh hunian tenang.",
      ...contact("Mau survey dulu? Hubungi via WhatsApp:"),
    ].join("\n");
  }

  if (s === 2) {
    return [
      ...spec(`${copy.listing} Ekonomis Tanpa Biaya Tersembunyi — ${ctx.prop}`),
      ...facs(),
      "Kondisi: harga transparan sesuai iklan — tanpa biaya kejutan, sudah termasuk fasilitas yang tercantum.",
      ...contact("Tanya harga & syarat sewa? Hubungi via WhatsApp:"),
    ].join("\n");
  }

  return [
    ...spec(`${copy.listing} di Lingkungan Aman & Tenang — ${ctx.prop}`),
    ...facs(),
    "Kondisi: siap huni, lingkungan aman, bersih & kondusif untuk keluarga kecil maupun pekerja.",
    ...contact("Tanya-tanya dulu juga boleh — hubungi via WhatsApp:"),
  ].join("\n");
}

// ── Format 1: Grup Facebook / Komunitas (VILLA / HOMESTAY — staycation) ──────

function generateFacebookVilla(
  s: number,
  input: AdGeneratorInput,
  ctx: AdContext,
  copy: VillaCopy,
): string {
  const cap = input.capacity && input.capacity > 0 ? input.capacity : null;
  const detail = () => ["🏡 Detail Unit:", ...villaDetailBlock(input, ctx, "▪️"), ""];
  const facs = () =>
    facilityBlock(
      ctx,
      "✨ Fasilitas Villa:",
      "✅ ",
      "✨ Chat saja untuk info fasilitas lengkapnya (kolam renang, dapur, view, dll.).",
    );
  const contact = (intro: string) =>
    ctx.contact ? [intro, `👉 ${ctx.contact}`, ""] : [];
  const capLine = () =>
    cap
      ? [`Muat hingga ${cap} tamu — pas untuk keluarga besar maupun rombongan.`, ""]
      : [];

  if (s === 0) {
    // Angle URGENSI — tanggal favorit cepat penuh
    return [
      `🏖️ TANGGAL LIBURAN CEPAT PENUH — ${copy.listing.toUpperCase()} DI ${ctx.prop.toUpperCase()} 🏖️`,
      "",
      `Weekend & tanggal favorit sering dibooking duluan! Unit kosong: ${input.roomId} — amankan tanggal staycation Anda sebelum keburu penuh. 🏃`,
      "",
      ...detail(),
      ...facs(),
      "",
      ...capLine(),
      "Cocok untuk staycation keluarga, gathering sahabat, atau healing weekend. 🌿",
      "",
      ...contact("📲 Cek ketersediaan tanggal & reservasi langsung via WhatsApp:"),
      "Tanggal bagus cepat habis — booking sekarang! 🙏",
    ].join("\n");
  }

  if (s === 1) {
    // Angle KENYAMANAN — staycation nyaman untuk keluarga
    return [
      `🌿 STAYCATION NYAMAN UNTUK KELUARGA — ${ctx.prop}`,
      "",
      "Butuh healing tanpa jauh-jauh? Unit ini bersih, privat, dan siap menemani liburan Anda — datang sebagai tamu, pulang bawa cerita. ✨",
      "",
      ...detail(),
      ...facs(),
      "",
      ...capLine(),
      ...contact(
        "📲 Tanya tanggal check-in / check-out & ketersediaan? Chat WhatsApp:",
      ),
      `Sampai jumpa di ${ctx.prop} — liburannya jangan cuma wacana! 🏡`,
    ].join("\n");
  }

  if (s === 2) {
    // Angle HEMAT — weekday rate spesial, tanpa biaya kejutan
    return [
      `💰 STAYCATION HEMAT — WEEKDAY RATE SPESIAL DI ${ctx.prop} 💰`,
      "",
      "Liburan nyaman nggak harus mahal. Booking Senin–Kamis dan nikmati tarif lebih ramah di kantong — harga di iklan = harga yang Anda bayar, tanpa biaya kejutan.",
      "",
      ...detail(),
      ...(ctx.facs.length > 0
        ? facilityBlock(ctx, "✨ Sudah termasuk fasilitas:", "✅ ", "")
        : ["✨ Chat untuk info fasilitas lengkapnya.", ""]),
      "",
      ...capLine(),
      ...contact("📲 Kunci tanggal hemat Anda & cek ketersediaan via WhatsApp:"),
      "Weekday rate terbatas — makin cepat makin hemat! 💸",
    ].join("\n");
  }

  // Angle SANTAI — reuni / gathering / arisan
  return [
    `👋 REUNI, GATHERING, ATAU HEALING BARENG? ADA UNIT KOSONG DI ${ctx.prop}!`,
    "",
    "Rencana kumpul keluarga besar atau staycation bareng sahabat? Unit ini siap jadi panggung kenangan baru — nyaman, privat, dan bebas drama. 😄",
    "",
    ...detail(),
    ...facs(),
    "",
    ...capLine(),
    ...contact("📲 Cek ketersediaan tanggal & reservasi via WhatsApp:"),
    `Sampai ketemu di ${ctx.prop}! 🏡`,
  ].join("\n");
}

// ── Format 2: Status / Story WhatsApp (VILLA / HOMESTAY — staycation) ────────

function generateWhatsappVilla(
  s: number,
  input: AdGeneratorInput,
  ctx: AdContext,
): string {
  const cap = input.capacity && input.capacity > 0 ? input.capacity : null;
  const weekend =
    input.weekendPrice && input.weekendPrice > 0 ? input.weekendPrice : null;
  const head = () => [
    `Unit ${input.roomId} · ${ctx.type}`,
    ...(cap ? [`👨‍👩‍👧‍👦 Kapasitas ${cap} tamu`] : []),
    `💸 ${ctx.priceShort}/malam`,
    ...(weekend ? [`🌙 Weekend: ${formatIDRShort(weekend)}/malam`] : []),
  ];
  const facs = () => (ctx.facs.length > 0 ? [`✅ ${facilityInline(ctx.facs)}`] : []);
  const cta = (label: string) => (ctx.contact ? [`${label}: ${ctx.contact}`] : []);

  if (s === 0) {
    // Angle URGENSI — tanggal favorit cepat penuh
    return [
      `🏖️ Weekend & tanggal favorit di ${ctx.prop} cepat penuh!`,
      "",
      ...head(),
      ...facs(),
      "",
      "Cek tanggal kosong & booking check-in sekarang ⚡",
      ...cta("Reservasi 📲"),
    ].join("\n");
  }

  if (s === 1) {
    // Angle KENYAMANAN — staycation keluarga
    return [
      `🌿 Staycation nyaman di ${ctx.prop} — pas buat keluarga!`,
      "",
      ...head(),
      ...facs(),
      "",
      "Bersih & privat — datang sebagai tamu, pulang bawa cerita ✨",
      ...cta("Cek tanggal & booking 📲"),
    ].join("\n");
  }

  if (s === 2) {
    // Angle HEMAT — weekday rate
    return [
      `💰 Weekday rate lebih hemat di ${ctx.prop}!`,
      "",
      ...head(),
      ...facs(),
      "",
      "Booking Sen–Kam, tarif lebih ramah — tanpa biaya kejutan",
      ...cta("Kunci tanggal hemat 📲"),
    ].join("\n");
  }

  // Angle SANTAI — reuni / gathering
  return [
    `👋 Reuni / gathering? Ada unit kosong di ${ctx.prop}!`,
    "",
    ...head(),
    ...facs(),
    "",
    "Nyaman & privat — cocok buat rombongan 🏡",
    ...cta("Cek ketersediaan 📲"),
  ].join("\n");
}

// ── Format 3: Marketplace (VILLA / HOMESTAY — staycation) ────────────────────

function generateMarketplaceVilla(
  s: number,
  input: AdGeneratorInput,
  ctx: AdContext,
  copy: VillaCopy,
): string {
  const spec = (judul: string) => [
    judul,
    "",
    "Spesifikasi:",
    ...villaDetailBlock(input, ctx, "-"),
    "",
  ];
  const facs = () =>
    facilityBlock(ctx, "Fasilitas Villa:", "- ", "Fasilitas lengkap — silakan tanya via chat.");
  const contact = (intro: string) =>
    ctx.contact ? ["", intro, ctx.contact] : [];

  if (s === 0) {
    return [
      ...spec(`Disewa Harian — ${copy.listing} di ${ctx.prop} (Tanggal Favorit Cepat Penuh)`),
      ...facs(),
      "Kondisi: bersih & siap ditempati. Booking harian / weekend — cek ketersediaan tanggal sebelum terlambat.",
      ...contact("Cek ketersediaan & reservasi via WhatsApp:"),
    ].join("\n");
  }

  if (s === 1) {
    return [
      ...spec(`Staycation Nyaman untuk Keluarga — ${ctx.prop}`),
      ...facs(),
      "Kondisi: bersih & terawat. Cocok untuk staycation keluarga, gathering sahabat, maupun reuni besar.",
      ...contact("Tanya tanggal check-in & reservasi via WhatsApp:"),
    ].join("\n");
  }

  if (s === 2) {
    return [
      ...spec(`${copy.listing} Hemat Tanpa Biaya Kejutan — ${ctx.prop}`),
      ...facs(),
      "Kondisi: harga transparan sesuai iklan — weekday rate lebih hemat, tanpa biaya kejutan.",
      ...contact("Cek tarif & ketersediaan via WhatsApp:"),
    ].join("\n");
  }

  return [
    ...spec(`Unit untuk Reuni, Gathering & Staycation — ${ctx.prop}`),
    ...facs(),
    "Kondisi: siap ditempati, nyaman & privat untuk keluarga besar maupun rombongan.",
    ...contact("Tanya-tanya dulu juga boleh — cek ketersediaan via WhatsApp:"),
  ].join("\n");
}

// ── Preset Cepat Villa/Homestay — caption siap pakai per platform sosmed ─────

export type VillaPresetId = "instagram" | "facebook-ads" | "wa-story";

export interface VillaPresetMeta {
  id: VillaPresetId;
  label: string;
  hint: string;
}

/** Preset caption khusus Villa/Homestay — tampil di modal sbg "Preset Cepat"
 *  (klik → preview langsung terisi, tinggal edit & salin). */
export const VILLA_PRESETS: VillaPresetMeta[] = [
  { id: "instagram", label: "Instagram", hint: "Caption estetik + hashtag" },
  { id: "facebook-ads", label: "Facebook Ads", hint: "Hook — benefit — CTA iklan" },
  { id: "wa-story", label: "WhatsApp Story", hint: "Singkat, padat, langsung reservasi" },
];

/** Bangun caption preset villa dari data unit aktual. Kapasitas & tarif
 *  weekend ikut masuk bila diisi; nomor WA kosong → CTA tanpa link. */
export function buildVillaPreset(id: VillaPresetId, input: AdGeneratorInput): string {
  const { ctx } = buildContext(input);
  const cap = input.capacity && input.capacity > 0 ? input.capacity : null;
  const weekend =
    input.weekendPrice && input.weekendPrice > 0 ? input.weekendPrice : null;

  if (id === "instagram") {
    return [
      `🏝️ STAYCATION ALERT — ${ctx.prop.toUpperCase()} ✨`,
      "",
      `Cocok buat healing weekend bareng keluarga atau sahabat! Nyaman, privat, dan siap jadi latar kenangan liburan Anda.${cap ? ` Muat hingga ${cap} tamu — pas untuk rombongan!` : ""}`,
      "",
      `🏡 ${ctx.prop} — Unit ${input.roomId}`,
      `🛏️ Tipe: ${ctx.type}${cap ? ` · Kapasitas ${cap} tamu` : ""}`,
      ...(ctx.facs.length > 0
        ? ["🌊 Fasilitas Villa:", facilityLines(ctx.facs, "✅ "), ""]
        : ["🌊 Chat untuk info fasilitas villa lengkapnya.", ""]),
      ...(weekend
        ? [
            `💸 Tarif Weekday (Sen–Kam): ${ctx.price}/malam`,
            `💸 Tarif Weekend (Jum–Min): ${formatIDR(weekend)}/malam`,
          ]
        : [`💸 Mulai ${ctx.price}/malam — booking harian & weekend`]),
      "",
      "📅 Cek ketersediaan tanggal & reservasi langsung:",
      ...(ctx.contact
        ? [`📲 ${ctx.contact}`]
        : ["📲 Hubungi kami via WhatsApp — cek nomor di bio."]),
      "",
      "#staycation #villa #homestay #liburankeluarga #healing #weekendgetaway #penginapan #wisata",
    ].join("\n");
  }

  if (id === "facebook-ads") {
    return [
      `🎒 LIBURAN GAK PERLU JAUH-JAUH — ${ctx.prop.toUpperCase()}`,
      "",
      `Butuh tempat menginap nyaman buat staycation keluarga, gathering, atau reunion?${cap ? ` Kapasitas hingga ${cap} tamu — pas untuk rombongan.` : ""}`,
      "",
      ...(ctx.facs.length > 0
        ? ["✅ Fasilitas lengkap:", facilityLines(ctx.facs, "• "), ""]
        : []),
      ...(weekend
        ? [`💸 ${ctx.price}/malam (weekday) · ${formatIDR(weekend)}/malam (weekend)`]
        : [`💸 ${ctx.price}/malam — booking harian & weekend`]),
      `📍 Unit ${input.roomId} · ${ctx.type}`,
      "",
      "📅 Tanggal favorit cepat penuh — cek ketersediaan & reservasi sekarang:",
      ...(ctx.contact ? [`👉 ${ctx.contact}`] : []),
      "",
      "Reservasi hari ini, liburan besok! 🏡",
    ].join("\n");
  }

  // wa-story — singkat, padat, langsung reservasi
  return [
    `🏖️ Staycation di ${ctx.prop}!`,
    "",
    `Unit ${input.roomId} · ${ctx.type}`,
    ...(cap ? [`👨‍👩‍👧‍👦 Kapasitas ${cap} tamu`] : []),
    ...(ctx.facs.length > 0 ? [`✅ ${facilityInline(ctx.facs)}`] : []),
    `💸 ${ctx.priceShort}/malam${weekend ? ` · Weekend ${formatIDRShort(weekend)}/malam` : ""}`,
    "",
    "Cek tanggal kosong & reservasi:",
    ...(ctx.contact ? [`📲 ${ctx.contact}`] : []),
  ].join("\n");
}
