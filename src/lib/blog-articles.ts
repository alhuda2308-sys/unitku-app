// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Akses data Blog Artikel (tabel Supabase `articles`) — SERVER-ONLY
//
// Sumber artikel: tabel public.articles di Supabase (lihat
// supabase/articles-table.sql — skema + RLS + seed pembuka).
//   • Pembacaan publik (listing/detail/sitemap): anon key — RLS hanya
//     memperlihatkan baris is_published = true.
//   • Penulisan (cron auto-article): service role via getSupabaseAdmin().
//
// Prinsip FAIL-OPEN ala UnitKu: Supabase belum dikonfigurasi / tabel belum
// ada / jaringan gagal → fungsi mengembalikan [] atau null (TANPA melempar)
// agar landing, blog, dan sitemap tetap hidup. Sandbox lokal (tanpa kredensial
// Supabase) otomatis jatuh ke kondisi kosong.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Baris tabel articles — bentuk kolom persis skema SQL */
export interface BlogArticleRow {
  id: string;
  title: string;
  slug: string;
  meta_description: string;
  content: string;
  is_published: boolean;
  created_at: string;
}

/** Baris ringkas utk sitemap (tanpa konten berat) */
export interface BlogArticleSlugRow {
  slug: string;
  created_at: string;
}

// Klien publik (anon) — dibuat & di-cache sekali per proses server.
let publicClient: SupabaseClient | null | undefined;

function getBlogPublicClient(): SupabaseClient | null {
  if (publicClient !== undefined) return publicClient;

  // Prioritas anon key (RLS aktif → hanya artikel published yang terbaca);
  // fallback service role bila anon tidak tersedia (filter is_published
  // tetap ditegakkan di setiap query).
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!url.startsWith("http") || key.length < 20) {
    console.error(
      "[UnitKu Blog] Kredensial Supabase tidak terisi — daftar artikel " +
        "dikembalikan kosong (blog tampil tanpa konten sampai env diisi).",
    );
    publicClient = null;
    return publicClient;
  }

  publicClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return publicClient;
}

const SELECT_COLUMNS =
  "id, title, slug, meta_description, content, is_published, created_at";

/**
 * Seluruh artikel published, terbaru dulu (created_at desc).
 * Gagal apa pun → [] (fail-open) — listing blog tetap render.
 */
export async function listPublishedArticles(
  limit?: number,
): Promise<BlogArticleRow[]> {
  const client = getBlogPublicClient();
  if (!client) return [];

  let query = client
    .from("articles")
    .select(SELECT_COLUMNS)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (limit && limit > 0) query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    console.error("[UnitKu Blog] listPublishedArticles gagal:", error.message);
    return [];
  }
  return (data ?? []) as BlogArticleRow[];
}

/**
 * Satu artikel published berdasarkan slug — null bila tidak ada / gagal.
 */
export async function getPublishedArticleBySlug(
  slug: string,
): Promise<BlogArticleRow | null> {
  const client = getBlogPublicClient();
  if (!client || !slug) return null;

  const { data, error } = await client
    .from("articles")
    .select(SELECT_COLUMNS)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    console.error("[UnitKu Blog] getPublishedArticleBySlug gagal:", error.message);
    return null;
  }
  return (data as BlogArticleRow | null) ?? null;
}

/**
 * Daftar slug + tanggal utk sitemap — GAGAL → [] (sitemap tetap memuat
 * halaman statis: landing, /blog, legal, dll).
 */
export async function listPublishedArticleSlugs(): Promise<
  BlogArticleSlugRow[]
> {
  const client = getBlogPublicClient();
  if (!client) return [];

  const { data, error } = await client
    .from("articles")
    .select("slug, created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[UnitKu Blog] listPublishedArticleSlugs gagal:", error.message);
    return [];
  }
  return (data ?? []) as BlogArticleSlugRow[];
}

// ── Penulisan (cron auto-article — service role, bypass RLS) ────────────────

/** Payload artikel hasil generate Gemini sebelum masuk DB */
export interface NewArticleInput {
  title: string;
  slug: string;
  meta_description: string;
  content: string;
}

export interface InsertArticlesResult {
  inserted: number;
  slugs: string[]; // slug yang benar-benar berhasil masuk DB
  error: string | null;
}

/**
 * Batch insert artikel hasil cron ke tabel articles (is_published: true).
 * Memakai klien ADMIN (service role) — RLS tabel tidak mengizinkan insert
 * anon. Konflik slug (artikel kembar antar-run) DILEWATI, bukan gagal total
 * (on conflict do nothing — butuh unique constraint pada kolom slug, sudah
 * dibuat di supabase/articles-table.sql).
 */
export async function insertGeneratedArticles(
  articles: NewArticleInput[],
): Promise<InsertArticlesResult> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      inserted: 0,
      slugs: [],
      error:
        "Klien admin Supabase tidak tersedia — set SUPABASE_SERVICE_ROLE_KEY " +
        "(dan NEXT_PUBLIC_SUPABASE_URL) di environment Vercel.",
    };
  }

  const rows = articles.map((a) => ({
    title: a.title,
    slug: a.slug,
    meta_description: a.meta_description,
    content: a.content,
    is_published: true,
  }));

  const { data, error } = await admin
    .from("articles")
    .upsert(rows, { onConflict: "slug", ignoreDuplicates: true })
    .select("slug");

  if (error) {
    return { inserted: 0, slugs: [], error: error.message };
  }

  const insertedSlugs = (data ?? []).map(
    (row: { slug: string }) => row.slug,
  );
  return { inserted: insertedSlugs.length, slugs: insertedSlugs, error: null };
}
