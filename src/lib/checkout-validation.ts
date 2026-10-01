// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Validasi form data pembeli checkout lisensi (client-side, shared)
//
// Cermin dari validasi server POST /api/checkout — dipakai bersama oleh:
//   - Modal checkout landing  : src/components/landing/buy-cta.tsx
//   - Halaman iklan Facebook  : src/components/checkout/checkout-client.tsx
// sehingga aturan nama/email/No. WhatsApp selalu identik di semua entry point.
// ─────────────────────────────────────────────────────────────────────────────

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

/** Cermin validasi server /api/checkout — inline error per field */
export function validateCheckoutBuyer(
  values: CheckoutFormState,
): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  if (values.name.trim().length < 2) {
    errors.name = "Nama lengkap wajib diisi (minimal 2 karakter).";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) {
    errors.email = "Alamat email tidak valid — periksa kembali penulisannya.";
  }
  let digits = values.phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  if (!/^62[0-9]{8,13}$/.test(digits)) {
    errors.phone = "Gunakan format 08… atau 62… (9–15 digit).";
  }
  return errors;
}
