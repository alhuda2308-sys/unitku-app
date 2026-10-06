-- ─────────────────────────────────────────────────────────────────────────────
-- UnitKu — Aktifkan Supabase Realtime untuk notifikasi instan lead baru
--
-- OPSIONAL (lapisan percepatan). Tanpa script ini sistem notifikasi TETAP
-- berjalan lewat polling GET /api/admin/leads/latest (guard super-admin,
-- tiap 20–30 detik). Dengan script ini, pendaftar baru mendorong event
-- postgres_changes ke browser Super Admin dalam <1 detik.
--
-- Jalankan di Supabase Dashboard → SQL Editor (server produksi), sekali saja.
--
-- KONTEKS KEAMANAN:
--   • Tabel license_leads berisi PII (nama + No. WhatsApp calon pembeli) dan
--     RLS-nya aktif TANPA policy (lihat sql/license-leads-table.sql) →
--     klien anon/authenticated TIDAK bisa membaca apa pun. Script ini menambah
--     SATU policy SELECT yang HANYA berlaku untuk email Super Admin, sehingga
--     event realtime tidak pernah sampai ke pengguna biasa.
--   • Ganti email di bawah sesuai SUPER_ADMIN_EMAILS di environment produksi.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Ikutkan tabel ke publikasi realtime bawaan Supabase
--    (idempoten: bila sudah ada, baris ini di-skip dengan ON_ERROR skip —
--     jalankan ulang aman)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public."license_leads";
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'license_leads sudah terdaftar di publikasi supabase_realtime';
END $$;

-- 2) Policy RLS SELECT khusus Super Admin (ganti daftar email!)
--    Realtime postgres_changes mengecek RLS per subscriber — tanpa policy
--    ini event TIDAK akan terkirim meski publikasi aktif.
CREATE POLICY "license_leads_realtime_super_admin_select"
  ON "public"."license_leads"
  FOR SELECT
  TO authenticated
  USING (
    coalesce(auth.jwt() ->> 'email', '') IN (
      'GANTI-EMAIL-ADMIN@unitku.my.id'  -- ← samakan dengan SUPER_ADMIN_EMAILS
      -- ,'email-admin-kedua@unitku.my.id'
    )
  );

-- 3) (Rekomendasi) REPLICA IDENTITY default sudah cukup untuk event INSERT.
--    Tidak perlu perubahan.

-- Verifikasi cepat setelah dijalankan:
--   SELECT pubname, tablename FROM pg_publication_tables
--    WHERE schemaname='public' AND tablename='license_leads';
--   SELECT policyname FROM pg_policies
--    WHERE schemaname='public' AND tablename='license_leads';
