// ─────────────────────────────────────────────────────────────────────────────
// /api/cash — Buku Kas pemasukan & pengeluaran (Supabase)
//
// GET    : riwayat transaksi kas (terbaru dulu)
// POST   : catat transaksi baru — id "KX-xxx" & dateSort dihitung server
// DELETE : hapus catatan (?id=…) — aksi "Hapus Catatan" pemilik
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { ensureSeed, nextCashId } from "@/lib/server/seed";
import { toClientCashEntry } from "@/lib/server/mappers";
import { dateSortFromLabel, type CashType } from "@/lib/kost-cashflow";
import { parseDateLabel } from "@/lib/kost-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeed();
    const entries = await db.cashEntry.findMany({ orderBy: [{ dateSort: "desc" }, { id: "asc" }] });
    return NextResponse.json({ entries: entries.map(toClientCashEntry) });
  } catch (err) {
    console.error("[api/cash GET]", err);
    return NextResponse.json({ error: "Gagal memuat buku kas." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSeed();
    const body = (await request.json().catch(() => ({}))) as {
      type?: unknown;
      category?: unknown;
      description?: unknown;
      amount?: unknown;
      dateLabel?: unknown; // "26 Sep 2026"
      attachment?: unknown;
    };

    const type: CashType = body.type === "keluar" ? "keluar" : "masuk";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const amount = Number(body.amount);
    const dateLabel = typeof body.dateLabel === "string" ? body.dateLabel.trim() : "";

    if (!category || !dateLabel || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Kategori, tanggal, dan nominal (positif) wajib diisi." },
        { status: 400 },
      );
    }

    const entry = await db.cashEntry.create({
      data: {
        id: await nextCashId(),
        type,
        category,
        description: typeof body.description === "string" ? body.description.trim() : "",
        amount: Math.round(amount),
        entryDate: parseDateLabel(dateLabel),
        dateLabel,
        dateSort: dateSortFromLabel(dateLabel),
        attachment: typeof body.attachment === "string" && body.attachment ? body.attachment : null,
      },
    });
    return NextResponse.json({ entry: toClientCashEntry(entry) }, { status: 201 });
  } catch (err) {
    console.error("[api/cash POST]", err);
    return NextResponse.json({ error: "Gagal mencatat transaksi kas." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureSeed();
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Parameter ?id= transaksi wajib diisi." }, { status: 400 });
    }
    try {
      await db.cashEntry.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
      }
      throw err;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/cash DELETE]", err);
    return NextResponse.json({ error: "Gagal menghapus transaksi kas." }, { status: 500 });
  }
}
