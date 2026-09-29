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
import type { StaffAccessMember } from "@/lib/staff-access";
import type { ClientProperty } from "@/lib/server/mappers";
import type { PortalRekening } from "./tenant-portal";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      ...init,
    });
  } catch {
    throw new Error("Tidak dapat terhubung ke server — periksa koneksi internet.");
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) {
    throw new Error(body?.error ?? `Permintaan gagal (${res.status}).`);
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
  // /api/properties
  getProperty: () => request<{ property: ClientProperty }>("/api/properties"),
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
    attachment?: string;
  }) =>
    request<{ entry: ClientCashEntry }>("/api/cash", {
      method: "POST",
      body: JSON.stringify(payload),
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
