// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Checkout lisensi seumur hidup via Mayar API V2 (server-only)
//
// POST /api/checkout
//   Body : { name, phone, email? }  — email OPSIONAL (zero friction: form
//          checkout hanya meminta Nama + No. WhatsApp).
//   Flow : validasi input (parseBuyerInput — shared) → SIMPAN LEAD ke
//          license_leads (upsertLicenseLead, kunci unik No. WhatsApp; email
//          boleh kosong) SEBELUM redirect, sehingga Admin tetap punya data
//          kontak walau pembayaran tidak diselesaikan → POST
//          {MAYAR_API_BASE_URL}/payments/create (Authorization: Bearer
//          MAYAR_API_KEY) → ambil `data.link` → kirim { paymentUrl } ke client
//          untuk redirect otomatis.
//
//   ⚠ MAYAR API V2 — WAJIB sejak 1 Oktober 2026
//     API V1 (https://api.mayar.id/hl/v1/*) dimatikan Mayar per 1 Okt 2026
//     (docs.mayar.id → "Migrating from API V1 to V2"). Penyebab invoice lama
//     selalu gagal (HTTP 409) bukan payload, melainkan endpoint V1 yang sudah
//     mati. Migrasi V1 → V2:
//       • Base URL   : /hl/v1 → /hl/v2 (env lama MAYAR_API_BASE_URL yang masih
//                      menunjuk /hl/v1 di-upgrade otomatis di sini).
//       • Endpoint   : POST /payment/create → POST /payments/create
//                      (amount = satu-satunya field wajib; name/email/mobile/
//                      description/redirectUrl/extraData opsional).
//       • Custom data: metadata → extraData (echo kembali di response & webhook).
//       • redirectUrl: V2 MENOLAK lantang (400 "redirectUrl is not supported
//                      …") bila record tidak dapat menyimpannya — kode ini
//                      otomatis mencoba ulang SEKALI tanpa redirectUrl.
//     API key TIDAK berubah (dibuat di web.mayar.id/api-keys, skema sama).
//
//   Email invoice: email pembeli bila diisi; bila tidak, email dummy valid
//   unik per-request (customer.{timestamp}.{rand}@gmail.com) — format standar
//   yang selalu diterima Mayar dan bebas konflik duplikasi. Email TETAP
//   dikirim (walau dummy) karena payload webhook payment.received Mayar
//   membawa customer_email — tanpa email, provisioning lisensi gagal.
//
//   FALLBACK MULUS: bila API Mayar gagal (4xx/5xx/timeout/network/apapun),
//   respons tetap memuat `fallbackUrl` — payment link statis UnitKu
//   (MAYAR_CHECKOUT_URL → MAYAR_CHECKOUT_URL_FALLBACK) ditempeli query param
//   referral (?ref=…&affiliate_ref=…) — client langsung me-redirect pembeli
//   ke sana sehingga TIDAK PERNAH terhenti di error.
//
//   Affiliate (Tahap 3): kode referral dari cookie `unitku_ref` (30 hari,
//          di-set middleware dari ?ref=… — lihat src/lib/affiliate.ts) diselipkan
//          ke extraData invoice → ikut kembali pada webhook payment.received
//          sebagai extraData/metadata.affiliate_ref untuk atribusi komisi.
//
//   Logging Vercel (verifikasi atribusi & debugging penolakan Mayar):
//          [Mayar Checkout Request Payload]: <json payload>
//          [Mayar Error {status} Raw Body]: <body mentah penolakan>
//          [UnitKu Checkout] Invoice Mayar V2 dibuat: <json response>
//
// Env produksi (Vercel):
//   MAYAR_API_KEY        API key Mayar — WAJIB
//   MAYAR_API_BASE_URL   default https://api.mayar.id/hl/v2 (override utk test)
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
 * diterima Mayar, keunikan per-request mencegah konflik duplikasi antar
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

/** Parse body response Mayar — penolakan kadang bukan JSON valid */
function tryParseMayarBody(rawBody: string): unknown {
  try {
    return rawBody ? (JSON.parse(rawBody) as unknown) : null;
  } catch {
    return null; // body bukan JSON — payload tetap null
  }
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

  // ── Base URL API V2 + migrasi defensif env lama ──────────────────────────
  // Env MAYAR_API_BASE_URL yang masih menunjuk /hl/v1 (endpoint MATI sejak
  // 1 Okt 2026) di-upgrade otomatis ke /hl/v2 — deploy aman tanpa ubah env.
  const rawBase = (
    process.env.MAYAR_API_BASE_URL || "https://api.mayar.id/hl/v2"
  )
    .trim()
    .replace(/\/+$/, "");
  const apiBase = rawBase.includes("/hl/v1")
    ? rawBase.replace("/hl/v1", "/hl/v2")
    : rawBase;

  // Email invoice: email pembeli bila diisi; selain itu dummy standar unik
  // per-request (lihat buildMayarEmail) — mencegah penolakan/konflik email.
  const mayarEmail = buildMayarEmail(email);
  // Mobile mengikuti contoh resmi Mayar — format lokal "08…".
  const mayarMobile = toMayarMobile(phone);

  try {
    // Payload invoice Mayar API V2 (POST /payments/create) — `amount` satu-
    // satunya field wajib; sisanya opsional. Custom data V2 = `extraData`
    // (pengganti `metadata` V1) berisi kode referral cookie `unitku_ref`
    // agar webhook payment.received dapat mengatribusi komisi Rp150.000 ke
    // affiliator yang tepat. Tidak ada ID transaksi/produk — Mayar yang
    // men-generate.
    const mayarPayload: Record<string, unknown> = {
      name,
      email: mayarEmail,
      mobile: mayarMobile,
      amount: LICENSE_AMOUNT_IDR,
      description: MAYAR_DESCRIPTION,
      redirectUrl,
    };
    // extraData hanya dikirim saat ada referral — hindari nilai null yang
    // berisiko ditolak validasi Mayar.
    if (affiliateRef) {
      mayarPayload.extraData = { affiliate_ref: affiliateRef };
    }

    // Log payload request ke API Mayar — verifikasi atribusi afiliasi langsung
    // di Vercel Logs (payload saja, tanpa header Authorization).
    console.log(
      "[Mayar Checkout Request Payload]:",
      JSON.stringify(mayarPayload),
    );

    const createPayment = (body: Record<string, unknown>) =>
      fetch(`${apiBase}/payments/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });

    let response = await createPayment(mayarPayload);
    // Body mentah dibaca dulu sebagai TEXT — penolakan Mayar kadang bukan
    // JSON valid; log mentah agar penyebab spesifik terbaca di Vercel Logs.
    let rawBody = await response.text().catch(() => "");
    let payload = tryParseMayarBody(rawBody);

    // V2 menolak lantang bila record payment request tidak dapat menyimpan
    // redirectUrl (400 "redirectUrl is not supported on payment requests and
    // was not saved") — ulangi SEKALI tanpa redirectUrl agar invoice tetap
    // terbentuk (redirect balik ke app cukup via halaman sukses Mayar).
    if (response.status === 400 && /redirecturl/i.test(rawBody)) {
      console.warn(
        "[UnitKu Checkout] redirectUrl ditolak Mayar V2 — mencoba ulang tanpa redirectUrl…",
      );
      const retryPayload = { ...mayarPayload };
      delete retryPayload.redirectUrl;
      response = await createPayment(retryPayload);
      rawBody = await response.text().catch(() => "");
      payload = tryParseMayarBody(rawBody);
    }

    if (!response.ok) {
      const detail =
        typeof payload === "object" && payload !== null && "messages" in payload
          ? String((payload as { messages?: unknown }).messages)
          : typeof payload === "object" && payload !== null && "message" in payload
            ? String((payload as { message?: unknown }).message)
            : `HTTP ${response.status}`;
      // LOG WAJIB — body mentah penolakan Mayar (401/409/429/500 dst.)
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

    // Invoice V2 SUKSES — log response (mengandung id/transactionId/link/
    // extraData) untuk verifikasi atribusi & rekonsiliasi di Vercel Logs.
    console.log(
      "[UnitKu Checkout] Invoice Mayar V2 dibuat:",
      JSON.stringify(payload)?.slice(0, 800),
    );

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
