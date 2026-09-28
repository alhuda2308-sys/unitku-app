"use client";

/**
 * "Kelola Staf" — pendaftaran & manajemen akses staf mandiri.
 *
 * Owner membuat staf + link akses unik /staff?token=…, menyalin/mengirimnya
 * via WhatsApp, dan mencabut akses saat staf berhenti. Data persist di
 * localStorage (unitku:staff-access:v1) — model Prisma StaffMember siap di
 * Supabase untuk backend nyata.
 */

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
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
import type { PropertyEntry } from "@/lib/app-settings";
import {
  addStaffAccess,
  deleteStaffAccess,
  setStaffAccessActive,
  staffPortalLink,
  STAFF_ROLES,
  STAFF_ROLE_META,
  subscribeStaffAccess,
  getStaffAccessSnapshot,
  getServerStaffAccessSnapshot,
  waInviteLink,
  type StaffAccessMember,
  type StaffAccessRole,
} from "@/lib/staff-access";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

interface StaffAccessManagerProps {
  properties: PropertyEntry[];
  activePropertyId: string;
}

export function StaffAccessManager({ properties, activePropertyId }: StaffAccessManagerProps) {
  const members = useSyncExternalStore(
    subscribeStaffAccess,
    getStaffAccessSnapshot,
    getServerStaffAccessSnapshot,
  );

  // Origin dinamis — komponen hanya dirender di klien (dalam dashboard)
  const [origin] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.location.origin,
  );

  // ── Form tambah staf ──
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffAccessRole>("ADMIN_OPERASIONAL");
  /** id staf yang baru dibuat — link box-nya diberi highlight */
  const [freshId, setFreshId] = useState<string | null>(null);

  const activeProperty = properties.find((p) => p.id === activePropertyId) ?? properties[0];
  const nameTaken = members.some(
    (m) => m.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  const phoneDigits = phone.replace(/[^0-9]/g, "");
  const valid = name.trim().length >= 3 && !nameTaken && phoneDigits.length >= 9;

  const submit = () => {
    if (!valid) return;
    const member = addStaffAccess({
      name,
      phone: formatPhoneInput(phoneDigits),
      role,
      propertyId: activeProperty?.id ?? "",
    });
    setName("");
    setPhone("");
    setRole("ADMIN_OPERASIONAL");
    setFreshId(member.id);
    toast.success(`Link akses staf dibuat untuk ${member.name}`, {
      description: "Salin atau kirim tautan via WhatsApp — staf langsung bisa masuk.",
    });
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
    const url = waInviteLink(m.phone, m.name, linkOf(m));
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const toggleActive = (m: StaffAccessMember) => {
    setStaffAccessActive(m.id, !m.isActive);
    toast.success(
      m.isActive ? `Akses ${m.name} dicabut` : `Akses ${m.name} diaktifkan kembali`,
      {
        description: m.isActive
          ? "Tautan staf tidak bisa dipakai login sampai diaktifkan lagi."
          : "Tautan lama berfungsi kembali — staf bisa masuk lagi.",
      },
    );
  };

  const removeMember = (m: StaffAccessMember) => {
    deleteStaffAccess(m.id);
    toast.success(`${m.name} dihapus permanen`, {
      description: "Tautan akses & sesi perangkat staf ikut dinonaktifkan.",
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
          Buat link akses unik untuk staf — berlaku untuk properti{" "}
          <span className="font-semibold text-zinc-800">{activeProperty?.name ?? "—"}</span>.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-[1fr_1fr_200px]">
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
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs leading-4 text-zinc-600">
            Token dibuat otomatis &amp; unik per staf — bisa dicabut kapan saja.
          </p>
          <Button
            onClick={submit}
            disabled={!valid}
            className="h-9 bg-[var(--ik-accent)] px-3 text-[12.5px] font-semibold text-[var(--ik-accent-fg)] shadow-none hover:bg-[var(--ik-accent-hover)]"
          >
            <UserRoundPlus className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Buat Link Akses Staf
          </Button>
        </div>
      </section>

      {/* ── Daftar staf ── */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold uppercase tracking-wider text-zinc-700">
          Daftar Staf &amp; Akses
        </h3>
        <p className="text-[12.5px] font-medium tabular-nums text-zinc-700">
          {members.filter((m) => m.isActive).length} aktif · {members.length} total
        </p>
      </div>

      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
          <KeyRound className="mx-auto size-7 text-zinc-300" strokeWidth={1.5} aria-hidden="true" />
          <p className="mt-2 text-[13px] font-semibold text-zinc-700">Belum ada staf terdaftar</p>
          <p className="mt-1 text-[12.5px] text-zinc-600">
            Buat link akses pertama — staf bisa langsung bertugas tanpa berbagi akun owner.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: tabel */}
        <div className="hidden overflow-hidden rounded-lg border border-border bg-white md:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-zinc-50 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <th className="px-3.5 py-2.5 font-bold">Staf</th>
                <th className="px-3 py-2.5 font-bold">Peran</th>
                <th className="px-3 py-2.5 font-bold">Kontak</th>
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
                        "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold leading-none",
                        STAFF_ROLE_META[m.role].pill,
                      )}
                    >
                      {STAFF_ROLE_META[m.role].label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[12.5px] tabular-nums text-zinc-700">{m.phone}</td>
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
                  <td className="px-3.5 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {m.isActive ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleActive(m)}
                          className="h-7 gap-1 border-zinc-200 bg-white px-2 text-[12px] font-semibold text-red-600 shadow-none hover:bg-red-50 hover:text-red-700"
                        >
                          <ShieldOff className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          Cabut Akses
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleActive(m)}
                          className="h-7 gap-1 border-zinc-200 bg-white px-2 text-[12px] font-semibold text-emerald-700 shadow-none hover:bg-emerald-50"
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

              <div className="mt-2 flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold leading-none",
                    STAFF_ROLE_META[m.role].pill,
                  )}
                >
                  {STAFF_ROLE_META[m.role].label}
                </span>
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
        "flex items-center gap-1.5 rounded-md border bg-zinc-50 py-1 pl-2 pr-1",
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
