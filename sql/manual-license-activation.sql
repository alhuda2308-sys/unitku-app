-- ═══════════════════════════════════════════════════════════════════════════
-- UnitKu — Aktivasi Lisensi Manual (Bypass Mayar) via SQL
--
-- Kapan dipakai : pembeli sudah bayar (WA/manual) tetapi lisensi belum aktif,
--                 atau Super Admin ingin membuka akses tanpa lewat panel /admin.
-- Cara pakai    : Supabase Dashboard → SQL Editor → ganti nilai v_email → Run.
-- Sifat         : IDEMPOTEN — aman dijalankan berulang (tidak ada baris ganda).
--
-- Catatan penting:
-- • Kolom "id" & "updatedAt" TIDAK punya default di DB (dikelola client Prisma),
--   jadi harus diisi eksplisit dalam SQL manual.
-- • auth.users.id bertipe UUID sedangkan kolom ownerId/userId Prisma bertipe
--   TEXT — selalu cast `auth.users.id::text` saat menyimpan/membandingkan.
-- • Lisensi terpasang pada level AKUN (email), mengikuti user ke semua propertinya.
-- • Super Admin TIDAK diatur lewat SQL — set env SUPER_ADMIN_EMAILS di Vercel
--   (comma-separated) lalu Redeploy. Lihat bagian bawah file ini.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_email   text := 'alburcell@gmail.com';   -- ← GANTI EMAIL DI SINI
  v_user_id text;
begin
  -- 0) Ambil id user Supabase Auth (bila sudah mendaftar)
  select u.id::text into v_user_id
  from auth.users u
  where u.email = v_email
  limit 1;

  -- 1) Upsert lisensi seumur hidup untuk akun email tsb
  insert into public.license_accounts
    ("id", "email", "isLifetimeLicensed", "licensedAt", "userId", "createdAt", "updatedAt")
  values (
    'lic_' || replace(gen_random_uuid()::text, '-', ''),
    v_email,
    true,
    now(),
    v_user_id,
    now(),
    now()
  )
  on conflict ("email") do update
    set "isLifetimeLicensed" = true,
        "licensedAt"         = coalesce(public.license_accounts."licensedAt", now()),
        "userId"             = coalesce(public.license_accounts."userId", excluded."userId"),
        "updatedAt"          = now();

  -- 2) Catatan audit pembelian manual — hanya bila belum ada (sumber lisensi
  --    di panel /admin tampil "Manual Super Admin")
  insert into public.license_purchases
    ("id", "transactionId", "email", "amount", "status", "eventType", "provider", "autoProvisioned", "createdAt")
  select
    'pur_' || replace(gen_random_uuid()::text, '-', ''),
    'MANUAL-SUPER-ADMIN-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
    v_email, 0, 'manual', 'MANUAL_SUPER_ADMIN', 'MANUAL_SUPER_ADMIN', false, now()
  where not exists (
    select 1 from public.license_purchases
    where "email" = v_email and "provider" = 'MANUAL_SUPER_ADMIN'
  );

  -- 3) Tautkan catatan pembelian ke akun lisensinya
  update public.license_purchases p
  set "licenseAccountId" = la."id"
  from public.license_accounts la
  where la."email" = p."email"
    and p."licenseAccountId" is null;

  -- 4) Laporan hasil
  raise notice 'Lisensi % aktif = % (userId: %)',
    v_email,
    (select "isLifetimeLicensed" from public.license_accounts where "email" = v_email),
    v_user_id;
end $$;

-- ── Verifikasi (jalankan terpisah bila perlu) ────────────────────────────────
-- select "email", "isLifetimeLicensed", "licensedAt", "userId"
--   from public.license_accounts where "email" = 'alburcell@gmail.com';
--
-- select "transactionId", "provider", "status", "amount"
--   from public.license_purchases where "email" = 'alburcell@gmail.com';

-- ═══════════════════════════════════════════════════════════════════════════
-- MENJADIKAN SUPER ADMIN (bukan SQL — env-based by design, tanpa migrasi):
--
--   Vercel → Project → Settings → Environment Variables:
--     SUPER_ADMIN_EMAILS = alburcell@gmail.com        (boleh >1, pisah koma)
--   → Redeploy (env server dibaca ulang saat deploy).
--
--   Setelah itu: tombol "🛡️ Panel Super Admin" muncul di Pengaturan → Profil
--   Saya, dan rute /admin bisa diakses oleh email tsb.
--
-- Soal tabel `public.profiles`: UnitKu TIDAK memakai tabel profiles — identitas
-- ada di auth.users (Supabase), lisensi di license_accounts, kepemilikan data
-- di properties.ownerId. Ketiadaan tabel profiles adalah normal, bukan error.
-- ═══════════════════════════════════════════════════════════════════════════
