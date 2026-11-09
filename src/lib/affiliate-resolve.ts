// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Resolusi kode referral → mitra AKTIF di tabel affiliates
// (server-only — mengimpor Prisma; jangan dipakai di middleware/edge)
//
// Dipakai bersama oleh:
//   • POST /api/auth/register  → source lead "Referral: <kode>" / "Organik (Web)"
//   • POST /api/checkout       → source lead "Referral: <kode>" / "BAYAR_OTOMATIS"
//                                + extraData.affiliate_ref invoice Mayar
//
// Pencocokan CASE-INSENSITIVE: link mitra disebar lowercase (?ref=budi2026)
// tetap cocok dengan refCode campuran di DB ("Budi2026" — input admin lama).
// refCode yang dikembalikan selalu versi KANONIK di DB.
// Fail-safe total: DB gagal / kode tak terdaftar / mitra nonaktif → null
// (pemanggil memperlakukan sebagai organik — TIDAK pernah melempar).
// ─────────────────────────────────────────────────────────────────────────────

import { sanitizeAffiliateRef } from "@/lib/affiliate";
import { db } from "@/lib/prisma";

/** Mitra pemilik kode referral yang valid & aktif */
export interface ResolvedAffiliate {
  /** Nama mitra (tabel affiliates) */
  name: string;
  /** Kode referral versi kanonik di DB */
  refCode: string;
}

/**
 * Cocokkan kode referral mentah (dari body / query / cookie) ke mitra AKTIF.
 * Hanya mitra isActive yang dihitung; kode tak terdaftar / mitra nonaktif /
 * DB tidak terjangkau → null (organik).
 */
export async function resolveActiveAffiliate(
  raw: string | null | undefined,
): Promise<ResolvedAffiliate | null> {
  const code = sanitizeAffiliateRef(raw);
  if (!code) return null;
  try {
    // Postgres `mode: "insensitive"` — satu query menangkap semua varian
    // case; ambil varian AKTIF bila ada duplikat case di data lama.
    const matches = await db.affiliate.findMany({
      where: { refCode: { equals: code, mode: "insensitive" } },
      select: { name: true, refCode: true, isActive: true },
    });
    const active = matches.find((m) => m.isActive);
    if (active) return { name: active.name, refCode: active.refCode };
    if (matches.length > 0) return null; // hanya varian nonaktif → organik
  } catch (error) {
    // Fallback provider DB tanpa mode "insensitive": exact → lowercase
    // (maks. 2 query findUnique — perilaku lama yang sudah terbukti).
    console.error(
      "[affiliate] Lookup insensitive gagal, fallback exact/lowercase:",
      error instanceof Error ? error.message : error,
    );
    const candidates = [...new Set([code, code.toLowerCase()])];
    for (const candidate of candidates) {
      try {
        const mitra = await db.affiliate.findUnique({
          where: { refCode: candidate },
          select: { name: true, refCode: true, isActive: true },
        });
        if (mitra && mitra.isActive) {
          return { name: mitra.name, refCode: mitra.refCode };
        }
        if (mitra && !mitra.isActive) return null; // mitra nonaktif → organik
      } catch {
        return null; // DB tidak terjangkau → organik (fail-safe)
      }
    }
  }
  console.log(
    `[affiliate] Kode referral "${code}" tidak terdaftar/aktif — dianggap organik.`,
  );
  return null;
}
