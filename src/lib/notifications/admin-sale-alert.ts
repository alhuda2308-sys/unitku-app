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
// Env (OPSIONAL — kosong/undefined → dipakai FALLBACK kredensial produksi di
// bawah, jadi notifikasi TETAP terkirim walau env lupa diisi di Vercel):
//   TELEGRAM_BOT_TOKEN       token dari @BotFather (fallback: hardcode produksi)
//   TELEGRAM_ADMIN_CHAT_ID   chat id admin tujuan notifikasi penjualan
//                            (fallback: TELEGRAM_CHAT_ID → hardcode produksi)
//   ADMIN_ALERT_TZ           zona waktu pesan (default Asia/Jakarta)
//
// Fail-safe total (wajib — webhook Mayar tidak boleh terganggu):
//   • fetch dibungkus try...catch + timeout 10 detik
//   • kegagalan Telegram HANYA masuk log server — respons 200 webhook Mayar
//     dan respons registrasi mitra tidak pernah berubah
//
// ⚠️ PENTING (bug produksi 2026 — notifikasi hilang di Vercel):
//   FUNGSI alert ini TIDAK BOLEH dibungkus wrapper fire-and-forget (void)
//   di dalam after(). Callback after() HARUS mengembalikan Promise yang
//   di-await penuh, kalau tidak runtime serverless membekukan eksekusi
//   sebelum fetch Telegram selesai → pesan hilang diam-diam.
//   • Route /api/affiliate/join → await sendAdminAffiliateJoinAlert() langsung
//   • Webhook Mayar            → after(async () => { await sendAdminSaleAlert() })
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

// ── Kanal Telegram (env utama + fallback hardcode kredensial produksi) ──────

/**
 * Fallback kredensial produksi — dipakai PERSIS bila env tidak diset/undefined
 * di Vercel (permintaan owner: notifikasi admin wajib tetap terkirim, tidak
 * boleh hilang hanya karena env lupa diisi). Urutan resolusi: env → fallback.
 */
const TELEGRAM_BOT_TOKEN_FALLBACK =
  "9170134733:AAEnAu7OEWVq9My0nA3aIoW_1dJ_mbtrXWU";
const TELEGRAM_ADMIN_CHAT_ID_FALLBACK = "5375383532";

/** Token bot — env TELEGRAM_BOT_TOKEN, kosong/undefined → fallback produksi */
function resolveTelegramBotToken(): string {
  return (
    (process.env.TELEGRAM_BOT_TOKEN ?? "").trim() || TELEGRAM_BOT_TOKEN_FALLBACK
  );
}

/** Chat id tujuan — TELEGRAM_ADMIN_CHAT_ID → TELEGRAM_CHAT_ID → fallback */
export function getSaleAlertTelegramChatId(): string {
  return (
    (process.env.TELEGRAM_ADMIN_CHAT_ID ?? "").trim() ||
    (process.env.TELEGRAM_CHAT_ID ?? "").trim() ||
    TELEGRAM_ADMIN_CHAT_ID_FALLBACK
  );
}

/** true bila kredensial terisi — dgn fallback produksi selalu terisi (guard) */
export function isSaleAlertConfigured(): boolean {
  return (
    resolveTelegramBotToken().length > 0 &&
    getSaleAlertTelegramChatId().length > 0
  );
}

/** Ringkasan kredensial utk log diagnosa (token di-mask, chat id penuh) */
function telegramCredentialLogInfo(): string {
  const token = resolveTelegramBotToken();
  const envToken = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  return (
    `env.TELEGRAM_BOT_TOKEN terbaca=${Boolean(envToken)}` +
    `(sumber=${envToken ? "env" : "FALLBACK"}, ` +
    `token terpakai: ${token.slice(0, 12)}…, len ${token.length}), ` +
    `env.TELEGRAM_ADMIN_CHAT_ID="${
      (process.env.TELEGRAM_ADMIN_CHAT_ID ?? "").trim()
    }", ` +
    `env.TELEGRAM_CHAT_ID="${(process.env.TELEGRAM_CHAT_ID ?? "").trim()}", ` +
    `chat_id_final=${getSaleAlertTelegramChatId()}`
  );
}

/**
 * Kirim pesan HTML ke chat admin via sendMessage — MELEMPAR bila gagal.
 * Status HTTP + body respons Telegram SELALU dicetak ke log (diagnosa owner),
 * termasuk menangkap error parse_mode HTML (mis. tag rusak → HTTP 400,
 * description "can't parse entities").
 */
async function sendTelegramHtmlMessage(
  text: string,
  logLabel: string,
): Promise<void> {
  const token = resolveTelegramBotToken();
  const chatId = getSaleAlertTelegramChatId();
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId, // string angka valid ("5375383532") — format resmi API
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const resData: unknown = await res.json().catch(() => null);
  console.log(
    `[Telegram ${logLabel} Response]: HTTP ${res.status} — ${
      JSON.stringify(resData) ?? "(body tidak bisa di-parse)"
    }`,
  );
  if (!res.ok || (resData as { ok?: boolean } | null)?.ok === false) {
    throw new Error(
      `Telegram HTTP ${res.status}: ${
        JSON.stringify(resData) ?? "tanpa body respons"
      }`,
    );
  }
}

/**
 * Kirim notifikasi penjualan baru ke Telegram Admin — FAIL-SAFE:
 * fetch gagal → hanya log server, TIDAK PERNAH melempar error ke pemanggil
 * (webhook Mayar tetap 200). SELALU di-await penuh oleh pemanggil (route
 * webhook memakai after(async () => { await ... })).
 */
export async function sendAdminSaleAlert(
  payload: SaleAlertPayload,
): Promise<void> {
  if (!isSaleAlertConfigured()) return; // guard defensif (fallback selalu isi)
  const target =
    payload.affiliate ? `afiliasi ${payload.affiliate.refCode}` : "organik";
  console.log(
    `[Telegram Sale Alert] Dipanggil — order ${payload.orderId ?? "-"}, ` +
      `${target}. Kredensial: ${telegramCredentialLogInfo()}.`,
  );
  try {
    await sendTelegramHtmlMessage(buildTelegramSaleMessage(payload), "Sale Alert");
    console.log(
      `[admin-sale-alert] Notifikasi penjualan terkirim via Telegram ` +
        `(order ${payload.orderId ?? "-"}, ${target}).`,
    );
  } catch (error) {
    console.error(
      "[admin-sale-alert] Gagal kirim Telegram (webhook Mayar tidak terpengaruh):",
      error instanceof Error ? error.message : error,
    );
  }
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
 * Alert): fetch gagal → hanya log, TIDAK PERNAH melempar error ke pemanggil
 * (registrasi tetap sukses). DI-AWAIT LANGSUNG oleh route /api/affiliate/join
 * sebelum respons dikirim — menjamin fetch tuntas di runtime serverless.
 */
export async function sendAdminAffiliateJoinAlert(
  payload: AffiliateJoinAlertPayload,
): Promise<void> {
  if (!isSaleAlertConfigured()) {
    console.error(
      "[admin-affiliate-alert] Dilewati — kredensial Telegram tidak tersedia.",
    );
    return;
  }
  console.log(
    `[Telegram Join Alert] Dipanggil — mitra "Kak ${payload.partnerName}" ` +
      `(WA ${payload.phone}, ref ${payload.refCode}). ` +
      `Kredensial: ${telegramCredentialLogInfo()}.`,
  );
  try {
    await sendTelegramHtmlMessage(
      buildTelegramAffiliateJoinMessage(payload),
      "Join Alert",
    );
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

// ── Alert PENDAFTARAN PENGGUNA BARU (sign-up akun owner) ────────────────────

/** Mitra pemilik kode referral saat pendaftaran lewat link mitra */
export interface UserSignupReferralSource {
  /** Nama mitra (dari DB tabel affiliates) */
  name: string;
  /** Kode referral terdeteksi (sudah ternormalisasi) */
  refCode: string;
}

export interface UserSignupAlertPayload {
  /** Nama lengkap pengguna dari form registrasi */
  userName: string;
  /** Email akun (bisa email sintetis dari WA: 62xxx@user.unitku.my.id) */
  email: string;
  /** No. WhatsApp ternormalisasi 62… — kosong → baris tautan WA dihilangkan */
  phone?: string | null;
  /** Terisi = daftar lewat link mitra; null/kosong = Organik (Langsung) */
  referral?: UserSignupReferralSource | null;
  /** Waktu pendaftaran (default: sekarang) */
  occurredAt?: Date | string | number;
}

/**
 * Pesan Telegram pengguna baru — parse_mode HTML (template sesuai spesifikasi).
 * Dua varian: lewat link mitra (blok "Sumber Referral" dgn nama + kode) atau
 * organik (baris "Sumber: Organik (Langsung)").
 */
function buildTelegramUserSignupMessage(
  payload: UserSignupAlertPayload,
): string {
  const userName = escapeHtml(payload.userName.trim() || "Pengguna Baru");
  const userEmail = escapeHtml(payload.email.trim() || "-");
  const cleanPhone = payload.phone?.trim()
    ? normalizeWaPhone(payload.phone)
    : "";
  const time = formatSaleTime(payload.occurredAt);
  const referral =
    payload.referral && payload.referral.name.trim() && payload.referral.refCode.trim()
      ? payload.referral
      : null;

  const lines = [
    "👤 <b>PENDAFTARAN PENGGUNA BARU UNITKU!</b> 🎉",
    "",
    "<b>Detail Pengguna:</b>",
    `• Nama: <b>${userName}</b>`,
    `• Email: ${userEmail}`,
    `• No. WhatsApp: ${cleanPhone || "-"}`,
  ];
  if (referral) {
    // ── Daftar lewat link mitra — blok sumber referral terpisah ─────────────
    lines.push(`• Tanggal: ${time}`);
    lines.push("");
    lines.push("<b>Sumber Referral:</b>");
    lines.push(
      `• Mitra: <b>Kak ${escapeHtml(referral.name)}</b> (<code>${escapeHtml(
        referral.refCode,
      )}</code>)`,
    );
  } else {
    // ── Pendaftaran langsung / organik ──────────────────────────────────────
    lines.push("• Sumber: <b>Organik (Langsung)</b>");
    lines.push(`• Tanggal: ${time}`);
  }
  // Tautan WA hanya bila nomor tersedia — tanpa nomor pesan tetap rapi
  if (cleanPhone) {
    // encodeURIComponent menyisakan `'` telanjang → amankan utk atribut HTML;
    // tidak pernah menghasilkan `"` sehingga href dgn kutip ganda 100% aman
    const encodedChatWA = encodeURIComponent(
      `Halo Kak ${payload.userName.trim() || "Kak"}, selamat datang di UnitKu!`,
    ).replace(/'/g, "%27");
    lines.push(
      "",
      `👉 <a href="https://wa.me/${cleanPhone}?text=${encodedChatWA}">Sapa Pengguna via WhatsApp</a>`,
    );
  }
  return lines.join("\n");
}

/**
 * Kirim alert pengguna baru ke Telegram Admin — FAIL-SAFE (pola alert lain):
 * fetch gagal → hanya log, TIDAK PERNAH melempar error ke pemanggil
 * (registrasi user tetap sukses). DI-AWAIT LANGSUNG oleh route registrasi
 * sebelum respons dikirim — menjamin fetch tuntas di runtime serverless
 * (pelajaran bug after()-void: eksekusi Vercel bisa dibekukan lebih dulu).
 */
export async function sendAdminUserSignupAlert(
  payload: UserSignupAlertPayload,
): Promise<void> {
  if (!isSaleAlertConfigured()) {
    console.error(
      "[admin-user-signup-alert] Dilewati — kredensial Telegram tidak tersedia.",
    );
    return;
  }
  console.log(
    `[Telegram User Signup Alert] Dipanggil — pengguna "${payload.userName}" ` +
      `(email ${payload.email}, WA ${payload.phone || "-"}, sumber ` +
      `${payload.referral ? `mitra ${payload.referral.refCode}` : "organik"}). ` +
      `Kredensial: ${telegramCredentialLogInfo()}.`,
  );
  try {
    await sendTelegramHtmlMessage(
      buildTelegramUserSignupMessage(payload),
      "User Signup Alert",
    );
    console.log(
      `[admin-user-signup-alert] Notifikasi pengguna baru terkirim via Telegram ` +
        `(${payload.userName}, ${payload.email}).`,
    );
  } catch (error) {
    console.error(
      "[admin-user-signup-alert] Gagal kirim Telegram (registrasi tidak terpengaruh):",
      error instanceof Error ? error.message : error,
    );
  }
}
