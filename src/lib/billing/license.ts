// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Core lisensi SaaS "Jual Putus" (server-only)
//
// Alur webhook Mayar (payment.received):
//   1. Idempotensi — transactionId unik di license_purchases.
//   2. Provisioning akun owner:
//        • Mode Supabase → supabase.auth.admin.createUser (password acak aman).
//        • Mode lokal    → OwnerAccount (scrypt) — sandbox/dev.
//      Akun yang sudah terdaftar tidak dibuat ulang, cukup dilisensikan.
//   3. license_accounts diset isLifetimeLicensed = true + paymentRef.
//   4. Histori pembelian dicatat ke license_purchases.
//
// Catatan desain: "profil default" pembeli = baris license_accounts (level
// akun/email). Properti kost pertama tetap dibuat lewat /onboarding agar nama
// kost & jumlah kamar ditentukan owner sendiri (alur Task 57 dipertahankan).
// ─────────────────────────────────────────────────────────────────────────────

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getAuthMode } from "@/lib/auth/config";
import { hashPassword } from "@/lib/auth/local";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Password acak aman (16 karakter url-safe, entropy ±96 bit) */
export function generateSecurePassword(): string {
  return randomBytes(12).toString("base64url");
}

/** Tautan checkout Mayar lisensi seumur hidup (kosong bila belum dikonfigurasi) */
export function getMayarCheckoutUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MAYAR_CHECKOUT_URL ??
    process.env.MAYAR_CHECKOUT_URL ??
    ""
  );
}

export interface MayarPaymentData {
  email: string;
  name?: string;
  phone?: string;
  amount: number;
  transactionId: string;
  eventType?: string;
  raw?: unknown;
}

export interface ApplyLicenseResult {
  /** true = akun owner baru dibuat otomatis */
  created: boolean;
  /** true = transactionId sudah pernah diproses (idempotensi) */
  duplicate: boolean;
}

/**
 * Terapkan lisensi seumur hidup untuk satu pembayaran Mayar.
 * Aman dipanggil berulang untuk transactionId yang sama (idempoten).
 */
export async function applyPaidLicense(
  payment: MayarPaymentData,
): Promise<ApplyLicenseResult> {
  const email = normalizeEmail(payment.email);

  // ── 1. Idempotensi — event yang sama tidak diproses dua kali ──────────────
  const existing = await prisma.licensePurchase.findUnique({
    where: { transactionId: payment.transactionId },
    select: { id: true },
  });
  if (existing) return { created: false, duplicate: true };

  // ── 2. Provisioning akun owner ────────────────────────────────────────────
  let created = false;
  let userId: string | null = null;
  let generatedPassword: string | null = null;

  if (getAuthMode() === "supabase") {
    const admin = getSupabaseAdmin();
    if (admin) {
      const password = generateSecurePassword();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: payment.name ?? null,
          phone: payment.phone ?? null,
          source: "mayar-webhook",
        },
      });
      if (error) {
        const detail = `${error.code ?? ""} ${error.message}`.toLowerCase();
        if (detail.includes("already") || error.status === 422) {
          // Email sudah terdaftar di Supabase Auth → cukup dilisensikan
          console.log(`[UnitKu Billing] Akun Supabase sudah ada: ${email}`);
        } else {
          // Gagal lain — lisensi tetap dicatat (berbasis email), akun menyusul manual
          console.error(
            "[UnitKu Billing] supabase.auth.admin.createUser gagal:",
            error.message,
          );
        }
      } else {
        created = true;
        userId = data.user?.id ?? null;
        generatedPassword = password;
      }
    }
    // admin null → SERVICE_ROLE_KEY belum diisi; log sudah dikeluarkan helper
  } else {
    // Mode lokal (sandbox/dev) — OwnerAccount scrypt
    const account = await prisma.ownerAccount.findUnique({ where: { email } });
    if (account) {
      userId = account.id;
    } else {
      const password = generateSecurePassword();
      const newAccount = await prisma.ownerAccount.create({
        data: { email, passwordHash: hashPassword(password) },
      });
      created = true;
      userId = newAccount.id;
      generatedPassword = password;
    }
  }

  // ── 3. Tandai lisensi seumur hidup pada profil akun ───────────────────────
  const licensedAt = new Date();
  const licenseAccount = await prisma.licenseAccount.upsert({
    where: { email },
    create: {
      email,
      userId,
      name: payment.name ?? null,
      phone: payment.phone ?? null,
      isLifetimeLicensed: true,
      paymentRef: payment.transactionId,
      licensedAt,
    },
    update: {
      isLifetimeLicensed: true,
      paymentRef: payment.transactionId,
      licensedAt,
      ...(userId ? { userId } : {}),
      ...(payment.name ? { name: payment.name } : {}),
      ...(payment.phone ? { phone: payment.phone } : {}),
    },
  });

  // ── 4. Catat histori pembelian ────────────────────────────────────────────
  try {
    await prisma.licensePurchase.create({
      data: {
        transactionId: payment.transactionId,
        email,
        name: payment.name ?? null,
        phone: payment.phone ?? null,
        amount: payment.amount,
        status: "paid",
        eventType: payment.eventType ?? null,
        provider: "MAYAR_WEBHOOK",
        autoProvisioned: created,
        generatedPassword,
        rawPayload:
          payment.raw === undefined || payment.raw === null
            ? Prisma.DbNull
            : (payment.raw as Prisma.InputJsonValue),
        licenseAccountId: licenseAccount.id,
      },
    });
  } catch (error) {
    // P2002 = balapan webhook: baris sudah dibuat request lain → anggap duplikat
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return { created: false, duplicate: true };
    }
    throw error;
  }

  return { created, duplicate: false };
}

/** Status lisensi untuk sebuah email (null bila belum pernah tercatat) */
export async function getLicenseByEmail(email: string) {
  return prisma.licenseAccount.findUnique({
    where: { email: normalizeEmail(email) },
  });
}

// ── Lead calon pembeli (license_leads) ───────────────────────────────────────

export type LicenseLeadSource = "BAYAR_OTOMATIS" | "PESAN_MANUAL" | "REGISTER";

let leadTableReady: Promise<void> | null = null;

/**
 * Jaminan tabel `license_leads` tersedia — self-heal untuk database produksi
 * yang belum menjalankan `prisma db push` setelah model LicenseLead ditambahkan.
 * Idempoten (CREATE TABLE / INDEX IF NOT EXISTS) dan hanya dieksekusi sekali
 * per proses; cache dibatalkan saat gagal agar dicoba ulang di request berikut.
 */
async function ensureLicenseLeadTable(): Promise<void> {
  if (!leadTableReady) {
    leadTableReady = (async () => {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "license_leads" (
           "id"        TEXT        NOT NULL,
           "email"     TEXT        NOT NULL,
           "name"      TEXT        NOT NULL,
           "phone"     TEXT        NOT NULL,
           "source"    TEXT        NOT NULL DEFAULT 'BAYAR_OTOMATIS',
           "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
           "updatedAt" TIMESTAMP(3) NOT NULL,
           CONSTRAINT "license_leads_pkey" PRIMARY KEY ("id")
         )`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "license_leads_email_key"
           ON "license_leads"("email")`,
      );
    })().catch((err) => {
      leadTableReady = null; // izinkan retry pada request berikutnya
      throw err;
    });
  }
  await leadTableReady;
}

/**
 * Simpan/perbarui lead calon pembeli lisensi — SATU baris per email (upsert)
 * agar admin selalu punya data kontak terbaru meski pembayaran belum selesai.
 * Melempar error bila DB gagal — pemanggil (checkout/register/WA manual) yang
 * memutuskan apakah kegagalan ini memblokir alur utama (umumnya tidak).
 */
export async function upsertLicenseLead(input: {
  name: string;
  email: string;
  /** Nomor WhatsApp TERNORMALISASI 62xxxxxxxxxx (normalizeWaPhone) */
  phone: string;
  source: LicenseLeadSource;
}): Promise<void> {
  await ensureLicenseLeadTable();
  const email = normalizeEmail(input.email);
  await prisma.licenseLead.upsert({
    where: { email },
    create: { email, name: input.name, phone: input.phone, source: input.source },
    update: { name: input.name, phone: input.phone, source: input.source },
  });
}
