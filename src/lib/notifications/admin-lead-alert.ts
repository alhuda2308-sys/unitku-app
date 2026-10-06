// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Notifikasi instan lead baru ke HP Admin (server-only)
//
// Dipicu setiap kali lead BARU tersimpan di license_leads (pendaftaran akun,
// pembelian lisensi, pesan manual). Pengiriman NON-BLOCKING: dipanggil via
// after() dari next/server sehingga respons registrasi/checkout tetap secepat
// kilat — notifikasi menyusul di belakang.
//
// Tiga kanal, SEMUA opsional (env kosong = kanal mati, tanpa error):
//   1. WhatsApp gateway — Fonnte (default) atau Wablas:
//        ADMIN_WHATSAPP_NUMBER  nomor HP admin tujuan (62…)
//        WHATSAPP_API_TOKEN     token device/gateway
//        WHATSAPP_API_PROVIDER  "fonnte" (default) | "wablas"
//        WHATSAPP_API_BASE_URL  domain Wablas (default https://tel.wablas.com)
//   2. Telegram Bot (gratis, push instan):
//        TELEGRAM_BOT_TOKEN     token dari @BotFather
//        TELEGRAM_CHAT_ID       chat id pribadi/grup admin
//   3. Discord / Slack webhook fallback:
//        ADMIN_ALERT_WEBHOOK_URL
//   Zona waktu pesan: ADMIN_ALERT_TZ (default Asia/Jakarta)
//
// Nama & nomor diambil dari lead asli (bukan email sintetis). Email otomatis
// nomor WhatsApp (62…@user.unitku.my.id) sengaja TIDAK ditampilkan — admin
// hanya perlu kontak yang bisa dihubungi.
// ─────────────────────────────────────────────────────────────────────────────

import { isPhoneEmail } from "@/lib/auth/phone-email";

export interface LeadAlertPayload {
  name: string;
  /** Nomor WhatsApp ternormalisasi 62xxxxxxxxxx — kunci upsert lead */
  phone: string;
  /** Email asli bila ada — email sintetis nomor WA diabaikan */
  email?: string | null;
  /** REGISTER | BAYAR_OTOMATIS | PESAN_MANUAL */
  source?: string | null;
  registeredAt?: Date | string | number;
}

const SOURCE_LABEL: Record<string, string> = {
  REGISTER: "Daftar akun baru",
  BAYAR_OTOMATIS: "Pembelian lisensi otomatis",
  PESAN_MANUAL: "Pemesanan manual via WhatsApp",
};

const FETCH_TIMEOUT_MS = 10_000;

function alertTimezone(): string {
  return (process.env.ADMIN_ALERT_TZ ?? "").trim() || "Asia/Jakarta";
}

function formatAlertTime(at: LeadAlertPayload["registeredAt"]): string {
  const date = at ? new Date(at) : new Date();
  if (Number.isNaN(date.getTime())) return formatAlertTime(Date.now());
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

/** escape HTML untuk pesan Telegram (nama pengguna bebas teks) */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface LeadAlertLines {
  name: string;
  phone: string;
  email: string | null;
  source: string;
  time: string;
}

function collectLines(payload: LeadAlertPayload): LeadAlertLines {
  const email =
    payload.email && !isPhoneEmail(payload.email) ? payload.email : null;
  return {
    name: payload.name,
    phone: payload.phone,
    email,
    source:
      (payload.source && SOURCE_LABEL[payload.source]) || payload.source || "Lead baru",
    time: formatAlertTime(payload.registeredAt),
  };
}

/** Pesan WhatsApp — format *bold* khas WA (sesuai template Admin) */
function buildWhatsAppMessage(l: LeadAlertLines): string {
  return [
    "🚨 *LEAD BARU UNITKU MASUK!*",
    `Nama: ${l.name}`,
    `WhatsApp: ${l.phone}`,
    l.email ? `Email: ${l.email}` : null,
    `Sumber: ${l.source}`,
    `Waktu: ${l.time}`,
    "",
    "Segera follow-up calon pembeli ini!",
    `👉 https://wa.me/${l.phone}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

/** Pesan Telegram — parse_mode HTML */
function buildTelegramMessage(l: LeadAlertLines): string {
  return [
    "🚨 <b>LEAD BARU UNITKU MASUK!</b>",
    `Nama: <b>${escapeHtml(l.name)}</b>`,
    `WhatsApp: ${l.phone}`,
    l.email ? `Email: ${l.email}` : null,
    `Sumber: ${escapeHtml(l.source)}`,
    `Waktu: ${l.time}`,
    "",
    "Segera follow-up calon pembeli ini!",
    `👉 https://wa.me/${l.phone}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

/** Pesan Discord/Slack webhook — markdown **bold** */
function buildWebhookMessage(l: LeadAlertLines): string {
  return [
    "🚨 **LEAD BARU UNITKU MASUK!**",
    `Nama: **${l.name}**`,
    `WhatsApp: ${l.phone}`,
    l.email ? `Email: ${l.email}` : null,
    `Sumber: ${l.source}`,
    `Waktu: ${l.time}`,
    "",
    "Segera follow-up calon pembeli ini!",
    `👉 https://wa.me/${l.phone}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

// ── Kanal pengiriman ─────────────────────────────────────────────────────────

async function sendWhatsApp(payload: LeadAlertPayload): Promise<void> {
  const token = (process.env.WHATSAPP_API_TOKEN ?? "").trim();
  const target = (process.env.ADMIN_WHATSAPP_NUMBER ?? "").trim();
  const provider = ((process.env.WHATSAPP_API_PROVIDER ?? "").trim() || "fonnte").toLowerCase();
  const message = buildWhatsAppMessage(collectLines(payload));

  if (provider === "wablas") {
    const base =
      (process.env.WHATSAPP_API_BASE_URL ?? "https://tel.wablas.com")
        .trim()
        .replace(/\/+$/, "") || "https://tel.wablas.com";
    const res = await fetch(`${base}/api/send-message`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: target, message }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Wablas HTTP ${res.status}`);
    return;
  }

  // Fonnte (default)
  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ target, message }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Fonnte HTTP ${res.status}`);
}

async function sendTelegram(payload: LeadAlertPayload): Promise<void> {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID ?? "").trim();
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: buildTelegramMessage(collectLines(payload)),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`);
}

async function sendWebhook(payload: LeadAlertPayload): Promise<void> {
  const url = (process.env.ADMIN_ALERT_WEBHOOK_URL ?? "").trim();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: buildWebhookMessage(collectLines(payload)) }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`);
}

/** Daftar kanal yang AKTIF berdasarkan env — untuk logging & health check */
export function getAdminLeadAlertChannels(): string[] {
  const channels: string[] = [];
  if (
    (process.env.WHATSAPP_API_TOKEN ?? "").trim() &&
    (process.env.ADMIN_WHATSAPP_NUMBER ?? "").trim()
  ) {
    channels.push(
      ((process.env.WHATSAPP_API_PROVIDER ?? "").trim() || "fonnte").toLowerCase() === "wablas"
        ? "whatsapp-wablas"
        : "whatsapp-fonnte",
    );
  }
  if (
    (process.env.TELEGRAM_BOT_TOKEN ?? "").trim() &&
    (process.env.TELEGRAM_CHAT_ID ?? "").trim()
  ) {
    channels.push("telegram");
  }
  if ((process.env.ADMIN_ALERT_WEBHOOK_URL ?? "").trim().startsWith("http")) {
    channels.push("webhook");
  }
  return channels;
}

/**
 * Kirim alert lead baru ke SEMUA kanal yang terkonfigurasi (paralel, saling
 * independen — satu kanal gagal tidak menggagalkan yang lain). Selalu resolve;
 * kegagalan per kanal hanya dicatat di log server.
 */
export async function sendAdminLeadAlert(payload: LeadAlertPayload): Promise<void> {
  const tasks: { name: string; run: () => Promise<void> }[] = [];
  if (
    (process.env.WHATSAPP_API_TOKEN ?? "").trim() &&
    (process.env.ADMIN_WHATSAPP_NUMBER ?? "").trim()
  ) {
    tasks.push({ name: "whatsapp", run: () => sendWhatsApp(payload) });
  }
  if (
    (process.env.TELEGRAM_BOT_TOKEN ?? "").trim() &&
    (process.env.TELEGRAM_CHAT_ID ?? "").trim()
  ) {
    tasks.push({ name: "telegram", run: () => sendTelegram(payload) });
  }
  if ((process.env.ADMIN_ALERT_WEBHOOK_URL ?? "").trim().startsWith("http")) {
    tasks.push({ name: "webhook", run: () => sendWebhook(payload) });
  }
  if (tasks.length === 0) return; // tidak ada kanal — notifikasi in-app tetap jalan

  const results = await Promise.allSettled(tasks.map((t) => t.run()));
  results.forEach((result, index) => {
    const name = tasks[index]!.name;
    if (result.status === "fulfilled") {
      console.log(`[admin-lead-alert] Terkirim via ${name} → ${payload.phone}`);
    } else {
      console.error(
        `[admin-lead-alert] Gagal via ${name}:`,
        result.reason instanceof Error ? result.reason.message : result.reason,
      );
    }
  });
}

/**
 * Fire-and-forget — DIPANGGIL dari route handler via after() (next/server):
 * respons API tidak menunggu pengiriman notifikasi (registrasi tetap kilat),
 * error hanya masuk log server, tidak pernah melempar.
 */
export function notifyAdminLeadAlert(payload: LeadAlertPayload): void {
  void sendAdminLeadAlert(payload).catch((error: unknown) => {
    console.error(
      "[admin-lead-alert] Notifikasi gagal terkirim:",
      error instanceof Error ? error.message : error,
    );
  });
}
