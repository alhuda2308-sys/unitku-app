// ─────────────────────────────────────────────────────────────────────────────
// /api/portal/ktp — unggah foto KTP oleh PENYEWA via Portal Penyewa
//
// POST { token, ktpImage } : validasi magic token (tanpa login owner) →
//   sanitasi gambar (dataURL terkompresi ≤1024px / URL) → simpan ke kolom
//   tenants.ktpImage. Pola sesi = foto tiket komplain (dataURL di body).
//
// Keamanan:
//   • Token wajib & tervalidasi ke DB (portalToken @unique) — penyewa hanya
//     bisa mengubah KTP miliknya sendiri.
//   • Ukuran dibatasi (≤1,5 juta karakter base64 ≈ ≤1,1 MB gambar) & format
//     divalidasi (data:image/* ATAU URL https).
//   • Respons tidak pernah melempar — selalu JSON { ok } / { error }.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Batas ukuran string dataURL — sama dgn guard di /api/tenants */
const KTP_IMAGE_MAX_CHARS = 1_500_000;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      token?: unknown;
      ktpImage?: unknown;
    };

    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ error: "Token portal wajib ada." }, { status: 400 });
    }
    const tenant = await db.tenant.findUnique({ where: { portalToken: token } });
    if (!tenant) {
      return NextResponse.json({ error: "Token portal tidak dikenali." }, { status: 404 });
    }

    if (typeof body.ktpImage !== "string") {
      return NextResponse.json({ error: "Foto KTP tidak terkirim." }, { status: 400 });
    }
    const ktp = body.ktpImage.trim();
    if (!ktp) {
      return NextResponse.json({ error: "Foto KTP kosong." }, { status: 400 });
    }
    if (ktp.length > KTP_IMAGE_MAX_CHARS) {
      return NextResponse.json(
        { error: "Ukuran foto terlalu besar — coba foto lain atau ambil ulang dengan kamera." },
        { status: 413 },
      );
    }
    const valid =
      /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(ktp) ||
      /^https:\/\/[^\s]+$/i.test(ktp);
    if (!valid) {
      return NextResponse.json(
        { error: "Format foto tidak didukung — gunakan JPG/PNG." },
        { status: 400 },
      );
    }

    await db.tenant.update({ where: { id: tenant.id }, data: { ktpImage: ktp } });

    return NextResponse.json(
      { ok: true, ktpImage: ktp },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[api/portal/ktp POST]", err);
    return NextResponse.json(
      { error: "Gagal menyimpan foto KTP — coba lagi." },
      { status: 500 },
    );
  }
}
