// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Penyimpanan lead calon pembeli lisensi (server-only, publik)
//
// POST /api/leads
//   Body : { name, email, phone, source? }
//   Flow : validasi input (parseBuyerInput — shared dengan /api/checkout)
//          → upsert license_leads SATU baris per email.
//
// Dipanggil tombol "Pesan Manual via WhatsApp Admin" (modal landing & halaman
// /checkout) SEBELUM membuka wa.me — sehingga Admin tetap memiliki Nama/Email/
// No. WhatsApp terkirim rapi ke database meski user belum menyelesaikan
// pembayaran. Juga dipakai /api/auth/register (source REGISTER).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import { upsertLicenseLead, type LicenseLeadSource } from "@/lib/billing/license";
import { parseBuyerInput } from "@/lib/checkout-validation";

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

  try {
    await upsertLicenseLead({ ...parsed.data, source });
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
