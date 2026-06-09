/**
 * GET /api/geo — best-effort country detection from Vercel's edge geo header,
 * returning a suggested onboarding currency. Suggestion only; never persisted
 * here. No header (local dev) → ILS fallback.
 */
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { currencyForCountry } from "@/lib/geo-currency";

export async function GET(request: Request): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
  }
  const country = request.headers.get("x-vercel-ip-country");
  return NextResponse.json({
    success: true,
    country,
    suggestedCurrency: currencyForCountry(country),
  });
}
