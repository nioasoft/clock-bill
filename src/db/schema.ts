import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// User Profile Table
export const userProfile = sqliteTable('user_profile', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  businessName: text('business_name'),
  logoUrl: text('logo_url'),
  phone: text('phone'),
  address: text('address'),
  taxId: text('tax_id'),
  defaultCurrency: text('default_currency').default('ILS').notNull(),
  preferredPdfTemplate: text('preferred_pdf_template').default('modern').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Clients Table
export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  defaultRate: real('default_rate'),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Projects Table
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  clientId: text('client_id').notNull(),
  name: text('name').notNull(),
  pricingModel: text('pricing_model').notNull(), // 'hourly', 'package', 'mixed'
  hourlyRate: real('hourly_rate'),
  packagePrice: real('package_price'),
  packageHours: real('package_hours'),
  overageRate: real('overage_rate'),
  currency: text('currency').default('ILS').notNull(),
  status: text('status').default('active').notNull(), // 'active', 'completed', 'paused'
  startDate: integer('start_date', { mode: 'timestamp' }),
  endDate: integer('end_date', { mode: 'timestamp' }),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Time Entries Table
export const timeEntries = sqliteTable('time_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  projectId: text('project_id').notNull(),
  description: text('description').notNull(),
  startTime: integer('start_time', { mode: 'timestamp' }),
  endTime: integer('end_time', { mode: 'timestamp' }),
  duration: integer('duration').notNull(), // in minutes
  date: integer('date', { mode: 'timestamp' }).notNull(),
  tags: text('tags', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  notes: text('notes'),
  isBillable: integer('is_billable', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Rate Overrides Table
export const rateOverrides = sqliteTable('rate_overrides', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  tag: text('tag').notNull(),
  rate: real('rate').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Custom Tags Table
export const customTags = sqliteTable('custom_tags', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  color: text('color'),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

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
