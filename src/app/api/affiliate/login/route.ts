// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — POST /api/affiliate/login — Terbitkan sesi portal mitra affiliator
//
// Body : { phone, token }
//   phone — No. WhatsApp mitra (08…/62…/+62…, dinormalisasi server)
//   token — kode akses portal dari Admin ("afk_<48 hex>", satu-satu dgn mitra)
// Alur : verifikasi kredensial ke tabel affiliates (No. WA + token wajib
//   cocok dengan SATU baris) → terbitkan cookie sesi mitra sendiri
//   ("unitku_partner", HMAC) → mitra diarahkan ke /affiliate/dashboard.
// Keamanan:
//   • Rate limit per IP (8 percobaan / 10 menit) — memori proses.
//   • Pesan kegagalan generik (tidak membocorkan field mana yang salah).
//   • Cookie HttpOnly HMAC tanpa menyimpan accessToken (pola auth/local.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import {
  authenticateAffiliateByCredentials,
  buildPartnerSessionCookie,
} from "@/lib/affiliate-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Batas percobaan login per IP: 8 kali per 10 menit */
const RATE_MAX_ATTEMPTS = 8;
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
  const token = typeof raw.token === "string" ? raw.token : "";
  if (!phone.trim() || !token.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: "No. WhatsApp dan kode akses portal wajib diisi.",
      },
      { status: 400 },
    );
  }

  const result = await authenticateAffiliateByCredentials(phone, token);
  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error:
          result.reason === "error"
            ? "Gagal menghubungi server — coba lagi sebentar."
            : "No. WhatsApp atau kode akses portal tidak cocok. Periksa kembali, atau minta kode terbaru ke Admin.",
      },
      { status: result.reason === "error" ? 500 : 401 },
    );
  }

  const response = NextResponse.json({
    success: true,
    name: result.affiliate.name,
    refCode: result.affiliate.refCode,
  });
  response.cookies.set(buildPartnerSessionCookie(result.affiliate));
  return response;
}
