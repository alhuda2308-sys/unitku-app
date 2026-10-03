"use client";

/**
 * Portal Akses Staf — /staff?token=…
 *
 * Staf membuka link undangan dari owner → sistem memverifikasi token ke
 * database (GET /api/staff?token=…) → token valid TIDAK langsung lolos:
 * staf harus melewati Layar Kunci PIN 6 digit (PinLockCard) yang diverifikasi
 * server (GET /api/staff?token=…&pin=…). PIN cocok → sesi "Staf Aktif
 * (terverifikasi PIN)" disimpan di perangkat → dashboard (/) tampil dengan
 * hak akses terbatas sesuai peran & identitas header memakai nama staf.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  ShieldOff,
  ShieldX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  saveStaffSession,
  isValidPinFormat,
  STAFF_ROLE_META,
  initialsOfStaff,
  type StaffAccessMember,
} from "@/lib/staff-access";
import { staffApi, type StaffTokenResolution } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Phase = "verifying" | "ready" | "failed";

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

  // Verifikasi token ke server (database Supabase) — async via callback, bukan localStorage.
  // Pola lint-safe: setState hanya di dalam callback promise (tidak sinkron di body effect).
  const hydrated = useHydrated();
  const [result, setResult] = useState<
    { ok: true; res: StaffTokenResolution } | { ok: false } | null
  >(null);
  const [retryKey, setRetryKey] = useState(0);

  const runVerify = useCallback(() => {
    staffApi
      .resolveToken(token)
      .then((res) => setResult({ ok: true, res }))
      .catch(() => setResult({ ok: false }));
  }, [token]);

  useEffect(() => {
    if (!hydrated || !token) return;
    runVerify();
  }, [hydrated, token, runVerify, retryKey]);

  const phase: Phase = !hydrated || result === null ? "verifying" : !result.ok ? "failed" : "ready";
  const member = result?.ok && result.res.status === "valid" ? result.res.member : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4 py-10">
      <main className="w-full max-w-md">
        {/* Brand — Logo UnitKu */}
        <div className="mb-5 flex items-center justify-center gap-2.5">
          <Image
            src="/brand/icon.png"
            alt="Logo UnitKu"
            width={36}
            height={36}
            priority
            className="size-9 shrink-0 rounded-xl object-contain ring-1 ring-zinc-200"
          />
          <span className="text-lg font-bold tracking-tight text-zinc-900">UnitKu</span>
        </div>

        {phase === "verifying" ? (
          <VerifyingCard />
        ) : phase === "failed" ? (
          <FailedCard
            onRetry={() => {
              setResult(null); // kembali ke layar verifikasi
              setRetryKey((k) => k + 1);
            }}
          />
        ) : member ? (
          <PinLockCard
            token={token}
            member={member}
            onVerified={(m) => {
              saveStaffSession(m);
              router.push("/dashboard");
            }}
          />
        ) : (
          <InvalidCard revoked={result?.ok ? result.res.status === "revoked" : false} />
        )}

        <p className="mt-5 text-center text-xs leading-4 text-zinc-500">
          Sistem kelola kost, kontrakan &amp; unit sewa — akses staf bersifat rahasia,
          jangan bagikan tautan &amp; PIN ini.
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
      <p className="mt-1 text-[12.5px] text-zinc-600">Sedang memeriksa token staf Anda di database.</p>
    </section>
  );
}

// ── State 1b: gagal terhubung server ─────────────────────────────────────────

function FailedCard({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      className="rounded-xl border border-border bg-white p-8 text-center shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
      aria-live="assertive"
    >
      <ShieldX className="mx-auto size-6 text-red-600" strokeWidth={1.75} aria-hidden="true" />
      <h1 className="mt-3 text-[15px] font-bold tracking-tight text-zinc-900">
        Gagal memeriksa tautan
      </h1>
      <p className="mt-1.5 text-[12.5px] leading-4 text-zinc-600">
        Server tidak terjangkau saat memverifikasi token Anda. Periksa koneksi internet lalu coba lagi.
      </p>
      <Button
        onClick={onRetry}
        className="mt-5 h-10 bg-zinc-900 px-4 text-[12.5px] font-semibold text-white shadow-none hover:bg-zinc-800"
      >
        Coba Lagi
      </Button>
    </section>
  );
}

// ── State 2: token valid — layar kunci PIN 6 digit (diverifikasi server) ─────

function PinLockCard({
  token,
  member,
  onVerified,
}: {
  token: string;
  member: Omit<StaffAccessMember, "accessPin">;
  onVerified: (m: Omit<StaffAccessMember, "accessPin">) => void;
}) {
  const meta = STAFF_ROLE_META[member.role];

  const [digits, setDigits] = useState<string[]>(() => Array<string>(6).fill(""));
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  /** key remount agar animasi shake diputar ulang tiap percobaan salah */
  const [shakeKey, setShakeKey] = useState(0);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const complete = digits.every((d) => d !== "");

  const focusAt = (i: number) => {
    inputsRef.current[Math.max(0, Math.min(5, i))]?.focus();
  };

  const handleChange = (i: number, raw: string) => {
    const onlyDigits = raw.replace(/\D/g, "");
    setError(false);
    if (onlyDigits === "") {
      // kotak dibersihkan (select-all + delete)
      setDigits((prev) => {
        const next = [...prev];
        next[i] = "";
        return next;
      });
      return;
    }
    const ch = onlyDigits.slice(-1); // digit terakhir yang diketik
    setDigits((prev) => {
      const next = [...prev];
      next[i] = ch;
      return next;
    });
    if (i < 5) focusAt(i + 1); // auto-advance
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      setError(false);
      if (digits[i]) {
        setDigits((prev) => {
          const next = [...prev];
          next[i] = "";
          return next;
        });
      } else if (i > 0) {
        focusAt(i - 1);
        setDigits((prev) => {
          const next = [...prev];
          next[i - 1] = "";
          return next;
        });
      }
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      focusAt(i - 1);
    }
    if (e.key === "ArrowRight" && i < 5) {
      e.preventDefault();
      focusAt(i + 1);
    }
    if (e.key === "Enter") submitPin();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    setError(false);
    const next = Array<string>(6).fill("");
    pasted.split("").forEach((ch, idx) => {
      next[idx] = ch;
    });
    setDigits(next);
    focusAt(Math.min(pasted.length, 5));
  };

  const submitPin = () => {
    const pin = digits.join("");
    if (!isValidPinFormat(pin) || checking) return;
    setChecking(true);
    setError(false);
    staffApi
      .verifyPin(token, pin)
      .then((res) => {
        if (res.status === "valid" && res.verified) {
          onVerified(res.member); // simpan sesi terverifikasi + masuk dashboard
          return;
        }
        throw new Error("pin-salah");
      })
      .catch(() => {
        // PIN salah — shake + pesan merah, kosongkan & fokus ke kotak pertama
        setError(true);
        setShakeKey((k) => k + 1);
        setDigits(Array<string>(6).fill(""));
        window.setTimeout(() => inputsRef.current[0]?.focus(), 0);
      })
      .finally(() => setChecking(false));
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="border-b border-border bg-emerald-50 px-5 py-3">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-700">
          <ShieldCheck className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Tautan akses valid — satu langkah lagi sebelum masuk
        </p>
      </div>

      <div className="p-5">
        {/* Identitas staf */}
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white",
              member.role === "ADMIN_OPERASIONAL" ? "bg-sky-600" : "bg-amber-500",
            )}
            aria-hidden="true"
          >
            {initialsOfStaff(member.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold tracking-tight text-zinc-900">
              {member.name}
            </p>
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

        {/* Header layar kunci */}
        <div className="mt-5 text-center">
          <h1 className="flex items-center justify-center gap-1.5 text-[15px] font-bold tracking-tight text-zinc-900">
            <LockKeyhole className="size-4 text-zinc-700" strokeWidth={1.75} aria-hidden="true" />
            Verifikasi Identitas Staf
          </h1>
          <p className="mt-1.5 text-[12.5px] leading-4 text-zinc-600">
            Halo {member.name}, masukkan 6 digit PIN keamanan Anda untuk mulai bertugas.
          </p>
        </div>

        {/* 6 kotak PIN — auto-focus & auto-advance */}
        <div
          key={shakeKey}
          role="group"
          aria-label="Masukkan 6 digit PIN"
          className={cn("mt-4 flex items-center justify-center gap-2", error && "pin-shake")}
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              disabled={checking}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit PIN ${i + 1}`}
              aria-invalid={error}
              className={cn(
                "size-12 rounded-lg border bg-white text-center text-xl font-bold tabular-nums text-zinc-900 shadow-none outline-none transition-colors",
                "focus:border-[var(--ik-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ik-accent)_25%,transparent)]",
                error
                  ? "border-red-400 bg-red-50/50 text-red-700"
                  : "border-zinc-300 hover:border-zinc-400",
              )}
            />
          ))}
        </div>

        {/* Pesan error */}
        <div aria-live="assertive">
          {error && (
            <p className="mt-3 text-center text-[12.5px] font-semibold leading-4 text-red-600">
              PIN salah. Periksa kembali PIN yang diberikan Owner.
            </p>
          )}
        </div>

        <Button
          onClick={submitPin}
          disabled={!complete || checking}
          className="mt-4 h-11 w-full bg-zinc-900 text-sm font-semibold text-white shadow-none hover:bg-zinc-800 disabled:opacity-50"
        >
          {checking ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <LayoutDashboard className="size-4" strokeWidth={1.75} aria-hidden="true" />
          )}
          {checking ? "Memverifikasi…" : "Masuk Dashboard"}
        </Button>

        <p className="mt-3 text-center text-[11.5px] leading-4 text-zinc-500">
          Tidak punya PIN? Hubungi Owner — PIN dikirim bersama tautan via WhatsApp.
        </p>

        <p className="mt-3 break-all rounded-md bg-zinc-50 px-2.5 py-2 text-center font-mono text-[10.5px] leading-4 text-zinc-400">
          token: {member.accessToken.slice(0, 12)}…{member.accessToken.slice(-6)}
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
