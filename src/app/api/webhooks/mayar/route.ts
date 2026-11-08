// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Webhook Mayar: "Jual Putus Otomatis" (zero manual work)
//
// POST /api/webhooks/mayar
//   • Event ditangani : payment.received (dan varian sukses lain)
//   • Validasi        : secret MAYAR_WEBHOOK_SECRET via header
//                       (x-mayar-token | x-webhook-token | Authorization: Bearer)
//                       atau query param ?token= / ?secret= — timing-safe.
//   • Payload         : flat maupun bersarang data{} — customer_email|email,
//                       customer_name|name, customer_mobile|phone, amount,
//                       transaction_id|id pembayaran Mayar.
//   • Affiliate (Tahap 3): metadata.affiliate_ref pada payload → komisi
//                       Rp150.000 otomatis utk affiliator terkait — IDEMPOTEN
//                       per order_id (retry webhook tidak menumpuk komisi).
//   • Respons sukses  : HTTP 200 { success: true, received: true }
//                       (Mayar berhenti mengulang).
//
// Konfigurasi di dashboard Mayar → Pengaturan → Webhook:
//   URL    : https://<domain>/api/webhooks/mayar
//   Secret : sama dengan env MAYAR_WEBHOOK_SECRET
// ─────────────────────────────────────────────────────────────────────────────

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeAffiliateRef } from "@/lib/affiliate";
import { recordAffiliateCommissionIfNew } from "@/lib/affiliate-commission";
import { applyPaidLicense } from "@/lib/billing/license";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Validasi secret ──────────────────────────────────────────────────────────

function extractProvidedToken(request: NextRequest): string {
  const header =
    request.headers.get("x-mayar-token") ??
    request.headers.get("x-webhook-token") ??
    "";
  if (header) return header.trim();

  const auth = request.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();

  return (
    request.nextUrl.searchParams.get("token") ??
    request.nextUrl.searchParams.get("secret") ??
    ""
  );
}

/** Bandingkan token dengan secret via SHA-256 agar panjang selalu setara */
function tokenMatches(provided: string, secret: string): boolean {
  if (!provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

// ── Normalisasi payload (flat / data{} / customer bersarang) ────────────────

type Loose = Record<string, unknown>;

function isLoose(value: unknown): value is Loose {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

/** Event sukses pembayaran — sisanya (expired, refund, dsb.) diabaikan.
 *  Mencakup varian resmi Mayar (payment.received) maupun varian umum
 *  payment/invoice/transaction/order paid|success|settled|completed. */
function isSuccessEvent(event: string): boolean {
  return /(?:payment|invoice|transaction|order)[_.-]?(received|success|paid|settled?|settlement|completed?)|^(paid|success|settlement|completed?)$/i.test(
    event,
  );
}

/** Metadata invoice — objek, atau string JSON (beberapa varian payload Mayar) */
function pickMetadata(...sources: unknown[]): Loose {
  for (const raw of sources) {
    if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isLoose(parsed)) return parsed;
      } catch {
        // bukan JSON valid — lewati
      }
    } else if (isLoose(raw)) {
      return raw;
    }
  }
  return {};
}

interface ExtractedPayment {
  email: string;
  name?: string;
  phone?: string;
  amount: number;
  transactionId: string;
  /** order_id / payment_id — kunci idempotensi komisi (fallback transactionId) */
  orderId: string;
  /** Kode referral afiliasi dari metadata invoice — null bila bukan traffic afiliasi */
  affiliateRef: string | null;
  eventType?: string;
  /** Field status mentah (root.status / data.status) — sinyal sukses tambahan */
  statusValue?: string;
  raw: unknown;
}

function extractPayment(body: unknown): ExtractedPayment | null {
  if (!isLoose(body)) return null;
  const root = body;
  const data = isLoose(root.data) ? root.data : {};
  const customer = isLoose(root.customer)
    ? root.customer
    : isLoose(data.customer)
      ? data.customer
      : {};
  const details = isLoose(root.customer_details)
    ? root.customer_details
    : isLoose(data.customer_details)
      ? data.customer_details
      : {};

  // Prefensi: data.* → root.* → customer/customer_details.* (varian payload Mayar)
  const email = pickString(
    data.customer_email,
    data.email,
    root.customer_email,
    root.email,
    customer.email,
    details.email,
  );
  const transactionId = pickString(
    data.transaction_id,
    data.transactionId,
    data.payment_id,
    data.paymentId,
    data.invoice_id,
    data.invoiceId,
    root.transaction_id,
    root.transactionId,
    root.payment_id,
    root.invoice_id,
    root.uid,
    data.uid,
    data.id,
    root.id,
  );

  if (!email || !transactionId) return null;

  // order_id / payment_id transaksi — kunci idempotensi komisi afiliasi
  const orderId =
    pickString(data.order_id, data.orderId, root.order_id, root.orderId) ??
    transactionId;

  // metadata.affiliate_ref (Tahap 3) — kode referral yang diselipkan /api/checkout
  // dari cookie `unitku_ref`; sebagian varian payload meletakkannya langsung
  // di root/data. Divalidasi ulang dengan sanitizeAffiliateRef.
  const metadata = pickMetadata(root.metadata, data.metadata);
  const affiliateRef = sanitizeAffiliateRef(
    pickString(
      metadata.affiliate_ref,
      metadata.affiliateRef,
      data.affiliate_ref,
      root.affiliate_ref,
    ) ?? null,
  );

  return {
    email,
    name: pickString(
      data.customer_name,
      data.name,
      root.customer_name,
      root.name,
      customer.name,
      details.name,
    ),
    phone: pickString(
      data.customer_mobile,
      data.customer_mobile_no,
      data.phone,
      data.mobile,
      root.customer_mobile,
      root.phone,
      customer.mobile,
      customer.phone,
      customer.mobile_no,
      details.mobile,
      details.phone,
    ),
    amount: pickNumber(
      data.amount,
      data.total,
      data.price,
      root.amount,
      root.total,
      root.price,
    ) ?? 0,
    transactionId,
    orderId,
    affiliateRef,
    eventType: pickString(root.event, data.event, root.type, data.type),
    statusValue: pickString(root.status, data.status),
    raw: body,
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const secret = process.env.MAYAR_WEBHOOK_SECRET ?? "";
  if (secret.length < 8) {
    console.error(
      "[UnitKu Billing] MAYAR_WEBHOOK_SECRET belum diisi — webhook ditolak (503).",
    );
    return NextResponse.json(
      {
        success: false,
        error: "Webhook belum dikonfigurasi — set env MAYAR_WEBHOOK_SECRET.",
      },
      { status: 503 },
    );
  }

  if (!tokenMatches(extractProvidedToken(request), secret)) {
    return NextResponse.json(
      { success: false, error: "Token webhook tidak valid." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);

  // Log event mentah — verifikasi alur atribusi afiliasi langsung di Vercel
  // Logs (payload Mayar bisa flat maupun bersarang data{}).
  if (isLoose(body)) {
    console.log(
      "[Mayar Webhook Event]:",
      pickString(body.event, body.type) ?? "(tanpa event)",
      "Data:",
      JSON.stringify(body.data ?? body),
    );
  } else {
    console.log(
      "[Mayar Webhook Event]: (payload non-objek)",
      "Data:",
      JSON.stringify(body),
    );
  }

  const payment = extractPayment(body);
  if (!payment) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Payload tidak lengkap — customer_email (email) & transaction_id wajib ada.",
      },
      { status: 400 },
    );
  }

  // Referral afiliasi terdeteksi pada payload — atribusi komisi akan diproses
  // setelah provisioning lisensi sukses (log hasilnya di bawah).
  if (payment.affiliateRef) {
    console.log(
      `[UnitKu Affiliate] metadata.affiliate_ref terdeteksi: "${payment.affiliateRef}" (order ${payment.orderId}, pembeli ${payment.email}).`,
    );
  }

  // Hanya event pembayaran sukses yang memicu provisioning — event lain
  // tetap dijawab 200 agar Mayar berhenti mencoba ulang. Sinyal sukses diuji
  // pada NAMA event (mis. payment.received) DAN field status (mis. "paid")
  // bila keduanya ada — payload dgn event tidak dikenal tapi status "paid"
  // tetap diproses, bukan diabaikan.
  const hasSuccessSignal =
    Boolean(payment.eventType && isSuccessEvent(payment.eventType)) ||
    Boolean(payment.statusValue && isSuccessEvent(payment.statusValue));
  if (payment.eventType && !hasSuccessSignal) {
    console.log(
      `[UnitKu Billing] Event diabaikan: ${payment.eventType} (${payment.transactionId})`,
    );
    return NextResponse.json({
      success: true,
      received: true,
      ignored: true,
      event: payment.eventType,
    });
  }

  try {
    const result = await applyPaidLicense({
      email: payment.email,
      name: payment.name,
      phone: payment.phone,
      amount: payment.amount,
      transactionId: payment.transactionId,
      eventType: payment.eventType,
      raw: payment.raw,
    });

    if (result.duplicate) {
      console.log(
        `[UnitKu Billing] Transaksi duplikat diabaikan: ${payment.transactionId}`,
      );
    } else {
      console.log(
        `[UnitKu Billing] Lisensi seumur hidup aktif untuk ${payment.email} ` +
          `(txn ${payment.transactionId}, akun baru: ${result.created})`,
      );
    }

    // ── Komisi afiliasi (Tahap 3) — idempoten per orderId ────────────────────
    // Bookkeeping komisi TIDAK PERNAH menggagalkan provisioning lisensi:
    // recordAffiliateCommissionIfNew menangkap error internalnya sendiri.
    const commission = await recordAffiliateCommissionIfNew({
      refCode: payment.affiliateRef,
      orderId: payment.orderId,
      customerEmail: payment.email,
    });
    if (payment.affiliateRef && !commission.recorded && !commission.duplicate) {
      console.log(
        `[UnitKu Affiliate] Komisi order ${payment.orderId} dilewati (${commission.reason}).`,
      );
    }

    return NextResponse.json({
      success: true,
      received: true,
      provisioned: result.created,
      ...(result.duplicate ? { duplicate: true } : {}),
      ...(payment.affiliateRef
        ? {
            affiliate: commission.recorded
              ? "commission_recorded"
              : commission.duplicate
                ? "commission_duplicate"
                : `commission_skipped:${commission.reason}`,
          }
        : {}),
    });
  } catch (error) {
    console.error("[UnitKu Billing] Gagal memproses webhook Mayar:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memproses webhook — coba lagi." },
      { status: 500 },
    );
  }
}
