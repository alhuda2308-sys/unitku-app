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
// • Tab 1 Antrean Pencairan Komisi : komisi approved → info rekening TERBARU
//   langsung dari data yang diinput mitra di dashboardnya (sinkron real-time:
//   refresh otomatis saat kembali ke tab / fokus jendela) + tombol "Copy
//   Rekening" (format "[Bank] [No Rek] a.n [Nama]") + "Tandai Sudah
//   Ditransfer" (status paid + paidAt) + tombol "Kirim Bukti WA" (pesan
//   konfirmasi transfer sapaan "Kak" via wa.me, buka tab baru) di sampingnya
//   + riwayat komisi PAID dengan tombol Kirim Bukti WA per baris; setelah
//   tandai-transfer, toast sukses menyediakan pintasan "Langsung Kirim Bukti
//   via WhatsApp".
// • Tab 2 Daftar Mitra : WhatsApp (wa.me), kode referral, info rekening +
//   copy, link portal mitra (magic-link), total komisi, toggle aktif +
//   aksi "Kirim WA Sambutan" (wa.me + template baku sapaan "Kak", buka tab
//   baru) & "Hapus Mitra" (confirm native → DELETE /api/admin/affiliate/[id] →
//   tabel diperbarui optimistis tanpa reload halaman penuh) +
//   modal "Tambah Mitra Baru" (3 field: Nama, Kode Referral, No. WhatsApp —
//   TANPA email; backend membuat fallback identifier otomatis) → modal sukses
//   berisi ringkasan + link portal + "Salin Pesan Sambutan WhatsApp".
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Check,
  CircleCheck,
  Copy,
  Gift,
  Inbox,
  Landmark,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  SquareArrowOutUpRight,
  Trash2,
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
import { SITE_URL } from "@/lib/landing-config";
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

/**
 * Format rekening siap-tempel m-Banking — persis permintaan:
 * "[Bank] [No Rek] a.n [Nama]" → "BCA 0970545093 a.n Budi Santoso"
 */
function formatRekeningText(
  bankName: string | null,
  bankAccountNo: string | null,
  bankAccountName: string | null,
): string {
  return `${bankName ?? ""} ${bankAccountNo ?? ""} a.n ${bankAccountName ?? ""}`.trim();
}

/** Link portal mitra (magic-link) — ref utk konteks, token utk akses nyata */
function portalLink(refCode: string, accessToken: string | null): string | null {
  if (!accessToken) return null;
  return `${SITE_URL}/affiliate/dashboard?ref=${refCode}&token=${accessToken}`;
}

/**
 * Sanitasi live input kode referral — huruf kecil tanpa spasi (permintaan):
 * lowercase + buang SEMUA whitespace. Karakter lain divalidasi saat submit
 * (hanya [a-z0-9_-] yang lolos — sama dengan sanitizeAffiliateRef backend).
 */
function sanitizeRefCodeInput(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, "");
}

/**
 * Pesan sambutan WhatsApp mitra — TEMPLATE BAKU permintaan admin (persis,
 * termasuk emoji & poin) dengan sapaan ramah "Kak" — dipakai modal sukses
 * pendaftaran & tombol "Kirim WA Sambutan" di Daftar Mitra. Link memakai
 * SITE_URL (https://unitku.my.id).
 */
function waSambutanMessage(name: string, refCode: string): string {
  return [
    `Halo Kak ${name}, akun kemitraan afiliasi UnitKu Kakak sudah aktif! 🎉`,
    "",
    "Berikut detail akun kemitraan Kakak:",
    `• Kode Referral: ${refCode}`,
    `• Link Promosi Utama: ${SITE_URL}/?ref=${refCode}`,
    `• Link Direct Checkout: ${SITE_URL}/checkout?ref=${refCode}`,
    "",
    "Kakak bisa mengakses Dashboard Afiliasi pribadi di:",
    `${SITE_URL}/affiliate/dashboard`,
    "",
    "Jangan lupa buka dashboard untuk melengkapi data rekening bank/e-wallet ya Kak, agar pencairan komisi (Rp150.000 per penjualan) bisa langsung kami transfer.",
    "",
    "Semangat berpromosi dan sukses selalu bersama UnitKu ya, Kak!",
  ].join("\n");
}

/** Tanggal hari ini, format Indonesia panjang — "9 November 2026" */
function todayLabel(): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

/**
 * Link wa.me — nomor WAJIB format internasional 62xxx tanpa '+' / '-' dan
 * pesan ter-encode URL (link dibuka di tab baru).
 */
function waLink(phone: string, message: string): string {
  return `https://wa.me/${normalizeWaPhone(phone)}?text=${encodeURIComponent(message)}`;
}

/**
 * Pesan konfirmasi transfer komisi — TEMPLATE BAKU permintaan admin (sapaan
 * ramah "Kak"): nominal, rekening tujuan, ID transaksi, tanggal. Tanggal
 * memakai paidAt (riwayat paid) atau hari ini (baru ditandai ditransfer).
 */
function waTransferMessage(row: AdminPayoutRow): string {
  const tanggal = row.paidAt ? dateLabel(row.paidAt) : todayLabel();
  return [
    `Halo Kak ${row.affiliateName}, `,
    "",
    "Kabar gembira! Komisi kemitraan afiliasi UnitKu Kakak telah berhasil ditransfer. 🎉",
    "",
    "Detail Pencairan:",
    `• Nominal Komisi: ${formatIDR(row.commissionAmount)}`,
    `• Rekening Tujuan: ${row.bankName ?? "-"} - ${row.bankAccountNo ?? "-"} (a.n. ${row.bankAccountName ?? "-"})`,
    `• ID Transaksi: ${row.orderId}`,
    `• Tanggal: ${tanggal}`,
    "",
    "Terima kasih banyak atas kerja sama dan kontribusinya dalam mempromosikan UnitKu ya, Kak. Kakak juga bisa mengecek riwayat komisi langsung di portal:",
    `${SITE_URL}/affiliate/dashboard`,
    "",
    "Semangat terus dan semoga closing-an berikutnya makin lancar ya Kak!",
  ].join("\n");
}

/** Ringkasan mitra yang BARU dibuat — dipakai modal sukses */
interface CreatedPartner {
  name: string;
  refCode: string;
  phone: string; // ternormalisasi 62…
  portalUrl: string;
  waMessage: string;
  linkedUser: boolean;
}

const REF_CODE_RE = /^[a-z0-9_-]{1,64}$/;

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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── State modal Tambah Mitra ──
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", refCode: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── State modal sukses (ringkasan mitra + link portal + pesan WA) ──
  const [created, setCreated] = useState<CreatedPartner | null>(null);

  const refresh = () => {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 900);
  };

  // ── Sinkron real-time rekening mitra ────────────────────────────────────────
  // Mitra bisa memperbarui rekening kapan saja di dashboardnya — setiap kali
  // admin kembali ke tab ini / jendela regains focus, data server dimuat ulang
  // (router.refresh → prop `initial` baru → useEffect di atas menyinkronkan).
  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

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
      // Baris pindah ke riwayat paid (paidAt = sekarang) — dipakai pesan WA
      const paidRow: AdminPayoutRow = {
        ...row,
        paidAt: new Date().toISOString(),
      };
      setData((prev) => ({
        stats: {
          ...prev.stats,
          pendingAmount: Math.max(0, prev.stats.pendingAmount - row.commissionAmount),
          pendingCount: Math.max(0, prev.stats.pendingCount - 1),
          paidAmount: prev.stats.paidAmount + row.commissionAmount,
          paidCount: prev.stats.paidCount + 1,
        },
        payoutQueue: prev.payoutQueue.filter((r) => r.id !== row.id),
        paidHistory: [paidRow, ...prev.paidHistory],
        partners: prev.partners,
      }));
      // Sinkronkan riwayat paid di server di belakang layar (tanpa reload)
      router.refresh();
      const waUrl = row.affiliatePhone
        ? waLink(row.affiliatePhone, waTransferMessage(paidRow))
        : null;
      toast.success("Komisi ditandai sudah ditransfer", {
        description: `${row.affiliateName} · ${formatIDR(row.commissionAmount)} · ${row.orderId}`,
        // Pintasan WA — klik action toast adalah user gesture, popup diizinkan
        duration: 20000,
        ...(waUrl
          ? {
              action: {
                label: "Langsung Kirim Bukti via WhatsApp",
                onClick: () => window.open(waUrl, "_blank", "noopener,noreferrer"),
              },
            }
          : {}),
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

  // ── Aksi: hapus mitra (confirm native → DELETE API → update tanpa reload) ──
  const deletePartner = async (partner: AdminPartnerRow) => {
    const confirmed = window.confirm(
      `Yakin ingin menghapus mitra ${partner.name}? Semua data kode referral dan komisi terkait akan terhapus.`,
    );
    if (!confirmed) return;

    setDeletingId(partner.id);
    try {
      const res = await fetch(`/api/admin/affiliate/${partner.id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        deletedCommissions?: number;
        deletedTrials?: number;
      } | null;
      if (!res.ok || !json?.success) {
        toast.error(json?.error ?? "Gagal menghapus mitra.");
        return;
      }

      // Update optimistis TANPA reload halaman penuh — baris mitra hilang,
      // antrean pencairan & statistik menyesuaikan, lalu router.refresh()
      // menyinkronkan ulang seluruh angka dari server di belakang layar.
      setData((prev) => {
        const removedQueue = prev.payoutQueue.filter(
          (row) => row.refCode === partner.refCode,
        );
        const removedSum = removedQueue.reduce(
          (sum, row) => sum + row.commissionAmount,
          0,
        );
        const removedPaid = prev.paidHistory.filter(
          (row) => row.refCode === partner.refCode,
        );
        const removedPaidSum = removedPaid.reduce(
          (sum, row) => sum + row.commissionAmount,
          0,
        );
        return {
          stats: {
            ...prev.stats,
            pendingAmount: Math.max(0, prev.stats.pendingAmount - removedSum),
            pendingCount: Math.max(
              0,
              prev.stats.pendingCount - removedQueue.length,
            ),
            paidAmount: Math.max(0, prev.stats.paidAmount - removedPaidSum),
            paidCount: Math.max(0, prev.stats.paidCount - removedPaid.length),
            partnersTotal: Math.max(0, prev.stats.partnersTotal - 1),
            partnersActive: Math.max(
              0,
              prev.stats.partnersActive - (partner.isActive ? 1 : 0),
            ),
          },
          payoutQueue: prev.payoutQueue.filter(
            (row) => row.refCode !== partner.refCode,
          ),
          paidHistory: prev.paidHistory.filter(
            (row) => row.refCode !== partner.refCode,
          ),
          partners: prev.partners.filter((p) => p.id !== partner.id),
        };
      });
      router.refresh();
      // Ringkasan hard delete — data apa saja yang ikut terhapus bersama mitra
      const deletedBits: string[] = [];
      if (json.deletedTrials && json.deletedTrials > 0) {
        deletedBits.push(
          `${json.deletedTrials} link trial lama langsung mati (tidak bisa diakses lagi)`,
        );
      }
      if (json.deletedCommissions && json.deletedCommissions > 0) {
        deletedBits.push(
          `${json.deletedCommissions} baris komisi terkait ikut terhapus`,
        );
      }
      toast.success(`Mitra ${partner.name} dihapus`, {
        description:
          deletedBits.length > 0
            ? `${deletedBits.join(" · ")}.`
            : "Kode referral kini bebas dipakai mitra baru.",
      });
    } catch {
      toast.error("Koneksi bermasalah — coba lagi sebentar.");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Aksi 3: daftarkan mitra baru (Nama + Kode Referral + No. WhatsApp) ────
  const submitCreate = async () => {
    const name = form.name.trim();
    const refCode = sanitizeRefCodeInput(form.refCode);
    const phone = normalizeWaPhone(form.phone);

    if (!name || !refCode || !form.phone.trim()) {
      setFormError("Semua kolom wajib diisi.");
      return;
    }
    if (!REF_CODE_RE.test(refCode)) {
      setFormError(
        "Kode referral hanya boleh huruf kecil, angka, tanda hubung, atau garis bawah (maks 64).",
      );
      return;
    }
    if (!/^62[0-9]{8,13}$/.test(phone)) {
      setFormError(
        "Nomor WhatsApp belum sesuai — gunakan format Indonesia, mis. 081234567890 atau 6281234567890.",
      );
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/affiliate/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, refCode, phone }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        detail?: string;
        linkedUser?: boolean;
        accessToken?: string;
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
      const token = json.accessToken ?? json.partner.accessToken;
      const portalUrl =
        portalLink(json.partner.refCode, token ?? null) ??
        `${SITE_URL}/affiliate/dashboard`;
      const waMessage = waSambutanMessage(json.partner.name, json.partner.refCode);

      setData((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          partnersTotal: prev.stats.partnersTotal + 1,
          partnersActive: prev.stats.partnersActive + (json.partner!.isActive ? 1 : 0),
        },
        partners: [json.partner!, ...prev.partners],
      }));

      // Tutup form → buka MODAL SUKSES (ringkasan + link portal + pesan WA)
      setCreateOpen(false);
      setForm({ name: "", refCode: "", phone: "" });
      setCreated({
        name: json.partner.name,
        refCode: json.partner.refCode,
        phone,
        portalUrl,
        waMessage,
        linkedUser: Boolean(json.linkedUser),
      });
      toast.success("Akun mitra aktif dibuat", {
        description: `${json.partner.name} · kode "${json.partner.refCode}"`,
      });
    } catch {
      setFormError("Koneksi bermasalah — coba lagi sebentar.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Aksi 4: salin rekening instan (m-Banking friendly) ────────────────────
  const copyRekening = async (
    bankName: string | null,
    bankAccountNo: string | null,
    bankAccountName: string | null,
  ) => {
    const text = formatRekeningText(bankName, bankAccountNo, bankAccountName);
    const ok = await copyText(text);
    if (ok) {
      toast.success("Rekening tersalin", { description: text });
    } else {
      toast.error("Gagal menyalin rekening");
    }
  };

  const { stats, payoutQueue, paidHistory, partners } = data;
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
        <Tabs
          defaultValue="payout"
          className="mt-5"
          onValueChange={(value) => {
            // Antrean pencairan wajib memakai rekening TERBARU yang diinput
            // mitra — muat ulang data server setiap kali tab dibuka.
            if (value === "payout") router.refresh();
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList className="h-9 bg-zinc-100">
              <TabsTrigger
                value="payout"
                className="gap-1.5 text-[12.5px] data-[state=active]:bg-white"
              >
                <Banknote className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                Antrean Pencairan Komisi
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
                  tampil paling atas. Rekening tampil LANGSUNG dari data
                  terbaru yang diinput mitra di dashboardnya. Total{" "}
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
                  <Table className="min-w-[980px]">
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
                        // wa.me wajib format internasional 62 + digit murni
                        const waPhone = row.affiliatePhone
                          ? normalizeWaPhone(row.affiliatePhone)
                          : null;
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
                            <TableCell className="max-w-[260px] align-top">
                              {rekeningLengkap ? (
                                <>
                                  <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
                                    <Landmark className="size-3.5 shrink-0 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
                                    {row.bankName}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[12px] tabular-nums text-zinc-600">
                                    {row.bankAccountNo} a.n. {row.bankAccountName}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyRekening(
                                        row.bankName,
                                        row.bankAccountNo,
                                        row.bankAccountName,
                                      )
                                    }
                                    className="mt-1.5 inline-flex h-7 items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 text-[11.5px] font-semibold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-white"
                                    title="Salin format: [Bank] [No Rek] a.n [Nama]"
                                  >
                                    <Copy className="size-3" strokeWidth={2} aria-hidden="true" />
                                    Copy Rekening
                                  </button>
                                </>
                              ) : (
                                <span
                                  className="inline-flex items-start gap-1 text-[12px] font-medium leading-snug text-amber-700"
                                  title="Rekening belum diisi mitra — minta lengkapi di dashboard affiliator (link portal)"
                                >
                                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                  Belum diisi mitra
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right align-top font-bold tabular-nums text-emerald-700">
                              {formatIDR(row.commissionAmount)}
                            </TableCell>
                            <TableCell className="pr-4 align-top sm:pr-5">
                              <span className="flex flex-wrap items-center justify-end gap-1.5">
                                {/* Kirim Bukti WA — pesan konfirmasi transfer
                                    sapaan "Kak", buka tab baru */}
                                {waPhone ? (
                                  <a
                                    href={waLink(waPhone, waTransferMessage(row))}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-[12.5px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                                    title="Buka WhatsApp dengan pesan konfirmasi transfer siap kirim"
                                  >
                                    <MessageCircle className="size-3.5" strokeWidth={2} aria-hidden="true" />
                                    Kirim Bukti WA
                                  </a>
                                ) : (
                                  <span
                                    className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-[12.5px] font-medium text-zinc-400"
                                    title="No. WhatsApp mitra belum tersedia"
                                  >
                                    <MessageCircle className="size-3.5" strokeWidth={2} aria-hidden="true" />
                                    Kirim Bukti WA
                                  </span>
                                )}
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
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* ── Riwayat Sudah Ditransfer (paid) — Kirim Bukti WA kapan pun ── */}
              {paidHistory.length > 0 && (
                <div className="border-t border-border">
                  <div className="px-4 py-3 sm:px-5">
                    <h3 className="text-[13px] font-bold text-zinc-900">
                      Riwayat Sudah Ditransfer (Paid)
                    </h3>
                    <p className="text-xs text-zinc-500">
                      {stats.paidCount} komisi paid total — kirim ulang pesan
                      konfirmasi transfer via WhatsApp kapan pun (50 terbaru
                      tampil di sini).
                    </p>
                  </div>
                  <div className="max-h-[340px] overflow-auto scrollbar-thin">
                    <Table className="min-w-[820px]">
                      <TableHeader className="sticky top-0 z-10 bg-zinc-50 [&_tr]:border-b">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="h-9 pl-4 text-[12.5px] font-medium text-zinc-500 sm:pl-5">
                            Tanggal Transfer
                          </TableHead>
                          <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">
                            Mitra
                          </TableHead>
                          <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">
                            ID Transaksi
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
                        {paidHistory.map((row) => {
                          const waPhone = row.affiliatePhone
                            ? normalizeWaPhone(row.affiliatePhone)
                            : null;
                          return (
                            <TableRow key={row.id} className="text-[13px]">
                              <TableCell className="whitespace-nowrap pl-4 align-top sm:pl-5">
                                <span className="font-medium text-zinc-800">
                                  {dateLabel(row.paidAt ?? row.createdAt)}
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
                                <Badge
                                  variant="outline"
                                  className="mt-0.5 h-5 border-zinc-200 px-1.5 text-[11px] font-bold text-zinc-600"
                                >
                                  ref: {row.refCode}
                                </Badge>
                              </TableCell>
                              <TableCell
                                className="max-w-[200px] truncate align-top text-[12px] text-zinc-600"
                                title={row.orderId}
                              >
                                {row.orderId}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right align-top font-bold tabular-nums text-emerald-700">
                                {formatIDR(row.commissionAmount)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap pr-4 text-right align-top sm:pr-5">
                                {waPhone ? (
                                  <a
                                    href={waLink(waPhone, waTransferMessage(row))}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-[12.5px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                                    title="Buka WhatsApp dengan pesan konfirmasi transfer siap kirim"
                                  >
                                    <MessageCircle className="size-3.5" strokeWidth={2} aria-hidden="true" />
                                    Kirim Bukti WA
                                  </a>
                                ) : (
                                  <span
                                    className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-[12.5px] font-medium text-zinc-400"
                                    title="No. WhatsApp mitra belum tersedia"
                                  >
                                    <MessageCircle className="size-3.5" strokeWidth={2} aria-hidden="true" />
                                    Kirim Bukti WA
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
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
                    pertama — cukup Nama, Kode Referral, dan No. WhatsApp.
                  </p>
                </div>
              ) : (
                <div className="max-h-[560px] overflow-auto scrollbar-thin">
                  <Table className="min-w-[1180px]">
                    <TableHeader className="sticky top-0 z-10 bg-zinc-50 [&_tr]:border-b">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-9 pl-4 text-[12.5px] font-medium text-zinc-500 sm:pl-5">
                          Nama Mitra
                        </TableHead>
                        <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">
                          Nomor WhatsApp
                        </TableHead>
                        <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">
                          Kode Referral
                        </TableHead>
                        <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">
                          Rekening Bank
                        </TableHead>
                        <TableHead className="h-9 text-[12.5px] font-medium text-zinc-500">
                          Portal Mitra
                        </TableHead>
                        <TableHead className="h-9 text-right text-[12.5px] font-medium text-zinc-500">
                          Total Komisi
                        </TableHead>
                        <TableHead className="h-9 pr-4 text-right text-[12.5px] font-medium text-zinc-500 sm:pr-5">
                          Status &amp; Aksi
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partners.map((p) => {
                        const busy = busyId === p.id;
                        const deleting = deletingId === p.id;
                        const rekeningLengkap = Boolean(
                          p.bankName && p.bankAccountNo && p.bankAccountName,
                        );
                        const pLink = portalLink(p.refCode, p.accessToken);
                        // wa.me wajib format internasional 62 + digit murni
                        const cleanPhone = p.phone
                          ? normalizeWaPhone(p.phone)
                          : null;
                        return (
                          <TableRow key={p.id} className="text-[13px]">
                            {/* Nama Mitra */}
                            <TableCell className="pl-4 align-top sm:pl-5">
                              <span className="font-semibold text-zinc-900">
                                {p.name}
                              </span>
                              <span className="mt-0.5 block text-[11px] text-zinc-400">
                                Gabung {dateLabel(p.createdAt)}
                              </span>
                            </TableCell>
                            {/* Nomor WhatsApp — link wa.me langsung */}
                            <TableCell className="align-top">
                              {p.phone ? (
                                <a
                                  href={`https://wa.me/${normalizeWaPhone(p.phone)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 font-medium text-emerald-700 hover:underline"
                                  title="Buka chat WhatsApp"
                                >
                                  <MessageCircle className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                  {formatWaDisplay(normalizeWaPhone(p.phone))}
                                </a>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </TableCell>
                            {/* Kode Referral — klik = salin link referral */}
                            <TableCell className="align-top">
                              <button
                                type="button"
                                onClick={async () => {
                                  const link = `${SITE_URL}/?ref=${p.refCode}`;
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
                                title={`Salin link referral: ${SITE_URL}/?ref=${p.refCode}`}
                              >
                                {p.refCode}
                                <Copy
                                  className="size-3 text-zinc-400 group-hover:text-zinc-600"
                                  strokeWidth={2}
                                  aria-hidden="true"
                                />
                              </button>
                            </TableCell>
                            {/* Rekening Bank + Copy Rekening instan */}
                            <TableCell className="max-w-[250px] align-top">
                              {rekeningLengkap ? (
                                <>
                                  <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
                                    <Landmark className="size-3.5 shrink-0 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
                                    {p.bankName}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[12px] tabular-nums text-zinc-600" title={`${p.bankAccountNo} a.n. ${p.bankAccountName}`}>
                                    {p.bankAccountNo} a.n. {p.bankAccountName}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyRekening(p.bankName, p.bankAccountNo, p.bankAccountName)
                                    }
                                    className="mt-1.5 inline-flex h-7 items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 text-[11.5px] font-semibold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-white"
                                    title="Salin format: [Bank] [No Rek] a.n [Nama]"
                                  >
                                    <Copy className="size-3" strokeWidth={2} aria-hidden="true" />
                                    Copy Rekening
                                  </button>
                                </>
                              ) : (
                                <span className="inline-flex items-start gap-1 text-[11.5px] font-medium leading-snug text-amber-700">
                                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                  Belum diisi mitra
                                </span>
                              )}
                            </TableCell>
                            {/* Link Portal Mitra — buka/intip dashboard mitra */}
                            <TableCell className="align-top">
                              {pLink ? (
                                <a
                                  href={pLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex h-7 items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 text-[11.5px] font-semibold text-sky-800 transition-colors hover:bg-sky-100"
                                  title={`Buka portal mitra: ${pLink}`}
                                >
                                  <SquareArrowOutUpRight className="size-3" strokeWidth={2} aria-hidden="true" />
                                  Buka Portal
                                </a>
                              ) : (
                                <span className="text-[11.5px] text-zinc-400">
                                  Token belum tersedia
                                </span>
                              )}
                            </TableCell>
                            {/* Total Komisi */}
                            <TableCell className="whitespace-nowrap text-right align-top font-bold tabular-nums text-emerald-700">
                              {formatIDR(p.totalEarnings)}
                            </TableCell>
                            {/* Status + toggle + Kirim WA Sambutan + Hapus */}
                            <TableCell className="pr-4 align-top sm:pr-5">
                              <span className="flex flex-col items-end gap-1.5">
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
                                  disabled={busy || deleting}
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
                                {/* Kirim WA Sambutan — wa.me + template baku,
                                    buka tab baru (tanpa interaksi server) */}
                                {cleanPhone ? (
                                  <a
                                    href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(waSambutanMessage(p.name, p.refCode))}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11.5px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                                    title="Buka WhatsApp dgn pesan sambutan siap kirim"
                                  >
                                    <MessageCircle className="size-3" strokeWidth={2} aria-hidden="true" />
                                    Kirim WA Sambutan
                                  </a>
                                ) : (
                                  <span
                                    className="inline-flex h-7 cursor-not-allowed items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 text-[11.5px] font-medium text-zinc-400"
                                    title="No. WhatsApp mitra belum tersedia"
                                  >
                                    <MessageCircle className="size-3" strokeWidth={2} aria-hidden="true" />
                                    Kirim WA Sambutan
                                  </span>
                                )}
                                {/* Hapus Mitra — confirm native → DELETE */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deletePartner(p)}
                                  disabled={busy || deleting}
                                  className="h-7 gap-1 border-red-200 px-2 text-[11.5px] text-red-700 hover:bg-red-50"
                                >
                                  {deleting ? (
                                    <Loader2 className="size-3 animate-spin" strokeWidth={2} aria-hidden="true" />
                                  ) : (
                                    <Trash2 className="size-3" strokeWidth={2} aria-hidden="true" />
                                  )}
                                  Hapus Mitra
                                </Button>
                              </span>
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

      {/* ── Modal Tambah Mitra Baru (Nama + Kode Referral + No. WhatsApp) ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
              Tambah Mitra Baru
            </DialogTitle>
            <DialogDescription className="text-[12.5px] leading-snug">
              Cukup 3 data — tanpa email. Akun mitra langsung aktif dan link
              portal pribadinya otomatis dibuat.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3.5 py-1">
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
                autoComplete="off"
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
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    refCode: sanitizeRefCodeInput(e.target.value),
                  }))
                }
                className="h-9 font-mono text-[13px]"
                autoComplete="off"
              />
              <p className="text-[11px] leading-snug text-zinc-500">
                Huruf kecil tanpa spasi — link referral:{" "}
                <span className="font-mono">
                  {SITE_URL}/?ref={form.refCode.trim() || "<kode>"}
                </span>
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="aff-phone" className="text-[12.5px]">
                Nomor WhatsApp <span className="text-red-500">*</span>
              </Label>
              <Input
                id="aff-phone"
                type="tel"
                inputMode="tel"
                placeholder="081234567890 / 6281234567890"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="h-9 text-[13px]"
                autoComplete="off"
              />
              <p className="text-[11px] leading-snug text-zinc-500">
                Identitas utama mitra — dipakai menghubungkan akun, kirim pesan
                sambutan, dan fallback identifier otomatis di backend.
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
              Simpan Mitra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Sukses: ringkasan mitra + link portal + pesan WA ──────── */}
      <Dialog open={Boolean(created)} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px] text-emerald-800">
              <CircleCheck className="size-5 text-emerald-600" strokeWidth={2} aria-hidden="true" />
              Akun Mitra Berhasil Dibuat
            </DialogTitle>
            <DialogDescription className="text-[12.5px] leading-snug">
              Akun kemitraan aktif &amp; terkait kode referral di bawah.
              Bagikan link portal + pesan sambutan ke mitra.
            </DialogDescription>
          </DialogHeader>

          {created && (
            <div className="grid gap-3.5 py-1">
              {/* Ringkasan data mitra */}
              <dl className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-1.5 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-[12.5px]">
                <dt className="font-medium text-zinc-500">Nama</dt>
                <dd className="font-semibold text-zinc-900">{created.name}</dd>
                <dt className="font-medium text-zinc-500">Kode Referral</dt>
                <dd className="font-mono font-bold text-zinc-900">{created.refCode}</dd>
                <dt className="font-medium text-zinc-500">No. WhatsApp</dt>
                <dd className="font-semibold tabular-nums text-zinc-900">
                  {formatWaDisplay(created.phone)}
                </dd>
                <dt className="font-medium text-zinc-500">Status</dt>
                <dd>
                  <Badge className="border-transparent bg-emerald-100 px-2 text-[11.5px] font-bold text-emerald-800">
                    Aktif
                  </Badge>
                </dd>
              </dl>

              {/* Link Portal Mitra Pribadi */}
              <div className="grid gap-1.5">
                <Label className="text-[12.5px]">Link Portal Mitra Pribadi</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    readOnly
                    value={created.portalUrl}
                    aria-label="Link portal mitra"
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-[11.5px] text-zinc-700 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      const ok = await copyText(created.portalUrl);
                      if (ok) toast.success("Link portal tersalin");
                      else toast.error("Gagal menyalin link");
                    }}
                    className="h-9 shrink-0 gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800"
                  >
                    <Copy className="size-3.5" strokeWidth={2} aria-hidden="true" />
                    Salin Link
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    asChild
                    variant="outline"
                    className="h-9 shrink-0 gap-1.5"
                  >
                    <a href={created.portalUrl} target="_blank" rel="noopener noreferrer">
                      <SquareArrowOutUpRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
                      Intip
                    </a>
                  </Button>
                </div>
                <p className="text-[11px] leading-snug text-zinc-500">
                  Mitra membuka link ini tanpa perlu login untuk melengkapi
                  rekening pencairan komisinya.
                </p>
              </div>

              {/* Pesan sambutan WhatsApp */}
              <div className="grid gap-1.5">
                <Label className="text-[12.5px]">Pesan Sambutan WhatsApp</Label>
                <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md border border-emerald-100 bg-emerald-50/60 p-3 font-sans text-[12px] leading-relaxed text-emerald-900 scrollbar-thin">
                  {created.waMessage}
                </pre>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      const ok = await copyText(created.waMessage);
                      if (ok) {
                        toast.success("Pesan sambutan tersalin", {
                          description: "Tempel langsung di chat WhatsApp mitra.",
                        });
                      } else {
                        toast.error("Gagal menyalin pesan");
                      }
                    }}
                    className="h-9 shrink-0 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Copy className="size-3.5" strokeWidth={2} aria-hidden="true" />
                    Salin Pesan Sambutan WhatsApp
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    asChild
                    variant="outline"
                    className="h-9 shrink-0 gap-1.5"
                  >
                    <a
                      href={`https://wa.me/${created.phone}?text=${encodeURIComponent(created.waMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="size-3.5" strokeWidth={2} aria-hidden="true" />
                      Kirim via WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCreated(null);
                setFormError(null);
                setCreateOpen(true);
              }}
              className="h-8 text-[12.5px]"
            >
              <Plus className="size-3.5" strokeWidth={2} aria-hidden="true" />
              Daftarkan Mitra Lain
            </Button>
            <Button
              size="sm"
              onClick={() => setCreated(null)}
              className="h-8 bg-zinc-900 text-[12.5px] text-white hover:bg-zinc-800"
            >
              Selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
