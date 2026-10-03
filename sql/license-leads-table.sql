-- ═════════════════════════════════════════════════════════════════════════════
-- UnitKu — Buat tabel license_leads (lead calon pembeli lisensi seumur hidup)
--
-- Kapan dipakai : bila panel /admin mencatat error terkait license_leads
--                 (tabel belum ikut terbuat di Supabase, karena deploy Vercel
--                 hanya menjalankan `prisma generate`, bukan `db push`).
-- Cara          : copy seluruh isi file ini → SQL Editor Supabase → Run.
-- Aman          : idempoten (IF NOT EXISTS) — boleh dijalankan berulang.
-- Konsisten     : struktur identik dengan prisma/schema.prisma (model
--                 LicenseLead) sehingga `prisma db push` berikutnya tidak
--                 mendeteksi drift.
-- Catatan panel : GET /api/admin/users sudah punya fallback — tanpa tabel ini
--                 daftar pengguna tetap tampil (hanya data lead yang kosong).
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Tabel utama ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "license_leads" (
    "id"         TEXT         NOT NULL,
    "email"      TEXT         NOT NULL,
    "name"       TEXT         NOT NULL,
    "phone"      TEXT         NOT NULL,
    "source"     TEXT         NOT NULL DEFAULT 'BAYAR_OTOMATIS',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Tanpa DEFAULT: dipelihara otomatis oleh Prisma client (@updatedAt) —
    -- disamakan persis dgn DDL `prisma db push` agar tidak ada drift.
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_leads_pkey" PRIMARY KEY ("id")
);

-- 2. Index ────────────────────────────────────────────────────────────────────
-- Unik per email — kunci upsert dari /api/lead (form checkout & register).
CREATE UNIQUE INDEX IF NOT EXISTS "license_leads_email_key" ON "license_leads"("email");

-- Urutan daftar lead terbaru di panel admin (GET /api/admin/users).
CREATE INDEX IF NOT EXISTS "license_leads_updatedAt_idx" ON "license_leads"("updatedAt");

-- 3. Row Level Security ───────────────────────────────────────────────────────
-- Aktifkan RLS TANPA policy apa pun:
--   • Prisma / server Next.js terhubung dengan role `postgres` (bypass RLS)
--     → panel admin tetap bisa bila & tulis lead.
--   • Role `anon` / `authenticated` via Data API (PostgREST) terblokir total
--     → data calon pembeli (email, No. WhatsApp) tidak bisa bocor ke publik.
ALTER TABLE "license_leads" ENABLE ROW LEVEL SECURITY;

-- 4. Dokumentasi kolom (muncul di Table Editor Supabase) ─────────────────────
COMMENT ON TABLE  "license_leads"            IS 'Lead calon pembeli lisensi seumur hidup UnitKu (form checkout / register sebelum bayar)';
COMMENT ON COLUMN "license_leads"."email"    IS 'Email calon pembeli (lowercase, unik — kunci upsert)';
COMMENT ON COLUMN "license_leads"."name"     IS 'Nama lengkap dari form';
COMMENT ON COLUMN "license_leads"."phone"    IS 'Nomor WhatsApp ternormalisasi 62xxxxxxxxxx';
COMMENT ON COLUMN "license_leads"."source"   IS 'Asal lead: BAYAR_OTOMATIS | PESAN_MANUAL | REGISTER';
