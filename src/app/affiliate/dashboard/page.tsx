// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Dashboard / Portal Affiliator (Tahap 4)
//
// /affiliate/dashboard — DUA jalur akses:
//   1. SESI (pola lama)      : user login → profil dicari via affiliates.
//     userId. Middleware menjaga rute ini (tamu → /login?next=…).
//   2. MAGIC-LINK (baru)     : mitra yang didaftarkan admin TANPA akun email
//     membuka link pribadi /affiliate/dashboard?ref=<kode>&token=<accessToken>.
//     Middleware mengizinkan rute ber-token (isTokenizedAffiliatePortal), dan
//     halaman INI yang memverifikasi token ke DB — token salah → redirect
//     /login (tidak ada kebocoran antar mitra).
//
// Isi: link referral + link direct checkout (salin), metrik komisi, riwayat
// referral (email pembeli disensor demi privasi), pengaturan rekening
// pencairan (tersimpan langsung ke tabel affiliates).
// ─────────────────────────────────────────────────────────────────────────────

import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Gift,
  Inbox,
  ShieldOff,
} from "lucide-react";

import { PayoutSettingsForm } from "@/components/affiliate/payout-settings-form";
import { ReferralLinkCard } from "@/components/affiliate/referral-link-card";
import { MetricCard } from "@/components/kost/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAffiliatePortalData,
  getAffiliatePortalDataByToken,
  type AffiliatePortalData,
} from "@/lib/affiliate-portal";
import { getAuthUser } from "@/lib/auth/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Format IDR ringkas: 150000 → "Rp150.000" */
function formatIDR(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

/** Sensor email pembeli demi privasi — "budi@gmail.com" → "b***i@gmail.com" */
function maskEmail(email: string | null): string {
  if (!email) return "—";
  const at = email.indexOf("@");
  if (at <= 0) return "b***@…";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local[0]}***${domain}`;
  return `${local[0]}***${local[local.length - 1]}${domain}`;
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

/** Badge status komisi — Approved / Paid / lainnya */
function CommissionStatusBadge({ status }: { status: string }) {
  const key = status.trim().toLowerCase();
  const skin =
    key === "approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : key === "paid"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-zinc-200 bg-zinc-100 text-zinc-700";
  const label =
    key === "approved"
      ? "Approved"
      : key === "paid"
        ? "Paid"
        : status.trim().replace(/^\w/, (c) => c.toUpperCase()) || "—";
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-bold leading-none",
        skin,
      )}
    >
      {label}
    </span>
  );
}

/** Ambil nilai searchParams pertama (string | string[] | undefined) */
function firstParam(
  value: string | string[] | undefined,
): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === "string" && v.trim());
    return first?.trim() ?? null;
  }
  return null;
}

export default async function AffiliateDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const token = firstParam(params.token);

  // ── Jalur 2: magic-link — verifikasi token ke DB SEBELUM apa pun ──────────
  if (token) {
    const dataByToken = await getAffiliatePortalDataByToken(token);
    // Token salah/kedaluwarsa → perlakukan seperti tamu: gerbang login
    if (!dataByToken) redirect("/login?next=%2Faffiliate%2Fdashboard");
    return (
      <AffiliateDashboardView data={dataByToken} accessToken={token} />
    );
  }

  // ── Jalur 1: sesi login (pola lama) — tamu → /login dgn tujuan kembali ────
  const user = await getAuthUser();
  if (!user) redirect("/login?next=%2Faffiliate%2Fdashboard");

  const data = await getAffiliatePortalData(user.id);

  return <AffiliateDashboardView data={data} userEmail={user.email ?? null} />;
}

/**
 * Seluruh isi portal — dipakai kedua jalur akses. `accessToken` hanya
 * terisi pada jalur magic-link (diteruskan ke form rekening agar mitra
 * tanpa akun login tetap bisa menyimpan rekeningnya).
 */
function AffiliateDashboardView({
  data,
  accessToken,
  userEmail,
}: {
  data: AffiliatePortalData;
  accessToken?: string;
  userEmail?: string | null;
}) {

  return (
    <main className="min-h-screen bg-zinc-50 pb-12">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <a
              href="/dashboard"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-800"
            >
              <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
              Kembali ke Dashboard
            </a>
            <h1 className="mt-1 text-xl font-black tracking-tight text-zinc-900 sm:text-2xl">
              Program Afiliasi
            </h1>
            <p className="mt-0.5 text-[13px] leading-snug text-zinc-700 sm:text-sm">
              Dapatkan <span className="font-bold text-emerald-700">Rp150.000</span>{" "}
              komisi untuk setiap lisensi seumur hidup yang dibeli lewat link
              referral Anda.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <Gift className="size-4" strokeWidth={2} aria-hidden="true" />
            Komisi Rp150.000 / Penjualan
          </span>
        </header>

        {data.error ? (
          <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-bold text-amber-900">
                  Gagal memuat data afiliasi
                </h2>
                <p className="mt-1 text-[13px] leading-snug text-amber-800">
                  Terjadi kendala menghubungi database. Muat ulang halaman, atau
                  coba lagi beberapa saat bila kendala berlanjut.
                </p>
              </div>
            </div>
          </section>
        ) : !data.affiliate ? (
          /* Belum terdaftar sebagai affiliator */
          <section className="mt-6 rounded-lg border border-border bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600">
                <ShieldOff className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-zinc-900">
                  Akun Anda Belum Terdaftar sebagai Affiliator
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-700">
                  Program afiliasi UnitKu memberi komisi{" "}
                  <span className="font-bold">Rp150.000</span> per penjualan
                  lisensi dari link referral pribadi. Akun Anda belum terhubung
                  dengan kode affiliator — hubungi Admin untuk pendaftaran dan
                  cantumkan email akun Anda:
                </p>
                <p className="mt-2 inline-flex max-w-full items-center rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[13px] font-semibold text-zinc-800">
                  <span className="truncate">{userEmail || "—"}</span>
                </p>
                <p className="mt-3 text-xs leading-snug text-zinc-500">
                  Setelah diaktifkan Admin, halaman ini otomatis menampilkan
                  link referral, metrik komisi, dan riwayat penjualan Anda.
                </p>
              </div>
            </div>
          </section>
        ) : (
          (() => {
            const { affiliate, commissions } = data;
            const approvedCount = commissions.filter(
              (c) => c.status.trim().toLowerCase() === "approved" || c.status.trim().toLowerCase() === "paid",
            ).length;
            return (
              <div className="mt-6 space-y-4 sm:space-y-5">
                {/* Link referral */}
                <ReferralLinkCard refCode={affiliate.refCode} />

                {/* Metrik */}
                <section aria-label="Ringkasan komisi" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MetricCard
                    dot="bg-emerald-500"
                    label="Total Komisi Didapat"
                    mobileLabel="Total Komisi"
                    value={formatIDR(affiliate.totalEarnings)}
                    sub="Akumulasi komisi transaksi approved Anda"
                  />
                  <MetricCard
                    dot="bg-sky-500"
                    label="Total Pembeli Sukses"
                    mobileLabel="Pembeli Sukses"
                    value={String(approvedCount)}
                    unit="pembeli"
                    sub="Transaksi approved lewat link referral Anda"
                  />
                  <MetricCard
                    dot="bg-amber-500"
                    label="Status Akun / Kode Referral"
                    mobileLabel="Kode Referral"
                    value={affiliate.refCode}
                    badge={affiliate.isActive ? "Aktif" : "Nonaktif"}
                    badgeClass={
                      affiliate.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }
                    sub={
                      affiliate.isActive
                        ? "Kode aktif — komisi otomatis tercatat dari webhook"
                        : "Kode nonaktif — komisi baru sementara tidak dicatat"
                    }
                  />
                </section>

                {/* Riwayat komisi */}
                <section className="rounded-lg border border-border bg-white">
                  <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-zinc-900 sm:text-base">
                        Riwayat Komisi
                      </h2>
                      <p className="text-xs text-zinc-700">
                        Email pembeli disensor demi privasi.
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 border-zinc-200 text-zinc-600">
                      {commissions.length} transaksi
                    </Badge>
                  </div>

                  {commissions.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                      <span className="flex size-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                        <Inbox className="size-5" strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <p className="text-sm font-semibold text-zinc-800">
                        Belum ada komisi
                      </p>
                      <p className="max-w-sm text-xs leading-snug text-zinc-600">
                        Bagikan link referral Anda — komisi Rp150.000 otomatis
                        masuk di sini setiap ada pembeli yang menyelesaikan
                        pembayaran.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[420px] overflow-x-auto overflow-y-auto scrollbar-thin">
                      <table className="w-full min-w-[560px] border-collapse text-left">
                        <thead className="sticky top-0 z-10 bg-zinc-50">
                          <tr className="text-[11px] font-bold uppercase tracking-wide text-zinc-600">
                            <th scope="col" className="px-4 py-2.5 sm:px-5">Tanggal</th>
                            <th scope="col" className="px-4 py-2.5 sm:px-5">Email Pembeli</th>
                            <th scope="col" className="px-4 py-2.5 text-right sm:px-5">Komisi</th>
                            <th scope="col" className="px-4 py-2.5 text-right sm:px-5">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commissions.map((c) => (
                            <tr
                              key={c.id}
                              className="border-t border-zinc-100 align-middle text-[13px] text-zinc-800"
                            >
                              <td className="whitespace-nowrap px-4 py-3 sm:px-5">
                                <span className="font-medium">{dateLabel(c.createdAt)}</span>
                                <span className="block truncate text-[11px] text-zinc-400" title={c.orderId}>
                                  {c.orderId}
                                </span>
                              </td>
                              <td className="max-w-[220px] px-4 py-3 sm:px-5">
                                <span className="block truncate font-medium" title={c.customerEmail ?? undefined}>
                                  {maskEmail(c.customerEmail)}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-emerald-700 sm:px-5">
                                {formatIDR(c.commissionAmount)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right sm:px-5">
                                <CommissionStatusBadge status={c.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Pengaturan rekening pencairan */}
                <PayoutSettingsForm
                  initial={{
                    bankName: affiliate.bankName,
                    bankAccountNo: affiliate.bankAccountNo,
                    bankAccountName: affiliate.bankAccountName,
                  }}
                  accessToken={accessToken}
                />

                {/* Catatan payout */}
                <p className="flex items-start gap-1.5 px-1 text-xs leading-snug text-zinc-500">
                  <BadgeCheck className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                  Pencairan komisi diproses manual oleh tim Admin ke rekening
                  terdaftar — hubungi Admin melalui WhatsApp setelah saldo
                  terkumpul.
                </p>
              </div>
            );
          })()
        )}

        {/* Footer kecil */}
        <footer className="mt-8 flex flex-col items-center gap-2 text-center">
          <Button asChild variant="ghost" size="sm" className="h-8 text-zinc-600">
            <a href="/dashboard">
              <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
              Kembali ke Dashboard Utama
            </a>
          </Button>
        </footer>
      </div>
    </main>
  );
}
