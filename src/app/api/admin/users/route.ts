// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/users — Panel Super Admin (server-only, role guard ketat)
//
//  GET    → daftar seluruh pengguna/owner + status lisensi + sumber lisensi
//  POST   → "+ Tambah Pengguna Manual (Bypass Mayar)": buat akun Supabase Auth
//           (email_confirm: true) + record Property + lisensi lifetime opsional
//           + catat license_purchases (provider: "MANUAL_SUPER_ADMIN")
//  PATCH  → toggle lisensi seumur hidup instan per email
//  DELETE → hapus akun (auth + data lisensi); data properti dipertahankan
//           (ownerId dikosongkan) untuk audit/pemulihan
//
// Semua method wajib lolos requireSuperAdminUser() — sesi tervalidasi penuh
// (bukan sekadar keberadaan cookie) dan email harus terdaftar di
// SUPER_ADMIN_EMAILS. 401 = belum masuk, 403 = bukan super admin.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "@/lib/prisma";
import { getAuthMode } from "@/lib/auth/config";
import { hashPassword } from "@/lib/auth/local";
import { isSuperAdminEmail, requireSuperAdminUser } from "@/lib/auth/super-admin";
import { generateSecurePassword, normalizeEmail } from "@/lib/billing/license";
import {
  findSupabaseUserIdByEmail,
  getSupabaseAdmin,
  listAllSupabaseUsers,
} from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** id properti unik — konsisten dengan /api/onboarding ("prop_xxxxxxxx") */
async function nextPropertyId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = `prop_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const exists = await db.property.findUnique({ where: { id } });
    if (!exists) return id;
  }
  return `prop_${randomUUID().replace(/-/g, "")}`;
}

/** id transaksi manual — unik utk license_purchases.transactionId */
function nextManualTransactionId(): string {
  return `MANUAL-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

// ── GET — daftar seluruh pengguna ────────────────────────────────────────────

interface AdminUserRow {
  id: string | null;
  email: string;
  name: string | null;
  registeredAt: string | null;
  properties: string[];
  licensed: boolean;
  licensedAt: string | null;
  source: "mayar" | "manual" | null;
  isSuperAdmin: boolean;
}

export async function GET() {
  const guard = await requireSuperAdminUser();
  if (!guard.ok) {
    return NextResponse.json({ error: "Akses ditolak — khusus Super Admin." }, { status: guard.status });
  }

  const mode = getAuthMode();
  const supabaseMode = mode === "supabase";

  // 1. Seluruh akun auth — sumber utama daftar pengguna
  interface AuthAccount {
    id: string | null;
    email: string;
    name: string | null;
    registeredAt: string | null;
  }
  const accounts = new Map<string, AuthAccount>();

  if (supabaseMode) {
    for (const u of await listAllSupabaseUsers()) {
      if (!u.email) continue;
      accounts.set(u.email, {
        id: u.id,
        email: u.email,
        name: u.fullName,
        registeredAt: u.createdAt,
      });
    }
  } else {
    const locals = await db.ownerAccount.findMany({
      select: { id: true, email: true, createdAt: true },
    });
    for (const a of locals) {
      accounts.set(a.email, {
        id: a.id,
        email: a.email,
        name: null,
        registeredAt: a.createdAt.toISOString(),
      });
    }
  }

  // 2. Profil lisensi level akun
  const licenses = await db.licenseAccount.findMany();
  for (const lic of licenses) {
    const email = lic.email.trim().toLowerCase();
    const existing = accounts.get(email);
    if (existing) {
      if (!existing.name && lic.name) existing.name = lic.name;
      if (!existing.registeredAt) existing.registeredAt = lic.createdAt.toISOString();
      if (!existing.id && lic.userId) existing.id = lic.userId;
    } else {
      accounts.set(email, {
        id: lic.userId,
        email,
        name: lic.name,
        registeredAt: lic.createdAt.toISOString(),
      });
    }
  }

  // 3. Properti per owner + sumber lisensi (pembelian terbaru per email)
  const [properties, purchases] = await Promise.all([
    db.property.findMany({
      select: { ownerId: true, name: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.licensePurchase.findMany({
      select: { email: true, provider: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const propsByOwner = new Map<string, string[]>();
  for (const p of properties) {
    if (!p.ownerId) continue;
    const list = propsByOwner.get(p.ownerId) ?? [];
    list.push(p.name);
    propsByOwner.set(p.ownerId, list);
  }

  const sourceByEmail = new Map<string, "mayar" | "manual">();
  for (const purchase of purchases) {
    const email = purchase.email.trim().toLowerCase();
    if (sourceByEmail.has(email)) continue; // sudah terisi dgn yang terbaru
    sourceByEmail.set(email, purchase.provider === "MANUAL_SUPER_ADMIN" ? "manual" : "mayar");
  }

  const licByEmail = new Map(licenses.map((l) => [l.email.trim().toLowerCase(), l]));

  const users: AdminUserRow[] = [...accounts.values()]
    .map((a) => {
      const lic = licByEmail.get(a.email);
      return {
        id: a.id,
        email: a.email,
        name: a.name,
        registeredAt: a.registeredAt,
        properties: a.id ? (propsByOwner.get(a.id) ?? []) : [],
        licensed: lic?.isLifetimeLicensed === true,
        licensedAt: lic?.licensedAt?.toISOString() ?? null,
        source: sourceByEmail.get(a.email) ?? null,
        isSuperAdmin: isSuperAdminEmail(a.email),
      };
    })
    .sort((a, b) => {
      const ta = a.registeredAt ? Date.parse(a.registeredAt) : 0;
      const tb = b.registeredAt ? Date.parse(b.registeredAt) : 0;
      return tb - ta || a.email.localeCompare(b.email);
    });

  return NextResponse.json({ mode, users });
}

// ── POST — tambah pengguna manual (bypass Mayar) ─────────────────────────────

export async function POST(request: NextRequest) {
  const guard = await requireSuperAdminUser();
  if (!guard.ok) {
    return NextResponse.json({ error: "Akses ditolak — khusus Super Admin." }, { status: guard.status });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  const propertyName = typeof body.propertyName === "string" ? body.propertyName.trim() : "";
  const passwordInput = typeof body.password === "string" ? body.password.trim() : "";
  const generate = body.generate === true;
  const lifetime = body.lifetime !== false; // checkbox default tercentang

  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: "Nama lengkap owner wajib diisi (2–80 karakter)." }, { status: 400 });
  }
  const email = normalizeEmail(emailRaw);
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
  }
  if (propertyName.length < 2 || propertyName.length > 80) {
    return NextResponse.json({ error: "Nama kost/properti awal wajib diisi (2–80 karakter)." }, { status: 400 });
  }
  const password = generate || passwordInput.length === 0 ? generateSecurePassword() : passwordInput;
  if (password.length < 6) {
    return NextResponse.json({ error: "Password awal minimal 6 karakter." }, { status: 400 });
  }

  // ── 1. Provisioning akun auth (email_confirm: true — tanpa verifikasi manual)
  let userId: string;
  const created = true;

  if (getAuthMode() === "supabase") {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi — provisioning admin tidak tersedia." },
        { status: 503 },
      );
    }
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, source: "manual-super-admin" },
    });
    if (error) {
      const detail = `${error.code ?? ""} ${error.message}`.toLowerCase();
      if (detail.includes("already") || error.status === 422) {
        return NextResponse.json(
          { error: "Email sudah terdaftar — gunakan aksi Ubah Lisensi / Reset Password pada tabel." },
          { status: 409 },
        );
      }
      console.error("[api/admin/users POST] createUser gagal:", error.message);
      return NextResponse.json({ error: `Gagal membuat akun Supabase: ${error.message}` }, { status: 502 });
    }
    userId = data.user?.id ?? "";
    if (!userId) {
      return NextResponse.json({ error: "Supabase tidak mengembalikan id user." }, { status: 502 });
    }
  } else {
    // Mode lokal — OwnerAccount scrypt
    const existing = await db.ownerAccount.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar — gunakan aksi Ubah Lisensi / Reset Password pada tabel." },
        { status: 409 },
      );
    }
    const account = await db.ownerAccount.create({
      data: { email, passwordHash: hashPassword(password) },
    });
    userId = account.id;
  }

  try {
    // ── 2. Record properti awal milik owner baru ────────────────────────────
    const property = await db.property.create({
      data: { id: await nextPropertyId(), ownerId: userId, name: propertyName, tipe: "kost" },
    });

    // ── 3. Lisensi seumur hidup (bila dicentang) + audit license_purchases ──
    if (lifetime) {
      const licenseAccount = await db.licenseAccount.upsert({
        where: { email },
        create: {
          email,
          userId,
          name,
          isLifetimeLicensed: true,
          licensedAt: new Date(),
          paymentRef: null,
        },
        update: { isLifetimeLicensed: true, licensedAt: new Date(), ...(name ? { name } : {}), userId },
      });
      await db.licensePurchase.create({
        data: {
          transactionId: nextManualTransactionId(),
          email,
          name,
          amount: 0,
          status: "manual",
          eventType: "manual-provisioning",
          provider: "MANUAL_SUPER_ADMIN",
          autoProvisioned: created,
          licenseAccountId: licenseAccount.id,
        },
      });
    } else {
      // Profil lisensi tetap dibuat (status terkunci) agar muncul rapi di panel
      await db.licenseAccount.upsert({
        where: { email },
        create: { email, userId, name, isLifetimeLicensed: false, licensedAt: null, paymentRef: null },
        update: { name, userId },
      });
    }

    return NextResponse.json(
      {
        user: { id: userId, email, name },
        property: { id: property.id, name: property.name },
        licensed: lifetime,
        credentials: { email, password },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api/admin/users POST]", err);
    return NextResponse.json(
      { error: "Akun dibuat, namun gagal menyiapkan properti/lisensi — periksa panel dan lengkapi manual." },
      { status: 500 },
    );
  }
}

// ── PATCH — toggle lisensi seumur hidup instan ───────────────────────────────

export async function PATCH(request: NextRequest) {
  const guard = await requireSuperAdminUser();
  if (!guard.ok) {
    return NextResponse.json({ error: "Akses ditolak — khusus Super Admin." }, { status: guard.status });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const emailRaw = typeof body.email === "string" ? body.email : "";
  const licensed = body.licensed === true;
  const email = normalizeEmail(emailRaw);
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
  }

  try {
    const existing = await db.licenseAccount.findUnique({ where: { email } });
    const data = await db.licenseAccount.upsert({
      where: { email },
      create: { email, isLifetimeLicensed: licensed, licensedAt: licensed ? new Date() : null },
      update: {
        isLifetimeLicensed: licensed,
        // Saat mencabut lisensi, licensedAt (histori aktivasi pertama) dipertahankan
        ...(licensed && !existing?.licensedAt ? { licensedAt: new Date() } : {}),
      },
    });
    return NextResponse.json({
      email: data.email,
      licensed: data.isLifetimeLicensed,
      licensedAt: data.licensedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("[api/admin/users PATCH]", err);
    return NextResponse.json({ error: "Gagal mengubah status lisensi." }, { status: 500 });
  }
}

// ── DELETE — hapus akun (auth + lisensi; data properti dipertahankan) ────────

export async function DELETE(request: NextRequest) {
  const guard = await requireSuperAdminUser();
  if (!guard.ok) {
    return NextResponse.json({ error: "Akses ditolak — khusus Super Admin." }, { status: guard.status });
  }

  const email = normalizeEmail(request.nextUrl.searchParams.get("email") ?? "");
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Parameter email wajib diisi dan valid." }, { status: 400 });
  }
  if (email === guard.user.email.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "Tidak dapat menghapus akun Anda sendiri dari panel." },
      { status: 400 },
    );
  }

  try {
    const license = await db.licenseAccount.findUnique({ where: { email } });
    let userId = license?.userId ?? null;

    if (getAuthMode() === "supabase") {
      const admin = getSupabaseAdmin();
      if (!admin) {
        return NextResponse.json(
          { error: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi — hapus akun tidak tersedia." },
          { status: 503 },
        );
      }
      if (!userId) userId = await findSupabaseUserIdByEmail(email);
      if (userId) {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) {
          console.error("[api/admin/users DELETE] deleteUser gagal:", error.message);
          return NextResponse.json({ error: `Gagal menghapus akun Supabase: ${error.message}` }, { status: 502 });
        }
      }
    } else {
      const account = await db.ownerAccount.findUnique({ where: { email }, select: { id: true } });
      if (account) {
        userId = account.id;
        await db.ownerAccount.delete({ where: { id: account.id } });
      }
    }

    // Data lisensi level akun dihapus; histori pembelian tetap (FK SetNull) utk audit
    if (license) {
      await db.licenseAccount.delete({ where: { id: license.id } });
    }
    // Data properti dipertahankan — kepemilikan dikosongkan
    if (userId) {
      await db.property.updateMany({ where: { ownerId: userId }, data: { ownerId: null } });
    }

    return NextResponse.json({ success: true, email, authDeleted: Boolean(userId) });
  } catch (err) {
    console.error("[api/admin/users DELETE]", err);
    return NextResponse.json({ error: "Gagal menghapus akun." }, { status: 500 });
  }
}
