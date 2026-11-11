// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — POST /api/affiliate/login — Terbitkan sesi portal mitra affiliator
//
// Body : { phone }
//   phone — No. WhatsApp mitra terdaftar (08…/62…/+62…, dinormalisasi server).
// TANPA KODE MANUAL: bila nomor terdaftar sebagai mitra AKTIF di tabel
// affiliates, sesi langsung diterbitkan oleh sistem — tanpa campur tangan
// Admin. Alur: autentikasi ke DB → cookie sesi mitra sendiri ("unitku_partner",
// HMAC) → mitra diarahkan ke /affiliate/dashboard.
// Keamanan (single-factor):
//   • Rate limit per IP lebih ketat (5 percobaan / 10 menit) — memori proses.
//   • Sesi divalidasi ulang ke DB tiap request (mitra dihapus/nonaktif →
//     sesi hangus seketika).
//   • Log audit server-side utk tiap login sukses.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import {
  authenticateAffiliateByPhone,
  buildPartnerSessionCookie,
} from "@/lib/affiliate-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Batas percobaan login per IP: 5 kali per 10 menit (single-factor) */
const RATE_MAX_ATTEMPTS = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

/** IP klien — Vercel menyediakan x-forwarded-for (komma = hop berurutan) */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  if (
    !checkRateLimit(
      `affiliate-login:${clientIp(request)}`,
      RATE_MAX_ATTEMPTS,
      RATE_WINDOW_MS,
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Terlalu banyak percobaan masuk — tunggu beberapa menit, lalu coba lagi.",
      },
      { status: 429 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { success: false, error: "Payload tidak valid." },
      { status: 400 },
    );
  }
  const raw = body as Record<string, unknown>;
  const phone = typeof raw.phone === "string" ? raw.phone : "";
  if (!phone.trim()) {
    return NextResponse.json(
      { success: false, error: "Nomor WhatsApp wajib diisi." },
      { status: 400 },
    );
  }

  const result = await authenticateAffiliateByPhone(phone);
  if (!result.ok) {
    if (result.reason === "invalid") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Nomor WhatsApp belum sesuai — mulai dengan 08 atau 62 ya (contoh: 081234567890).",
        },
        { status: 400 },
      );
    }
    if (result.reason === "not-found") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Nomor WhatsApp tidak terdaftar sebagai mitra aktif. Periksa kembali nomor Anda, atau hubungi Admin bila nomor memang sudah terdaftar.",
        },
        { status: 401 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "Gagal menghubungi server — coba lagi sebentar.",
      },
      { status: 500 },
    );
  }

  console.log(
    `[UnitKu Affiliate Login] Mitra masuk via No. WA: "${result.affiliate.refCode}" (${result.affiliate.name}, WA ${result.affiliate.phone ?? "-"}).`,
  );

  const response = NextResponse.json({
    success: true,
    name: result.affiliate.name,
    refCode: result.affiliate.refCode,
  });
  response.cookies.set(buildPartnerSessionCookie(result.affiliate));
  return response;
}
