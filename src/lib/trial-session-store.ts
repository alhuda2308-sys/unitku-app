// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Persistensi sesi TRIAL per token (client-safe, localStorage)
//
// Akun trial (link /trial?token=… dari mitra) memasuki dashboard utama dalam
// kondisi FRESH STATE — tanpa data dummy. Owner kemudian memasukkan data
// kamar/kos mereka sendiri dari nol. Mutasi sesi trial berjalan di mode lokal
// (sesi demo tidak pernah menyentuh database — mutasi API akan menulis ke
// scope "demo-owner" dan mencampur data demo), sehingga agar kerja owner
// TIDAK hilang saat halaman dimuat ulang, seluruh snapshot sesi disimpan di
// localStorage PER TOKEN trial:
//   kamar, tagihan, buku kas, tiket komplain, pengumuman + pengaturan
//   (identitas & preferensi yang diedit owner selama trial).
//
// Catatan desain:
//   • Kunci = token OwnerTrial (dari cookie unitku_trial) → dua link trial
//     berbeda di perangkat yang sama tidak pernah saling menimpa data.
//   • Data TIDAK terkirim ke cloud (trial = evaluasi per perangkat); setelah
//     owner mengaktifkan lisensi, akun riilnya memakai database sendiri.
//   • Toleran terhadap data korup/lama: field yang tidak valid diabaikan,
//     bukan melempar error.
// ─────────────────────────────────────────────────────────────────────────────

import type { IndoKostSettings } from "@/lib/app-settings";
import type { Room } from "@/lib/kost-data";
import type { Invoice } from "@/lib/kost-invoices";
import type { CashEntry } from "@/lib/kost-cashflow";
import type { Ticket } from "@/lib/ticket-data";
import type { Announcement } from "@/lib/announcement-data";

/** Awalan kunci localStorage — nilai utuhnya `unitku_trial_session:<token>` */
const KEY_PREFIX = "unitku_trial_session:";

/** Snapshot lengkap satu sesi trial (semua field opsional — merge per bagian) */
export interface TrialSessionSnapshot {
  /** Pengaturan yang diedit owner trial (identitas, staf, template, tema…) */
  settings?: IndoKostSettings;
  rooms?: Room[];
  invoices?: Invoice[];
  cashEntries?: CashEntry[];
  tickets?: Ticket[];
  announcements?: Announcement[];
  /** Penanda waktu simpan terakhir (ISO) — keperluan debug/inspeksi */
  savedAt?: string;
}

function storageKey(token: string): string {
  return `${KEY_PREFIX}${token}`;
}

/** Baca snapshot sesi trial dari localStorage — null bila tidak ada/tak valid */
export function loadTrialSession(token: string): TrialSessionSnapshot | null {
  if (typeof window === "undefined") return null;
  const id = token.trim();
  if (!id) return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKey(id));
  } catch {
    return null; // localStorage non-aktif (private mode) — sesi berjalan tanpa persistensi
  }
  if (!raw) return null;
  try {
    return sanitizeSnapshot(JSON.parse(raw));
  } catch {
    return null; // JSON korup — perlakukan sebagai sesi baru (fresh state)
  }
}

/** Simpan (merge) sebagian snapshot sesi trial — kegagalan kuota diabaikan aman */
export function saveTrialSession(
  token: string,
  patch: Partial<TrialSessionSnapshot>,
): void {
  if (typeof window === "undefined") return;
  const id = token.trim();
  if (!id) return;
  const current = loadTrialSession(id) ?? {};
  const next: TrialSessionSnapshot = { ...current, ...patch, savedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(storageKey(id), JSON.stringify(next));
  } catch (err) {
    // Kuota penuh / storage diblokir — jangan pernah menggagalkan UI trial
    console.warn("[UnitKu Trial] Gagal menyimpan sesi trial di perangkat:", err);
  }
}

/** Sanitasi toleran: field array disalin bila memang array, selain itu diabaikan */
function sanitizeSnapshot(raw: unknown): TrialSessionSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const snapshot: TrialSessionSnapshot = {};
  const arrayField = (value: unknown): boolean => Array.isArray(value);

  if (arrayField(r.rooms)) snapshot.rooms = r.rooms as Room[];
  if (arrayField(r.invoices)) snapshot.invoices = r.invoices as Invoice[];
  if (arrayField(r.cashEntries)) snapshot.cashEntries = r.cashEntries as CashEntry[];
  if (arrayField(r.tickets)) snapshot.tickets = r.tickets as Ticket[];
  if (arrayField(r.announcements)) snapshot.announcements = r.announcements as Announcement[];
  if (r.settings && typeof r.settings === "object" && !Array.isArray(r.settings)) {
    snapshot.settings = r.settings as IndoKostSettings;
  }
  return Object.keys(snapshot).length > 0 ? snapshot : null;
}
