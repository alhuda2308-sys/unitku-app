// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/affiliate/status — Aktif/nonaktifkan kode referral mitra
//
//  PATCH  body { affiliateId, isActive } → toggle kolom affiliates.isActive.
//         Nonaktif = webhook berhenti mencatat komisi baru utk kode tsb
//         (cookie lama tetap mengikuti calon pembeli).
//
// Wajib requireSuperAdminUser() — 401 belum masuk, 403 bukan super admin.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import { setAffiliateActive } from "@/lib/affiliate-admin";
import { requireSuperAdminUser } from "@/lib/auth/super-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const gate = await requireSuperAdminUser();
  if (!gate.ok) {
    return NextResponse.json(
      {
        success: false,
        error:
          gate.status === 401
            ? "Silakan masuk terlebih dahulu."
            : "Akses ditolak — endpoint ini khusus Super Admin.",
      },
      { status: gate.status },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { success: false, error: "Payload tidak valid." },
      { status: 400 },
    );
  }
  const { affiliateId, isActive } = body as Record<string, unknown>;

  if (typeof affiliateId !== "string" || !affiliateId.trim()) {
    return NextResponse.json(
      { success: false, error: "affiliateId wajib diisi." },
      { status: 400 },
    );
  }
  if (typeof isActive !== "boolean") {
    return NextResponse.json(
      { success: false, error: "isActive wajib boolean." },
      { status: 400 },
    );
  }

  const result = await setAffiliateActive(affiliateId.trim(), isActive);
  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error:
          result.reason === "not-found"
            ? "Mitra tidak ditemukan."
            : "Gagal mengubah status mitra — coba lagi sebentar.",
      },
      { status: result.reason === "not-found" ? 404 : 500 },
    );
  }

  return NextResponse.json({ success: true, isActive });
}
