// ─────────────────────────────────────────────────────────────────────────────
// /api/settings — Pengaturan owner di cloud (sinkron lintas perangkat)
//
// Akar masalah yang diperbaiki: seluruh modul Pengaturan (Profil Saya, Profil
// Properti non-Property, Staf, Template WA, Fasilitas, Tema) sebelumnya HANYA
// tersimpan di localStorage — ganti perangkat / clear storage / login ulang
// di hari lain menampilkan data dummy bawaan.
//
// GET  : sesi owner riil → bagian settings tersimpan (per user.id) + default
//        profil dari akun (email sesi, nama/WA dari lisensi & metadata auth).
//        Sesi demo → { demo: true } (demo tetap murni localStorage).
//        Tabel belum dibuat (SQL owner_settings belum dijalankan) →
//        { degraded: true, settings: null } — TIDAK 500, klien tetap lokal.
// PUT  : simpan bagian settings ke owner_settings (upsert per userId) +
//        CERMINKAN field yang memang milik tabel properties (nama properti,
//        tipe, alamat, foto fasad, rekening, QRIS) agar satu sumber kebenaran.
//
// Keamanan: wajib sesi (getAuthUser), data di-scoped user.id, email profil
// dipaksa = email sesi (profil email TIDAK bisa diubah via endpoint ini).
// ═════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth/server";
import { getActiveOwnedProperty, unauthorized } from "@/lib/auth/ownership";
import { findSupabaseUserIdByEmail, getSupabaseAdmin } from "@/lib/supabase-admin";
import { PROPERTY_TYPES, THEME_KEYS } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

/* ── Util kecil ─────────────────────────────────────────────────────────── */

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

function strOrNull(value: unknown): string | null {
  const s = str(value);
  return s ? s : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** String non-kosong dari nilai JSONB — selain itu undefined */
function jsonStr(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Ambil nama & No. WA profil akun (lisensi → metadata auth) utk prefill */
async function accountProfile(email: string): Promise<{ nama: string | null; whatsapp: string | null }> {
  try {
    const lic = await db.licenseAccount.findUnique({
      where: { email },
      select: { name: true, phone: true },
    });
    if (lic?.name || lic?.phone) {
      return { nama: lic.name ?? null, whatsapp: lic.phone ?? null };
    }
  } catch {
    /* lisensi gagal dibaca — bukan halangan, lanjut ke metadata auth */
  }
  try {
    const admin = getSupabaseAdmin();
    if (admin) {
      const userId = await findSupabaseUserIdByEmail(email);
      if (userId) {
        const { data } = await admin.auth.admin.getUserById(userId);
        const meta = data?.user?.user_metadata as Record<string, unknown> | undefined;
        const nama = typeof meta?.full_name === "string" ? meta.full_name : null;
        const phone = typeof meta?.phone === "string" ? meta.phone : null;
        return { nama, whatsapp: phone };
      }
    }
  } catch {
    /* metadata auth tidak tersedia — abaikan */
  }
  return { nama: null, whatsapp: null };
}

/* ── GET ────────────────────────────────────────────────────────────────── */

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  // Sesi demo tidak pernah menyentuh cloud — pengaturannya murni perangkat.
  if (user.demo) {
    return NextResponse.json({ demo: true, settings: null });
  }

  try {
    const row = await db.ownerSetting.findUnique({ where: { userId: user.id } });
    const profile = await accountProfile(user.email);
    const savedOwner = isRecord(row?.owner) ? row.owner : null;

    return NextResponse.json({
      demo: false,
      degraded: false,
      settings: {
        // Email SELALU email sesi — konsisten lintas perangkat.
        owner: {
          nama: jsonStr(savedOwner?.nama) ?? profile.nama ?? undefined,
          email: user.email,
          whatsapp: jsonStr(savedOwner?.whatsapp) ?? profile.whatsapp ?? undefined,
        },
        propertyExtras: row?.propertyExtras ?? null,
        properties: row?.properties ?? null,
        staff: row?.staff ?? null,
        templates: row?.templates ?? null,
        facilities: row?.facilities ?? null,
        theme: row?.theme ?? null,
      },
    });
  } catch (err) {
    // Tabel owner_settings belum ada (P2021) / DB gagal — panel tetap jalan
    // dengan localStorage; buat tabel via sql/owner-settings-table.sql.
    console.error(
      "[api/settings GET] owner_settings belum tersedia — klien tetap memakai pengaturan lokal:",
      err,
    );
    return NextResponse.json({ demo: false, degraded: true, settings: null });
  }
}

/* ── PUT ────────────────────────────────────────────────────────────────── */

interface SettingsPutBody {
  owner?: Record<string, unknown>;
  propertyProfile?: Record<string, unknown>;
  rekening?: Record<string, unknown>;
  properties?: unknown;
  staff?: unknown;
  templates?: Record<string, unknown>;
  facilities?: Record<string, unknown>;
  theme?: unknown;
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (user.demo) {
    return NextResponse.json(
      { error: "Mode demo tidak menyimpan pengaturan ke cloud." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as SettingsPutBody;
  const email = user.email;

  // ── Data JSON owner_settings ─────────────────────────────────────────────
  const ownerJson = isRecord(body.owner)
    ? {
        nama: str(body.owner.nama) ?? "",
        email, // dipaksa email sesi — endpoint ini tidak mengubah email akun
        whatsapp: str(body.owner.whatsapp) ?? "",
      }
    : undefined;

  // Profil Properti: core (nama/tipe/alamat/fotoUrl) → tabel properties,
  // sisanya (lantai/jamMalam/aturan) → JSON owner_settings.
  let propertyMirror: { name?: string; tipe?: string; alamat?: string | null; fotoUrl?: string | null } | null = null;
  let propertyExtrasJson: Record<string, string> | undefined;
  if (isRecord(body.propertyProfile)) {
    const pp = body.propertyProfile;
    const name = str(pp.nama);
    const tipe = str(pp.tipe);
    propertyMirror = {
      ...(name ? { name } : {}),
      ...(tipe && (PROPERTY_TYPES as readonly string[]).includes(tipe) ? { tipe } : {}),
      ...(pp.alamat !== undefined ? { alamat: strOrNull(pp.alamat) } : {}),
      ...(pp.fotoUrl !== undefined ? { fotoUrl: strOrNull(pp.fotoUrl) } : {}),
    };
    const extras: Record<string, string> = {};
    const lantai = str(pp.lantai);
    const jamMalam = str(pp.jamMalam);
    const aturan = str(pp.aturan);
    if (lantai !== undefined) extras.lantai = lantai;
    if (jamMalam !== undefined) extras.jamMalam = jamMalam;
    if (aturan !== undefined) extras.aturan = aturan;
    if (Object.keys(extras).length > 0) propertyExtrasJson = extras;
  }

  // Rekening & QRIS — milik tabel properties (dipakai portal & pesan WA).
  let rekeningMirror: {
    bankName?: string | null;
    bankAccountNo?: string | null;
    bankAccountName?: string | null;
    qrisImageUrl?: string | null;
    qrisNmid?: string | null;
  } | null = null;
  if (isRecord(body.rekening)) {
    const r = body.rekening;
    rekeningMirror = {
      ...(r.bank !== undefined ? { bankName: strOrNull(r.bank) } : {}),
      ...(r.noRek !== undefined ? { bankAccountNo: strOrNull(r.noRek) } : {}),
      ...(r.atasNama !== undefined ? { bankAccountName: strOrNull(r.atasNama) } : {}),
      ...(r.qrisImageUrl !== undefined ? { qrisImageUrl: strOrNull(r.qrisImageUrl) } : {}),
      ...(r.qrisNmid !== undefined ? { qrisNmid: strOrNull(r.qrisNmid) } : {}),
    };
  }

  const asArray = (value: unknown): Prisma.InputJsonValue | undefined =>
    Array.isArray(value) ? (value as Prisma.InputJsonValue) : undefined;
  const asObject = (value: unknown): Prisma.InputJsonValue | undefined =>
    isRecord(value) ? (value as Prisma.InputJsonValue) : undefined;

  const themeRaw = str(body.theme);
  const theme = themeRaw && (THEME_KEYS as readonly string[]).includes(themeRaw) ? themeRaw : undefined;

  try {
    // ── 1. Cermin ke tabel properties (sumber kebenaran identitas & rekening)
    if ((propertyMirror && Object.keys(propertyMirror).length > 0) || rekeningMirror) {
      const property = await getActiveOwnedProperty(user);
      if (property) {
        await db.property.update({
          where: { id: property.id },
          data: { ...(propertyMirror ?? {}), ...(rekeningMirror ?? {}) },
        });
      }
      // Belum onboarding → tidak ada yang dicerminkan; settings JSON tetap disimpan
    }

    // ── 2. Upsert owner_settings (satu baris per owner)
    await db.ownerSetting.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...(ownerJson ? { owner: ownerJson as Prisma.InputJsonValue } : {}),
        ...(propertyExtrasJson ? { propertyExtras: propertyExtrasJson as Prisma.InputJsonValue } : {}),
        ...(asArray(body.properties) !== undefined ? { properties: asArray(body.properties) } : {}),
        ...(asArray(body.staff) !== undefined ? { staff: asArray(body.staff) } : {}),
        ...(asObject(body.templates) !== undefined ? { templates: asObject(body.templates) } : {}),
        ...(asObject(body.facilities) !== undefined ? { facilities: asObject(body.facilities) } : {}),
        ...(theme ? { theme } : {}),
      },
      update: {
        ...(ownerJson ? { owner: ownerJson as Prisma.InputJsonValue } : {}),
        ...(propertyExtrasJson ? { propertyExtras: propertyExtrasJson as Prisma.InputJsonValue } : {}),
        ...(asArray(body.properties) !== undefined ? { properties: asArray(body.properties) } : {}),
        ...(asArray(body.staff) !== undefined ? { staff: asArray(body.staff) } : {}),
        ...(asObject(body.templates) !== undefined ? { templates: asObject(body.templates) } : {}),
        ...(asObject(body.facilities) !== undefined ? { facilities: asObject(body.facilities) } : {}),
        ...(theme ? { theme } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Tabel belum dibuat (P2021) dsb. — klien tetap menyimpan lokal & akan
    // mencoba sinkron ulang pada edit/kunjungan berikutnya.
    console.error("[api/settings PUT] Gagal menyimpan pengaturan ke cloud:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan pengaturan ke cloud — jalankan sql/owner-settings-table.sql di Supabase." },
      { status: 500 },
    );
  }
}
