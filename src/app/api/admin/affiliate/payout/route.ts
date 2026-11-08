// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/affiliate/payout — Tandai komisi sudah ditransfer (Super Admin)
//
//  PATCH  body { commissionId } → status komisi "approved" menjadi "paid"
//         + paidAt = now() (audit payout). Idempoten: komisi yang sudah paid
//         tetap sukses (alreadyPaid) tanpa menimpa timestamp pertama.
//
// Wajib requireSuperAdminUser() — 401 belum masuk, 403 bukan super admin.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import { markCommissionPaid } from "@/lib/affiliate-admin";
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
  const commissionId =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).commissionId
      : undefined;

  if (typeof commissionId !== "string" || !commissionId.trim()) {
    return NextResponse.json(
      { success: false, error: "commissionId wajib diisi." },
      { status: 400 },
    );
  }

  const result = await markCommissionPaid(commissionId.trim());
  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error:
          result.reason === "not-found"
            ? "Komisi tidak ditemukan."
            : "Gagal menandai komisi — coba lagi sebentar.",
      },
      { status: result.reason === "not-found" ? 404 : 500 },
    );
  }

  return NextResponse.json({ success: true, alreadyPaid: result.alreadyPaid });
}
