-- ─────────────────────────────────────────────────────────────────────────────
-- UnitKu — Sistem affiliate (Tahap 2–3): tabel referrals & komisi
--
-- Jalankan di Supabase SQL Editor bila `prisma db push` belum dibuatkan —
-- runtime juga self-heal otomatis (src/lib/affiliate-commission.ts →
-- ensureAffiliateTables), jadi file ini referensi/manual-ops.
-- Kolom camelCase mengikuti konvensi Prisma (model Affiliate /
-- AffiliateCommission di prisma/schema.prisma); id diisi Prisma (cuid).
--
-- Alur: link https://unitku.my.id/?ref=budi123 → cookie unitku_ref (30 hari)
--   → /api/checkout menyelipkan metadata.affiliate_ref ke invoice Mayar
--   → webhook payment.received mencatat komisi Rp150.000 (idempoten per
--   order_id) + menambah totalEarnings.
-- ─────────────────────────────────────────────────────────────────────────────

-- Daftar affiliator — tambahkan satu baris per mitra (refCode = nilai ?ref=)
create table if not exists public."affiliates" (
  "id"            text         not null,
  "name"          text         not null,
  "email"         text,
  "phone"         text,
  "refCode"       text         not null,
  "totalEarnings" integer      not null default 0,
  "isActive"      boolean      not null default true,
  "createdAt"     timestamp(3) not null default current_timestamp,
  "updatedAt"     timestamp(3) not null,
  constraint "affiliates_pkey" primary key ("id")
);
create unique index if not exists "affiliates_refCode_key" on public."affiliates"("refCode");

-- Histori komisi — orderId (id transaksi Mayar) UNIQUE = anti-komisi-ganda
-- saat webhook Mayar me-retry event yang sama.
create table if not exists public."affiliate_commissions" (
  "id"               text         not null,
  "affiliateId"      text         not null,
  "orderId"          text         not null,
  "customerEmail"    text,
  "commissionAmount" integer      not null,
  "status"           text         not null default 'approved',
  "createdAt"        timestamp(3) not null default current_timestamp,
  constraint "affiliate_commissions_pkey" primary key ("id"),
  constraint "affiliate_commissions_affiliateId_fkey"
    foreign key ("affiliateId") references public."affiliates"("id")
    on delete cascade
);
create unique index if not exists "affiliate_commissions_orderId_key"
  on public."affiliate_commissions"("orderId");
create index if not exists "affiliate_commissions_affiliateId_idx"
  on public."affiliate_commissions"("affiliateId");

-- Proteksi: tabel hanya diakses Prisma (koneksi postgres, bypass RLS) &
-- service-role — blokir akses anon/public key.
alter table public."affiliates"            enable row level security;
alter table public."affiliate_commissions" enable row level security;

-- Contoh daftar affiliator (hapus komentar & sesuaikan):
-- insert into public."affiliates" ("id", "name", "email", "phone", "refCode", "updatedAt")
-- values (gen_random_uuid()::text, 'Budi Santoso', 'budi@example.com', '6281234567890',
--         'budi123', now());
