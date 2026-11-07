// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Cron Generator Artikel Harian: /api/cron/auto-article
//
// Dijadwalkan Vercel Cron (vercel.json) tiap hari 00:00 UTC = 08.00 WITA:
//   1. Validasi header Authorization: Bearer <CRON_SECRET>
//   2. Panggil Google Gemini (gemini-2.5-flash) → 3 artikel SEO Bahasa
//      Indonesia (JSON array) seputar manajemen kost, selipan rekomendasi
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

// Serverless timeout guard — generate 3 artikel ~700-1000 kata butuh waktu;
// 60 detik batas aman utk Vercel Functions.
export const maxDuration = 60;

// Selalu eksekusi fresh (tidak pernah di-cache edge)
export const dynamic = "force-dynamic";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** Prompt sesuai spesifikasi — minta HANYA JSON array tanpa pembungkus markdown */
const GEMINI_PROMPT = `Anda adalah konsultan ahli manajemen bisnis kost di Indonesia. Buatlah 3 artikel edukatif orisinal yang berbeda topik (masing-masing 700-1000 kata) dalam Bahasa Indonesia seputar pengelolaan bisnis kost (misal topik 1: tips pembukuan arus kas kost, topik 2: cara menagih sewa tepat waktu & kuitansi digital, topik 3: denah kamar interaktif atau tips perawatan fasilitas). Selipkan ajakan/rekomendasi natural di tiap artikel agar pembaca menggunakan aplikasi manajemen kost UnitKu (unitku.my.id).
Kembalikan HANYA format JSON ARRAY valid tanpa pembungkus backtick markdown:
[
  {
    "title": "Judul Artikel 1 SEO",
    "slug": "slug-url-unik-1",
    "meta_description": "Deskripsi ringkas 150 karakter untuk Google...",
    "content": "Konten lengkap format Markdown..."
  },
  {
    "title": "Judul Artikel 2 SEO",
    "slug": "slug-url-unik-2",
    "meta_description": "Deskripsi ringkas 150 karakter untuk Google...",
    "content": "Konten lengkap format Markdown..."
  },
  {
    "title": "Judul Artikel 3 SEO",
    "slug": "slug-url-unik-3",
    "meta_description": "Deskripsi ringkas 150 karakter untuk Google...",
    "content": "Konten lengkap format Markdown..."
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
          maxOutputTokens: 32768,
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
