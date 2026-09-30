// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sesi mode lokal (Node runtime saja — memakai node:crypto)
//
// Cookie "unitku_session": <base64url(payload)>.<hmac-sha256>
// Password di-hash scrypt (format "s1:salt:hash"). Hanya dipakai saat env
// Supabase tidak terisi (sandbox/dev); produksi memakai Supabase Auth.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { AUTH_SECRET, SESSION_MAX_AGE } from "./config";

export interface SessionPayload {
  /** user id — OwnerAccount.id / DEMO_OWNER_ID */
  sub: string;
  email: string;
  /** true = sesi demo tanpa akun */
  demo?: boolean;
  iat: number;
  exp: number;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `s1:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [version, salt, hash] = stored.split(":");
  if (version !== "s1" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function toB64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(body: string): string {
  return createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
}

export function createSessionToken(
  payload: Omit<SessionPayload, "iat" | "exp">,
): string {
  const now = Math.floor(Date.now() / 1000);
  const full: SessionPayload = { ...payload, iat: now, exp: now + SESSION_MAX_AGE };
  const body = toB64Url(JSON.stringify(full));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.sub || typeof payload.email !== "string") return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Opsi cookie sesi — HttpOnly, Lax, Secure di produksi */
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
