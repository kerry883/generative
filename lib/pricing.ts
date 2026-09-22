/**
 * Regional Pricing Configuration
 * Netflix-style pricing tiers based on country purchasing power
 */

export type PricingTier = "standard" | "emerging" | "middle";

export interface TierPricing {
  monthlyPrice: string;
  yearlyPrice: string;
  yearlyMonthly: string;
  monthlyProductId: string;
  yearlyProductId: string;
  currency: string;
  discount?: string; // For emerging/middle tiers
}

/**
 * Pricing tiers with product IDs
 * TODO: Update the emerging/middle product IDs once created in Dodo
 */
export const PRICING_TIERS: Record<PricingTier, TierPricing> = {
  standard: {
    monthlyPrice: "$9.99",
    yearlyPrice: "$69.99",
    yearlyMonthly: "$5.80",
    monthlyProductId: "pdt_2fl4BLtmIEkAgdGMs1ueB",
    yearlyProductId: "pdt_0NVNoEnbpjTv0FJZyA7j2",
    currency: "USD",
  },
  emerging: {
    monthlyPrice: "$1.99",
    yearlyPrice: "$15",
    yearlyMonthly: "$1.25",
    // TODO: Replace with actual Dodo product IDs
    monthlyProductId: "pdt_0NWGm15XhrSRQshmrLAsS",
    yearlyProductId: "pdt_0NWGtzW415WnXGojMWz9c",
    currency: "USD",
    discount: "70% off",
  },
  middle: {
    monthlyPrice: "$4.99",
    yearlyPrice: "$39",
    yearlyMonthly: "$3.25",
    // TODO: Replace with actual Dodo product IDs
    monthlyProductId: "pdt_0NWGueadNeW1wlPIEVQ1l",
    yearlyProductId: "pdt_0NWGupwKY3FbzjYczJdrC",
    currency: "USD",
    discount: "50% off",
  },
};

/**
 * Country code to pricing tier mapping
 * ISO 3166-1 alpha-2 country codes
 */
export const COUNTRY_TO_TIER: Record<string, PricingTier> = {
  // Standard tier - High income countries
  US: "standard",
  GB: "standard",
  CA: "standard",
  AU: "standard",
  DE: "standard",
  FR: "standard",
  NL: "standard",
  BE: "standard",
  CH: "standard",
  AT: "standard",
  IE: "standard",
  SE: "standard",
  NO: "standard",
  DK: "standard",
  FI: "standard",
  SG: "standard",
  JP: "standard",
  KR: "standard",
  NZ: "standard",
  
  // Emerging tier - Lower income / Developing countries
  KE: "emerging", // Kenya
  NG: "emerging", // Nigeria
  IN: "emerging", // India
  PK: "emerging", // Pakistan
  BD: "emerging", // Bangladesh
  PH: "emerging", // Philippines
  VN: "emerging", // Vietnam
  LK: "emerging", // Sri Lanka
  NP: "emerging", // Nepal
  GH: "emerging", // Ghana
  TZ: "emerging", // Tanzania
  UG: "emerging", // Uganda
  ET: "emerging", // Ethiopia
  RW: "emerging", // Rwanda
  ZM: "emerging", // Zambia
  ZW: "emerging", // Zimbabwe
  MM: "emerging", // Myanmar
  KH: "emerging", // Cambodia
  
  // Middle tier - Middle income countries
  BR: "middle", // Brazil
  MX: "middle", // Mexico
  ZA: "middle", // South Africa
  EG: "middle", // Egypt
  TH: "middle", // Thailand
  ID: "middle", // Indonesia
  MY: "middle", // Malaysia
  TR: "middle", // Turkey
  AR: "middle", // Argentina
  CL: "middle", // Chile
  CO: "middle", // Colombia
  PE: "middle", // Peru
  PL: "middle", // Poland
  CZ: "middle", // Czech Republic
  HU: "middle", // Hungary
  RO: "middle", // Romania
  UA: "middle", // Ukraine
  RU: "middle", // Russia
  CN: "middle", // China
};

/**
 * Get pricing tier for a country code
 * Defaults to "middle" for unknown countries
 */
export function getTierForCountry(countryCode: string | null): PricingTier {
  if (!countryCode) return "middle";
  return COUNTRY_TO_TIER[countryCode.toUpperCase()] || "middle";
}

/**
 * Get pricing for a country
 */
export function getPricingForCountry(countryCode: string | null): TierPricing {
  const tier = getTierForCountry(countryCode);
  return PRICING_TIERS[tier];
}
