"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — LeadsAlertWatcher: mesin notifikasi lead baru di dashboard reguler
//
// Dipasang sekali di /dashboard (hanya untuk sesi Super Admin, bukan demo):
// berjalan di latar belakang — polling + Supabase Realtime + toast aksi +
// chime + badge (nav & PWA). Merender apa pun TIDAK — murni efek samping, jadi
// denah kamar/kas/tagihan tetap secepat biasa.
// ─────────────────────────────────────────────────────────────────────────────

import { useLeadsAlerts } from "@/hooks/use-leads-alerts";

export function LeadsAlertWatcher({ enabled }: { enabled: boolean }) {
  useLeadsAlerts({ enabled, pollMs: 30_000 });
  return null;
}
