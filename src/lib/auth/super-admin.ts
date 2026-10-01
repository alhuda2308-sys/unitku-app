// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Super Admin & Role Guard (server-only)
//
// Super admin ditentukan lewat environment variable SUPER_ADMIN_EMAILS
// (comma-separated, contoh: "owner@elvindigital.com,admin@unitku.com").
// Email dibandingkan case-insensitive setelah trim — sama seperti normalisasi
// lisensi. Env kosong/tidak di-set berarti TIDAK ADA super admin (safe default:
// seluruh endpoint /api/admin/* dan halaman /admin menolak 403).
//
// WAJIB dipanggil di server (route handler / server component). Jangan pernah
// mengekspos daftar email super admin ke client — client hanya menerima flag
// boolean `isSuperAdmin` dari /api/auth/me.
// ─────────────────────────────────────────────────────────────────────────────

import { getAuthUser, type AuthUser } from "./server";

/** Daftar email super admin ternormalisasi (lowercase, trim, buang kosong) */
export function getSuperAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes("@"));
}

/** true bila email terdaftar sebagai super admin di SUPER_ADMIN_EMAILS */
export function isSuperAdminEmail(
  userEmail: string | null | undefined,
): boolean {
  if (!userEmail) return false;
  const normalized = userEmail.trim().toLowerCase();
  return getSuperAdminEmails().includes(normalized);
}

/** true bila email sesi aktif = super admin */
export async function isSuperAdmin(): Promise<boolean> {
  const user = await getAuthUser();
  return isSuperAdminEmail(user?.email);
}

/**
 * Gerbang ketat untuk seluruh endpoint & halaman admin.
 *  - null          → belum masuk (HTTP 401)
 *  - { user, 403 } → masuk tapi bukan super admin (HTTP 403)
 *  - { user }      → lolos, lanjutkan operasi admin
 */
export async function requireSuperAdminUser():
  Promise<
    | { ok: true; user: AuthUser }
    | { ok: false; status: 401 | 403 }
  > {
  const user = await getAuthUser();
  if (!user) return { ok: false, status: 401 };
  if (!isSuperAdminEmail(user.email)) return { ok: false, status: 403 };
  return { ok: true, user };
}

/** Pesan error seragam — jangan membocorkan kenapa akses ditolak */
export const ADMIN_FORBIDDEN_MESSAGE =
  "Akses ditolak — panel ini khusus Super Admin.";
