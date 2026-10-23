// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Klien API (frontend → Next.js Route Handlers → Prisma → Supabase)
//
// Semua pemanggilan memakai path relatif "/api/…" (aman gateway/preview) dan
// melempar Error berbahasa Indonesia saat gagal — siap ditampilkan sebagai
// toast notifikasi sukses/gagal di seluruh dashboard.
// ─────────────────────────────────────────────────────────────────────────────

import { fetchWithTimeout, isTimeoutError } from "@/lib/http";
import {
  notifySyncError,
  notifySyncSettled,
  notifySyncStart,
  notifySyncSuccess,
} from "@/lib/sync-status";
import type { Room as ClientRoom, RoomStatus } from "@/lib/kost-data";
import type { Invoice as ClientInvoice } from "@/lib/kost-invoices";
import type { CashEntry as ClientCashEntry, CashType } from "@/lib/kost-cashflow";
import type { Ticket as ClientTicket } from "@/lib/ticket-data";
import type { TechnicianContact as ClientTechnician } from "@/lib/technician-data";
import type { StaffAccessMember } from "@/lib/staff-access";
import type { Announcement as ClientAnnouncement, AnnouncementDraft } from "@/lib/announcement-data";
import type { ClientProperty } from "@/lib/server/mappers";
import type { PortalRekening } from "./tenant-portal";
import type { SettingsCloudPatch } from "./app-settings";

// ── 401 anti ping-pong (infinite reload) ────────────────────────────────
// 401 SEKENS bisa terjadi pada pemilik sesi sah: access token Supabase
// kedaluwarsa dan beberapa request paralel berlomba me-refresh token (rotasi
// refresh token), sehingga satu request gagal sementara yang lain berhasil.
// Redirect membuta ke /login membuat middleware memantulkan balik pemilik
// sesi sah ke /dashboard → 401 lagi → pantul lagi = RELOAD TANPA UJUNG.
// Maka: konfirmasi dulu ke /api/auth/me (sumber kebenaran sesi), redirect
// HANYA bila sesi benar-benar batal, dan bersihkan cookie basi sebelum
// pergi agar middleware tidak memantul balik.

/** Konfirmasi sesi ke /api/auth/me — true HANYA bila terkonfirmasi pasti:
 *  HTTP 200 + body JSON terbaca + user === null. Kegagalan apa pun (500/503,
 *  body rusak, timeout, network) = TIDAK TERKONFIRMASI → false — jangan usir
 *  pengguna berdasarkan ketidakpastian (sumber utama logout/loop palsu). */
async function isReallyLoggedOut(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout("/api/auth/me", {
      cache: "no-store",
      timeoutMs: 8_000,
    });
    if (!res.ok) return false; // 500/503 (mis. race auth sesaat) → tak terkonfirmasi
    const body = (await res.json().catch(() => null)) as { user?: unknown } | null;
    if (body === null) return false; // body bukan JSON valid → tak terkonfirmasi
    return body.user == null; // 200 + user null → benar-benar belum masuk
  } catch {
    // /api/auth/me sendiri gagal/timeout → TIDAK BISA dipastikan → jangan usir
    return false;
  }
}

/** Guard agar 401 beruntun tidak memicu beberapa redirect sekaligus */
let handling401 = false;
/** Redirect 401 maksimal SEKALI per muatan halaman — putus rantai pantulan
 *  /dashboard ⇄ /login bila sesuatu 401 lagi saat halaman lama masih hidup. */
let redirected401 = false;

async function handle401(): Promise<void> {
  if (handling401 || redirected401) return; // satu upaya per waktu & per page-load
  const path = window.location.pathname;
  // Sudah di halaman auth → tidak ada yang perlu diarahkan (putus rantai loop)
  if (path === "/login" || path === "/register") return;
  handling401 = true;
  try {
    if (!(await isReallyLoggedOut())) return; // sesi masih ada / tak terkonfirmasi → jangan redirect
    redirected401 = true; // komit: dari sini pasti pergi ke /login sekali saja
    // Bersihkan cookie basi (best-effort) — supaya middleware tidak memantulkan
    // balik ke /dashboard dengan sesi yang sudah batal.
    try {
      await fetchWithTimeout("/api/auth/logout", { method: "POST", timeoutMs: 8_000 });
    } catch {
      /* logout gagal → tetap lanjut, cookie akan ditolak server juga */
    }
    console.warn("[UnitKu API] 401 terkonfirmasi sesi berakhir — arahkan ke /login");
    window.location.href = `/login?next=${encodeURIComponent(
      window.location.pathname + window.location.search,
    )}`;
  } finally {
    handling401 = false;
  }
}

// ── Sesi sekali-muat (cache promise per page-load) ───────────────────────
// Dipakai bootstrap dashboard & guard agar SEMUA pemeriksaan sesi berbagi
// SATU jawaban /api/auth/me — konsisten (tak ada effect yang menyimpulkan
// "demo" sementara yang lain menyimpulkan "owner") dan hemat request.

export interface AuthMeResult {
  user: { id: string; email?: string } | null;
  mode?: "supabase" | "local";
  demo?: boolean;
  isSuperAdmin?: boolean;
}

let authMeOnce: Promise<AuthMeResult> | null = null;

/** /api/auth/me di-cache SEKALI per muatan halaman; error tidak di-cache
 *  (pemanggil berikutnya mencoba lagi). Gagal → melempar (caller punya
 *  try-catch masing-masing). */
export function getAuthMeOnce(): Promise<AuthMeResult> {
  if (!authMeOnce) {
    authMeOnce = request<AuthMeResult>("/api/auth/me").catch((err: unknown) => {
      authMeOnce = null; // gagal → boleh dicoba ulang oleh pemeriksa berikutnya
      throw err;
    });
  }
  return authMeOnce;
}

/**
 * Semua permintaan API dijamin SELALU settle (sukses / HTTP error / timeout) —
 * koneksi database yang menggantung tidak boleh membuat UI loading abadi.
 * Default 15 dtk; operasi berat (onboarding buat puluhan kamar) boleh lebih.
 */
async function request<T>(url: string, init?: RequestInit, timeoutMs = 15_000): Promise<T> {
  // Indikator sinkron cloud: setiap permintaan ke route handler dilaporkan ke
  // store global (ikon awan berputar → hijau/merah di sidebar dashboard).
  notifySyncStart();
  const method = init?.method ?? "GET";
  let res: Response;
  let body: (T & { error?: string }) | null;
  try {
    res = await fetchWithTimeout(url, { cache: "no-store", timeoutMs, ...init });
    body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  } catch (cause) {
    notifySyncError();
    if (isTimeoutError(cause)) {
      console.error(`[UnitKu API] ${method} ${url} → timeout setelah ${timeoutMs} ms`);
      throw new Error(
        "Server tidak merespons (timeout) — koneksi database lambat atau terputus.",
        { cause },
      );
    }
    // Network error sungguhan (server mati, DNS, CORS, offline) — log penyebab
    // aslinya agar terlihat jelas di console browser (F12), jangan ditelan.
    console.error(
      `[UnitKu API] ${method} ${url} → network error:`,
      cause instanceof Error ? cause.message : cause,
    );
    throw new Error("Tidak dapat terhubung ke server — periksa koneksi internet.", {
      cause,
    });
  }
  if (!res.ok) {
    // Klasifikasi kegagalan untuk indikator sinkron cloud (jujur, tidak bohong):
    //  • 4xx SELAIN 401/429 (400 validasi, 404 tidak ditemukan, 409 nomor kamar
    //    duplikat, dst.) = server SEHAT & TERJANGKAU — ini kegagalan level
    //    permintaan yang sudah dijelaskan toast merah di UI. Menandai koneksi
    //    "Belum tersinkron (Offline)" untuk kasus ini justru menyesatkan
    //    (pengguna mengira database putus padahal tidak) → TIDAK dijadikan merah.
    //  • 401 (sesi berakhir), 429 (dibatasi), 5xx (server/DB gagal) = aliran
    //    data benar-benar terganggu → indikator merah (jujur).
    const requestLevelError =
      res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429;
    // DUA jalur wajib menyeimbangkan inflight dari notifySyncStart — tanpa itu
    // indikator melekat di "Menyinkronkan..." selamanya:
    //  • request-level (400/404/409…) → notifySyncSettled (tidak jadi merah);
    //  • sync-level (401/429/5xx) → notifySyncError (merah, jujur).
    if (requestLevelError) notifySyncSettled();
    else notifySyncError();
    // 401 = sesi berakhir — KONFIRMASI dulu via /api/auth/me (anti ping-pong,
    // lihat catatan di atas), kecuali endpoint auth itu sendiri
    if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/")) {
      console.warn(`[UnitKu API] ${method} ${url} → 401 — verifikasi sesi sebelum redirect`);
      void handle401();
    }
    // HTTP error (404 endpoint salah, 500 Prisma/DB, dsb.) — log status + pesan
    // server supaya akar masalahnya langsung terbaca di console.
    const message = body?.error ?? `Permintaan gagal (${res.status}).`;
    console.error(`[UnitKu API] ${method} ${url} → HTTP ${res.status}: ${message}`);
    throw new Error(message);
  }
  notifySyncSuccess(); // 2xx — data benar-benar tersampai ke/dari cloud
  return body as T;
}

// ── Properti ─────────────────────────────────────────────────────────────────

export interface PropertyPatchInput {
  name?: string;
  tipe?: string;
  alamat?: string | null;
  fotoUrl?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankAccountName?: string | null;
  /** DataURL gambar QRIS statis (null = hapus) */
  qrisImageUrl?: string | null;
  /** Nama Merchant / NMID QRIS (null = hapus) */
  qrisNmid?: string | null;
}

/** Ringkasan properti dari tabel `properties` (dipakai switcher dashboard) */
export interface PropertySummary {
  id: string;
  name: string;
  tipe: string;
  alamat: string | null;
  fotoUrl: string | null;
  /** Jumlah kamar riil milik properti ini (dari tabel rooms) */
  roomCount: number;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  qrisImageUrl: string | null;
  qrisNmid: string | null;
}

/** Sisipkan scope properti aktif sebagai query param (tanpa param = perilaku lama) */
function scopedPropertyUrl(path: string, propertyId?: string | null): string {
  return propertyId ? `${path}?propertyId=${encodeURIComponent(propertyId)}` : path;
}

export const api = {
  // /api/auth/me — info sesi (dengan timeout; user null bila belum masuk)
  getAuthMe: () =>
    request<{
      user: { id: string; email?: string } | null;
      mode?: "supabase" | "local";
      demo?: boolean;
      isSuperAdmin?: boolean;
    }>("/api/auth/me"),

  // /api/billing/license — gerbang lisensi (fail-open ditangani pemanggil)
  getLicense: () =>
    request<{ licensed?: boolean; checkoutUrl?: string }>("/api/billing/license"),

  // /api/properties — property null bila owner belum onboarding; properties =
  // SELURUH daftar properti dari tabel properties (+ roomCount) utk switcher
  getProperty: () =>
    request<{ property: ClientProperty | null; properties?: PropertySummary[] }>("/api/properties"),
  updateProperty: (patch: PropertyPatchInput) =>
    request<{ property: ClientProperty }>("/api/properties", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  // /api/settings — pengaturan owner di cloud (Profil Saya, Staf, Template WA,
  // Fasilitas, Tema). settings null = sesi demo / tabel cloud belum dibuat
  // (degraded) — klien tetap memakai localStorage tanpa error.
  getSettings: () =>
    request<{ demo?: boolean; degraded?: boolean; settings?: SettingsCloudPatch | null }>(
      "/api/settings",
    ),

  // /api/rooms — propertyId opsional: muat kamar SESUAI cabang aktif (switcher)
  getRooms: (propertyId?: string | null) =>
    request<{ rooms: ClientRoom[] }>(scopedPropertyUrl("/api/rooms", propertyId)),
  /** renamed: nomor yang diminta tapi diubah otomatis server — nomor itu
   *  ternyata sudah dipakai kamar PROPERTI LAIN (tidak memblokir; kamar
   *  tetap dibuat dengan varian "A-1 (2)") — klien menjelaskan di toast. */
  addRooms: (
    rooms: {
      id: string;
      floor: number;
      type: string;
      price: number;
      facilities?: string[];
      operational?: string;
    }[],
    propertyId?: string | null,
    // Nama & tipe properti aktif — dipakai server utk AUTO-PROVISION baris
    // `properties` bila propertyId belum terdaftar (anti gagal foreign key).
    propertyName?: string | null,
    propertyTipe?: string | null,
  ) =>
    request<{ rooms: ClientRoom[]; renamed?: { requested: string; stored: string }[] }>(
      "/api/rooms",
      {
        method: "POST",
        body: JSON.stringify({
          rooms,
          ...(propertyId ? { propertyId } : {}),
          ...(propertyName ? { propertyName } : {}),
          ...(propertyTipe ? { propertyTipe } : {}),
        }),
      },
    ),
  patchRoom: (id: string, patch: Record<string, unknown>) =>
    request<{ rooms: ClientRoom[]; renamed?: { requested: string; stored: string }[] }>(
      "/api/rooms",
      {
        method: "PATCH",
        body: JSON.stringify({ id, patch }),
      },
    ),
  patchRoomsBulk: (bulk: { id: string; patch: Record<string, unknown> }[]) =>
    request<{ rooms: ClientRoom[]; renamed?: { requested: string; stored: string }[] }>(
      "/api/rooms",
      {
        method: "PATCH",
        body: JSON.stringify({ bulk }),
      },
    ),
  deleteRoom: (id: string) =>
    request<{ ok: true }>(`/api/rooms?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  // /api/tenants
  checkinTenant: (payload: {
    roomId: string;
    name: string;
    phone: string;
    emergencyName?: string;
    emergencyPhone?: string;
    tanggalMasuk: string; // yyyy-mm-dd
    siklus: string;
    hargaSewa: number;
    deposit: number;
    addons: string[];
    totalPerBulan: number;
    // ── Sewa harian (siklus Harian / Villa-Homestay)
    tanggalCheckout?: string; // yyyy-mm-dd
    durasiHari?: number; // jumlah malam
    totalTagihan?: number; // harga per hari × durasi
  }) =>
    request<{ room: ClientRoom; invoice: ClientInvoice }>("/api/tenants", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  renewTenant: (roomId: string, contractEnd: string, deposit?: number) =>
    request<{ room: ClientRoom }>("/api/tenants", {
      method: "PATCH",
      body: JSON.stringify({ roomId, contractEnd, deposit }),
    }),
  checkoutTenant: (roomId: string) =>
    request<{ room: ClientRoom; checkedOut: string }>(
      `/api/tenants?roomId=${encodeURIComponent(roomId)}`,
      { method: "DELETE" },
    ),

  // /api/invoices — propertyId opsional: tagihan SESUAI cabang aktif (switcher)
  getInvoices: (propertyId?: string | null) =>
    request<{ invoices: ClientInvoice[] }>(scopedPropertyUrl("/api/invoices", propertyId)),
  /** Generator tagihan bulanan — pindai kamar terisi, buat draft invoice periode terpilih.
   *  propertyId opsional: generator hanya memindai cabang yang sedang dikelola. */
  generateInvoices: (periodKey: string, propertyId?: string | null) =>
    request<{ created: ClientInvoice[]; scanned: number; skipped: number }>("/api/invoices", {
      method: "POST",
      body: JSON.stringify({ periodKey, ...(propertyId ? { propertyId } : {}) }),
    }),
  /** Perbarui rincian add-on sebelum tagihan dikirim ("Simpan & Siap Ditagih") */
  updateInvoiceLines: (
    id: string,
    lines: { label: string; amount: number }[],
  ) =>
    request<{ invoice: ClientInvoice }>("/api/invoices", {
      method: "PATCH",
      body: JSON.stringify({ id, lines }),
    }),
  /** Tandai lunas — server juga mencatat pemasukan ke Buku Kas (cashEntry).
   *  Fallback anti-error "Tagihan tidak ditemukan": bila id tidak dikenal
   *  (state basi) atau tidak disertakan, server memakai tagihan aktif milik
   *  kamar (roomId) atau membuat invoice periode terkait yang langsung lunas
   *  (created=true) — kamar ikut badge hijau & kas tercatat. */
  markInvoicePaid: (id: string | null, roomId?: string, periodKey?: string) =>
    request<{ invoice: ClientInvoice; room: ClientRoom; cashEntry?: ClientCashEntry; created?: boolean }>("/api/invoices", {
      method: "PATCH",
      body: JSON.stringify({
        ...(id ? { id } : {}),
        ...(roomId ? { roomId } : {}),
        ...(periodKey ? { periodKey } : {}),
        status: "lunas",
      }),
    }),
  cancelInvoice: (id: string) =>
    request<{ ok: true }>(`/api/invoices?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  // /api/cash — propertyId opsional: buku kas SESUAI cabang aktif (switcher)
  getCash: (propertyId?: string | null) =>
    request<{ entries: ClientCashEntry[] }>(scopedPropertyUrl("/api/cash", propertyId)),
  addCash: (payload: {
    type: CashType;
    category: string;
    description: string;
    amount: number;
    dateLabel: string;
    source?: string;
    attachment?: string;
    /** Properti tujuan (switcher aktif) — server divalidasi kepemilikannya */
    propertyId?: string | null;
  }) =>
    request<{ entry: ClientCashEntry }>("/api/cash", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  /** Edit transaksi (pengeluaran manual) — patch parsial */
  updateCash: (
    id: string,
    patch: {
      category?: string;
      description?: string;
      amount?: number;
      dateLabel?: string;
      source?: string;
      attachment?: string | null;
    },
  ) =>
    request<{ entry: ClientCashEntry }>("/api/cash", {
      method: "PATCH",
      body: JSON.stringify({ id, ...patch }),
    }),
  deleteCash: (id: string) =>
    request<{ ok: true }>(`/api/cash?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  // /api/staff
  getStaff: () => request<{ staff: StaffAccessMember[] }>("/api/staff"),
  addStaff: (payload: {
    name: string;
    phone: string;
    role: string;
    propertyId: string;
    accessPin: string;
  }) =>
    request<{ member: StaffAccessMember }>("/api/staff", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  setStaffActive: (id: string, isActive: boolean) =>
    request<{ member: StaffAccessMember }>("/api/staff", {
      method: "PATCH",
      body: JSON.stringify({ id, isActive }),
    }),
  deleteStaff: (id: string) =>
    request<{ ok: true }>(`/api/staff?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  // /api/tickets — Komplain & Pemeliharaan
  getTickets: (propertyId?: string | null) =>
    request<{ tickets: ClientTicket[] }>(
      scopedPropertyUrl("/api/tickets", propertyId),
    ),
  /** Laporan masalah dari Portal Penyewa — foto dataURL (kompres canvas di klien) */
  createTicket: (payload: {
    portalToken?: string;
    sumber?: string;
    roomId?: string;
    lokasi?: string;
    reporterName?: string;
    reporterPhone?: string;
    judul?: string;
    kategori: string;
    deskripsi: string;
    urgensi?: string;
    photos?: string[];
    /** Properti tujuan (switcher aktif) — server divalidasi kepemilikannya */
    propertyId?: string | null;
  }) =>
    request<{ ticket: ClientTicket }>("/api/tickets", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  /** Tandai dikerjakan / selesai & penugasan teknisi */
  updateTicket: (
    id: string,
    patch: { status?: string; teknisiName?: string; teknisiPhone?: string },
  ) =>
    request<{ ticket: ClientTicket }>("/api/tickets", {
      method: "PATCH",
      body: JSON.stringify({ id, ...patch }),
    }),
  /** Hapus permanen tiket komplain (setelah konfirmasi owner) */
  deleteTicket: (id: string) =>
    request<{ ok: true }>(`/api/tickets?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  // /api/technicians — Kontak Teknisi (Komplain & Pemeliharaan)
  getTechnicians: () =>
    request<{ technicians: ClientTechnician[] }>("/api/technicians"),
  /** Tambah kontak teknisi — isPrimary mencabut status utama kontak lain */
  createTechnician: (payload: {
    name: string;
    phone: string;
    specialization: string;
    isPrimary?: boolean;
  }) =>
    request<{ technician: ClientTechnician }>("/api/technicians", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  /** Edit kontak teknisi — patch parsial */
  updateTechnician: (
    id: string,
    patch: {
      name?: string;
      phone?: string;
      specialization?: string;
      isPrimary?: boolean;
    },
  ) =>
    request<{ technician: ClientTechnician }>("/api/technicians", {
      method: "PATCH",
      body: JSON.stringify({ id, ...patch }),
    }),
  deleteTechnician: (id: string) =>
    request<{ ok: true }>(`/api/technicians?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  // /api/announcements — Pengumuman & Broadcast (tersimpan permanen di cloud)
  getAnnouncements: (propertyId?: string | null) =>
    request<{ announcements: ClientAnnouncement[] }>(
      scopedPropertyUrl("/api/announcements", propertyId),
    ),
  createAnnouncement: (draft: AnnouncementDraft, propertyId?: string | null) =>
    request<{ announcement: ClientAnnouncement }>("/api/announcements", {
      method: "POST",
      body: JSON.stringify(propertyId ? { ...draft, propertyId } : draft),
    }),
  updateAnnouncement: (
    id: string,
    patch: Partial<AnnouncementDraft> & { aktif?: boolean },
  ) =>
    request<{ announcement: ClientAnnouncement }>("/api/announcements", {
      method: "PATCH",
      body: JSON.stringify({ id, ...patch }),
    }),
  deleteAnnouncement: (id: string) =>
    request<{ ok: true }>(
      `/api/announcements?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),

  // /api/reset — Zona Berbahaya
  resetData: (mode: "demo" | "factory") =>
    request<{ ok: true; mode: string }>("/api/reset", {
      method: "POST",
      body: JSON.stringify({ mode }),
    }),

  // /api/backup/restore — pulihkan data dari berkas cadangan JSON (Pengaturan)
  restoreBackup: (payload: unknown) =>
    request<{
      ok: true;
      propertyId: string;
      propertyName: string;
      restored: {
        roomsCreated: number;
        roomsUpdated: number;
        roomsSkipped: number;
        tenantsAligned: number;
        invoicesCreated: number;
        invoicesUpdated: number;
        invoicesSkipped: number;
        cashCreated: number;
        cashUpdated: number;
        cashSkipped: number;
      };
    }>(
      "/api/backup/restore",
      { method: "POST", body: JSON.stringify({ payload }) },
      45_000, // pemulihan menulis banyak baris — beri waktu longgar
    ),

  // /api/demo/reset — khusus sesi demo: hapus & seed ulang data simulasi
  resetDemo: () =>
    request<{ ok: true }>("/api/demo/reset", { method: "POST" }),
};

// ── Verifikasi portal staf (/staff) — dipanggil tanpa sesi owner ─────────────

export type StaffTokenResolution =
  | { status: "valid"; member: Omit<StaffAccessMember, "accessPin"> }
  | { status: "revoked"; member: Omit<StaffAccessMember, "accessPin"> }
  | { status: "invalid" };

export type StaffPinVerification =
  | { status: "valid"; verified: true; member: Omit<StaffAccessMember, "accessPin"> }
  | { status: "valid"; verified: false }
  | { status: "revoked"; member?: Omit<StaffAccessMember, "accessPin"> }
  | { status: "invalid" };

async function staffGet(token: string, pin?: string) {
  const qs = new URLSearchParams({ token });
  if (pin !== undefined) qs.set("pin", pin);
  return request<StaffTokenResolution | StaffPinVerification>(`/api/staff?${qs.toString()}`);
}

export const staffApi = {
  resolveToken: (token: string) => staffGet(token) as Promise<StaffTokenResolution>,
  verifyPin: (token: string, pin: string) => staffGet(token, pin) as Promise<StaffPinVerification>,
};

// ── Portal penyewa (/portal) ─────────────────────────────────────────────────

export interface PortalData {
  room: ClientRoom;
  invoices: ClientInvoice[];
  propertyName: string;
  /** Pengumuman properti (banner portal) — cloud-first lintas perangkat */
  announcements?: ClientAnnouncement[];
  /** Sesi demo (properti seed) — portal memakai tanggal snapshot dataset,
   *  bukan tanggal riil, agar konsisten dengan panel admin demo. */
  demo?: boolean;
  /** Rekening + QRIS statis owner (cloud) — kartu pembayaran portal */
  rekening?: PortalRekening;
}

export const portalApi = {
  resolve: (token: string) =>
    request<PortalData>(
      `/api/portal?token=${encodeURIComponent(token)}`,
      // no-store — portal penyewa harus selalu segar: pengumuman/tagihan baru
      // dari owner tampil tanpa clear cache browser (respons API juga no-store)
      { cache: "no-store" },
    ),
};

// re-export tipe ringan untuk konsumen
export type { ClientRoom, ClientInvoice, ClientCashEntry, RoomStatus, ClientAnnouncement };
