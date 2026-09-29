"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Komponen PWA "Pasang Aplikasi" (Add to Home Screen)
//
// PwaInstallBanner : banner kecil ramah jempol di bawah layar mobile —
//   Android/Chrome memakai prompt bawaan (beforeinstallprompt), iOS/Safari
//   mendapat panduan mini 2 langkah. Bisa ditutup & disimpan di sessionStorage.
// PwaInstallCard   : kartu "Pasang Aplikasi" manual di Pengaturan → Profil
//   Properti sebagai opsi alternatif bila banner ditutup / tidak muncul.
//
// Keduanya aman hydration: keputusan render hanya setelah mount (shim
// useSyncExternalStore) & status prompt membaca store eksternal pwa-install.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useSyncExternalStore } from "react";
import { CirclePlus, Share, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import {
  getInstallPromptAvailable,
  getStandalone,
  isIosSafari,
  promptInstall,
  registerUnitKuServiceWorker,
  subscribeInstallPrompt,
  subscribeStandalone,
} from "@/lib/pwa-install";

/** sessionStorage key — banner tak muncul lagi sepanjang sesi tab ini */
const DISMISS_KEY = "unitku-pwa-dismissed";

const emptySubscribe = () => () => {};

/** Shim mount aman SSR — render keputusan platform hanya setelah hydration */
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function safeSessionDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** CTA instalasi solid biru — aksen PWA (#2563eb, senada theme_color manifest) */
const INSTALL_BTN =
  "h-10 w-full bg-[#2563eb] px-4 text-[13px] font-semibold text-white shadow-none hover:bg-blue-700";

function useInstallState() {
  const promptAvailable = useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPromptAvailable,
    () => false,
  );
  const standalone = useSyncExternalStore(subscribeStandalone, getStandalone, () => false);
  const mounted = useMounted();
  const ios = mounted && isIosSafari();
  return { mounted, promptAvailable, standalone, ios };
}

async function runInstall(onDone?: () => void): Promise<void> {
  const outcome = await promptInstall();
  onDone?.();
  if (outcome === "accepted") {
    toast.success("UnitKu terpasang di layar utama", {
      description: "Buka lewat ikon UnitKu — tampilan penuh tanpa bar alamat browser.",
    });
  } else if (outcome === "dismissed") {
    toast.info("Instalasi ditunda", {
      description: "Pasang kapan saja lewat Pengaturan → Profil Properti → Pasang Aplikasi.",
    });
  } else {
    toast.error("Prompt instalasi tidak tersedia", {
      description: "Gunakan menu browser → \u201CInstal aplikasi / Tambahkan ke Layar Utama\u201D.",
    });
  }
}

/** Panduan mini 2 langkah iOS Safari (ikon Share → Tambahkan ke Layar Utama) */
function IosGuide({ compact = false }: { compact?: boolean }) {
  return (
    <ol className={compact ? "space-y-1.5" : "mt-3 space-y-2"}>
      <li className="flex items-start gap-2 text-[12.5px] leading-4 text-zinc-700">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
          <Share className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span>
          Tekan ikon <span className="font-semibold text-zinc-900">Share (Bagikan)</span> di bilah
          bawah Safari.
        </span>
      </li>
      <li className="flex items-start gap-2 text-[12.5px] leading-4 text-zinc-700">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
          <CirclePlus className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span>
          Gulir lalu pilih <span className="font-semibold text-zinc-900">&quot;Tambahkan ke Layar Utama&quot; (+)</span>.
        </span>
      </li>
    </ol>
  );
}

// ── Banner mobile ────────────────────────────────────────────────────────────

export function PwaInstallBanner() {
  const { mounted, promptAvailable, standalone, ios } = useInstallState();
  const [dismissed, setDismissed] = useState(() =>
    typeof window === "undefined" ? false : safeSessionDismissed(),
  );
  const [busy, setBusy] = useState(false);

  // Daftarkan service worker sekali per kunjungan (syarat installability Chrome)
  useEffect(() => {
    registerUnitKuServiceWorker();
  }, []);

  const visible = mounted && !standalone && !dismissed && (promptAvailable || ios);
  if (!visible) return null;

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // sessionStorage diblokir — cukup sembunyikan untuk render ini
    }
    setDismissed(true);
  };

  return (
    <div
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 sm:hidden"
      role="complementary"
      aria-label="Pasang aplikasi UnitKu"
    >
      <div className="rounded-xl border border-border bg-white p-3.5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]">
        <div className="flex items-start gap-3">
          <img
            src="/icons/icon-192.png"
            alt="Ikon UnitKu"
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-[10px] border border-border"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold tracking-tight text-zinc-900">Pasang UnitKu</p>
            <p className="mt-0.5 text-[12.5px] leading-4 text-zinc-600">
              {ios
                ? "Tambahkan ke layar utama agar akses cepat, seperti aplikasi biasa."
                : "Akses cepat dari layar utama — tampilan penuh tanpa bar alamat browser."}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Tutup banner pemasangan"
            className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        {ios ? (
          <IosGuide />
        ) : (
          <Button
            onClick={() => {
              setBusy(true);
              void runInstall(() => setBusy(false));
            }}
            disabled={busy}
            className={`mt-3 ${INSTALL_BTN} disabled:opacity-60`}
          >
            <span aria-hidden="true">📲</span>
            Pasang UnitKu di Layar Utama
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Kartu manual di Pengaturan ───────────────────────────────────────────────

export function PwaInstallCard() {
  const { mounted, promptAvailable, standalone, ios } = useInstallState();
  const [busy, setBusy] = useState(false);

  let body: React.ReactNode;

  if (!mounted) {
    body = (
      <p className="text-[12.5px] leading-4 text-zinc-700">Memeriksa status perangkat…</p>
    );
  } else if (standalone) {
    body = (
      <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <span className="mt-1 flex size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
        <p className="text-[12.5px] leading-4 text-emerald-800">
          <span className="font-semibold">Terpasang</span> — UnitKu sedang berjalan sebagai
          aplikasi di perangkat ini. Selamat!
        </p>
      </div>
    );
  } else if (promptAvailable) {
    body = (
      <>
        <p className="text-[12.5px] leading-4 text-zinc-700">
          Instal UnitKu sebagai aplikasi: buka instan dari layar utama, tampilan penuh tanpa bar
          alamat, dan tetap satu login yang sama.
        </p>
        <Button
          onClick={() => {
            setBusy(true);
            void runInstall(() => setBusy(false));
          }}
          disabled={busy}
          className={`mt-3 h-9 w-auto bg-[#2563eb] px-4 text-[13px] font-semibold text-white shadow-none hover:bg-blue-700 disabled:opacity-60 sm:h-9`}
        >
          <Smartphone className="size-4" strokeWidth={1.75} />
          Pasang Aplikasi
        </Button>
      </>
    );
  } else if (ios) {
    body = (
      <>
        <p className="text-[12.5px] leading-4 text-zinc-700">
          Di iPhone/iPad, instalasi dilakukan lewat menu Share Safari:
        </p>
        <IosGuide compact />
      </>
    );
  } else {
    body = (
      <p className="text-[12.5px] leading-4 text-zinc-700">
        Browser ini belum menawarkan instalasi. Buka UnitKu di Chrome/Edge (Android &amp; desktop)
        atau Safari di iPhone, lalu pilih menu{" "}
        <span className="font-medium text-zinc-800">&quot;Instal aplikasi / Tambahkan ke Layar Utama&quot;</span>.
      </p>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-[13px] font-bold tracking-tight text-zinc-900">Aplikasi &amp; Layar Utama</h3>
        <p className="mt-0.5 text-[12.5px] text-zinc-700">
          Pasang UnitKu sebagai PWA — akses seperti aplikasi native, tanpa install store.
        </p>
      </div>
      <div className="p-4">{body}</div>
    </section>
  );
}
