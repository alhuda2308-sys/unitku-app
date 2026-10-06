import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Skeleton in-place dashboard (pengganti loading layar penuh)
//
// Shell dashboard (sidebar, topbar, banner properti, tab) tampil INSTAN tanpa
// menunggu Supabase. Kartu data (metrik, denah kamar, tabel tagihan/kas,
// daftar penghuni/komplain/pengumuman) memakai placeholder shimmer tipis yang
// meniru bentuk komponen aslinya — data menyusul di latar belakang, seluruh
// layar tidak pernah diblokir halaman kosong.
// ─────────────────────────────────────────────────────────────────────────────

/** Blok shimmer dasar — blok abu tipis + sapuan cahaya (CSS .shimmer di globals.css) */
function Shimmer({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("shimmer rounded-md", className)} />;
}

/** Baris placeholder generik — dipakai tabel tagihan & daftar kas/penghuni/dll */
function RowPlaceholders({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      {/* Header tabel */}
      <div className="flex items-center gap-4 border-b border-zinc-100 bg-zinc-50/70 px-4 py-2.5">
        <Shimmer className="h-3 w-16" />
        <Shimmer className="h-3 w-24" />
        <Shimmer className="hidden h-3 w-20 sm:block" />
        <Shimmer className="ml-auto h-3 w-16" />
      </div>
      {/* Baris data */}
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0"
        >
          <Shimmer className="size-8 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Shimmer className="h-3.5 w-1/3 max-w-[180px]" />
            <Shimmer className="h-3 w-1/2 max-w-[240px]" />
          </div>
          <Shimmer className="h-6 w-20 shrink-0 rounded-full" />
          <Shimmer className="hidden h-8 w-24 shrink-0 rounded-lg sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Kartu metrik placeholder (meniru StatCard / MetricCard) */
function MetricCardPlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-zinc-200 bg-white p-4", className)}>
      <Shimmer className="h-3 w-24" />
      <Shimmer className="mt-2.5 h-7 w-16 rounded-sm" />
      <Shimmer className="mt-2 h-3 w-28" />
    </div>
  );
}

/** Skeleton strip metrik denah (4 kartu statistik) */
export function MetricStripSkeleton() {
  return (
    <section
      aria-label="Memuat ringkasan statistik"
      role="status"
      className="grid grid-cols-2 gap-3 xl:grid-cols-4"
    >
      <MetricCardPlaceholder />
      <MetricCardPlaceholder />
      <MetricCardPlaceholder />
      <MetricCardPlaceholder />
    </section>
  );
}

/** Skeleton denah kamar — pil filter + grid kartu kamar setinggi kartu asli */
export function RoomMatrixSkeleton() {
  return (
    <section aria-label="Memuat denah kamar" role="status" className="space-y-4">
      {/* Filter tabs segmented control */}
      <Shimmer className="h-9 w-full max-w-xl rounded-full" />
      {/* Section lantai */}
      <div>
        <Shimmer className="mb-2.5 h-4 w-32" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className="h-[124px] rounded-lg border border-zinc-200 bg-white p-3"
            >
              <div className="flex items-start justify-between">
                <Shimmer className="h-5 w-12" />
                <Shimmer className="h-5 w-16 rounded-full" />
              </div>
              <Shimmer className="mt-7 h-3.5 w-20" />
              <Shimmer className="mt-4 h-5 w-24" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Skeleton view Tagihan & Invoice — judul + toolbar + 4 metrik + tabel */
export function TagihanSkeleton() {
  return (
    <div role="status" aria-label="Memuat tagihan" className="space-y-5">
      <Shimmer className="h-8 w-56" />
      <Shimmer className="h-9 w-full max-w-md rounded-full" />
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <MetricCardPlaceholder />
        <MetricCardPlaceholder />
        <MetricCardPlaceholder />
        <MetricCardPlaceholder />
      </div>
      <RowPlaceholders rows={6} />
    </div>
  );
}

/** Skeleton view Buku Kas — judul + toolbar + 3 metrik + daftar entri */
export function KasSkeleton() {
  return (
    <div role="status" aria-label="Memuat buku kas" className="space-y-4">
      <Shimmer className="h-8 w-48" />
      <Shimmer className="h-9 w-full max-w-md rounded-full" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCardPlaceholder />
        <MetricCardPlaceholder />
        <MetricCardPlaceholder />
      </div>
      <RowPlaceholders rows={6} />
    </div>
  );
}

/** Skeleton daftar generik — komplain, pengumuman, data penghuni */
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Memuat data" className="space-y-4">
      <Shimmer className="h-8 w-56" />
      <Shimmer className="h-9 w-full max-w-md rounded-full" />
      <RowPlaceholders rows={rows} />
    </div>
  );
}

/** Skeleton Portal Penyewa (render mandiri tanpa shell owner) */
export function PortalSkeleton() {
  return (
    <div
      role="status"
      aria-label="Memuat portal penyewa"
      className="flex min-h-screen items-center justify-center bg-background p-4"
    >
      <div className="w-full max-w-md space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
        <Shimmer className="h-5 w-40" />
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-3/4" />
        <Shimmer className="h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}
