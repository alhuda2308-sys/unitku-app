// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Cadangan & Keamanan Data (Dual Format Backup & Restore)
//
// Helper murni (tanpa dependensi DOM di jalur validasi) untuk:
//  1. Membangun berkas cadangan sistem JSON  → backup-unitku-[kost]-[tgl].json
//  2. Membangun laporan rekap CSV            → rekap-unitku-[kost]-[tgl].csv
//     (delimiter ";" + BOM — terbuka rapi di Excel/Sheets/WPS locale Indonesia)
//  3. Memvalidasi struktur berkas cadangan sebelum dipulihkan (klien & server)
//
// Berkas dipakai bersama oleh komponen klien (settings → backup-view) dan
// route handler /api/backup/restore (validasi ulang di sisi server).
// ─────────────────────────────────────────────────────────────────────────────

import { MONTH_NAMES, parseDateLabel, type Room } from "@/lib/kost-data";
import { STATUS_META } from "@/lib/kost-data";
import type { Invoice } from "@/lib/kost-invoices";
import type { CashEntry } from "@/lib/kost-cashflow";

// ── Bentuk berkas cadangan ──────────────────────────────────────────────────

export interface BackupTenant {
  name: string;
  phone?: string;
  moveInDate?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  portalToken?: string;
}

export interface BackupRoom {
  id: string;
  // Nomor/nama kamar murni (tanpa suffix "(n)") — cadangan lama tanpa nomor
  // memakai id sebagai nomor (id kamar lama = nomornya sendiri)
  nomor?: string;
  floor: number;
  type: string;
  price: number;
  status: string;
  facilities?: string[];
  operational?: string;
  tenant?: BackupTenant;
  contract?: {
    duration?: string;
    startDate?: string;
    endDate?: string;
    deposit?: number;
    depositHeld?: boolean;
  };
}

export interface BackupInvoice {
  id: string;
  roomId: string;
  tenantName?: string | null;
  tenantPhone?: string | null;
  roomType?: string;
  periodLabel: string;
  periodKey: string;
  dueDate?: string;
  lines?: { label: string; amount: number }[];
  total: number;
  status: string;
  dayOffset?: number;
  paidAt?: string;
}

export interface BackupCashEntry {
  id: string;
  dateLabel: string;
  dateSort?: number;
  type: string;
  category: string;
  description?: string;
  amount: number;
  source?: string;
}

export interface BackupPayload {
  app: "unitku";
  format: "unitku-backup";
  version: number;
  exportedAt: string;
  property?: { name?: string; tipe?: string; alamat?: string | null };
  counts: { rooms: number; tenants: number; invoices: number; cash: number };
  rooms: BackupRoom[];
  invoices: BackupInvoice[];
  cashEntries: BackupCashEntry[];
}

export interface BackupSummary {
  propertyName: string;
  exportedAt: string;
  rooms: number;
  tenants: number;
  invoices: number;
  cash: number;
}

// ── Nama berkas ─────────────────────────────────────────────────────────────

/** "Kost Griya Pratama" → "kost-griya-pratama" (aman untuk nama berkas) */
export function slugifyForFile(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "kost";
}

/** Tanggal hari ini sebagai penanda berkas "2026-01-15" (waktu lokal) */
export function todayFileStamp(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function rekapFileName(propertyName: string): string {
  return `rekap-unitku-${slugifyForFile(propertyName)}-${todayFileStamp()}.csv`;
}

export function backupFileName(propertyName: string): string {
  return `backup-unitku-${slugifyForFile(propertyName)}-${todayFileStamp()}.json`;
}

// ── Unduh berkas (khusus klien) ─────────────────────────────────────────────

/** Unduh teks sebagai berkas via Blob + anchor sementara (klien saja) */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

// ── Builder: berkas cadangan JSON ───────────────────────────────────────────

function roomToBackup(room: Room): BackupRoom {
  return {
    id: room.id,
    // Nomor murni (tanpa suffix) — cadangan lama tidak punya field ini
    nomor: room.nomor || room.id,
    floor: room.floor,
    type: room.type,
    price: room.price,
    status: room.status,
    ...(room.facilities?.length ? { facilities: [...room.facilities] } : {}),
    ...(room.operational ? { operational: room.operational } : {}),
    ...(room.tenant
      ? {
          tenant: {
            name: room.tenant.name,
            phone: room.tenant.phone,
            moveInDate: room.tenant.moveInDate,
            emergencyName: room.tenant.emergencyContact?.name,
            emergencyPhone: room.tenant.emergencyContact?.phone,
          },
        }
      : {}),
    ...(room.contract
      ? {
          contract: {
            duration: room.contract.duration,
            startDate: room.contract.startDate,
            endDate: room.contract.endDate,
            deposit: room.contract.deposit,
            depositHeld: room.contract.depositHeld,
          },
        }
      : {}),
  };
}

function invoiceToBackup(inv: Invoice): BackupInvoice {
  return {
    id: inv.id,
    roomId: inv.roomId,
    tenantName: inv.tenantName,
    tenantPhone: inv.tenantPhone,
    roomType: inv.roomType,
    periodLabel: inv.periodLabel,
    periodKey: inv.periodKey,
    dueDate: inv.dueDate,
    lines: inv.lines.map((l) => ({ label: l.label, amount: l.amount })),
    total: inv.total,
    status: inv.status,
    ...(inv.dayOffset !== undefined ? { dayOffset: inv.dayOffset } : {}),
    ...(inv.paidAt ? { paidAt: inv.paidAt } : {}),
  };
}

function cashToBackup(e: CashEntry): BackupCashEntry {
  return {
    id: e.id,
    dateLabel: e.dateLabel,
    dateSort: e.dateSort,
    type: e.type,
    category: e.category,
    description: e.description,
    amount: e.amount,
    ...(e.source ? { source: e.source } : {}),
    // Lampiran foto (dataURL) sengaja tidak disertakan — jaga ukuran berkas
    // tetap kecil agar aman diunggah kembali lewat serverless body limit.
  };
}

/**
 * Bangun payload berkas cadangan lengkap dari data dashboard yang sedang hidup.
 * Catatan: lampiran foto transaksi (bukti nota) tidak ikut diarsipkan agar
 * berkas tetap ringan dan aman dipulihkan kembali.
 */
export function buildBackupPayload(input: {
  propertyName: string;
  rooms: Room[];
  invoices: Invoice[];
  cashEntries: CashEntry[];
  propertyTipe?: string;
  propertyAlamat?: string | null;
}): BackupPayload {
  const rooms = input.rooms.map(roomToBackup);
  const invoices = input.invoices.map(invoiceToBackup);
  const cashEntries = input.cashEntries.map(cashToBackup);
  const tenants = rooms.filter((r) => r.tenant).length;
  return {
    app: "unitku",
    format: "unitku-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    property: {
      name: input.propertyName,
      ...(input.propertyTipe ? { tipe: input.propertyTipe } : {}),
      ...(input.propertyAlamat !== undefined ? { alamat: input.propertyAlamat } : {}),
    },
    counts: {
      rooms: rooms.length,
      tenants,
      invoices: invoices.length,
      cash: cashEntries.length,
    },
    rooms,
    invoices,
    cashEntries,
  };
}

// ── Builder: laporan rekap CSV (Excel / Google Sheets / WPS) ────────────────

const CSV_DELIM = ";";

/** Escape sel CSV — bungkus kutip bila memuat delimiter, kutip, atau baris baru */
function csvCell(value: string): string {
  if (/[";\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map((c) => csvCell(String(c ?? ""))).join(CSV_DELIM);
}

/** "Tempo: 28 Okt" → "28 Okt" */
function cleanDueLabel(dueLabel: string | undefined): string {
  return (dueLabel ?? "").replace(/^Tempo:\s*/i, "").trim();
}

/**
 * Bangun isi laporan rekap CSV — dua tabel dalam satu berkas:
 *  (1) Kamar & Penyewa — No Kamar, Nama Penghuni, No WA, Nominal Sewa,
 *      Status Sewa, Tanggal Jatuh Tempo
 *  (2) Transaksi Keuangan — Tanggal, Tipe, Kategori, Nominal, Catatan
 * Menggunakan delimiter ";" + BOM UTF-8 agar locale Excel Indonesia
 * langsung memisah kolom dengan benar.
 */
export function buildRekapCsv(input: {
  propertyName: string;
  rooms: Room[];
  cashEntries: CashEntry[];
}): string {
  const lines: string[] = [];
  const generated = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ── Tabel 1: Kamar & Penyewa ──────────────────────────────────────────────
  lines.push(csvRow([`REKAP KAMAR & PENYEWA — ${input.propertyName.toUpperCase()}`]));
  lines.push(csvRow([`Diunduh dari UnitKu, ${generated}`]));
  lines.push("");
  lines.push(
    csvRow([
      "No Kamar",
      "Nama Penghuni",
      "No WA",
      "Nominal Sewa (Rp)",
      "Status Sewa",
      "Tanggal Jatuh Tempo",
    ]),
  );
  for (const room of input.rooms) {
    lines.push(
      csvRow([
        room.id,
        room.tenant?.name ?? "",
        room.tenant?.phone ?? "",
        room.price,
        STATUS_META[room.status]?.label ?? room.status,
        cleanDueLabel(room.invoice?.dueLabel),
      ]),
    );
  }

  // ── Tabel 2: Transaksi Keuangan (Buku Kas) ────────────────────────────────
  lines.push("");
  lines.push(csvRow(["TRANSAKSI KEUANGAN (BUKU KAS)"]));
  lines.push("");
  lines.push(csvRow(["Tanggal", "Tipe", "Kategori", "Nominal (Rp)", "Catatan"]));
  for (const e of input.cashEntries) {
    lines.push(
      csvRow([
        e.dateLabel,
        e.type === "keluar" ? "Pengeluaran" : "Pemasukan",
        e.category,
        e.amount,
        e.description ?? "",
      ]),
    );
  }

  // BOM UTF-8 — wajib agar Excel membaca karakter non-ASCII dengan benar
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

// ── Validasi berkas cadangan (klien & server) ───────────────────────────────

/** Batas ukuran data — pelindung server dari payload tak wajar */
const MAX_ROOMS = 500;
const MAX_INVOICES = 5_000;
const MAX_CASH = 20_000;

const ROOM_STATUSES = new Set(["lunas", "jatuhTempo", "menunggak", "kosong"]);
const INVOICE_STATUSES = new Set(["belumBayar", "lunas", "verifikasi", "jatuhTempo", "menunggak"]);

export class BackupValidationError extends Error {}

function asObject(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is string => typeof x === "string");
}

function parseLabelToIsoOrNull(label: unknown): string | undefined {
  const s = asString(label).trim();
  if (!s) return undefined;
  try {
    const d = parseDateLabel(s);
    if (Number.isNaN(d.getTime())) return undefined;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  } catch {
    return undefined;
  }
}

/**
 * Validasi & normalisasi payload cadangan — melempar BackupValidationError
 * dengan pesan Indonesia yang bisa langsung ditampilkan sebagai toast.
 * Dipakai di klien (sebelum modal konfirmasi) DAN di server (sebelum eksekusi).
 */
export function validateBackupPayload(raw: unknown): {
  payload: BackupPayload;
  summary: BackupSummary;
} {
  const root = asObject(raw);
  if (!root) throw new BackupValidationError("Berkas bukan JSON cadangan yang valid.");
  const isUnitku =
    (root.app === "unitku" || asString(root.app) === "unitku") &&
    (root.format === "unitku-backup" || asString(root.format) === "unitku-backup");
  if (!isUnitku) {
    throw new BackupValidationError(
      "Format berkas tidak dikenali — gunakan berkas cadangan (.json) yang diunduh dari UnitKu.",
    );
  }
  const version = asNumber(root.version);
  if (!Number.isFinite(version) || version < 1) {
    throw new BackupValidationError("Versi berkas cadangan tidak valid.");
  }
  if (version > 1) {
    throw new BackupValidationError(
      "Berkas dibuat oleh versi UnitKu yang lebih baru — perbarui aplikasi terlebih dahulu.",
    );
  }

  const roomsRaw = Array.isArray(root.rooms) ? root.rooms : null;
  const invoicesRaw = Array.isArray(root.invoices) ? root.invoices : null;
  const cashRaw = Array.isArray(root.cashEntries) ? root.cashEntries : null;
  if (!roomsRaw || !invoicesRaw || !cashRaw) {
    throw new BackupValidationError(
      "Struktur berkas tidak lengkap — bagian rooms/invoices/cashEntries wajib ada.",
    );
  }
  if (
    roomsRaw.length === 0 &&
    invoicesRaw.length === 0 &&
    cashRaw.length === 0
  ) {
    throw new BackupValidationError("Berkas cadangan kosong — tidak ada data untuk dipulihkan.");
  }
  if (roomsRaw.length > MAX_ROOMS) {
    throw new BackupValidationError(`Jumlah kamar melebihi batas (${MAX_ROOMS}).`);
  }
  if (invoicesRaw.length > MAX_INVOICES) {
    throw new BackupValidationError(`Jumlah tagihan melebihi batas (${MAX_INVOICES}).`);
  }
  if (cashRaw.length > MAX_CASH) {
    throw new BackupValidationError(`Jumlah transaksi melebihi batas (${MAX_CASH}).`);
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────
  const rooms: BackupRoom[] = [];
  for (const [i, item] of roomsRaw.entries()) {
    const o = asObject(item);
    if (!o) throw new BackupValidationError(`Data kamar #${i + 1} tidak valid.`);
    const id = asString(o.id).trim();
    if (!id) throw new BackupValidationError(`Data kamar #${i + 1} tidak memiliki nomor kamar.`);
    const price = asNumber(o.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new BackupValidationError(`Nominal sewa kamar "${id}" tidak valid.`);
    }
    const floor = asNumber(o.floor);
    const status = ROOM_STATUSES.has(asString(o.status)) ? asString(o.status) : "kosong";
    const tenantObj = asObject(o.tenant);
    const tenantName = asString(tenantObj?.name).trim();
    const contractObj = asObject(o.contract);
    rooms.push({
      id,
      floor: Number.isFinite(floor) && floor > 0 ? Math.round(floor) : 1,
      type: asString(o.type),
      price: Math.round(price),
      status,
      facilities: asStringArray(o.facilities),
      operational: ["perbaikan", "nonaktif", "siap"].includes(asString(o.operational))
        ? asString(o.operational)
        : undefined,
      ...(tenantName
        ? {
            tenant: {
              name: tenantName,
              phone: asString(tenantObj?.phone),
              moveInDate: asString(tenantObj?.moveInDate) || undefined,
              emergencyName: asString(tenantObj?.emergencyName) || undefined,
              emergencyPhone: asString(tenantObj?.emergencyPhone) || undefined,
              portalToken: asString(tenantObj?.portalToken) || undefined,
            },
          }
        : {}),
      ...(contractObj
        ? {
            contract: {
              duration: asString(contractObj.duration) || undefined,
              startDate: asString(contractObj.startDate) || undefined,
              endDate: asString(contractObj.endDate) || undefined,
              deposit: Number.isFinite(asNumber(contractObj.deposit))
                ? Math.max(0, Math.round(asNumber(contractObj.deposit)))
                : undefined,
              depositHeld: contractObj.depositHeld === true,
            },
          }
        : {}),
    });
  }

  // ── Invoices ──────────────────────────────────────────────────────────────
  const invoices: BackupInvoice[] = [];
  for (const [i, item] of invoicesRaw.entries()) {
    const o = asObject(item);
    if (!o) throw new BackupValidationError(`Data tagihan #${i + 1} tidak valid.`);
    const id = asString(o.id).trim();
    const roomId = asString(o.roomId).trim();
    const periodKey = asString(o.periodKey).trim();
    const total = asNumber(o.total);
    if (!id || !roomId || !periodKey) {
      throw new BackupValidationError(`Data tagihan #${i + 1} tidak lengkap (id/roomId/periode).`);
    }
    if (!Number.isFinite(total) || total < 0) {
      throw new BackupValidationError(`Nominal tagihan "${id}" tidak valid.`);
    }
    const lines: { label: string; amount: number }[] = [];
    if (Array.isArray(o.lines)) {
      for (const line of o.lines) {
        const lo = asObject(line);
        if (!lo) continue;
        const label = asString(lo.label).trim();
        const amount = asNumber(lo.amount);
        if (label && Number.isFinite(amount)) {
          lines.push({ label, amount: Math.round(amount) });
        }
      }
    }
    const status = INVOICE_STATUSES.has(asString(o.status)) ? asString(o.status) : "belumBayar";
    const dayOffset = asNumber(o.dayOffset);
    invoices.push({
      id,
      roomId,
      tenantName: asString(o.tenantName) || null,
      tenantPhone: asString(o.tenantPhone) || null,
      roomType: asString(o.roomType),
      periodLabel: asString(o.periodLabel).trim() || periodKey,
      periodKey,
      dueDate: asString(o.dueDate) || undefined,
      lines,
      total: Math.round(total),
      status,
      ...(Number.isFinite(dayOffset) ? { dayOffset: Math.round(dayOffset) } : {}),
      ...(asString(o.paidAt) ? { paidAt: asString(o.paidAt) } : {}),
    });
  }

  // ── Cash entries ──────────────────────────────────────────────────────────
  const cashEntries: BackupCashEntry[] = [];
  for (const [i, item] of cashRaw.entries()) {
    const o = asObject(item);
    if (!o) throw new BackupValidationError(`Data transaksi #${i + 1} tidak valid.`);
    const id = asString(o.id).trim();
    const type = asString(o.type) === "keluar" ? "keluar" : "masuk";
    const amount = asNumber(o.amount);
    const dateLabel = asString(o.dateLabel).trim();
    if (!id) throw new BackupValidationError(`Data transaksi #${i + 1} tidak memiliki ID.`);
    if (!dateLabel) {
      throw new BackupValidationError(`Data transaksi "${id}" tidak memiliki tanggal.`);
    }
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BackupValidationError(`Nominal transaksi "${id}" tidak valid.`);
    }
    const dateSort = asNumber(o.dateSort);
    cashEntries.push({
      id,
      dateLabel,
      dateSort:
        Number.isFinite(dateSort) && dateSort > 0
          ? Math.round(dateSort)
          : sortFromLabel(dateLabel),
      type,
      category: asString(o.category).trim() || (type === "keluar" ? "Lain-lain" : "Lainnya"),
      description: asString(o.description),
      amount: Math.round(amount),
      source: asString(o.source) || undefined,
    });
  }

  const property = asObject(root.property);
  const propertyName = asString(property?.name).trim();
  const payload: BackupPayload = {
    app: "unitku",
    format: "unitku-backup",
    version,
    exportedAt: asString(root.exportedAt) || new Date().toISOString(),
    property: {
      ...(propertyName ? { name: propertyName } : {}),
      ...(asString(property?.tipe) ? { tipe: asString(property?.tipe) } : {}),
      ...(property && "alamat" in property ? { alamat: asString(property?.alamat) || null } : {}),
    },
    counts: {
      rooms: rooms.length,
      tenants: rooms.filter((r) => r.tenant).length,
      invoices: invoices.length,
      cash: cashEntries.length,
    },
    rooms,
    invoices,
    cashEntries,
  };

  return {
    payload,
    summary: {
      propertyName: propertyName || "(tanpa nama properti)",
      exportedAt: payload.exportedAt,
      rooms: rooms.length,
      tenants: payload.counts.tenants,
      invoices: invoices.length,
      cash: cashEntries.length,
    },
  };
}

/** "01 Sep 2026" → 20260901 (fallback validasi dateSort) */
function sortFromLabel(label: string): number {
  const [d, m, y] = label.split(" ");
  const month = MONTH_NAMES.indexOf((m ?? "Jan") as (typeof MONTH_NAMES)[number]) + 1;
  const day = Number(d);
  const year = Number(y);
  if (!Number.isFinite(day) || !Number.isFinite(year) || month < 1) return 0;
  return Number(`${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`);
}

/** Tanggal ekspor dalam format Indonesia utk ditampilkan di modal konfirmasi */
export function formatExportedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ISO label → Date | null (untuk kolom DateTime di database saat restore) */
export function backupLabelToDate(label: string | undefined): Date | null {
  const iso = parseLabelToIsoOrNull(label);
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
