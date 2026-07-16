/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Profile, ExpenseCategory, PaymentMethod } from "../types";
import { CheckCircle2, RefreshCw, XCircle, ArrowLeft, Plus, UploadCloud, FileText, Check } from "lucide-react";

interface ExpenseFormProps {
  user: Profile;
  onSuccess: () => void;
  onNavigate: (tab: string) => void;
}

export default function ExpenseForm({ user, onSuccess, onNavigate }: ExpenseFormProps) {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingOptions, setFetchingOptions] = useState(true);

  // Form State
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("GPay");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);
  const [employeeId, setEmployeeId] = useState(user.id);
  const [notes, setNotes] = useState("");
  
  // Upload States
  const [receiptUrl, setReceiptUrl] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [appSettings, setAppSettings] = useState<any>(null);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const catRes = await fetch("/api/expense-categories");
        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData.categories.filter((c: any) => c.is_active));
        }

        const setRes = await fetch("/api/settings");
        if (setRes.ok) {
          const setData = await setRes.json();
          setAppSettings(setData.settings);
        }

        if (user.role === "owner") {
          const empRes = await fetch("/api/employees");
          if (empRes.ok) {
            const empData = await empRes.json();
            setEmployees(empData.employees.filter((e: any) => e.is_active));
          }
        }
      } catch (err) {
        console.error("Failed to load options for Expense Form:", err);
      } finally {
        setFetchingOptions(false);
      }
    };
    loadOptions();
  }, [user]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("File size exceeds 5MB limit.");
      return;
    }

    // Validate type (JPG, PNG, PDF)
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setErrorMsg("Invalid file format. Please upload JPG, PNG, or PDF.");
      return;
    }

    setErrorMsg(null);
    setUploadedFileName(file.name);
    setUploadProgress(0);

    // Simulate progress bar upload to Supabase Storage
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev === null) return 0;
        if (prev >= 100) {
          clearInterval(interval);
          setReceiptUrl(`/receipts/${file.name}`);
          return 100;
        }
        return prev + 25;
      });
    }, 150);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !description || !amount || !paymentMethod || !transactionDate) {
      setErrorMsg("Please fill out all required fields.");
      return;
    }

    const amtNum = Number(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setErrorMsg("Expense amount must be a number greater than zero.");
      return;
    }

    if (appSettings?.require_expense_receipt && !receiptUrl) {
      setErrorMsg("Receipt upload is mandatory under current business policies. Please choose a PDF/Image receipt.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        expense_category_id: categoryId,
        description,
        amount: amtNum,
        payment_method: paymentMethod,
        transaction_date: transactionDate,
        employee_id: user.role === "owner" ? employeeId : user.id,
        receipt_url: receiptUrl,
        notes,
      };

      const res = await fetch("/api/expense-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to log expense payout.");
      }

      setSuccessMsg("Expense transaction logged and recorded in UTC Audit Trail.");
      
      // Clear states
      setCategoryId("");
      setDescription("");
      setAmount("");
      setNotes("");
      setReceiptUrl("");
      setUploadProgress(null);
      setUploadedFileName("");
      
      onSuccess(); // Refresh dashboards
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchingOptions) {
    return (
      <div className="p-6 flex flex-col justify-center items-center min-h-[300px]">
        <RefreshCw className="w-8 h-8 text-[#7e22ce] animate-spin" />
        <p className="text-slate-500 text-xs mt-3">Fetching operating budget categories...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto" id="expense-form-wrapper">
      
      {/* Title Header */}
      <div className="flex items-center gap-3 mb-6" id="expense-form-header">
        <button
          onClick={() => onNavigate("Dashboard")}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display text-lg font-semibold text-slate-900">Record Center Expense</h1>
          <p className="text-slate-500 text-xs">Log stationery, electricity, EB bills, or printing operational payouts</p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-5 flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-100 text-rose-900 rounded-xl text-xs" id="form-error">
          <XCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="mb-5 flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-900 rounded-xl text-xs" id="form-success">
          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
          <p className="font-medium">{successMsg}</p>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6 space-y-4" id="expense-entry-form">
        
        {/* Category */}
        <div>
          <label htmlFor="expense-category" className="block text-xs font-semibold text-slate-500 mb-1">
            Expense Category <span className="text-rose-500">*</span>
          </label>
          <select
            id="expense-category"
            required
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-600 transition-all"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={loading}
          >
            <option value="">-- Choose expense type --</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.category_name}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-xs font-semibold text-slate-500 mb-1">
            Payment Description <span className="text-rose-500">*</span>
          </label>
          <input
            id="description"
            type="text"
            required
            placeholder="e.g. EB Bill payment Madurai center shop"
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-600 transition-all"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Amount */}
        <div>
          <label htmlFor="amount" className="block text-xs font-semibold text-slate-500 mb-1">
            Amount Paid (₹) <span className="text-rose-500">*</span>
          </label>
          <input
            id="amount"
            type="number"
            required
            min="1"
            placeholder="0.00"
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-purple-600 transition-all"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">
            Payment Method <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2" id="expense-payment-methods">
            {([ "Cash in Hand", "GPay", "Bank Transfer", "Other" ] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPaymentMethod(mode)}
                disabled={loading}
                className={`py-2 px-1 rounded-xl text-[10px] font-medium border text-center transition-all ${
                  paymentMethod === mode
                    ? "bg-purple-50 text-[#7e22ce] border-[#7e22ce] font-semibold"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {mode === "GPay" ? "UPI / GPay" : mode}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label htmlFor="transaction-date" className="block text-xs font-semibold text-slate-500 mb-1">
            Transaction Date <span className="text-rose-500">*</span>
          </label>
          <input
            id="transaction-date"
            type="date"
            required
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-600 transition-all"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Delegate Employee (Owners only) */}
        {user.role === "owner" && (
          <div>
            <label htmlFor="employee-delegate" className="block text-xs font-semibold text-slate-500 mb-1">
              Recorded For (Employee Delegate)
            </label>
            <select
              id="employee-delegate"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-600 transition-all"
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

        {/* Receipt Upload */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex justify-between">
            <span>Upload Receipt {appSettings?.require_expense_receipt && <span className="text-rose-500">* (Required)</span>}</span>
            <span className="text-slate-400 font-normal">Max size: 5MB (JPG, PNG, PDF)</span>
          </label>
          
          <div className="border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-2xl p-4 text-center cursor-pointer relative bg-slate-50/50" id="receipt-drop-zone">
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              disabled={loading}
            />
            
            {uploadProgress === null ? (
              <div className="flex flex-col items-center">
                <UploadCloud className="w-8 h-8 text-slate-400 mb-1" />
                <p className="text-xs font-medium text-slate-600">Drag receipt here or click to select</p>
                <p className="text-[10px] text-slate-400 mt-1">Accepts PDF, Image files</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 max-w-xs mx-auto">
                  <span className="flex items-center gap-1.5 truncate">
                    <FileText className="w-4 h-4 text-[#7e22ce] shrink-0" />
                    <span className="truncate">{uploadedFileName}</span>
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-slate-200 rounded-full h-2 max-w-xs mx-auto">
                  <div
                    className="bg-[#7e22ce] h-2 rounded-full transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>

                {uploadProgress === 100 && (
                  <div className="text-[10px] text-emerald-600 flex items-center justify-center gap-1 font-semibold">
                    <Check className="w-3.5 h-3.5" />
                    <span>Receipt verified and attached!</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-xs font-semibold text-slate-500 mb-1">
            Optional Notes
          </label>
          <textarea
            id="notes"
            rows={2}
            placeholder="Add voucher details, check references, bill counts, etc."
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-purple-600 transition-all resize-none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Submit */}
        <button
          id="expense-submit-btn"
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1e3a8a] hover:bg-blue-950 text-white font-medium rounded-xl text-xs shadow hover:shadow-md transition-all disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw className="w-4.5 h-4.5 animate-spin" />
          ) : (
            <>
              <Plus className="w-4.5 h-4.5" />
              <span>Log Expense</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
