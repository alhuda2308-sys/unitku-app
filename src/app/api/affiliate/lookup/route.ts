// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Lookup publik mitra referral (server-only, TANPA auth)
//
// GET /api/affiliate/lookup?ref=<kode>
//   Fallback sumber kode : cookie `unitku_ref` (bila query kosong) — alur
//   sama dengan halaman /checkout (URL dulu, lalu cookie last-click).
//   Flow  : resolveActiveAffiliate (validasi DB — hanya mitra AKTIF,
//           case-insensitive, refCode kanonik) → normalisasi nomor WA mitra
//           (normalizeMitraWaNumber: 08…/62…/+62… → 62xxxxxxxxxx).
//
//   Response 200 (selalu — kegagalan = "found:false", TIDAK pernah melempar):
//     { found: true,  refCode, waPhone }  — waPhone null bila mitra tidak
//                                           punya nomor sah
//     { found: false }
//
// KEAMANAN (data diekspos MINIMAL — hanya routing tombol WA white-label):
//   • refCode + waPhone — cukup utk routing tombol "Pesan Manual via WhatsApp
//     Admin" ke WA mitra saat referral aktif. Nama mitra SENGAJA tidak
//     dikirim (white-label: pembeli hanya melihat identitas "Admin UnitKu").
//   • TIDAK PERNAH mengekspos email, saldo komisi (totalEarnings), rekening
//     pencairan, accessToken, atau status aktivasi mentah.
//   • Kode mitra nonaktif/dihapus → found:false — kode mati tidak bisa
//     "hidup kembali" dari cookie basi (konsisten dgn validasi /api/checkout).
//   • Cache-Control: no-store — atribusi last-click selalu segar.
//
// Dipakai: modal checkout landing (buy-cta.tsx — client fetch on mount,
// dedup per halaman) saat pengunjung membawa cookie referral.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import { AFFILIATE_REF_COOKIE } from "@/lib/affiliate";
import { resolveActiveAffiliate } from "@/lib/affiliate-resolve";
import { normalizeMitraWaNumber } from "@/lib/checkout-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Kode mentah: query ?ref= dulu (klik terkini), fallback cookie `unitku_ref`
  const rawRef =
    request.nextUrl.searchParams.get("ref") ??
    request.cookies.get(AFFILIATE_REF_COOKIE)?.value ??
    null;

  // Fail-safe total: DB gagal / kode tak terdaftar / mitra nonaktif → organik
  const affiliate = await resolveActiveAffiliate(rawRef).catch(() => null);
  if (!affiliate) {
    return NextResponse.json(
      { found: false },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Nomor WA dinormalisasi di server SEKALI — client tinggal pakai; nomor
  // tidak sah (landline/typo) → null → client jatuh ke fallback WA Admin.
  const waPhone = normalizeMitraWaNumber(affiliate.phone);

  return NextResponse.json(
    {
      found: true,
      refCode: affiliate.refCode,
      waPhone,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
