// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Sistem affiliate, Tahap 2: helper sisi SERVER.
//
// Dipisah dari affiliate.ts karena mengimpor next/headers yang TIDAK boleh
// dibundel ke middleware (edge runtime). Ikuti pola yang sama dengan
// src/lib/auth/ (config.ts edge-safe vs server.ts node-only).
//
// Pemakaian (Tahap 3 — atribusi komisi saat checkout):
//   import { getAffiliateRefServer } from "@/lib/affiliate-server";
//   const ref = await getAffiliateRefServer(); // null bila tanpa referral
// ─────────────────────────────────────────────────────────────────────────────

import { cookies } from "next/headers";

import { AFFILIATE_REF_COOKIE } from "@/lib/affiliate";

/**
 * Baca kode referral afiliasi dari cookie `unitku_ref` — sisi SERVER.
 *
 * Bekerja di Route Handler (mis. /api/checkout) maupun Server Component
 * (mis. banner "Direkomendasikan oleh X"). Mengembalikan null bila pengunjung
 * datang tanpa link referral atau cookie sudah kedaluwarsa (30 hari).
 */
export async function getAffiliateRefServer(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(AFFILIATE_REF_COOKIE)?.value ?? null;
}
