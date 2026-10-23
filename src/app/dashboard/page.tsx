"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "@/lib/toast";
import { api, getAuthMeOnce } from "@/lib/api-client";
import type { PropertySummary } from "@/lib/api-client";
import {
  applyDemoSnapshot,
  getDashboardSnapshot,
  getServerDashboardSnapshot,
  loadDashboard,
  markStalled,
  refreshDashboard,
  reloadDashboardData,
  rescueDemoIfLoading,
  setDashboardPropertyScope,
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
import { CloudOff, Info, Loader2, Plus, RefreshCw, RotateCcw, X } from "lucide-react";
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
import { CloudSyncBadge } from "@/components/kost/cloud-sync-badge";
import { LeadsAlertWatcher } from "@/components/admin/leads-alert-watcher";
import { TopBar } from "@/components/kost/topbar";
import { MobileBottomBar } from "@/components/kost/mobile-bottombar";
import { PwaInstallBanner } from "@/components/kost/pwa-install";
import { DemoConvertBar } from "@/components/landing/demo-convert-bar";
import { MetricStrip } from "@/components/kost/metric-strip";
import { RoomMatrix, type TabValue } from "@/components/kost/room-matrix";
import { RoomDrawer } from "@/components/kost/room-drawer";
import { TagihanView } from "@/components/kost/tagihan-view";
import { MaintenancePanel } from "@/components/kost/maintenance-panel";
import { AnnouncementPanel } from "@/components/kost/announcement-panel";
import { TenantPortal } from "@/components/kost/tenant-portal";
import { LicenseGate } from "@/components/billing/license-gate";
import { BuyCta } from "@/components/landing/buy-cta";
import { PenghuniView } from "@/components/kost/penghuni-view";
import { KasView } from "@/components/kost/kas-view";
import { SettingsView } from "@/components/kost/settings-view";
import { CheckinModal, type CheckinPayload } from "@/components/kost/checkin-modal";
import { RoomAddModal } from "@/components/kost/room-add-modal";
import { RoomManageModal, type RoomPatch } from "@/components/kost/room-manage-modal";
import { AdGeneratorModal } from "@/components/kost/ad-generator-modal";
import type { CheckoutPayload } from "@/components/kost/checkout-dialog";
import type { ExpenseDraft } from "@/components/kost/expense-modal";
import type { IncomeDraft } from "@/components/kost/income-modal";
import type { IssueDraft } from "@/components/kost/report-issue-drawer";
import {
  addMonths,
  diffNights,
  formatDateLabel,
  formatIDR,
  MONTH_NAMES,
  newPortalToken,
  parseIsoDate,
  ROOMS,
  waLink,
  dateToLabel,
  type Room,
} from "@/lib/kost-data";
import {
  INVOICES,
  buildBillingWaMessage,
  buildReceiptWaMessage,
  currentPeriodKey,
  periodLabelFromKey,
  periodShortLabel,
  type Invoice,
  type InvoiceLine,
  type WaBillingContext,
} from "@/lib/kost-invoices";
import { portalLink } from "@/lib/tenant-portal";
import { openExternal } from "@/lib/open-external";
import { dateSortFromLabel, type CashEntry } from "@/lib/kost-cashflow";
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
  announcementTargetLabel,
  periodeLabel,
  targetLabel,
  type Announcement,
  type AnnouncementDraft,
} from "@/lib/announcement-data";
import { savePortalMirror } from "@/lib/portal-mirror";
import { PropertyBanner } from "@/components/kost/property-banner";
import {
  KasSkeleton,
  MetricStripSkeleton,
  PortalSkeleton,
  RoomMatrixSkeleton,
  RowsSkeleton,
  TagihanSkeleton,
} from "@/components/kost/dashboard-skeletons";
import {
  commitSettingsToCloud,
  DEFAULT_SETTINGS,
  fileToPhotoDataUrl,
  isSettingsCloudSyncEnabled,
  nextSettingsId,
  PROPERTY_TYPE_META,
  applyRemoteSettings,
  pauseCloudSync,
  setSettingsCloudSync,
  getServerSettingsSnapshot,
  getSettingsSnapshot,
  subscribeSettings,
  updateStoredSettings,
  type IndoKostSettings,
  type PropertyEntry,
  type PropertyProfile,
  type ThemeKey,
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

/** Harga add-on check-in (demo) — cermin daftar ADDONS di checkin-modal agar
 *  rincian invoice lokal selalu sama dengan total yang dijanjikan modal. */
const DEMO_ADDON_PRICE: Record<string, number> = {
  "Parkir Motor": 50_000,
  "Parkir Mobil": 150_000,
  "Orang Kedua": 200_000,
};

// ── Properti aktif multi-cabang (Task 124) ───────────────────────────────────
// Pilihan cabang dipersist di localStorage agar login berikutnya langsung ke
// properti yang sama. Default cerdas: properti TERSIMPAN (valid) → default
// server (utamakan "kgp" berdata) → "kgp" → kamar terbanyak.

const ACTIVE_PROPERTY_KEY = "unitku_active_property";

function readStoredActivePropertyId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_PROPERTY_KEY);
  } catch {
    return null;
  }
}

function writeStoredActivePropertyId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_PROPERTY_KEY, id);
    else window.localStorage.removeItem(ACTIVE_PROPERTY_KEY);
  } catch {
    /* kuota penuh / private mode — pilihan tak persist, biarkan */
  }
}

/** Pilih properti aktif dari daftar DATABASE (pure): pilihan tersimpan →
 *  default server → utamakan id "kgp" → kamar terbanyak. null bila daftar kosong. */
function chooseActivePropertyId(
  list: PropertySummary[],
  storedId: string | null,
  serverActiveId: string | null | undefined,
): PropertySummary | null {
  if (list.length === 0) return null;
  if (storedId) {
    const hit = list.find((p) => p.id === storedId);
    if (hit) return hit;
  }
  if (serverActiveId) {
    const hit = list.find((p) => p.id === serverActiveId);
    if (hit) return hit;
  }
  const kgp = list.find((p) => p.id === "kgp");
  if (kgp) return kgp;
  return [...list].sort((a, b) => b.roomCount - a.roomCount)[0] ?? null;
}

export default function IndoKostPage() {
  // ── Sesi demo interaktif (CTA landing "Coba Denah Kost Saya — Gratis") ─────
  // instantDemo: datang dari GET /demo (redirect /dashboard?demo=1) → dataset
  // simulasi 12 kamar dipasang SEKALI di render pertama TANPA panggilan
  // API/Supabase — mode demo tampil < 1 detik dan tidak pernah menunggu DB.
  // DIDEKLARASIKAN PALING AWAL — dipakai initializer mock tiket/pengumuman.
  const [instantDemo] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("demo") === "1",
  );

  // ── Data dari Supabase via Route Handlers (external store — kamar/tagihan/kas)
  const dash = useSyncExternalStore(
    subscribeDashboard,
    getDashboardSnapshot,
    getServerDashboardSnapshot,
  );
  const { rooms, invoices, cashEntries, status: dbState } = dash;
  const [tickets, setTickets] = useState<Ticket[]>(() =>
    // Mock TIDAK PERNAH tampil utk akun riil — hanya sesi demo (?demo=1);
    // akun riil mulai kosong lalu diisi dari database (empty state bila 0).
    instantDemo ? TICKETS : [],
  );
  const [announcements, setAnnouncements] = useState<Announcement[]>(() =>
    instantDemo ? ANNOUNCEMENTS : [],
  );
  const [view, setView] = useState<ViewKey>("denah");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  /** Generator Iklan Sosmed — kamar kosong yang sedang dibuatkan iklan */
  const [adRoomId, setAdRoomId] = useState<string | null>(null);
  // Pengaturan global — sumber kebenaran: localStorage (useSyncExternalStore), persist otomatis
  const settings = useSyncExternalStore(subscribeSettings, getSettingsSnapshot, getServerSettingsSnapshot);
  const [settingsTab, setSettingsTab] = useState("profil-saya");
  const property = settings.propertyProfile.nama;

  // ── Gerbang lisensi (jual putus Mayar) — non-null = tampilkan layar gembok ─
  const [licenseGate, setLicenseGate] = useState<{
    email: string;
    checkoutUrl: string;
  } | null>(null);

  const [isDemoSession, setIsDemoSession] = useState(false);

  // ── Properti aktif multi-cabang (dari tabel properties via /api/properties) ─
  const [dbProperties, setDbProperties] = useState<PropertySummary[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  /** Properti terpilih terakhir — dibaca ulang setelah applyRemoteSettings agar
   *  sinkron cloud tidak menghidupkan kembali profil properti lama. */
  const chosenPropertyRef = useRef<PropertySummary | null>(null);

  /** Aktifkan dataset simulasi utk sesi demo — dipanggil saat sesi demo
   *  terkonfirmasi (?demo=1 atau /api/auth/me → demo:true). Mock HANYA
   *  boleh tampil di mode demo; akun riil tidak pernah melewati ini.
   *  rescue=true → snapshot hanya dipasang bila bootstrap masih loading
   *  (tidak menimpa data yang sudah hidup). */
  const activateDemoDataset = useCallback((rescue = false) => {
    setIsDemoSession(true);
    if (rescue) rescueDemoIfLoading();
    else applyDemoSnapshot();
    setTickets(TICKETS);
    setAnnouncements(ANNOUNCEMENTS);
  }, []);

  /** Reset Data Demo — dataset simulasi kembali persis ke kondisi awal.
   *  Murni in-memory (instan, tanpa API): data demo tidak pernah bergantung DB. */
  const handleResetDemo = useCallback(() => {
    applyDemoSnapshot();
    // Modul lokal (tiket & pengumuman) kembali ke dataset awal juga
    setTickets(TICKETS);
    setAnnouncements(ANNOUNCEMENTS);
    setSelectedRoomId(null);
    setAdRoomId(null);
    toast.success("Data demo berhasil direset", {
      description:
        "Seluruh data simulasi kembali ke kondisi awal — 12 kamar, penghuni, tagihan, buku kas & komplain.",
    });
  }, []);

  // ── Sesi staf mandiri (/staff?token=…) — null = akses owner penuh ──
  const staffSession = useSyncExternalStore(
    subscribeStaffSession,
    getStaffSessionSnapshot,
    getServerStaffSessionSnapshot,
  ) as StaffSession | null;
  const isPenjaga = staffSession?.role === "PENJAGA_TEKNISI";
  /** Owner & Admin Operasional boleh mengubah data; Penjaga hanya melihat */
  const canManageRooms = !staffSession || staffSession.role === "ADMIN_OPERASIONAL";

  // ── Notifikasi pendaftar baru (Super Admin saja) ──
  /** Sesi Super Admin? (dari /api/auth/me) — mengaktifkan watcher realtime,
   *  badge merah nav & PWA app badge. Sesi demo/staf tidak pernah true. */
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

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

  const adRoom = useMemo(
    () => rooms.find((r) => r.id === adRoomId) ?? null,
    [rooms, adRoomId]
  );

  // ── Pengaturan: persist ke localStorage + tema global ────────────────────
  const updateSettings = useCallback((patch: Partial<IndoKostSettings> | ((s: IndoKostSettings) => Partial<IndoKostSettings>)) => {
    updateStoredSettings(patch);
  }, []);

  /** Simpan daftar properti DATABASE + tetapkan properti aktif (localStorage →
   *  default server "utamakan kgp" → kamar terbanyak) dan set scope fetch
   *  dashboard (kamar/tagihan/kas) ke propertyId terpilih. Dipakai bootstrap,
   *  sinkron profil & refresh manual — idempoten, hasil murni dari input. */
  const applyPropertyList = useCallback(
    (list: PropertySummary[], serverActiveId: string | null | undefined) => {
      setDbProperties(list);
      const stored = readStoredActivePropertyId();
      const chosen = chooseActivePropertyId(list, stored, serverActiveId);
      chosenPropertyRef.current = chosen;
      const scopeId = chosen?.id ?? null;
      if (scopeId !== stored) writeStoredActivePropertyId(scopeId);
      setActivePropertyId(scopeId);
      setDashboardPropertyScope(scopeId);
      return chosen;
    },
    [],
  );

  /** Terapkan identitas properti TERPILIH ke profil & rekening — dipanggil
   *  setelah applyRemoteSettings agar nilai cloud basi (mis. nama properti
   *  lama hasil default salah) tidak menimpa cabang yang sedang dikelola. */
  const applyChosenPropertyToSettings = useCallback(() => {
    const chosen = chosenPropertyRef.current;
    if (!chosen) return;
    pauseCloudSync(() =>
      updateStoredSettings((s) => ({
        propertyProfile: {
          ...s.propertyProfile,
          nama: chosen.name,
          tipe: (chosen.tipe in PROPERTY_TYPE_META
            ? chosen.tipe
            : s.propertyProfile.tipe) as PropertyProfile["tipe"],
          alamat: chosen.alamat || s.propertyProfile.alamat,
          fotoUrl: chosen.fotoUrl ?? s.propertyProfile.fotoUrl,
        },
        rekening: {
          bank: chosen.bankName ?? s.rekening.bank,
          noRek: chosen.bankAccountNo ?? s.rekening.noRek,
          atasNama: chosen.bankAccountName ?? s.rekening.atasNama,
          qrisImageUrl: chosen.qrisImageUrl ?? s.rekening.qrisImageUrl,
          qrisNmid: chosen.qrisNmid ?? s.rekening.qrisNmid,
        },
      })),
    );
  }, []);

  useEffect(() => {
    document.documentElement.dataset.ikTheme = settings.theme;
  }, [settings.theme]);


  // ── Bootstrap data dashboard ────────────────────────────────────────────────
  // MODE DEMO (?demo=1 dari GET /demo): pasang dataset simulasi 12 kamar
  // SEKALI jalan TANPA memanggil API/Supabase sama sekali — tidak ada loading,
  // tidak pernah "0 Kamar", tidak pernah skeleton menunggu database.
  //
  // AKUN ASLI: cek properti dulu (belum onboarding → langsung wizard
  // /onboarding, bukan error), lalu muat kamar/tagihan/kas DI LATAR BELAKANG —
  // shell dashboard tampil instan, hanya kartu data memakai skeleton shimmer.
  // Seluruh alur memakai try-catch-finally + fetch ber-timeout + watchdog 5 dtk
  // — apa pun yang terjadi (sukses, data kosong, error, database menggantung),
  // skeleton SELALU selesai dan pengguna tidak pernah menatap placeholder abadi.
  useEffect(() => {
    if (instantDemo) {
      // Sesi demo via URL — dataset simulasi instan (0 panggilan API/DB)
      activateDemoDataset();
      return;
    }

    let alive = true;
    let navigating = false;

    // Watchdog: database tak pernah menjawab dalam 5 detik → lepas ke mode
    // offline (data kosong + banner retry, TANPA dummy utk akun riil) — TIDAK
    // ada loader tak berujung.
    const watchdog = setTimeout(() => {
      if (alive) markStalled();
    }, 5_000);

    const sync = () =>
      loadDashboard().catch((err: unknown) => {
        toast.error("Gagal terhubung database", {
          description:
            err instanceof Error
              ? err.message
              : "Data tidak dimuat dari server — periksa koneksi lalu coba sambungkan ulang.",
        });
      });

    (async () => {
      try {
        const res = await api.getProperty();
        if (!alive) return;
        clearTimeout(watchdog);
        // Daftar properti DATABASE + properti aktif default cerdas (utamakan
        // "kgp" berdata, BUKAN properti kosong hasil onboarding) + scope fetch.
        applyPropertyList(res.properties ?? [], res.property?.id ?? null);
        if (res.property === null) {
          // ANTI PING-PONG: sebelum melempar ke wizard, pastikan ini BUKAN
          // sesi demo — wizard onboarding memantulkan demo balik ke
          // /dashboard?demo=1; tanpa guard ini /onboarding ⇄ /dashboard
          // berputar tanpa ujung (reload abadi). Sesi demo cukup dipasang
          // snapshot simulasi instan di sini.
          try {
            const me = await getAuthMeOnce();
            if (!alive) return;
            if (me.demo) {
              activateDemoDataset(true);
              return;
            }
          } catch {
            return; // sesi tak terkonfirmasi → jangan redirect membuta
          }
          // Akun belum punya properti → wizard onboarding (bukan loader/error)
          navigating = true;
          window.location.replace("/onboarding");
          return;
        }
        await sync();
      } catch {
        // getProperty gagal (database offline) — tidak bisa dibedakan dari
        // "belum onboarding" → lanjutkan alur fallback data perangkat
        if (!alive) return;
        await sync();
      } finally {
        // Jaminan terakhir: status "loading" tidak boleh tersisa apa pun yang
        // terjadi (watchdog sudah dibersihkan; sync selalu menetapkan status).
        clearTimeout(watchdog);
        if (alive && !navigating) markStalled();
      }
    })();

    return () => {
      alive = false;
      clearTimeout(watchdog);
    };
  }, [instantDemo, applyPropertyList]);

  // ── Bootstrap tiket komplain dari database (cloud-first, fallback mock demo)
  // Scoped ?propertyId= — panel Komplain hanya menampilkan tiket milik cabang
  // yang dikelola; otomatis dimuat ulang saat berganti properti di switcher.
  useEffect(() => {
    if (instantDemo) return; // demo: tiket simulasi lokal — tanpa API
    let alive = true;
    api
      .getTickets(activePropertyId)
      .then((res) => {
        if (alive) setTickets(res.tickets);
      })
      .catch(() => {
        /* offline — tetap kosong (bukan mock); banner offline + retry aktif */
      });
    return () => {
      alive = false;
    };
  }, [instantDemo, activePropertyId]);

  // ── Bootstrap PENGUMUMAN dari database (akun riil & sesi demo) ──────────────
  // Dulu pengumuman hanya state lokal perangkat — tidak pernah ikut pindah
  // perangkat dan tak terlihat penyewa di /portal perangkat lain. Kini
  // cloud-first untuk SEMUA sesi (sinkron Portal Penyewa):
  //   • Akun riil : memuat dari tabel announcements milik propertinya;
  //                 gagal → tetap kosong (TIDAK PERNAH mock).
  //   • Sesi demo : memuat dari database (seed + buatan user agar panel =
  //                 portal); gagal (offline/sandbox) → dataset simulasi lokal
  //                 yang sudah terpasang tetap dipakai.
  // Scoped ?propertyId= — panel hanya memuat pengumuman cabang yang dikelola;
  // otomatis dimuat ulang saat berganti properti di switcher.
  useEffect(() => {
    let alive = true;
    api
      .getAnnouncements(instantDemo ? null : activePropertyId)
      .then((res) => {
        if (alive) setAnnouncements(res.announcements);
      })
      .catch((err: unknown) => {
        // Demo: biarkan dataset simulasi lokal (offline tetap hidup).
        // Akun riil: tetap kosong — konsisten dgn prinsip "akun riil tidak
        // pernah melihat data dummy"; banner offline dashboard menandai gagal.
        if (!instantDemo) {
          console.warn(
            "[UnitKu] Pengumuman gagal dimuat dari database:",
            err instanceof Error ? err.message : err,
          );
        }
      });
    return () => {
      alive = false;
    };
  }, [instantDemo, activePropertyId]);

  /** "Hari ini" versi ISO (yyyy-mm-dd) — status tayang pengumuman akun riil
   *  memakai tanggal nyata; sesi demo memakai snapshot dataset (ISO demo). */
  const realTodayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  }, []);
  const announcementTodayISO = instantDemo || isDemoSession ? ANNOUNCEMENT_TODAY_ISO : realTodayISO;

  /** Tombol "Coba Sambungkan Ulang" pada banner offline */
  const handleRetrySync = () => {
    loadDashboard().catch((err: unknown) => {
      toast.error("Gagal terhubung database", {
        description:
          err instanceof Error
            ? err.message
            : "Data tidak dimuat dari server — periksa koneksi lalu coba sambungkan ulang.",
      });
    });
  };

  // ── Paksa Sinkronkan / Muat Ulang (header Denah) ────────────────────────────
  // Tarik ulang SELURUH data dashboard dari Supabase tanpa reload halaman:
  // kamar + tagihan + kas (reloadDashboardData), daftar properti switcher,
  // tiket komplain & pengumuman — semuanya ter-scope properti aktif. Dipakai
  // saat indikator menampilkan "Belum tersinkron (Offline)", setelah gagal
  // validasi, atau sekadar ingin memastikan data terbaru tampil realtime.
  // Sukses → indikator sinkron kembali hijau (operasi cloud terakhir berhasil).
  const [forceSyncing, setForceSyncing] = useState(false);
  const handleForceSync = () => {
    if (instantDemo || isDemoSession) {
      toast.info("Mode demo memakai data simulasi lokal", {
        description:
          "Sesi demo tidak tersambung ke cloud — gunakan Reset Data Demo untuk memulihkan kondisi awal.",
      });
      return;
    }
    if (forceSyncing) return;
    setForceSyncing(true);
    Promise.all([
      reloadDashboardData(),
      api.getProperty().then((res) => {
        applyPropertyList(res.properties ?? [], res.property?.id ?? null);
      }),
      activePropertyId
        ? api.getTickets(activePropertyId).then((res) => setTickets(res.tickets))
        : Promise.resolve(),
      activePropertyId
        ? api.getAnnouncements(activePropertyId).then((res) => setAnnouncements(res.announcements))
        : Promise.resolve(),
    ])
      .then(() => {
        toast.success("Data berhasil dimuat ulang", {
          description:
            "Kamar, tagihan, buku kas, komplain & pengumuman ditarik langsung dari cloud Supabase.",
        });
      })
      .catch((err: unknown) => {
        toast.error("Gagal memuat ulang data", { description: errMsg(err) });
      })
      .finally(() => setForceSyncing(false));
  };

  // ── Guard onboarding + gerbang lisensi (jual putus Mayar) ───────────────────
  // Semua panggilan ber-timeout (api.getAuthMe/getLicense/getProperty) sehingga
  // guard tidak pernah menggantung; kegagalan ditangani try-catch per langkah.
  useEffect(() => {
    if (instantDemo) return; // demo: banner & data mock sudah aktif — tanpa API
    let alive = true;
    (async () => {
      let info: Awaited<ReturnType<typeof api.getAuthMe>> | null = null;
      try {
        info = await getAuthMeOnce(); // cache bersama bootstrap — konsisten & hemat
      } catch {
        return; // /api/auth/me gagal — middleware sudah menangani sesi
      }
      if (!alive || !info?.user) return;
      // Tandai sesi Super Admin — mengaktifkan notifikasi pendaftar baru
      setIsSuperAdmin(info.isSuperAdmin === true);
      // Sesi demo (CTA landing /demo) → tampilkan banner demo interaktif;
      // tanpa gerbang lisensi & tanpa redirect onboarding.
      if (info.demo) {
        // Bila bootstrap masih menggantung (database hang), selamatkan UI
        // dengan data simulasi instan — demo tidak menunggu database.
        activateDemoDataset(true);
        return;
      }
      // Gerbang lisensi dulu: belum lunas → layar gembok (sebelum onboarding)
      try {
        const lic = await api.getLicense();
        if (!alive) return;
        if (lic && lic.licensed === false) {
          setLicenseGate({
            email: info.user?.email ?? "",
            checkoutUrl: typeof lic.checkoutUrl === "string" ? lic.checkoutUrl : "",
          });
          return;
        }
        // API lisensi gagal (offline) → fail-open; lanjut cek properti
      } catch {
        if (!alive) return;
      }
      // Lisensi OK → pastikan properti ada; belum → wizard onboarding
      try {
        const res = await api.getProperty();
        if (alive && res.property === null) {
          window.location.replace("/onboarding");
        }
      } catch {
        /* offline — biarkan mode demo/offline berjalan */
      }
    })();
    return () => {
      alive = false;
    };
  }, [instantDemo]);

  // ── Sinkron profil properti & rekening dari database (cloud = sumber kebenaran)
  useEffect(() => {
    if (instantDemo) return; // demo: profil simulasi lokal — tanpa API
    let alive = true;
    api
      .getProperty()
      .then((res) => {
        if (!alive) return;
        // Daftar & properti TERPILIH (multi-cabang) — konsisten dgn bootstrap;
        // fallback ke res.property bila daftar tak tersedia (API lama/offline).
        const p =
          applyPropertyList(res.properties ?? [], res.property?.id ?? null) ?? res.property;
        // Belum onboarding (properti null) → guard onboarding yang menangani
        if (!p) return;
        // pauseCloudSync: nilai ini BERSUMBER dari server — jangan di-push balik
        pauseCloudSync(() =>
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
          })),
        );
      })
      .catch(() => {
        /* offline — biarkan pengaturan lokal */
      });
    return () => {
      alive = false;
    };
  }, [instantDemo, applyPropertyList]);

  // ── Sinkron PENGATURAN owner dari cloud (Profil Saya, Staf, Template WA,
  // Fasilitas, Tema) — perbaikan data-reset: bagian pengaturan ini dulu HANYA
  // di localStorage, sehingga login dari perangkat lain / clear storage
  // menampilkan data dummy. Sekarang cloud = sumber kebenaran (owner_settings);
  // localStorage tinggal cache instan. Sesi demo tetap murni perangkat.
  useEffect(() => {
    if (instantDemo) {
      setSettingsCloudSync(false); // demo: tidak pernah push ke cloud
      return;
    }
    let alive = true;
    (async () => {
      // Bedakan sesi demo (cookie) vs akun riil SEBELUM menyentuh cache lokal —
      // sesi demo pada perangkat baru memang berbasis dataset default.
      let isDemo = false;
      let sessionEmail = "";
      try {
        const me = await getAuthMeOnce();
        isDemo = me.demo === true;
        sessionEmail = me.user?.email ?? "";
      } catch {
        /* tak terkonfirmasi — perlakukan sebagai akun riil (aman) */
      }
      if (!alive) return;
      if (isDemo) {
        setSettingsCloudSync(false);
        return;
      }

      // ARSITEKTUR DATA (akun riil): bila cache lokal masih persis dataset
      // default (perangkat baru / clear storage), NETRALKAN identitas agar
      // dashboard tidak pernah memamerkan "Kost Griya Pratama · 12 Kamar"
      // seolah-olah itu data owner. Perangkat yang sudah punya data owner asli
      // (cache ≠ default) tidak disentuh. Cloud yang menjawab akan mengisi
      // identitas sebenarnya via applyRemoteSettings.
      pauseCloudSync(() =>
        updateStoredSettings((s) => {
          const untouchedDefaults =
            s.propertyProfile.nama === DEFAULT_SETTINGS.propertyProfile.nama &&
            s.owner.nama === DEFAULT_SETTINGS.owner.nama &&
            s.rekening.noRek === DEFAULT_SETTINGS.rekening.noRek &&
            s.properties.length === DEFAULT_SETTINGS.properties.length &&
            s.properties[0]?.name === DEFAULT_SETTINGS.properties[0]?.name;
          if (!untouchedDefaults) return {};
          return {
            propertyProfile: {
              ...s.propertyProfile,
              nama: "Properti Saya",
              alamat: "",
            },
            owner: { ...s.owner, nama: "Owner" },
            properties: [],
          };
        }),
      );

      try {
        const res = await api.getSettings();
        if (!alive) return;
        // degraded = tabel owner_settings belum dibuat (SQL belum dijalankan)
        // → tetap mode lokal, tanpa error — tabel dibuat otomatis via self-heal
        // di /api/settings (ensureOwnerSettingsTable).
        if (res.demo || !res.settings) {
          setSettingsCloudSync(false);
          return;
        }
        // OVERWRITE CACHE LINTAS AKUN: bila cloud belum menyimpan daftar
        // properti (baris owner_settings masih kosong) dan cache lokal berasal
        // dari akun LAIN di perangkat yang sama (email pemilik cache ≠ email
        // sesi), buang daftar properti/staf/template cache tersebut — cloud
        // WAJIB menimpa cache supaya akun lain tidak melihat data akun lain.
        const cachedEmail = getSettingsSnapshot().owner.email;
        if (
          res.settings.properties == null &&
          cachedEmail &&
          sessionEmail &&
          cachedEmail !== sessionEmail
        ) {
          console.info(
            "[UnitKu] Cache pengaturan lokal milik akun lain — dibuang, menunggu data cloud akun ini.",
          );
          pauseCloudSync(() =>
            updateStoredSettings((s) => ({
              ...s,
              properties: [],
              staff: [],
            })),
          );
        }
        applyRemoteSettings(res.settings); // cloud menang atas cache lokal
        // Profil properti kembali ke cabang TERPILIH — nilai cloud basi (dari
        // sesi lama dgn default salah) tidak boleh menimpa pilihan aktif.
        applyChosenPropertyToSettings();
        setSettingsCloudSync(true); // edit berikutnya otomatis di-push
      } catch (err: unknown) {
        // offline — pengaturan lokal (netral/owner asli) tetap dipakai;
        // banner offline dashboard sudah menandai koneksi bermasalah.
        if (alive) setSettingsCloudSync(false);
        console.warn(
          "[UnitKu] Pengaturan gagal dimuat dari server:",
          err instanceof Error ? err.message : err,
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, [instantDemo, applyChosenPropertyToSettings]);

  // ── Anti-stuck akun baru: bila dashboard jatuh ke mode offline saat mount
  // (getProperty sempat menggantung), verifikasi properti SEKALI database
  // menjawab — akun yang ternyata belum onboarding langsung diarahkan ke
  // wizard, bukan tertahan di data demo perangkat tanpa penjelasan.
  useEffect(() => {
    if (dbState !== "offline" || instantDemo || licenseGate) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      api
        .getProperty()
        .then(async (res) => {
          if (!alive || res.property !== null) return; // properti ada → biarkan banner offline + retry bekerja
          // ANTI PING-PONG: properti null + sesi demo → wizard akan memantul
          // balik ke /dashboard?demo=1 (reload abadi). Cukup aktifkan snapshot
          // demo instan di sini — JANGAN lempar sesi demo ke /onboarding.
          try {
            const me = await getAuthMeOnce();
            if (!alive) return;
            if (me.demo) {
              activateDemoDataset(true);
              return;
            }
          } catch {
            return; // sesi tak terkonfirmasi → jangan redirect membuta
          }
          if (alive) window.location.replace("/onboarding");
        })
        .catch(() => {
          if (alive) timer = setTimeout(check, 8_000); // DB belum menjawab
        });
    };
    check();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [dbState, instantDemo, licenseGate]);

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

  // ── Skeleton in-place: selama sinkron awal berjalan, shell dashboard tetap
  // tampil penuh (sidebar, topbar, banner properti, tab) — hanya kartu data
  // (metrik, denah, tabel) yang memakai placeholder shimmer. Layar penuh tidak
  // pernah diblokir halaman kosong/spinner saat data disinkronkan.
  const isDataLoading = dbState === "loading";

  // ── Mode data lokal: sesi demo (?demo=1 / sesi demo cookie) atau akun riil
  // yang sedang offline (database tak terjangkau → data kosong + banner).
  // Di sesi demo, data di memori adalah dataset simulasi yang TIDAK ada di
  // cloud — mutasi pembayaran wajib murni lokal; memanggil API dulu-lah yang
  // memicu error "Tagihan tidak ditemukan" / 401. Di mode offline akun riil
  // datanya kosong sehingga cabang ini praktis no-op (tidak ada yang bisa
  // dimutasi) — simpan ulang hanya bisa setelah koneksi pulih.

  // ── Pengunjung mode demo (?demo=1 / sesi demo cookie) → target konversi
  // Meta Ads: sticky bottom bar "Beli Lisensi Sekarang" (DemoConvertBar).
  const isDemoVisitor = instantDemo || isDemoSession;

  // ── Ganti tema — SERVER-FIRST utk akun riil (sinkron lintas perangkat) ────
  // Dulu: hanya localStorage + push debounce (1,2 dtk) — tema bisa tertinggal
  // di perangkat saat tab ditutup cepat & tak ada jaminan sampai ke cloud.
  // Kini: PUT /api/settings (commitSettingsToCloud) dikirim DULU; tema baru
  // diterapkan ke seluruh aplikasi hanya setelah server mengonfirmasi. Gagal
  // → tema lama tetap dipakai + toast merah (doktrin cloud-first, tanpa
  // pura-pura sukses). Demo & sesi sebelum bootstrap cloud → lokal instan.
  const handleThemeChange = useCallback(
    (t: ThemeKey) => {
      if (isDemoVisitor || !isSettingsCloudSyncEnabled()) {
        updateSettings({ theme: t }); // demo / staf / bootstrap belum siap → lokal saja
        return;
      }
      void (async () => {
        const ok = await commitSettingsToCloud({ theme: t });
        if (!ok) {
          toast.error("Gagal mengganti tema", {
            description:
              "Tema belum tersimpan ke cloud — periksa koneksi internet lalu coba lagi.",
          });
        }
      })();
    },
    [isDemoVisitor, updateSettings],
  );

  // ── Refresh manual data cloud (tombol ikon di header) ────────────────
  // Tarik ulang SEMUA dataset dari Supabase tanpa reload tab: kamar, tagihan,
  // kas (reloadDashboardData), profil properti & rekening, pengaturan owner
  // (termasuk TEMA — overwrite lintas perangkat), tiket komplain & pengumuman.
  // Feedback: ikon berputar + tombol disabled selama fetch, toast ringkas saat
  // selesai. Demo disembunyikan (sesi demo tidak pernah menyentuh cloud).
  const [refreshingCloud, setRefreshingCloud] = useState(false);

  const handleRefreshCloud = useCallback(async () => {
    if (refreshingCloud || isDemoVisitor) return;
    setRefreshingCloud(true);
    try {
      const [propertyRes, settingsRes, ticketsRes, announcementsRes] = await Promise.all([
        api.getProperty(),
        api.getSettings(),
        api.getTickets(),
        api.getAnnouncements(),
      ]);
      // Daftar properti terbaru + properti TERPILIH (multi-cabang) — scope
      // fetch dashboard diperbarui SEBELUM reload kamar/tagihan/kas.
      const chosen =
        applyPropertyList(propertyRes.properties ?? [], propertyRes.property?.id ?? null) ??
        propertyRes.property;
      await Promise.all([
        reloadDashboardData(), // kamar + tagihan + kas (melempar bila gagal)
        (async () => {
          // Profil properti & rekening cabang TERPILIH — cloud menang atas cache lokal
          const p = chosen;
          if (p) {
            pauseCloudSync(() =>
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
              })),
            );
          }
          // Pengaturan owner (profil, staf, template, fasilitas & TEMA) —
          // applyRemoteSettings menimpa cache localStorage dgn nilai cloud.
          if (!settingsRes.demo && settingsRes.settings) {
            applyRemoteSettings(settingsRes.settings);
            // Profil kembali ke cabang TERPILIH setelah cloud menimpa cache
            applyChosenPropertyToSettings();
          }
        })(),
      ]);
      setTickets(ticketsRes.tickets);
      setAnnouncements(announcementsRes.announcements);
      toast.success("Data cloud berhasil diperbarui!", {
        description:
          "Kamar, tagihan, kas, penghuni, pengumuman & tema ditarik ulang dari Supabase.",
      });
    } catch (err: unknown) {
      toast.error("Gagal memperbarui data cloud", {
        description: errMsg(err),
      });
    } finally {
      setRefreshingCloud(false);
    }
  }, [refreshingCloud, isDemoVisitor, applyPropertyList, applyChosenPropertyToSettings]);

  /** Id unik entri kas lokal (demo/offline) — hindari tabrakan KAS-… */
  const localCashId = () => `KAS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  /** Tandai lunas versi lokal (demo & offline) — instan di memori, tanpa API:
   *  invoice lunas, kartu kamar badge hijau, pemasukan masuk Buku Kas lokal.
   *  Bila tagihan belum ada di state (tanpa stateInv), record invoice periode
   *  terkait langsung dibuat berstatus lunas — persis perilaku auto-create
   *  server, jadi mode demo tidak pernah kehilangan fungsi pembayaran. */
  const markPaidLocal = (roomId: string, stateInv?: Invoice) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) {
      toast.info(`Kamar ${roomId} tidak ada di denah saat ini.`);
      return;
    }
    const now = new Date();
    const todayLabel = dateToLabel(now);
    const periodKey = stateInv?.periodKey ?? currentPeriodKey();
    const inv: Invoice =
      stateInv ?? {
        id: `#INV-${periodKey.replace("-", "")}-${roomId}`,
        roomId,
        tenantName: room.tenant?.name ?? null,
        tenantPhone: room.tenant?.phone ?? null,
        roomType: room.type,
        periodLabel: periodLabelFromKey(periodKey),
        periodKey,
        dueDate: todayLabel,
        lines: [{ label: "Sewa Kamar", amount: room.price }],
        total: room.price,
        status: "lunas",
        paidAt: todayLabel,
      };
    const paidInvoice: Invoice = { ...inv, status: "lunas", paidAt: todayLabel, dayOffset: undefined };
    updateInvoices((prev) =>
      prev.some((i) => i.id === inv.id)
        ? prev.map((i) => (i.id === inv.id ? paidInvoice : i))
        : [paidInvoice, ...prev],
    );
    // Kartu kamar: badge hijau "Lunas" + hilangkan tanda H+n/H-n pada tempo
    updateRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? {
              ...r,
              status: "lunas" as const,
              invoice: r.invoice ? { ...r.invoice, dayOffset: undefined } : r.invoice,
            }
          : r,
      ),
    );
    // Pemasukan sewa tercatat ke Buku Kas (format identik dgn catatan server)
    const entry: CashEntry = {
      id: localCashId(),
      dateLabel: todayLabel,
      dateSort: dateSortFromLabel(todayLabel),
      type: "masuk",
      category: "Sewa Kamar",
      description: `Kamar ${roomId} · ${paidInvoice.tenantName ?? "Penyewa"} — Sewa ${periodShortLabel(paidInvoice.periodKey)}`,
      amount: paidInvoice.total,
    };
    updateCashEntries((prev) => [entry, ...prev]);
    toast.success("Tagihan berhasil ditandai lunas!", {
      description: `Kamar ${roomId} · ${formatIDR(paidInvoice.total)} diterima ${todayLabel} · pemasukan dicatat ke Buku Kas${
        dbState === "offline" && !instantDemo && !isDemoSession
          ? " (lokal — database sedang offline)"
          : " (mode demo)"
      }.`,
    });
  };

  /** Terapkan hasil server: sinkronkan invoice/kamar/Buku Kas dari respons.
   *  Bila server menyelesaikan lewat fallback (id klien basi → tagihan aktif
   *  lain), sisa tagihan belum-lunas kamar yang sama dibersihkan agar denah
   *  tidak menampilkan menunggak palsu. */
  const applyServerPayment = (
    invoice: Invoice,
    room: Room,
    cashEntry: CashEntry | undefined,
    staleInvoiceId: string | undefined,
  ) => {
    updateInvoices((prev) => {
      const replaced = prev.some((i) => i.id === invoice.id)
        ? prev.map((i) => (i.id === invoice.id ? invoice : i))
        : [invoice, ...prev];
      if (staleInvoiceId && staleInvoiceId !== invoice.id) {
        return replaced.filter(
          (i) =>
            !(
              i.roomId === invoice.roomId &&
              i.id !== invoice.id &&
              i.status !== "lunas" &&
              i.status !== "verifikasi"
            ),
        );
      }
      return replaced;
    });
    updateRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
    if (cashEntry) updateCashEntries((prev) => [cashEntry, ...prev]);
  };

  /** Shared payment flip — server ditandai lunas lalu kamar+invoice diperbarui
   *  dari respons. id basi / tanpa tagihan BUKAN kegagalan: server memakai
   *  tagihan aktif kamar atau auto-create invoice periode terkait (lunas). */
  const markRoomPaid = (roomId: string) => {
    const stateInvoice = invoices.find((i) => i.roomId === roomId && i.status !== "lunas");

    // MODE DEMO: manipulasi state lokal — instan, tanpa API. (Akun riil yang
    // database-nya offline TIDAK memanipulasi lokal — biarkan API gagal dengan
    // toast merah agar tidak ada perubahan yang hilang saat reload.)
    if (instantDemo || isDemoSession) {
      markPaidLocal(roomId, stateInvoice);
      return;
    }

    api
      .markInvoicePaid(stateInvoice?.id ?? null, roomId, stateInvoice?.periodKey)
      .then(({ invoice, room, cashEntry, created }) => {
        applyServerPayment(invoice, room, cashEntry, stateInvoice?.id);
        toast.success(`Pembayaran Kamar ${room.id} dicatat lunas`, {
          description: created
            ? `Tagihan periode terkait dibuat otomatis · ${formatIDR(invoice.total)} diterima ${invoice.paidAt ?? "hari ini"}${cashEntry ? " · pemasukan dicatat ke Buku Kas" : ""} · tersimpan ke cloud.`
            : `${room.tenant?.name ?? "Penyewa"} · ${formatIDR(invoice.total)} diterima ${invoice.paidAt ?? "hari ini"}${cashEntry ? " · pemasukan dicatat ke Buku Kas" : ""} · tersimpan ke cloud.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal menandai lunas", { description: errMsg(err) }),
      );
  };

  const handleMarkPaid = (room: Room) => markRoomPaid(room.id);

  /** Tagihan table "Tandai Lunas / Konfirmasi" — server-first dgn fallback
   *  roomId, kamar & Buku Kas ikut disinkronkan; demo/offline murni lokal. */
  const handleInvoiceMarkPaid = (inv: Invoice) => {
    if (instantDemo || isDemoSession) {
      markPaidLocal(inv.roomId, inv);
      return;
    }
    api
      .markInvoicePaid(inv.id, inv.roomId, inv.periodKey)
      .then(({ invoice, room, cashEntry, created }) => {
        applyServerPayment(invoice, room, cashEntry, inv.id);
        toast.success(`Kamar ${inv.roomId} ditandai lunas`, {
          description: created
            ? `${invoice.id} (dibuat otomatis) · ${formatIDR(invoice.total)} diterima ${invoice.paidAt ?? "hari ini"}${cashEntry ? " · pemasukan dicatat ke Buku Kas" : ""}.`
            : `${invoice.id} · ${formatIDR(invoice.total)} diterima ${invoice.paidAt ?? "hari ini"}${cashEntry ? " · pemasukan dicatat ke Buku Kas" : ""}.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal menandai lunas", { description: errMsg(err) }),
      );
  };

  /** Generator tagihan bulanan — pindai kamar terisi, terbitkan draft baru */
  const handleGenerateInvoices = async (periodKey: string) => {
    try {
      const res = await api.generateInvoices(periodKey, activePropertyId);
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

  /** Buka WhatsApp dgn pesan terkode — shared utk tagihan & kwitansi lunas.
   *  Navigasi via anchor sinkron (lihat open-external.ts) — tidak kena
   *  pop-up blocker Chrome/Edge, jadi toast sukses langsung dipicu. */
  const openWaFor = (inv: Invoice, message: string, label: string) => {
    const digits = (inv.tenantPhone ?? "").replace(/[^0-9]/g, "");
    if (!digits) {
      toast.error("Nomor WhatsApp penyewa belum tersedia", {
        description: `Kamar ${inv.roomId} — lengkapi No. WhatsApp penghuni terlebih dahulu.`,
      });
      return;
    }
    const waUrl = `${waLink(digits)}?text=${encodeURIComponent(message)}`;
    openExternal(waUrl);
    toast.success(`${label} — Kamar ${inv.roomId}`, {
      description: `${inv.tenantName ?? "Penyewa"} · ${formatIDR(inv.total)} → draf WhatsApp terbuka.`,
    });
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

  /** Isi placeholder Template WhatsApp: {nama} {kos} {kamar} {nominal} {tempo} {rekening} */
  const fillWaTemplate = (tpl: string, v: Record<string, string>) =>
    tpl
      .replaceAll("{nama}", v.nama)
      .replaceAll("{kos}", v.kos)
      .replaceAll("{kamar}", v.kamar)
      .replaceAll("{nominal}", v.nominal)
      .replaceAll("{tempo}", v.tempo)
      .replaceAll("{rekening}", v.rekening ?? "");

  /** Blok instruksi transfer utk pesan tagihan WA (spec Task 99) — dari
   *  rekening aktif (database properti pada akun riil, dummy state di demo —
   *  keduanya mengalir lewat settings.rekening). Null bila belum lengkap. */
  const rekeningWaBlock = (): string | null => {
    const bank = settings.rekening.bank.trim();
    const noRek = settings.rekening.noRek.trim();
    const atasNama = settings.rekening.atasNama.trim();
    if (!bank || !noRek || !atasNama) return null;
    return `Pembayaran dapat ditransfer melalui:\n🏦 ${bank}: ${noRek} (a.n. ${atasNama})`;
  };

  /** "Kirim Tagihan WA" (panel tagihan RoomDrawer) — BUKA WhatsApp asli:
   *  nomor dibersihkan → wa.me/<digits>?text=<encodeURIComponent(pesan)>;
   *  pesan dari Template WhatsApp (Pengaturan) sesuai status tagihan + blok
   *  rekening pemilik selalu tersisip (template lama tanpa {rekening} pun
   *  tetap mendapatkannya — disisipkan sebelum paragraf penutup).
   *  Dibuka via anchor sinkron (open-external.ts) — imun pop-up blocker. */
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
    const isReceipt = room.status === "lunas";
    const tpl = isReceipt ? settings.templates.lunas : settings.templates.hariH;
    // Kwitansi lunas tidak menyertakan instruksi transfer; tagihan menyertakan.
    const block = isReceipt ? "" : (rekeningWaBlock() ?? "");
    let body = fillWaTemplate(tpl, {
      nama: room.tenant?.name ?? "Penyewa",
      kos: settings.propertyProfile.nama,
      kamar: room.id,
      nominal: formatIDR(amount),
      tempo: (room.invoice?.dueLabel ?? "").replace("Tempo: ", ""),
      rekening: block,
    })
      .replace(/\n{3,}/g, "\n\n") // placeholder kosong tak menyisakan baris kosong beruntun
      .trim();
    // Kompatibilitas template lama/kustom tanpa {rekening}: sisipkan blok
    // sebelum paragraf penutup agar urutan pesan selaras spec (sapaan →
    // rincian → rekening → konfirmasi).
    if (block && !body.includes("Pembayaran dapat ditransfer")) {
      const parts = body.split("\n\n");
      if (parts.length >= 2) parts.splice(parts.length - 1, 0, block);
      else parts.push(block);
      body = parts.join("\n\n");
    }
    const message = [body, BRAND_WA_FOOTER].join("\n\n");
    const waUrl = `${waLink(digits)}?text=${encodeURIComponent(message)}`;
    openExternal(waUrl);
    toast.success(`Draf WhatsApp dibuka — Kamar ${room.id}`, {
      description: `${room.tenant?.name ?? "Penyewa"} · ${formatIDR(amount)} → ${phone}`,
    });
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
    const isHarian = p.siklus === "Harian";
    const nights = isHarian ? diffNights(p.tanggalMasuk, p.tanggalCheckout ?? "") : 0;

    // MODE DEMO: check-in murni di state lokal — replika persis logika server
    // (penghuni + token portal, kontrak & deposit terkunci, invoice pertama
    // berstatus lunas) tanpa menyentuh database, karena sesi demo tidak punya
    // properti terdaftar; POST /api/tenants hanya memicu toast merah 401/403.
    if (instantDemo || isDemoSession) {
      const room = rooms.find((r) => r.id === p.roomId);
      if (!room) {
        toast.info(`Kamar ${p.roomId} tidak ada di denah saat ini.`);
        return;
      }
      if (isHarian && (!p.tanggalCheckout || nights < 1 || !p.totalTagihan)) {
        toast.error("Rentang menginap belum valid", {
          description: "Tanggal check-out harus minimal 1 malam setelah check-in.",
        });
        return;
      }
      const [yy, mm, dd] = p.tanggalMasuk.split("-").map(Number);
      const moveIn = new Date(yy, (mm ?? 1) - 1, dd ?? 1);
      const checkOutLabel = isHarian ? formatDateLabel(p.tanggalCheckout!) : "";
      const months = p.siklus === "Per 3 Bulan" ? 3 : p.siklus === "Tahunan" ? 12 : 1;
      const contractEnd = isHarian
        ? parseIsoDate(p.tanggalCheckout ?? "") ?? moveIn
        : addMonths(moveIn, months);
      const monthName = MONTH_NAMES[moveIn.getMonth()];
      const lastDay = new Date(moveIn.getFullYear(), moveIn.getMonth() + 1, 0).getDate();
      const periodKey = `${moveIn.getFullYear()}-${String(moveIn.getMonth() + 1).padStart(2, "0")}`;
      const phoneDisplay = `+62 ${formatPhone(p.phone.replace(/\D/g, ""))}`;
      const todayLabel = dateToLabel(new Date());
      const invoiceTotal = isHarian ? Math.round(p.totalTagihan ?? 0) : Math.round(p.totalPerBulan);

      const updatedRoom: Room = {
        ...room,
        status: "lunas",
        price: Math.round(isHarian ? p.hargaSewa : p.totalPerBulan),
        tenant: {
          name: p.nama,
          phone: phoneDisplay,
          moveInDate: moveInLabel,
          emergencyContact: {
            name: p.emergencyName.trim() || "—",
            phone: p.emergencyPhone.trim() || "—",
          },
          portalToken: newPortalToken(p.roomId),
        },
        invoice: {
          amount: invoiceTotal,
          periodLabel: isHarian
            ? `Check-in ${moveInLabel} – ${checkOutLabel}`
            : `Sewa ${monthName} ${moveIn.getFullYear()}`,
          dueLabel: `Tempo: ${moveInLabel.replace(/\s\d{4}$/, "")}`,
        },
        contract: {
          duration: p.siklus,
          startDate: moveInLabel,
          endDate: isHarian ? checkOutLabel : dateToLabel(contractEnd),
          deposit: p.deposit,
          depositHeld: true,
        },
      };
      const invoice: Invoice = {
        id: `#INV-${periodKey.replace("-", "")}-${p.roomId}`,
        roomId: p.roomId,
        tenantName: p.nama,
        tenantPhone: phoneDisplay,
        roomType: room.type,
        periodLabel: isHarian
          ? `${moveInLabel} – ${checkOutLabel} (${nights} Malam)`
          : `1 ${monthName} – ${lastDay} ${monthName} ${moveIn.getFullYear()}`,
        periodKey,
        dueDate: moveInLabel,
        lines: isHarian
          ? [{ label: "Sewa Harian", amount: Math.round(p.hargaSewa) }]
          : [
              { label: "Sewa Kamar", amount: Math.round(p.hargaSewa) },
              ...p.addons.map((a) => ({ label: a, amount: DEMO_ADDON_PRICE[a] ?? 0 })),
            ],
        total: invoiceTotal,
        status: "lunas",
        paidAt: todayLabel,
        ...(isHarian
          ? { checkIn: moveInLabel, checkOut: checkOutLabel, nights }
          : {}),
      };
      updateRooms((prev) => prev.map((r) => (r.id === p.roomId ? updatedRoom : r)));
      updateInvoices((prev) =>
        prev.some((i) => i.id === invoice.id)
          ? prev.map((i) => (i.id === invoice.id ? invoice : i))
          : [invoice, ...prev],
      );
      const addons = p.addons.length > 0 ? ` · Add-on: ${p.addons.join(", ")}` : "";
      toast.success(`${p.nama} check-in ke ${isHarian ? "Unit" : "Kamar"} ${p.roomId}`, {
        description: isHarian
          ? `${formatIDR(invoiceTotal)} · ${nights} malam (${formatIDR(p.hargaSewa)}/hari) · check-out ${checkOutLabel} · tersimpan di sesi demo — dapatkan Lisensi Seumur Hidup agar data tersimpan permanen di cloud.`
          : `${formatIDR(p.totalPerBulan)}/bln · deposit ${formatIDR(p.deposit)} ditahan · kontrak hingga ${dateToLabel(contractEnd)}${addons} · tersimpan di sesi demo — dapatkan Lisensi Seumur Hidup agar data tersimpan permanen di cloud.`,
      });
      return;
    }

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
        ...(isHarian
          ? {
              tanggalCheckout: p.tanggalCheckout ?? "",
              durasiHari: nights,
              totalTagihan: p.totalTagihan ?? 0,
            }
          : {}),
      })
      .then(({ room, invoice }) => {
        updateRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
        updateInvoices((prev) => [invoice, ...prev]);
        const addons = p.addons.length > 0 ? ` · Add-on: ${p.addons.join(", ")}` : "";
        toast.success(`${p.nama} check-in ke ${isHarian ? "Unit" : "Kamar"} ${p.roomId}`, {
          description: isHarian
            ? `${formatIDR(p.totalTagihan ?? 0)} · ${nights} malam (${formatIDR(p.hargaSewa)}/hari) · check-out ${p.tanggalCheckout ? formatDateLabel(p.tanggalCheckout) : "—"} · tersimpan ke cloud.`
            : `${formatIDR(p.totalPerBulan)}/bln · deposit ${formatIDR(p.deposit)} ditahan · kontrak hingga ${
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
    // MODE DEMO: perpanjangan kontrak cukup di state lokal — dataset simulasi
    // tidak ada di database; PATCH /api/tenants hanya memicu toast merah.
    if (instantDemo || isDemoSession) {
      updateRooms((prev) =>
        prev.map((r) =>
          r.id === room.id && r.contract
            ? { ...r, contract: { ...r.contract, endDate: newEndDate } }
            : r,
        ),
      );
      toast.success(`Kontrak Kamar ${room.id} diperpanjang +${months} bulan`, {
        description: `${room.tenant?.name} · kontrak berakhir ${newEndDate} · tersimpan di sesi demo — dapatkan Lisensi Seumur Hidup agar data tersimpan permanen di cloud.`,
      });
      return;
    }
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

    // MODE DEMO: check-out murni di state lokal — kamar kembali kosong,
    // penghuni & kontrak dilepas persis perilaku server; refund deposit
    // (bila ada) masuk Buku Kas lokal. Tanpa database di sesi demo.
    if (instantDemo || isDemoSession) {
      updateRooms((prev) =>
        prev.map((r) =>
          r.id === room.id
            ? { ...r, status: "kosong", tenant: undefined, invoice: undefined, contract: undefined }
            : r,
        ),
      );
      if (payload.refund > 0) {
        const entry: CashEntry = {
          id: localCashId(),
          dateLabel,
          dateSort: dateSortFromLabel(dateLabel),
          type: "keluar",
          category: "Refund Deposit",
          description: `Refund deposit — ${tenantName} (Kamar ${room.id}) · ${payload.alasan}`,
          amount: payload.refund,
        };
        updateCashEntries((prev) => [entry, ...prev]);
      }
      toast.success(`Check-out Kamar ${room.id} diproses`, {
        description:
          payload.refund > 0
            ? `${tenantName} keluar (${payload.alasan}) · refund ${formatIDR(payload.refund)} tercatat di Buku Kas · tersimpan di sesi demo.`
            : `${tenantName} keluar (${payload.alasan}) · tanpa refund deposit · tersimpan di sesi demo.`,
      });
      return;
    }

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
              // Isolasi multi-cabang — kas masuk buku cabang yang dikelola
              propertyId: activePropertyId,
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

    // MODE DEMO: catat murni di state lokal — baris baru langsung tampil di
    // Buku Kas (kartu ringkasan ikut terhitung ulang) tanpa memanggil API kas,
    // karena sesi demo tidak pernah menyentuh database.
    if (instantDemo || isDemoSession) {
      const entry: CashEntry = {
        id: localCashId(),
        dateLabel,
        dateSort: dateSortFromLabel(dateLabel),
        type: "keluar",
        category: draft.category,
        description: draft.description,
        amount: draft.amount,
        source: draft.source,
        ...(draft.attachment ? { attachment: draft.attachment } : {}),
      };
      updateCashEntries((prev) => [entry, ...prev]);
      toast.success(`Pengeluaran ${formatIDR(draft.amount)} tercatat`, {
        description: `${draft.category} · ${draft.description} · ${dateLabel} · tersimpan di sesi demo — dapatkan Lisensi Seumur Hidup agar data tersimpan permanen di cloud.`,
      });
      return;
    }

    api
      .addCash({
        type: "keluar",
        category: draft.category,
        description: draft.description,
        amount: draft.amount,
        dateLabel,
        source: draft.source,
        attachment: draft.attachment,
        // Isolasi multi-cabang — kas tercatat milik cabang yang dikelola
        propertyId: activePropertyId,
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

    // MODE DEMO: catat murni di state lokal — instan, tanpa API database.
    if (instantDemo || isDemoSession) {
      const entry: CashEntry = {
        id: localCashId(),
        dateLabel,
        dateSort: dateSortFromLabel(dateLabel),
        type: "masuk",
        category: draft.category,
        description: draft.description,
        amount: draft.amount,
        source: draft.source,
      };
      updateCashEntries((prev) => [entry, ...prev]);
      toast.success(`Pemasukan ${formatIDR(draft.amount)} tercatat`, {
        description: `${draft.category} · ${draft.description} · ${dateLabel} · tersimpan di sesi demo — dapatkan Lisensi Seumur Hidup agar data tersimpan permanen di cloud.`,
      });
      return;
    }

    api
      .addCash({
        type: "masuk",
        category: draft.category,
        description: draft.description,
        amount: draft.amount,
        dateLabel,
        source: draft.source,
        // Isolasi multi-cabang — kas tercatat milik cabang yang dikelola
        propertyId: activePropertyId,
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

  /** Edit pengeluaran manual — perubahan langsung tersinkron ke database.
   *  MODE DEMO: perbarui lokal tanpa API — catatan demo hidup di sesi ini. */
  const handleUpdateExpense = (entry: CashEntry, draft: ExpenseDraft) => {
    const dateLabel = formatDateLabel(draft.tanggal);

    if (instantDemo || isDemoSession) {
      const updated: CashEntry = {
        ...entry,
        category: draft.category,
        description: draft.description,
        amount: draft.amount,
        dateLabel,
        dateSort: dateSortFromLabel(dateLabel),
        source: draft.source,
        attachment: draft.attachment, // undefined = nota dihapus
      };
      updateCashEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
      toast.success(`Pengeluaran ${formatIDR(draft.amount)} diperbarui`, {
        description: `${draft.category} · ${dateLabel} · tersimpan di sesi demo.`,
      });
      return;
    }

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
    // MODE DEMO: tanpa API — catatan demo hidup hanya di sesi ini.
    if (instantDemo || isDemoSession) {
      updateCashEntries((prev) => prev.filter((e) => e.id !== entry.id));
      toast.success(`Transaksi ${entry.id} dihapus`, {
        description: `${entry.description} · ${formatIDR(entry.amount)} dikeluarkan dari rekap (sesi demo).`,
      });
      return;
    }
    // AKUN RIIL — server-first: hapus di database, baru perbarui Buku Kas.
    api.deleteCash(entry.id).then(() => {
      updateCashEntries((prev) => prev.filter((e) => e.id !== entry.id));
      toast.success(`Transaksi ${entry.id} dihapus`, {
        description: `${entry.description} · ${formatIDR(entry.amount)} dihapus permanen dari database.`,
      });
    }).catch((err: unknown) =>
      toast.error("Gagal menyimpan ke server", {
        description: `Transaksi ${entry.id} belum terhapus di database — ${errMsg(err)}`,
      }),
    );
  };

  // ── Pengaturan ─────────────────────────────────────────────────────────────

  /** Daftar properti utk switcher (sidebar & kartu atas) — GABUNGAN tabel
   *  `properties` DATABASE (dgn jumlah kamar riil) + daftar Pengaturan
   *  (owner_settings). Entri Pengaturan yang belum terdaftar di database
   *  tetap tampil — tidak lagi tertimpa seluruhnya oleh daftar DB
   *  (dedupe by id ATAU nama, DB menang utk entri yang sama). */
  const switcherProperties: PropertyEntry[] = useMemo(() => {
    if (dbProperties.length === 0) return settings.properties;
    const fromDb: PropertyEntry[] = dbProperties.map((p) => ({
      id: p.id,
      name: p.name,
      type: (p.tipe in PROPERTY_TYPE_META ? p.tipe : "kost") as PropertyEntry["type"],
      unitCount: p.roomCount,
      address: p.alamat ?? "",
      photoUrl: p.fotoUrl ?? undefined,
    }));
    const extras = settings.properties.filter(
      (s) =>
        !fromDb.some(
          (p) =>
            p.id === s.id ||
            p.name.trim().toLowerCase() === s.name.trim().toLowerCase(),
        ),
    );
    return [...fromDb, ...extras];
  }, [dbProperties, settings.properties]);

  /** switchProperty(newPropertyId) — TERPUSAT: persist pilihan, RESET seluruh
   *  state tampilan (detail kamar terpilih, modal terbuka, filter & pencarian)
   *  supaya tidak ada sisa data properti sebelumnya yang terbawa ke layar, lalu
   *  memuat ulang (re-fetch) data murni milik properti baru: kamar/tagihan/kas
   *  via reloadDashboardData (scope sudah dipindah), tiket & pengumuman otomatis
   *  via effect [activePropertyId]. Tiket & data lama diganti utuh oleh hasil
   *  fetch — tidak pernah tercampur antar cabang. */
  const switchProperty = (entry: PropertyEntry) => {
    const dbBacked = dbProperties.some((p) => p.id === entry.id);
    // Reset state tampilan — penanda kamar, modal & filter tidak boleh
    // membawa data cabang sebelumnya ke layar cabang baru (kamar "101" milik
    // cabang lama tidak boleh menampilkan detail kamar "101" cabang baru).
    setSelectedRoomId(null);
    setAdRoomId(null);
    setManageRoomId(null);
    setConfirmDeleteRoom(null);
    setCheckinOpen(false);
    setActiveTab("all");
    setQuery("");
    if (dbBacked) {
      // Cabang database riil — persist pilihan + muat ulang data scoped
      writeStoredActivePropertyId(entry.id);
      setActivePropertyId(entry.id);
      setDashboardPropertyScope(entry.id);
      toast.info(`Beralih ke ${entry.name}`, {
        description: `${entry.unitCount} ${PROPERTY_TYPE_META[entry.type].unit} · kamar, tagihan & kas cabang ini dimuat dari database.`,
      });
      reloadDashboardData().catch((err: unknown) =>
        toast.error("Gagal memuat data properti", { description: errMsg(err) }),
      );
    } else {
      // Entri hanya ada di daftar Pengaturan (belum jadi properti database /
      // sesi demo) — data kamar cabang ini berupa dataset demo.
      toast.info(`Beralih ke ${entry.name}`, {
        description: `${PROPERTY_TYPE_META[entry.type].label} · data kamar cabang ini berupa dataset demo.`,
      });
    }
  };

  /** Ganti properti aktif (dropdown kartu atas / pemilih sidebar) — sinkronkan
   *  profil & daftar Pengaturan, lalu serahkan ke switchProperty (reset state
   *  tampilan + re-fetch data cabang terpilih). Menerima id ATAU nama
   *  (kompatibel pemanggil lama). */
  const handleSwitchProperty = (idOrName: string) => {
    const entry = switcherProperties.find((p) => p.id === idOrName || p.name === idOrName);
    if (!entry) return;
    updateSettings((s) => ({
      properties: s.properties.some((p) => p.id === entry.id)
        ? s.properties.map((p) => ({ ...p, aktif: p.id === entry.id }))
        : s.properties,
      propertyProfile: {
        ...s.propertyProfile,
        nama: entry.name,
        tipe: entry.type,
        alamat: entry.address || s.propertyProfile.alamat,
        fotoUrl: entry.photoUrl ?? s.propertyProfile.fotoUrl,
      },
    }));
    if (entry.name === property) return;
    switchProperty(entry);
  };

  /** Ganti foto fasad langsung dari banner Denah — tersimpan ke database.
   *  MODE DEMO: foto cukup tampil lokal (sesi demo tidak menyentuh database) */
  const handleGantiFotoProperti = (file: File) => {
    fileToPhotoDataUrl(file)
      .then((url) => {
        // MODE DEMO: foto cukup tampil lokal (sesi demo tidak menyentuh database)
        if (instantDemo || isDemoSession) {
          updateSettings({ propertyProfile: { ...settings.propertyProfile, fotoUrl: url } });
          toast.success("Foto properti diperbarui", {
            description:
              "Perubahan tersimpan di sesi demo! Dapatkan Lisensi Seumur Hidup agar data tersimpan permanen di cloud.",
          });
          return;
        }
        // AKUN RIIL — server-first: unggah ke database dulu; cache lokal & UI
        // hanya diperbarui setelah server mengonfirmasi.
        api
          .updateProperty({ fotoUrl: url })
          .then(() => {
            pauseCloudSync(() =>
              updateStoredSettings((s) => ({
                propertyProfile: { ...s.propertyProfile, fotoUrl: url },
              })),
            );
            toast.success("Foto properti diperbarui", {
              description: "Banner identitas & modul Pengaturan ikut berganti — tersimpan ke cloud.",
            });
          })
          .catch((err: unknown) =>
            toast.error("Gagal menyimpan ke server", {
              description: `Foto belum masuk database — ${errMsg(err)}`,
            }),
          );
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Gagal memuat foto");
      });
  };

  const handleApplyTariff = (changes: { type: string; price: number }[]) => {
    // MODE DEMO: tarif cukup di state lokal — dataset simulasi tidak ada di
    // database; bulk PATCH hanya memicu toast merah.
    if (instantDemo || isDemoSession) {
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
          .concat(" — berlaku untuk tagihan periode berikutnya (sesi demo)."),
      });
      return;
    }

    // AKUN RIIL — server-first: bulk PATCH dulu, TUNGGU respons server.
    const targets = rooms.filter((r) => changes.some((c) => c.type === r.type));
    if (targets.length === 0) return;
    api
      .patchRoomsBulk(
        targets.map((r) => ({
          id: r.id,
          patch: { price: changes.find((c) => c.type === r.type)!.price },
        })),
      )
      .then(({ rooms: updated }) => {
        updateRooms((prev) =>
          prev.map((r) => updated.find((u) => u.id === r.id) ?? r),
        );
        toast.success("Tarif kamar diperbarui", {
          description: changes
            .map((c) => `${c.type}: ${formatIDR(c.price)}/bln`)
            .join(" · ")
            .concat(" — tersimpan ke cloud, berlaku untuk tagihan periode berikutnya."),
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal menyimpan ke server", {
          description: `Tarif belum masuk database — ${errMsg(err)}`,
        }),
      );
  };

  // ── Manajemen Kamar (CRUD) ────────────────────────────────────────────

  const handleAddRooms = (newRooms: Room[]) => {
    // MODE DEMO: kamar baru murni di state lokal — dataset simulasi tidak ada
    // di database, POST /api/rooms hanya memicu toast merah "Properti belum
    // terdaftar". Kotak kamar langsung tampil di denah lantai terpilih dengan
    // status kosong; total kamar & okupansi ikut terhitung ulang otomatis.
    if (instantDemo || isDemoSession) {
      updateRooms((prev) => [...prev, ...newRooms]);
      toast.success(
        newRooms.length === 1
          ? "Kamar baru berhasil ditambahkan ke simulasi denah!"
          : `${newRooms.length} kamar baru berhasil ditambahkan ke simulasi denah!`,
        {
          description: `${newRooms.map((r) => r.id).join(", ")} · ${newRooms[0]?.type ?? "Kamar"} · ${formatIDR(newRooms[0]?.price ?? 0)}/bln · status Kosong — tersimpan di sesi demo; dapatkan Lisensi Seumur Hidup agar data tersimpan permanen di cloud.`,
        },
      );
      return;
    }
    // Identitas properti aktif (id + nama + tipe) — ikut dikirim agar server
    // bisa MEMASTIKAN baris properti ada di tabel `properties` sebelum insert
    // kamar (auto-provision bila belum terdaftar → anti gagal foreign key).
    const activeEntry = dbProperties.find((p) => p.id === activePropertyId) ?? null;
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
        // Kamar baru masuk ke cabang yang SEDANG dikelola (switcher aktif)
        activePropertyId,
        activeEntry?.name ?? settings.propertyProfile.nama,
        activeEntry?.tipe ?? settings.propertyProfile.tipe,
      )
      .then(({ rooms: created, renamed }) => {
        if (created.length === 0) {
          // Server 2xx tanpa satu pun kamar — JANGAN tampil toast sukses palsu
          // "0 kamar baru ditambahkan"; perlakukan sebagai kegagalan simpan.
          toast.error("Kamar belum tersimpan ke cloud", {
            description:
              "Server tidak mengembalikan data kamar — coba ulangi beberapa saat lagi atau gunakan tombol sambungkan ulang di banner atas.",
          });
          return;
        }
        updateRooms((prev) => [...prev, ...created]);
        // Nomor yang diubah otomatis server (dipakai kamar PROPERTI LAIN —
        // tidak memblokir; kamar tetap dibuat dgn varian "A-1 (2)")
        const renameNote = (renamed ?? [])
          .map((r) => `nomor "${r.requested}" dipakai properti lain → disimpan sebagai "${r.stored}"`)
          .join(" · ");
        toast.success(`${created.length} kamar baru ditambahkan`, {
          description: `${created.map((r) => r.id).join(", ")} · ${created[0]?.type ?? newRooms[0].type} · ${formatIDR(
            created[0]?.price ?? newRooms[0].price,
          )}/bln · status kosong · tersimpan ke cloud.${renameNote ? ` Catatan: ${renameNote}.` : ""}`,
        });
        // Sinkronkan daftar properti switcher (jumlah kamar terbaru & baris
        // properti yang baru saja di-provision server) — senyap, non-kritis.
        api
          .getProperty()
          .then((res) => applyPropertyList(res.properties ?? [], res.property?.id ?? null))
          .catch(() => {});
      })
      .catch((err: unknown) =>
        toast.error("Gagal menambah kamar", { description: errMsg(err) }),
      );
  };

  /** Katalog Fasilitas — tambah custom dari modal Tambah Kamar (master katalog
   *  fasilitas tersimpan di cloud owner_settings; demo: lokal murni). */
  const handleAddCustomFacility = (label: string) => {
    const inDemo = instantDemo || isDemoSession;
    const s = getSettingsSnapshot();
    const facilities = {
      ...s.facilities,
      unit: [...s.facilities.unit, { id: nextSettingsId("fac"), label, custom: true }],
    };
    if (inDemo) {
      updateStoredSettings({ facilities });
      toast.success(`Fasilitas "${label}" masuk katalog`, {
        description: "Otomatis terpilih untuk kamar ini & tersedia saat menambah kamar berikutnya (sesi demo).",
      });
      return;
    }
    void commitSettingsToCloud({ facilities }).then((ok) => {
      if (ok) {
        toast.success("Tersimpan ke Cloud", {
          description: `Fasilitas "${label}" masuk katalog — otomatis terpilih untuk kamar ini & tersedia di semua perangkat.`,
        });
      } else {
        toast.error("Gagal menyimpan ke server", {
          description: `Fasilitas "${label}" belum masuk katalog di database — coba simpan ulang di Pengaturan → Katalog Fasilitas.`,
        });
      }
    });
  };

  /** Hapus fasilitas custom dari katalog (salah ketik) — kamar lama tak terpengaruh */
  const handleRemoveCustomFacility = (id: string) => {
    const removed = settings.facilities.unit.find((f) => f.id === id);
    const inDemo = instantDemo || isDemoSession;
    const s = getSettingsSnapshot();
    const facilities = {
      ...s.facilities,
      unit: s.facilities.unit.filter((f) => f.id !== id),
    };
    if (inDemo) {
      updateStoredSettings({ facilities });
      if (removed) {
        toast.info(`Fasilitas "${removed.label}" dihapus dari katalog`, {
          description: "Kamar yang sudah memilikinya tidak berubah (sesi demo).",
        });
      }
      return;
    }
    void commitSettingsToCloud({ facilities }).then((ok) => {
      if (!ok) {
        toast.error("Gagal menyimpan ke server", {
          description: `Fasilitas belum terhapus dari katalog di database — coba ulang dari Pengaturan → Katalog Fasilitas.`,
        });
        return;
      }
      if (removed) {
        toast.success("Tersimpan ke Cloud", {
          description: `Fasilitas "${removed.label}" dihapus dari katalog — kamar yang sudah memilikinya tidak berubah.`,
        });
      }
    });
  };

  const handleUpdateRoom = (room: Room, patch: RoomPatch) => {
    const idChanged = patch.id !== room.id;
    const inDemo = instantDemo || isDemoSession;

    // MODE DEMO: perubahan kamar cukup di state lokal — dataset simulasi tidak
    // ada di database; PATCH /api/rooms hanya memicu toast merah.
    if (inDemo) {
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
          ? `Nomor kamar berubah menjadi "${patch.id}" — tagihan & tiket ikut diperbarui (sesi demo).`
          : `${patch.type} · ${formatIDR(patch.price)}/bln · Lantai ${patch.floor} · tersimpan di sesi demo.`,
      });
      return;
    }

    // AKUN RIIL — server-first: kirim PATCH, TUNGGU respons; state UI & toast
    // hijau hanya setelah server mengonfirmasi. Gagal → TIDAK ada perubahan
    // lokal (tidak ada kesan sukses palsu), hanya toast merah.
    api
      .patchRoom(room.id, {
        id: patch.id,
        floor: patch.floor,
        type: patch.type,
        price: patch.price,
        facilities: patch.facilities,
        operational: patch.operational,
      })
      .then(({ rooms: [updated] }) => {
        if (updated) updateRooms((prev) => prev.map((r) => (r.id === room.id ? updated : r)));
        if (idChanged) {
          // Server meng-cascade perubahan id ke invoice & tiket (FK onUpdate) —
          // state lokal ikut dinomori ulang agar denah konsisten.
          updateInvoices((prev) =>
            prev.map((i) => (i.roomId === room.id ? { ...i, roomId: patch.id } : i))
          );
          setTickets((prev) =>
            prev.map((t) => (t.roomId === room.id ? { ...t, roomId: patch.id } : t))
          );
        }
        toast.success(`Kamar ${patch.id} diperbarui`, {
          description: idChanged
            ? `Nomor kamar berubah menjadi "${patch.id}" — tagihan & tiket ikut diperbarui · tersimpan ke cloud.`
            : `${patch.type} · ${formatIDR(patch.price)}/bln · Lantai ${patch.floor} · tersimpan ke cloud.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal menyimpan ke server", {
          description: `Perubahan Kamar ${room.id} belum masuk database — ${errMsg(err)}`,
        }),
      );
  };

  const handleDeleteRoom = (room: Room) => {
    if (room.tenant && room.status !== "kosong") {
      toast.error("Kamar tidak bisa dihapus", {
        description:
          "Kamar tidak bisa dihapus selama masih ada penghuni aktif. Lakukan check-out terlebih dahulu.",
      });
      return;
    }
    const inDemo = instantDemo || isDemoSession;

    // MODE DEMO: penghapusan kamar cukup di state lokal — dataset simulasi
    // tidak ada di database; DELETE /api/rooms hanya memicu toast merah.
    if (inDemo) {
      updateRooms((prev) => prev.filter((r) => r.id !== room.id));
      updateInvoices((prev) => prev.filter((i) => i.roomId !== room.id));
      if (selectedRoomId === room.id) setSelectedRoomId(null);
      if (manageRoomId === room.id) setManageRoomId(null);
      toast.success(`Kamar ${room.id} dihapus`, {
        description: `${room.type} (${formatIDR(room.price)}/bln) dikeluarkan dari denah & daftar tagihan di sesi demo.`,
      });
      return;
    }

    // AKUN RIIL — server-first: hapus di database dulu, baru perbarui denah.
    api.deleteRoom(room.id).then(() => {
      updateRooms((prev) => prev.filter((r) => r.id !== room.id));
      updateInvoices((prev) => prev.filter((i) => i.roomId !== room.id));
      if (selectedRoomId === room.id) setSelectedRoomId(null);
      if (manageRoomId === room.id) setManageRoomId(null);
      toast.success(`Kamar ${room.id} dihapus`, {
        description: `${room.type} (${formatIDR(room.price)}/bln) dihapus permanen dari database.`,
      });
    }).catch((err: unknown) =>
      toast.error("Gagal menyimpan ke server", {
        description: `Kamar ${room.id} belum terhapus di database — ${errMsg(err)}`,
      }),
    );
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
    api
      // Isolasi multi-cabang: reset HANYA properti aktif yang sedang dikelola —
      // data cabang lain dijamin tidak tersentuh.
      .resetData("demo", activePropertyId)
      .then(() => refreshDashboard())
      .then(() => {
        // Bersihkan state LOKAL hanya setelah server mengonfirmasi
        setTickets([]);
        setAnnouncements([]);
        setSelectedRoomId(null);
        toast.success("Data demo berhasil dihapus", {
          description: `${removedTenants} penyewa, seluruh invoice & transaksi kas dikosongkan dari database — struktur ${keptRooms} kamar & profil properti dipertahankan. Hanya cabang aktif yang terpengaruh.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal menyimpan ke server", {
          description: `Reset data belum diproses database — ${errMsg(err)}`,
        }),
      );
  };

  const handleFactoryReset = () => {
    const removedRooms = rooms.length;
    api
      // Isolasi multi-cabang: factory reset HANYA properti aktif — kamar & data
      // cabang lain tetap utuh di database.
      .resetData("factory", activePropertyId)
      .then(() => {
        // Kosongkan state LOKAL hanya setelah server mengonfirmasi
        updateRooms(() => []);
        updateInvoices(() => []);
        updateCashEntries(() => []);
        setTickets([]);
        setAnnouncements([]);
        setSelectedRoomId(null);
        setView("denah");
        setActiveTab("all");
        setQuery("");
        toast.success("Factory reset selesai", {
          description: `${removedRooms} kamar beserta seluruh data penyewa, tagihan & transaksi CABANG INI dihapus permanen dari database — cabang lain tetap aman.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal menyimpan ke server", {
          description: `Factory reset belum diproses database — ${errMsg(err)}`,
        }),
      );
  };

  // ── Maintenance / ticketing (Phase 3) ──────────────────────────────────────

  const handleTicketStatus = (ticket: Ticket, status: TicketStatus) => {
    if (status === ticket.status) return;

    // MODE DEMO: tiket simulasi lokal — tanpa API (dataset tidak ada di DB).
    if (instantDemo || isDemoSession) {
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
        } (sesi demo).`,
      });
      return;
    }

    // AKUN RIIL — server-first: PATCH dulu, TUNGGU respons server.
    api
      .updateTicket(ticket.id, { status })
      .then((res) => {
        // Samakan label selesai dengan kanonik server ("Selesai 29 Sep, 14:05 WIB")
        setTickets((prev) =>
          prev.map((t) => (t.id === res.ticket.id ? { ...t, ...res.ticket } : t))
        );
        toast.success(`${ticket.id} → ${TICKET_STATUS_META[status].label}`, {
          description: `${ticketSubject(ticket)} · ${ticket.kategori} · urgensi ${
            TICKET_URGENSI_META[ticket.urgensi].label
          } · tersimpan ke cloud.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal menyimpan ke server", {
          description: `Status ${ticket.id} belum masuk database — ${errMsg(err)}`,
        }),
      );
  };

  /** Hapus permanen tiket — server-first: DELETE ke database dulu; baris baru
   *  hilang dari daftar setelah server mengonfirmasi. Demo: lokal murni. */
  const handleDeleteTicket = (ticket: Ticket) => {
    if (instantDemo || isDemoSession) {
      setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
      toast.success(`Tiket ${ticket.id} berhasil dihapus`, {
        description: `${ticketSubject(ticket)} · ${ticket.kategori} — dihapus dari sesi demo.`,
      });
      return;
    }
    api.deleteTicket(ticket.id).then(() => {
      setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
      toast.success(`Tiket ${ticket.id} berhasil dihapus`, {
        description: `${ticketSubject(ticket)} · ${ticket.kategori} — dihapus permanen dari database.`,
      });
    }).catch((err: unknown) =>
      toast.error("Gagal menyimpan ke server", {
        description: `Tiket ${ticket.id} belum terhapus di database — ${errMsg(err)}`,
      }),
    );
  };

  /** Shared ticket creator (modal owner + portal webhook) — baris placeholder
   *  tampil instan (modal & portal butuh id), LALU digantikan versi kanonik
   *  server (id #TKT-xxx resmi). Gagal → placeholder DIBUANG + toast merah
   *  (tidak ada kesan sukses palsu); demo: murni lokal tanpa API. */
  const insertTicket = (draft: CreateTicketDraft): Ticket => {
    const temp = ticketFromDraft(draft, tickets);
    setTickets((prev) => [temp, ...prev]);

    // MODE DEMO: tiket simulasi lokal — tanpa API.
    if (instantDemo || isDemoSession) return temp;

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
        // Isolasi multi-cabang — tiket terikat cabang yang dikelola
        propertyId: activePropertyId,
      })
      .then((res) => {
        setTickets((prev) => prev.map((t) => (t.id === temp.id ? res.ticket : t)));
      })
      .catch((err: unknown) => {
        // Buang placeholder — jangan tampilkan tiket yang gagal tersimpan
        setTickets((prev) => prev.filter((t) => t.id !== temp.id));
        toast.error("Gagal menyimpan ke server", {
          description: `Tiket "${draft.judul}" tidak jadi terbuat di database — ${errMsg(err)}`,
        });
      });
    return temp;
  };

  /** "+ Buat Laporan Komplain / Maintenance" modal → new Menunggu ticket (metrics & badge live) */
  const handleCreateTicket = (draft: CreateTicketDraft): string => {
    const ticket = insertTicket(draft);
    if (instantDemo || isDemoSession) {
      toast.success(`Tiket ${ticket.id} dibuat — status Perlu Ditangani`, {
        description: `${ticket.judul} · ${ticketSubject(ticket)} · urgensi ${
          TICKET_URGENSI_META[ticket.urgensi].label
        }${ticket.photos.length > 0 ? ` · ${ticket.photos.length} foto lampiran` : ""} · tersimpan di sesi demo.`,
      });
    } else {
      toast.success(`Tiket ${ticket.id} dibuat — status Perlu Ditangani`, {
        description: `${ticket.judul} · ${ticketSubject(ticket)} · urgensi ${
          TICKET_URGENSI_META[ticket.urgensi].label
        }${ticket.photos.length > 0 ? ` · ${ticket.photos.length} foto lampiran` : ""} — disinkronkan ke cloud.`,
      });
    }
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
  // SEMUA sesi (demo & akun riil) menulis ke DATABASE (tabel announcements,
  // Supabase) — bukan hanya local state — agar halaman Portal Penyewa
  // /portal?token=… yang membaca database selalu menampilkan pengumuman
  // terbaru (sinkron lintas perangkat, tanpa clear cache):
  //   Akun riil : SERVER-FIRST — TUNGGU respons; gagal → toast merah, TANPA
  //               perubahan lokal (tidak seolah tersimpan padahal tidak).
  //   Sesi demo : SERVER-FIRST juga (dataset simulasi ikut masuk cloud agar
  //               portal demo ?token=… menampilkannya); bila API gagal/offline
  //               → fallback dataset lokal agar demo tetap hidup.

  /** "+ Buat Pengumuman Baru" → tayang di portal sesuai periode & target */
  const handleCreateAnnouncement = (draft: AnnouncementDraft) => {
    // Sesi demo → server-first, fallback lokal bila API tidak terjangkau
    if (instantDemo || isDemoSession) {
      api
        .createAnnouncement(draft, activePropertyId)
        .then((res) => {
          const a = res.announcement;
          setAnnouncements((prev) => [a, ...prev]);
          toast.success(`Pengumuman ${a.id} dipasang di Portal Penyewa`, {
            description: `${a.judul} · ${announcementTargetLabel(a)} · tayang ${periodeLabel(a)} · tersimpan ke database.`,
          });
        })
        .catch(() => {
          // Offline / sesi lokal murni → dataset simulasi (tanpa cloud)
          const a = announcementFromDraft(draft, announcements, announcementTodayISO);
          setAnnouncements((prev) => [a, ...prev]);
          toast.success(`Pengumuman ${a.id} dipasang di Portal Penyewa`, {
            description: `${a.judul} · ${targetLabel(a.targetFloor)} · tayang ${periodeLabel(a)} (mode lokal).`,
          });
        });
      return;
    }

    api
      .createAnnouncement(draft, activePropertyId)
      .then((res) => {
        const a = res.announcement;
        setAnnouncements((prev) => [a, ...prev]);
        toast.success(`Pengumuman ${a.id} dipasang di Portal Penyewa`, {
          description: `${a.judul} · ${targetLabel(a.targetFloor)} · tayang ${periodeLabel(a)} · tersimpan ke cloud.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal menyimpan ke server", {
          description: `Pengumuman "${draft.judul}" belum masuk database — ${errMsg(err)}`,
        }),
      );
  };

  const handleUpdateAnnouncement = (a: Announcement, draft: AnnouncementDraft) => {
    // Sesi demo → update lokal instan + ikutkan ke database (best-effort)
    if (instantDemo || isDemoSession) {
      setAnnouncements((prev) =>
        prev.map((row) => (row.id === a.id ? { ...row, ...draft } : row))
      );
      api.updateAnnouncement(a.id, draft).catch(() => undefined);
      toast.success(`Pengumuman ${a.id} diperbarui`, {
        description: `${draft.judul} · tayang ${periodeLabel({ ...a, ...draft })} (sesi demo).`,
      });
      return;
    }

    api
      .updateAnnouncement(a.id, draft)
      .then((res) => {
        setAnnouncements((prev) =>
          prev.map((row) => (row.id === a.id ? res.announcement : row)),
        );
        toast.success(`Pengumuman ${a.id} diperbarui`, {
          description: `${draft.judul} · tayang ${periodeLabel({ ...a, ...draft })} · tersimpan ke cloud.`,
        });
      })
      .catch((err: unknown) =>
        toast.error("Gagal menyimpan ke server", {
          description: `Perubahan ${a.id} belum masuk database — ${errMsg(err)}`,
        }),
      );
  };

  const handleToggleAnnouncement = (a: Announcement) => {
    // Sesi demo → toggle lokal instan + ikutkan ke database (best-effort)
    if (instantDemo || isDemoSession) {
      setAnnouncements((prev) =>
        prev.map((row) => (row.id === a.id ? { ...row, aktif: !row.aktif } : row))
      );
      api.updateAnnouncement(a.id, { aktif: !a.aktif }).catch(() => undefined);
      toast.success(
        a.aktif ? `Pengumuman ${a.id} dinonaktifkan` : `Pengumuman ${a.id} diaktifkan kembali`,
        {
          description: a.aktif
            ? `"${a.judul}" ditarik dari Portal Penyewa (sesi demo).`
            : `"${a.judul}" kembali tayang sesuai periode & target (sesi demo).`,
        }
      );
      return;
    }

    api
      .updateAnnouncement(a.id, { aktif: !a.aktif })
      .then((res) => {
        setAnnouncements((prev) =>
          prev.map((row) => (row.id === a.id ? res.announcement : row)),
        );
        toast.success(
          a.aktif ? `Pengumuman ${a.id} dinonaktifkan` : `Pengumuman ${a.id} diaktifkan kembali`,
          {
            description: a.aktif
              ? `"${a.judul}" ditarik dari Portal Penyewa · tersimpan ke cloud.`
              : `"${a.judul}" kembali tayang sesuai periode & target lantai · tersimpan ke cloud.`,
          }
        );
      })
      .catch((err: unknown) =>
        toast.error("Gagal menyimpan ke server", {
          description: `Status ${a.id} belum masuk database — ${errMsg(err)}`,
        }),
      );
  };

  const handleDeleteAnnouncement = (a: Announcement) => {
    // Sesi demo → hapus lokal instan + ikutkan ke database (best-effort)
    if (instantDemo || isDemoSession) {
      setAnnouncements((prev) => prev.filter((row) => row.id !== a.id));
      api.deleteAnnouncement(a.id).catch(() => undefined);
      toast.success(`Pengumuman ${a.id} dihapus`, {
        description: `"${a.judul}" dikeluarkan dari riwayat & Portal Penyewa.`,
      });
      return;
    }

    api.deleteAnnouncement(a.id).then(() => {
      setAnnouncements((prev) => prev.filter((row) => row.id !== a.id));
      toast.success(`Pengumuman ${a.id} dihapus`, {
        description: `"${a.judul}" dihapus permanen dari database.`,
      });
    }).catch((err: unknown) =>
      toast.error("Gagal menyimpan ke server", {
        description: `${a.id} belum terhapus di database — ${errMsg(err)}`,
      }),
    );
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

  // ── Portal Penyewa renders standalone (public page, no owner chrome) ──────
  // Skeleton in-place selama sinkron awal — tidak ada layar kosong penuh.
  if (view === "portal") {
    if (isDataLoading) return <PortalSkeleton />;
    return (
      <TenantPortal
        token={portalPreviewToken ?? ""}
        rooms={rooms}
        invoices={invoices}
        announcements={announcements}
        todayISO={announcementTodayISO}
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
        properties={switcherProperties}
        // Jumlah kamar riil properti AKTIF (live dari database, ikut switcher)
        activeRoomCount={rooms.length > 0 ? rooms.length : null}
        onPropertyChange={(id) => {
          handleSwitchProperty(id);
          setMobileOpen(false);
        }}
        invoiceAlerts={invoiceAlerts}
        ticketAlerts={ticketAlerts}
        activeKey={view}
        onNavigate={handleNavigate}
        onOpenDangerZone={handleOpenDangerZone}
        staffSession={staffSession ? { name: staffSession.name, role: staffSession.role } : null}
        onStaffLogout={handleStaffLogout}
        showSyncStatus={!isDemoVisitor}
        showSuperAdminNav={isSuperAdmin && !isDemoVisitor}
        activePropertyType={settings.propertyProfile.tipe}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* TopBar + Sidebar tampil instan — sinkronisasi Supabase berjalan di
            latar belakang tanpa memblokir navigasi */}
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
          propertyType={settings.propertyProfile.tipe}
          theme={settings.theme}
          onThemeChange={handleThemeChange}
          onRefresh={isDemoVisitor ? undefined : () => void handleRefreshCloud()}
          refreshing={refreshingCloud}
        />

        <main
          className="flex-1 overflow-y-auto scrollbar-thin"
          aria-label="Konten utama"
          aria-busy={isDataLoading}
        >
          {/* MODE DEMO (mobile): DemoConvertBar fixed menjorok ±144px ke atas
              area <main> — trailing space diperbesar agar tombol aksi terbawah
              (cth. "Simpan Perubahan" Pengaturan) tetap bisa diklik. */}
          <div
            className={
              isDemoVisitor
                ? "mx-auto max-w-[1440px] space-y-5 px-3.5 py-4 pb-48 sm:pb-4 lg:p-6"
                : "mx-auto max-w-[1440px] space-y-5 px-3.5 py-4 pb-24 sm:pb-4 lg:p-6"
            }
          >
            {isDemoSession && <DemoBanner onReset={handleResetDemo} />}
            {dbState === "offline" && <OfflineBanner onRetry={handleRetrySync} />}
            {view === "tagihan" ? (
              isDataLoading ? (
                <TagihanSkeleton />
              ) : (
              <TagihanView
                invoices={invoices}
                rooms={rooms}
                query={query}
                onQueryChange={setQuery}
                propertyName={property}
                ownerName={settings.owner.nama}
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
              )
            ) : view === "komplain" ? (
              isDataLoading ? (
                <RowsSkeleton rows={5} />
              ) : (
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
              )
            ) : view === "pengumuman" ? (
              isDataLoading ? (
                <RowsSkeleton rows={4} />
              ) : (
              <AnnouncementPanel
                announcements={announcements}
                rooms={rooms}
                query={query}
                onQueryChange={setQuery}
                propertyName={property}
                todayISO={announcementTodayISO}
                onCreate={handleCreateAnnouncement}
                onUpdate={handleUpdateAnnouncement}
                onToggleActive={handleToggleAnnouncement}
                onDelete={handleDeleteAnnouncement}
              />
              )
            ) : view === "penghuni" ? (
              isDataLoading ? (
                <RowsSkeleton rows={6} />
              ) : (
              <PenghuniView
                rooms={rooms}
                invoices={invoices}
                query={query}
                onQueryChange={setQuery}
                onRenew={handleRenew}
                onCheckout={handleCheckout}
                propertyName={property}
                propertyType={settings.propertyProfile.tipe}
              />
              )
            ) : view === "kas" ? (
              isDataLoading ? (
                <KasSkeleton />
              ) : (
              <KasView
                entries={cashEntries}
                onAddExpense={handleAddExpense}
                onAddIncome={handleAddIncome}
                onUpdateExpense={handleUpdateExpense}
                onDeleteEntry={handleDeleteEntry}
                propertyName={property}
                staffRole={staffSession?.role ?? null}
              />
              )
            ) : view === "pengaturan" ? (
              // Pengaturan: data profil tersimpan lokal + cloud — tampil instan
              <SettingsView
                propertyName={property}
                rooms={rooms}
                tab={settingsTab}
                onTabChange={setSettingsTab}
                settings={settings}
                switcherProperties={switcherProperties}
                onSwitchProperty={handleSwitchProperty}
                onUpdateSettings={updateSettings}
                onThemeChange={handleThemeChange}
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
                invoices={invoices}
                cashEntries={cashEntries}
                onRestoreComplete={() => void refreshDashboard()}
                staffSession={
                  staffSession ? { name: staffSession.name, role: staffSession.role } : null
                }
                onStaffLogout={handleStaffLogout}
                isDemoMode={isDemoVisitor}
              />
            ) : (
              <>
                {/* [1] Banner identitas properti — paling atas, tampil INSTAN
                    (profil dari settings lokal + cloud). Jumlah unit memakai
                    placeholder "···" selama sinkron awal agar tidak flashes 0. */}
                <PropertyBanner
                  profile={settings.propertyProfile}
                  unitCount={isDataLoading ? -1 : rooms.length}
                  onGantiFoto={handleGantiFotoProperti}
                  ownerName={staffSession?.name ?? settings.owner.nama}
                  ownerRole={staffSession ? staffRoleLabel(staffSession.role) : "Owner"}
                  properties={switcherProperties}
                  activePropertyId={activePropertyId}
                  onSelectProperty={staffSession ? undefined : handleSwitchProperty}
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
                    {/* Paksa Sinkronkan / Muat Ulang — tarik ulang SELURUH data
                        dari Supabase tanpa reload halaman. Ikon berputar saat
                        berjalan; sukses → indikator sinkron kembali hijau. */}
                    {!isDemoVisitor && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleForceSync}
                        disabled={forceSyncing}
                        aria-label="Paksa Sinkronkan / Muat Ulang"
                        title="Paksa Sinkronkan / Muat Ulang — tarik ulang seluruh data terbaru dari cloud Supabase"
                        className="h-9 w-9 shrink-0 border-zinc-200 bg-white text-zinc-700 shadow-none hover:bg-zinc-100 disabled:opacity-60"
                      >
                        <RefreshCw
                          className={"size-4" + (forceSyncing ? " animate-spin" : "")}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </Button>
                    )}
                    {/* Status sinkron cloud — 3 keadaan jujur: hijau (tersinkron
                        + jam), awan berputar (menyinkronkan), merah (gagal).
                        Demo: teks netral — sesi demo memang tidak ke cloud. */}
                    {isDemoVisitor ? (
                      <p className="hidden text-[13px] font-medium text-zinc-700 sm:block">
                        Mode Demo · data simulasi
                      </p>
                    ) : (
                      <div className="hidden sm:block">
                        <CloudSyncBadge variant="inline" />
                      </div>
                    )}
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

                {/* [3] Kartu metrik ringkasan — skeleton shimmer saat sinkron awal */}
                {isDataLoading ? (
                  <MetricStripSkeleton />
                ) : (
                  <MetricStrip
                    rooms={rooms}
                    unit={PROPERTY_TYPE_META[settings.propertyProfile.tipe].unit}
                  />
                )}

                {/* [4] Denah kamar — shell & tab tetap interaktif; kartu data
                    menyusul otomatis saat fetch Supabase selesai (tanpa blocker) */}
                {isDataLoading ? (
                  <RoomMatrixSkeleton />
                ) : (
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
                    onAdRoom={(room) => setAdRoomId(room.id)}
                    canManage={canManageRooms}
                    propertyType={settings.propertyProfile.tipe}
                    onAddRoom={() => setAddRoomOpen(true)}
                  />
                )}
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
          propertyType={settings.propertyProfile.tipe}
          theme={settings.theme}
          onThemeChange={handleThemeChange}
          onRefresh={isDemoVisitor ? undefined : () => void handleRefreshCloud()}
          refreshing={refreshingCloud}
          showSuperAdminNav={isSuperAdmin && !isDemoVisitor}
        />

        {/* Banner PWA "Pasang Aplikasi" — bottom sheet ramah jempol, bisa ditutup
            ( disembunyikan di mode demo — tak relevan sebelum membeli & mencegah
            tumpang-tindih dengan DemoConvertBar ) */}
        {!isDemoVisitor && <PwaInstallBanner />}

        {/* Watcher notifikasi pendaftar baru — hanya Super Admin; murni efek
            samping (polling+realtime → toast/suara/badge/PWA), merender null */}
        <LeadsAlertWatcher enabled={isSuperAdmin && !isDemoVisitor} />

        {/* Sticky conversion bar mode demo — tombol memicu modal checkout +
            event custom Meta Pixel ClickCTA_Beli (InitiateCheckout baru saat
            form checkout disubmit — lihat buy-cta.tsx) */}
        {isDemoVisitor && <DemoConvertBar />}
        {isDemoVisitor && <div aria-hidden="true" className="h-16" />}
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
        onCreateAd={(room) => setAdRoomId(room.id)}
        propertyName={property}
        canManage={canManageRooms}
        propertyType={settings.propertyProfile.tipe}
      />

      {/* Generator Iklan Kamar Siap Copas ke Sosmed — kamar kosong */}
      <AdGeneratorModal
        room={adRoom}
        open={adRoomId !== null}
        onOpenChange={(o) => {
          if (!o) setAdRoomId(null);
        }}
        propertyName={property}
        ownerWhatsapp={settings.owner.whatsapp}
        facilityCatalog={settings.facilities.unit}
        propertyType={settings.propertyProfile.tipe}
      />

      <CheckinModal
        key={`ck-${checkinOpen ? "open" : "closed"}-${checkinPreselect ?? "none"}`}
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        vacantRooms={vacantRooms}
        preselectRoomId={checkinPreselect}
        onSubmit={handleCheckinSubmit}
        propertyType={settings.propertyProfile.tipe}
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

// ── Banner fallback offline (database tak terjangkau → data kosong, tanpa dummy)

function OfflineBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
      <p className="flex min-w-0 items-start gap-2 text-[12.5px] font-medium leading-4 text-amber-800">
        <CloudOff className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span>
          Mode offline — database tidak terjangkau, data TIDAK dimuat dari server.
          Perangkat ini menampilkan data kosong (bukan data Anda); perubahan apapun
          belum tersimpan ke cloud.
        </span>
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

// ── Banner Mode Demo Interaktif (sesi demo dari CTA landing /demo) ───────────
// Sticky di atas konten main — selalu terlihat pengunjung mencoba demo, dengan
// CTA konversi "Beli Lisensi Rp 399rb" (modal checkout, komponen BuyCta) dan
// tombol kecil "Reset Data Demo" untuk mengembalikan data simulasi ke awal.

function DemoBanner({ onReset }: { onReset: () => void }) {
  const [hidden, setHidden] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  if (hidden) return null;
  return (
    <div
      role="status"
      aria-label="Banner Mode Demo Interaktif"
      className="sticky top-0 z-30 -mx-3.5 -mt-4 border-b border-emerald-200 bg-emerald-50/95 px-3.5 py-2.5 shadow-[0_1px_3px_rgba(5,150,105,0.10)] backdrop-blur lg:-mx-6 lg:px-6"
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex min-w-0 items-start gap-2 text-[12.5px] leading-snug text-emerald-900">
          <Info
            className="mt-0.5 size-4 shrink-0 text-emerald-600"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span>
            <span className="font-bold">Mode Demo Interaktif</span> — Anda sedang mencoba
            fitur UnitKu dengan data simulasi. Bebas klik denah kamar, lihat status sewa,
            dan coba kirim tagihan WhatsApp.
          </span>
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:pl-3">
          <BuyCta
            label="Beli Lisensi Rp 399rb"
            className="h-9 min-h-0 whitespace-nowrap rounded-lg px-3.5 py-0 text-[12.5px] font-bold sm:text-[13px]"
          />
          <Button
            variant="outline"
            onClick={() => setConfirmReset(true)}
            className="h-9 gap-1.5 rounded-lg border-emerald-300 bg-white/70 px-2.5 text-[12px] font-semibold text-emerald-800 shadow-none hover:bg-emerald-100"
          >
            <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            Reset Data Demo
          </Button>
          <button
            type="button"
            onClick={() => setHidden(true)}
            aria-label="Tutup banner demo"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-900"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent className="max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-left text-base font-bold text-zinc-900">
              Reset data demo?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-[13px] leading-relaxed text-zinc-600">
              Seluruh perubahan simulasi (penghuni, tagihan, buku kas, komplain) dihapus
              dan data kembali ke kondisi awal — 12 kamar lengkap dengan penghuni contoh.
              Data asli Anda tidak terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-[13px]">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={onReset}
              className="h-9 bg-orange-600 text-[13px] font-semibold hover:bg-orange-700"
            >
              <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Ya, Reset Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
