-- ═════════════════════════════════════════════════════════════════════════════
-- UnitKu — license_leads: email OPSIONAL + kunci upsert pindah ke phone
--
-- Kapan dipakai : bila panel /admin atau /api/leads mencatat error terkait
--                 license_leads (tabel belum dibuat / masih bentuk lama di
--                 Supabase, karena deploy Vercel hanya menjalankan
--                 `prisma generate`, bukan `db push`).
-- Cara          : copy seluruh isi file ini → SQL Editor Supabase → Run.
-- Aman          : idempoten — boleh dijalankan berulang.
-- Perubahan     : form checkout kini ZERO FRICTION (hanya Nama + No. WhatsApp),
--                 jadi email boleh NULL dan kunci unik upsert pindah dari
--                 email ke phone (No. WhatsApp ternormalisasi 62xxxxxxxxxx).
-- Konsisten     : struktur identik dengan prisma/schema.prisma (model
--                 LicenseLead) sehingga `prisma db push` berikutnya tidak
--                 mendeteksi drift.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Tabel utama (bila belum ada) — bentuk BARU: email nullable ───────────────
CREATE TABLE IF NOT EXISTS "license_leads" (
    "id"         TEXT         NOT NULL,
    "email"      TEXT,            -- OPSIONAL: NULL bila pembeli tanpa email
    "name"       TEXT         NOT NULL,
    "phone"      TEXT         NOT NULL,
    "source"     TEXT         NOT NULL DEFAULT 'BAYAR_OTOMATIS',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Tanpa DEFAULT: dipelihara otomatis oleh Prisma client (@updatedAt) —
    -- disamakan persis dgn DDL `prisma db push` agar tidak ada drift.
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_leads_pkey" PRIMARY KEY ("id")
);

-- 2. Migrasi bentuk lama: longgarkan NOT NULL email (idempoten) ───────────────
ALTER TABLE "license_leads" ALTER COLUMN "email" DROP NOT NULL;

-- 3. Wariskan email dari baris duplikat ke baris terbaru per phone ────────────
UPDATE "license_leads" a
   SET "email" = sub."email"
  FROM (
    SELECT DISTINCT ON ("phone") "id", "phone", "email"
      FROM "license_leads"
     WHERE "email" IS NOT NULL AND "email" <> ''
     ORDER BY "phone", "updatedAt" DESC, "id" DESC
  ) sub
 WHERE a."phone" = sub."phone"
   AND a."id" <> sub."id"
   AND (a."email" IS NULL OR a."email" = '');

-- 4. Dedupe phone — sisakan SATU baris terbaru per nomor WhatsApp ─────────────
DELETE FROM "license_leads" a
  USING "license_leads" b
 WHERE a."phone" = b."phone"
   AND (a."updatedAt" < b."updatedAt"
        OR (a."updatedAt" = b."updatedAt" AND a."id" < b."id"));

-- 5. Index — kunci upsert pindah: unique(email) → unique(phone) ───────────────
DROP INDEX IF EXISTS "license_leads_email_key";

CREATE UNIQUE INDEX IF NOT EXISTS "license_leads_phone_key"
    ON "license_leads"("phone");

-- Urutan daftar lead terbaru di panel admin (GET /api/admin/users).
CREATE INDEX IF NOT EXISTS "license_leads_updatedAt_idx" ON "license_leads"("updatedAt");

-- 6. Row Level Security ───────────────────────────────────────────────────────
-- Aktifkan RLS TANPA policy apa pun:
--   • Prisma / server Next.js terhubung dengan role `postgres` (bypass RLS)
--     → panel admin tetap bisa bila & tulis lead.
--   • Role `anon` / `authenticated` via Data API (PostgREST) terblokir total
--     → data calon pembeli (email, No. WhatsApp) tidak bisa bocor ke publik.
ALTER TABLE "license_leads" ENABLE ROW LEVEL SECURITY;

-- 7. Dokumentasi kolom (muncul di Table Editor Supabase) ─────────────────────
COMMENT ON TABLE  "license_leads"            IS 'Lead calon pembeli lisensi seumur hidup UnitKu (form checkout / register sebelum bayar)';
COMMENT ON COLUMN "license_leads"."email"    IS 'Email calon pembeli — OPSIONAL (NULL bila form zero-friction hanya Nama + No. WhatsApp)';
COMMENT ON COLUMN "license_leads"."name"     IS 'Nama lengkap dari form';
COMMENT ON COLUMN "license_leads"."phone"    IS 'Nomor WhatsApp ternormalisasi 62xxxxxxxxxx (unik — kunci upsert)';
COMMENT ON COLUMN "license_leads"."source"   IS 'Asal lead: BAYAR_OTOMATIS | PESAN_MANUAL | REGISTER';
