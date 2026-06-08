import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { brandName } from "@/lib/brand";
import { PricingClient } from "./pricing-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pricing");
  const brand = brandName(await getLocale());
  return {
    title: `${t("metaTitle")} · ${brand}`,
  };
}

/**
 * Public pricing page. Server wrapper supplies locale-aware metadata (mirrors
 * the contact/legal page convention); the interactive plan UI lives in the
 * `PricingClient` child component.
 */
export default function PricingPage() {
  return <PricingClient />;
}
