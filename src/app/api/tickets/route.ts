// ─────────────────────────────────────────────────────────────────────────────
// /api/tickets — Komplain & Pemeliharaan (Supabase)
//
// GET    : daftar tiket (terbaru dulu — reportedSort desc)
// POST   : buat tiket baru — sumber Portal Penyewa (portalToken) atau owner
//          (roomId/reporter eksplisit). Foto dikirim sebagai dataURL hasil
//          kompresi klien (canvas) sehingga bisa dipratinjau lintas perangkat.
// PATCH  : ubah status (menunggu → dikerjakan → selesai) & penugasan teknisi.
// DELETE : hapus tiket permanen (?id=TKT-xxx) — dipanggil dari tombol "Hapus
//          Tiket" (kolom Aksi / kartu mobile) setelah konfirmasi AlertDialog.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { ensureSeedForUser, nextTicketId } from "@/lib/server/seed";
import { toClientTicket } from "@/lib/server/mappers";
import { getAuthUser } from "@/lib/auth/server";
import {
  getOwnedPropertyIds,
  notOwned,
  resolveOwnedPropertyOverride,
  resolveOwnedPropertyScopeLenient,
  unauthorized,
} from "@/lib/auth/ownership";
import {
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  TICKET_URGENSI,
  type TicketCategory,
  type TicketStatus,
  type TicketUrgensi,
} from "@/lib/ticket-data";

export const dynamic = "force-dynamic";

/** Batas aman payload foto (dataURL) — klien mengompres via canvas sebelum kirim */
const MAX_PHOTOS = 3;
const MAX_PHOTO_LENGTH = 1_600_000; // ~1.6 MB per foto (base64)

/** WIB "sekarang" — server berjalan UTC, pelapor memakai Waktu Indonesia Barat */
function wibNow(): Date {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}

/** "Hari ini, 14:05 WIB" — label waktu lapor tiket baru */
function reportedLabelNow(): string {
  const d = wibNow();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `Hari ini, ${hh}:${mm} WIB`;
}

/** Sort monotonic yyyyMMddHHmm (WIB) — dijamin > seluruh sort existing */
async function reportedSortNow(): Promise<bigint> {
  const d = wibNow();
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const nowSort = BigInt(`${y}${mo}${da}${hh}${mi}`);
  const agg = await db.ticket.aggregate({ _max: { reportedSort: true } });
  const maxExisting = agg._max.reportedSort ?? BigInt(0);
  return nowSort > maxExisting ? nowSort : maxExisting + BigInt(1);
}

/** "29 Sep" — label tanggal WIB utk catatan selesai */
function wibDateShort(): string {
  const d = wibNow();
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${d.getUTCDate()} ${bulan[d.getUTCMonth()] ?? ""}`;
}

/** Validasi & normalisasi daftar foto (dataURL / path statis) */
function normalizePhotos(input: unknown): string[] | string {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) return "Foto harus berupa array.";
  const photos = input.filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
  if (photos.length > MAX_PHOTOS) {
    return `Maksimal ${MAX_PHOTOS} foto lampiran.`;
  }
  for (const p of photos) {
    if (p.length > MAX_PHOTO_LENGTH) {
      return "Ukuran foto terlalu besar — coba ambil ulang foto.";
    }
  }
  return photos;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    // Scope opsional ?propertyId= — panel Komplain memuat SESUAI cabang aktif
    // di switcher; tanpa param = perilaku lama (seluruh properti owner).
    // LENIENT: id basi/tidak dikenal → fallback seluruh properti owner (200),
    // bukan 404 — panel tetap hidup saat localStorage basi / properti terhapus.
    const scope = await resolveOwnedPropertyScopeLenient(
      user,
      request.nextUrl.searchParams.get("propertyId")?.trim() || null,
    );
    const tickets = await db.ticket.findMany({
      // Isolasi: tiket terikat properti (kolom propertyId) ATAU via kamar
      // (tiket lama pra-migrasi yang belum di-backfill)
      where: {
        OR: [
          { propertyId: { in: scope } },
          { room: { propertyId: { in: scope } } },
        ],
      },
      orderBy: [{ reportedSort: "desc" }, { id: "desc" }],
    });
    // Label kamar murni (tanpa suffix) — kunci internal rooms.id tidak ditampilkan
    const roomIds = [...new Set(tickets.map((t) => t.roomId).filter((v): v is string => !!v))];
    const nomorById = new Map<string, string>();
    if (roomIds.length > 0) {
      const roomRows = await db.room.findMany({
        where: { id: { in: roomIds } },
        select: { id: true, nomor: true },
      });
      for (const r of roomRows) nomorById.set(r.id, r.nomor);
    }
    return NextResponse.json({
      tickets: tickets.map((t) =>
        toClientTicket(t, t.roomId ? nomorById.get(t.roomId) ?? t.roomId : null),
      ),
    });
  } catch (err) {
    console.error("[api/tickets GET]", err);
    return NextResponse.json({ error: "Gagal memuat tiket komplain." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const kategori = typeof body.kategori === "string" ? body.kategori.trim() : "";
    const deskripsi = typeof body.deskripsi === "string" ? body.deskripsi.trim() : "";
    if (!kategori) {
      return NextResponse.json({ error: "Kategori masalah wajib dipilih." }, { status: 400 });
    }
    if (!TICKET_CATEGORIES.includes(kategori as TicketCategory)) {
      return NextResponse.json({ error: "Kategori masalah tidak dikenal." }, { status: 400 });
    }
    if (deskripsi.length < 3) {
      return NextResponse.json(
        { error: "Catatan keluhan minimal 3 karakter." },
        { status: 400 },
      );
    }
    const photos = normalizePhotos(body.photos);
    if (typeof photos === "string") {
      return NextResponse.json({ error: photos }, { status: 400 });
    }

    const urgensi = (
      TICKET_URGENSI.includes(body.urgensi as TicketUrgensi) ? body.urgensi : "sedang"
    ) as TicketUrgensi;

    // ── Resolusi pelapor: portalToken → roomId → field eksplisit ────────────
    let roomId: string | null = null;
    let lokasi: string | null = null;
    let reporterName = typeof body.reporterName === "string" ? body.reporterName.trim() : "";
    let reporterPhone = typeof body.reporterPhone === "string" ? body.reporterPhone.trim() : "";
    let judul = typeof body.judul === "string" ? body.judul.trim() : "";

    /** Sumber tiket — portal/penyewa (default) atau pemeliharaan fasilitas owner */
    const sumber = body.sumber === "fasilitas" ? "fasilitas" : "penyewa";

    const portalToken = typeof body.portalToken === "string" ? body.portalToken.trim() : "";
    let propertyId: string | null = null;
    if (portalToken) {
      // Cabang PUBLIK (Portal Penyewa — magic token, tanpa sesi owner)
      const tenant = await db.tenant.findFirst({
        where: { portalToken },
        include: { room: { include: { property: true } } },
      });
      if (!tenant) {
        return NextResponse.json(
          { error: "Token portal tidak valid — laporan tidak terkait kamar." },
          { status: 403 },
        );
      }
      roomId = tenant.roomId;
      propertyId = tenant.room.propertyId;
      reporterName = tenant.name;
      reporterPhone = tenant.phone;
      judul = judul || "Laporan via Portal Penyewa";
    } else {
      // Cabang OWNER — wajib sesi + terikat properti miliknya.
      // Isolasi multi-cabang: propertyId dari body (switcher aktif, divalidasi
      // kepemilikan); tanpa itu → properti aktif default (perilaku lama).
      const user = await getAuthUser();
      if (!user) return unauthorized();
      await ensureSeedForUser(user);
      const ownedProperty = await resolveOwnedPropertyOverride(user, body.propertyId);
      if (ownedProperty instanceof NextResponse) return ownedProperty;
      if (!ownedProperty) {
        return NextResponse.json(
          { error: "Properti belum terdaftar — lengkapi onboarding terlebih dahulu." },
          { status: 400 },
        );
      }
      propertyId = ownedProperty.id;
    }

    if (!roomId && typeof body.roomId === "string" && body.roomId.trim()) {
      // Owner dapat memakai label kamar custom — tetap tercatat di propertinya
      const room = await db.room.findUnique({
        where: { id: body.roomId.trim() },
        include: { tenant: true },
      });
      if (room) {
        roomId = room.id;
        if (room.tenant) {
          reporterName = reporterName || room.tenant.name;
          reporterPhone = reporterPhone || room.tenant.phone;
        }
      } else {
        roomId = body.roomId.trim(); // kamar custom — tetap catat id-nya
      }
    }

    // Tiket fasilitas umum (owner) — lokasi area bersama, tanpa kamar
    if (sumber === "fasilitas") {
      lokasi = typeof body.lokasi === "string" ? body.lokasi.trim() : "";
      if (!lokasi) {
        return NextResponse.json(
          { error: "Lokasi fasilitas wajib diisi untuk tiket pemeliharaan." },
          { status: 400 },
        );
      }
      roomId = null;
      if (!reporterName) reporterName = "Pengelola";
    }

    if (!reporterName) reporterName = "Pengelola";
    if (!judul) judul = "Laporan Komplain";

    const ticket = await db.ticket.create({
      data: {
        id: await nextTicketId(),
        roomId,
        // Isolasi multi-tenant: tiket fasilitas (roomId null) tetap terikat
        // properti owner; tiket portal terikat properti kamar penyewa
        propertyId,
        lokasi,
        sumber,
        judul,
        urgensi,
        reporterName,
        reporterPhone,
        kategori,
        deskripsi,
        photos,
        status: "menunggu",
        reportedLabel: reportedLabelNow(),
        reportedSort: await reportedSortNow(),
      },
      include: { room: { select: { nomor: true } } },
    });
    return NextResponse.json({ ticket: toClientTicket(ticket, ticket.room?.nomor ?? ticket.roomId) }, { status: 201 });
  } catch (err) {
    console.error("[api/tickets POST]", err);
    return NextResponse.json({ error: "Gagal mengirim laporan komplain." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "Parameter id tiket wajib diisi." }, { status: 400 });
    }

    const data: {
      status?: string;
      selesaiLabel?: string | null;
      teknisiName?: string | null;
      teknisiPhone?: string | null;
    } = {};

    if (body.status !== undefined) {
      const status = typeof body.status === "string" ? body.status.trim() : "";
      if (!TICKET_STATUSES.includes(status as TicketStatus)) {
        return NextResponse.json({ error: "Status tiket tidak dikenal." }, { status: 400 });
      }
      data.status = status;
      if (status === "selesai") {
        const d = wibNow();
        const hh = String(d.getUTCHours()).padStart(2, "0");
        const mm = String(d.getUTCMinutes()).padStart(2, "0");
        data.selesaiLabel = `Selesai ${wibDateShort()}, ${hh}:${mm} WIB`;
      } else {
        data.selesaiLabel = null;
      }
    }
    if (body.teknisiName !== undefined) {
      data.teknisiName =
        typeof body.teknisiName === "string" ? body.teknisiName.trim() || null : null;
    }
    if (body.teknisiPhone !== undefined) {
      data.teknisiPhone =
        typeof body.teknisiPhone === "string" ? body.teknisiPhone.trim() || null : null;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Tidak ada perubahan yang dikirim (status/teknisi)." },
        { status: 400 },
      );
    }

    try {
      // Isolasi: tiket milik owner lain → 404
      const propertyIds = await getOwnedPropertyIds(user);
      const owned = await db.ticket.findFirst({
        where: {
          id,
          OR: [
            { propertyId: { in: propertyIds } },
            { room: { propertyId: { in: propertyIds } } },
          ],
        },
        select: { id: true },
      });
      if (!owned) return notOwned("Tiket tidak ditemukan.");
      const ticket = await db.ticket.update({
        where: { id },
        data,
        include: { room: { select: { nomor: true } } },
      });
      return NextResponse.json({ ticket: toClientTicket(ticket, ticket.room?.nomor ?? ticket.roomId) });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return NextResponse.json({ error: "Tiket tidak ditemukan." }, { status: 404 });
      }
      throw err;
    }
  } catch (err) {
    console.error("[api/tickets PATCH]", err);
    return NextResponse.json({ error: "Gagal memperbarui tiket." }, { status: 500 });
  }
}

/** Hapus permanen tiket komplain — ?id=TKT-xxx (dari dialog konfirmasi owner) */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    if (!id) {
      return NextResponse.json({ error: "Parameter id tiket wajib diisi." }, { status: 400 });
    }
    // Isolasi: tiket milik owner lain → 404
    const propertyIds = await getOwnedPropertyIds(user);
    const owned = await db.ticket.findFirst({
      where: {
        id,
        OR: [
          { propertyId: { in: propertyIds } },
          { room: { propertyId: { in: propertyIds } } },
        ],
      },
      select: { id: true },
    });
    if (!owned) return notOwned("Tiket tidak ditemukan.");
    await db.ticket.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[api/tickets DELETE]", err);
    return NextResponse.json({ error: "Gagal menghapus tiket." }, { status: 500 });
  }
}
