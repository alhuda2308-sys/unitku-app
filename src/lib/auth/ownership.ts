// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Helper isolasi data multi-tenant (server-only)
//
// Setiap query Prisma pada endpoint owner WAJIB lolos filter kepemilikan:
//   where: { property: { ownerId: user.id } }          (via relasi)
//   where: { propertyId: { in: ownedPropertyIds } }    (via daftar id)
// Baris tanpa kepemilikan (ownerId/propertyId null — data lama pra-SaaS)
// tidak terlihat oleh owner mana pun; backfill dilakukan via SQL manual.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import type { AuthUser } from "./server";
import type { Property } from "@prisma/client";

/** 401 — tidak ada sesi / sesi kedaluwarsa */
export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Sesi berakhir — silakan masuk kembali." },
    { status: 401 },
  );
}

/** 400 — sesi valid tetapi owner belum menyelesaikan onboarding properti */
export function noProperty(): NextResponse {
  return NextResponse.json(
    { error: "Properti belum terdaftar — lengkapi onboarding terlebih dahulu." },
    { status: 400 },
  );
}

/** 404 — sumber daya bukan milik owner (sengaja 404, jangan 403, agar tak bocor) */
export function notOwned(message = "Data tidak ditemukan."): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

/** Daftar id seluruh properti milik owner */
export async function getOwnedPropertyIds(user: AuthUser): Promise<string[]> {
  const rows = await db.property.findMany({
    where: { ownerId: user.id },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Properti aktif owner (pertama dibuat) — null bila belum onboarding */
export async function getActiveOwnedProperty(user: AuthUser): Promise<Property | null> {
  return db.property.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
  });
}

/** Properti aktif owner — melempar Response 400 bila belum onboarding */
export async function requireActiveProperty(user: AuthUser): Promise<Property> {
  const property = await getActiveOwnedProperty(user);
  if (!property) throw noProperty();
  return property;
}

/** Pastikan propertyId milik owner — kembalikan true/false */
export function ownsProperty(propertyId: string, ownedIds: string[]): boolean {
  return ownedIds.includes(propertyId);
}
