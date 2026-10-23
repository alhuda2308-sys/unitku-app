// ─────────────────────────────────────────────────────────────────────────────
// /api/announcements — Pengumuman & Broadcast (Supabase)
//
// Dulu pengumuman HANYA hidup di state dashboard perangkat (localStorage) —
// hilang saat ganti perangkat dan tidak pernah terlihat penyewa di perangkat
// lain. Kini tersimpan permanen per properti:
//
// GET    : daftar pengumuman properti owner (terbaru dulu — createdAtSort desc)
// POST   : buat pengumuman baru (id #PGM-xxx dihitung server, anti tabrakan)
// PATCH  : edit draft pengumuman / toggle aktif-nonaktif
// DELETE : hapus permanen (?id=#PGM-xxx)
//
// Isolasi multi-tenant: semua operasi terikat properti milik sesi owner.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { ensureSeedForUser } from "@/lib/server/seed";
import { toClientAnnouncement } from "@/lib/server/mappers";
import { getAuthUser } from "@/lib/auth/server";
import {
  getOwnedPropertyIds,
  resolveOwnedPropertyOverride,
  resolveOwnedPropertyScope,
  notOwned,
  unauthorized,
} from "@/lib/auth/ownership";
import {
  ANNOUNCEMENT_KATEGORI,
  type AnnouncementKategori,
} from "@/lib/announcement-data";

export const dynamic = "force-dynamic";

/** ISO yyyy-mm-dd — dipakai validasi periode tayang */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── Self-heal migrasi (zero-touch produksi) ──────────────────────────────────
// Bila `prisma db push` belum dijalankan di Supabase produksi, tabel
// announcements dibuat otomatis saat request pertama (idempoten, memoized) —
// pola sama dengan ensureLicenseLeadTable. Jalankan manual sql/announcements-
// table.sql bila lebih suka DDL eksplisit.
let announcementTableReady: Promise<void> | null = null;

function ensureAnnouncementTable(): Promise<void> {
  announcementTableReady ??= (async () => {
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "announcements" (
         "id"              TEXT       NOT NULL,
         "propertyId"      TEXT       NOT NULL,
         "judul"           TEXT       NOT NULL,
         "kategori"        TEXT       NOT NULL DEFAULT 'info',
         "targetFloor"     INTEGER,
         "targetTenantId"  TEXT,
         "isi"             TEXT       NOT NULL DEFAULT '',
         "tanggalMulai"    TEXT       NOT NULL,
         "tanggalBerakhir" TEXT       NOT NULL,
         "aktif"           BOOLEAN    NOT NULL DEFAULT true,
         "createdAtLabel"  TEXT       NOT NULL DEFAULT '',
         "createdAtSort"   BIGINT     NOT NULL DEFAULT 0,
         "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
         "updatedAt"       TIMESTAMP(3) NOT NULL,
         CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
       )`,
    );
    // Tabel lama tanpa kolom target penyewa — tambahkan (idempoten, no-op bila ada)
    await db
      .$executeRawUnsafe(
        `ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "targetTenantId" TEXT`,
      )
      .catch(() => undefined);
    await db
      .$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "announcements_propertyId_idx" ON "announcements"("propertyId")`,
      )
      .catch(() => undefined);
    await db
      .$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "announcements_createdAtSort_idx" ON "announcements"("createdAtSort")`,
      )
      .catch(() => undefined);
    await db
      .$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "announcements_targetTenantId_idx" ON "announcements"("targetTenantId")`,
      )
      .catch(() => undefined);
    // Tabel lama dibuat dengan INTEGER — createdAtSort yyyymmddHHmm (12 digit)
    // meluap INT4. Naikkan ke BIGINT (idempoten, no-op bila sudah BIGINT).
    await db
      .$executeRawUnsafe(
        `ALTER TABLE "announcements" ALTER COLUMN "createdAtSort" TYPE BIGINT`,
      )
      .catch(() => undefined);
    await db
      .$executeRawUnsafe(
        `DO $$ BEGIN
           IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'announcements_propertyId_fkey') THEN
             ALTER TABLE "announcements" ADD CONSTRAINT "announcements_propertyId_fkey"
               FOREIGN KEY ("propertyId") REFERENCES "properties"("id")
               ON DELETE CASCADE ON UPDATE CASCADE;
           END IF;
         END $$`,
      )
      .catch(() => undefined);
    await db
      .$executeRawUnsafe(
        `DO $$ BEGIN
           IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'announcements_targetTenantId_fkey') THEN
             ALTER TABLE "announcements" ADD CONSTRAINT "announcements_targetTenantId_fkey"
               FOREIGN KEY ("targetTenantId") REFERENCES "tenants"("id")
               ON DELETE SET NULL ON UPDATE CASCADE;
           END IF;
         END $$`,
      )
      .catch(() => undefined);
  })().catch((err) => {
    announcementTableReady = null; // gagal → boleh dicoba ulang request berikutnya
    throw err;
  });
  return announcementTableReady;
}

/** ID pengumuman berikutnya — max #PGM-N existing (semua properti) + 1 */
async function nextAnnouncementId(): Promise<string> {
  const ids = await db.announcement.findMany({ select: { id: true } });
  const max = ids.reduce((m, row) => {
    const n = Number(row.id.replace(/[^0-9]/g, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `#PGM-${String(max + 1).padStart(3, "0")}`;
}

/** Parse & validasi satu tanggal ISO — balik string valid atau null */
function parseIsoDate(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.trim();
  return ISO_DATE_RE.test(v) ? v : null;
}

export async function GET(request: NextRequest) {
  try {
    await ensureAnnouncementTable();
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    // Scope opsional ?propertyId= — panel Pengumuman memuat SESUAI cabang
    // aktif di switcher (broadcast hanya milik properti yang dikelola);
    // tanpa param = perilaku lama (seluruh properti owner).
    const scope = await resolveOwnedPropertyScope(
      user,
      request.nextUrl.searchParams.get("propertyId")?.trim() || null,
    );
    if (scope instanceof NextResponse) return scope;
    const announcements = await db.announcement.findMany({
      where: { propertyId: { in: scope } },
      orderBy: [{ createdAtSort: "desc" }, { id: "desc" }],
    });
    return NextResponse.json({
      announcements: announcements.map(toClientAnnouncement),
    });
  } catch (err) {
    console.error("[api/announcements GET]", err);
    return NextResponse.json(
      { error: "Gagal memuat pengumuman." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureAnnouncementTable();
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    // Isolasi multi-cabang: pengumuman masuk ke properti yang SEDANG dikelola
    // (body.propertyId dari switcher, divalidasi kepemilikan); tanpa itu →
    // properti aktif default (perilaku lama).
    const ownedProperty = await resolveOwnedPropertyOverride(user, body.propertyId);
    if (ownedProperty instanceof NextResponse) return ownedProperty;
    if (!ownedProperty) {
      return NextResponse.json(
        { error: "Properti belum terdaftar — lengkapi onboarding terlebih dahulu." },
        { status: 400 },
      );
    }
    const judul = typeof body.judul === "string" ? body.judul.trim() : "";
    const isi = typeof body.isi === "string" ? body.isi.trim() : "";
    const kategori = (
      ANNOUNCEMENT_KATEGORI.includes(body.kategori as AnnouncementKategori)
        ? body.kategori
        : "info"
    ) as AnnouncementKategori;

    if (judul.length < 3) {
      return NextResponse.json(
        { error: "Judul pengumuman minimal 3 karakter." },
        { status: 400 },
      );
    }
    const tanggalMulai = parseIsoDate(body.tanggalMulai);
    const tanggalBerakhir = parseIsoDate(body.tanggalBerakhir);
    if (!tanggalMulai || !tanggalBerakhir) {
      return NextResponse.json(
        { error: "Periode tayang wajib diisi (tanggal mulai & berakhir)." },
        { status: 400 },
      );
    }
    if (tanggalBerakhir < tanggalMulai) {
      return NextResponse.json(
        { error: "Tanggal berakhir tidak boleh sebelum tanggal mulai." },
        { status: 400 },
      );
    }
    const targetFloor =
      body.targetFloor === null || body.targetFloor === undefined || body.targetFloor === ""
        ? null
        : Number(body.targetFloor);
    if (targetFloor !== null && (!Number.isInteger(targetFloor) || targetFloor < 0)) {
      return NextResponse.json(
        { error: "Target lantai tidak valid." },
        { status: 400 },
      );
    }

    // Target penyewa spesifik ("Khusus Penyewa") — null/'' = ALL.
    // Validasi: penyewa WAJIB penghuni salah satu kamar properti aktif owner
    // (isolasi multi-tenant — id penyewa properti orang lain ditolak).
    const rawTargetTenantId =
      body.targetTenantId === null || body.targetTenantId === undefined || body.targetTenantId === ""
        ? null
        : typeof body.targetTenantId === "string"
          ? body.targetTenantId.trim()
          : null;
    if (rawTargetTenantId) {
      const tenant = await db.tenant.findFirst({
        where: { id: rawTargetTenantId, room: { propertyId: ownedProperty.id } },
        select: { id: true },
      });
      if (!tenant) {
        return NextResponse.json(
          { error: "Target penyewa tidak valid — bukan penghuni properti ini." },
          { status: 400 },
        );
      }
    }

    // "Hari ini" WIB — label & sort key monotonic utk urutan terbaru dulu
    const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const y = nowWib.getUTCFullYear();
    const mo = nowWib.getUTCMonth() + 1;
    const da = nowWib.getUTCDate();
    const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const createdSortAgg = await db.announcement.aggregate({
      _max: { createdAtSort: true },
    });
    const maxExisting = Number(createdSortAgg._max.createdAtSort ?? 0);
    const createdAtSort = BigInt(
      Math.max(
        Number(`${y}${String(mo).padStart(2, "0")}${String(da).padStart(2, "0")}0900`),
        maxExisting + 1,
      ),
    );

    const created = await db.announcement.create({
      data: {
        id: await nextAnnouncementId(),
        propertyId: ownedProperty.id,
        judul,
        kategori,
        targetFloor,
        targetTenantId: rawTargetTenantId,
        isi,
        tanggalMulai,
        tanggalBerakhir,
        aktif: true,
        createdAtLabel: `${da} ${bulan[mo - 1] ?? ""} ${y}`,
        createdAtSort,
      },
    });
    return NextResponse.json(
      { announcement: toClientAnnouncement(created) },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api/announcements POST]", err);
    return NextResponse.json(
      { error: "Gagal memasang pengumuman." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureAnnouncementTable();
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json(
        { error: "Parameter id pengumuman wajib diisi." },
        { status: 400 },
      );
    }

    const data: {
      judul?: string;
      kategori?: string;
      targetFloor?: number | null;
      targetTenantId?: string | null;
      isi?: string;
      tanggalMulai?: string;
      tanggalBerakhir?: string;
      aktif?: boolean;
    } = {};

    if (body.judul !== undefined) {
      const judul = typeof body.judul === "string" ? body.judul.trim() : "";
      if (judul.length < 3) {
        return NextResponse.json(
          { error: "Judul pengumuman minimal 3 karakter." },
          { status: 400 },
        );
      }
      data.judul = judul;
    }
    if (body.kategori !== undefined) {
      if (!ANNOUNCEMENT_KATEGORI.includes(body.kategori as AnnouncementKategori)) {
        return NextResponse.json(
          { error: "Kategori pengumuman tidak dikenal." },
          { status: 400 },
        );
      }
      data.kategori = body.kategori as string;
    }
    if (body.targetFloor !== undefined) {
      const targetFloor =
        body.targetFloor === null || body.targetFloor === "" ? null : Number(body.targetFloor);
      if (targetFloor !== null && (!Number.isInteger(targetFloor) || targetFloor < 0)) {
        return NextResponse.json(
          { error: "Target lantai tidak valid." },
          { status: 400 },
        );
      }
      data.targetFloor = targetFloor;
    }
    if (body.targetTenantId !== undefined) {
      const rawTargetTenantId =
        body.targetTenantId === null || body.targetTenantId === ""
          ? null
          : typeof body.targetTenantId === "string"
            ? body.targetTenantId.trim()
            : null;
      if (rawTargetTenantId) {
        // Isolasi: penyewa harus milik salah satu properti owner sesi ini
        const propertyIds = await getOwnedPropertyIds(user);
        const tenant = await db.tenant.findFirst({
          where: { id: rawTargetTenantId, room: { propertyId: { in: propertyIds } } },
          select: { id: true },
        });
        if (!tenant) {
          return NextResponse.json(
            { error: "Target penyewa tidak valid — bukan penghuni properti Anda." },
            { status: 400 },
          );
        }
      }
      data.targetTenantId = rawTargetTenantId;
    }
    if (body.isi !== undefined) {
      data.isi = typeof body.isi === "string" ? body.isi.trim() : "";
    }
    if (body.tanggalMulai !== undefined) {
      const v = parseIsoDate(body.tanggalMulai);
      if (!v) {
        return NextResponse.json(
          { error: "Tanggal mulai tidak valid." },
          { status: 400 },
        );
      }
      data.tanggalMulai = v;
    }
    if (body.tanggalBerakhir !== undefined) {
      const v = parseIsoDate(body.tanggalBerakhir);
      if (!v) {
        return NextResponse.json(
          { error: "Tanggal berakhir tidak valid." },
          { status: 400 },
        );
      }
      data.tanggalBerakhir = v;
    }
    if (body.aktif !== undefined) {
      data.aktif = body.aktif === true;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Tidak ada perubahan yang dikirim." },
        { status: 400 },
      );
    }

    try {
      // Isolasi: pengumuman milik owner lain → 404
      const propertyIds = await getOwnedPropertyIds(user);
      const owned = await db.announcement.findFirst({
        where: { id, propertyId: { in: propertyIds } },
        select: { id: true },
      });
      if (!owned) return notOwned("Pengumuman tidak ditemukan.");
      const updated = await db.announcement.update({ where: { id }, data });
      return NextResponse.json({ announcement: toClientAnnouncement(updated) });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return NextResponse.json({ error: "Pengumuman tidak ditemukan." }, { status: 404 });
      }
      throw err;
    }
  } catch (err) {
    console.error("[api/announcements PATCH]", err);
    return NextResponse.json(
      { error: "Gagal memperbarui pengumuman." },
      { status: 500 },
    );
  }
}

/** Hapus permanen pengumuman — ?id=#PGM-xxx (dari dialog konfirmasi owner) */
export async function DELETE(request: NextRequest) {
  try {
    await ensureAnnouncementTable();
    const user = await getAuthUser();
    if (!user) return unauthorized();
    await ensureSeedForUser(user);
    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    if (!id) {
      return NextResponse.json(
        { error: "Parameter id pengumuman wajib diisi." },
        { status: 400 },
      );
    }
    const propertyIds = await getOwnedPropertyIds(user);
    const owned = await db.announcement.findFirst({
      where: { id, propertyId: { in: propertyIds } },
      select: { id: true },
    });
    if (!owned) return notOwned("Pengumuman tidak ditemukan.");
    await db.announcement.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[api/announcements DELETE]", err);
    return NextResponse.json(
      { error: "Gagal menghapus pengumuman." },
      { status: 500 },
    );
  }
}
