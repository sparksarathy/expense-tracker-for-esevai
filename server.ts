/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/localDb.ts";
import { Profile, UserRole, PaymentMethod } from "./src/types.ts";

const app = express();
const PORT = 3000;

// Body parser
app.use(express.json());

// Helper: Custom inline cookie parser
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie || "";
  const parsed: { [key: string]: string } = {};
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    if (parts.length === 2) {
      parsed[parts[0].trim()] = decodeURIComponent(parts[1].trim());
    }
  });
  (req as any).cookies = parsed;
  next();
});

// Helper: Get Logged In User from session
function getSessionUser(req: express.Request): Profile | null {
  const userId = (req as any).cookies["auth_session_id"];
  if (!userId) return null;
  const profile = db.getProfileById(userId);
  if (!profile || !profile.is_active) return null;
  return profile;
}

// Security Middleware: Require Auth
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized. Please log in first." });
  }
  (req as any).user = user;
  next();
};

// Security Middleware: Require Owner/Admin role
const requireOwner = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = getSessionUser(req);
  if (!user || user.role !== "owner") {
    return res.status(403).json({ error: "Access denied. Owner permissions required." });
  }
  (req as any).user = user;
  next();
};

// =========================================================================
// 1. AUTHENTICATION ENDPOINTS
// =========================================================================

// Get currently logged-in user profile
app.get("/api/auth/me", (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.json({ user: null });
  }
  res.json({ user });
});

// Mock login simulation (Google OAuth / approved email lookup)
app.post("/api/auth/login", (req, res) => {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  // Look up in Approved Users list
  const approvedUser = db.getApprovedUserByEmail(email);
  if (!approvedUser || !approvedUser.is_active) {
    return res.status(403).json({ error: "Access denied. Your email is not pre-approved or has been deactivated." });
  }

  // Look up profile, create if not exists
  let profile = db.getProfileByEmail(email);
  if (!profile) {
    profile = db.createProfile({
      id: "user-id-" + Math.random().toString(36).substr(2, 9),
      organization_id: approvedUser.organization_id,
      branch_id: approvedUser.branch_id,
      full_name: name || email.split("@")[0].replace(/[._-]/g, " "),
      email: email.toLowerCase(),
      role: approvedUser.role,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  if (!profile.is_active) {
    return res.status(403).json({ error: "Access denied. Your account profile is deactivated." });
  }

  // Save login in Audit logs
  db.addAuditLog({
    organization_id: profile.organization_id,
    user_id: profile.id,
    action: "LOGIN",
    entity_type: "profiles",
    entity_id: profile.id,
    new_values: JSON.stringify({ email: profile.email, timestamp: new Date().toISOString() })
  });

  // Set Auth cookie
  res.cookie("auth_session_id", profile.id, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
    sameSite: "none",
    secure: true,
  });

  res.json({ user: profile });
});

// Clear session / Logout
app.post("/api/auth/logout", (req, res) => {
  const user = getSessionUser(req);
  if (user) {
    db.addAuditLog({
      organization_id: user.organization_id,
      user_id: user.id,
      action: "LOGOUT",
      entity_type: "profiles",
      entity_id: user.id
    });
  }

  res.cookie("auth_session_id", "", { 
    maxAge: 0, 
    path: "/",
    sameSite: "none",
    secure: true,
  });
  res.json({ success: true });
});

// Emulator convenience endpoint: List pre-approved employees for easy UI toggling
app.get("/api/auth/approved-list", (req, res) => {
  const list = db.getProfiles();
  res.json({ approved: list });
});


// =========================================================================
// 2. SERVICE CATEGORIES
// =========================================================================
app.get("/api/service-categories", requireAuth, (req, res) => {
  const categories = db.getServiceCategories();
  res.json({ categories });
});

app.post("/api/service-categories", requireOwner, (req, res) => {
  const user = (req as any).user;
  const { category_name, service_name, service_code, description, default_rate, minimum_rate, maximum_rate, display_order } = req.body;
  
  const nameToUse = service_name || category_name;
  if (!nameToUse) {
    return res.status(400).json({ error: "Service name is required" });
  }

  // Enforce unique service names within the organization (case-insensitive)
  const existing = db.getServiceCategories().find(
    s => s.organization_id === user.organization_id &&
         (s.service_name || s.category_name).toLowerCase() === nameToUse.trim().toLowerCase()
  );
  if (existing) {
    return res.status(400).json({ error: "A service with this name already exists in your organization." });
  }

  const rate = Number(default_rate);
  if (isNaN(rate) || rate < 0) {
    return res.status(400).json({ error: "Rate must be a non-negative number" });
  }

  const minR = (minimum_rate !== undefined && minimum_rate !== "") ? Number(minimum_rate) : undefined;
  const maxR = (maximum_rate !== undefined && maximum_rate !== "") ? Number(maximum_rate) : undefined;

  if (minR !== undefined && (isNaN(minR) || minR < 0)) {
    return res.status(400).json({ error: "Minimum rate must be zero or greater." });
  }
  if (maxR !== undefined && (isNaN(maxR) || maxR < 0)) {
    return res.status(400).json({ error: "Maximum rate must be zero or greater." });
  }
  if (minR !== undefined && maxR !== undefined && maxR < minR) {
    return res.status(400).json({ error: "Maximum rate must be greater than or equal to minimum rate." });
  }

  const category = db.addServiceCategory({
    organization_id: user.organization_id,
    category_name: nameToUse.trim(),
    service_name: nameToUse.trim(),
    service_code: service_code || "",
    description: description || "",
    default_rate: rate,
    minimum_rate: minR,
    maximum_rate: maxR,
    is_active: true,
    display_order: Number(display_order) || 0,
    created_by: user.id,
    updated_by: user.id,
  });

  res.json({ success: true, category });
});

app.put("/api/service-categories/:id", requireOwner, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { category_name, service_name, service_code, description, default_rate, minimum_rate, maximum_rate, is_active, display_order } = req.body;

  const updates: any = {};
  
  const nameToUse = service_name || category_name;
  if (nameToUse !== undefined) {
    const existing = db.getServiceCategories().find(
      s => s.id !== id && 
           s.organization_id === user.organization_id &&
           (s.service_name || s.category_name).toLowerCase() === nameToUse.trim().toLowerCase()
    );
    if (existing) {
      return res.status(400).json({ error: "A service with this name already exists in your organization." });
    }
    updates.service_name = nameToUse.trim();
    updates.category_name = nameToUse.trim();
  }

  if (service_code !== undefined) updates.service_code = service_code;
  if (description !== undefined) updates.description = description;
  if (is_active !== undefined) updates.is_active = Boolean(is_active);
  if (display_order !== undefined) updates.display_order = Number(display_order);

  const currentCat = db.getServiceCategories().find(c => c.id === id);
  if (!currentCat) {
    return res.status(404).json({ error: "Service not found" });
  }

  let minR = minimum_rate !== undefined ? (minimum_rate === "" ? null : Number(minimum_rate)) : currentCat.minimum_rate;
  let maxR = maximum_rate !== undefined ? (maximum_rate === "" ? null : Number(maximum_rate)) : currentCat.maximum_rate;

  if (minR !== undefined && minR !== null) {
    if (isNaN(Number(minR)) || Number(minR) < 0) {
      return res.status(400).json({ error: "Minimum rate must be zero or greater." });
    }
    updates.minimum_rate = Number(minR);
  } else if (minimum_rate === "") {
    updates.minimum_rate = undefined;
  }

  if (maxR !== undefined && maxR !== null) {
    if (isNaN(Number(maxR)) || Number(maxR) < 0) {
      return res.status(400).json({ error: "Maximum rate must be zero or greater." });
    }
    updates.maximum_rate = Number(maxR);
  } else if (maximum_rate === "") {
    updates.maximum_rate = undefined;
  }

  if (updates.minimum_rate !== undefined && updates.maximum_rate !== undefined && updates.maximum_rate < updates.minimum_rate) {
    return res.status(400).json({ error: "Maximum rate must be greater than or equal to minimum rate." });
  }

  if (default_rate !== undefined) {
    const rate = Number(default_rate);
    if (isNaN(rate) || rate < 0) {
      return res.status(400).json({ error: "Rate must be a non-negative number" });
    }
    updates.default_rate = rate;
  }

  updates.updated_by = user.id;

  try {
    const updated = db.updateServiceCategory(id, updates, user.id);
    res.json({ success: true, category: updated });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

app.post("/api/service-categories/bulk-status", requireOwner, (req, res) => {
  const user = (req as any).user;
  const { ids, is_active } = req.body;
  if (!Array.isArray(ids) || is_active === undefined) {
    return res.status(400).json({ error: "Missing ids array or is_active boolean" });
  }

  try {
    const updatedCategories = ids.map(id => {
      return db.updateServiceCategory(id, { is_active: Boolean(is_active) }, user.id);
    });
    res.json({ success: true, count: updatedCategories.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/service-rate-history", requireAuth, (req, res) => {
  const user = (req as any).user;
  const history = db.getServiceRateHistory().filter(h => h.organization_id === user.organization_id);
  
  // Enrich with service and performer metadata
  const enriched = history.map(h => {
    const s = db.getServiceCategories().find(cat => cat.id === h.service_id);
    const p = db.getProfileById(h.changed_by);
    return {
      ...h,
      service_name: s ? (s.service_name || s.category_name) : "Deleted Service",
      performer_name: p ? p.full_name : "System / Unknown"
    };
  });
  
  res.json({ history: enriched });
});


// =========================================================================
// 3. EXPENSE CATEGORIES
// =========================================================================
app.get("/api/expense-categories", requireAuth, (req, res) => {
  const categories = db.getExpenseCategories();
  res.json({ categories });
});

app.post("/api/expense-categories", requireOwner, (req, res) => {
  const { category_name, description, display_order } = req.body;
  if (!category_name) {
    return res.status(400).json({ error: "Category name is required" });
  }

  const category = db.addExpenseCategory({
    organization_id: (req as any).user.organization_id,
    category_name,
    description: description || "",
    is_active: true,
    display_order: Number(display_order) || 0,
  });

  res.json({ success: true, category });
});

app.put("/api/expense-categories/:id", requireOwner, (req, res) => {
  const { id } = req.params;
  const { category_name, description, is_active, display_order } = req.body;

  const updates: any = {};
  if (category_name !== undefined) updates.category_name = category_name;
  if (description !== undefined) updates.description = description;
  if (is_active !== undefined) updates.is_active = Boolean(is_active);
  if (display_order !== undefined) updates.display_order = Number(display_order);

  try {
    const updated = db.updateExpenseCategory(id, updates);
    res.json({ success: true, category: updated });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});


// =========================================================================
// 4. INCOME ENTRIES (TRANSACTIONS)
// =========================================================================
app.get("/api/income-entries", requireAuth, (req, res) => {
  const user = (req as any).user;
  let entries = db.getIncomeEntries();

  // 1. Enforce Role Isolation (Employees see only their own, Owners see all)
  if (user.role !== "owner") {
    entries = entries.filter((e) => e.employee_id === user.id);
  }

  // 2. App Filter Parameters
  const { customer, employee_id, service_id, payment_method, date_from, date_to, sort_by } = req.query;

  if (customer) {
    const q = (customer as string).toLowerCase();
    entries = entries.filter((e) => e.customer_name.toLowerCase().includes(q));
  }
  if (employee_id && user.role === "owner") {
    entries = entries.filter((e) => e.employee_id === employee_id);
  }
  if (service_id) {
    entries = entries.filter((e) => e.service_category_id === service_id);
  }
  if (payment_method) {
    entries = entries.filter((e) => e.payment_method === payment_method);
  }
  if (date_from) {
    entries = entries.filter((e) => e.transaction_date >= (date_from as string));
  }
  if (date_to) {
    entries = entries.filter((e) => e.transaction_date <= (date_to as string));
  }

  // Sort
  if (sort_by === "oldest") {
    entries.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.created_at.localeCompare(b.created_at));
  } else if (sort_by === "highest") {
    entries.sort((a, b) => b.service_rate - a.service_rate);
  } else if (sort_by === "lowest") {
    entries.sort((a, b) => a.service_rate - b.service_rate);
  } else {
    // default: newest
    entries.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.created_at.localeCompare(a.created_at));
  }

  res.json({ entries });
});

app.post("/api/income-entries", requireAuth, (req, res) => {
  const user = (req as any).user;
  const { customer_name, service_category_id, payment_method, service_rate, transaction_date, notes, employee_id, rate_override_reason } = req.body;

  if (!customer_name || !service_category_id || !payment_method || !service_rate || !transaction_date) {
    return res.status(400).json({ error: "Missing required fields (customer_name, service_category_id, payment_method, service_rate, transaction_date)" });
  }

  const rate = Number(service_rate);
  if (isNaN(rate) || rate < 0) {
    return res.status(400).json({ error: "Service rate must be zero or greater." });
  }

  // Find service category or match by service name snapshot
  const service = db.getServiceCategories().find(s => s.id === service_category_id || (s.service_name || s.category_name).toLowerCase() === service_category_id.toLowerCase());
  const service_id = service ? service.id : service_category_id;
  const service_name_snapshot = service ? (service.service_name || service.category_name) : service_category_id;
  const listed_rate = service ? Number(service.default_rate) : rate;

  const rate_overridden = (rate !== listed_rate);

  if (rate_overridden) {
    if (user.role !== "owner") {
      const appSettings = db.getAppSettings();
      if (!appSettings.allow_employee_rate_override) {
        return res.status(403).json({ error: "Employee rate override is disabled by application settings." });
      }
      
      // If minimum and maximum rates are configured, stay in range
      if (service) {
        if (service.minimum_rate !== undefined && service.minimum_rate !== null && rate < service.minimum_rate) {
          return res.status(400).json({ error: `Rate is below the minimum permitted rate of ₹${service.minimum_rate}.` });
        }
        if (service.maximum_rate !== undefined && service.maximum_rate !== null && rate > service.maximum_rate) {
          return res.status(400).json({ error: `Rate exceeds the maximum permitted rate of ₹${service.maximum_rate}.` });
        }
      }
    }

    // Add audit log for rate override difference
    db.addAuditLog({
      organization_id: user.organization_id,
      user_id: user.id,
      action: "RATE_OVERRIDE",
      entity_type: "income_entries",
      entity_id: "new",
      old_values: `Listed: ₹${listed_rate}`,
      new_values: `Charged: ₹${rate}. Reason: ${rate_override_reason || "None specified"}`
    });
  }

  // Determine actual target employee (Only Owner can record on behalf of other employees)
  let targetEmployeeId = user.id;
  if (user.role === "owner" && employee_id) {
    targetEmployeeId = employee_id;
  }

  const entry = db.addIncomeEntry({
    organization_id: user.organization_id,
    branch_id: user.branch_id,
    employee_id: targetEmployeeId,
    customer_name: customer_name.trim(),
    service_category_id: service_id,
    payment_method,
    service_rate: rate,
    transaction_date,
    notes: notes || "",
    created_by: user.id,
    
    // New snapshot fields
    service_id,
    service_name_snapshot,
    listed_rate,
    charged_rate: rate,
    rate_overridden,
    rate_override_reason: rate_override_reason || "",
  });

  res.json({ success: true, entry });
});

app.put("/api/income-entries/:id", requireAuth, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { customer_name, service_category_id, payment_method, service_rate, transaction_date, notes, employee_id } = req.body;

  let original;
  try {
    original = db.getIncomeEntries().find((e) => e.id === id);
    if (!original) return res.status(404).json({ error: "Transaction not found" });
  } catch (err) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  // Check Permissions
  if (user.role !== "owner") {
    // Employees can only edit their own
    if (original.employee_id !== user.id) {
      return res.status(403).json({ error: "Access Denied. You cannot edit another employee's records." });
    }

    // Check configuration limits
    const settings = db.getAppSettings();
    if (!settings.allow_employee_editing) {
      return res.status(403).json({ error: "Employee transaction editing is disabled by the owner." });
    }

    const createdTime = new Date(original.created_at).getTime();
    const limitMs = settings.employee_editing_limit_hours * 60 * 60 * 1000;
    if (Date.now() - createdTime > limitMs) {
      return res.status(403).json({ error: `Time limit exceeded. Employees can only edit transactions within ${settings.employee_editing_limit_hours} hours of creation.` });
    }
  }

  const updates: any = {};
  if (customer_name !== undefined) updates.customer_name = customer_name;
  if (service_category_id !== undefined) updates.service_category_id = service_category_id;
  if (payment_method !== undefined) updates.payment_method = payment_method;
  if (notes !== undefined) updates.notes = notes;
  if (transaction_date !== undefined) updates.transaction_date = transaction_date;
  
  if (service_rate !== undefined) {
    const rate = Number(service_rate);
    if (isNaN(rate) || rate <= 0) {
      return res.status(400).json({ error: "Rate must be greater than zero" });
    }
    updates.service_rate = rate;
  }

  if (employee_id !== undefined && user.role === "owner") {
    updates.employee_id = employee_id;
  }

  const updated = db.updateIncomeEntry(id, updates, user.id);
  res.json({ success: true, entry: updated });
});

app.delete("/api/income-entries/:id", requireOwner, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;

  try {
    const deleted = db.deleteIncomeEntry(id, user.id);
    res.json({ success: true, entry: deleted });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});


// =========================================================================
// 5. EXPENSE ENTRIES (TRANSACTIONS)
// =========================================================================
app.get("/api/expense-entries", requireAuth, (req, res) => {
  const user = (req as any).user;
  let entries = db.getExpenseEntries();

  // Role Isolation
  if (user.role !== "owner") {
    entries = entries.filter((e) => e.employee_id === user.id);
  }

  const { category_id, employee_id, payment_method, date_from, date_to, sort_by } = req.query;

  if (employee_id && user.role === "owner") {
    entries = entries.filter((e) => e.employee_id === employee_id);
  }
  if (category_id) {
    entries = entries.filter((e) => e.expense_category_id === category_id);
  }
  if (payment_method) {
    entries = entries.filter((e) => e.payment_method === payment_method);
  }
  if (date_from) {
    entries = entries.filter((e) => e.transaction_date >= (date_from as string));
  }
  if (date_to) {
    entries = entries.filter((e) => e.transaction_date <= (date_to as string));
  }

  // Sort
  if (sort_by === "oldest") {
    entries.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
  } else if (sort_by === "highest") {
    entries.sort((a, b) => b.amount - a.amount);
  } else if (sort_by === "lowest") {
    entries.sort((a, b) => a.amount - b.amount);
  } else {
    // default: newest
    entries.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.created_at.localeCompare(a.created_at));
  }

  res.json({ entries });
});

app.post("/api/expense-entries", requireAuth, (req, res) => {
  const user = (req as any).user;
  const { expense_category_id, description, amount, payment_method, transaction_date, notes, employee_id, receipt_url } = req.body;

  if (!expense_category_id || !description || !amount || !payment_method || !transaction_date) {
    return res.status(400).json({ error: "Missing required fields (expense_category_id, description, amount, payment_method, transaction_date)" });
  }

  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: "Expense amount must be greater than zero." });
  }

  const settings = db.getAppSettings();
  if (settings.require_expense_receipt && !receipt_url) {
    return res.status(400).json({ error: "A receipt upload is required for all expense logging under current admin settings." });
  }

  let targetEmployeeId = user.id;
  if (user.role === "owner" && employee_id) {
    targetEmployeeId = employee_id;
  }

  const entry = db.addExpenseEntry({
    organization_id: user.organization_id,
    branch_id: user.branch_id,
    employee_id: targetEmployeeId,
    expense_category_id,
    description,
    amount: numericAmount,
    payment_method,
    transaction_date,
    receipt_url: receipt_url || "",
    notes: notes || "",
    created_by: user.id,
  });

  res.json({ success: true, entry });
});

app.put("/api/expense-entries/:id", requireAuth, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { expense_category_id, description, amount, payment_method, transaction_date, notes, employee_id, receipt_url } = req.body;

  let original;
  try {
    original = db.getExpenseEntries().find((e) => e.id === id);
    if (!original) return res.status(404).json({ error: "Expense not found" });
  } catch (err) {
    return res.status(404).json({ error: "Expense not found" });
  }

  // Check Permissions
  if (user.role !== "owner") {
    if (original.employee_id !== user.id) {
      return res.status(403).json({ error: "Access Denied. You cannot edit another employee's expenses." });
    }

    const settings = db.getAppSettings();
    if (!settings.allow_employee_editing) {
      return res.status(403).json({ error: "Employee editing is disabled by the owner." });
    }

    const createdTime = new Date(original.created_at).getTime();
    const limitMs = settings.employee_editing_limit_hours * 60 * 60 * 1000;
    if (Date.now() - createdTime > limitMs) {
      return res.status(403).json({ error: `Time limit exceeded. Employees can only edit transactions within ${settings.employee_editing_limit_hours} hours of creation.` });
    }
  }

  const updates: any = {};
  if (expense_category_id !== undefined) updates.expense_category_id = expense_category_id;
  if (description !== undefined) updates.description = description;
  if (payment_method !== undefined) updates.payment_method = payment_method;
  if (transaction_date !== undefined) updates.transaction_date = transaction_date;
  if (notes !== undefined) updates.notes = notes;
  if (receipt_url !== undefined) updates.receipt_url = receipt_url;

  if (amount !== undefined) {
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than zero." });
    }
    updates.amount = numericAmount;
  }

  if (employee_id !== undefined && user.role === "owner") {
    updates.employee_id = employee_id;
  }

  const updated = db.updateExpenseEntry(id, updates, user.id);
  res.json({ success: true, entry: updated });
});

app.delete("/api/expense-entries/:id", requireOwner, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;

  try {
    const deleted = db.deleteExpenseEntry(id, user.id);
    res.json({ success: true, entry: deleted });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});


// =========================================================================
// 6. EMPLOYEE MANAGEMENT
// =========================================================================
app.get("/api/branches", requireAuth, (req, res) => {
  const branches = db.getBranches();
  res.json({ branches });
});

app.get("/api/employees", requireOwner, (req, res) => {
  const profiles = db.getProfiles();
  const approvedList = db.getApprovedUsers();
  
  const incomeEntries = db.getIncomeEntries();
  const expenseEntries = db.getExpenseEntries();

  // Enrich profile information with transaction totals and performance details
  const employees = profiles.map((p) => {
    const userIncomes = incomeEntries.filter((i) => i.employee_id === p.id);
    const userExpenses = expenseEntries.filter((e) => e.employee_id === p.id);

    const revenue = userIncomes.reduce((acc, curr) => acc + curr.service_rate, 0);
    const expensesSum = userExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const count = userIncomes.length;

    // Last login lookup from audit logs
    const userAudits = db.getAuditLogs().filter((l) => l.user_id === p.id && l.action === "LOGIN");
    const lastLogin = userAudits.length > 0 
      ? userAudits[userAudits.length - 1].created_at 
      : p.created_at;

    return {
      ...p,
      transaction_count: count,
      revenue_generated: revenue,
      expense_amount: expensesSum,
      last_login: lastLogin,
    };
  });

  res.json({ employees, approvedList });
});

// Add future approved user email
app.post("/api/employees", requireOwner, (req, res) => {
  const { email, full_name, desk_name, phone_number, notes, role, branch_id, avatar_url, is_active } = req.body;
  const currentUser = (req as any).user;

  if (!email || !full_name) {
    return res.status(400).json({ error: "Email and Full Name are required" });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingApproved = db.getApprovedUserByEmail(normalizedEmail);
  const existingProfile = db.getProfileByEmail(normalizedEmail);
  if (existingApproved || existingProfile) {
    return res.status(400).json({ error: "Email is already approved and registered." });
  }

  const org = db.getOrganizations()[0];
  const branch = db.getBranches()[0]; // Default to main branch for demo

  // Create approved user entry
  const approved = db.addApprovedUser({
    organization_id: currentUser.organization_id || org.id,
    branch_id: branch_id || branch.id,
    email: normalizedEmail,
    role: role === "owner" ? "owner" : "employee",
    is_active: is_active !== undefined ? Boolean(is_active) : true,
    invited_by: currentUser.id,
  });

  // Automatically seed matching profile so the user can immediately log in!
  const profile = db.createProfile({
    id: "user-id-" + Math.random().toString(36).substr(2, 9),
    organization_id: currentUser.organization_id || org.id,
    branch_id: branch_id || branch.id,
    full_name: full_name.trim(),
    email: normalizedEmail,
    role: approved.role,
    is_active: is_active !== undefined ? Boolean(is_active) : true,
    desk_name: desk_name ? desk_name.trim() : undefined,
    phone_number: phone_number ? phone_number.trim() : undefined,
    notes: notes ? notes.trim() : undefined,
    avatar_url: avatar_url || undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Record employee creation in audit log
  db.addAuditLog({
    organization_id: currentUser.organization_id || org.id,
    user_id: currentUser.id,
    action: "CREATE_EMPLOYEE",
    entity_type: "profiles",
    entity_id: profile.id,
    new_values: JSON.stringify(profile)
  });

  res.json({ success: true, employee: profile, approved });
});

// Photo upload endpoint
app.post("/api/employees/upload-avatar", requireAuth, (req, res) => {
  const { fileData, fileName, fileType } = req.body;
  if (!fileData || !fileType) {
    return res.status(400).json({ error: "Missing file data or file type" });
  }

  // Validate file size (max 2MB)
  const sizeInBytes = (fileData.length * 3) / 4;
  if (sizeInBytes > 2 * 1024 * 1024) {
    return res.status(400).json({ error: "File is too large. Maximum size allowed is 2 MB." });
  }

  // Validate actual file type (jpeg, jpg, png, webp)
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowedTypes.includes(fileType.toLowerCase())) {
    return res.status(400).json({ error: "Invalid file type. Only JPG, JPEG, PNG, or WebP files are allowed." });
  }

  try {
    const fs = require("fs");
    const path = require("path");
    
    // Ensure data directory exists
    const uploadDir = path.join(process.cwd(), "data", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Convert Base64 data to buffer
    const base64Data = fileData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Generate clean filename
    const extension = fileType.split("/")[1] || "png";
    const cleanFileName = `avatar_${Date.now()}_${Math.floor(Math.random() * 1000)}.${extension}`;
    const filePath = path.join(uploadDir, cleanFileName);

    // Save file
    fs.writeFileSync(filePath, buffer);

    // Return the public URL path
    const fileUrl = `/uploads/${cleanFileName}`;
    res.json({ success: true, url: fileUrl });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save file: " + err.message });
  }
});

// Endpoint to check deletion eligibility
app.get("/api/employees/:id/deletion-check", requireOwner, (req, res) => {
  const { id } = req.params;
  const currentUser = (req as any).user;
  
  try {
    const profile = db.getProfileById(id);
    if (!profile) {
      return res.status(404).json({ error: "Employee profile not found" });
    }

    if (profile.organization_id !== currentUser.organization_id) {
      return res.status(403).json({ error: "Permission Denied. Cross-organization access is rejected." });
    }

    const incomeCount = db.getIncomeEntries().filter((e) => e.employee_id === id).length;
    const expenseCount = db.getExpenseEntries().filter((e) => e.employee_id === id).length;
    
    // Check non-auth audits
    const auditLogsReferenced = db.getAuditLogs().some(
      (log) => (log.user_id === id || log.entity_id === id) && log.action !== "LOGIN" && log.action !== "LOGOUT"
    );

    const isCurrentOwner = profile.id === currentUser.id;
    const activeOwnersCount = db.getProfiles().filter(p => p.organization_id === profile.organization_id && p.role === "owner" && p.is_active).length;
    const isFinalActiveOwner = profile.role === "owner" && activeOwnersCount <= 1;

    const allowed = incomeCount === 0 && expenseCount === 0 && !auditLogsReferenced && !isCurrentOwner && !isFinalActiveOwner;

    res.json({
      allowed,
      reasons: {
        hasIncome: incomeCount > 0,
        hasExpenses: expenseCount > 0,
        hasAudits: auditLogsReferenced,
        isCurrentOwner,
        isFinalActiveOwner
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle activation, set branch, or change details of employee
app.put("/api/employees/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const { is_active, full_name, desk_name, phone_number, notes, role, email, avatar_url, branch_id } = req.body;
  const currentUser = (req as any).user;

  try {
    const original = db.getProfileById(id);
    if (!original) return res.status(404).json({ error: "Employee profile not found" });

    // Prevent cross-organization access
    if (original.organization_id !== currentUser.organization_id) {
      return res.status(403).json({ error: "Permission Denied. Cross-organization access is rejected." });
    }

    // Permissions check: Owner can edit any profile. Employees can only edit their own name/avatar/phone
    const isSelf = currentUser.id === original.id;
    if (currentUser.role !== "owner" && !isSelf) {
      return res.status(403).json({ error: "Permission Denied. You can only edit your own desk profile details." });
    }

    const updates: any = {};
    if (full_name !== undefined) updates.full_name = full_name.trim();
    if (desk_name !== undefined) updates.desk_name = desk_name ? desk_name.trim() : null;
    if (phone_number !== undefined) updates.phone_number = phone_number ? phone_number.trim() : null;
    if (notes !== undefined) updates.notes = notes ? notes.trim() : null;
    if (avatar_url !== undefined) {
      updates.avatar_url = avatar_url;
      updates.avatar_updated_at = new Date().toISOString();
    }

    // These fields are OWNER ONLY
    if (currentUser.role === "owner") {
      const activeOwnersCount = db.getProfiles().filter(p => p.organization_id === original.organization_id && p.role === "owner" && p.is_active).length;

      if (is_active !== undefined) {
        const nextActive = Boolean(is_active);
        if (!nextActive && original.role === "owner" && original.is_active && activeOwnersCount <= 1) {
          return res.status(400).json({ error: "Self-Deactivation Protection: You cannot deactivate the final active Owner of this center!" });
        }
        updates.is_active = nextActive;
      }

      if (role !== undefined) {
        if (role !== "owner" && role !== "employee") {
          return res.status(400).json({ error: "Invalid role specified." });
        }
        if (role === "employee" && original.role === "owner" && original.is_active && activeOwnersCount <= 1) {
          return res.status(400).json({ error: "Self-Demotion Protection: You cannot demote the final active Owner of this center!" });
        }
        updates.role = role;
      }

      if (branch_id !== undefined) {
        updates.branch_id = branch_id;
      }

      if (email !== undefined) {
        const lowerEmail = email.trim().toLowerCase();
        if (lowerEmail !== original.email.toLowerCase()) {
          // Check for email collision
          const existing = db.getProfileByEmail(lowerEmail);
          if (existing && existing.id !== original.id) {
            return res.status(400).json({ error: "Email address is already in use by another desk." });
          }
          updates.email = lowerEmail;
          
          // Also rename/update the approved user record
          try {
            const approved = db.getApprovedUserByEmail(original.email);
            if (approved) {
              db.deleteApprovedUser(original.email);
              db.addApprovedUser({
                organization_id: approved.organization_id,
                branch_id: approved.branch_id,
                email: lowerEmail,
                role: updates.role !== undefined ? updates.role : approved.role,
                is_active: updates.is_active !== undefined ? updates.is_active : approved.is_active,
                invited_by: approved.invited_by
              });
            }
          } catch (e) {
            // Ignored if no approved record exists
          }
        }
      }
    } else {
      // If employee, prevent changing active status, role, email, or branch_id
      if (is_active !== undefined || role !== undefined || email !== undefined || branch_id !== undefined) {
        return res.status(403).json({ error: "Permission Denied. Employees cannot change status, roles, branches, or email addresses." });
      }
    }

    const updatedProfile = db.updateProfile(id, updates);

    // Also sync updates to approved list if applicable
    if (currentUser.role === "owner") {
      try {
        db.updateApprovedUser(updates.email || original.email, {
          is_active: updates.is_active !== undefined ? updates.is_active : original.is_active,
          role: updates.role !== undefined ? updates.role : original.role,
        });
      } catch (e) {
        // Ignored
      }
    }

    // Record rename/edit action in audit logs
    db.addAuditLog({
      organization_id: original.organization_id,
      user_id: currentUser.id,
      action: is_active === false ? "REVOKE_ACCESS" : "UPDATE_EMPLOYEE",
      entity_type: "profiles",
      entity_id: id,
      old_values: JSON.stringify(original),
      new_values: JSON.stringify(updatedProfile)
    });

    res.json({ success: true, employee: updatedProfile });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete employee desk entirely (profile and approved list)
app.delete("/api/employees/:id", requireOwner, (req, res) => {
  const { id } = req.params;
  const currentUser = (req as any).user;

  try {
    const profile = db.getProfileById(id);
    if (!profile) {
      return res.status(404).json({ error: "Employee profile not found" });
    }

    // Prevent cross-organization access
    if (profile.organization_id !== currentUser.organization_id) {
      return res.status(403).json({ error: "Permission Denied. Cross-organization deletion is rejected." });
    }

    if (profile.id === currentUser.id) {
      return res.status(400).json({ error: "Self-Deletion Protection: You cannot delete your own active owner account." });
    }

    // Check if they have income entries
    const incomeCount = db.getIncomeEntries().filter((e) => e.employee_id === id).length;
    if (incomeCount > 0) {
      return res.status(400).json({ error: "Cannot permanently delete: Employee has historical income records." });
    }

    // Check if they have expense entries
    const expenseCount = db.getExpenseEntries().filter((e) => e.employee_id === id).length;
    if (expenseCount > 0) {
      return res.status(400).json({ error: "Cannot permanently delete: Employee has historical expense records." });
    }

    // Check if referenced by non-auth audit logs
    const auditLogsReferenced = db.getAuditLogs().some(
      (log) => (log.user_id === id || log.entity_id === id) && log.action !== "LOGIN" && log.action !== "LOGOUT"
    );
    if (auditLogsReferenced) {
      return res.status(400).json({ error: "Cannot permanently delete: Employee is referenced by operational audit records." });
    }

    // Check if final active owner
    const activeOwnersCount = db.getProfiles().filter(p => p.organization_id === profile.organization_id && p.role === "owner" && p.is_active).length;
    if (profile.role === "owner" && activeOwnersCount <= 1) {
      return res.status(400).json({ error: "Cannot permanently delete the final active Owner of this center!" });
    }

    // Delete profile and approved_user record
    db.deleteProfile(id);
    db.deleteApprovedUser(profile.email);

    // Create system audit log
    db.addAuditLog({
      organization_id: currentUser.organization_id,
      user_id: currentUser.id,
      action: "DELETE_EMPLOYEE",
      entity_type: "profiles",
      entity_id: id,
      new_values: JSON.stringify({ email: profile.email, name: profile.full_name })
    });

    res.json({ success: true, message: `Employee desk for ${profile.full_name} deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// =========================================================================
// 7. REPORTS ENDPOINTS (HIGHLY ACCURATE MATH)
// =========================================================================
app.get("/api/reports", requireAuth, (req, res) => {
  const user = (req as any).user;
  const { date_from, date_to, employee_id, service_id } = req.query;

  let incomes = db.getIncomeEntries();
  let expenses = db.getExpenseEntries();

  // Role restriction
  if (user.role !== "owner") {
    incomes = incomes.filter((e) => e.employee_id === user.id);
    expenses = expenses.filter((e) => e.employee_id === user.id);
  } else if (employee_id) {
    incomes = incomes.filter((e) => e.employee_id === employee_id);
    expenses = expenses.filter((e) => e.employee_id === employee_id);
  }

  if (service_id) {
    incomes = incomes.filter((e) => e.service_category_id === service_id);
  }

  if (date_from) {
    incomes = incomes.filter((e) => e.transaction_date >= (date_from as string));
    expenses = expenses.filter((e) => e.transaction_date >= (date_from as string));
  }
  if (date_to) {
    incomes = incomes.filter((e) => e.transaction_date <= (date_to as string));
    expenses = expenses.filter((e) => e.transaction_date <= (date_to as string));
  }

  // Exact calculations to avoid float errors
  const totalIncome = incomes.reduce((acc, curr) => acc + curr.service_rate, 0);
  const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const netProfit = totalIncome - totalExpense;

  const cashReceived = incomes.filter(i => i.payment_method === "Cash in Hand").reduce((acc, c) => acc + c.service_rate, 0);
  const gpayReceived = incomes.filter(i => i.payment_method === "GPay").reduce((acc, c) => acc + c.service_rate, 0);

  // Group by category for chart (robust to handle dynamic categories)
  const serviceCategories = db.getServiceCategories();
  const revenueByCategoryMap: { [key: string]: { amount: number; count: number } } = {};

  incomes.forEach(inc => {
    const cat = serviceCategories.find(c => c.id === inc.service_category_id);
    const resolvedName = cat ? cat.category_name : inc.service_category_id;
    if (!revenueByCategoryMap[resolvedName]) {
      revenueByCategoryMap[resolvedName] = { amount: 0, count: 0 };
    }
    revenueByCategoryMap[resolvedName].amount += inc.service_rate;
    revenueByCategoryMap[resolvedName].count += 1;
  });

  const revenueByCategory = Object.entries(revenueByCategoryMap).map(([name, stats]) => ({
    category_name: name,
    amount: stats.amount,
    count: stats.count
  })).sort((a, b) => b.amount - a.amount);

  const expenseCategories = db.getExpenseCategories();
  const expensesByCategory = expenseCategories.map(cat => {
    const catExpenses = expenses.filter(e => e.expense_category_id === cat.id);
    const amount = catExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const count = catExpenses.length;
    return {
      category_name: cat.category_name,
      amount,
      count
    };
  }).filter(c => c.count > 0).sort((a,b) => b.amount - a.amount);

  // Group by Employee
  const profiles = db.getProfiles();
  const revenueByEmployee = profiles.map(p => {
    const empIncomes = incomes.filter(i => i.employee_id === p.id);
    const empExpenses = expenses.filter(e => e.employee_id === p.id);
    const revenue = empIncomes.reduce((acc, curr) => acc + curr.service_rate, 0);
    const count = empIncomes.length;
    const expenseAmt = empExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    return {
      id: p.id,
      full_name: p.full_name,
      revenue,
      count,
      expenses: expenseAmt,
      net: revenue - expenseAmt,
    };
  }).filter(e => e.count > 0 || e.expenses > 0).sort((a,b) => b.revenue - a.revenue);

  // Group by day for charts
  const datesSet = new Set([...incomes.map(i => i.transaction_date), ...expenses.map(e => e.transaction_date)]);
  const dailyBreakdown = Array.from(datesSet).map(dateStr => {
    const dayIncomes = incomes.filter(i => i.transaction_date === dateStr).reduce((acc, curr) => acc + curr.service_rate, 0);
    const dayExpenses = expenses.filter(e => e.transaction_date === dateStr).reduce((acc, curr) => acc + curr.amount, 0);
    return {
      date: dateStr, // YYYY-MM-DD
      income: dayIncomes,
      expense: dayExpenses,
      profit: dayIncomes - dayExpenses,
    };
  }).sort((a,b) => a.date.localeCompare(b.date));

  res.json({
    summary: {
      totalIncome,
      totalExpense,
      netProfit,
      cashReceived,
      gpayReceived,
      totalTransactions: incomes.length + expenses.length,
      avgTransactionValue: incomes.length > 0 ? Number((totalIncome / incomes.length).toFixed(2)) : 0,
    },
    revenueByCategory,
    expensesByCategory,
    revenueByEmployee,
    dailyBreakdown,
    incomes,
    expenses,
  });
});


// =========================================================================
// 8. SETTINGS
// =========================================================================
app.get("/api/settings", requireAuth, (req, res) => {
  const settings = db.getAppSettings();
  res.json({ settings });
});

app.put("/api/settings", requireOwner, (req, res) => {
  const { allow_employee_editing, employee_editing_limit_hours, require_expense_receipt } = req.body;
  
  const updates: any = {};
  if (allow_employee_editing !== undefined) updates.allow_employee_editing = Boolean(allow_employee_editing);
  if (require_expense_receipt !== undefined) updates.require_expense_receipt = Boolean(require_expense_receipt);
  if (employee_editing_limit_hours !== undefined) {
    const hrs = Number(employee_editing_limit_hours);
    if (isNaN(hrs) || hrs < 0) {
      return res.status(400).json({ error: "Time limit must be a positive number" });
    }
    updates.employee_editing_limit_hours = hrs;
  }

  const updated = db.updateAppSettings(updates);
  res.json({ success: true, settings: updated });
});

app.post("/api/settings/reset-data", requireOwner, (req, res) => {
  try {
    const { confirmation, reauth_email } = req.body;
    const currentUser = (req as any).user;
    
    // Check if the current user's email is exactly csb21090@gmail.com (the main admin email)
    if (currentUser.email.toLowerCase() !== "csb21090@gmail.com") {
      return res.status(403).json({ error: "Access Denied. Database formatting/reset is strictly restricted to the primary administrator email (csb21090@gmail.com) only." });
    }
    
    // 1. Re-authentication verification
    if (reauth_email && reauth_email.toLowerCase() !== currentUser.email.toLowerCase()) {
      return res.status(403).json({ error: "Re-authentication failed. The provided email does not match your active owner account." });
    }

    // 2. Exact confirmation check
    if (confirmation !== "RESET ALL RECORDS") {
      return res.status(400).json({ error: "Explicit confirmation failed. Please type 'RESET ALL RECORDS' exactly to confirm." });
    }

    // 3. Perform server-side transaction data reset
    const { incomeCount, expenseCount } = db.resetTransactionData(currentUser.id);
    
    // 4. Create system audit log for the reset action
    db.addAuditLog({
      organization_id: currentUser.organization_id,
      user_id: currentUser.id,
      action: "SYSTEM_RESET",
      entity_type: "organizations",
      entity_id: currentUser.organization_id,
      old_values: `Incomes: ${incomeCount}, Expenses: ${expenseCount}`,
      new_values: "Reset completed. Transaction records cleared."
    });

    res.json({ 
      success: true, 
      message: "System transaction data reset completed successfully.",
      incomeCount,
      expenseCount
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// =========================================================================
// 9. AUDIT LOGS
// =========================================================================
app.get("/api/audit-logs", requireOwner, (req, res) => {
  const logs = db.getAuditLogs();
  logs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  
  // Enrich audit logs with performer full name
  const enriched = logs.map(l => {
    const p = db.getProfileById(l.user_id);
    return {
      ...l,
      performer_name: p ? p.full_name : "System / Unknown",
    };
  });

  res.json({ logs: enriched });
});


// =========================================================================
// 10. RECEIPT FILE UPLOAD HANDLER
// =========================================================================
// Mock Upload: We accept files from forms, return a localized preview URL
app.post("/api/upload-receipt", requireAuth, (req, res) => {
  // Return a realistic mock uploaded receipt file path
  res.json({
    success: true,
    file_url: `/mock_receipt_${Math.floor(Math.random() * 1000)}.png`,
  });
});

// Serve uploaded avatars statically
app.use("/uploads", express.static(path.join(process.cwd(), "data", "uploads")));


// =========================================================================
// VITE MIDDLEWARE & STATIC SERVING CONFIGURATION
// =========================================================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
