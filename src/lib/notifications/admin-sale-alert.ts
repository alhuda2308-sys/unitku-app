// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Notifikasi instan ke Telegram Admin (server-only)
//
// Dua jenis alert, SATU handler Telegram yang sama (fail-safe):
//   1. PENJUALAN BARU — dipicu webhook Mayar persis setelah pembayaran
//      berhasil diverifikasi & transaksi tercatat (VIA AFILIASI / ORGANIK).
//   2. MITRA BARU BERGABUNG — dipicu POST /api/affiliate/join saat calon
//      mitra berhasil mendaftar lewat form publik /affiliate/join.
// Deteksi otomatis:
//   • VIA AFILIASI — kode referral valid & komisi Rp150.000 masuk antrean
//     (pesan berisi data mitra + tombol WA "Kabari Kak {nama_mitra}")
//   • ORGANIK — penjualan langsung tanpa referral
//
// Env (SEMUA OPSIONAL — kosong = notifikasi dilewati, TANPA error):
//   TELEGRAM_BOT_TOKEN       token dari @BotFather
//   TELEGRAM_ADMIN_CHAT_ID   chat id admin tujuan notifikasi penjualan
//                            (fallback: TELEGRAM_CHAT_ID milik alert lead —
//                            kompatibel dgn konfigurasi yang sudah ada)
//   ADMIN_ALERT_TZ           zona waktu pesan (default Asia/Jakarta)
//
// Fail-safe total (wajib — webhook Mayar tidak boleh terganggu):
//   • env tidak diset   → langsung skip, tidak ada fetch
//   • fetch dibungkus try...catch + timeout 10 detik
//   • kegagalan Telegram HANYA masuk log server — respons 200 webhook Mayar
//     tidak pernah berubah
// ─────────────────────────────────────────────────────────────────────────────

import { AFFILIATE_COMMISSION_IDR } from "@/lib/affiliate";
import { normalizeWaPhone } from "@/lib/checkout-validation";
import { SITE_URL } from "@/lib/landing-config";

export interface SaleAlertAffiliate {
  /** Nama mitra — selalu ditampilkan dgn sapaan "Kak {nama}" */
  name: string;
  /** Kode referral mitra (sudah ternormalisasi) */
  refCode: string;
  /** Nomor WA mitra mentah dari DB — dinormalisasi ke 62… saat kirim */
  phone?: string | null;
}

export interface SaleAlertPayload {
  /** Nama pembeli (fallback: email bila webhook tidak mengirim nama) */
  buyerName: string;
  /** No. WhatsApp pembeli dari payload Mayar (bila ada) */
  buyerPhone?: string | null;
  /** Nama produk/paket — fallback default lisensi UnitKu */
  productName?: string | null;
  /** Nominal transaksi (IDR) */
  amount: number;
  /** order_id / id transaksi Mayar — info log saja */
  orderId?: string | null;
  /** Waktu transaksi (default: sekarang) */
  occurredAt?: Date | string | number;
  /** Terisi = penjualan via afiliasi; null/kosong = organik */
  affiliate?: SaleAlertAffiliate | null;
}

const FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_PRODUCT_NAME = "Lisensi Seumur Hidup UnitKu";
const ADMIN_QUEUE_URL = `${SITE_URL}/admin/affiliates`;
const AFFILIATE_PORTAL_URL = `${SITE_URL}/affiliate/dashboard`;

function alertTimezone(): string {
  return (process.env.ADMIN_ALERT_TZ ?? "").trim() || "Asia/Jakarta";
}

function formatSaleTime(at: SaleAlertPayload["occurredAt"]): string {
  const date = at ? new Date(at) : new Date();
  if (Number.isNaN(date.getTime())) return formatSaleTime(Date.now());
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: alertTimezone(),
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/** escape HTML utk pesan Telegram (nama pengguna/produk bebas teks) */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatIDR(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `Rp${safe.toLocaleString("id-ID")}`;
}

/** Chat WA singkat utk mitra — isi parameter `text` pada link wa.me */
function buildPartnerChatMessage(affiliateName: string): string {
  return (
    `Halo Kak ${affiliateName}, selamat! Ada penjualan lisensi baru lewat link ` +
    `referral Kakak. Komisi ${formatIDR(AFFILIATE_COMMISSION_IDR)} telah tercatat ` +
    `dan menunggu jadwal transfer admin. Cek detailnya di portal Kakak ya: ` +
    AFFILIATE_PORTAL_URL
  );
}

/** Pesan Telegram — parse_mode HTML (template persis sesuai spesifikasi) */
function buildTelegramSaleMessage(payload: SaleAlertPayload): string {
  const buyer = escapeHtml(payload.buyerName?.trim() || "Pembeli");
  const buyerPhone = payload.buyerPhone?.trim()
    ? normalizeWaPhone(payload.buyerPhone)
    : "-";
  const product = escapeHtml(
    payload.productName?.trim() || DEFAULT_PRODUCT_NAME,
  );
  const nominal = formatIDR(payload.amount);
  const time = formatSaleTime(payload.occurredAt);

  // ── Penjualan VIA AFILIASI ─────────────────────────────────────────────────
  if (payload.affiliate) {
    const mitra = escapeHtml(payload.affiliate.name);
    const refCode = escapeHtml(payload.affiliate.refCode);
    const cleanPhoneMitra = payload.affiliate.phone
      ? normalizeWaPhone(payload.affiliate.phone)
      : "";
    // encodeURIComponent menyisakan `'` telanjang → amankan utk atribut HTML
    const encodedChatWA = encodeURIComponent(
      buildPartnerChatMessage(payload.affiliate.name),
    ).replace(/'/g, "%27");
    // Kutip ganda dipakai pada href (bentuk kanonik parser HTML Telegram —
    // encodeURIComponent tidak pernah menghasilkan `"` sehingga 100% aman)
    const waButton = cleanPhoneMitra
      ? `👉 <a href="https://wa.me/${cleanPhoneMitra}?text=${encodedChatWA}"><b>Klik di Sini untuk Kabari Kak ${mitra} via WhatsApp</b></a>`
      : `👉 Nomor WA mitra belum tersedia — cek Daftar Mitra: ${ADMIN_QUEUE_URL}`;

    return [
      "🔔 <b>PENJUALAN BARU VIA AFILIASI!</b> 🎉",
      "",
      "<b>Detail Transaksi:</b>",
      `• Pembeli: <b>${buyer}</b> (${buyerPhone})`,
      `• Paket: ${product} (${nominal})`,
      `• Tanggal: ${time}`,
      "",
      "<b>Data Mitra Afiliasi:</b>",
      `• Nama Mitra: <b>Kak ${mitra}</b>`,
      `• Kode Ref: <code>${refCode}</code>`,
      `• Komisi Masuk Antrean: <b>${formatIDR(AFFILIATE_COMMISSION_IDR)}</b>`,
      "",
      waButton,
      "",
      `<i>Buka antrean komisi admin: ${ADMIN_QUEUE_URL}</i>`,
    ].join("\n");
  }

  // ── Penjualan ORGANIK (tanpa referral) ─────────────────────────────────────
  return [
    "🔔 <b>PENJUALAN BARU (ORGANIK)!</b> 🎉",
    `• Pembeli: <b>${buyer}</b> (${buyerPhone})`,
    `• Paket: ${product} (${nominal})`,
    `• Tanggal: ${time}`,
    "• Sumber: Langsung (Tanpa Referral)",
  ].join("\n");
}

// ── Kanal Telegram (env-gated) ───────────────────────────────────────────────

/** Chat id tujuan — TELEGRAM_ADMIN_CHAT_ID utama, fallback TELEGRAM_CHAT_ID */
export function getSaleAlertTelegramChatId(): string {
  return (
    (process.env.TELEGRAM_ADMIN_CHAT_ID ?? "").trim() ||
    (process.env.TELEGRAM_CHAT_ID ?? "").trim()
  );
}

/** true bila kredensial Telegram lengkap — notifikasi penjualan aktif */
export function isSaleAlertConfigured(): boolean {
  return (
    (process.env.TELEGRAM_BOT_TOKEN ?? "").trim().length > 0 &&
    getSaleAlertTelegramChatId().length > 0
  );
}

async function sendTelegramSaleAlert(payload: SaleAlertPayload): Promise<void> {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const chatId = getSaleAlertTelegramChatId();
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: buildTelegramSaleMessage(payload),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`);
}

/**
 * Kirim notifikasi penjualan baru ke Telegram Admin — FAIL-SAFE:
 * env tidak diset → skip diam-diam; kegagalan fetch → hanya log server.
 * TIDAK PERNAH melempar error ke pemanggil (webhook Mayar tetap 200).
 */
export async function sendAdminSaleAlert(
  payload: SaleAlertPayload,
): Promise<void> {
  if (!isSaleAlertConfigured()) return; // env belum diset — lewati tanpa error
  try {
    await sendTelegramSaleAlert(payload);
    console.log(
      `[admin-sale-alert] Notifikasi penjualan terkirim via Telegram ` +
        `(order ${payload.orderId ?? "-"}, ` +
        `${payload.affiliate ? `afiliasi ${payload.affiliate.refCode}` : "organik"}).`,
    );
  } catch (error) {
    console.error(
      "[admin-sale-alert] Gagal kirim Telegram (webhook Mayar tidak terpengaruh):",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Fire-and-forget — dipanggil dari webhook via after() (next/server):
 * respons 200 ke Mayar TIDAK menunggu Telegram, error hanya masuk log.
 */
export function notifyAdminSaleAlert(payload: SaleAlertPayload): void {
  void sendAdminSaleAlert(payload).catch((error: unknown) => {
    console.error(
      "[admin-sale-alert] Notifikasi penjualan gagal terkirim:",
      error instanceof Error ? error.message : error,
    );
  });
}

// ── Alert MITRA AFILIASI BARU BERGABUNG (form publik /affiliate/join) ───────

export interface AffiliateJoinAlertPayload {
  /** Nama mitra — ditampilkan dgn sapaan "Kak {nama}" */
  partnerName: string;
  /** No. WhatsApp mitra ternormalisasi 62xxxxxxxxxx */
  phone: string;
  /** Kode referral yang baru diklaim */
  refCode: string;
}

/** Pesan Telegram mitra baru — parse_mode HTML (template sesuai spesifikasi) */
function buildTelegramAffiliateJoinMessage(
  payload: AffiliateJoinAlertPayload,
): string {
  const mitra = escapeHtml(payload.partnerName);
  const refCode = escapeHtml(payload.refCode);
  const chatWa = encodeURIComponent(
    `Halo Kak ${payload.partnerName}, selamat bergabung di afiliasi UnitKu!`,
  ).replace(/'/g, "%27");
  return [
    "🤝 <b>MITRA AFILIASI BARU BERGABUNG!</b>",
    `• Nama: <b>Kak ${mitra}</b>`,
    `• WhatsApp: ${payload.phone}`,
    `• Kode Ref: <code>${refCode}</code>`,
    "",
    `👉 <a href="https://wa.me/${payload.phone}?text=${chatWa}">Sapa via WhatsApp</a>`,
  ].join("\n");
}

/**
 * Kirim alert mitra baru ke Telegram Admin — FAIL-SAFE (pola sendAdminSale
 * Alert): env tidak diset → skip diam-diam; fetch gagal → hanya log.
 * TIDAK PERNAH melempar error ke pemanggil (registrasi tetap sukses).
 */
export async function sendAdminAffiliateJoinAlert(
  payload: AffiliateJoinAlertPayload,
): Promise<void> {
  if (!isSaleAlertConfigured()) return; // env belum diset — lewati tanpa error
  try {
    const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
    const chatId = getSaleAlertTelegramChatId();
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildTelegramAffiliateJoinMessage(payload),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`);
    console.log(
      `[admin-affiliate-alert] Notifikasi mitra baru terkirim via Telegram ` +
        `(Kak ${payload.partnerName}, WA ${payload.phone}, ref ${payload.refCode}).`,
    );
  } catch (error) {
    console.error(
      "[admin-affiliate-alert] Gagal kirim Telegram (registrasi tidak terpengaruh):",
      error instanceof Error ? error.message : error,
    );
  }
}

/** Fire-and-forget — dipanggil route via after(): respons API tidak menunggu */
export function notifyAdminAffiliateJoinAlert(
  payload: AffiliateJoinAlertPayload,
): void {
  void sendAdminAffiliateJoinAlert(payload).catch((error: unknown) => {
    console.error(
      "[admin-affiliate-alert] Notifikasi mitra baru gagal terkirim:",
      error instanceof Error ? error.message : error,
    );
  });
}
