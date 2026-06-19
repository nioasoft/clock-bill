/**
 * Trial lifecycle email templates (bilingual he/en). Each returns the subject
 * and full HTML, built from the shared light-theme shell in lib/email.ts.
 */
import { emailLayout, emailButton, type EmailLocale } from "@/lib/email";
import { TRIAL_DAYS } from "@/lib/plans";

/** Day-0 welcome: trial has started, here's what you get. */
export function trialWelcomeEmail(locale: EmailLocale, appUrl: string): { subject: string; html: string } {
  const dashboardUrl = `${appUrl}/dashboard`;
  if (locale === "en") {
    return {
      subject: `Your ${TRIAL_DAYS}-day Unlimited trial has started`,
      html: emailLayout({
        locale,
        heading: "Welcome to ClockBill 🎉",
        bodyHtml:
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">You're on the <strong>Unlimited</strong> plan for the next <strong>${TRIAL_DAYS} days</strong> — track unlimited clients, projects, and reports, no card required.</p>` +
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Add your clients now and see how much time you can bill.</p>` +
          emailButton(dashboardUrl, "Open ClockBill"),
      }),
    };
  }
  return {
    subject: `ה-${TRIAL_DAYS} ימי Unlimited שלך התחילו`,
    html: emailLayout({
      locale,
      heading: "ברוך הבא ל-ClockBill 🎉",
      bodyHtml:
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">אתה על מסלול <strong>Unlimited</strong> ל-<strong>${TRIAL_DAYS} הימים</strong> הקרובים — לקוחות, פרויקטים ודוחות ללא הגבלה, בלי כרטיס אשראי.</p>` +
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">הוסף את הלקוחות שלך עכשיו וראה כמה זמן אתה יכול לחייב.</p>` +
        emailButton(dashboardUrl, "פתח את ClockBill"),
    }),
  };
}
