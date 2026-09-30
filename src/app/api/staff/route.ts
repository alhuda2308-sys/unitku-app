// ─────────────────────────────────────────────────────────────────────────────
// /api/staff — akses staf mandiri (tabel staff_members, Supabase)
//
// GET tanpa parameter        : daftar seluruh staf (untuk Owner — termasuk PIN)
// GET ?token=…               : verifikasi tautan → valid | revoked | invalid
//                              (identitas dikirim TANPA PIN)
// GET ?token=…&pin=…         : verifikasi token + PIN 6 digit (portal /staff)
//                              → { verified: true, member } bila cocok & aktif
// POST                       : buat staf baru + generate token akses ("stk_…")
//                              + simpan PIN 6 digit
// PATCH                      : ubah status aktif / cabut akses ({ id, isActive })
// DELETE ?id=…               : hapus permanen data staf
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { ensureSeedForUser } from "@/lib/server/seed";
import { toClientStaff, toClientStaffSafe } from "@/lib/server/mappers";
import { getAuthUser } from "@/lib/auth/server";
import {
  getActiveOwnedProperty,
  getOwnedPropertyIds,
  notOwned,
  unauthorized,
} from "@/lib/auth/ownership";

export const dynamic = "force-dynamic";

function generateAccessToken(): string {
  return `stk_${randomBytes(16).toString("hex")}`;
}

function isValidPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{6}$/.test(pin.trim());
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const token = params.get("token")?.trim();
    const pin = params.get("pin")?.trim();

    // Verifikasi token (+PIN bila disertakan) — PUBLIK, dipakai portal /staff
    if (token) {
      const member = await db.staffMember.findUnique({ where: { accessToken: token } });
      if (!member) {
        return NextResponse.json({ status: "invalid" });
      }
      if (!member.isActive) {
        return NextResponse.json({ status: "revoked", member: toClientStaffSafe(member) });
      }
      if (pin === null) {
        // Token valid — layar kunci PIN berikutnya (PIN tidak dikirim)
        return NextResponse.json({ status: "valid", member: toClientStaffSafe(member) });
      }
      // Verifikasi PIN 6 digit
      const verified = isValidPin(pin) && member.accessPin === pin;
      return NextResponse.json({
        status: "valid",
        verified,
        // Identitas dikirim untuk sesi; PIN TIDAK pernah dikirim balik ke klien
        member: toClientStaffSafe(member),
      });
    }

    // Daftar staf untuk owner — isolasi multi-tenant (milik properti owner)
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const staff = await db.staffMember.findMany({
      where: { property: { ownerId: user.id } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ staff: staff.map(toClientStaff) });
  } catch (err) {
    console.error("[api/staff GET]", err);
    return NextResponse.json({ error: "Gagal memuat data staf." }, { status: 500 });
  }
}

// ── POST (buat staf baru) ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      phone?: unknown;
      role?: unknown;
      propertyId?: unknown;
      accessPin?: unknown;
    };

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const role =
      body.role === "ADMIN_OPERASIONAL" || body.role === "PENJAGA_TEKNISI"
        ? body.role
        : "PENJAGA_TEKNISI";

    // Isolasi: staf WAJIB terikat properti milik owner (bukan "semua cabang"
    // lintas owner) — default ke properti aktif bila tidak dikirim/dikenal
    const ownedIds = await getOwnedPropertyIds(user);
    const requested =
      typeof body.propertyId === "string" && ownedIds.includes(body.propertyId)
        ? body.propertyId
        : null;
    const propertyId = requested ?? (await getActiveOwnedProperty(user))?.id ?? null;
    if (!propertyId) {
      return NextResponse.json(
        { error: "Properti belum terdaftar — lengkapi onboarding terlebih dahulu." },
        { status: 400 },
      );
    }

    if (name.length < 3) {
      return NextResponse.json({ error: "Nama staf minimal 3 karakter." }, { status: 400 });
    }
    if (!isValidPin(body.accessPin)) {
      return NextResponse.json({ error: "PIN harus tepat 6 digit angka." }, { status: 400 });
    }

    const member = await db.staffMember.create({
      data: {
        name,
        phone,
        role,
        propertyId,
        accessPin: body.accessPin.trim(),
        accessToken: generateAccessToken(),
        isActive: true,
      },
    });
    return NextResponse.json({ member: toClientStaff(member) }, { status: 201 });
  } catch (err) {
    console.error("[api/staff POST]", err);
    return NextResponse.json({ error: "Gagal membuat staf baru." }, { status: 500 });
  }
}

// ── PATCH (aktifkan / cabut akses) ───────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
      isActive?: unknown;
      accessPin?: unknown;
    };
    if (typeof body.id !== "string") {
      return NextResponse.json({ error: "Parameter id staf wajib diisi." }, { status: 400 });
    }
    const data: Prisma.StaffMemberUpdateInput = {};
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (isValidPin(body.accessPin)) data.accessPin = body.accessPin.trim();
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
    }
    // Isolasi: staf milik owner lain → 404
    const owned = await db.staffMember.findFirst({
      where: { id: body.id, property: { ownerId: user.id } },
      select: { id: true },
    });
    if (!owned) return notOwned("Staf tidak ditemukan.");
    const member = await db.staffMember.update({ where: { id: body.id }, data });
    return NextResponse.json({ member: toClientStaff(member) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Staf tidak ditemukan." }, { status: 404 });
    }
    console.error("[api/staff PATCH]", err);
    return NextResponse.json({ error: "Gagal memperbarui staf." }, { status: 500 });
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Parameter ?id= staf wajib diisi." }, { status: 400 });
    }
    // Isolasi: staf milik owner lain → 404
    const owned = await db.staffMember.findFirst({
      where: { id, property: { ownerId: user.id } },
      select: { id: true },
    });
    if (!owned) return notOwned("Staf tidak ditemukan.");
    await db.staffMember.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Staf tidak ditemukan." }, { status: 404 });
    }
    console.error("[api/staff DELETE]", err);
    return NextResponse.json({ error: "Gagal menghapus staf." }, { status: 500 });
  }
}
