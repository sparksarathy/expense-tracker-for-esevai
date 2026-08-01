/**
 * Client-side API Fallback Handler for Netlify Static Hosting & Firebase Firestore Sync.
 * When deployed as a static site (e.g. Netlify) without an Express backend, this interceptor
 * handles all /api/ requests directly on the client using Firebase Firestore & localStorage.
 */

import { Profile, ServiceCategory, IncomeEntry, ExpenseEntry, ApprovedUser } from "../types";
import { db } from "./firebase";
import { collection, doc, getDocs, setDoc, deleteDoc, query, where } from "firebase/firestore";

const STORAGE_KEYS = {
  AUTH_USER: "esevai_auth_user",
  INCOME: "esevai_income_entries",
  EXPENSE: "esevai_expense_entries",
  SERVICES: "esevai_service_categories",
  EMPLOYEES: "esevai_approved_users",
  PROFILES: "esevai_profiles",
};

const DEFAULT_APPROVED_USERS: ApprovedUser[] = [
  {
    id: "approved-owner-1",
    organization_id: "org-1",
    branch_id: "branch-1",
    email: "csb21090@gmail.com",
    role: "owner",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "approved-emp-1",
    organization_id: "org-1",
    branch_id: "branch-1",
    email: "employee1@esevai.com",
    role: "employee",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "approved-emp-2",
    organization_id: "org-1",
    branch_id: "branch-1",
    email: "employee2@esevai.com",
    role: "employee",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const DEFAULT_PROFILES: Profile[] = [
  {
    id: "user-csb21090",
    organization_id: "org-1",
    branch_id: "branch-1",
    full_name: "Owner (e-Sevai)",
    email: "csb21090@gmail.com",
    role: "owner",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "emp-1",
    organization_id: "org-1",
    branch_id: "branch-1",
    full_name: "Arun Kumar",
    email: "employee1@esevai.com",
    role: "employee",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const DEFAULT_SERVICES: ServiceCategory[] = [
  { id: "s-1", organization_id: "org-1", category_name: "Aadhaar Update", service_name: "Aadhaar Update", default_rate: 100, is_active: true, display_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "s-2", organization_id: "org-1", category_name: "PAN Card Service", service_name: "PAN Card Service", default_rate: 150, is_active: true, display_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "s-3", organization_id: "org-1", category_name: "Passport Service", service_name: "Passport Service", default_rate: 1500, is_active: true, display_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "s-4", organization_id: "org-1", category_name: "Voter ID Service", service_name: "Voter ID Service", default_rate: 100, is_active: true, display_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "s-5", organization_id: "org-1", category_name: "Income Certificate", service_name: "Income Certificate", default_rate: 80, is_active: true, display_order: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "s-6", organization_id: "org-1", category_name: "Community Certificate", service_name: "Community Certificate", default_rate: 80, is_active: true, display_order: 6, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "s-7", organization_id: "org-1", category_name: "Patta Chitta & EC Extraction", service_name: "Patta Chitta & EC Extraction", default_rate: 100, is_active: true, display_order: 7, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "s-8", organization_id: "org-1", category_name: "Electricity Bill Payment", service_name: "Electricity Bill Payment", default_rate: 50, is_active: true, display_order: 8, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

function getLocal<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Failed to save to localStorage:", err);
  }
}

function makeJsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Client-side endpoint router
export async function handleClientApiRequest(urlStr: string, options: RequestInit = {}): Promise<Response> {
  const url = new URL(urlStr, window.location.origin);
  const path = url.pathname;
  const method = (options.method || "GET").toUpperCase();

  let bodyData: any = {};
  if (options.body && typeof options.body === "string") {
    try {
      bodyData = JSON.parse(options.body);
    } catch {}
  }

  // --- 1. AUTH ENDPOINTS ---
  if (path === "/api/auth/me" && method === "GET") {
    const currentUser = getLocal<Profile | null>(STORAGE_KEYS.AUTH_USER, null);
    return makeJsonResponse({ user: currentUser });
  }

  if (path === "/api/auth/login" && method === "POST") {
    const { email, name } = bodyData;
    if (!email) {
      return makeJsonResponse({ error: "Email address is required." }, 400);
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Check approved list
    const approvedList = getLocal<ApprovedUser[]>(STORAGE_KEYS.EMPLOYEES, DEFAULT_APPROVED_USERS);
    const approvedUser = approvedList.find(
      (u) => u.email.toLowerCase() === cleanEmail && u.is_active
    ) || (cleanEmail === "csb21090@gmail.com" ? { role: "owner" as const } : null);

    if (!approvedUser) {
      return makeJsonResponse(
        { error: "Access denied. Your email is not pre-approved or has been deactivated." },
        403
      );
    }

    // Get or create profile
    const profiles = getLocal<Profile[]>(STORAGE_KEYS.PROFILES, DEFAULT_PROFILES);
    let profile = profiles.find((p) => p.email.toLowerCase() === cleanEmail);

    if (!profile) {
      profile = {
        id: "user-" + Math.random().toString(36).substr(2, 9),
        organization_id: "org-1",
        branch_id: "branch-1",
        full_name: name || cleanEmail.split("@")[0].replace(/[._-]/g, " "),
        email: cleanEmail,
        role: approvedUser.role || "employee",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      profiles.push(profile);
      setLocal(STORAGE_KEYS.PROFILES, profiles);
      
      // Save profile to Firestore
      try {
        await setDoc(doc(db, "profiles", profile.id), profile);
      } catch (e) {
        console.warn("Firestore sync warning:", e);
      }
    }

    setLocal(STORAGE_KEYS.AUTH_USER, profile);
    return makeJsonResponse({ user: profile });
  }

  if (path === "/api/auth/logout" && method === "POST") {
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    return makeJsonResponse({ success: true });
  }

  if (path === "/api/auth/approved-list" && method === "GET") {
    const profiles = getLocal<Profile[]>(STORAGE_KEYS.PROFILES, DEFAULT_PROFILES);
    return makeJsonResponse({ approved: profiles });
  }

  // --- 2. SERVICE CATEGORIES ENDPOINTS ---
  if ((path === "/api/service-categories" || path === "/api/services") && method === "GET") {
    const services = getLocal<ServiceCategory[]>(STORAGE_KEYS.SERVICES, DEFAULT_SERVICES);
    return makeJsonResponse({ categories: services, services });
  }

  if ((path === "/api/service-categories" || path === "/api/services") && method === "POST") {
    const services = getLocal<ServiceCategory[]>(STORAGE_KEYS.SERVICES, DEFAULT_SERVICES);
    const newService: ServiceCategory = {
      id: "s-" + Math.random().toString(36).substr(2, 9),
      organization_id: "org-1",
      category_name: bodyData.service_name || bodyData.category_name || "New Service",
      service_name: bodyData.service_name || bodyData.category_name || "New Service",
      default_rate: Number(bodyData.default_rate || 0),
      is_active: true,
      display_order: services.length + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    services.push(newService);
    setLocal(STORAGE_KEYS.SERVICES, services);
    return makeJsonResponse({ category: newService, service: newService });
  }

  // --- 3. INCOME ENTRIES ENDPOINTS ---
  if ((path === "/api/income-entries" || path === "/api/income") && method === "GET") {
    const entries = getLocal<IncomeEntry[]>(STORAGE_KEYS.INCOME, []);
    return makeJsonResponse({ entries });
  }

  if ((path === "/api/income-entries" || path === "/api/income") && method === "POST") {
    const currentUser = getLocal<Profile | null>(STORAGE_KEYS.AUTH_USER, null);
    const entries = getLocal<IncomeEntry[]>(STORAGE_KEYS.INCOME, []);
    
    const newEntry: IncomeEntry = {
      id: "inc-" + Math.random().toString(36).substr(2, 9),
      organization_id: currentUser?.organization_id || "org-1",
      branch_id: currentUser?.branch_id || "branch-1",
      employee_id: currentUser?.id || "unknown",
      customer_name: bodyData.customer_name || "Walk-in Customer",
      service_category_id: bodyData.service_category_id || "s-1",
      payment_method: bodyData.payment_method || "Cash in Hand",
      service_rate: Number(bodyData.service_rate || bodyData.charged_rate || 0),
      transaction_date: bodyData.transaction_date || new Date().toISOString().split("T")[0],
      notes: bodyData.notes || "",
      created_by: currentUser?.id || "unknown",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      listed_rate: Number(bodyData.listed_rate || 0),
      charged_rate: Number(bodyData.charged_rate || bodyData.service_rate || 0),
      rate_overridden: Boolean(bodyData.rate_overridden),
      rate_override_reason: bodyData.rate_override_reason || "",
    };

    entries.unshift(newEntry);
    setLocal(STORAGE_KEYS.INCOME, entries);

    try {
      await setDoc(doc(db, "incomeEntries", newEntry.id), newEntry);
    } catch (e) {
      console.warn("Firestore sync warning:", e);
    }

    return makeJsonResponse({ success: true, entry: newEntry });
  }

  if ((path.startsWith("/api/income-entries/") || path.startsWith("/api/income/")) && method === "DELETE") {
    const id = path.replace("/api/income-entries/", "").replace("/api/income/", "");
    let entries = getLocal<IncomeEntry[]>(STORAGE_KEYS.INCOME, []);
    entries = entries.filter((e) => e.id !== id);
    setLocal(STORAGE_KEYS.INCOME, entries);

    try {
      await deleteDoc(doc(db, "incomeEntries", id));
    } catch (e) {
      console.warn("Firestore delete error:", e);
    }

    return makeJsonResponse({ success: true });
  }

  // --- 4. EXPENSE ENTRIES ENDPOINTS ---
  if ((path === "/api/expense-entries" || path === "/api/expense") && method === "GET") {
    const entries = getLocal<ExpenseEntry[]>(STORAGE_KEYS.EXPENSE, []);
    return makeJsonResponse({ entries });
  }

  if ((path === "/api/expense-entries" || path === "/api/expense") && method === "POST") {
    const currentUser = getLocal<Profile | null>(STORAGE_KEYS.AUTH_USER, null);
    const entries = getLocal<ExpenseEntry[]>(STORAGE_KEYS.EXPENSE, []);

    const newEntry: ExpenseEntry = {
      id: "exp-" + Math.random().toString(36).substr(2, 9),
      organization_id: currentUser?.organization_id || "org-1",
      branch_id: currentUser?.branch_id || "branch-1",
      employee_id: currentUser?.id || "unknown",
      expense_category_id: bodyData.expense_category_id || "cat-1",
      description: bodyData.description || "Expense Item",
      amount: Number(bodyData.amount || 0),
      payment_method: bodyData.payment_method || "Cash in Hand",
      transaction_date: bodyData.transaction_date || new Date().toISOString().split("T")[0],
      notes: bodyData.notes || "",
      created_by: currentUser?.id || "unknown",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    entries.unshift(newEntry);
    setLocal(STORAGE_KEYS.EXPENSE, entries);

    try {
      await setDoc(doc(db, "expenseEntries", newEntry.id), newEntry);
    } catch (e) {
      console.warn("Firestore sync warning:", e);
    }

    return makeJsonResponse({ success: true, entry: newEntry });
  }

  if ((path.startsWith("/api/expense-entries/") || path.startsWith("/api/expense/")) && method === "DELETE") {
    const id = path.replace("/api/expense-entries/", "").replace("/api/expense/", "");
    let entries = getLocal<ExpenseEntry[]>(STORAGE_KEYS.EXPENSE, []);
    entries = entries.filter((e) => e.id !== id);
    setLocal(STORAGE_KEYS.EXPENSE, entries);

    try {
      await deleteDoc(doc(db, "expenseEntries", id));
    } catch (e) {
      console.warn("Firestore delete error:", e);
    }

    return makeJsonResponse({ success: true });
  }

  if (path === "/api/expense-categories" && method === "GET") {
    return makeJsonResponse({
      categories: [
        { id: "cat-1", category_name: "Rent & Utilities", description: "Office rent, power bills, water", is_active: true },
        { id: "cat-2", category_name: "Stationery & Paper", description: "A4 sheets, printing ink, envelopes", is_active: true },
        { id: "cat-3", category_name: "Internet & Telecom", description: "Broadband bill, mobile recharges", is_active: true },
        { id: "cat-4", category_name: "Staff Refreshment", description: "Tea, snacks, water bottles", is_active: true },
        { id: "cat-5", category_name: "Miscellaneous", description: "Other expenses", is_active: true },
      ]
    });
  }

  // --- 5. EMPLOYEES ENDPOINTS ---
  if (path === "/api/employees" && method === "GET") {
    const approved = getLocal<ApprovedUser[]>(STORAGE_KEYS.EMPLOYEES, DEFAULT_APPROVED_USERS);
    const profiles = getLocal<Profile[]>(STORAGE_KEYS.PROFILES, DEFAULT_PROFILES);
    return makeJsonResponse({ employees: profiles, profiles, approved });
  }

  if (path === "/api/employees" && method === "POST") {
    const approved = getLocal<ApprovedUser[]>(STORAGE_KEYS.EMPLOYEES, DEFAULT_APPROVED_USERS);
    const profiles = getLocal<Profile[]>(STORAGE_KEYS.PROFILES, DEFAULT_PROFILES);
    const email = (bodyData.email || "").trim().toLowerCase();

    const newEmp: ApprovedUser = {
      id: "emp-" + Math.random().toString(36).substr(2, 9),
      organization_id: "org-1",
      branch_id: "branch-1",
      email,
      role: bodyData.role || "employee",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    approved.push(newEmp);
    setLocal(STORAGE_KEYS.EMPLOYEES, approved);

    const newProfile: Profile = {
      id: newEmp.id,
      organization_id: "org-1",
      branch_id: "branch-1",
      full_name: bodyData.full_name || email.split("@")[0],
      email,
      role: bodyData.role || "employee",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    profiles.push(newProfile);
    setLocal(STORAGE_KEYS.PROFILES, profiles);

    return makeJsonResponse({ employee: newProfile, approved: newEmp });
  }

  // --- 6. BRANCHES & SETTINGS ENDPOINTS ---
  if (path === "/api/branches" && method === "GET") {
    return makeJsonResponse({
      branches: [
        { id: "branch-1", organization_id: "org-1", branch_name: "Main Branch - Tenkasi", city: "Tenkasi", is_active: true }
      ]
    });
  }

  if (path === "/api/settings" && method === "GET") {
    return makeJsonResponse({
      settings: {
        allow_employee_editing: true,
        employee_editing_limit_hours: 24,
        allow_employee_rate_override: true,
        require_expense_receipt: false
      }
    });
  }

  if (path === "/api/settings" && method === "PUT") {
    return makeJsonResponse({ success: true });
  }

  // --- 7. REPORTS ENDPOINTS ---
  if (path.startsWith("/api/reports") && method === "GET") {
    const income = getLocal<IncomeEntry[]>(STORAGE_KEYS.INCOME, []);
    const expense = getLocal<ExpenseEntry[]>(STORAGE_KEYS.EXPENSE, []);

    const dateFrom = url.searchParams.get("date_from") || "";
    const dateTo = url.searchParams.get("date_to") || "";

    const filteredIncome = income.filter((i) => {
      if (dateFrom && i.transaction_date < dateFrom) return false;
      if (dateTo && i.transaction_date > dateTo) return false;
      return true;
    });

    const filteredExpense = expense.filter((e) => {
      if (dateFrom && e.transaction_date < dateFrom) return false;
      if (dateTo && e.transaction_date > dateTo) return false;
      return true;
    });

    const totalIncome = filteredIncome.reduce((acc, curr) => acc + (curr.service_rate || 0), 0);
    const totalExpense = filteredExpense.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const netProfit = totalIncome - totalExpense;

    const cashReceived = filteredIncome.filter(i => i.payment_method === "Cash in Hand").reduce((acc, c) => acc + (c.service_rate || 0), 0);
    const gpayReceived = filteredIncome.filter(i => i.payment_method === "GPay").reduce((acc, c) => acc + (c.service_rate || 0), 0);

    const services = getLocal<ServiceCategory[]>(STORAGE_KEYS.SERVICES, DEFAULT_SERVICES);
    const revenueByCategoryMap: { [key: string]: { amount: number; count: number } } = {};
    filteredIncome.forEach(inc => {
      const cat = services.find(c => c.id === inc.service_category_id);
      const resolvedName = cat ? cat.category_name : (inc.service_category_id || "General");
      if (!revenueByCategoryMap[resolvedName]) {
        revenueByCategoryMap[resolvedName] = { amount: 0, count: 0 };
      }
      revenueByCategoryMap[resolvedName].amount += (inc.service_rate || 0);
      revenueByCategoryMap[resolvedName].count += 1;
    });

    const revenueByCategory = Object.entries(revenueByCategoryMap).map(([name, stats]) => ({
      category_name: name,
      amount: stats.amount,
      count: stats.count
    })).sort((a, b) => b.amount - a.amount);

    const expensesByCategory: any[] = [];
    const profiles = getLocal<Profile[]>(STORAGE_KEYS.PROFILES, DEFAULT_PROFILES);
    const revenueByEmployee = profiles.map(p => {
      const empIncomes = filteredIncome.filter(i => i.employee_id === p.id);
      const empExpenses = filteredExpense.filter(e => e.employee_id === p.id);
      const revenue = empIncomes.reduce((acc, curr) => acc + (curr.service_rate || 0), 0);
      const count = empIncomes.length;
      const expenseAmt = empExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
      return {
        id: p.id,
        full_name: p.full_name,
        revenue,
        count,
        expenses: expenseAmt,
        net: revenue - expenseAmt,
      };
    }).filter(e => e.count > 0 || e.expenses > 0).sort((a,b) => b.revenue - a.revenue);

    const datesSet = new Set([...filteredIncome.map(i => i.transaction_date), ...filteredExpense.map(e => e.transaction_date)]);
    const dailyBreakdown = Array.from(datesSet).map(dateStr => {
      const dayIncomes = filteredIncome.filter(i => i.transaction_date === dateStr).reduce((acc, curr) => acc + (curr.service_rate || 0), 0);
      const dayExpenses = filteredExpense.filter(e => e.transaction_date === dateStr).reduce((acc, curr) => acc + (curr.amount || 0), 0);
      return {
        date: dateStr,
        income: dayIncomes,
        expense: dayExpenses,
        profit: dayIncomes - dayExpenses,
      };
    }).sort((a,b) => a.date.localeCompare(b.date));

    return makeJsonResponse({
      summary: {
        totalIncome,
        totalExpense,
        netProfit,
        cashReceived,
        gpayReceived,
        totalTransactions: filteredIncome.length + filteredExpense.length,
        avgTransactionValue: filteredIncome.length > 0 ? Number((totalIncome / filteredIncome.length).toFixed(2)) : 0,
        incomeCount: filteredIncome.length,
        expenseCount: filteredExpense.length,
      },
      revenueByCategory,
      expensesByCategory,
      revenueByEmployee,
      dailyBreakdown,
      incomes: filteredIncome,
      expenses: filteredExpense,
    });
  }

  // --- 8. TRANSACTIONS ENDPOINT ---
  if (path.startsWith("/api/transactions") && method === "GET") {
    const income = getLocal<IncomeEntry[]>(STORAGE_KEYS.INCOME, []);
    const expense = getLocal<ExpenseEntry[]>(STORAGE_KEYS.EXPENSE, []);
    return makeJsonResponse({ income, expense });
  }

  if (path === "/api/audit-logs" && method === "GET") {
    return makeJsonResponse({ logs: [] });
  }

  // Default fallback response
  return makeJsonResponse({ message: "OK" });
}

// Global fetch patcher
export function patchFetchForClientFallback() {
  if (typeof window === "undefined") return;

  const originalFetch = window.fetch ? window.fetch.bind(window) : null;
  if (!originalFetch) return;

  const customFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    // Only intercept /api/ requests
    if (urlStr.includes("/api/")) {
      try {
        const response = await originalFetch(input, init);
        
        // If response is HTML (e.g. Netlify static server returning index.html for /api routes with 200/404)
        // or if status is 404, 405, or not ok, route to client API handler
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/html") || response.status === 404 || response.status === 405 || !response.ok) {
          return await handleClientApiRequest(urlStr, init);
        }

        return response;
      } catch (networkError) {
        // Network error (e.g. no backend server running on Netlify or offline)
        return await handleClientApiRequest(urlStr, init);
      }
    }

    return originalFetch(input, init);
  };

  try {
    Object.defineProperty(window, 'fetch', {
      value: customFetch,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  } catch (e) {
    try {
      Object.defineProperty(Object.getPrototypeOf(window), 'fetch', {
        value: customFetch,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch (err) {
      console.warn("Could not patch window.fetch:", err);
    }
  }
}
