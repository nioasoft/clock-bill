import {
  pgTable,
  text,
  boolean,
  timestamp,
  date,
  integer,
  real,
  jsonb,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Users ──────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").default(false),
  role: text("role").default("user"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Sessions ───────────────────────────────────────────────────────

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").unique().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_sessions_user_id").on(table.userId),
    index("idx_sessions_token").on(table.token),
  ]
);

// ─── User Profiles ──────────────────────────────────────────────────

export const userProfiles = pgTable("user_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").unique().notNull(),
  businessName: text("business_name"),
  logoUrl: text("logo_url"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  taxId: text("tax_id"),
  website: text("website"),
  defaultCurrency: text("default_currency").default("ILS"),
  preferredPdfTemplate: text("preferred_pdf_template").default("modern"),
  // Invoice settings
  invoicePrefix: text("invoice_prefix"),
  nextInvoiceNumber: integer("next_invoice_number"),
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
  // Display preferences
  dateFormat: text("date_format").default("DD/MM/YYYY"),
  timeFormat: text("time_format").default("24h"),
  firstDayOfWeek: text("first_day_of_week").default("sunday"),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  ]
);

// ─── Tasks ──────────────────────────────────────────────────────────

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").default("todo"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_tasks_project_id").on(table.projectId),
    index("idx_tasks_user_id").on(table.userId),
    check(
      "tasks_status_check",
      sql`${table.status} IN ('todo', 'in_progress', 'done')`
    ),
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
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_time_entries_user_id").on(table.userId),
    index("idx_time_entries_project_id").on(table.projectId),
    index("idx_time_entries_task_id").on(table.taskId),
    index("idx_time_entries_date").on(table.date),
    index("idx_time_entries_user_id_date").on(table.userId, table.date),
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

// ─── Password Reset Tokens ─────────────────────────────────────────

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").unique().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    used: boolean("used").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_password_reset_tokens_token").on(table.token),
    index("idx_password_reset_tokens_user_id").on(table.userId),
  ]
);

// ─── Email Verification Tokens ──────────────────────────────────────

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").unique().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    used: boolean("used").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_email_verification_tokens_token").on(table.token),
    index("idx_email_verification_tokens_user_id").on(table.userId),
  ]
);

// ─── Report Presets ─────────────────────────────────────────────────

export const reportPresets = pgTable(
  "report_presets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
    baseCurrency: text("base_currency").notNull(),
    targetCurrency: text("target_currency").notNull(),
    rate: real("rate").notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [unique().on(table.baseCurrency, table.targetCurrency)]
);
