import { NextRequest, NextResponse } from "next/server";
import { getTierForCountry, getPricingForCountry } from "@/lib/pricing";

/**
 * GET /api/pricing
 * Returns the pricing tier and pricing info based on user's country
 * Uses Vercel's x-vercel-ip-country header for country detection
 */
export async function GET(request: NextRequest) {
  // Get country from Vercel header
  const countryCode = request.headers.get("x-vercel-ip-country");
  
  // For local development, allow override via query param
  const url = new URL(request.url);
  const overrideCountry = url.searchParams.get("country");
  
  const effectiveCountry = overrideCountry || countryCode;
  
  const tier = getTierForCountry(effectiveCountry);
  const pricing = getPricingForCountry(effectiveCountry);
  
  return NextResponse.json({
    countryCode: effectiveCountry,
    tier,
    pricing,
  });
}
