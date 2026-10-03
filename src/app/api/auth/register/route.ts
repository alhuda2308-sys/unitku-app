// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register — Daftar akun owner baru
//
// Mode Supabase: supabase.auth.signUp (metadata full_name + phone untuk tabel
//                Admin) — bila verifikasi email aktif di dashboard Supabase,
//                sesi null → needsEmailConfirmation=true.
// Mode lokal   : akun disimpan di owner_accounts (scrypt) + sesi langsung.
// Kontak       : Nama Lengkap + No. WhatsApp wajib (selaras form checkout) —
//                tersimpan sebagai lead license_leads (source REGISTER) agar
//                Panel Super Admin selalu punya data kontak akun.
// Validasi     : nama ≥2, format WA 62…, format email, password minimal 6.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { upsertLicenseLead } from "@/lib/billing/license";
import { normalizeWaPhone } from "@/lib/checkout-validation";
import { getAuthMode, SESSION_COOKIE } from "@/lib/auth/config";
import { createSessionToken, hashPassword, sessionCookieOptions } from "@/lib/auth/local";
import { createSupabaseAuthCollector } from "@/lib/auth/supabase-route";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  // Nama + No. WhatsApp wajib bila dikirim (selaras form checkout) — profil
  // akun selalu lengkap. Field lama tanpa profil tetap diterima (kompatibel).
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = normalizeWaPhone(typeof body.phone === "string" ? body.phone : "");
  const profileRequired = typeof body.name === "string" || typeof body.phone === "string";

  if (profileRequired) {
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { error: "Nama lengkap wajib diisi (2–100 karakter)." },
        { status: 400 },
      );
    }
    if (!/^62[0-9]{8,13}$/.test(phone)) {
      return NextResponse.json(
        { error: "Nomor WhatsApp tidak valid — gunakan format 08… atau 62… (9–15 digit)." },
        { status: 400 },
      );
    }
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter." }, { status: 400 });
  }

  /** Simpan lead kontak (source REGISTER) — kegagalan DB tidak memblokir daftar */
  const saveLead = async (): Promise<void> => {
    if (!profileRequired) return;
    try {
      await upsertLicenseLead({ name, email, phone, source: "REGISTER" });
    } catch (leadError) {
      console.error(
        "[api/auth/register] Gagal menyimpan lead:",
        leadError instanceof Error ? leadError.message : leadError,
      );
    }
  };

  if (getAuthMode() === "supabase") {
    // Pola kolektor (lihat /api/auth/login) — sesi dari signUp (bila verifikasi
    // email nonaktif) tidak boleh terbuang saat response final dibangun.
    const { client: supabase, applyCookies } = createSupabaseAuthCollector(request);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Metadata ikut ke auth.users — kolom Nama/No. WhatsApp tabel Admin terisi
      options: profileRequired
        ? { data: { full_name: name, phone } }
        : undefined,
    });
    if (error) {
      console.error("[api/auth/register] Supabase signUp gagal:", error.message);
      const duplicate = /already|terdaftar|exists/i.test(error.message);
      const failed = NextResponse.json(
        {
          error: duplicate
            ? "Email sudah terdaftar. Silakan masuk."
            : error.message,
        },
        { status: duplicate ? 409 : 400 },
      );
      applyCookies(failed); // cookie pembersihan/refresh parsial tetap diteruskan
      return failed;
    }
    await saveLead();
    const response = NextResponse.json({
      ok: true,
      needsEmailConfirmation: !data.session,
      user: data.user ? { id: data.user.id, email: data.user.email ?? email } : null,
    });
    applyCookies(response); // ← Set-Cookie sesi ikut ke browser (bila sesi langsung)
    return response;
  }

  // ── Mode lokal ─────────────────────────────────────────────────────────────
  try {
    const existing = await db.ownerAccount.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar. Silakan masuk." },
        { status: 409 },
      );
    }
    const account = await db.ownerAccount.create({
      data: { email, passwordHash: hashPassword(password) },
    });
    await saveLead();
    const response = NextResponse.json({
      ok: true,
      needsEmailConfirmation: false,
      user: { id: account.id, email },
    });
    response.cookies.set(
      SESSION_COOKIE,
      createSessionToken({ sub: account.id, email }),
      sessionCookieOptions,
    );
    return response;
  } catch (err) {
    console.error("[api/auth/register] DB gagal:", err);
    return NextResponse.json(
      { error: "Database tidak terjangkau — coba tombol \"Masuk sebagai Demo\"." },
      { status: 503 },
    );
  }
}
