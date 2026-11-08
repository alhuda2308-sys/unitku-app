"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AffiliateAdminPanel — Manajemen Afiliasi Super Admin (client)
//
// Dipakai halaman /admin/affiliates (server component memvalidasi super admin
// + memuat data awal via getAffiliateAdminOverview). Mutasi memakai API
// /api/admin/affiliate/* lalu state di-update optimistis — tanpa refetch penuh.
//
// • Statistik : menunggu ditransfer (approved), sudah ditransfer (paid),
//   mitra terdaftar & aktif.
// • Tab 1 Pencairan Komisi : antrean komisi approved → "Tandai Sudah
//   Ditransfer" (status paid + paidAt).
// • Tab 2 Daftar Mitra : kontak, kode referral (salin link), total komisi,
//   toggle aktif/nonaktif, + modal "Tambah Mitra Baru".
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Check,
  Copy,
  Gift,
  Inbox,
  Landmark,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  UserRoundX,
} from "lucide-react";

import { MetricCard } from "@/components/kost/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatWaDisplay } from "@/lib/auth/phone-email";
import { normalizeWaPhone } from "@/lib/checkout-validation";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type {
  AdminPartnerRow,
  AdminPayoutRow,
  AffiliateAdminOverview,
} from "@/lib/affiliate-admin";

/** Format IDR ringkas: 150000 → "Rp150.000" */
function formatIDR(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

/** Label tanggal Indonesia — ISO → "8 Nov 2026" */
function dateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Salin teks ke clipboard — fallback utk konteks non-secure */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* lanjut ke fallback */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    return true;
  } catch {
    return false;
  }
}

const REF_CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function AffiliateAdminPanel({
  initial,
}: {
  initial: AffiliateAdminOverview;
}) {
  const router = useRouter();
  const [data, setData] = useState<AffiliateAdminOverview>(initial);
  // Sinkron ulang saat server component me-refresh props (router.refresh)
  useEffect(() => setData(initial), [initial]);

  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // ── State modal Tambah Mitra ──
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", refCode: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = () => {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 900);
  };

  // ── Aksi 1: tandai komisi sudah ditransfer ────────────────────────────────
  const markPaid = async (row: AdminPayoutRow) => {
    setBusyId(row.id);
    try {
      const res = await fetch("/api/admin/affiliate/payout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionId: row.id }),
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;
      if (!res.ok || !json?.success) {
        toast.error(json?.error ?? "Gagal menandai komisi", {
          description: "Coba lagi sebentar atau muat ulang halaman.",
        });
        return;
      }
      setData((prev) => ({
        stats: {
          ...prev.stats,
          pendingAmount: Math.max(0, prev.stats.pendingAmount - row.commissionAmount),
          pendingCount: Math.max(0, prev.stats.pendingCount - 1),
          paidAmount: prev.stats.paidAmount + row.commissionAmount,
          paidCount: prev.stats.paidCount + 1,
        },
        payoutQueue: prev.payoutQueue.filter((r) => r.id !== row.id),
        partners: prev.partners,
      }));
      toast.success("Komisi ditandai sudah ditransfer", {
        description: `${row.affiliateName} · ${formatIDR(row.commissionAmount)} · ${row.orderId}`,
      });
    } catch {
      toast.error("Koneksi bermasalah — coba lagi sebentar.");
    } finally {
      setBusyId(null);
    }
  };

  // ── Aksi 2: toggle aktif/nonaktif kode referral ───────────────────────────
  const toggleActive = async (partner: AdminPartnerRow) => {
    const next = !partner.isActive;
    setBusyId(partner.id);
    try {
      const res = await fetch("/api/admin/affiliate/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliateId: partner.id, isActive: next }),
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;
      if (!res.ok || !json?.success) {
        toast.error(json?.error ?? "Gagal mengubah status mitra");
        return;
      }
      setData((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          partnersActive: Math.max(
            0,
            prev.stats.partnersActive + (next ? 1 : -1),
          ),
        },
        partners: prev.partners.map((p) =>
          p.id === partner.id ? { ...p, isActive: next } : p,
        ),
      }));
      toast.success(
        next
          ? `Kode "${partner.refCode}" diaktifkan`
          : `Kode "${partner.refCode}" dinonaktifkan`,
        {
          description: next
            ? "Komisi baru kembali otomatis tercatat dari webhook."
            : "Komisi baru tidak lagi dicatat untuk kode ini.",
        },
      );
    } catch {
      toast.error("Koneksi bermasalah — coba lagi sebentar.");
    } finally {
      setBusyId(null);
    }
  };

  // ── Aksi 3: daftarkan mitra baru ──────────────────────────────────────────
  const submitCreate = async () => {
    const email = form.email.trim();
    const name = form.name.trim();
    const refCode = form.refCode.trim();
    if (!email || !name || !refCode) {
      setFormError("Semua kolom wajib diisi.");
      return;
    }
    if (!REF_CODE_RE.test(refCode)) {
      setFormError(
        "Kode referral hanya boleh huruf, angka, tanda hubung, atau garis bawah (maks 64).",
      );
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/affiliate/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, refCode }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        detail?: string;
        linkedUser?: boolean;
        partner?: AdminPartnerRow;
      } | null;
      if (!res.ok || !json?.success || !json.partner) {
        // Tampilkan juga detail error DB bila ada — Super Admin langsung
        // melihat penyebab teknis tanpa membuka server logs.
        setFormError(
          json?.detail && json?.error
            ? `${json.error} (${json.detail})`
            : (json?.error ?? "Gagal mendaftarkan mitra."),
        );
        return;
      }
      setData((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          partnersTotal: prev.stats.partnersTotal + 1,
          partnersActive: prev.stats.partnersActive + (json.partner!.isActive ? 1 : 0),
        },
        partners: [json.partner!, ...prev.partners],
      }));
      setCreateOpen(false);
      setForm({ email: "", name: "", refCode: "" });
      toast.success("Mitra baru terdaftar", {
        description: `${name} · kode "${refCode}" · link https://unitku.my.id/?ref=${refCode}`,
      });
      if (!json.linkedUser) {
        toast.warning("Kode belum terhubung ke akun user", {
          description:
            "Email tidak ditemukan di Supabase Auth — dashboard affiliator akan terhubung setelah user mendaftar dengan email tersebut, lalu daftarkan ulang kodenya.",
          duration: 9000,
        });
      }
    } catch {
      setFormError("Koneksi bermasalah — coba lagi sebentar.");
    } finally {
      setSubmitting(false);
    }
  };

  const { stats, payoutQueue, partners } = data;
  const pendingValue = formatIDR(stats.pendingAmount);

  return (
    <main className="min-h-dvh bg-[#f8fafc] pb-10">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-zinc-900">
              <Gift className="size-5 text-white" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-[17px] font-semibold tracking-tight text-zinc-900">
                Kelola Afiliasi
              </h1>
              <p className="mt-0.5 text-[12.5px] text-zinc-500">
                Pencairan komisi Rp150.000/penjualan &amp; daftar mitra affiliator.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={refreshing}
              className="h-8 gap-1.5 px-3 text-[12.5px]"
            >
              <RefreshCw
                className={cn("size-3.5", refreshing && "animate-spin")}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              Muat Ulang
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 gap-1.5 px-3 text-[12.5px]"
            >
              <Link href="/admin">
                <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                Panel Admin
              </Link>
            </Button>
          </div>
        </header>

        {/* ── Statistik ──────────────────────────────────────────────────── */}
        <section
          aria-label="Ringkasan afiliasi"
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <MetricCard
            dot="bg-amber-500"
            label="Menunggu Ditransfer (Approved)"
            mobileLabel="Menunggu Transfer"
            value={pendingValue}
            sub={`${stats.pendingCount} komisi approved wajib ditransfer ke mitra`}
          />
          <MetricCard
            dot="bg-emerald-500"
            label="Sudah Ditransfer (Paid)"
            mobileLabel="Sudah Ditransfer"
            value={formatIDR(stats.paidAmount)}
            sub={`${stats.paidCount} komisi paid — bukti transfer tercatat`}
          />
          <MetricCard
            dot="bg-sky-500"
            label="Mitra Terdaftar"
            mobileLabel="Mitra"
            value={String(stats.partnersTotal)}
            unit="mitra"
            badge={`${stats.partnersActive} aktif`}
            badgeClass={
              stats.partnersActive > 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-zinc-200 bg-zinc-100 text-zinc-600"
            }
            sub="Kode referral aktif menghasilkan komisi otomatis dari webhook"
          />
        </section>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <Tabs defaultValue="payout" className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList className="h-9 bg-zinc-100">
              <TabsTrigger
                value="payout"
                className="gap-1.5 text-[12.5px] data-[state=active]:bg-white"
              >
                <Banknote className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                Pencairan Komisi
                {payoutQueue.length > 0 && (
                  <Badge className="ml-1 h-5 border-transparent bg-amber-100 px-1.5 text-[11px] tabular-nums text-amber-800">
                    {payoutQueue.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="partners"
                className="gap-1.5 text-[12.5px] data-[state=active]:bg-white"
              >
                Daftar Mitra
                <Badge className="ml-1 h-5 border-transparent bg-zinc-200 px-1.5 text-[11px] tabular-nums text-zinc-700">
                  {partners.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
            <Button
              size="sm"
              onClick={() => {
                setFormError(null);
                setCreateOpen(true);
              }}
              className="h-8 gap-1.5 bg-zinc-900 px-3 text-[12.5px] text-white hover:bg-zinc-800"
            >
              <Plus className="size-3.5" strokeWidth={2} aria-hidden="true" />
              Tambah Mitra Baru
            </Button>
          </div>

          {/* ── Tab 1: Payout Queue ──────────────────────────────────────── */}
          <TabsContent value="payout" className="mt-3">
            <section className="rounded-lg border border-border bg-white">
              <div className="border-b border-border px-4 py-3 sm:px-5">
                <h2 className="text-sm font-bold text-zinc-900 sm:text-base">
                  Antrean Pencairan Komisi
                </h2>
                <p className="text-xs text-zinc-500">
                  Komisi approved menunggu transfer — paling lama menunggu
                  tampil paling atas. Total{" "}
                  <span className="font-bold text-amber-700">{pendingValue}</span>.
                </p>
              </div>

              {payoutQueue.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <Check className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-zinc-800">
                    Tidak ada komisi menunggu
                  </p>
                  <p className="max-w-sm text-xs leading-snug text-zinc-500">
                    Semua komisi approved sudah ditransfer. Komisi baru akan
                    muncul otomatis setiap webhook Mayar mencatat penjualan
                    dari link referral.
                  </p>
                </div>
              ) : (
                <div className="max-h-[520px] overflow-auto scrollbar-thin">
                  <Table className="min-w-[880px]">
                    <TableHeader className="sticky top-0 z-10 bg-zinc-50 [&_tr]:border-b">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-9 pl-4 text-[12.5px] font-medium text-zinc-500 sm:pl-5">
                          Tanggal
                        </TableHead>
                        <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">
                          Mitra
                        </TableHead>
                        <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">
                          Rekening Pencairan
                        </TableHead>
                        <TableHead className="h-9 text-right text-[12.5px] font-medium text-zinc-500">
                          Nominal
                        </TableHead>
                        <TableHead className="h-9 pr-4 text-right text-[12.5px] font-medium text-zinc-500 sm:pr-5">
                          Aksi
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payoutQueue.map((row) => {
                        const rekeningLengkap = Boolean(
                          row.bankName && row.bankAccountNo && row.bankAccountName,
                        );
                        const busy = busyId === row.id;
                        return (
                          <TableRow key={row.id} className="text-[13px]">
                            <TableCell className="whitespace-nowrap pl-4 align-top sm:pl-5">
                              <span className="font-medium text-zinc-800">
                                {dateLabel(row.createdAt)}
                              </span>
                              <span
                                className="block max-w-[180px] truncate text-[11px] text-zinc-400"
                                title={row.orderId}
                              >
                                {row.orderId}
                              </span>
                            </TableCell>
                            <TableCell className="align-top">
                              <span className="font-semibold text-zinc-900">
                                {row.affiliateName}
                              </span>
                              <span className="mt-0.5 flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className="h-5 border-zinc-200 px-1.5 text-[11px] font-bold text-zinc-600"
                                >
                                  ref: {row.refCode}
                                </Badge>
                                {row.affiliatePhone && (
                                  <a
                                    href={`https://wa.me/${normalizeWaPhone(row.affiliatePhone)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline"
                                  >
                                    <MessageCircle className="size-3" strokeWidth={2} aria-hidden="true" />
                                    WA
                                  </a>
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[240px] align-top">
                              {rekeningLengkap ? (
                                <>
                                  <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
                                    <Landmark className="size-3.5 shrink-0 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
                                    {row.bankName}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[12px] tabular-nums text-zinc-600">
                                    {row.bankAccountNo} a.n. {row.bankAccountName}
                                  </span>
                                </>
                              ) : (
                                <span className="inline-flex items-start gap-1 text-[12px] font-medium leading-snug text-amber-700">
                                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                  Rekening belum diisi mitra — minta lengkapi di dashboard affiliator
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right align-top font-bold tabular-nums text-emerald-700">
                              {formatIDR(row.commissionAmount)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap pr-4 text-right align-top sm:pr-5">
                              <Button
                                size="sm"
                                onClick={() => markPaid(row)}
                                disabled={busy}
                                className="h-8 gap-1.5 bg-emerald-600 px-3 text-[12.5px] text-white hover:bg-emerald-700"
                              >
                                {busy ? (
                                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
                                ) : (
                                  <Check className="size-3.5" strokeWidth={2} aria-hidden="true" />
                                )}
                                Tandai Sudah Ditransfer
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </TabsContent>

          {/* ── Tab 2: Daftar Mitra ──────────────────────────────────────── */}
          <TabsContent value="partners" className="mt-3">
            <section className="rounded-lg border border-border bg-white">
              <div className="border-b border-border px-4 py-3 sm:px-5">
                <h2 className="text-sm font-bold text-zinc-900 sm:text-base">
                  Seluruh Mitra Affiliator
                </h2>
                <p className="text-xs text-zinc-500">
                  Nonaktifkan kode untuk menghentikan komisi baru tanpa menghapus
                  riwayat — mitra tetap bisa melihat saldo &amp; riwayatnya.
                </p>
              </div>

              {partners.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                    <Inbox className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-zinc-800">
                    Belum ada mitra terdaftar
                  </p>
                  <p className="max-w-sm text-xs leading-snug text-zinc-500">
                    Klik &quot;Tambah Mitra Baru&quot; untuk mendaftarkan affiliator
                    pertama — tanpa perlu SQL manual.
                  </p>
                </div>
              ) : (
                <div className="max-h-[520px] overflow-auto scrollbar-thin">
                  <Table className="min-w-[900px]">
                    <TableHeader className="sticky top-0 z-10 bg-zinc-50 [&_tr]:border-b">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-9 pl-4 text-[12.5px] font-medium text-zinc-500 sm:pl-5">
                          Nama Lengkap
                        </TableHead>
                        <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">
                          Kontak
                        </TableHead>
                        <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">
                          Kode Referral
                        </TableHead>
                        <TableHead className="h-9 text-right text-[12.5px] font-medium text-zinc-500">
                          Total Komisi
                        </TableHead>
                        <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">
                          Status
                        </TableHead>
                        <TableHead className="h-9 pr-4 text-right text-[12.5px] font-medium text-zinc-500 sm:pr-5">
                          Bergabung
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partners.map((p) => {
                        const busy = busyId === p.id;
                        return (
                          <TableRow key={p.id} className="text-[13px]">
                            <TableCell className="pl-4 align-top sm:pl-5">
                              <span className="font-semibold text-zinc-900">
                                {p.name}
                              </span>
                              {!p.hasUser && (
                                <span
                                  className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-700"
                                  title="Email belum ditemukan di Supabase Auth — kode belum terhubung ke dashboard affiliator mana pun."
                                >
                                  <UserRoundX className="size-3" strokeWidth={2} aria-hidden="true" />
                                  Belum terhubung akun
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              {p.phone ? (
                                <a
                                  href={`https://wa.me/${normalizeWaPhone(p.phone)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 font-medium text-emerald-700 hover:underline"
                                >
                                  <MessageCircle className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                  {formatWaDisplay(normalizeWaPhone(p.phone))}
                                </a>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                              {p.email && (
                                <span className="mt-0.5 block max-w-[200px] truncate text-[11.5px] text-zinc-500" title={p.email}>
                                  {p.email}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              <button
                                type="button"
                                onClick={async () => {
                                  const link = `${window.location.origin}/?ref=${p.refCode}`;
                                  const ok = await copyText(link);
                                  if (ok) {
                                    toast.success("Link referral tersalin", {
                                      description: link,
                                    });
                                  } else {
                                    toast.error("Gagal menyalin link");
                                  }
                                }}
                                className="group inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[12px] font-bold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-white"
                                title={`Salin link referral: ${window.location.origin}/?ref=${p.refCode}`}
                              >
                                {p.refCode}
                                <Copy
                                  className="size-3 text-zinc-400 group-hover:text-zinc-600"
                                  strokeWidth={2}
                                  aria-hidden="true"
                                />
                              </button>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right align-top font-bold tabular-nums text-emerald-700">
                              {formatIDR(p.totalEarnings)}
                            </TableCell>
                            <TableCell className="align-top">
                              <span className="flex items-center gap-2">
                                <Badge
                                  className={cn(
                                    "border-transparent px-2 text-[11.5px] font-bold",
                                    p.isActive
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-zinc-200 text-zinc-600",
                                  )}
                                >
                                  {p.isActive ? "Aktif" : "Nonaktif"}
                                </Badge>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleActive(p)}
                                  disabled={busy}
                                  className={cn(
                                    "h-7 gap-1 px-2 text-[11.5px]",
                                    p.isActive
                                      ? "border-amber-200 text-amber-800 hover:bg-amber-50"
                                      : "border-emerald-200 text-emerald-800 hover:bg-emerald-50",
                                  )}
                                >
                                  {busy && (
                                    <Loader2 className="size-3 animate-spin" strokeWidth={2} aria-hidden="true" />
                                  )}
                                  {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                                </Button>
                              </span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap pr-4 text-right align-top text-[12px] text-zinc-500 sm:pr-5">
                              {dateLabel(p.createdAt)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Modal Tambah Mitra Baru ──────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
              Tambah Mitra Baru
            </DialogTitle>
            <DialogDescription className="text-[12.5px] leading-snug">
              Daftarkan affiliator tanpa SQL. Kode referral otomatis aktif dan
              link referral langsung bisa dibagikan.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3.5 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="aff-email" className="text-[12.5px]">
                Email User <span className="text-red-500">*</span>
              </Label>
              <Input
                id="aff-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="mitra@email.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="h-9 text-[13px]"
              />
              <p className="text-[11px] leading-snug text-zinc-500">
                Email akun user Supabase — kunci akses dashboard affiliator.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="aff-name" className="text-[12.5px]">
                Nama Lengkap <span className="text-red-500">*</span>
              </Label>
              <Input
                id="aff-name"
                placeholder="Nama mitra"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-9 text-[13px]"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="aff-ref" className="text-[12.5px]">
                Kode Referral <span className="text-red-500">*</span>
              </Label>
              <Input
                id="aff-ref"
                placeholder="mis. huda"
                value={form.refCode}
                onChange={(e) => setForm((f) => ({ ...f, refCode: e.target.value }))}
                className="h-9 font-mono text-[13px]"
              />
              <p className="text-[11px] leading-snug text-zinc-500">
                Link referral:{" "}
                <span className="font-mono">
                  {typeof window !== "undefined" ? window.location.origin : ""}/?ref=
                  {form.refCode.trim() || "<kode>"}
                </span>
              </p>
            </div>
            {formError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[12px] font-medium leading-snug text-red-700">
                {formError}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
              className="h-8 text-[12.5px]"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={submitCreate}
              disabled={submitting}
              className="h-8 gap-1.5 bg-zinc-900 text-[12.5px] text-white hover:bg-zinc-800"
            >
              {submitting && (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
              )}
              Daftarkan Mitra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
