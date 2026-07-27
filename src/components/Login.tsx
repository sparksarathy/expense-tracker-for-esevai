/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Profile } from "../types";
import { LogIn, ShieldAlert, CheckCircle, RefreshCw } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (user: Profile) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quickLoginList, setQuickLoginList] = useState<Profile[]>([]);

  useEffect(() => {
    // Fetch pre-approved list for the emulator quick selection
    fetch("/api/auth/approved-list")
      .then(async (res) => {
        const text = await res.text();
        return text ? JSON.parse(text) : {};
      })
      .then((data) => {
        if (data && data.approved) {
          setQuickLoginList(data.approved);
        }
      })
      .catch((err) => console.error("Error loading emulator logins:", err));
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseErr) {
        throw new Error(`Server returned invalid response (${res.status} ${res.statusText || ""}). Please try again.`);
      }

      if (!res.ok) {
        throw new Error(data.error || `Login failed (${res.status})`);
      }

      if (!data.user) {
        throw new Error("Login failed: User data was not returned by server.");
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (p: Profile) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: p.email, name: p.full_name }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseErr) {
        throw new Error(`Server returned invalid response (${res.status} ${res.statusText || ""}). Please try again.`);
      }

      if (!res.ok) {
        throw new Error(data.error || `Quick login failed (${res.status})`);
      }

      if (!data.user) {
        throw new Error("Quick login failed: User data was not returned by server.");
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-slate-50 py-12" id="login-screen">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden" id="login-card">
        
        {/* Banner */}
        <div className="bg-gradient-to-br from-[#1e3a8a] to-slate-900 px-6 py-8 text-center text-white">
          <div className="inline-flex p-3 bg-white/10 rounded-2xl mb-3 backdrop-blur-sm">
            <LogIn className="w-8 h-8 text-purple-200" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">e-Sevai Maiyam</h1>
          <p className="text-purple-200 text-xs mt-1 font-sans">Income & Expense Manager</p>
        </div>

        {/* Content Form */}
        <div className="p-6 md:p-8">
          {error && (
            <div className="mb-5 flex items-start gap-3 p-4 bg-rose-50 text-rose-900 border border-rose-100 rounded-xl text-sm" id="login-error">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Access Denied</p>
                <p className="opacity-90">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-500 mb-1.5">
                Google / Approved Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-transparent transition-all"
                placeholder="Enter approved email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-slate-500 mb-1.5">
                Full Name (Optional)
              </label>
              <input
                id="name"
                type="text"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-transparent transition-all"
                placeholder="Enter full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              id="google-login-btn"
              type="submit"
              disabled={loading || !email}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-[#7e22ce] hover:bg-purple-800 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Continue with Google</span>
                </>
              )}
            </button>
          </form>

          {/* Emulator Helper Section */}
          {quickLoginList.length > 0 && (
            <div className="mt-8 border-t border-slate-100 pt-6" id="quick-login-section">
              <div className="flex items-center gap-1.5 text-slate-500 mb-3.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold tracking-wide uppercase">Developer Quick Switcher</span>
              </div>
              <p className="text-slate-400 text-xs mb-3">
                Click any approved employee below to immediately simulate their login & evaluate access controls:
              </p>
              
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {quickLoginList.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleQuickLogin(p)}
                    disabled={loading}
                    type="button"
                    className="w-full flex items-center justify-between text-left px-3 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 hover:border-slate-200 text-xs font-sans transition-all"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{p.full_name}</p>
                      <p className="text-slate-400 font-mono mt-0.5">{p.email}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] tracking-wide uppercase ${
                      p.role === "owner" ? "bg-purple-50 text-purple-700 border border-purple-100" : "bg-blue-50 text-blue-700 border border-blue-100"
                    }`}>
                      {p.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
