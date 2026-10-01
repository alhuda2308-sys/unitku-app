// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Checkout lisensi seumur hidup via Mayar API (server-only)
//
// POST /api/checkout
//   Body : { name, email, phone }  (semua wajib)
//   Flow : validasi input → POST {MAYAR_API_BASE_URL}/payment/create
//          (Authorization: Bearer MAYAR_API_KEY) → ambil `data.link`
//          → kirim { paymentUrl } ke client untuk redirect otomatis.
//
//   Invoice dibuat per-pembeli (nama/email/no. WA terkirim ke Mayar), sehingga
//   data pembayaran & webhook balik (payment.received) selaras — lisensi
//   diaktifkan otomatis oleh /api/webhooks/mayar setelah pembayaran sukses.
//
// Env produksi (Vercel):
//   MAYAR_API_KEY        API key Mayar (KYC terverifikasi) — WAJIB
//   MAYAR_API_BASE_URL   default https://api.mayar.id/hl/v1 (override utk test)
//   LICENSE_REDIRECT_URL opsional — default {origin}/payment/success
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import { LICENSE_AMOUNT_IDR } from "@/lib/landing-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAYAR_DESCRIPTION = "Lisensi Seumur Hidup UnitKu - Early Adopter";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Normalisasi nomor Indonesia ke 62xxxxxxxxxx (terima 08… / 62… / +62…) */
function normalizeWaPhone(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
}

interface CheckoutInput {
  name: string;
  email: string;
  phone: string;
}

function parseInput(
  body: unknown,
): { ok: true; data: CheckoutInput } | { ok: false; error: string; field: string } {
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

/** Ambil URL pembayaran dari beberapa bentuk response Mayar yang dikenal */
function extractPaymentUrl(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const root = payload as Record<string, unknown>;
  const data =
    typeof root.data === "object" && root.data !== null
      ? (root.data as Record<string, unknown>)
      : {};
  for (const candidate of [
    data.link,
    data.url,
    data.paymentUrl,
    data.payment_url,
    data.checkoutUrl,
    data.checkout_url,
    root.link,
    root.url,
  ]) {
    if (typeof candidate === "string" && candidate.startsWith("http")) return candidate;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.MAYAR_API_KEY ?? "";
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Checkout otomatis belum aktif. Silakan gunakan tombol 'Pesan Manual via WhatsApp Admin'.",
      },
      { status: 503 },
    );
  }

  const parsed = parseInput(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, error: parsed.error, field: parsed.field },
      { status: 400 },
    );
  }
  const { name, email, phone } = parsed.data;

  const redirectUrl =
    process.env.LICENSE_REDIRECT_URL || `${request.nextUrl.origin}/payment/success`;

  const apiBase = (
    process.env.MAYAR_API_BASE_URL || "https://api.mayar.id/hl/v1"
  ).replace(/\/+$/, "");

  try {
    const response = await fetch(`${apiBase}/payment/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        mobile: phone,
        amount: LICENSE_AMOUNT_IDR,
        description: MAYAR_DESCRIPTION,
        redirectUrl,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const detail =
        typeof payload === "object" && payload !== null && "message" in payload
          ? String((payload as { message?: unknown }).message)
          : `HTTP ${response.status}`;
      console.error(
        `[UnitKu Checkout] Mayar menolak pembuatan invoice (${detail}) — email: ${email}`,
      );
      return NextResponse.json(
        {
          success: false,
          error:
            "Gagal membuat invoice pembayaran. Coba lagi sebentar atau gunakan pemesanan manual via WhatsApp.",
        },
        { status: 502 },
      );
    }

    const paymentUrl = extractPaymentUrl(payload);
    if (!paymentUrl) {
      console.error(
        "[UnitKu Checkout] Response Mayar tanpa URL pembayaran:",
        JSON.stringify(payload)?.slice(0, 500),
      );
      return NextResponse.json(
        {
          success: false,
          error:
            "Response pembayaran tidak dikenali. Coba lagi sebentar atau gunakan pemesanan manual via WhatsApp.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, paymentUrl });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("[UnitKu Checkout] Gagal menghubungi Mayar:", reason);
    return NextResponse.json(
      {
        success: false,
        error:
          "Tidak dapat menghubungi server pembayaran. Periksa koneksi lalu coba lagi, atau gunakan pemesanan manual via WhatsApp.",
      },
      { status: 502 },
    );
  }
}
