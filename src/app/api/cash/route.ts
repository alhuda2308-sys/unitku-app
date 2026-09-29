// ─────────────────────────────────────────────────────────────────────────────
// /api/cash — Buku Kas pemasukan & pengeluaran (Supabase)
//
// GET    : riwayat transaksi kas (terbaru dulu)
// POST   : catat transaksi baru — id "KX-xxx" & dateSort dihitung server
// PATCH  : edit transaksi pengeluaran manual (kategori/nominal/tanggal/sumber/nota)
// DELETE : hapus catatan (?id=…) — aksi "Hapus Catatan" pemilik
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { ensureSeed, nextCashId } from "@/lib/server/seed";
import { toClientCashEntry } from "@/lib/server/mappers";
import { dateSortFromLabel, CASH_SOURCES, type CashType } from "@/lib/kost-cashflow";
import { parseDateLabel } from "@/lib/kost-data";

export const dynamic = "force-dynamic";

/** Validasi sumber dana — default "Kas Tunai" */
function normalizeSource(input: unknown): string {
  if (typeof input === "string") {
    const found = CASH_SOURCES.find((s) => s === input.trim());
    if (found) return found;
  }
  return "Kas Tunai";
}

interface CashInput {
  type: CashType;
  category: string;
  description: string;
  amount: number;
  source: string;
  dateLabel: string;
  attachment: string | null;
}

function parseCashBody(
  body: Record<string, unknown>,
): { data: CashInput } | { error: string } {
  const type: CashType = body.type === "keluar" ? "keluar" : "masuk";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const amount = Number(body.amount);
  const dateLabel = typeof body.dateLabel === "string" ? body.dateLabel.trim() : "";

  if (!category || !dateLabel || !Number.isFinite(amount) || amount <= 0) {
    return { error: "Kategori, tanggal, dan nominal (positif) wajib diisi." };
  }

  return {
    data: {
      type,
      category,
      description: typeof body.description === "string" ? body.description.trim() : "",
      amount: Math.round(amount),
      source: normalizeSource(body.source),
      dateLabel,
      attachment:
        typeof body.attachment === "string" && body.attachment.trim() ? body.attachment : null,
    },
  };
}

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
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseCashBody(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const d = parsed.data;

    const entry = await db.cashEntry.create({
      data: {
        id: await nextCashId(d.type),
        type: d.type,
        category: d.category,
        description: d.description,
        amount: d.amount,
        source: d.source,
        entryDate: parseDateLabel(d.dateLabel),
        dateLabel: d.dateLabel,
        dateSort: dateSortFromLabel(d.dateLabel),
        attachment: d.attachment,
      },
    });
    return NextResponse.json({ entry: toClientCashEntry(entry) }, { status: 201 });
  } catch (err) {
    console.error("[api/cash POST]", err);
    return NextResponse.json({ error: "Gagal mencatat transaksi kas." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureSeed();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "Parameter id transaksi wajib diisi." }, { status: 400 });
    }

    // PATCH parsial — hanya field yang dikirim yang diubah (mode edit pengeluaran manual)
    const patch: Partial<CashInput> = {};
    if (body.category !== undefined) {
      const category = typeof body.category === "string" ? body.category.trim() : "";
      if (!category) return NextResponse.json({ error: "Kategori wajib diisi." }, { status: 400 });
      patch.category = category;
    }
    if (body.description !== undefined) {
      patch.description = typeof body.description === "string" ? body.description.trim() : "";
    }
    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "Nominal harus angka positif." }, { status: 400 });
      }
      patch.amount = Math.round(amount);
    }
    if (body.source !== undefined) patch.source = normalizeSource(body.source);
    if (body.dateLabel !== undefined) {
      const dateLabel = typeof body.dateLabel === "string" ? body.dateLabel.trim() : "";
      if (!dateLabel) return NextResponse.json({ error: "Tanggal wajib diisi." }, { status: 400 });
      patch.dateLabel = dateLabel;
    }
    if (body.attachment !== undefined) {
      patch.attachment =
        typeof body.attachment === "string" && body.attachment.trim() ? body.attachment : null;
    }

    try {
      const entry = await db.$transaction(async (tx) => {
        const updated = await tx.cashEntry.update({
          where: { id },
          data: {
            ...(patch.category !== undefined ? { category: patch.category } : {}),
            ...(patch.description !== undefined ? { description: patch.description } : {}),
            ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
            ...(patch.source !== undefined ? { source: patch.source } : {}),
            ...(patch.dateLabel !== undefined
              ? {
                  dateLabel: patch.dateLabel,
                  dateSort: dateSortFromLabel(patch.dateLabel),
                  entryDate: parseDateLabel(patch.dateLabel),
                }
              : {}),
            ...(patch.attachment !== undefined ? { attachment: patch.attachment } : {}),
          },
        });
        return updated;
      });
      return NextResponse.json({ entry: toClientCashEntry(entry) });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
      }
      throw err;
    }
  } catch (err) {
    console.error("[api/cash PATCH]", err);
    return NextResponse.json({ error: "Gagal memperbarui transaksi kas." }, { status: 500 });
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
