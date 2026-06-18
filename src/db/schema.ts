import {
  pgTable,
  text,
  boolean,
  timestamp,
  date,
  integer,
  bigint,
  real,
  jsonb,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Better Auth tables ─────────────────────────────────────────────
// These back Better Auth (email/password + Google). Application data tables
// (clients/projects/time_entries/...) reference `user.id` via their loose
// `user_id` text columns (no FK). Managed by Better Auth; do not hand-edit rows.
// (The pre-Better-Auth `users`/`sessions`/*_tokens tables were dropped 2026-06-01 —
// see drizzle/0011_drop_legacy_auth_tables.sql.)

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  // Custom field surfaced via Better Auth additionalFields (not user-settable).
  role: text("role").default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("idx_ba_session_user_id").on(table.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_ba_account_user_id").on(table.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_ba_verification_identifier").on(table.identifier)]
);

// Better Auth persistent rate-limit store (storage: "database"). Keyed by
// IP/endpoint, not user — no RLS (like the other BA tables). Column/field names
// must match Better Auth's rateLimit model (id, key, count, lastRequest).
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").unique(),
  count: integer("count"),
  lastRequest: bigint("last_request", { mode: "number" }),
});

// ─── User Profiles ──────────────────────────────────────────────────

export const userProfiles = pgTable("user_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").unique().notNull(),
  businessName: text("business_name"),
  logoUrl: text("logo_url"),
  phone: text("phone"),
  email: text("email"),
  // Legacy single-line address — kept as the denormalized value printed on
  // invoices/reports. The structured street/city below are the edit fields;
  // address is recomposed from them on save (see settings save).
  address: text("address"),
  addressStreet: text("address_street"),
  addressCity: text("address_city"),
  taxId: text("tax_id"),
  website: text("website"),
  // Whether the website is printed on the settlement document/PDF.
  showWebsiteOnDoc: boolean("show_website_on_doc").default(false),
  defaultCurrency: text("default_currency").default("ILS"),
  preferredPdfTemplate: text("preferred_pdf_template").default("modern"),
  // Invoice settings
  invoicePrefix: text("invoice_prefix"),
  nextInvoiceNumber: integer("next_invoice_number"),
  // Per-user counter for charge-document (settlement) numbers.
  nextChargeDocNumber: integer("next_charge_doc_number").notNull().default(1),
  // Per-user counter for item-line reference numbers (time_entries.item_ref).
  nextItemRef: integer("next_item_ref").notNull().default(1),
  paymentTerms: text("payment_terms"),
  // Bank details
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  bankBranch: text("bank_branch"),
  bankSwift: text("bank_swift"),
  // Digital signature
  signatureUrl: text("signature_url"),
  // PDF customization
  pdfPrimaryColor: text("pdf_primary_color").default("#2563EB"),
  pdfAccentColor: text("pdf_accent_color").default("#059669"),
  // Working hours
  workingHours: real("working_hours").default(8),
  // Notification settings
  longTimerEnabled: boolean("long_timer_enabled").default(true),
  longTimerThreshold: integer("long_timer_threshold").default(120),
  dailyReminderEnabled: boolean("daily_reminder_enabled").default(false),
  dailyReminderTime: text("daily_reminder_time").default("09:00"),
  lastReminderDate: date("last_reminder_date"),
  // IANA timezone (e.g. "Asia/Jerusalem") used by the server cron to fire the
  // daily reminder at the user's *local* dailyReminderTime. Sent by the client
  // on push subscribe; defaults to Israel for the existing base.
  timezone: text("timezone").default("Asia/Jerusalem"),
  // Display preferences
  dateFormat: text("date_format").default("DD/MM/YYYY"),
  timeFormat: text("time_format").default("24h"),
  firstDayOfWeek: text("first_day_of_week").default("sunday"),
  // Preferred UI language ('he' | 'en'). Locks the user's language choice
  // server-side (e.g. for transactional emails) beyond the NEXT_LOCALE cookie.
  locale: text("locale").default("he"),
  // Selected UI theme (Theme Set feature). Defaults to the dark theme.
  theme: text("theme").default("dark"),
  // Customizable dashboard layout (which stat cards / sections show, in what
  // order). Shape + validation live in lib/dashboard-widgets.ts. NULL = never
  // customized → the code default (today's layout) is used, so existing users
  // see no change (no backfill).
  dashboardConfig: jsonb("dashboard_config"),
  // ─── Onboarding / billing base (cascade root) ────────────────────────
  // Chosen profession preset id (see lib/professions.ts); NULL = never chose.
  profession: text("profession"),
  // Base hourly rate; new entries fall back to this when client/task have none.
  defaultRate: real("default_rate"),
  // Base billing rounding; clients/projects inherit when their value is NULL.
  defaultBillingRounding: text("default_billing_rounding").notNull().default("none"),
  // Controls the first-run onboarding modal. Backfilled true for existing users.
  onboarded: boolean("onboarded").notNull().default(false),
  // ─── Subscription (Polar) ───────────────────────────────────────────
  // Tier is written by the Polar webhook (Plan 2). Until then everyone is
  // 'free' except accounts flagged `founding` (owner / pre-launch users),
  // which lib/entitlements.ts resolves to 'unlimited'.
  subscriptionTier: text("subscription_tier").default("free"),
  subscriptionStatus: text("subscription_status"),
  subscriptionPeriodEnd: timestamp("subscription_period_end"),
  polarSubscriptionId: text("polar_subscription_id"),
  // Which billing backend owns the active subscription ('polar' today; lets a
  // future provider — e.g. an Israeli gateway — write the same tier columns).
  billingProvider: text("billing_provider").default("polar"),
  founding: boolean("founding").default(false),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  check(
    "user_profiles_default_billing_rounding_check",
    sql`${table.defaultBillingRounding} IN ('none', 'tenth_hour_up', 'quarter_hour_up', 'half_hour_up', 'hour_up')`
  ),
]);

// ─── Clients ────────────────────────────────────────────────────────

export const clients = pgTable(
  "clients",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    defaultRate: real("default_rate"),
    currency: text("currency").default("ILS"),
    // Billing time-rounding policy for hourly lines: 'none' | 'hour_up' | 'half_hour_up'.
    // Applied at billing time (report/charge-doc); never alters the raw worked duration.
    billingRounding: text("billing_rounding").default("none"),
    isRetainer: boolean("is_retainer").default(false),
    retainerHours: real("retainer_hours"),
    retainerMonthlyFee: real("retainer_monthly_fee"),
    overageRate: real("overage_rate"),
    notes: text("notes"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_clients_user_id").on(table.userId),
    index("idx_clients_user_id_is_active").on(table.userId, table.isActive),
    check(
      "clients_billing_rounding_check",
      sql`${table.billingRounding} IS NULL OR ${table.billingRounding} IN ('none', 'tenth_hour_up', 'quarter_hour_up', 'half_hour_up', 'hour_up')`
    ),
  ]
);

// ─── Client Rates (hourly rates + fixed items) ──────────────────────

export const clientRates = pgTable(
  "client_rates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    // 'hourly' => price per hour; 'item' => price per unit (billed by quantity)
    kind: text("kind").notNull().default("hourly"),
    name: text("name").notNull(),
    rate: real("rate").notNull(),
    // Preselected hourly rate for the client; items are never default.
    isDefault: boolean("is_default").notNull().default(false),
    // Per-unit noun for an item rate ("פגישה"/"מילה"). NULL for hourly (implicit "שעה").
    unit: text("unit"),
    // Optional project scoping: NULL => the rate applies to every project of the
    // client; set => offered only on that project. Cascade with the project —
    // time_entries keep their own rate/label snapshot so history is unaffected.
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_client_rates_client_id").on(table.clientId),
    index("idx_client_rates_user_id").on(table.userId),
    index("idx_client_rates_project_id").on(table.projectId),
    check("client_rates_kind_check", sql`${table.kind} IN ('hourly', 'item')`),
  ]
);

// ─── Projects ───────────────────────────────────────────────────────

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").default("active"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    fixedMonthlyEnabled: boolean("fixed_monthly_enabled").default(false).notNull(),
    fixedMonthlyFee: real("fixed_monthly_fee"),
    fixedMonthlyStartDate: date("fixed_monthly_start_date"),
    fixedMonthlyEndDate: date("fixed_monthly_end_date"),
    // Per-project override of the client's hourly time-rounding policy.
    // NULL => inherit the client setting; otherwise 'none' | 'hour_up' | 'half_hour_up'.
    billingRounding: text("billing_rounding"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_projects_user_id").on(table.userId),
    index("idx_projects_client_id").on(table.clientId),
    index("idx_projects_user_id_status").on(table.userId, table.status),
    check(
      "projects_status_check",
      sql`${table.status} IN ('active', 'completed', 'paused', 'archived')`
    ),
    check(
      "projects_billing_rounding_check",
      sql`${table.billingRounding} IS NULL OR ${table.billingRounding} IN ('none', 'tenth_hour_up', 'quarter_hour_up', 'half_hour_up', 'hour_up')`
    ),
  ]
);

// ─── Tasks ──────────────────────────────────────────────────────────

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // Chosen hourly rate. SET NULL on rate delete (snapshot below keeps display).
    rateId: text("rate_id").references(() => clientRates.id, { onDelete: "set null" }),
    rate: real("rate"), // ₪/hour snapshot at assignment
    rateLabel: text("rate_label"), // rate name snapshot
    title: text("title").notNull(),
    notes: text("notes"),
    status: text("status").notNull().default("todo"),
    priority: text("priority").notNull().default("normal"),
    dueDate: date("due_date"),
    position: real("position").notNull().default(1000),
    tags: jsonb("tags").notNull().default([]),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_tasks_project_id").on(table.projectId),
    index("idx_tasks_user_id").on(table.userId),
    index("idx_tasks_user_status_position").on(table.userId, table.status, table.position),
    check("tasks_status_check", sql`${table.status} IN ('todo', 'in_progress', 'done')`),
    check("tasks_priority_check", sql`${table.priority} IN ('normal', 'high', 'urgent')`),
  ]
);

// ─── Time Entries ───────────────────────────────────────────────────

export const timeEntries = pgTable(
  "time_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => tasks.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    startTime: timestamp("start_time"),
    endTime: timestamp("end_time"),
    duration: integer("duration").default(0),
    date: date("date").notNull(),
    tags: jsonb("tags").default([]),
    notes: text("notes"),
    isBillable: boolean("is_billable").default(true),
    pausedAt: timestamp("paused_at"),
    totalPausedTime: integer("total_paused_time").default(0),
    // Set by the notifications cron when a long-timer push was sent for this
    // running entry, so the alert fires once (not on every cron tick). NULL =
    // not yet notified; naturally NULL for new entries.
    longTimerNotifiedAt: timestamp("long_timer_notified_at"),
    // Per-line billing snapshot (immune to later edits of client_rates).
    rate: real("rate"), // ₪/hour for hourly lines, ₪/unit for item lines
    rateLabel: text("rate_label"), // the rate/item name at log time
    unit: text("unit"), // item unit-noun snapshot at log time (mirrors rate_label)
    billingKind: text("billing_kind"), // 'hourly' | 'item'; NULL => legacy hourly
    quantity: real("quantity"), // units for an item line; ignored for hourly
    // FK to the charge document this entry was settled into (NULL => unbilled).
    // Plain text column — the real FK is created in SQL (avoids a definition cycle).
    chargeDocumentId: text("charge_document_id"),
    // Per-user monotonic reference number ("אסמכתא"), set ONLY on item lines at
    // creation (NULL for hourly). Stable, never reused — see user_profiles.next_item_ref.
    itemRef: integer("item_ref"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_time_entries_user_id").on(table.userId),
    index("idx_time_entries_project_id").on(table.projectId),
    index("idx_time_entries_task_id").on(table.taskId),
    index("idx_time_entries_date").on(table.date),
    index("idx_time_entries_user_id_date").on(table.userId, table.date),
    index("idx_time_entries_user_project").on(table.userId, table.projectId, table.date),
    // Partial index for billable aggregates — see drizzle/0010_time_entries_perf_indexes.sql.
    index("idx_time_entries_user_date_billable")
      .on(table.userId, table.date)
      .where(sql`${table.isBillable} = TRUE`),
    // NOTE: a covering index `idx_time_entries_user_date_covering` on
    // (user_id, date) INCLUDE (duration, is_billable, project_id) also exists in
    // the DB, created out-of-band via psql (Drizzle 0.45 can't express INCLUDE).
    // It lets dashboard/report aggregates skip the heap fetch. Keep it when
    // running db:push — see drizzle/0008_time_entries_covering_index.sql.
    // NON-unique: multiple concurrent running timers per user are allowed.
    // Keeps the partial predicate so the running-timer lookup stays index-backed.
    index("idx_running_timers_per_user")
      .on(table.userId)
      .where(sql`${table.startTime} IS NOT NULL AND ${table.endTime} IS NULL`),
    // SCALE NOTE (not yet created — deliberately deferred): the clients list
    // (app/api/clients/route.ts) aggregates SUM(duration)/SUM(is_billable) over
    // ALL of a user's entries via clients⟕projects⟕time_entries on every load.
    // If a single user ever accumulates tens of thousands of entries and that
    // endpoint slows, add a covering index out-of-band (Drizzle 0.45 can't
    // express INCLUDE — mirror drizzle/0008):
    //   CREATE INDEX CONCURRENTLY idx_time_entries_project_billing
    //     ON time_entries (project_id) INCLUDE (duration, is_billable);
    // Measured 2026-06-13: dev=12, prod=39 rows → seq-scan, index would be
    // unused. Don't add it before the data justifies it.
    index("idx_time_entries_charge_document_id").on(table.chargeDocumentId),
    index("idx_time_entries_user_unbilled")
      .on(table.userId, table.projectId)
      .where(sql`${table.chargeDocumentId} IS NULL AND ${table.isBillable} = TRUE`),
  ]
);

// ─── Custom Tags ────────────────────────────────────────────────────

export const customTags = pgTable(
  "custom_tags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    color: text("color"),
    isDefault: boolean("is_default").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique().on(table.userId, table.name),
    index("idx_custom_tags_user_id").on(table.userId),
  ]
);

// (Legacy `password_reset_tokens` / `email_verification_tokens` tables were
// dropped 2026-06-01 — Better Auth uses its own `verification` table. See
// drizzle/0011_drop_legacy_auth_tables.sql.)

// ─── Report Presets ─────────────────────────────────────────────────

export const reportPresets = pgTable(
  "report_presets",
  {
    id: text("id").primaryKey(),
    // Loose text ref to the Better Auth user.id (no FK — matches the other app
    // tables). The old FK to the legacy `users` table was dropped 2026-06-01;
    // because that table was empty it had silently blocked all preset inserts.
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    clientId: text("client_id"),
    projectId: text("project_id"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_report_presets_user_id").on(table.userId)]
);

// ─── Currency Rates ─────────────────────────────────────────────────

export const currencyRates = pgTable(
  "currency_rates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    fromCurrency: text("from_currency").notNull(),
    toCurrency: text("to_currency").notNull(),
    rate: real("rate").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique().on(table.userId, table.fromCurrency, table.toCurrency),
    index("idx_currency_rates_user_id").on(table.userId),
  ]
);

// ─── Charge Documents (internal settlement) ─────────────────────────

export const chargeDocuments = pgTable(
  "charge_documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    docNumber: integer("doc_number").notNull(),
    status: text("status").notNull().default("pending"),
    currency: text("currency").notNull().default("ILS"),
    total: real("total"),
    notes: text("notes"),
    pdfTemplate: text("pdf_template"),
    issuedAt: timestamp("issued_at"),
    paidAt: timestamp("paid_at"),
    canceledAt: timestamp("canceled_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique().on(table.userId, table.docNumber),
    index("idx_charge_documents_user_id").on(table.userId),
    index("idx_charge_documents_user_id_client_id").on(table.userId, table.clientId),
    index("idx_charge_documents_user_id_status").on(table.userId, table.status),
    check(
      "charge_documents_status_check",
      sql`${table.status} IN ('pending', 'paid', 'canceled')`
    ),
  ]
);

export const chargeDocumentLines = pgTable(
  "charge_document_lines",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => chargeDocuments.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    timeEntryId: text("time_entry_id").references(() => timeEntries.id, {
      onDelete: "set null",
    }),
    periodMonth: text("period_month"),
    label: text("label").notNull(),
    description: text("description"),
    notes: text("notes"),
    itemRef: integer("item_ref"),
    billingKind: text("billing_kind"),
    quantity: real("quantity"),
    unit: text("unit"), // item unit-noun snapshot at issue time
    rate: real("rate"),
    amount: real("amount"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_charge_document_lines_document_id").on(table.documentId),
    index("idx_charge_document_lines_user_id").on(table.userId),
    index("idx_charge_document_lines_time_entry_id").on(table.timeEntryId),
    check(
      "charge_document_lines_source_type_check",
      sql`${table.sourceType} IN ('time_entry', 'fixed_monthly', 'retainer')`
    ),
    check(
      "charge_document_lines_period_month_check",
      sql`${table.periodMonth} IS NULL OR ${table.periodMonth} ~ '^\\d{4}-\\d{2}$'`
    ),
  ]
);

// ─── Web Push subscriptions ─────────────────────────────────────────
// One row per browser/device push endpoint a user has granted. The endpoint is
// globally unique (re-subscribing the same browser upserts). User-scoped → RLS
// FORCE-d like the other tenant tables; the notifications cron reads across all
// users via the privileged adminQuery() connection (bypasses RLS).
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_push_subscriptions_user_id").on(table.userId)]
);
