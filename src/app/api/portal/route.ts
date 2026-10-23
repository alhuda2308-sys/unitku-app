// ─────────────────────────────────────────────────────────────────────────────
// /api/portal — Portal Penyewa publik (magic token, tanpa login)
//
// GET ?token=… : resolve SATU kamar milik token tersebut + tagihannya + nama
//                properti. Dipakai halaman /portal?token=… agar data pembayaran
//                selalu terkini dari cloud (lintas perangkat, bukan mirror lokal).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { DEMO_OWNER_ID } from "@/lib/auth/config";
import { toClientAnnouncement, toClientInvoice, toClientRoom } from "@/lib/server/mappers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Publik (magic token) — TANPA ensureSeed: data harus sudah ada milik owner
    const token = request.nextUrl.searchParams.get("token")?.trim();
    if (!token) {
      return NextResponse.json({ error: "Parameter ?token= wajib diisi." }, { status: 400 });
    }

    const tenant = await db.tenant.findUnique({
      where: { portalToken: token },
      include: { room: { include: { property: true } } },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Token portal tidak dikenali." }, { status: 404 });
    }

    // Isolasi: properti diambil dari properti kamar penyewa (bukan properti
    // global pertama) agar rekening/QRIS yang tampil selalu milik owner kamar tsb.
    // Filter pengumuman sesuai struktur sinkron:
    //   property_id = properti penyewa  DAN  (target = ALL ATAU target_tenant_id = penyewa ini)
    // Target lantai (targetFloor) tetap difilter di klien — kamar penyewa sudah
    // dikirim bersama respons.
    const [invoices, property, announcements] = await Promise.all([
      db.invoice.findMany({
        where: { roomId: tenant.roomId },
        include: { lines: { orderBy: { id: "asc" } } },
        orderBy: [{ periodKey: "desc" }, { id: "asc" }],
      }),
      Promise.resolve(tenant.room.property),
      // Banner pengumuman properti — dulu hanya mirror localStorage owner
      // (tak pernah tampil di perangkat penyewa), kini cloud-first
      db.announcement.findMany({
        where: {
          propertyId: tenant.room.propertyId,
          OR: [{ targetTenantId: null }, { targetTenantId: tenant.id }],
        },
        orderBy: [{ createdAtSort: "desc" }, { id: "desc" }],
      }),
    ]);
    if (!property) {
      return NextResponse.json(
        { error: "Properti untuk token portal ini tidak ditemukan." },
        { status: 404 },
      );
    }

    const roomWithTenant = { ...tenant.room, tenant, invoices };
    return NextResponse.json(
      {
        room: toClientRoom(roomWithTenant),
        invoices: invoices.map((i) => toClientInvoice(i, tenant.room.nomor ?? tenant.roomId)),
        propertyName: property.name,
        // Banner pengumuman aktif — penyewa melihat yang sama di perangkat mana pun
        announcements: announcements.map(toClientAnnouncement),
        // Sesi demo (properti seed DEMO_OWNER_ID) hidup pada tanggal snapshot
        // dataset (ANNOUNCEMENT_TODAY_ISO) — halaman portal memakai flag ini
        // untuk memilih "hari ini" yang konsisten dgn panel admin demo.
        demo: property.ownerId === DEMO_OWNER_ID,
        // Rekening & QRIS statis owner — kartu pembayaran portal (Transfer Bank /
        // Scan QRIS). Null-aman: field opsional di model Property.
        rekening: {
          bank: property.bankName ?? "BCA",
          noRek: property.bankAccountNo ?? "",
          atasNama: property.bankAccountName ?? property.name,
          qrisImageUrl: property.qrisImageUrl ?? undefined,
          qrisNmid: property.qrisNmid ?? undefined,
        },
      },
      {
        // Portal penyewa harus SELALU segar — pengumuman/tagihan baru yang
        // dipasang owner tampil tanpa clear cache browser (no-store di semua
        // level: browser, service worker, CDN).
        headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" },
      },
    );
  } catch (err) {
    console.error("[api/portal GET]", err);
    return NextResponse.json(
      { error: "Gagal memuat data portal penyewa." },
      { status: 500 },
    );
  }
}
