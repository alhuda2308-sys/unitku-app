// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Klien Supabase Admin (SERVICE ROLE — server-side saja!)
//
// Dipakai provisioning akun pembeli lisensi secara programatik dari webhook
// Mayar (supabase.auth.admin.createUser). Kredensial SERVICE ROLE BYPASS RLS —
// JANGAN PERNAH diimpor dari komponen client / dipaparkan ke browser.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

/**
 * Mengembalikan klien admin Supabase bila env tersedia, selain itu null.
 * Cache sekali per proses agar webhook berkecepatan tinggi tidak membuat
 * klien baru untuk setiap request.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url.startsWith("http") || serviceKey.length < 20) {
    console.error(
      "[UnitKu Billing] SUPABASE_SERVICE_ROLE_KEY tidak terisi — " +
        "provisioning akun Supabase via webhook dilewati (lisensi tetap dicatat).",
    );
    cached = null;
    return cached;
  }

  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

// ── Utilitas daftar user (dipakai panel Super Admin — /api/admin/*) ─────────

export interface SupabaseAuthUserLite {
  id: string;
  email: string; // lowercase, bisa "" bila aneh
  createdAt: string | null;
  fullName: string | null;
}

/**
 * Ambil seluruh user auth (paginasi otomatis — maks 10 halaman × 200 baris).
 * Butuh SUPABASE_SERVICE_ROLE_KEY; mengembalikan [] bila admin tidak tersedia.
 */
export async function listAllSupabaseUsers(): Promise<SupabaseAuthUserLite[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];

  const perPage = 200;
  const out: SupabaseAuthUserLite[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("[UnitKu Admin] listUsers gagal:", error.message);
      break;
    }
    for (const u of data.users ?? []) {
      out.push({
        id: u.id,
        email: (u.email ?? "").trim().toLowerCase(),
        createdAt: u.created_at ?? null,
        fullName:
          typeof u.user_metadata?.full_name === "string"
            ? (u.user_metadata.full_name as string)
            : null,
      });
    }
    const users = data.users ?? [];
    if (users.length < perPage) break;
  }
  return out;
}

/** Cari id user Supabase berdasarkan email (untuk reset password / hapus akun) */
export async function findSupabaseUserIdByEmail(
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const users = await listAllSupabaseUsers();
  return users.find((u) => u.email === normalized)?.id ?? null;
}
