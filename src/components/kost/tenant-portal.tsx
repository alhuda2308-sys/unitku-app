"use client";

import { useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowLeft,
  Bell,
  Clock,
  Copy,
  DoorOpen,
  Download,
  Landmark,
  Link2Off,
  Megaphone,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Siren,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatIDR, type Room } from "@/lib/kost-data";
import type { Invoice } from "@/lib/kost-invoices";
import {
  ANNOUNCEMENT_KATEGORI_META,
  ANNOUNCEMENT_TODAY_ISO,
  isAnnouncementLive,
  matchesFloor,
  periodeLabel,
  type Announcement,
} from "@/lib/announcement-data";
import {
  AUTO_VERIFY_NOTE,
  QRIS_CHANNELS,
  QRIS_NMID,
  VA_ACCOUNTS,
  buildQrisPayload,
  portalInvoiceView,
  qrisMerchantName,
  resolvePortalRoom,
  type PortalBannerTone,
} from "@/lib/tenant-portal";
import { ReportIssueDrawer, type IssueDraft } from "./report-issue-drawer";
import { FacilityBadge } from "./facility-badge";

interface TenantPortalProps {
  /** portal_token dari URL (?token=…) atau pratinjau dashboard */
  token: string;
  rooms: Room[];
  invoices: Invoice[];
  propertyName: string;
  /** Pengumuman aktif milik pengelola — banner di atas kartu tagihan */
  announcements?: Announcement[];
  /** Fasilitas bersama properti (dari Pengaturan → Katalog Fasilitas) */
  sharedFacilities?: string[];
  /** true = halaman publik /portal (tab terpisah, tanpa chrome owner) */
  standalone?: boolean;
  /** Kembali ke dashboard owner (mode pratinjau saja) */
  onExit?: () => void;
  /** Lompat ke panel Komplain setelah laporan terkirim (mode pratinjau) */
  onOpenTickets?: () => void;
  /** Membuat tiket owner-side; mengembalikan id tiket (mode pratinjau) */
  onSubmitIssue?: (draft: IssueDraft) => string;
}

type PayMethod = "qris" | "va";

const BANNER_META: Record<
  PortalBannerTone,
  { box: string; text: string; icon: React.ReactNode }
> = {
  amber: {
    box: "border-amber-200 bg-amber-50",
    text: "text-amber-800",
    icon: <Clock className="size-3.5 shrink-0 text-amber-600" strokeWidth={1.75} aria-hidden="true" />,
  },
  rose: {
    box: "border-rose-200 bg-rose-50",
    text: "text-rose-800",
    icon: <Clock className="size-3.5 shrink-0 text-rose-600" strokeWidth={1.75} aria-hidden="true" />,
  },
  emerald: {
    box: "border-emerald-200 bg-emerald-50",
    text: "text-emerald-800",
    icon: <ShieldCheck className="size-3.5 shrink-0 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />,
  },
  violet: {
    box: "border-violet-200 bg-violet-50",
    text: "text-violet-800",
    icon: <Clock className="size-3.5 shrink-0 text-violet-600" strokeWidth={1.75} aria-hidden="true" />,
  },
};

/** Outlined pill used for room/tenant + invoice chips in the header */
function HeaderChip({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border border-border bg-white px-2.5 text-xs font-medium text-zinc-700",
        mono && "font-mono tabular-nums text-zinc-700"
      )}
    >
      {children}
    </span>
  );
}

function PortalHeader({
  propertyName,
  onExit,
  children,
}: {
  propertyName: string;
  onExit?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-white">
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-[13px] font-bold text-white"
          aria-hidden="true"
        >
          {propertyName.charAt(0).toUpperCase() || "I"}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="truncate text-[14px] font-bold tracking-tight text-zinc-900">
            {propertyName}
          </h1>
          <p className="text-xs text-zinc-700">Portal Penyewa</p>
        </div>
        {onExit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            className="h-8 gap-1.5 px-2 text-[12.5px] text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Kembali ke dashboard owner"
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.75} />
            Kembali
          </Button>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 pt-2.5">{children}</div>}
    </header>
  );
}

/** Empty/error state — centered column, mobile-first */
function CenterState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
        {icon}
      </span>
      <p className="text-[14px] font-bold text-zinc-900">{title}</p>
      <p className="max-w-[300px] text-[12.5px] leading-5 text-zinc-700">{body}</p>
    </div>
  );
}

/** Banner pengumuman pengelola — border 1px sesuai urgensi (spec) */
function AnnouncementBannerCard({
  announcement,
  onDismiss,
}: {
  announcement: Announcement;
  onDismiss: (id: string) => void;
}) {
  const meta = ANNOUNCEMENT_KATEGORI_META[announcement.kategori];
  const Icon = announcement.kategori === "darurat" ? Siren : Megaphone;
  return (
    <article
      className={cn("rounded-lg border bg-white p-4", meta.bannerBorder)}
      aria-label={`Pengumuman: ${announcement.judul}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            meta.bannerBg,
            meta.bannerIconText
          )}
          aria-hidden="true"
        >
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-full border px-2 text-xs font-bold uppercase tracking-wide leading-none",
                meta.pill
              )}
            >
              {meta.label}
            </span>
            <span className="inline-flex items-center gap-1 text-xs tabular-nums text-zinc-700">
              <Bell className="size-3" strokeWidth={1.75} aria-hidden="true" />
              Berlaku {periodeLabel(announcement)}
            </span>
          </div>
          <p className="mt-2 text-[13.5px] font-bold leading-snug tracking-tight text-zinc-900">
            {announcement.judul}
          </p>
          <p className="mt-1 whitespace-pre-line text-[12.5px] leading-[1.55] text-zinc-600">
            {announcement.isi}
          </p>
          <div className="mt-3 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDismiss(announcement.id)}
              className="h-7 gap-1 border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-600 shadow-none hover:bg-zinc-50"
            >
              <X className="size-3" strokeWidth={2} aria-hidden="true" />
              Tutup / Mengerti
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function TenantPortal({
  token,
  rooms,
  invoices,
  propertyName,
  announcements = [],
  sharedFacilities = [],
  standalone = false,
  onExit,
  onOpenTickets,
  onSubmitIssue,
}: TenantPortalProps) {
  const [method, setMethod] = useState<PayMethod>("qris");
  const [vaIdx, setVaIdx] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  /** Dismiss sementara per id — banner muncul lagi pada kunjungan berikutnya */
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const qrBoxRef = useRef<HTMLDivElement>(null);

  // ── Magic-link resolution: token → SATU kamar & tagihannya ────────────────
  const room = useMemo(() => resolvePortalRoom(token, rooms), [token, rooms]);
  const tenant = room?.tenant ?? null;

  // Banner pengumuman aktif yang relevan dengan lantai kamar ini
  const visibleBanners = useMemo(() => {
    if (!room) return [];
    return announcements.filter(
      (a) =>
        isAnnouncementLive(a, ANNOUNCEMENT_TODAY_ISO) &&
        matchesFloor(a, room.floor) &&
        !dismissed.has(a.id)
    );
  }, [announcements, room, dismissed]);

  const dismissBanner = (id: string) =>
    setDismissed((prev) => new Set(prev).add(id));

  const invoice = useMemo(() => {
    if (!room) return null;
    const list = invoices.filter((i) => i.roomId === room.id && i.tenantName);
    if (list.length === 0) return null;
    return list.find((i) => i.status !== "lunas") ?? list[0];
  }, [room, invoices]);

  const view = useMemo(() => (invoice ? portalInvoiceView(invoice) : null), [invoice]);
  const unpaid =
    invoice != null &&
    (invoice.status === "belumBayar" || invoice.status === "jatuhTempo" || invoice.status === "menunggak");
  const qrisPayload = useMemo(
    () => (unpaid && invoice ? buildQrisPayload(invoice.total, invoice.id, propertyName) : ""),
    [unpaid, invoice, propertyName]
  );

  const va = VA_ACCOUNTS[vaIdx];

  // ── State 1 — token tidak valid / kamar tidak terdaftar lagi ───────────────
  if (!room) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          <PortalHeader propertyName={propertyName} onExit={onExit} />
          <CenterState
            icon={<Link2Off className="size-5" strokeWidth={1.5} aria-hidden="true" />}
            title="Tautan Portal Tidak Valid"
            body="Tautan ini tidak dikenali atau kamarnya sudah tidak terdaftar. Minta tautan terbaru kepada pengelola kost."
          />
        </div>
      </div>
    );
  }

  const downloadQr = () => {
    const canvas = qrBoxRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qris-${invoice!.id.replace("#", "")}.png`;
    a.click();
    toast.success("QR Code diunduh", {
      description: "Scan dengan aplikasi mobile banking / e-wallet untuk membayar.",
    });
  };

  const copyVa = async () => {
    const digits = va.va.replace(/\s/g, "");
    try {
      await navigator.clipboard.writeText(digits);
      toast.success(`Nomor VA ${va.bank} disalin`, {
        description: `${digits} — a.n. Hendra Wijaya`,
      });
    } catch {
      toast.error("Gagal menyalin", { description: "Salin manual: " + digits });
    }
  };

  const handleSubmitIssue = (draft: IssueDraft): string => {
    if (onSubmitIssue && tenant) {
      const ticketId = onSubmitIssue(draft);
      setReportOpen(false);
      toast.success(`Laporan terkirim — ${ticketId}`, {
        description: `${draft.kategori} · Kamar ${room.id} · ${
          draft.photos.length > 0 ? `${draft.photos.length} foto lampiran` : "tanpa foto"
        }. Pengelola akan menindaklanjuti.`,
        action: onOpenTickets ? { label: "Buka Dashboard", onClick: onOpenTickets } : undefined,
        duration: 9000,
      });
      return ticketId;
    }
    // Standalone (/portal tab publik) — laporan disimulasikan terkirim
    setReportOpen(false);
    toast.success("Laporan terkirim", {
      description: `${draft.kategori} · Kamar ${room.id} · Pengelola akan menindaklanjuti segera.`,
    });
    return "";
  };

  const banner = view ? BANNER_META[view.bannerTone] : null;
  const bannerLead = view ? view.bannerText.split(" — ")[0] : "";
  const bannerRest = view ? view.bannerText.split(" — ").slice(1).join(" — ") : "";

  // ── State 2/3/4 — kamar ter-resolve (kosong / tanpa tagihan / penuh) ───────
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <PortalHeader propertyName={propertyName} onExit={onExit}>
          <HeaderChip>
            Kamar {room.id} • {tenant?.name ?? "Belum ada penyewa"}
          </HeaderChip>
          {view && <HeaderChip mono>{view.id}</HeaderChip>}
        </PortalHeader>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <main className="flex-1 space-y-4 px-4 py-4">
          {/* Banner pengumuman — paling atas sesuai spec (di atas kartu tagihan) */}
          {visibleBanners.length > 0 && (
            <section aria-label="Pengumuman pengelola" className="space-y-2.5">
              {visibleBanners.map((a) => (
                <AnnouncementBannerCard
                  key={a.id}
                  announcement={a}
                  onDismiss={dismissBanner}
                />
              ))}
            </section>
          )}

          {!tenant ? (
            <CenterState
              icon={<DoorOpen className="size-5" strokeWidth={1.5} aria-hidden="true" />}
              title="Kamar Belum Memiliki Penyewa"
              body="Token portal ini belum terhubung ke penyewa aktif. Tagihan akan tampil di sini setelah check-in dilakukan pengelola."
            />
          ) : !view ? (
            <CenterState
              icon={<ReceiptText className="size-5" strokeWidth={1.5} aria-hidden="true" />}
              title="Belum Ada Tagihan Terbit"
              body={`Tagihan untuk Kamar ${room.id} akan muncul di sini setelah diterbitkan oleh pengelola.`}
            />
          ) : (
            <>
              {/* Invoice breakdown */}
              <section aria-label="Rincian tagihan" className="rounded-lg border border-border bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12.5px] font-semibold tabular-nums text-zinc-600">
                    {view.id}
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-5 items-center rounded-full border px-2 text-xs font-semibold leading-none",
                      view.pillClass
                    )}
                  >
                    {view.statusLabel}
                  </span>
                </div>

                <div className={cn("mt-3 flex items-center gap-2 rounded-md border px-3 py-2.5", banner!.box)}>
                  {banner!.icon}
                  <p className={cn("text-[12.5px] leading-snug", banner!.text)}>
                    <span className="font-semibold">{bannerLead}</span>
                    {bannerRest.length > 0 && ` — ${bannerRest}`}
                  </p>
                </div>

                <ul className="mt-4 space-y-3">
                  {view.lines.map((l) => (
                    <li key={l.label} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-zinc-800">{l.label}</p>
                        <p className="mt-0.5 text-[12.5px] text-zinc-700">{l.sub}</p>
                      </div>
                      <span className="pt-0.5 text-[13px] font-semibold tabular-nums text-zinc-900">
                        {formatIDR(l.amount)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 border-t border-border pt-3.5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[12.5px] font-medium text-zinc-700">Total Tagihan</p>
                      <p className="mt-0.5 text-xs text-zinc-700">{view.issuedLabel}</p>
                    </div>
                    <p className="text-[26px] font-bold leading-none tracking-tight tabular-nums text-zinc-900">
                      {formatIDR(view.total)}
                    </p>
                  </div>
                </div>
              </section>

              {/* Payment methods (belum bayar) / status (lunas & verifikasi) */}
              {invoice!.status === "lunas" ? (
                <section aria-label="Status pembayaran" className="rounded-lg border border-border bg-white p-4">
                  <h2 className="text-[13.5px] font-bold tracking-tight text-zinc-900">Status Pembayaran</h2>
                  <div className="mt-3 flex items-start gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3">
                    <ShieldCheck className="mt-px size-4 shrink-0 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-semibold text-emerald-800">
                        Tagihan lunas — terima kasih!
                      </p>
                      <p className="mt-0.5 text-[12.5px] leading-snug text-emerald-700/80">
                        Pembayaran diterima {invoice!.paidAt ?? "—"} · kwitansi digital tersimpan otomatis.
                        Tagihan periode berikutnya terbit sesuai jadwal sewa.
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-4 text-zinc-700">
                    Butuh kwitansi atau ada pertanyaan tagihan? Hubungi pengelola via WhatsApp.
                  </p>
                </section>
              ) : invoice!.status === "verifikasi" ? (
                <section aria-label="Status pembayaran" className="rounded-lg border border-border bg-white p-4">
                  <h2 className="text-[13.5px] font-bold tracking-tight text-zinc-900">Status Pembayaran</h2>
                  <div className="mt-3 flex items-start gap-2.5 rounded-md border border-violet-200 bg-violet-50 px-3 py-3">
                    <Clock className="mt-px size-4 shrink-0 text-violet-600" strokeWidth={1.75} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-semibold text-violet-800">
                        Pembayaran sedang diverifikasi
                      </p>
                      <p className="mt-0.5 text-[12.5px] leading-snug text-violet-700/80">
                        Sistem memverifikasi otomatis dalam 1–2 menit. Tidak perlu membayar ulang —
                        status halaman ini diperbarui seketika setelah selesai.
                      </p>
                    </div>
                  </div>
                </section>
              ) : (
                <section aria-label="Metode pembayaran" className="rounded-lg border border-border bg-white p-4">
                  <h2 className="text-[13.5px] font-bold tracking-tight text-zinc-900">Metode Pembayaran</h2>
                  <p className="mt-0.5 text-[12.5px] text-zinc-700">
                    Pilih cara bayar — total {formatIDR(view.total)}
                  </p>

                  {/* Method selector */}
                  <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pilih metode pembayaran">
                    <MethodOption
                      active={method === "qris"}
                      onSelect={() => setMethod("qris")}
                      icon={<QrCode className="size-4" strokeWidth={1.75} />}
                      title="QRIS"
                      sub="Semua Bank & E-Wallet"
                    />
                    <MethodOption
                      active={method === "va"}
                      onSelect={() => setMethod("va")}
                      icon={<Landmark className="size-4" strokeWidth={1.75} />}
                      title="Virtual Account"
                      sub="BCA · Mandiri · BRI"
                    />
                  </div>

                  {method === "qris" ? (
                    <div className="mt-4">
                      <div
                        ref={qrBoxRef}
                        className="mx-auto w-fit rounded-lg border border-border bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                      >
                        <QRCodeCanvas
                          value={qrisPayload}
                          size={172}
                          marginSize={2}
                          level="M"
                          bgColor="#FFFFFF"
                          fgColor="#0F172A"
                          title={`QRIS ${formatIDR(view.total)} ${propertyName}`}
                          className="block"
                        />
                      </div>
                      <div className="mt-3 text-center">
                        <p className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-700">
                          {qrisMerchantName(propertyName)}
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-zinc-700">{QRIS_NMID}</p>
                        <p className="mt-1.5 text-[20px] font-bold tracking-tight tabular-nums text-zinc-900">
                          {formatIDR(view.total)}
                        </p>
                      </div>
                      <div className="mt-3 flex justify-center">
                        <Button
                          variant="outline"
                          onClick={downloadQr}
                          className="h-8 border-zinc-200 bg-white px-3 text-[12.5px] font-medium text-zinc-700 shadow-none hover:bg-zinc-50"
                        >
                          <Download className="size-3.5 text-zinc-700" strokeWidth={1.75} />
                          Unduh QR
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                        <span className="text-xs text-zinc-700">Scan via</span>
                        {QRIS_CHANNELS.map((c) => (
                          <span
                            key={c}
                            className="rounded border border-border bg-zinc-50 px-1.5 py-0.5 text-xs font-semibold text-zinc-600"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <div className="grid grid-cols-3 gap-1.5">
                        {VA_ACCOUNTS.map((acc, i) => (
                          <button
                            key={acc.bank}
                            type="button"
                            onClick={() => setVaIdx(i)}
                            aria-pressed={vaIdx === i}
                            className={cn(
                              "h-9 rounded-md border text-[12.5px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20",
                              vaIdx === i
                                ? "border-zinc-900 bg-zinc-900 text-white"
                                : "border-border bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                            )}
                          >
                            {acc.bank}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 rounded-lg border border-border bg-zinc-50 p-3.5 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
                          Nomor Virtual Account · {va.bank}
                        </p>
                        <p className="mt-1.5 font-mono text-[19px] font-bold tracking-[0.08em] tabular-nums text-zinc-900">
                          {va.va}
                        </p>
                        <p className="mt-1 text-xs text-zinc-700">a.n. Hendra Wijaya — Pengelola Kost</p>
                      </div>
                      <Button
                        onClick={copyVa}
                        className="mt-3 h-9 w-full bg-zinc-900 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800"
                      >
                        <Copy className="size-3.5" strokeWidth={1.75} />
                        Salin Nomor
                      </Button>
                    </div>
                  )}

                  {/* Auto-verification note */}
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-zinc-50 px-3 py-2.5">
                    <ShieldCheck
                      className="mt-px size-3.5 shrink-0 text-emerald-600"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <p className="text-[12.5px] leading-snug text-zinc-600">{AUTO_VERIFY_NOTE}</p>
                  </div>
                </section>
              )}
            </>
          )}

          {/* Fasilitas — hak penyewa (kamar) + fasilitas bersama properti */}
          {tenant && (
            <section aria-label="Fasilitas kamar & properti" className="rounded-lg border border-border bg-white p-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                Fasilitas
              </h2>
              <p className="mt-0.5 text-[12.5px] text-zinc-700">
                Fasilitas Kamar {room.id} yang menjadi hak Anda:
              </p>
              {(room.facilities?.length ?? 0) > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {room.facilities!.map((f) => (
                    <FacilityBadge key={f} label={f} />
                  ))}
                </div>
              ) : (
                <p className="mt-2.5 text-[12.5px] italic text-zinc-700">
                  Belum ada fasilitas kamar tercatat.
                </p>
              )}

              {sharedFacilities.length > 0 && (
                <>
                  <div className="mt-3.5 border-t border-border pt-3.5">
                    <p className="text-[12.5px] text-zinc-700">
                      Fasilitas bersama properti yang dapat Anda gunakan:
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {sharedFacilities.map((f) => (
                        <FacilityBadge key={f} label={f} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}
        </main>

        {/* ── Bottom action bar (kamar terisi) ────────────────────────────── */}
        {tenant && (
          <div className="sticky bottom-0 mt-auto border-t border-border bg-white px-4 py-3">
            <Button
              variant="outline"
              onClick={() => setReportOpen(true)}
              className="h-10 w-full border-zinc-200 bg-white text-[13px] font-medium text-zinc-800 shadow-none hover:bg-zinc-50"
            >
              <Wrench className="size-4 text-zinc-700" strokeWidth={1.75} />
              Lapor Masalah Fasilitas
            </Button>
          </div>
        )}

        {/* ── Footer brand resmi UnitKu ────────────────────────────────────── */}
        <footer className="mt-auto border-t border-border bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3.5 text-center">
          <p className="text-xs font-medium leading-4 text-zinc-700">
            Didukung oleh <span className="font-bold text-zinc-900">{BRAND_NAME}</span>
            <span aria-hidden="true"> · </span>
            {BRAND_TAGLINE}
          </p>
        </footer>
      </div>

      {/* Lapor masalah drawer */}
      <ReportIssueDrawer
        open={reportOpen}
        onOpenChange={setReportOpen}
        onSubmit={handleSubmitIssue}
        roomLabel={`Kamar ${room.id}`}
      />
    </div>
  );
}

/** Radio-style payment method card */
function MethodOption({
  active,
  onSelect,
  icon,
  title,
  sub,
}: {
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20",
        active ? "border-zinc-900 bg-white ring-1 ring-zinc-900" : "border-border bg-white hover:border-zinc-300"
      )}
    >
      <span className={cn("mt-0.5 shrink-0", active ? "text-zinc-900" : "text-zinc-700")} aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[12.5px] font-semibold", active ? "text-zinc-900" : "text-zinc-700")}>
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-zinc-700">{sub}</span>
      </span>
      <span
        className={cn(
          "mt-0.5 size-3.5 shrink-0 rounded-full border bg-white",
          active ? "border-[5px] border-zinc-900" : "border-zinc-300"
        )}
        aria-hidden="true"
      />
    </button>
  );
}
