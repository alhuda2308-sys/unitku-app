"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import { ChevronsUpDown, DatabaseBackup, LayoutGrid, LogOut, Megaphone, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings, ShieldCheck, Smartphone, Users, Wallet, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAFF_ROLE_META, type StaffAccessRole } from "@/lib/staff-access";
import { CloudSyncBadge } from "@/components/kost/cloud-sync-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PROPERTY_TYPE_META, isVillaType, type PropertyEntry } from "@/lib/app-settings";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import {
  getLeadsAlertServerSnapshot,
  getLeadsAlertSnapshot,
  subscribeLeadsAlert,
} from "@/lib/leads-alert-store";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  property: string;
  /** Nama profil owner dari Pengaturan → Profil Saya (settings.owner.nama) —
   *  reaktif: ikut terupdate saat "Simpan Perubahan" diklik */
  ownerName: string;
  /** Daftar properti dari Pengaturan (multi-cabang) */
  properties: PropertyEntry[];
  onPropertyChange: (name: string) => void;
  invoiceAlerts: number;
  ticketAlerts: number;
  activeKey: string;
  onNavigate: (key: string) => void;
  /** Opens Pengaturan → tab "Zona Berbahaya" (Kelola Data / Reset Demo) */
  onOpenDangerZone: () => void;
  /** Sesi staf aktif (dari /staff?token=…) — null = owner */
  staffSession: { name: string; role: StaffAccessRole } | null;
  onStaffLogout: () => void;
  /** Indikator status sinkron cloud di kaki sidebar — disembunyikan di mode
   *  demo (sesi demo tidak pernah menyentuh Supabase, hijau/merah akan bohong) */
  showSyncStatus?: boolean;
  /** true = sesi Super Admin → tampilkan nav "Panel Super Admin" + badge
   *  merah jumlah pendaftar baru yang belum ditinjau */
  showSuperAdminNav?: boolean;
  /** Tipe properti AKTIF (Profil Properti) — Villa/Homestay → nav "Data Tamu / Penyewa".
   *  Fallback: tipe pada daftar cabang dengan nama yang cocok. */
  activePropertyType?: string;
}

const NAV_ITEMS: { key: string; label: string; icon: typeof LayoutGrid }[] = [
  { key: "denah", label: "Denah Kamar", icon: LayoutGrid },
  { key: "tagihan", label: "Tagihan & Invoice", icon: ReceiptText },
  { key: "komplain", label: "Komplain & Pemeliharaan", icon: Wrench },
  { key: "pengumuman", label: "Pengumuman & Broadcast", icon: Megaphone },
  { key: "portal", label: "Portal Penyewa", icon: Smartphone },
  { key: "penghuni", label: "Data Penghuni", icon: Users },
  { key: "kas", label: "Buku Kas", icon: Wallet },
  { key: "pengaturan", label: "Pengaturan", icon: Settings },
];

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
  property,
  ownerName,
  properties = [],
  onPropertyChange,
  invoiceAlerts,
  ticketAlerts,
  activeKey,
  onNavigate,
  onOpenDangerZone,
  staffSession,
  onStaffLogout,
  showSyncStatus = true,
  showSuperAdminNav = false,
  activePropertyType,
}: SidebarProps) {
  const isStaff = staffSession != null;
  const staffMeta = staffSession ? STAFF_ROLE_META[staffSession.role] : null;
  /** Jumlah pendaftar baru belum ditinjau (badge merah nav Super Admin) */
  const leadsAlert = useSyncExternalStore(
    subscribeLeadsAlert,
    getLeadsAlertSnapshot,
    getLeadsAlertServerSnapshot,
  );
  /** Penjaga: hanya denah + komplain + pengaturan; admin operasional: semua */
  const allowedKeys = isStaff && staffSession.role === "PENJAGA_TEKNISI"
    ? ["denah", "komplain", "pengaturan"]
    : NAV_ITEMS.map((n) => n.key);
  const visibleNav = NAV_ITEMS.filter((n) => allowedKeys.includes(n.key));
  /** Tipe properti aktif — Villa/Homestay → nav "Data Penghuni" jadi "Data Tamu / Penyewa" */
  const activePropertyTypeResolved =
    activePropertyType ?? properties.find((p) => p.name === property)?.type;
  const isVilla = isVillaType(activePropertyTypeResolved);
  const navLabel = (key: string, label: string): string =>
    key === "penghuni" && isVilla ? "Data Tamu / Penyewa" : label;
  /** Nama tampilan sesi aktif — staf dari sesi, owner dari profil Pengaturan */
  const displayName = isStaff ? staffSession.name : ownerName.trim() || "Owner";
  const userInitial = displayName
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          aria-hidden="true"
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-zinc-950/30 lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col border-r border-border bg-white transition-[width,transform] duration-200 ease-in-out",
          collapsed ? "w-[64px]" : "w-[240px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:translate-x-0"
        )}
      >
        {/* Brand — UnitKu */}
        <div
          className={cn(
            "flex min-h-14 items-center gap-2.5 border-b border-border px-3 py-2",
            collapsed && "justify-center px-0 py-0"
          )}
        >
          <Image
            src="/brand/icon.png"
            alt="Logo UnitKu"
            width={28}
            height={28}
            priority
            className="size-7 shrink-0 rounded-md object-contain ring-1 ring-zinc-200"
            title={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
          />
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="block text-[15px] font-extrabold tracking-tight text-zinc-900">{BRAND_NAME}</span>
              <span className="mt-0.5 block text-[12.5px] leading-4 text-zinc-700">{BRAND_TAGLINE}</span>
            </span>
          )}
        </div>

        {/* Property switcher — staf melihat properti penugasan (tanpa ganti) */}
        <div className={cn("border-b border-border p-2", collapsed && "px-1.5")}>
          {isStaff ? (
          <div
            className={cn(
              "flex w-full items-center gap-2 rounded-md p-2 text-left",
              collapsed && "justify-center p-1.5"
            )}
            aria-label="Properti penugasan"
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded bg-zinc-100 text-zinc-600",
                collapsed && "hidden"
              )}
            >
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" strokeLinecap="round" />
              </svg>
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold leading-4 text-zinc-900">{property}</span>
                <span className="block truncate text-xs leading-4 text-zinc-700">{staffMeta?.label} · Akses Terbatas</span>
              </span>
            )}
          </div>
          ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-zinc-50",
                  collapsed && "justify-center p-1.5"
                )}
                aria-label="Ganti properti"
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded bg-zinc-100 text-zinc-600",
                    collapsed && "hidden"
                  )}
                >
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" strokeLinecap="round" />
                  </svg>
                </span>
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold leading-4 text-zinc-900">{property}</span>
                      <span className="block truncate text-xs leading-4 text-zinc-700">
                      {(() => {
                        const active = properties.find((p) => p.name === property);
                        return active
                          ? `${active.unitCount} ${PROPERTY_TYPE_META[active.type].unit} · Owner`
                          : "Owner";
                      })()}
                    </span>
                    </span>
                    <ChevronsUpDown className="size-3.5 shrink-0 text-zinc-700" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs text-zinc-700">Properti Saya</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {properties.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => onPropertyChange(p.name)}
                  className="justify-between text-[13px]"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="text-xs tabular-nums text-zinc-700">
                    {p.unitCount} {PROPERTY_TYPE_META[p.type].unit}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>

        {/* Nav */}
        <nav className={cn("flex-1 space-y-0.5 overflow-y-auto p-2 scrollbar-thin", collapsed && "px-1.5")} aria-label="Navigasi utama">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = activeKey === item.key;
            const label = navLabel(item.key, item.label);
            return (
              <button
                key={item.key}
                title={collapsed ? label : undefined}
                onClick={() => onNavigate(item.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-[var(--ik-accent)] text-[var(--ik-accent-fg)]"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                )}
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{label}</span>
                    {item.key === "tagihan" && invoiceAlerts > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1 text-xs font-semibold tabular-nums text-amber-700">
                        {invoiceAlerts}
                      </span>
                    )}
                    {item.key === "komplain" && ticketAlerts > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1 text-xs font-semibold tabular-nums text-amber-700">
                        {ticketAlerts}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}

          {/* Panel Super Admin — hanya untuk sesi Super Admin (bukan staf);
              badge merah = pendaftar baru yang belum ditinjau */}
          {showSuperAdminNav && (
            <>
              <div aria-hidden="true" className="my-1 border-t border-border" />
              <a
                href="/admin"
                title={collapsed ? "Panel Super Admin" : undefined}
                className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
              >
                <span className="relative shrink-0">
                  <ShieldCheck className="size-[18px]" strokeWidth={1.75} />
                  {collapsed && leadsAlert.unread > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 size-2.5 rounded-full bg-red-500 ring-2 ring-white"
                    />
                  )}
                </span>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">Panel Super Admin</span>
                    {leadsAlert.unread > 0 && (
                      <span
                        aria-label={`${leadsAlert.unread} pendaftar baru belum ditinjau`}
                        className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold tabular-nums text-white"
                      >
                        {leadsAlert.unread > 9 ? "9+" : leadsAlert.unread}
                      </span>
                    )}
                  </>
                )}
              </a>
            </>
          )}
        </nav>

        {/* Footer: sync cloud + data management + profile + collapse */}
        <div className={cn("border-t border-border p-2", collapsed && "px-1.5")}>
          {showSyncStatus && (
            <CloudSyncBadge
              variant="sidebar"
              collapsed={collapsed}
              className={cn(!collapsed && "mb-1.5")}
            />
          )}
          {!isStaff && (
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "sm"}
              onClick={onOpenDangerZone}
              title={collapsed ? "Kelola Data / Reset Demo" : undefined}
              className={cn(
                "h-8 w-full justify-start gap-2 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-800",
                collapsed && "justify-center"
              )}
              aria-label="Kelola Data / Reset Demo"
            >
              <DatabaseBackup className="size-[18px] shrink-0" strokeWidth={1.75} />
              {!collapsed && <span className="text-[12.5px]">Kelola Data / Reset Demo</span>}
            </Button>
          )}
          <div className={cn("flex items-center gap-2 rounded-md p-1.5", collapsed && "justify-center p-1")}>
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                staffMeta ? staffMeta.pill : "border border-zinc-200 bg-zinc-100 text-zinc-600"
              )}
              aria-hidden="true"
            >
              {userInitial}
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[12.5px] font-semibold text-zinc-800">
                  {displayName}
                </span>
                <span className="block text-xs text-zinc-700">{isStaff ? staffMeta!.label : "Owner · Admin"}</span>
              </span>
            )}
            {isStaff && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onStaffLogout}
                className="size-7 shrink-0 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                aria-label="Keluar sesi staf"
                title="Keluar sesi staf"
              >
                <LogOut className="size-4" strokeWidth={1.75} />
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            onClick={onToggleCollapse}
            className={cn(
              "mt-1 h-8 w-full justify-start gap-2 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-800",
              collapsed && "justify-center"
            )}
            aria-label={collapsed ? "Buka sidebar" : "Ciutkan sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px]" strokeWidth={1.75} />
            ) : (
              <>
                <PanelLeftClose className="size-[18px]" strokeWidth={1.75} />
                <span className="text-[12.5px]">Ciutkan</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </>
  );
}
