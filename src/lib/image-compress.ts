// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Kompresi foto lampiran (File → dataURL JPEG)
//
// Foto dari kamera HP bisa 3–8 MB; dikirim apa adanya akan membebani payload
// JSON API & kuota database. Helper ini menskalakan sisi terpanjang maks.
// MAX_DIMENSION px lalu mengekspor JPEG kualitas JPEG_QUALITY sebagai dataURL
// — siap disimpan di kolom JSONB `photos` dan dipratinjau lintas perangkat.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.72;

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal membaca berkas foto."));
    reader.readAsDataURL(file);
  });

  // Dekode ke Image untuk membaca dimensi asli
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Format foto tidak didukung."));
    el.src = dataUrl;
  });

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  // Foto kecil (≤ maks) tetap lewat canvas agar seragam JPEG & metadata dibuang
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl; // fallback: dataURL asli
  ctx.drawImage(img, 0, 0, w, h);

  const compressed = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  // Bila kompresi justru lebih besar (transparansi → hitam dsb.), pakai asli
  return compressed.length < dataUrl.length ? compressed : dataUrl;
}
