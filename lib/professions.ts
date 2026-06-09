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
  /** Suggested billing model — prefills the new-client form (not a cascade level). */
  suggestedBillingModel: "hourly" | "retainer" | "fixed_monthly" | "items";
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
    defaults: { defaultBillingRounding: "tenth_hour_up", paymentTerms: "שוטף+30", preferredPdfTemplate: "classic", suggestedBillingModel: "hourly" },
  },
  {
    id: "accountant",
    labelHe: 'רו"ח / יועץ מס',
    labelEn: "Accountant / Tax advisor",
    modelHintHe: "ריטיינר חודשי",
    modelHintEn: "Monthly retainer",
    defaults: { defaultBillingRounding: "tenth_hour_up", paymentTerms: "שוטף+30", preferredPdfTemplate: "classic", suggestedBillingModel: "retainer" },
  },
  {
    id: "consultant",
    labelHe: "יועץ עסקי / מאמן",
    labelEn: "Consultant / Coach",
    modelHintHe: "ריטיינר / שעתי",
    modelHintEn: "Retainer / Hourly",
    defaults: { defaultBillingRounding: "half_hour_up", paymentTerms: "שוטף+30", preferredPdfTemplate: "modern", suggestedBillingModel: "retainer" },
  },
  {
    id: "developer",
    labelHe: "מפתח תוכנה",
    labelEn: "Software developer",
    modelHintHe: "שעתי / ריטיינר",
    modelHintEn: "Hourly / Retainer",
    defaults: { defaultBillingRounding: "none", paymentTerms: "שוטף+30", preferredPdfTemplate: "modern", suggestedBillingModel: "hourly" },
  },
  {
    id: "designer",
    labelHe: "מעצב גרפי / UX",
    labelEn: "Graphic / UX designer",
    modelHintHe: "פרויקט / Fixed",
    modelHintEn: "Project / Fixed",
    defaults: { defaultBillingRounding: "none", paymentTerms: "שוטף+30", preferredPdfTemplate: "modern", suggestedBillingModel: "items" },
  },
  {
    id: "photographer",
    labelHe: "צלם / וידאו",
    labelEn: "Photographer / Video",
    modelHintHe: "Fixed (יום צילום)",
    modelHintEn: "Fixed (shoot day)",
    defaults: { defaultBillingRounding: "none", paymentTerms: "שוטף+30", preferredPdfTemplate: "modern", suggestedBillingModel: "items" },
  },
  {
    id: "writer",
    labelHe: "כותב תוכן / קופירייטר",
    labelEn: "Content writer / Copywriter",
    modelHintHe: "לפי פריט / שעתי",
    modelHintEn: "Per item / Hourly",
    defaults: { defaultBillingRounding: "none", paymentTerms: "שוטף+30", preferredPdfTemplate: "modern", suggestedBillingModel: "items" },
  },
  {
    id: "therapist",
    labelHe: "מטפל / פסיכולוג",
    labelEn: "Therapist / Psychologist",
    modelHintHe: "פגישה 45–50 דק'",
    modelHintEn: "Per session",
    defaults: { defaultBillingRounding: "none", paymentTerms: "מיידי", preferredPdfTemplate: "elegant", suggestedBillingModel: "items" },
  },
  {
    id: "health-pro",
    labelHe: "מטפל בריאות (דיאטן/פיזיו)",
    labelEn: "Health / Wellness Practitioner",
    modelHintHe: "פגישה",
    modelHintEn: "Per session",
    defaults: { defaultBillingRounding: "none", paymentTerms: "מיידי", preferredPdfTemplate: "elegant", suggestedBillingModel: "items" },
  },
  {
    id: "marketer",
    labelHe: "משווק / סושיאל",
    labelEn: "Marketing / Social Media",
    modelHintHe: "ריטיינר חודשי",
    modelHintEn: "Monthly retainer",
    defaults: { defaultBillingRounding: "none", paymentTerms: "שוטף+30", preferredPdfTemplate: "bold", suggestedBillingModel: "retainer" },
  },
  {
    id: "video-editor",
    labelHe: "עורך וידאו",
    labelEn: "Video Editor",
    modelHintHe: "שעתי / פרויקט",
    modelHintEn: "Hourly / Project",
    defaults: { defaultBillingRounding: "none", paymentTerms: "שוטף+30", preferredPdfTemplate: "modern", suggestedBillingModel: "hourly" },
  },
  {
    id: "architect",
    labelHe: "אדריכל / מהנדס",
    labelEn: "Architect / Engineer",
    modelHintHe: "אחוז מהפרויקט",
    modelHintEn: "% of project",
    defaults: { defaultBillingRounding: "none", paymentTerms: "שוטף+30", preferredPdfTemplate: "classic", suggestedBillingModel: "hourly" },
  },
  {
    id: "translator",
    labelHe: "מתרגם",
    labelEn: "Translator",
    modelHintHe: "לפי מילה / עמוד",
    modelHintEn: "Per word / page",
    defaults: { defaultBillingRounding: "none", paymentTerms: "שוטף+30", preferredPdfTemplate: "classic", suggestedBillingModel: "items" },
  },
  {
    id: "tutor",
    labelHe: "מורה פרטי",
    labelEn: "Private Tutor",
    modelHintHe: "שיעור",
    modelHintEn: "Per lesson",
    defaults: { defaultBillingRounding: "none", paymentTerms: "מיידי", preferredPdfTemplate: "modern", suggestedBillingModel: "items" },
  },
  {
    id: "fitness-trainer",
    labelHe: "מאמן כושר",
    labelEn: "Fitness Trainer",
    modelHintHe: "אימון",
    modelHintEn: "Per session",
    defaults: { defaultBillingRounding: "none", paymentTerms: "מיידי", preferredPdfTemplate: "bold", suggestedBillingModel: "items" },
  },
  {
    id: "realtor",
    labelHe: "מתווך נדל\"ן",
    labelEn: "Real-Estate Agent",
    modelHintHe: "עמלה (~2%)",
    modelHintEn: "Commission",
    defaults: { defaultBillingRounding: "none", paymentTerms: "מיידי", preferredPdfTemplate: "classic", suggestedBillingModel: "items" },
  },
  {
    id: "other",
    labelHe: "אחר / כללי",
    labelEn: "Other / General",
    modelHintHe: "—",
    modelHintEn: "—",
    defaults: { defaultBillingRounding: "none", paymentTerms: null, preferredPdfTemplate: "modern", suggestedBillingModel: "hourly" },
  },
];

export function isProfessionId(value: unknown): value is string {
  return typeof value === "string" && PROFESSIONS.some((p) => p.id === value);
}

export function getProfession(id: string | null | undefined): Profession | undefined {
  return PROFESSIONS.find((p) => p.id === id);
}
