import { Loader2 } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Loading /affiliate/dashboard (Suspense fallback route segment)
//
// Tampil SELAMA server masih menyiapkan data portal mitra (verifikasi sesi,
// verifikasi magic-link, termasuk retry database bertoleransi ±6 dtk di
// getAffiliatePortalData*). Spinner minimalis yang tenang — BUKAN banner
// peringatan — sehingga proses fetching awal tidak lagi terlihat seperti
// kegagalan. Banner kuning "Gagal memuat data afiliasi" hanya muncul bila
// seluruh upaya selesai dan benar-benar gagal (isLoading === false).
// ─────────────────────────────────────────────────────────────────────────────

export default function Loading() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-zinc-50"
      role="status"
      aria-label="Memuat data afiliasi"
    >
      <p className="flex items-center gap-2.5 text-sm font-medium text-zinc-600">
        <Loader2
          className="size-5 animate-spin text-emerald-600"
          strokeWidth={2.25}
          aria-hidden="true"
        />
        Memuat data, mohon tunggu...
      </p>
    </main>
  );
}
