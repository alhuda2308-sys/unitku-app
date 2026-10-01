// ─────────────────────────────────────────────────────────────────────────────
// UnitKu — Status lisensi sesi owner aktif
//
// GET /api/billing/license → dipakai gerbang lisensi di dashboard & onboarding.
//   { licensed: boolean, demo, email, paymentRef?, licensedAt?, checkoutUrl }
// Mode demo selalu berlisensi (data contoh, bukan akun berbayar).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/server";
import { getLicenseByEmail, getMayarCheckoutUrl } from "@/lib/billing/license";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const checkoutUrl = getMayarCheckoutUrl();

  if (user.demo) {
    return NextResponse.json({
      licensed: true,
      demo: true,
      email: user.email,
      checkoutUrl,
    });
  }

  const license = user.email
    ? await getLicenseByEmail(user.email)
    : null;

  return NextResponse.json({
    licensed: license?.isLifetimeLicensed === true,
    demo: false,
    email: user.email,
    paymentRef: license?.paymentRef ?? null,
    licensedAt: license?.licensedAt ?? null,
    checkoutUrl,
  });
}
