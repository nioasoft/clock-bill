/**
 * Single source of truth for the selectable profession presets. Adding a
 * profession = one record here. A preset seeds the user's billing *base* during
 * onboarding: rounding mode, payment terms, and preferred PDF template. It does
 * NOT set currency (geo-suggested), rate (user-typed), or theme (user choice).
 * The "model hint" is descriptive only (billing model lives on client/project).
 */
import type { RoundingMode } from "@/lib/rounding";

export interface ProfessionDefaults {
  /** Applied to user_profiles.default_billing_rounding (the cascade base). */
  defaultBillingRounding: RoundingMode;
  /** Hebrew payment-terms text, or null for the generic preset. */
  paymentTerms: string | null;
  /** A KNOWN_TEMPLATES id (see lib/schemas/charge-documents.ts). */
  preferredPdfTemplate: string;
}

export interface Profession {
  id: string;
  labelHe: string;
  labelEn: string;
  /** Descriptive only — orients the user, never applied. */
  modelHintHe: string;
  modelHintEn: string;
  defaults: ProfessionDefaults;
}

export const PROFESSIONS: Profession[] = [
  {
    id: "lawyer",
    labelHe: 'עו"ד',
    labelEn: "Lawyer",
    modelHintHe: "חיוב שעתי",
    modelHintEn: "Hourly billing",
    defaults: { defaultBillingRounding: "tenth_hour_up", paymentTerms: "שוטף+30", preferredPdfTemplate: "classic" },
  },
  {
    id: "accountant",
    labelHe: 'רו"ח / יועץ מס',
    labelEn: "Accountant / Tax advisor",
    modelHintHe: "ריטיינר חודשי",
    modelHintEn: "Monthly retainer",
    defaults: { defaultBillingRounding: "tenth_hour_up", paymentTerms: "שוטף+30", preferredPdfTemplate: "classic" },
  },
  {
    id: "consultant",
    labelHe: "יועץ עסקי / מאמן",
    labelEn: "Consultant / Coach",
    modelHintHe: "ריטיינר / שעתי",
    modelHintEn: "Retainer / Hourly",
    defaults: { defaultBillingRounding: "half_hour_up", paymentTerms: "שוטף+30", preferredPdfTemplate: "modern" },
  },
  {
    id: "developer",
    labelHe: "מפתח תוכנה",
    labelEn: "Software developer",
    modelHintHe: "שעתי / ריטיינר",
    modelHintEn: "Hourly / Retainer",
    defaults: { defaultBillingRounding: "none", paymentTerms: "שוטף+30", preferredPdfTemplate: "modern" },
  },
  {
    id: "designer",
    labelHe: "מעצב גרפי / UX",
    labelEn: "Graphic / UX designer",
    modelHintHe: "פרויקט / Fixed",
    modelHintEn: "Project / Fixed",
    defaults: { defaultBillingRounding: "none", paymentTerms: "שוטף+30", preferredPdfTemplate: "modern" },
  },
  {
    id: "photographer",
    labelHe: "צלם / וידאו",
    labelEn: "Photographer / Video",
    modelHintHe: "Fixed (יום צילום)",
    modelHintEn: "Fixed (shoot day)",
    defaults: { defaultBillingRounding: "none", paymentTerms: "שוטף+30", preferredPdfTemplate: "modern" },
  },
  {
    id: "writer",
    labelHe: "כותב תוכן / קופירייטר",
    labelEn: "Content writer / Copywriter",
    modelHintHe: "לפי פריט / שעתי",
    modelHintEn: "Per item / Hourly",
    defaults: { defaultBillingRounding: "none", paymentTerms: "שוטף+30", preferredPdfTemplate: "modern" },
  },
  {
    id: "other",
    labelHe: "אחר / כללי",
    labelEn: "Other / General",
    modelHintHe: "—",
    modelHintEn: "—",
    defaults: { defaultBillingRounding: "none", paymentTerms: null, preferredPdfTemplate: "modern" },
  },
];

export function isProfessionId(value: unknown): value is string {
  return typeof value === "string" && PROFESSIONS.some((p) => p.id === value);
}

export function getProfession(id: string | null | undefined): Profession | undefined {
  return PROFESSIONS.find((p) => p.id === id);
}
