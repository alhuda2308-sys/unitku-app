-- ─────────────────────────────────────────────────────────────────────────────
-- UnitKu — Tabel "announcements" (Pengumuman & Broadcast lintas perangkat)
--
-- Dulu pengumuman HANYA hidup di state dashboard perangkat (localStorage miror
-- portal) — tidak pernah tersimpan di cloud. Model Prisma Announcement kini
-- ada; jalankan SQL ini SEKALI di Supabase (SQL Editor) bila `prisma db push`
-- tidak dipakai. Idempoten — aman dijalankan berulang.
--
-- Kolom & tipe = cermin prisma/schema.prisma (model Announcement).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "announcements" (
  "id"              TEXT       NOT NULL,
  "propertyId"      TEXT       NOT NULL,
  "judul"           TEXT       NOT NULL,
  "kategori"        TEXT       NOT NULL DEFAULT 'info',
  "targetFloor"     INTEGER,
  "isi"             TEXT       NOT NULL DEFAULT '',
  "tanggalMulai"    TEXT       NOT NULL,
  "tanggalBerakhir" TEXT       NOT NULL,
  "aktif"           BOOLEAN    NOT NULL DEFAULT true,
  "createdAtLabel"  TEXT       NOT NULL DEFAULT '',
  "createdAtSort"   INTEGER    NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- Relasi ke properties (Cascade: pengumuman ikut terhapus bersama properti)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'announcements_propertyId_fkey'
  ) THEN
    ALTER TABLE "announcements"
      ADD CONSTRAINT "announcements_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "properties"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Index query utama: daftar per properti + urutan terbaru dulu
CREATE INDEX IF NOT EXISTS "announcements_propertyId_idx"   ON "announcements"("propertyId");
CREATE INDEX IF NOT EXISTS "announcements_createdAtSort_idx" ON "announcements"("createdAtSort");
