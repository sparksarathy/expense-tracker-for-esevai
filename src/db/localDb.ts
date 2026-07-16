/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import {
  Organization,
  Branch,
  Profile,
  ApprovedUser,
  ServiceCategory,
  ExpenseCategory,
  IncomeEntry,
  ExpenseEntry,
  AuditLog,
  AppSettings,
  UserRole,
  ServiceRateHistory
} from "../types";

const DB_FILE_PATH = path.join(process.cwd(), "data", "db.json");

interface DatabaseSchema {
  organizations: Organization[];
  branches: Branch[];
  profiles: Profile[];
  approved_users: ApprovedUser[];
  service_categories: ServiceCategory[];
  expense_categories: ExpenseCategory[];
  income_entries: IncomeEntry[];
  expense_entries: ExpenseEntry[];
  audit_logs: AuditLog[];
  app_settings: AppSettings[];
  service_rate_history?: ServiceRateHistory[];
}

let dbCache: DatabaseSchema | null = null;

// Helper to generate UUIDs
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Initialize Database with Seed Data
function getInitialData(): DatabaseSchema {
  const orgId = "88888888-8888-4888-a888-888888888888";
  const branchId = "77777777-7777-4777-a777-777777777777";
  const adminId = "99999999-9999-4999-b999-999999999999";

  const org: Organization = {
    id: orgId,
    name: "e-Sevai Maiyam Main Center",
    logo_url: "",
    address: "12, Kamarajar Street, Near Bus Stand, Madurai, Tamil Nadu - 625001",
    phone: "+91 9876543210",
    email: "contact@esevaimaiyam.in",
    timezone: "Asia/Kolkata",
    currency: "INR",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const branch: Branch = {
    id: branchId,
    organization_id: orgId,
    name: "Madurai Town Branch",
    address: "12, Kamarajar Street, Near Bus Stand, Madurai",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const approvedUsers: ApprovedUser[] = [
    {
      id: generateUUID(),
      organization_id: orgId,
      branch_id: branchId,
      email: "csb21090@gmail.com",
      role: "owner",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      organization_id: orgId,
      branch_id: branchId,
      email: "employee1@esevai.com",
      role: "employee",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      organization_id: orgId,
      branch_id: branchId,
      email: "employee2@esevai.com",
      role: "employee",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      organization_id: orgId,
      branch_id: branchId,
      email: "employee3@esevai.com",
      role: "employee",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      organization_id: orgId,
      branch_id: branchId,
      email: "employee4@esevai.com",
      role: "employee",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Pre-seed owner and employee profiles for frictionless login/simulation
  const profiles: Profile[] = [
    {
      id: "admin-user-id-mock-uuid-key",
      organization_id: orgId,
      branch_id: branchId,
      full_name: "Ganesan (Owner)",
      email: "csb21090@gmail.com",
      role: "owner",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "emp-1-mock-uuid-key",
      organization_id: orgId,
      branch_id: branchId,
      full_name: "Arun Kumar",
      email: "employee1@esevai.com",
      role: "employee",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "emp-2-mock-uuid-key",
      organization_id: orgId,
      branch_id: branchId,
      full_name: "Priya Sharma",
      email: "employee2@esevai.com",
      role: "employee",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "emp-3-mock-uuid-key",
      organization_id: orgId,
      branch_id: branchId,
      full_name: "Karthik Raja",
      email: "employee3@esevai.com",
      role: "employee",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "emp-4-mock-uuid-key",
      organization_id: orgId,
      branch_id: branchId,
      full_name: "Anitha R.",
      email: "employee4@esevai.com",
      role: "employee",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Service categories
  const services = [
    { name: "Aadhaar Update", rate: 100 },
    { name: "PAN Card Service", rate: 150 },
    { name: "Passport Service", rate: 1500 },
    { name: "Voter ID Service", rate: 100 },
    { name: "Income Certificate", rate: 80 },
    { name: "Community Certificate", rate: 80 },
    { name: "Nativity Certificate", rate: 80 },
    { name: "Birth Certificate", rate: 100 },
    { name: "Death Certificate", rate: 100 },
    { name: "Ration Card Service", rate: 120 },
    { name: "Driving Licence Service", rate: 350 },
    { name: "Electricity Bill Payment", rate: 50 },
    { name: "Government Application", rate: 100 },
    { name: "Printing and Scanning", rate: 20 },
    { name: "Other Service", rate: 100 },
  ];

  const serviceCategories: ServiceCategory[] = services.map((s, index) => ({
    id: `service-cat-${index}`,
    organization_id: orgId,
    category_name: s.name,
    service_name: s.name,
    description: `Government service for ${s.name}`,
    default_rate: s.rate,
    is_active: true,
    display_order: index + 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  // Expense categories
  const expenses = [
    "Printing",
    "Paper and Stationery",
    "Internet",
    "Electricity",
    "Rent",
    "Employee Advance",
    "Travel",
    "Government Fee",
    "Equipment Maintenance",
    "Software Subscription",
    "Other Expense",
  ];

  const expenseCategories: ExpenseCategory[] = expenses.map((name, index) => ({
    id: `expense-cat-${index}`,
    organization_id: orgId,
    category_name: name,
    description: `Business operations cost for ${name}`,
    is_active: true,
    display_order: index + 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const appSettings: AppSettings = {
    id: generateUUID(),
    organization_id: orgId,
    allow_employee_editing: true,
    employee_editing_limit_hours: 24,
    require_expense_receipt: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Generate some realistic sample transactions for the dashboard
  const incomeEntries: IncomeEntry[] = [];
  const expenseEntries: ExpenseEntry[] = [];

  const customerNames = [
    "Ramachandran K.",
    "Muthu Kumar",
    "Saraswathi Amma",
    "Vijayalakshmi S.",
    "Balamurugan R.",
    "Meenakshi Sundaram",
    "Chidambaram A.",
    "Senthil Velan",
    "Janaki R.",
    "Subbiah Pillai",
    "Rajeshwari M.",
    "Kathiravan G."
  ];

  const methods: ("GPay" | "Cash in Hand")[] = ["GPay", "Cash in Hand"];
  const expMethods: ("GPay" | "Cash in Hand" | "Bank Transfer" | "Other")[] = ["GPay", "Cash in Hand", "Bank Transfer", "Other"];

  // Add 40 sample income transactions spread over the last 30 days
  const nowTime = new Date();
  for (let i = 0; i < 40; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(nowTime.getDate() - daysAgo);
    
    const empIndex = Math.floor(Math.random() * profiles.length);
    const emp = profiles[empIndex];
    const customer = customerNames[Math.floor(Math.random() * customerNames.length)];
    const serviceIndex = Math.floor(Math.random() * serviceCategories.length);
    const service = serviceCategories[serviceIndex];
    
    // Slight variance in standard rate
    const finalRate = service.default_rate * (1 + (Math.random() * 0.2 - 0.1));
    const roundedRate = Math.round(finalRate / 5) * 5 || 10; // Round to nearest 5

    incomeEntries.push({
      id: generateUUID(),
      organization_id: orgId,
      branch_id: branchId,
      employee_id: emp.id,
      customer_name: customer,
      service_category_id: service.id,
      payment_method: methods[Math.floor(Math.random() * methods.length)],
      service_rate: roundedRate,
      transaction_date: date.toISOString().split("T")[0],
      notes: Math.random() > 0.7 ? "Fast-tracked application" : "",
      created_by: emp.id,
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
      deleted_at: null,
      service_id: service.id,
      service_name_snapshot: service.service_name || service.category_name,
      listed_rate: service.default_rate,
      charged_rate: roundedRate,
      rate_overridden: roundedRate !== service.default_rate,
      rate_override_reason: roundedRate !== service.default_rate ? "Slight variance allowed" : "",
    });
  }

  // Add 15 sample expense entries
  const expenseDescriptions: { [key: string]: string[] } = {
    "Printing": ["Laser Toner cartridge refilling", "Printer drum replacement"],
    "Paper and Stationery": ["A4 Paper Boxes (5 rims)", "Double sided tape & file clips"],
    "Internet": ["Monthly Fibernet Broadband pack", "Mobile hot-spot recharge"],
    "Electricity": ["EB Meter reading July", "Replacement LED bulbs"],
    "Rent": ["Office shop monthly rent deposit"],
    "Employee Advance": ["Festival advance payout"],
    "Other Expense": ["Drinking water can supply", "Tea and snacks for visitors"],
  };

  for (let i = 0; i < 15; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(nowTime.getDate() - daysAgo);

    const empIndex = Math.floor(Math.random() * profiles.length);
    const emp = profiles[empIndex];
    const expIndex = Math.floor(Math.random() * expenseCategories.length);
    const expCat = expenseCategories[expIndex];
    
    const possibleDesc = expenseDescriptions[expCat.category_name] || ["Office maintenance & cleaning services"];
    const desc = possibleDesc[Math.floor(Math.random() * possibleDesc.length)];
    const amount = Math.floor(Math.random() * 400) + 100;

    expenseEntries.push({
      id: generateUUID(),
      organization_id: orgId,
      branch_id: branchId,
      employee_id: emp.id,
      expense_category_id: expCat.id,
      description: desc,
      amount: amount,
      payment_method: expMethods[Math.floor(Math.random() * expMethods.length)],
      transaction_date: date.toISOString().split("T")[0],
      receipt_url: Math.random() > 0.5 ? "/placeholder_receipt.png" : undefined,
      notes: "",
      created_by: emp.id,
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
      deleted_at: null,
    });
  }

  return {
    organizations: [org],
    branches: [branch],
    profiles,
    approved_users: approvedUsers,
    service_categories: serviceCategories,
    expense_categories: expenseCategories,
    income_entries: incomeEntries,
    expense_entries: expenseEntries,
    audit_logs: [],
    app_settings: [appSettings],
    service_rate_history: [],
  };
}

// Low-level read/write
function readDb(): DatabaseSchema {
  if (dbCache) {
    return dbCache;
  }

  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const data = fs.readFileSync(DB_FILE_PATH, "utf-8");
      dbCache = JSON.parse(data);
      return dbCache!;
    }
  } catch (error) {
    console.error("Failed to read database file, initializing fresh:", error);
  }

  // Create directory if not exists
  const dir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  dbCache = getInitialData();
  writeDb(dbCache);
  return dbCache;
}

function writeDb(data: DatabaseSchema) {
  dbCache = data;
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write database file:", err);
  }
}

// Database Operations Core
export const db = {
  // Query operations
  getOrganizations: () => readDb().organizations,
  getBranches: () => readDb().branches,
  getProfiles: () => readDb().profiles,
  getApprovedUsers: () => readDb().approved_users,
  getServiceCategories: () => readDb().service_categories,
  getExpenseCategories: () => readDb().expense_categories,
  getIncomeEntries: () => readDb().income_entries.filter(e => !e.deleted_at),
  getExpenseEntries: () => readDb().expense_entries.filter(e => !e.deleted_at),
  getAuditLogs: () => readDb().audit_logs,
  getAppSettings: () => readDb().app_settings[0],
  getServiceRateHistory: () => readDb().service_rate_history || [],

  // Specific finding helpers
  getProfileByEmail: (email: string) => {
    return readDb().profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
  },
  getApprovedUserByEmail: (email: string) => {
    return readDb().approved_users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },
  getProfileById: (id: string) => {
    return readDb().profiles.find((p) => p.id === id);
  },

  // Auth / Mutation Actions
  createProfile: (profile: Profile): Profile => {
    const database = readDb();
    database.profiles.push(profile);
    writeDb(database);
    return profile;
  },

  updateProfile: (id: string, updates: Partial<Profile>): Profile => {
    const database = readDb();
    const index = database.profiles.findIndex((p) => p.id === id);
    if (index === -1) throw new Error("Profile not found");
    const updated = { ...database.profiles[index], ...updates, updated_at: new Date().toISOString() };
    database.profiles[index] = updated;
    writeDb(database);
    return updated;
  },

  deleteProfile: (id: string): void => {
    const database = readDb();
    database.profiles = database.profiles.filter((p) => p.id !== id);
    writeDb(database);
  },

  addApprovedUser: (user: Omit<ApprovedUser, "id" | "created_at" | "updated_at">): ApprovedUser => {
    const database = readDb();
    const id = generateUUID();
    const newUser: ApprovedUser = {
      ...user,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    database.approved_users.push(newUser);
    writeDb(database);
    return newUser;
  },

  updateApprovedUser: (email: string, updates: Partial<ApprovedUser>): ApprovedUser => {
    const database = readDb();
    const index = database.approved_users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
    if (index === -1) throw new Error("Approved user not found");
    const updated = { ...database.approved_users[index], ...updates, updated_at: new Date().toISOString() };
    database.approved_users[index] = updated;
    writeDb(database);
    return updated;
  },

  deleteApprovedUser: (email: string) => {
    const database = readDb();
    database.approved_users = database.approved_users.filter((u) => u.email.toLowerCase() !== email.toLowerCase());
    writeDb(database);
  },

  // Service Category mutation
  addServiceCategory: (cat: Omit<ServiceCategory, "id" | "created_at" | "updated_at">): ServiceCategory => {
    const database = readDb();
    const id = generateUUID();
    const serviceName = (cat.service_name || cat.category_name).trim();
    const categoryName = (cat.category_name || cat.service_name).trim();

    // Enforce case-insensitive uniqueness per organization
    const existing = database.service_categories.find(
      (s) => s.organization_id === cat.organization_id &&
             (s.service_name || s.category_name).toLowerCase() === serviceName.toLowerCase()
    );
    if (existing) {
      throw new Error(`A service with name '${serviceName}' already exists in your organization.`);
    }

    const newCat: ServiceCategory = {
      ...cat,
      service_name: serviceName,
      category_name: categoryName,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    database.service_categories.push(newCat);
    writeDb(database);
    return newCat;
  },

  updateServiceCategory: (id: string, updates: Partial<ServiceCategory>, actorId?: string): ServiceCategory => {
    const database = readDb();
    const index = database.service_categories.findIndex((c) => c.id === id);
    if (index === -1) throw new Error("Service category not found");
    const oldCat = database.service_categories[index];
    const updated = { ...oldCat, ...updates, updated_at: new Date().toISOString() };
    database.service_categories[index] = updated;

    // Record rate change history if default_rate was updated and changed
    if (updates.default_rate !== undefined && Number(oldCat.default_rate) !== Number(updates.default_rate)) {
      if (!database.service_rate_history) {
        database.service_rate_history = [];
      }
      database.service_rate_history.push({
        id: generateUUID(),
        organization_id: oldCat.organization_id,
        service_id: id,
        old_rate: oldCat.default_rate,
        new_rate: Number(updates.default_rate),
        changed_by: actorId || "admin-user-id-mock-uuid-key",
        changed_at: new Date().toISOString()
      });
    }

    writeDb(database);
    return updated;
  },

  // Expense Category mutation
  addExpenseCategory: (cat: Omit<ExpenseCategory, "id" | "created_at" | "updated_at">): ExpenseCategory => {
    const database = readDb();
    const id = generateUUID();
    const newCat: ExpenseCategory = {
      ...cat,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    database.expense_categories.push(newCat);
    writeDb(database);
    return newCat;
  },

  updateExpenseCategory: (id: string, updates: Partial<ExpenseCategory>): ExpenseCategory => {
    const database = readDb();
    const index = database.expense_categories.findIndex((c) => c.id === id);
    if (index === -1) throw new Error("Expense category not found");
    const updated = { ...database.expense_categories[index], ...updates, updated_at: new Date().toISOString() };
    database.expense_categories[index] = updated;
    writeDb(database);
    return updated;
  },

  // Income Entries CRUD
  addIncomeEntry: (entry: Omit<IncomeEntry, "id" | "created_at" | "updated_at" | "deleted_at">): IncomeEntry => {
    const database = readDb();
    const id = generateUUID();
    const newEntry: IncomeEntry = {
      ...entry,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    database.income_entries.push(newEntry);
    writeDb(database);
    return newEntry;
  },

  updateIncomeEntry: (id: string, updates: Partial<IncomeEntry>, actorId: string): IncomeEntry => {
    const database = readDb();
    const index = database.income_entries.findIndex((e) => e.id === id);
    if (index === -1) throw new Error("Income transaction not found");
    
    const oldVal = database.income_entries[index];
    const updated = { ...oldVal, ...updates, updated_at: new Date().toISOString() };
    database.income_entries[index] = updated;

    // Log to Audit Log
    db.addAuditLog({
      organization_id: oldVal.organization_id,
      user_id: actorId,
      action: "UPDATE",
      entity_type: "income_entries",
      entity_id: id,
      old_values: JSON.stringify(oldVal),
      new_values: JSON.stringify(updated),
    });

    writeDb(database);
    return updated;
  },

  deleteIncomeEntry: (id: string, actorId: string): IncomeEntry => {
    const database = readDb();
    const index = database.income_entries.findIndex((e) => e.id === id);
    if (index === -1) throw new Error("Income transaction not found");

    const oldVal = database.income_entries[index];
    const deleted = { ...oldVal, deleted_at: new Date().toISOString() };
    database.income_entries[index] = deleted;

    // Log to Audit Log
    db.addAuditLog({
      organization_id: oldVal.organization_id,
      user_id: actorId,
      action: "DELETE",
      entity_type: "income_entries",
      entity_id: id,
      old_values: JSON.stringify(oldVal),
      new_values: JSON.stringify(deleted),
    });

    writeDb(database);
    return deleted;
  },

  // Expense Entries CRUD
  addExpenseEntry: (entry: Omit<ExpenseEntry, "id" | "created_at" | "updated_at" | "deleted_at">): ExpenseEntry => {
    const database = readDb();
    const id = generateUUID();
    const newEntry: ExpenseEntry = {
      ...entry,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    database.expense_entries.push(newEntry);
    writeDb(database);
    return newEntry;
  },

  updateExpenseEntry: (id: string, updates: Partial<ExpenseEntry>, actorId: string): ExpenseEntry => {
    const database = readDb();
    const index = database.expense_entries.findIndex((e) => e.id === id);
    if (index === -1) throw new Error("Expense transaction not found");
    
    const oldVal = database.expense_entries[index];
    const updated = { ...oldVal, ...updates, updated_at: new Date().toISOString() };
    database.expense_entries[index] = updated;

    // Log to Audit Log
    db.addAuditLog({
      organization_id: oldVal.organization_id,
      user_id: actorId,
      action: "UPDATE",
      entity_type: "expense_entries",
      entity_id: id,
      old_values: JSON.stringify(oldVal),
      new_values: JSON.stringify(updated),
    });

    writeDb(database);
    return updated;
  },

  deleteExpenseEntry: (id: string, actorId: string): ExpenseEntry => {
    const database = readDb();
    const index = database.expense_entries.findIndex((e) => e.id === id);
    if (index === -1) throw new Error("Expense transaction not found");

    const oldVal = database.expense_entries[index];
    const deleted = { ...oldVal, deleted_at: new Date().toISOString() };
    database.expense_entries[index] = deleted;

    // Log to Audit Log
    db.addAuditLog({
      organization_id: oldVal.organization_id,
      user_id: actorId,
      action: "DELETE",
      entity_type: "expense_entries",
      entity_id: id,
      old_values: JSON.stringify(oldVal),
      new_values: JSON.stringify(deleted),
    });

    writeDb(database);
    return deleted;
  },

  // Settings
  updateAppSettings: (updates: Partial<AppSettings>): AppSettings => {
    const database = readDb();
    const setting = database.app_settings[0];
    const updated = { ...setting, ...updates, updated_at: new Date().toISOString() };
    database.app_settings[0] = updated;
    writeDb(database);
    return updated;
  },

  clearTransactions: (options?: { clearEmployees?: boolean; clearCategories?: boolean; keepUserId?: string }): void => {
    const database = readDb();
    database.income_entries = [];
    database.expense_entries = [];
    database.audit_logs = [];

    if (options) {
      if (options.clearEmployees && options.keepUserId) {
        const keepProfile = database.profiles.find(p => p.id === options.keepUserId);
        if (keepProfile) {
          database.profiles = [keepProfile];
          const keepApproved = database.approved_users.find(u => u.email.toLowerCase() === keepProfile.email.toLowerCase());
          if (keepApproved) {
            database.approved_users = [keepApproved];
          } else {
            database.approved_users = [{
              id: generateUUID(),
              organization_id: keepProfile.organization_id,
              branch_id: keepProfile.branch_id,
              email: keepProfile.email.toLowerCase(),
              role: "owner",
              is_active: true,
              created_at: keepProfile.created_at,
              updated_at: keepProfile.updated_at
            }];
          }
        }
      }

      if (options.clearCategories) {
        database.service_categories = [];
        database.expense_categories = [];
      }
    }

    writeDb(database);
  },

  // Audit Logs
  addAuditLog: (log: Omit<AuditLog, "id" | "created_at">): AuditLog => {
    const database = readDb();
    const id = generateUUID();
    const newLog: AuditLog = {
      ...log,
      id,
      created_at: new Date().toISOString(),
    };
    database.audit_logs.push(newLog);
    // Don't save files recursively during internal log writes, let the caller handle persistence or save directly
    return newLog;
  },

  resetTransactionData: (userId: string): { incomeCount: number; expenseCount: number } => {
    const database = readDb();
    
    // Verify user is active owner and get their organization
    const profile = database.profiles.find(p => p.id === userId);
    if (!profile || profile.role !== "owner" || !profile.is_active) {
      throw new Error("Unauthorized: Active owner profile required");
    }

    const orgId = profile.organization_id;

    // Filter out transaction data belonging to that organization
    const incomeBefore = database.income_entries.filter(e => e.organization_id === orgId);
    const expenseBefore = database.expense_entries.filter(e => e.organization_id === orgId);

    database.income_entries = database.income_entries.filter(e => e.organization_id !== orgId);
    database.expense_entries = database.expense_entries.filter(e => e.organization_id !== orgId);
    
    // Clear transaction-related audit logs for this organization
    database.audit_logs = database.audit_logs.filter(log => {
      const isTxRelated = log.entity_type === "income_entries" || log.entity_type === "expense_entries" || log.action === "RATE_OVERRIDE";
      return !(log.organization_id === orgId && isTxRelated);
    });

    writeDb(database);

    return {
      incomeCount: incomeBefore.length,
      expenseCount: expenseBefore.length
    };
  }
};
