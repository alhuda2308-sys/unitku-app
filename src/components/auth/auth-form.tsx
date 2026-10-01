"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Form autentikasi terpusat (dipakai /login dan /register)
//
// Satu kartu dengan tab Masuk / Daftar Akun Baru. Semua logika sesi diambil
// dari kontrak src/lib/auth/client — komponen ini hanya UI + validasi klien.
// CATATAN: memakai useSearchParams → halaman pemakai wajib membungkus dengan
// <Suspense>.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MailCheck, TriangleAlert, Zap } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  afterAuthRedirect,
  isSupabaseConfigured,
  signIn,
  signInAsDemo,
  signInWithGoogle,
  signUp,
} from "@/lib/auth/client";

type Mode = "login" | "register";
type Pending = null | "form" | "google" | "demo";

const COPY: Record<Mode, { title: string; subtitle: string }> = {
  login: {
    title: "Masuk ke UnitKu",
    subtitle: "Kelola kost, kontrakan & unit sewa Anda dalam satu dashboard.",
  },
  register: {
    title: "Buat Akun Owner",
    subtitle: "Gratis untuk memulai — atur properti pertama Anda dalam 1 menit.",
  },
};

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Logo Google resmi (4 warna) — inline SVG, bukan lucide */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06L5.84 9.9c.87-2.6 3.3-4.52 6.16-4.52Z"
      />
    </svg>
  );
}

export function AuthForm({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [awaitConfirm, setAwaitConfirm] = useState(false);

  const oauthError = searchParams.get("error");
  const nextParam = searchParams.get("next");
  const busy = pending !== null;

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setAwaitConfirm(false);
  };

  const redirectAfterAuth = async () => {
    const target = await afterAuthRedirect(nextParam);
    router.replace(target);
    router.refresh();
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    setAwaitConfirm(false);
    if (!EMAIL_RE.test(email.trim())) {
      setError("Format email tidak valid.");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }

    setError(null);
    setPending("form");
    try {
      if (mode === "login") {
        const res = await signIn(email.trim(), password);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        await redirectAfterAuth();
      } else {
        const res = await signUp(email.trim(), password);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (res.needsEmailConfirmation) {
          // Tidak redirect — tunggu owner konfirmasi email terlebih dahulu.
          setAwaitConfirm(true);
          return;
        }
        await redirectAfterAuth();
      }
    } catch {
      setError("Terjadi kesalahan tak terduga — coba lagi.");
    } finally {
      setPending(null);
    }
  };

  const onGoogle = async () => {
    if (busy) return;
    setError(null);
    setAwaitConfirm(false);
    setPending("google");
    try {
      const res = await signInWithGoogle();
      if (!res.ok) setError(res.error);
    } catch {
      setError("Login Google gagal — coba lagi atau gunakan email & kata sandi.");
    } finally {
      setPending(null);
    }
  };

  const onDemo = async () => {
    if (busy) return;
    setError(null);
    setAwaitConfirm(false);
    setPending("demo");
    try {
      const res = await signInAsDemo();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await redirectAfterAuth();
    } catch {
      setError("Terjadi kesalahan tak terduga — coba lagi.");
    } finally {
      setPending(null);
    }
  };

  const supabase = isSupabaseConfigured();

  return (
    <div className="w-full max-w-md">
      {/* Branding */}
      <div className="mb-5 flex items-center justify-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-lg font-bold text-white select-none">
          U
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-bold leading-tight text-zinc-900">UnitKu</p>
          <p className="text-[12.5px] leading-tight text-zinc-500">
            Kelola Kost, Kontrakan &amp; Unit Sewa
          </p>
        </div>
      </div>

      <div className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h1 className="text-lg font-bold text-zinc-900">{COPY[mode].title}</h1>
        <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">{COPY[mode].subtitle}</p>

        <Tabs value={mode} onValueChange={(v) => switchMode(v as Mode)} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="login" disabled={busy}>
              Masuk
            </TabsTrigger>
            <TabsTrigger value="register" disabled={busy}>
              Daftar Akun Baru
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Error dari OAuth (?error=oauth-gagal / oauth-tidak-aktif) */}
        {oauthError && (
          <Alert variant="destructive" className="mt-4">
            <TriangleAlert strokeWidth={1.75} />
            <AlertDescription className="text-[12.5px]">
              Login Google gagal — coba lagi atau gunakan email &amp; kata sandi.
            </AlertDescription>
          </Alert>
        )}

        {/* Error validasi klien / server */}
        {error && (
          <Alert variant="destructive" className="mt-4">
            <TriangleAlert strokeWidth={1.75} />
            <AlertDescription className="text-[12.5px]">{error}</AlertDescription>
          </Alert>
        )}

        {/* Info tunggu konfirmasi email (register, Supabase) */}
        {awaitConfirm && (
          <Alert className="mt-4 border-amber-200 bg-amber-50 [&>svg]:text-amber-600">
            <MailCheck strokeWidth={1.75} />
            <AlertDescription className="text-[12.5px] text-amber-800">
              Pendaftaran berhasil — periksa email Anda untuk konfirmasi sebelum masuk.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
          <div>
            <Label htmlFor="auth-email" className="mb-1.5 text-[12.5px] font-medium text-zinc-700">
              Email
            </Label>
            <Input
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="h-10 text-[13px]"
            />
          </div>

          <div>
            <Label
              htmlFor="auth-password"
              className="mb-1.5 text-[12.5px] font-medium text-zinc-700"
            >
              Kata Sandi
            </Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="h-10 text-[13px]"
            />
            {mode === "register" && (
              <p className="mt-1 text-[12.5px] text-zinc-500">Minimal 6 karakter.</p>
            )}
          </div>

          <Button type="submit" disabled={busy} className="h-10 w-full text-[13px] font-semibold">
            {pending === "form" ? (
              <>
                <Loader2 className="animate-spin" strokeWidth={1.75} aria-hidden="true" />
                Memproses…
              </>
            ) : mode === "login" ? (
              "Masuk"
            ) : (
              "Daftar"
            )}
          </Button>
        </form>

        {supabase ? (
          <>
            <div className="my-4 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-zinc-200" />
              <span className="text-[12.5px] text-zinc-400">atau</span>
              <span className="h-px flex-1 bg-zinc-200" />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onGoogle}
              disabled={busy}
              className="h-10 w-full text-[13px] text-zinc-800"
            >
              {pending === "google" ? (
                <Loader2 className="animate-spin text-zinc-500" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <GoogleMark className="size-4" />
              )}
              Lanjutkan dengan Google
            </Button>
          </>
        ) : (
          <>
            <div className="my-4 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-zinc-200" />
              <span className="text-[12.5px] text-zinc-400">atau</span>
              <span className="h-px flex-1 bg-zinc-200" />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onDemo}
              disabled={busy}
              className="h-auto w-full flex-col gap-0.5 py-2.5 text-[13px] text-zinc-800"
            >
              <span className="flex items-center gap-2">
                {pending === "demo" ? (
                  <Loader2 className="animate-spin text-zinc-500" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <Zap strokeWidth={1.75} aria-hidden="true" />
                )}
                Masuk sebagai Demo
              </span>
              <span className="text-xs font-normal text-zinc-500">
                Coba UnitKu tanpa akun (data contoh)
              </span>
            </Button>
          </>
        )}

        {/* Pindah mode */}
        <p className="mt-4 text-center text-[12.5px] text-zinc-600">
          {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "register" : "login")}
            disabled={busy}
            className="font-semibold text-zinc-900 underline underline-offset-2 hover:text-zinc-600 disabled:opacity-50"
          >
            {mode === "login" ? "Daftar Akun Baru" : "Masuk di sini"}
          </button>
        </p>
      </div>
    </div>
  );
}
