// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Self-heal skema database runtime (idempoten, tanpa migrasi manual)
//
// Latar: deployment Vercel + Supabase memakai Prisma, namun penambahan kolom
// pada schema.prisma (mis. invoices."checkIn"/"checkOut"/"nights" utk sewa
// harian) tidak otomatis sampai ke database produksi — sandbox tidak punya
// kredensial DB produksi sehingga "prisma db push" tak pernah dijalankan ke
// sana. Akibatnya SELECT dgn kolom baru gagal: "The column invoices.checkin
// does not exist" — POST /api/rooms gagal & GET fail-open tampil kosong.
//
// Solusi: ensureSchema() dipanggil sebelum query database. Probe 1 query
// information_schema membandingkan kolom aktual vs skema Prisma; bila ada
// drift, seluruh DDL idempoten di bawah dijalankan:
//   • CREATE TABLE IF NOT EXISTS             — tabel baru (mis. announcements)
//   • ALTER TABLE … ADD COLUMN IF NOT EXISTS — kolom baru pada tabel lama
//   • CREATE INDEX IF NOT EXISTS             — indeks & unique index
//   • ADD CONSTRAINT … FOREIGN KEY           — ditoleransi bila sudah ada
// DDL dijalankan lewat DIRECT_URL bila tersedia (koneksi langsung, bukan
// pgbouncer) — fallback ke DATABASE_URL. Aman dijalankan berulang; hanya
// proses yang mendeteksi drift yang membayar biaya DDL (sekali per cold start).
//
// DICETAK OTOMATIS dari prisma migrate diff — jangan edit manual; jalankan
// ulang generator bila schema.prisma berubah.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

import { db } from "@/lib/prisma";
import { ensureRoomsNormalized } from "@/lib/server/room-nomor";

/** Probe ringan — 1 query per cold start; membandingkan kolom aktual vs harapan */
const PROBE_SQL = "SELECT \"table_name\" || '.' || \"column_name\" AS col FROM \"information_schema\".\"columns\" WHERE \"table_schema\" = current_schema() AND \"table_name\" IN ('properties', 'owner_accounts', 'license_accounts', 'license_leads', 'license_purchases', 'staff_members', 'rooms', 'tenants', 'invoices', 'invoice_lines', 'facilities', 'tickets', 'technician_contacts', 'cash_entries', 'announcements', 'owner_settings')";

/** Seluruh kolom yang diharapkan ada menurut schema.prisma ("tabel.kolom") */
const EXPECTED_COLUMNS: ReadonlySet<string> = new Set<string>([
  "properties.id",
  "properties.ownerId",
  "properties.name",
  "properties.tipe",
  "properties.alamat",
  "properties.fotoUrl",
  "properties.bankName",
  "properties.bankAccountNo",
  "properties.bankAccountName",
  "properties.qrisImageUrl",
  "properties.qrisNmid",
  "properties.createdAt",
  "properties.updatedAt",
  "owner_accounts.id",
  "owner_accounts.email",
  "owner_accounts.passwordHash",
  "owner_accounts.createdAt",
  "license_accounts.id",
  "license_accounts.email",
  "license_accounts.userId",
  "license_accounts.name",
  "license_accounts.phone",
  "license_accounts.isLifetimeLicensed",
  "license_accounts.paymentRef",
  "license_accounts.licensedAt",
  "license_accounts.createdAt",
  "license_accounts.updatedAt",
  "license_leads.id",
  "license_leads.email",
  "license_leads.name",
  "license_leads.phone",
  "license_leads.source",
  "license_leads.createdAt",
  "license_leads.updatedAt",
  "license_purchases.id",
  "license_purchases.transactionId",
  "license_purchases.email",
  "license_purchases.name",
  "license_purchases.phone",
  "license_purchases.amount",
  "license_purchases.status",
  "license_purchases.eventType",
  "license_purchases.provider",
  "license_purchases.autoProvisioned",
  "license_purchases.generatedPassword",
  "license_purchases.rawPayload",
  "license_purchases.licenseAccountId",
  "license_purchases.createdAt",
  "staff_members.id",
  "staff_members.propertyId",
  "staff_members.name",
  "staff_members.phone",
  "staff_members.role",
  "staff_members.accessToken",
  "staff_members.accessPin",
  "staff_members.isActive",
  "staff_members.createdAt",
  "rooms.id",
  "rooms.nomor",
  "rooms.propertyId",
  "rooms.floor",
  "rooms.type",
  "rooms.price",
  "rooms.status",
  "rooms.operational",
  "rooms.contractDuration",
  "rooms.contractStart",
  "rooms.contractEnd",
  "rooms.deposit",
  "rooms.depositHeld",
  "rooms.facilities",
  "rooms.createdAt",
  "rooms.updatedAt",
  "tenants.id",
  "tenants.roomId",
  "tenants.name",
  "tenants.phone",
  "tenants.moveInAt",
  "tenants.emergencyName",
  "tenants.emergencyPhone",
  "tenants.portalToken",
  "tenants.propertyId",
  "tenants.createdAt",
  "tenants.updatedAt",
  "tenants.occupation",
  "tenants.maritalStatus",
  "tenants.guardianName",
  "tenants.addressKtp",
  "tenants.notes",
  "tenants.customFields",
  "invoices.id",
  "invoices.roomId",
  "invoices.propertyId",
  "invoices.tenantName",
  "invoices.tenantPhone",
  "invoices.roomType",
  "invoices.periodLabel",
  "invoices.periodKey",
  "invoices.dueDate",
  "invoices.status",
  "invoices.dayOffset",
  "invoices.paidAt",
  "invoices.total",
  "invoices.checkIn",
  "invoices.checkOut",
  "invoices.nights",
  "invoices.createdAt",
  "invoices.updatedAt",
  "invoice_lines.id",
  "invoice_lines.invoiceId",
  "invoice_lines.label",
  "invoice_lines.amount",
  "facilities.id",
  "facilities.propertyId",
  "facilities.group",
  "facilities.label",
  "facilities.custom",
  "facilities.createdAt",
  "tickets.id",
  "tickets.roomId",
  "tickets.lokasi",
  "tickets.sumber",
  "tickets.judul",
  "tickets.urgensi",
  "tickets.reporterName",
  "tickets.reporterPhone",
  "tickets.kategori",
  "tickets.deskripsi",
  "tickets.photos",
  "tickets.status",
  "tickets.reportedLabel",
  "tickets.reportedSort",
  "tickets.teknisiName",
  "tickets.teknisiPhone",
  "tickets.selesaiLabel",
  "tickets.createdAt",
  "tickets.updatedAt",
  "tickets.propertyId",
  "technician_contacts.id",
  "technician_contacts.name",
  "technician_contacts.phone",
  "technician_contacts.specialization",
  "technician_contacts.isPrimary",
  "technician_contacts.propertyId",
  "technician_contacts.createdAt",
  "technician_contacts.updatedAt",
  "cash_entries.id",
  "cash_entries.type",
  "cash_entries.category",
  "cash_entries.description",
  "cash_entries.amount",
  "cash_entries.source",
  "cash_entries.entryDate",
  "cash_entries.dateLabel",
  "cash_entries.dateSort",
  "cash_entries.attachment",
  "cash_entries.propertyId",
  "cash_entries.createdAt",
  "announcements.id",
  "announcements.propertyId",
  "announcements.judul",
  "announcements.kategori",
  "announcements.targetFloor",
  "announcements.targetTenantId",
  "announcements.isi",
  "announcements.tanggalMulai",
  "announcements.tanggalBerakhir",
  "announcements.aktif",
  "announcements.createdAtLabel",
  "announcements.createdAtSort",
  "announcements.createdAt",
  "announcements.updatedAt",
  "owner_settings.userId",
  "owner_settings.owner",
  "owner_settings.propertyExtras",
  "owner_settings.properties",
  "owner_settings.staff",
  "owner_settings.templates",
  "owner_settings.facilities",
  "owner_settings.theme",
  "owner_settings.createdAt",
  "owner_settings.updatedAt",
]);

/** DDL idempoten — urutan aman: tabel → kolom → indeks → foreign key */
const SCHEMA_DDL: readonly string[] = [
  "CREATE SCHEMA IF NOT EXISTS \"public\"",
  "CREATE TABLE IF NOT EXISTS \"properties\" (\n    \"id\" TEXT NOT NULL,\n    \"ownerId\" TEXT,\n    \"name\" TEXT NOT NULL,\n    \"tipe\" TEXT NOT NULL DEFAULT 'kost',\n    \"alamat\" TEXT,\n    \"fotoUrl\" TEXT,\n    \"bankName\" TEXT,\n    \"bankAccountNo\" TEXT,\n    \"bankAccountName\" TEXT,\n    \"qrisImageUrl\" TEXT,\n    \"qrisNmid\" TEXT,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"properties_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"owner_accounts\" (\n    \"id\" TEXT NOT NULL,\n    \"email\" TEXT NOT NULL,\n    \"passwordHash\" TEXT NOT NULL,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n\n    CONSTRAINT \"owner_accounts_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"license_accounts\" (\n    \"id\" TEXT NOT NULL,\n    \"email\" TEXT NOT NULL,\n    \"userId\" TEXT,\n    \"name\" TEXT,\n    \"phone\" TEXT,\n    \"isLifetimeLicensed\" BOOLEAN NOT NULL DEFAULT false,\n    \"paymentRef\" TEXT,\n    \"licensedAt\" TIMESTAMP(3),\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"license_accounts_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"license_leads\" (\n    \"id\" TEXT NOT NULL,\n    \"email\" TEXT,\n    \"name\" TEXT NOT NULL,\n    \"phone\" TEXT NOT NULL,\n    \"source\" TEXT NOT NULL DEFAULT 'BAYAR_OTOMATIS',\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"license_leads_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"license_purchases\" (\n    \"id\" TEXT NOT NULL,\n    \"transactionId\" TEXT NOT NULL,\n    \"email\" TEXT NOT NULL,\n    \"name\" TEXT,\n    \"phone\" TEXT,\n    \"amount\" INTEGER NOT NULL DEFAULT 0,\n    \"status\" TEXT NOT NULL DEFAULT 'paid',\n    \"eventType\" TEXT,\n    \"provider\" TEXT,\n    \"autoProvisioned\" BOOLEAN NOT NULL DEFAULT false,\n    \"generatedPassword\" TEXT,\n    \"rawPayload\" JSONB,\n    \"licenseAccountId\" TEXT,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n\n    CONSTRAINT \"license_purchases_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"staff_members\" (\n    \"id\" TEXT NOT NULL,\n    \"propertyId\" TEXT,\n    \"name\" TEXT NOT NULL,\n    \"phone\" TEXT NOT NULL,\n    \"role\" TEXT NOT NULL DEFAULT 'PENJAGA_TEKNISI',\n    \"accessToken\" TEXT NOT NULL,\n    \"accessPin\" TEXT NOT NULL DEFAULT '',\n    \"isActive\" BOOLEAN NOT NULL DEFAULT true,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n\n    CONSTRAINT \"staff_members_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"rooms\" (\n    \"id\" TEXT NOT NULL,\n    \"nomor\" TEXT NOT NULL DEFAULT '',\n    \"propertyId\" TEXT NOT NULL,\n    \"floor\" INTEGER NOT NULL DEFAULT 1,\n    \"type\" TEXT NOT NULL DEFAULT '',\n    \"price\" INTEGER NOT NULL DEFAULT 0,\n    \"status\" TEXT NOT NULL DEFAULT 'kosong',\n    \"operational\" TEXT,\n    \"contractDuration\" TEXT,\n    \"contractStart\" TIMESTAMP(3),\n    \"contractEnd\" TIMESTAMP(3),\n    \"deposit\" INTEGER NOT NULL DEFAULT 0,\n    \"depositHeld\" BOOLEAN NOT NULL DEFAULT false,\n    \"facilities\" JSONB,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"rooms_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"tenants\" (\n    \"id\" TEXT NOT NULL,\n    \"roomId\" TEXT NOT NULL,\n    \"propertyId\" TEXT NOT NULL DEFAULT '',\n    \"name\" TEXT NOT NULL,\n    \"phone\" TEXT NOT NULL,\n    \"moveInAt\" TIMESTAMP(3),\n    \"emergencyName\" TEXT,\n    \"emergencyPhone\" TEXT,\n    \"portalToken\" TEXT NOT NULL,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"tenants_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"invoices\" (\n    \"id\" TEXT NOT NULL,\n    \"roomId\" TEXT NOT NULL,\n    \"propertyId\" TEXT NOT NULL DEFAULT '',\n    \"tenantName\" TEXT,\n    \"tenantPhone\" TEXT,\n    \"roomType\" TEXT,\n    \"periodLabel\" TEXT NOT NULL,\n    \"periodKey\" TEXT NOT NULL,\n    \"dueDate\" TIMESTAMP(3),\n    \"status\" TEXT NOT NULL DEFAULT 'jatuhTempo',\n    \"dayOffset\" INTEGER,\n    \"paidAt\" TIMESTAMP(3),\n    \"total\" INTEGER NOT NULL DEFAULT 0,\n    \"checkIn\" TIMESTAMP(3),\n    \"checkOut\" TIMESTAMP(3),\n    \"nights\" INTEGER,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"invoices_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"invoice_lines\" (\n    \"id\" SERIAL NOT NULL,\n    \"invoiceId\" TEXT NOT NULL,\n    \"label\" TEXT NOT NULL,\n    \"amount\" INTEGER NOT NULL DEFAULT 0,\n\n    CONSTRAINT \"invoice_lines_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"facilities\" (\n    \"id\" TEXT NOT NULL,\n    \"propertyId\" TEXT,\n    \"group\" TEXT NOT NULL DEFAULT 'unit',\n    \"label\" TEXT NOT NULL,\n    \"custom\" BOOLEAN NOT NULL DEFAULT false,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n\n    CONSTRAINT \"facilities_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"tickets\" (\n    \"id\" TEXT NOT NULL,\n    \"roomId\" TEXT,\n    \"lokasi\" TEXT,\n    \"sumber\" TEXT NOT NULL DEFAULT 'penyewa',\n    \"judul\" TEXT NOT NULL,\n    \"urgensi\" TEXT NOT NULL DEFAULT 'sedang',\n    \"reporterName\" TEXT NOT NULL,\n    \"reporterPhone\" TEXT NOT NULL DEFAULT '',\n    \"kategori\" TEXT NOT NULL DEFAULT 'Lainnya',\n    \"deskripsi\" TEXT NOT NULL DEFAULT '',\n    \"photos\" JSONB NOT NULL DEFAULT '[]',\n    \"status\" TEXT NOT NULL DEFAULT 'menunggu',\n    \"reportedLabel\" TEXT NOT NULL,\n    \"reportedSort\" BIGINT NOT NULL DEFAULT 0,\n    \"teknisiName\" TEXT,\n    \"teknisiPhone\" TEXT,\n    \"selesaiLabel\" TEXT,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n    \"propertyId\" TEXT,\n\n    CONSTRAINT \"tickets_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"technician_contacts\" (\n    \"id\" TEXT NOT NULL,\n    \"name\" TEXT NOT NULL,\n    \"phone\" TEXT NOT NULL,\n    \"specialization\" TEXT NOT NULL DEFAULT 'Tukang Bangunan/Umum',\n    \"isPrimary\" BOOLEAN NOT NULL DEFAULT false,\n    \"propertyId\" TEXT,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"technician_contacts_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"cash_entries\" (\n    \"id\" TEXT NOT NULL,\n    \"type\" TEXT NOT NULL DEFAULT 'masuk',\n    \"category\" TEXT NOT NULL,\n    \"description\" TEXT NOT NULL DEFAULT '',\n    \"amount\" INTEGER NOT NULL DEFAULT 0,\n    \"source\" TEXT NOT NULL DEFAULT 'Kas Tunai',\n    \"entryDate\" TIMESTAMP(3),\n    \"dateLabel\" TEXT NOT NULL,\n    \"dateSort\" INTEGER NOT NULL DEFAULT 0,\n    \"attachment\" TEXT,\n    \"propertyId\" TEXT,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n\n    CONSTRAINT \"cash_entries_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"announcements\" (\n    \"id\" TEXT NOT NULL,\n    \"propertyId\" TEXT NOT NULL,\n    \"judul\" TEXT NOT NULL,\n    \"kategori\" TEXT NOT NULL DEFAULT 'info',\n    \"targetFloor\" INTEGER,\n    \"targetTenantId\" TEXT,\n    \"isi\" TEXT NOT NULL DEFAULT '',\n    \"tanggalMulai\" TEXT NOT NULL,\n    \"tanggalBerakhir\" TEXT NOT NULL,\n    \"aktif\" BOOLEAN NOT NULL DEFAULT true,\n    \"createdAtLabel\" TEXT NOT NULL,\n    \"createdAtSort\" BIGINT NOT NULL DEFAULT 0,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"announcements_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"owner_settings\" (\n    \"userId\" TEXT NOT NULL,\n    \"owner\" JSONB,\n    \"propertyExtras\" JSONB,\n    \"properties\" JSONB,\n    \"staff\" JSONB,\n    \"templates\" JSONB,\n    \"facilities\" JSONB,\n    \"theme\" TEXT,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"owner_settings_pkey\" PRIMARY KEY (\"userId\")\n)",
  "ALTER TABLE \"properties\" ADD COLUMN IF NOT EXISTS \"id\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"properties\" ADD COLUMN IF NOT EXISTS \"ownerId\" TEXT",
  "ALTER TABLE \"properties\" ADD COLUMN IF NOT EXISTS \"name\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"properties\" ADD COLUMN IF NOT EXISTS \"tipe\" TEXT NOT NULL DEFAULT 'kost'",
  "ALTER TABLE \"properties\" ADD COLUMN IF NOT EXISTS \"alamat\" TEXT",
  "ALTER TABLE \"properties\" ADD COLUMN IF NOT EXISTS \"fotoUrl\" TEXT",
  "ALTER TABLE \"properties\" ADD COLUMN IF NOT EXISTS \"bankName\" TEXT",
  "ALTER TABLE \"properties\" ADD COLUMN IF NOT EXISTS \"bankAccountNo\" TEXT",
  "ALTER TABLE \"properties\" ADD COLUMN IF NOT EXISTS \"bankAccountName\" TEXT",
  "ALTER TABLE \"properties\" ADD COLUMN IF NOT EXISTS \"qrisImageUrl\" TEXT",
  "ALTER TABLE \"properties\" ADD COLUMN IF NOT EXISTS \"qrisNmid\" TEXT",
  "ALTER TABLE \"properties\" ADD COLUMN IF NOT EXISTS \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"properties\" ADD COLUMN IF NOT EXISTS \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"owner_accounts\" ADD COLUMN IF NOT EXISTS \"id\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"owner_accounts\" ADD COLUMN IF NOT EXISTS \"email\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"owner_accounts\" ADD COLUMN IF NOT EXISTS \"passwordHash\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"owner_accounts\" ADD COLUMN IF NOT EXISTS \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"license_accounts\" ADD COLUMN IF NOT EXISTS \"id\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"license_accounts\" ADD COLUMN IF NOT EXISTS \"email\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"license_accounts\" ADD COLUMN IF NOT EXISTS \"userId\" TEXT",
  "ALTER TABLE \"license_accounts\" ADD COLUMN IF NOT EXISTS \"name\" TEXT",
  "ALTER TABLE \"license_accounts\" ADD COLUMN IF NOT EXISTS \"phone\" TEXT",
  "ALTER TABLE \"license_accounts\" ADD COLUMN IF NOT EXISTS \"isLifetimeLicensed\" BOOLEAN NOT NULL DEFAULT false",
  "ALTER TABLE \"license_accounts\" ADD COLUMN IF NOT EXISTS \"paymentRef\" TEXT",
  "ALTER TABLE \"license_accounts\" ADD COLUMN IF NOT EXISTS \"licensedAt\" TIMESTAMP(3)",
  "ALTER TABLE \"license_accounts\" ADD COLUMN IF NOT EXISTS \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"license_accounts\" ADD COLUMN IF NOT EXISTS \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"license_leads\" ADD COLUMN IF NOT EXISTS \"id\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"license_leads\" ADD COLUMN IF NOT EXISTS \"email\" TEXT",
  "ALTER TABLE \"license_leads\" ADD COLUMN IF NOT EXISTS \"name\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"license_leads\" ADD COLUMN IF NOT EXISTS \"phone\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"license_leads\" ADD COLUMN IF NOT EXISTS \"source\" TEXT NOT NULL DEFAULT 'BAYAR_OTOMATIS'",
  "ALTER TABLE \"license_leads\" ADD COLUMN IF NOT EXISTS \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"license_leads\" ADD COLUMN IF NOT EXISTS \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"license_purchases\" ADD COLUMN IF NOT EXISTS \"id\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"license_purchases\" ADD COLUMN IF NOT EXISTS \"transactionId\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"license_purchases\" ADD COLUMN IF NOT EXISTS \"email\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"license_purchases\" ADD COLUMN IF NOT EXISTS \"name\" TEXT",
  "ALTER TABLE \"license_purchases\" ADD COLUMN IF NOT EXISTS \"phone\" TEXT",
  "ALTER TABLE \"license_purchases\" ADD COLUMN IF NOT EXISTS \"amount\" INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE \"license_purchases\" ADD COLUMN IF NOT EXISTS \"status\" TEXT NOT NULL DEFAULT 'paid'",
  "ALTER TABLE \"license_purchases\" ADD COLUMN IF NOT EXISTS \"eventType\" TEXT",
  "ALTER TABLE \"license_purchases\" ADD COLUMN IF NOT EXISTS \"provider\" TEXT",
  "ALTER TABLE \"license_purchases\" ADD COLUMN IF NOT EXISTS \"autoProvisioned\" BOOLEAN NOT NULL DEFAULT false",
  "ALTER TABLE \"license_purchases\" ADD COLUMN IF NOT EXISTS \"generatedPassword\" TEXT",
  "ALTER TABLE \"license_purchases\" ADD COLUMN IF NOT EXISTS \"rawPayload\" JSONB",
  "ALTER TABLE \"license_purchases\" ADD COLUMN IF NOT EXISTS \"licenseAccountId\" TEXT",
  "ALTER TABLE \"license_purchases\" ADD COLUMN IF NOT EXISTS \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"staff_members\" ADD COLUMN IF NOT EXISTS \"id\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"staff_members\" ADD COLUMN IF NOT EXISTS \"propertyId\" TEXT",
  "ALTER TABLE \"staff_members\" ADD COLUMN IF NOT EXISTS \"name\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"staff_members\" ADD COLUMN IF NOT EXISTS \"phone\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"staff_members\" ADD COLUMN IF NOT EXISTS \"role\" TEXT NOT NULL DEFAULT 'PENJAGA_TEKNISI'",
  "ALTER TABLE \"staff_members\" ADD COLUMN IF NOT EXISTS \"accessToken\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"staff_members\" ADD COLUMN IF NOT EXISTS \"accessPin\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"staff_members\" ADD COLUMN IF NOT EXISTS \"isActive\" BOOLEAN NOT NULL DEFAULT true",
  "ALTER TABLE \"staff_members\" ADD COLUMN IF NOT EXISTS \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"rooms\" ADD COLUMN IF NOT EXISTS \"id\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"rooms\" ADD COLUMN IF NOT EXISTS \"nomor\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"rooms\" ADD COLUMN IF NOT EXISTS \"propertyId\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"rooms\" ADD COLUMN IF NOT EXISTS \"floor\" INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE \"rooms\" ADD COLUMN IF NOT EXISTS \"type\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"rooms\" ADD COLUMN IF NOT EXISTS \"price\" INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE \"rooms\" ADD COLUMN IF NOT EXISTS \"status\" TEXT NOT NULL DEFAULT 'kosong'",
  "ALTER TABLE \"rooms\" ADD COLUMN IF NOT EXISTS \"operational\" TEXT",
  "ALTER TABLE \"rooms\" ADD COLUMN IF NOT EXISTS \"contractDuration\" TEXT",
  "ALTER TABLE \"rooms\" ADD COLUMN IF NOT EXISTS \"contractStart\" TIMESTAMP(3)",
  "ALTER TABLE \"rooms\" ADD COLUMN IF NOT EXISTS \"contractEnd\" TIMESTAMP(3)",
  "ALTER TABLE \"rooms\" ADD COLUMN IF NOT EXISTS \"deposit\" INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE \"rooms\" ADD COLUMN IF NOT EXISTS \"depositHeld\" BOOLEAN NOT NULL DEFAULT false",
  "ALTER TABLE \"rooms\" ADD COLUMN IF NOT EXISTS \"facilities\" JSONB",
  "ALTER TABLE \"rooms\" ADD COLUMN IF NOT EXISTS \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"rooms\" ADD COLUMN IF NOT EXISTS \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"id\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"roomId\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"name\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"phone\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"moveInAt\" TIMESTAMP(3)",
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"emergencyName\" TEXT",
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"emergencyPhone\" TEXT",
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"portalToken\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  // ── Profil lengkap penyewa (modal "Edit Data Penghuni") — kolom kustom JSONB ──
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"occupation\" TEXT",
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"maritalStatus\" TEXT",
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"guardianName\" TEXT",
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"addressKtp\" TEXT",
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"notes\" TEXT",
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"customFields\" JSONB",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"id\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"roomId\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"tenantName\" TEXT",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"tenantPhone\" TEXT",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"roomType\" TEXT",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"periodLabel\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"periodKey\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"dueDate\" TIMESTAMP(3)",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"status\" TEXT NOT NULL DEFAULT 'jatuhTempo'",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"dayOffset\" INTEGER",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"paidAt\" TIMESTAMP(3)",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"total\" INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"checkIn\" TIMESTAMP(3)",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"checkOut\" TIMESTAMP(3)",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"nights\" INTEGER",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  // ── Isolasi multi-cabang: kolom propertyId langsung di tenants & invoices ──
  // NOT NULL DEFAULT '' aman utk tabel berisi (Postgres mengisi baris lama dgn
  // ''), lalu backfill di bawah mengisinya dari kamar masing-masing.
  "ALTER TABLE \"tenants\" ADD COLUMN IF NOT EXISTS \"propertyId\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"invoices\" ADD COLUMN IF NOT EXISTS \"propertyId\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"invoice_lines\" ADD COLUMN IF NOT EXISTS \"invoiceId\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"invoice_lines\" ADD COLUMN IF NOT EXISTS \"label\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"invoice_lines\" ADD COLUMN IF NOT EXISTS \"amount\" INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE \"facilities\" ADD COLUMN IF NOT EXISTS \"id\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"facilities\" ADD COLUMN IF NOT EXISTS \"propertyId\" TEXT",
  "ALTER TABLE \"facilities\" ADD COLUMN IF NOT EXISTS \"group\" TEXT NOT NULL DEFAULT 'unit'",
  "ALTER TABLE \"facilities\" ADD COLUMN IF NOT EXISTS \"label\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"facilities\" ADD COLUMN IF NOT EXISTS \"custom\" BOOLEAN NOT NULL DEFAULT false",
  "ALTER TABLE \"facilities\" ADD COLUMN IF NOT EXISTS \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"id\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"roomId\" TEXT",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"lokasi\" TEXT",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"sumber\" TEXT NOT NULL DEFAULT 'penyewa'",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"judul\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"urgensi\" TEXT NOT NULL DEFAULT 'sedang'",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"reporterName\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"reporterPhone\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"kategori\" TEXT NOT NULL DEFAULT 'Lainnya'",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"deskripsi\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"photos\" JSONB NOT NULL DEFAULT '[]'",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"status\" TEXT NOT NULL DEFAULT 'menunggu'",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"reportedLabel\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"reportedSort\" BIGINT NOT NULL DEFAULT 0",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"teknisiName\" TEXT",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"teknisiPhone\" TEXT",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"selesaiLabel\" TEXT",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"propertyId\" TEXT",
  "ALTER TABLE \"technician_contacts\" ADD COLUMN IF NOT EXISTS \"id\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"technician_contacts\" ADD COLUMN IF NOT EXISTS \"name\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"technician_contacts\" ADD COLUMN IF NOT EXISTS \"phone\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"technician_contacts\" ADD COLUMN IF NOT EXISTS \"specialization\" TEXT NOT NULL DEFAULT 'Tukang Bangunan/Umum'",
  "ALTER TABLE \"technician_contacts\" ADD COLUMN IF NOT EXISTS \"isPrimary\" BOOLEAN NOT NULL DEFAULT false",
  "ALTER TABLE \"technician_contacts\" ADD COLUMN IF NOT EXISTS \"propertyId\" TEXT",
  "ALTER TABLE \"technician_contacts\" ADD COLUMN IF NOT EXISTS \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"technician_contacts\" ADD COLUMN IF NOT EXISTS \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"cash_entries\" ADD COLUMN IF NOT EXISTS \"id\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"cash_entries\" ADD COLUMN IF NOT EXISTS \"type\" TEXT NOT NULL DEFAULT 'masuk'",
  "ALTER TABLE \"cash_entries\" ADD COLUMN IF NOT EXISTS \"category\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"cash_entries\" ADD COLUMN IF NOT EXISTS \"description\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"cash_entries\" ADD COLUMN IF NOT EXISTS \"amount\" INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE \"cash_entries\" ADD COLUMN IF NOT EXISTS \"source\" TEXT NOT NULL DEFAULT 'Kas Tunai'",
  "ALTER TABLE \"cash_entries\" ADD COLUMN IF NOT EXISTS \"entryDate\" TIMESTAMP(3)",
  "ALTER TABLE \"cash_entries\" ADD COLUMN IF NOT EXISTS \"dateLabel\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"cash_entries\" ADD COLUMN IF NOT EXISTS \"dateSort\" INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE \"cash_entries\" ADD COLUMN IF NOT EXISTS \"attachment\" TEXT",
  "ALTER TABLE \"cash_entries\" ADD COLUMN IF NOT EXISTS \"propertyId\" TEXT",
  "ALTER TABLE \"cash_entries\" ADD COLUMN IF NOT EXISTS \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"announcements\" ADD COLUMN IF NOT EXISTS \"id\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"announcements\" ADD COLUMN IF NOT EXISTS \"propertyId\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"announcements\" ADD COLUMN IF NOT EXISTS \"judul\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"announcements\" ADD COLUMN IF NOT EXISTS \"kategori\" TEXT NOT NULL DEFAULT 'info'",
  "ALTER TABLE \"announcements\" ADD COLUMN IF NOT EXISTS \"targetFloor\" INTEGER",
  "ALTER TABLE \"announcements\" ADD COLUMN IF NOT EXISTS \"targetTenantId\" TEXT",
  "ALTER TABLE \"announcements\" ADD COLUMN IF NOT EXISTS \"isi\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"announcements\" ADD COLUMN IF NOT EXISTS \"tanggalMulai\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"announcements\" ADD COLUMN IF NOT EXISTS \"tanggalBerakhir\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"announcements\" ADD COLUMN IF NOT EXISTS \"aktif\" BOOLEAN NOT NULL DEFAULT true",
  "ALTER TABLE \"announcements\" ADD COLUMN IF NOT EXISTS \"createdAtLabel\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"announcements\" ADD COLUMN IF NOT EXISTS \"createdAtSort\" BIGINT NOT NULL DEFAULT 0",
  "ALTER TABLE \"announcements\" ADD COLUMN IF NOT EXISTS \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"announcements\" ADD COLUMN IF NOT EXISTS \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"owner_settings\" ADD COLUMN IF NOT EXISTS \"userId\" TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE \"owner_settings\" ADD COLUMN IF NOT EXISTS \"owner\" JSONB",
  "ALTER TABLE \"owner_settings\" ADD COLUMN IF NOT EXISTS \"propertyExtras\" JSONB",
  "ALTER TABLE \"owner_settings\" ADD COLUMN IF NOT EXISTS \"properties\" JSONB",
  "ALTER TABLE \"owner_settings\" ADD COLUMN IF NOT EXISTS \"staff\" JSONB",
  "ALTER TABLE \"owner_settings\" ADD COLUMN IF NOT EXISTS \"templates\" JSONB",
  "ALTER TABLE \"owner_settings\" ADD COLUMN IF NOT EXISTS \"facilities\" JSONB",
  "ALTER TABLE \"owner_settings\" ADD COLUMN IF NOT EXISTS \"theme\" TEXT",
  "ALTER TABLE \"owner_settings\" ADD COLUMN IF NOT EXISTS \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE \"owner_settings\" ADD COLUMN IF NOT EXISTS \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
  // ── Backfill idempoten (SETELAH semua ALTER — kolom dijamin sudah ada) ────
  // Semua baris tenants/invoices wajib punya property_id (NOT NULL efektif di
  // level aplikasi; FK tidak ditambahkan agar self-heal tak bisa gagal bila
  // ada baris yatim) sehingga SELECT/reset per properti tak perlu join room.
  "UPDATE \"tenants\" SET \"propertyId\" = (SELECT r.\"propertyId\" FROM \"rooms\" r WHERE r.\"id\" = \"tenants\".\"roomId\") WHERE \"propertyId\" = ''",
  "UPDATE \"invoices\" SET \"propertyId\" = (SELECT r.\"propertyId\" FROM \"rooms\" r WHERE r.\"id\" = \"invoices\".\"roomId\") WHERE \"propertyId\" = ''",
  // Backfill tiket lama berbasis kamar (propertyId NULL) — tiket fasilitas tanpa
  // kamar tetap dibiarkan NULL (kolom memang opsional).
  "UPDATE \"tickets\" SET \"propertyId\" = (SELECT r.\"propertyId\" FROM \"rooms\" r WHERE r.\"id\" = \"tickets\".\"roomId\") WHERE \"propertyId\" IS NULL AND \"roomId\" IS NOT NULL",
  // ── Indeks ──
  "CREATE INDEX IF NOT EXISTS \"properties_ownerId_idx\" ON \"properties\"(\"ownerId\")",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"owner_accounts_email_key\" ON \"owner_accounts\"(\"email\")",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"license_accounts_email_key\" ON \"license_accounts\"(\"email\")",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"license_leads_phone_key\" ON \"license_leads\"(\"phone\")",
  "CREATE INDEX IF NOT EXISTS \"license_leads_updatedAt_idx\" ON \"license_leads\"(\"updatedAt\")",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"license_purchases_transactionId_key\" ON \"license_purchases\"(\"transactionId\")",
  "CREATE INDEX IF NOT EXISTS \"license_purchases_email_idx\" ON \"license_purchases\"(\"email\")",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"staff_members_accessToken_key\" ON \"staff_members\"(\"accessToken\")",
  "CREATE INDEX IF NOT EXISTS \"staff_members_propertyId_idx\" ON \"staff_members\"(\"propertyId\")",
  "CREATE INDEX IF NOT EXISTS \"staff_members_isActive_idx\" ON \"staff_members\"(\"isActive\")",
  "CREATE INDEX IF NOT EXISTS \"rooms_propertyId_idx\" ON \"rooms\"(\"propertyId\")",
  "CREATE INDEX IF NOT EXISTS \"rooms_status_idx\" ON \"rooms\"(\"status\")",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"tenants_roomId_key\" ON \"tenants\"(\"roomId\")",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"tenants_portalToken_key\" ON \"tenants\"(\"portalToken\")",
  "CREATE INDEX IF NOT EXISTS \"tenants_propertyId_idx\" ON \"tenants\"(\"propertyId\")",
  "CREATE INDEX IF NOT EXISTS \"invoices_propertyId_idx\" ON \"invoices\"(\"propertyId\")",
  "CREATE INDEX IF NOT EXISTS \"invoices_status_idx\" ON \"invoices\"(\"status\")",
  "CREATE INDEX IF NOT EXISTS \"invoices_periodKey_idx\" ON \"invoices\"(\"periodKey\")",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"invoices_roomId_periodKey_key\" ON \"invoices\"(\"roomId\", \"periodKey\")",
  "CREATE INDEX IF NOT EXISTS \"invoice_lines_invoiceId_idx\" ON \"invoice_lines\"(\"invoiceId\")",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"facilities_group_label_key\" ON \"facilities\"(\"group\", \"label\")",
  "CREATE INDEX IF NOT EXISTS \"tickets_status_idx\" ON \"tickets\"(\"status\")",
  "CREATE INDEX IF NOT EXISTS \"tickets_roomId_idx\" ON \"tickets\"(\"roomId\")",
  "CREATE INDEX IF NOT EXISTS \"tickets_propertyId_idx\" ON \"tickets\"(\"propertyId\")",
  "CREATE INDEX IF NOT EXISTS \"technician_contacts_propertyId_idx\" ON \"technician_contacts\"(\"propertyId\")",
  "CREATE INDEX IF NOT EXISTS \"cash_entries_type_idx\" ON \"cash_entries\"(\"type\")",
  "CREATE INDEX IF NOT EXISTS \"cash_entries_dateSort_idx\" ON \"cash_entries\"(\"dateSort\")",
  "CREATE INDEX IF NOT EXISTS \"cash_entries_propertyId_idx\" ON \"cash_entries\"(\"propertyId\")",
  "CREATE INDEX IF NOT EXISTS \"announcements_propertyId_idx\" ON \"announcements\"(\"propertyId\")",
  "CREATE INDEX IF NOT EXISTS \"announcements_createdAtSort_idx\" ON \"announcements\"(\"createdAtSort\")",
  "CREATE INDEX IF NOT EXISTS \"announcements_targetTenantId_idx\" ON \"announcements\"(\"targetTenantId\")",
  "ALTER TABLE \"license_purchases\" ADD CONSTRAINT \"license_purchases_licenseAccountId_fkey\" FOREIGN KEY (\"licenseAccountId\") REFERENCES \"license_accounts\"(\"id\") ON DELETE SET NULL ON UPDATE CASCADE",
  "ALTER TABLE \"staff_members\" ADD CONSTRAINT \"staff_members_propertyId_fkey\" FOREIGN KEY (\"propertyId\") REFERENCES \"properties\"(\"id\") ON DELETE SET NULL ON UPDATE CASCADE",
  "ALTER TABLE \"rooms\" ADD CONSTRAINT \"rooms_propertyId_fkey\" FOREIGN KEY (\"propertyId\") REFERENCES \"properties\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE",
  "ALTER TABLE \"tenants\" ADD CONSTRAINT \"tenants_roomId_fkey\" FOREIGN KEY (\"roomId\") REFERENCES \"rooms\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE",
  "ALTER TABLE \"invoices\" ADD CONSTRAINT \"invoices_roomId_fkey\" FOREIGN KEY (\"roomId\") REFERENCES \"rooms\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE",
  "ALTER TABLE \"invoice_lines\" ADD CONSTRAINT \"invoice_lines_invoiceId_fkey\" FOREIGN KEY (\"invoiceId\") REFERENCES \"invoices\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE",
  "ALTER TABLE \"facilities\" ADD CONSTRAINT \"facilities_propertyId_fkey\" FOREIGN KEY (\"propertyId\") REFERENCES \"properties\"(\"id\") ON DELETE SET NULL ON UPDATE CASCADE",
  "ALTER TABLE \"tickets\" ADD CONSTRAINT \"tickets_roomId_fkey\" FOREIGN KEY (\"roomId\") REFERENCES \"rooms\"(\"id\") ON DELETE SET NULL ON UPDATE CASCADE",
  "ALTER TABLE \"tickets\" ADD CONSTRAINT \"tickets_propertyId_fkey\" FOREIGN KEY (\"propertyId\") REFERENCES \"properties\"(\"id\") ON DELETE SET NULL ON UPDATE CASCADE",
  "ALTER TABLE \"technician_contacts\" ADD CONSTRAINT \"technician_contacts_propertyId_fkey\" FOREIGN KEY (\"propertyId\") REFERENCES \"properties\"(\"id\") ON DELETE SET NULL ON UPDATE CASCADE",
  "ALTER TABLE \"cash_entries\" ADD CONSTRAINT \"cash_entries_propertyId_fkey\" FOREIGN KEY (\"propertyId\") REFERENCES \"properties\"(\"id\") ON DELETE SET NULL ON UPDATE CASCADE",
  "ALTER TABLE \"announcements\" ADD CONSTRAINT \"announcements_propertyId_fkey\" FOREIGN KEY (\"propertyId\") REFERENCES \"properties\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE",
  "ALTER TABLE \"announcements\" ADD CONSTRAINT \"announcements_targetTenantId_fkey\" FOREIGN KEY (\"targetTenantId\") REFERENCES \"tenants\"(\"id\") ON DELETE SET NULL ON UPDATE CASCADE",
];

let schemaPromise: Promise<void> | null = null;

/**
 * Pastikan skema database sinkron dengan schema.prisma. Memoisasi promise per
 * proses → request paralel hanya memicu satu probe. Gagal → memo di-reset agar
 * request berikutnya mencoba lagi (mis. DB sesaat tidak terjangkau).
 * Setelah skema terjamin, normalisasi data kamar (backfill kolom nomor +
 * buka suffix "(n)" data lama) dijalankan sekali per proses — higienitas
 * data yang TIDAK pernah melempar error.
 */
export function ensureSchema(): Promise<void> {
  schemaPromise ??= (async () => {
    await runEnsureSchema();
    await ensureRoomsNormalized();
  })().catch((err) => {
    schemaPromise = null;
    throw err;
  });
  return schemaPromise;
}

/** Klien khusus DDL lewat DIRECT_URL (koneksi langsung) — fallback db utama */
let ddlPrisma: PrismaClient | null = null;

function ddlClient(): PrismaClient {
  const direct = process.env.DIRECT_URL;
  if (direct?.startsWith("postgres")) {
    ddlPrisma ??= new PrismaClient({
      datasources: { db: { url: direct } },
      log: ["error"],
    });
    return ddlPrisma;
  }
  return db;
}

function isDuplicateError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  // Postgres 42710/42P07/42701 — "… already exists" (constraint/indeks/kolom)
  return /already exists/i.test(message);
}

async function runEnsureSchema(): Promise<void> {
  const client = ddlClient();
  try {
    const rows = await client.$queryRawUnsafe<{ col: string }[]>(PROBE_SQL);
    const actual = new Set(rows.map((r) => r.col));
    const missing: string[] = [];
    for (const expectedCol of EXPECTED_COLUMNS) {
      if (!actual.has(expectedCol)) missing.push(expectedCol);
    }
    if (missing.length === 0) return; // skema lengkap — tidak ada yang dilakukan

    console.warn(
      "[UnitKu DB] Skema database belum sinkron dengan Prisma — jalankan self-heal DDL…",
    );
    console.warn(
      "  Kolom/tabel kurang:",
      missing.slice(0, 12).join(", "),
      missing.length > 12 ? "(+" + String(missing.length - 12) + " lagi)" : "",
    );
    let applied = 0;
    let skipped = 0;
    for (const sql of SCHEMA_DDL) {
      try {
        await client.$executeRawUnsafe(sql);
        applied += 1;
      } catch (err) {
        if (isDuplicateError(err)) {
          skipped += 1;
          continue;
        }
        console.error("[UnitKu DB] Gagal DDL self-heal:", sql.slice(0, 120), err);
        throw err;
      }
    }
    console.log(
      "[UnitKu DB] Self-heal skema selesai — " +
        String(applied) +
        " pernyataan diterapkan, " +
        String(skipped) +
        " dilewati (sudah ada).",
    );
  } finally {
    if (ddlPrisma && client !== db) {
      await ddlPrisma.$disconnect().catch(() => undefined);
      ddlPrisma = null;
    }
  }
}
