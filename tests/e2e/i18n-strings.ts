/**
 * Translated strings asserted by the i18n E2E suite.
 *
 * Each value is copied verbatim from messages/he.json and messages/en.json
 * (the source of truth) and was additionally verified against the LIVE rendered
 * HTML of the running dev server before these tests were written — so an
 * assertion failure here means the UI drifted from the catalog, not a typo.
 *
 * Catalog keys are noted next to each string.
 */
export const STR = {
  he: {
    // Auth.login.title
    loginTitle: "התחבר לחשבון שלך",
    // Landing.hero.headlinePrefix
    landingHeadline: "כל העבודה נרשמת.",
    // Legal.terms.title
    termsTitle: "תנאי שימוש",
    // Legal.privacy.title
    privacyTitle: "מדיניות פרטיות",
    // Legal.accessibility.title
    accessibilityTitle: "הצהרת נגישות",
    // LocaleSwitcher.he
    switcherHe: "עברית",
    // LocaleSwitcher.en
    switcherEn: "English",
    // Nav.dashboard / Nav.settings (authed sidebar)
    navDashboard: "דשבורד",
    navSettings: "הגדרות",
    // Dashboard.pageTitle
    dashboardWelcome: "ברוך הבא!",
  },
  en: {
    loginTitle: "Sign in to your account",
    landingHeadline: "Every job gets logged.",
    termsTitle: "Terms of Service",
    privacyTitle: "Privacy Policy",
    accessibilityTitle: "Accessibility Statement",
    switcherHe: "עברית",
    switcherEn: "English",
    navDashboard: "Dashboard",
    navSettings: "Settings",
    dashboardWelcome: "Welcome!",
  },
} as const;
