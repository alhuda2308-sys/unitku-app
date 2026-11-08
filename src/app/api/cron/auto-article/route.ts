// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Cron Generator Artikel Harian: /api/cron/auto-article
//
// Dijadwalkan Vercel Cron (vercel.json) tiap hari 00:00 UTC = 08.00 WITA:
//   1. Validasi header Authorization: Bearer <CRON_SECRET>
//   2. 3 panggilan Gemini PARALEL (1 artikel / panggilan) → 3 artikel SEO
//      Bahasa Indonesia mendalam (1000-1500 kata, H2/H3, contoh kasus, tips
//      aksi) + cover image Unsplash + selipan rekomendasi natural UnitKu
//   3. Batch insert ke tabel Supabase `articles` (is_published: true,
//      upsert on-conflict-slug agar idempotent)
//   4. Balas { success, count, slugs }
//
// Kenapa 1 artikel per panggilan (bukan 3 sekaligus)?
//   Model stabil gemini-2.0-flash / gemini-1.5-flash dibatasi 8192 token
//   output per respons — 3 artikel panjang dalam SATU respons pasti terpotong
//   → JSON rusak. Satu artikel (±2000-3500 token) muat lega, dan 3 panggilan
//   berjalan PARALEL sehingga total durasi tetap ~durasi 1 panggilan.
//
// Model: gemini-2.0-flash (stabil, GA di v1beta) → fallback otomatis
//   gemini-1.5-flash bila 404/400 (mis. akun/key tertentu tak punya akses
//   model tsb — error "models/... is not found").
//
// Env WAJIB (diatur di Vercel → Settings → Environment Variables):
//   CRON_SECRET      — rahasia yg sama dgn schedule header Vercel Cron
//   GEMINI_API_KEY   — API key Google AI Studio
//   SUPABASE_SERVICE_ROLE_KEY — insert bypass RLS (server-side saja)
// ═════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import { insertGeneratedArticles, type NewArticleInput } from "@/lib/blog-articles";

// Serverless timeout guard — 3 panggilan paralel ≈ durasi 1 panggilan;
// 60 detik batas aman utk Vercel Functions.
export const maxDuration = 60;

// Selalu eksekusi fresh (tidak pernah di-cache edge)
export const dynamic = "force-dynamic";

// Model stabil di API v1beta (urutan fallback). gemini-2.0-flash utama;
// bila 404 ("models/... is not found") → coba gemini-1.5-flash.
const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"] as const;

// Maksimum output gemini-2.0-flash & gemini-1.5-flash = 8192 token.
// Set lebih dari ini → API menolak dengan 400 INVALID_ARGUMENT.
const MAX_OUTPUT_TOKENS = 8192;

// Batas waktu satu panggilan Gemini — sisakan ruang utk insert DB di dlm
// maxDuration 60 dtk.
const GEMINI_TIMEOUT_MS = 48_000;

const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Topik harian — 4 set × 3 topik, diputar per hari (day-of-epoch mod 4)
 * agar cron harian tidak menulis ulang topik yang sama terus-menerus.
 */
const TOPIC_SETS: string[][] = [
  [
    "tips pembukuan arus kas kost: memisahkan keuangan pribadi dan usaha, kategori pemasukan-pengeluaran, dan rekap laba bersih bulanan",
    "cara menagih sewa kost tepat waktu dengan pesan WhatsApp sopan plus kuitansi digital otomatis",
    "denah kamar interaktif untuk memantau status terisi/jatuh tempo dan perawatan fasilitas kost",
  ],
  [
    "strategi menaikkan okupansi kost saat musim sepi: penetapan harga, promosi, dan fasilitas yang paling dicari anak kos",
    "cara menyaring penyewa yang bagus: screening calon anak kos, aturan kontrak sewa, dan pengelolaan deposit",
    "checklist perawatan bulanan fasilitas kost: air, listrik, kebersihan, dan keamanan",
  ],
  [
    "kesalahan umum pemilik kost pemula dalam mengelola keuangan dan operasional serta cara menghindarinya",
    "digitalisasi pembayaran sewa kost: transfer bank, QRIS, dan pencatatan otomatis ke buku kas",
    "menangani komplain dan tiket perbaikan penyewa secara profesional agar penyewa betah dan perpanjang sewa",
  ],
  [
    "cara menghitung harga sewa kamar kost yang tepat agar untung tetapi tetap mudah terisi",
    "membuat kuitansi digital dan laporan keuangan bulanan kost yang rapi sebagai alat evaluasi usaha",
    "renovasi kamar kost hemat biaya untuk menaikkan nilai sewa dan daya tarik penyewa",
  ],
];

function pickDailyTopics(): string[] {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return TOPIC_SETS[dayIndex % TOPIC_SETS.length];
}

/** Pool URL Unsplash terverifikasi (semua pernah dicek HTTP 200) */
const UNSPLASH_POOL = `- https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80 (apartment-interior — ruang tamu apartemen modern)
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
- https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?auto=format&fit=crop&w=1200&q=80 (keys-door — kunci pintu)`;

/**
 * Prompt SATU artikel — mendalam (1000-1500 kata), H2/H3 komprehensif,
 * bullet points, contoh kasus nyata, tips aksi konkret, dan pemilihan cover
 * dari pool URL terverifikasi (Gemini hanya MEMILIH, tidak mengarang URL).
 */
function buildArticlePrompt(topic: string): string {
  return `Anda adalah konsultan ahli manajemen bisnis kost di Indonesia. Tulislah SATU artikel edukatif orisinal dengan topik: ${topic}.
Artikel MINIMAL 1000-1500 KATA, mendalam dan komprehensif, dalam Bahasa Indonesia.

KETENTUAN MUTLAK KUALITAS KONTEN (wajib dipenuhi):
- Struktur Markdown lengkap: minimal 4-6 sub-heading "##" (H2) dan beberapa sub-sub-heading "###" (H3) yang komprehensif
- Gunakan bullet points / daftar bernomor untuk langkah dan poin praktis
- Sertakan CONTOH KASUS NYATA dengan simulasi angka konkret (misal: perhitungan laba bersih kost 10 kamar, skenario keterlambatan bayar, perbandingan sebelum/sesudah sistem digital)
- Tutup dengan "## Kesimpulan" berisi TIPS AKSI KONKRET yang bisa dipraktikkan pembaca hari ini juga
- Selipkan ajakan/rekomendasi natural agar pembaca menggunakan aplikasi manajemen kost UnitKu (unitku.my.id)

GAMBAR COVER: pilih SATU URL Unsplash yang paling relevan dengan topik dari daftar URL foto terverifikasi berikut (JANGAN mengarang atau mengubah URL lain):
${UNSPLASH_POOL}

Kembalikan HANYA SATU objek JSON valid tanpa pembungkus backtick markdown:
{
  "title": "Judul Artikel SEO",
  "slug": "slug-url-unik",
  "meta_description": "Deskripsi ringkas 150 karakter untuk Google...",
  "content": "Konten lengkap format Markdown minimal 1000 kata dengan ## dan ###...",
  "image_url": "https://images.unsplash.com/photo-..."
}`;
}

/** 401 + pesan jelas (detail hanya di log server) */
function unauthorized(): NextResponse {
  return NextResponse.json(
    { success: false, error: "Unauthorized — header Authorization: Bearer <CRON_SECRET> wajib." },
    { status: 401 },
  );
}

/**
 * Ekstrak SATU objek JSON dari teks model — tahan banting: buang code fence
 * markdown, ambil dari '{' pertama s.d. '}' terakhir, lalu JSON.parse.
 */
function extractJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  let text = raw.trim();
  // Buang pembungkus ```json ... ``` bila model tetap menyisipkannya
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
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

/**
 * Satu panggilan Gemini → SATU objek artikel (sudah di-parse).
 * Fallback model otomatis: 404/400 pada satu model → coba model berikutnya
 * di GEMINI_MODELS (menangani kasus "models/... is not found").
 * Melempar Error bila semua model gagal.
 */
async function generateArticleJson(
  apiKey: string,
  prompt: string,
): Promise<Record<string, unknown>> {
  let lastError = "Tidak ada model yang dicoba.";

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.8,
              responseMimeType: "application/json",
              maxOutputTokens: MAX_OUTPUT_TOKENS,
              // thinkingConfig hanya valid utk keluarga 2.5 — model lain
              // dikirim tanpa field ini agar tidak berisiko ditolak.
              ...(model.startsWith("gemini-2.5")
                ? { thinkingConfig: { thinkingBudget: 0 } }
                : {}),
            },
          }),
        },
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        lastError = `HTTP ${res.status} pada ${model}: ${errText.slice(0, 300)}`;
        console.error(`[UnitKu Cron auto-article] ${lastError}`);
        // 404 (model tak tersedia utk key ini) / 400 (argumen tak valid) →
        // layak dicoba dgn model fallback berikutnya. Selain itu stop.
        if (res.status === 404 || res.status === 400) continue;
        break;
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        promptFeedback?: { blockReason?: string };
      };

      if (data.promptFeedback?.blockReason) {
        lastError = `Respons ${model} diblokir safety: ${data.promptFeedback.blockReason}`;
        console.error(`[UnitKu Cron auto-article] ${lastError}`);
        continue;
      }

      const rawText = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("");

      const parsed = extractJsonObject(rawText);
      if (parsed) return parsed;

      lastError = `Respons ${model} bukan objek JSON valid (kemungkinan terpotong). Awal teks: ${rawText.slice(0, 200)}`;
      console.error(`[UnitKu Cron auto-article] ${lastError}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = `Panggilan ${model} gagal: ${message}`;
      console.error(`[UnitKu Cron auto-article] ${lastError}`);
    }
  }

  throw new Error(lastError);
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

  // ── 2. Siapkan kredensial Gemini ─────────────────────────────────────
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

  // ── 3. 3 panggilan Gemini PARALEL (1 artikel per panggilan) ──────────────
  // Promise.allSettled: gagalnya 1 topik TIDAK menggugurkan 2 artikel lain —
  // yang berhasil tetap dipublikasikan hari itu.
  const topics = pickDailyTopics();
  const settled = await Promise.allSettled(
    topics.map((topic) =>
      generateArticleJson(apiKey, buildArticlePrompt(topic)),
    ),
  );

  const rawObjects: Record<string, unknown>[] = [];
  const failures: string[] = [];
  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      rawObjects.push(outcome.value);
    } else {
      failures.push(`Topik "${topics[i].slice(0, 60)}…": ${outcome.reason?.message ?? outcome.reason}`);
      console.error(
        `[UnitKu Cron auto-article] Gagal topik ${i + 1}:`,
        outcome.reason?.message ?? outcome.reason,
      );
    }
  });

  if (rawObjects.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Semua panggilan Gemini gagal. Detail pertama: ${failures[0] ?? "tidak diketahui"}`,
      },
      { status: 502 },
    );
  }

  // ── 4. Normalisasi & validasi artikel ─────────────────────────────────────
  const withoutImage = rawObjects.filter(
    (o) => sanitizeImageUrl(o.image_url) === null,
  ).length;
  if (withoutImage > 0) {
    console.warn(
      `[UnitKu Cron auto-article] ${withoutImage} artikel tanpa image_url valid — akan memakai cover default.`,
    );
  }

  const usedSlugs = new Set<string>();
  const articles = rawObjects
    .map((obj) => normalizeArticle(obj, usedSlugs))
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

  // ── 6. Respons sukses sesuai spesifikasi ──────────────────────────────
  return NextResponse.json({
    success: true,
    count: articles.length,
    slugs: articles.map((a) => a.slug),
  });
}
