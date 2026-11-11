// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/affiliate/[id] — Hapus permanen satu mitra affiliator
//
//  DELETE  → HARD DELETE TOTAL dalam satu transaksi (lib affiliate-admin):
//            1. owner_trials (partnerId) — seluruh link/token trial mitra
//               terhapus → link lama langsung mati (halaman "Link Trial
//               Tidak Valid"), tak bisa diakses lagi siapa pun.
//            2. affiliate_commissions (affiliateId) — seluruh komisi terkait.
//            3. affiliates (id) — baris mitra: referral ?ref= & magic-link
//               portal mati otomatis (resolusi server selalu validasi DB).
//            Respons: { success, deletedCommissions, deletedTrials } — panel
//            memperbarui tabel secara optimistis tanpa reload halaman penuh.
//
// Wajib requireSuperAdminUser() — 401 belum masuk, 403 bukan super admin.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";

import { deleteAffiliate } from "@/lib/affiliate-admin";
import { requireSuperAdminUser } from "@/lib/auth/super-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  if (typeof id !== "string" || !id.trim()) {
    return NextResponse.json(
      { success: false, error: "ID mitra tidak valid." },
      { status: 400 },
    );
  }

  const result = await deleteAffiliate(id.trim());
  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error:
          result.reason === "not-found"
            ? "Mitra tidak ditemukan — mungkin sudah dihapus sebelumnya."
            : "Gagal menghapus mitra — coba lagi sebentar.",
      },
      { status: result.reason === "not-found" ? 404 : 500 },
    );
  }

  return NextResponse.json({
    success: true,
    deletedCommissions: result.deletedCommissions,
    deletedTrials: result.deletedTrials,
  });
}
