// ─────────────────────────────────────────────────────────────────────────────
// POST /api/demo/reset — Reset Data Demo (khusus sesi demo)
//
// Menghapus seluruh data properti simulasi "Kost Griya Pratama" lalu
// men-seed ulang dari nol — dataset demo kembali persis ke kondisi awal
// (12 kamar, penghuni, tagihan, buku kas, staf, tiket komplain).
// Dipakai tombol "Reset Data Demo" pada banner Mode Demo Interaktif.
//
// Keamanan: ditolak untuk sesi non-demo (owner asli tidak pernah bisa
// memicunya) dan hanya menyentuh properti seed milik DEMO_OWNER_ID.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth/server";
import { resetDemoSeed } from "@/lib/server/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sesi berakhir — silakan masuk kembali." },
      { status: 401 },
    );
  }
  if (!user.demo) {
    return NextResponse.json(
      { error: "Reset data demo hanya tersedia dalam Mode Demo." },
      { status: 403 },
    );
  }

  try {
    await resetDemoSeed();
    return NextResponse.json({ ok: true, resetAt: new Date().toISOString() });
  } catch (err) {
    console.error("[api/demo/reset POST]", err);
    return NextResponse.json(
      { error: "Gagal mereset data demo — coba lagi sebentar." },
      { status: 500 },
    );
  }
}
