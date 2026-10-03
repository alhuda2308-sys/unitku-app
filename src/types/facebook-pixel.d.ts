// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Tipe global untuk Meta (Facebook) Pixel
//
// `window.fbq` dibuat otomatis oleh snippet fbevents.js yang dimuat di root
// layout (lihat src/components/meta-pixel.tsx). Snippet men-stub fungsi tsb
// sebelum library aslinya selesai dimuat (panggilan di-queue lalu di-flush),
// jadi cukup satu tipe panggilan longgar untuk semua varian perintah:
//   fbq('init', '<pixelId>')
//   fbq('track', 'PageView')
//   fbq('track', 'Lead', { content_name: 'Coba Demo UnitKu' })
//   fbq('set', 'autoConfig', false, '<pixelId>')
// ─────────────────────────────────────────────────────────────────────────────

export {};

declare global {
  interface Window {
    /** Fungsi tracking Meta Pixel (stub dibuat oleh snippet fbevents.js). */
    fbq?: (...args: unknown[]) => void;
    /** Alias yang juga di-set snippet Meta (window._fbq = window.fbq). */
    _fbq?: unknown;
  }
}
