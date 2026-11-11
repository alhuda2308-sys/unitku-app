// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — GET /api/trial/enter — Gerbang masuk dashboard utk trial 3 hari
//
// Dipanggil halaman /trial?token=… SAAT token terbukti valid & masih aktif
// (redirect server-side). Tugasnya SATU: menyiapkan sesi dashboard lalu
// mengarahkan owner langsung ke antarmuka utama UnitKu:
//   1. Verifikasi ulang token (defense in depth — API bisa diakses langsung).
//   2. Owner berlisensi yang sudah login (sesi Supabase/owner riil) TIDAK
//      dipakaikan mode trial — langsung dashboard miliknya.
//   3. Trial aktif → set cookie sesi demo TRIAL (pola /demo — akses /dashboard
//      lolos middleware di semua mode auth; email khusus "trial@unitku.id"
//      agar dashboard memilahnya dari demo CTA) + cookie trial (banner
//      countdown + kunci persistensi data) → redirect /dashboard?trial=1.
//      Dashboard trial = FRESH STATE: tanpa dataset demo (12 kamar contoh
//      "Kost Griya Pratama" dsb.), identitas bersih — owner memasukkan data
//      kamar/kos mereka sendiri dari nol layaknya akun riil baru; data yang
//      diketik tersimpan per-token di perangkat (trial-session-store).
//   4. Trial LOCKED / token tak dikenal → cookie trial dibersihkan → kembali
//      ke /trial?token=… yang menampilkan halaman pemberitahuan "Masa Uji
//      Coba Telah Berakhir" + tombol checkout mitra pembuat.
//
// Penguncian tetap server-side: status trial dibaca ulang dari DB tiap kali
// /api/trial/state dipanggil banner dashboard (lazy-lock ditegakkan di lib).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";

import {
  DEMO_OWNER_ID,
  isSupabaseConfigured,
  SESSION_COOKIE,
} from "@/lib/auth/config";
import {
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/auth/local";
import { createSupabaseAuthCollector } from "@/lib/auth/supabase-route";
import { activateOwnerTrial } from "@/lib/owner-trial";
import {
  TRIAL_COOKIE,
  TRIAL_COOKIE_MAX_AGE,
  TRIAL_DASHBOARD_URL,
  TRIAL_SESSION_EMAIL,
} from "@/lib/trial-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Batas waktu getUser() — auth yang hangat tidak boleh menahan redirect */
const GET_USER_TIMEOUT_MS = 4_000;

/** Response redirect yang MENGHAPUS cookie trial (trial berakhir/tak valid) */
function redirectWithoutTrialCookie(
  origin: string,
  location: string,
): NextResponse {
  const response = NextResponse.redirect(new URL(location, origin));
  response.cookies.set({ name: TRIAL_COOKIE, value: "", maxAge: 0, path: "/" });
  return response;
}

export async function GET(request: NextRequest) {
  const token = (request.nextUrl.searchParams.get("token") ?? "").trim();

  // ── Owner berlisensi yang sudah login TIDAK dipakaikan mode trial ──────────
  if (isSupabaseConfigured()) {
    try {
      const collector = createSupabaseAuthCollector(request);
      const getUser = collector.client
        .auth.getUser()
        .catch(() => ({ data: { user: null } }));
      const timeout = new Promise<{ data: { user: null } }>((resolve) => {
        setTimeout(() => resolve({ data: { user: null } }), GET_USER_TIMEOUT_MS);
      });
      const { data } = await Promise.race([getUser, timeout]);
      if (data.user) {
        const response = NextResponse.redirect(
          new URL("/dashboard", request.nextUrl.origin),
        );
        collector.applyCookies(response); // sertakan cookie refresh bila ada
        return response;
      }
    } catch {
      // getUser gagal sesaat → lanjut sebagai pengunjung trial (di bawah)
    }
  } else {
    // Mode lokal: sesi owner riil (bukan demo) jangan ditimpa mode trial
    const existing = request.cookies.get(SESSION_COOKIE)?.value;
    const payload = existing ? verifySessionToken(existing) : null;
    if (payload && !payload.demo) {
      return NextResponse.redirect(
        new URL("/dashboard", request.nextUrl.origin),
      );
    }
  }

  // ── Verifikasi ulang token ke DB (halaman /trial sudah mengaktifkan) ───────
  if (!token || token.length > 64) {
    return redirectWithoutTrialCookie(request.nextUrl.origin, "/trial");
  }
  const result = await activateOwnerTrial(token); // idempoten — aman dipanggil ulang

  if (!result.ok) {
    return redirectWithoutTrialCookie(
      request.nextUrl.origin,
      `/trial?token=${encodeURIComponent(token)}`,
    );
  }
  if (result.state.status === "LOCKED") {
    // Trial habis → halaman pemberitahuan /trial (tombol checkout mitra)
    return redirectWithoutTrialCookie(
      request.nextUrl.origin,
      `/trial?token=${encodeURIComponent(token)}`,
    );
  }

  // ── Trial aktif → sesi demo TRIAL + cookie trial → dashboard fresh state ──
  const response = NextResponse.redirect(
    new URL(TRIAL_DASHBOARD_URL, request.nextUrl.origin),
  );
  response.cookies.set(
    SESSION_COOKIE,
    createSessionToken({
      sub: DEMO_OWNER_ID,
      email: TRIAL_SESSION_EMAIL, // penanda sesi TRIAL — dipilah dashboard dari demo CTA
      demo: true,
    }),
    sessionCookieOptions,
  );
  response.cookies.set({
    name: TRIAL_COOKIE,
    value: token,
    path: "/",
    maxAge: TRIAL_COOKIE_MAX_AGE,
    httpOnly: false, // dibaca TrialBanner di client utk fetch status
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
