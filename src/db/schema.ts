import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  serial
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase Auth UID
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  currency: text("currency").notNull().default("INR"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const branches = pgTable("branches", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(), // Profile ID
  organizationId: text("organization_id").notNull(),
  branchId: text("branch_id").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(), // 'owner' | 'employee'
  isActive: boolean("is_active").notNull().default(true),
  avatarUrl: text("avatar_url"),
  avatarUpdatedAt: text("avatar_updated_at"),
  deskName: text("desk_name"),
  phoneNumber: text("phone_number"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const approvedUsers = pgTable("approved_users", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  branchId: text("branch_id").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  invitedBy: text("invited_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const serviceCategories = pgTable("service_categories", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  categoryName: text("category_name").notNull(),
  serviceName: text("service_name").notNull(),
  serviceCode: text("service_code"),
  description: text("description"),
  defaultRate: numeric("default_rate").notNull(),
  minimumRate: numeric("minimum_rate"),
  maximumRate: numeric("maximum_rate"),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const serviceRateHistory = pgTable("service_rate_history", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  serviceId: text("service_id").notNull(),
  oldRate: numeric("old_rate"),
  newRate: numeric("new_rate").notNull(),
  changedBy: text("changed_by").notNull(),
  changedAt: text("changed_at").notNull(),
});

export const expenseCategories = pgTable("expense_categories", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  categoryName: text("category_name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const incomeEntries = pgTable("income_entries", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  branchId: text("branch_id").notNull(),
  employeeId: text("employee_id").notNull(),
  customerName: text("customer_name").notNull(),
  serviceCategoryId: text("service_category_id").notNull(),
  paymentMethod: text("payment_method").notNull(),
  serviceRate: numeric("service_rate").notNull(),
  transactionDate: text("transaction_date").notNull(),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
  serviceId: text("service_id"),
  serviceNameSnapshot: text("service_name_snapshot"),
  listedRate: numeric("listed_rate"),
  chargedRate: numeric("charged_rate"),
  rateOverridden: boolean("rate_overridden"),
  rateOverrideReason: text("rate_override_reason"),
});

export const expenseEntries = pgTable("expense_entries", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  branchId: text("branch_id").notNull(),
  employeeId: text("employee_id").notNull(),
  expenseCategoryId: text("expense_category_id").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount").notNull(),
  paymentMethod: text("payment_method").notNull(),
  transactionDate: text("transaction_date").notNull(),
  receiptUrl: text("receipt_url"),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  oldValues: text("old_values"),
  newValues: text("new_values"),
  createdAt: text("created_at").notNull(),
});

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  allowEmployeeEditing: boolean("allow_employee_editing").notNull().default(true),
  employeeEditingLimitHours: integer("employee_editing_limit_hours").notNull().default(24),
  requireExpenseReceipt: boolean("require_expense_receipt").notNull().default(false),
  allowEmployeeRateOverride: boolean("allow_employee_rate_override").default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
