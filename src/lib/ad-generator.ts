// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Generator Iklan Kamar Siap Copas ke Sosmed
//
// Smart string templating 100% client-side (tanpa biaya API tambahan):
// mengubah data kamar (nama properti, nomor kamar, harga, fasilitas, nomor WA
// owner) menjadi draf iklan promosi yang siap di-copy-paste ke:
//   1. "facebook"   — Grup Facebook / Komunitas (lengkap, ramah, emoji, link WA)
//   2. "whatsapp"   — Status / Story WhatsApp (singkat, kasual, padat)
//   3. "marketplace" — Deskripsi listing Marketplace (terstruktur, to the point)
//
// Setiap format punya 4 VARIASI GAYA (angle penulisan) agar tombol
// "Buat Ulang Draf Otomatis" selalu menghasilkan teks yang berbeda:
//   0. Urgensi     — sisa unit terakhir, siapa cepat dia dapat
//   1. Kenyamanan  — istirahat tenang, kamar bersih, tinggal bawa koper
//   2. Hemat       — harga terjangkau, tanpa biaya tersembunyi
//   3. Santai      — ramah tetangga, lingkungan aman & kondusif
// Semua variasi tetap menyisipkan data kamar aktual: nomor kamar, harga,
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
  /** Harga sewa per bulan (IDR) */
  price: number;
  /** Daftar fasilitas aktif (dari checklist modal) */
  facilities: string[];
  /** Nomor WhatsApp owner (tampil mentah, dinormalisasi ke wa.me) */
  ownerWhatsapp: string;
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
}

/** Blok "Detail Kamar" (facebook & marketplace share struktur) */
function detailBlock(ctx: AdContext, roomId: string, floor: number, bullet: string): string[] {
  return [
    `${bullet} Kamar: ${roomId}`,
    `${bullet} Tipe: ${ctx.type}`,
    `${bullet} Lantai: ${floor}`,
    `${bullet} Harga sewa: ${ctx.price}/bulan`,
  ];
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

/**
 * Bangun draf iklan sesuai format + variasi gaya pilihan. Murni string
 * templating — cepat dan gratis (client-side). `style` di luar 0..3 tetap
 * aman (di-normalisasi modulo).
 */
export function generateAd(format: AdFormatId, input: AdGeneratorInput, style = 0): string {
  const s = ((Math.trunc(style) % AD_STYLE_COUNT) + AD_STYLE_COUNT) % AD_STYLE_COUNT;
  const ctx: AdContext = {
    prop: input.propertyName.trim() || "Kost & Kontrakan",
    type: input.type.trim() || "Kamar",
    price: formatIDR(input.price),
    priceShort: formatIDRShort(input.price),
    contact: adContactLink(input.ownerWhatsapp),
    facs: input.facilities.map((f) => f.trim()).filter(Boolean),
  };

  if (format === "facebook") {
    return generateFacebook(s, input, ctx);
  }
  if (format === "whatsapp") {
    return generateWhatsapp(s, input, ctx);
  }
  return generateMarketplace(s, input, ctx);
}

// ── Format 1: Grup Facebook / Komunitas ──────────────────────────────────────

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

// ── Format 2: Status / Story WhatsApp ────────────────────────────────────────

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

// ── Format 3: Marketplace ────────────────────────────────────────────────────

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
