// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/users/reset-password — Reset Password Cepat (Super Admin)
//
// Set password baru langsung via Admin API (tanpa email link — bekerja bahkan
// tanpa SMTP terpasang). Password kosong → digenerate acak yang aman.
// Respons berisi kredensial baru siap-copy untuk dikirim ke user.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { getAuthMode } from "@/lib/auth/config";
import { hashPassword } from "@/lib/auth/local";
import { requireSuperAdminUser } from "@/lib/auth/super-admin";
import { generateSecurePassword, normalizeEmail } from "@/lib/billing/license";
import { findSupabaseUserIdByEmail, getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const guard = await requireSuperAdminUser();
  if (!guard.ok) {
    return NextResponse.json({ error: "Akses ditolak — khusus Super Admin." }, { status: guard.status });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  const passwordInput = typeof body.password === "string" ? body.password.trim() : "";
  const generate = body.generate === true;

  const email = normalizeEmail(emailRaw);
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
  }
  const password = generate || passwordInput.length === 0 ? generateSecurePassword() : passwordInput;
  if (password.length < 6) {
    return NextResponse.json({ error: "Password baru minimal 6 karakter." }, { status: 400 });
  }

  try {
    if (getAuthMode() === "supabase") {
      const admin = getSupabaseAdmin();
      if (!admin) {
        return NextResponse.json(
          { error: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi — reset password tidak tersedia." },
          { status: 503 },
        );
      }
      const license = await db.licenseAccount.findUnique({
        where: { email },
        select: { userId: true },
      });
      const userId = license?.userId ?? (await findSupabaseUserIdByEmail(email));
      if (!userId) {
        return NextResponse.json(
          { error: "Akun owner tidak ditemukan untuk email ini." },
          { status: 404 },
        );
      }
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) {
        console.error("[api/admin/users/reset-password] update gagal:", error.message);
        return NextResponse.json({ error: `Gagal mengganti password: ${error.message}` }, { status: 502 });
      }
    } else {
      const account = await db.ownerAccount.findUnique({ where: { email }, select: { id: true } });
      if (!account) {
        return NextResponse.json({ error: "Akun owner tidak ditemukan untuk email ini." }, { status: 404 });
      }
      await db.ownerAccount.update({
        where: { id: account.id },
        data: { passwordHash: hashPassword(password) },
      });
    }

    return NextResponse.json({ success: true, credentials: { email, password } });
  } catch (err) {
    console.error("[api/admin/users/reset-password]", err);
    return NextResponse.json({ error: "Gagal mengganti password." }, { status: 500 });
  }
}
