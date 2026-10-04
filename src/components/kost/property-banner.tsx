"use client";

import { useRef } from "react";
import { Camera, ImagePlus, MapPin, PencilLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROPERTY_TYPE_META, type PropertyProfile } from "@/lib/app-settings";
import { cn } from "@/lib/utils";

interface PropertyBannerProps {
  profile: PropertyProfile;
  /** Jumlah unit live dari dataset kamar. -1 = masih sinkron awal → tampil "···"
   *  (bukan 0) agar pill tidak berkedip nilai salah sebelum data tiba. */
  unitCount: number;
  onGantiFoto: (file: File) => void;
  /** Kelola properti — owner only; undefined = sembunyikan (sesi staf) */
  onKelola?: () => void;
  /** Nama pengguna aktif — tampil pada kartu identitas (desktop & ponsel) */
  ownerName: string;
  /** Role pengguna aktif (Owner / Staff Admin) */
  ownerRole?: string;
}

/**
 * Property Identity Banner — kartu identitas properti di atas Denah Kamar.
 * Foto (80×80 desktop / 96×96 mobile) + nama + pill solid tipe·unit + alamat.
 * Border & badge mengikuti tema solid aktif (--ik-accent-*).
 * Ganti Foto tidak lagi berupa tombol di banner: desktop memakai hover overlay
 * pada foto & menu Pengaturan → Profil Properti; posisinya digantikan kartu
 * identitas pengguna aktif (avatar inisial + nama + badge role + status akses)
 * berdampingan dengan tombol "Kelola Properti". Mobile memakai varian ringkas.
 */

/** Gaya badge role & label status akses sesuai role pengguna aktif */
const ROLE_BADGE_META: Record<string, { pill: string; icon: string; status: string }> = {
  owner: { pill: "bg-emerald-600 text-white", icon: "text-emerald-600", status: "Akses Penuh" },
  "staff admin": { pill: "bg-sky-600 text-white", icon: "text-sky-600", status: "Sesi Staf Aktif" },
  penjaga: { pill: "bg-amber-500 text-white", icon: "text-amber-600", status: "Akses Terbatas" },
};
const DEFAULT_ROLE_BADGE = { pill: "bg-sky-600 text-white", icon: "text-sky-600", status: "Sesi Aktif" };

export function PropertyBanner({
  profile,
  unitCount,
  onGantiFoto,
  onKelola,
  ownerName,
  ownerRole = "Owner",
}: PropertyBannerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const meta = PROPERTY_TYPE_META[profile.tipe];
  const roleMeta = ROLE_BADGE_META[ownerRole.trim().toLowerCase()] ?? DEFAULT_ROLE_BADGE;
  const initial = ownerName.trim().charAt(0).toUpperCase() || "U";

  return (
    <section
      aria-label="Identitas properti"
      className="ik-card rounded-xl border-2 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] [border-color:var(--ik-accent-border)] sm:p-4"
    >
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Foto fasad — ponsel: lebih besar & jelas (96px) */}
        <div
          className={cn(
            "relative size-24 shrink-0 overflow-hidden rounded-xl border [border-color:var(--ik-accent-border)] bg-zinc-50 sm:size-20 sm:rounded-lg"
          )}
        >
          {profile.fotoUrl ? (
            <img
              src={profile.fotoUrl}
              alt={`Foto fasad ${profile.nama}`}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center" aria-hidden="true">
              <ImagePlus className="size-6 text-zinc-300 sm:size-6" strokeWidth={1.5} />
            </div>
          )}
          {/* Overlay ganti foto — desktop saja (ponsel via Pengaturan) */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Ganti foto fasad"
            aria-label="Ganti foto fasad"
            className="absolute inset-0 hidden items-center justify-center bg-zinc-950/45 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 sm:flex"
          >
            <Camera className="size-4 text-white" strokeWidth={1.75} />
          </button>
        </div>

        {/* Nama + badge + alamat */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="ik-head truncate text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">
              {profile.nama}
            </h2>
            <span className="ik-num inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-[var(--ik-accent)] px-2.5 text-xs font-semibold text-[var(--ik-accent-fg)]">
              {meta.label}
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {unitCount < 0 ? "···" : `${unitCount} ${meta.unit}`}
              </span>
            </span>
          </div>
          {profile.alamat && (
            <p className="mt-1 flex items-start gap-1.5 text-xs leading-4 font-medium text-zinc-700 sm:text-sm sm:leading-5 dark:text-zinc-300">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
              <span className="line-clamp-2 sm:line-clamp-1">{profile.alamat}</span>
            </p>
          )}
        </div>

        {/* Aksi + identitas sesi aktif — desktop */}
        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          {/* Kartu identitas pengguna aktif — pengganti tombol "Ganti Foto" */}
          <div
            className="flex min-w-0 items-center gap-2.5 rounded-lg border bg-[var(--ik-accent-soft)] py-1.5 pl-1.5 pr-3 shadow-none [border-color:var(--ik-accent-border)]"
            aria-label={`Pengguna aktif: ${ownerName}, ${ownerRole}`}
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--ik-accent)] text-[13px] font-bold text-[var(--ik-accent-fg)]"
              aria-hidden="true"
            >
              {initial}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="max-w-[150px] truncate text-[13px] font-semibold leading-4 text-zinc-900">
                  {ownerName}
                </span>
                <span
                  className={cn(
                    "inline-flex h-[18px] shrink-0 items-center rounded-full px-2 text-[11px] font-semibold leading-none",
                    roleMeta.pill
                  )}
                >
                  {ownerRole}
                </span>
              </span>
              <span className="mt-1 flex items-center gap-1 text-[11px] font-medium leading-none text-zinc-600">
                <ShieldCheck className={cn("size-3 shrink-0", roleMeta.icon)} strokeWidth={2} aria-hidden="true" />
                {roleMeta.status}
              </span>
            </span>
          </div>
          {onKelola && (
            <Button
              onClick={onKelola}
              className="h-9 shrink-0 bg-[var(--ik-accent)] px-3 text-[13px] font-semibold text-[var(--ik-accent-fg)] shadow-none hover:bg-[var(--ik-accent-hover)]"
            >
              <PencilLine className="size-3.5" strokeWidth={1.75} />
              Kelola Properti
            </Button>
          )}
        </div>
      </div>

      {/* Aksi + identitas — mobile */}
      <div className="mt-3 flex items-center gap-2 sm:hidden">
        {/* Kartu identitas pengguna aktif — pengganti tombol Ganti Foto */}
        <div
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-zinc-50 px-2.5 py-2"
          aria-label={`Pengguna aktif: ${ownerName}, ${ownerRole}`}
        >
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--ik-accent)] text-[var(--ik-accent-fg)]"
            aria-hidden="true"
          >
            <ShieldCheck className="size-3.5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[12.5px] font-semibold text-zinc-900">{ownerName}</span>
            <span
              className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--ik-accent)] px-1.5 py-px text-xs font-semibold leading-none text-[var(--ik-accent-fg)]"
            >
              <span className="truncate">{ownerRole}</span>
            </span>
          </span>
        </div>
        {onKelola && (
          <Button
            onClick={onKelola}
            className="h-10 shrink-0 bg-[var(--ik-accent)] px-3 text-[13px] font-semibold text-[var(--ik-accent-fg)] shadow-none hover:bg-[var(--ik-accent-hover)]"
          >
            <PencilLine className="size-3.5" strokeWidth={1.75} />
            Kelola
          </Button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onGantiFoto(file);
          e.target.value = "";
        }}
        aria-label="Unggah foto fasad properti"
      />
    </section>
  );
}
