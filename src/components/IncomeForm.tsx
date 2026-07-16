/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Profile, ServiceCategory } from "../types";
import { 
  CheckCircle2, RefreshCw, XCircle, ArrowLeft, Plus, 
  HelpCircle, Sparkles, Sliders, Info
} from "lucide-react";

interface IncomeFormProps {
  user: Profile;
  onSuccess: () => void;
  onNavigate: (tab: string) => void;
}

export default function IncomeForm({ user, onSuccess, onNavigate }: IncomeFormProps) {
  const isOwner = user.role === "owner";

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [allowEmployeeRateOverride, setAllowEmployeeRateOverride] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingOptions, setFetchingOptions] = useState(true);
  
  // Form State
  const [customerName, setCustomerName] = useState("");
  const [serviceCategoryId, setServiceCategoryId] = useState("");
  const [serviceRate, setServiceRate] = useState<string>("");
  const [listedRate, setListedRate] = useState<number | null>(null);
  const [rateOverrideReason, setRateOverrideReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"GPay" | "Cash in Hand">("GPay");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);
  const [employeeId, setEmployeeId] = useState(user.id);
  const [notes, setNotes] = useState("");
  const [existingCustomers, setExistingCustomers] = useState<string[]>([]);
  
  // Dynamic Service Creation (Owner Only)
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceRate, setNewServiceRate] = useState("");
  const [newServiceMinRate, setNewServiceMinRate] = useState("");
  const [newServiceMaxRate, setNewServiceMaxRate] = useState("");
  const [newServiceCode, setNewServiceCode] = useState("");
  const [newServiceError, setNewServiceError] = useState("");
  const [newServiceLoading, setNewServiceLoading] = useState(false);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmedEntry, setConfirmedEntry] = useState<any>(null);

  const loadOptions = async () => {
    try {
      // 1. Fetch categories
      const catRes = await fetch("/api/service-categories");
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories.filter((c: any) => c.is_active));
      }

      // 2. Fetch system settings for override permissions
      const setRes = await fetch("/api/settings");
      if (setRes.ok) {
        const setData = await setRes.json();
        setAllowEmployeeRateOverride(!!setData.settings.allow_employee_rate_override);
      }

      // 3. Fetch past customer names for datalist
      const incRes = await fetch("/api/income-entries");
      if (incRes.ok) {
        const incData = await incRes.json();
        const customers = incData.entries.map((e: any) => e.customer_name);
        const uniqueCustomers = Array.from(new Set(customers)) as string[];
        setExistingCustomers(uniqueCustomers.filter(Boolean));
      }

      // 4. Fetch profiles if owner
      if (isOwner) {
        const empRes = await fetch("/api/employees");
        if (empRes.ok) {
          const empData = await empRes.json();
          setEmployees(empData.employees.filter((e: any) => e.is_active));
        }
      }
    } catch (err) {
      console.error("Failed to load options for Income Form:", err);
    } finally {
      setFetchingOptions(false);
    }
  };

  useEffect(() => {
    loadOptions();
  }, [user]);

  // Handle service template changes
  const handleCategoryInputChange = (val: string) => {
    setServiceCategoryId(val);
    
    // Attempt to match selected option
    const selected = categories.find(
      (c) => (c.service_name || c.category_name).toLowerCase() === val.toLowerCase() || c.id === val
    );
    if (selected) {
      setServiceRate(selected.default_rate.toString());
      setListedRate(selected.default_rate);
    } else {
      setListedRate(null);
    }
    setRateOverrideReason("");
  };

  // Quick Service Creation for Owners
  const handleQuickCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewServiceError("");
    if (!newServiceName.trim()) {
      setNewServiceError("Service Name is required.");
      return;
    }

    const rate = Number(newServiceRate);
    if (isNaN(rate) || rate < 0) {
      setNewServiceError("Rate must be zero or a positive number.");
      return;
    }

    const minR = newServiceMinRate ? Number(newServiceMinRate) : undefined;
    const maxR = newServiceMaxRate ? Number(newServiceMaxRate) : undefined;

    if (minR !== undefined && (isNaN(minR) || minR < 0)) {
      setNewServiceError("Minimum rate must be zero or greater.");
      return;
    }
    if (maxR !== undefined && (isNaN(maxR) || maxR < 0)) {
      setNewServiceError("Maximum rate must be zero or greater.");
      return;
    }
    if (minR !== undefined && maxR !== undefined && maxR < minR) {
      setNewServiceError("Maximum rate cannot be less than minimum rate.");
      return;
    }

    setNewServiceLoading(true);
    try {
      const res = await fetch("/api/service-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_name: newServiceName.trim(),
          service_code: newServiceCode.trim() || undefined,
          default_rate: rate,
          minimum_rate: minR,
          maximum_rate: maxR,
        })
      });

      const data = await res.json();
      if (res.ok && data.category) {
        // Refresh catalogue local state
        const refreshedCats = [...categories, data.category];
        setCategories(refreshedCats);

        // Auto-select newly created service template
        setServiceCategoryId(data.category.id);
        setServiceRate(data.category.default_rate.toString());
        setListedRate(data.category.default_rate);

        // Reset quick form
        setNewServiceName("");
        setNewServiceCode("");
        setNewServiceRate("");
        setNewServiceMinRate("");
        setNewServiceMaxRate("");
        setShowAddServiceModal(false);
      } else {
        setNewServiceError(data.error || "Failed to create new service catalog entry.");
      }
    } catch (err) {
      console.error(err);
      setNewServiceError("Connection error. Check backend server logs.");
    } finally {
      setNewServiceLoading(false);
    }
  };

  const selectedService = categories.find(
    (c) => c.id === serviceCategoryId || (c.service_name || c.category_name).toLowerCase() === serviceCategoryId.toLowerCase()
  );

  // Decide if we are overriding the rate
  const activeRate = Number(serviceRate);
  const activeListedRate = selectedService ? selectedService.default_rate : activeRate;
  const isOverridden = activeRate !== activeListedRate;

  // Rate range checks
  const minPermitted = selectedService?.minimum_rate;
  const maxPermitted = selectedService?.maximum_rate;
  const isBelowMin = minPermitted !== undefined && minPermitted !== null && activeRate < minPermitted;
  const isAboveMax = maxPermitted !== undefined && maxPermitted !== null && activeRate > maxPermitted;
  const rangeError = isBelowMin 
    ? `Amount is below the minimum permitted rate of ₹${minPermitted}.`
    : isAboveMax 
      ? `Amount exceeds the maximum permitted rate of ₹${maxPermitted}.`
      : "";

  const isRateFieldDisabled = !isOwner && !allowEmployeeRateOverride;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!customerName || !serviceCategoryId || !paymentMethod || !serviceRate || !transactionDate) {
      setErrorMsg("Please fill out all required fields.");
      return;
    }

    const rateNum = Number(serviceRate);
    if (isNaN(rateNum) || rateNum < 0) {
      setErrorMsg("Amount rate must be a valid non-negative number.");
      return;
    }

    if (isOverridden && !isOwner) {
      if (!allowEmployeeRateOverride) {
        setErrorMsg("Employee rate override is disabled by organization settings.");
        return;
      }
      if (rangeError) {
        setErrorMsg(rangeError);
        return;
      }
      if (!rateOverrideReason.trim()) {
        setErrorMsg("A justification reason is required for rate overrides.");
        return;
      }
    }

    setLoading(true);
    try {
      const resolvedServiceCategoryId = selectedService ? selectedService.id : serviceCategoryId.trim();

      const payload = {
        customer_name: customerName.trim(),
        service_category_id: resolvedServiceCategoryId,
        payment_method: paymentMethod,
        service_rate: rateNum,
        transaction_date: transactionDate,
        employee_id: isOwner ? employeeId : user.id,
        notes: notes.trim(),
        rate_override_reason: isOverridden ? rateOverrideReason.trim() : ""
      };

      const res = await fetch("/api/income-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record transaction.");
      }

      // Setup confirmation parameters
      const emp = isOwner ? employees.find(e => e.id === employeeId) : user;
      
      setConfirmedEntry({
        customer: customerName.trim(),
        service: selectedService ? (selectedService.service_name || selectedService.category_name) : resolvedServiceCategoryId,
        amount: rateNum,
        method: paymentMethod,
        employee: emp ? emp.full_name : "Self",
      });

      // Clear Form state
      setCustomerName("");
      setServiceCategoryId("");
      setServiceRate("");
      setListedRate(null);
      setRateOverrideReason("");
      setNotes("");
      
      setShowConfirmModal(true);
      onSuccess(); // Triggers parent dashboard/ledger lists to reload
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnother = () => {
    setShowConfirmModal(false);
    setConfirmedEntry(null);
  };

  if (fetchingOptions) {
    return (
      <div className="p-8 flex flex-col justify-center items-center min-h-[300px]">
        <div className="w-10 h-10 border-4 border-blue-900/10 border-t-blue-900 rounded-full animate-spin"></div>
        <p className="text-slate-500 text-xs mt-4 font-sans font-medium">Fetching center metadata templates...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-6" id="income-form-wrapper">
      
      {/* Title Header */}
      <div className="flex items-center gap-3" id="income-form-header">
        <button
          onClick={() => onNavigate("Dashboard")}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Record Income Transaction</h1>
          <p className="text-slate-500 text-xs mt-0.5">Enter receipts for completed center services with audit tracking</p>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-100 text-rose-900 rounded-xl text-xs" id="form-error">
          <XCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
          <p className="font-semibold">{errorMsg}</p>
        </div>
      )}

      {/* Main form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6 space-y-4" id="income-entry-form">
        
        {/* Customer Name */}
        <div>
          <label htmlFor="customer-name" className="block text-xs font-bold text-slate-500 mb-1">
            Customer Name <span className="text-rose-500">*</span>
          </label>
          <input
            id="customer-name"
            type="text"
            required
            list="customer-names-list"
            placeholder="e.g. Subbiah Pillai"
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-900 text-slate-900 font-medium"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            disabled={loading}
          />
          <datalist id="customer-names-list">
            {existingCustomers.map((cust, idx) => (
              <option key={idx} value={cust} />
            ))}
          </datalist>
        </div>

        {/* Service selection + Quick add */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="service-category" className="block text-xs font-bold text-slate-500">
              Service / Application Type <span className="text-rose-500">*</span>
            </label>
            {isOwner && (
              <button
                type="button"
                onClick={() => setShowAddServiceModal(true)}
                className="text-[11px] font-bold text-blue-900 hover:text-blue-950 flex items-center gap-0.5"
                title="Add New Service catalog item dynamically"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Service</span>
              </button>
            )}
          </div>

          <div className="relative">
            <input
              id="service-category"
              type="text"
              required
              list="service-categories-list"
              placeholder="Select standard service or type custom category..."
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-900 text-slate-900"
              value={serviceCategoryId}
              onChange={(e) => handleCategoryInputChange(e.target.value)}
              disabled={loading}
            />
            <datalist id="service-categories-list">
              {categories.map((cat) => (
                <option key={cat.id} value={cat.service_name || cat.category_name}>
                  Standard Listed Price: ₹{cat.default_rate}
                </option>
              ))}
            </datalist>
          </div>
          
          {selectedService && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10.5px] bg-blue-50/50 p-2 border border-blue-100/50 rounded-lg">
              <span className="text-slate-500 font-medium">Standard rate: <span className="font-bold text-slate-900">₹{selectedService.default_rate}</span></span>
              {(selectedService.minimum_rate !== undefined || selectedService.maximum_rate !== undefined) && (
                <span className="text-slate-500 border-l border-slate-200 pl-2 font-medium">
                  Permissible limit: <span className="font-bold text-blue-950">₹{selectedService.minimum_rate ?? 0} → {selectedService.maximum_rate ?? "∞"}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Amount Input */}
        <div>
          <label htmlFor="service-rate" className="block text-xs font-bold text-slate-500 mb-1">
            Collected Charging Rate Amount (₹) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="service-rate"
              type="number"
              required
              min="0"
              placeholder="₹0.00"
              className={`w-full px-4 py-2 bg-slate-50 border rounded-xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-blue-900 transition-all ${
                isRateFieldDisabled 
                  ? "opacity-70 cursor-not-allowed border-slate-200" 
                  : isOverridden 
                    ? "border-amber-300 bg-amber-50/30 text-amber-900" 
                    : "border-slate-200 text-slate-900"
              }`}
              value={serviceRate}
              onChange={(e) => setServiceRate(e.target.value)}
              disabled={isRateFieldDisabled || loading}
            />
            {isRateFieldDisabled && (
              <p className="text-[10px] text-slate-400 mt-1 font-medium">
                🔒 Pricing modifications are locked by the administrator. Contact Owner to request rate override capabilities.
              </p>
            )}
          </div>

          {/* Rate Warning info */}
          {isOverridden && !isRateFieldDisabled && (
            <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[11px]">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Rate Override Activated</span>
              </div>
              <p className="text-[10.5px] leading-relaxed">
                You are changing the charged rate from the catalog standard of <span className="font-bold">₹{activeListedRate}</span>. An audit log trail will be recorded for this transaction.
              </p>
              
              {rangeError && (
                <p className="text-[10.5px] text-red-700 font-bold flex items-center gap-1">
                  ⚠️ {rangeError}
                </p>
              )}

              {/* Reason justifying input field */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Reason / Justification for Override <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Group bulk discount, physically disabled waiver..."
                  className="w-full px-3 py-1 bg-white border border-amber-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={rateOverrideReason}
                  onChange={(e) => setRateOverrideReason(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5">
            Payment Mode <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3" id="payment-modes">
            {(["GPay", "Cash in Hand"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPaymentMethod(mode)}
                disabled={loading}
                className={`py-2 px-4 rounded-xl text-xs font-semibold border text-center transition-all ${
                  paymentMethod === mode
                    ? "bg-blue-50 text-blue-900 border-blue-900"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {mode === "GPay" ? "UPI / Google Pay" : "Cash In Hand"}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label htmlFor="transaction-date" className="block text-xs font-bold text-slate-500 mb-1">
            Transaction Date <span className="text-rose-500">*</span>
          </label>
          <input
            id="transaction-date"
            type="date"
            required
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-900 text-slate-900 font-medium"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Delegate Employee (Owners only) */}
        {isOwner && (
          <div>
            <label htmlFor="employee-delegate" className="block text-xs font-bold text-slate-500 mb-1">
              Recorded For (Employee Delegate)
            </label>
            <select
              id="employee-delegate"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-900 text-slate-900 font-bold"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={loading}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-xs font-bold text-slate-500 mb-1">
            Optional Notes
          </label>
          <textarea
            id="notes"
            rows={2}
            placeholder="Add specific client instructions, application receipt codes..."
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-900 resize-none font-medium"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Submit */}
        <button
          id="income-submit-btn"
          type="submit"
          disabled={loading || (isOverridden && !isOwner && !allowEmployeeRateOverride) || (isOverridden && rangeError !== "")}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl text-xs shadow hover:shadow-md transition-all disabled:opacity-40"
        >
          {loading ? (
            <RefreshCw className="w-4.5 h-4.5 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-4.5 h-4.5" />
              <span>Record Transaction Ledger</span>
            </>
          )}
        </button>
      </form>

      {/* Confirmation Success Modal */}
      {showConfirmModal && confirmedEntry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50 animate-fade-in" id="confirm-modal">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 text-center space-y-4">
            
            <div className="inline-flex p-3 bg-emerald-50 text-emerald-700 rounded-full mb-2">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="font-bold text-slate-800 text-lg">Transaction Logged!</h3>
              <p className="text-slate-500 text-xs mt-1">Filing has been registered successfully with dynamic rate auditing.</p>
            </div>

            {/* Fact board */}
            <div className="bg-slate-50 rounded-xl p-4 text-xs text-left space-y-2 border border-slate-100 font-sans" id="confirmation-details">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-800">{confirmedEntry.customer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Service:</span>
                <span className="font-bold text-slate-800">{confirmedEntry.service}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Collected Rate:</span>
                <span className="font-bold text-emerald-700">₹{confirmedEntry.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mode:</span>
                <span className="font-semibold text-slate-800">{confirmedEntry.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Operator:</span>
                <span className="font-semibold text-slate-800">{confirmedEntry.employee}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2" id="modal-actions">
              <button
                onClick={handleAddAnother}
                className="flex-1 py-2.5 px-4 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl text-xs transition-all"
              >
                Add Another Entry
              </button>
              <button
                onClick={() => onNavigate("Ledgers")}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
              >
                Go to Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Service Creation Modal (Owner Only) */}
      {isOwner && showAddServiceModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="add-service-modal">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden max-w-md w-full text-xs">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800">Dynamically Create & Select New Service</h3>
              <button 
                type="button" 
                onClick={() => setShowAddServiceModal(false)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              >
                <XCircle className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateService} className="p-4 space-y-3">
              {newServiceError && (
                <div className="p-2 bg-red-50 border border-red-100 text-red-700 rounded-xl font-semibold">
                  {newServiceError}
                </div>
              )}

              <div>
                <label className="block text-slate-500 font-bold mb-1">Service Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PAN Card Correction"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-900"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Service Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="PAN-CORR"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-900 uppercase font-mono"
                    value={newServiceCode}
                    onChange={(e) => setNewServiceCode(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Default Rate (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="120"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-900 font-bold"
                    value={newServiceRate}
                    onChange={(e) => setNewServiceRate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Min Permitted (₹)</label>
                  <input
                    type="number"
                    placeholder="None"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-900"
                    value={newServiceMinRate}
                    onChange={(e) => setNewServiceMinRate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Max Permitted (₹)</label>
                  <input
                    type="number"
                    placeholder="None"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-900"
                    value={newServiceMaxRate}
                    onChange={(e) => setNewServiceMaxRate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddServiceModal(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newServiceLoading}
                  className="px-3 py-1.5 bg-blue-900 hover:bg-blue-950 text-white rounded-lg font-bold flex items-center gap-1"
                >
                  {newServiceLoading ? (
                    <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create & Select</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
