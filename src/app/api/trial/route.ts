// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — API publik portal trial owner (server-only)
//
// Dipakai halaman /trial?token=<id> (owner kost/kontrakan, TANPA login).
// Token = OwnerTrial.id (cuid unik) yang dibuat mitra dari dashboard.
// /api/* dilewati middleware — validasi token ketat ada di lib.
//
// POST /api/trial   Body: { token }
//   → AKTIVASI klik pertama: PENDING → ACTIVE, trialStartedAt = sekarang,
//     trialExpiresAt = +72 jam (idempoten — refresh tidak memperpanjang).
//     Respons berisi status terkini (lazy-lock ditegakkan) + refCode mitra
//     untuk link checkout paywall.
//
// GET /api/trial?token=<id>
//   → Status SAJA (tanpa aktivasi) — dipakai polling countdown client.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import {
  activateOwnerTrial,
  getOwnerTrialState,
} from "@/lib/owner-trial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Respons seragam utk token tidak valid/tidak dikenal — tanpa bocor detail */
function notFound() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Link trial tidak valid atau sudah kedaluwarsa. Silakan minta link baru dari mitra UnitKu Anda.",
    },
    { status: 404 },
  );
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const token =
    typeof body === "object" && body !== null
      ? typeof (body as Record<string, unknown>).token === "string"
        ? ((body as Record<string, unknown>).token as string).trim()
        : ""
      : "";
  if (!token) return notFound();

  const result = await activateOwnerTrial(token);
  if (!result.ok) return notFound();
  return NextResponse.json({ success: true, state: result.state });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) return notFound();

  const result = await getOwnerTrialState(token);
  if (!result.ok) return notFound();
  return NextResponse.json({ success: true, state: result.state });
}
