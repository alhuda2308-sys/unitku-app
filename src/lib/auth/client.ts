// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Klien autentikasi (dipakai komponen sisi browser)
//
// Semua alur (Masuk/Daftar/Keluar/Demo) seragam lewat endpoint /api/auth/*,
// sehingga komponen TIDAK perlu tahu mode aktif (Supabase vs lokal).
// Google OAuth (khusus mode Supabase) memakai browser client @supabase/ssr
// dengan redirect ke /auth/callback.
// ─────────────────────────────────────────────────────────────────────────────

import { isSupabaseConfigured } from "./config";

export { isSupabaseConfigured } from "./config";

export interface AuthInfo {
  user: { id: string; email: string } | null;
  mode: "supabase" | "local";
  demo: boolean;
}

export type AuthResult = { ok: true } | { ok: false; error: string };

export type SignUpResult =
  | { ok: true; needsEmailConfirmation: boolean }
  | { ok: false; error: string };

async function postAuth(path: string, body?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(path, {
    method: "POST",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

function errorOf(data: Record<string, unknown>, fallback: string): string {
  return typeof data.error === "string" && data.error ? data.error : fallback;
}

/** Masuk dengan email + password (Supabase Auth atau mode lokal) */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const { status, data } = await postAuth("/api/auth/login", { email, password });
    if (status !== 200) return { ok: false, error: errorOf(data, "Email atau password salah.") };
    return { ok: true };
  } catch {
    return { ok: false, error: "Tidak dapat terhubung ke server — periksa koneksi internet." };
  }
}

/** Daftar akun owner baru — needsEmailConfirmation bila Supabase meminta verifikasi email */
export async function signUp(email: string, password: string): Promise<SignUpResult> {
  try {
    const { status, data } = await postAuth("/api/auth/register", { email, password });
    if (status !== 200) return { ok: false, error: errorOf(data, "Gagal mendaftarkan akun.") };
    return { ok: true, needsEmailConfirmation: data.needsEmailConfirmation === true };
  } catch {
    return { ok: false, error: "Tidak dapat terhubung ke server — periksa koneksi internet." };
  }
}

/** Keluar — menghapus sesi (cookie) lalu arahkan ke /login */
export async function signOut(): Promise<void> {
  try {
    await postAuth("/api/auth/logout");
  } catch {
    /* tetap lanjut redirect meski network gagal */
  }
}

/** Masuk cepat tanpa akun (khusus mode lokal) — sesi demo data contoh */
export async function signInAsDemo(): Promise<AuthResult> {
  try {
    const { status, data } = await postAuth("/api/auth/demo");
    if (status !== 200) return { ok: false, error: errorOf(data, "Mode demo tidak tersedia.") };
    return { ok: true };
  } catch {
    return { ok: false, error: "Tidak dapat terhubung ke server — periksa koneksi internet." };
  }
}

/** Login cepat Google — khusus mode Supabase (memredirect keluar halaman) */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Login Google hanya tersedia saat Supabase Auth aktif." };
  }
  try {
    const { createBrowserClient } = await import("@supabase/ssr");
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Gagal memulai login Google." };
  }
}

/** Info sesi aktif — user null bila belum masuk */
export async function getAuthInfo(): Promise<AuthInfo> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as Partial<AuthInfo>;
    return {
      user: data.user ?? null,
      mode: data.mode === "supabase" ? "supabase" : "local",
      demo: data.demo === true,
    };
  } catch {
    return { user: null, mode: isSupabaseConfigured() ? "supabase" : "local", demo: false };
  }
}

/**
 * Tujuan redirect setelah masuk/daftar:
 *  - "/onboarding" bila owner belum punya properti (akun baru)
 *  - `next` bila ada (rute yang dituju sebelum diarahkan ke /login)
 *  - "/dashboard" default (landing "/" publik untuk pengunjung umum)
 */
export async function afterAuthRedirect(next?: string | null): Promise<string> {
  const info = await getAuthInfo();
  if (info.demo) return next && next.startsWith("/") ? next : "/dashboard";
  try {
    const res = await fetch("/api/properties", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as { property?: unknown } | null;
      if (data && data.property === null) return "/onboarding";
    }
  } catch {
    /* offline — biarkan dashboard yang menangani */
  }
  return next && next.startsWith("/") && !next.startsWith("/login") && !next.startsWith("/register")
    ? next
    : "/dashboard";
}
