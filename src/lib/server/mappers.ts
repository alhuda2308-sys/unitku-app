// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Mapper Prisma → bentuk data klien (src/lib/kost-*.ts)
//
// Route handlers menyimpan data dalam bentuk relasional (DateTime, InvoiceLine,
// tenant terpisah) lalu memetakannya kembali ke bentuk yang sama persis dengan
// tipe UI (label tanggal Indonesia, tenant/invoice/contract menempel di Room,
// dst.) — sehingga komponen frontend tidak perlu berubah.
// ─────────────────────────────────────────────────────────────────────────────

import { dateToLabel, MONTH_NAMES, type Room as ClientRoom, type Tenant as ClientTenant } from "@/lib/kost-data";
import type { Invoice as ClientInvoice, InvoiceStatus, InvoiceLine as ClientInvoiceLine } from "@/lib/kost-invoices";
import type { CashEntry as ClientCashEntry } from "@/lib/kost-cashflow";
import type { Ticket as ClientTicket, TicketContact } from "@/lib/ticket-data";
import type { StaffAccessMember, StaffAccessRole } from "@/lib/staff-access";
import type { Announcement as ClientAnnouncement, AnnouncementKategori } from "@/lib/announcement-data";
import type { Announcement, CashEntry, Invoice, InvoiceLine, Property, Room, StaffMember, Tenant, Ticket } from "@prisma/client";

// ── Invoice ──────────────────────────────────────────────────────────────────

export function toClientInvoiceLine(line: InvoiceLine): ClientInvoiceLine {
  return { label: line.label, amount: line.amount };
}

export function toClientInvoice(
  invoice: Invoice & { lines?: InvoiceLine[] },
): ClientInvoice {
  return {
    id: invoice.id,
    roomId: invoice.roomId,
    tenantName: invoice.tenantName,
    tenantPhone: invoice.tenantPhone,
    roomType: invoice.roomType ?? "",
    periodLabel: invoice.periodLabel,
    periodKey: invoice.periodKey,
    dueDate: invoice.dueDate ? dateToLabel(invoice.dueDate) : "",
    lines: (invoice.lines ?? []).map(toClientInvoiceLine),
    total: invoice.total,
    status: invoice.status as InvoiceStatus,
    dayOffset: invoice.dayOffset ?? undefined,
    paidAt: invoice.paidAt ? dateToLabel(invoice.paidAt) : undefined,
  };
}

// ── Room (+ tenant & invoice ringkas menempel, bentuk UI) ────────────────────

/** "Sewa Sep 2026" — label ringkas kamar dari periodKey "2026-09" */
function sewaLabelFromPeriodKey(periodKey: string): string {
  const [y, m] = periodKey.split("-");
  const idx = Number(m) - 1;
  return `Sewa ${MONTH_NAMES[idx] ?? ""} ${y}`;
}

function tenantToClient(tenant: Tenant): ClientTenant {
  return {
    name: tenant.name,
    phone: tenant.phone,
    moveInDate: tenant.moveInAt ? dateToLabel(tenant.moveInAt) : "—",
    emergencyContact: {
      name: tenant.emergencyName ?? "—",
      phone: tenant.emergencyPhone ?? "—",
    },
    portalToken: tenant.portalToken,
  };
}

export function toClientRoom(
  room: Room & {
    tenant?: Tenant | null;
    invoices?: Invoice[];
  },
): ClientRoom {
  // Invoice terbaru (periodKey terbesar) menempel di kamar — pill status & tempo
  const latest =
    (room.invoices ?? [])
      .slice()
      .sort((a, b) => b.periodKey.localeCompare(a.periodKey))[0] ?? null;

  return {
    id: room.id,
    floor: room.floor,
    type: room.type,
    price: room.price,
    status: room.status as ClientRoom["status"],
    facilities: (room.facilities as string[] | null) ?? undefined,
    operational: (room.operational ?? "siap") as ClientRoom["operational"],
    tenant: room.tenant ? tenantToClient(room.tenant) : undefined,
    invoice: latest
      ? {
          amount: latest.total,
          periodLabel: sewaLabelFromPeriodKey(latest.periodKey),
          dueLabel: latest.dueDate
            ? `Tempo: ${dateToLabel(latest.dueDate).replace(/\s\d{4}$/, "")}`
            : "Tempo: —",
          dayOffset: latest.dayOffset ?? undefined,
        }
      : undefined,
    contract:
      room.contractStart || room.contractDuration
        ? {
            duration: (room.contractDuration ?? "Bulanan") as NonNullable<
              ClientRoom["contract"]
            >["duration"],
            startDate: room.contractStart ? dateToLabel(room.contractStart) : "",
            endDate: room.contractEnd ? dateToLabel(room.contractEnd) : undefined,
            deposit: room.deposit,
            depositHeld: room.depositHeld,
          }
        : undefined,
  };
}

// ── Buku Kas ─────────────────────────────────────────────────────────────────

export function toClientCashEntry(entry: CashEntry): ClientCashEntry {
  return {
    id: entry.id,
    dateLabel: entry.dateLabel,
    dateSort: entry.dateSort,
    type: entry.type as ClientCashEntry["type"],
    category: entry.category,
    description: entry.description,
    amount: entry.amount,
    source: entry.source || undefined,
    attachment: entry.attachment ?? undefined,
  };
}

// ── Tiket Komplain & Pemeliharaan ───────────────────────────────────────

export function toClientTicket(t: Ticket): ClientTicket {
  const teknisi: TicketContact | undefined =
    t.teknisiName && t.teknisiPhone
      ? { name: t.teknisiName, phone: t.teknisiPhone }
      : t.teknisiName
        ? { name: t.teknisiName, phone: "" }
        : undefined;

  return {
    id: t.id,
    ...(t.roomId ? { roomId: t.roomId } : {}),
    ...(t.lokasi ? { lokasi: t.lokasi } : {}),
    sumber: t.sumber as ClientTicket["sumber"],
    judul: t.judul,
    urgensi: t.urgensi as ClientTicket["urgensi"],
    reporterName: t.reporterName,
    reporterPhone: t.reporterPhone,
    kategori: t.kategori as ClientTicket["kategori"],
    deskripsi: t.deskripsi,
    photos: Array.isArray(t.photos) ? (t.photos as string[]) : [],
    status: t.status as ClientTicket["status"],
    reportedLabel: t.reportedLabel,
    reportedSort: Number(t.reportedSort),
    ...(teknisi ? { teknisi } : {}),
    ...(t.selesaiLabel ? { selesaiLabel: t.selesaiLabel } : {}),
  };
}

// ── Pengumuman (Pengumuman & Broadcast — Portal Penyewa) ────────────────────

export function toClientAnnouncement(a: Announcement): ClientAnnouncement {
  return {
    id: a.id,
    judul: a.judul,
    kategori: a.kategori as AnnouncementKategori,
    targetFloor: a.targetFloor,
    isi: a.isi,
    tanggalMulai: a.tanggalMulai,
    tanggalBerakhir: a.tanggalBerakhir,
    aktif: a.aktif,
    createdAtLabel: a.createdAtLabel,
    createdAtSort: Number(a.createdAtSort),
  };
}

// ── Staf ─────────────────────────────────────────────────────────────────────

export function toClientStaff(member: StaffMember): StaffAccessMember {
  return {
    id: member.id,
    propertyId: member.propertyId ?? "",
    name: member.name,
    phone: member.phone,
    role: member.role as StaffAccessRole,
    accessToken: member.accessToken,
    accessPin: member.accessPin,
    isActive: member.isActive,
    createdAt: member.createdAt.toISOString(),
  };
}

/** Staf tanpa PIN — aman dikirim saat verifikasi token (sebelum PIN cocok) */
export function toClientStaffSafe(member: StaffMember): Omit<StaffAccessMember, "accessPin"> {
  const { accessPin: _pin, ...rest } = toClientStaff(member);
  return rest;
}

// ── Properti ─────────────────────────────────────────────────────────────────

export interface ClientProperty {
  id: string;
  name: string;
  tipe: string;
  alamat: string | null;
  fotoUrl: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  qrisImageUrl: string | null;
  qrisNmid: string | null;
}

export function toClientProperty(property: Property): ClientProperty {
  return {
    id: property.id,
    name: property.name,
    tipe: property.tipe,
    alamat: property.alamat,
    fotoUrl: property.fotoUrl,
    bankName: property.bankName,
    bankAccountNo: property.bankAccountNo,
    bankAccountName: property.bankAccountName,
    qrisImageUrl: property.qrisImageUrl,
    qrisNmid: property.qrisNmid,
  };
}

/**
 * Properti aktif kini di-resolve per-owner (isolasi multi-tenant):
 * lihat getActiveOwnedProperty / requireActiveProperty di src/lib/auth/ownership.ts
 */
