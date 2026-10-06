"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — useLeadsAlerts: deteksi pendaftar (lead) baru secara realtime
//
// Dua lapis pemicu, SATU sumber data (endpoint aman):
//   1. Polling GET /api/admin/leads/latest (guard super-admin) tiap `pollMs`
//      — bekerja di SEMUA lingkungan (Supabase/lokal), tanpa syarat RLS.
//   2. Supabase Realtime postgres_changes INSERT pada license_leads (bila
//      NEXT_PUBLIC_SUPABASE_* terisi & publikasi realtime diaktifkan di DB —
//      lihat sql/license-leads-realtime.sql) → pemicu instan (<1 detik),
//      datanya TETAP diambil dari endpoint (PII lead tidak lewat channel).
//   Ekstra: cek ulang saat tab kembali visible (admin sering pindah tab).
//
// Efek saat lead BARU terdeteksi (setelah baseline awal):
//   toast melayang [Chat WhatsApp][Buka Admin] + chime Web Audio + badge
//   merah di nav Super Admin + navigator.setAppBadge (PWA di HP) + callback
//   onNewLead (mis. auto-refresh tabel /admin).
//
// Polling pertama HANYA menetapkan baseline (lead terbaru yang sudah ada saat
// halaman dibuka tidak dianggap "baru") — anti-notifikasi basi saat refresh.
// Semua proses non-blocking; kegagalan jaringan/DB diabaikan senyap karena
// polling berikutnya otomatis mencoba lagi.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import {
  markLeadsSeen,
  reportNewLead,
  type LeadAlertInfo,
} from "@/lib/leads-alert-store";
import { showLeadAlertToast } from "@/components/admin/lead-alert-toast";
import { playLeadAlertSound } from "@/lib/notification-sound";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/auth/config";
import { fetchWithTimeout } from "@/lib/http";

export interface UseLeadsAlertsOptions {
  /** Hanya aktif untuk Super Admin (dari /api/auth/me → isSuperAdmin) */
  enabled: boolean;
  /** Jeda polling ms — default 30.000 (dashboard); panel admin 20.000 */
  pollMs?: number;
  /** Efek tambahan saat lead baru (mis. re-fetch tabel /admin) */
  onNewLead?: (info: LeadAlertInfo) => void;
  /** true = tandai sudah ditinjau tiap cek sukses (panel admin aktif) */
  autoMarkSeen?: boolean;
}

interface LatestLeadResponse {
  ok?: boolean;
  latest?: LeadAlertInfo | null;
}

export function useLeadsAlerts({
  enabled,
  pollMs = 30_000,
  onNewLead,
  autoMarkSeen = false,
}: UseLeadsAlertsOptions): void {
  /** undefined = belum ada baseline; null = belum ada lead; string = id lead terakhir */
  const baselineIdRef = useRef<string | null | undefined>(undefined);
  const inFlightRef = useRef(false);
  const onNewLeadRef = useRef(onNewLead);
  useEffect(() => {
    onNewLeadRef.current = onNewLead;
  }, [onNewLead]);

  const check = useCallback(
    async (announce: boolean): Promise<void> => {
      if (!enabled || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const res = await fetchWithTimeout("/api/admin/leads/latest", {
          cache: "no-store",
          timeoutMs: 8_000,
        });
        if (!res.ok) return; // 401/403 bukan admin, 503 DB — senyap, polling lanjut
        const data = (await res.json().catch(() => null)) as LatestLeadResponse | null;
        const latest = data?.latest ?? null;

        if (baselineIdRef.current === undefined) {
          // Cek pertama — kunci baseline agar lead lama tidak dianggap baru
          baselineIdRef.current = latest?.id ?? null;
          if (autoMarkSeen) markLeadsSeen();
          return;
        }
        if (latest && latest.id !== baselineIdRef.current) {
          baselineIdRef.current = latest.id;
          if (autoMarkSeen) markLeadsSeen();
          if (announce) {
            reportNewLead(latest);
            playLeadAlertSound();
            showLeadAlertToast(latest);
            onNewLeadRef.current?.(latest);
          }
        }
      } catch {
        /* offline/timeout — polling berikutnya mencoba lagi */
      } finally {
        inFlightRef.current = false;
      }
    },
    [enabled, autoMarkSeen],
  );

  // Lapisan 1 — polling berkala + cek saat tab kembali visible
  useEffect(() => {
    if (!enabled) return;
    void check(false);
    const interval = setInterval(() => void check(true), pollMs);
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") void check(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, pollMs, check]);

  // Lapisan 2 — Supabase Realtime (opsional, percepatan pemicu)
  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) return;
    let client: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const scheduleCheck = (): void => {
        if (debounceTimer) return;
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          void check(true);
        }, 800);
      };
      channel = client
        .channel("unitku-license-leads-watch")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "license_leads" },
          scheduleCheck,
        )
        .subscribe();
    } catch {
      /* realtime tidak tersedia — polling tetap berjalan */
    }
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (client && channel) {
        void client
          .removeChannel(channel)
          .catch(() => {});
      }
    };
  }, [enabled, check]);
}
