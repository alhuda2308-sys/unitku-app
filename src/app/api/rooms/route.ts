// ─────────────────────────────────────────────────────────────────────────────
// /api/rooms — CRUD kamar dengan relasi penghuni & fasilitas (Supabase)
//
// GET    : seluruh kamar + tenant + invoice terbaru (bentuk UI lengkap)
// POST   : tambah kamar baru ({ rooms: [...] } — dukung batch)
// PATCH  : perbarui detail kamar — harga sewa, tipe, lantai, status hunian
//          (operational), fasilitas, ganti nomor ({ id, patch }) atau
//          ({ bulk: [{ id, patch }] }) untuk penetapan tarif massal
// DELETE : hapus kamar (?id=…) — ditolak bila masih ada penghuni aktif
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { ensureSeed } from "@/lib/server/seed";
import { getActiveProperty, toClientRoom } from "@/lib/server/mappers";
import type { OperationalStatus } from "@/lib/kost-data";

export const dynamic = "force-dynamic";

const ROOM_INCLUDE = {
  tenant: true,
  invoices: { orderBy: { periodKey: "desc" as const }, take: 1 },
} satisfies Prisma.RoomInclude;

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    await ensureSeed();
    const rooms = await db.room.findMany({
      include: ROOM_INCLUDE,
      orderBy: [{ floor: "asc" }, { id: "asc" }],
    });
    return NextResponse.json({ rooms: rooms.map(toClientRoom) });
  } catch (err) {
    console.error("[api/rooms GET]", err);
    return NextResponse.json(
      { error: "Gagal memuat data kamar dari database." },
      { status: 500 },
    );
  }
}

// ── POST (tambah kamar) ──────────────────────────────────────────────────────

interface IncomingRoom {
  id?: unknown;
  floor?: unknown;
  type?: unknown;
  price?: unknown;
  facilities?: unknown;
  operational?: unknown;
}

function normalizeRoomInput(raw: IncomingRoom) {
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) return null;
  const operational =
    raw.operational === "perbaikan" || raw.operational === "nonaktif" || raw.operational === "siap"
      ? (raw.operational as OperationalStatus)
      : "siap";
  return {
    id,
    floor: Number.isFinite(Number(raw.floor)) ? Number(raw.floor) : 1,
    type: typeof raw.type === "string" ? raw.type : "",
    price: Number.isFinite(Number(raw.price)) ? Math.max(0, Math.round(Number(raw.price))) : 0,
    facilities: Array.isArray(raw.facilities)
      ? (raw.facilities.filter((f): f is string => typeof f === "string") as unknown as Prisma.InputJsonValue)
      : ([] as unknown as Prisma.InputJsonValue),
    // kolom DB menyimpan null untuk "siap" agar mudah dibedakan
    operational: operational === "siap" ? null : operational,
  };
}

export async function POST(request: NextRequest) {
  try {
    await ensureSeed();
    const property = await getActiveProperty();
    const body = (await request.json().catch(() => ({}))) as { rooms?: IncomingRoom[] };
    const inputs = Array.isArray(body.rooms) ? body.rooms : [];
    if (inputs.length === 0) {
      return NextResponse.json({ error: "Data kamar baru tidak ditemukan." }, { status: 400 });
    }

    const data = inputs.map(normalizeRoomInput);
    if (data.some((d) => d === null)) {
      return NextResponse.json({ error: "Nomor/label kamar wajib diisi." }, { status: 400 });
    }

    const created: Prisma.RoomGetPayload<{ include: typeof ROOM_INCLUDE }>[] = [];
    for (const item of data) {
      try {
        const room = await db.room.create({
          data: { ...item!, propertyId: property.id },
          include: ROOM_INCLUDE,
        });
        created.push(room);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return NextResponse.json(
            { error: `Nomor kamar "${item!.id}" sudah dipakai — gunakan nomor lain.` },
            { status: 409 },
          );
        }
        throw err;
      }
    }

    return NextResponse.json({ rooms: created.map(toClientRoom) }, { status: 201 });
  } catch (err) {
    console.error("[api/rooms POST]", err);
    return NextResponse.json(
      { error: "Gagal menambah kamar ke database." },
      { status: 500 },
    );
  }
}

// ── PATCH (perbarui kamar) ───────────────────────────────────────────────────

interface RoomPatchBody {
  id?: unknown;
  floor?: unknown;
  type?: unknown;
  price?: unknown;
  facilities?: unknown;
  operational?: unknown;
}

function normalizePatch(raw: RoomPatchBody): Prisma.RoomUpdateInput {
  const data: Prisma.RoomUpdateInput = {};
  if (typeof raw.id === "string" && raw.id.trim()) data.id = raw.id.trim();
  if (Number.isFinite(Number(raw.floor))) data.floor = Number(raw.floor);
  if (typeof raw.type === "string") data.type = raw.type;
  if (Number.isFinite(Number(raw.price))) data.price = Math.max(0, Math.round(Number(raw.price)));
  if (Array.isArray(raw.facilities)) {
    data.facilities = raw.facilities.filter(
      (f): f is string => typeof f === "string",
    ) as unknown as Prisma.InputJsonValue;
  }
  if (raw.operational === "siap") data.operational = null;
  else if (raw.operational === "perbaikan" || raw.operational === "nonaktif") {
    data.operational = raw.operational;
  }
  return data;
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureSeed();
    const body = (await request.json().catch(() => ({}))) as
      | { id?: unknown; patch?: RoomPatchBody }
      | { bulk?: { id: unknown; patch: RoomPatchBody }[] };

    const updates: { id: string; patch: RoomPatchBody }[] = [];
    if ("bulk" in body && Array.isArray(body.bulk)) {
      for (const item of body.bulk) {
        if (typeof item?.id === "string") updates.push({ id: item.id, patch: item.patch ?? {} });
      }
    } else if ("id" in body && typeof body.id === "string") {
      updates.push({ id: body.id, patch: body.patch ?? {} });
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "Target kamar tidak ditemukan." }, { status: 400 });
    }

    const updated: Prisma.RoomGetPayload<{ include: typeof ROOM_INCLUDE }>[] = [];
    for (const { id, patch } of updates) {
      try {
        const room = await db.room.update({
          where: { id },
          data: normalizePatch(patch),
          include: { ...ROOM_INCLUDE, invoices: { orderBy: { periodKey: "desc" } } },
        });
        updated.push(room);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return NextResponse.json(
            { error: `Kamar "${id}" tidak ditemukan.` },
            { status: 404 },
          );
        }
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return NextResponse.json(
            { error: `Nomor kamar baru sudah dipakai kamar lain.` },
            { status: 409 },
          );
        }
        throw err;
      }
    }

    return NextResponse.json({ rooms: updated.map(toClientRoom) });
  } catch (err) {
    console.error("[api/rooms PATCH]", err);
    return NextResponse.json(
      { error: "Gagal memperbarui kamar di database." },
      { status: 500 },
    );
  }
}

// ── DELETE (hapus kamar kosong) ──────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    await ensureSeed();
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Parameter ?id= kamar wajib diisi." }, { status: 400 });
    }
    const room = await db.room.findUnique({ where: { id }, include: { tenant: true } });
    if (!room) {
      return NextResponse.json({ error: `Kamar "${id}" tidak ditemukan.` }, { status: 404 });
    }
    if (room.tenant) {
      return NextResponse.json(
        { error: `Kamar ${id} masih dihuni — lakukan check-out penghuni terlebih dahulu.` },
        { status: 409 },
      );
    }
    await db.room.delete({ where: { id } }); // invoice & tiket ikut ter-cascade
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/rooms DELETE]", err);
    return NextResponse.json(
      { error: "Gagal menghapus kamar dari database." },
      { status: 500 },
    );
  }
}
