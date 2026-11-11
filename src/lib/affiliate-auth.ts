// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sesi & kredensial portal mitra affiliator (server-only, Node)
//
// Mitra didaftarkan Super Admin TANPA akun email — identitasnya No. WhatsApp
// dan kredensial rahasianya accessToken portal ("afk_<48 hex>", dikirim
// Admin bersama magic-link). Halaman /affiliate/login memasangkan keduanya,
// lalu menerbitkan sesi mitra sendiri (cookie "unitku_partner", HMAC-signed)
// yang TERPISAH dari sesi owner (unitku_session / sb-*) — sehingga guard
// /affiliate/dashboard tidak lagi membuang mitra ke /login pemilik properti.
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
export function buildPartnerSessionCookie(affiliate: AffiliateSessionRow) {
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
 * Mengembalikan baris mitra TERBARU dari DB bila sesi sah & mitra masih ada;
 * `null` bila tidak ada sesi / HMAC basi / mitra sudah dihapus Admin.
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
        accessToken: true,
      },
    });
    // Baris hilang (mitra dihapus Admin) → sesi hangus seketika
    if (!affiliate) return null;

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

export type AffiliateCredentialResult =
  | { ok: true; affiliate: AffiliateSessionRow }
  | { ok: false; reason: "invalid" | "error" };

/**
 * Verifikasi kredensial login mitra: No. WhatsApp + kode akses portal.
 * Keduanya wajib cocok dengan SATU baris affiliates (token dicari dulu lewat
 * kunci unik accessToken, lalu No. WA dicocokkan dua sisi ternormalisasi agar
 * baris legacy berformat 08…/​+62… tetap sah). API pemanggil memilih pesan
 * generik agar tidak membocorkan field mana yang salah.
 */
export async function authenticateAffiliateByCredentials(
  rawPhone: string,
  rawToken: string,
): Promise<AffiliateCredentialResult> {
  const phone = normalizeWaPhone(rawPhone);
  const token = rawToken.trim();
  if (!/^62[0-9]{8,13}$/.test(phone) || !token || token.length > 128) {
    return { ok: false, reason: "invalid" };
  }
  try {
    await ensureAffiliateTables();
    const affiliate = await prisma.affiliate.findUnique({
      where: { accessToken: token },
      select: { id: true, name: true, refCode: true, phone: true },
    });
    if (
      !affiliate ||
      !affiliate.phone ||
      normalizeWaPhone(affiliate.phone) !== phone
    ) {
      return { ok: false, reason: "invalid" };
    }
    return {
      ok: true,
      affiliate: {
        id: affiliate.id,
        name: affiliate.name,
        refCode: affiliate.refCode,
        phone: affiliate.phone,
        accessToken: token,
      },
    };
  } catch (error) {
    console.error(
      "[UnitKu Affiliate Auth] Gagal memverifikasi kredensial mitra:",
      error,
    );
    return { ok: false, reason: "error" };
  }
}
