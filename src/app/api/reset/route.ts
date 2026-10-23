// ─────────────────────────────────────────────────────────────────────────────
// /api/reset — Zona Berbahaya (Pengaturan) — TER-SCOPE PER PROPERTI
//
// POST { mode: "demo", propertyId? }    : hapus penyewa, tagihan & transaksi
//                                         kas MILIK PROPERTI AKTIF SAJA —
//                                         struktur kamar + profil dipertahankan
//                                         (kamar kembali status kosong)
// POST { mode: "factory", propertyId? } : di atas + hapus seluruh kamar
//                                         properti aktif (reset penuh cabang)
//
// ISOLASI MULTI-CABANG (WAJIB): reset TIDAK PERNAH menyentuh properti lain —
// semua deleteMany difilter property_id = properti aktif yang sedang dikelola
// (body.propertyId dari switcher, divalidasi kepemilikan; bila tidak dikirim →
// properti aktif default owner, BUKAN seluruh properti).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { ensureSeedForUser } from "@/lib/server/seed";
import { getAuthUser } from "@/lib/auth/server";
import {
  getActiveOwnedProperty,
  resolveOwnedPropertyOverride,
  unauthorized,
} from "@/lib/auth/ownership";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const body = (await request.json().catch(() => ({}))) as {
      mode?: unknown;
      propertyId?: unknown;
    };
    const factory = body.mode === "factory";

    // Properti TUJUAN reset = properti AKTIF yang sedang dikelola (switcher).
    // Bukan milik owner → 404 (fail-loud, tidak pernah fallback ke semua).
    const target = await resolveOwnedPropertyOverride(user, body.propertyId);
    if (target instanceof NextResponse) return target;
    const property = target ?? (await getActiveOwnedProperty(user));
    if (!property) {
      return NextResponse.json(
        { error: "Properti belum terdaftar — lengkapi onboarding terlebih dahulu." },
        { status: 400 },
      );
    }
    const propertyId = property.id;

    // Isolasi ketat: SEMUA penghapusan terikat SATU properti aktif ini saja —
    // data cabang lain dijamin tidak tersentuh.
    await db.tenant.deleteMany({ where: { propertyId } });
    await db.ticket.deleteMany({
      // komplain properti ini (kolom propertyId langsung ATAU via kamar lama)
      where: { OR: [{ propertyId }, { room: { propertyId } }] },
    });
    await db.invoice.deleteMany({ where: { propertyId } }); // invoice_lines ikut ter-cascade
    await db.cashEntry.deleteMany({ where: { propertyId } });
    // Pengumuman properti ini ikut dibersihkan
    await db.announcement.deleteMany({ where: { propertyId } });
    if (factory) {
      await db.room.deleteMany({ where: { propertyId } });
    } else {
      await db.room.updateMany({
        where: { propertyId },
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
      propertyId,
      propertyName: property.name,
      clearedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/reset POST]", err);
    return NextResponse.json({ error: "Gagal melakukan reset data." }, { status: 500 });
  }
}
