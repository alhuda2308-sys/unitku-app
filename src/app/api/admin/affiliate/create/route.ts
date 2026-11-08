// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/affiliate/create — Daftarkan mitra affiliator baru (Super Admin)
//
//  POST   body { name, refCode, phone } → baris affiliates baru AKTIF.
//         • Tanpa email — backend membuat fallback identifier otomatis
//           `${phone}@affiliate.unitku.my.id` bila skema membutuhkannya.
//         • No. WA di-resolve ke akun Supabase (bila ada) → dashboard
//           affiliator langsung terhubung (userId).
//         • accessToken magic-link dibuat → link portal mitra tanpa login.
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
  const { name, refCode, phone } = body as Record<string, unknown>;

  if (
    typeof name !== "string" ||
    typeof refCode !== "string" ||
    typeof phone !== "string"
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Nama, kode referral, dan nomor WhatsApp wajib diisi.",
      },
      { status: 400 },
    );
  }

  const result = await createAffiliate({ name, refCode, phone });
  if (!result.ok) {
    const status =
      result.reason === "invalid-input"
        ? 400
        : result.reason === "error"
          ? 500
          : 409;
    const message: Record<string, string> = {
      "invalid-input":
        "Data tidak valid — nama wajib diisi, kode referral hanya boleh huruf kecil/angka/tanda hubung/garis bawah, dan No. WhatsApp harus format Indonesia yang sah (08…/62…).",
      "ref-code-taken":
        "Kode referral sudah dipakai mitra lain — gunakan kode berbeda.",
      "phone-taken":
        "No. WhatsApp tersebut sudah terdaftar sebagai mitra affiliator.",
      "user-linked":
        "No. WhatsApp ini milik akun yang sudah terhubung ke mitra affiliator lain — satu akun user hanya boleh satu mitra.",
      error: "Gagal mendaftarkan mitra — coba lagi sebentar.",
    };
    return NextResponse.json(
      {
        success: false,
        error: message[result.reason] ?? "Gagal.",
        // Detail error DB (kode Prisma + pesan pendek) — Super Admin langsung
        // melihat penyebab sesungguhnya tanpa membuka server logs.
        ...(result.reason === "error" && result.detail
          ? { detail: result.detail }
          : {}),
      },
      { status },
    );
  }

  return NextResponse.json({
    success: true,
    linkedUser: result.linkedUser,
    phone: result.phone,
    email: result.email,
    accessToken: result.accessToken,
    partner: result.partner,
  });
}
