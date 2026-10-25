// ─────────────────────────────────────────────────────────────────────────────
// /api/uploads — unggah gambar (foto fasad properti, dll.) ke cloud storage.
//
// POST { dataUrl } — data URL gambar hasil kompresi klien (canvas → JPEG/PNG/
// WebP base64). Server mencoba mengunggah ke Supabase Storage (bucket publik
// "property-assets") lalu mengembalikan URL publik permanen:
//   { ok: true, url: "https://…/storage/v1/object/public/property-assets/…", storage: "supabase" }
//
// Bila Supabase Storage tidak terkonfigurasi (dev/sandbox) ATAU unggahan gagal
// (bucket/RLS/jaringan), respons TETAP 200 dengan url null:
//   { ok: true, url: null, storage: "local", reason: "…" }
// → klien memakai fallback data URL terkompresi yang sudah dimilikinya (foto
//   tetap tersimpan ke kolom fotoUrl — Postgres TEXT, ≤ 400 ribu karakter).
// Kegagalan TIDAK pernah memblokir pengguna — prinsip fail-open khusus upload
// gambar profil; payload tidak valid tetap fail-loud 400.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** Bucket publik penyimpanan aset gambar profil (foto fasad properti) */
const BUCKET = "property-assets";
/** Batas aman ukuran gambar terkompresi (base64) — klien memampatkan ≤ 720px */
const MAX_BASE64_LENGTH = 2_000_000; // ± 1,5 MB biner

/** Resolusi kredensial Supabase — mirror fallback lintas penamaan config.ts */
function resolveSupabaseStorageEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";
  if (!url.startsWith("http") || key.length < 20) return null;
  return { url, key };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Sesi tidak ditemukan — masuk kembali." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { dataUrl?: unknown };
    const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl.trim() : "";
    const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) {
      return NextResponse.json(
        { error: "Payload gambar tidak valid — kirim data URL image/jpeg|png|webp ber-base64." },
        { status: 400 },
      );
    }
    if (dataUrl.length > MAX_BASE64_LENGTH) {
      return NextResponse.json(
        { error: "Ukuran foto terlalu besar — kompresi klien menghasilkan gambar > 1,5 MB." },
        { status: 413 },
      );
    }

    const env = resolveSupabaseStorageEnv();
    if (!env) {
      return NextResponse.json({
        ok: true,
        url: null,
        storage: "local",
        reason: "Supabase Storage belum terkonfigurasi — foto disimpan sebagai data URL terkompresi.",
      });
    }

    try {
      const admin = createClient(env.url, env.key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // Pastikan bucket publik ada — "Bucket already exists" diabaikan (idempoten)
      const { error: bucketErr } = await admin.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: "2MB",
      });
      if (bucketErr && !/already exists|duplicate/i.test(bucketErr.message)) {
        throw new Error(bucketErr.message);
      }

      const mime = match[1];
      const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
      const buffer = Buffer.from(match[2], "base64");
      const path = `properties/${user.id}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

      const { error: uploadErr } = await admin.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: mime, upsert: false });
      if (uploadErr) throw new Error(uploadErr.message);

      const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("URL publik tidak tersedia.");

      return NextResponse.json({ ok: true, url: data.publicUrl, storage: "supabase" });
    } catch (storageErr) {
      // Bucket/RLS/jaringan gagal → foto tetap bisa dipakai via data URL klien
      console.error("[api/uploads] Supabase Storage gagal (fallback data URL):", storageErr);
      return NextResponse.json({
        ok: true,
        url: null,
        storage: "local",
        reason: storageErr instanceof Error ? storageErr.message : "Unggahan storage gagal.",
      });
    }
  } catch (err) {
    console.error("[api/uploads]", err);
    return NextResponse.json(
      { error: "Gagal memproses unggahan gambar — coba lagi sebentar." },
      { status: 500 },
    );
  }
}
