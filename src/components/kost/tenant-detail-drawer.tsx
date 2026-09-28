"use client";

import { BadgeCheck, CalendarClock, MessageCircle, PhoneCall } from "lucide-react";
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
  addMonths,
  formatIDR,
  initialsOf,
  parseDateLabel,
  dateToLabel,
  waLink,
  type Room,
} from "@/lib/kost-data";
import { INVOICE_STATUS_META, type Invoice } from "@/lib/kost-invoices";
import { cn } from "@/lib/utils";
import { PortalAccessCard } from "./portal-access-card";

interface TenantDetailDrawerProps {
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenew: (room: Room) => void;
  onCheckout: (room: Room) => void;
  /** Lifted invoice history — reflects room deletion / demo-data resets live */
  invoices: Invoice[];
  /** Nama properti — tampil pada QR & tautan portal penyewa */
  propertyName: string;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-white">
      <h3 className="border-b border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
        {title}
      </h3>
      <div className="p-4">{children}</div>
    </section>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 pt-px text-[12.5px] text-zinc-700">{label}</span>
      <span className="min-w-0 break-words text-right text-[12.5px] font-medium leading-5 text-zinc-800">
        {children}
      </span>
    </div>
  );
}

export function TenantDetailDrawer({ room, open, onOpenChange, onRenew, onCheckout, invoices, propertyName }: TenantDetailDrawerProps) {
  const history = room ? invoices.filter((i) => i.roomId === room.id) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[100vw] gap-0 border-l-border p-0 sm:max-w-[420px]"
        aria-describedby={undefined}
      >
        {room && room.tenant && (
          <>
            {/* Header */}
            <SheetHeader className="border-b border-border bg-white p-4 pb-3.5">
              <SheetDescription className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                Profil Penghuni
              </SheetDescription>
              <SheetTitle className="text-[15px] font-bold tracking-tight text-zinc-900">
                {room.tenant.name}
              </SheetTitle>
              <div className="flex items-center gap-1.5 text-[12.5px] tabular-nums text-zinc-700">
                <span className="inline-flex h-5 items-center rounded-md border border-border bg-zinc-50 px-1.5 font-semibold text-zinc-700">
                  Kamar {room.id}
                </span>
                <span>· {room.type}</span>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-4 scrollbar-thin">
              {/* Data penyewa */}
              <SectionCard title="Data Penyewa">
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-[13px] font-bold text-zinc-600"
                    aria-hidden="true"
                  >
                    {initialsOf(room.tenant.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold leading-5 text-zinc-900">
                      {room.tenant.name}
                    </p>
                    <p className="text-[12.5px] tabular-nums text-zinc-700">
                      Menyewa sejak {room.tenant.moveInDate}
                    </p>
                  </div>
                </div>
                <Separator className="my-3.5" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="shrink-0 text-[12.5px] text-zinc-700">No. WhatsApp</span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[12.5px] font-medium tabular-nums text-zinc-800">
                        {room.tenant.phone}
                      </span>
                      <a
                        href={waLink(room.tenant.phone)}
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
                    <span className="tabular-nums">{room.tenant.moveInDate}</span>
                  </InfoRow>
                  <InfoRow label="Kontak Darurat">
                    <span className="inline-flex flex-col items-end gap-0.5">
                      <span className="inline-flex items-center gap-1.5">
                        <PhoneCall className="size-3 shrink-0 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
                        {room.tenant.emergencyContact.name}
                      </span>
                      <span className="tabular-nums text-zinc-700">
                        {room.tenant.emergencyContact.phone}
                      </span>
                    </span>
                  </InfoRow>
                </div>
              </SectionCard>

              {/* Kontrak & deposit */}
              <SectionCard title="Kontrak &amp; Deposit">
                <div className="space-y-3">
                  <InfoRow label="Siklus Sewa">{room.contract!.duration}</InfoRow>
                  <InfoRow label="Mulai Kontrak">
                    <span className="tabular-nums">{room.contract!.startDate}</span>
                  </InfoRow>
                  <InfoRow label="Kontrak Berakhir">
                    {room.contract!.endDate ? (
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <CalendarClock className="size-3 shrink-0 text-amber-500" strokeWidth={1.75} aria-hidden="true" />
                        {room.contract!.endDate}
                      </span>
                    ) : (
                      <span className="text-[12.5px] text-zinc-700">Auto-renew (bulanan)</span>
                    )}
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

              {/* Magic token link & QR portal penyewa */}
              <PortalAccessCard room={room} propertyName={propertyName} />

              {/* Riwayat tagihan */}
              <SectionCard title="Riwayat Tagihan">
                <div className="space-y-2">
                  {history.length === 0 && (
                    <p className="py-2 text-center text-[12.5px] text-zinc-700">
                      Belum ada tagihan tercatat.
                    </p>
                  )}
                  {history.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-semibold text-zinc-700">{inv.id}</p>
                        <p className="mt-0.5 truncate text-[12.5px] font-medium text-zinc-800">
                          {inv.periodLabel}
                        </p>
                        <p className="text-xs tabular-nums text-zinc-700">Tempo {inv.dueDate}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[13px] font-bold tabular-nums text-zinc-900">
                          {formatIDR(inv.total)}
                        </p>
                        <span
                          className={cn(
                            "mt-0.5 inline-flex h-5 items-center rounded-full border px-1.5 text-xs font-semibold",
                            INVOICE_STATUS_META[inv.status].pill
                          )}
                        >
                          {INVOICE_STATUS_META[inv.status].label}
                        </span>
                      </div>
                    </div>
                  ))}
                  <p className="pt-1 text-xs leading-4 text-zinc-700">
                    Menampilkan {history.length} tagihan dari periode berjalan (Sep 2025).
                  </p>
                </div>
              </SectionCard>

              {/* Status tagihan berjalan */}
              {room.invoice && (
                <SectionCard title="Status Tagihan Berjalan">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[12.5px] text-zinc-700">{room.invoice.periodLabel}</p>
                      <p className="mt-1 text-[20px] font-bold leading-6 tracking-tight tabular-nums text-zinc-900">
                        {formatIDR(room.invoice.amount)}
                      </p>
                      <p className="mt-0.5 text-[12.5px] tabular-nums text-zinc-700">
                        {room.invoice.dueLabel}
                      </p>
                    </div>
                    <span className="inline-flex h-6 shrink-0 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold">
                      <BadgeCheck className="mr-1 size-3" strokeWidth={2} aria-hidden="true" />
                      Terdata
                    </span>
                  </div>
                </SectionCard>
              )}
            </div>

            {/* Footer actions */}
            <div className="border-t border-border bg-white p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onRenew(room);
                  }}
                  className="h-8 border-zinc-200 bg-white text-[12.5px] text-zinc-700 shadow-none hover:bg-zinc-50"
                >
                  <CalendarClock className="size-3.5" strokeWidth={1.75} />
                  Perpanjang Sewa
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onCheckout(room);
                  }}
                  className="h-8 border-red-200 bg-white text-[12.5px] font-semibold text-red-600 shadow-none hover:bg-red-50 hover:text-red-700"
                >
                  Proses Check-out / Refund
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Shared helper: next contract end date from an existing end (or cycle end) */
export function nextEndDate(room: Room, months: number): string {
  const base = room.contract?.endDate ? parseDateLabel(room.contract.endDate) : new Date(2025, 8, 30);
  return dateToLabel(addMonths(base, months));
}
