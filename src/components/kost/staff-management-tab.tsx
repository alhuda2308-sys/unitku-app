"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Tab Pengaturan "Kelola Admin & Staf" (RBAC simulasi)
// Tabel staf & penjaga: Nama & Kontak · Peran (badge) · Akses Properti (chips)
// · Status Akun (badge) · Aksi kebab (Edit Izin, Ubah Password, Nonaktifkan,
// Hapus). Baris pertama = akun Owner (tidak dapat diubah/dihapus).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  Building2,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  UserRoundX,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ManagedProperty } from "@/lib/property-store";
import {
  STAFF_ROLE_META,
  STAFF_STATUS_META,
  type StaffMember,
  type StaffRole,
  type StaffStatus,
} from "@/lib/staff-store";
import { cn } from "@/lib/utils";

interface StaffManagementTabProps {
  properties: ManagedProperty[];
  staff: StaffMember[];
  /** Nomor WhatsApp aktif Owner — tampil pada baris akun utama */
  ownerWaPhone: string;
  onAdd: () => void;
  onEdit: (member: StaffMember) => void;
  onChangePassword: (member: StaffMember, password: string) => void;
  onToggleStatus: (member: StaffMember) => void;
  onDelete: (member: StaffMember) => void;
}

const ROLE_BADGE: Record<StaffRole, string> = {
  admin: "border-sky-200 bg-sky-50 text-sky-700",
  caretaker: "border-zinc-200 bg-zinc-100 text-zinc-600",
};

const STATUS_BADGE: Record<StaffStatus, string> = {
  aktif: "border-emerald-200 bg-emerald-50 text-emerald-700",
  menunggu: "border-amber-200 bg-amber-50 text-amber-700",
  nonaktif: "border-zinc-200 bg-zinc-100 text-zinc-500",
};

const STATUS_DOT: Record<StaffStatus, string> = {
  aktif: "bg-emerald-500",
  menunggu: "bg-amber-500",
  nonaktif: "bg-zinc-400",
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function RoleBadge({ role }: { role: StaffRole }) {
  return (
    <span
      className={cn(
        "inline-flex h-[20px] items-center gap-1 rounded-full border px-2 text-[10.5px] font-semibold",
        ROLE_BADGE[role]
      )}
    >
      {role === "admin" ? (
        <ShieldCheck className="size-3" strokeWidth={2} aria-hidden="true" />
      ) : (
        <WrenchIcon />
      )}
      {STAFF_ROLE_META[role].label}
    </span>
  );
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusBadge({ status }: { status: StaffStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-[20px] items-center gap-1.5 rounded-full border px-2 text-[10.5px] font-semibold",
        STATUS_BADGE[status]
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} aria-hidden="true" />
      {STAFF_STATUS_META[status].label}
    </span>
  );
}

function PropertyChips({ member, properties }: { member: StaffMember; properties: ManagedProperty[] }) {
  const names = member.propertyIds
    .map((id) => properties.find((p) => p.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  if (names.length === 0) {
    return <span className="text-[12px] text-zinc-300">—</span>;
  }
  return (
    <div className="flex max-w-[240px] flex-wrap gap-1">
      {names.slice(0, 2).map((n) => (
        <span
          key={n}
          className="inline-flex h-[20px] max-w-[150px] items-center gap-1 rounded-full border border-border bg-zinc-50 px-2 text-[10.5px] font-medium text-zinc-600"
        >
          <Building2 className="size-2.5 shrink-0 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
          <span className="truncate">{n}</span>
        </span>
      ))}
      {names.length > 2 && (
        <span className="inline-flex h-[20px] items-center rounded-full border border-border bg-white px-2 text-[10.5px] font-semibold tabular-nums text-zinc-500">
          +{names.length - 2}
        </span>
      )}
    </div>
  );
}

export function StaffManagementTab({
  properties,
  staff,
  ownerWaPhone,
  onAdd,
  onEdit,
  onChangePassword,
  onToggleStatus,
  onDelete,
}: StaffManagementTabProps) {
  const [confirmDelete, setConfirmDelete] = useState<StaffMember | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const openPasswordDialog = (member: StaffMember) => {
    setPasswordTarget(member);
    setNewPassword("");
  };

  const submitPassword = () => {
    if (!passwordTarget || newPassword.length < 6) return;
    onChangePassword(passwordTarget, newPassword);
    setPasswordTarget(null);
    setNewPassword("");
  };

  const rowMenu = (m: StaffMember) => (
    <>
      <DropdownMenuItem onClick={() => onEdit(m)} className="gap-2 text-[13px]">
        <Pencil className="size-4 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
        Edit Izin Properti
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => openPasswordDialog(m)} className="gap-2 text-[13px]">
        <KeyRound className="size-4 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
        Ubah Password
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => onToggleStatus(m)} className="gap-2 text-[13px]">
        <UserRoundX className="size-4 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
        {m.status === "aktif" ? "Nonaktifkan Akun" : "Aktifkan Akun"}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => setConfirmDelete(m)}
        className="gap-2 text-[13px] text-red-600 focus:bg-red-50 focus:text-red-700"
      >
        <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
        Hapus Staf
      </DropdownMenuItem>
    </>
  );

  /** Baris kontak staf: nomor WhatsApp AKTIF + email kontak bila ada */
  const contactCell = (m: StaffMember) => {
    const isEmail = m.contact.includes("@");
    return (
      <>
        <p className="text-[11.5px] tabular-nums text-zinc-500">
          {m.phone ? `WA ${m.phone}` : isEmail ? "WA belum diisi" : `WA ${m.contact}`}
        </p>
        {isEmail && <p className="truncate text-[11px] text-zinc-400">{m.contact}</p>}
      </>
    );
  };

  return (
    <div className="space-y-3">
      {/* Kartu daftar staf */}
      <section className="overflow-hidden rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-[13.5px] font-bold tracking-tight text-zinc-900">
              Manajemen Admin &amp; Penjaga Kost
            </h2>
            <p className="mt-0.5 text-[11.5px] text-zinc-500">
              Atur hak akses staf dan batasi properti yang dikelola
            </p>
          </div>
          <Button
            onClick={onAdd}
            className="h-8 bg-zinc-900 px-2.5 text-[12.5px] font-semibold text-white shadow-none hover:bg-zinc-800"
          >
            <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
            Tambah Admin Baru
          </Button>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Nama &amp; Kontak</th>
                <th className="px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Peran / Role</th>
                <th className="px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Akses</th>
                <th className="px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Status Akun</th>
                <th className="py-2 pl-2.5 pr-2 text-right text-[11px] font-bold uppercase tracking-wider text-zinc-400">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {/* Baris Owner — akun utama */}
              <tr className="border-b border-border bg-zinc-50/40">
                <td className="px-2.5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-violet-100 text-[11px] font-bold text-violet-700"
                      aria-hidden="true"
                    >
                      HW
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-zinc-900">Hendra Wijaya</p>
                      <p className="text-[11.5px] tabular-nums text-zinc-500">WA {ownerWaPhone || "belum diisi"}</p>
                      <p className="text-[11.5px] text-zinc-500">hendra@indokost.id</p>
                    </div>
                  </div>
                </td>
                <td className="px-2.5 py-3">
                  <span className="inline-flex h-[20px] items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 text-[10.5px] font-semibold text-violet-700">
                    <UserRound className="size-3" strokeWidth={2} aria-hidden="true" />
                    Owner
                  </span>
                </td>
                <td className="px-2.5 py-3">
                  <span className="inline-flex h-[20px] items-center rounded-full border border-violet-200 bg-violet-50 px-2 text-[10.5px] font-medium text-violet-600">
                    Semua Properti ({properties.length})
                  </span>
                </td>
                <td className="px-2.5 py-3">
                  <StatusBadge status="aktif" />
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[11px] italic text-zinc-400">Akun utama</span>
                </td>
              </tr>

              {/* Baris staf */}
              {staff.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 transition-colors hover:bg-zinc-50/60">
                  <td className="px-2.5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-[11px] font-bold text-zinc-600"
                        aria-hidden="true"
                      >
                        {initialsOf(m.name)}
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold text-zinc-900">{m.name}</p>
                        {contactCell(m)}
                      </div>
                    </div>
                  </td>
                  <td className="px-2.5 py-3">
                    <RoleBadge role={m.role} />
                  </td>
                  <td className="px-2.5 py-3">
                    <PropertyChips member={m} properties={properties} />
                  </td>
                  <td className="px-2.5 py-3">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                          aria-label={`Aksi untuk ${m.name}`}
                        >
                          <MoreHorizontal className="size-4" strokeWidth={1.75} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        {rowMenu(m)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}

              {staff.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2.5 py-8 text-center">
                    <p className="text-[12.5px] font-medium text-zinc-500">Belum ada staf terdaftar</p>
                    <p className="mt-0.5 text-[11.5px] text-zinc-400">
                      Tambahkan admin atau penjaga untuk mendelegasikan pengelolaan cabang.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-border md:hidden">
          {/* Owner card */}
          <div className="flex items-center gap-2.5 px-3.5 py-3">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-violet-100 text-[11px] font-bold text-violet-700"
              aria-hidden="true"
            >
              HW
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-zinc-900">Hendra Wijaya</p>
              <p className="truncate text-[11.5px] tabular-nums text-zinc-500">WA {ownerWaPhone || "belum diisi"}</p>
              <p className="truncate text-[11.5px] text-zinc-500">hendra@indokost.id</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span className="inline-flex h-[20px] items-center rounded-full border border-violet-200 bg-violet-50 px-2 text-[10.5px] font-semibold text-violet-700">
                  Owner
                </span>
                <StatusBadge status="aktif" />
              </div>
            </div>
            <span className="text-[11px] italic text-zinc-400">Akun utama</span>
          </div>
          {staff.map((m) => (
            <div key={m.id} className="space-y-2 px-3.5 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-[11px] font-bold text-zinc-600"
                    aria-hidden="true"
                  >
                    {initialsOf(m.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-zinc-900">{m.name}</p>
                    {contactCell(m)}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                      aria-label={`Aksi untuk ${m.name}`}
                    >
                      <MoreHorizontal className="size-4" strokeWidth={1.75} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {rowMenu(m)}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <RoleBadge role={m.role} />
                <StatusBadge status={m.status} />
              </div>
              <PropertyChips member={m} properties={properties} />
            </div>
          ))}
          {staff.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-[12.5px] font-medium text-zinc-500">Belum ada staf terdaftar</p>
              <p className="mt-0.5 text-[11.5px] text-zinc-400">
                Tambahkan admin atau penjaga untuk mendelegasikan cabang.
              </p>
            </div>
          )}
        </div>
      </section>

      <p className="text-[11.5px] leading-4 text-zinc-400">
        Simulasi RBAC: gunakan menu <span className="font-semibold text-zinc-500">Ganti Akun</span> pada
        panel profil di kiri bawah sidebar untuk masuk sebagai staf dan merasakan pembatasan aksesnya.
      </p>

      {/* Konfirmasi hapus staf */}
      <AlertDialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">
              Hapus staf {confirmDelete?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12.5px] leading-5">
              Akun {confirmDelete?.name} ({confirmDelete ? STAFF_ROLE_META[confirmDelete.role].label : ""}) akan
              dihapus permanen dan keluar dari daftar staf. Riwayat aktivitas pada propertinya tetap tersimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 border-zinc-200 bg-white text-[13px] text-zinc-700 shadow-none hover:bg-zinc-100">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-9 bg-red-600 text-[13px] font-semibold text-white shadow-none hover:bg-red-700"
              onClick={() => {
                if (confirmDelete) onDelete(confirmDelete);
                setConfirmDelete(null);
              }}
            >
              Ya, Hapus Staf
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog ubah password */}
      <Dialog open={passwordTarget !== null} onOpenChange={(o) => !o && setPasswordTarget(null)}>
        <DialogContent className="gap-0 bg-white p-0 sm:max-w-[400px]">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-900">
              <KeyRound className="size-4 text-zinc-600" strokeWidth={2} aria-hidden="true" />
              Ubah Password — {passwordTarget?.name}
            </DialogTitle>
            <DialogDescription className="text-[12px] text-zinc-500">
              Password baru menimpa password sementara sebelumnya. Bagikan ke staf via WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-zinc-50 px-5 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="stf-newpass" className="text-[12px] text-zinc-600">
                Password Baru <span className="text-red-500">*</span>
              </Label>
              <Input
                id="stf-newpass"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPassword.length >= 6) submitPassword();
                }}
                placeholder="Minimal 6 karakter"
                autoFocus
                className="h-9 border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-zinc-900/5"
              />
              {newPassword.length > 0 && newPassword.length < 6 && (
                <p className="text-[11px] font-medium text-red-600">Password minimal 6 karakter.</p>
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-border bg-white px-5 py-4">
            <div className="flex w-full items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 border-zinc-200 bg-white px-3.5 text-[13px] font-medium text-zinc-700 shadow-none hover:bg-zinc-100"
                onClick={() => setPasswordTarget(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={newPassword.length < 6}
                onClick={submitPassword}
                className="h-9 bg-zinc-900 px-3.5 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800 disabled:opacity-50"
              >
                Simpan Password
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
