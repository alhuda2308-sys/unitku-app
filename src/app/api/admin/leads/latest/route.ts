// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/leads/latest — Deteksi pendaftar baru untuk notifikasi instan
//
// Endpoint ringan khusus Super Admin (guard ketat, sama dengan /api/admin/
// users): mengembalikan lead TERBARU dari license_leads ATAU null bila belum
// ada. Dipakai klien (dashboard & panel admin) sebagai sumber kebenaran:
//   • Polling berkala (20–30 detik) — bekerja di SEMUA mode (Supabase/lokal),
//     tanpa syarat RLS/realtime, 401/403 untuk non-admin.
//   • Supabase Realtime postgres_changes (bila aktif di sisi DB) hanya
//     mempercepat pemicu — datanya tetap diambil dari endpoint ini sehingga
//     tidak ada PII lead yang bocor lewat channel publik.
// Berat query minimal: 1 baris (orderBy createdAt desc, limit 1).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";

import { db } from "@/lib/prisma";
import { getAuthMode } from "@/lib/auth/config";
import {
  ADMIN_FORBIDDEN_MESSAGE,
  requireSuperAdminUser,
} from "@/lib/auth/super-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSuperAdminUser();
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: ADMIN_FORBIDDEN_MESSAGE },
      { status: gate.status },
    );
  }

  try {
    const row = await db.licenseLead.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        source: true,
        createdAt: true,
      },
    });
    return NextResponse.json({
      ok: true,
      mode: getAuthMode(),
      latest: row
        ? {
            id: row.id,
            name: row.name,
            phone: row.phone,
            source: row.source,
            createdAt: row.createdAt.toISOString(),
          }
        : null,
    });
  } catch (error) {
    console.error(
      "[api/admin/leads/latest] Gagal membaca lead terbaru:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "Database tidak terjangkau — coba lagi sebentar." },
      { status: 503 },
    );
  }
}
