// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — API affiliator: simpan rekening pencairan komisi (server-only)
//
// POST /api/affiliate/payout
//   Body : { bankName, bankAccountNo, bankAccountName, token? }
//   Auth : DUA jalur (salah satu wajib):
//          1. Magic-link token  → ownership by affiliates.accessToken — mitra
//             yang didaftarkan admin tanpa akun email (akses portal via link
//             pribadi) tetap bisa mengelola rekeningnya sendiri.
//          2. Sesi login        → ownership by userId sesi (bukan input client).
//   Respon: { success: true } | error JSON sesuai kondisi.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import {
  updateAffiliatePayout,
  updateAffiliatePayoutByToken,
} from "@/lib/affiliate-portal";
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
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { success: false, error: "Payload tidak valid." },
      { status: 400 },
    );
  }

  const raw = body as Record<string, unknown>;
  const token = typeof raw.token === "string" ? raw.token.trim() : "";

  // ── Gerbang auth: token magic-link ATAU sesi login ─────────────────────────
  // Keabsahan token divalidasi di lib (findUnique by accessToken) — token
  // salah diperlakukan seperti affiliator tidak ditemukan (404), bukan 403,
  // agar pesan ke mitra tidak membocorkan detail internal.
  let sessionUserId: string | null = null;
  if (!token) {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Silakan masuk terlebih dahulu." },
        { status: 401 },
      );
    }
    sessionUserId = user.id;
  }

  const bankName = cleanText(raw.bankName, 64);
  const bankAccountNo = cleanText(raw.bankAccountNo, 32);
  const bankAccountName = cleanText(raw.bankAccountName, 128);

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

  const input = { bankName, bankAccountNo, bankAccountName };
  const result = token
    ? await updateAffiliatePayoutByToken(token, input)
    : await updateAffiliatePayout(sessionUserId as string, input);

  if (!result.ok) {
    const message =
      result.reason === "not-found"
        ? token
          ? "Link portal tidak valid atau sudah berubah — minta link terbaru ke Admin."
          : "Akun affiliator tidak ditemukan untuk akun Anda. Hubungi admin untuk pendaftaran."
        : "Gagal menyimpan rekening — coba lagi sebentar.";
    return NextResponse.json(
      { success: false, error: message },
      { status: result.reason === "not-found" ? 404 : 500 },
    );
  }

  return NextResponse.json({ success: true });
}
