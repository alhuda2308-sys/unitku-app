// ─────────────────────────────────────────────────────────────────────────────
// /api/properties — profil properti aktif + rekening pembayaran (Supabase)
//
// GET  : ambil properti aktif (+auto-seed database saat pertama kali)
// PUT/
// PATCH: perbarui profil properti — nama kost, tipe, alamat, foto fasad,
//        dan rekening pembayaran (bankName/bankAccountNo/bankAccountName)
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { ensureSeed } from "@/lib/server/seed";
import { getActiveProperty, toClientProperty } from "@/lib/server/mappers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeed();
    const property = await getActiveProperty();
    return NextResponse.json({ property: toClientProperty(property) });
  } catch (err) {
    console.error("[api/properties GET]", err);
    return NextResponse.json(
      { error: "Gagal memuat data properti dari database." },
      { status: 500 },
    );
  }
}

const STRING_FIELDS = [
  "name",
  "tipe",
  "alamat",
  "fotoUrl",
  "bankName",
  "bankAccountNo",
  "bankAccountName",
  "qrisImageUrl",
  "qrisNmid",
] as const;

type PropertyPatch = Partial<{
  name: string;
  tipe: string;
  alamat: string | null;
  fotoUrl: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  qrisImageUrl: string | null;
  qrisNmid: string | null;
}>;

function pickPatch(body: Record<string, unknown>): PropertyPatch {
  const patch: PropertyPatch = {};
  for (const field of STRING_FIELDS) {
    const value = body[field];
    if (typeof value === "string") {
      const trimmed = value.trim();
      // name & tipe non-nullable di schema — hanya diisi bila string tak kosong
      if (field === "name" || field === "tipe") {
        if (trimmed) patch[field] = trimmed;
      } else {
        patch[field] = trimmed || null;
      }
    } else if (value === null && field !== "name" && field !== "tipe") {
      patch[field] = null;
    }
  }
  return patch;
}

async function handleUpdate(request: NextRequest) {
  try {
    await ensureSeed();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch = pickPatch(body);
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
    }
    const property = await getActiveProperty();
    const updated = await db.property.update({
      where: { id: property.id },
      data: patch,
    });
    return NextResponse.json({ property: toClientProperty(updated) });
  } catch (err) {
    console.error("[api/properties PUT]", err);
    return NextResponse.json(
      { error: "Gagal menyimpan profil properti ke database." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  return handleUpdate(request);
}

export async function PATCH(request: NextRequest) {
  return handleUpdate(request);
}
