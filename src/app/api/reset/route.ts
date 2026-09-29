// ─────────────────────────────────────────────────────────────────────────────
// /api/reset — Zona Berbahaya (Pengaturan)
//
// POST { mode: "demo" }    : hapus penyewa, tagihan & transaksi kas — struktur
//                            kamar + profil properti dipertahankan (kamar
//                            dikembalikan ke status kosong)
// POST { mode: "factory" } : di atas + hapus seluruh kamar (reset penuh)
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { ensureSeed } from "@/lib/server/seed";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await ensureSeed();
    const body = (await request.json().catch(() => ({}))) as { mode?: unknown };
    const factory = body.mode === "factory";

    await db.tenant.deleteMany();
    await db.ticket.deleteMany(); // komplain demo ikut dibersihkan
    await db.invoice.deleteMany(); // invoice_lines ikut ter-cascade
    await db.cashEntry.deleteMany();
    if (factory) {
      await db.room.deleteMany();
    } else {
      await db.room.updateMany({
        data: {
          status: "kosong",
          contractDuration: null,
          contractStart: null,
          contractEnd: null,
          deposit: 0,
          depositHeld: false,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      mode: factory ? "factory" : "demo",
      clearedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/reset POST]", err);
    return NextResponse.json({ error: "Gagal melakukan reset data." }, { status: 500 });
  }
}
