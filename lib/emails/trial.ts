/**
 * Trial lifecycle email templates (bilingual he/en). Each returns the subject
 * and full HTML, built from the shared light-theme shell in lib/email.ts.
 */
import { emailLayout, emailButton, type EmailLocale } from "@/lib/email";
import { TRIAL_DAYS } from "@/lib/plans";
import type { TrialEmailKey } from "@/lib/trial-emails-schedule";

/** Shared opts type for all lifecycle emails. */
interface TrialEmailOpts {
  appUrl: string;
  daysLeft?: number;
  lockedCount?: number;
}

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

/** Day-3 onboarding: nudge to add clients. */
export function trialDay3Email(
  locale: EmailLocale,
  opts: TrialEmailOpts,
): { subject: string; html: string } {
  const clientsUrl = `${opts.appUrl}/clients`;
  if (locale === "en") {
    return {
      subject: "Have you added your clients yet?",
      html: emailLayout({
        locale,
        heading: "Time to add your first client",
        bodyHtml:
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">You've been on ClockBill for a few days — have you set up your clients and projects yet?</p>` +
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Once they're in, you can start the timer with one tap and always know exactly how many hours each client owes you.</p>` +
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">It takes less than two minutes to get your first client running.</p>` +
          emailButton(clientsUrl, "Add my clients"),
      }),
    };
  }
  return {
    subject: "הוספת כבר את הלקוחות שלך?",
    html: emailLayout({
      locale,
      heading: "זה הזמן להוסיף את הלקוח הראשון",
      bodyHtml:
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">עברו כמה ימים מאז שהצטרפת ל-ClockBill — הגדרת כבר את הלקוחות והפרויקטים שלך?</p>` +
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">ברגע שהם בפנים, תוכל להפעיל טיימר בלחיצה אחת ולדעת בדיוק כמה שעות כל לקוח חייב לך.</p>` +
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">לוקח פחות משתי דקות להכניס את הלקוח הראשון.</p>` +
        emailButton(clientsUrl, "הוסף לקוחות"),
    }),
  };
}

/** Day-7 mid-trial: remind of the full value they're getting. */
export function trialDay7Email(
  locale: EmailLocale,
  opts: TrialEmailOpts,
): { subject: string; html: string } {
  const dashboardUrl = `${opts.appUrl}/dashboard`;
  if (locale === "en") {
    return {
      subject: "You're halfway through your Unlimited trial",
      html: emailLayout({
        locale,
        heading: "One week in — how's it going?",
        bodyHtml:
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">You're halfway through your <strong>${TRIAL_DAYS}-day Unlimited trial</strong>. This is a good moment to check in.</p>` +
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">During your trial you have access to <strong>unlimited clients, projects, and detailed reports</strong> — the same features that help freelancers bill accurately and get paid faster.</p>` +
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Head to your dashboard and see what you've tracked so far — you might be surprised by the numbers.</p>` +
          emailButton(dashboardUrl, "Open my dashboard"),
      }),
    };
  }
  return {
    subject: `עברה שבוע — איך ה-${TRIAL_DAYS} ימים שלך מתקדמים?`,
    html: emailLayout({
      locale,
      heading: "שבוע ב-ClockBill — הגיע הזמן לבדוק",
      bodyHtml:
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">עברה שבוע מה-Unlimited Trial שלך, וחצי הדרך מאחוריך.</p>` +
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">בתקופת הניסיון יש לך גישה ל<strong>לקוחות, פרויקטים ודוחות ללא הגבלה</strong> — בדיוק הכלים שעוזרים לפרילנסרים לחייב בצורה מדויקת ולקבל תשלום מהר יותר.</p>` +
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">כנס לדאשבורד וראה כמה שעות כבר תיעדת — ייתכן שהמספרים יפתיעו אותך.</p>` +
        emailButton(dashboardUrl, "פתח את הדאשבורד"),
    }),
  };
}

/** Day-11 loss aversion: daysLeft remaining, nudge to pricing. */
export function trialDay11Email(
  locale: EmailLocale,
  opts: TrialEmailOpts,
): { subject: string; html: string } {
  const pricingUrl = `${opts.appUrl}/pricing`;
  const daysLeft = opts.daysLeft ?? 3;
  if (locale === "en") {
    return {
      subject: `${daysLeft} days left in your Unlimited trial`,
      html: emailLayout({
        locale,
        heading: `${daysLeft} days left — here's what you'll keep`,
        bodyHtml:
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Your Unlimited trial ends in <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong>. Here's what happens when it does:</p>` +
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">All your time entries, reports, and project data stay safe — nothing is deleted. If you don't upgrade, the account moves to the free tier, where you can track <strong>1 active client</strong>.</p>` +
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Upgrade now to keep unlimited clients and access everything you've built during the trial.</p>` +
          emailButton(pricingUrl, "See plans"),
      }),
    };
  }
  return {
    subject: `נשארו ${daysLeft} ימים ב-Unlimited Trial שלך`,
    html: emailLayout({
      locale,
      heading: `${daysLeft} ימים אחרונים — מה ישאר איתך`,
      bodyHtml:
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">ה-Unlimited Trial שלך מסתיים בעוד <strong>${daysLeft} יום${daysLeft === 1 ? "" : "ים"}</strong>. הנה מה שיקרה:</p>` +
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">כל רשומות הזמן, הדוחות והנתונים שלך נשארים — שום דבר לא נמחק. אם לא תעבור לתוכנית בתשלום, החשבון יעבור לחינמי עם <strong>לקוח פעיל אחד</strong>.</p>` +
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">שדרג עכשיו כדי לשמור על כל הלקוחות והגישה לכל מה שבנית בניסיון.</p>` +
        emailButton(pricingUrl, "ראה תוכניות"),
    }),
  };
}

/** Day-14 trial ended: conversion email, data-is-safe reassurance. */
export function trialEndedEmail(
  locale: EmailLocale,
  opts: TrialEmailOpts,
): { subject: string; html: string } {
  const pricingUrl = `${opts.appUrl}/pricing`;
  const lockedCount = opts.lockedCount ?? 0;
  if (locale === "en") {
    return {
      subject: "Your trial ended — your data is safe",
      html: emailLayout({
        locale,
        heading: "Your Unlimited trial has ended",
        bodyHtml:
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Your ${TRIAL_DAYS}-day trial is over. <strong>All your data is safe</strong> — every time entry, report, and project is still there.</p>` +
          (lockedCount > 0
            ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Right now, <strong>${lockedCount} client${lockedCount === 1 ? "" : "s"}</strong> ${lockedCount === 1 ? "is" : "are"} locked. You'll need to upgrade to access them and add new ones.</p>`
            : `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Upgrade to unlock full access to your clients and keep growing.</p>`) +
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Pick a plan that fits your workload — no annual commitment required.</p>` +
          emailButton(pricingUrl, "Unlock everything"),
      }),
    };
  }
  return {
    subject: "ה-Trial הסתיים — הנתונים שלך בטוחים",
    html: emailLayout({
      locale,
      heading: "תקופת הניסיון הסתיימה",
      bodyHtml:
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">ה-${TRIAL_DAYS} ימי הניסיון שלך הסתיימו. <strong>כל הנתונים שלך בטוחים</strong> — כל רשומות הזמן, הדוחות והפרויקטים עדיין שם.</p>` +
        (lockedCount > 0
          ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">כרגע <strong>${lockedCount} לקוח${lockedCount === 1 ? "" : "ות"}</strong> נעול${lockedCount === 1 ? "" : "ים"}. כדי לגשת אליהם ולהוסיף חדשים תצטרך לשדרג.</p>`
          : `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">שדרג כדי לפתוח גישה מלאה ללקוחות ולהמשיך לצמוח.</p>`) +
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">בחר תוכנית שמתאימה לעומס העבודה שלך — ללא התחייבות שנתית.</p>` +
        emailButton(pricingUrl, "פתח הכל"),
    }),
  };
}

/** Day-17 winback: final nudge for users who haven't converted. */
export function trialWinbackEmail(
  locale: EmailLocale,
  opts: TrialEmailOpts,
): { subject: string; html: string } {
  const pricingUrl = `${opts.appUrl}/pricing`;
  if (locale === "en") {
    return {
      subject: "Still want your clients back?",
      html: emailLayout({
        locale,
        heading: "We're keeping the door open",
        bodyHtml:
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">A few days ago your Unlimited trial ended. Your data is still there, exactly as you left it.</p>` +
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">If you've been busy, no worries — but if you're ready to get back to accurate time tracking and billing, we'd love to have you on board.</p>` +
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">One click to unlock everything you built during your trial.</p>` +
          emailButton(pricingUrl, "Get back in"),
      }),
    };
  }
  return {
    subject: "עדיין רוצה לקבל את הלקוחות שלך בחזרה?",
    html: emailLayout({
      locale,
      heading: "הדלת עדיין פתוחה",
      bodyHtml:
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">לפני כמה ימים הסתיים ה-Unlimited Trial שלך. הנתונים שלך עדיין שם, בדיוק כמו שהשארת אותם.</p>` +
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">אם היית עסוק — אין בעיה. אבל אם אתה מוכן לחזור למעקב שעות ודיוק בחיוב, אנחנו כאן.</p>` +
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">לחיצה אחת ואתה פותח הכל מחדש.</p>` +
        emailButton(pricingUrl, "חזור פנימה"),
    }),
  };
}

/** Dispatcher: map a TrialEmailKey to its template function. */
export function trialEmailFor(
  key: TrialEmailKey,
  locale: EmailLocale,
  opts: TrialEmailOpts,
): { subject: string; html: string } {
  switch (key) {
    case "trial_d3": return trialDay3Email(locale, opts);
    case "trial_d7": return trialDay7Email(locale, opts);
    case "trial_d11": return trialDay11Email(locale, opts);
    case "trial_ended": return trialEndedEmail(locale, opts);
    case "trial_winback": return trialWinbackEmail(locale, opts);
  }
}
