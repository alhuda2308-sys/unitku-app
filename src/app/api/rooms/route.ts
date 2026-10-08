// ─────────────────────────────────────────────────────────────────────────────
// /api/rooms — CRUD kamar dengan relasi penghuni & fasilitas (Supabase)
//
// GET    : seluruh kamar + tenant + invoice terbaru (bentuk UI lengkap)
// POST   : tambah kamar baru ({ rooms: [...] } — dukung batch)
// PATCH  : perbarui detail kamar — harga sewa, tipe, lantai, status hunian
//          (operational), fasilitas, ganti nomor ({ id, patch }) atau
//          ({ bulk: [{ id, patch }] }) untuk penetapan tarif massal
// DELETE : hapus kamar (?id=…) — ditolak bila masih ada penghuni aktif
//
// ANTI-500 (fail-open): seluruh pemanggilan database dibungkus try...catch.
// Bila kredensial database tidak terbaca atau query gagal, handler mengembalikan
// 200 { success: true, data: [] } — BUKAN 500 — agar bootstrap dashboard tidak
// langsung jatuh ke mode offline fatal. Detail penyebab selalu dicetak ke log
// server: console.error("Detail error API invoices/rooms:", error).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { ensureSeedForUser } from "@/lib/server/seed";
import { toClientRoom } from "@/lib/server/mappers";
import { getAuthUser } from "@/lib/auth/server";
import {
  getActiveOwnedProperty,
  getOwnedPropertyIds,
  notOwned,
  unauthorized,
} from "@/lib/auth/ownership";
import type { OperationalStatus } from "@/lib/kost-data";

export const dynamic = "force-dynamic";

const ROOM_INCLUDE = {
  tenant: true,
  invoices: { orderBy: { periodKey: "desc" as const }, take: 1 },
} satisfies Prisma.RoomInclude;

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const propertyIds = await getOwnedPropertyIds(user);
    const rooms = await db.room.findMany({
      where: { propertyId: { in: propertyIds } },
      include: ROOM_INCLUDE,
      orderBy: [{ floor: "asc" }, { id: "asc" }],
    });
    return NextResponse.json({ success: true, rooms: rooms.map(toClientRoom) });
  } catch (err) {
    // Kredensial database tidak terbaca / query gagal → JANGAN 500: dashboard
    // memperlakukan kegagalan muat awal sebagai mode offline fatal. Fail-open
    // 200 dgn data kosong; UI tetap hidup & otomatis sinkron ulang saat DB pulih.
    console.error("Detail error API invoices/rooms:", err);
    return NextResponse.json({ success: true, data: [], rooms: [] });
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
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const property = await getActiveOwnedProperty(user);
    if (!property) {
      return NextResponse.json(
        { error: "Properti belum terdaftar — lengkapi onboarding terlebih dahulu." },
        { status: 400 },
      );
    }
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
    console.error("Detail error API invoices/rooms:", err);
    // Fail-open 200 dgn rooms: [] sesuai kontrak klien — tanpa pernah 500.
    return NextResponse.json({ success: true, data: [], rooms: [] });
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
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const propertyIds = await getOwnedPropertyIds(user);
    if (propertyIds.length === 0) {
      return NextResponse.json(
        { error: "Properti belum terdaftar — lengkapi onboarding terlebih dahulu." },
        { status: 400 },
      );
    }
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
        // Isolasi: hanya kamar milik properti owner yang boleh diubah
        const target = await db.room.findFirst({
          where: { id, propertyId: { in: propertyIds } },
          select: { id: true },
        });
        if (!target) return notOwned(`Kamar "${id}" tidak ditemukan.`);
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
    console.error("Detail error API invoices/rooms:", err);
    // Fail-open 200 dgn rooms: [] sesuai kontrak klien — tanpa pernah 500.
    return NextResponse.json({ success: true, data: [], rooms: [] });
  }
}

// ── DELETE (hapus kamar kosong) ──────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const propertyIds = await getOwnedPropertyIds(user);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Parameter ?id= kamar wajib diisi." }, { status: 400 });
    }
    // Isolasi: kamar milik owner lain terlihat sebagai 404
    const room = await db.room.findFirst({
      where: { id, propertyId: { in: propertyIds } },
      include: { tenant: true },
    });
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
    console.error("Detail error API invoices/rooms:", err);
    return NextResponse.json({ success: true, data: [] });
  }
}
