"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api-client";
import {
  getDashboardSnapshot,
  getServerDashboardSnapshot,
  loadDashboard,
  refreshDashboard,
  subscribeDashboard,
  updateCashEntries,
  updateInvoices,
  updateRooms,
} from "@/lib/dashboard-store";
import {
  clearStaffSession,
  getServerStaffSessionSnapshot,
  getStaffSessionSnapshot,
  staffRoleLabel,
  subscribeStaffSession,
  type StaffSession,
} from "@/lib/staff-access";
import { BRAND_WA_FOOTER } from "@/lib/brand";
import { Building2, CloudOff, Loader2, Plus, RefreshCw } from "lucide-react";
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
import { PwaInstallBanner } from "@/components/kost/pwa-install";
import { MetricStrip } from "@/components/kost/metric-strip";
import { RoomMatrix, type TabValue } from "@/components/kost/room-matrix";
import { RoomDrawer } from "@/components/kost/room-drawer";
import { TagihanView } from "@/components/kost/tagihan-view";
import { MaintenancePanel } from "@/components/kost/maintenance-panel";
import { AnnouncementPanel } from "@/components/kost/announcement-panel";
import { TenantPortal } from "@/components/kost/tenant-portal";
import { LicenseGate } from "@/components/billing/license-gate";
import { PenghuniView } from "@/components/kost/penghuni-view";
import { KasView } from "@/components/kost/kas-view";
import { SettingsView } from "@/components/kost/settings-view";
import { CheckinModal, type CheckinPayload } from "@/components/kost/checkin-modal";
import { RoomAddModal } from "@/components/kost/room-add-modal";
import { RoomManageModal, type RoomPatch } from "@/components/kost/room-manage-modal";
import type { CheckoutPayload } from "@/components/kost/checkout-dialog";
import type { ExpenseDraft } from "@/components/kost/expense-modal";
import type { IncomeDraft } from "@/components/kost/income-modal";
import type { IssueDraft } from "@/components/kost/report-issue-drawer";
import {
  formatDateLabel,
  formatIDR,
  ROOMS,
  waLink,
  type Room,
} from "@/lib/kost-data";
import {
  INVOICES,
  buildBillingWaMessage,
  buildReceiptWaMessage,
  type Invoice,
  type InvoiceLine,
  type WaBillingContext,
} from "@/lib/kost-invoices";
import { portalLink } from "@/lib/tenant-portal";
import {
  CASH_ENTRIES,
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
  type PropertyProfile,
  type RekeningConfig,
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

/** Pesan error ramah untuk toast gagal (dari Error dilempar api-client) */
function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Terjadi kesalahan tak terduga.";
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
  // ── Data dari Supabase via Route Handlers (external store — kamar/tagihan/kas)
  const dash = useSyncExternalStore(
    subscribeDashboard,
    getDashboardSnapshot,
    getServerDashboardSnapshot,
  );
  const { rooms, invoices, cashEntries, status: dbState, syncedAt } = dash;
  const [tickets, setTickets] = useState<Ticket[]>(TICKETS); // lokal (demo)
  const [announcements, setAnnouncements] = useState<Announcement[]>(ANNOUNCEMENTS); // lokal (demo)
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

  // ── Gerbang lisensi (jual putus Mayar) — non-null = tampilkan layar gembok ─
  const [licenseGate, setLicenseGate] = useState<{
    email: string;
    checkoutUrl: string;
  } | null>(null);

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

  // ── Bootstrap data dari Supabase (Route Handlers) — external store, tanpa setState-in-effect
  useEffect(() => {
    loadDashboard().catch((err: unknown) => {
      toast.error("Gagal terhubung database", {
        description: err instanceof Error ? err.message : "Menampilkan data demo perangkat ini.",
      });
    });
  }, []);

  // ── Bootstrap tiket komplain dari database (cloud-first, fallback mock demo)
  useEffect(() => {
    let alive = true;
    api
      .getTickets()
      .then((res) => {
        if (alive) setTickets(res.tickets);
      })
      .catch(() => {
        /* offline — dataset demo lokal tetap dipakai */
      });
    return () => {
      alive = false;
    };
  }, []);

  /** Tombol "Coba Sambungkan Ulang" pada banner offline */
  const handleRetrySync = () => {
    loadDashboard().catch((err: unknown) => {
      toast.error("Gagal terhubung database", {
        description: err instanceof Error ? err.message : "Menampilkan data demo perangkat ini.",
      });
    });
  };

  // ── Guard onboarding + gerbang lisensi (jual putus Mayar) ───────────────────
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then(
        (info:
          | { user?: { id: string; email?: string } | null; demo?: boolean }
          | null) => {
          // Demo / belum masuk (middleware sudah menangani) → jangan ganggu
          if (!alive || !info?.user || info.demo) return;
          // Gerbang lisensi dulu: belum lunas → layar gembok (sebelum onboarding)
          return fetch("/api/billing/license", { cache: "no-store" })
            .then((r) => r.json())
            .then(
              (lic: { licensed?: boolean; checkoutUrl?: string } | null) => {
                if (!alive) return;
                if (lic && lic.licensed === false) {
                  setLicenseGate({
                    email: info.user?.email ?? "",
                    checkoutUrl:
                      typeof lic.checkoutUrl === "string" ? lic.checkoutUrl : "",
                  });
                  return;
                }
                // API lisensi gagal (offline) → fail-open; lanjut cek properti
                return api
                  .getProperty()
                  .then((res) => {
                    if (alive && res.property === null) {
                      window.location.replace("/onboarding");
                    }
                  })
                  .catch(() => {
                    /* offline — biarkan mode demo/offline berjalan */
                  });
              },
            );
        },
      )
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // ── Sinkron profil properti & rekening dari database (cloud = sumber kebenaran)
  useEffect(() => {
    let alive = true;
    api
      .getProperty()
      .then((res) => {
        if (!alive) return;
        const p = res.property;
        // Belum onboarding (properti null) → guard onboarding yang menangani
        if (!p) return;
        updateStoredSettings((s) => ({
          propertyProfile: {
            ...s.propertyProfile,
            nama: p.name,
            tipe: (p.tipe in PROPERTY_TYPE_META
              ? p.tipe
              : s.propertyProfile.tipe) as PropertyProfile["tipe"],
            alamat: p.alamat ?? s.propertyProfile.alamat,
            fotoUrl: p.fotoUrl ?? s.propertyProfile.fotoUrl,
          },
          rekening: {
            bank: p.bankName ?? s.rekening.bank,
            noRek: p.bankAccountNo ?? s.rekening.noRek,
            atasNama: p.bankAccountName ?? s.rekening.atasNama,
            qrisImageUrl: p.qrisImageUrl ?? s.rekening.qrisImageUrl,
            qrisNmid: p.qrisNmid ?? s.rekening.qrisNmid,
          },
        }));
      })
      .catch(() => {
        /* offline — biarkan pengaturan lokal */
      });
    return () => {
      alive = false;
    };
  }, []);

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

  /** Shared payment flip — server ditandai lunas lalu kamar+invoice diperbarui dari respons */
  const markRoomPaid = (roomId: string) => {
    const invoiceId = invoices.find((i) => i.roomId === roomId && i.status !== "lunas")?.id;
    if (!invoiceId) {
      toast.info(`Tidak ada tagihan tertunggak untuk Kamar ${roomId}.`);
      return;
    }
    api
      .markInvoicePaid(invoiceId)
      .then(({ invoice, room, cashEntry }) => {
        updateInvoices((prev) => prev.map((i) => (i.id === invoice.id ? invoice : i)));
        updateRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
        if (cashEntry) updateCashEntries((prev) => [cashEntry, ...prev]);
        toast.success(`Pembayaran Kamar ${room.id} dicatat lunas`, {
          description: `${room.tenant?.name ?? "Penyewa"} · ${formatIDR(invoice.total)} diterima ${invoice.paidAt ?? "hari ini"}${cashEntry ? " · pemasukan dicatat ke Buku Kas" : ""} · tersimpan ke cloud.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal menandai lunas", { description: errMsg(err) }),
      );
  };

  const handleMarkPaid = (room: Room) => markRoomPaid(room.id);

  /** Tagihan table "Tandai Lunas / Konfirmasi" — server-first, kamar & Buku Kas ikut disinkronkan */
  const handleInvoiceMarkPaid = (inv: Invoice) => {
    api
      .markInvoicePaid(inv.id)
      .then(({ invoice, room, cashEntry }) => {
        updateInvoices((prev) => prev.map((i) => (i.id === invoice.id ? invoice : i)));
        updateRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
        if (cashEntry) updateCashEntries((prev) => [cashEntry, ...prev]);
        toast.success(`Kamar ${inv.roomId} ditandai lunas`, {
          description: `${invoice.id} · ${formatIDR(invoice.total)} diterima ${invoice.paidAt ?? "hari ini"}${cashEntry ? " · pemasukan dicatat ke Buku Kas" : ""}.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal menandai lunas", { description: errMsg(err) }),
      );
  };

  /** Generator tagihan bulanan — pindai kamar terisi, terbitkan draft baru */
  const handleGenerateInvoices = async (periodKey: string) => {
    try {
      const res = await api.generateInvoices(periodKey);
      if (res.created.length > 0) {
        updateInvoices((prev) => [...res.created, ...prev]);
        await refreshDashboard(); // sinkronkan pill status kamar dari server
        toast.success(
          `${res.created.length} tagihan dibuat untuk ${periodKey.replace("-", " ")}`,
          {
            description: `${res.scanned} kamar terisi dipindai · ${res.skipped} sudah ditagih sebelumnya (anti-duplikat) · tersimpan ke cloud.`,
          },
        );
      } else {
        toast.info(`Semua tagihan sudah terbit`, {
          description: `${res.scanned} kamar terisi dipindai — tidak ada tagihan baru untuk periode ini.`,
        });
      }
    } catch (err: unknown) {
      toast.error("Generator tagihan gagal", { description: errMsg(err) });
    }
  };

  /** "Simpan & Siap Ditagih" — perbarui rincian add-on invoice */
  const handleUpdateInvoiceLines = (inv: Invoice, lines: InvoiceLine[]) => {
    api
      .updateInvoiceLines(inv.id, lines)
      .then(({ invoice }) => {
        updateInvoices((prev) => prev.map((i) => (i.id === invoice.id ? invoice : i)));
        toast.success(`Rincian ${invoice.id} disimpan — siap ditagih`, {
          description: `Kamar ${invoice.roomId} · total ${formatIDR(invoice.total)} (${invoice.lines.length} baris biaya).`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal menyimpan rincian tagihan", { description: errMsg(err) }),
      );
  };

  /** Konteks pesan WA: nama properti + rekening cloud + link portal penyewa.
   *  qrisAvailable = QRIS statis terunggah → pesan menyebut opsi QRIS. */
  const waBillingContext = (inv: Invoice): WaBillingContext => {
    const origin = typeof window === "undefined" ? undefined : window.location.origin;
    const token = rooms.find((r) => r.id === inv.roomId)?.tenant?.portalToken;
    return {
      propertyName: property,
      bank: {
        bank: settings.rekening.bank,
        number: settings.rekening.noRek,
        holder: settings.rekening.atasNama,
      },
      portalUrl: token ? portalLink(token, origin) : `${origin ?? "https://unitku.id"}/portal`,
      qrisAvailable: !!settings.rekening.qrisImageUrl,
    };
  };

  /** Buka WhatsApp dgn pesan terkode — shared utk tagihan & kwitansi lunas */
  const openWaFor = (inv: Invoice, message: string, label: string) => {
    const digits = (inv.tenantPhone ?? "").replace(/[^0-9]/g, "");
    if (!digits) {
      toast.error("Nomor WhatsApp penyewa belum tersedia", {
        description: `Kamar ${inv.roomId} — lengkapi No. WhatsApp penghuni terlebih dahulu.`,
      });
      return;
    }
    const waUrl = `${waLink(digits)}?text=${encodeURIComponent(message)}`;
    const opened = window.open(waUrl, "_blank", "noopener,noreferrer");
    if (opened) {
      toast.success(`${label} — Kamar ${inv.roomId}`, {
        description: `${inv.tenantName ?? "Penyewa"} · ${formatIDR(inv.total)} → draf WhatsApp terbuka.`,
      });
    } else {
      toast.warning("Browser memblokir pop-up WhatsApp", {
        description: "Izinkan pop-up untuk situs ini, lalu tekan tombol sekali lagi.",
      });
    }
  };

  /** Tombol hijau "Tagih via WhatsApp" — wa.me dgn template tagihan rapi */
  const handleTagihWa = (inv: Invoice) => {
    openWaFor(inv, buildBillingWaMessage(inv, waBillingContext(inv)), "Draf tagihan dibuka");
  };

  /** "Kirim Kwitansi Lunas via WA" — konfirmasi pembayaran diterima */
  const handleReceiptWa = (inv: Invoice) => {
    openWaFor(inv, buildReceiptWaMessage(inv, waBillingContext(inv)), "Kwitansi lunas dibuka");
  };

  const handleInvoiceCancel = (inv: Invoice) => {
    updateInvoices((prev) => prev.filter((i) => i.id !== inv.id));
    toast.warning(`Tagihan ${inv.id} dibatalkan`, {
      description: `Kamar ${inv.roomId} · ${formatIDR(inv.total)} dihapus dari daftar.`,
    });
    api.cancelInvoice(inv.id).catch((err: unknown) => {
      toast.error("Gagal membatalkan tagihan di database", { description: errMsg(err) });
      void refreshDashboard();
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
    api
      .checkinTenant({
        roomId: p.roomId,
        name: p.nama,
        phone: p.phone,
        emergencyName: p.emergencyName,
        emergencyPhone: p.emergencyPhone,
        tanggalMasuk: p.tanggalMasuk,
        siklus: p.siklus,
        hargaSewa: p.hargaSewa,
        deposit: p.deposit,
        addons: p.addons,
        totalPerBulan: p.totalPerBulan,
      })
      .then(({ room, invoice }) => {
        updateRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
        updateInvoices((prev) => [invoice, ...prev]);
        const addons = p.addons.length > 0 ? ` · Add-on: ${p.addons.join(", ")}` : "";
        toast.success(`${p.nama} check-in ke Kamar ${p.roomId}`, {
          description: `${formatIDR(p.totalPerBulan)}/bln · deposit ${formatIDR(p.deposit)} ditahan · kontrak hingga ${
            room.contract?.endDate ?? moveInLabel
          }${addons} · tersimpan ke cloud.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Check-in gagal diproses", { description: errMsg(err) }),
      );
  };

  // ── Data Penghuni: perpanjang & check-out ──────────────────────────────────

  const handleRenew = (room: Room, newEndDate: string, months: number) => {
    api
      .renewTenant(room.id, newEndDate)
      .then(({ room: updated }) => {
        updateRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        toast.success(`Kontrak Kamar ${room.id} diperpanjang +${months} bulan`, {
          description: `${room.tenant?.name} · kontrak berakhir ${newEndDate}. Pengingat otomatis H-14 via WA.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal memperpanjang kontrak", { description: errMsg(err) }),
      );
  };

  const handleCheckout = (room: Room, payload: CheckoutPayload) => {
    if (!room.tenant) return;
    const dateLabel = formatDateLabel(payload.tanggal);
    const tenantName = room.tenant.name;

    api
      .checkoutTenant(room.id)
      .then(({ room: updated }) => {
        updateRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

        if (payload.refund > 0) {
          api
            .addCash({
              type: "keluar",
              category: "Refund Deposit",
              description: `Refund deposit — ${tenantName} (Kamar ${room.id}) · ${payload.alasan}`,
              amount: payload.refund,
              dateLabel,
            })
            .then(({ entry }) => updateCashEntries((prev) => [entry, ...prev]))
            .catch((err: unknown) =>
              toast.error("Refund gagal dicatat ke Buku Kas", { description: errMsg(err) }),
            );
        }

        toast.success(`Check-out Kamar ${room.id} diproses`, {
          description:
            payload.refund > 0
              ? `${tenantName} keluar (${payload.alasan}) · refund ${formatIDR(payload.refund)} tercatat di Buku Kas.`
              : `${tenantName} keluar (${payload.alasan}) · tanpa refund deposit.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Check-out gagal diproses", { description: errMsg(err) }),
      );
  };

  // ── Buku Kas ───────────────────────────────────────────────────────────────

  const handleAddExpense = (draft: ExpenseDraft) => {
    const dateLabel = formatDateLabel(draft.tanggal);
    api
      .addCash({
        type: "keluar",
        category: draft.category,
        description: draft.description,
        amount: draft.amount,
        dateLabel,
        source: draft.source,
        attachment: draft.attachment,
      })
      .then(({ entry }) => {
        updateCashEntries((prev) => [entry, ...prev]);
        toast.success(`Pengeluaran ${formatIDR(draft.amount)} tercatat`, {
          description: `${draft.category} · ${draft.description} · ${dateLabel} · tersimpan ke cloud.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal mencatat pengeluaran", { description: errMsg(err) }),
      );
  };

  /** Pemasukan manual (modal "+ Tambah Pemasukan") — type masuk langsung ke Buku Kas */
  const handleAddIncome = (draft: IncomeDraft) => {
    const dateLabel = formatDateLabel(draft.tanggal);
    api
      .addCash({
        type: "masuk",
        category: draft.category,
        description: draft.description,
        amount: draft.amount,
        dateLabel,
        source: draft.source,
      })
      .then(({ entry }) => {
        updateCashEntries((prev) => [entry, ...prev]);
        toast.success(`Pemasukan ${formatIDR(draft.amount)} tercatat`, {
          description: `${draft.category} · ${draft.description} · ${dateLabel} · tersimpan ke cloud.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal mencatat pemasukan", { description: errMsg(err) }),
      );
  };

  /** Edit pengeluaran manual — perubahan langsung tersinkron ke database */
  const handleUpdateExpense = (entry: CashEntry, draft: ExpenseDraft) => {
    const dateLabel = formatDateLabel(draft.tanggal);
    api
      .updateCash(entry.id, {
        category: draft.category,
        description: draft.description,
        amount: draft.amount,
        dateLabel,
        source: draft.source,
        attachment: draft.attachment ?? null,
      })
      .then(({ entry: updated }) => {
        updateCashEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
        toast.success(`Pengeluaran ${updated.id} diperbarui`, {
          description: `${draft.category} · ${formatIDR(draft.amount)} · ${dateLabel}.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal memperbarui pengeluaran", { description: errMsg(err) }),
      );
  };

  const handleDeleteEntry = (entry: CashEntry) => {
    updateCashEntries((prev) => prev.filter((e) => e.id !== entry.id));
    toast.success(`Transaksi ${entry.id} dihapus`, {
      description: `${entry.description} · ${formatIDR(entry.amount)} dikeluarkan dari rekap.`,
    });
    api.deleteCash(entry.id).catch((err: unknown) => {
      toast.error("Gagal menghapus transaksi di database", { description: errMsg(err) });
      void refreshDashboard();
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

  /** Ganti foto fasad langsung dari banner Denah — tersimpan ke database */
  const handleGantiFotoProperti = (file: File) => {
    fileToPhotoDataUrl(file)
      .then((url) => {
        updateSettings({ propertyProfile: { ...settings.propertyProfile, fotoUrl: url } });
        api
          .updateProperty({ fotoUrl: url })
          .then(() => {
            toast.success("Foto properti diperbarui", {
              description: "Banner identitas & modul Pengaturan ikut berganti — tersimpan ke cloud.",
            });
          })
          .catch((err: unknown) =>
            toast.error("Foto tampil lokal, gagal tersimpan ke database", {
              description: errMsg(err),
            }),
          );
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Gagal memuat foto");
      });
  };

  /** Sinkronkan profil properti & rekening (Pengaturan) ke database via PUT /api/properties */
  const handleSyncPropertyToDb = useCallback(
    (patch: { propertyProfile?: PropertyProfile; rekening?: RekeningConfig }) => {
      const payload: Record<string, string | null> = {};
      if (patch.propertyProfile) {
        payload.name = patch.propertyProfile.nama;
        payload.tipe = patch.propertyProfile.tipe;
        payload.alamat = patch.propertyProfile.alamat;
        if (patch.propertyProfile.fotoUrl) payload.fotoUrl = patch.propertyProfile.fotoUrl;
      }
      if (patch.rekening) {
        payload.bankName = patch.rekening.bank;
        payload.bankAccountNo = patch.rekening.noRek;
        payload.bankAccountName = patch.rekening.atasNama;
        // QRIS statis — undefined di-drop JSON, string/null dikirim apa adanya
        payload.qrisImageUrl = patch.rekening.qrisImageUrl ?? null;
        payload.qrisNmid = patch.rekening.qrisNmid ?? null;
      }
      api
        .updateProperty(payload)
        .then((res) => {
          toast.success("Tersinkron ke database", {
            description: `Profil "${res.property.name}" tersimpan di Supabase — ikut tampil di semua perangkat.`,
          });
        })
        .catch((err: unknown) =>
          toast.error("Gagal sinkron profil ke database", { description: errMsg(err) }),
        );
    },
    [],
  );

  const handleApplyTariff = (changes: { type: string; price: number }[]) => {
    updateRooms((prev) =>
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
    // Bulk patch ke database (tarif massal per tipe kamar)
    const targets = rooms.filter((r) => changes.some((c) => c.type === r.type));
    if (targets.length === 0) return;
    api
      .patchRoomsBulk(
        targets.map((r) => ({
          id: r.id,
          patch: { price: changes.find((c) => c.type === r.type)!.price },
        })),
      )
      .catch((err: unknown) => {
        toast.error("Gagal menyimpan tarif ke database", { description: errMsg(err) });
        void refreshDashboard();
      });
  };

  // ── Manajemen Kamar (CRUD) ────────────────────────────────────────────

  const handleAddRooms = (newRooms: Room[]) => {
    api
      .addRooms(
        newRooms.map((r) => ({
          id: r.id,
          floor: r.floor,
          type: r.type,
          price: r.price,
          facilities: r.facilities,
          operational: r.operational ?? "siap",
        })),
      )
      .then(({ rooms: created }) => {
        updateRooms((prev) => [...prev, ...created]);
        toast.success(`${created.length} kamar baru ditambahkan`, {
          description: `${created.map((r) => r.id).join(", ")} · ${created[0]?.type ?? newRooms[0].type} · ${formatIDR(
            created[0]?.price ?? newRooms[0].price,
          )}/bln · status kosong · tersimpan ke cloud.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal menambah kamar", { description: errMsg(err) }),
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
    updateRooms((prev) =>
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
      updateInvoices((prev) =>
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
    api
      .patchRoom(room.id, {
        id: patch.id,
        floor: patch.floor,
        type: patch.type,
        price: patch.price,
        facilities: patch.facilities,
        operational: patch.operational,
      })
      .catch((err: unknown) => {
        toast.error("Gagal menyimpan perubahan kamar", { description: errMsg(err) });
        void refreshDashboard();
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
    updateRooms((prev) => prev.filter((r) => r.id !== room.id));
    updateInvoices((prev) => prev.filter((i) => i.roomId !== room.id));
    if (selectedRoomId === room.id) setSelectedRoomId(null);
    if (manageRoomId === room.id) setManageRoomId(null);
    toast.success(`Kamar ${room.id} dihapus`, {
      description: `${room.type} (${formatIDR(room.price)}/bln) dikeluarkan dari denah & daftar tagihan di database.`,
    });
    api.deleteRoom(room.id).catch((err: unknown) => {
      toast.error("Gagal menghapus kamar di database", { description: errMsg(err) });
      void refreshDashboard();
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
    setTickets([]);
    setAnnouncements([]);
    setSelectedRoomId(null);
    api
      .resetData("demo")
      .then(() => refreshDashboard())
      .then(() => {
        toast.success("Data demo berhasil dihapus", {
          description: `${removedTenants} penyewa, seluruh invoice & transaksi kas dikosongkan dari database — struktur ${keptRooms} kamar & profil properti dipertahankan.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Reset data gagal", { description: errMsg(err) }),
      );
  };

  const handleFactoryReset = () => {
    const removedRooms = rooms.length;
    updateRooms(() => []);
    updateInvoices(() => []);
    updateCashEntries(() => []);
    setTickets([]);
    setAnnouncements([]);
    setSelectedRoomId(null);
    setView("denah");
    setActiveTab("all");
    setQuery("");
    api
      .resetData("factory")
      .then(() => {
        toast.success("Factory reset selesai", {
          description: `${removedRooms} kamar beserta seluruh data penyewa, tagihan & transaksi dihapus permanen dari database.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Factory reset gagal", { description: errMsg(err) }),
      );
  };

  // ── Maintenance / ticketing (Phase 3) ──────────────────────────────────────

  const handleTicketStatus = (ticket: Ticket, status: TicketStatus) => {
    if (status === ticket.status) return;
    // Optimistic — status baru langsung tampil, database disinkronkan belakangan
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
    api
      .updateTicket(ticket.id, { status })
      .then((res) => {
        // Samakan label selesai dengan kanonik server ("Selesai 29 Sep, 14:05 WIB")
        setTickets((prev) =>
          prev.map((t) => (t.id === res.ticket.id ? { ...t, ...res.ticket } : t))
        );
      })
      .catch((err: unknown) => {
        toast.error("Status tiket gagal tersimpan", { description: errMsg(err) });
        api
          .getTickets()
          .then((res) => setTickets(res.tickets))
          .catch(() => {});
      });
  };

  /** Hapus permanen tiket — optimistic remove (statistik & tab ikut update),
   *  lalu DELETE ke database; gagal → toast error + refetch supaya tetap tampil. */
  const handleDeleteTicket = (ticket: Ticket) => {
    setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
    toast.success(`Tiket ${ticket.id} berhasil dihapus`, {
      description: `${ticketSubject(ticket)} · ${ticket.kategori} — dihapus permanen dari database.`,
    });
    api.deleteTicket(ticket.id).catch((err: unknown) => {
      toast.error("Gagal menghapus tiket di database", { description: errMsg(err) });
      api
        .getTickets()
        .then((res) => setTickets(res.tickets))
        .catch(() => {});
    });
  };

  /** Shared ticket creator (modal owner + portal webhook) — optimistic + POST API.
   *  Tiket tampil instan secara lokal; begitu server merespons, digantikan versi
   *  kanonik database (id #TKT-xxx resmi) agar konsisten lintas perangkat. */
  const insertTicket = (draft: CreateTicketDraft): Ticket => {
    const temp = ticketFromDraft(draft, tickets);
    setTickets((prev) => [temp, ...prev]);
    api
      .createTicket({
        sumber: draft.sumber,
        roomId: draft.roomId,
        lokasi: draft.lokasi,
        reporterName: draft.reporterName,
        reporterPhone: draft.reporterPhone,
        judul: draft.judul,
        kategori: draft.kategori,
        deskripsi: draft.deskripsi,
        urgensi: draft.urgensi,
        photos: draft.photos,
      })
      .then((res) => {
        setTickets((prev) => prev.map((t) => (t.id === temp.id ? res.ticket : t)));
      })
      .catch((err: unknown) => {
        toast.error("Tiket gagal tersimpan ke database", {
          description: `${errMsg(err)} — tiket hanya tampil di perangkat ini.`,
        });
      });
    return temp;
  };

  /** "+ Buat Laporan Komplain / Maintenance" modal → new Menunggu ticket (metrics & badge live) */
  const handleCreateTicket = (draft: CreateTicketDraft): string => {
    const ticket = insertTicket(draft);
    toast.success(`Tiket ${ticket.id} dibuat — status Perlu Ditangani`, {
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

  // ── Gerbang lisensi: akun belum lunas → layar gembok (akses ditahan) ──
  if (licenseGate) {
    return (
      <LicenseGate
        email={licenseGate.email}
        checkoutUrl={licenseGate.checkoutUrl}
      />
    );
  }

  // ── Loading gate: data belum tiba dari database → skeleton layar penuh ──
  if (dbState === "loading") {
    return <DashboardSkeleton />;
  }

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
        rekening={{
          bank: settings.rekening.bank,
          noRek: settings.rekening.noRek,
          atasNama: settings.rekening.atasNama,
          qrisImageUrl: settings.rekening.qrisImageUrl,
          qrisNmid: settings.rekening.qrisNmid,
        }}
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
        ownerName={settings.owner.nama}
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
            {dbState === "offline" && <OfflineBanner onRetry={handleRetrySync} />}
            {view === "tagihan" ? (
              <TagihanView
                invoices={invoices}
                rooms={rooms}
                query={query}
                onQueryChange={setQuery}
                propertyName={property}
                bank={{
                  bank: settings.rekening.bank,
                  number: settings.rekening.noRek,
                  holder: settings.rekening.atasNama,
                }}
                qrisAvailable={!!settings.rekening.qrisImageUrl}
                onGenerate={handleGenerateInvoices}
                onMarkPaid={handleInvoiceMarkPaid}
                onUpdateLines={handleUpdateInvoiceLines}
                onTagihWa={handleTagihWa}
                onReceiptWa={handleReceiptWa}
                onCancelInvoice={handleInvoiceCancel}
              />
            ) : view === "komplain" ? (
              <MaintenancePanel
                tickets={tickets}
                rooms={rooms}
                propertyName={property}
                query={query}
                onQueryChange={setQuery}
                onStatusChange={handleTicketStatus}
                onDeleteTicket={handleDeleteTicket}
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
                onAddIncome={handleAddIncome}
                onUpdateExpense={handleUpdateExpense}
                onDeleteEntry={handleDeleteEntry}
                propertyName={property}
                staffRole={staffSession?.role ?? null}
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
                onSyncProperty={handleSyncPropertyToDb}
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
                      Ringkasan okupansi &amp; status tagihan · data tersimpan di cloud Supabase
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="hidden text-[13px] font-medium text-zinc-700 sm:block">
                      {syncedAt ? `Tersinkron cloud · ${syncedAt}` : "Menyambungkan ke cloud…"}
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

        {/* Banner PWA "Pasang Aplikasi" — bottom sheet ramah jempol, bisa ditutup */}
        <PwaInstallBanner />
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

// ── Skeleton layar penuh saat data dimuat dari Supabase ─────────────────────

function DashboardSkeleton() {
  return (
    <div
      className="flex h-screen flex-col items-center justify-center gap-3 bg-background px-4"
      role="status"
      aria-live="polite"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
        <Building2 className="size-5 animate-pulse" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="flex items-center gap-2 text-[13px] font-semibold text-zinc-800">
        <Loader2 className="size-4 animate-spin text-zinc-500" strokeWidth={2} aria-hidden="true" />
        Menyambungkan ke database…
      </p>
      <p className="text-center text-[12.5px] leading-4 text-zinc-500">
        Memuat kamar, tagihan &amp; buku kas dari Supabase via API.
      </p>
    </div>
  );
}

// ── Banner fallback offline (database tak terjangkau → data demo perangkat) ──

function OfflineBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
      <p className="flex min-w-0 items-center gap-2 text-[12.5px] font-medium leading-4 text-amber-800">
        <CloudOff className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Mode offline — database tidak terjangkau. Menampilkan data demo perangkat; perubahan
        tidak tersimpan ke cloud.
      </p>
      <Button
        variant="outline"
        onClick={onRetry}
        className="h-8 shrink-0 gap-1.5 border-amber-300 bg-white px-2.5 text-[12.5px] font-semibold text-amber-800 shadow-none hover:bg-amber-100"
      >
        <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        Coba Sambungkan Ulang
      </Button>
    </div>
  );
}
