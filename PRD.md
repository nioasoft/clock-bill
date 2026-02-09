# שעון ⏱️
## מערכת מעקב שעות עבודה לפרילנסרים
### מסמך אפיון מוצר (PRD)

---

| שדה | ערך |
|-----|-----|
| גרסה | 1.1 |
| תאריך | פברואר 2026 |
| מחבר | אסף |
| סטטוס | טיוטה ראשונה |

---

## 1. סקירה כללית

### רקע

כפרילנסר בתחום הטכנולוגיה והייעוץ, קיים צורך במערכת מעקב שעות עבודה שתומכת באופן מלא בעברית (RTL), מאפשרת מודלי תמחור גמישים (שעתי וחבילות), ומייצרת דוחות מקצועיים בעברית ללקוחות.

הפתרונות הקיימים בשוק אינם תומכים בעברית כראוי ואינם מספקים פירוט בעברית ברמה הנדרשת.

### חזון המוצר

מערכת רב-משתמשית (Multi-tenant) שרצה בענן, מאפשרת לכל פרילנסר לנהל את הלקוחות, הפרויקטים והשעות שלו באופן עצמאי. המערכת תומכת באימות משתמשים, העלאת לוגו אישי, ומייצרת דוחות מקצועיים בעברית עם מגוון עיצובים לבחירה.

### קהל יעד

פרילנסרים ויועצים עצמאיים הפועלים בשוק הישראלי, המנהלים 2-3 לקוחות במקביל ועובדים מהמחשב בבית.

---

## 2. ארכיטקטורה וטכנולוגיה

| רכיב | טכנולוגיה | הערות |
|------|-----------|-------|
| Frontend | Next.js + React + TypeScript | App Router |
| UI | shadcn/ui + Tailwind CSS v4 | RTL מלא, עברית |
| Database (Dev) | SQLite | פיתוח מקומי, פשוט ומהיר |
| Database (Prod) | Neon (PostgreSQL) | Serverless, לפרודקשן |
| ORM | Drizzle | Type-safe, תומך SQLite + PostgreSQL |
| Auth | Better Auth | הרשמה, התחברות, ניהול סשנים |
| File Storage (Dev) | Local filesystem | אחסון מקומי בפיתוח |
| File Storage (Prod) | Vercel Blob | אחסון לוגואים ותמונות |
| Hosting | Vercel | דיפלוי אוטומטי מ-GitHub |
| PDF | React-PDF (@react-pdf/renderer) | רנדור בצד שרת, RTL, 6 טמפלטים |
| Excel | exceljs | ייצוא דוחות ב-Excel |
| Env | `.env` / `.env.local` | הגדרות סביבה (DB URL, Blob token, Auth secret) |

---

## 3. עיצוב (Theme)

המערכת משתמשת ב-shadcn/ui עם ערכת צבעים מותאמת בפורמט OKLCH, תומכת במצב בהיר וכהה.

### צבעים עיקריים

| תפקיד | Light Mode | Dark Mode |
|--------|-----------|-----------|
| Background | `oklch(0.9383 0.0042 236.4993)` | `oklch(0.2598 0.0306 262.6666)` |
| Foreground | `oklch(0.3211 0 0)` | `oklch(0.9219 0 0)` |
| Primary | `oklch(0.6397 0.1720 36.4421)` | `oklch(0.6397 0.1720 36.4421)` |
| Card | `oklch(1.0000 0 0)` | `oklch(0.3106 0.0301 268.6365)` |
| Accent | `oklch(0.9119 0.0222 243.8174)` | `oklch(0.3380 0.0589 267.5867)` |
| Destructive | `oklch(0.6368 0.2078 25.3313)` | `oklch(0.6368 0.2078 25.3313)` |
| Border | `oklch(0.9022 0.0052 247.8822)` | `oklch(0.3843 0.0301 269.7337)` |

### טיפוגרפיה

| סוג | פונט |
|-----|------|
| Sans | Inter |
| Serif | Source Serif 4 |
| Mono | JetBrains Mono |

### הגדרות נוספות

- **Radius:** `0.75rem`
- **Spacing:** `0.25rem`

### קובץ CSS מלא

```css
:root {
  --background: oklch(0.9383 0.0042 236.4993);
  --foreground: oklch(0.3211 0 0);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.3211 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.3211 0 0);
  --primary: oklch(0.6397 0.1720 36.4421);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9670 0.0029 264.5419);
  --secondary-foreground: oklch(0.4461 0.0263 256.8018);
  --muted: oklch(0.9846 0.0017 247.8389);
  --muted-foreground: oklch(0.5510 0.0234 264.3637);
  --accent: oklch(0.9119 0.0222 243.8174);
  --accent-foreground: oklch(0.3791 0.1378 265.5222);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.9022 0.0052 247.8822);
  --input: oklch(0.9700 0.0029 264.5420);
  --ring: oklch(0.6397 0.1720 36.4421);
  --chart-1: oklch(0.7156 0.0605 248.6845);
  --chart-2: oklch(0.7875 0.0917 35.9616);
  --chart-3: oklch(0.5778 0.0759 254.1573);
  --chart-4: oklch(0.5016 0.0849 259.4902);
  --chart-5: oklch(0.4241 0.0952 264.0306);
  --sidebar: oklch(0.9030 0.0046 258.3257);
  --sidebar-foreground: oklch(0.3211 0 0);
  --sidebar-primary: oklch(0.6397 0.1720 36.4421);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9119 0.0222 243.8174);
  --sidebar-accent-foreground: oklch(0.3791 0.1378 265.5222);
  --sidebar-border: oklch(0.9276 0.0058 264.5313);
  --sidebar-ring: oklch(0.6397 0.1720 36.4421);
  --font-sans: Inter, sans-serif;
  --font-serif: Source Serif 4, serif;
  --font-mono: JetBrains Mono, monospace;
  --radius: 0.75rem;
  --spacing: 0.25rem;
}

.dark {
  --background: oklch(0.2598 0.0306 262.6666);
  --foreground: oklch(0.9219 0 0);
  --card: oklch(0.3106 0.0301 268.6365);
  --card-foreground: oklch(0.9219 0 0);
  --popover: oklch(0.2900 0.0249 268.3986);
  --popover-foreground: oklch(0.9219 0 0);
  --primary: oklch(0.6397 0.1720 36.4421);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.3095 0.0266 266.7132);
  --secondary-foreground: oklch(0.9219 0 0);
  --muted: oklch(0.3095 0.0266 266.7132);
  --muted-foreground: oklch(0.7155 0 0);
  --accent: oklch(0.3380 0.0589 267.5867);
  --accent-foreground: oklch(0.8823 0.0571 254.1284);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.3843 0.0301 269.7337);
  --input: oklch(0.3843 0.0301 269.7337);
  --ring: oklch(0.6397 0.1720 36.4421);
  --chart-1: oklch(0.7156 0.0605 248.6845);
  --chart-2: oklch(0.7693 0.0876 34.1875);
  --chart-3: oklch(0.5778 0.0759 254.1573);
  --chart-4: oklch(0.5016 0.0849 259.4902);
  --chart-5: oklch(0.4241 0.0952 264.0306);
  --sidebar: oklch(0.3100 0.0283 267.7408);
  --sidebar-foreground: oklch(0.9219 0 0);
  --sidebar-primary: oklch(0.6397 0.1720 36.4421);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.3380 0.0589 267.5867);
  --sidebar-accent-foreground: oklch(0.8823 0.0571 254.1284);
  --sidebar-border: oklch(0.3843 0.0301 269.7337);
  --sidebar-ring: oklch(0.6397 0.1720 36.4421);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

---

## 4. מודל נתונים

> כל הישויות (למעט User) כוללות שדה `userId` לבידוד נתונים בין משתמשים.

### משתמשים (Users) - Better Auth

Better Auth מנהל את טבלאות המשתמשים (`user`, `session`, `account`, `verification`). בנוסף, נוסיף טבלת פרופיל מורחבת:

### פרופיל משתמש (UserProfile)

| שדה | סוג | תיאור |
|-----|-----|-------|
| id | UUID | מזהה ייחודי |
| userId | string (FK) | שיוך למשתמש Better Auth |
| businessName | string? | שם העסק |
| logoUrl | string? | URL ללוגו (Vercel Blob / local) |
| phone | string? | טלפון עסקי |
| address | string? | כתובת עסקית |
| taxId | string? | מספר עוסק / ח.פ. |
| defaultCurrency | string | ברירת מחדל: `ILS` |
| preferredPdfTemplate | string | טמפלט PDF מועדף (ברירת מחדל: `modern`) |
| createdAt | timestamp | תאריך יצירה |

### לקוחות (Clients)

| שדה | סוג | תיאור |
|-----|-----|-------|
| id | UUID | מזהה ייחודי |
| userId | string (FK) | שיוך למשתמש |
| name | string | שם הלקוח |
| contactName | string? | איש קשר |
| email | string? | דוא"ל |
| phone | string? | טלפון |
| defaultRate | number? | תעריף שעתי ברירת מחדל (₪) |
| notes | text? | הערות |
| isActive | boolean | פעיל/לא פעיל |
| createdAt | timestamp | תאריך יצירה |

### פרויקטים (Projects)

| שדה | סוג | תיאור |
|-----|-----|-------|
| id | UUID | מזהה ייחודי |
| userId | string (FK) | שיוך למשתמש |
| clientId | UUID (FK) | שיוך ללקוח |
| name | string | שם הפרויקט |
| pricingModel | enum | `hourly` / `package` / `mixed` |
| hourlyRate | number? | תעריף שעתי (₪) - לשעתי/מעבר לחבילה |
| packagePrice | number? | מחיר חבילה (₪) |
| packageHours | number? | שעות כלולות בחבילה |
| overageRate | number? | תעריף חריגה מחבילה (₪/שעה) |
| status | enum | `active` / `completed` / `paused` |
| startDate | date? | תאריך התחלה |
| endDate | date? | תאריך סיום |
| notes | text? | הערות |
| createdAt | timestamp | תאריך יצירה |

### רשומות זמן (TimeEntries)

| שדה | סוג | תיאור |
|-----|-----|-------|
| id | UUID | מזהה ייחודי |
| userId | string (FK) | שיוך למשתמש |
| projectId | UUID (FK) | שיוך לפרויקט |
| description | string | תיאור העבודה |
| startTime | timestamp? | שעת התחלה (טיימר) |
| endTime | timestamp? | שעת סיום (טיימר) |
| duration | number | משך בדקות (ידני או מחושב) |
| date | date | תאריך העבודה |
| tags | string[] | תגיות (פיתוח, ייעוץ, תמיכה...) |
| notes | text? | הערות חופשיות |
| isBillable | boolean | ניתן לחיוב |
| createdAt | timestamp | תאריך יצירה |

### תעריפים מיוחדים (RateOverrides)

מאפשר הגדרת תעריפים שונים לסוגי עבודה שונים באותו פרויקט.

| שדה | סוג | תיאור |
|-----|-----|-------|
| id | UUID | מזהה ייחודי |
| projectId | UUID (FK) | שיוך לפרויקט |
| tag | string | סוג העבודה (תגית) |
| rate | number | תעריף שעתי (₪) |

### תגיות (Tags)

המערכת כוללת תגיות בסיס מובנות (system) וכן אפשרות למשתמש להוסיף תגיות מותאמות אישית (user). תגיות המשתמש נשמרות ב-user scope ולא משפיעות על משתמשים אחרים.

| שדה | סוג | תיאור |
|-----|-----|-------|
| id | UUID | מזהה ייחודי |
| userId | string? (FK) | `null` = תגית מערכת, אחרת שיוך למשתמש |
| name | string | שם התגית (עברית) |
| color | string? | צבע לתצוגה (hex) |
| icon | string? | אייקון (emoji או lucide icon name) |
| isSystem | boolean | תגית מערכת (לא ניתנת למחיקה) |
| sortOrder | number | סדר תצוגה |
| createdAt | timestamp | תאריך יצירה |

**תגיות בסיס (System Tags):**

| שם | צבע | תיאור |
|-----|------|-------|
| פיתוח | `#2563EB` | כתיבת קוד, פיתוח פיצ'רים |
| ייעוץ | `#7C3AED` | פגישות ייעוץ, אפיון |
| תמיכה | `#059669` | תמיכה טכנית, תיקון באגים |
| ניהול | `#D97706` | ניהול פרויקט, תיאום |
| עיצוב | `#EC4899` | עיצוב UI/UX |
| אחר | `#6B7280` | כללי |

---

## 5. פיצ'רים ותכולה

### 5.1 מעקב זמן

- **טיימר חי** - לחצן התחל/עצור עם תצוגת זמן שרץ
  - בחירת לקוח ופרויקט לפני התחלת הטיימר
  - אפשרות להוסיף תיאור ותגיות תוך כדי עבודה
- **הזנה ידנית** - הזנת שעות/דקות ידנית עם בחירת תאריך
  - בחירת תאריך מקלנדר
  - הזנת שעת התחלה וסיום או משך ישיר
- **תגיות** - סיווג סוג העבודה. כולל תגיות בסיס מובנות (פיתוח, ייעוץ, תמיכה, ניהול, עיצוב, אחר) + אפשרות למשתמש להוסיף תגיות מותאמות אישית דרך ההגדרות. תגיות המשתמש נשמרות ב-user scope בלבד.
- **הערות חופשיות** - שדה טקסט חופשי לכל רשומת זמן

### 5.2 ניהול לקוחות ופרויקטים

- ניהול לקוחות - הוספה, עריכה, השבתה
- ניהול פרויקטים תחת כל לקוח
- מודל תמחור גמיש לכל פרויקט:
  - **שעתי** - תעריף קבוע לשעה
  - **חבילה** - סכום קבוע עבור X שעות כלולות
  - **משולב** - חבילה בסיסית + תעריף שעתי לחריגות
- תעריפים שונים לפי סוג עבודה (תגית) באותו פרויקט
- מעקב אחרי ניצול שעות מחבילה

### 5.3 פרופיל משתמש והגדרות

- **הרשמה והתחברות** - Better Auth עם email/password
- **פרופיל עסקי** - שם עסק, כתובת, מספר עוסק/ח.פ., טלפון
- **העלאת לוגו** - העלאת תמונת לוגו שתופיע בדוחות PDF
  - Dev: אחסון מקומי (`/uploads`)
  - Prod: Vercel Blob
- **בחירת טמפלט PDF** - ברירת מחדל לעיצוב דוחות (ניתן לשנות גם בעת יצירת דוח)

### 5.4 סיכום חודשי ודשבורד

- דשבורד ראשי עם סיכום היום/השבוע/החודש
- תצוגת שעות לפי לקוח ופרויקט
- מצב חבילה - כמה שעות נוצלו, כמה נותרו, חריגות
- סיכום כספי - סה"כ לחיוב לכל לקוח

### 5.5 דוחות וייצוא

- **דוח PDF בעברית** - 6 טמפלטים לבחירה (ראו סעיף 11), הכולל:
  - לוגו המשתמש (אם הועלה)
  - פרטי העסק (שם, כתובת, ח.פ.)
  - פרטי הלקוח והפרויקט
  - פירוט שעות עבודה (תאריך, משך, תיאור, תגית)
  - סיכום חבילה: שעות כלולות, שעות שנוצלו, חריגה
  - סיכום כספי: סה"כ לתשלום
- **ייצוא Excel/CSV** - נתונים גולמיים לעיבוד נוסף
- סינון לפי טווח תאריכים, לקוח, פרויקט

---

## 6. לוגיקת תמחור

### מודל שעתי (hourly)

חישוב פשוט: **סה"כ שעות × תעריף שעתי**. אם קיימים תעריפים שונים לפי תגית, כל רשומה מחושבת לפי התעריף של התגית שלה.

### מודל חבילה (package)

סכום קבוע (`packagePrice`) עבור מכסת שעות (`packageHours`). ללא חיוב נוסף כל עוד לא חורגים מהמכסה.

### מודל משולב (mixed)

חבילה בסיסית + תעריף חריגה. לדוגמה:
> 4,000₪ עבור 20 שעות כלולות, 250₪ לכל שעה נוספת מעבר.

הדוח מציג: שעות כלולות, שעות שנוצלו, שעות חריגה, עלות חריגה, וסה"כ לתשלום.

---

## 7. עיצוב וחוויית משתמש (UX)

- ממשק מלא בעברית עם RTL מושלם
- עיצוב נקי ומינימלי עם shadcn/ui (ערכת צבעים מותאמת - ראו סעיף 3)
- מצב כהה (Dark Mode)
- רספונסיבי - עובד גם בנייד (עדיפות לדסקטופ)
- טיימר נגיש - תמיד גלוי בראש הדף
- ניווט פשוט: דשבורד / רשומות / לקוחות / דוחות

---

## 8. מבנה דפים (Routes)

| נתיב | דף | תיאור |
|------|-----|-------|
| `/login` | התחברות | כניסה למערכת |
| `/register` | הרשמה | יצירת חשבון חדש |
| `/` | דשבורד | סיכום כללי, טיימר, פעילות אחרונה |
| `/entries` | רשומות זמן | רשימת רשומות, סינון, הוספה ידנית |
| `/clients` | לקוחות | רשימת לקוחות, הוספה ועריכה |
| `/clients/[id]` | פרטי לקוח | פרויקטים, סיכום שעות |
| `/projects/[id]` | פרטי פרויקט | רשומות, מצב חבילה, תעריפים |
| `/reports` | דוחות | יצירת דוחות, סינון, ייצוא PDF/Excel |
| `/settings` | הגדרות | פרופיל עסקי, לוגו, טמפלט PDF, תגיות |

---

## 9. שלבי פיתוח

### שלב 1 - בסיס (MVP)

- הקמת פרויקט Next.js + Drizzle + SQLite (dev)
- **Better Auth** - הרשמה, התחברות, ניהול סשנים
- מודל נתונים ומיגרציות (עם `userId` בכל טבלה)
- פרופיל משתמש בסיסי (שם עסק, לוגו)
- העלאת לוגו (local filesystem בפיתוח)
- ניהול לקוחות ופרויקטים (CRUD)
- הזנת שעות ידנית
- טיימר חי
- ממשק RTL בסיסי עם shadcn/ui
- קובץ `.env` עם הגדרות סביבה

### שלב 2 - תמחור ודוחות

- לוגיקת תמחור (שעתי/חבילה/משולב)
- תעריפים שונים לפי תגית
- דשבורד עם סיכומים
- ייצוא PDF בעברית (React-PDF) עם 6 טמפלטים
- לוגו המשתמש בדוחות
- ייצוא Excel

### שלב 3 - פרודקשן ושיפורים

- מעבר ל-Neon (PostgreSQL) לפרודקשן
- מעבר ל-Vercel Blob לאחסון קבצים
- דיפלוי ל-Vercel
- עיצוב מתקדם ו-Dark Mode
- סינון ומיון מתקדם בדוחות
- גיבוי ושחזור נתונים
- התראות (חריגה מחבילה, סוף חודש)

---

## 10. דוגמת מבנה דוח PDF

| חלק בדוח | תוכן |
|-----------|-------|
| לוגו | לוגו המשתמש (אם הועלה) |
| פרטי העסק | שם עסק, כתובת, ח.פ., טלפון |
| כותרת | דוח שעות עבודה - [שם לקוח] |
| תקופה | חודש/שנה |
| פרטי פרויקט | שם, מודל תמחור, תעריף |
| טבלת פירוט | תאריך · שעות · תיאור · סוג עבודה · סכום |
| סיכום חבילה | שעות כלולות · שעות שנוצלו · חריגה |
| סה"כ | סכום כולל לתשלום |
| הערות | הערות חופשיות |

---

## 11. טמפלטים לדוחות PDF

המערכת מציעה 6 טמפלטים מעוצבים לדוחות PDF. כל הטמפלטים תומכים ב-RTL מלא, לוגו משתמש, וכל מבנה הדוח שלעיל. ההבדל ביניהם הוא בצבעים, טיפוגרפיה, וסגנון עיצובי.

| מזהה | שם | תיאור | צבע ראשי | סגנון |
|------|-----|-------|-----------|-------|
| `modern` | מודרני | קווים נקיים, מינימלי, הרבה רווח לבן | `#2563EB` (כחול) | פס צבעוני עליון, טבלה עם רקע בהיר לכותרות, פינות מעוגלות |
| `classic` | קלאסי | מסורתי ורשמי, מתאים לחשבוניות | `#1A1A1A` (שחור) | מסגרות דקות, כותרות מודגשות, קו הפרדה תחתון, סריף |
| `bold` | בולט | צבעוני ואנרגטי, מתאים ליצירתיים | `#E85D04` (כתום) | כותרות גדולות, בלוקים צבעוניים, הדגשות חזקות |
| `elegant` | אלגנטי | מעודן ויוקרתי, גוון כהה | `#4A5568` (אפור-כחול) | רקע בהיר, קווים דקים, ריווח נדיב, טיפוגרפיה מעודנת |
| `nature` | טבעי | גוונים ירוקים, רענן ונעים | `#059669` (ירוק) | אלמנטים עגולים, רקעים בגוון ירוק בהיר, תחושה אורגנית |
| `ocean` | אוקיינוס | כחול-טורקיז, מקצועי ורגוע | `#0891B2` (טורקיז) | גרדיאנט עדין בכותרת, טבלה עם שורות מתחלפות, נקי |

### תצוגה מקדימה

בעמוד הדוחות (`/reports`) המשתמש יוכל:
- לבחור טמפלט מתוך 6 האפשרויות
- לראות תצוגה מקדימה (Preview) לפני ייצוא
- לשמור טמפלט מועדף כברירת מחדל בהגדרות הפרופיל

---

## 12. משתני סביבה (.env)

```env
# Database
DATABASE_URL=file:./dev.db          # Dev: SQLite
# DATABASE_URL=postgres://...       # Prod: Neon

# Better Auth
BETTER_AUTH_SECRET=your-secret-here
BETTER_AUTH_URL=http://localhost:3000

# File Storage (Prod)
BLOB_READ_WRITE_TOKEN=              # Vercel Blob token

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

*— סוף מסמך —*
