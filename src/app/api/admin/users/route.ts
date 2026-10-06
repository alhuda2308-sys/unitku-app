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
import {
  isPhoneEmail,
  phoneEmailToPhone,
  phoneToEmail,
} from "@/lib/auth/phone-email";
import { isSuperAdminEmail, requireSuperAdminUser } from "@/lib/auth/super-admin";
import { normalizeWaPhone } from "@/lib/checkout-validation";
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
  /** Identitas baris stabil utk React key & aksi panel — "email:{email}" | "lead:{id}" */
  key: string;
  id: string | null;
  /** null = lead zero-friction tanpa email (hanya Nama + No. WhatsApp) —
   *  panel menampilkannya "(Tanpa Email)" agar tabel tetap rapi. */
  email: string | null;
  name: string | null;
  phone: string | null; // No. WhatsApp ternormalisasi 62… (dari lead/license/metadata)
  registeredAt: string | null;
  properties: string[];
  licensed: boolean;
  licensedAt: string | null;
  source: "mayar" | "manual" | null;
  isSuperAdmin: boolean;
}

/** Susun daftar pengguna dari semua sumber (auth + lisensi + lead).
 *  Kegagalan sumber non-kritis (mis. tabel license_leads belum dibuat di
 *  Supabase) TIDAK boleh menggagalkan seluruh daftar — fallback per sumber. */
async function buildAdminUserList(): Promise<{
  mode: "supabase" | "local";
  users: AdminUserRow[];
}> {
  const mode = getAuthMode();
  const supabaseMode = mode === "supabase";

  // 1. Seluruh akun auth — sumber utama daftar pengguna
  interface AuthAccount {
    id: string | null;
    email: string;
    name: string | null;
    phone: string | null;
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
        phone: u.phone,
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
        phone: null,
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
      if (!existing.phone && lic.phone) existing.phone = lic.phone;
      if (!existing.registeredAt) existing.registeredAt = lic.createdAt.toISOString();
      if (!existing.id && lic.userId) existing.id = lic.userId;
    } else {
      accounts.set(email, {
        id: lic.userId,
        email,
        name: lic.name,
        phone: lic.phone,
        registeredAt: lic.createdAt.toISOString(),
      });
    }
  }

  // 2.5 Lead calon pembeli (form checkout / register sebelum pembayaran) —
  // melengkapi Nama & No. WhatsApp agar kolom kontak tidak tampil kosong/strip,
  // sekaligus menampilkan calon pembeli yang BELUM membuat akun.
  //
  // Fallback aman: tabel license_leads bisa jadi BELUM ada di database
  // produksi (buat via SQL Editor Supabase — lihat sql/license-leads-table.sql).
  // Bila query gagal (P2021 dsb.), panel TETAP tampil dari data auth + lisensi
  // yang sudah ada — jangan biarkan satu tabel opsional mematikan GET (500).
  let leads: Awaited<ReturnType<typeof db.licenseLead.findMany>> = [];
  try {
    // Urut created_at (waktu daftar) terbaru dulu — kolom waktu tampil konsisten.
    leads = await db.licenseLead.findMany({ orderBy: { createdAt: "desc" } });
  } catch (err) {
    console.error(
      "[api/admin/users GET] license_leads belum tersedia (tabel belum dibuat / query gagal) — lanjut TANPA data lead:",
      err,
    );
  }
  // Lead TANPA email (zero-friction: hanya Nama + No. WhatsApp) tampil sebagai
  // baris sendiri dgn email null — panel merendernya "(Tanpa Email)".
  const emaillessLeads: AdminUserRow[] = [];
  for (const lead of leads) {
    const email = (lead.email ?? "").trim().toLowerCase();
    if (!email) {
      emaillessLeads.push({
        key: `lead:${lead.id}`,
        id: null,
        email: null,
        name: lead.name,
        phone: lead.phone,
        registeredAt: lead.createdAt.toISOString(),
        properties: [],
        licensed: false,
        licensedAt: null,
        source: null,
        isSuperAdmin: false,
      });
      continue;
    }
    const existing = accounts.get(email);
    if (existing) {
      if (!existing.name && lead.name) existing.name = lead.name;
      if (!existing.phone && lead.phone) existing.phone = lead.phone;
    } else {
      accounts.set(email, {
        id: null,
        email,
        name: lead.name,
        phone: lead.phone,
        registeredAt: lead.createdAt.toISOString(),
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

  const users: AdminUserRow[] = [
    ...[...accounts.values()].map((a) => {
      const lic = licByEmail.get(a.email);
      return {
        key: `email:${a.email}`,
        id: a.id,
        email: a.email,
        name: a.name,
        phone: a.phone,
        registeredAt: a.registeredAt,
        properties: a.id ? (propsByOwner.get(a.id) ?? []) : [],
        licensed: lic?.isLifetimeLicensed === true,
        licensedAt: lic?.licensedAt?.toISOString() ?? null,
        source: sourceByEmail.get(a.email) ?? null,
        isSuperAdmin: isSuperAdminEmail(a.email),
      } satisfies AdminUserRow;
    }),
    ...emaillessLeads,
  ].sort((a, b) => {
    // Default sorting tabel: paling baru → paling lama (created_at DESC).
    // Date.parse memakai timestamp penuh ISO — presisi sampai detik/ms,
    // bukan sekadar tanggal — jadi pendaftar jam 10:31 selalu di atas
    // pendaftar jam 10:30 di hari yang sama. Tiebreaker email utk stabilitas.
    const ta = a.registeredAt ? Date.parse(a.registeredAt) : 0;
    const tb = b.registeredAt ? Date.parse(b.registeredAt) : 0;
    return tb - ta || (a.email ?? "").localeCompare(b.email ?? "");
  });

  return { mode, users };
}

export async function GET() {
  const guard = await requireSuperAdminUser();
  if (!guard.ok) {
    return NextResponse.json({ error: "Akses ditolak — khusus Super Admin." }, { status: guard.status });
  }

  try {
    return NextResponse.json(await buildAdminUserList());
  } catch (err) {
    // Detail penuh ke log server (Vercel Logs / terminal) utk debugging, dan
    // ikut dikirim ke panel (endpoint terkunci Super Admin) agar pesan di
    // layar tidak generik.
    console.error("[api/admin/users GET] Gagal memuat daftar pengguna:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Gagal memuat daftar pengguna.", detail },
      { status: 500 },
    );
  }
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
  const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
  const propertyName = typeof body.propertyName === "string" ? body.propertyName.trim() : "";
  const passwordInput = typeof body.password === "string" ? body.password.trim() : "";
  const generate = body.generate === true;
  const lifetime = body.lifetime !== false; // checkbox default tercentang

  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: "Nama lengkap owner wajib diisi (2–80 karakter)." }, { status: 400 });
  }

  // ── Identitas 100% berbasis WhatsApp: nomor WA adalah identitas utama.
  // Email autentikasi bisa berupa email asli (akun lama) ATAU email sintetis
  // 62…@user.unitku.my.id yang disintesis dari nomor WA.
  const phone = phoneRaw ? normalizeWaPhone(phoneRaw) : "";
  if (phone && !/^62[0-9]{8,13}$/.test(phone)) {
    return NextResponse.json(
      { error: "Nomor WhatsApp tidak valid — gunakan format 08… atau 62… (9–15 digit)." },
      { status: 400 },
    );
  }
  // Email kosong + nomor WA tersedia → sintesis email dari nomor (zero email).
  const emailInput = emailRaw || (phone ? phoneToEmail(phone) : "");
  const email = normalizeEmail(emailInput);
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Nomor WhatsApp atau email tidak valid." }, { status: 400 });
  }
  // Phone final: dari body, atau turunan email sintetis (kompatibel client lama).
  const identityPhone = phone || (isPhoneEmail(email) ? phoneEmailToPhone(email) ?? "" : "");
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
      user_metadata: {
        full_name: name,
        ...(identityPhone ? { phone: identityPhone } : {}),
        source: "manual-super-admin",
      },
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
          phone: identityPhone || null,
          isLifetimeLicensed: true,
          licensedAt: new Date(),
          paymentRef: null,
        },
        update: {
          isLifetimeLicensed: true,
          licensedAt: new Date(),
          ...(name ? { name } : {}),
          ...(identityPhone ? { phone: identityPhone } : {}),
          userId,
        },
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
        create: {
          email,
          userId,
          name,
          phone: identityPhone || null,
          isLifetimeLicensed: false,
          licensedAt: null,
          paymentRef: null,
        },
        update: { name, ...(identityPhone ? { phone: identityPhone } : {}), userId },
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

// ── DELETE — hapus pengguna/lead lintas sumber (best-effort per sumber) ──────
//
// Menghapus SEMUA jejak email target di panel:
//   1. Akun auth          — Supabase Auth (admin.deleteUser) / OwnerAccount lokal
//   2. Lisensi level akun — tabel licenses (by email)
//   3. Lead calon pembeli — tabel license_leads (by email) ← sering satu-satunya
//                           data utk "calon user/simulasi" dari form checkout
//   4. Profil owner       — OwnerSetting (by userId) + tabel opsional profiles
//                           (bila admin membuatnya sendiri di Supabase)
//   5. Properti           — TIDAK dihapus; ownerId dikosongkan utk audit
//
// Safe handling: satu sumber yang tidak menemukan record (atau gagal) TIDAK
// menggagalkan sumber lain — proses lanjut & tetap 200 selama minimal satu
// langkah berhasil / dilewati dengan aman. 500 hanya bila semua langkah gagal
// keras (indikasi DB down / konfigurasi rusak).

interface DeleteStepResult {
  source: "auth" | "license" | "lead" | "profile" | "property";
  ok: boolean;
  skipped: boolean; // true = tidak ada record / tidak berlaku (bukan error)
  detail: string;
}

/** Kode error Prisma (P2025 record not found, P2021 table missing, …) */
function prismaErrorCode(err: unknown): string | null {
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  ) {
    return (err as { code: string }).code;
  }
  return null;
}

/** Tidak ada record / tabel yang bisa dihapus — bukan error, cukup dilewati */
function isNothingToDelete(err: unknown): boolean {
  const code = prismaErrorCode(err);
  return code === "P2025" || code === "P2021";
}

export async function DELETE(request: NextRequest) {
  const guard = await requireSuperAdminUser();
  if (!guard.ok) {
    return NextResponse.json({ error: "Akses ditolak — khusus Super Admin." }, { status: guard.status });
  }

  // Lead TANPA email (zero-friction: hanya Nama + No. WhatsApp) dihapus per
  // No. WhatsApp — panel memanggil DELETE /api/admin/users?phone=62xxxxxxxxxx
  const phoneParam = (request.nextUrl.searchParams.get("phone") ?? "").replace(
    /[^\d]/g,
    "",
  );
  if (!request.nextUrl.searchParams.get("email") && phoneParam) {
    try {
      const lead = await db.licenseLead.findFirst({ where: { phone: phoneParam } });
      if (lead) {
        await db.licenseLead.delete({ where: { id: lead.id } });
        return NextResponse.json({
          success: true,
          phone: phoneParam,
          authDeleted: false,
          leadDeleted: true,
          results: [
            {
              source: "lead",
              ok: true,
              skipped: false,
              detail: "Lead calon pembeli (tanpa email) dihapus.",
            },
          ] satisfies DeleteStepResult[],
        });
      }
      return NextResponse.json(
        { error: "Tidak ada lead dengan nomor WhatsApp tersebut." },
        { status: 404 },
      );
    } catch (err) {
      console.error("[api/admin/users DELETE] hapus lead (by phone) gagal:", err);
      const detail = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: "Gagal menghapus data lead.", detail }, { status: 500 });
    }
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
    const results: DeleteStepResult[] = [];
    const push = (r: DeleteStepResult) => results.push(r);

    // ── Identitas: userId & profil lisensi (jika ada) — best-effort ──────────
    type LicenseRow = Awaited<ReturnType<typeof db.licenseAccount.findUnique>>;
    let license: LicenseRow = null;
    let userId: string | null = null;
    try {
      license = await db.licenseAccount.findUnique({ where: { email } });
      userId = license?.userId ?? null;
    } catch (err) {
      console.error("[api/admin/users DELETE] lookup lisensi gagal — lanjut tanpa userId:", err);
    }

    // ── 1. Akun auth (Supabase / lokal) — gagal TIDAK membatalkan sumber lain
    let authDeleted = false;
    if (getAuthMode() === "supabase") {
      const admin = getSupabaseAdmin();
      if (!admin) {
        push({ source: "auth", ok: false, skipped: true, detail: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi — penghapusan auth dilewati." });
      } else {
        try {
          if (!userId) userId = await findSupabaseUserIdByEmail(email);
          if (userId) {
            const { error } = await admin.auth.admin.deleteUser(userId);
            if (error) {
              // Record auth tidak ditemukan / sudah terhapus → aman dilewati;
              // error lain juga TIDAK membatalkan penghapusan data database.
              console.error("[api/admin/users DELETE] deleteUser gagal (dilewati):", error.message);
              push({ source: "auth", ok: false, skipped: true, detail: `Auth tidak terhapus: ${error.message}` });
            } else {
              authDeleted = true;
              push({ source: "auth", ok: true, skipped: false, detail: `Akun auth ${userId} dihapus.` });
            }
          } else {
            push({ source: "auth", ok: true, skipped: true, detail: "Tidak ada akun auth untuk email ini." });
          }
        } catch (err) {
          console.error("[api/admin/users DELETE] langkah auth error (dilewati):", err);
          push({ source: "auth", ok: false, skipped: true, detail: "Langkah auth gagal — dilewati." });
        }
      }
    } else {
      // Mode lokal — OwnerAccount scrypt
      try {
        const account = await db.ownerAccount.findUnique({ where: { email }, select: { id: true } });
        if (account) {
          userId = account.id;
          await db.ownerAccount.delete({ where: { id: account.id } });
          authDeleted = true;
          push({ source: "auth", ok: true, skipped: false, detail: `Akun lokal ${account.id} dihapus.` });
        } else {
          push({ source: "auth", ok: true, skipped: true, detail: "Tidak ada akun lokal untuk email ini." });
        }
      } catch (err) {
        console.error("[api/admin/users DELETE] langkah auth lokal error (dilewati):", err);
        push({ source: "auth", ok: false, skipped: true, detail: "Langkah auth lokal gagal — dilewati." });
      }
    }

    // ── 2. Lisensi level akun (licenses, by email) ───────────────────────────
    // Histori pembelian (license_purchases) tetap disimpan (FK SetNull) utk audit.
    try {
      if (license) {
        await db.licenseAccount.delete({ where: { email } });
        push({ source: "license", ok: true, skipped: false, detail: "Profil lisensi dihapus." });
      } else {
        push({ source: "license", ok: true, skipped: true, detail: "Tidak ada profil lisensi." });
      }
    } catch (err) {
      if (isNothingToDelete(err)) {
        push({ source: "license", ok: true, skipped: true, detail: "Tidak ada profil lisensi." });
      } else {
        console.error("[api/admin/users DELETE] hapus lisensi gagal:", err);
        push({ source: "license", ok: false, skipped: false, detail: "Gagal menghapus profil lisensi." });
      }
    }

    // ── 3. Lead calon pembeli (license_leads, by email) — INTI PERBAIKAN ─────
    // "Calon user / akun dummy dari lead" hanya tersimpan di tabel ini; tanpa
    // langkah ini barisnya tetap muncul di panel setelah refresh.
    try {
      // email bukan lagi unique key di license_leads (kini phone) — cari via
      // findFirst lalu hapus per id.
      const lead = await db.licenseLead.findFirst({ where: { email } });
      if (lead) {
        await db.licenseLead.delete({ where: { id: lead.id } });
        push({ source: "lead", ok: true, skipped: false, detail: "Lead calon pembeli dihapus." });
      } else {
        push({ source: "lead", ok: true, skipped: true, detail: "Tidak ada lead untuk email ini." });
      }
    } catch (err) {
      if (isNothingToDelete(err)) {
        push({ source: "lead", ok: true, skipped: true, detail: "Tidak ada lead untuk email ini." });
      } else {
        // Tabel license_leads mungkin belum dibuat di database produksi —
        // jangan biarkan tabel opsional menggagalkan penghapusan sumber lain.
        console.error("[api/admin/users DELETE] hapus lead gagal:", err);
        push({ source: "lead", ok: false, skipped: true, detail: "Gagal menghapus lead (tabel mungkin belum tersedia)." });
      }
    }

    // ── 4. Profil owner — OwnerSetting (by userId) ───────────────────────────
    if (userId) {
      try {
        const setting = await db.ownerSetting.findUnique({ where: { userId } });
        if (setting) {
          await db.ownerSetting.delete({ where: { userId } });
          push({ source: "profile", ok: true, skipped: false, detail: "Profil/pengaturan owner dihapus." });
        } else {
          push({ source: "profile", ok: true, skipped: true, detail: "Tidak ada profil/pengaturan owner." });
        }
      } catch (err) {
        if (isNothingToDelete(err)) {
          push({ source: "profile", ok: true, skipped: true, detail: "Tidak ada profil/pengaturan owner." });
        } else {
          console.error("[api/admin/users DELETE] hapus owner_setting gagal:", err);
          push({ source: "profile", ok: false, skipped: true, detail: "Gagal menghapus profil owner." });
        }
      }

      // Tabel opsional `profiles` (bila pernah dibuat manual di Supabase —
      // UnitKu bawaan TIDAK memakainya). Keberadaan tabel & kolom dicek dulu
      // via information_schema agar tidak ada noise error Prisma di log.
      try {
        const meta = await db.$queryRaw<
          Array<{ has_table: boolean; has_user_id: boolean; has_email: boolean }>
        >`SELECT
             EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') AS has_table,
             EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id') AS has_user_id,
             EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email') AS has_email`;
        const info = meta[0];
        if (info?.has_table) {
          let rows = 0;
          let skippedDetail: string | null = null;
          // $executeRaw (tagged template) mem-parameterisasi otomatis — aman.
          if (info.has_user_id && userId && info.has_email) {
            rows = await db.$executeRaw`DELETE FROM "profiles" WHERE user_id = ${userId} OR lower(email) = ${email}`;
          } else if (info.has_user_id && userId) {
            rows = await db.$executeRaw`DELETE FROM "profiles" WHERE user_id = ${userId}`;
          } else if (info.has_email) {
            rows = await db.$executeRaw`DELETE FROM "profiles" WHERE lower(email) = ${email}`;
          } else {
            skippedDetail = "Tabel profiles tidak punya kolom user_id/email — dilewati.";
          }
          if (skippedDetail) {
            push({ source: "profile", ok: true, skipped: true, detail: skippedDetail });
          } else {
            push({
              source: "profile",
              ok: true,
              skipped: rows === 0,
              detail: rows > 0 ? `${rows} baris profiles dihapus.` : "Tidak ada baris profiles.",
            });
          }
        } else {
          push({ source: "profile", ok: true, skipped: true, detail: "Tabel profiles tidak tersedia — dilewati." });
        }
      } catch (err) {
        console.error("[api/admin/users DELETE] hapus profiles (opsional) gagal — dilewati:", err);
        push({ source: "profile", ok: true, skipped: true, detail: "Tabel profiles tidak tersedia — dilewati." });
      }
    }

    // ── 5. Properti dipertahankan — kepemilikan dikosongkan utk audit ────────
    if (userId) {
      try {
        await db.property.updateMany({ where: { ownerId: userId }, data: { ownerId: null } });
        push({ source: "property", ok: true, skipped: false, detail: "Kepemilikan properti dilepas (data dipertahankan)." });
      } catch (err) {
        console.error("[api/admin/users DELETE] lepas kepemilikan properti gagal:", err);
        push({ source: "property", ok: false, skipped: false, detail: "Gagal melepas kepemilikan properti." });
      }
    }

    // ── Ringkasan: 200 selama ada langkah yang berhasil/aman dilewati; 500
    //    hanya bila SEMUA langkah gagal keras (indikasi sistemik). ────────────
    const attempted = results.filter((r) => !r.skipped);
    const hardFailures = attempted.filter((r) => !r.ok);
    if (attempted.length > 0 && hardFailures.length === attempted.length) {
      return NextResponse.json(
        { error: "Gagal menghapus data pengguna/lead.", detail: results.map((r) => `${r.source}: ${r.detail}`).join(" | ") },
        { status: 500 },
      );
    }

    const leadDeleted = results.some((r) => r.source === "lead" && r.ok && !r.skipped);
    return NextResponse.json({
      success: true,
      email,
      authDeleted,
      leadDeleted,
      results,
    });
  } catch (err) {
    console.error("[api/admin/users DELETE]", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Gagal menghapus data pengguna/lead.", detail }, { status: 500 });
  }
}
