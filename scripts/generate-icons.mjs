// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Generator aset ikon PWA (one-off, jalankan: node scripts/generate-icons.mjs)
// Menghasilkan PNG tajam dari SVG flat: regular (rounded), maskable (safe zone
// 80%), dan apple-touch-icon — sesuai kriteria manifest Lighthouse.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });

const BLUE = "#2563eb";

/** Glif bangunan kos putih (kanvas 512, memenuhi safe-zone maskable saat diskalakan) */
function glyph(scale = 1) {
  if (scale === 1) {
    return `
    <rect x="146" y="94"  width="220" height="36" rx="12" fill="#ffffff"/>
    <rect x="118" y="250" width="48"  height="146" rx="14" fill="#ffffff"/>
    <rect x="346" y="250" width="48"  height="146" rx="14" fill="#ffffff"/>
    <rect x="166" y="118" width="180" height="278" rx="20" fill="#ffffff"/>
    <g fill="${BLUE}">
      <rect x="196" y="150" width="44" height="44" rx="10"/>
      <rect x="272" y="150" width="44" height="44" rx="10"/>
      <rect x="196" y="212" width="44" height="44" rx="10"/>
      <rect x="272" y="212" width="44" height="44" rx="10"/>
      <rect x="196" y="274" width="44" height="44" rx="10"/>
      <rect x="272" y="274" width="44" height="44" rx="10"/>
      <rect x="127" y="286" width="28" height="28" rx="6"/>
      <rect x="357" y="286" width="28" height="28" rx="6"/>
      <rect x="234" y="318" width="44" height="78" rx="10"/>
    </g>`;
  }
  return `<g transform="translate(38.4 38.4) scale(0.85)">${glyph(1)}</g>`;
}

const svgAny = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${BLUE}"/>
  ${glyph(1)}
</svg>`;

const svgSquare = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BLUE}"/>
  ${glyph(0.85)}
</svg>`;

const jobs = [
  { svg: svgAny(512), size: 512, file: `${OUT}/icon-512.png` },
  { svg: svgAny(512), size: 192, file: `${OUT}/icon-192.png` },
  { svg: svgSquare(512), size: 512, file: `${OUT}/maskable-512.png` },
  { svg: svgSquare(512), size: 192, file: `${OUT}/maskable-192.png` },
  { svg: svgSquare(512), size: 180, file: `${OUT}/apple-touch-icon.png` },
];

for (const job of jobs) {
  await sharp(Buffer.from(job.svg)).resize(job.size, job.size).png().toFile(job.file);
  console.log(`✓ ${job.file} (${job.size}×${job.size})`);
}

// Simpan SVG sumber untuk referensi
writeFileSync(`${OUT}/icon-source.svg`, svgAny(512));
console.log("✓ selesai — aset ikon PWA siap.");
