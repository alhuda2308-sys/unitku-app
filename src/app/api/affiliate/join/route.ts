// ─────────────────────────────────────────────────────────────────────────────
// /api/affiliate/join — Pendaftaran mitra afiliasi PUBLIK (tanpa login)
//
// POST body { name, phone, refCode, bankName?, bankAccountNo?, bankAccountName? }
//   • Kode referral dicek dulu — sudah dipakai mitra lain → 409 ramah
//     ("Kode referral sudah digunakan, silakan pilih kode lain") + field hint
//     agar form menampilkan error inline di bawah input kode.
//   • Belum dipakai → baris affiliates baru AKTIF via createAffiliate():
//       - No. WA dinormalisasi 62… → identifier utama (satu WA = satu mitra).
//       - Fail-safe email: fallback otomatis `${phone}@affiliate.unitku.my.id`
//         bila skema/DB membutuhkannya (pola sama dengan create admin).
//       - accessToken magic-link dibuat → dashboard mitra tanpa login.
//       - Rekening bank/e-wallet opsional langsung tersimpan (boleh kosong —
//         dilengkapi mitra sendiri di dashboardnya).
//   • Sukses → notifikasi Telegram Admin dikirim dgn AWAIT LANGSUNG sebelum
//     respons (bukan after() — lihat catatan di blok notifikasi di bawah).
//
// Anti-spam ringan: rate limit memori per IP (5 daftar / 10 menit) — tanpa
// middleware tambahan. Gagal limit → 429, form menampilkan pesan ramah.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import { createAffiliate } from "@/lib/affiliate-admin";
import { normalizeWaPhone } from "@/lib/checkout-validation";
import { sendAdminAffiliateJoinAlert } from "@/lib/notifications/admin-sale-alert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Batas kode referral publik — mudah diketik, aman di link ?ref= */
const REF_CODE_MIN = 3;
const REF_CODE_MAX = 30;

// ── Rate limit memori (pola lokal, tanpa middleware) ─────────────────────────

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const joinAttempts = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (joinAttempts.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (hits.length >= RATE_LIMIT_MAX) {
    joinAttempts.set(ip, hits);
    return true;
  }
  hits.push(now);
  joinAttempts.set(ip, hits);
  // Buang IP lama agar map tidak tumbuh tanpa batas
  if (joinAttempts.size > 5000) {
    for (const [key, times] of joinAttempts) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) {
        joinAttempts.delete(key);
      }
    }
  }
  return false;
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

// ── Respon error seragam (field = input yang bermasalah, utk inline error) ───

function joinError(
  error: string,
  status: number,
  field?: "name" | "phone" | "refCode",
): NextResponse {
  return NextResponse.json(
    { success: false, error, ...(field ? { field } : {}) },
    { status },
  );
}

export async function POST(request: NextRequest) {
  if (isRateLimited(clientIp(request))) {
    return joinError(
      "Terlalu banyak percobaan pendaftaran dari perangkat ini — coba lagi dalam 10 menit ya, Kak.",
      429,
    );
  }

  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return joinError("Payload tidak valid.", 400);
  }
  const raw = body as Record<string, unknown>;

  // ── Validasi server (cermin validasi form — jangan percaya client) ─────────
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    return joinError(
      "Mohon isi nama lengkap Anda (minimal 2 huruf).",
      400,
      "name",
    );
  }

  const phone = normalizeWaPhone(typeof raw.phone === "string" ? raw.phone : "");
  if (!/^62[0-9]{8,13}$/.test(phone)) {
    return joinError(
      "Nomor WhatsApp tidak valid — gunakan awalan 08 atau 62 (contoh: 081234567890).",
      400,
      "phone",
    );
  }

  // Kode referral: huruf kecil/angka/strip — contoh sukses2026. Input otomatis
  // di-lowercase di sisi form; di sini divalidasi ulang secara ketat.
  const refCode =
    typeof raw.refCode === "string" ? raw.refCode.trim().toLowerCase() : "";
  if (
    refCode.length < REF_CODE_MIN ||
    refCode.length > REF_CODE_MAX ||
    !/^[a-z0-9-]+$/.test(refCode)
  ) {
    return joinError(
      `Kode referral hanya boleh huruf kecil, angka, dan tanda hubung (${REF_CODE_MIN}–${REF_CODE_MAX} karakter) — contoh: sukses2026.`,
      400,
      "refCode",
    );
  }

  // Rekening opsional — boleh kosong (dilengkapi nanti di dashboard mitra)
  const bankName = typeof raw.bankName === "string" ? raw.bankName : undefined;
  const bankAccountNo =
    typeof raw.bankAccountNo === "string" ? raw.bankAccountNo : undefined;
  const bankAccountName =
    typeof raw.bankAccountName === "string" ? raw.bankAccountName : undefined;

  // ── Buat mitra (duplikasi/ref-code-taken/email fallback ditangani lib) ─────
  const result = await createAffiliate({
    name,
    refCode,
    phone,
    bankName,
    bankAccountNo,
    bankAccountName,
  });

  if (!result.ok) {
    console.log(
      `[UnitKu Affiliate Join] Pendaftaran ditolak: ${result.reason} (ref "${refCode}", WA ${phone}).`,
    );
    switch (result.reason) {
      case "ref-code-taken":
        return joinError(
          "Kode referral sudah digunakan, silakan pilih kode lain.",
          409,
          "refCode",
        );
      case "phone-taken":
        return joinError(
          "Nomor WhatsApp ini sudah terdaftar sebagai mitra — silakan buka Dashboard Mitra Anda lewat link yang pernah dikirim, atau daftar dengan nomor berbeda.",
          409,
          "phone",
        );
      case "user-linked":
        return joinError(
          "Nomor WhatsApp ini milik akun yang sudah terhubung ke mitra lain — hubungi Admin untuk bantuan.",
          409,
          "phone",
        );
      case "invalid-input":
        return joinError(
          "Data pendaftaran tidak valid — periksa kembali Nama, No. WhatsApp, dan Kode Referral Anda.",
          400,
        );
      default:
        // error DB — detail hanya masuk log server (endpoint publik)
        console.error(
          "[UnitKu Affiliate Join] Gagal createAffiliate:",
          result.detail ?? "(tanpa detail)",
        );
        return joinError(
          "Terjadi kendala saat menyimpan pendaftaran — coba lagi sebentar ya, Kak.",
          500,
        );
    }
  }

  // ── Notifikasi Telegram Admin — AWAIT LANGSUNG (bukan after()) ─────────────
  // Bug produksi terverifikasi: after(() => notify...()) dgn callback VOID
  // membuat after() tidak melacak Promise-nya — runtime serverless Vercel
  // membekukan eksekusi segera setelah respons, fetch Telegram terpotong,
  // notifikasi hilang diam-diam. await langsung menjamin fetch TUNTAS
  // SEBELUM respons dikirim (100% deterministik di serverless mana pun).
  // sendAdminAffiliateJoinAlert fail-safe: tidak pernah melempar, timeout
  // 10 dtk → worst case respons client menunggu maksimal ~10 detik.
  const partner = result.partner;
  await sendAdminAffiliateJoinAlert({
    partnerName: partner.name,
    phone: result.phone,
    refCode: partner.refCode,
  });

  console.log(
    `[UnitKu Affiliate Join] Mitra baru dari form publik: "${partner.refCode}" ` +
      `(Kak ${partner.name}, WA ${result.phone}).`,
  );

  return NextResponse.json({
    success: true,
    name: partner.name,
    refCode: partner.refCode,
    phone: result.phone,
    /** Magic-link portal — dashboard mitra bisa dibuka TANPA login */
    accessToken: result.accessToken,
  });
}
