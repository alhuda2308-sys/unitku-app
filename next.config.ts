import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output — artefak deploy (.next/standalone) hanya menyalin
  // node_modules yang benar-benar terpakai (traced) → memangkas ukuran
  // Vercel Serverless Function (Function Storage).
  output: "standalone",
  // Prisma Client di-external-kan: TIDAK di-bundle berulang ke setiap rute
  // API/Server Action — query engine dimuat langsung dari node_modules
  // (hanya satu salinan di artefak standalone).
  serverExternalPackages: ["@prisma/client", "prisma"],
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
