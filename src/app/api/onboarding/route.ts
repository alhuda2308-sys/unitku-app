// ─────────────────────────────────────────────────────────────────────────────
// POST /api/onboarding — Onboarding properti pertama (setelah registrasi)
//
// Membuat record Property milik owner + slot kamar awal (01, 02, …) secara
// otomatis, lalu owner diarahkan ke dashboard utama. Ditolak bila owner
// sudah punya properti atau masih dalam sesi demo.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth/server";
import { unauthorized } from "@/lib/auth/ownership";
import { toClientProperty } from "@/lib/server/mappers";

export const dynamic = "force-dynamic";

/** id properti unik — "prop_xxxxxxxx" (retry bila tabrakan) */
async function nextPropertyId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = `prop_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const exists = await db.property.findUnique({ where: { id } });
    if (!exists) return id;
  }
  return `prop_${randomUUID().replace(/-/g, "")}`;
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (user.demo) {
    return NextResponse.json(
      { error: "Mode demo memakai properti contoh — daftar akun untuk membuat properti Anda." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const roomCount = Math.round(Number(body.roomCount));

  if (name.length < 2 || name.length > 80) {
    return NextResponse.json(
      { error: "Nama properti wajib diisi (2–80 karakter)." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(roomCount) || roomCount < 1 || roomCount > 50) {
    return NextResponse.json(
      { error: "Jumlah kamar awal harus angka 1–50." },
      { status: 400 },
    );
  }
  if (address.length > 160) {
    return NextResponse.json(
      { error: "Alamat singkat maksimal 160 karakter." },
      { status: 400 },
    );
  }

  try {
    const existing = await db.property.count({ where: { ownerId: user.id } });
    if (existing > 0) {
      return NextResponse.json(
        { error: "Anda sudah memiliki properti — lanjutkan ke dashboard." },
        { status: 400 },
      );
    }

    const property = await db.property.create({
      data: {
        id: await nextPropertyId(),
        ownerId: user.id,
        name,
        tipe: "kost",
        alamat: address || null,
      },
    });

    // Slot kamar awal — nomor urut "01", "02", … (auto-suffix bila nomor
    // global sudah dipakai properti lain; label kamar unik lintas akun).
    let roomsCreated = 0;
    for (let i = 1; i <= roomCount; i += 1) {
      const base = String(i).padStart(2, "0");
      let roomId = base;
      let seq = 2;
      while (await db.room.findUnique({ where: { id: roomId } })) {
        roomId = `${base}-${seq}`;
        seq += 1;
      }
      try {
        await db.room.create({
          data: {
            id: roomId,
            propertyId: property.id,
            floor: 1,
            type: "",
            price: 0,
            status: "kosong",
            facilities: [],
          },
        });
        roomsCreated += 1;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
        throw err;
      }
    }

    return NextResponse.json(
      { property: toClientProperty(property), roomsCreated },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api/onboarding POST]", err);
    return NextResponse.json(
      { error: "Gagal membuat properti — coba lagi sebentar." },
      { status: 500 },
    );
  }
}
