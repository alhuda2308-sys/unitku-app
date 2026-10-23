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
import { ensureSeedForUser, nextCashId } from "@/lib/server/seed";
import { toClientCashEntry } from "@/lib/server/mappers";
import { getAuthUser } from "@/lib/auth/server";
import type { AuthUser } from "@/lib/auth/server";
import {
  getOwnedPropertyIds,
  resolveOwnedPropertyOverride,
  notOwned,
  unauthorized,
} from "@/lib/auth/ownership";
import { dateSortFromLabel, CASH_SOURCES, type CashType } from "@/lib/kost-cashflow";
import { parseDateLabel } from "@/lib/kost-data";

export const dynamic = "force-dynamic";

/**
 * Resolusi scope properti dari query ?propertyId= (isolation multi-tenant) —
 * bila diisi, id WAJIB milik owner; tanpa param → seluruh properti owner.
 */
async function resolvePropertyScope(
  user: AuthUser,
  requested: string | null,
): Promise<string[] | NextResponse> {
  const ownedIds = await getOwnedPropertyIds(user);
  if (!requested) return ownedIds;
  if (!ownedIds.includes(requested)) return notOwned("Properti tidak ditemukan.");
  return [requested];
}

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

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    // Scope opsional ?propertyId= — buku kas dimuat SESUAI cabang aktif di
    // switcher properti; tanpa param = perilaku lama (semua properti owner).
    const scope = await resolvePropertyScope(user, request.nextUrl.searchParams.get("propertyId")?.trim() || null);
    if (scope instanceof NextResponse) return scope;
    const entries = await db.cashEntry.findMany({
      where: { propertyId: { in: scope } },
      orderBy: [{ dateSort: "desc" }, { id: "asc" }],
    });
    return NextResponse.json({ success: true, entries: entries.map(toClientCashEntry) });
  } catch (err) {
    // Fail-open (ANTI-500): GET cash adalah bagian dari Promise.all bootstrap
    // dashboard (rooms + invoices + cash) — satu saja yang 500 membuat seluruh
    // dashboard jatuh ke mode offline fatal. Kredensial DB tidak terbaca / query
    // gagal → 200 dgn data kosong; sinkron ulang otomatis saat database pulih.
    console.error("Detail error API invoices/rooms:", err);
    return NextResponse.json({ success: true, data: [], entries: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    // Isolasi multi-cabang: transaksi kas tercatat milik properti yang SEDANG
    // dikelola (body.propertyId dari switcher, divalidasi kepemilikan); tanpa
    // itu → properti aktif default (perilaku lama).
    const property = await resolveOwnedPropertyOverride(user, body.propertyId);
    if (property instanceof NextResponse) return property;
    if (!property) {
      return NextResponse.json(
        { error: "Properti belum terdaftar — lengkapi onboarding terlebih dahulu." },
        { status: 400 },
      );
    }
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
        // Isolasi multi-tenant — kas tercatat milik properti owner
        propertyId: property.id,
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
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const propertyIds = await getOwnedPropertyIds(user);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "Parameter id transaksi wajib diisi." }, { status: 400 });
    }
    // Isolasi: transaksi milik owner lain → 404
    const owned = await db.cashEntry.findFirst({
      where: { id, propertyId: { in: propertyIds } },
      select: { id: true },
    });
    if (!owned) return notOwned("Transaksi tidak ditemukan.");

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
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const propertyIds = await getOwnedPropertyIds(user);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Parameter ?id= transaksi wajib diisi." }, { status: 400 });
    }
    // Isolasi: transaksi milik owner lain → 404
    const owned = await db.cashEntry.findFirst({
      where: { id, propertyId: { in: propertyIds } },
      select: { id: true },
    });
    if (!owned) return notOwned("Transaksi tidak ditemukan.");
    await db.cashEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/cash DELETE]", err);
    return NextResponse.json({ error: "Gagal menghapus transaksi kas." }, { status: 500 });
  }
}
