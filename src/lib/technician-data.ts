// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Kontak Teknisi (Komplain & Pemeliharaan)
//
// Daftar teknisi on-call milik pengelola — dikelola dari modal "Kelola Kontak
// Teknisi" (pill "On-call" pada panel Komplain), tersimpan di Supabase via
// /api/technicians. Dipakai tombol "Chat Teknisi" untuk dispatch WhatsApp.
// ─────────────────────────────────────────────────────────────────────────────

export interface TechnicianContact {
  id: string;
  name: string; // "Pak Yanto"
  phone: string; // "081322001177" / "+62 813-2200-1177" (bebas format — dinormalisasi)
  specialization: string; // "AC & Pendingin" | "Pipa & Sanitasi" | …
  isPrimary: boolean; // on-call utama — tampil di pill header
}

/** Preset spesialisasi pada form dropdown (dilengkapi opsi tulis manual) */
export const TECHNICIAN_SPECIALIZATIONS = [
  "AC & Pendingin",
  "Pipa & Sanitasi",
  "Listrik",
  "Tukang Bangunan/Umum",
] as const;

export const TECHNICIAN_CUSTOM_SPEC = "__custom__";

// ── Normalisasi nomor WhatsApp Indonesia ─────────────────────────────────────

/** Digit murni untuk link wa.me — "0813-2200" → "628132200…" (0/8 → 62) */
export function waDigits(phone: string): string {
  let d = phone.replace(/[^0-9]/g, "");
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  else if (d.startsWith("8")) d = `62${d}`;
  return d;
}

/** Validasi nomor WA Indonesia (08xx / 62xx, 9–15 digit) — null = valid */
export function validateWaPhone(raw: string): string | null {
  const d = raw.replace(/[^0-9]/g, "");
  if (!d) return "Nomor WhatsApp wajib diisi.";
  if (d.length < 9 || d.length > 15) return "Nomor WhatsApp tidak valid — harus 9–15 digit.";
  if (!/^(0|62|8)/.test(d)) return "Gunakan format Indonesia: 08xx atau 62xx.";
  return null;
}

/** Tampilan rapi: "6281322001177"/"081322001177" → "+62 813-2200-1177" / "0813-2200-1177" */
export function formatWaPhone(raw: string): string {
  const d = raw.replace(/[^0-9]/g, "");
  if (d.length < 6) return raw; // terlalu pendek — tampilkan apa adanya
  if (d.startsWith("62")) {
    const rest = d.slice(2);
    const groups = [rest.slice(0, 3), rest.slice(3, 7), rest.slice(7)].filter(Boolean);
    return `+62 ${groups.join("-")}`;
  }
  return [d.slice(0, 4), d.slice(4, 8), d.slice(8)].filter(Boolean).join("-");
}

/** Label singkat spesialisasi utk dropdown dispatch — "AC & Pendingin" → "AC" */
export function shortSpecialization(spec: string): string {
  const first = spec.split(/[&/,]/)[0]?.trim() ?? "";
  if (!first) return spec;
  return first.split(/\s+/)[0] ?? first;
}
