// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Checkout lisensi seumur hidup via Mayar API (server-only)
//
// POST /api/checkout
//   Body : { name, phone, email? }  — email OPSIONAL (zero friction: form
//          checkout hanya meminta Nama + No. WhatsApp).
//   Flow : validasi input (parseBuyerInput — shared) → SIMPAN LEAD ke
//          license_leads (upsertLicenseLead, kunci unik No. WhatsApp; email
//          boleh kosong) SEBELUM redirect, sehingga Admin tetap punya data
//          kontak walau pembayaran tidak diselesaikan → POST
//          {MAYAR_API_BASE_URL}/payment/create (Authorization: Bearer
//          MAYAR_API_KEY) → ambil `data.link` → kirim { paymentUrl } ke client
//          untuk redirect otomatis.
//          Bila email tidak dikirim, invoice Mayar memakai email deterministik
//          turunan No. WhatsApp ({phone}@wa.unitku.my.id) — format selalu valid
//          sehingga pembuatan invoice tidak pernah gagal karena email kosong.
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

import { upsertLicenseLead } from "@/lib/billing/license";
import { parseBuyerInput } from "@/lib/checkout-validation";
import { LICENSE_AMOUNT_IDR } from "@/lib/landing-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAYAR_DESCRIPTION = "Lisensi Seumur Hidup UnitKu - Early Adopter";

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
  const parsed = parseBuyerInput(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, error: parsed.error, field: parsed.field },
      { status: 400 },
    );
  }
  const { name, email, phone } = parsed.data;

  // ── Simpan lead SEBELUM redirect/checkout — kontak Admin tetap tersimpan
  // walau user tidak menyelesaikan pembayaran, bahkan saat Mayar tidak aktif.
  // Kegagalan penyimpanan TIDAK memblokir checkout (cukup dicatat di log).
  // Payload tanpa email (hanya nama + WA) WAJIB tetap tersimpan (email null).
  try {
    await upsertLicenseLead({ name, email, phone, source: "BAYAR_OTOMATIS" });
  } catch (leadError) {
    console.error(
      "[UnitKu Checkout] Gagal menyimpan lead:",
      leadError instanceof Error ? leadError.message : leadError,
    );
  }

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

  const redirectUrl =
    process.env.LICENSE_REDIRECT_URL || `${request.nextUrl.origin}/payment/success`;

  const apiBase = (
    process.env.MAYAR_API_BASE_URL || "https://api.mayar.id/hl/v1"
  ).replace(/\/+$/, "");

  // Mayar meminta email pembeli pada invoice — bila form zero-friction tidak
  // mengumpulkan email, derivasikan email deterministik dari No. WhatsApp.
  const mayarEmail = email || `${phone}@wa.unitku.my.id`;

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
        email: mayarEmail,
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
        `[UnitKu Checkout] Mayar menolak pembuatan invoice (${detail}) — email: ${mayarEmail}`,
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
