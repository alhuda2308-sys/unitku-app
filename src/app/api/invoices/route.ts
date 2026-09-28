// ─────────────────────────────────────────────────────────────────────────────
// /api/invoices — Tagihan & invoice (Supabase)
//
// GET    : seluruh tagihan + rincian (bentuk UI kost-invoices.ts)
// PATCH  : tandai lunas / ubah status ({ id, status: "lunas" }) — kamar ikut
//          disetel "lunas", paidAt & dayOffset diperbarui
// DELETE : batalkan tagihan (?id=…)
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { ensureSeed } from "@/lib/server/seed";
import { toClientInvoice, toClientRoom } from "@/lib/server/mappers";

export const dynamic = "force-dynamic";

const INVOICE_INCLUDE = { lines: { orderBy: { id: "asc" as const } } } satisfies Prisma.InvoiceInclude;

export async function GET() {
  try {
    await ensureSeed();
    const invoices = await db.invoice.findMany({
      include: INVOICE_INCLUDE,
      orderBy: [{ periodKey: "desc" }, { roomId: "asc" }],
    });
    return NextResponse.json({ invoices: invoices.map(toClientInvoice) });
  } catch (err) {
    console.error("[api/invoices GET]", err);
    return NextResponse.json({ error: "Gagal memuat daftar tagihan." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureSeed();
    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
      status?: unknown;
    };
    if (typeof body.id !== "string") {
      return NextResponse.json({ error: "Parameter id tagihan wajib diisi." }, { status: 400 });
    }

    const data: Prisma.InvoiceUpdateInput = {};
    if (body.status === "lunas") {
      data.status = "lunas";
      data.paidAt = new Date();
      data.dayOffset = null;
    } else if (body.status === "verifikasi") {
      data.status = "verifikasi";
      data.dayOffset = null;
    } else if (typeof body.status === "string" && body.status) {
      data.status = body.status;
    } else {
      return NextResponse.json({ error: "Status tagihan tidak valid." }, { status: 400 });
    }

    const invoice = await db.invoice.update({
      where: { id: body.id },
      data,
      include: INVOICE_INCLUDE,
    });
    // Kamar ikut disetel lunas agar pill denah konsisten
    const room = await db.room.update({
      where: { id: invoice.roomId },
      data: { status: body.status === "lunas" ? "lunas" : invoice.status },
      include: { tenant: true, invoices: { orderBy: { periodKey: "desc" }, take: 1 } },
    });

    return NextResponse.json({ invoice: toClientInvoice(invoice), room: toClientRoom(room) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Tagihan tidak ditemukan." }, { status: 404 });
    }
    console.error("[api/invoices PATCH]", err);
    return NextResponse.json({ error: "Gagal memperbarui tagihan." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureSeed();
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Parameter ?id= tagihan wajib diisi." }, { status: 400 });
    }
    try {
      await db.invoice.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return NextResponse.json({ error: "Tagihan tidak ditemukan." }, { status: 404 });
      }
      throw err;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/invoices DELETE]", err);
    return NextResponse.json({ error: "Gagal membatalkan tagihan." }, { status: 500 });
  }
}
