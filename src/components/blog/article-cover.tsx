// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Cover Artikel Blog (shared: listing card + detail hero)
//
// • Menampilkan cover artikel dgn rasio 16:9 konsisten di seluruh blog.
// • Sumber: article.image_url (URL Unsplash terverifikasi dari cron Gemini)
//   → divalidasi ulang di sisi render; bila kosong/tidak dikenal, otomatis
//   jatuh ke cover default lokal /blog/default-cover.jpg (tidak pernah
//   tampil gambar rusak).
// • <Image> next/image (lazy by default, priority opsional utk hero LCP).
// ─────────────────────────────────────────────────────────────────────────────

import Image from "next/image";

import { DEFAULT_ARTICLE_COVER } from "@/lib/landing-config";

interface ArticleCoverProps {
  imageUrl: string | null | undefined;
  title: string;
  /** true utk hero detail (elemen LCP) — muat tanpa lazy */
  priority?: boolean;
  /** Wajib — hint responsive sizes utk optimizer next/image */
  sizes: string;
  /** Kelas tambahan utk wrapper (rounded, ring, dsb.) */
  className?: string;
  /** Kelas tambahan utk <img> (efek hover, dsb.) */
  imgClassName?: string;
}

export function ArticleCover({
  imageUrl,
  title,
  priority = false,
  sizes,
  className = "",
  imgClassName = "",
}: ArticleCoverProps) {
  // Guard render: hanya URL Unsplash resmi yang dipakai langsung — kolom
  // image_url lama/bisa berisi nilai aneh hasil edit manual di Supabase.
  const src =
    imageUrl && imageUrl.startsWith("https://images.unsplash.com/")
      ? imageUrl
      : DEFAULT_ARTICLE_COVER;

  return (
    <div
      className={`relative aspect-[16/9] w-full overflow-hidden bg-zinc-100 ${className}`}
    >
      <Image
        src={src}
        alt={`Cover artikel: ${title}`}
        fill
        priority={priority}
        sizes={sizes}
        className={`object-cover ${imgClassName}`}
      />
    </div>
  );
}
