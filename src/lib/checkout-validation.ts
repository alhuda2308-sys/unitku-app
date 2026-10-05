// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Validasi & utilitas form data pembeli lisensi (client + server)
//
// Dipakai bersama oleh:
//   - Modal checkout landing      : src/components/landing/buy-cta.tsx
//   - Halaman iklan Facebook      : src/components/checkout/checkout-client.tsx
//   - POST /api/checkout          (validasi server, cermin identik)
//   - POST /api/leads             (penyimpanan lead sebelum redirect)
//   - POST /api/auth/register     (Nama + No. WhatsApp akun baru)
// sehingga aturan nama/email/No. WhatsApp selalu identik di semua entry point.
// ─────────────────────────────────────────────────────────────────────────────

import { LICENSE_PRICE_LABEL, SUPPORT_WA_NUMBER } from "@/lib/landing-config";

export interface CheckoutFormState {
  name: string;
  email: string;
  phone: string;
}

export type CheckoutFieldErrors = Partial<Record<keyof CheckoutFormState, string>>;

export const EMPTY_CHECKOUT_FORM: CheckoutFormState = {
  name: "",
  email: "",
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
 *  tetap lanjut mengisi, bukan menutup modal — target konversi Task 102. */
export function validateCheckoutBuyer(
  values: CheckoutFormState,
): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  if (values.name.trim().length < 2) {
    errors.name = "Mohon isi nama lengkap Anda (minimal 2 huruf).";
  }
  if (!EMAIL_RE.test(values.email.trim())) {
    errors.email = "Format email belum benar — cth. nama@email.com";
  }
  if (!/^62[0-9]{8,13}$/.test(normalizeWaPhone(values.phone))) {
    errors.phone = "Nomor WhatsApp belum sesuai — mulai dengan 08 atau 62 ya.";
  }
  return errors;
}

export interface BuyerInput {
  name: string; // sudah di-trim (2–100 karakter)
  email: string; // sudah di-trim + lowercase
  phone: string; // sudah dinormalisasi 62xxxxxxxxxx
}

export type BuyerParseResult =
  | { ok: true; data: BuyerInput }
  | { ok: false; error: string; field: string };

/** Validasi server untuk body { name, email, phone } — dipakai /api/checkout, /api/leads, /api/auth/register */
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
  if (!EMAIL_RE.test(email) || email.length > 254) {
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
 * Link wa.me Admin dengan draft pesan pemesanan terisi data form — dipakai
 * tombol "Pesan Manual via WhatsApp Admin" (anchor native, imun pop-up blocker)
 * sehingga Admin menerima Nama/Email/No. WhatsApp langsung di chat.
 */
export function buildManualOrderWaLink(values: CheckoutFormState): string {
  const phone = normalizeWaPhone(values.phone);
  const message = [
    `Halo Admin UnitKu, saya ingin membeli Lisensi Seumur Hidup (${LICENSE_PRICE_LABEL}).`,
    "",
    `Nama: ${values.name.trim()}`,
    `Email: ${values.email.trim()}`,
    `No. WhatsApp: ${phone}`,
    "",
    "Mohon info rekening / panduan pembayarannya. Terima kasih!",
  ].join("\n");
  return `https://wa.me/${SUPPORT_WA_NUMBER}?text=${encodeURIComponent(message)}`;
}
