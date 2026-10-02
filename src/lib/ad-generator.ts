// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Generator Iklan Kamar Siap Copas ke Sosmed
//
// Smart string templating 100% client-side (tanpa biaya API tambahan):
// mengubah data kamar (nama properti, nomor kamar, harga, fasilitas, nomor WA
// owner) menjadi draf iklan promosi yang siap di-copy-paste ke:
//   1. "facebook"   — Grup Facebook / Komunitas (lengkap, ramah, emoji, link WA)
//   2. "whatsapp"   — Status / Story WhatsApp (singkat, kasual, padat)
//   3. "marketplace" — Deskripsi listing Marketplace (terstruktur, to the point)
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

/**
 * Bangun draf iklan sesuai format pilihan. Murni string templating —
 * cepat, deterministik, dan gratis (client-side).
 */
export function generateAd(format: AdFormatId, input: AdGeneratorInput): string {
  const prop = input.propertyName.trim() || "Kost & Kontrakan";
  const type = input.type.trim() || "Kamar";
  const price = formatIDR(input.price);
  const priceShort = formatIDRShort(input.price);
  const contact = adContactLink(input.ownerWhatsapp);
  const facs = input.facilities.map((f) => f.trim()).filter(Boolean);

  if (format === "facebook") {
    const lines: string[] = [
      `📢 KAMAR KOSONG — ${prop.toUpperCase()} 📢`,
      "",
      "Halo guys! 👋 Ada kamar kosong nih, cocok banget buat anak kos, karyawan, atau siapa pun yang lagi cari tempat tinggal nyaman & aman.",
      "",
      "🏠 Detail Kamar:",
      `▪️ Kamar: ${input.roomId}`,
      `▪️ Tipe: ${type}`,
      `▪️ Lantai: ${input.floor}`,
      `▪️ Harga sewa: ${price}/bulan`,
      "",
    ];
    if (facs.length > 0) {
      lines.push("✨ Fasilitas:", facilityLines(facs, "✅ "), "");
    } else {
      lines.push("✨ Chat saja untuk info fasilitas lengkapnya.", "");
    }
    if (contact) {
      lines.push(
        "📲 Serius mau sewa atau mau survey dulu? Langsung chat WhatsApp ya:",
        `👉 ${contact}`,
        "",
      );
    }
    lines.push("Kamar bagus cepat diambil — jangan sampai kehabisan ya! 🙏");
    return lines.join("\n");
  }

  if (format === "whatsapp") {
    const lines: string[] = [
      `🔥 KAMAR KOSONG di ${prop}!`,
      "",
      `Kamar ${input.roomId} · ${type}`,
      `💰 ${priceShort}/bln`,
    ];
    if (facs.length > 0) {
      lines.push(`✅ ${facilityInline(facs)}`);
    }
    lines.push("", "Siap huni — bisa langsung tanya-tanya & survey.");
    if (contact) {
      lines.push(`Minat? Chat: ${contact} 📲`);
    }
    return lines.join("\n");
  }

  // marketplace — terstruktur & to the point
  const lines: string[] = [
    `Disewa Kamar ${type} — ${prop}`,
    "",
    "Spesifikasi:",
    `- Nomor Kamar: ${input.roomId}`,
    `- Lantai: ${input.floor}`,
    `- Tipe: ${type}`,
    `- Harga Sewa: ${price}/bulan`,
    "",
  ];
  if (facs.length > 0) {
    lines.push("Fasilitas:", facilityLines(facs, "- "), "");
  }
  lines.push("Kondisi: siap huni, langsung bisa ditempati.");
  if (contact) {
    lines.push("", "Survey & tanya-tanya? Hubungi via WhatsApp:", contact);
  }
  return lines.join("\n");
}
