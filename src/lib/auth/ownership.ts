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
import { SEED_PROPERTY_ID } from "@/lib/server/seed";
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

/** Baris properti + jumlah kamar (untuk pemilihan properti aktif & switcher) */
export type PropertyWithRoomCount = Property & { _count: { rooms: number } };

/** Daftar SELURUH properti milik owner + jumlah kamar (urutan dibuat) */
export async function getOwnedPropertiesWithRoomCounts(
  user: AuthUser,
): Promise<PropertyWithRoomCount[]> {
  return db.property.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { rooms: true } } },
  });
}

/**
 * Pilih properti AKTIF default dari daftar milik owner (pure, tanpa query):
 *   1. Utamakan properti utama berdata — id seed "kgp" ("Kost Griya Pratama")
 *      BILA milik owner ini dan punya kamar.
 *   2. Lalu properti dengan kamar TERBANYAK (data asli pengguna).
 *   3. Fallback terakhir: properti pertama dibuat (perilaku lama).
 * Menjamin dashboard tidak menunjuk properti kosong hasil onboarding ketika
 * data asli pemilik berada di properti lain.
 */
export function pickDefaultActiveProperty<T extends { id: string; createdAt: Date; _count: { rooms: number } }>(
  rows: T[],
): T | null {
  if (rows.length === 0) return null;
  const preferred = rows.find((p) => p.id === SEED_PROPERTY_ID) ?? null;
  if (preferred && preferred._count.rooms > 0) return preferred;
  const best = [...rows].sort(
    (a, b) =>
      b._count.rooms - a._count.rooms || a.createdAt.getTime() - b.createdAt.getTime(),
  )[0]!;
  return best._count.rooms > 0 ? best : (preferred ?? rows[0]!);
}

/** Properti aktif owner — DEFAULT CERDAS (lihat pickDefaultActiveProperty) */
export async function getActiveOwnedProperty(user: AuthUser): Promise<Property | null> {
  const rows = await getOwnedPropertiesWithRoomCounts(user);
  return pickDefaultActiveProperty(rows);
}

/** Properti aktif owner — melempar Response 400 bila belum onboarding */
export async function requireActiveProperty(user: AuthUser): Promise<Property> {
  const property = await getActiveOwnedProperty(user);
  if (!property) throw noProperty();
  return property;
}

/**
 * Scope daftar id properti untuk GET — isolasi multi-cabang:
 * `requested` diisi & milik owner → [id] (hanya cabang yang dikelola);
 * kosong → seluruh properti owner (perilaku lama); bukan milik owner → 404.
 */
export async function resolveOwnedPropertyScope(
  user: AuthUser,
  requested: string | null,
): Promise<string[] | NextResponse> {
  const ownedIds = await getOwnedPropertyIds(user);
  if (!requested) return ownedIds;
  if (!ownedIds.includes(requested)) return notOwned("Properti tidak ditemukan.");
  return [requested];
}

/**
 * Scope daftar id properti untuk GET — versi TOLERAN anti-mode-offline:
 *   • `requested` kosong → seluruh properti owner (perilaku lama);
 *   • `requested` milik owner → [id] (hanya cabang yang dikelola);
 *   • `requested` TIDAK dikenal / bukan milik owner (localStorage basi,
 *     properti sudah dihapus, perangkat berganti akun) → fallback SENYAP ke
 *     seluruh properti owner — fetch tetap 200, dashboard TIDAK jatuh ke mode
 *     offline hanya karena id aktif tersimpan tidak valid lagi.
 * Isolasi tetap terjaga: fallback dibatasi pada properti milik owner sesi.
 * (Mutasi tetap memakai resolveOwnedPropertyOverride yang strict 404.)
 */
export async function resolveOwnedPropertyScopeLenient(
  user: AuthUser,
  requested: string | null,
): Promise<string[]> {
  const ownedIds = await getOwnedPropertyIds(user);
  if (!requested) return ownedIds;
  if (ownedIds.includes(requested)) return [requested];
  console.warn(
    `[UnitKu] propertyId "${requested.slice(0, 120)}" tidak dikenal/bukan milik owner sesi — fallback ke seluruh properti owner (${ownedIds.length}).`,
  );
  return ownedIds;
}

/**
 * Properti TUJUAN operasi tulis (POST) dari permintaan klien — isolasi
 * multi-cabang: klien mengirim id properti yang SEDANG dikelola (switcher
 * sidebar); server memvalidasi kepemilikan sebelum memakainya.
 * Tidak dikirim → kembali ke properti aktif default (perilaku lama).
 * Bukan milik owner → Response 404 (sengaja 404, jangan bocorkan keberadaan).
 * Belum onboarding → null (caller menjawab 400).
 */
export async function resolveOwnedPropertyOverride(
  user: AuthUser,
  requested: unknown,
): Promise<Property | NextResponse | null> {
  const id = typeof requested === "string" ? requested.trim() : "";
  if (!id) return await getActiveOwnedProperty(user);
  const ownedIds = await getOwnedPropertyIds(user);
  if (!ownedIds.includes(id)) return notOwned("Properti tidak ditemukan.");
  const property = await db.property.findUnique({ where: { id } });
  return property ?? notOwned("Properti tidak ditemukan.");
}

/** Pastikan propertyId milik owner — kembalikan true/false */
export function ownsProperty(propertyId: string, ownedIds: string[]): boolean {
  return ownedIds.includes(propertyId);
}
