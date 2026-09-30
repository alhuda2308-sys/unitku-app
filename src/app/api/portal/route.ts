// ─────────────────────────────────────────────────────────────────────────────
// /api/portal — Portal Penyewa publik (magic token, tanpa login)
//
// GET ?token=… : resolve SATU kamar milik token tersebut + tagihannya + nama
//                properti. Dipakai halaman /portal?token=… agar data pembayaran
//                selalu terkini dari cloud (lintas perangkat, bukan mirror lokal).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { toClientInvoice, toClientRoom } from "@/lib/server/mappers";

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
    const [invoices, property] = await Promise.all([
      db.invoice.findMany({
        where: { roomId: tenant.roomId },
        include: { lines: { orderBy: { id: "asc" } } },
        orderBy: [{ periodKey: "desc" }, { id: "asc" }],
      }),
      Promise.resolve(tenant.room.property),
    ]);
    if (!property) {
      return NextResponse.json(
        { error: "Properti untuk token portal ini tidak ditemukan." },
        { status: 404 },
      );
    }

    const roomWithTenant = { ...tenant.room, tenant, invoices };
    return NextResponse.json({
      room: toClientRoom(roomWithTenant),
      invoices: invoices.map(toClientInvoice),
      propertyName: property.name,
      // Rekening & QRIS statis owner — kartu pembayaran portal (Transfer Bank /
      // Scan QRIS). Null-aman: field opsional di model Property.
      rekening: {
        bank: property.bankName ?? "BCA",
        noRek: property.bankAccountNo ?? "",
        atasNama: property.bankAccountName ?? property.name,
        qrisImageUrl: property.qrisImageUrl ?? undefined,
        qrisNmid: property.qrisNmid ?? undefined,
      },
    });
  } catch (err) {
    console.error("[api/portal GET]", err);
    return NextResponse.json(
      { error: "Gagal memuat data portal penyewa." },
      { status: 500 },
    );
  }
}
