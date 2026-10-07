"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "@/lib/toast";
import { BRAND_WA_LINE } from "@/lib/brand";
import { sessionIdentityLabel } from "@/lib/auth/phone-email";
import {
  getLeadsAlertServerSnapshot,
  getLeadsAlertSnapshot,
  subscribeLeadsAlert,
} from "@/lib/leads-alert-store";
import {
  BedDouble,
  Building2,
  Camera,
  Check,
  DatabaseBackup,
  ImagePlus,
  Landmark,
  Layers3,
  Loader2,
  MessageSquareText,
  Palette,
  Pencil,
  Plus,
  QrCode,
  Save,
  ShieldCheck,
  Sofa,
  Trash2,
  TriangleAlert,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatIDR, waLink, type Room } from "@/lib/kost-data";
import type { Invoice } from "@/lib/kost-invoices";
import type { CashEntry } from "@/lib/kost-cashflow";
import { BackupView } from "./backup-view";
import {
  commitSettingsToCloud,
  fileToPhotoDataUrl,
  nextSettingsId,
  PROPERTY_TYPES,
  PROPERTY_TYPE_META,
  THEME_KEYS,
  THEME_META,
  type FacilityCatalog,
  type FacilityItem,
  type IndoKostSettings,
  type PropertyEntry,
  type PropertyProfile,
  type PropertyType,
  type ThemeKey,
} from "@/lib/app-settings";
import { cn } from "@/lib/utils";
import { DangerZone } from "./danger-zone";
import { ChangePasswordCard } from "@/components/kost/change-password-card";
import { WaIcon } from "./wa-icon";
import { StaffAccessManager } from "./staff-access-manager";
import { PwaInstallCard } from "./pwa-install";
import {
  STAFF_ROLE_META as ACCESS_ROLE_META,
  clearStaffSession,
  type StaffAccessRole,
} from "@/lib/staff-access";
import { LogOut } from "lucide-react";
import { getAuthInfo, signOut } from "@/lib/auth/client";

const inputCls =
  "h-9 border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-600 focus-visible:ring-zinc-900/5";

const SAMPLE = {
  nama: "Dimas Ardi",
  kamar: "102",
  nominal: "Rp1.750.000",
  tempo: "28 Sep 2026",
  kos: "Kost Griya Pratama",
  // Blok rekening contoh — tampil di pratinjau Template Hari H (Task 99)
  rekening: "Pembayaran dapat ditransfer melalui:\n🏦 BCA: 1234567890 (a.n. Hendra Wijaya)",
};

const TOKENS = ["{nama}", "{kamar}", "{nominal}", "{tempo}", "{rekening}"] as const;

/** Static facility map per room type (fallback bila kamar belum punya fasilitas) */
const TYPE_FACILITIES: Record<string, string[]> = {
  "Tipe A - AC": ["AC ½ PK", "Kamar Mandi Dalam", "Kasur & Lemari"],
  "Tipe B - Kipas": ["Kipas Angin", "Kamar Mandi Dalam", "Kasur & Lemari"],
  "Tipe AC Deluxe": ["AC Inverter", "Kamar Mandi Dalam", "TV LED", "Meja Kerja"],
};

/* ── Navigasi sub-pengaturan ───────────────────────────────────────────────── */

const NAV: {
  key: string;
  label: string;
  desc: string;
  icon: typeof Building2;
  destructive?: boolean;
}[] = [
  { key: "profil-saya", label: "Profil Saya", desc: "Akun pengelola", icon: UserRound },
  { key: "profil", label: "Profil Properti", desc: "Identitas & aturan", icon: Building2 },
  { key: "properti-list", label: "Daftar & Kelola Properti", desc: "Multi-cabang", icon: Layers3 },
  { key: "staf", label: "Kelola Staf", desc: "Link akses & peran", icon: UsersRound },
  { key: "rekening", label: "Rekening & Pembayaran", desc: "Bank & QRIS", icon: Landmark },
  { key: "template", label: "Template WhatsApp", desc: "Pesan otomatis", icon: MessageSquareText },
  { key: "tarif", label: "Tarif & Tipe Kamar", desc: "Harga & fasilitas", icon: BedDouble },
  { key: "fasilitas", label: "Katalog Fasilitas", desc: "Unit & bersama", icon: Sofa },
  { key: "tema", label: "Tema & Tampilan", desc: "12 tema: solid & karakter", icon: Palette },
  { key: "backup", label: "Cadangan & Keamanan Data", desc: "Export Excel & backup JSON", icon: DatabaseBackup },
  { key: "danger", label: "Zona Berbahaya", desc: "Reset data", icon: TriangleAlert, destructive: true },
];

interface SettingsViewProps {
  propertyName: string;
  rooms: Room[];
  /** Controlled active tab (owner dashboard keeps it across visits) */
  tab: string;
  onTabChange: (tab: string) => void;
  settings: IndoKostSettings;
  onUpdateSettings: (patch: Partial<IndoKostSettings>) => void;
  /** Ganti tema — server-first utk akun riil (Task 109 sinkron lintas
   *  perangkat); bila tidak diberikan, jatuh ke onUpdateSettings lokal. */
  onThemeChange?: (t: ThemeKey) => void;
  /** Sesi staf aktif (dari /staff?token=…) — membatasi tab & menyembunyikan zona sensitif */
  staffSession: { name: string; role: StaffAccessRole } | null;
  onStaffLogout: () => void;
  dangerCounts: {
    rooms: number;
    tenants: number;
    invoices: number;
    cash: number;
    tickets: number;
  };
  onClearDemo: () => void;
  onFactoryReset: () => void;
  onApplyTariff: (changes: { type: string; price: number }[]) => void;
  /** Data cadangan & rekap — kamar, tagihan, dan transaksi kas yang sedang hidup */
  invoices: Invoice[];
  cashEntries: CashEntry[];
  /** Setelah restore sukses — muat ulang data dashboard dari database */
  onRestoreComplete: () => void;
  /** Mode demo (?demo=1 / sesi demo) — toast "Profil Saya" menyebut sesi demo */
  isDemoMode?: boolean;
}

export function SettingsView({
  propertyName,
  rooms,
  tab,
  onTabChange,
  settings,
  onUpdateSettings,
  onThemeChange,
  staffSession,
  onStaffLogout,
  dangerCounts,
  onClearDemo,
  onFactoryReset,
  onApplyTariff,
  invoices,
  cashEntries,
  onRestoreComplete,
  isDemoMode,
}: SettingsViewProps) {
  /** Server-first commit utk seluruh tab Pengaturan (standarisasi tombol Simpan):
   *  akun riil → PUT /api/settings dulu, TUNGGU respons server (sukses: cache
   *  lokal diperbarui oleh commitSettingsToCloud; gagal: false — state lokal
   *  TIDAK diubah, pemanggil menampilkan toast merah). Demo: tulis lokal
   *  langsung tanpa menyentuh Supabase. */
  const commitSettings = async (
    patch: Partial<IndoKostSettings>,
  ): Promise<boolean> => {
    if (isDemoMode) {
      onUpdateSettings(patch);
      return true;
    }
    return commitSettingsToCloud(patch);
  };
  // ── RBAC staf: tab tersembunyi + snap tab terlarang ke yang diizinkan ──
  const allowedKeys = useMemo(() => {
    if (!staffSession) return NAV.map((n) => n.key);
    return staffSession.role === "ADMIN_OPERASIONAL" ? ["tarif", "fasilitas", "tema"] : ["tema"];
  }, [staffSession]);
  const visibleNav = useMemo(
    () => NAV.filter((n) => allowedKeys.includes(n.key)),
    [allowedKeys],
  );
  const effectiveTab = allowedKeys.includes(tab) ? tab : allowedKeys[0]!;
  const staffMeta = staffSession ? ACCESS_ROLE_META[staffSession.role] : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-zinc-900">Pengaturan</h1>
        <p className="mt-0.5 text-[12.5px] text-zinc-700">
          Profil pengelola, properti multi-cabang, staf, pembayaran, template WhatsApp, tarif, tema, dan pengelolaan data
        </p>
      </div>

      {/* Kartu sesi staf — identitas & keluar (hanya saat akses via link staf) */}
      {staffSession && staffMeta && (
        <section
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-[var(--ik-accent-soft)] p-3.5 [border-color:var(--ik-accent-border)]"
          aria-label="Sesi staf aktif"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white",
                staffMeta.pill,
              )}
              aria-hidden="true"
            >
              {staffSession.name.trim().charAt(0).toUpperCase() || "S"}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold leading-4 text-zinc-900">
                <span className="truncate">{staffSession.name}</span>
                <span className={cn("inline-flex h-[18px] items-center rounded-full px-2 text-[11px] font-semibold leading-none", staffMeta.pill)}>
                  {staffMeta.label}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] font-medium leading-3 text-zinc-600">
                Sesi staf aktif — menu sensitif owner disembunyikan otomatis
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              clearStaffSession();
              onStaffLogout();
            }}
            className="h-8 gap-1.5 border-zinc-300 bg-white px-3 text-[12.5px] font-semibold text-zinc-700 shadow-none hover:bg-zinc-100"
          >
            <LogOut className="size-3.5 text-zinc-600" strokeWidth={1.75} aria-hidden="true" />
            Keluar Sesi Staf
          </Button>
        </section>
      )}

      {/*
        Layout: desktop 2 kolom — sub-sidebar vertikal (kiri) + konten form (kanan).
        Mobile: deretan chip scroll-horizontal DIGANTI dropdown elegan
        "Kategori Pengaturan:" (tanpa geser-geser samping).
        forceMount menjaga draf form tetap hidup saat berpindah sub-menu.
      */}
      {/* Mobile: dropdown kategori pengaturan */}
      <div className="rounded-lg border border-border bg-white p-2 md:hidden">
        <Label
          htmlFor="kategori-pengaturan"
          className="mb-1.5 block text-[12.5px] font-medium text-zinc-700"
        >
          Kategori Pengaturan:
        </Label>
        <Select value={effectiveTab} onValueChange={onTabChange}>
          <SelectTrigger
            id="kategori-pengaturan"
            aria-label="Pilih kategori pengaturan"
            className="h-10 w-full justify-between border-zinc-200 bg-zinc-50 text-[13px] font-medium text-zinc-900 shadow-none hover:bg-zinc-100 focus-visible:ring-zinc-900/10"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-[min(60vh,380px)] w-[var(--radix-select-trigger-width)]">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              return (
                <SelectItem
                  key={item.key}
                  value={item.key}
                  className={cn("text-[13px]", item.destructive && "text-red-600")}
                >
                  <span className="flex items-center gap-2">
                    <Icon
                      className={cn("size-3.5 shrink-0", item.destructive ? "text-red-500" : "text-zinc-700")}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <Tabs
        value={effectiveTab}
        onValueChange={onTabChange}
        className="space-y-3 md:grid md:grid-cols-[236px_minmax(0,1fr)] md:items-start md:gap-6 md:space-y-0"
      >
        <TabsList className="hidden h-auto w-full items-stretch gap-1 rounded-lg border border-border bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:flex md:flex-col md:h-auto md:gap-0.5 md:overflow-visible md:rounded-xl md:p-1.5">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <TabsTrigger
                key={item.key}
                value={item.key}
                className={cn(
                  "h-9 shrink-0 gap-2 rounded-md border-0 px-2.5 text-[12.5px] font-medium data-[state=inactive]:bg-transparent data-[state=inactive]:shadow-none md:h-auto md:w-full md:justify-start md:py-2 md:text-left",
                  item.destructive
                    ? "text-red-600 data-[state=active]:bg-red-600 data-[state=active]:text-white"
                    : "text-zinc-600 hover:data-[state=inactive]:text-zinc-900 data-[state=active]:bg-[var(--ik-accent)] data-[state=active]:text-[var(--ik-accent-fg)]"
                )}
                title={item.label}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="min-w-0 whitespace-nowrap md:flex-1 md:whitespace-normal">
                  <span className="block truncate leading-4">{item.label}</span>
                  <span
                    className={cn(
                      "mt-0.5 hidden text-xs font-normal leading-3 opacity-70 md:block",
                      item.destructive ? "text-red-500" : "text-current"
                    )}
                  >
                    {item.desc}
                  </span>
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <ProfilSayaTab
          key={JSON.stringify(settings.owner)}
          owner={settings.owner}
          onSave={(owner) => commitSettings({ owner })}
          isDemoMode={isDemoMode}
        />
        <ProfilPropertiTab
          key={JSON.stringify(settings.propertyProfile)}
          profile={settings.propertyProfile}
          propertyCount={settings.properties.length}
          onSave={(propertyProfile) => commitSettings({ propertyProfile })}
          isDemoMode={isDemoMode}
        />
        <PropertiListTab
          properties={settings.properties}
          activeName={propertyName}
          onChange={(properties) => commitSettings({ properties })}
          isDemoMode={isDemoMode}
        />
        <StaffAccessTab
          properties={settings.properties}
          activePropertyName={propertyName}
        />
        <RekeningTab
          key={JSON.stringify(settings.rekening)}
          rekening={settings.rekening}
          onSave={(rekening) => commitSettings({ rekening })}
          isDemoMode={isDemoMode}
        />
        <TemplateTab
          key={JSON.stringify(settings.templates)}
          propertyName={propertyName}
          templates={settings.templates}
          onSave={(templates) => commitSettings({ templates })}
          isDemoMode={isDemoMode}
        />
        <TarifTab rooms={rooms} onApplyTariff={onApplyTariff} />
        <FasilitasTab
          catalog={settings.facilities}
          onChange={(facilities) => commitSettings({ facilities })}
          isDemoMode={isDemoMode}
        />
        <TemaTab
          theme={settings.theme}
          onSelect={(theme) =>
            onThemeChange ? onThemeChange(theme) : onUpdateSettings({ theme })
          }
        />
        <Pane value="backup">
          <BackupView
            propertyName={propertyName}
            rooms={rooms}
            invoices={invoices}
            cashEntries={cashEntries}
            onRestored={onRestoreComplete}
          />
        </Pane>
        <TabsContent value="danger" forceMount className="mt-0 data-[state=inactive]:hidden">
          <DangerZone counts={dangerCounts} onClearDemo={onClearDemo} onFactoryReset={onFactoryReset} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Shared: pane & save row ───────────────────────────────────────────────── */

function Pane({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TabsContent
      value={value}
      forceMount
      className={cn("mt-0 min-w-0 data-[state=inactive]:hidden", className)}
    >
      {children}
    </TabsContent>
  );
}

/** Toast hasil simpan yang terstandarisasi (arsitektur data cloud-first):
 *  sukses → hijau "Tersimpan ke Cloud" (sesi demo → wording demo);
 *  gagal  → merah "Gagal menyimpan ke server" — dipanggil SETELAH respons
 *  server diketahui, bukan sebelum request dikirim. */
function toastSaveResult(
  ok: boolean,
  isDemoMode: boolean | undefined,
  okDesc: string,
  failContext: string,
): void {
  if (ok) {
    if (isDemoMode) {
      toast.success("Perubahan tersimpan di sesi demo!", {
        description:
          "Dapatkan Lisensi Seumur Hidup agar data tersimpan permanen di cloud.",
      });
    } else {
      toast.success("Tersimpan ke Cloud", { description: okDesc });
    }
  } else {
    toast.error("Gagal menyimpan ke server", {
      description: `${failContext} belum masuk database — periksa koneksi internet lalu coba simpan ulang.`,
    });
  }
}

function SaveRow({
  onClick,
  hint,
  compact,
  busy,
}: {
  onClick: () => void;
  hint?: string | undefined;
  compact?: boolean;
  busy?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      {hint && <p className="mr-auto text-[12.5px] text-zinc-700">{hint}</p>}
      <Button
        onClick={onClick}
        disabled={busy}
        className={cn(
          "bg-[var(--ik-accent)] text-[13px] font-semibold text-[var(--ik-accent-fg)] shadow-none hover:bg-[var(--ik-accent-hover)]",
          compact ? "h-8 px-3" : "h-9 px-4"
        )}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <Save className="size-3.5" strokeWidth={2} />
        )}
        {busy ? "Menyimpan…" : "Simpan Perubahan"}
      </Button>
    </div>
  );
}

function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ── Tab 1: Profil Saya ────────────────────────────────────────────────────── */

/** Kartu "Akun & Sesi" — identitas akun aktif (Nomor WhatsApp utk akun berbasis
 *  WA; email asli hanya utk akun lama/admin) + tombol keluar. */
function AccountCard() {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof getAuthInfo>> | null>(null);
  /** Jumlah pendaftar baru belum ditinjau — badge merah tombol Panel Super Admin */
  const leadsAlert = useSyncExternalStore(
    subscribeLeadsAlert,
    getLeadsAlertSnapshot,
    getLeadsAlertServerSnapshot,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getAuthInfo().then((data) => {
      if (alive) setInfo(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    await signOut();
    window.location.href = "/login";
  };

  const identityText = info
    ? info.demo
      ? "Akun Demo"
      : sessionIdentityLabel(info.user?.email, "Tidak diketahui")
    : "Memuat…";

  const modeText = info
    ? info.mode === "supabase"
      ? "Terhubung ke Supabase Auth"
      : "Mode lokal (tanpa Supabase Auth)"
    : "Memeriksa sesi…";

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-white p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
          <ShieldCheck className="size-4.5 text-zinc-600" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[13px] font-medium text-zinc-900">{identityText}</p>
            {info?.demo && (
              <Badge className="border-transparent bg-amber-100 text-[12.5px] font-medium text-amber-800">
                Mode Demo
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] text-zinc-500">{modeText}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {info?.isSuperAdmin && (
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-8 gap-1.5 border-zinc-300 px-3 text-[12.5px] text-zinc-800 hover:bg-zinc-50"
          >
            <Link href="/admin">
              <ShieldCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              🛡️ Panel Super Admin
              {leadsAlert.unread > 0 && (
                <span
                  aria-label={`${leadsAlert.unread} pendaftar baru belum ditinjau`}
                  className="ml-0.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10.5px] font-bold tabular-nums leading-none text-white"
                >
                  {leadsAlert.unread > 9 ? "9+" : leadsAlert.unread}
                </span>
              )}
            </Link>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={busy}
          className="h-8 gap-1.5 border-red-200 px-3 text-[12.5px] text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <LogOut className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          )}
          Keluar
        </Button>
      </div>
    </div>
  );
}

function ProfilSayaTab({
  owner,
  onSave,
  isDemoMode,
}: {
  owner: IndoKostSettings["owner"];
  /** Server-first — resolve true = tersimpan (cloud/sesi demo); false = gagal
   *  (state lokal TIDAK diubah, toast merah ditampilkan). */
  onSave: (owner: IndoKostSettings["owner"]) => Promise<boolean>;
  /** Mode demo — data hanya hidup di sesi, toast mengarahkan ke lisensi */
  isDemoMode?: boolean;
}) {
  const [nama, setNama] = useState(owner.nama);
  const [wa, setWa] = useState(owner.whatsapp);
  const [saving, setSaving] = useState(false);

  // Email pengelola dipertahankan apa adanya (dipakai internal sinkronisasi
  // lintas perangkat) — UI profil 100% Nomor WhatsApp tanpa input email.
  const dirty = nama.trim() !== owner.nama || wa.trim() !== owner.whatsapp;

  const waDigits = wa.replace(/[^0-9]/g, "");
  const valid = nama.trim().length >= 2 && waDigits.length >= 9;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const ok = await onSave({ nama: nama.trim(), email: owner.email, whatsapp: wa.trim() });
    setSaving(false);
    toastSaveResult(
      ok,
      isDemoMode,
      "Profil pengelola dipakai pada identitas dashboard & pengirim broadcast WA di semua perangkat.",
      "Profil pengelola",
    );
  };

  return (
    <Pane value="profil-saya">
      <div className="max-w-[640px] space-y-4">
        <AccountCard />
        <SectionCard title="Akun Pengelola">
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="st-me-nama" className="text-[12.5px] text-zinc-600">Nama Pengelola</Label>
              <Input
                id="st-me-nama"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className={inputCls}
                placeholder="cth. Hendra Wijaya"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="st-me-wa" className="text-[12.5px] text-zinc-600">Nomor WhatsApp Pengelola</Label>
              <Input
                id="st-me-wa"
                inputMode="tel"
                value={wa}
                onChange={(e) => setWa(e.target.value)}
                className={cn(inputCls, "tabular-nums")}
                placeholder="+62 812-xxxx-xxxx"
              />
              <p className="text-xs leading-4 text-zinc-700">
                Dipakai sebagai pengirim default broadcast &amp; tautan portal penyewa.
              </p>
              {waDigits.length >= 9 && (
                <a
                  href={`${waLink(wa)}?text=${encodeURIComponent(`Halo, ini uji kirim pesan. ${BRAND_WA_LINE}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-700 hover:underline"
                >
                  <WaIcon className="size-3" />
                  Uji tautan WA — {waDigits}
                </a>
              )}
            </div>
          </div>
        </SectionCard>
        <SaveRow
          onClick={save}
          busy={saving}
          hint={
            !valid && dirty
              ? "Lengkapi nama dan nomor WA pengelola (min. 9 digit)."
              : dirty
                ? "Ada perubahan yang belum disimpan."
                : undefined
          }
        />
        <ChangePasswordCard />
      </div>
    </Pane>
  );
}

/* ── Tab 2: Profil Properti ────────────────────────────────────────────────── */

function ProfilPropertiTab({
  profile,
  propertyCount,
  onSave,
  isDemoMode,
}: {
  profile: PropertyProfile;
  propertyCount: number;
  /** Server-first — resolve true = tersimpan (cloud/sesi demo). */
  onSave: (profile: PropertyProfile) => Promise<boolean>;
  isDemoMode?: boolean;
}) {
  const [draft, setDraft] = useState<PropertyProfile>(profile);
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlMode, setUrlMode] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);

  const set = (patch: Partial<PropertyProfile>) => {
    setDraft((d) => ({ ...d, ...patch }));
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await fileToPhotoDataUrl(file);
      set({ fotoUrl: dataUrl });
      toast.success("Foto fasad dimuat", { description: "Klik Simpan untuk menerapkan." });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat foto");
    }
  };

  const save = async () => {
    if (!draft.nama.trim() || saving) return;
    setSaving(true);
    const ok = await onSave({ ...draft, nama: draft.nama.trim() });
    setSaving(false);
    toastSaveResult(
      ok,
      isDemoMode,
      "Nama, tipe, foto, dan aturan langsung tampil di banner & portal di semua perangkat.",
      "Profil properti",
    );
  };

  return (
    <Pane value="profil">
      <div className="max-w-[680px] space-y-4">
        <SectionCard title="Identitas Properti">
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="st-nama" className="text-[12.5px] text-zinc-600">
                Nama {PROPERTY_TYPE_META[draft.tipe].label}
              </Label>
              <Input id="st-nama" value={draft.nama} onChange={(e) => set({ nama: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="st-tipe" className="text-[12.5px] text-zinc-600">Tipe Properti</Label>
              <Select value={draft.tipe} onValueChange={(v) => set({ tipe: v as PropertyType })}>
                <SelectTrigger id="st-tipe" className="h-9 w-full border-zinc-200 text-[13px] focus:ring-zinc-900/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-[13px]">
                      {PROPERTY_TYPE_META[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs leading-4 text-zinc-700">
                {PROPERTY_TYPE_META[draft.tipe].hint} Label unit mengikuti tipe:{" "}
                <span className="font-medium text-zinc-700">
                  {PROPERTY_TYPES.map((t) => `${PROPERTY_TYPE_META[t].label} → ${PROPERTY_TYPE_META[t].unit}`).join(" · ")}
                </span>
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="st-alamat" className="text-[12.5px] text-zinc-600">Alamat Lengkap</Label>
              <Textarea id="st-alamat" rows={2} value={draft.alamat} onChange={(e) => set({ alamat: e.target.value })} className="border-zinc-200 bg-white text-[13px] text-zinc-900 focus-visible:ring-zinc-900/5" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-lantai" className="text-[12.5px] text-zinc-600">
                Jumlah Lantai{draft.tipe === "kontrakan" ? "/Petak" : draft.tipe === "rusun" ? "/Tower" : draft.tipe === "villa" ? "/Blok" : ""}
              </Label>
              <Input id="st-lantai" type="number" min={1} max={50} value={draft.lantai} onChange={(e) => set({ lantai: e.target.value })} className={cn(inputCls, "tabular-nums")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-jam" className="text-[12.5px] text-zinc-600">Jam Malam</Label>
              <Input id="st-jam" type="time" value={draft.jamMalam} onChange={(e) => set({ jamMalam: e.target.value })} className={cn(inputCls, "tabular-nums")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="st-aturan" className="text-[12.5px] text-zinc-600">Aturan Kost</Label>
              <Textarea id="st-aturan" rows={5} value={draft.aturan} onChange={(e) => set({ aturan: e.target.value })} className="border-zinc-200 bg-white text-[12.5px] leading-5 text-zinc-900 focus-visible:ring-zinc-900/5" />
              <p className="text-xs text-zinc-700">Aturan tampil pada portal penyewa &amp; pesan WhatsApp otomatis.</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Foto Bangunan / Fasad"
          action={
            draft.fotoUrl ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[12.5px] text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => set({ fotoUrl: undefined })}
              >
                <X className="mr-1 size-3" strokeWidth={1.75} />
                Hapus Foto
              </Button>
            ) : undefined
          }
        >
          <div className="space-y-3 p-4">
            {draft.fotoUrl ? (
              <div className="flex items-start gap-3">
                <img
                  src={draft.fotoUrl}
                  alt={`Foto fasad ${draft.nama}`}
                  className="h-28 w-full max-w-[220px] rounded-lg border border-border object-cover"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-[12.5px] font-medium text-zinc-700">Foto aktif</p>
                  <p className="text-xs leading-4 text-zinc-700">
                    Tampil pada banner identitas properti ({propertyCount > 1 ? "properti aktif" : "dashboard"}) &amp; kartu properti.
                    Disimpan terkompresi agar ringan di perangkat.
                  </p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-7 text-center transition-colors hover:border-zinc-400 hover:bg-white"
              >
                <ImagePlus className="size-5 text-zinc-700" strokeWidth={1.5} aria-hidden="true" />
                <span className="text-[12.5px] font-medium text-zinc-600">Unggah Foto Bangunan / Fasad</span>
                <span className="text-xs text-zinc-700">PNG/JPG · otomatis dikompresi</span>
              </button>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                className="h-8 border-zinc-200 bg-white px-3 text-[12.5px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
              >
                <Camera className="size-3.5 text-zinc-700" strokeWidth={1.75} />
                {draft.fotoUrl ? "Ganti dari File" : "Pilih File"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setUrlMode((m) => !m); setUrlDraft(""); }}
                className="h-8 border-zinc-200 bg-white px-3 text-[12.5px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
                aria-expanded={urlMode}
              >
                Gunakan URL Gambar
              </Button>
              {urlMode && (
                <div className="flex min-w-[240px] flex-1 items-center gap-1.5">
                  <Input
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                    placeholder="https://…/foto-fasad.jpg"
                    className={inputCls}
                    aria-label="URL gambar fasad"
                  />
                  <Button
                    variant="outline"
                    disabled={!urlDraft.trim()}
                    onClick={() => { set({ fotoUrl: urlDraft.trim() }); setUrlMode(false); setUrlDraft(""); }}
                    className="h-9 shrink-0 border-zinc-200 bg-white px-3 text-[12.5px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
                  >
                    Pakai
                  </Button>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ""; }}
              aria-label="Unggah foto bangunan/fasad"
            />
          </div>
        </SectionCard>

        {/* PWA — tombol manual "Pasang Aplikasi" sebagai alternatif banner bawah */}
        <PwaInstallCard />

        <SaveRow
          onClick={save}
          busy={saving}
          hint={
            !draft.nama.trim()
              ? "Nama properti wajib diisi."
              : dirty
                ? "Perubahan nama langsung tampil di sidebar, banner & portal."
                : undefined
          }
        />
      </div>
    </Pane>
  );
}

/* ── Tab 3: Daftar & Kelola Properti (multi-cabang) ───────────────────────── */

const emptyPropDraft = { name: "", type: "kost" as PropertyType, unitCount: "8", address: "", photoUrl: "" };

function PropertiListTab({
  properties,
  activeName,
  onChange,
  isDemoMode,
}: {
  properties: PropertyEntry[];
  activeName: string;
  /** Server-first — resolve true = tersimpan (cloud/sesi demo). */
  onChange: (properties: PropertyEntry[]) => Promise<boolean>;
  isDemoMode?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyPropDraft);
  const [confirmDelete, setConfirmDelete] = useState<PropertyEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditId(null);
    setDraft(emptyPropDraft);
    setModalOpen(true);
  };

  const openEdit = (p: PropertyEntry) => {
    setEditId(p.id);
    setDraft({ name: p.name, type: p.type, unitCount: String(p.unitCount), address: p.address, photoUrl: p.photoUrl ?? "" });
    setModalOpen(true);
  };

  const nameTaken = properties.some(
    (p) => p.id !== editId && p.name.trim().toLowerCase() === draft.name.trim().toLowerCase()
  );
  const unitCount = Number(draft.unitCount);
  const valid = draft.name.trim().length >= 3 && !nameTaken && unitCount >= 1;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const next: PropertyEntry[] = editId
      ? properties.map((p) =>
          p.id === editId
            ? { ...p, name: draft.name.trim(), type: draft.type, unitCount, address: draft.address.trim(), photoUrl: draft.photoUrl.trim() || undefined }
            : p
        )
      : [
          ...properties,
          {
            id: nextSettingsId("prop"),
            name: draft.name.trim(),
            type: draft.type,
            unitCount,
            address: draft.address.trim(),
            photoUrl: draft.photoUrl.trim() || undefined,
          },
        ];
    const ok = await onChange(next);
    setSaving(false);
    if (!ok) {
      toastSaveResult(false, isDemoMode, "Daftar properti tersinkron di semua perangkat.", "Daftar properti");
      return;
    }
    toastSaveResult(
      true,
      isDemoMode,
      editId
        ? `${draft.name.trim()} — daftar cabang tersinkron di semua perangkat.`
        : `${draft.name.trim()} · ${unitCount} ${PROPERTY_TYPE_META[draft.type].unit} — tersinkron di semua perangkat.`,
      "Daftar properti",
    );
    setModalOpen(false);
  };

  const doDelete = async (p: PropertyEntry) => {
    const ok = await onChange(properties.filter((x) => x.id !== p.id));
    if (!ok) {
      toastSaveResult(false, isDemoMode, "Daftar properti tersinkron di semua perangkat.", "Daftar properti");
      return;
    }
    setConfirmDelete(null);
    toastSaveResult(true, isDemoMode, `${p.name} dikeluarkan dari daftar properti.`, "Daftar properti");
  };

  return (
    <Pane value="properti-list">
      <div className="max-w-[860px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px] text-zinc-700">
            <span className="font-semibold tabular-nums text-zinc-700">{properties.length}</span> properti terdaftar —
            kelola semua cabang dari satu akun owner.
          </p>
          <Button
            onClick={openAdd}
            className="h-9 bg-[var(--ik-accent)] px-3 text-[12.5px] font-semibold text-[var(--ik-accent-fg)] shadow-none hover:bg-[var(--ik-accent-hover)]"
          >
            <Plus className="size-4" strokeWidth={2} />
            Tambah Properti Baru
          </Button>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto rounded-lg border border-border bg-white md:block">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <caption className="sr-only">Daftar properti multi-cabang</caption>
            <thead>
              <tr>
                <th className={`${HEAD_CELL} pl-4 text-left`}>Properti</th>
                <th className={`${HEAD_CELL} text-left`}>Tipe</th>
                <th className={`${HEAD_CELL} text-center`}>Unit</th>
                <th className={`${HEAD_CELL} text-left`}>Status</th>
                <th className={`${HEAD_CELL} pr-4 text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => {
                const isActive = p.name === activeName;
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-zinc-50/70">
                    <td className="max-w-[280px] py-2.5 pl-4 pr-3">
                      <p className="truncate font-semibold text-zinc-900">{p.name}</p>
                      <p className="truncate text-[12.5px] text-zinc-700">{p.address || "Alamat belum diisi"}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="h-5 border-zinc-200 bg-zinc-50 px-1.5 text-xs font-semibold text-zinc-600">
                        {PROPERTY_TYPE_META[p.type].label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-zinc-700">
                      {p.unitCount} {PROPERTY_TYPE_META[p.type].unit}
                    </td>
                    <td className="px-3 py-2.5">
                      {isActive ? (
                        <span className="inline-flex h-5 items-center rounded-full bg-[var(--ik-accent)] px-2 text-xs font-semibold text-[var(--ik-accent-fg)]">
                          Aktif — dikelola
                        </span>
                      ) : (
                        <span className="inline-flex h-5 items-center rounded-full border border-border bg-zinc-50 px-2 text-xs font-medium text-zinc-700">
                          Cadangan
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(p)}
                          className="h-7 gap-1 px-2 text-[12.5px] text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                          aria-label={`Edit ${p.name}`}
                        >
                          <Pencil className="size-3" strokeWidth={1.75} />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isActive}
                          title={isActive ? "Properti yang sedang dikelola tidak dapat dihapus" : undefined}
                          onClick={() => setConfirmDelete(p)}
                          className="h-7 gap-1 px-2 text-[12.5px] text-red-600 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Hapus ${p.name}`}
                        >
                          <Trash2 className="size-3" strokeWidth={1.75} />
                          Hapus
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-2.5 md:hidden">
          {properties.map((p) => {
            const isActive = p.name === activeName;
            return (
              <div key={p.id} className="rounded-lg border border-border bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-zinc-900">{p.name}</p>
                    <p className="mt-0.5 truncate text-[12.5px] text-zinc-700">{p.address || "Alamat belum diisi"}</p>
                  </div>
                  {isActive && (
                    <span className="shrink-0 rounded-full bg-[var(--ik-accent)] px-2 py-0.5 text-xs font-semibold text-[var(--ik-accent-fg)]">
                      Aktif
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="h-5 border-zinc-200 bg-zinc-50 px-1.5 text-xs font-semibold text-zinc-600">
                    {PROPERTY_TYPE_META[p.type].label}
                  </Badge>
                  <span className="text-[12.5px] tabular-nums text-zinc-700">
                    {p.unitCount} {PROPERTY_TYPE_META[p.type].unit}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => openEdit(p)}
                    className="h-8 flex-1 border-zinc-200 bg-white text-[12.5px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
                  >
                    <Pencil className="size-3" strokeWidth={1.75} />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isActive}
                    onClick={() => setConfirmDelete(p)}
                    className="h-8 flex-1 border-red-200 bg-white text-[12.5px] font-medium text-red-600 shadow-none hover:bg-red-50 disabled:opacity-40"
                  >
                    <Trash2 className="size-3" strokeWidth={1.75} />
                    Hapus
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="rounded-md border border-border bg-zinc-50 px-3 py-2.5 text-[12.5px] leading-5 text-zinc-700">
          Gunakan pemilih properti di sidebar untuk berpindah cabang yang sedang dikelola. Data kamar per cabang
          mengikuti dataset aktif.
        </p>
      </div>

      {/* Modal tambah/edit */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="flex max-h-[85dvh] w-[calc(100%-1.5rem)] max-w-md flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 sm:max-w-[480px]">
          <DialogHeader className="flex shrink-0 flex-row items-center justify-between border-b border-border bg-white px-4 py-3.5 text-left">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-[15px] font-bold text-zinc-900">
                {editId ? "Edit Properti" : "Tambah Properti Baru"}
              </DialogTitle>
              <DialogDescription className="text-[12.5px] text-zinc-700">
                Cabang kedua & seterusnya memakai dataset demo saat diaktifkan.
              </DialogDescription>
            </div>
            <DialogClose className="ml-2" />
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 touch-pan-y">
            <div className="space-y-1.5">
              <Label htmlFor="pr-nama" className="text-[12.5px] text-zinc-600">Nama Properti</Label>
              <Input id="pr-nama" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className={inputCls} placeholder="cth. Kost Melati Indah" />
              {nameTaken && <p className="text-xs text-red-500">Nama properti sudah dipakai.</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pr-tipe" className="text-[12.5px] text-zinc-600">Tipe Properti</Label>
                <Select value={draft.type} onValueChange={(v) => setDraft((d) => ({ ...d, type: v as PropertyType }))}>
                  <SelectTrigger id="pr-tipe" className="h-9 w-full border-zinc-200 text-[13px] focus:ring-zinc-900/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-[13px]">
                        {PROPERTY_TYPE_META[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-unit" className="text-[12.5px] text-zinc-600">
                  Jumlah {PROPERTY_TYPE_META[draft.type].unit}
                </Label>
                <Input
                  id="pr-unit"
                  type="number"
                  min={1}
                  max={999}
                  value={draft.unitCount}
                  onChange={(e) => setDraft((d) => ({ ...d, unitCount: e.target.value.replace(/\D/g, "") }))}
                  className={cn(inputCls, "tabular-nums")}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-alamat" className="text-[12.5px] text-zinc-600">Alamat</Label>
              <Textarea id="pr-alamat" rows={2} value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} className="border-zinc-200 bg-white text-[13px] text-zinc-900 focus-visible:ring-zinc-900/5" placeholder="Jl. …" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-foto" className="text-[12.5px] text-zinc-600">URL Foto Fasad (opsional)</Label>
              <Input id="pr-foto" value={draft.photoUrl} onChange={(e) => setDraft((d) => ({ ...d, photoUrl: e.target.value }))} className={inputCls} placeholder="https://…/fasad.jpg" />
            </div>
          </div>
          <DialogFooter className="shrink-0 flex-row items-center justify-end gap-2 border-t border-border bg-white px-4 py-3">
            <DialogClose asChild>
              <Button variant="outline" className="h-9 border-zinc-200 bg-white px-3.5 text-[13px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50">
                Batal
              </Button>
            </DialogClose>
            <Button
              onClick={submit}
              disabled={!valid || saving}
              className="h-9 bg-[var(--ik-accent)] px-4 text-[13px] font-semibold text-[var(--ik-accent-fg)] shadow-none hover:bg-[var(--ik-accent-hover)] disabled:opacity-40"
            >
              {saving && <Loader2 className="mr-1 size-3.5 animate-spin" strokeWidth={2} />}
              {editId ? "Simpan Perubahan" : "Tambah Properti"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus */}
      <AlertDialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="max-w-[calc(100%-1.5rem)] rounded-2xl sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] text-zinc-900">Hapus {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-[12.5px] text-zinc-700">
              Properti akan dikeluarkan dari daftar multi-cabang UnitKu. Riwayat data properti ini tidak ikut terhapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel className="h-9 border-zinc-200 bg-white px-3.5 text-[13px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && doDelete(confirmDelete)}
              className="h-9 bg-red-600 px-3.5 text-[13px] font-semibold text-white shadow-none hover:bg-red-700"
            >
              Ya, Hapus Properti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Pane>
  );
}

/* ── Tab 4: Kelola Staf — akses mandiri via link undangan ──────────────────── */

function StaffAccessTab({
  properties,
  activePropertyName,
}: {
  properties: PropertyEntry[];
  activePropertyName: string;
}) {
  const activePropertyId =
    properties.find((p) => p.name === activePropertyName)?.id ?? properties[0]?.id ?? "";
  return (
    <Pane value="staf">
      <StaffAccessManager properties={properties} activePropertyId={activePropertyId} />
    </Pane>
  );
}

/* ── Tab 5: Rekening & Pembayaran ──────────────────────────────────────────── */

const BANKS = ["BCA", "Mandiri", "BRI", "BNI", "CIMB Niaga", "Permata"];

/* ── QRIS statis — pembaca file (PNG/JPG/WebP → dataURL siap simpan) ──────── */

const QRIS_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const QRIS_ACCEPT = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

/** File QRIS → dataURL. PNG/WebP kecil dipertahankan apa adanya agar modul QR
 *  tetap tajam; JPG/file besar dikompresi sisi terpanjang 720px (quality 0.9). */
function fileToQrisDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      if (
        (file.type === "image/png" || file.type === "image/webp") &&
        file.size <= 250_000
      ) {
        resolve(dataUrl);
        return;
      }
      fileToPhotoDataUrl(file, 720, 0.9).then(resolve, reject);
    };
    reader.readAsDataURL(file);
  });
}

function RekeningTab({
  rekening,
  onSave,
  isDemoMode,
}: {
  rekening: IndoKostSettings["rekening"];
  /** Server-first — resolve true = tersimpan (cloud/sesi demo). */
  onSave: (rekening: IndoKostSettings["rekening"]) => Promise<boolean>;
  isDemoMode?: boolean;
}) {
  const [bank, setBank] = useState(rekening.bank);
  const [noRek, setNoRek] = useState(rekening.noRek);
  const [atasNama, setAtasNama] = useState(rekening.atasNama);
  // QRIS statis — sumber kebenaran = rekening tersimpan (remount via key saat
  // settings berubah). NMID di-draft lokal agar bisa diketik dulu; tersimpan
  // saat blur bila berubah.
  const qrisUrl = rekening.qrisImageUrl;
  const [nmid, setNmid] = useState(rekening.qrisNmid ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  /** Persist QRIS — bank fields diambil dari snapshot tersimpan (bukan draft
   *  lokal) agar aksi QRIS tidak ikut menyimpan editan rekening yang belum
   *  disimpan pengguna. Server-first: tunggu respons, toast mengikuti hasil. */
  const saveQris = async (qrisImageUrl: string | undefined) => {
    const ok = await onSave({
      ...rekening,
      bank: rekening.bank,
      noRek: rekening.noRek,
      atasNama: rekening.atasNama,
      qrisImageUrl,
      qrisNmid: nmid.trim() || undefined,
    });
    toastSaveResult(
      ok,
      isDemoMode,
      qrisImageUrl
        ? "QRIS tampil di portal penyewa (tab Scan QRIS) & pesan tagihan WhatsApp di semua perangkat."
        : "Portal penyewa kembali menampilkan nomor rekening bank saja.",
      "QRIS / rekening",
    );
  };

  const pick = (file: File | undefined) => {
    if (!file || uploading) return;
    if (!(QRIS_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Format tidak didukung", {
        description: "Unggah gambar QRIS dalam format PNG, JPG, atau WebP.",
      });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Ukuran gambar terlalu besar", {
        description: "Maksimal 8 MB — kompres dulu atau pilih file lain.",
      });
      return;
    }
    setUploading(true);
    fileToQrisDataUrl(file)
      .then((dataUrl) => saveQris(dataUrl))
      .catch((err: unknown) => {
        toast.error("Gagal memuat QRIS", {
          description: err instanceof Error ? err.message : "Coba file lain.",
        });
      })
      .finally(() => setUploading(false));
  };

  const save = async () => {
    if (!noRek.trim() || !atasNama.trim() || saving) return;
    setSaving(true);
    const ok = await onSave({ bank, noRek: noRek.trim(), atasNama: atasNama.trim(), qrisImageUrl: qrisUrl, qrisNmid: nmid.trim() || undefined });
    setSaving(false);
    toastSaveResult(
      ok,
      isDemoMode,
      "Instruksi transfer pada invoice & pengingat WA ikut diperbarui di semua perangkat.",
      "Rekening bank",
    );
  };

  /** Simpan NMID saat blur bila berubah (input opsional) — server-first */
  const commitNmid = async () => {
    const next = nmid.trim() || undefined;
    if (next === (rekening.qrisNmid ?? undefined)) return;
    const ok = await onSave({ ...rekening, qrisNmid: next });
    toastSaveResult(
      ok,
      isDemoMode,
      "Nama merchant / NMID tampil bersama kode QRIS di portal penyewa.",
      "Info QRIS (NMID)",
    );
  };

  return (
    <Pane value="rekening">
      <div className="grid max-w-[860px] grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Rekening Bank">
          <div className="space-y-3 p-4">
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-zinc-600">Nama Bank</Label>
              <Select value={bank} onValueChange={setBank}>
                <SelectTrigger className="h-9 w-full border-zinc-200 text-[13px] focus:ring-zinc-900/5" aria-label="Nama bank">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BANKS.map((b) => (
                    <SelectItem key={b} value={b} className="text-[13px]">
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-rek" className="text-[12.5px] text-zinc-600">Nomor Rekening</Label>
              <Input id="st-rek" inputMode="numeric" value={noRek} onChange={(e) => setNoRek(e.target.value.replace(/\D/g, "").slice(0, 18))} className={cn(inputCls, "tabular-nums")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-an" className="text-[12.5px] text-zinc-600">Atas Nama Penerima</Label>
              <Input id="st-an" value={atasNama} onChange={(e) => setAtasNama(e.target.value)} className={inputCls} />
            </div>
            <div className="rounded-md border border-border bg-zinc-50 px-3 py-2.5">
              <p className="text-[12.5px] leading-5 text-zinc-700">
                Rekening ini otomatis muncul pada template pengingat WA &amp; instruksi transfer invoice.
              </p>
            </div>
            <SaveRow onClick={save} busy={saving} hint={undefined} compact />
          </div>
        </SectionCard>

        <SectionCard title="QRIS Statis">
          <div className="space-y-3 p-4">
            <div className="flex items-start gap-2.5 rounded-md border border-violet-200 bg-violet-50 px-3 py-2.5">
              <QrCode className="mt-0.5 size-4 shrink-0 text-violet-500" strokeWidth={1.75} aria-hidden="true" />
              <p className="text-[12.5px] leading-5 text-violet-800">
                QRIS yang diunggah otomatis tampil di portal penyewa (tab &quot;Scan QRIS&quot;),
                kwitansi digital &amp; disebut pada pesan tagihan WhatsApp.
              </p>
            </div>

            {qrisUrl ? (
              <div className="flex items-start gap-3 rounded-md border border-border bg-zinc-50 p-3">
                {/* Pratinjau — aspect-square + object-contain agar QRIS tidak terpotong */}
                <img
                  src={qrisUrl}
                  alt="QRIS statis properti ini"
                  className="size-24 shrink-0 rounded border border-border bg-white object-contain p-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-emerald-600" strokeWidth={2} aria-hidden="true" />
                    <p className="text-[12.5px] font-semibold text-zinc-800">QRIS Aktif</p>
                  </div>
                  <p className="mt-0.5 text-xs leading-4 text-zinc-700">
                    Ditampilkan di portal penyewa &amp; kwitansi digital.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      className="h-7 border-zinc-200 bg-white px-2 text-[12.5px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
                      onClick={() => fileRef.current?.click()}
                    >
                      <ImagePlus className="size-3 text-zinc-700" strokeWidth={1.75} />
                      Ganti QRIS
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={uploading}
                      className="h-7 px-2 text-[12.5px] text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => {
                        void saveQris(undefined);
                      }}
                    >
                      <Trash2 className="size-3" strokeWidth={1.75} />
                      Hapus QRIS
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  pick(e.dataTransfer.files?.[0]);
                }}
              >
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  aria-label="Pilih Gambar QRIS"
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-7 text-center transition-colors",
                    dragActive
                      ? "border-zinc-900 bg-zinc-100"
                      : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-white",
                    uploading && "opacity-60",
                  )}
                >
                  {uploading ? (
                    <Loader2 className="size-5 animate-spin text-zinc-700" strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <ImagePlus className="size-5 text-zinc-700" strokeWidth={1.5} aria-hidden="true" />
                  )}
                  <span className="text-[12.5px] font-medium text-zinc-700">
                    {uploading ? "Memproses gambar…" : "Pilih Gambar QRIS"}
                  </span>
                  <span className="text-xs text-zinc-700">
                    {dragActive ? "Lepaskan untuk mengunggah" : "Tarik & lepas di sini, atau klik · PNG/JPG/WebP"}
                  </span>
                </button>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept={QRIS_ACCEPT}
              className="hidden"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
              aria-label="Unggah gambar QRIS"
            />

            <div className="space-y-1.5">
              <Label htmlFor="st-qris-nmid" className="text-[12.5px] text-zinc-600">
                Nama Merchant / NMID QRIS <span className="text-zinc-400">(opsional)</span>
              </Label>
              <Input
                id="st-qris-nmid"
                value={nmid}
                onChange={(e) => setNmid(e.target.value)}
                onBlur={commitNmid}
                placeholder="Kost Griya Nyaman / NMID: ID1020..."
                className={inputCls}
              />
            </div>
            <p className="text-xs leading-4 text-zinc-700">
              Gambar tersimpan sebagai dataURL &amp; disinkronkan ke database — tampil tajam di
              portal penyewa dan dapat diunduh penyewa untuk dipindai dari layar HP lain.
            </p>
          </div>
        </SectionCard>
      </div>
    </Pane>
  );
}

/* ── Tab 6: Template WhatsApp ──────────────────────────────────────────────── */

function renderPreview(text: string): string {
  return text
    .replaceAll("{nama}", SAMPLE.nama)
    .replaceAll("{kamar}", SAMPLE.kamar)
    .replaceAll("{nominal}", SAMPLE.nominal)
    .replaceAll("{tempo}", SAMPLE.tempo)
    .replaceAll("{kos}", SAMPLE.kos)
    .replaceAll("{rekening}", SAMPLE.rekening)
    .replace(/\n{3,}/g, "\n\n");
}

function TemplateTab({
  propertyName,
  templates,
  onSave,
  isDemoMode,
}: {
  propertyName: string;
  templates: IndoKostSettings["templates"];
  /** Server-first — resolve true = tersimpan (cloud/sesi demo). */
  onSave: (templates: IndoKostSettings["templates"]) => Promise<boolean>;
  isDemoMode?: boolean;
}) {
  const [draft, setDraft] = useState<IndoKostSettings["templates"]>(templates);
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const dirty =
    draft.h3 !== templates.h3 || draft.hariH !== templates.hariH || draft.lunas !== templates.lunas;

  const insertToken = (key: keyof IndoKostSettings["templates"], token: string) => {
    const el = refs.current[key];
    const ta = draft[key];
    if (!el) {
      setDraft((t) => ({ ...t, [key]: t[key] + token }));
      return;
    }
    const start = el.selectionStart ?? ta.length;
    const end = el.selectionEnd ?? ta.length;
    const next = ta.slice(0, start) + token + ta.slice(end);
    setDraft((t) => ({ ...t, [key]: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    toastSaveResult(
      ok,
      isDemoMode,
      "Template dipakai pada pengingat tagihan berikutnya & tombol kirim WA di semua perangkat.",
      "Template WhatsApp",
    );
  };

  const FIELDS: { key: keyof IndoKostSettings["templates"]; label: string; hint: string }[] = [
    { key: "h3", label: "Template Tagihan H-3", hint: "Dikirim otomatis 3 hari sebelum jatuh tempo." },
    { key: "hariH", label: "Template Tagihan Hari H", hint: "Dikirim pada tanggal jatuh tempo." },
    { key: "lunas", label: "Template Kwitansi Lunas", hint: "Dikirim setelah pembayaran terverifikasi." },
  ];

  return (
    <Pane value="template">
      <div className="max-w-[720px] space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-bold uppercase tracking-wider text-zinc-700">Placeholder</span>
            {TOKENS.map((t) => (
              <span key={t} className="rounded border border-border bg-zinc-50 px-1.5 py-0.5 font-mono text-xs text-zinc-600">
                {t}
              </span>
            ))}
            <span className="rounded border border-border bg-zinc-50 px-1.5 py-0.5 font-mono text-xs text-zinc-600">
              {"{kos}"}
            </span>
          </div>
          <p className="hidden text-xs text-zinc-700 sm:block">Klik token pada tiap editor untuk menyisipkan</p>
        </div>

        {FIELDS.map((f) => (
          <section key={f.key} className="rounded-lg border border-border bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <div>
                <h3 className="text-[12.5px] font-bold text-zinc-800">{f.label}</h3>
                <p className="text-xs text-zinc-700">{f.hint}</p>
              </div>
              <div className="flex items-center gap-1">
                {TOKENS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => insertToken(f.key, t)}
                    className="rounded border border-border bg-zinc-50 px-1.5 py-0.5 font-mono text-xs text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-white hover:text-zinc-800"
                    aria-label={`Sisipkan ${t} ke ${f.label}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">
              <Textarea
                ref={(el) => {
                  refs.current[f.key] = el;
                }}
                rows={6}
                value={draft[f.key]}
                onChange={(e) => setDraft((t) => ({ ...t, [f.key]: e.target.value }))}
                className="border-zinc-200 bg-white text-[12.5px] leading-5 text-zinc-900 focus-visible:ring-zinc-900/5"
                aria-label={f.label}
              />
              <div className="mt-3 rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2.5">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Pratinjau · {propertyName}
                </p>
                <p className="whitespace-pre-wrap text-[12.5px] leading-5 text-zinc-600">{renderPreview(draft[f.key])}</p>
              </div>
            </div>
          </section>
        ))}

        <SaveRow
          onClick={save}
          busy={saving}
          hint={dirty ? "Perubahan template belum disimpan." : undefined}
        />
      </div>
    </Pane>
  );
}

/* ── Tab 7: Tarif & Tipe Kamar ─────────────────────────────────────────────── */

function TarifTab({ rooms, onApplyTariff }: { rooms: Room[]; onApplyTariff: (c: { type: string; price: number }[]) => void }) {
  const typeRows = useMemo(() => {
    const map = new Map<string, { type: string; count: number; price: number; occupied: number }>();
    rooms.forEach((r) => {
      const row = map.get(r.type) ?? { type: r.type, count: 0, price: r.price, occupied: 0 };
      row.count += 1;
      if (r.status !== "kosong") row.occupied += 1;
      map.set(r.type, row);
    });
    return [...map.values()];
  }, [rooms]);

  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(typeRows.map((r) => [r.type, String(r.price)]))
  );

  const dirty = typeRows.filter((r) => Number(prices[r.type] ?? r.price) !== r.price && Number(prices[r.type]) > 0);

  const save = () => {
    if (dirty.length === 0) return;
    onApplyTariff(dirty.map((r) => ({ type: r.type, price: Number(prices[r.type]) })));
    toast.success("Tarif diperbarui", {
      description: `${dirty.length} tipe kamar — berlaku untuk tagihan periode berikutnya.`,
    });
  };

  if (typeRows.length === 0) {
    return (
      <Pane value="tarif">
        <div className="max-w-[820px]">
          <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-6 py-10 text-center">
            <p className="text-[13px] font-semibold text-zinc-700">Belum ada tipe kamar</p>
            <p className="mt-1 text-[12.5px] text-zinc-700">
              Tambahkan kamar terlebih dahulu pada halaman Denah Kamar — tarif per tipe akan muncul di sini.
            </p>
          </div>
        </div>
      </Pane>
    );
  }

  return (
    <Pane value="tarif">
      <div className="max-w-[820px] space-y-4">
        <div className="rounded-lg border border-border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <div>
              <h3 className="text-[12.5px] font-bold text-zinc-800">Tipe Kamar, Harga &amp; Fasilitas Default</h3>
              <p className="text-xs text-zinc-700">
                Perubahan berlaku untuk tagihan periode berikutnya — invoice berjalan tidak berubah.
              </p>
            </div>
            <span className="text-xs tabular-nums text-zinc-700">{typeRows.length} tipe · {rooms.length} kamar</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-[13px]">
              <caption className="sr-only">Daftar tipe kamar dan tarif</caption>
              <thead>
                <tr>
                  <th className={`${HEAD_CELL} pl-4 text-left`}>Tipe Kamar</th>
                  <th className={`${HEAD_CELL} text-left`}>Fasilitas</th>
                  <th className={`${HEAD_CELL} text-center`}>Jumlah</th>
                  <th className={`${HEAD_CELL} text-left`}>Terisi</th>
                  <th className={`${HEAD_CELL} pr-4 text-left`}>Harga Sewa Dasar</th>
                </tr>
              </thead>
              <tbody>
                {typeRows.map((row) => {
                  const current = Number(prices[row.type] ?? row.price);
                  const changed = current !== row.price;
                  const facilities =
                    rooms.find((r) => r.type === row.type)?.facilities ?? TYPE_FACILITIES[row.type] ?? [];
                  return (
                    <tr key={row.type} className="border-b border-border last:border-0 hover:bg-zinc-50/70">
                      <td className="py-2.5 pl-4 pr-3">
                        <p className="text-[13px] font-semibold text-zinc-900">{row.type}</p>
                        {changed && (
                          <p className="text-xs font-medium text-amber-600 tabular-nums">
                            sebelumnya {formatIDR(row.price)}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex max-w-[280px] flex-wrap gap-1">
                          {facilities.map((f) => (
                            <span key={f} className="rounded-full border border-border bg-zinc-50 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-[13px] tabular-nums text-zinc-700">{row.count}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex h-5 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 text-xs font-semibold tabular-nums text-emerald-700">
                          {row.occupied}/{row.count}
                        </span>
                      </td>
                      <td className="py-2.5 pl-3 pr-4">
                        <div
                          className={cn(
                            "flex h-9 w-[190px] items-center rounded-md border bg-white transition-colors focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-zinc-900/5",
                            changed ? "border-amber-300" : "border-border"
                          )}
                        >
                          <span className="select-none border-r border-border px-2 text-[12.5px] font-medium text-zinc-700">Rp</span>
                          <input
                            inputMode="numeric"
                            value={prices[row.type] ? Number(prices[row.type]).toLocaleString("id-ID") : ""}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                              setPrices((p) => ({ ...p, [row.type]: digits }));
                            }}
                            aria-label={`Harga sewa dasar ${row.type}`}
                            className="h-full w-full min-w-0 px-2 text-[13px] font-medium tabular-nums text-zinc-900 focus:outline-none"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <SaveRow
          onClick={save}
          hint={dirty.length ? `${dirty.length} tipe tarif akan diperbarui.` : "Belum ada perubahan tarif."}
        />
      </div>
    </Pane>
  );
}

const HEAD_CELL =
  "h-9 bg-white px-3 text-xs font-semibold uppercase tracking-wide text-zinc-700 shadow-[inset_0_-1px_0_var(--border)]";

/* ── Tab 8: Katalog Fasilitas ───────────────────────────────────────────────── */

/** Editor satu grup fasilitas — tambah, edit nama (inline), hapus. */
function FacilityGroupEditor({
  title,
  hint,
  items,
  onUpdate,
  isDemoMode,
}: {
  title: string;
  hint: string;
  items: FacilityItem[];
  /** Server-first — resolve true = tersimpan (cloud/sesi demo). */
  onUpdate: (items: FacilityItem[]) => Promise<boolean>;
  isDemoMode?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const labelsLower = items.map((i) => i.label.toLowerCase());
  const dup = draft.trim().length > 0 && labelsLower.includes(draft.trim().toLowerCase());
  const editDup =
    editDraft.trim().length > 0 &&
    items.some((i) => i.id !== editId && i.label.toLowerCase() === editDraft.trim().toLowerCase());

  const add = async () => {
    const label = draft.trim();
    if (!label || dup || busy) return;
    setBusy(true);
    const ok = await onUpdate([...items, { id: nextSettingsId("fac"), label, custom: true }]);
    setBusy(false);
    if (!ok) {
      toastSaveResult(false, isDemoMode, `Fasilitas "${label}"`, "Katalog fasilitas");
      return;
    }
    setDraft("");
    toastSaveResult(true, isDemoMode, `Fasilitas "${label}" masuk katalog ${title} — langsung tersedia di pilihan fasilitas kamar.`, "Katalog fasilitas");
  };

  const rename = async () => {
    const label = editDraft.trim();
    if (!label || editDup || !editId || busy) return;
    setBusy(true);
    const ok = await onUpdate(items.map((i) => (i.id === editId ? { ...i, label } : i)));
    setBusy(false);
    if (!ok) {
      toastSaveResult(false, isDemoMode, `Nama fasilitas "${label}"`, "Katalog fasilitas");
      return;
    }
    toastSaveResult(true, isDemoMode, `"${label}" — katalog ${title} diperbarui di semua perangkat.`, "Katalog fasilitas");
    setEditId(null);
  };

  const remove = async (item: FacilityItem) => {
    if (busy) return;
    setBusy(true);
    const ok = await onUpdate(items.filter((i) => i.id !== item.id));
    setBusy(false);
    if (!ok) {
      toastSaveResult(false, isDemoMode, `Fasilitas "${item.label}"`, "Katalog fasilitas");
      return;
    }
    toastSaveResult(true, isDemoMode, `Fasilitas "${item.label}" dihapus dari katalog ${title} — kamar yang sudah memilikinya tidak berubah.`, "Katalog fasilitas");
  };

  return (
    <div className="rounded-lg border border-border bg-white">
      <div className="border-b border-border px-4 py-2.5">
        <h3 className="text-[12.5px] font-bold text-zinc-800">{title}</h3>
        <p className="mt-0.5 text-xs text-zinc-700">{hint}</p>
      </div>

      {/* Tambah */}
      <div className="flex items-center gap-2 border-b border-border bg-zinc-50 px-4 py-2.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Tambah fasilitas baru…"
          aria-label={`Tambah fasilitas pada ${title}`}
          aria-invalid={dup}
          className={cn(inputCls, "flex-1", dup && "border-red-300")}
        />
        <Button
          onClick={add}
          disabled={!draft.trim() || dup}
          className="h-9 shrink-0 bg-[var(--ik-accent)] px-3 text-[13px] font-semibold text-[var(--ik-accent-fg)] shadow-none hover:bg-[var(--ik-accent-hover)] disabled:opacity-50"
        >
          <Plus className="size-3.5" strokeWidth={2} />
          Tambah
        </Button>
      </div>
      {dup && (
        <p className="px-4 pt-2 text-xs font-medium text-red-600">
          Fasilitas "{draft.trim()}" sudah ada di katalog ini.
        </p>
      )}

      {/* Daftar item */}
      <ul className="p-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 transition-colors hover:bg-zinc-50"
          >
            {editId === item.id ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Input
                  autoFocus
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      rename();
                    }
                    if (e.key === "Escape") setEditId(null);
                  }}
                  aria-label="Nama fasilitas"
                  aria-invalid={editDup}
                  className={cn(inputCls, "h-8 flex-1", editDup && "border-red-300")}
                />
                <Button
                  size="icon"
                  onClick={rename}
                  disabled={editDup || !editDraft.trim()}
                  className="size-8 shrink-0 bg-emerald-600 text-white shadow-none hover:bg-emerald-700 disabled:opacity-40"
                  aria-label="Simpan nama fasilitas"
                >
                  <Check className="size-3.5" strokeWidth={2.5} />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setEditId(null)}
                  className="size-8 shrink-0 border-zinc-200 bg-white text-zinc-700 shadow-none hover:bg-zinc-50"
                  aria-label="Batal edit nama"
                >
                  <X className="size-3.5" strokeWidth={2.25} />
                </Button>
              </div>
            ) : (
              <>
                <span className="flex min-w-0 items-center gap-2">
                  <Check className="size-3 shrink-0 text-emerald-600" strokeWidth={2.25} aria-hidden="true" />
                  <span className="truncate text-[13px] font-medium text-zinc-800">{item.label}</span>
                  {item.custom && (
                    <span className="shrink-0 rounded-full border border-border bg-zinc-50 px-1.5 py-px text-xs font-semibold text-zinc-700">
                      custom
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-700"
                    onClick={() => {
                      setEditId(item.id);
                      setEditDraft(item.label);
                    }}
                    aria-label={`Edit nama ${item.label}`}
                  >
                    <Pencil className="size-3.5" strokeWidth={1.75} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => remove(item)}
                    aria-label={`Hapus ${item.label}`}
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                  </Button>
                </span>
              </>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="px-2.5 py-3 text-[12.5px] text-zinc-700">
            Belum ada fasilitas pada katalog ini — tambahkan lewat kolom di atas.
          </li>
        )}
      </ul>
    </div>
  );
}

function FasilitasTab({
  catalog,
  onChange,
  isDemoMode,
}: {
  catalog: FacilityCatalog;
  /** Server-first — resolve true = tersimpan (cloud/sesi demo). */
  onChange: (catalog: FacilityCatalog) => Promise<boolean>;
  isDemoMode?: boolean;
}) {
  return (
    <Pane value="fasilitas">
      <div className="max-w-[820px] space-y-4">
        <div className="rounded-lg border border-border bg-white px-4 py-3">
          <h2 className="text-[13px] font-bold text-zinc-900">Katalog Fasilitas</h2>
          <p className="mt-0.5 text-[12.5px] leading-5 text-zinc-700">
            Master pilihan fasilitas untuk modal Tambah/Kelola Kamar dan tampilan fasilitas di
            Detail Kamar &amp; Portal Penyewa. Fasilitas custom yang ditambahkan lewat modal
            otomatis masuk ke katalog di sini.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <FacilityGroupEditor
            title="Fasilitas Unit"
            hint="Fasilitas default unit (milik kamar) — dipilih saat tambah/kelola kamar."
            items={catalog.unit}
            onUpdate={(unit) => onChange({ ...catalog, unit })}
            isDemoMode={isDemoMode}
          />
          <FacilityGroupEditor
            title="Fasilitas Bersama"
            hint="Fasilitas bersama properti — tampil di Portal Penyewa."
            items={catalog.shared}
            onUpdate={(shared) => onChange({ ...catalog, shared })}
            isDemoMode={isDemoMode}
          />
        </div>

        <p className="rounded-md border border-border bg-zinc-50 px-3 py-2.5 text-[12.5px] leading-5 text-zinc-700">
          Perubahan katalog tersimpan otomatis &amp; langsung berlaku. Menghapus fasilitas tidak
          mengubah kamar yang sudah memilikinya.
        </p>
      </div>
    </Pane>
  );
}

/* ── Tab 9: Tema & Tampilan ────────────────────────────────────────────────── */

function TemaTab({ theme, onSelect }: { theme: ThemeKey; onSelect: (t: ThemeKey) => void }) {
  return (
    <Pane value="tema">
      <div className="max-w-[820px] space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_KEYS.map((key) => {
            const meta = THEME_META[key];
            const active = theme === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-start gap-3 rounded-xl border-2 bg-white p-3.5 text-left transition-colors hover:bg-zinc-50/60",
                  active ? "border-[var(--ik-accent)]" : "border-border"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className={cn("size-6 rounded-full ring-1 ring-zinc-950/10", meta.dot)} />
                    <span className={cn("size-6 rounded-full ring-1 ring-zinc-950/10", meta.softDot)} />
                    <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-bold ring-1 ring-zinc-950/10", meta.softDot, meta.text)}>
                      Aa
                    </span>
                  </div>
                  {active ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ik-accent)] px-2 py-0.5 text-xs font-semibold text-[var(--ik-accent-fg)]">
                      <Check className="size-3" strokeWidth={2.5} />
                      Aktif
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-700">Pilih</span>
                  )}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-zinc-900">{meta.label}</p>
                  <p className="mt-0.5 text-[12.5px] leading-4 text-zinc-700">{meta.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
        <p className="rounded-md border border-border bg-zinc-50 px-3 py-2.5 text-[12.5px] leading-5 text-zinc-700">
          12 tema: 5 palet solid (warna menu aktif, tombol utama &amp; badge) dan 7 tema berkarakter — Industrial
          Utility (struk kasir brutalis), Retro Ledger (kartu arsip &amp; cap karet), Blueprint Studio (cetak biru
          arsitek), Pastel Macaron (estetika Korea), Matcha Sanctuary (zen villa), Cyber Terminal (OLED neon)
          &amp; Coffee Roastery (espresso hangat) — yang turut mengubah latar, kartu denah, metrik, banner, modal
          &amp; tipografi. Pilihan tersimpan otomatis di perangkat ini &amp; langsung berlaku tanpa refresh.
        </p>
      </div>
    </Pane>
  );
}
