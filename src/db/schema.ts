import { pgTable, text, boolean, real, integer, timestamp, date, jsonb, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// User Profile Table
export const userProfile = pgTable('user_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  businessName: text('business_name'),
  logoUrl: text('logo_url'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  taxId: text('tax_id'),
  website: text('website'),
  defaultCurrency: text('default_currency').default('ILS').notNull(),
  preferredPdfTemplate: text('preferred_pdf_template').default('modern').notNull(),
  invoicePrefix: text('invoice_prefix'),
  nextInvoiceNumber: integer('next_invoice_number'),
  paymentTerms: text('payment_terms'),
  bankName: text('bank_name'),
  bankAccountNumber: text('bank_account_number'),
  bankBranch: text('bank_branch'),
  bankSwift: text('bank_swift'),
  pdfPrimaryColor: text('pdf_primary_color').default('#2563EB'),
  pdfAccentColor: text('pdf_accent_color').default('#059669'),
  // Notification settings
  longTimerEnabled: boolean('long_timer_enabled').default(true).notNull(),
  longTimerThreshold: integer('long_timer_threshold').default(120), // in minutes (2 hours default)
  dailyReminderEnabled: boolean('daily_reminder_enabled').default(false).notNull(),
  dailyReminderTime: text('daily_reminder_time').default('09:00'), // format: HH:MM
  lastReminderDate: date('last_reminder_date'),
  // Working hours setting
  workingHours: real('working_hours').default(8), // hours per day
  // Display format preferences
  dateFormat: text('date_format').default('DD/MM/YYYY').notNull(), // 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'
  timeFormat: text('time_format').default('24h').notNull(), // '12h' or '24h'
  createdAt: timestamp('created_at').default(sql`NOW()`),
  updatedAt: timestamp('updated_at').default(sql`NOW()`),
});

// Clients Table
export const clients = pgTable('clients', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  defaultRate: real('default_rate'),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').default(sql`NOW()`),
  updatedAt: timestamp('updated_at').default(sql`NOW()`),
});

// Projects Table
export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  clientId: text('client_id').notNull(),
  name: text('name').notNull(),
  pricingModel: text('pricing_model').notNull(), // 'hourly', 'package', 'mixed', 'fixed', 'retainer'
  hourlyRate: real('hourly_rate'),
  packagePrice: real('package_price'),
  packageHours: real('package_hours'),
  overageRate: real('overage_rate'),
  fixedBudget: real('fixed_budget'), // For 'fixed' pricing model
  retainerMonthlyFee: real('retainer_monthly_fee'), // For 'retainer' pricing model
  retainerHours: real('retainer_hours'), // For 'retainer' pricing model
  currency: text('currency').default('ILS').notNull(),
  status: text('status').default('active').notNull(), // 'active', 'completed', 'paused'
  startDate: date('start_date'),
  endDate: date('end_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').default(sql`NOW()`),
  updatedAt: timestamp('updated_at').default(sql`NOW()`),
});

// Time Entries Table
export const timeEntries = pgTable('time_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  projectId: text('project_id').notNull(),
  description: text('description').notNull(),
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  duration: integer('duration').notNull(), // in minutes
  date: date('date').notNull(),
  tags: jsonb('tags').$type<string[]>().default(sql`'[]'::jsonb`),
  notes: text('notes'),
  isBillable: boolean('is_billable').default(true).notNull(),
  createdAt: timestamp('created_at').default(sql`NOW()`),
  updatedAt: timestamp('updated_at').default(sql`NOW()`),
});

// Rate Overrides Table
export const rateOverrides = pgTable('rate_overrides', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  tag: text('tag').notNull(),
  rate: real('rate').notNull(),
  createdAt: timestamp('created_at').default(sql`NOW()`),
  updatedAt: timestamp('updated_at').default(sql`NOW()`),
});

// Custom Tags Table
export const customTags = pgTable('custom_tags', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  color: text('color'),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').default(sql`NOW()`),
  updatedAt: timestamp('updated_at').default(sql`NOW()`),
}, (table) => [
  unique().on(table.userId, table.name),
]);

// Currency Conversion Rates Table
export const currencyRates = pgTable('currency_rates', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  fromCurrency: text('from_currency').notNull(), // e.g., 'USD'
  toCurrency: text('to_currency').notNull(), // e.g., 'ILS'
  rate: real('rate').notNull(), // Conversion rate (multiply by this to convert from->to)
  createdAt: timestamp('created_at').default(sql`NOW()`),
  updatedAt: timestamp('updated_at').default(sql`NOW()`),
}, (table) => [
  unique().on(table.userId, table.fromCurrency, table.toCurrency),
]);

// Export types
export type UserProfile = typeof userProfile.$inferSelect;
export type NewUserProfile = typeof userProfile.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;
export type RateOverride = typeof rateOverrides.$inferSelect;
export type NewRateOverride = typeof rateOverrides.$inferInsert;
export type CustomTag = typeof customTags.$inferSelect;
export type NewCustomTag = typeof customTags.$inferInsert;
export type CurrencyRate = typeof currencyRates.$inferSelect;
export type NewCurrencyRate = typeof currencyRates.$inferInsert;
