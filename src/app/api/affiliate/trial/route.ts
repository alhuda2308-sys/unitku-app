// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — API affiliator: Generator Link Trial 3 Hari (server-only)
//
// POST /api/affiliate/trial
//   Body : { ownerName, ownerWhatsapp, propertyName?, token? }
//   Auth : DUA jalur (pola /api/affiliate/payout):
//          1. Magic-link token → ownership by affiliates.accessToken
//          2. Sesi login       → ownership by userId sesi (bukan input client)
//   Efek : baris OwnerTrial baru (status PENDING) terikat partnerId mitra —
//          atribusi komisi paywall nanti dijamin lewat kolom ini.
//   Respon: { success, trial: { id, trialUrl, waMessage, … } } — trialUrl &
//          waMessage siap tampil di card "Salin Pesan WA".
//
// GET /api/affiliate/trial[?token=]
//   Auth : sama dengan POST. Respon: { success, trials: OwnerTrialRow[] } —
//          riwayat trial mitra (terbaru dulu, maks 30) utk dashboard.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth/server";
import {
  buildTrialWaMessage,
  createOwnerTrialForToken,
  createOwnerTrialForUser,
  listOwnerTrialsForToken,
  listOwnerTrialsForUser,
} from "@/lib/owner-trial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ambil token magic-link dari body/query (string pertama yang valid) */
function extractToken(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  return trimmed && trimmed.length <= 128 ? trimmed : "";
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
  const token = extractToken(raw.token);

  // ── Gerbang auth: token magic-link ATAU sesi login ─────────────────────────
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

  const input = {
    ownerName: typeof raw.ownerName === "string" ? raw.ownerName : "",
    ownerWhatsapp:
      typeof raw.ownerWhatsapp === "string" ? raw.ownerWhatsapp : "",
    propertyName:
      typeof raw.propertyName === "string" ? raw.propertyName : null,
  };

  const result = token
    ? await createOwnerTrialForToken(token, input)
    : await createOwnerTrialForUser(sessionUserId as string, input);

  if (!result.ok) {
    if (result.reason === "not-found") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Akun mitra tidak ditemukan. Pastikan Anda mengakses dashboard melalui link portal mitra yang benar.",
        },
        { status: 404 },
      );
    }
    if (result.reason === "invalid") {
      return NextResponse.json(
        { success: false, error: result.error ?? "Data form belum lengkap." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "Kendala database — coba lagi beberapa saat.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    success: true,
    trial: {
      ...result.trial,
      waMessage: buildTrialWaMessage({
        ownerName: result.trial.ownerName,
        propertyName: result.trial.propertyName,
        trialUrl: result.trial.trialUrl,
      }),
    },
  });
}

export async function GET(request: NextRequest) {
  const token = extractToken(
    request.nextUrl.searchParams.get("token") ?? undefined,
  );

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

  const result = token
    ? await listOwnerTrialsForToken(token)
    : await listOwnerTrialsForUser(sessionUserId as string);

  if (!result.ok) {
    if (result.reason === "not-found") {
      return NextResponse.json(
        { success: false, error: "Akun mitra tidak ditemukan." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Kendala database — coba lagi beberapa saat." },
      { status: 503 },
    );
  }

  return NextResponse.json({ success: true, trials: result.trials });
}
