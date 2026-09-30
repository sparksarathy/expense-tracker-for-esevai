/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Profile, IncomeEntry, ExpenseEntry, ServiceCategory, AppSettings } from "../types";

const STORAGE_KEYS = {
  USER: "esevai_auth_user",
  TOKEN: "esevai_auth_token",
  REMEMBER: "esevai_remember_me",
  INCOMES: "esevai_cached_incomes",
  EXPENSES: "esevai_cached_expenses",
  SERVICES: "esevai_cached_services",
  REPORT: "esevai_cached_report",
  SETTINGS: "esevai_cached_app_settings",
  PENDING_QUEUE: "esevai_pending_queue",
  LAST_SYNC: "esevai_last_sync_timestamp",
};

/**
 * Safe JSON parser for localStorage
 */
function safeGet<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`Failed reading localStorage key ${key}:`, e);
    return defaultValue;
  }
}

/**
 * Safe JSON setter for localStorage
 */
function safeSet(key: string, value: any): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed writing localStorage key ${key}:`, e);
  }
}

// =========================================================================
// AUTHENTICATION & SESSION RESTORE
// =========================================================================

export function getCachedUser(): Profile | null {
  return safeGet<Profile | null>(STORAGE_KEYS.USER, null);
}

export function getCachedToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

export function setCachedSession(user: Profile | null, token?: string, remember: boolean = true): void {
  if (typeof window === "undefined") return;
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    return;
  }
  safeSet(STORAGE_KEYS.USER, user);
  if (token) {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  } else if (user.id) {
    localStorage.setItem(STORAGE_KEYS.TOKEN, user.id);
  }
  localStorage.setItem(STORAGE_KEYS.REMEMBER, remember ? "true" : "false");
}

export function clearCachedSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
}

// =========================================================================
// DATA CACHING & RESTORATION (Meaning 3)
// =========================================================================

export function getCachedIncomes(): IncomeEntry[] {
  return safeGet<IncomeEntry[]>(STORAGE_KEYS.INCOMES, []);
}

export function setCachedIncomes(incomes: IncomeEntry[]): void {
  safeSet(STORAGE_KEYS.INCOMES, incomes);
  setLastSyncTime();
}

export function appendCachedIncome(income: IncomeEntry): void {
  const current = getCachedIncomes();
  // Avoid duplicates
  const filtered = current.filter(i => i.id !== income.id);
  safeSet(STORAGE_KEYS.INCOMES, [income, ...filtered]);
}

export function getCachedExpenses(): ExpenseEntry[] {
  return safeGet<ExpenseEntry[]>(STORAGE_KEYS.EXPENSES, []);
}

export function setCachedExpenses(expenses: ExpenseEntry[]): void {
  safeSet(STORAGE_KEYS.EXPENSES, expenses);
  setLastSyncTime();
}

export function appendCachedExpense(expense: ExpenseEntry): void {
  const current = getCachedExpenses();
  const filtered = current.filter(e => e.id !== expense.id);
  safeSet(STORAGE_KEYS.EXPENSES, [expense, ...filtered]);
}

export function getCachedServices(): ServiceCategory[] {
  return safeGet<ServiceCategory[]>(STORAGE_KEYS.SERVICES, []);
}

export function setCachedServices(services: ServiceCategory[]): void {
  safeSet(STORAGE_KEYS.SERVICES, services);
}

export function getCachedReport(): any | null {
  return safeGet<any | null>(STORAGE_KEYS.REPORT, null);
}

export function setCachedReport(report: any): void {
  safeSet(STORAGE_KEYS.REPORT, report);
}

export function getCachedAppSettings(): AppSettings | null {
  return safeGet<AppSettings | null>(STORAGE_KEYS.SETTINGS, null);
}

export function setCachedAppSettings(settings: AppSettings): void {
  safeSet(STORAGE_KEYS.SETTINGS, settings);
}

// =========================================================================
// OFFLINE QUEUE (For when employee records entries without internet)
// =========================================================================

export interface PendingQueueItem {
  id: string;
  type: "income" | "expense";
  payload: any;
  createdAt: string;
}

export function getPendingQueue(): PendingQueueItem[] {
  return safeGet<PendingQueueItem[]>(STORAGE_KEYS.PENDING_QUEUE, []);
}

export function addToPendingQueue(type: "income" | "expense", payload: any): void {
  const current = getPendingQueue();
  const item: PendingQueueItem = {
    id: "offline-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
  safeSet(STORAGE_KEYS.PENDING_QUEUE, [...current, item]);
}

export function removeFromPendingQueue(id: string): void {
  const current = getPendingQueue();
  safeSet(STORAGE_KEYS.PENDING_QUEUE, current.filter(i => i.id !== id));
}

export function clearPendingQueue(): void {
  safeSet(STORAGE_KEYS.PENDING_QUEUE, []);
}

// =========================================================================
// SYNC METADATA & BACKUP / RESTORE UTILITIES
// =========================================================================

export function getLastSyncTime(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
}

export function setLastSyncTime(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
}

/**
 * Helper to merge arrays of records by id without losing existing entries
 */
function mergeRecordsById<T extends { id?: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  (existing || []).forEach((item) => {
    if (item && item.id) map.set(item.id, item);
  });
  (incoming || []).forEach((item) => {
    if (item && item.id) {
      map.set(item.id, { ...(map.get(item.id) || {}), ...item });
    }
  });
  return Array.from(map.values());
}

/**
 * Exports all local data into a JSON file for the employee / admin to save as an offline backup
 */
export function exportLocalBackup(): void {
  const cachedReport = getCachedReport();
  const allIncomes = mergeRecordsById<IncomeEntry>(
    getCachedIncomes(),
    Array.isArray(cachedReport?.incomes) ? cachedReport.incomes : []
  );
  const allExpenses = mergeRecordsById<ExpenseEntry>(
    getCachedExpenses(),
    Array.isArray(cachedReport?.expenses) ? cachedReport.expenses : []
  );

  const backup = {
    app: "e-Sevai Maiyam Manager",
    exported_at: new Date().toISOString(),
    user: getCachedUser(),
    incomes: allIncomes,
    expenses: allExpenses,
    services: getCachedServices(),
    settings: getCachedAppSettings(),
    report: cachedReport,
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStr = new Date().toISOString().split("T")[0];
  link.href = url;
  link.download = `esevai_data_backup_${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Restores local cache from an imported JSON backup (merging with existing records so previous data is never deleted)
 * and returns parsed arrays for server persistence.
 */
export function importLocalBackup(jsonString: string): {
  success: boolean;
  message: string;
  count?: number;
  payload?: { incomes: any[]; expenses: any[]; services: any[]; report?: any };
} {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== "object") {
      return { success: false, message: "Invalid backup file format." };
    }

    const incomingIncomes = mergeRecordsById<IncomeEntry>(
      Array.isArray(data.incomes) ? data.incomes : Array.isArray(data.income_entries) ? data.income_entries : [],
      Array.isArray(data.report?.incomes) ? data.report.incomes : []
    );

    const incomingExpenses = mergeRecordsById<ExpenseEntry>(
      Array.isArray(data.expenses) ? data.expenses : Array.isArray(data.expense_entries) ? data.expense_entries : [],
      Array.isArray(data.report?.expenses) ? data.report.expenses : []
    );

    const incomingServices = Array.isArray(data.services)
      ? data.services
      : Array.isArray(data.service_categories)
      ? data.service_categories
      : [];

    const mergedIncomes = mergeRecordsById<IncomeEntry>(getCachedIncomes(), incomingIncomes);
    const mergedExpenses = mergeRecordsById<ExpenseEntry>(getCachedExpenses(), incomingExpenses);

    setCachedIncomes(mergedIncomes);
    setCachedExpenses(mergedExpenses);

    if (incomingServices.length > 0) {
      const mergedServices = mergeRecordsById<ServiceCategory>(getCachedServices(), incomingServices);
      setCachedServices(mergedServices);
    }

    if (data.settings) {
      setCachedAppSettings(data.settings);
    }

    if (data.report) {
      setCachedReport({
        ...data.report,
        incomes: mergedIncomes,
        expenses: mergedExpenses,
      });
    }
    setLastSyncTime();

    const restoredCount = incomingIncomes.length + incomingExpenses.length;

    return {
      success: true,
      message: `Successfully restored and merged ${incomingIncomes.length} income records and ${incomingExpenses.length} expense records from backup!`,
      count: restoredCount,
      payload: {
        incomes: mergedIncomes,
        expenses: mergedExpenses,
        services: incomingServices,
        report: data.report,
      },
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to parse backup JSON." };
  }
}

// =========================================================================
// UNIVERSAL AUTHENTICATED FETCH
// Passes Authorization Bearer header so Netlify proxy / cross-domain never drops sessions!
// =========================================================================

export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});

  const token = getCachedToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("x-user-id", token);
  }

  // Ensure content-type for POST/PUT if sending body
  if (init?.body && !headers.has("Content-Type") && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...init,
    headers,
    credentials: "include", // also sends cookies
  });
}
