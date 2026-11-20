// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Validasi & utilitas form data pembeli lisensi (client + server)
//
// ZERO FRICTION — form hanya meminta 2 data: Nama + No. WhatsApp. Email
// dihapus sepenuhnya dari UI checkout (modal landing & halaman /checkout) dan
// BUKAN syarat validasi; di server email bersifat opsional.
//
// Dipakai bersama oleh:
//   - Modal checkout landing      : src/components/landing/buy-cta.tsx
//   - Halaman iklan Facebook      : src/components/checkout/checkout-client.tsx
//   - POST /api/checkout          (validasi server, cermin identik)
//   - POST /api/leads             (penyimpanan lead sebelum redirect)
//   - POST /api/auth/register     (Nama + No. WhatsApp akun baru)
// sehingga aturan nama/No. WhatsApp selalu identik di semua entry point.
// ─────────────────────────────────────────────────────────────────────────────

import { LICENSE_PRICE_LABEL, SUPPORT_WA_NUMBER } from "@/lib/landing-config";

export interface CheckoutFormState {
  name: string;
  phone: string;
}

export type CheckoutFieldErrors = Partial<Record<keyof CheckoutFormState, string>>;

export const EMPTY_CHECKOUT_FORM: CheckoutFormState = {
  name: "",
  phone: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Normalisasi nomor Indonesia ke 62xxxxxxxxxx (terima 08… / 62… / +62…) */
export function normalizeWaPhone(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
}

/** Validasi client-side — inline error per field (cermin parseBuyerInput).
 *  Pesan dibuat ramah & memberi contoh (tidak menghakimi) agar calon pembeli
 *  tetap lanjut mengisi, bukan menutup modal — target konversi.
 *  HANYA 2 field: nama + No. WhatsApp (email dihapus — zero friction). */
export function validateCheckoutBuyer(
  values: CheckoutFormState,
): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  if (values.name.trim().length < 2) {
    errors.name = "Mohon isi nama Anda (minimal 2 huruf).";
  }
  if (!/^62[0-9]{8,13}$/.test(normalizeWaPhone(values.phone))) {
    errors.phone = "Nomor WhatsApp belum sesuai — mulai dengan 08 atau 62 ya.";
  }
  return errors;
}

export interface BuyerInput {
  name: string; // sudah di-trim (2–100 karakter)
  email: string; // OPSIONAL — "" bila pembeli tidak mengisi (boleh kosong)
  phone: string; // sudah dinormalisasi 62xxxxxxxxxx
}

export type BuyerParseResult =
  | { ok: true; data: BuyerInput }
  | { ok: false; error: string; field: string };

/** Validasi server untuk body { name, email?, phone } — dipakai /api/checkout,
 *  /api/leads, /api/auth/register.
 *  Email OPSIONAL: kosong/tidak dikirim → diterima (email: ""); bila diisi,
 *  formatnya tetap divalidasi agar data lead tetap bersih. */
export function parseBuyerInput(body: unknown): BuyerParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Data pembeli tidak terkirim — coba lagi.", field: "" };
  }
  const raw = body as Record<string, unknown>;

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (name.length < 2 || name.length > 100) {
    return { ok: false, error: "Nama lengkap wajib diisi (2–100 karakter).", field: "name" };
  }

  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  if (email && (!EMAIL_RE.test(email) || email.length > 254)) {
    return {
      ok: false,
      error: "Alamat email tidak valid — periksa kembali penulisannya.",
      field: "email",
    };
  }

  const phone = normalizeWaPhone(typeof raw.phone === "string" ? raw.phone : "");
  if (!/^62[0-9]{8,13}$/.test(phone)) {
    return {
      ok: false,
      error: "Nomor WhatsApp tidak valid — gunakan format 08… atau 62… (9–15 digit).",
      field: "phone",
    };
  }

  return { ok: true, data: { name, email, phone } };
}

/**
 * Template pesan WhatsApp pemesanan manual — NETRAL & RESMI (white-label).
 * Dipakai identik untuk SEMUA pengunjung (referral maupun organik): sapaan
 * selalu "Halo Admin UnitKu" — TANPA kode referral, TANPA nama mitra, TANPA
 * penyebutan "link referral". Mitra pemilik referral tampil di mata calon
 * pembeli seolah-olah Admin Resmi UnitKu.
 *
 * Baris Nama / No. WhatsApp hanya ditambahkan bila sudah diisi di form —
 * hasil selalu VALID sejak form kosong (sapaan + penutup saja), sehingga
 * anchor wa.me tidak pernah menunjuk pesan rusak.
 */
function buildOrderWaMessage(values: CheckoutFormState): string {
  const phone = normalizeWaPhone(values.phone);
  const name = values.name.trim();
  const lines = [
    `Halo Admin UnitKu, saya tertarik aktivasi Lisensi Seumur Hidup UnitKu (${LICENSE_PRICE_LABEL}).`,
  ];
  if (name) lines.push(`Nama: ${name}`);
  if (phone) lines.push(`No. WhatsApp: ${phone}`);
  lines.push("Mohon dibantu info cara pembayarannya. Terima kasih!");
  return lines.join("\n");
}

/**
 * Link wa.me Admin pusat dengan draft pesan pemesanan terisi data form —
 * dipakai tombol "Pesan Manual via WhatsApp Admin" (anchor native, imun
 * pop-up blocker) saat TIDAK ada referral aktif (fallback organik).
 */
export function buildManualOrderWaLink(values: CheckoutFormState): string {
  return `https://wa.me/${SUPPORT_WA_NUMBER}?text=${encodeURIComponent(
    buildOrderWaMessage(values),
  )}`;
}

/**
 * Label seragam tombol sekunder checkout — WHITE-LABEL: TANPA kata "Mitra" /
 * "Affiliate" / nama mitra, TANPA nomor tujuan, untuk SEMUA pengunjung
 * (referral maupun organik). Tujuan chat mengikuti routing nomor di belakang
 * layar (WA mitra saat referral aktif, WA Admin pusat selainnya) tanpa
 * membocorkannya ke calon pembeli.
 */
export const MANUAL_ORDER_BUTTON_LABEL = "Pesan Manual via WhatsApp Admin";

// ── Mode REFERRAL MITRA — routing WA white-label ─────────────────────────────
// Saat pengunjung datang lewat link referral (?ref=…) milik mitra AKTIF yang
// punya nomor WhatsApp terdaftar, tombol sekunder checkout diarahkan ke wa.me
// MITRA (bukan Admin pusat) — calon pembeli dilayani langsung oleh mitra
// pemilik kode (komisi & follow-up tetap milik jalur afiliasi mitra).
// WHITE-LABEL: tujuan nomor TIDAK diumumkan — label tombol & isi pesan tetap
// seragam "Admin UnitKu" (MANUAL_ORDER_BUTTON_LABEL & buildOrderWaMessage)
// sehingga mitra tampil seolah-olah Admin Resmi UnitKu di mata pembeli.

/** Nomor WA mitra ternormalisasi 62xxxxxxxxxx + valid utk tujuan wa.me.
 *  Menerima 08… / 62… / +62… / format ber-tanda baca; mengembalikan null bila
 *  kosong atau bukan nomor ponsel Indonesia yang sah (8–13 digit setelah 62). */
export function normalizeMitraWaNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = normalizeWaPhone(raw);
  return /^62[0-9]{8,13}$/.test(digits) ? digits : null;
}

/** Data mitra pemilik kode referral aktif — cukup utk routing tombol WA.
 *  WHITE-LABEL: nama mitra SENGAJA tidak dibawa ke client — tidak pernah
 *  tampil di UI pembeli (label & pesan memakai identitas "Admin UnitKu"). */
export interface MitraReferralInfo {
  /** Kode referral versi kanonik di DB — atribusi internal (lead source) */
  refCode: string;
  /** Nomor WA mitra ternormalisasi 62xxxxxxxxxx (hasil normalizeMitraWaNumber) */
  waPhone: string;
}

/**
 * Link wa.me MITRA dengan draft pesan resmi yang IDENTIK dgn jalur Admin
 * (buildOrderWaMessage — tanpa kode referral / nama mitra). Dipakai tombol
 * "Pesan Manual via WhatsApp Admin" pada modal checkout landing & halaman
 * /checkout saat traffic referral aktif + mitra punya No. WA — tujuan chat =
 * nomor WA mitra (BUKAN Admin pusat), tapi calon pembeli tetap melihatnya
 * sebagai chat dengan "Admin UnitKu" (white-label).
 *
 * href tetap VALID sejak render pertama (form kosong — hanya sapaan + penutup);
 * klik sebelum form lengkap tetap dicegah oleh handler (validasi + toast),
 * konsisten dengan tombol Admin.
 */
export function buildMitraOrderWaLink(
  values: CheckoutFormState,
  mitra: Pick<MitraReferralInfo, "waPhone">,
): string {
  return `https://wa.me/${mitra.waPhone}?text=${encodeURIComponent(
    buildOrderWaMessage(values),
  )}`;
}
