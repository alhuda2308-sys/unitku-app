// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Health Check
//
// GET /api/health → ping ringan ke database (SELECT 1). Dipakai:
//   • auto-recovery mode offline pada dashboard (dashboard-store.ts) —
//     polling murah utk mendeteksi kapan database kembali terjangkau;
//   • diagnosa manual saat banner "Mode offline" tampil.
//
// Sengaja TIDAK memicu ensureSeed() — probe harus murah & bebas efek samping.
// Respon 200 { ok: true } bila DB hidup; 503 { ok: false, error } bila tidak.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      db: "up",
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown database error";
    console.error("[api/health] Database tidak terjangkau:", message);
    return NextResponse.json(
      { ok: false, db: "down", error: message, checkedAt: new Date().toISOString() },
      { status: 503 },
    );
  }
}
