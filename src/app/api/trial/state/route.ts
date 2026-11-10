// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — GET /api/trial/state — Status trial utk banner dashboard (client)
//
// Dipakai TrialBanner di /dashboard: banner "Mode Uji Coba — Sisa trial: X
// hari" membaca cookie trial lalu mengambil status TERKINI dari server.
// Status dihitung server-side (lazy-lock ditegakkan) — sumber kebenaran selalu
// DB, sehingga paywall saat trial habis tetap sah walau countdown client
// dimanipulasi.
//
// Respon:
//   200 { success: true, state: { ownerName, propertyName, status,
//          trialStartedAt, trialExpiresAt, partnerRefCode } }
//   400 { success: false, error } — token tidak ada/bentuk salah
//   404 { success: false, error } — token tidak dikenal
//   503 { success: false, error } — database tak terjangkau
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import { getOwnerTrialState } from "@/lib/owner-trial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = (request.nextUrl.searchParams.get("token") ?? "").trim();
  if (!token || token.length > 64) {
    return NextResponse.json(
      { success: false, error: "Token trial tidak valid." },
      { status: 400 },
    );
  }

  const result = await getOwnerTrialState(token);
  if (!result.ok) {
    if (result.reason === "not-found") {
      return NextResponse.json(
        { success: false, error: "Trial tidak ditemukan." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Kendala database — coba lagi beberapa saat." },
      { status: 503 },
    );
  }

  return NextResponse.json({ success: true, state: result.state });
}
