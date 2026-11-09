// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register — Daftar akun owner baru (TANPA email)
//
// Zero friction (selaras form checkout): cukup Nama Lengkap + No. WhatsApp +
// Kata Sandi. Supabase Auth mewajibkan format email → email sintetis dibuat
// otomatis dari nomor WhatsApp (lihat src/lib/auth/phone-email.ts):
//   62xxxxxxxxxx → 62xxxxxxxxxx@user.unitku.my.id
// Nomor asli & Nama tetap tersimpan di metadata Supabase (raw_user_meta_data:
// full_name + phone) dan tabel lead Admin — email sintetis tidak pernah
// diminta ke pengguna.
// Mode Supabase: supabase.auth.signUp — bila verifikasi email aktif di
//                dashboard Supabase, sesi null → needsEmailConfirmation=true.
// Mode lokal   : akun disimpan di owner_accounts (scrypt) + sesi langsung.
// Kontak       : tersimpan sebagai lead license_leads (source REGISTER) agar
//                Panel Super Admin selalu punya data kontak akun.
// Notifikasi   : Telegram Admin "PENDAFTARAN PENGGUNA BARU" — await langsung
//                sebelum respons (fail-safe, hanya saat user benar-benar baru).
//                Sumber referral terdeteksi otomatis: body ref/refCode → query
//                ?ref → cookie `unitku_ref` (30 hari, last-click) → lookup
//                mitra aktif di DB → varian pesan "Sumber Referral" / Organik.
// Validasi     : nama ≥2, format WA 62…, password minimal 6.
// Email lama (body.email) tetap diterima untuk kompatibilitas klien lama.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, after, type NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { upsertLicenseLead, type LicenseLeadSource } from "@/lib/billing/license";
import { normalizeWaPhone } from "@/lib/checkout-validation";
import { getAuthMode, SESSION_COOKIE } from "@/lib/auth/config";
import { createSessionToken, hashPassword, sessionCookieOptions } from "@/lib/auth/local";
import { isPhoneEmail, phoneToEmail } from "@/lib/auth/phone-email";
import { createSupabaseAuthCollector } from "@/lib/auth/supabase-route";
import {
  AFFILIATE_QUERY_PARAM,
  AFFILIATE_REF_COOKIE,
  sanitizeAffiliateRef,
} from "@/lib/affiliate";
import { notifyAdminLeadAlert } from "@/lib/notifications/admin-lead-alert";
import {
  sendAdminUserSignupAlert,
  type UserSignupReferralSource,
} from "@/lib/notifications/admin-sale-alert";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const password = typeof body.password === "string" ? body.password : "";

  // Nama + No. WhatsApp wajib — profil akun selalu lengkap (identitas login WA).
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = normalizeWaPhone(typeof body.phone === "string" ? body.phone : "");

  // Email tidak lagi diminta di UI — bila ada (klien lama) hormati, selain itu
  // buat otomatis dari nomor WhatsApp.
  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  let email = phoneToEmail(phone);
  if (rawEmail) {
    if (!EMAIL_RE.test(rawEmail)) {
      return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
    }
    email = rawEmail;
  }

  if (name.length < 2 || name.length > 100) {
    return NextResponse.json(
      { error: "Nama lengkap wajib diisi (2–100 karakter)." },
      { status: 400 },
    );
  }
  if (!/^62[0-9]{8,13}$/.test(phone)) {
    return NextResponse.json(
      { error: "Nomor WhatsApp tidak valid — gunakan format 08… atau 62… (9–15 digit)." },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter." }, { status: 400 });
  }

  /** Simpan lead kontak (source REGISTER) — kegagalan DB tidak memblokir daftar.
   *  Return: true = lead BENAR-BENAR baru (insert), false = pembaruan kontak lama. */
  const saveLead = async (): Promise<boolean> => {
    try {
      const result = await upsertLicenseLead({ name, email, phone, source: leadSource });
      return result.created;
    } catch (leadError) {
      console.error(
        "[api/auth/register] Gagal menyimpan lead:",
        leadError instanceof Error ? leadError.message : leadError,
      );
      return false;
    }
  };

  /** Notifikasi instan ke HP Admin (WA gateway / Telegram / webhook) —
   *  via after(): respons registrasi TIDAK menunggu pengiriman notifikasi. */
  const queueLeadAlert = (leadCreated: boolean): void => {
    if (!leadCreated) return; // kontak lama submit ulang — jangan spam admin
    after(() =>
      notifyAdminLeadAlert({ name, phone, email, source: leadSource, registeredAt: new Date() }),
    );
  };

  /**
   * Deteksi sumber referral pendaftaran — fail-safe (lookup gagal / kode
   * tak terdaftar / mitra nonaktif = organik, TIDAK pernah memblokir daftar).
   * Urutan sumber: body.ref / body.refCode (eksplisit dari klien) → query
   * ?ref → cookie `unitku_ref` (atribusi last-click 30 hari dari middleware).
   * Kode dicocokkan ke tabel affiliates — hanya mitra AKTIF dihitung.
   */
  const resolveReferralSource = async (): Promise<UserSignupReferralSource | null> => {
    const raw =
      (typeof body.ref === "string" && body.ref.trim()) ||
      (typeof body.refCode === "string" && body.refCode.trim()) ||
      request.nextUrl.searchParams.get(AFFILIATE_QUERY_PARAM) ||
      request.cookies.get(AFFILIATE_REF_COOKIE)?.value ||
      "";
    const code = sanitizeAffiliateRef(raw);
    if (!code) return null;
    // Kode di DB bisa lowercase (form join) atau campuran (input admin lama) —
    // coba persis dulu, lalu lowercase (maks. 2 query, hanya saat ada ref).
    const candidates = [...new Set([code, code.toLowerCase()])];
    for (const candidate of candidates) {
      try {
        const mitra = await db.affiliate.findUnique({
          where: { refCode: candidate },
          select: { name: true, isActive: true },
        });
        if (mitra && mitra.isActive) {
          return { name: mitra.name, refCode: candidate };
        }
        if (mitra && !mitra.isActive) return null; // mitra nonaktif → organik
      } catch (error) {
        console.error(
          "[api/auth/register] Lookup mitra referral gagal (dianggap organik):",
          error instanceof Error ? error.message : error,
        );
        return null;
      }
    }
    console.log(
      `[api/auth/register] Kode referral "${code}" tidak terdaftar — pendaftaran dihitung organik.`,
    );
    return null;
  };

  // ── Sumber pendaftaran (dihitung SEKALI, dipakai bersama) ─────────────────
  // Field `source` lead = "Referral: <kode>" bila daftar lewat link mitra,
  // "Organik (Web)" bila mandiri → kolom Sumber Panel Super Admin selalu
  // terisi informatif. Fail-safe: lookup gagal/kode tak terdaftar = organik.
  const referralSource = await resolveReferralSource();
  const leadSource: LicenseLeadSource = referralSource
    ? `Referral: ${referralSource.refCode}`
    : "Organik (Web)";

  if (getAuthMode() === "supabase") {
    // Pola kolektor (lihat /api/auth/login) — sesi dari signUp (bila verifikasi
    // email nonaktif) tidak boleh terbuang saat response final dibangun.
    const { client: supabase, applyCookies } = createSupabaseAuthCollector(request);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Metadata ikut ke auth.users (raw_user_meta_data) — kolom Nama/No.
      // WhatsApp tabel Admin terisi & identitas asli pemilik terjaga.
      options: { data: { full_name: name, phone } },
    });
    if (error) {
      console.error("[api/auth/register] Supabase signUp gagal:", error.message);
      const duplicate = /already|terdaftar|exists/i.test(error.message);
      const failed = NextResponse.json(
        {
          error: duplicate
            ? isPhoneEmail(email)
              ? "Nomor WhatsApp sudah terdaftar. Silakan masuk."
              : "Email sudah terdaftar. Silakan masuk."
            : error.message,
        },
        { status: duplicate ? 409 : 400 },
      );
      applyCookies(failed); // cookie pembersihan/refresh parsial tetap diteruskan
      return failed;
    }
    await saveLead().then(queueLeadAlert);
    // ── Notifikasi Telegram Admin — PENGGUNA BARU (await langsung) ─────────
    // signUp sukses tanpa error = user baru tercatat di Supabase Auth (error
    // "already registered" sudah tersaring di atas). Guard identities:
    // Supabase mengembalikan identities KOSONG utk email yang SUDAH terdaftar
    // saat verifikasi email aktif → tidak ada user baru dibuat → jangan spam
    // notifikasi utk percobaan ulang. Await penuh agar fetch Telegram tuntas
    // sebelum respons (runtime serverless tidak memotong proses); fungsi
    // fail-safe — gagal kirim tidak pernah membatalkan registrasi.
    const isNewUser = (data.user?.identities?.length ?? 1) > 0;
    if (isNewUser) {
      await sendAdminUserSignupAlert({
        userName: name,
        email,
        phone,
        referral: referralSource,
        occurredAt: new Date(),
      });
    }
    const response = NextResponse.json({
      ok: true,
      needsEmailConfirmation: !data.session,
      user: data.user ? { id: data.user.id, email: data.user.email ?? email } : null,
    });
    applyCookies(response); // ← Set-Cookie sesi ikut ke browser (bila sesi langsung)
    return response;
  }

  // ── Mode lokal ─────────────────────────────────────────────────────────────
  try {
    const existing = await db.ownerAccount.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        {
          error: isPhoneEmail(email)
            ? "Nomor WhatsApp sudah terdaftar. Silakan masuk."
            : "Email sudah terdaftar. Silakan masuk.",
        },
        { status: 409 },
      );
    }
    const account = await db.ownerAccount.create({
      data: { email, passwordHash: hashPassword(password) },
    });
    await saveLead().then(queueLeadAlert);
    // Akun lokal baru BENAR-BENAR dibuat (email existing sudah tersaring di
    // atas) → notifikasi Telegram Admin dgn await langsung — fail-safe,
    // gagal kirim tidak pernah membatalkan registrasi (lihat mode Supabase).
    await sendAdminUserSignupAlert({
      userName: name,
      email,
      phone,
      referral: referralSource,
      occurredAt: new Date(),
    });
    const response = NextResponse.json({
      ok: true,
      needsEmailConfirmation: false,
      user: { id: account.id, email },
    });
    response.cookies.set(
      SESSION_COOKIE,
      createSessionToken({ sub: account.id, email }),
      sessionCookieOptions,
    );
    return response;
  } catch (err) {
    console.error("[api/auth/register] DB gagal:", err);
    return NextResponse.json(
      { error: "Database tidak terjangkau — coba tombol \"Masuk sebagai Demo\"." },
      { status: 503 },
    );
  }
}
