"use client";

/**
 * "Kelola Staf" — pendaftaran & manajemen akses staf mandiri.
 *
 * Owner membuat staf + link akses unik /staff?token=… + PIN keamanan 6 digit,
 * menyalin/mengirimnya via WhatsApp, dan mencabut akses saat staf berhenti.
 * Data persist di tabel `staff_members` (Supabase) via Route Handler
 * /api/staff — tersinkron lintas perangkat; sesi perangkat tetap di localStorage.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Dices,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserRoundPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api-client";
import type { PropertyEntry } from "@/lib/app-settings";
import {
  clearStaffSession,
  generatePin,
  getStaffSessionSnapshot,
  isValidPinFormat,
  maskPin,
  staffPortalLink,
  STAFF_ROLES,
  STAFF_ROLE_META,
  waInviteLink,
  type StaffAccessMember,
  type StaffAccessRole,
} from "@/lib/staff-access";
import { cn } from "@/lib/utils";
import { openExternal } from "@/lib/open-external";

interface StaffAccessManagerProps {
  properties: PropertyEntry[];
  activePropertyId: string;
}

export function StaffAccessManager({ properties, activePropertyId }: StaffAccessManagerProps) {
  // ── Daftar staf dari database via GET /api/staff (tabel staff_members) ──
  const [members, setMembers] = useState<StaffAccessMember[] | null>(null);
  const [saving, setSaving] = useState(false);

  const loadMembers = (onFail?: () => void) => {
    api
      .getStaff()
      // ?? [] — respons tanpa array `staff` (degraded/bentuk tak terduga) tidak
      // boleh menyetel undefined: state selain null/array menghancurkan render
      // (members.length crash) seluruh tab Pengaturan.
      .then((res) => setMembers(res.staff ?? []))
      .catch((err: unknown) => {
        toast.error("Gagal memuat daftar staf", {
          description: err instanceof Error ? err.message : "Periksa koneksi database.",
        });
        setMembers((prev) => prev ?? []);
        onFail?.();
      });
  };

  useEffect(() => {
    loadMembers();
  }, []);

  // Origin dinamis — komponen hanya dirender di klien (dalam dashboard)
  const [origin] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.location.origin,
  );

  // ── Form tambah staf ──
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffAccessRole>("ADMIN_OPERASIONAL");
  const [pin, setPin] = useState("");
  /** id staf yang baru dibuat — link box-nya diberi highlight */
  const [freshId, setFreshId] = useState<string | null>(null);

  const activeProperty = properties.find((p) => p.id === activePropertyId) ?? properties[0];
  const nameTaken = (members ?? []).some(
    (m) => m.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  const phoneDigits = phone.replace(/[^0-9]/g, "");
  const pinOk = isValidPinFormat(pin);
  const valid =
    name.trim().length >= 3 && !nameTaken && phoneDigits.length >= 9 && pinOk && !saving;

  const submit = () => {
    if (!valid) return;
    setSaving(true);
    api
      .addStaff({
        name,
        phone: formatPhoneInput(phoneDigits),
        role,
        propertyId: activeProperty?.id ?? "",
        accessPin: pin,
      })
      .then(({ member }) => {
        setMembers((prev) => [member, ...(prev ?? [])]);
        setName("");
        setPhone("");
        setRole("ADMIN_OPERASIONAL");
        setPin("");
        setFreshId(member.id);
        toast.success(`Link akses staf dibuat untuk ${member.name}`, {
          description: "Token & PIN tersimpan di database — kirim tautan + PIN via WhatsApp.",
        });
      })
      .catch((err: unknown) => {
        toast.error("Gagal membuat staf", {
          description: err instanceof Error ? err.message : "Coba lagi sebentar.",
        });
      })
      .finally(() => setSaving(false));
  };

  const linkOf = (m: StaffAccessMember) => staffPortalLink(m.accessToken, origin ?? undefined);

  const copyLink = async (m: StaffAccessMember) => {
    try {
      await navigator.clipboard.writeText(linkOf(m));
      toast.success("Link akses disalin", {
        description: `${m.name} — tempel di chat WA/email staf.`,
      });
    } catch {
      toast.error("Gagal menyalin", { description: "Salin manual dari kotak tautan." });
    }
  };

  const sendWa = (m: StaffAccessMember) => {
    const url = waInviteLink(m.phone, m.name, linkOf(m), m.accessPin);
    openExternal(url);
  };

  const toggleActive = (m: StaffAccessMember) => {
    const next = !m.isActive;
    // Optimistic + clear sesi lokal bila token perangkat ini yang dicabut
    setMembers((prev) =>
      prev?.map((x) => (x.id === m.id ? { ...x, isActive: next } : x)) ?? prev,
    );
    if (!next && getStaffSessionSnapshot()?.accessToken === m.accessToken) {
      clearStaffSession();
    }
    api
      .setStaffActive(m.id, next)
      .then(() => {
        toast.success(
          next ? `Akses ${m.name} diaktifkan kembali` : `Akses ${m.name} dicabut`,
          {
            description: next
              ? "Tautan lama berfungsi kembali — staf bisa masuk lagi."
              : "Tautan staf tidak bisa dipakai login sampai diaktifkan lagi.",
          },
        );
      })
      .catch((err: unknown) => {
        toast.error("Gagal mengubah status akses", {
          description: err instanceof Error ? err.message : "Sinkron ulang daftar staf.",
        });
        loadMembers();
      });
  };

  const removeMember = (m: StaffAccessMember) => {
    setMembers((prev) => prev?.filter((x) => x.id !== m.id) ?? prev);
    if (getStaffSessionSnapshot()?.accessToken === m.accessToken) clearStaffSession();
    toast.success(`${m.name} dihapus permanen`, {
      description: "Data staf dihapus dari database — sesi perangkatnya ikut dinonaktifkan.",
    });
    api.deleteStaff(m.id).catch((err: unknown) => {
      toast.error("Gagal menghapus staf di database", {
        description: err instanceof Error ? err.message : "Sinkron ulang daftar staf.",
      });
      loadMembers();
    });
  };

  return (
    <div className="max-w-[880px] space-y-4">
      {/* ── Penjelasan peran ── */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {STAFF_ROLES.map((r) => {
          const meta = STAFF_ROLE_META[r];
          return (
            <div key={r} className="rounded-lg border border-border bg-white p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold leading-none",
                    meta.pill,
                  )}
                >
                  {meta.label}
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-4 text-zinc-600">{meta.desc}</p>
              <ul className="mt-2 space-y-1">
                {meta.permissions.map((p) => (
                  <li
                    key={p}
                    className="flex items-start gap-1.5 text-[12.5px] leading-4 text-zinc-700"
                  >
                    <ShieldCheck
                      className="mt-0.5 size-3.5 shrink-0 text-emerald-600"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* ── Form Tambah Staf Baru ── */}
      <section className="rounded-lg border border-border bg-white p-4" aria-label="Tambah staf baru">
        <h3 className="text-[13px] font-bold uppercase tracking-wider text-zinc-700">
          Tambah Staf Baru
        </h3>
        <p className="mt-0.5 text-[12.5px] text-zinc-600">
          Buat link akses unik + PIN keamanan untuk staf — berlaku untuk properti{" "}
          <span className="font-semibold text-zinc-800">{activeProperty?.name ?? "—"}</span>.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-[1fr_1fr_200px_220px]">
          <div className="space-y-1">
            <label htmlFor="staff-name" className="text-[12.5px] font-medium text-zinc-700">
              Nama Lengkap Staf
            </label>
            <Input
              id="staff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth. Ratna Sari"
              className="h-9 border-zinc-200 bg-white text-[13px]"
              autoComplete="off"
            />
            {nameTaken && (
              <p className="text-xs leading-4 text-red-600">Nama sudah dipakai staf lain.</p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor="staff-phone" className="text-[12.5px] font-medium text-zinc-700">
              Nomor WhatsApp
            </label>
            <Input
              id="staff-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+62 / 08…"
              inputMode="tel"
              className="h-9 border-zinc-200 bg-white text-[13px] tabular-nums"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[12.5px] font-medium text-zinc-700">Role / Peran</span>
            <Select value={role} onValueChange={(v) => setRole(v as StaffAccessRole)}>
              <SelectTrigger className="h-9 w-full border-zinc-200 bg-white text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="text-[12.5px]">
                    {STAFF_ROLE_META[r].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="staff-pin" className="text-[12.5px] font-medium text-zinc-700">
              PIN Akses (6 Digit Angka)
            </label>
            <div className="relative">
              <Input
                id="staff-pin"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                placeholder="cth. 123456"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                className="h-9 border-zinc-200 bg-white pr-[74px] text-[13px] tabular-nums tracking-[0.2em]"
              />
              <button
                type="button"
                onClick={() => setPin(generatePin())}
                title="Acak PIN — generate 6 angka acak otomatis"
                aria-label="Acak PIN"
                className="absolute right-1 top-1/2 flex h-7 -translate-y-1/2 items-center gap-1 rounded-md bg-zinc-100 px-1.5 text-[11px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-200"
              >
                <Dices className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                Acak PIN
              </button>
            </div>
            {pin.length > 0 && !pinOk && (
              <p className="text-xs leading-4 text-red-600">PIN harus tepat 6 angka.</p>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs leading-4 text-zinc-600">
            Token unik &amp; PIN dibuat per staf — staf wajib verifikasi PIN saat membuka
            tautan; akses bisa dicabut kapan saja.
          </p>
          <Button
            onClick={submit}
            disabled={!valid}
            className="h-9 bg-[var(--ik-accent)] px-3 text-[12.5px] font-semibold text-[var(--ik-accent-fg)] shadow-none hover:bg-[var(--ik-accent-hover)]"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <UserRoundPlus className="size-4" strokeWidth={1.75} aria-hidden="true" />
            )}
            {saving ? "Menyimpan…" : "Buat Link Akses Staf"}
          </Button>
        </div>
      </section>

      {/* ── Daftar staf ── */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold uppercase tracking-wider text-zinc-700">
          Daftar Staf &amp; Akses
        </h3>
        <p className="text-[12.5px] font-medium tabular-nums text-zinc-700">
          {(members ?? []).filter((m) => m.isActive).length} aktif · {(members ?? []).length} total
        </p>
      </div>

      {members === null ? (
        <div
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-[12.5px] font-medium text-zinc-600"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-4 animate-spin text-zinc-400" strokeWidth={2} aria-hidden="true" />
          Memuat daftar staf dari database…
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
          <KeyRound className="mx-auto size-7 text-zinc-300" strokeWidth={1.5} aria-hidden="true" />
          <p className="mt-2 text-[13px] font-semibold text-zinc-700">Belum ada staf terdaftar</p>
          <p className="mt-1 text-[12.5px] text-zinc-600">
            Buat link akses pertama — staf bisa langsung bertugas tanpa berbagi akun owner.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: tabel — table-fixed + colgroup proporsional agar SEMUA
              kolom (termasuk tombol "Cabut Akses") muat tanpa terpotong di
              lebar normal; overflow-x-auto menjaga layar sempit tetap rapi */}
        <div className="hidden overflow-hidden rounded-lg border border-border bg-white md:block">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] table-fixed text-left">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[18%]" />
              <col className="w-[12%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[16%]" />
              <col className="w-[21%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-zinc-50 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <th className="px-3.5 py-2.5 font-bold">Staf</th>
                <th className="px-3 py-2.5 font-bold">Peran</th>
                <th className="px-3 py-2.5 font-bold">Kontak</th>
                <th className="px-3 py-2.5 font-bold">PIN</th>
                <th className="px-3 py-2.5 font-bold">Status</th>
                <th className="px-3 py-2.5 font-bold">Link Akses Staf</th>
                <th className="px-3.5 py-2.5 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={m.id}
                  className={cn(
                    "border-b border-border/70 last:border-0 align-middle",
                    !m.isActive && "bg-zinc-50/70",
                  )}
                >
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
                          STAFF_ROLE_META[m.role].pill,
                        )}
                        aria-hidden="true"
                      >
                        {initials(m.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-zinc-900">{m.name}</p>
                        <p className="text-[11px] leading-3 text-zinc-500">
                          {properties.find((p) => p.id === m.propertyId)?.name ?? "Semua cabang"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
                        STAFF_ROLE_META[m.role].pill,
                      )}
                    >
                      {STAFF_ROLE_META[m.role].label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[12.5px] tabular-nums text-zinc-700">{m.phone}</td>
                  <td className="px-3 py-3">
                    <PinDisplay pin={m.accessPin} />
                  </td>
                  <td className="px-3 py-3">
                    {m.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700">
                        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-zinc-500">
                        <span className="size-1.5 rounded-full bg-zinc-400" aria-hidden="true" />
                        Nonaktif
                      </span>
                    )}
                  </td>
                  <td className="max-w-[240px] px-3 py-3">
                    <LinkBox link={linkOf(m)} onCopy={() => copyLink(m)} highlight={m.id === freshId} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {m.isActive ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleActive(m)}
                          className="h-7 shrink-0 gap-1 whitespace-nowrap border-zinc-200 bg-white px-1.5 text-[12px] font-semibold text-red-600 shadow-none hover:bg-red-50 hover:text-red-700"
                        >
                          <ShieldOff className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          Cabut Akses
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleActive(m)}
                          className="h-7 shrink-0 gap-1 whitespace-nowrap border-zinc-200 bg-white px-1.5 text-[12px] font-semibold text-emerald-700 shadow-none hover:bg-emerald-50"
                        >
                          <ShieldCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          Aktifkan Lagi
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-zinc-500 shadow-none hover:bg-zinc-100"
                            aria-label={`Menu lain untuk ${m.name}`}
                          >
                            <MoreHorizontal className="size-4" strokeWidth={1.75} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => sendWa(m)} className="text-[12.5px]">
                            Kirim via WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyLink(m)} className="text-[12.5px]">
                            Salin Tautan
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => removeMember(m)}
                            className="text-[12.5px] text-red-600 focus:text-red-700"
                          >
                            Hapus Permanen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Mobile: kartu */}
        <div className="space-y-2.5 md:hidden">
          {members.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-lg border border-border bg-white p-3.5",
                !m.isActive && "bg-zinc-50/70",
                m.id === freshId && "border-[var(--ik-accent-border)] bg-[var(--ik-accent-soft)]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white",
                      STAFF_ROLE_META[m.role].pill,
                    )}
                    aria-hidden="true"
                  >
                    {initials(m.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-zinc-900">{m.name}</p>
                    <p className="text-[11.5px] tabular-nums text-zinc-600">{m.phone}</p>
                  </div>
                </div>
                {m.isActive ? (
                  <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700">
                    <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    Aktif
                  </span>
                ) : (
                  <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 text-[11px] font-semibold text-zinc-500">
                    <span className="size-1.5 rounded-full bg-zinc-400" aria-hidden="true" />
                    Nonaktif
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
                    STAFF_ROLE_META[m.role].pill,
                  )}
                >
                  {STAFF_ROLE_META[m.role].label}
                </span>
                <PinDisplay pin={m.accessPin} />
                <span className="truncate text-[11px] text-zinc-500">
                  {properties.find((p) => p.id === m.propertyId)?.name ?? "Semua cabang"}
                </span>
              </div>

              <div className="mt-2.5">
                <LinkBox link={linkOf(m)} onCopy={() => copyLink(m)} highlight={m.id === freshId} />
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => sendWa(m)}
                  className="h-9 rounded-xl border-zinc-300 bg-white px-3 text-[12.5px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
                >
                  Kirim via WhatsApp
                </Button>
                {m.isActive ? (
                  <Button
                    variant="outline"
                    onClick={() => toggleActive(m)}
                    className="h-9 rounded-xl border-zinc-300 bg-white px-3 text-[12.5px] font-medium text-red-600 shadow-none hover:bg-red-50"
                  >
                    <ShieldOff className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    Cabut Akses
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => toggleActive(m)}
                    className="h-9 rounded-xl border-zinc-300 bg-white px-3 text-[12.5px] font-medium text-emerald-700 shadow-none hover:bg-emerald-50"
                  >
                    <ShieldCheck className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    Aktifkan Lagi
                  </Button>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeMember(m)}
                className="mt-2 w-full rounded-md py-1.5 text-center text-[11.5px] font-medium text-zinc-500 hover:bg-red-50 hover:text-red-600"
              >
                Hapus permanen
              </button>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}

// ── Sub-komponen ─────────────────────────────────────────────────────────────

/** Tampilan PIN owner: tersembunyi "••••56" + ikon mata utk intip */
function PinDisplay({ pin, className }: { pin: string; className?: string }) {
  const [revealed, setRevealed] = useState(false);
  const valid = isValidPinFormat(pin);
  const label = revealed ? "Sembunyikan PIN" : "Intip PIN";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-zinc-50 py-0.5 pl-1.5 pr-0.5",
        className,
      )}
    >
      <span
        className={cn(
          "font-mono text-[11.5px] leading-4 tabular-nums",
          revealed ? "font-semibold text-zinc-900" : "text-zinc-600",
        )}
        aria-label={revealed ? "PIN staf" : "PIN staf (tersembunyi)"}
      >
        {valid ? (revealed ? pin : maskPin(pin)) : "——"}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-label={label}
        aria-pressed={revealed}
        title={label}
        disabled={!valid}
        className="flex size-5 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-700 disabled:opacity-40"
      >
        {revealed ? (
          <EyeOff className="size-3" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Eye className="size-3" strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
    </span>
  );
}

/** Kotak tautan akses: mono + tombol salin (highlight saat baru dibuat) */
function LinkBox({
  link,
  onCopy,
  highlight,
}: {
  link: string;
  onCopy: () => void;
  highlight: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const display = useMemo(() => shortenLink(link), [link]);
  return (
    <div
      className={cn(
        "flex w-44 max-w-full items-center gap-1.5 rounded-md border bg-zinc-50 py-1 pl-2 pr-1",
        highlight ? "border-[var(--ik-accent)]" : "border-border",
      )}
      title={link}
    >
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] leading-4 text-zinc-600">
        {display}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onCopy();
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
        className="h-6 shrink-0 gap-1 border-zinc-200 bg-white px-1.5 text-[11px] font-semibold text-zinc-700 shadow-none hover:bg-zinc-100"
        aria-label="Salin tautan akses staf"
      >
        {copied ? (
          <Check className="size-3 text-emerald-600" strokeWidth={2} aria-hidden="true" />
        ) : (
          <Copy className="size-3" strokeWidth={2} aria-hidden="true" />
        )}
        Salin
      </Button>
    </div>
  );
}

/** "https://host/staff?token=stk_…" → "host/staff?token=stk_…" (hemat kolom) */
function shortenLink(link: string): string {
  return link.replace(/^https?:\/\//, "");
}

function initials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "S"
  );
}

/** "0813…" / "62813…" → "+62 813…" — display konsisten, wa.me tetap dinormalisasi */
function formatPhoneInput(digits: string): string {
  let d = digits;
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  if (d.startsWith("62")) return `+62 ${d.slice(2)}`;
  return d;
}
