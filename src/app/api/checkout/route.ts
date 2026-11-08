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
//          Email invoice: email pembeli bila diisi; bila tidak, email dummy
//          valid unik per-request (customer.{timestamp}.{rand}@gmail.com) —
//          format standar yang selalu diterima Mayar dan bebas konflik
//          duplikasi email antar percobaan checkout.
//          FALLBACK MULUS: bila API Mayar gagal (409/timeout/network/apapun),
//          respons tetap memuat `fallbackUrl` — payment link statis UnitKu
//          (MAYAR_CHECKOUT_URL → MAYAR_CHECKOUT_URL_FALLBACK) ditempeli query
//          param referral (?ref=…&affiliate_ref=…) — client langsung me-
//          redirect pembeli ke sana sehingga TIDAK PERNAH terhenti di error.
//
//   Affiliate (Tahap 3): kode referral dari cookie `unitku_ref` (30 hari,
//          di-set middleware dari ?ref=… — lihat src/lib/affiliate.ts) diselipkan
//          ke metadata invoice → ikut kembali pada webhook payment.received
//          sebagai metadata.affiliate_ref untuk atribusi komisi afiliasi.
//
//   Logging Vercel (verifikasi atribusi & debugging penolakan Mayar):
//          [Mayar Checkout Request Payload]: <json payload>
//          [Mayar Error {status} Raw Body]: <body mentah penolakan>
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

import { NextResponse, after, type NextRequest } from "next/server";

import { upsertLicenseLead } from "@/lib/billing/license";
import { appendAffiliateRefToUrl, sanitizeAffiliateRef } from "@/lib/affiliate";
import { getAffiliateRefServer } from "@/lib/affiliate-server";
import { parseBuyerInput } from "@/lib/checkout-validation";
import {
  LICENSE_AMOUNT_IDR,
  MAYAR_CHECKOUT_URL,
  MAYAR_CHECKOUT_URL_FALLBACK,
} from "@/lib/landing-config";
import { notifyAdminLeadAlert } from "@/lib/notifications/admin-lead-alert";

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

/**
 * Email invoice Mayar — email pembeli bila diisi; bila tidak (form zero-
 * friction hanya minta nama + No. WA), email dummy FORMAT STANDAR yang unik
 * per-request (customer.{timestamp}.{rand}@gmail.com). Format standar selalu
 * diterima Mayar, keunikan per-request mencegah 409 konflik duplikasi antar
 * percobaan checkout pembeli yang sama.
 */
function buildMayarEmail(realEmail: string): string {
  if (realEmail) return realEmail;
  const suffix = Math.random().toString(36).slice(2, 8);
  return `customer.${Date.now()}.${suffix}@gmail.com`;
}

/**
 * Format mobile Mayar — contoh resmi memakai format lokal "08…" (mis.
 * "085797522261"); nomor ternormalisasi "628…" dikembalikan ke "08…".
 */
function toMayarMobile(normalizedPhone: string): string {
  return normalizedPhone.startsWith("62")
    ? `0${normalizedPhone.slice(2)}`
    : normalizedPhone;
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

  // ── Kode referral afiliasi (Tahap 3) — dari cookie `unitku_ref` ──────────
  // Cookie sudah disaring middleware, disaring ulang di sini sebagai pertahanan
  // tambahan (defense-in-depth) sebelum dikirim ke API pihak ketiga.
  const affiliateRef = sanitizeAffiliateRef(await getAffiliateRefServer());
  if (affiliateRef) {
    console.log(
      `[UnitKu Checkout] Traffic referral afiliasi: "${affiliateRef}" (pembeli ${phone})`,
    );
  }

  // ── Fallback mulus (3): payment link statis UnitKu + param referral ──────
  // Disertakan pada SETIAP respons gagal (invoice API ditolak Mayar / timeout
  // / config kosong) sehingga pembeli SELALU bisa lanjut bayar — tidak pernah
  // terhenti di layar error. Referral tetap terbawa di query param.
  const staticCheckoutUrl =
    MAYAR_CHECKOUT_URL.trim() || MAYAR_CHECKOUT_URL_FALLBACK.trim();
  const fallbackUrl = staticCheckoutUrl
    ? appendAffiliateRefToUrl(staticCheckoutUrl, affiliateRef)
    : undefined;

  // ── Simpan lead SEBELUM redirect/checkout — kontak Admin tetap tersimpan
  // walau user tidak menyelesaikan pembayaran, bahkan saat Mayar tidak aktif.
  // Kegagalan penyimpanan TIDAK memblokir checkout (cukup dicatat di log).
  // Payload tanpa email (hanya nama + WA) WAJIB tetap tersimpan (email null).
  try {
    const leadResult = await upsertLicenseLead({ name, email, phone, source: "BAYAR_OTOMATIS" });
    // Lead benar-benar baru → notifikasi instan ke HP Admin via after()
    // (respons checkout tetap kilat; kontak lama tidak memicu alert ulang)
    if (leadResult.created) {
      after(() =>
        notifyAdminLeadAlert({
          name,
          phone,
          email,
          source: "BAYAR_OTOMATIS",
          registeredAt: new Date(),
        }),
      );
    }
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
        ...(fallbackUrl ? { fallbackUrl } : {}),
      },
      { status: 503 },
    );
  }

  const redirectUrl =
    process.env.LICENSE_REDIRECT_URL || `${request.nextUrl.origin}/payment/success`;

  const apiBase = (
    process.env.MAYAR_API_BASE_URL || "https://api.mayar.id/hl/v1"
  ).replace(/\/+$/, "");

  // Email invoice: email pembeli bila diisi; selain itu dummy standar unik
  // per-request (lihat buildMayarEmail) — mencegah penolakan/konflik email.
  const mayarEmail = buildMayarEmail(email);
  // Mobile mengikuti contoh resmi Mayar — format lokal "08…".
  const mayarMobile = toMayarMobile(phone);

  try {
    // Payload invoice Mayar — sesuai standar resmi (name, email, mobile,
    // amount number, description, redirectUrl) + metadata.affiliate_ref
    // (kode referral cookie `unitku_ref`) agar webhook payment.received
    // dapat mengatribusi komisi Rp150.000 ke affiliator yang tepat.
    // Tidak ada ID transaksi/produk yang dikirim — Mayar yang men-generate.
    const mayarPayload = {
      name,
      email: mayarEmail,
      mobile: mayarMobile,
      amount: LICENSE_AMOUNT_IDR,
      description: MAYAR_DESCRIPTION,
      redirectUrl,
      metadata: {
        affiliate_ref: affiliateRef || null,
      },
    };

    // Log payload request ke API Mayar — verifikasi atribusi afiliasi langsung
    // di Vercel Logs (payload saja, tanpa header Authorization).
    console.log(
      "[Mayar Checkout Request Payload]:",
      JSON.stringify(mayarPayload),
    );

    const response = await fetch(`${apiBase}/payment/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(mayarPayload),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    // Body mentah dibaca dulu sebagai TEXT — penolakan Mayar (mis. 409
    // Conflict) kadang bukan JSON valid; log mentah agar penyebab spesifik
    // terbaca langsung di Vercel Logs.
    const rawBody = await response.text().catch(() => "");
    let payload: unknown = null;
    try {
      payload = rawBody ? (JSON.parse(rawBody) as unknown) : null;
    } catch {
      payload = null; // body bukan JSON — payload tetap null
    }

    if (!response.ok) {
      const detail =
        typeof payload === "object" && payload !== null && "message" in payload
          ? String((payload as { message?: unknown }).message)
          : `HTTP ${response.status}`;
      // LOG WAJIB — body mentah penolakan Mayar (409/401/429/500 dst.)
      console.error(
        `[Mayar Error ${response.status} Raw Body]:`,
        rawBody.slice(0, 2_000) || "(body kosong)",
      );
      console.error(
        `[UnitKu Checkout] Mayar menolak pembuatan invoice (${detail}) — email: ${mayarEmail}`,
      );
      // Fallback mulus — pembeli langsung diarahkan ke payment link statis
      // (dengan param referral) alih-alih terhenti di layar error.
      return NextResponse.json(
        {
          success: false,
          error:
            "Gagal membuat invoice pembayaran — mengarahkan ke halaman pembayaran langsung.",
          ...(fallbackUrl ? { fallbackUrl } : {}),
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
            "Response pembayaran tidak dikenali — mengarahkan ke halaman pembayaran langsung.",
          ...(fallbackUrl ? { fallbackUrl } : {}),
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
          "Tidak dapat menghubungi server pembayaran — mengarahkan ke halaman pembayaran langsung.",
        ...(fallbackUrl ? { fallbackUrl } : {}),
      },
      { status: 502 },
    );
  }
}
