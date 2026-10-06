-- ═════════════════════════════════════════════════════════════════════════════
-- UnitKu — Tabel owner_settings (Pengaturan owner sinkron lintas perangkat)
--
-- Kapan dipakai : bila pengaturan (Profil Saya, Profil Properti, Staf, Template
--                 WhatsApp, Fasilitas, Tema) kembali ke data dummy saat ganti
--                 perangkat — tabel ini penyimpan cloud-nya.
-- Cara          : copy seluruh isi file ini → SQL Editor Supabase → Run.
-- Aman          : idempoten (IF NOT EXISTS) — boleh dijalankan berulang.
-- RLS           : aktif + policy auth.uid() = "userId" — via Data API user
--                 hanya bisa baca/ubah barisnya sendiri; server Next.js
--                 (Prisma, role postgres) bypass RLS untuk seluruh operasi.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Tabel utama (struktur identik prisma/schema.prisma → model OwnerSetting)
CREATE TABLE IF NOT EXISTS "owner_settings" (
    "userId"         TEXT NOT NULL,
    "owner"          JSONB,
    "propertyExtras" JSONB,
    "properties"     JSONB,
    "staff"          JSONB,
    "templates"      JSONB,
    "facilities"     JSONB,
    "theme"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Tanpa DEFAULT: dipelihara Prisma client (@updatedAt) — bebas drift.
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_settings_pkey" PRIMARY KEY ("userId")
);

-- 2. Row Level Security — user hanya boleh menyentuh datanya sendiri
ALTER TABLE "owner_settings" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_settings_self_all" ON "owner_settings";
CREATE POLICY "owner_settings_self_all" ON "owner_settings"
    FOR ALL
    TO anon, authenticated
    USING ("userId" = auth.uid())
    WITH CHECK ("userId" = auth.uid());

-- 3. Dokumentasi kolom (muncul di Table Editor Supabase)
COMMENT ON TABLE  "owner_settings"               IS 'Pengaturan owner UnitKu (Profil Saya, Profil Properti, Staf, Template WA, Fasilitas, Tema) — sinkron lintas perangkat per auth.uid()';
COMMENT ON COLUMN "owner_settings"."userId"      IS 'Id owner — auth.users.id (Supabase) / owner_accounts.id (mode lokal)';
COMMENT ON COLUMN "owner_settings"."owner"          IS 'Profil Saya: { nama, email, whatsapp }';
COMMENT ON COLUMN "owner_settings"."propertyExtras" IS 'Profil Properti non-Property: { lantai, jamMalam, aturan }';
COMMENT ON COLUMN "owner_settings"."properties"  IS 'Daftar properti multi-cabang versi settings';
COMMENT ON COLUMN "owner_settings"."staff"       IS 'Daftar staf versi settings';
COMMENT ON COLUMN "owner_settings"."templates"   IS 'Template pesan WhatsApp: { h3, hariH, lunas }';
COMMENT ON COLUMN "owner_settings"."facilities"  IS 'Katalog fasilitas: { unit: [], shared: [] }';
COMMENT ON COLUMN "owner_settings"."theme"       IS 'Kunci tema tampilan aktif (12 tema)';
