"use client";

/**
 * Portal Akses Staf — /staff?token=…
 *
 * Staf membuka link undangan dari owner → sistem memverifikasi token
 * (aktif / dicabut / tidak dikenal). Token valid → sesi "Staf Aktif"
 * disimpan di perangkat; dashboard (/) otomatis tampil dengan hak akses
 * terbatas sesuai peran & identitas header memakai nama staf.
 */

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  KeyRound,
  LayoutDashboard,
  ShieldCheck,
  ShieldOff,
  ShieldX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  resolveStaffToken,
  saveStaffSession,
  clearStaffSession,
  STAFF_ROLE_META,
  initialsOfStaff,
} from "@/lib/staff-access";
import { cn } from "@/lib/utils";

type Phase = "verifying" | "ready";

/** Deteksi hydration tanpa setState-in-effect — server false, client true */
const emptySubscribe = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

export default function StaffPortalPage() {
  const router = useRouter();

  // Baca token dari URL (client-only di bawah Suspense — aman akses localStorage)
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") ?? "";
  }, []);

  // Verifikasi token saat render pertama (client-only) — tanpa setState di effect
  const resolution = useMemo(
    () => (token ? resolveStaffToken(token) : null),
    [token],
  );
  // Server & render pertama klien → "verifying" (HTML identik, tanpa mismatch);
  // setelah hydration baru tampilkan hasil verifikasi token.
  const hydrated = useHydrated();
  const phase: Phase = hydrated && resolution ? "ready" : "verifying";

  const member = resolution?.status === "valid" ? resolution.member : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4 py-10">
      <main className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-5 flex items-center justify-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <Building2 className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight text-zinc-900">UnitKu</span>
        </div>

        {phase === "verifying" ? (
          <VerifyingCard />
        ) : member ? (
          <WelcomeCard
            name={member.name}
            role={member.role}
            token={member.accessToken}
            onEnterDashboard={() => {
              saveStaffSession(member);
              router.push("/");
            }}
            onExitSession={() => clearStaffSession()}
          />
        ) : (
          <InvalidCard
            revoked={resolution?.status === "revoked"}
          />
        )}

        <p className="mt-5 text-center text-xs leading-4 text-zinc-500">
          Sistem kelola kost, kontrakan &amp; unit sewa — akses staf bersifat rahasia,
          jangan bagikan tautan ini.
        </p>
      </main>
    </div>
  );
}

// ── State 1: verifikasi singkat ──────────────────────────────────────────────

function VerifyingCard() {
  return (
    <section
      className="rounded-xl border border-border bg-white p-8 text-center shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
      aria-live="polite"
    >
      <KeyRound className="mx-auto size-8 animate-pulse text-zinc-400" strokeWidth={1.5} aria-hidden="true" />
      <h1 className="mt-3 text-[15px] font-bold text-zinc-900">Memverifikasi tautan akses…</h1>
      <p className="mt-1 text-[12.5px] text-zinc-600">Sedang memeriksa token staf Anda.</p>
    </section>
  );
}

// ── State 2: token valid — sesi disimpan ─────────────────────────────────────

function WelcomeCard({
  name,
  role,
  token,
  onEnterDashboard,
  onExitSession,
}: {
  name: string;
  role: "ADMIN_OPERASIONAL" | "PENJAGA_TEKNISI";
  token: string;
  onEnterDashboard: () => void;
  onExitSession: () => void;
}) {
  const meta = STAFF_ROLE_META[role];
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="border-b border-border bg-emerald-50 px-5 py-3">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-700">
          <ShieldCheck className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Tautan akses valid — sesi staf aktif disimpan di perangkat ini
        </p>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white",
              role === "ADMIN_OPERASIONAL" ? "bg-sky-600" : "bg-amber-500",
            )}
            aria-hidden="true"
          >
            {initialsOfStaff(name)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold tracking-tight text-zinc-900">
              Selamat bertugas, {name}
            </h1>
            <span
              className={cn(
                "mt-1 inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold leading-none",
                meta.pill,
              )}
            >
              {meta.label}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-zinc-50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Hak akses peran Anda
          </p>
          <ul className="mt-2 space-y-1.5">
            {meta.permissions.map((p) => (
              <li key={p} className="flex items-start gap-1.5 text-[12.5px] leading-4 text-zinc-700">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" strokeWidth={2} aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <Button
          onClick={onEnterDashboard}
          className="mt-4 h-11 w-full bg-zinc-900 text-sm font-semibold text-white shadow-none hover:bg-zinc-800"
        >
          <LayoutDashboard className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Masuk ke Dashboard UnitKu
        </Button>
        <button
          type="button"
          onClick={onExitSession}
          className="mt-2 w-full rounded-lg py-2 text-center text-[12.5px] font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
        >
          Keluar sesi di perangkat ini
        </button>

        <p className="mt-3 break-all rounded-md bg-zinc-50 px-2.5 py-2 text-center font-mono text-[10.5px] leading-4 text-zinc-400">
          token: {token.slice(0, 12)}…{token.slice(-6)}
        </p>
      </div>
    </section>
  );
}

// ── State 3: token tidak valid / dicabut ─────────────────────────────────────

function InvalidCard({ revoked }: { revoked: boolean }) {
  return (
    <section
      className="rounded-xl border border-border bg-white p-8 text-center shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
      aria-live="assertive"
    >
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50">
        {revoked ? (
          <ShieldOff className="size-6 text-red-600" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <ShieldX className="size-6 text-red-600" strokeWidth={1.75} aria-hidden="true" />
        )}
      </span>
      <h1 className="mt-3 text-[15px] font-bold tracking-tight text-zinc-900">
        Akses Tidak Ditemukan atau Telah Dinonaktifkan oleh Owner
      </h1>
      <p className="mt-1.5 text-[12.5px] leading-4 text-zinc-600">
        {revoked
          ? "Tautan akses ini telah dicabut oleh pemilik properti. Hubungi owner untuk link akses baru."
          : "Tautan akses staf tidak dikenali. Pastikan Anda memakai link lengkap yang dikirim owner via WhatsApp."}
      </p>
      <Button
        asChild
        variant="outline"
        className="mt-5 h-10 border-zinc-300 bg-white px-4 text-[12.5px] font-semibold text-zinc-700 shadow-none hover:bg-zinc-50"
      >
        <Link href="/">
          <LayoutDashboard className="size-4 text-zinc-600" strokeWidth={1.75} aria-hidden="true" />
          Buka Halaman Utama
        </Link>
      </Button>
    </section>
  );
}
