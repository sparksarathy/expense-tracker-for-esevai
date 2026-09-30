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
  ServiceRateHistory,
  EmployeeInvitation,
  GoogleAccessRequest
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
  invitations?: EmployeeInvitation[];
  google_requests?: GoogleAccessRequest[];
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
    name: "SS E-SEVAI MAIYAM",
    logo_url: "",
    address: "Main Road, Near Bus Stand, Tamil Nadu",
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
    name: "Main Branch",
    address: "Main Road, Near Bus Stand",
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
      email: "ssesevai@gmail.com",
      role: "owner",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Pre-seed owner profiles for administrator access
  const profiles: Profile[] = [
    {
      id: "admin-user-ssesevai-id",
      organization_id: orgId,
      branch_id: branchId,
      full_name: "SS E-Sevai (Owner)",
      email: "ssesevai@gmail.com",
      role: "owner",
      password: "admin123",
      desk_name: "Main Admin Desk",
      is_active: true,
      email_verified: true,
      joining_date: "2024-10-01",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "admin-user-id-mock-uuid-key",
      organization_id: orgId,
      branch_id: branchId,
      full_name: "Spark (Owner)",
      email: "csb21090@gmail.com",
      role: "owner",
      password: "admin123",
      desk_name: "Admin Control Desk",
      is_active: true,
      email_verified: true,
      joining_date: "2024-10-01",
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
    allow_employee_rate_override: true,
    employee_rate_permissions: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Fresh clean production state: No mock or sample transactions
  const incomeEntries: IncomeEntry[] = [];
  const expenseEntries: ExpenseEntry[] = [];

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
    invitations: [],
  };
}

// Low-level read/write
function readDb(): DatabaseSchema {
  if (dbCache) {
    return dbCache;
  }

  const initial = getInitialData();

  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const data = fs.readFileSync(DB_FILE_PATH, "utf-8");
      dbCache = JSON.parse(data);
      let needsSave = false;

      if (!dbCache!.organizations || !Array.isArray(dbCache!.organizations)) {
        dbCache!.organizations = initial.organizations;
        needsSave = true;
      }
      if (!dbCache!.branches || !Array.isArray(dbCache!.branches)) {
        dbCache!.branches = initial.branches;
        needsSave = true;
      }
      if (!dbCache!.profiles || !Array.isArray(dbCache!.profiles)) {
        dbCache!.profiles = initial.profiles;
        needsSave = true;
      }
      if (!dbCache!.approved_users || !Array.isArray(dbCache!.approved_users)) {
        dbCache!.approved_users = initial.approved_users;
        needsSave = true;
      }
      if (!dbCache!.service_categories || !Array.isArray(dbCache!.service_categories)) {
        dbCache!.service_categories = initial.service_categories;
        needsSave = true;
      }
      if (!dbCache!.expense_categories || !Array.isArray(dbCache!.expense_categories)) {
        dbCache!.expense_categories = initial.expense_categories;
        needsSave = true;
      }
      if (!dbCache!.income_entries || !Array.isArray(dbCache!.income_entries)) {
        dbCache!.income_entries = [];
        needsSave = true;
      }
      if (!dbCache!.expense_entries || !Array.isArray(dbCache!.expense_entries)) {
        dbCache!.expense_entries = [];
        needsSave = true;
      }
      if (!dbCache!.audit_logs || !Array.isArray(dbCache!.audit_logs)) {
        dbCache!.audit_logs = [];
        needsSave = true;
      }
      if (!dbCache!.app_settings || !Array.isArray(dbCache!.app_settings) || dbCache!.app_settings.length === 0) {
        dbCache!.app_settings = initial.app_settings;
        needsSave = true;
      } else {
        if (dbCache!.app_settings[0].allow_employee_rate_override === undefined) {
          dbCache!.app_settings[0].allow_employee_rate_override = true;
          needsSave = true;
        }
        if (!dbCache!.app_settings[0].employee_rate_permissions) {
          dbCache!.app_settings[0].employee_rate_permissions = {};
          needsSave = true;
        }
      }
      if (!dbCache!.service_rate_history || !Array.isArray(dbCache!.service_rate_history)) {
        dbCache!.service_rate_history = [];
        needsSave = true;
      }
      if (!dbCache!.invitations || !Array.isArray(dbCache!.invitations)) {
        dbCache!.invitations = [];
        needsSave = true;
      }
      if (!dbCache!.google_requests || !Array.isArray(dbCache!.google_requests)) {
        dbCache!.google_requests = [];
        needsSave = true;
      }

      if (needsSave) {
        writeDb(dbCache!);
      }
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
  getOrganizations: () => readDb().organizations || [],
  getBranches: () => readDb().branches || [],
  getProfiles: () => readDb().profiles || [],
  getApprovedUsers: () => readDb().approved_users || [],
  getServiceCategories: () => readDb().service_categories || [],
  getExpenseCategories: () => readDb().expense_categories || [],
  getIncomeEntries: () => (readDb().income_entries || []).filter(e => !e.deleted_at),
  getExpenseEntries: () => (readDb().expense_entries || []).filter(e => !e.deleted_at),
  getAuditLogs: () => readDb().audit_logs || [],
  getAppSettings: () => (readDb().app_settings && readDb().app_settings[0]) || getInitialData().app_settings[0],
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

  updateProfile: (id: string, updates: Partial<Profile> & { id?: string }): Profile => {
    const database = readDb();
    const index = database.profiles.findIndex((p) => p.id === id);
    if (index === -1) throw new Error("Profile not found");

    let newId = id;
    if (updates.id && updates.id !== id) {
      newId = updates.id.trim();
      if (!newId) throw new Error("Employee ID cannot be empty.");
      const idExists = database.profiles.some(p => p.id === newId);
      if (idExists) throw new Error("Employee ID is already in use by another desk.");
    }

    const updated = { ...database.profiles[index], ...updates, id: newId, updated_at: new Date().toISOString() };
    database.profiles[index] = updated;

    if (newId !== id) {
      // Cascade ID updates to income_entries
      database.income_entries = database.income_entries.map(entry => {
        if (entry.employee_id === id) {
          return { ...entry, employee_id: newId };
        }
        return entry;
      });

      // Cascade ID updates to expense_entries
      database.expense_entries = database.expense_entries.map(entry => {
        if (entry.employee_id === id) {
          return { ...entry, employee_id: newId };
        }
        return entry;
      });

      // Cascade ID updates to audit_logs
      database.audit_logs = database.audit_logs.map(log => {
        const updatedLog = { ...log };
        if (log.user_id === id) {
          updatedLog.user_id = newId;
        }
        if (log.entity_id === id) {
          updatedLog.entity_id = newId;
        }
        return updatedLog;
      });
    }

    writeDb(database);
    return updated;
  },

  deleteProfile: (id: string, reassignToId?: string): void => {
    const database = readDb();

    if (reassignToId) {
      // Re-assign income entries
      database.income_entries = database.income_entries.map(entry => {
        const updated = { ...entry };
        if (entry.employee_id === id) {
          updated.employee_id = reassignToId;
        }
        if (entry.created_by === id) {
          updated.created_by = reassignToId;
        }
        return updated;
      });

      // Re-assign expense entries
      database.expense_entries = database.expense_entries.map(entry => {
        const updated = { ...entry };
        if (entry.employee_id === id) {
          updated.employee_id = reassignToId;
        }
        if (entry.created_by === id) {
          updated.created_by = reassignToId;
        }
        return updated;
      });

      // Re-assign audit logs
      database.audit_logs = database.audit_logs.map(log => {
        const updated = { ...log };
        if (log.user_id === id) {
          updated.user_id = reassignToId;
        }
        if (log.entity_id === id) {
          updated.entity_id = reassignToId;
        }
        return updated;
      });
    }

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

  // Google Access Requests
  getGoogleRequests: (): GoogleAccessRequest[] => {
    const database = readDb();
    if (!database.google_requests) database.google_requests = [];
    return database.google_requests;
  },

  addGoogleRequest: (req: { email: string; name: string; avatar_url?: string; google_id?: string; email_verified?: boolean; verified_at?: string }): GoogleAccessRequest => {
    const database = readDb();
    if (!database.google_requests) database.google_requests = [];
    
    // Check if an existing request for this email exists
    const existing = database.google_requests.find(r => r.email.toLowerCase() === req.email.toLowerCase());
    if (existing) {
      existing.name = req.name || existing.name;
      existing.avatar_url = req.avatar_url || existing.avatar_url;
      existing.google_id = req.google_id || existing.google_id;
      if (req.email_verified !== undefined) existing.email_verified = req.email_verified;
      if (req.verified_at !== undefined) existing.verified_at = req.verified_at;
      existing.requested_at = new Date().toISOString();
      existing.status = "pending";
      writeDb(database);
      return existing;
    }

    const newReq: GoogleAccessRequest = {
      id: "req-" + generateUUID(),
      email: req.email.toLowerCase(),
      name: req.name,
      avatar_url: req.avatar_url,
      google_id: req.google_id,
      requested_at: new Date().toISOString(),
      status: "pending",
      email_verified: req.email_verified || false,
      verified_at: req.verified_at,
    };
    database.google_requests.push(newReq);
    writeDb(database);
    return newReq;
  },

  updateGoogleRequest: (id: string, updates: Partial<GoogleAccessRequest>): GoogleAccessRequest | null => {
    const database = readDb();
    if (!database.google_requests) database.google_requests = [];
    const index = database.google_requests.findIndex(r => r.id === id);
    if (index !== -1) {
      database.google_requests[index] = { ...database.google_requests[index], ...updates };
      writeDb(database);
      return database.google_requests[index];
    }
    return null;
  },

  updateGoogleRequestStatus: (id: string, status: "approved" | "rejected") => {
    const database = readDb();
    if (!database.google_requests) database.google_requests = [];
    const index = database.google_requests.findIndex(r => r.id === id);
    if (index !== -1) {
      database.google_requests[index].status = status;
      writeDb(database);
    }
  },

  deleteGoogleRequest: (id: string) => {
    const database = readDb();
    if (!database.google_requests) database.google_requests = [];
    database.google_requests = database.google_requests.filter(r => r.id !== id);
    writeDb(database);
  },

  // Employee Invitations
  getInvitations: (): EmployeeInvitation[] => {
    const database = readDb();
    if (!database.invitations) database.invitations = [];
    return database.invitations;
  },

  getInvitationByToken: (token: string): EmployeeInvitation | undefined => {
    const database = readDb();
    if (!database.invitations) database.invitations = [];
    return database.invitations.find((i) => i.token === token);
  },

  getInvitationByEmail: (email: string): EmployeeInvitation | undefined => {
    const database = readDb();
    if (!database.invitations) database.invitations = [];
    return database.invitations.find(
      (i) => i.email.toLowerCase() === email.toLowerCase() && i.status === "pending"
    );
  },

  addInvitation: (inv: Omit<EmployeeInvitation, "id" | "created_at">): EmployeeInvitation => {
    const database = readDb();
    if (!database.invitations) database.invitations = [];
    const id = generateUUID();
    const newInv: EmployeeInvitation = {
      ...inv,
      id,
      created_at: new Date().toISOString(),
    };
    database.invitations.push(newInv);
    writeDb(database);
    return newInv;
  },

  updateInvitation: (id: string, updates: Partial<EmployeeInvitation>): EmployeeInvitation => {
    const database = readDb();
    if (!database.invitations) database.invitations = [];
    const index = database.invitations.findIndex((i) => i.id === id);
    if (index === -1) throw new Error("Invitation record not found");
    const updated = { ...database.invitations[index], ...updates };
    database.invitations[index] = updated;
    writeDb(database);
    return updated;
  },

  deleteInvitation: (id: string) => {
    const database = readDb();
    if (!database.invitations) database.invitations = [];
    database.invitations = database.invitations.filter((i) => i.id !== id);
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
    if (!database.app_settings || !database.app_settings[0]) {
      database.app_settings = getInitialData().app_settings;
    }
    const setting = database.app_settings[0];
    const mergedPermissions = {
      ...(setting.employee_rate_permissions || {}),
      ...(updates.employee_rate_permissions || {}),
    };
    const updated: AppSettings = {
      ...setting,
      ...updates,
      employee_rate_permissions: mergedPermissions,
      updated_at: new Date().toISOString(),
    };
    database.app_settings[0] = updated;

    // Also sync per-employee rate edit permission onto profiles and approved_users
    if (updates.employee_rate_permissions) {
      database.profiles = (database.profiles || []).map((p) => {
        if (updates.employee_rate_permissions && p.id in updates.employee_rate_permissions) {
          return {
            ...p,
            allow_rate_edit: Boolean(updates.employee_rate_permissions[p.id]),
            updated_at: new Date().toISOString(),
          };
        }
        return p;
      });
    }

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
