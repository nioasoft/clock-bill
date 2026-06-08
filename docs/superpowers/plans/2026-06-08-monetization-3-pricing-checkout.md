# Monetization Plan 3 — Pricing Page, Checkout & Payment Terms

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the user-facing monetization surface — a `/pricing` page with checkout, a billing section in settings (manage subscription via Polar portal), and the payment clauses in the Terms — so users can actually subscribe and the compliance copy is correct.

**Architecture:** A new `GET /api/account/plan` exposes the current plan to the UI. `/pricing` renders the 3 tiers with a monthly/annual toggle (annual default) and calls `authClient.checkout({ slug })` (Plan 2 client plugin) after an EU express-consent gate + MoR disclosure. Settings gains a "billing" tab showing the current plan + "Manage subscription" (`authClient.customer.portal()`). The Plan-1 usage-banner CTA is repointed to `/pricing`. ToS gains the payment clauses (he+en).

**Tech Stack:** Next.js 16 App Router (client components for interactivity), next-intl (he/en), dark ClickHouse theme tokens (no hardcoded colors), RTL-safe logical classes, `authClient` from `@/lib/auth/client`.

**Prereqs:** Plan 2 done (checkout slugs `starter-monthly`/`starter-annual`/`unlimited-monthly`/`unlimited-annual`; `authClient.checkout`/`authClient.customer.portal`; `getUserPlan` in `lib/entitlements.ts`). Prices: Starter $7/mo·$67/yr, Unlimited $14/mo·$134/yr.

---

### Task 1: `GET /api/account/plan` endpoint

**Files:** Create `app/api/account/plan/route.ts`

- [ ] **Step 1:** Create the route:
```ts
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

/** GET /api/account/plan — the authenticated user's current subscription plan. */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
  }
  const { getUserPlan } = await import("@/lib/entitlements");
  const plan = await getUserPlan(user.id);
  return NextResponse.json({
    success: true,
    plan: {
      tier: plan.tier,
      status: plan.status,
      periodEnd: plan.periodEnd,
      founding: plan.founding,
    },
  });
}
```
- [ ] **Step 2:** `npx tsc --noEmit` → clean.
- [ ] **Step 3:** Commit: `git add app/api/account/plan/route.ts && git commit -m "feat(account): GET /api/account/plan endpoint"`

---

### Task 2: Payment clauses in the Terms (he + en + render)

**Files:** `messages/he.json`, `messages/en.json` (`Legal.terms`), `app/[locale]/terms/page.tsx`

Add a `payment` block to `Legal.terms` (after the existing `pricing` block) in BOTH locales. **he.json** keys/content:
```json
      "payment": {
        "heading": "תשלום, חידוש וביטול",
        "processor": "התשלום בתוכניות בתשלום מתבצע באמצעות Polar Software Inc., הפועלת כ-Merchant of Record (המוכר הרשמי). חוזה הרכישה והחיוב נכרת בינך לבין Polar; מוניט מעניקה לך את רישיון השימוש בשירות לפי תנאים אלה. בכל הנוגע לתשלום, חשבונית ומסים — חלים תנאי Polar.",
        "billing": "התוכניות מחויבות במחזור חודשי או שנתי לפי בחירתך, במטבע דולר ארה\"ב, ומתחדשות אוטומטית בתום כל תקופה עד לביטול. המס (VAT/מע\"מ) ייתכן ויתווסף בקופה בהתאם למדינתך, ומנוהל על ידי Polar.",
        "priceChanges": "אנו רשאים לעדכן מחירים או תכניות בעתיד. שינוי מחיר יחול רק לאחר הודעה מוקדמת בנפרד, ובכלל זה הודעה נפרדת בתום תקופת מבצע, ולא תחויב במחיר מעודכן ללא הסכמה.",
        "cancellation": "באפשרותך לבטל את המנוי בכל עת דרך פורטל ניהול המנוי או הגדרות החשבון. הביטול ייכנס לתוקף לכל המאוחר תוך 3 ימי עסקים, לא תחויב עבור תקופה שלאחר מועד הביטול, ותישמר לך הגישה עד תום התקופה ששולמה.",
        "refunds": "החזרים מטופלים על ידי Polar בהתאם למדיניותה ולכללי חברות האשראי, מבלי לגרוע מזכויותיך לפי דין — ובכלל זה זכות ביטול עסקת מכר מרחוק תוך 14 יום והחזר יחסי בעסקה מתמשכת לפי חוק הגנת הצרכן.",
        "downgrade": "עם ביטול או שדרוג-מטה, הנתונים שלך נשמרים: לקוחות מעבר למכסת התוכנית החינמית יישארו לצפייה (לקריאה) ולא יימחקו; לא ניתן יהיה להוסיף לקוחות חדשים עד לירידה מתחת למכסה או חידוש המנוי. ניתן לייצא את הנתונים בכל עת מהגדרות החשבון.",
        "freeTier": "התוכנית החינמית מאפשרת ניהול של לקוח אחד ואינה כרוכה בתשלום. אנו רשאים לשנות את היקף התוכנית החינמית בעתיד, בהודעה מראש."
      },
```
**en.json** equivalent:
```json
      "payment": {
        "heading": "Payment, Renewal and Cancellation",
        "processor": "Payment for paid plans is processed by Polar Software Inc., acting as Merchant of Record (the seller of record). The purchase and billing contract is between you and Polar; Monit licenses the use of the Service to you under these Terms. For payment, invoicing and taxes, Polar's terms apply.",
        "billing": "Paid plans are billed on a monthly or annual cycle of your choosing, in US dollars, and renew automatically at the end of each period until cancelled. Tax (VAT/sales tax) may be added at checkout depending on your country and is handled by Polar.",
        "priceChanges": "We may update prices or plans in the future. A price change will take effect only after separate advance notice (including a separate notice at the end of any promotional period), and you will not be charged an updated price without consent.",
        "cancellation": "You may cancel your subscription at any time via the subscription management portal or your account settings. Cancellation takes effect within 3 business days at the latest; you will not be charged for any period after the cancellation date, and you keep access until the end of the paid period.",
        "refunds": "Refunds are handled by Polar per its policy and card-network rules, without prejudice to your statutory rights — including the 14-day right to cancel a distance sale and a pro-rata refund for an ongoing transaction under Israeli consumer law.",
        "downgrade": "On cancellation or downgrade, your data is preserved: clients beyond the free plan's quota remain visible (read-only) and are not deleted; you will not be able to add new clients until below the quota or re-subscribed. You can export your data at any time from account settings.",
        "freeTier": "The free plan allows managing one client at no charge. We may change the scope of the free plan in the future, with advance notice."
      },
```

- [ ] **Step 1:** Add the `payment` block to both files (after the `pricing` block; valid JSON; he/en parity).
- [ ] **Step 2:** Render it in `app/[locale]/terms/page.tsx` — add a `<section>` after the `pricing` section:
```tsx
      <section>
        <h2>{t("payment.heading")}</h2>
        <p>{t("payment.processor")}</p>
        <p>{t("payment.billing")}</p>
        <p>{t("payment.priceChanges")}</p>
        <p>{t("payment.cancellation")}</p>
        <p>{t("payment.refunds")}</p>
        <p>{t("payment.downgrade")}</p>
        <p>{t("payment.freeTier")}</p>
      </section>
```
- [ ] **Step 3:** Bump `Legal.terms.updated` to `"8 ביוני 2026"` (he) / `"June 8, 2026"` (en).
- [ ] **Step 4:** `npx tsx tests/unit/messages-parity.test.ts` → PASS; `node -e`-validate both JSON files; `npx tsc --noEmit` → clean.
- [ ] **Step 5:** Commit: `git add messages/he.json messages/en.json "app/[locale]/terms/page.tsx" && git commit -m "feat(legal): payment/renewal/cancellation terms (Polar MoR)"`

---

### Task 3: `/pricing` page (tiers, annual toggle, consent gate, checkout)

**Files:** Create `app/[locale]/pricing/page.tsx`; add `Pricing` namespace to `messages/{he,en}.json`.

- [ ] **Step 1:** Add the `Pricing` i18n namespace (he):
```json
  "Pricing": {
    "metaTitle": "תמחור",
    "title": "תוכניות ומחירים",
    "subtitle": "התחילו בחינם. שדרגו כשתצמחו.",
    "monthly": "חודשי",
    "annual": "שנתי",
    "annualSave": "חסכו 20%",
    "perMonth": "/ חודש",
    "perYear": "/ שנה",
    "currentPlan": "התוכנית הנוכחית שלך",
    "manage": "ניהול מנוי",
    "free": { "name": "חינם", "price": "$0", "tagline": "ללקוח אחד", "cta": "התוכנית הנוכחית" },
    "starter": { "name": "Starter", "tagline": "עד 5 לקוחות", "cta": "שדרגו ל-Starter" },
    "unlimited": { "name": "Unlimited", "tagline": "לקוחות ללא הגבלה", "cta": "שדרגו ל-Unlimited" },
    "features": {
      "allFeatures": "כל הפיצ'רים — טיימר, משימות, דוחות PDF, רב-מטבע",
      "clients1": "לקוח אחד",
      "clients5": "עד 5 לקוחות",
      "clientsUnlimited": "לקוחות ללא הגבלה",
      "noLimits": "ללא הגבלת שעות/טיימרים"
    },
    "consent": "אני מבקש/ת לקבל גישה מיידית לשירות ומאשר/ת שאאבד את זכות הביטול בת 14 הימים עם השלמת השירות.",
    "mor": "התשלום מעובד על ידי Polar כ-Merchant of Record; חוזה הרכישה הוא מול Polar. המחיר ב-USD, מתחדש אוטומטית, ניתן לביטול בכל עת.",
    "renews": "מתחדש אוטומטית · ביטול בכל עת",
    "consentRequired": "יש לאשר את ההסכמה כדי להמשיך לתשלום.",
    "checkoutError": "שגיאה בפתיחת התשלום. נסו שוב."
  },
```
en equivalent (mirror keys; English copy):
```json
  "Pricing": {
    "metaTitle": "Pricing",
    "title": "Plans & Pricing",
    "subtitle": "Start free. Upgrade as you grow.",
    "monthly": "Monthly",
    "annual": "Annual",
    "annualSave": "Save 20%",
    "perMonth": "/ mo",
    "perYear": "/ yr",
    "currentPlan": "Your current plan",
    "manage": "Manage subscription",
    "free": { "name": "Free", "price": "$0", "tagline": "For one client", "cta": "Current plan" },
    "starter": { "name": "Starter", "tagline": "Up to 5 clients", "cta": "Upgrade to Starter" },
    "unlimited": { "name": "Unlimited", "tagline": "Unlimited clients", "cta": "Upgrade to Unlimited" },
    "features": {
      "allFeatures": "All features — timer, tasks, PDF reports, multi-currency",
      "clients1": "1 client",
      "clients5": "Up to 5 clients",
      "clientsUnlimited": "Unlimited clients",
      "noLimits": "No limits on hours/timers"
    },
    "consent": "I request immediate access to the service and acknowledge I lose my 14-day right of withdrawal once the service is fully performed.",
    "mor": "Payments are processed by Polar as Merchant of Record; your purchase contract is with Polar. Price in USD, renews automatically, cancel anytime.",
    "renews": "Renews automatically · cancel anytime",
    "consentRequired": "Please accept to continue to checkout.",
    "checkoutError": "Could not open checkout. Please try again."
  },
```

- [ ] **Step 2:** Create `app/[locale]/pricing/page.tsx` (client component). Behavior:
  - Annual/monthly toggle, **annual default**. Prices from a static map: Starter {monthly:"$7", annual:"$67"}, Unlimited {monthly:"$14", annual:"$134"}.
  - Slug map: `${tier}-${interval}` → "starter-monthly" etc.
  - On mount, `fetch("/api/account/plan")` → current tier; mark the user's tier "current"; if a paid tier, show "Manage subscription" → `authClient.customer.portal()`.
  - A single EU express-consent checkbox + MoR disclosure (`mor`, `renews`) shown above the paid CTAs; paid CTA disabled until checked (show `consentRequired` if clicked while unchecked).
  - Paid CTA → `await authClient.checkout({ slug })`; on throw show `checkoutError`.
  - Three cards using theme tokens (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, primary CTA `bg-primary text-primary-foreground`, `rounded-[var(--radius-card)]`). RTL-safe. Each card lists features (Free: clients1+allFeatures+noLimits; Starter: clients5+allFeatures+noLimits; Unlimited: clientsUnlimited+allFeatures+noLimits). Links to ToS + Privacy near the consent.
  - Use `useTranslations("Pricing")`, `Link` from `@/src/i18n/navigation`, `authClient` from `@/lib/auth/client`.
  Reference structure (adapt to existing component conventions; keep it one focused file ~150-200 lines):
```tsx
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { authClient } from "@/lib/auth/client";

type Interval = "monthly" | "annual";
type Tier = "free" | "starter" | "unlimited";
const PRICE: Record<Exclude<Tier, "free">, Record<Interval, string>> = {
  starter: { monthly: "$7", annual: "$67" },
  unlimited: { monthly: "$14", annual: "$134" },
};

export default function PricingPage() {
  const t = useTranslations("Pricing");
  const [interval, setInterval] = useState<Interval>("annual");
  const [consent, setConsent] = useState(false);
  const [currentTier, setCurrentTier] = useState<Tier | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/account/plan").then(r => r.json()).then(d => {
      if (d?.success && d.plan?.tier) setCurrentTier(d.plan.tier as Tier);
    }).catch(() => {});
  }, []);

  async function upgrade(tier: Exclude<Tier, "free">) {
    if (!consent) { setError(t("consentRequired")); return; }
    setBusy(true); setError("");
    try {
      await authClient.checkout({ slug: `${tier}-${interval}` });
    } catch {
      setError(t("checkoutError")); setBusy(false);
    }
  }
  async function manage() { try { await authClient.customer.portal(); } catch { setError(t("checkoutError")); } }

  // ... render: title/subtitle, interval toggle (annual shows annualSave),
  // consent checkbox + mor + renews + ToS/Privacy links, 3 cards.
  // For each paid tier: if currentTier===tier show t("currentPlan") + manage button;
  // else a CTA button calling upgrade(tier), disabled={busy || !consent}.
  // Free card: cta is "current plan" (disabled) when currentTier==='free'.
  return (/* full JSX with theme tokens, RTL-safe */);
}
```
  Also add `generateMetadata`/title using `Pricing.metaTitle` if other `[locale]` pages do (match the privacy/terms page metadata pattern — those are server components; since this page is a client component, either wrap with a small server `page.tsx` exporting metadata + rendering the client component, OR follow how other client pages under `[locale]` handle metadata). Keep it consistent with existing client pages in the repo.

- [ ] **Step 3:** Verify: `npx tsc --noEmit` clean; `npm run lint` zero warnings; parity test PASS; load `/pricing` and `/en/pricing` in dev — renders 4 states (toggle works, consent gates CTA).
- [ ] **Step 4:** Commit: `git add "app/[locale]/pricing/page.tsx" messages/he.json messages/en.json && git commit -m "feat(pricing): pricing page with checkout + EU consent gate"`

---

### Task 4: Repoint the usage-banner CTA to `/pricing`

**Files:** `components/plan-usage-banner.tsx`

- [ ] **Step 1:** Change the upgrade `<Link href="/settings">` to `<Link href="/pricing">`.
- [ ] **Step 2:** `npx tsc --noEmit` clean.
- [ ] **Step 3:** Commit: `git add components/plan-usage-banner.tsx && git commit -m "feat(clients): point usage banner upgrade CTA to /pricing"`

---

### Task 5: Billing section in Settings (current plan + manage)

**Files:** `app/[locale]/settings/page.tsx`; `messages/{he,en}.json` (`Settings`)

The settings page has a tabs state: `"profile" | "security" | "currencies" | "notifications"`. Add a `"billing"` tab.

- [ ] **Step 1:** Add `Settings.billing` i18n (he): `{ "tabLabel": "חיוב", "heading": "תוכנית ומנוי", "currentPlan": "התוכנית הנוכחית", "tierFree": "חינם", "tierStarter": "Starter", "tierUnlimited": "Unlimited", "manage": "ניהול מנוי", "viewPlans": "צפייה בתוכניות", "renewsOn": "מתחדש בתאריך {date}", "founding": "חבר מייסד — גישה מלאה" }`. en mirror: `{ "tabLabel": "Billing", "heading": "Plan & Subscription", "currentPlan": "Current plan", "tierFree": "Free", "tierStarter": "Starter", "tierUnlimited": "Unlimited", "manage": "Manage subscription", "viewPlans": "View plans", "renewsOn": "Renews on {date}", "founding": "Founding member — full access" }`.
- [ ] **Step 2:** Add `"billing"` to the `activeTab` union + the tab list (follow the existing tab-rendering pattern in the file — read it). Add a billing tab panel that: fetches `/api/account/plan`, shows the current tier label (founding → `founding` line), a `viewPlans` link to `/pricing`, and for a paid tier a `manage` button → `authClient.customer.portal()`. Use existing settings card/section styling + theme tokens.
- [ ] **Step 3:** Verify: `npx tsc --noEmit` clean; `npm run lint` clean; parity PASS; settings shows the billing tab in he + en.
- [ ] **Step 4:** Commit: `git add "app/[locale]/settings/page.tsx" messages/he.json messages/en.json && git commit -m "feat(settings): billing tab (current plan + manage subscription)"`

---

### Task 6: Full gate

- [ ] `npm test` → all pass (incl. messages-parity). `npx tsc --noEmit && npm run lint` → clean. Commit anything pending.

---

## Self-Review
- **Spec coverage (design spec §5/§6):** `/pricing` with annual default + checkout (Task 3) ✓; MoR disclosure + EU express-consent at checkout (Task 3) ✓; renews/cancel copy (Task 3) ✓; ToS payment clauses incl IL עסקה-מתמשכת §13ד/§13א, refunds, taxes, downgrade/data-retention, free-tier (Task 2) ✓; banner CTA → /pricing (Task 4) ✓; manage-subscription via portal (Tasks 3+5) ✓; current-plan endpoint (Task 1) ✓.
- **Placeholder scan:** Task 3's render JSX is described as a contract + reference skeleton (the implementer completes the standard card markup with the specified tokens/strings) — not a placeholder, since every string, slug, price, behavior, and token is specified. No TODOs.
- **Type consistency:** tiers/intervals/slugs consistent; `/api/account/plan` shape matches what pricing+settings read; i18n keys mirrored he/en.

## Deferred / launch prereqs (after this plan)
Combined **live e2e on a preview deploy** (push branch → register Polar webhook at the preview URL via API → test-mode checkout with 100% discount → verify tier lifts → portal cancel → revoke; also confirms the Turbopack #6845 client path). Then: prod migrations 0016+0017, Polar **Go Live** + live products/token/webhook secret on Vercel, עוסק מורשה + רו"ח, DPA + sub-processor list (Polar) in privacy policy, then merge to main.
