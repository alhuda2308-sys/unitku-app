// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — HOOK UTAMA penampil data kamar (single source of truth status)
//
// HOOK UNIVERSAL: dipakai semua jenis akun (Akun Admin, Akun Pemilik/User
// Riil, sesi Staf, maupun Mode Demo) dan semua properti (multi-cabang) —
// input apa pun array `rooms` aktif, output selalu kamar berstatus EFEKTIF.
//
// Status kamar TIDAK pernah dibaca mentah dari `room.status` (kolom database
// denormalisasi / dataset statis). Status efektif DIHITUNG realtime dari:
//   • nextBillingDate — jatuh tempo tagihan berikutnya (siklus sewa; maju 1
//     siklus tiap "Tandai Lunas"), fallback contractEnd utk data lama
//   • selisih terhadap HARI INI (tengah malam lokal, stabil lintas zona waktu)
//
// Klasifikasi (aturan di src/lib/room-status.ts — dipakai bersama server):
//   lewat jatuh tempo tagihan (today > due) → "menunggak"  — TANPA kecuali
//   H-3 s.d. H+0                            → "jatuhTempo"
//   tagihan berikutnya masih jauh            → "lunas" (siklus terbayar)
//   kosong / tanpa tanggal acuan            → status dasar
//
// contractEnd TIDAK lagi menentukan status (decoupled) — tanggal itu kini
// murni batas masa komitmen sewa ("Habis:" di kartu & sisa hari kontrak).
//
// ── Update OTOMATIS saat tanggal berganti ────────────────────────────────────
// "Hari ini" TIDAK dibekukan seumur halaman: ticker modul memeriksa kalender
// tiap 30 detik + instan saat tab kembali terlihat/fokus. Saat tanggal
// berganti (melewati tengah malam jatuh tempo), `now` dihitung ulang →
// seluruh status, kartu statistik & tab filter bergeser sendiri TANPA reload
// — laporan pemilik: "harusnya update otomatis ketika tanggal melewati jatuh
// tempo". Pembedaan hari memakai key string sehingga re-render hanya terjadi
// sekali per pergantian tanggal, bukan tiap interval.
//
// Konsumen wajib memakai hasil hook ini untuk SEMUA permukaan yang menampilkan
// status kamar (denah, kartu statistik, tab filter, direktori penghuni, portal
// mirror, dsb.) — kamar kontraknya lewat MUSTAHIL tampil "Lunas" di mana pun.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useSyncExternalStore } from "react";
import type { Room } from "@/lib/kost-data";
import { deriveRoomStatuses } from "@/lib/room-status";

// ── Ticker pergantian tanggal (modul-level — satu interval utk semua konsumen)

const DAY_TICK_MS = 30_000;

let dayKeyCache = "";
let tickTimer: ReturnType<typeof setInterval> | null = null;
const dayListeners = new Set<() => void>();

/** Key kalender lokal "YYYY-M-D" — berubah tepat saat tanggal berganti. */
function currentDayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function checkDayRollover(): void {
  const next = currentDayKey();
  if (next !== dayKeyCache) {
    dayKeyCache = next;
    dayListeners.forEach((l) => l());
  }
}

function subscribeDayTicker(listener: () => void): () => void {
  dayListeners.add(listener);
  if (dayListeners.size === 1 && typeof window !== "undefined") {
    dayKeyCache = currentDayKey();
    tickTimer = setInterval(checkDayRollover, DAY_TICK_MS);
    // Tab yang sempat ditidurkan (HP ketiduran / laptop sleep) harus menangkap
    // pergantian tanggal SEGERA saat dibuka kembali — bukan menunggu tick.
    document.addEventListener("visibilitychange", checkDayRollover);
    window.addEventListener("focus", checkDayRollover);
  }
  return () => {
    dayListeners.delete(listener);
    if (dayListeners.size === 0 && tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
      document.removeEventListener("visibilitychange", checkDayRollover);
      window.removeEventListener("focus", checkDayRollover);
    }
  };
}

function getDayKeySnapshot(): string {
  return dayKeyCache;
}

/** Snapshot server: kosong — identik dgn render klien pertama (anti hidrasi). */
function getServerDayKeySnapshot(): string {
  return "";
}

/**
 * Kamar berstatus EFEKTIF (dinamis berbasis jatuh tempo tagihan vs hari ini).
 *
 * @param rooms kamar aktif properti terpilih — mentah dari demo (demoData)
 *              maupun cloud (Supabase `rooms` + `tenants`)
 * @param today taruh hanya untuk pengujian; produksi mengikuti ticker hari
 * @returns array BARU immutable; kamar tak berubah dipakai ulang referensinya
 *          agar memo/React aman
 */
export function useEffectiveRooms(rooms: Room[], today?: Date): Room[] {
  // Berubah sekali per pergantian tanggal (atau saat tab fokus ulang) —
  // pemicu tunggal recompute status di seluruh dashboard.
  const dayKey = useSyncExternalStore(
    subscribeDayTicker,
    getDayKeySnapshot,
    getServerDayKeySnapshot,
  );
  // "Hari ini" konsisten utk seluruh kamar dalam satu frame — tidak ada
  // flicker klasifikasi; dibekukan per-hari, bukan per-render.
  const now = useMemo(() => today ?? new Date(), [today, dayKey]);
  return useMemo(() => deriveRoomStatuses(rooms, now), [rooms, now]);
}
