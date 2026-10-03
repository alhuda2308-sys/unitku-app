// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/update-password — Ganti password akun owner (Supabase Auth)
//
// Dipakai kartu "Ganti Password" di Dashboard → Pengaturan → Profil Saya.
// Alur : validasi body → verifikasi sesi (getUser) → supabase.auth.updateUser
//        ({ password }) → cookie sesi baru (hasil rotasi token) ditempel ke
//        response via kolektor @supabase/ssr (pola sama dgn login/register).
// Balikan: { ok: true } atau { error } — pesan siap-tampil utk toast.
// Catatan: mode lokal (sandbox tanpa Supabase) tidak mendukung → 400 jelas.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { getAuthMode, SESSION_COOKIE } from "@/lib/auth/config";
import { createSupabaseAuthCollector } from "@/lib/auth/supabase-route";

export const dynamic = "force-dynamic";

/** Kebijakan panjang password UnitKu (client & server sama) */
export const MIN_PASSWORD = 8;
/** Batas bcrypt Supabase Auth */
const MAX_PASSWORD = 72;

/** Terjemahan pesan error GoTrue yang umum → pesan siap-tampil */
function mapAuthError(message: string): string {
  if (/different from the old/i.test(message)) {
    return "Password baru harus berbeda dari password lama.";
  }
  if (/at least \d+ characters/i.test(message)) {
    return `Password baru minimal ${MIN_PASSWORD} karakter.`;
  }
  if (/session missing|invalid session/i.test(message)) {
    return "Sesi berakhir — silakan masuk ulang lalu coba lagi.";
  }
  return "Gagal memperbarui password — coba lagi sebentar.";
}

export async function POST(request: NextRequest) {
  // Mode lokal (sandbox/dev tanpa kredensial Supabase) — tidak ada auth.users
  if (getAuthMode() !== "supabase") {
    return NextResponse.json(
      { error: "Ganti password hanya tersedia saat login via Supabase Auth." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const password = typeof body.password === "string" ? body.password : "";

  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Password baru minimal ${MIN_PASSWORD} karakter.` },
      { status: 400 },
    );
  }
  if (password.length > MAX_PASSWORD) {
    return NextResponse.json(
      { error: `Password baru maksimal ${MAX_PASSWORD} karakter.` },
      { status: 400 },
    );
  }

  // Kolektor cookie: updateUser meng-rotasi token sesi — cookie baru HARUS
  // ditempel ke response final (pola anti-hilang-sesi login/register).
  const { client: supabase, applyCookies } = createSupabaseAuthCollector(request);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    console.error("[api/auth/update-password] Sesi tidak valid:", userError?.message);
    // Sesi demo (cookie lokal) memang tidak punya password Supabase
    const isDemoSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
    return NextResponse.json(
      {
        error: isDemoSession
          ? "Mode demo tidak memiliki password — masuk dengan akun owner asli untuk mengganti password."
          : "Sesi tidak ditemukan — silakan masuk ulang lalu coba lagi.",
      },
      { status: 401 },
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("[api/auth/update-password] Supabase updateUser gagal:", error.message);
    return NextResponse.json({ error: mapAuthError(error.message) }, { status: 400 });
  }

  const response = NextResponse.json({
    ok: true,
    message: "Password berhasil diperbarui!",
  });
  applyCookies(response); // ← cookie sesi hasil rotasi ikut tersimpan
  return response;
}
