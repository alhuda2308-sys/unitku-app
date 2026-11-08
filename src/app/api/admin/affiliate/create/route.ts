// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/affiliate/create — Daftarkan mitra affiliator baru (Super Admin)
//
//  POST   body { email, name, refCode } → baris affiliates baru. userId
//         di-resolve otomatis dari Supabase Auth via email — bila user belum
//         terdaftar, baris tetap dibuat tanpa keterkaitan (linkedUser:false)
//         dan dashboard affiliator terhubung setelah user mendaftar.
//
// Wajib requireSuperAdminUser() — 401 belum masuk, 403 bukan super admin.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import { createAffiliate } from "@/lib/affiliate-admin";
import { requireSuperAdminUser } from "@/lib/auth/super-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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
  const { email, name, refCode } = body as Record<string, unknown>;

  if (
    typeof email !== "string" ||
    typeof name !== "string" ||
    typeof refCode !== "string"
  ) {
    return NextResponse.json(
      { success: false, error: "Email, nama, dan kode referral wajib diisi." },
      { status: 400 },
    );
  }

  const result = await createAffiliate({ email, name, refCode });
  if (!result.ok) {
    const status =
      result.reason === "invalid-input"
        ? 400
        : result.reason === "error"
          ? 500
          : 409;
    const message: Record<string, string> = {
      "invalid-input":
        "Data tidak valid — email harus berformat benar dan kode referral hanya boleh huruf, angka, tanda hubung, atau garis bawah.",
      "ref-code-taken":
        "Kode referral sudah dipakai mitra lain — gunakan kode berbeda.",
      "email-taken":
        "Email tersebut sudah terdaftar sebagai mitra affiliator.",
      error: "Gagal mendaftarkan mitra — coba lagi sebentar.",
    };
    return NextResponse.json(
      { success: false, error: message[result.reason] ?? "Gagal." },
      { status },
    );
  }

  return NextResponse.json({
    success: true,
    linkedUser: result.linkedUser,
    phone: result.phone,
    partner: result.partner,
  });
}
