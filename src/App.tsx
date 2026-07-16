/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
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
  MapPin,
  Clock
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // High-frequency refresh trigger for charts
  const [refreshCounter, setRefreshCounter] = useState(0);

  const checkSession = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error("Session sync failed:", e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        setUser(null);
        setActiveTab("Dashboard");
      }
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleRefreshTrigger = () => {
    setRefreshCounter((prev) => prev + 1);
  };

  const navigateTo = (tabName: string) => {
    setActiveTab(tabName);
    setMobileMenuOpen(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col justify-center items-center">
        <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
        <h2 className="text-white font-display font-semibold text-sm mt-4 tracking-wider uppercase">e-Sevai Roster Sync...</h2>
        <p className="text-slate-400 text-[10px] font-mono mt-1">Verifying Google OAuth Session Tokens</p>
      </div>
    );
  }

  // If unauthenticated, redirect to Login panel
  if (!user) {
    return <Login onLoginSuccess={checkSession} />;
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

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
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
            <p className="text-xs text-blue-300 opacity-80 mt-1 uppercase tracking-widest">Manager v1.0</p>
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

        {/* User profile details block */}
        <div className="border-t border-blue-800/50 pt-5 space-y-4" id="sidebar-footer">
          
          <div className="flex items-center gap-3">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-blue-400 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white shrink-0 shadow-sm text-sm">
                {user.full_name ? user.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "EM"}
              </div>
            )}
            <div className="space-y-0.5 truncate text-left">
              <h4 className="text-sm font-semibold text-white truncate leading-tight">{user.full_name}</h4>
              <span className="text-[10px] uppercase tracking-wider font-bold text-blue-300 opacity-80 block font-mono">
                {user.role === "owner" ? "Owner/Admin" : "Desk Staff"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 bg-white/5 p-2.5 rounded-lg border border-blue-800/30 text-[10px] text-blue-200 font-mono" id="center-timezone">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-blue-400" />
                <span>Zone:</span>
              </span>
              <span className="font-semibold text-blue-100">IST</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-400" />
                <span>Format:</span>
              </span>
              <span className="font-semibold text-blue-100">DD/MM/YYYY</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs rounded transition-colors uppercase font-bold tracking-widest"
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
    </div>
  );
}
