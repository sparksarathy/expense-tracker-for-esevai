/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Profile } from "./types";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import IncomeForm from "./components/IncomeForm";
import ExpenseForm from "./components/ExpenseForm";
import Transactions from "./components/Transactions";
import Reports from "./components/Reports";
import EmployeeManagement from "./components/EmployeeManagement";
import ServiceCategories from "./components/ServiceCategories";
import Settings from "./components/Settings";
import {
  getCachedUser,
  setCachedSession,
  clearCachedSession,
  authFetch,
  getCachedIncomes,
  getCachedExpenses,
  setCachedIncomes,
  setCachedExpenses,
  exportLocalBackup,
  importLocalBackup,
  getPendingQueue,
  removeFromPendingQueue,
  getLastSyncTime,
  setLastSyncTime
} from "./lib/offlineStorage";

import {
  LayoutDashboard,
  PlusCircle,
  MinusCircle,
  BookOpen,
  TrendingUp,
  Users,
  Settings as SettingsIcon,
  Layers,
  LogOut,
  Menu,
  X,
  RefreshCw,
  Wifi,
  WifiOff,
  Database,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export default function App() {
  // Meaning 3: Auto-restore user immediately on startup from localStorage
  const [user, setUser] = useState<Profile | null>(() => getCachedUser());
  const [loading, setLoading] = useState<boolean>(() => !getCachedUser());
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // High-frequency refresh trigger for charts & tables
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Backup & Restore Modal State
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Network connectivity state
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  // Background queue flusher when back online
  const syncPendingOfflineQueue = async () => {
    const queue = getPendingQueue();
    if (queue.length === 0) return;
    console.log(`[Offline Sync] Syncing ${queue.length} pending offline transactions...`);
    for (const item of queue) {
      try {
        const endpoint = item.type === "income" ? "/api/income-entries" : "/api/expense-entries";
        const res = await authFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });
        if (res.ok) {
          removeFromPendingQueue(item.id);
        }
      } catch (err) {
        console.warn("Sync queue item failed, will retry later:", err);
      }
    }
    setRefreshCounter((prev) => prev + 1);
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const checkSession = async () => {
    try {
      const res = await authFetch("/api/auth/me");
      if (res.ok) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (data.user) {
          setUser(data.user);
          setCachedSession(data.user);
          // Sync any pending items saved while offline
          syncPendingOfflineQueue();
        } else if (!getCachedUser()) {
          setUser(null);
        }
      } else if (res.status === 401) {
        // Explicitly unauthorized (e.g. account removed or deactivated)
        clearCachedSession();
        setUser(null);
      }
    } catch (e) {
      // Server sleeping/cold-start or offline: keep cached user logged in!
      console.warn("Session check in offline/standby mode:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      await authFetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.warn("Logout failed:", err);
    } finally {
      clearCachedSession();
      setUser(null);
      setActiveTab("Dashboard");
    }
  };

  const handleRefreshTrigger = () => {
    setRefreshCounter((prev) => prev + 1);
  };

  const navigateTo = (tabName: string) => {
    setActiveTab(tabName);
    setMobileMenuOpen(false);
  };

  // Restore All Data from Cloud Database
  const handleRestoreFromCloud = async () => {
    setRestoreLoading(true);
    setRestoreMessage(null);
    try {
      const [incRes, expRes, catRes] = await Promise.all([
        authFetch("/api/income-entries"),
        authFetch("/api/expense-entries"),
        authFetch("/api/service-categories"),
      ]);

      let incCount = 0;
      let expCount = 0;

      if (incRes.ok) {
        const incData = await incRes.json();
        setCachedIncomes(incData.entries || []);
        incCount = (incData.entries || []).length;
      }
      if (expRes.ok) {
        const expData = await expRes.json();
        setCachedExpenses(expData.entries || []);
        expCount = (expData.entries || []).length;
      }
      setLastSyncTime();
      setRestoreMessage(`Restored ${incCount} income records and ${expCount} expense records to local device storage!`);
      handleRefreshTrigger();
    } catch (err: any) {
      setRestoreMessage(`Restore failed: ${err?.message || "Check your internet connection."}`);
    } finally {
      setRestoreLoading(false);
    }
  };

  // Import Backup from File
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importLocalBackup(content);
      if (res.success) {
        setRestoreMessage(res.message);
        handleRefreshTrigger();
      } else {
        setRestoreMessage("Error: " + res.message);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (loading && !user) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col justify-center items-center">
        <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
        <h2 className="text-white font-display font-semibold text-sm mt-4 tracking-wider uppercase">Restoring e-Sevai Workspace...</h2>
        <p className="text-slate-400 text-[10px] font-mono mt-1">Loading locally cached employee profile</p>
      </div>
    );
  }

  // If unauthenticated, redirect to Login panel
  if (!user) {
    return <Login onLoginSuccess={(u) => { setUser(u); checkSession(); }} />;
  }

  // Navigation Links
  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard, role: "employee" },
    { name: "Income Entry", icon: PlusCircle, role: "employee" },
    { name: "Expense Entry", icon: MinusCircle, role: "employee" },
    { name: "Ledgers", icon: BookOpen, role: "employee" },
    { name: "Reports", icon: TrendingUp, role: "employee" },
    { name: "Employee Access", icon: Users, role: "owner" },
    { name: "Service Catalog", icon: Layers, role: "owner" },
    { name: "Security Policies", icon: SettingsIcon, role: "owner" },
  ];

  const visibleNavItems = navItems.filter((item) => {
    if (item.role === "owner") {
      return user.role === "owner";
    }
    return true;
  });

  const cachedIncomesCount = getCachedIncomes().length;
  const cachedExpensesCount = getCachedExpenses().length;
  const pendingCount = getPendingQueue().length;
  const lastSyncStr = getLastSyncTime() ? new Date(getLastSyncTime()!).toLocaleTimeString() : "Restored on open";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900" id="main-application-frame">
      
      {/* Mobile Top Navigation Bar (Hidden on Desktop) */}
      <header className="md:hidden bg-[#1e3a8a] text-white px-4 py-3.5 flex items-center justify-between shadow-md z-40 no-print" id="mobile-app-bar">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/10 rounded-lg text-white font-bold text-xs uppercase tracking-wider">
            eS
          </div>
          <div>
            <h1 className="font-display font-bold text-sm tracking-wide uppercase">e-Sevai Maiyam</h1>
            <p className="text-[9px] text-blue-200 uppercase tracking-widest font-semibold">Manager v1.0</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBackupModal(true)}
            className="p-1.5 bg-white/10 rounded-lg text-emerald-300 text-xs flex items-center gap-1 font-semibold"
            title="Local Data & Restore"
          >
            <Database className="w-4 h-4" />
            <span className="text-[10px] hidden sm:inline">Restored</span>
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Primary Sidebar Layout (Desktop Fixed, Mobile Drawer Overlay) */}
      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 bg-[#1e3a8a] text-white w-64 p-6 flex flex-col justify-between shadow-2xl z-45 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:shadow-none no-print ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-6">
          
          {/* Logo block */}
          <div className="flex flex-col border-b border-blue-800/50 pb-5" id="sidebar-logo-block">
            <h1 className="text-xl font-bold tracking-tight uppercase">e-Sevai Maiyam</h1>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-blue-300 opacity-80 uppercase tracking-widest">Manager v1.0</p>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-200 px-1.5 py-0.5 rounded border border-emerald-400/30 font-mono">
                Auto-Restore
              </span>
            </div>
          </div>

          {/* Nav Items List */}
          <nav className="space-y-1" id="sidebar-navigation">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => navigateTo(item.name)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                    isActive
                      ? "bg-white/10 text-white shadow-sm"
                      : "hover:bg-white/5 text-blue-100 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile & Data status footer */}
        <div className="border-t border-blue-800/50 pt-5 space-y-3" id="sidebar-footer">
          
          {/* Data Backup & Auto-Restore Button */}
          <button
            onClick={() => setShowBackupModal(true)}
            className="w-full flex items-center justify-between px-3 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-xs text-blue-100 transition-all cursor-pointer border border-white/10"
            id="open-data-restore-modal"
          >
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="text-left">
                <span className="font-semibold block text-[11px] leading-tight">Data Restored</span>
                <span className="text-[9px] text-blue-200 font-mono">{cachedIncomesCount + cachedExpensesCount} records local</span>
              </div>
            </div>
            {pendingCount > 0 && (
              <span className="text-[9px] bg-amber-400 text-amber-950 font-bold px-1.5 py-0.5 rounded-full">
                {pendingCount} offline
              </span>
            )}
          </button>

          {/* Network Connectivity Status Indicator */}
          <div
            className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              isOnline
                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-200"
                : "bg-amber-950/70 border-amber-500/60 text-amber-100 animate-pulse shadow-md"
            }`}
            id="network-status-indicator"
          >
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate text-[11px]">Synced to Cloud</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="truncate text-[11px]">Offline (Local Storage Active)</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover border border-blue-400 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white shrink-0 shadow-sm text-xs">
                {user.full_name ? user.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "EM"}
              </div>
            )}
            <div className="space-y-0.5 truncate text-left">
              <h4 className="text-xs font-semibold text-white truncate leading-tight">{user.full_name}</h4>
              <span className="text-[9px] uppercase tracking-wider font-bold text-blue-300 opacity-80 block font-mono">
                {user.role === "owner" ? "Owner/Admin" : "Desk Staff"}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs rounded transition-colors uppercase font-bold tracking-widest cursor-pointer"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Overlay Backdrop (Hidden on Desktop) */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden"
          id="mobile-overlay-backdrop"
        />
      )}

      {/* Main Workspace Frame */}
      <main className="flex-1 min-w-0" id="workspace-viewport">
        {!isOnline && (
          <div className="bg-amber-50 border-b border-amber-300 px-4 py-2 flex items-center justify-between text-amber-900 text-xs font-medium shadow-xs" id="workspace-offline-alert">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Offline Mode Active:</strong> You can continue entering incomes and expenses. All records are saved securely in your browser and will automatically restore and sync when internet reconnects.
              </span>
            </div>
          </div>
        )}
        {activeTab === "Dashboard" && (
          <Dashboard user={user} refreshCounter={refreshCounter} onNavigate={navigateTo} />
        )}
        {activeTab === "Income Entry" && (
          <IncomeForm user={user} onSuccess={handleRefreshTrigger} onNavigate={navigateTo} />
        )}
        {activeTab === "Expense Entry" && (
          <ExpenseForm user={user} onSuccess={handleRefreshTrigger} onNavigate={navigateTo} />
        )}
        {activeTab === "Ledgers" && (
          <Transactions user={user} onRefreshTrigger={handleRefreshTrigger} />
        )}
        {activeTab === "Reports" && (
          <Reports user={user} />
        )}
        {activeTab === "Employee Access" && user.role === "owner" && (
          <EmployeeManagement user={user} onRefresh={handleRefreshTrigger} />
        )}
        {activeTab === "Service Catalog" && user.role === "owner" && (
          <ServiceCategories user={user} />
        )}
        {activeTab === "Security Policies" && user.role === "owner" && (
          <Settings user={user} />
        )}
      </main>

      {/* ========================================================================= */}
      {/* MEANING 3: LOCAL DATA BACKUP & RESTORE DIALOG MODAL */}
      {/* ========================================================================= */}
      {showBackupModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-700">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Employee Data Storage & Restore</h3>
                  <p className="text-xs text-slate-500">Persistent local storage keeps your records safe on this device</p>
                </div>
              </div>
              <button
                onClick={() => setShowBackupModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {restoreMessage && (
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="font-medium">{restoreMessage}</p>
              </div>
            )}

            {/* Storage Status Card */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Cached Incomes</span>
                <span className="text-xl font-bold text-emerald-700 font-mono">{cachedIncomesCount}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">entries saved locally</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Cached Expenses</span>
                <span className="text-xl font-bold text-rose-700 font-mono">{cachedExpensesCount}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">entries saved locally</span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Auto-Restore Status: Active</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Every time an employee opens this app on this device, their login session and all recorded transaction data are restored immediately from local storage.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleRestoreFromCloud}
                disabled={restoreLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#1e3a8a] hover:bg-blue-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {restoreLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Syncing & Restoring from Server...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh & Restore Latest Data from Server</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={exportLocalBackup}
                  type="button"
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-slate-200 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>Download Backup (.json)</span>
                </button>

                <label className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-slate-200 cursor-pointer">
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span>Import Backup (.json)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowBackupModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
