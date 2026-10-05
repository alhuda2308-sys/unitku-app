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
import { ensureSeedForUser } from "@/lib/server/seed";
import { getAuthUser } from "@/lib/auth/server";
import { getOwnedPropertyIds, unauthorized } from "@/lib/auth/ownership";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const body = (await request.json().catch(() => ({}))) as { mode?: unknown };
    const factory = body.mode === "factory";

    // Isolasi multi-tenant: reset HANYA menyentuh data milik properti owner
    const propertyIds = await getOwnedPropertyIds(user);
    const roomScope = { propertyId: { in: propertyIds } };

    await db.tenant.deleteMany({ where: { room: roomScope } });
    await db.ticket.deleteMany({
      // komplain demo ikut dibersihkan (tiket via kolom propertyId / kamar)
      where: { OR: [{ propertyId: { in: propertyIds } }, { room: roomScope }] },
    });
    await db.invoice.deleteMany({ where: { room: roomScope } }); // invoice_lines ikut ter-cascade
    await db.cashEntry.deleteMany({ where: { propertyId: { in: propertyIds } } });
    // Pengumuman ikut dibersihkan (dulu state lokal — kini tersimpan di cloud)
    await db.announcement.deleteMany({ where: { propertyId: { in: propertyIds } } });
    if (factory) {
      await db.room.deleteMany({ where: roomScope });
    } else {
      await db.room.updateMany({
        where: roomScope,
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
