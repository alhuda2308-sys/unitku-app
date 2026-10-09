"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IndoKost — Foto fasad properti: placeholder, resolver, & kompresi upload.
// Dipakai PropertyBanner, PropertyModal, dan Pengaturan → Profil Properti /
// Daftar & Kelola Properti. Upload dikompres di sisi klien (canvas → JPEG
// data URL ≤ 720px) agar aman disimpan di localStorage bersama data lain.
// ─────────────────────────────────────────────────────────────────────────────

/** Gambar default/placeholder bangunan yang bersih bila foto belum diunggah */
export const PROPERTY_IMAGE_PLACEHOLDER = "/properties/property-placeholder.png";

/** Path/URL gambar valid → tampilkan; selain itu placeholder */
export function resolvePropertyImage(imageUrl: string | undefined | null): string {
  const v = (imageUrl ?? "").trim();
  if (v && (v.startsWith("data:image/") || v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/"))) {
    return v;
  }
  return PROPERTY_IMAGE_PLACEHOLDER;
}

/** true = properti punya foto sendiri (bukan placeholder) */
export function hasCustomImage(imageUrl: string | undefined | null): boolean {
  const v = (imageUrl ?? "").trim();
  return Boolean(v) && resolvePropertyImage(v) === v;
}

const MAX_DIMENSION = 720; // px sisi terpanjang — cukup untuk thumbnail & banner
const JPEG_QUALITY = 0.82;

export interface CompressedImage {
  dataUrl: string;
  name: string;
  sizeKb: number;
}

/**
 * Baca file gambar → downscale via canvas → JPEG data URL terkompresi.
 * Melempar Error dengan pesan ramah pengguna bila file bukan gambar/terlalu besar.
 */
export async function compressImageFile(file: File): Promise<CompressedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Berkas bukan gambar — gunakan JPG, PNG, atau WebP.");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("Ukuran foto melebihi 15 MB — pilih foto lebih kecil.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const bitmap = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Peramban tidak mendukung kompresi gambar.");
    ctx.fillStyle = "#ffffff"; // PNG transparan → dasar putih bersih
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    if (bitmap instanceof ImageBitmap) bitmap.close();

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    return {
      dataUrl,
      name: file.name,
      sizeKb: Math.round((dataUrl.length * 3) / 4 / 1024),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadImage(src: string): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    const blob = await (await fetch(src)).blob();
    return createImageBitmap(blob);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gambar gagal dimuat — coba berkas lain."));
    img.src = src;
  });
}
