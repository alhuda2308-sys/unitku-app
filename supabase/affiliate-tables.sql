-- ═════════════════════════════════════════════════════════════════════════════
-- UnitKu — Sistem affiliate: SKEMA FINAL & LENGKAP (Tahap 2–4)
-- ═════════════════════════════════════════════════════════════════════════════
-- Jalankan SELURUH file ini di Supabase SQL Editor. IDEMPOTEN — aman dijalankan
-- berulang kali (fresh install maupun upgrade tabel lama).
--
-- Dijamin sinkron 100% dengan prisma/schema.prisma (model Affiliate &
-- AffiliateCommission): SETIAP kolom dibuat via CREATE TABLE IF NOT EXISTS
-- (tabel baru) DAN ALTER TABLE ADD COLUMN IF NOT EXISTS (tabel lama yang
-- dibuat manual / dari versi SQL sebelumnya → fix error P2022
-- "The column affiliates.xxx does not exist").
--
-- Konvensi nama: kolom camelCase TANPA @map di Prisma → identifier di-quote
-- persis ("refCode", "totalEarnings", "bankAccountNo", dst.). Tabel snake_case
-- via @@map → "affiliates" / "affiliate_commissions".
--
-- Alur: link https://unitku.my.id/?ref=huda → cookie unitku_ref (30 hari)
--   → /api/checkout menyelipkan metadata.affiliate_ref ke invoice Mayar
--   → webhook payment.received mencatat komisi Rp150.000 (idempoten per
--   order_id) + menambah totalEarnings.
--
-- Catatan: runtime aplikasi juga self-heal otomatis dengan langkah yang
-- identik (src/lib/affiliate-commission.ts → ensureAffiliateTables), jadi
-- file ini referensi/manual-ops — menjalankannya sekali membuat produksi
-- langsung sinkron tanpa menunggu request pertama.
-- ═════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) TABEL AFFILIATES — daftar affiliator (fresh install, definisi lengkap)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public."affiliates" (
  "id"              text         not null,
  -- Pemilik akun affiliator — auth.users.id (Supabase) / OwnerAccount.id (lokal).
  -- UNIQUE: satu akun user = satu akun affiliator; kunci akses dashboard
  -- /affiliate/dashboard (profil dicari berdasarkan user yang sedang login).
  "userId"          text,
  "name"            text         not null,
  "email"           text,        -- opsional — kontak payout/komisi
  "phone"           text,        -- opsional — WhatsApp affiliator
  -- Kode unik di link referral ([A-Za-z0-9_-], maks 64 — sanitizeAffiliateRef)
  "refCode"         text         not null,
  -- Saldo komisi terakumulasi (IDR) — di-increment webhook Mayar per sale baru
  "totalEarnings"   integer      not null default 0,
  -- Nonaktif = kode masih mengikuti cookie, tetapi komisi baru TIDAK dicatat
  "isActive"        boolean      not null default true,
  -- Rekening pencairan komisi — diisi affiliator dari dashboard
  "bankName"        text,        -- "BCA"
  "bankAccountNo"   text,        -- "0970545093"
  "bankAccountName" text,        -- "Budi Santoso"
  -- Magic-link akses portal mitra tanpa login — "afk_<48 hex>" (pattern
  -- StaffMember.accessToken). Link: /affiliate/dashboard?ref=<kode>&token=<...>
  "accessToken"     text,
  "createdAt"       timestamp(3) not null default current_timestamp,
  "updatedAt"       timestamp(3) not null default current_timestamp,
  constraint "affiliates_pkey" primary key ("id")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) UPGRADE TABEL AFFILIATES LAMA — SEMUA kolom dijamin ada (fix P2022)
--    CREATE TABLE IF NOT EXISTS tidak menyentuh tabel yang sudah ada; tabel
--    buatan manual / versi SQL lama wajib dinaikkan versi per kolom.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public."affiliates" add column if not exists "userId"          text;
alter table public."affiliates" add column if not exists "name"            text not null default '';
alter table public."affiliates" add column if not exists "email"           text;
alter table public."affiliates" add column if not exists "phone"           text;
alter table public."affiliates" add column if not exists "refCode"         text not null default '';
alter table public."affiliates" add column if not exists "totalEarnings"   integer not null default 0;
alter table public."affiliates" add column if not exists "isActive"        boolean not null default true;
alter table public."affiliates" add column if not exists "bankName"        text;
alter table public."affiliates" add column if not exists "bankAccountNo"   text;
alter table public."affiliates" add column if not exists "bankAccountName" text;
alter table public."affiliates" add column if not exists "accessToken"     text;
alter table public."affiliates" add column if not exists "createdAt"       timestamp(3) not null default current_timestamp;
alter table public."affiliates" add column if not exists "updatedAt"       timestamp(3) not null default current_timestamp;

-- Backfill baris legacy agar NOT NULL & unique index tetap valid
update public."affiliates" set "name" = 'Affiliator'
 where "name" is null or "name" = '';
update public."affiliates" set "refCode" = 'aff_' || substr(md5("id" || random()::text), 1, 10)
 where "refCode" is null or "refCode" = '';

-- Primary key — tabel buatan manual bisa tanpa PK (idempoten)
do $$
begin
  alter table public."affiliates" add constraint "affiliates_pkey" primary key ("id");
exception
  when duplicate_object then null;          -- constraint sudah ada
  when invalid_table_definition then null;  -- PK lain sudah ada
end $$;

-- Unique index Prisma (setelah backfill)
create unique index if not exists "affiliates_refCode_key" on public."affiliates"("refCode");
create unique index if not exists "affiliates_userId_key"  on public."affiliates"("userId");
create unique index if not exists "affiliates_accessToken_key" on public."affiliates"("accessToken");


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) TABEL AFFILIATE_COMMISSIONS — histori komisi (fresh install + upgrade)
--    orderId (id transaksi Mayar) UNIQUE = anti-komisi-ganda saat webhook
--    Mayar me-retry event yang sama.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public."affiliate_commissions" (
  "id"               text         not null,
  "affiliateId"      text         not null,
  "orderId"          text         not null,
  "customerEmail"    text,
  "commissionAmount" integer      not null,
  "status"           text         not null default 'approved', -- approved | paid | reversed
  "paidAt"           timestamp(3), -- timestamp transfer admin ke mitra (audit)
  "createdAt"        timestamp(3) not null default current_timestamp,
  constraint "affiliate_commissions_pkey" primary key ("id"),
  constraint "affiliate_commissions_affiliateId_fkey"
    foreign key ("affiliateId") references public."affiliates"("id")
    on delete cascade
);

-- Upgrade tabel lama — semua kolom dijamin ada (fix P2022)
alter table public."affiliate_commissions" add column if not exists "affiliateId"      text not null default '';
alter table public."affiliate_commissions" add column if not exists "orderId"          text not null default '';
alter table public."affiliate_commissions" add column if not exists "customerEmail"    text;
alter table public."affiliate_commissions" add column if not exists "commissionAmount" integer not null default 0;
alter table public."affiliate_commissions" add column if not exists "status"           text not null default 'approved';
alter table public."affiliate_commissions" add column if not exists "paidAt"           timestamp(3);
alter table public."affiliate_commissions" add column if not exists "createdAt"        timestamp(3) not null default current_timestamp;

-- Primary key — tabel buatan manual bisa tanpa PK (idempoten)
do $$
begin
  alter table public."affiliate_commissions" add constraint "affiliate_commissions_pkey" primary key ("id");
exception
  when duplicate_object then null;
  when invalid_table_definition then null;
end $$;

-- Index Prisma
create unique index if not exists "affiliate_commissions_orderId_key"
  on public."affiliate_commissions"("orderId");
create index if not exists "affiliate_commissions_affiliateId_idx"
  on public."affiliate_commissions"("affiliateId");

-- Foreign key — tabel lama mungkin belum punya (idempoten, best effort bila
-- ada baris orphan legacy)
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'affiliate_commissions_affiliateId_fkey'
  ) then
    alter table public."affiliate_commissions"
      add constraint "affiliate_commissions_affiliateId_fkey"
      foreign key ("affiliateId") references public."affiliates"("id")
      on delete cascade;
  end if;
exception when others then null;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4) PROTEKSI: RLS — tabel hanya diakses Prisma (koneksi postgres, bypass RLS)
--    & service-role — blokir akses anon/public key.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public."affiliates"            enable row level security;
alter table public."affiliate_commissions" enable row level security;


-- ═════════════════════════════════════════════════════════════════════════════
-- 5) PENDAFTARAN AKUN AFFILIATOR — Alburhanul Huda (idempoten)
--    Jalankan bagian ini juga bila skema di atas sudah sinkron sebelumnya.
-- ═════════════════════════════════════════════════════════════════════════════

-- Lepas klaim userId dari baris affiliator lain (jika ada) agar tidak bentrok
-- unique index "affiliates_userId_key" saat upsert di bawah.
update public."affiliates"
   set "userId" = null
 where "userId" = '2e8aba75-2c09-4a12-894b-1117d8f0ec40'
   and "refCode" <> 'huda';

-- Daftarkan / perbarui akun affiliator "huda" — komisi mengalir otomatis ke
-- dashboard /affiliate/dashboard milik user ini setelah baris ada.
insert into public."affiliates"
  ("id", "userId", "name", "phone", "refCode", "isActive", "createdAt", "updatedAt")
values
  (gen_random_uuid()::text,
   '2e8aba75-2c09-4a12-894b-1117d8f0ec40',
   'Alburhanul Huda',
   '085187813569',
   'huda',
   true,
   now(),
   now())
on conflict ("refCode") do update
  set "userId"    = excluded."userId",
      "name"      = excluded."name",
      "phone"     = excluded."phone",
      "isActive"  = true,
      "updatedAt" = now();


-- ─────────────────────────────────────────────────────────────────────────────
-- 6) VERIFIKASI — harus tampil 1 baris: huda / Alburhanul Huda / userId terisi
-- ─────────────────────────────────────────────────────────────────────────────
select "refCode", "name", "userId", "phone", "totalEarnings", "isActive"
  from public."affiliates"
 where "refCode" = 'huda';
