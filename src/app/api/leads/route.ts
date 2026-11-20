// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Penyimpanan lead calon pembeli lisensi (server-only, publik)
//
// POST /api/leads
//   Body : { name, email, phone, source?, ref? }
//   Flow : validasi input (parseBuyerInput — shared dengan /api/checkout)
//          → validasi ref opsional ke DB (resolveActiveAffiliate — hanya
//            mitra AKTIF) → upsert license_leads SATU baris per No. WhatsApp.
//
// ATRIBUSI REFERRAL: bila body.ref berisi kode mitra AKTIF, source lead
// menjadi "Referral: <kode>" (bukan PESAN_MANUAL) — kolom Sumber Panel Admin
// menunjukkan mitra pemilik link, termasuk untuk pesanan manual via tombol
// "Pesan Manual via WhatsApp Admin" yang routingnya diarahkan ke WA mitra
// (white-label — komisi manual direkonsiliasi admin).
// Attribution guard di upsertLicenseLead menjaga atribusi lama:
// lead yang sudah ber-source "Referral: X" TIDAK diturunkan ke sumber generik.
//
// Dipanggil tombol "Pesan Manual via WhatsApp Admin" (modal landing & halaman
// /checkout — tujuan WA bisa mitra referral saat aktif) SEBELUM membuka wa.me
// — sehingga Admin/Mitra tetap memiliki Nama/No. WhatsApp terkirim rapi ke
// database meski user belum menyelesaikan pembayaran. Juga dipakai
// /api/auth/register.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, after, type NextRequest } from "next/server";

import { resolveActiveAffiliate } from "@/lib/affiliate-resolve";
import { upsertLicenseLead, type LicenseLeadSource } from "@/lib/billing/license";
import { parseBuyerInput } from "@/lib/checkout-validation";
import { notifyAdminLeadAlert } from "@/lib/notifications/admin-lead-alert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEAD_SOURCES = new Set<string>(["BAYAR_OTOMATIS", "PESAN_MANUAL", "REGISTER"]);

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const rawSource =
    typeof body === "object" && body !== null && "source" in body
      ? (body as { source?: unknown }).source
      : undefined;
  const source: LicenseLeadSource =
    typeof rawSource === "string" && LEAD_SOURCES.has(rawSource)
      ? (rawSource as LicenseLeadSource)
      : "PESAN_MANUAL";

  const parsed = parseBuyerInput(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, error: parsed.error, field: parsed.field },
      { status: 400 },
    );
  }

  // ── Atribusi referral opsional — body.ref dari tombol manual mode mitra ───
  // Kode divalidasi ke DB (hanya mitra AKTIF — sama dengan /api/checkout);
  // sah → source "Referral: <kode>" agar Panel Admin melihat pemilik link.
  // Fail-safe: kode basi/nonaktif/DB gagal → source generik, TIDAK melempar.
  const rawRef =
    typeof body === "object" && body !== null && "ref" in body
      ? (body as { ref?: unknown }).ref
      : undefined;
  const affiliate =
    typeof rawRef === "string" && rawRef.trim()
      ? await resolveActiveAffiliate(rawRef).catch(() => null)
      : null;
  const effectiveSource: LicenseLeadSource = affiliate
    ? `Referral: ${affiliate.refCode}`
    : source;

  try {
    const result = await upsertLicenseLead({ ...parsed.data, source: effectiveSource });
    // Lead benar-benar baru → notifikasi instan ke HP Admin via after()
    // (respons tetap kilat; kontak lama submit ulang tidak memicu alert)
    if (result.created) {
      after(() =>
        notifyAdminLeadAlert({
          name: parsed.data.name,
          phone: parsed.data.phone,
          email: parsed.data.email,
          source: effectiveSource,
          registeredAt: new Date(),
        }),
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "[api/leads] Gagal menyimpan lead:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      {
        success: false,
        error:
          "Gagal menyimpan data kontak — pesan WhatsApp tetap dibuka, namun mohon sampaikan data Anda di chat.",
      },
      { status: 500 },
    );
  }
}
