// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Suara notifikasi lead baru (Web Audio API, TANPA file audio)
//
// Chime sintetis dua nada lembut (E5 → A5) — ringan (0 KB aset), halus, dan
// tidak mengagetkan. Catatan browser:
//   • AudioContext dibuat malas & dipakai ulang; bila state "suspended"
//     (autoplay policy) dicoba di-resume — bila gagal, suara diabaikan senyap.
//   • Dibatasi throttle 2 detik agar beberapa lead yang masuk bersamaan tidak
//     menumpuk jadi bunyi beruntun.
// ─────────────────────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let lastPlayedAt = 0;

const THROTTLE_MS = 2_000;

type AudioContextCtor = typeof AudioContext;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

/** Mainkan satu nada dengan envelope halus (attack-decay singkat) */
function playTone(
  audio: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  peak: number,
): void {
  const t0 = audio.currentTime + startOffset;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);
  // Envelope: naik cepat 15 ms, luruh eksponensial — terdengar "ting" lembut
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/**
 * Chime notifikasi pendaftar baru. Tidak pernah melempar — halaman harus tetap
 * aman walau Web Audio tidak tersedia/blokir.
 */
export function playLeadAlertSound(): void {
  const now = Date.now();
  if (now - lastPlayedAt < THROTTLE_MS) return;
  lastPlayedAt = now;
  try {
    const audio = getAudioContext();
    if (!audio) return;
    if (audio.state === "suspended") {
      void audio.resume().catch(() => {});
    }
    // E5 (659.25 Hz) lalu A5 (880 Hz) — interval naik yang ramah telinga
    playTone(audio, 659.25, 0, 0.22, 0.16);
    playTone(audio, 880, 0.13, 0.34, 0.14);
  } catch {
    /* Web Audio tidak tersedia — abaikan tanpa error */
  }
}
