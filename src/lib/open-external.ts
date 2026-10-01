// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Pembuka tautan eksternal imun pop-up blocker
//
// Chrome/Edge memblokir `window.open()` yang dipicu tidak langsung dari
// gesture pengguna (mis. tertahan await) — dan `window.open(url, "_blank",
// "noopener,noreferrer")` selalu return null sehingga status buka tak bisa
// dideteksi. Mekanisme yang andal: membuat elemen <a href target="_blank"
// rel="noopener noreferrer"> lalu men-trigger click-nya SINKRON di dalam
// handler — navigasi native, tidak dianggap pop-up oleh browser.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Buka `url` di tab baru via anchor sinkron. WAJIB dipanggil langsung di
 * dalam event handler klik (tanpa await di antaranya) agar tetap dihitung
 * sebagai navigasi atas izin pengguna.
 */
export function openExternal(url: string): void {
  if (typeof document === "undefined") return;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
