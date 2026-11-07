// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Cron Generator Artikel Harian: /api/cron/auto-article
//
// Dijadwalkan Vercel Cron (vercel.json) tiap hari 00:00 UTC = 08.00 WITA:
//   1. Validasi header Authorization: Bearer <CRON_SECRET>
//   2. Panggil Google Gemini (gemini-2.5-flash) → 3 artikel SEO Bahasa
//      Indonesia mendalam (1000-1500 kata, H2/H3, contoh kasus, tips aksi)
//      seputar manajemen kost + cover image Unsplash, selipan rekomendasi
//      natural UnitKu
//   3. Batch insert ke tabel Supabase `articles` (is_published: true,
//      upsert on-conflict-slug agar idempotent)
//   4. Balas { success, count, slugs }
//
// Env WAJIB (diatur di Vercel → Settings → Environment Variables):
//   CRON_SECRET      — rahasia yg sama dgn schedule header Vercel Cron
//   GEMINI_API_KEY   — API key Google AI Studio
//   SUPABASE_SERVICE_ROLE_KEY — insert bypass RLS (server-side saja)
// ═════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import { insertGeneratedArticles, type NewArticleInput } from "@/lib/blog-articles";

// Serverless timeout guard — generate 3 artikel mendalam (1000-1500 kata)
// butuh waktu; 60 detik batas aman utk Vercel Functions.
export const maxDuration = 60;

// Selalu eksekusi fresh (tidak pernah di-cache edge)
export const dynamic = "force-dynamic";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Prompt sesuai spesifikasi — artikel MENDALAM (1000-1500 kata) dengan
 * struktur H2/H3 komprehensif, bullet points, contoh kasus nyata, dan tips
 * aksi konkret. Gambar cover diambil dari kumpulan URL Unsplash terverifikasi
 * (static safe images) — Gemini hanya MEMILIH, tidak mengarang ID foto, agar
 * semua URL pasti valid & hidup.
 */
const GEMINI_PROMPT = `Anda adalah konsultan ahli manajemen bisnis kost di Indonesia. Buatlah 3 artikel edukatif orisinal yang berbeda topik (masing-masing MINIMAL 1000-1500 KATA, mendalam dan komprehensif) dalam Bahasa Indonesia seputar pengelolaan bisnis kost (misal topik 1: tips pembukuan arus kas kost, topik 2: cara menagih sewa tepat waktu & kuitansi digital, topik 3: denah kamar interaktif atau tips perawatan fasilitas).

KETENTUAN MUTLAK KUALITAS KONTEN (wajib dipenuhi setiap artikel):
- Struktur Markdown lengkap: minimal 4-6 sub-heading "##" (H2) dan beberapa sub-sub-heading "###" (H3) yang komprehensif
- Gunakan bullet points / daftar bernomor untuk langkah dan poin praktis
- Sertakan CONTOH KASUS NYATA dengan simulasi angka konkret (misal: perhitungan laba bersih kost 10 kamar, skenario keterlambatan bayar, perbandingan sebelum/sesudah sistem digital)
- Tutup dengan "## Kesimpulan" berisi TIPS AKSI KONKRET yang bisa dipraktikkan pembaca hari ini juga
- Selipkan ajakan/rekomendasi natural di tiap artikel agar pembaca menggunakan aplikasi manajemen kost UnitKu (unitku.my.id)

GAMBAR COVER: untuk setiap artikel, pilih SATU URL Unsplash yang paling relevan dengan topiknya dari daftar URL foto terverifikasi berikut (JANGAN mengarang atau mengubah URL lain):
- https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80 (apartment-interior — ruang tamu apartemen modern)
- https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80 (modern-room — interior unit apartemen terang)
- https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80 (apartment-interior — apartemen kecil nyaman)
- https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=80 (modern-room — ruang keluarga estetik)
- https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80 (apartment-interior — studio modern)
- https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=1200&q=80 (modern-room — interior minimalis)
- https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&q=80 (modern-room — kamar bernuansa hijau)
- https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1200&q=80 (bedroom — kamar tidur rapi ala hotel)
- https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&q=80 (bedroom — kamar kost modern)
- https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=1200&q=80 (bedroom — kamar tidur putih minimalis)
- https://images.unsplash.com/photo-1560185008-b033106af5c3?auto=format&fit=crop&w=1200&q=80 (bedroom — kamar tidur dengan meja kerja)
- https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?auto=format&fit=crop&w=1200&q=80 (bedroom — kamar tidur kayu hangat)
- https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=1200&q=80 (rental-house — rumah sewa tampak depan)
- https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80 (rental-house — rumah modern dengan halaman)
- https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80 (rental-house — rumah modern malam hari)
- https://images.unsplash.com/photo-1560448075-bb485b067938?auto=format&fit=crop&w=1200&q=80 (rental-house — gedung apartemen)
- https://images.unsplash.com/photo-1416331108676-a22ccb276e35?auto=format&fit=crop&w=1200&q=80 (rental-house — properti perumahan)
- https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80 (apartment-interior — dapur bersih terawat)
- https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80 (keys-door — kontrak sewa & kunci)
- https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?auto=format&fit=crop&w=1200&q=80 (keys-door — kunci pintu)

Kembalikan HANYA format JSON ARRAY valid tanpa pembungkus backtick markdown:
[
  {
    "title": "Judul Artikel 1 SEO",
    "slug": "slug-url-unik-1",
    "meta_description": "Deskripsi ringkas 150 karakter untuk Google...",
    "content": "Konten lengkap format Markdown minimal 1000 kata dengan ## dan ###...",
    "image_url": "https://images.unsplash.com/photo-..."
  },
  {
    "title": "Judul Artikel 2 SEO",
    "slug": "slug-url-unik-2",
    "meta_description": "Deskripsi ringkas 150 karakter untuk Google...",
    "content": "Konten lengkap format Markdown minimal 1000 kata dengan ## dan ###...",
    "image_url": "https://images.unsplash.com/photo-..."
  },
  {
    "title": "Judul Artikel 3 SEO",
    "slug": "slug-url-unik-3",
    "meta_description": "Deskripsi ringkas 150 karakter untuk Google...",
    "content": "Konten lengkap format Markdown minimal 1000 kata dengan ## dan ###...",
    "image_url": "https://images.unsplash.com/photo-..."
  }
]`;

/** 401 + pesan jelas (detail hanya di log server) */
function unauthorized(): NextResponse {
  return NextResponse.json(
    { success: false, error: "Unauthorized — header Authorization: Bearer <CRON_SECRET> wajib." },
    { status: 401 },
  );
}

/**
 * Ekstrak array JSON dari teks model — tahan banting: buang code fence
 * markdown, ambil dari '[' pertama s.d. ']' terakhir, lalu JSON.parse.
 */
function extractJsonArray(raw: string): unknown[] | null {
  if (!raw) return null;
  let text = raw.trim();
  // Buang pembungkus ```json ... ``` bila model tetap menyisipkannya
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Normalisasi slug — lowercase, non-alfanumerik → '-', rapi di kedua ujung */
function sanitizeSlug(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "artikel-unitku"
  );
}

/**
 * Validasi URL cover — HANYA terima https://images.unsplash.com/photo-…
 * (satu-satunya domain yang diizinkan next/image remotePatterns). URL lain /
 * model mengarang → null → UI memakai cover default.
 */
function sanitizeImageUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const url = input.trim();
  return /^https:\/\/images\.unsplash\.com\/[\w-]+/.test(url) ? url : null;
}

/** Validasi & rapikan satu objek artikel hasil model (string wajib ada) */
function normalizeArticle(
  item: unknown,
  usedSlugs: Set<string>,
): NewArticleInput | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  const metaDescription =
    typeof obj.meta_description === "string" ? obj.meta_description.trim() : "";
  const content = typeof obj.content === "string" ? obj.content.trim() : "";
  if (!title || !content) return null;

  // Slug unik dalam batch — duplikat diberi akhiran -2, -3, dst.
  const baseSlug = sanitizeSlug(
    typeof obj.slug === "string" && obj.slug ? obj.slug : title,
  );
  let slug = baseSlug;
  let counter = 2;
  while (usedSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
  usedSlugs.add(slug);

  return {
    title: title.slice(0, 200),
    slug,
    meta_description: metaDescription.slice(0, 300),
    content,
    image_url: sanitizeImageUrl(obj.image_url),
  };
}

export async function GET(req: Request) {
  // ── 1. Autentikasi cron — Bearer CRON_SECRET (fail-closed) ────────────────
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    console.error(
      "[UnitKu Cron auto-article] Tolak akses: CRON_SECRET kosong atau header tidak cocok.",
    );
    return unauthorized();
  }

  // ── 2. Siapkan kredensial Gemini ──────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(
      "[UnitKu Cron auto-article] GEMINI_API_KEY tidak terisi — generate dilewati.",
    );
    return NextResponse.json(
      { success: false, error: "GEMINI_API_KEY belum dikonfigurasi di environment." },
      { status: 500 },
    );
  }

  // ── 3. Panggil Gemini (responseMimeType json + thinking off utk kecepatan) ─
  let rawText = "";
  try {
    const res = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: GEMINI_PROMPT }] }],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: "application/json",
          // Artikel 3 × 1000-1500 kata berformat Markdown+JSON butuh ruang
          // token besar — 65536 adalah maksimum gemini-2.5-flash.
          maxOutputTokens: 65536,
          // Tulis artikel tidak butuh reasoning — matikan thinking agar muat
          // dlm batas maxDuration 60 dtk (gemini-2.5-flash).
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(
        `[UnitKu Cron auto-article] Gemini HTTP ${res.status}:`,
        errText.slice(0, 500),
      );
      return NextResponse.json(
        { success: false, error: `Gemini API error HTTP ${res.status}.` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    rawText = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");
  } catch (err) {
    console.error("[UnitKu Cron auto-article] Panggilan Gemini gagal:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menghubungi Gemini API." },
      { status: 502 },
    );
  }

  // ── 4. Parse & validasi JSON array artikel ────────────────────────────────
  const parsed = extractJsonArray(rawText);
  if (!parsed || parsed.length === 0) {
    console.error(
      "[UnitKu Cron auto-article] Respons bukan JSON array valid:",
      rawText.slice(0, 300),
    );
    return NextResponse.json(
      { success: false, error: "Gemini tidak mengembalikan JSON array valid." },
      { status: 502 },
    );
  }

  const withoutImage = parsed.filter(
    (a) =>
      a && typeof a === "object" && sanitizeImageUrl((a as Record<string, unknown>).image_url) === null,
  ).length;
  if (withoutImage > 0) {
    console.warn(
      `[UnitKu Cron auto-article] ${withoutImage} artikel tanpa image_url valid — akan memakai cover default.`,
    );
  }

  const usedSlugs = new Set<string>();
  const articles = parsed
    .map((item) => normalizeArticle(item, usedSlugs))
    .filter((a): a is NewArticleInput => a !== null);

  if (articles.length === 0) {
    return NextResponse.json(
      { success: false, error: "Artikel hasil generate tidak valid (title/content kosong)." },
      { status: 502 },
    );
  }

  // ── 5. Batch insert ke Supabase (upsert on conflict slug → idempotent) ────
  const result = await insertGeneratedArticles(articles);
  if (result.error) {
    console.error("[UnitKu Cron auto-article] Insert DB gagal:", result.error);
    return NextResponse.json(
      { success: false, error: `Gagal menyimpan artikel: ${result.error}` },
      { status: 500 },
    );
  }

  console.log(
    `[UnitKu Cron auto-article] ${result.inserted}/${articles.length} artikel tersimpan: ${result.slugs.join(", ")}`,
  );

  // ── 6. Respons sukses sesuai spesifikasi ──────────────────────────────────
  return NextResponse.json({
    success: true,
    count: articles.length,
    slugs: articles.map((a) => a.slug),
  });
}
