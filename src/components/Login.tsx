/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Profile } from "../types";
import { 
  LogIn, ShieldAlert, CheckCircle, CheckCircle2, RefreshCw, Mail, 
  KeyRound, ArrowLeft, Sparkles, Check, Send, Eye, EyeOff,
  ShieldCheck, Lock, AlertCircle, X, UserPlus, Clock
} from "lucide-react";
import { setCachedSession, getCachedUser, authFetch } from "../lib/offlineStorage";

interface LoginProps {
  onLoginSuccess: (user: Profile) => void;
}

export type LoginMode = 
  | "password" 
  | "signup"
  | "otp_request" 
  | "otp_verify" 
  | "pending_approval";

export default function Login({ onLoginSuccess }: LoginProps) {
  // Login Mode
  const [mode, setMode] = useState<LoginMode>("password");

  // Pending Approval State
  const [pendingApprovalEmail, setPendingApprovalEmail] = useState("");
  const [pendingApprovalName, setPendingApprovalName] = useState("");

  // Sign In Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Sign Up (Register Staff) Form Fields
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // OTP Fields
  const [otpCode, setOtpCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Feedback & Loading
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if there was a previously remembered user email to pre-fill
    const previousUser = getCachedUser();
    if (previousUser?.email) {
      setEmail(previousUser.email);
    }

    // Check for invitation URL query parameters (?invite=...&email=...)
    try {
      const params = new URLSearchParams(window.location.search);
      const inviteEmail = params.get("email");
      if (inviteEmail) {
        setEmail(inviteEmail);
        setInfoMsg(`Invitation detected for ${inviteEmail}. Enter your password, PIN, or use Google Sign-in to activate.`);
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

  // Auto-polling for Admin approval when awaiting approval
  useEffect(() => {
    if (mode !== "pending_approval" || !pendingApprovalEmail) return;

    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`/api/auth/google/status?email=${encodeURIComponent(pendingApprovalEmail)}`);
        const data = await res.json();
        if (data.approved && data.user) {
          clearInterval(interval);
          setCachedSession(data.user, data.token, true);
          onLoginSuccess(data.user);
        }
      } catch {
        // Ignore background polling error
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [mode, pendingApprovalEmail, onLoginSuccess]);

  // Check Approval Status manually
  const handleCheckApprovalStatus = async () => {
    if (!pendingApprovalEmail) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/auth/google/status?email=${encodeURIComponent(pendingApprovalEmail)}`);
      const data = await res.json();
      if (data.approved && data.user) {
        setCachedSession(data.user, data.token, true);
        onLoginSuccess(data.user);
      } else {
        setInfoMsg("Still awaiting administrator approval. Center administration will activate your counter access in the Employee Access dashboard.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to check status.");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // SIGN-UP / STAFF REGISTRATION HANDLER
  // =========================================================================
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = registerName.trim();
    const cleanEmail = registerEmail.trim().toLowerCase();
    const cleanPassword = registerPassword.trim();
    const cleanConfirm = registerConfirmPassword.trim();
    const cleanPhone = registerPhone.trim();

    if (!cleanName) {
      setError("Please enter your full name.");
      return;
    }
    if (!cleanEmail) {
      setError("Please enter a valid email address.");
      return;
    }
    if (cleanPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (cleanPassword !== cleanConfirm) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);
    setError(null);
    setInfoMsg(null);

    try {
      const res = await authFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: cleanName,
          email: cleanEmail,
          password: cleanPassword,
          phone_number: cleanPhone || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      if (data.pendingApproval) {
        setPendingApprovalEmail(cleanEmail);
        setPendingApprovalName(cleanName);
        setMode("pending_approval");
        setInfoMsg(data.message);
        return;
      }

      // Log in immediately
      setCachedSession(data.user, data.token, true);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // OPTION A: DIRECT EMAIL + PASSWORD LOGIN HANDLER
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
      setError("Please enter your password.");
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
        if (data.pendingApproval) {
          setPendingApprovalEmail(cleanEmail);
          setMode("pending_approval");
          setInfoMsg(data.error);
          return;
        }
        throw new Error(data.error || "Authentication failed. Please check your credentials.");
      }

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

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-slate-50 py-10 font-sans" id="login-screen">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden" id="login-card">
        
        {/* Top Banner with exact title */}
        <div className="bg-gradient-to-br from-[#1e3a8a] via-[#172554] to-slate-900 px-6 py-7 text-center text-white relative">
          <div className="inline-flex p-3 bg-white/10 rounded-2xl mb-2.5 backdrop-blur-md border border-white/10 shadow-inner">
            <LogIn className="w-7 h-7 text-blue-200" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight uppercase">SS E-SEVAI MAIYAM</h1>
          <p className="text-blue-200 text-xs mt-1 font-medium">Income & Expense Management Portal</p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2.5 bg-white/10 border border-white/10 rounded-full text-xs text-blue-100 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>Authorized Staff & Admin Login</span>
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
          {/* TAB SWITCHER: SIGN IN vs SIGN UP */}
          {/* ========================================================================= */}
          {(mode === "password" || mode === "signup") && (
            <div className="flex bg-slate-100 p-1 rounded-xl mb-5 border border-slate-200/80">
              <button
                type="button"
                onClick={() => { setMode("password"); setError(null); setInfoMsg(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === "password"
                    ? "bg-white text-blue-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); setInfoMsg(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === "signup"
                    ? "bg-white text-blue-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Sign Up (New Staff)</span>
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 1. EMAIL + PASSWORD LOGIN */}
          {/* ========================================================================= */}
          {mode === "password" && (
            <div className="space-y-4">
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
                      placeholder="Enter your email (e.g. staff@gmail.com)"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Password</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all font-medium text-slate-900 placeholder:text-slate-400"
                      placeholder="Enter your password"
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

                {/* Remember Me Option */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-slate-600">
                      Keep me signed in on this device
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
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Log In to Desk</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={() => { setMode("otp_request"); setError(null); }}
                    className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer block mx-auto"
                  >
                    Or log in with 6-digit Email Verification Code
                  </button>
                  <p className="text-xs text-slate-500">
                    New staff member?{" "}
                    <button
                      type="button"
                      onClick={() => { setMode("signup"); setError(null); }}
                      className="text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
                    >
                      Create your staff account
                    </button>
                  </p>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. SIGN UP / CREATE STAFF ACCOUNT */}
          {/* ========================================================================= */}
          {mode === "signup" && (
            <form onSubmit={handleRegister} className="space-y-3.5" id="signup-form">
              <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-blue-950">
                  <UserPlus className="w-4 h-4 text-blue-700" />
                  <span>New Staff Self-Registration</span>
                </div>
                <p className="text-blue-900/90 text-[11px] leading-relaxed">
                  Create your own login password. Your employee data will be recorded in the database, and the Shop Owner will activate your counter access.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. M. Rajesh Kumar"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium text-slate-900 placeholder:text-slate-400"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Staff Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="staff@gmail.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium text-slate-900 placeholder:text-slate-400"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={registerPhone}
                    onChange={(e) => setRegisterPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium text-slate-900 placeholder:text-slate-400"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Create Password *</span>
                    <span className="text-[10px] text-slate-400">Min 6 chars</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegisterPassword ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder="Choose password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium text-slate-900 placeholder:text-slate-400"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      {showRegisterPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type={showRegisterPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Repeat password"
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium text-slate-900 placeholder:text-slate-400"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !registerName || !registerEmail || !registerPassword || !registerConfirmPassword}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 bg-[#1e3a8a] hover:bg-blue-900 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create Staff Account</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setMode("password"); setError(null); }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline cursor-pointer"
                >
                  Already have an account? Sign In here
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
                    placeholder="Enter your email (e.g. staff@gmail.com)"
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
                      placeholder="· · · · · ·"
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

          {/* ========================================================================= */}
          {/* OPTION C: PENDING ADMIN APPROVAL SCREEN */}
          {/* ========================================================================= */}
          {mode === "pending_approval" && (
            <div className="space-y-4 animate-in fade-in duration-200 text-center py-2">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-emerald-200">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-800 font-bold px-3 py-0.5 rounded-full mb-1.5">
                  <Check className="w-3 h-3" />
                  <span>Account Registered & Data Saved</span>
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Awaiting Administrator Approval
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {pendingApprovalEmail}
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-left space-y-2 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Staff Member:</span>
                  <span className="font-bold text-slate-800">{pendingApprovalName || pendingApprovalEmail.split("@")[0]}</span>
                </div>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Registration Status:</span>
                  <span className="font-semibold text-emerald-700">Profile Recorded ✓</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Access Status:</span>
                  <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>Pending Admin Activation</span>
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-800 leading-relaxed">
                Your staff profile is recorded in the system. As soon as center administration activates your account, this screen will automatically sign you in.
              </div>

              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  onClick={handleCheckApprovalStatus}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1e3a8a] hover:bg-blue-900 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Checking Approval Status...</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-blue-200" />
                      <span>Check Approval Status Now</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Auto-refreshing status every few seconds...</span>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => { setMode("password"); setError(null); }}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline cursor-pointer"
                  >
                    Sign in with a different account
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
