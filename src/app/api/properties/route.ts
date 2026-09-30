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
import { ensureSeedForUser } from "@/lib/server/seed";
import { toClientProperty } from "@/lib/server/mappers";
import { getAuthUser } from "@/lib/auth/server";
import { getActiveOwnedProperty, unauthorized } from "@/lib/auth/ownership";

export const dynamic = "force-dynamic";

/**
 * GET — properti aktif milik owner sesi.
 * `{ property: null }` bila belum onboarding (akun baru) — dipakai guard
 * onboarding di klien; TIDAK lagi melempar 500 saat database kosong.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const property = await getActiveOwnedProperty(user);
    return NextResponse.json({
      property: property ? toClientProperty(property) : null,
    });
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
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch = pickPatch(body);
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
    }
    const property = await getActiveOwnedProperty(user);
    if (!property) {
      return NextResponse.json(
        { error: "Properti belum terdaftar — lengkapi onboarding terlebih dahulu." },
        { status: 400 },
      );
    }
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
