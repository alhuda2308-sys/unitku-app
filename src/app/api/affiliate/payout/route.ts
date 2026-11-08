// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — API affiliator: simpan rekening pencairan komisi (server-only)
//
// POST /api/affiliate/payout
//   Body : { bankName, bankAccountNo, bankAccountName }
//   Auth : sesi wajib (getAuthUser) — 401 bila tamu.
//   Ownership: baris affiliates dicari by userId sesi (bukan input client).
//   Respon: { success: true } | error JSON sesuai kondisi.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import { updateAffiliatePayout } from "@/lib/affiliate-portal";
import { getAuthUser } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bersihkan input teks: trim + batas panjang (null bila kosong) */
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Silakan masuk terlebih dahulu." },
      { status: 401 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { success: false, error: "Payload tidak valid." },
      { status: 400 },
    );
  }

  const bankName = cleanText(
    (body as Record<string, unknown>).bankName,
    64,
  );
  const bankAccountNo = cleanText(
    (body as Record<string, unknown>).bankAccountNo,
    32,
  );
  const bankAccountName = cleanText(
    (body as Record<string, unknown>).bankAccountName,
    128,
  );

  // Rekening pencairan wajib lengkap — salah satu kosong = tidak bisa dicairkan
  if (!bankName || !bankAccountNo || !bankAccountName) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Nama bank, nomor rekening, dan atas nama rekening wajib diisi.",
      },
      { status: 400 },
    );
  }
  // Nomor rekening: hanya angka, spasi, dan tanda hubung
  if (!/^[0-9\s-]+$/.test(bankAccountNo)) {
    return NextResponse.json(
      {
        success: false,
        error: "Nomor rekening hanya boleh berisi angka, spasi, dan tanda hubung.",
      },
      { status: 400 },
    );
  }

  const result = await updateAffiliatePayout(user.id, {
    bankName,
    bankAccountNo,
    bankAccountName,
  });

  if (!result.ok) {
    const message =
      result.reason === "not-found"
        ? "Akun affiliator tidak ditemukan untuk akun Anda. Hubungi admin untuk pendaftaran."
        : "Gagal menyimpan rekening — coba lagi sebentar.";
    return NextResponse.json(
      { success: false, error: message },
      { status: result.reason === "not-found" ? 404 : 500 },
    );
  }

  return NextResponse.json({ success: true });
}
