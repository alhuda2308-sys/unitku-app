"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — PWA Install (Add to Home Screen)
//
// Store eksternal mini untuk event `beforeinstallprompt` agar aman hydration:
// komponen membaca status via useSyncExternalStore (server snapshot selalu
// netral) — tidak ada setState di dalam effect. Dipakai bersama oleh banner
// mobile (PwaInstallBanner) & kartu manual di Pengaturan (PwaInstallCard).
// ─────────────────────────────────────────────────────────────────────────────

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let captured: BeforeInstallPromptEvent | null = null;
let attached = false;
let swRegistered = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function handleBeforeInstallPrompt(event: Event): void {
  // Cegah mini-infobar bawaan Chrome — kita pakai banner sendiri yang ramah jempol
  event.preventDefault();
  captured = event as BeforeInstallPromptEvent;
  notify();
}

function handleAppInstalled(): void {
  captured = null;
  notify();
}

/** Pasang listener sekali & berlangganan notifikasi perubahan ketersediaan prompt */
export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined" && !attached) {
    attached = true;
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot untuk useSyncExternalStore — true bila browser menawarkan instalasi */
export function getInstallPromptAvailable(): boolean {
  return captured !== null;
}

/** Picu prompt instalasi bawaan browser. Hasil: accepted / dismissed / unavailable */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!captured) return "unavailable";
  const event = captured;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      captured = null;
      notify();
    }
    return choice.outcome;
  } catch {
    return "unavailable";
  }
}

/** Subscribe perubahan display-mode standalone (aplikasi sudah terpasang) */
export function subscribeStandalone(listener: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mediaQuery = window.matchMedia("(display-mode: standalone)");
  const onChange = () => listener();
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

/** Snapshot standalone — true bila UnitKu berjalan sebagai aplikasi terpasang */
export function getStandalone(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

/** Deteksi iPhone/iPad Safari (bukan mode standalone) — tidak mendukung beforeinstallprompt */
export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isIos && !standalone;
}

/**
 * Daftarkan service worker minimal (syarat installability Chrome).
 * Dipanggil sekali per kunjungan; gagal (iframe/dev tanpa SW) diabaikan diam-diam.
 */
export function registerUnitKuServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || swRegistered) return;
  swRegistered = true;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    swRegistered = false;
  });
}
