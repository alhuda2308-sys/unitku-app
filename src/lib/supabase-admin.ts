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
