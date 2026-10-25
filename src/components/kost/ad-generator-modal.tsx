"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Generator Iklan Unit Siap Copas ke Sosmed (Dashboard)
//
// Modal pembuat draf iklan promosi untuk unit berstatus KOSONG:
//   1. Data otomatis dari unit terpilih (properti, no. unit, harga,
//      fasilitas via checklist cepat, nomor WA owner dari Pengaturan).
//   2. 3 format iklan otomatis (templating client-side, tanpa API):
//      Grup Facebook / Komunitas · Status WhatsApp · Marketplace —
//      masing-masing dengan 4 variasi gaya (urgensi/kenyamanan/hemat/santai);
//      "Buat Ulang Draf Otomatis" memutar ke variasi berbeda + toast.
//   3. Villa/Homestay: PRESET CEPAT caption siap pakai per platform
//      (Instagram, Facebook Ads, WhatsApp Story) + input opsional Data
//      Staycation (kapasitas tamu & tarif weekend/malam) yang masuk
//      otomatis ke iklan — terminologi staycation, bukan istilah anak kost.
//   4. Preview bisa diedit manual → "Salin Teks Iklan" (toast) →
//      "Buka WhatsApp" (draf terisi, tinggal pilih grup/kontak tujuan).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  Check,
  Copy,
  Facebook,
  Instagram,
  Megaphone,
  Plus,
  RefreshCw,
  Smartphone,
  Sparkles,
  Store,
  Users,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AD_STYLE_COUNT,
  AD_STYLE_META,
  HOUSE_FACILITY_PRIORITY,
  VILLA_FACILITY_PRIORITY,
  VILLA_PRESETS,
  adContactLink,
  adModalTitle,
  adPropertyScope,
  adUnitNoun,
  buildVillaPreset,
  generateAd,
  pickDifferentStyle,
  type AdFormatId,
  type AdGeneratorInput,
  type AdPropertyScope,
  type VillaPresetId,
} from "@/lib/ad-generator";
import { FACILITY_OPTIONS, formatIDR, roomNomor, type Room } from "@/lib/kost-data";
import type { FacilityItem } from "@/lib/app-settings";
import { cn } from "@/lib/utils";
import { WaIcon } from "./wa-icon";

interface AdGeneratorModalProps {
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nama properti (Pengaturan → Profil Properti) */
  propertyName: string;
  /** Nomor WhatsApp owner (Pengaturan → Profil Saya) */
  ownerWhatsapp: string;
  /** Katalog master fasilitas unit (Pengaturan → Katalog Fasilitas) */
  facilityCatalog?: FacilityItem[];
  /** Tambah fasilitas kustom mendadak — persist ke katalog master properti
   *  (cloud/demo) supaya pilihan baru juga muncul di modal kamar berikutnya */
  onAddCustomFacility?: (label: string) => void;
  /** Tipe properti aktif (kost / kontrakan / rusun / villa) — menentukan
   *  label, judul modal, struktur draf iklan & terminologi (Kamar vs Unit
   *  Kontrakan vs terminologi staycation villa) */
  propertyType?: string;
}

const AD_FORMATS: {
  id: AdFormatId;
  label: string;
  hint: string;
  icon: typeof Megaphone;
}[] = [
  { id: "facebook", label: "Grup Facebook / Komunitas", hint: "Lengkap, ramah, rapi + emoji", icon: Megaphone },
  { id: "whatsapp", label: "Status / Story WhatsApp", hint: "Singkat, kasual, padat", icon: Smartphone },
  { id: "marketplace", label: "Marketplace", hint: "Terstruktur, to the point", icon: Store },
];

/** Clipboard imun konteks non-secure: Clipboard API → fallback execCommand */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // lanjut ke fallback
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Inner body keyed by room id so format/facility state resets on every open */
function AdModalBody({
  room,
  propertyName,
  ownerWhatsapp,
  facilityCatalog,
  onAddCustomFacility,
  propertyType,
}: {
  room: Room;
  propertyName: string;
  ownerWhatsapp: string;
  facilityCatalog?: FacilityItem[];
  onAddCustomFacility?: (label: string) => void;
  propertyType?: string;
}) {
  const [format, setFormat] = useState<AdFormatId>("facebook");
  const [selected, setSelected] = useState<string[]>(() => room.facilities ?? []);
  const [draft, setDraft] = useState<string>("");
  // Variasi gaya aktif (0=Urgensi 1=Kenyamanan 2=Hemat 3=Santai) — tombol
  // "Buat Ulang" memutar ke variasi BERBEDA supaya teks preview benar-benar
  // berubah, bukan mengulang template statis yang sama.
  const [styleIdx, setStyleIdx] = useState(0);
  // Kunci animasi: naikkan tiap regenerate → textarea fade-in dgn teks baru
  const [flashKey, setFlashKey] = useState(0);
  // Villa/Homestay: data staycation opsional (kapasitas tamu & tarif weekend
  // per malam) — langsung mengalir ke draf iklan & preset tanpa disimpan.
  const [capacityText, setCapacityText] = useState("");
  const [weekendText, setWeekendText] = useState("");
  // Fasilitas kustom mendadak — inline input di baris pill FASILITAS.
  // extraFacilities menjaga pill tetap terlihat & terpilih seketika meski
  // persist katalog master (cloud/demo) belum selesai.
  const [extraFacilities, setExtraFacilities] = useState<string[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState("");

  /** Scope properti aktif — Kost (Kamar) vs Kontrakan/Rusun (Unit) vs
   *  Villa/Homestay (terminologi staycation + preset cepat) */
  const scope: AdPropertyScope = useMemo(() => adPropertyScope(propertyType), [propertyType]);
  const unitWord = adUnitNoun(scope);
  const isVilla = scope === "villa";

  const capacity = useMemo(() => {
    const n = Number.parseInt(capacityText.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [capacityText]);
  const weekendPrice = useMemo(() => {
    const n = Number.parseInt(weekendText.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [weekendText]);

  // Checklist cepat: fasilitas unit (termasuk kustom dari Kelola/Tambah Kamar)
  // + tambahan mendadak + katalog master + opsi bawaan (dedup). Kontrakan/rusun:
  // fasilitas prioritas rumah dulu; Villa/homestay: fasilitas liburan (kolam
  // renang, dapur, view, BBQ…) paling depan agar iklan langsung menonjolkan
  // yang relevan utk tamu liburan.
  const roomLabel = roomNomor(room);
  const facilityPool = useMemo(() => {
    const roomAndCatalog = [
      ...(room.facilities ?? []),
      ...extraFacilities,
      ...(facilityCatalog ?? []).map((f) => f.label),
      ...FACILITY_OPTIONS,
    ];
    const pool =
      scope === "kost"
        ? roomAndCatalog
        : scope === "villa"
          ? [...VILLA_FACILITY_PRIORITY, ...roomAndCatalog]
          : [...HOUSE_FACILITY_PRIORITY, ...roomAndCatalog];
    return Array.from(new Set(pool.filter((f) => f.trim().length > 0)));
  }, [scope, roomLabel, room.facilities, facilityCatalog, extraFacilities]);
  // Semua fasilitas milik kamar selalu tampil (mereka paling depan di pool);
  // sisanya dipotong agar baris pill tetap ringkas (area scrollable).
  const quickFacilities = useMemo(() => facilityPool.slice(0, 18), [facilityPool]);

  const input = useMemo<AdGeneratorInput>(
    () => ({
      propertyName,
      roomId: roomLabel,
      floor: room.floor,
      type: room.type,
      price: room.price,
      facilities: selected,
      ownerWhatsapp,
      propertyType,
      capacity: isVilla ? capacity : null,
      weekendPrice: isVilla ? weekendPrice : null,
    }),
    [
      propertyName,
      roomLabel,
      room.floor,
      room.type,
      room.price,
      selected,
      ownerWhatsapp,
      propertyType,
      isVilla,
      capacity,
      weekendPrice,
    ],
  );

  // Draf awal + regenerasi otomatis saat ganti format / checklist fasilitas /
  // variasi gaya. Edit manual tetap bisa — tombol "Buat Ulang" memutar gaya
  // ke variasi lain lalu draf dibangun ulang dari template variasi tersebut.
  useEffect(() => {
    setDraft(generateAd(format, input, styleIdx));
  }, [format, input, styleIdx]);

  const hasContact = Boolean(adContactLink(ownerWhatsapp));

  const toggleFacility = (f: string) => {
    setSelected((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  // ── Fasilitas kustom mendadak: validasi & submit (Enter / ikon centang) ──
  const customDraftTrimmed = customDraft.trim();
  const customDup =
    customDraftTrimmed.length > 0 &&
    facilityPool.some((f) => f.toLowerCase() === customDraftTrimmed.toLowerCase());
  const submitCustom = () => {
    const label = customDraft.trim();
    if (!label || customDup) return;
    // 1) persist ke katalog master properti (cloud/demo) — tersedia juga di
    //    modal Kelola/Tambah Kamar berikutnya
    onAddCustomFacility?.(label);
    // 2) pill muncul + otomatis terpilih → draf iklan bereaksi seketika
    setExtraFacilities((prev) => (prev.includes(label) ? prev : [...prev, label]));
    setSelected((prev) => (prev.includes(label) ? prev : [...prev, label]));
    setCustomDraft("");
    setCustomOpen(false);
  };

  // Escape menutup HANYA input inline, bukan seluruh dialog. Radix Dialog
  // mendaftarkan handler Escape di document fase CAPTURE — cegat via window
  // capture (window mendahului document) sebelum sempat menutup dialog.
  useEffect(() => {
    if (!customOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setCustomOpen(false);
        setCustomDraft("");
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [customOpen]);

  const handleCopy = async () => {
    const ok = await copyText(draft);
    if (ok) {
      toast.success("Teks iklan disalin — siap di-paste ke sosmed", {
        description: `${unitWord} ${room.id} · ${AD_FORMATS.find((f) => f.id === format)?.label ?? ""}`,
      });
    } else {
      toast.error("Gagal menyalin — silakan salin manual dari kotak preview");
    }
  };

  /** Buat Ulang Draf Otomatis — putar ke variasi gaya BERBEDA dari yang
   *  aktif (rotasi acak), bangun ulang draf dari data unit aktual, lalu
   *  beri umpan balik toast + animasi fade di kotak preview. */
  const handleRegenerate = () => {
    const next = pickDifferentStyle(styleIdx, AD_STYLE_COUNT);
    setStyleIdx(next);
    setFlashKey((k) => k + 1); // picu transisi fade-in pada preview
    toast.success("Draf baru berhasil digenerate!", {
      description: `Gaya ${AD_STYLE_META[next].label} — ${AD_STYLE_META[next].description}.`,
    });
  };

  /** Preset Cepat Villa/Homestay — isi preview dgn caption siap pakai per
   *  platform (Instagram / Facebook Ads / WhatsApp Story) dari data aktual. */
  const applyPreset = (id: VillaPresetId, label: string) => {
    setDraft(buildVillaPreset(id, input));
    setFlashKey((k) => k + 1);
    toast.success(`Preset ${label} diterapkan`, {
      description: "Caption siap pakai — sesuaikan bila perlu, lalu salin.",
    });
  };

  return (
    <>
      <DialogHeader className="border-b border-border p-4">
        <DialogTitle className="text-[15px] font-bold tracking-tight text-zinc-900">
          {adModalTitle(scope, room.id)}
        </DialogTitle>
        <DialogDescription className="text-[12.5px] text-zinc-700">
          Draf iklan promosi otomatis dari data unit — pilih format, sesuaikan,
          lalu salin &amp; sebar ke sosmed.
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
        {/* Ringkasan kamar sumber */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-zinc-50 px-3 py-2 text-[12px] font-medium text-zinc-700">
          <Building2 className="size-3.5 shrink-0 text-zinc-500" strokeWidth={1.75} aria-hidden="true" />
          <span className="max-w-[180px] truncate font-bold text-zinc-900">{propertyName}</span>
          <span className="text-zinc-400" aria-hidden="true">·</span>
          <span>{unitWord} {roomNomor(room)}</span>
          <span className="text-zinc-400" aria-hidden="true">·</span>
          <span className="tabular-nums">
            {formatIDR(room.price)}/{isVilla ? "malam" : "bln"}
          </span>
        </div>

        {/* Pilihan format iklan */}
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
            Format Iklan
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3" role="tablist" aria-label="Format iklan">
            {AD_FORMATS.map((f) => {
              const Icon = f.icon;
              const active = format === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
                    active
                      ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500"
                      : "border-border bg-white text-zinc-700 hover:bg-zinc-50",
                  )}
                >
                  <Icon
                    className={cn("size-4 shrink-0", active ? "text-amber-600" : "text-zinc-500")}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 leading-tight">
                    <span className={cn("block truncate text-[12.5px] font-bold", active && "text-amber-900")}>
                      {f.label}
                    </span>
                    <span className="block truncate text-[11px] text-zinc-500">{f.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preset Cepat Villa/Homestay — caption siap pakai per platform sosmed */}
        {isVilla && (
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
              Preset Cepat Villa / Homestay{" "}
              <span className="font-medium normal-case tracking-normal text-zinc-500">
                (klik utk isi caption siap pakai)
              </span>
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              {VILLA_PRESETS.map((p) => {
                const Icon =
                  p.id === "instagram" ? Instagram : p.id === "facebook-ads" ? Facebook : Smartphone;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id, p.label)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border border-border bg-white px-2.5 py-2 text-left transition-colors",
                      "hover:border-emerald-500 hover:bg-emerald-50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
                    )}
                  >
                    <Icon
                      className="size-4 shrink-0 text-zinc-500"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate text-[12.5px] font-bold text-zinc-900">
                        {p.label}
                      </span>
                      <span className="block truncate text-[11px] text-zinc-500">{p.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Data Staycation villa — opsional, masuk otomatis ke draf & preset */}
        {isVilla && (
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
              Data Staycation{" "}
              <span className="font-medium normal-case tracking-normal text-zinc-500">
                (opsional — langsung masuk ke iklan)
              </span>
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
                  <Users className="size-3" strokeWidth={1.75} aria-hidden="true" />
                  Kapasitas Tamu
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={capacityText}
                  onChange={(e) => setCapacityText(e.target.value)}
                  placeholder="cth: 10"
                  className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-[12.5px] tabular-nums text-zinc-800 placeholder:text-zinc-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  aria-label="Kapasitas tamu per booking (opsional)"
                />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
                  <CalendarDays className="size-3" strokeWidth={1.75} aria-hidden="true" />
                  Tarif Weekend / Malam
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={weekendText}
                  onChange={(e) => setWeekendText(e.target.value)}
                  placeholder="cth: 500000"
                  className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-[12.5px] tabular-nums text-zinc-800 placeholder:text-zinc-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  aria-label="Tarif akhir pekan per malam (opsional)"
                />
              </label>
            </div>
          </div>
        )}

        {/* Checklist fasilitas cepat — pill kamar (termasuk kustom) + tambah
            fasilitas kustom mendadak; tiap toggle langsung meregenerasi draf */}
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
            Fasilitas <span className="font-medium normal-case tracking-normal text-zinc-500">(klik utk tambah/hapus dari iklan)</span>
          </p>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto scrollbar-thin">
            {quickFacilities.map((f) => {
              const on = selected.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleFacility(f)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
                    on
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100",
                  )}
                >
                  {on && <Check className="size-3" strokeWidth={2.5} aria-hidden="true" />}
                  {f}
                </button>
              );
            })}

            {customOpen ? (
              <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto">
                <input
                  autoFocus
                  value={customDraft}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitCustom();
                    }
                  }}
                  placeholder="Misal: Kulkas Mini, Dispenser, Smart TV"
                  aria-label="Nama fasilitas kustom baru untuk iklan"
                  aria-invalid={customDup}
                  className={cn(
                    "h-7 min-w-0 flex-1 rounded-full border border-zinc-200 bg-white px-3 text-[11.5px] text-zinc-800 shadow-none outline-none placeholder:text-zinc-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 sm:w-[230px] sm:flex-none",
                    customDup && "border-red-300 focus:border-red-400 focus:ring-red-500/20",
                  )}
                />
                <button
                  type="button"
                  onClick={submitCustom}
                  disabled={!customDraftTrimmed || customDup}
                  aria-label="Tambah fasilitas kustom ke iklan"
                  className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomOpen(false);
                    setCustomDraft("");
                  }}
                  aria-label="Batal tambah fasilitas kustom"
                  className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  <X className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCustomOpen(true)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-emerald-300 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700 transition-colors hover:border-emerald-500 hover:bg-emerald-50"
              >
                <Plus className="size-3" strokeWidth={2.25} aria-hidden="true" />
                Tambah Fasilitas Kustom
              </button>
            )}

            {quickFacilities.length === 0 && (
              <p className="text-[12px] text-zinc-500">Belum ada fasilitas — tambahkan lewat tombol kustom di atas atau lewat Kelola Kamar.</p>
            )}
          </div>
          {customOpen && customDup && (
            <p className="mt-1.5 text-[11.5px] font-medium text-red-600">
              Fasilitas "{customDraftTrimmed}" sudah ada di daftar.
            </p>
          )}
        </div>

        {/* Preview bisa diedit manual */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="ad-preview" className="text-xs font-bold uppercase tracking-wider text-zinc-700">
              Preview Iklan — Bisa Diedit
            </label>
            <span className="shrink-0 text-xs tabular-nums text-zinc-500">{draft.length} karakter</span>
          </div>
          <div
            key={flashKey}
            className="animate-in fade-in slide-in-from-bottom-1 duration-300"
          >
            <textarea
              id="ad-preview"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={13}
              className="w-full resize-none rounded-lg border border-border bg-white p-3 font-sans text-[12.5px] leading-5 text-zinc-800 placeholder:text-zinc-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              aria-label={`Teks iklan ${unitWord.toLowerCase()} ${roomNomor(room)}`}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleRegenerate}
              className="inline-flex items-center gap-1 rounded text-[11.5px] font-semibold text-zinc-600 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20"
            >
              <RefreshCw className="size-3" strokeWidth={2} aria-hidden="true" />
              Buat Ulang Draf Otomatis
            </button>
            {/* Indikator variasi aktif — bukti visual bahwa teks berotasi */}
            <span
              title={AD_STYLE_META[styleIdx].description}
              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-800"
            >
              <Sparkles className="size-3" strokeWidth={2} aria-hidden="true" />
              Gaya: {AD_STYLE_META[styleIdx].label} · {styleIdx + 1}/{AD_STYLE_COUNT}
            </span>
          </div>
        </div>

        {!hasContact && (
          <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11.5px] font-medium leading-4 text-amber-800">
            Nomor WhatsApp Anda belum diisi — iklan tampil tanpa link chat.
            Lengkapi di Pengaturan → Profil Saya agar {isVilla ? "calon tamu" : "calon penyewa"} bisa langsung chat.
          </p>
        )}
      </div>

      <DialogFooter className="border-t border-border p-4 sm:justify-between">
        <Button
          variant="outline"
          onClick={handleCopy}
          disabled={draft.length === 0}
          className="h-9 border-zinc-200 bg-white text-[13px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
        >
          <Copy className="size-3.5" strokeWidth={1.75} />
          Salin Teks Iklan
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(draft)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            toast.success("Draf iklan terbuka di WhatsApp", {
              description: "Pilih grup, kontak, atau bagikan ke Status Anda.",
            })
          }
          aria-disabled={draft.length === 0}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-700",
            draft.length === 0 && "pointer-events-none opacity-50",
          )}
        >
          <WaIcon className="size-4" />
          Buka WhatsApp
        </a>
      </DialogFooter>
    </>
  );
}

export function AdGeneratorModal({
  room,
  open,
  onOpenChange,
  propertyName,
  ownerWhatsapp,
  facilityCatalog,
  onAddCustomFacility,
  propertyType,
}: AdGeneratorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] max-w-[560px] flex-col gap-0 overflow-hidden p-0" aria-describedby={undefined}>
        {room && (
          <AdModalBody
            key={room.id}
            room={room}
            propertyName={propertyName}
            ownerWhatsapp={ownerWhatsapp}
            facilityCatalog={facilityCatalog}
            onAddCustomFacility={onAddCustomFacility}
            propertyType={propertyType}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
