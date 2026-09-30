// ─────────────────────────────────────────────────────────────────────────────
// /api/technicians — Kontak Teknisi (Komplain & Pemeliharaan)
//
// GET    : daftar teknisi — on-call utama dulu, lalu terlama dibuat
// POST   : tambah kontak (nama, spesialisasi, no. WA, isPrimary)
// PATCH  : edit kontak — meng-centang isPrimary memindahkan status on-call
// DELETE : hapus kontak — bila yang dihapus on-call utama, kontak terlama
//          lainnya otomatis dipromosikan agar pill On-call tak pernah kosong
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { ensureSeedForUser } from "@/lib/server/seed";
import { validateWaPhone } from "@/lib/technician-data";
import { getAuthUser } from "@/lib/auth/server";
import {
  getActiveOwnedProperty,
  getOwnedPropertyIds,
  notOwned,
  unauthorized,
} from "@/lib/auth/ownership";

export const dynamic = "force-dynamic";

/** Urutan tampil: utama dulu, lalu terlama dibuat (id sbg tiebreaker deterministik) */
const ORDER = [{ isPrimary: "desc" }, { createdAt: "asc" }, { id: "asc" }] as const;

/** Validasi & rapikan payload kontak — kembalikan data bersih atau pesan error */
function normalizeContact(
  body: Record<string, unknown>,
  partial: false,
): { data: Prisma.TechnicianContactUncheckedCreateInput } | { error: string };
function normalizeContact(
  body: Record<string, unknown>,
  partial: true,
): { data: Prisma.TechnicianContactUncheckedUpdateInput } | { error: string };
function normalizeContact(
  body: Record<string, unknown>,
  partial: boolean,
): { data: unknown } | { error: string } {
  const data: Record<string, string | boolean> = {};

  if (!partial || body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2) return { error: "Nama teknisi minimal 2 karakter." };
    if (name.length > 60) return { error: "Nama teknisi maksimal 60 karakter." };
    data.name = name;
  }

  if (!partial || body.phone !== undefined) {
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const phoneError = validateWaPhone(phone);
    if (phoneError) return { error: phoneError };
    data.phone = phone;
  }

  if (!partial || body.specialization !== undefined) {
    const spec = typeof body.specialization === "string" ? body.specialization.trim() : "";
    if (!spec) return { error: "Spesialisasi wajib diisi." };
    if (spec.length > 60) return { error: "Spesialisasi maksimal 60 karakter." };
    data.specialization = spec;
  }

  if (body.isPrimary !== undefined) {
    data.isPrimary = body.isPrimary === true;
  }

  return { data };
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const propertyIds = await getOwnedPropertyIds(user);
    const technicians = await db.technicianContact.findMany({
      where: { propertyId: { in: propertyIds } },
      orderBy: [...ORDER],
    });
    return NextResponse.json({ technicians });
  } catch (err) {
    console.error("[api/technicians GET]", err);
    return NextResponse.json({ error: "Gagal memuat kontak teknisi." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const normalized = normalizeContact(body, false);
    if ("error" in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }
    // Isolasi: kontak teknisi selalu milik properti owner
    const property = await getActiveOwnedProperty(user);
    if (!property) {
      return NextResponse.json(
        { error: "Properti belum terdaftar — lengkapi onboarding terlebih dahulu." },
        { status: 400 },
      );
    }

    const technician = await db.$transaction(async (tx) => {
      // On-call utama baru → status utama kontak lain (dalam properti yg sama) dicabut
      if (normalized.data.isPrimary === true) {
        await tx.technicianContact.updateMany({
          where: { propertyId: property.id },
          data: { isPrimary: false },
        });
      }
      return tx.technicianContact.create({
        data: { ...normalized.data, propertyId: property.id },
      });
    });

    return NextResponse.json({ technician }, { status: 201 });
  } catch (err) {
    console.error("[api/technicians POST]", err);
    return NextResponse.json({ error: "Gagal menyimpan kontak teknisi." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "Parameter id kontak wajib diisi." }, { status: 400 });
    }
    const normalized = normalizeContact(body, true);
    if ("error" in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }
    if (Object.keys(normalized.data).length === 0) {
      return NextResponse.json(
        { error: "Tidak ada perubahan yang dikirim." },
        { status: 400 },
      );
    }
    // Isolasi: hanya kontak milik properti owner yang boleh diubah
    const propertyIds = await getOwnedPropertyIds(user);
    const owned = await db.technicianContact.findFirst({
      where: { id, propertyId: { in: propertyIds } },
      select: { id: true, propertyId: true },
    });
    if (!owned) return notOwned("Kontak teknisi tidak ditemukan.");
    const scopePropertyId = owned.propertyId;

    const technician = await db.$transaction(async (tx) => {
      if (normalized.data.isPrimary === true) {
        await tx.technicianContact.updateMany({
          where: { propertyId: scopePropertyId, id: { not: id } },
          data: { isPrimary: false },
        });
      }
      const updated = await tx.technicianContact.update({ where: { id }, data: normalized.data });

      // Invarian (per properti): selalu ada tepat satu on-call utama bila
      // daftar tak kosong — bila kontak terakhir yang utama dilepas,
      // kontak terlama lain otomatis naik
      const primaryCount = await tx.technicianContact.count({
        where: { propertyId: scopePropertyId, isPrimary: true },
      });
      if (primaryCount === 0) {
        const candidate = await tx.technicianContact.findFirst({
          where: { propertyId: scopePropertyId, id: { not: id } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        if (candidate) {
          return tx.technicianContact.update({
            where: { id: candidate.id },
            data: { isPrimary: true },
          });
        }
      }
      return updated;
    });

    return NextResponse.json({ technician });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Kontak teknisi tidak ditemukan." }, { status: 404 });
    }
    console.error("[api/technicians PATCH]", err);
    return NextResponse.json({ error: "Gagal memperbarui kontak teknisi." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    if (!id) {
      return NextResponse.json({ error: "Parameter id kontak wajib diisi." }, { status: 400 });
    }

    // Isolasi: hanya kontak milik properti owner yang boleh dihapus
    const propertyIds = await getOwnedPropertyIds(user);
    const owned = await db.technicianContact.findFirst({
      where: { id, propertyId: { in: propertyIds } },
      select: { id: true, propertyId: true, isPrimary: true },
    });
    if (!owned) return notOwned("Kontak teknisi tidak ditemukan.");
    const scopePropertyId = owned.propertyId;

    const technician = await db.$transaction(async (tx) => {
      const deleted = await tx.technicianContact.delete({ where: { id } });
      // On-call utama terhapus → promosikan kontak terlama yang tersisa
      // (dalam properti yang sama)
      if (deleted.isPrimary) {
        const next = await tx.technicianContact.findFirst({
          where: { propertyId: scopePropertyId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        if (next) {
          return tx.technicianContact.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
        }
      }
      return deleted;
    });

    return NextResponse.json({ ok: true, technician });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Kontak teknisi tidak ditemukan." }, { status: 404 });
    }
    console.error("[api/technicians DELETE]", err);
    return NextResponse.json({ error: "Gagal menghapus kontak teknisi." }, { status: 500 });
  }
}
