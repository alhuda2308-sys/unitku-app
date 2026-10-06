// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Identitas login tanpa email (Nomor WhatsApp sebagai identitas)
//
// Pendaftaran owner tidak lagi meminta email (zero friction, selaras form
// checkout). Supabase Auth tetap mewajibkan format email, sehingga akun
// didaftarkan dengan EMAIL SINTETIS dari nomor WhatsApp:
//
//   6281234567890  →  6281234567890@user.unitku.my.id
//
// Nomor asli & Nama Lengkap tetap tersimpan di user metadata Supabase
// (raw_user_meta_data: full_name + phone) dan tabel lead Admin.
// Resolver login menerima email asli ATAU nomor WhatsApp — nomor diubah ke
// email sintetis sebelum signInWithPassword, jadi pengguna tidak pernah
// perlu menyentuh input email.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeWaPhone } from "@/lib/checkout-validation";

/** Domain namespace email sintetis — subdomain milik UnitKu, tidak dipakai inbox nyata */
export const PHONE_EMAIL_DOMAIN = "user.unitku.my.id";

/** 62xxxxxxxxxx → 62xxxxxxxxxx@user.unitku.my.id */
export function phoneToEmail(phone: string): string {
  return `${phone}@${PHONE_EMAIL_DOMAIN}`;
}

/** Deteksi email sintetis hasil konversi nomor WhatsApp */
export function isPhoneEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at === -1) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return domain === PHONE_EMAIL_DOMAIN && /^[0-9]+$/.test(local);
}

/** Email sintetis → nomor WhatsApp aslinya (null bila bukan format sintetis) */
export function phoneEmailToPhone(email: string): string | null {
  if (!isPhoneEmail(email)) return null;
  return email.slice(0, email.lastIndexOf("@"));
}

/** Tampilan nomor rapi — "6281234567890" → "+62 812-3456-7890" */
export function formatWaDisplay(phone: string): string {
  if (phone.startsWith("62")) {
    const local = phone.slice(2);
    const match = local.match(/^(\d{3})(\d{4})(\d+)$/);
    return match ? `+62 ${match[1]}-${match[2]}-${match[3]}` : `+62 ${local}`;
  }
  return `+${phone}`;
}

/**
 * Identitas sesi siap-tampil (prinsip 100% berbasis WhatsApp):
 *   - email sintetis WA (62…@user.unitku.my.id) → nomor rapi "+62 812-…"
 *   - email asli (akun lama / super admin)      → apa adanya
 *   - kosong                                    → fallback pemanggil
 * Dipakai di mana pun UI menampilkan identitas akun agar pengguna tidak
 * pernah melihat email sintetis internal yang membingungkan.
 */
export function sessionIdentityLabel(
  email: string | null | undefined,
  fallback = "Tidak diketahui",
): string {
  if (!email) return fallback;
  const phone = phoneEmailToPhone(email);
  if (phone) return formatWaDisplay(phone);
  return email;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WA_RE = /^62[0-9]{8,13}$/;

/**
 * Resolver identitas login — menerima apa pun yang diketik pengguna di kolom
 * "Email atau Nomor WhatsApp":
 *   - email valid      → dipakai apa adanya (akun lama ber-email)
 *   - nomor WhatsApp   → dikonversi ke email sintetis (akun baru tanpa email)
 *   - selain itu       → null (pemanggil membalas 400)
 */
export function resolveIdentityEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (EMAIL_RE.test(value)) return value;
  const phone = normalizeWaPhone(value);
  if (WA_RE.test(phone)) return phoneToEmail(phone);
  return null;
}
