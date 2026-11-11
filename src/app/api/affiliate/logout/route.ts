// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — POST /api/affiliate/logout — Akhiri sesi portal mitra affiliator
//
// Menghapus cookie "unitku_partner" (sesi mitra). Tidak butuh autentikasi —
// menghapus cookie tidak membuka akses apa pun. Mitra tanpa sesi pun aman
// dipanggil (idempoten).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";

import { PARTNER_SESSION_COOKIE } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: PARTNER_SESSION_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
  });
  return response;
}
