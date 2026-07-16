/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Profile, AppSettings } from "../types";
import { 
  ShieldCheck, ToggleLeft, ToggleRight, Clock, Receipt, 
  Save, RefreshCw, XCircle, Trash2, AlertTriangle, Info, CheckCircle2 
} from "lucide-react";

interface SettingsProps {
  user: Profile;
}

export default function Settings({ user }: SettingsProps) {
  const isOwner = user.role === "owner";

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  
  // App policy states
  const [allowEditing, setAllowEditing] = useState(true);
  const [limitHours, setLimitHours] = useState<string>("24");
  const [requireReceipt, setRequireReceipt] = useState(false);
  const [allowEmployeeOverride, setAllowEmployeeOverride] = useState(false);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Danger Zone System Reset states
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [reauthEmail, setReauthEmail] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [dangerError, setDangerError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings(data.settings);
          setAllowEditing(data.settings.allow_employee_editing);
          setLimitHours(data.settings.employee_editing_limit_hours.toString());
          setRequireReceipt(data.settings.require_expense_receipt);
          setAllowEmployeeOverride(!!data.settings.allow_employee_rate_override);
        }
      } catch (err) {
        console.error("Failed fetching settings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setErrorMsg(null);

    const hrs = Number(limitHours);
    if (isNaN(hrs) || hrs < 0) {
      setErrorMsg("Editing limit hours must be a positive number.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allow_employee_editing: allowEditing,
          employee_editing_limit_hours: hrs,
          require_expense_receipt: requireReceipt,
          allow_employee_rate_override: allowEmployeeOverride,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        const data = await res.json();
        throw new Error(data.error || "Save settings failed");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSystemReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setDangerError(null);
    setResetSuccess(false);

    // Verify logged in user is the primary admin csb21090@gmail.com
    if (user.email.toLowerCase() !== "csb21090@gmail.com") {
      setDangerError("Access Denied: Data formatting/reset is strictly restricted to the primary administrator email (csb21090@gmail.com) only.");
      return;
    }

    // 1. Password confirmation simulation check
    if (reauthEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      setDangerError("Re-authentication failed. You must enter your exact active owner account email address.");
      return;
    }

    // 2. Explicit confirmation string match
    if (confirmPhrase.trim() !== "RESET ALL RECORDS") {
      setDangerError("Explicit phrase confirmation failed. Please type 'RESET ALL RECORDS' exactly.");
      return;
    }

    // 3. Confirm window
    const secondConfirmation = window.confirm(
      "WARNING: This action is highly destructive and absolutely irreversible. " +
      "This will permanently purge all income filings, expense payouts, and logs. " +
      "Active employees, services, configurations, and categories WILL BE RETAINED intact.\n\n" +
      "Are you absolutely sure you want to perform this system reset?"
    );

    if (!secondConfirmation) return;

    setResetting(true);
    try {
      const res = await fetch("/api/settings/reset-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: confirmPhrase.trim(),
          reauth_email: reauthEmail.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResetSuccess(true);
        setReauthEmail("");
        setConfirmPhrase("");
        
        // Stagger page refresh to allow users to see success message
        setTimeout(() => {
          window.location.reload();
        }, 2200);
      } else {
        setDangerError(data.error || "Failed to complete system reset. Check server logs.");
      }
    } catch (err: any) {
      console.error(err);
      setDangerError("Connection failure. Reset was not completed.");
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex flex-col justify-center items-center min-h-[300px]">
        <RefreshCw className="w-8 h-8 text-blue-900 animate-spin" />
        <p className="text-slate-500 text-xs mt-3 font-sans">Syncing security parameters...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-6" id="settings-config">
      
      {/* Title */}
      <div className="border-b border-slate-100 pb-5" id="settings-header">
        <h1 className="text-xl font-bold text-slate-900 font-sans tracking-tight">Policy Controls & Settings</h1>
        <p className="text-slate-500 text-xs mt-1">Configure Sevai center billing boundaries, employee permissions, and system resets.</p>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-100 text-rose-900 rounded-xl text-xs font-semibold" id="settings-error">
          <XCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
          <p>{errorMsg}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-900 rounded-xl text-xs font-semibold" id="settings-success">
          <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
          <p>Sevai center operating rules updated successfully!</p>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5 text-xs" id="settings-form">
        
        {/* Toggle 1: Allow Employee Editing */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4" id="toggle-editing-group">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Clock className="w-4.5 h-4.5 text-slate-400" />
              <span>Allow Employee Ledger Editing</span>
            </h3>
            <p className="text-slate-500 text-xs font-normal">
              Authorize staff operators to modify their own recorded entries within a strict safety window.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setAllowEditing(!allowEditing)}
            disabled={saving || !isOwner}
            className="p-1 disabled:opacity-40"
          >
            {allowEditing ? (
              <ToggleRight className="w-9 h-9 text-emerald-600 cursor-pointer" />
            ) : (
              <ToggleLeft className="w-9 h-9 text-slate-400 cursor-pointer" />
            )}
          </button>
        </div>

        {/* Option 2: Employee Editing limit hours (Conditional) */}
        {allowEditing && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4" id="limit-hours-group">
            <div className="space-y-1 max-w-sm">
              <h4 className="font-semibold text-slate-700">Ledger Modification Safety Window</h4>
              <p className="text-slate-500 text-[10px] leading-relaxed">
                Duration in hours from transaction submission where modifications are allowed. After this, records automatically lock down.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center font-mono">
              <input
                type="number"
                required
                min="1"
                className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-1 focus:ring-blue-900 text-slate-900"
                value={limitHours}
                onChange={(e) => setLimitHours(e.target.value)}
                disabled={saving || !isOwner}
              />
              <span className="text-slate-400 font-semibold">Hours</span>
            </div>
          </div>
        )}

        {/* Toggle 3: Allow Employee Rate Overrides */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4" id="toggle-override-group">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <ShieldCheck className="w-4.5 h-4.5 text-slate-400" />
              <span>Allow Employee Rate Overrides</span>
            </h3>
            <p className="text-slate-500 text-xs font-normal">
              Authorize staff operators to modify catalog prices during customer intake. (Subject to catalog min/max limitations, override reasons logged).
            </p>
          </div>

          <button
            type="button"
            onClick={() => setAllowEmployeeOverride(!allowEmployeeOverride)}
            disabled={saving || !isOwner}
            className="p-1 disabled:opacity-40"
          >
            {allowEmployeeOverride ? (
              <ToggleRight className="w-9 h-9 text-emerald-600 cursor-pointer" />
            ) : (
              <ToggleLeft className="w-9 h-9 text-slate-400 cursor-pointer" />
            )}
          </button>
        </div>

        {/* Toggle 4: Mandate Expense Receipt */}
        <div className="flex items-start justify-between gap-4 pb-1" id="toggle-receipt-group">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Receipt className="w-4.5 h-4.5 text-slate-400" />
              <span>Mandate Expense Receipt Upload</span>
            </h3>
            <p className="text-slate-500 text-xs font-normal">
              Require employee desks to upload receipts or invoices (PDF/Image) for all cash payouts.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setRequireReceipt(!requireReceipt)}
            disabled={saving || !isOwner}
            className="p-1 disabled:opacity-40"
          >
            {requireReceipt ? (
              <ToggleRight className="w-9 h-9 text-emerald-600 cursor-pointer" />
            ) : (
              <ToggleLeft className="w-9 h-9 text-slate-400 cursor-pointer" />
            )}
          </button>
        </div>

        {/* Save Button (Owner Only) */}
        {isOwner && (
          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl text-xs shadow hover:shadow-md transition-all disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4.5 h-4.5 animate-spin" />
            ) : (
              <>
                <Save className="w-4.5 h-4.5" />
                <span>Save Operating Rules</span>
              </>
            )}
          </button>
        )}
      </form>

      {/* SECURE OWNER DANGER ZONE - SYSTEM DATA RESET */}
      {isOwner && (
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6 space-y-4 text-xs" id="owner-danger-zone">
          <div className="space-y-1">
            <h3 className="font-bold text-red-700 text-sm flex items-center gap-1.5">
              <AlertTriangle className="w-4.5 h-4.5 text-red-600 shrink-0" />
              <span>Administrative Danger Zone</span>
            </h3>
            <p className="text-slate-500 text-xs font-normal">
              Wipe all transactions to initiate a clean production environment. This action performs a destructive ledger truncate.
            </p>
          </div>

          {user.email.toLowerCase() !== "csb21090@gmail.com" ? (
            <div className="p-3.5 bg-amber-50 border border-amber-100 text-amber-900 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>RESTRICTED ACCESS WARNING</span>
              </div>
              <p className="text-[10.5px] leading-relaxed font-medium">
                System formatting (destructive system reset) is locked. Under security operating guidelines, only the primary administrator account (<strong className="font-bold">csb21090@gmail.com</strong>) has formatting authority.
              </p>
            </div>
          ) : (
            <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl space-y-2 text-red-950">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>IRREVERSIBLE OPERATION WARNING</span>
              </div>
              <p className="text-[10.5px] leading-relaxed">
                Performing a <strong className="font-bold">System Reset</strong> will permanently erase all income transactions, expense records, and system audit logs from the database. 
                Metadata profiles, e-Sevai dynamic services catalog, categories, and account configurations <strong className="font-bold">will be preserved completely</strong>.
              </p>
            </div>
          )}

          {dangerError && (
            <div className="p-2.5 bg-rose-100/50 border border-rose-200 text-rose-900 rounded-xl font-semibold">
              ⚠️ {dangerError}
            </div>
          )}

          {resetSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-900 rounded-xl font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>System transaction data successfully purged. Reloading workspace...</span>
            </div>
          )}

          <form onSubmit={handleSystemReset} className="space-y-3 pt-1">
            {/* Re-authenticate Email */}
            <div>
              <label className="block text-slate-700 font-bold text-[11px] mb-1">
                Confirm your Owner active email address: <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder={user.email}
                value={reauthEmail}
                onChange={(e) => setReauthEmail(e.target.value)}
                disabled={resetting || user.email.toLowerCase() !== "csb21090@gmail.com"}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-600 text-slate-800 disabled:opacity-50"
              />
            </div>

            {/* Confirm phrase matching exact string requested */}
            <div>
              <label className="block text-slate-700 font-bold text-[11px] mb-1">
                To confirm, type <strong className="text-red-700 font-mono select-all bg-red-50 px-1.5 py-0.5 rounded border border-red-100">RESET ALL RECORDS</strong> below: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="RESET ALL RECORDS"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                disabled={resetting || user.email.toLowerCase() !== "csb21090@gmail.com"}
                className="w-full px-3 py-2 border border-red-100 bg-red-50/10 rounded-xl font-mono text-center tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50"
              />
            </div>

            {/* Truncate Reset Button */}
            <button
              type="submit"
              disabled={resetting || user.email.toLowerCase() !== "csb21090@gmail.com" || reauthEmail.trim().toLowerCase() !== user.email.toLowerCase() || confirmPhrase.trim() !== "RESET ALL RECORDS"}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {resetting ? (
                <RefreshCw className="w-4.5 h-4.5 animate-spin" />
              ) : (
                <>
                  <Trash2 className="w-4.5 h-4.5" />
                  <span>Perform Destructive System Reset</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Read-only Employee view fallback */}
      {!isOwner && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-2.5 text-blue-950 text-xs">
          <Info className="w-4.5 h-4.5 text-blue-900 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Settings Locked:</span> Operating guidelines, security settings, and reset safety utilities are strictly view-only for employees. Please contact the Sevai Center Owner to request updates.
          </div>
        </div>
      )}
    </div>
  );
}
