// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sesi & kredensial portal mitra affiliator (server-only, Node)
//
// Mitra didaftarkan Super Admin ATAU daftar mandiri TANPA akun email —
// identitasnya No. WhatsApp. Login portal TANPA KODE MANUAL: mitra cukup
// memasukkan No. WhatsApp terdaftar; bila nomor itu milik mitra AKTIF
// (affiliates.isActive), sesi diterbitkan langsung oleh sistem. Halaman
// /affiliate/login menerbitkan sesi mitra sendiri (cookie "unitku_partner",
// HMAC-signed) yang TERPISAH dari sesi owner (unitku_session / sb-*) —
// sehingga guard /affiliate/dashboard tidak membuang mitra ke /login
// pemilik properti. accessToken ("afk_…") kini murni utk MAGIC-LINK
// (tombol "Link Portal" Admin), bukan lagi kredensial login.
//
// Struktur cookie: <base64url(payload)>.<hmac-sha256> (pola auth/local.ts).
// Payload TIDAK menyimpan accessToken — tiap request divalidasi ulang ke DB:
// mitra yang dihapus Admin langsung kehilangan akses (sesi hangus seketika),
// tanpa menunggu kedaluwarsa cookie.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import {
  AUTH_SECRET,
  PARTNER_SESSION_COOKIE,
  PARTNER_SESSION_MAX_AGE,
} from "@/lib/auth/config";
import { ensureAffiliateTables } from "@/lib/affiliate-commission";
import { generateAffiliateAccessToken } from "@/lib/affiliate-admin";
import { normalizeWaPhone } from "@/lib/checkout-validation";
import { prisma } from "@/lib/prisma";

/** Baris mitra minimum yang dibutuhkan portal — dipakai halaman dashboard */
export interface AffiliateSessionRow {
  id: string;
  name: string;
  refCode: string;
  phone: string | null;
  /** Token portal dari DB (dijamin ada — legacy di-backfill lazy) */
  accessToken: string;
}

/** Identitas minimum utk menerbitkan cookie sesi mitra (login nomor WA) */
export interface AffiliateIdentity {
  id: string;
  name: string;
  refCode: string;
  phone: string | null;
}

interface PartnerSessionPayload {
  /** affiliates.id */
  sub: string;
  refCode: string;
  phone: string;
  iat: number;
  exp: number;
}

function toB64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(body: string): string {
  return createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
}

/** Terbitkan token sesi mitra HMAC-signed (pola auth/local.ts) */
function createPartnerSessionToken(
  payload: Omit<PartnerSessionPayload, "iat" | "exp">,
): string {
  const now = Math.floor(Date.now() / 1000);
  const full: PartnerSessionPayload = {
    ...payload,
    iat: now,
    exp: now + PARTNER_SESSION_MAX_AGE,
  };
  const body = toB64Url(JSON.stringify(full));
  return `${body}.${sign(body)}`;
}

/** Verifikasi token sesi mitra — HMAC salah / kedaluwarsa → null */
function verifyPartnerSessionToken(
  token: string,
): PartnerSessionPayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as PartnerSessionPayload;
    if (!payload.sub || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Opsi cookie sesi mitra — HttpOnly, Lax, Secure di produksi */
export const partnerSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: PARTNER_SESSION_MAX_AGE,
} as const;

/** Susun cookie sesi mitra utk response — nilai token dibuat di sini agar
 *  detail payload tetap enkapsulasi di lib ini (route cukup memanggil). */
export function buildPartnerSessionCookie(affiliate: AffiliateIdentity) {
  return {
    name: PARTNER_SESSION_COOKIE,
    value: createPartnerSessionToken({
      sub: affiliate.id,
      refCode: affiliate.refCode,
      phone: affiliate.phone ?? "",
    }),
    ...partnerSessionCookieOptions,
  };
}

/**
 * Resolusi sesi mitra dari cookie (Server Component / route handler).
 * Mengembalikan baris mitra TERBARU dari DB bila sesi sah & mitra masih ada
 * dan AKTIF; `null` bila tidak ada sesi / HMAC basi / mitra sudah dihapus
 * atau dinonaktifkan Admin.
 * accessToken legacy yang kosong di-backfill lazy (pola panel admin) agar
 * generator trial & form rekening pencairan tetap berfungsi.
 */
export async function getAffiliateFromSession(): Promise<AffiliateSessionRow | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PARTNER_SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyPartnerSessionToken(token);
  if (!payload?.sub) return null;
  try {
    await ensureAffiliateTables();
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        refCode: true,
        phone: true,
        isActive: true,
        accessToken: true,
      },
    });
    // Baris hilang (mitra dihapus Admin) ATAU dinonaktifkan (isActive=false)
    // → sesi hangus seketika — konsisten dgn syarat "mitra aktif" di login
    // nomor WhatsApp
    if (!affiliate || !affiliate.isActive) return null;

    let accessToken = affiliate.accessToken;
    if (!accessToken) {
      accessToken = generateAffiliateAccessToken();
      await prisma.affiliate
        .update({ where: { id: affiliate.id }, data: { accessToken } })
        .catch(() => undefined);
    }
    if (!accessToken) return null;

    return {
      id: affiliate.id,
      name: affiliate.name,
      refCode: affiliate.refCode,
      phone: affiliate.phone,
      accessToken,
    };
  } catch (error) {
    console.error(
      "[UnitKu Affiliate Auth] Gagal memuat sesi mitra (dilewati):",
      error,
    );
    return null;
  }
}

export type AffiliatePhoneAuthResult =
  | { ok: true; affiliate: AffiliateIdentity }
  | { ok: false; reason: "invalid" | "not-found" | "error" };

/**
 * Autentikasi login mitra BERBAS NOMOR WHATSAPP — tanpa kode akses manual.
 * Nomor dinormalisasi (08…/62…/+62…) lalu dicocokkan dua sisi dgn No. WA
 * mitra yang MASIH AKTIF (isActive=true); baris legacy berformat 08…/+62…
 * tetap sah. Kolom phone tidak unik di skema, jadi pencocokan memakai pola
 * admin (ambil daftar aktif lalu bandingkan ternormalisasi; baris terbaru
 * menang bila ada duplikat warisan). Satu faktor: keamanan ditegakkan lewat
 * rate limit ketat di API + sesi yang divalidasi ulang ke DB tiap request.
 */
export async function authenticateAffiliateByPhone(
  rawPhone: string,
): Promise<AffiliatePhoneAuthResult> {
  const phone = normalizeWaPhone(rawPhone);
  if (!/^62[0-9]{8,13}$/.test(phone)) {
    return { ok: false, reason: "invalid" };
  }
  try {
    await ensureAffiliateTables();
    const partners = await prisma.affiliate.findMany({
      where: { isActive: true },
      select: { id: true, name: true, refCode: true, phone: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    const affiliate = partners.find(
      (p) => p.phone && normalizeWaPhone(p.phone) === phone,
    );
    if (!affiliate) return { ok: false, reason: "not-found" };
    return { ok: true, affiliate };
  } catch (error) {
    console.error(
      "[UnitKu Affiliate Auth] Gagal memverifikasi nomor WhatsApp mitra:",
      error,
    );
    return { ok: false, reason: "error" };
  }
}
