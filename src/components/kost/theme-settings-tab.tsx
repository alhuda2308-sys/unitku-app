"use client";

import { Check, Palette } from "lucide-react";
import { STATUS_ROOM_TONE } from "@/lib/kost-data";
import { useTheme, type ThemeMeta } from "@/lib/theme-store";
import { cn } from "@/lib/utils";

/** Kartu pilihan tema: pratinjau mini-mock (canvas + kartu + tombol solid + aksen) */
function ThemeCard({ meta, active, onPick }: { meta: ThemeMeta; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={cn(
        "group cursor-pointer rounded-lg border-[1.5px] p-2.5 text-left transition-all duration-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10",
        active
          ? "border-zinc-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
          : "border-zinc-200/90 hover:border-zinc-400 hover:shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
      )}
    >
      {/* Pratinjau mini */}
      <div
        className="rounded-md border p-2"
        style={{ background: meta.canvas, borderColor: meta.border }}
        aria-hidden="true"
      >
        <div className="rounded border bg-white p-1.5" style={{ borderColor: meta.border }}>
          <div className="flex items-center justify-between">
            <span className="h-1.5 w-9 rounded-full" style={{ background: meta.solid }} />
            <span
              className="inline-flex h-3 items-center rounded-full px-1 text-[7px] font-bold leading-none text-white"
              style={{ background: meta.solid }}
            >
              Aksi
            </span>
          </div>
          <div className="mt-1.5 space-y-1">
            <span className="block h-1 w-full rounded-full" style={{ background: meta.soft }} />
            <span className="block h-1 w-2/3 rounded-full" style={{ background: meta.soft }} />
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="flex gap-1">
            <span className="size-2.5 rounded-full" style={{ background: meta.accent }} />
            <span className="size-2.5 rounded-full border" style={{ background: meta.card, borderColor: meta.border }} />
          </span>
          <span className="h-1 w-6 rounded-full" style={{ background: meta.border }} />
        </div>
      </div>

      {/* Nama + status aktif */}
      <div className="mt-2.5 flex items-start justify-between gap-2 px-0.5 pb-0.5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-zinc-900">{meta.label}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-zinc-500">{meta.tagline}</p>
        </div>
        {active && (
          <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-zinc-900 bg-zinc-900 px-1.5 text-[10px] font-semibold text-white">
            <Check className="size-3" strokeWidth={2.5} aria-hidden="true" />
            Aktif
          </span>
        )}
      </div>
    </button>
  );
}

interface PreviewCardProps {
  roomLabel: string;
  badgeText: string;
  /** Tone class kartu (ik-room-*) — memakai token --rm-* yang SAMA dengan RoomCard asli */
  cardClass: string;
  sub: string;
  /** "Tersedia" italic muted — meniru kartu kosong asli */
  subItalic?: boolean;
  /** Label keterangan semibold (mis. "Sedang Perbaikan") */
  subStrong?: boolean;
  footerLeft: string;
  footerRight: string;
  pulse?: boolean;
  badgeGlow?: boolean;
  stripes?: boolean;
}

/** Mini kartu kamar: struktur 3 baris & tinggi tetap h-[124px] yang SAMA dengan RoomCard asli */
function StatusPreviewCard({
  roomLabel,
  badgeText,
  cardClass,
  sub,
  subItalic,
  subStrong,
  footerLeft,
  footerRight,
  pulse,
  badgeGlow,
  stripes,
}: PreviewCardProps) {
  return (
    <div
      className={cn(
        "ik-room h-[124px] w-full flex flex-col justify-between overflow-hidden rounded-lg p-3",
        cardClass,
        stripes && "ik-stripes"
      )}
    >
      {/* Baris 1: nomor kamar + badge status */}
      <div className="flex h-5 shrink-0 items-center justify-between gap-1.5">
        <span className="truncate text-base font-bold leading-5 tracking-tight tabular-nums text-[color:var(--c-tx)]">
          {roomLabel}
        </span>
        <span
          className={cn(
            "ik-badge-solid inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] font-semibold whitespace-nowrap",
            badgeGlow && "ik-badge-alert"
          )}
        >
          {pulse && (
            <span className="ik-pulse-dot size-1.5 shrink-0 rounded-full" aria-hidden="true" />
          )}
          {badgeText}
        </span>
      </div>
      {/* Baris 2: penghuni / keterangan — satu baris truncate */}
      <div className="flex h-5 shrink-0 items-center overflow-hidden">
        <span
          className={cn(
            "min-w-0 truncate text-[13px] leading-5",
            subItalic && "italic text-[color:var(--c-sub)]",
            subStrong ? "font-semibold text-[color:var(--c-tx)]" : !subItalic && "font-medium text-[color:var(--c-tx)]"
          )}
        >
          {sub}
        </span>
      </div>
      {/* Baris 3: chip tipe + tempo/harga — sejajar, tanpa wrap */}
      <div className="flex h-5 shrink-0 items-center justify-between text-xs gap-x-1.5">
        <span className="ik-chip inline-flex h-5 min-w-0 items-center truncate rounded px-1.5 text-[10px] font-medium leading-4 whitespace-nowrap">
          <span className="truncate">{footerLeft}</span>
        </span>
        <span className="shrink-0 text-xs font-medium leading-5 tabular-nums whitespace-nowrap text-[color:var(--c-sub)]">
          {footerRight}
        </span>
      </div>
    </div>
  );
}

/** Pengaturan → tab "Tema & Tampilan": 5 preset tema + pratinjau kontras status */
export function ThemeSettingsTab() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="space-y-4">
      {/* Pemilih tema */}
      <section className="rounded-lg border border-border bg-white p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-600">
            <Palette className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[13.5px] font-bold tracking-tight text-zinc-900">Tema &amp; Tampilan</h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              Pilih palet warna aplikasi. Pilihan tersimpan otomatis di perangkat ini (localStorage)
              dan tetap aktif setelah halaman di-refresh.
            </p>
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="Pilih tema tampilan"
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          {themes.map((t) => (
            <ThemeCard key={t.id} meta={t} active={t.id === theme} onPick={() => setTheme(t.id)} />
          ))}
        </div>
      </section>

      {/* Pratinjau kontras status kamar */}
      <section className="rounded-lg border border-border bg-white p-4 sm:p-5">
        <h2 className="text-[13.5px] font-bold tracking-tight text-zinc-900">
          Pratinjau Status Kamar
        </h2>
        <p className="mt-0.5 text-[12px] text-zinc-500">
          Kartu kamar memakai latar blok SOLID penuh per status yang mengikuti palet tema aktif —
          bukan lagi kartu putih dengan border tipis — sehingga status terbaca sekilas pandang.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatusPreviewCard
            roomLabel="201"
            badgeText="Lunas"
            cardClass={STATUS_ROOM_TONE.lunas}
            sub="Siti Rahma"
            footerLeft="Tipe A - AC"
            footerRight="28 Okt"
          />
          <StatusPreviewCard
            roomLabel="105"
            badgeText="H-2"
            cardClass={STATUS_ROOM_TONE.jatuhTempo}
            sub="Ahmad Fauzi"
            footerLeft="Tipe B - Kipas"
            footerRight="28 Sep"
          />
          <StatusPreviewCard
            roomLabel="110"
            badgeText="H+4"
            cardClass={STATUS_ROOM_TONE.menunggak}
            sub="Dewi Lestari"
            footerLeft="Tipe AC Deluxe"
            footerRight="24 Sep"
            pulse
            badgeGlow
          />
          <StatusPreviewCard
            roomLabel="108"
            badgeText="Kosong"
            cardClass={STATUS_ROOM_TONE.kosong}
            sub="Tersedia"
            subItalic
            footerLeft="Tipe A - AC"
            footerRight="Rp1,5 jt/bln"
          />
          <StatusPreviewCard
            roomLabel="112"
            badgeText="Perbaikan"
            cardClass="ik-room-perbaikan"
            sub="Sedang Perbaikan"
            subStrong
            footerLeft="Tipe AC Deluxe"
            footerRight="Rp1,75 jt/bln"
            stripes
          />
        </div>

        <ul className="mt-4 space-y-1.5 text-[11.5px] leading-4 text-zinc-500">
          <li className="flex items-start gap-1.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-600" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-zinc-700">Lunas / Terisi</strong> — latar blok
              hijau solid penuh (mengikuti aksen tema) dengan teks kontras tinggi dan badge pill
              pekat di pojok kanan atas.
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-600" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-zinc-700">Menunggak / Jatuh Tempo</strong> —
              blok warna hangat penuh (oranye-merah/kuning sesuai tema) dengan border tegas; badge
              Menunggak berkedip halus agar langsung terlihat perlu ditagih.
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full border border-sky-400 bg-sky-200" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-zinc-700">Kosong (Siap Huni)</strong> — latar
              netral soft solid dengan border putus-putus kontras, mempertegas ketersediaan kamar.
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-zinc-700">Perbaikan / Maintenance</strong> —
              blok amber dengan motif strip halus sebagai penanda peringatan.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
