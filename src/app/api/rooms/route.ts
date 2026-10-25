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
// ANTI-500 (fail-open — HANYA GET): seluruh pemanggilan database pada GET
// dibungkus try...catch. Bila kredensial database tidak terbaca atau query
// gagal, handler mengembalikan 200 { success: true, data: [] } — BUKAN 500 —
// agar bootstrap dashboard tidak langsung jatuh ke mode offline fatal. Detail
// penyebab selalu dicetak ke log server.
//
// MUTASI (POST/PATCH/DELETE) TIDAK PERNAH fail-open: kegagalan insert/update/
// delete WAJIB terlihat oleh pengguna — server mencetak console.error(
// "Gagal insert kamar:", error ) dan mengembalikan 500 { success: false,
// error: error.message } agar toast dashboard menampilkan penyebab PASTI
// (bukan sukses palsu "0 kamar baru ditambahkan").
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { Prisma, type Property } from "@prisma/client";
import { db } from "@/lib/prisma";
import { ensureSeedForUser } from "@/lib/server/seed";
import { toClientRoom } from "@/lib/server/mappers";
import { syncContractOverdueStatuses } from "@/lib/server/room-status-sync";
import { getAuthUser } from "@/lib/auth/server";
import type { AuthUser } from "@/lib/auth/server";
import {
  getActiveOwnedProperty,
  getOwnedPropertyIds,
  notOwned,
  resolveOwnedPropertyScopeLenient,
  unauthorized,
} from "@/lib/auth/ownership";
import { PROPERTY_TYPES } from "@/lib/app-settings";
import { sanitizeRoomNomor } from "@/lib/server/room-nomor";
import type { OperationalStatus } from "@/lib/kost-data";

/**
 * Scope mutasi (PATCH/DELETE) — id yang tidak dikenal/bukan milik owner tetap
 * ditolak 404 (fail-loud). GET memakai resolveOwnedPropertyScopeLenient agar
 * localStorage basi tidak menjatuhkan dashboard ke mode offline.
 */
async function resolvePropertyScope(
  user: AuthUser,
  requested: string | null,
): Promise<string[] | NextResponse> {
  const ownedIds = await getOwnedPropertyIds(user);
  if (!requested) return ownedIds;
  if (!ownedIds.includes(requested)) return notOwned("Properti tidak ditemukan.");
  return [requested];
}

export const dynamic = "force-dynamic";

const ROOM_INCLUDE = {
  tenant: true,
  invoices: { orderBy: { periodKey: "desc" as const }, take: 1 },
} satisfies Prisma.RoomInclude;

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    // Scope opsional ?propertyId= — switcher properti dashboard memuat ulang
    // kamar SESUAI cabang aktif; tanpa param = perilaku lama (semua properti).
    // LENIENT: id basi/tidak dikenal → fallback seluruh properti owner (200) —
    // daftar kamar KOSONG karena properti baru pun tetap 200, bukan mode offline.
    const scope = await resolveOwnedPropertyScopeLenient(
      user,
      request.nextUrl.searchParams.get("propertyId")?.trim() || null,
    );
    const rooms = await db.room.findMany({
      where: { propertyId: { in: scope } },
      include: ROOM_INCLUDE,
      orderBy: [{ floor: "asc" }, { id: "asc" }],
    });
    // Sinkronisasi otomatis status kontrak: "lunas" + masa habis kontrak lewat
    // + belum ada pembayaran tagihan baru → "jatuhTempo" (kuning) / "menunggak"
    // (merah) — badge & tab filter denah akurat tanpa input manual.
    const synced = await syncContractOverdueStatuses(rooms);
    return NextResponse.json({ success: true, rooms: synced.map(toClientRoom) });
  } catch (err) {
    // HANYA GET yang fail-open: bootstrap dashboard memperlakukan kegagalan
    // muat awal sebagai mode offline fatal. Fail-open 200 dgn data kosong;
    // UI tetap hidup & otomatis sinkron ulang saat DB pulih.
    console.error("Detail error API invoices/rooms:", err);
    return NextResponse.json({ success: true, data: [], rooms: [] });
  }
}

// ── POST (tambah kamar) ──────────────────────────────────────────────────────

interface IncomingRoom {
  id?: unknown; // nomor/nama kamar yang diketik pengguna — disanitasi suffix "(n)"
  floor?: unknown;
  type?: unknown;
  price?: unknown;
  facilities?: unknown;
  operational?: unknown;
}

function normalizeRoomInput(raw: IncomingRoom) {
  // Nomor kamar MURNI — suffix otomatis "(n)" tidak pernah masuk database
  const nomor = typeof raw.id === "string" ? sanitizeRoomNomor(raw.id) : "";
  if (!nomor) return null;
  const operational =
    raw.operational === "perbaikan" || raw.operational === "nonaktif" || raw.operational === "siap"
      ? (raw.operational as OperationalStatus)
      : "siap";
  return {
    nomor,
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

/**
 * Pesan duplikat nomor kamar — unik PER PROPERTI (data antar cabang terisolasi
 * oleh property_id), nomor milik properti lain tidak pernah memblokir.
 */
function duplicateNomorResponse(nomor: string): NextResponse {
  return NextResponse.json(
    { error: `Nomor kamar "${nomor}" sudah dipakai di properti ini — gunakan nomor lain.` },
    { status: 409 },
  );
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const body = (await request.json().catch(() => ({}))) as {
      rooms?: IncomingRoom[];
      propertyId?: unknown;
      propertyName?: unknown;
      propertyTipe?: unknown;
    };
    // Kamar baru masuk ke properti AKTIF yang sedang dikelola. Bila klien
    // mengirim propertyId (cabang terpilih di switcher), PASTIKAN baris
    // properti itu benar-benar ada di tabel `properties` DULU — bila belum
    // terdaftar (mis. dibuat hanya di sisi klien), buat barisnya SEKARANG
    // supaya insert ke `rooms` tidak pernah gagal foreign key constraint.
    // Tanpa propertyId → properti aktif default cerdas (utamakan yang berdata).
    const requestedId =
      typeof body.propertyId === "string" ? body.propertyId.trim().slice(0, 120) : "";
    const propertyName =
      typeof body.propertyName === "string" ? body.propertyName.trim().slice(0, 80) : "";
    const tipeRaw = typeof body.propertyTipe === "string" ? body.propertyTipe.trim() : "";
    let target: Property | null = null;
    if (requestedId) {
      const found = await db.property.findUnique({ where: { id: requestedId } });
      if (found) {
        // Isolasi multi-tenant: properti milik owner lain tetap 404 (tak bocor)
        if (found.ownerId !== user.id) return notOwned("Properti tidak ditemukan.");
        target = found;
      } else {
        // AUTO-PROVISION — properti aktif klien belum ada di tabel `properties`:
        // buat barisnya milik owner ini (nama dari klien bila dikirim) agar FK
        // ke tabel `rooms` terpenuhi dan kamar langsung bisa disimpan.
        try {
          target = await db.property.create({
            data: {
              id: requestedId,
              ownerId: user.id,
              name: propertyName || requestedId,
              tipe: (PROPERTY_TYPES as readonly string[]).includes(tipeRaw) ? tipeRaw : "kost",
            },
          });
        } catch (err) {
          // Race serverless: instance lain baru saja membuat id yang sama.
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            const race = await db.property.findUnique({ where: { id: requestedId } });
            if (race && race.ownerId === user.id) target = race;
            else return notOwned("Properti tidak ditemukan.");
          } else {
            throw err;
          }
        }
      }
    } else {
      target = await getActiveOwnedProperty(user);
    }
    if (!target) {
      return NextResponse.json(
        { error: "Properti belum terdaftar — lengkapi onboarding terlebih dahulu." },
        { status: 400 },
      );
    }
    const inputs = Array.isArray(body.rooms) ? body.rooms : [];
    if (inputs.length === 0) {
      return NextResponse.json({ error: "Data kamar baru tidak ditemukan." }, { status: 400 });
    }

    const data = inputs.map(normalizeRoomInput);
    if (data.some((d) => d === null)) {
      return NextResponse.json({ error: "Nomor/label kamar wajib diisi." }, { status: 400 });
    }

    const created: Prisma.RoomGetPayload<{ include: typeof ROOM_INCLUDE }>[] = [];
    // Nomor yang sudah diputuskan untuk batch ini — unik PER PROPERTI
    const reservedNomors = new Set<string>();

    for (const item of data) {
      const nomor = item!.nomor;
      // VALIDASI MURNI PER PROPERTI — nomor kamar properti LAIN tidak pernah
      // memblokir dan TIDAK ADA penamaan otomatis "(2)"/"(3)".
      if (reservedNomors.has(nomor)) return duplicateNomorResponse(nomor);
      const dupInProperty = await db.room.findFirst({
        where: { propertyId: target.id, nomor },
        select: { id: true },
      });
      if (dupInProperty) return duplicateNomorResponse(nomor);
      reservedNomors.add(nomor);

      // id (kunci internal stabil): pakai nomornya langsung bila bebas GLOBAL
      // (kompatibel data lama); bila sudah dipakai kamar properti LAIN, kunci
      // komposit "propertyId::nomor" — dijamin unik lintas properti tanpa
      // mengubah nomor tampilan. Nomor tetap murni "A-1", bukan "A-1 (2)".
      let roomId = nomor;
      const globalClash = await db.room.findUnique({
        where: { id: roomId },
        select: { propertyId: true },
      });
      if (globalClash) {
        if (globalClash.propertyId === target.id) return duplicateNomorResponse(nomor);
        roomId = `${target.id}::${nomor}`;
      }

      try {
        const room = await db.room.create({
          // Kolom insert mengikuti skema Prisma (peta @@map("rooms")) — sama
          // persis dgn kolom yang dipakai GET, sehingga konsisten dgn tabel
          // Supabase yang dibuat via prisma db push.
          data: {
            floor: item!.floor,
            type: item!.type,
            price: item!.price,
            facilities: item!.facilities,
            operational: item!.operational,
            id: roomId,
            nomor,
            propertyId: target.id,
          },
          include: ROOM_INCLUDE,
        });
        created.push(room);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          // Race serverless: kunci diambil request paralel setelah pre-check.
          // Bila kandidat "nomor polos" yang kalah race → pakai kunci komposit
          // (unik per properti, tanpa penamaan otomatis). Bila komposit yang
          // tabrakan → benar-benar duplikat di properti ini → 409.
          if (roomId === nomor) {
            try {
              const room = await db.room.create({
                data: {
                  floor: item!.floor,
                  type: item!.type,
                  price: item!.price,
                  facilities: item!.facilities,
                  operational: item!.operational,
                  id: `${target.id}::${nomor}`,
                  nomor,
                  propertyId: target.id,
                },
                include: ROOM_INCLUDE,
              });
              created.push(room);
              continue;
            } catch (retryErr) {
              if (
                retryErr instanceof Prisma.PrismaClientKnownRequestError &&
                retryErr.code === "P2002"
              ) {
                return duplicateNomorResponse(nomor);
              }
              throw retryErr;
            }
          }
          return duplicateNomorResponse(nomor);
        }
        // Error asli (FK, kolom, koneksi) → dilempar ke catch luar agar
        // pengguna melihat penyebab PASTI — tidak pernah sukses palsu.
        throw err;
      }
    }

    return NextResponse.json(
      {
        success: true,
        rooms: created.map(toClientRoom),
      },
      { status: 201 },
    );
  } catch (err) {
    // MUTASI TIDAK PERNAH fail-open: tanpa fallback created: [] berstatus 200.
    // Pesan error asli Supabase/Prisma dikembalikan agar kegagalan terdeteksi.
    console.error("Gagal insert kamar:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Gagal menyimpan kamar ke database — coba lagi sebentar.",
      },
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
  // "id" pada patch = NOMOR/NAMA KAMAR BARU yang diketik pengguna — disanitasi
  // suffix "(n)" dan disimpan ke kolom nomor (kunci internal id TIDAK berubah —
  // relasi tagihan/penghuni/tiket tetap utuh tanpa cascade rename).
  if (typeof raw.id === "string" && raw.id.trim()) data.nomor = sanitizeRoomNomor(raw.id);
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
          select: { id: true, propertyId: true, nomor: true },
        });
        if (!target) return notOwned(`Kamar "${id}" tidak ditemukan.`);
        const data = normalizePatch(patch);
        // Ganti nomor kamar — VALIDASI MURNI PER PROPERTI: bila kamar lain di
        // properti INI sudah memakai nomor itu → 409 (pesan jelas). Nomor milik
        // properti LAIN tidak pernah memblokir & tidak pernah diubah otomatis.
        if (typeof data.nomor === "string") {
          const newNomor = data.nomor;
          if (!newNomor) {
            return NextResponse.json(
              { error: "Nomor kamar tidak valid — gunakan nomor tanpa akhiran dalam kurung." },
              { status: 400 },
            );
          }
          if (newNomor !== target.nomor) {
            const dup = await db.room.findFirst({
              where: { propertyId: target.propertyId, nomor: newNomor, id: { not: target.id } },
              select: { id: true },
            });
            if (dup) return duplicateNomorResponse(newNomor);
          }
        }
        const room = await db.room.update({
          where: { id },
          data,
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
            { error: `Nomor kamar baru sudah dipakai di properti ini — gunakan nomor lain.` },
            { status: 409 },
          );
        }
        throw err;
      }
    }

    return NextResponse.json({
      rooms: updated.map(toClientRoom),
    });
  } catch (err) {
    // MUTASI TIDAK PERNAH fail-open — kegagalan update wajib terlihat.
    console.error("Gagal memperbarui kamar:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Gagal memperbarui kamar di database — coba lagi sebentar.",
      },
      { status: 500 },
    );
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
    // MUTASI TIDAK PERNAH fail-open — tanpa ini klien mengira kamar terhapus
    // padahal masih ada di database.
    console.error("Gagal menghapus kamar:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Gagal menghapus kamar dari database — coba lagi sebentar.",
      },
      { status: 500 },
    );
  }
}
