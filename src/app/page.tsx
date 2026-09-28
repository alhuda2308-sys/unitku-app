"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "@/lib/toast";
import {
  clearStaffSession,
  getServerStaffSessionSnapshot,
  getStaffSessionSnapshot,
  staffRoleLabel,
  subscribeStaffSession,
  type StaffSession,
} from "@/lib/staff-access";
import { BRAND_WA_FOOTER } from "@/lib/brand";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sidebar } from "@/components/kost/sidebar";
import { TopBar } from "@/components/kost/topbar";
import { MobileBottomBar } from "@/components/kost/mobile-bottombar";
import { MetricStrip } from "@/components/kost/metric-strip";
import { RoomMatrix, type TabValue } from "@/components/kost/room-matrix";
import { RoomDrawer } from "@/components/kost/room-drawer";
import { TagihanView } from "@/components/kost/tagihan-view";
import { MaintenancePanel } from "@/components/kost/maintenance-panel";
import { AnnouncementPanel } from "@/components/kost/announcement-panel";
import { TenantPortal } from "@/components/kost/tenant-portal";
import { PenghuniView } from "@/components/kost/penghuni-view";
import { KasView } from "@/components/kost/kas-view";
import { SettingsView } from "@/components/kost/settings-view";
import { CheckinModal, type CheckinPayload } from "@/components/kost/checkin-modal";
import { RoomAddModal } from "@/components/kost/room-add-modal";
import { RoomManageModal, type RoomPatch } from "@/components/kost/room-manage-modal";
import type { CheckoutPayload } from "@/components/kost/checkout-dialog";
import type { ExpenseDraft } from "@/components/kost/expense-modal";
import type { IssueDraft } from "@/components/kost/report-issue-drawer";
import {
  MONTH_NAMES,
  addMonths,
  formatDateLabel,
  formatIDR,
  dateToLabel,
  newPortalToken,
  parseDateLabel,
  ROOMS,
  waLink,
  type Room,
} from "@/lib/kost-data";
import {
  INVOICES,
  type Invoice,
} from "@/lib/kost-invoices";
import {
  CASH_ENTRIES,
  dateSortFromLabel,
  nextExpenseId,
  type CashEntry,
} from "@/lib/kost-cashflow";
import {
  TICKETS,
  TICKET_STATUS_META,
  TICKET_URGENSI_META,
  ticketFromDraft,
  ticketSubject,
  type CreateTicketDraft,
  type Ticket,
  type TicketStatus,
} from "@/lib/ticket-data";
import {
  ANNOUNCEMENTS,
  ANNOUNCEMENT_TODAY_ISO,
  announcementFromDraft,
  periodeLabel,
  targetLabel,
  type Announcement,
  type AnnouncementDraft,
} from "@/lib/announcement-data";
import { savePortalMirror } from "@/lib/portal-mirror";
import { PropertyBanner } from "@/components/kost/property-banner";
import {
  DEFAULT_SETTINGS,
  fileToPhotoDataUrl,
  nextSettingsId,
  PROPERTY_TYPE_META,
  getServerSettingsSnapshot,
  getSettingsSnapshot,
  subscribeSettings,
  updateStoredSettings,
  type IndoKostSettings,
} from "@/lib/app-settings";

type ViewKey =
  | "denah"
  | "tagihan"
  | "komplain"
  | "pengumuman"
  | "portal"
  | "penghuni"
  | "kas"
  | "pengaturan";

const VIEW_LABELS: Record<ViewKey, string> = {
  denah: "Denah Kamar",
  tagihan: "Tagihan & Invoice",
  komplain: "Komplain & Pemeliharaan",
  pengumuman: "Pengumuman & Broadcast",
  portal: "Portal Penyewa",
  penghuni: "Data Penghuni",
  kas: "Buku Kas",
  pengaturan: "Pengaturan",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "Tempo: 24 Sep" / "Sewa Sep 2025" → rolls the month forward (mock billing cycle) */
function advanceMonth(text: string): string {
  const idx = MONTHS.findIndex((m) => text.includes(m));
  if (idx === -1) return text;
  if (idx === MONTHS.length - 1) {
    return text.replace("Des", "Jan").replace(/\d{4}/, (y) => String(Number(y) + 1));
  }
  return text.replace(MONTHS[idx], MONTHS[idx + 1]);
}

/** "8123456789" → "812-3456-789" style display (matches existing dataset formatting) */
function formatPhone(digits: string): string {
  if (digits.length <= 4) return digits;
  const head = digits.slice(0, 3);
  const rest = digits.slice(3);
  const groups = rest.match(/.{1,4}/g) ?? [];
  return [head, ...groups].join("-");
}

export default function IndoKostPage() {
  const [rooms, setRooms] = useState<Room[]>(ROOMS);
  const [tickets, setTickets] = useState<Ticket[]>(TICKETS);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>(CASH_ENTRIES);
  // Lifted so room deletion / demo-data resets propagate to Tagihan & portal in real time
  const [invoices, setInvoices] = useState<Invoice[]>(INVOICES);
  const [announcements, setAnnouncements] = useState<Announcement[]>(ANNOUNCEMENTS);
  const [view, setView] = useState<ViewKey>("denah");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  // Pengaturan global — sumber kebenaran: localStorage (useSyncExternalStore), persist otomatis
  const settings = useSyncExternalStore(subscribeSettings, getSettingsSnapshot, getServerSettingsSnapshot);
  const [settingsTab, setSettingsTab] = useState("profil-saya");
  const property = settings.propertyProfile.nama;

  // ── Sesi staf mandiri (/staff?token=…) — null = akses owner penuh ──
  const staffSession = useSyncExternalStore(
    subscribeStaffSession,
    getStaffSessionSnapshot,
    getServerStaffSessionSnapshot,
  ) as StaffSession | null;
  const isPenjaga = staffSession?.role === "PENJAGA_TEKNISI";
  /** Owner & Admin Operasional boleh mengubah data; Penjaga hanya melihat */
  const canManageRooms = !staffSession || staffSession.role === "ADMIN_OPERASIONAL";

  const handleStaffLogout = () => {
    clearStaffSession();
    setView("denah");
    setSettingsTab("profil-saya");
    toast.success("Sesi staf ditutup", {
      description: "Perangkat ini kembali ke tampilan owner.",
    });
  };

  // Check-in modal (topbar + vacant room drawer)
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinPreselect, setCheckinPreselect] = useState<string | null>(null);

  // Room CRUD modals
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageRoomId, setManageRoomId] = useState<string | null>(null);
  /** Kebab-menu delete → double confirmation (occupied rooms are rejected with a toast) */
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<Room | null>(null);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  // ── Pengaturan: persist ke localStorage + tema global ────────────────────
  const updateSettings = useCallback((patch: Partial<IndoKostSettings> | ((s: IndoKostSettings) => Partial<IndoKostSettings>)) => {
    updateStoredSettings(patch);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.ikTheme = settings.theme;
  }, [settings.theme]);

  const manageRoom = useMemo(
    () => rooms.find((r) => r.id === manageRoomId) ?? null,
    [rooms, manageRoomId]
  );

  // Only ready-to-rent vacant rooms are bookable (perbaikan/nonaktif excluded)
  const vacantRooms = useMemo(
    () =>
      rooms.filter(
        (r) => r.status === "kosong" && (r.operational ?? "siap") === "siap"
      ),
    [rooms]
  );

  // Tab counts reflect the current search query (Denah view)
  const searchedRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(
      (r) => r.id.toLowerCase().includes(q) || (r.tenant?.name.toLowerCase().includes(q) ?? false)
    );
  }, [rooms, query]);

  const invoiceAlerts = useMemo(
    () =>
      rooms.filter((r) => r.status === "jatuhTempo" || r.status === "menunggak").length,
    [rooms]
  );

  const ticketAlerts = useMemo(
    () => tickets.filter((t) => t.status === "menunggu").length,
    [tickets]
  );

  // ── Portal Penyewa (magic token link) ──────────────────────────────
  // Pratinjau in-app memakai token penyewa dengan tagihan tertunggak
  // (fallback: Kamar 102, lalu penyewa mana pun). Halaman /portal?token=
  // selalu me-resolve data milik token tersebut saja.
  const portalPreviewToken = useMemo(() => {
    const unpaidRoom = rooms.find((r) => {
      if (!r.tenant) return false;
      const inv = invoices.find((i) => i.roomId === r.id && i.tenantName);
      return inv != null && inv.status !== "lunas";
    });
    const fallback =
      rooms.find((r) => r.id === "102" && r.tenant) ?? rooms.find((r) => r.tenant);
    return (unpaidRoom ?? fallback)?.tenant?.portalToken ?? null;
  }, [rooms, invoices]);

  const portalRoom = useMemo(
    () =>
      portalPreviewToken
        ? rooms.find((r) => r.tenant?.portalToken === portalPreviewToken) ?? null
        : null,
    [rooms, portalPreviewToken]
  );

  // Mirror state → localStorage: halaman publik /portal (tab baru) membaca
  // data terkini (lunas, check-in baru, banner pengumuman, reset) tanpa backend.
  useEffect(() => {
    savePortalMirror({ rooms, invoices, announcements, propertyName: property });
  }, [rooms, invoices, announcements, property]);

  const handleNavigate = (key: string) => {
    setMobileOpen(false);
    setSelectedRoomId(null);
    setView(key as ViewKey);
  };

  /** Open Pengaturan → tab "Zona Berbahaya" (sidebar footer shortcut) */
  const handleOpenDangerZone = () => {
    setMobileOpen(false);
    setSelectedRoomId(null);
    setView("pengaturan");
    setSettingsTab("danger");
  };

  /** Shared payment flip — syncs room pill AND the lifted invoice table */
  const markRoomPaid = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId && r.invoice
          ? {
              ...r,
              status: "lunas",
              invoice: {
                ...r.invoice,
                dueLabel: advanceMonth(r.invoice.dueLabel),
                periodLabel: advanceMonth(r.invoice.periodLabel),
                dayOffset: undefined,
              },
            }
          : r
      )
    );
    setInvoices((prev) =>
      prev.map((i) =>
        i.roomId === roomId && i.status !== "lunas"
          ? { ...i, status: "lunas", paidAt: "26 Sep 2025", dayOffset: undefined }
          : i
      )
    );
    if (room) {
      toast.success(`Pembayaran Kamar ${room.id} dicatat lunas`, {
        description: `${room.tenant?.name ?? "Penyewa"} · ${formatIDR(room.invoice?.amount ?? 0)} — tempo digeser ke ${
          advanceMonth(room.invoice?.dueLabel ?? "")
        }`,
      });
    }
  };

  const handleMarkPaid = (room: Room) => markRoomPaid(room.id);

  /** Tagihan table "Tandai Lunas / Konfirmasi" — syncs the invoice dataset (rooms follow via pill) */
  const handleInvoiceMarkPaid = (inv: Invoice) => {
    setInvoices((prev) =>
      prev.map((i) =>
        i.id === inv.id ? { ...i, status: "lunas", paidAt: "26 Sep 2025", dayOffset: undefined } : i
      )
    );
    setRooms((prev) =>
      prev.map((r) =>
        r.id === inv.roomId && r.status !== "kosong" && r.invoice
          ? {
              ...r,
              status: "lunas",
              invoice: {
                ...r.invoice,
                dueLabel: advanceMonth(r.invoice.dueLabel),
                periodLabel: advanceMonth(r.invoice.periodLabel),
                dayOffset: undefined,
              },
            }
          : r
      )
    );
    toast.success(`Kamar ${inv.roomId} ditandai lunas`, {
      description: `${inv.id} · ${formatIDR(inv.total)} diterima hari ini.`,
    });
  };

  const handleInvoiceCancel = (inv: Invoice) => {
    setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
    toast.warning(`Tagihan ${inv.id} dibatalkan`, {
      description: `Kamar ${inv.roomId} · ${formatIDR(inv.total)} dihapus dari daftar.`,
    });
  };

  /** Isi placeholder Template WhatsApp: {nama} {kos} {kamar} {nominal} {tempo} */
  const fillWaTemplate = (tpl: string, v: Record<string, string>) =>
    tpl
      .replaceAll("{nama}", v.nama)
      .replaceAll("{kos}", v.kos)
      .replaceAll("{kamar}", v.kamar)
      .replaceAll("{nominal}", v.nominal)
      .replaceAll("{tempo}", v.tempo);

  /** "Kirim Tagihan WA" (panel tagihan RoomDrawer) — BUKA WhatsApp asli:
   *  nomor dibersihkan → wa.me/<digits>?text=<encodeURIComponent(pesan)>;
   *  pesan dari Template WhatsApp (Pengaturan) sesuai status tagihan; toast
   *  sukses HANYA setelah jendela WhatsApp berhasil dibuka/ditrigger. */
  const handleSendInvoice = (room: Room) => {
    const phone = room.tenant?.phone ?? "";
    const digits = phone.replace(/[^0-9]/g, "");
    const amount = room.invoice?.amount ?? 0;
    if (!digits) {
      toast.error("Nomor WhatsApp penyewa belum tersedia", {
        description: `Kamar ${room.id} — lengkapi No. WhatsApp penghuni terlebih dahulu.`,
      });
      return;
    }
    const tpl =
      room.status === "lunas" ? settings.templates.lunas : settings.templates.hariH;
    const message = [
      fillWaTemplate(tpl, {
        nama: room.tenant?.name ?? "Penyewa",
        kos: settings.propertyProfile.nama,
        kamar: room.id,
        nominal: formatIDR(amount),
        tempo: (room.invoice?.dueLabel ?? "").replace("Tempo: ", ""),
      }),
      BRAND_WA_FOOTER,
    ].join("\n\n");
    const waUrl = `${waLink(digits)}?text=${encodeURIComponent(message)}`;
    const opened = window.open(waUrl, "_blank", "noopener,noreferrer");
    if (opened) {
      toast.success(`Draf WhatsApp dibuka — Kamar ${room.id}`, {
        description: `${room.tenant?.name ?? "Penyewa"} · ${formatIDR(amount)} → ${phone}`,
      });
    } else {
      toast.warning("Browser memblokir pop-up WhatsApp", {
        description: "Izinkan pop-up untuk situs ini, lalu tekan tombol sekali lagi.",
      });
    }
  };

  // ── Check-in Penghuni Baru ─────────────────────────────────────────────────

  const openCheckin = (roomId?: string) => {
    if (vacantRooms.length === 0) {
      toast.info("Semua kamar sedang terisi.", {
        description: "Proses check-out terlebih dahulu untuk mengosongkan kamar.",
      });
      return;
    }
    setCheckinPreselect(roomId ?? vacantRooms[0].id);
    setSelectedRoomId(null);
    setCheckinOpen(true);
  };

  const handleCheckinSubmit = (p: CheckinPayload) => {
    const moveInLabel = formatDateLabel(p.tanggalMasuk);
    const moveIn = parseDateLabel(moveInLabel);
    const months = p.siklus === "Bulanan" ? 1 : p.siklus === "Per 3 Bulan" ? 3 : 12;
    const endDate = dateToLabel(addMonths(moveIn, months));
    const monthName = MONTH_NAMES[moveIn.getMonth()];
    const roomType = rooms.find((r) => r.id === p.roomId)?.type ?? "";

    setRooms((prev) =>
      prev.map((r) =>
        r.id === p.roomId
          ? {
              ...r,
              status: "lunas",
              price: p.totalPerBulan,
              tenant: {
                name: p.nama,
                phone: `+62 ${formatPhone(p.phone)}`,
                moveInDate: moveInLabel,
                emergencyContact: {
                  name: p.emergencyName || "—",
                  phone: p.emergencyPhone || "—",
                },
                portalToken: newPortalToken(p.roomId),
              },
              invoice: {
                amount: p.totalPerBulan,
                periodLabel: `Sewa ${monthName} ${moveIn.getFullYear()}`,
                dueLabel: `Tempo: ${moveIn.getDate()} ${monthName}`,
              },
              contract: {
                duration: p.siklus,
                startDate: moveInLabel,
                endDate,
                deposit: p.deposit,
                depositHeld: true,
              },
            }
          : r
      )
    );

    // First invoice for the new tenant (start month, paid at check-in) → Tagihan table
    const newInvoice: Invoice = {
      id: `#INV-${moveIn.getFullYear()}${String(moveIn.getMonth() + 1).padStart(2, "0")}-${p.roomId}`,
      roomId: p.roomId,
      tenantName: p.nama,
      tenantPhone: `+62 ${formatPhone(p.phone)}`,
      roomType,
      periodLabel: `1 ${monthName} – ${new Date(moveIn.getFullYear(), moveIn.getMonth() + 1, 0).getDate()} ${monthName} ${moveIn.getFullYear()}`,
      periodKey: `${moveIn.getFullYear()}-${String(moveIn.getMonth() + 1).padStart(2, "0")}`,
      dueDate: moveInLabel,
      lines: [
        { label: "Sewa Kamar", amount: p.hargaSewa },
        ...p.addons.map((a) => ({
          label: a,
          amount:
            a === "Parkir Motor" ? 50_000 : a === "Parkir Mobil" ? 150_000 : 200_000,
        })),
      ],
      total: p.totalPerBulan,
      status: "lunas",
      paidAt: "26 Sep 2025",
    };
    setInvoices((prev) => [newInvoice, ...prev]);

    const addons = p.addons.length > 0 ? ` · Add-on: ${p.addons.join(", ")}` : "";
    toast.success(`${p.nama} check-in ke Kamar ${p.roomId}`, {
      description: `${formatIDR(p.totalPerBulan)}/bln · deposit ${formatIDR(p.deposit)} ditahan · kontrak hingga ${endDate}${addons}`,
    });
  };

  // ── Data Penghuni: perpanjang & check-out ──────────────────────────────────

  const handleRenew = (room: Room, newEndDate: string, months: number) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === room.id && r.contract
          ? { ...r, contract: { ...r.contract, endDate: newEndDate } }
          : r
      )
    );
    toast.success(`Kontrak Kamar ${room.id} diperpanjang +${months} bulan`, {
      description: `${room.tenant?.name} · kontrak berakhir ${newEndDate}. Pengingat otomatis H-14 via WA.`,
    });
  };

  const handleCheckout = (room: Room, payload: CheckoutPayload) => {
    if (!room.tenant) return;
    const dateLabel = formatDateLabel(payload.tanggal);

    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== room.id) return r;
        const { tenant: _t, invoice: _i, contract: _c, ...rest } = r;
        return { ...rest, status: "kosong" as const };
      })
    );

    if (payload.refund > 0) {
      const id = nextExpenseId(cashEntries);
      const entry: CashEntry = {
        id,
        dateLabel,
        dateSort: dateSortFromLabel(dateLabel),
        type: "keluar",
        category: "Refund Deposit",
        description: `Refund deposit — ${room.tenant.name} (Kamar ${room.id}) · ${payload.alasan}`,
        amount: payload.refund,
      };
      setCashEntries((prev) => [entry, ...prev]);
    }

    toast.success(`Check-out Kamar ${room.id} diproses`, {
      description:
        payload.refund > 0
          ? `${room.tenant.name} keluar (${payload.alasan}) · refund ${formatIDR(payload.refund)} tercatat di Buku Kas.`
          : `${room.tenant.name} keluar (${payload.alasan}) · tanpa refund deposit.`,
    });
  };

  // ── Buku Kas ───────────────────────────────────────────────────────────────

  const handleAddExpense = (draft: ExpenseDraft) => {
    const dateLabel = formatDateLabel(draft.tanggal);
    const entry: CashEntry = {
      id: nextExpenseId(cashEntries),
      dateLabel,
      dateSort: dateSortFromLabel(dateLabel),
      type: "keluar",
      category: draft.category,
      description: draft.description,
      amount: draft.amount,
      attachment: draft.attachment,
    };
    setCashEntries((prev) => [entry, ...prev]);
    toast.success(`Pengeluaran ${formatIDR(draft.amount)} tercatat`, {
      description: `${draft.category} · ${draft.description} · ${dateLabel}`,
    });
  };

  const handleDeleteEntry = (entry: CashEntry) => {
    setCashEntries((prev) => prev.filter((e) => e.id !== entry.id));
    toast.success(`Transaksi ${entry.id} dihapus`, {
      description: `${entry.description} · ${formatIDR(entry.amount)} dikeluarkan dari rekap.`,
    });
  };

  // ── Pengaturan ─────────────────────────────────────────────────────────────

  /** Ganti properti aktif dari pemilih sidebar — profil ikut tersinkron dari daftar properti */
  const handleSwitchProperty = (name: string) => {
    const entry = settings.properties.find((p) => p.name === name);
    if (!entry) return;
    updateSettings((s) => ({
      properties: s.properties.map((p) => ({ ...p, aktif: p.id === entry.id })),
      propertyProfile: {
        ...s.propertyProfile,
        nama: entry.name,
        tipe: entry.type,
        alamat: entry.address || s.propertyProfile.alamat,
        fotoUrl: entry.photoUrl ?? s.propertyProfile.fotoUrl,
      },
    }));
    if (name !== property) {
      toast.info(`Beralih ke ${name}`, {
        description: `${PROPERTY_TYPE_META[entry.type].label} · data kamar cabang ini berupa dataset demo.`,
      });
    }
  };

  /** Ganti foto fasad langsung dari banner Denah */
  const handleGantiFotoProperti = (file: File) => {
    fileToPhotoDataUrl(file)
      .then((url) => {
        updateSettings({ propertyProfile: { ...settings.propertyProfile, fotoUrl: url } });
        toast.success("Foto properti diperbarui", {
          description: "Banner identitas & modul Pengaturan otomatis ikut berganti.",
        });
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Gagal memuat foto");
      });
  };

  const handleApplyTariff = (changes: { type: string; price: number }[]) => {
    setRooms((prev) =>
      prev.map((r) => {
        const change = changes.find((c) => c.type === r.type);
        return change ? { ...r, price: change.price } : r;
      })
    );
    toast.success("Tarif kamar diperbarui", {
      description: changes
        .map((c) => `${c.type}: ${formatIDR(c.price)}/bln`)
        .join(" · ")
        .concat(" — berlaku untuk tagihan periode berikutnya."),
    });
  };

  // ── Manajemen Kamar (CRUD) ────────────────────────────────────────────

  const handleAddRooms = (newRooms: Room[]) => {
    setRooms((prev) => [...prev, ...newRooms]);
    toast.success(
      `${newRooms.length} kamar baru ditambahkan`,
      {
        description: `${newRooms.map((r) => r.id).join(", ")} · ${newRooms[0].type} · ${formatIDR(
          newRooms[0].price
        )}/bln · status kosong.`,
      }
    );
  };

  /** Katalog Fasilitas — tambah custom dari modal Tambah Kamar (tersimpan master) */
  const handleAddCustomFacility = (label: string) => {
    updateStoredSettings((s) => ({
      facilities: {
        ...s.facilities,
        unit: [...s.facilities.unit, { id: nextSettingsId("fac"), label, custom: true }],
      },
    }));
    toast.success(`Fasilitas "${label}" masuk katalog`, {
      description: "Otomatis terpilih untuk kamar ini & tersedia saat menambah kamar berikutnya.",
    });
  };

  /** Hapus fasilitas custom dari katalog (salah ketik) — kamar lama tak terpengaruh */
  const handleRemoveCustomFacility = (id: string) => {
    const removed = settings.facilities.unit.find((f) => f.id === id);
    updateStoredSettings((s) => ({
      facilities: {
        ...s.facilities,
        unit: s.facilities.unit.filter((f) => f.id !== id),
      },
    }));
    if (removed) {
      toast.info(`Fasilitas "${removed.label}" dihapus dari katalog`, {
        description: "Kamar yang sudah memilikinya tidak berubah.",
      });
    }
  };

  const handleUpdateRoom = (room: Room, patch: RoomPatch) => {
    const idChanged = patch.id !== room.id;
    setRooms((prev) =>
      prev.map((r) =>
        r.id === room.id
          ? {
              ...r,
              id: patch.id,
              floor: patch.floor,
              type: patch.type,
              price: patch.price,
              facilities: patch.facilities,
              operational: patch.operational,
            }
          : r
      )
    );
    // Renumber propagates to invoice & ticket datasets so nothing dangles
    if (idChanged) {
      setInvoices((prev) =>
        prev.map((i) => (i.roomId === room.id ? { ...i, roomId: patch.id } : i))
      );
      setTickets((prev) =>
        prev.map((t) => (t.roomId === room.id ? { ...t, roomId: patch.id } : t))
      );
    }
    toast.success(`Kamar ${room.id} diperbarui`, {
      description: idChanged
        ? `Nomor kamar berubah menjadi "${patch.id}" — tagihan & tiket ikut diperbarui.`
        : `${patch.type} · ${formatIDR(patch.price)}/bln · Lantai ${patch.floor}.`,
    });
  };

  const handleDeleteRoom = (room: Room) => {
    if (room.tenant && room.status !== "kosong") {
      toast.error("Kamar tidak bisa dihapus", {
        description:
          "Kamar tidak bisa dihapus selama masih ada penghuni aktif. Lakukan check-out terlebih dahulu.",
      });
      return;
    }
    setRooms((prev) => prev.filter((r) => r.id !== room.id));
    setInvoices((prev) => prev.filter((i) => i.roomId !== room.id));
    if (selectedRoomId === room.id) setSelectedRoomId(null);
    if (manageRoomId === room.id) setManageRoomId(null);
    toast.success(`Kamar ${room.id} dihapus`, {
      description: `${room.type} (${formatIDR(room.price)}/bln) dikeluarkan dari denah & daftar tagihan.`,
    });
  };

  /** Kebab path — gate the destructive action behind a confirmation dialog */
  const handleRequestDeleteRoom = (room: Room) => {
    if (room.tenant && room.status !== "kosong") {
      handleDeleteRoom(room); // runs the validation branch → toast only
      return;
    }
    setConfirmDeleteRoom(room);
  };

  // ── Zona Berbahaya (Danger Zone) ────────────────────────────────────────

  const handleClearDemoData = () => {
    const keptRooms = rooms.length;
    const removedTenants = rooms.filter((r) => r.tenant && r.status !== "kosong").length;
    setRooms((prev) =>
      prev.map((r) => {
        const { tenant: _t, invoice: _i, contract: _c, ...rest } = r;
        return { ...rest, status: "kosong" as const };
      })
    );
    setInvoices([]);
    setCashEntries([]);
    setTickets([]);
    setAnnouncements([]);
    setSelectedRoomId(null);
    toast.success("Data demo berhasil dihapus", {
      description: `${removedTenants} penyewa, seluruh invoice, transaksi kas, tiket & pengumuman dikosongkan — struktur ${keptRooms} kamar & profil properti dipertahankan.`,
    });
  };

  const handleFactoryReset = () => {
    const removedRooms = rooms.length;
    setRooms([]);
    setInvoices([]);
    setCashEntries([]);
    setTickets([]);
    setAnnouncements([]);
    setSelectedRoomId(null);
    setView("denah");
    setActiveTab("all");
    setQuery("");
    toast.success("Factory reset selesai", {
      description: `${removedRooms} kamar beserta seluruh data penyewa, tagihan & transaksi dihapus permanen.`,
    });
  };

  // ── Maintenance / ticketing (Phase 3) ──────────────────────────────────────

  const handleTicketStatus = (ticket: Ticket, status: TicketStatus) => {
    if (status === ticket.status) return;
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticket.id
          ? {
              ...t,
              status,
              selesaiLabel: status === "selesai" ? "Selesai hari ini" : t.selesaiLabel,
            }
          : t
      )
    );
    toast.success(`${ticket.id} → ${TICKET_STATUS_META[status].label}`, {
      description: `${ticketSubject(ticket)} · ${ticket.kategori} · urgensi ${
        TICKET_URGENSI_META[ticket.urgensi].label
      }`,
    });
  };

  /** Shared ticket creator (modal owner + portal webhook) — newest-first sort key */
  const insertTicket = (draft: CreateTicketDraft): Ticket => {
    const ticket = ticketFromDraft(draft, tickets);
    setTickets((prev) => [ticket, ...prev]);
    return ticket;
  };

  /** "+ Buat Laporan Komplain / Maintenance" modal → new Menunggu ticket (metrics & badge live) */
  const handleCreateTicket = (draft: CreateTicketDraft): string => {
    const ticket = insertTicket(draft);
    toast.success(`Tiket ${ticket.id} dibuat — status Menunggu`, {
      description: `${ticket.judul} · ${ticketSubject(ticket)} · urgensi ${
        TICKET_URGENSI_META[ticket.urgensi].label
      }${ticket.photos.length > 0 ? ` · ${ticket.photos.length} foto lampiran` : ""}.`,
    });
    return ticket.id;
  };

  /** Tenant portal report → new ticket in the owner panel. Returns ticket id. */
  const handleCreateIssue = (draft: IssueDraft): string => {
    const room = portalRoom;
    if (!room?.tenant) return "";
    return insertTicket({
      sumber: "penyewa",
      roomId: room.id,
      reporterName: room.tenant.name,
      reporterPhone: room.tenant.phone,
      kategori: draft.kategori,
      judul: "Laporan via Portal Penyewa",
      deskripsi: draft.catatan,
      urgensi: "sedang",
      photos: draft.photos,
    }).id;
  };

  // ── Pengumuman & Broadcast ─────────────────────────────────────────

  /** "+ Buat Pengumuman Baru" → tayang di portal sesuai periode & lantai */
  const handleCreateAnnouncement = (draft: AnnouncementDraft) => {
    const a = announcementFromDraft(draft, announcements, ANNOUNCEMENT_TODAY_ISO);
    setAnnouncements((prev) => [a, ...prev]);
    toast.success(`Pengumuman ${a.id} dipasang di Portal Penyewa`, {
      description: `${a.judul} · ${targetLabel(a.targetFloor)} · tayang ${periodeLabel(a)}.`,
    });
  };

  const handleUpdateAnnouncement = (a: Announcement, draft: AnnouncementDraft) => {
    setAnnouncements((prev) =>
      prev.map((row) => (row.id === a.id ? { ...row, ...draft } : row))
    );
    toast.success(`Pengumuman ${a.id} diperbarui`, {
      description: `${draft.judul} · tayang ${periodeLabel({ ...a, ...draft })}.`,
    });
  };

  const handleToggleAnnouncement = (a: Announcement) => {
    setAnnouncements((prev) =>
      prev.map((row) => (row.id === a.id ? { ...row, aktif: !row.aktif } : row))
    );
    toast.success(
      a.aktif ? `Pengumuman ${a.id} dinonaktifkan` : `Pengumuman ${a.id} diaktifkan kembali`,
      {
        description: a.aktif
          ? `"${a.judul}" ditarik dari Portal Penyewa.`
          : `"${a.judul}" kembali tayang sesuai periode & target lantai.`,
      }
    );
  };

  const handleDeleteAnnouncement = (a: Announcement) => {
    setAnnouncements((prev) => prev.filter((row) => row.id !== a.id));
    toast.success(`Pengumuman ${a.id} dihapus`, {
      description: `"${a.judul}" dikeluarkan dari riwayat & Portal Penyewa.`,
    });
  };

  // ── Portal Penyewa renders standalone (public page, no owner chrome) ──────
  if (view === "portal") {
    return (
      <TenantPortal
        token={portalPreviewToken ?? ""}
        rooms={rooms}
        invoices={invoices}
        announcements={announcements}
        propertyName={property}
        sharedFacilities={settings.facilities.shared.map((f) => f.label)}
        onExit={() => setView("denah")}
        onOpenTickets={() => setView("komplain")}
        onSubmitIssue={handleCreateIssue}
      />
    );
  }

  return (
    <div className="ik-shell flex h-screen overflow-hidden bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        property={property}
        properties={settings.properties}
        onPropertyChange={(name) => {
          handleSwitchProperty(name);
          setMobileOpen(false);
        }}
        invoiceAlerts={invoiceAlerts}
        ticketAlerts={ticketAlerts}
        activeKey={view}
        onNavigate={handleNavigate}
        onOpenDangerZone={handleOpenDangerZone}
        staffSession={staffSession ? { name: staffSession.name, role: staffSession.role } : null}
        onStaffLogout={handleStaffLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          property={property}
          current={VIEW_LABELS[view]}
          query={query}
          onQueryChange={setQuery}
          activeStatus={activeTab}
          onStatusChange={(s) => {
            setActiveTab(s);
            if (view !== "denah") setView("denah");
          }}
          onCheckIn={() => openCheckin()}
          canCheckIn={!isPenjaga}
          onOpenMobileNav={() => setMobileOpen(true)}
          theme={settings.theme}
          onThemeChange={(t) => updateSettings({ theme: t })}
        />

        <main className="flex-1 overflow-y-auto scrollbar-thin" aria-label="Konten utama">
          <div className="mx-auto max-w-[1440px] space-y-5 px-3.5 py-4 pb-24 sm:pb-4 lg:p-6">
            {view === "tagihan" ? (
              <TagihanView
                invoices={invoices}
                query={query}
                onQueryChange={setQuery}
                propertyName={property}
                onMarkPaid={handleInvoiceMarkPaid}
                onCancelInvoice={handleInvoiceCancel}
              />
            ) : view === "komplain" ? (
              <MaintenancePanel
                tickets={tickets}
                rooms={rooms}
                query={query}
                onQueryChange={setQuery}
                onStatusChange={handleTicketStatus}
                onCreateTicket={handleCreateTicket}
              />
            ) : view === "pengumuman" ? (
              <AnnouncementPanel
                announcements={announcements}
                rooms={rooms}
                query={query}
                onQueryChange={setQuery}
                propertyName={property}
                onCreate={handleCreateAnnouncement}
                onUpdate={handleUpdateAnnouncement}
                onToggleActive={handleToggleAnnouncement}
                onDelete={handleDeleteAnnouncement}
              />
            ) : view === "penghuni" ? (
              <PenghuniView
                rooms={rooms}
                invoices={invoices}
                query={query}
                onQueryChange={setQuery}
                onRenew={handleRenew}
                onCheckout={handleCheckout}
                propertyName={property}
              />
            ) : view === "kas" ? (
              <KasView
                entries={cashEntries}
                onAddExpense={handleAddExpense}
                onDeleteEntry={handleDeleteEntry}
                isStaffView={!!staffSession}
              />
            ) : view === "pengaturan" ? (
              <SettingsView
                propertyName={property}
                rooms={rooms}
                tab={settingsTab}
                onTabChange={setSettingsTab}
                settings={settings}
                onUpdateSettings={updateSettings}
                dangerCounts={{
                  rooms: rooms.length,
                  tenants: rooms.filter((r) => r.tenant && r.status !== "kosong").length,
                  invoices: invoices.length,
                  cash: cashEntries.length,
                  tickets: tickets.length,
                }}
                onClearDemo={handleClearDemoData}
                onFactoryReset={handleFactoryReset}
                onApplyTariff={handleApplyTariff}
                staffSession={
                  staffSession ? { name: staffSession.name, role: staffSession.role } : null
                }
                onStaffLogout={handleStaffLogout}
              />
            ) : (
              <>
                {/* [1] Banner identitas properti — paling atas */}
                <PropertyBanner
                  profile={settings.propertyProfile}
                  unitCount={rooms.length}
                  onGantiFoto={handleGantiFotoProperti}
                  ownerName={staffSession?.name ?? settings.owner.nama}
                  ownerRole={staffSession ? staffRoleLabel(staffSession.role) : "Owner"}
                  onKelola={
                    staffSession
                      ? undefined
                      : () => {
                          setView("pengaturan");
                          setSettingsTab("properti-list");
                        }
                  }
                />

                {/* [2] Page heading + aksi */}
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h1 className="ik-head text-lg font-bold tracking-tight text-zinc-900">Denah Kamar</h1>
                    <p className="mt-0.5 text-sm font-medium text-zinc-700">
                      Ringkasan okupansi &amp; status tagihan · data per 26 Sep 2025
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="hidden text-[13px] font-medium text-zinc-700 sm:block">
                      Sinkron terakhir: hari ini 08.32 WIB
                    </p>
                    {canManageRooms && (
                      <Button
                        onClick={() => setAddRoomOpen(true)}
                        variant="outline"
                        className="h-9 border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-800 shadow-none hover:bg-zinc-50"
                      >
                        <Plus className="size-4 text-zinc-700" strokeWidth={2} />
                        Tambah Kamar Baru
                      </Button>
                    )}
                  </div>
                </div>

                {/* [3] Kartu metrik ringkasan */}
                <MetricStrip
                  rooms={rooms}
                  unit={PROPERTY_TYPE_META[settings.propertyProfile.tipe].unit}
                />

                <RoomMatrix
                  rooms={searchedRooms}
                  totalRooms={rooms.length}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  onSelectRoom={(room) => setSelectedRoomId(room.id)}
                  onManageRoom={(room) => {
                    setManageRoomId(room.id);
                    setManageOpen(true);
                  }}
                  onDeleteRoom={handleRequestDeleteRoom}
                  onCheckinRoom={(room) => openCheckin(room.id)}
                  canManage={canManageRooms}
                  onAddRoom={() => setAddRoomOpen(true)}
                />
              </>
            )}
          </div>
        </main>

        {/* Bilah navigasi bawah — khusus ponsel (<640px); kontrol atas desktop tidak berubah */}
        <MobileBottomBar
          query={query}
          onQueryChange={setQuery}
          activeStatus={activeTab}
          onStatusChange={(s) => {
            setActiveTab(s);
            if (view !== "denah") setView("denah");
          }}
          onCheckIn={() => openCheckin()}
          canCheckIn={!isPenjaga}
          onOpenMobileNav={() => setMobileOpen(true)}
          theme={settings.theme}
          onThemeChange={(t) => updateSettings({ theme: t })}
        />
      </div>

      <RoomDrawer
        room={selectedRoom}
        open={selectedRoomId !== null}
        onOpenChange={(o) => {
          if (!o) setSelectedRoomId(null);
        }}
        onMarkPaid={handleMarkPaid}
        onSendInvoice={handleSendInvoice}
        onCheckIn={(room) => openCheckin(room.id)}
        propertyName={property}
        canManage={canManageRooms}
      />

      <CheckinModal
        key={`ck-${checkinOpen ? "open" : "closed"}-${checkinPreselect ?? "none"}`}
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        vacantRooms={vacantRooms}
        preselectRoomId={checkinPreselect}
        onSubmit={handleCheckinSubmit}
      />

      <RoomAddModal
        key={`ra-${addRoomOpen}`}
        open={addRoomOpen}
        onOpenChange={setAddRoomOpen}
        allRooms={rooms}
        onAdd={handleAddRooms}
        facilityCatalog={settings.facilities.unit}
        onAddCustomFacility={handleAddCustomFacility}
        onRemoveCustomFacility={handleRemoveCustomFacility}
      />

      <RoomManageModal
        key={`rm-${manageRoomId ?? "none"}-${manageOpen}`}
        room={manageRoom}
        open={manageOpen}
        onOpenChange={setManageOpen}
        allRooms={rooms}
        onSave={handleUpdateRoom}
        onDelete={handleDeleteRoom}
        facilityCatalog={settings.facilities.unit}
      />

      {/* Kebab delete confirmation */}
      <AlertDialog
        open={confirmDeleteRoom !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmDeleteRoom(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">
              Hapus Kamar {confirmDeleteRoom?.id}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12.5px] leading-5">
              Kamar {confirmDeleteRoom?.id} — {confirmDeleteRoom?.type} ({formatIDR(
                confirmDeleteRoom?.price ?? 0
              )}
              /bln) akan dihapus permanen dari denah beserta tagihannya. Riwayat transaksi kas tetap
              tersimpan di UnitKu. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 border-zinc-200 bg-white text-[13px] text-zinc-700 shadow-none hover:bg-zinc-100">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-9 bg-red-600 text-[13px] font-semibold text-white shadow-none hover:bg-red-700"
              onClick={() => {
                if (confirmDeleteRoom) handleDeleteRoom(confirmDeleteRoom);
                setConfirmDeleteRoom(null);
              }}
            >
              Ya, Hapus Kamar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
