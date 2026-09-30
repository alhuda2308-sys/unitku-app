// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Klien API (frontend → Next.js Route Handlers → Prisma → Supabase)
//
// Semua pemanggilan memakai path relatif "/api/…" (aman gateway/preview) dan
// melempar Error berbahasa Indonesia saat gagal — siap ditampilkan sebagai
// toast notifikasi sukses/gagal di seluruh dashboard.
// ─────────────────────────────────────────────────────────────────────────────

import type { Room as ClientRoom, RoomStatus } from "@/lib/kost-data";
import type { Invoice as ClientInvoice } from "@/lib/kost-invoices";
import type { CashEntry as ClientCashEntry, CashType } from "@/lib/kost-cashflow";
import type { Ticket as ClientTicket } from "@/lib/ticket-data";
import type { TechnicianContact as ClientTechnician } from "@/lib/technician-data";
import type { StaffAccessMember } from "@/lib/staff-access";
import type { ClientProperty } from "@/lib/server/mappers";
import type { PortalRekening } from "./tenant-portal";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      ...init,
    });
  } catch (cause) {
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
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) {
    // 401 = sesi berakhir — arahkan ke /login (kecuali endpoint auth itu sendiri)
    if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/")) {
      console.warn(`[UnitKu API] ${method} ${url} → 401 sesi berakhir — redirect /login`);
      window.location.href = `/login?next=${encodeURIComponent(
        window.location.pathname + window.location.search,
      )}`;
    }
    // HTTP error (404 endpoint salah, 500 Prisma/DB, dsb.) — log status + pesan
    // server supaya akar masalahnya langsung terbaca di console.
    const message = body?.error ?? `Permintaan gagal (${res.status}).`;
    console.error(`[UnitKu API] ${method} ${url} → HTTP ${res.status}: ${message}`);
    throw new Error(message);
  }
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

export const api = {
  // /api/properties — property null bila owner belum onboarding
  getProperty: () => request<{ property: ClientProperty | null }>("/api/properties"),
  updateProperty: (patch: PropertyPatchInput) =>
    request<{ property: ClientProperty }>("/api/properties", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  // /api/rooms
  getRooms: () => request<{ rooms: ClientRoom[] }>("/api/rooms"),
  addRooms: (
    rooms: {
      id: string;
      floor: number;
      type: string;
      price: number;
      facilities?: string[];
      operational?: string;
    }[],
  ) =>
    request<{ rooms: ClientRoom[] }>("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ rooms }),
    }),
  patchRoom: (id: string, patch: Record<string, unknown>) =>
    request<{ rooms: ClientRoom[] }>("/api/rooms", {
      method: "PATCH",
      body: JSON.stringify({ id, patch }),
    }),
  patchRoomsBulk: (bulk: { id: string; patch: Record<string, unknown> }[]) =>
    request<{ rooms: ClientRoom[] }>("/api/rooms", {
      method: "PATCH",
      body: JSON.stringify({ bulk }),
    }),
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

  // /api/invoices
  getInvoices: () => request<{ invoices: ClientInvoice[] }>("/api/invoices"),
  /** Generator tagihan bulanan — pindai kamar terisi, buat draft invoice periode terpilih */
  generateInvoices: (periodKey: string) =>
    request<{ created: ClientInvoice[]; scanned: number; skipped: number }>("/api/invoices", {
      method: "POST",
      body: JSON.stringify({ periodKey }),
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
  /** Tandai lunas — server juga mencatat pemasukan ke Buku Kas (cashEntry) */
  markInvoicePaid: (id: string) =>
    request<{ invoice: ClientInvoice; room: ClientRoom; cashEntry?: ClientCashEntry }>("/api/invoices", {
      method: "PATCH",
      body: JSON.stringify({ id, status: "lunas" }),
    }),
  cancelInvoice: (id: string) =>
    request<{ ok: true }>(`/api/invoices?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  // /api/cash
  getCash: () => request<{ entries: ClientCashEntry[] }>("/api/cash"),
  addCash: (payload: {
    type: CashType;
    category: string;
    description: string;
    amount: number;
    dateLabel: string;
    source?: string;
    attachment?: string;
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
  getTickets: () => request<{ tickets: ClientTicket[] }>("/api/tickets"),
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

  // /api/reset — Zona Berbahaya
  resetData: (mode: "demo" | "factory") =>
    request<{ ok: true; mode: string }>("/api/reset", {
      method: "POST",
      body: JSON.stringify({ mode }),
    }),
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
  /** Rekening + QRIS statis owner (cloud) — kartu pembayaran portal */
  rekening?: PortalRekening;
}

export const portalApi = {
  resolve: (token: string) =>
    request<PortalData>(`/api/portal?token=${encodeURIComponent(token)}`),
};

// re-export tipe ringan untuk konsumen
export type { ClientRoom, ClientInvoice, ClientCashEntry, RoomStatus };
