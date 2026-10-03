import Image from "next/image";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Loading Screen awal (Suspense fallback seluruh segmen tanpa
// loading.tsx sendiri). Menampilkan LOGO LENGKAP (rumah + tulisan UnitKu) —
// bukan ikon rumah saja — agar momen pembuka aplikasi selalu menampilkan
// brand, termasuk saat PWA diluncurkan dari shortcut home screen.
// ─────────────────────────────────────────────────────────────────────────────

export default function Loading() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-white"
      role="status"
      aria-label="Memuat UnitKu"
    >
      <Image
        src="/brand/logo-full.png"
        alt="UnitKu — rumah + tulisan UnitKu"
        width={180}
        height={180}
        priority
        className="animate-pulse select-none"
      />
      <span className="sr-only">Memuat UnitKu…</span>
    </div>
  );
}
