/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = "owner" | "employee";

export type PaymentMethod = "GPay" | "Cash in Hand" | "Bank Transfer" | "Other";

export interface Organization {
  id: string;
  name: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  organization_id: string;
  name: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string; // Linked to auth user ID
  organization_id: string;
  branch_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  avatar_url?: string;
  avatar_updated_at?: string;
  desk_name?: string;
  phone_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ApprovedUser {
  id: string;
  organization_id: string;
  branch_id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  invited_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceCategory {
  id: string;
  organization_id: string;
  category_name: string; // Keep as alias/fallback for service_name
  service_name: string;   // Primary service name
  service_code?: string;
  description?: string;
  default_rate: number;
  minimum_rate?: number;
  maximum_rate?: number;
  is_active: boolean;
  display_order: number;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export type Service = ServiceCategory;

export interface ServiceRateHistory {
  id: string;
  organization_id: string;
  service_id: string;
  old_rate: number | null;
  new_rate: number;
  changed_by: string;
  changed_at: string;
}

export interface ExpenseCategory {
  id: string;
  organization_id: string;
  category_name: string;
  description?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface IncomeEntry {
  id: string;
  organization_id: string;
  branch_id: string;
  employee_id: string; // ID of the profile who earned/recorded
  customer_name: string;
  service_category_id: string;
  payment_method: "GPay" | "Cash in Hand";
  service_rate: number;
  transaction_date: string; // ISO Date String or YYYY-MM-DD
  notes?: string;
  created_by: string; // Profile ID of the creator
  created_at: string;
  updated_at: string;
  deleted_at?: string | null; // For soft delete
  
  // New service-specific fields for dynamic and override tracking
  service_id?: string;
  service_name_snapshot?: string;
  listed_rate?: number;
  charged_rate?: number;
  rate_overridden?: boolean;
  rate_override_reason?: string;
}

export interface ExpenseEntry {
  id: string;
  organization_id: string;
  branch_id: string;
  employee_id: string;
  expense_category_id: string;
  description: string;
  amount: number;
  payment_method: PaymentMethod;
  transaction_date: string;
  receipt_url?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null; // For soft delete
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string; // Profile ID who performed action
  action: string; // "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT"
  entity_type: string; // "income_entries" | "expense_entries" | "profiles" | "settings"
  entity_id: string;
  old_values?: string; // JSON string representation
  new_values?: string; // JSON string representation
  created_at: string;
}

export interface AppSettings {
  id: string;
  organization_id: string;
  allow_employee_editing: boolean;
  employee_editing_limit_hours: number;
  require_expense_receipt: boolean;
  allow_employee_rate_override?: boolean;
  created_at: string;
  updated_at: string;
}

// Client Auth Session State
export interface AuthState {
  user: Profile | null;
  loading: boolean;
  error?: string | null;
}
