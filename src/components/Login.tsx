/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Profile } from "../types";
import { 
  LogIn, ShieldAlert, CheckCircle, RefreshCw, Mail, 
  KeyRound, ArrowLeft, Sparkles, Check, Send, Eye, EyeOff,
  ShieldCheck, Lock, Smartphone, Database
} from "lucide-react";
import { setCachedSession, getCachedUser, authFetch } from "../lib/offlineStorage";

interface LoginProps {
  onLoginSuccess: (user: Profile) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  // Login Mode: "password" (Option A default) | "otp_request" | "otp_verify"
  const [mode, setMode] = useState<"password" | "otp_request" | "otp_verify">("password");

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // OTP Fields
  const [otpCode, setOtpCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Feedback & Loading
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quickLoginList, setQuickLoginList] = useState<Profile[]>([]);

  useEffect(() => {
    // Check if there was a previously remembered user email to pre-fill
    const previousUser = getCachedUser();
    if (previousUser?.email) {
      setEmail(previousUser.email);
    }

    // 1. Fetch pre-approved list for the emulator quick selection
    fetch("/api/auth/approved-list")
      .then((res) => res.json())
      .then((data) => {
        if (data.approved) {
          setQuickLoginList(data.approved);
        }
      })
      .catch((err) => console.error("Error loading emulator logins:", err));

    // 2. Check for invitation URL query parameters (?invite=...&email=...)
    try {
      const params = new URLSearchParams(window.location.search);
      const inviteEmail = params.get("email");
      if (inviteEmail) {
        setEmail(inviteEmail);
        setInfoMsg(`Invitation detected for ${inviteEmail}. Enter your password or PIN to activate and log in.`);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  // Countdown timer effect for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // =========================================================================
  // OPTION A: DIRECT EMAIL + PASSWORD / PIN LOGIN HANDLER
  // =========================================================================
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setError("Please enter your registered email address.");
      return;
    }
    if (!cleanPassword) {
      setError("Please enter your password or 4-digit PIN.");
      return;
    }

    setLoading(true);
    setError(null);
    setInfoMsg(null);

    try {
      const res = await authFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
          rememberMe,
        }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Unable to reach backend server. Please verify server status.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed. Please check your credentials.");
      }

      // Save user session in localStorage for automatic restoration on next app opening
      setCachedSession(data.user, data.token, rememberMe);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err?.message || "Failed to log in.");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // OPTION B: OTP LOGIN HANDLERS
  // =========================================================================
  const handleRequestOtp = async (targetEmail?: string) => {
    const emailToUse = (targetEmail || email).trim().toLowerCase();
    if (!emailToUse) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError(null);
    setInfoMsg(null);

    try {
      const res = await authFetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUse }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code.");
      }

      setEmail(emailToUse);
      if (data.devOtp) {
        setDevOtp(data.devOtp);
      }
      setMode("otp_verify");
      setOtpCode("");
      setResendCooldown(45);
      setInfoMsg(data.isInvited ? `Welcome! A 6-digit code has been sent to activate your account.` : `Verification code sent to ${emailToUse}`);
    } catch (err: any) {
      setError(err?.message || "Failed to send code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otpCode) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await authFetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: otpCode.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed.");
      }

      setCachedSession(data.user, data.token, rememberMe);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err?.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !email) return;

    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend code.");

      if (data.devOtp) {
        setDevOtp(data.devOtp);
      }
      setResendCooldown(45);
      setInfoMsg("A fresh 6-digit verification code has been dispatched.");
    } catch (err: any) {
      setError(err?.message || "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  // Quick select helper for emulator
  const handleQuickSelect = (p: Profile) => {
    setEmail(p.email);
    const pass = p.role === "owner" ? "admin123" : "123456";
    setPassword(pass);
    setMode("password");
    setError(null);
    setInfoMsg(`Pre-filled ${p.full_name} (${p.email}) credentials.`);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-slate-50 py-12" id="login-screen">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden" id="login-card">
        
        {/* Top Banner */}
        <div className="bg-gradient-to-br from-[#1e3a8a] via-[#172554] to-slate-900 px-6 py-7 text-center text-white relative">
          <div className="inline-flex p-3 bg-white/10 rounded-2xl mb-2.5 backdrop-blur-md border border-white/10 shadow-inner">
            <LogIn className="w-7 h-7 text-blue-200" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">e-Sevai Maiyam</h1>
          <p className="text-blue-200 text-xs mt-0.5 font-sans font-medium">Income & Expense Manager</p>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-[11px] text-emerald-200 font-medium">
            <Database className="w-3 h-3 text-emerald-300" />
            <span>Persistent Login & Data Auto-Restore Enabled</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8">
          {error && (
            <div className="mb-4 flex items-start gap-2.5 p-3.5 bg-rose-50 text-rose-900 border border-rose-100 rounded-xl text-xs" id="login-error">
              <ShieldAlert className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Authentication Notice</p>
                <p className="opacity-90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 flex items-start gap-2.5 p-3.5 bg-blue-50 text-blue-900 border border-blue-100 rounded-xl text-xs" id="login-info">
              <CheckCircle className="w-4.5 h-4.5 text-blue-600 shrink-0 mt-0.5" />
              <p className="font-medium">{infoMsg}</p>
            </div>
          )}

          {/* ========================================================================= */}
          {/* OPTION A: DIRECT EMAIL + PASSWORD / PIN LOGIN (DEFAULT) */}
          {/* ========================================================================= */}
          {mode === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4" id="password-login-form">
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Registered Staff Email</span>
                  <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Required</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all font-medium text-slate-900 placeholder:text-slate-400"
                    placeholder="e.g. csb21090@gmail.com or staff@esevai.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Password or 4-Digit PIN</span>
                  <span className="text-[10px] text-slate-400 font-medium">Default: 123456</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all font-medium text-slate-900 placeholder:text-slate-400"
                    placeholder="Enter password or PIN"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-600">
                    Stay logged in & restore data automatically
                  </span>
                </label>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                disabled={loading || !email || !password}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-[#1e3a8a] hover:bg-blue-900 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing in & Restoring Data...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Log In to Desk</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setMode("otp_request"); setError(null); }}
                  className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
                >
                  Or log in with 6-digit Email Verification Code (OTP)
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* OPTION B: OTP CODE FLOW */}
          {/* ========================================================================= */}
          {mode === "otp_request" && (
            <form onSubmit={(e) => { e.preventDefault(); handleRequestOtp(); }} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => { setMode("password"); setError(null); }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Password Login</span>
                </button>
              </div>

              <div>
                <label htmlFor="otp-email" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Authorized Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="otp-email"
                    type="email"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all font-medium text-slate-800 placeholder:text-slate-400"
                    placeholder="Enter registered email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1e3a8a] hover:bg-blue-900 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send 6-Digit OTP</span>
                  </>
                )}
              </button>
            </form>
          )}

          {mode === "otp_verify" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => { setMode("otp_request"); setError(null); }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Email</span>
                </button>
                <span className="text-xs font-mono font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                  {email}
                </span>
              </div>

              {devOtp && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between text-blue-900 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span>Verification Code:</span>
                    </span>
                    <span className="font-mono text-sm tracking-widest bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-800">
                      {devOtp}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setOtpCode(devOtp)}
                      className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                    >
                      Click here to auto-fill code
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label htmlFor="otp-input" className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center justify-between">
                    <span>6-Digit Verification Code</span>
                    <span className="text-[10px] text-slate-400">Expires in 10 minutes</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="otp-input"
                      type="text"
                      maxLength={6}
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base tracking-[0.3em] font-mono font-bold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:text-slate-400"
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1e3a8a] hover:bg-blue-900 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Verify & Sign In</span>
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 text-center">
                {resendCooldown > 0 ? (
                  <p className="text-xs text-slate-400">
                    Resend code in <span className="font-semibold text-slate-600">{resendCooldown}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                  >
                    Didn't receive code? Resend Code
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick Staff Roster Emulator Section */}
          {quickLoginList.length > 0 && (
            <div className="mt-7 border-t border-slate-100 pt-5" id="quick-login-section">
              <div className="flex items-center gap-1.5 text-slate-500 mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold tracking-wide uppercase">Quick Staff Login (1-Click)</span>
              </div>
              <p className="text-slate-400 text-[11px] mb-3">
                Click any staff desk below to auto-fill their email and default credentials:
              </p>
              
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {quickLoginList.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleQuickSelect(p)}
                    disabled={loading}
                    type="button"
                    className="w-full flex items-center justify-between text-left px-3 py-2 bg-slate-50 hover:bg-blue-50/70 rounded-xl border border-slate-100 hover:border-blue-200 text-xs font-sans transition-all cursor-pointer group"
                  >
                    <div>
                      <p className="font-semibold text-slate-800 group-hover:text-blue-900">{p.full_name}</p>
                      <p className="text-slate-400 font-mono text-[10px] mt-0.5">{p.email}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-medium text-[9px] tracking-wide uppercase ${
                      p.role === "owner" ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-blue-50 text-blue-700 border border-blue-100"
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
