"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — useTrialCheckoutHref: URL checkout MITRA pembuat trial (client)
//
// Memecahkan atribusi komisi di dashboard mode uji coba: SEMUA tombol lisensi
// (banner atas "Aktifkan Lisensi" & bar bawah "Beli Lisensi Sekarang") wajib
// menuju checkout milik mitra pembuat trial — /checkout?ref=<refCode> —
// BUKAN checkout pusat admin. refCode di-resolve dari token trial (cookie
// unitku_trial) via GET /api/trial/state (server = sumber kebenaran DB).
//
//   • enabled=false (bukan konteks trial) → null, TANPA fetch.
//   • Belum selesai fetch / gagal jaringan / cookie trial absen → null.
//     Pemanggil MENYEMBUNYIKAN CTA selama null — owner trial TIDAK PERNAH
//     diarahkan ke checkout pusat yang mencuri komisi mitra.
//   • Sekali resolve → stabil (tanpa polling; refCode mitra tidak berubah).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";

import {
  buildCheckoutUrl,
  fetchTrialState,
  readTrialTokenClient,
} from "@/lib/trial-shared";

export function useTrialCheckoutHref(enabled: boolean): string | null {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const token = readTrialTokenClient();
    if (!token) return; // tanpa cookie trial → tak bisa resolve (tetap null)
    void fetchTrialState(token).then((state) => {
      if (!alive || !state) return;
      setHref(buildCheckoutUrl(state.partnerRefCode));
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return href;
}
