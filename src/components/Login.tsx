/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Profile } from "../types";
import { 
  LogIn, ShieldAlert, CheckCircle, RefreshCw, Mail, 
  KeyRound, ArrowLeft, Sparkles, Check, Send, AlertCircle
} from "lucide-react";

interface LoginProps {
  onLoginSuccess: (user: Profile) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  // Navigation / Step state: "email" | "otp"
  const [step, setStep] = useState<"email" | "otp">("email");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quickLoginList, setQuickLoginList] = useState<Profile[]>([]);

  // Resend OTP countdown timer
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
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
      const inviteToken = params.get("invite");
      if (inviteEmail) {
        setEmail(inviteEmail);
        setInfoMsg(`Invitation link detected for ${inviteEmail}. Click "Send Verification Code" to activate your account.`);
      }
    } catch (e) {
      // Ignore URL parsing errors
    }
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Send OTP to Email
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
      const res = await fetch("/api/auth/send-otp", {
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
      setStep("otp");
      setOtpCode("");
      setResendCooldown(45); // 45 seconds cooldown
      setInfoMsg(data.isInvited ? `Welcome! We sent a 6-digit code to activate your invited account.` : `Verification code sent to ${emailToUse}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP Code and Log In
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otpCode) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: otpCode.trim(),
          name: name.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed.");
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Resend Code handler
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !email) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-otp", {
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Quick switcher handler (initiates email verification for that user)
  const handleQuickSelect = (p: Profile) => {
    setEmail(p.email);
    setName(p.full_name);
    handleRequestOtp(p.email);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-slate-50 py-12" id="login-screen">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden" id="login-card">
        
        {/* Top Banner */}
        <div className="bg-gradient-to-br from-[#1e3a8a] via-[#172554] to-slate-900 px-6 py-7 text-center text-white relative">
          <div className="inline-flex p-3 bg-white/10 rounded-2xl mb-2.5 backdrop-blur-md border border-white/10 shadow-inner">
            <LogIn className="w-7 h-7 text-purple-200" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">e-Sevai Maiyam</h1>
          <p className="text-purple-200 text-xs mt-0.5 font-sans font-medium">Income & Expense Manager</p>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-[11px] text-emerald-200 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Email Verified Login Enforced</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8">
          {error && (
            <div className="mb-4 flex items-start gap-2.5 p-3.5 bg-rose-50 text-rose-900 border border-rose-100 rounded-xl text-xs" id="login-error">
              <ShieldAlert className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Verification Error</p>
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

          {/* STEP 1: Enter Email to Request Verification Code */}
          {step === "email" && (
            <form onSubmit={(e) => { e.preventDefault(); handleRequestOtp(); }} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center justify-between">
                  <span>Authorized Email Address</span>
                  <span className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">Required</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="email"
                    type="email"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all font-medium text-slate-800 placeholder:text-slate-400"
                    placeholder="e.g. staff@esevai.com or gmail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Only pre-approved staff or employees invited by the center admin can access.
                </p>
              </div>

              <div>
                <label htmlFor="name" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Full Name <span className="text-slate-400 font-normal">(Optional, if first time)</span>
                </label>
                <input
                  id="name"
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all font-medium text-slate-800 placeholder:text-slate-400"
                  placeholder="e.g. Arun Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>

              <button
                id="send-otp-btn"
                type="submit"
                disabled={loading || !email}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-[#7e22ce] hover:bg-purple-800 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Authorization...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Verification Code</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: Enter 6-digit Email Verification Code (OTP) */}
          {step === "otp" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => { setStep("email"); setError(null); }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Email</span>
                </button>
                <span className="text-xs font-mono font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                  {email}
                </span>
              </div>

              {/* Dev / Emulator helper badge */}
              {devOtp && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between text-purple-900 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>Local Dev Verification Code:</span>
                    </span>
                    <span className="font-mono text-sm tracking-widest bg-white px-2 py-0.5 rounded border border-purple-200 text-purple-800">
                      {devOtp}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setOtpCode(devOtp)}
                      className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline cursor-pointer"
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
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base tracking-[0.3em] font-mono font-bold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:text-slate-400"
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Enter the code sent to your registered email to confirm your identity.
                  </p>
                </div>

                <button
                  id="verify-login-btn"
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#7e22ce] hover:bg-purple-800 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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

              {/* Resend Code Section */}
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
                    className="text-xs font-bold text-purple-700 hover:text-purple-900 underline cursor-pointer"
                  >
                    Didn't receive code? Resend Code
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick Staff Login Emulator Section */}
          {quickLoginList.length > 0 && (
            <div className="mt-7 border-t border-slate-100 pt-5" id="quick-login-section">
              <div className="flex items-center gap-1.5 text-slate-500 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold tracking-wide uppercase">Pre-Approved Staff Roster</span>
              </div>
              <p className="text-slate-400 text-[11px] mb-3">
                Click any staff member to auto-fill their email and trigger email verification code:
              </p>
              
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {quickLoginList.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleQuickSelect(p)}
                    disabled={loading}
                    type="button"
                    className="w-full flex items-center justify-between text-left px-3 py-2 bg-slate-50 hover:bg-purple-50/60 rounded-xl border border-slate-100 hover:border-purple-200 text-xs font-sans transition-all cursor-pointer group"
                  >
                    <div>
                      <p className="font-semibold text-slate-800 group-hover:text-purple-900">{p.full_name}</p>
                      <p className="text-slate-400 font-mono text-[10px] mt-0.5">{p.email}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-medium text-[9px] tracking-wide uppercase ${
                      p.role === "owner" ? "bg-purple-100 text-purple-700 border border-purple-200" : "bg-blue-50 text-blue-700 border border-blue-100"
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
