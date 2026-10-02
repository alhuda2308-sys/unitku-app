"use client";

import { BadgeCheck, DoorOpen, Megaphone, MessageCircle, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  formatIDR,
  initialsOf,
  STATUS_META,
  waLink,
  type Room,
} from "@/lib/kost-data";
import { cn } from "@/lib/utils";
import { adCtaLabel, adPropertyScope } from "@/lib/ad-generator";
import { FacilityBadge } from "./facility-badge";
import { PortalAccessCard } from "./portal-access-card";

interface RoomDrawerProps {
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkPaid: (room: Room) => void;
  onSendInvoice: (room: Room) => void;
  onCheckIn: (room: Room) => void;
  /** Unit kosong → buka Generator Iklan Sosmed (opsional) */
  onCreateAd?: (room: Room) => void;
  /** Nama properti — tampil pada QR & tautan portal penyewa */
  propertyName: string;
  /** false = peran read-only (Penjaga) — aksi ubah data disembunyikan */
  canManage?: boolean;
  /** Tipe properti aktif — label CTA iklan adaptif (Kamar/Kontrakan/Unit) */
  propertyType?: string;
}

function SectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-white", className)}>
      <h3 className="border-b border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
        {title}
      </h3>
      <div className="p-4">{children}</div>
    </section>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 pt-px text-[12.5px] text-zinc-700">{label}</span>
      <span className="min-w-0 break-words text-right text-[12.5px] font-medium leading-5 text-zinc-800">
        {children}
      </span>
    </div>
  );
}

/** Full status label for drawer: "Menunggak H+2" / "Jatuh Tempo H-2" / "Lunas" */
function invoiceStatusLabel(room: Room): string {
  const off = room.invoice?.dayOffset;
  if (room.status === "menunggak" && off !== undefined) return `Menunggak H+${off}`;
  if (room.status === "jatuhTempo" && off !== undefined) return `Jatuh Tempo H-${off}`;
  return STATUS_META[room.status].label;
}

export function RoomDrawer({
  room,
  open,
  onOpenChange,
  onMarkPaid,
  onSendInvoice,
  onCheckIn,
  onCreateAd,
  canManage = true,
  propertyName,
  propertyType,
}: RoomDrawerProps) {
  const vacant = room?.status === "kosong";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[100vw] gap-0 border-l-border p-0 sm:max-w-[420px]"
        aria-describedby={undefined}
      >
        {room && (
          <>
            {/* Header */}
            <SheetHeader className="border-b border-border bg-white p-4 pb-3.5">
              <SheetDescription className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                Detail Kamar
              </SheetDescription>
              <SheetTitle className="text-[15px] font-bold tracking-tight text-zinc-900">
                Kamar {room.id} — {room.type}
              </SheetTitle>
              <p className="text-[12.5px] tabular-nums text-zinc-700">
                Lantai {room.floor} · {formatIDR(room.price)} / bulan
              </p>
            </SheetHeader>

            <div className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-4 scrollbar-thin">
              {vacant ? (
                /* ── VACANT STATE ─────────────────────────────────────── */
                <>
                  <div className="flex flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed border-zinc-200 bg-white px-6 py-10 text-center">
                    <span className="flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                      <DoorOpen className="size-5" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <p className="text-[13px] font-semibold text-zinc-700">Kamar ini kosong</p>
                    <p className="max-w-[260px] text-xs leading-5 text-zinc-700">
                      Belum ada penyewa terdaftar. Lakukan check-in untuk mengisi kamar{" "}
                      {room.id}.
                    </p>
                    {canManage && (
                      <Button
                        onClick={() => onCheckIn(room)}
                        className="mt-1 h-8 bg-zinc-900 px-3 text-[12.5px] font-semibold text-white shadow-none hover:bg-zinc-800"
                      >
                        Check-in Penghuni
                      </Button>
                    )}
                    {onCreateAd && (
                      <>
                        <Button
                          onClick={() => onCreateAd(room)}
                          className="mt-0.5 h-8 bg-gradient-to-r from-amber-500 to-orange-500 px-3 text-[12.5px] font-bold text-white shadow-none transition-all hover:from-amber-600 hover:to-orange-600"
                        >
                          <Megaphone className="size-3.5" strokeWidth={2} aria-hidden="true" />
                          {adCtaLabel(adPropertyScope(propertyType))} / Promosi Sosmed
                        </Button>
                        <p className="text-[11px] leading-tight text-zinc-500">
                          Draf iklan otomatis siap copas ke Facebook, Marketplace &amp; Status WA
                        </p>
                      </>
                    )}
                  </div>

                  <SectionCard title="Info Kamar">
                    <div className="space-y-3">
                      <InfoRow label="Tipe Kamar">{room.type}</InfoRow>
                      <InfoRow label="Tarif per Bulan">
                        <span className="tabular-nums">{formatIDR(room.price)}</span>
                      </InfoRow>
                      <InfoRow label="Status">
                        <span className="inline-flex h-5 items-center rounded-full border border-zinc-200 bg-zinc-100 px-1.5 text-xs font-semibold text-zinc-700">
                          Tersedia
                        </span>
                      </InfoRow>
                    </div>
                  </SectionCard>

                  {/* Fasilitas kamar — badge pill flex-wrap */}
                  {(room.facilities?.length ?? 0) > 0 && (
                    <SectionCard title="Fasilitas Kamar">
                      <div className="flex flex-wrap gap-2" aria-label="Daftar fasilitas kamar">
                        {room.facilities!.map((f) => (
                          <FacilityBadge key={f} label={f} />
                        ))}
                      </div>
                    </SectionCard>
                  )}
                </>
              ) : (
                /* ── OCCUPIED STATE ───────────────────────────────────── */
                <>
                  {/* Tenant info */}
                  <SectionCard title="Data Penyewa">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-[13px] font-bold text-zinc-600"
                        aria-hidden="true"
                      >
                        {initialsOf(room.tenant!.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold leading-5 text-zinc-900">
                          {room.tenant!.name}
                        </p>
                        <p className="text-[12.5px] tabular-nums text-zinc-700">
                          Penyewa sejak {room.tenant!.moveInDate}
                        </p>
                      </div>
                    </div>

                    <Separator className="my-3.5" />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="shrink-0 text-[12.5px] text-zinc-700">No. WhatsApp</span>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[12.5px] font-medium tabular-nums text-zinc-800">
                            {room.tenant!.phone}
                          </span>
                          <a
                            href={waLink(room.tenant!.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-green-200 bg-green-50 px-1.5 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100"
                          >
                            <MessageCircle className="size-3" strokeWidth={2} aria-hidden="true" />
                            Chat WA
                          </a>
                        </span>
                      </div>
                      <InfoRow label="Tanggal Masuk">
                        <span className="tabular-nums">{room.tenant!.moveInDate}</span>
                      </InfoRow>
                      <InfoRow label="Kontak Darurat">
                        <span className="inline-flex flex-col items-end gap-0.5">
                          <span className="inline-flex items-center gap-1.5">
                            <PhoneCall className="size-3 shrink-0 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
                            {room.tenant!.emergencyContact.name}
                          </span>
                          <span className="tabular-nums text-zinc-700">
                            {room.tenant!.emergencyContact.phone}
                          </span>
                        </span>
                      </InfoRow>
                    </div>
                  </SectionCard>

                  {/* Last invoice */}
                  <SectionCard title="Status Tagihan Terakhir">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[12.5px] text-zinc-700">Nominal Sewa</p>
                        <p className="mt-1 text-[22px] font-bold leading-7 tracking-tight tabular-nums text-zinc-900">
                          {formatIDR(room.invoice!.amount)}
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-zinc-700">
                          Periode {room.invoice!.periodLabel} · Tempo{" "}
                          <span className="tabular-nums">{room.invoice!.dueLabel.replace("Tempo: ", "")}</span>
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex h-6 shrink-0 items-center rounded-full border px-2 text-xs font-semibold tabular-nums",
                          STATUS_META[room.status].pill
                        )}
                      >
                        {invoiceStatusLabel(room)}
                      </span>
                    </div>

                    {canManage && (
                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        onClick={() => onSendInvoice(room)}
                        className="h-8 border-green-600 bg-white px-2 text-[12.5px] font-semibold text-green-700 shadow-none hover:bg-green-50 hover:text-green-800"
                      >
                        <MessageCircle className="size-3.5" strokeWidth={2} />
                        Kirim Tagihan WA
                      </Button>
                      <Button
                        onClick={() => onMarkPaid(room)}
                        disabled={room.status === "lunas"}
                        className="h-8 bg-zinc-900 px-2 text-[12.5px] font-semibold text-white shadow-none hover:bg-zinc-800"
                      >
                        <BadgeCheck className="size-3.5" strokeWidth={2} />
                        {room.status === "lunas" ? "Sudah Lunas" : "Tandai Lunas Manual"}
                      </Button>
                    </div>
                    )}
                  </SectionCard>

                  {/* Contract */}
                  <SectionCard title="Kontrak Sewa">
                    <div className="space-y-3">
                      <InfoRow label="Durasi Sewa">{room.contract!.duration}</InfoRow>
                      <InfoRow label="Mulai Kontrak">
                        <span className="tabular-nums">{room.contract!.startDate}</span>
                      </InfoRow>
                      <InfoRow label="Uang Deposit">
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <span className="tabular-nums">{formatIDR(room.contract!.deposit)}</span>
                          <span
                            className={cn(
                              "inline-flex h-5 items-center rounded-full border px-1.5 text-xs font-semibold",
                              room.contract!.depositHeld
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-zinc-200 bg-zinc-100 text-zinc-700"
                            )}
                          >
                            {room.contract!.depositHeld ? "Ditahan" : "Dikembalikan"}
                          </span>
                        </span>
                      </InfoRow>
                    </div>
                  </SectionCard>

                  {/* Fasilitas kamar — badge pill flex-wrap */}
                  {(room.facilities?.length ?? 0) > 0 && (
                    <SectionCard title="Fasilitas Kamar">
                      <div className="flex flex-wrap gap-2" aria-label="Daftar fasilitas kamar">
                        {room.facilities!.map((f) => (
                          <FacilityBadge key={f} label={f} />
                        ))}
                      </div>
                    </SectionCard>
                  )}

                  {/* Magic token link & QR portal penyewa */}
                  <PortalAccessCard room={room} propertyName={propertyName} />
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
