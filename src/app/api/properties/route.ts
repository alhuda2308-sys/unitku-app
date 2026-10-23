// ─────────────────────────────────────────────────────────────────────────────
// /api/properties — properti multi-cabang owner (Supabase)
//
// GET    : properti aktif + SELURUH daftar properti (+ jumlah kamar riil)
// POST   : TAMBAH CABANG BARU — buat baris `properties` milik owner sesi.
//          Produksi: properti baru WAJIB lahir di database agar switcher
//          dashboard memuat data murni miliknya (bukan dataset demo).
// PUT/
// PATCH  : perbarui profil properti — nama, tipe, alamat, foto fasad,
//          rekening pembayaran, QRIS. Tanpa body.id → properti AKTIF
//          (perilaku lama); dengan body.id (milik owner) → cabang tertentu
//          (dipakai tabel "Daftar & Kelola Properti" di Pengaturan).
// DELETE : hapus cabang (?id=) — MURNI milik owner sesi. SELURUH data relasi
//          terkait cabang ini dihapus permanen agar database tetap bersih:
//          kamar → penghuni → tagihan (+rinciannya), pengumuman, tiket, kas,
//          staf, teknisi, fasilitas. Cabang lain TIDAK PERNAH tersentuh
//          (semua deleteMany ter-scope property_id / roomId cabang ini).
//
// Semua mutasi fail-loud: kegagalan database mengembalikan 4xx/5xx dengan
// pesan jelas — tidak pernah sukses palsu.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/prisma";
import { ensureSeedForUser } from "@/lib/server/seed";
import { toClientProperty } from "@/lib/server/mappers";
import { getAuthUser } from "@/lib/auth/server";
import {
  getActiveOwnedProperty,
  getOwnedPropertiesWithRoomCounts,
  notOwned,
  pickDefaultActiveProperty,
  unauthorized,
} from "@/lib/auth/ownership";
import { PROPERTY_TYPES } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

/** Ringkasan properti utk switcher (bentuk sama dgn GET `properties[]`) */
function toSummary(p: {
  id: string;
  name: string;
  tipe: string;
  alamat: string | null;
  fotoUrl: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  qrisImageUrl: string | null;
  qrisNmid: string | null;
  _count?: { rooms: number };
}) {
  return {
    id: p.id,
    name: p.name,
    tipe: p.tipe,
    alamat: p.alamat,
    fotoUrl: p.fotoUrl,
    bankName: p.bankName,
    bankAccountNo: p.bankAccountNo,
    bankAccountName: p.bankAccountName,
    qrisImageUrl: p.qrisImageUrl,
    qrisNmid: p.qrisNmid,
    roomCount: p._count?.rooms ?? 0,
  };
}

/**
 * GET — properti aktif milik owner sesi + SELURUH daftar properti (switcher).
 * `{ property: null }` bila belum onboarding (akun baru) — dipakai guard
 * onboarding di klien; TIDAK lagi melempar 500 saat database kosong.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const rows = await getOwnedPropertiesWithRoomCounts(user);
    // Properti aktif default cerdas — helper bersama dgn endpoint lain
    const active = pickDefaultActiveProperty(rows);
    return NextResponse.json({
      property: active ? toClientProperty(active) : null,
      properties: rows.map(toSummary),
    });
  } catch (err) {
    console.error("[api/properties GET]", err);
    return NextResponse.json(
      { error: "Gagal memuat data properti dari database." },
      { status: 500 },
    );
  }
}

// ── POST — tambah cabang baru (baris `properties` milik owner sesi) ──────────

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
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    const address = typeof body.address === "string" ? body.address.trim().slice(0, 160) : "";
    const photoUrl = typeof body.fotoUrl === "string" ? body.fotoUrl.trim().slice(0, 400_000) : "";
    const tipeRaw = typeof body.tipe === "string" ? body.tipe.trim() : "kost";
    const tipe = (PROPERTY_TYPES as readonly string[]).includes(tipeRaw) ? tipeRaw : "kost";

    if (name.length < 2) {
      return NextResponse.json(
        { error: "Nama properti wajib diisi (2–80 karakter)." },
        { status: 400 },
      );
    }
    // Nama cabang unik per owner — mencegah entri kembar membingungkan switcher
    const duplicate = await db.property.findFirst({
      where: { ownerId: user.id, name: { equals: name } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: `Cabang "${name}" sudah ada di daftar properti Anda.` },
        { status: 409 },
      );
    }

    const created = await db.property.create({
      data: {
        id: await nextPropertyId(),
        ownerId: user.id,
        name,
        tipe,
        alamat: address || null,
        fotoUrl: photoUrl || null,
      },
      include: { _count: { select: { rooms: true } } },
    });
    // Cabang baru LAHIR KOSONG — 0 kamar. Denah akan menampilkan empty state
    // resmi "Belum ada kamar di properti ini" sampai owner menambah kamar.
    return NextResponse.json(
      { property: toClientProperty(created), summary: toSummary(created) },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api/properties POST]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Gagal membuat properti baru — coba lagi sebentar.",
      },
      { status: 500 },
    );
  }
}

// ── PUT/PATCH — perbarui profil properti (aktif ATAU per-id) ─────────────────

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
    // body.id → update cabang TERTENTU milik owner (tabel Kelola Properti);
    // tanpa id → properti aktif default (perilaku lama form Profil Properti).
    const requestedId = typeof body.id === "string" ? body.id.trim() : "";
    const property = requestedId
      ? await db.property.findUnique({ where: { id: requestedId } })
      : await getActiveOwnedProperty(user);
    if (!property || (requestedId && property.ownerId !== user.id)) {
      return notOwned("Properti tidak ditemukan.");
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

// ── DELETE — hapus cabang (ter-scope, anti sentuh cabang lain) ───────────────

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
    if (!id) {
      return NextResponse.json(
        { error: "Parameter ?id= properti wajib diisi." },
        { status: 400 },
      );
    }
    const property = await db.property.findUnique({ where: { id } });
    if (!property || property.ownerId !== user.id) {
      return notOwned("Properti tidak ditemukan.");
    }
    // ── Hapus menyeluruh data relasi cabang ini (database tetap bersih) ──
    // Kamar dihapus eksplisit → penghuni & tagihan (FK Cascade) ikut;
    // dihapus juga eksplisit di sini agar aman bila FK cascade belum terpasang
    // di database produksi (drift skema).
    const roomIds = (
      await db.room.findMany({ where: { propertyId: id }, select: { id: true } })
    ).map((r) => r.id);
    const ownerId = user.id;
    await db.$transaction([
      // Rincian tagihan DULU, baru tagihannya — aman walau FK cascade belum
      // terpasang di database produksi (urutan anak → induk)
      db.invoiceLine.deleteMany({
        where: { invoice: { roomId: { in: roomIds.length > 0 ? roomIds : ["__none__"] } } },
      }),
      // Tagihan — milik kamar cabang ini (safety net eksplisit)
      db.invoice.deleteMany({
        where: roomIds.length > 0 ? { roomId: { in: roomIds } } : { propertyId: id },
      }),
      // Penghuni — milik kamar cabang ini
      db.tenant.deleteMany({
        where: roomIds.length > 0 ? { roomId: { in: roomIds } } : { propertyId: id },
      }),
      // Tiket — ter-scope cabang (propertyId) ATAU menempel kamar cabang ini
      db.ticket.deleteMany({
        where:
          roomIds.length > 0
            ? { OR: [{ propertyId: id }, { roomId: { in: roomIds } }] }
            : { propertyId: id },
      }),
      // Baris terkait cabang lainnya — dibersihkan agar tidak jadi yatim
      db.announcement.deleteMany({ where: { propertyId: id } }),
      db.cashEntry.deleteMany({ where: { propertyId: id } }),
      db.staffMember.deleteMany({ where: { propertyId: id } }),
      db.technicianContact.deleteMany({ where: { propertyId: id } }),
      db.facility.deleteMany({ where: { propertyId: id } }),
      // Kamar cabang ini (penghuni/tagihan sudah bersih di atas)
      db.room.deleteMany({ where: { propertyId: id } }),
      // Terakhir — baris properti itu sendiri
      db.property.delete({ where: { id } }),
    ]);
    // Kepemilikan sudah divalidasi di atas — log audit ringkas
    console.info(
      `[api/properties DELETE] cabang "${property.name}" (${id}) dihapus oleh owner ${ownerId} beserta seluruh data relasinya.`,
    );
    return NextResponse.json({ ok: true, propertyId: id, propertyName: property.name });
  } catch (err) {
    console.error("[api/properties DELETE]", err);
    return NextResponse.json(
      { error: "Gagal menghapus properti dari database." },
      { status: 500 },
    );
  }
}
