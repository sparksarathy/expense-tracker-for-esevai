/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Profile } from "../types";
import { 
  LogIn, ShieldAlert, CheckCircle, RefreshCw, Mail, 
  KeyRound, ArrowLeft, Sparkles, Check, Send, Eye, EyeOff,
  ShieldCheck, Lock, Smartphone, Database, AlertCircle, X,
  UserCheck, UserPlus
} from "lucide-react";
import { setCachedSession, getCachedUser, authFetch } from "../lib/offlineStorage";

interface LoginProps {
  onLoginSuccess: (user: Profile) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  // Login Mode: "password" | "otp_request" | "otp_verify"
  const [mode, setMode] = useState<"password" | "otp_request" | "otp_verify">("password");

  // Google Login Dialog State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState("");
  const [googleNameInput, setGoogleNameInput] = useState("");

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
  const [pendingApprovalNotice, setPendingApprovalNotice] = useState<string | null>(null);
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

  // =========================================================================
  // GOOGLE SIGN-IN HANDLER
  // =========================================================================
  const handleGoogleSignIn = async (userEmail: string, userName?: string, userAvatar?: string) => {
    const cleanEmail = userEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Please provide a valid Google email address.");
      return;
    }

    setLoading(true);
    setError(null);
    setInfoMsg(null);
    setPendingApprovalNotice(null);

    try {
      const res = await authFetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          name: userName || cleanEmail.split("@")[0].replace(/[._-]/g, " "),
          avatar_url: userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || cleanEmail)}&background=1e3a8a&color=fff`,
          google_id: "g-" + Math.random().toString(36).substring(2, 10),
        }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Unable to reach backend server. Please verify deployment.");
      }

      if (!res.ok) {
        if (data.pendingApproval) {
          setShowGoogleModal(false);
          setPendingApprovalNotice(cleanEmail);
          setError(`Access Request Sent: Your Google ID (${cleanEmail}) has not been approved by the Admin yet. The Center Admin can approve your account in the Employee Access console.`);
          return;
        }
        throw new Error(data.error || "Google Sign-in was not authorized.");
      }

      setShowGoogleModal(false);
      // Auto-restore session in localStorage
      setCachedSession(data.user, data.token, true);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err?.message || "Google Sign-In failed.");
    } finally {
      setLoading(false);
    }
  };

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
    setPendingApprovalNotice(null);

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
    setPendingApprovalNotice(null);

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
            <ShieldCheck className="w-3 h-3 text-emerald-300" />
            <span>Google Login & Admin Approval Enforced</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8">
          
          {/* Pending Approval Notice */}
          {pendingApprovalNotice && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Google ID Awaiting Admin Approval</span>
              </div>
              <p className="leading-relaxed text-amber-900/90">
                Your Google account <strong>{pendingApprovalNotice}</strong> has requested access. The Center Admin has been notified and can approve your account in the <strong>Employee Access</strong> dashboard.
              </p>
            </div>
          )}

          {error && !pendingApprovalNotice && (
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
          {/* 1. PRIMARY GOOGLE SIGN-IN BUTTON */}
          {/* ========================================================================= */}
          <div className="space-y-3 mb-5">
            <button
              type="button"
              onClick={() => setShowGoogleModal(true)}
              disabled={loading}
              id="google-signin-btn"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl text-sm border border-slate-300 shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Sign in with Google</span>
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2.5 text-slate-400 font-semibold tracking-wider text-[11px]">
                  or sign in with password
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2. DIRECT EMAIL + PASSWORD / PIN LOGIN */}
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
                    placeholder="e.g. csb21090@gmail.com or staff@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
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
                Click any staff desk below to test or auto-fill credentials:
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

      {/* ========================================================================= */}
      {/* GOOGLE ACCOUNT SELECTOR MODAL DIALOG */}
      {/* ========================================================================= */}
      {showGoogleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="font-bold text-sm text-slate-800">Choose a Google Account</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select or enter your Google account to log in to <strong>e-Sevai Maiyam</strong>:
            </p>

            {/* Quick 1-Click Center Owner Google Account */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleGoogleSignIn("csb21090@gmail.com", "Spark", "https://ui-avatars.com/api/?name=Spark&background=1e3a8a&color=fff")}
                disabled={loading}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-blue-50/80 rounded-xl border border-slate-200 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-900 text-white font-bold flex items-center justify-center text-xs">
                    S
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 group-hover:text-blue-950">Spark (Center Owner)</p>
                    <p className="text-[11px] text-slate-500 font-mono">csb21090@gmail.com</p>
                  </div>
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                  Admin
                </span>
              </button>
            </div>

            {/* Custom Google Email Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGoogleSignIn(googleEmailInput, googleNameInput);
              }}
              className="space-y-3 pt-2 border-t border-slate-100"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <span>Use another Google account</span>
              </div>
              
              <div>
                <input
                  type="email"
                  required
                  placeholder="Enter employee Google email (@gmail.com)"
                  value={googleEmailInput}
                  onChange={(e) => setGoogleEmailInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Staff Name (Optional)"
                  value={googleNameInput}
                  onChange={(e) => setGoogleNameInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !googleEmailInput}
                className="w-full py-2.5 px-4 bg-[#1e3a8a] hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Sign In with this Google ID</span>}
              </button>
            </form>

            <div className="pt-2 text-center text-[10px] text-slate-400">
              Only Google IDs approved by the Center Admin can access the system.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
