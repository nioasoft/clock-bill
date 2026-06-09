# Profession Presets Expansion — Plan

> Extension of the shipped profession-onboarding feature. NO DB migration (registry data + form prefill only). Research-backed (3 parallel research agents, 2026-06-09).

**Goal:** Add 9 professions so more Israeli freelancers feel supported, and add a `suggestedBillingModel` to each preset that prefills the new-client form (closing the "retainer is built but hidden" gap).

## Decisions (approved)
- Add 9 professions: therapist, health-pro, marketer, video-editor, architect, translator, tutor, fitness-trainer, realtor.
- Add `suggestedBillingModel: 'hourly' | 'retainer' | 'fixed_monthly' | 'items'` to `ProfessionDefaults`; set for all 17 presets.
- Client create form reads `profile.profession` → preset.suggestedBillingModel and **prefills the retainer toggle ON when it's `retainer`** (+ a small "suggested by your profession, you can change it" hint). Other models leave the form at its normal default (hourly/items editor already available). Not part of the rounding cascade — a one-time form seed.

## Registry values (lib/professions.ts)

| id | labelHe | rounding | template | paymentTerms | suggestedBillingModel | modelHint he/en |
|---|---|---|---|---|---|---|
| lawyer | עו"ד | tenth_hour_up | classic | שוטף+30 | hourly | חיוב שעתי / Hourly |
| accountant | רו"ח / יועץ מס | tenth_hour_up | classic | שוטף+30 | retainer | ריטיינר חודשי / Monthly retainer |
| consultant | יועץ עסקי / מאמן | half_hour_up | modern | שוטף+30 | retainer | ריטיינר / שעתי / Retainer / Hourly |
| developer | מפתח תוכנה | none | modern | שוטף+30 | hourly | שעתי / ריטיינר / Hourly / Retainer |
| designer | מעצב גרפי / UX | none | modern | שוטף+30 | items | פרויקט / Fixed / Project / Fixed |
| photographer | צלם / וידאו | none | modern | שוטף+30 | items | Fixed (יום צילום) / Fixed (shoot day) |
| writer | כותב תוכן / קופירייטר | none | modern | שוטף+30 | items | לפי פריט / שעתי / Per item / Hourly |
| **therapist** | מטפל / פסיכולוג | none | elegant | מיידי | items | פגישה 45–50 דק' / Per session |
| **health-pro** | מטפל בריאות (דיאטן/פיזיו) | none | elegant | מיידי | items | פגישה / Per session |
| **marketer** | משווק / סושיאל | none | bold | שוטף+30 | retainer | ריטיינר חודשי / Monthly retainer |
| **video-editor** | עורך וידאו | none | modern | שוטף+30 | hourly | שעתי / פרויקט / Hourly / Project |
| **architect** | אדריכל / מהנדס | none | classic | שוטף+30 | hourly | אחוז מהפרויקט / % of project |
| **translator** | מתרגם | none | classic | שוטף+30 | items | לפי מילה / עמוד / Per word / page |
| **tutor** | מורה פרטי | none | modern | מיידי | items | שיעור / Per lesson |
| **fitness-trainer** | מאמן כושר | none | bold | מיידי | items | אימון / Per session |
| **realtor** | מתווך נדל"ן | none | classic | מיידי | items | עמלה (~2%) / Commission |
| other | אחר / כללי | none | modern | (null) | hourly | (—) |

All `defaultBillingRounding` values are in `ROUNDING_MODES`; all templates are in `KNOWN_TEMPLATES` (modern/classic/bold/elegant/nature/ocean).

## Tasks
- **Task A** — registry + i18n (must ship together: modal renders `t(professions.<id>)`).
  - `lib/professions.ts`: add `suggestedBillingModel` to `ProfessionDefaults`; set on all 8 existing; add the 9 new records.
  - `messages/{he,en}.json`: add `Onboarding.professions.<id>` for the 9 new ids (parity).
  - `tests/unit/professions.test.ts`: assert `>=17` professions; every preset's `suggestedBillingModel ∈ {hourly,retainer,fixed_monthly,items}`.
- **Task B** — client-form retainer prefill.
  - `app/[locale]/clients/page.tsx`: fetch `profile.profession` (GET /api/profile, key `data.profile.profession`), look up `getProfession(id)?.defaults.suggestedBillingModel`; when `'retainer'` and creating a NEW client (not editing), default `isRetainer=true` so the retainer fields show. Add a subtle hint near the toggle ("מומלץ לפי המקצוע שלך — אפשר לשנות"). Design tokens only; don't break the edit flow (only prefill on the new-client path, and only when the user hasn't explicitly toggled).
  - Add the hint label to `messages/{he,en}.json` (parity).

## Verify
tsc + lint + npm test (incl messages-parity + professions registry) + build. In-browser: onboarding shows the new cards legibly (light theme); creating a client as a "retainer" profession prefills the retainer toggle.

## Out of scope (logged for later)
`unit` label on client_rates; per-profession starter tags/sample data; `session` billing kind (the real per-session fix); Israeli business-status (עוסק פטור/מורשה) onboarding axis.
