/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Profile, IncomeEntry, ExpenseEntry, ServiceCategory, ExpenseCategory } from "../types";
import {
  Search,
  Filter,
  Download,
  Trash2,
  Edit3,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Clock
} from "lucide-react";

interface TransactionsProps {
  user: Profile;
  onRefreshTrigger: () => void;
}

export default function Transactions({ user, onRefreshTrigger }: TransactionsProps) {
  const [activeTab, setActiveTab] = useState<"income" | "expense">("income");
  
  // Lists
  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [appSettings, setAppSettings] = useState<any>(null);
  
  // Loading states
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Dialog Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Soft Delete Confirmation Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch Master Records
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const [scRes, ecRes, setRes] = await Promise.all([
          fetch("/api/service-categories"),
          fetch("/api/expense-categories"),
          fetch("/api/settings")
        ]);

        if (scRes.ok) {
          const scData = await scRes.json();
          setServiceCategories(scData.categories);
        }
        if (ecRes.ok) {
          const ecData = await ecRes.json();
          setExpenseCategories(ecData.categories);
        }
        if (setRes.ok) {
          const setData = await setRes.json();
          setAppSettings(setData.settings);
        }

        if (user.role === "owner") {
          const empRes = await fetch("/api/employees");
          if (empRes.ok) {
            const empData = await empRes.json();
            setEmployees(empData.employees);
          }
        }
      } catch (err) {
        console.error("Failed loading master filters:", err);
      }
    };
    fetchMasters();
  }, [user]);

  // Fetch Transactions based on filter options
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (searchQuery) {
        if (activeTab === "income") query.append("customer", searchQuery);
        // Expense search handled locally or simulated below
      }
      if (filterEmployeeId) query.append("employee_id", filterEmployeeId);
      if (filterCategoryId) {
        if (activeTab === "income") query.append("service_id", filterCategoryId);
        else query.append("category_id", filterCategoryId);
      }
      if (filterPaymentMethod) query.append("payment_method", filterPaymentMethod);
      if (dateFrom) query.append("date_from", dateFrom);
      if (dateTo) query.append("date_to", dateTo);
      query.append("sort_by", sortBy);

      const endpoint = activeTab === "income" ? "/api/income-entries" : "/api/expense-entries";
      const res = await fetch(`${endpoint}?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (activeTab === "income") {
          setIncomes(data.entries);
        } else {
          setExpenses(data.entries);
        }
      }
    } catch (err) {
      console.error("Failed to load transactions list:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    setCurrentPage(1); // Reset page on filter shift
  }, [activeTab, filterEmployeeId, filterCategoryId, filterPaymentMethod, dateFrom, dateTo, sortBy, searchQuery]);

  // CSV Exporter (Robust client-side encoder)
  const handleExportCSV = () => {
    const listToExport = activeTab === "income" ? incomes : expenses;
    if (listToExport.length === 0) return;

    let headers: string[] = [];
    let rows: string[][] = [];

    if (activeTab === "income") {
      headers = ["Transaction Date", "Customer Name", "Service Category", "Payment Method", "Amount Rate (INR)", "Recorded By", "Notes"];
      rows = listToExport.map((e) => {
        const cat = serviceCategories.find((c) => c.id === e.service_category_id);
        const emp = employees.find((emp) => emp.id === e.employee_id) || user;
        return [
          e.transaction_date,
          e.customer_name,
          cat ? cat.category_name : e.service_category_id,
          e.payment_method,
          e.service_rate.toString(),
          emp ? emp.full_name : "Staff",
          e.notes || "",
        ];
      });
    } else {
      headers = ["Transaction Date", "Category", "Description", "Payment Method", "Amount Paid (INR)", "Recorded By", "Notes"];
      rows = listToExport.map((e) => {
        const cat = expenseCategories.find((c) => c.id === e.expense_category_id);
        const emp = employees.find((emp) => emp.id === e.employee_id) || user;
        return [
          e.transaction_date,
          cat ? cat.category_name : "Other Expense",
          e.description,
          e.payment_method,
          e.amount.toString(),
          emp ? emp.full_name : "Staff",
          e.notes || "",
        ];
      });
    }

    // Combine headers & rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `e-sevai-${activeTab}-ledger-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Check editing privileges for employees
  const canEditItem = (item: any): { allowed: boolean; reason?: string } => {
    if (user.role === "owner") return { allowed: true };
    if (!appSettings) return { allowed: false, reason: "Settings loading..." };
    
    if (!appSettings.allow_employee_editing) {
      return { allowed: false, reason: "Editing is disabled for employee accounts." };
    }

    const createdTime = new Date(item.created_at).getTime();
    const limitMs = appSettings.employee_editing_limit_hours * 60 * 60 * 1000;
    if (Date.now() - createdTime > limitMs) {
      return { allowed: false, reason: `Transactions older than ${appSettings.employee_editing_limit_hours} hours cannot be modified.` };
    }

    return { allowed: true };
  };

  // Edit Action Trigger
  const handleOpenEdit = (item: any) => {
    const privilege = canEditItem(item);
    if (!privilege.allowed) {
      alert(privilege.reason);
      return;
    }

    setEditItem(item);
    setEditError(null);
    setEditSuccess(null);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;

    setEditLoading(true);
    setEditError(null);

    try {
      const endpoint = activeTab === "income" 
        ? `/api/income-entries/${editItem.id}` 
        : `/api/expense-entries/${editItem.id}`;
      
      const payload: any = {};
      if (activeTab === "income") {
        payload.customer_name = editItem.customer_name;
        payload.service_category_id = editItem.service_category_id;
        payload.service_rate = Number(editItem.service_rate);
        payload.payment_method = editItem.payment_method;
        payload.transaction_date = editItem.transaction_date;
        payload.notes = editItem.notes;
        if (user.role === "owner") payload.employee_id = editItem.employee_id;
      } else {
        payload.description = editItem.description;
        payload.expense_category_id = editItem.expense_category_id;
        payload.amount = Number(editItem.amount);
        payload.payment_method = editItem.payment_method;
        payload.transaction_date = editItem.transaction_date;
        payload.notes = editItem.notes;
        if (user.role === "owner") payload.employee_id = editItem.employee_id;
      }

      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Save action failed");
      }

      setEditSuccess("Transaction edited and logged securely.");
      setTimeout(() => {
        setShowEditModal(false);
        setEditItem(null);
        fetchTransactions();
        onRefreshTrigger();
      }, 1000);
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Delete Action Trigger (Soft deletion)
  const handleOpenDelete = (item: any) => {
    if (user.role !== "owner") {
      alert("Unauthorized. Deletion rights are strictly restricted to Center Owners.");
      return;
    }
    setDeleteItem(item);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem) return;
    setDeleteLoading(true);

    try {
      const endpoint = activeTab === "income" 
        ? `/api/income-entries/${deleteItem.id}` 
        : `/api/expense-entries/${deleteItem.id}`;

      const res = await fetch(endpoint, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Soft delete failed.");
      }

      setShowDeleteModal(false);
      setDeleteItem(null);
      fetchTransactions();
      onRefreshTrigger();
    } catch (err: any) {
      alert(`Error soft-deleting transaction: ${err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Pagination Helper
  const listToDisplay = activeTab === "income" ? incomes : expenses;
  const totalPages = Math.ceil(listToDisplay.length / itemsPerPage) || 1;
  const paginatedList = listToDisplay.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const dynamicServiceNames = Array.from(
    new Set(
      incomes
        .map((inc) => inc.service_category_id)
        .filter((id) => id && !serviceCategories.some((sc) => sc.id === id))
    )
  ) as string[];

  return (
    <div className="p-4 md:p-8 space-y-6" id="ledger-ledger-container">
      
      {/* Title & Tabs Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5" id="ledger-header">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 tracking-tight">Center Ledgers & Audit Records</h1>
          <p className="text-slate-500 text-xs mt-1">Review active income inflows and expense disbursements</p>
        </div>
 
        {/* Tab Toggle */}
        <div className="bg-slate-100 p-1 rounded-xl flex gap-1 self-start" id="ledger-tabs">
          <button
            onClick={() => { setActiveTab("income"); setSearchQuery(""); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all ${
              activeTab === "income" ? "bg-[#1e3a8a] text-white shadow-sm" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            Income Receipts
          </button>
          <button
            onClick={() => { setActiveTab("expense"); setSearchQuery(""); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all ${
              activeTab === "expense" ? "bg-[#7e22ce] text-white shadow-sm" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            Expense Payouts
          </button>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4 text-xs" id="ledger-filters">
        
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3">
          
          {/* Fuzzy Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={activeTab === "income" ? "Search customer name..." : "Search description..."}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-600"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Employee Isolation Filter (Admin only) */}
          {user.role === "owner" ? (
            <select
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none"
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
            >
              <option value="">All Employees / Desks</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.full_name}</option>
              ))}
            </select>
          ) : (
            <div className="w-full px-3 py-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl font-semibold flex items-center gap-1.5 font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>Desk: {user.full_name.split(" ")[0]} (Isolated)</span>
            </div>
          )}

          {/* Category Filter */}
          <select
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none"
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
          >
            <option value="">{activeTab === "income" ? "All Services" : "All Expenses"}</option>
            {activeTab === "income" ? (
              <>
                <optgroup label="Standard Services">
                  {serviceCategories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
                </optgroup>
                {dynamicServiceNames.length > 0 && (
                  <optgroup label="Custom / Dynamic Services">
                    {dynamicServiceNames.map(name => <option key={name} value={name}>{name}</option>)}
                  </optgroup>
                )}
              </>
            ) : (
              expenseCategories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)
            )}
          </select>

          {/* Payment Method */}
          <select
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none"
            value={filterPaymentMethod}
            onChange={(e) => setFilterPaymentMethod(e.target.value)}
          >
            <option value="">All Payment Modes</option>
            {activeTab === "income" ? (
              <>
                <option value="GPay">GPay (UPI)</option>
                <option value="Cash in Hand">Cash in Hand</option>
              </>
            ) : (
              <>
                <option value="GPay">GPay (UPI)</option>
                <option value="Cash in Hand">Cash in Hand</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Other">Other</option>
              </>
            )}
          </select>

          {/* Sort Selection */}
          <select
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest Amount</option>
            <option value="lowest">Lowest Amount</option>
          </select>
        </div>

        {/* Date Boundaries */}
        <div className="flex flex-wrap gap-3 items-center border-t border-slate-100 pt-3" id="ledger-date-filters">
          <span className="text-slate-500 font-semibold shrink-0">Boundary Date:</span>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {(dateFrom || dateTo || searchQuery || filterEmployeeId || filterCategoryId || filterPaymentMethod) && (
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setSearchQuery("");
                setFilterEmployeeId("");
                setFilterCategoryId("");
                setFilterPaymentMethod("");
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg shrink-0 flex items-center gap-1 transition-all"
            >
              <span>Reset Filters</span>
              <X className="w-3 h-3" />
            </button>
          )}

          {/* Exporter Button */}
          <button
            onClick={handleExportCSV}
            className="ml-auto px-4 py-2 bg-[#1e3a8a] hover:bg-blue-950 text-white font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Grid List representation */}
      {loading ? (
        <div className="p-12 flex flex-col justify-center items-center">
          <RefreshCw className="w-8 h-8 text-[#7e22ce] animate-spin" />
          <span className="text-slate-500 text-xs mt-3 font-semibold">Loading audited transactions...</span>
        </div>
      ) : paginatedList.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center" id="ledger-empty-state">
          <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="font-semibold text-slate-800">No Ledger Entries</h3>
          <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
            We couldn't find any financial transactions matching your selected filters. Refine criteria or add a transaction first.
          </p>
        </div>
      ) : (
        <div className="space-y-4" id="ledger-grid-view">
          
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm" id="ledger-desktop-table">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">{activeTab === "income" ? "Customer" : "Description"}</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Payment Mode</th>
                  <th className="py-3.5 px-4">Desk operator</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {paginatedList.map((item) => {
                  const sCat = activeTab === "income" 
                     ? serviceCategories.find(c => c.id === item.service_category_id)
                     : null;
                  const eCat = activeTab === "expense" 
                     ? expenseCategories.find(c => c.id === item.expense_category_id)
                     : null;
                  
                  const creator = employees.find(e => e.id === item.employee_id) || user;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="py-3.5 px-4 font-mono">{item.transaction_date}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {activeTab === "income" ? item.customer_name : item.description}
                        {item.notes && (
                          <span className="block text-[10px] text-slate-400 font-normal mt-0.5 max-w-xs truncate">{item.notes}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          activeTab === "income" ? "bg-blue-50 text-[#1e3a8a]" : "bg-purple-50 text-[#7e22ce]"
                        }`}>
                          {activeTab === "income" 
                            ? (sCat ? sCat.category_name : "e-Sevai Service")
                            : (eCat ? eCat.category_name : "Other Expense")
                          }
                        </span>
                      </td>
                      <td className="py-3.5 px-4">{item.payment_method === "GPay" ? "UPI / GPay" : item.payment_method}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-600">{creator ? creator.full_name : "Staff desk"}</td>
                      <td className="py-3.5 px-4 text-right font-bold font-mono">
                        <span className={activeTab === "income" ? "text-emerald-700" : "text-rose-700"}>
                          {activeTab === "income" ? "+" : "-"}₹{Number(activeTab === "income" ? item.service_rate : item.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-slate-400 hover:text-[#1e3a8a] hover:bg-slate-100 rounded-lg transition-all"
                            title="Edit transaction details"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {user.role === "owner" && (
                            <button
                              onClick={() => handleOpenDelete(item)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg transition-all"
                              title="Soft delete entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden space-y-3" id="ledger-mobile-cards">
            {paginatedList.map((item) => {
              const sCat = activeTab === "income" 
                ? serviceCategories.find(c => c.id === item.service_category_id)
                : null;
              const eCat = activeTab === "expense" 
                ? expenseCategories.find(c => c.id === item.expense_category_id)
                : null;

              const creator = employees.find(e => e.id === item.employee_id) || user;

              return (
                <div key={item.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm relative space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 block mb-0.5">{item.transaction_date}</span>
                      <h4 className="font-semibold text-slate-900 text-sm">
                        {activeTab === "income" ? item.customer_name : item.description}
                      </h4>
                    </div>
                    <span className="font-bold font-mono text-sm shrink-0">
                      <span className={activeTab === "income" ? "text-emerald-700" : "text-rose-700"}>
                        {activeTab === "income" ? "+" : "-"}₹{Number(activeTab === "income" ? item.service_rate : item.amount).toFixed(2)}
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[10px]" id="card-labels">
                    <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      activeTab === "income" ? "bg-blue-50 text-[#1e3a8a]" : "bg-purple-50 text-[#7e22ce]"
                    }`}>
                      {activeTab === "income" 
                        ? (sCat ? sCat.category_name : item.service_category_id)
                        : (eCat ? eCat.category_name : "Expense")
                      }
                    </span>
                    <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded-lg border border-slate-100 font-semibold">
                      {item.payment_method === "GPay" ? "GPay" : item.payment_method}
                    </span>
                    <span className="text-slate-400 font-semibold">Desk: {creator ? creator.full_name.split(" ")[0] : "Staff"}</span>
                  </div>

                  {item.notes && (
                    <p className="text-[10px] text-slate-400 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 leading-relaxed font-sans italic">
                      "{item.notes}"
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="px-3 py-1.5 text-xs text-[#1e3a8a] bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-lg font-bold transition-all flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    {user.role === "owner" && (
                      <button
                        onClick={() => handleOpenDelete(item)}
                        className="px-3 py-1.5 text-xs text-rose-700 bg-rose-50/50 hover:bg-rose-50 border border-rose-100 rounded-lg font-bold transition-all flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Simple Pagination */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500" id="ledger-pagination">
            <span>Showing Page {currentPage} of {totalPages}</span>
            <div className="flex gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal Dialogue */}
      {showEditModal && editItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50 animate-fade-in" id="edit-modal">
          <form onSubmit={handleSaveEdit} className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden text-xs space-y-4">
            
            <div className="bg-[#1e3a8a] p-4 text-white flex justify-between items-center">
              <h3 className="font-display font-semibold text-sm">Edit Logged Transaction</h3>
              <button type="button" onClick={() => setShowEditModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[450px] overflow-y-auto">
              {editError && (
                <div className="p-3 bg-rose-50 text-rose-900 border border-rose-100 rounded-xl font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              {editSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-100 rounded-xl font-medium flex items-center gap-2">
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span>{editSuccess}</span>
                </div>
              )}

              {/* Specific inputs */}
              {activeTab === "income" ? (
                <>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Customer Name</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-600 font-medium text-slate-900"
                      value={editItem.customer_name}
                      onChange={(e) => setEditItem({ ...editItem, customer_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Service / Application Name</label>
                    <input
                      type="text"
                      list="edit-service-categories-list"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-600 font-medium text-slate-900"
                      value={
                        serviceCategories.find(sc => sc.id === editItem.service_category_id)?.category_name || 
                        editItem.service_category_id
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        const found = serviceCategories.find(sc => sc.category_name.toLowerCase() === val.toLowerCase());
                        setEditItem({ 
                          ...editItem, 
                          service_category_id: found ? found.id : val 
                        });
                      }}
                    />
                    <datalist id="edit-service-categories-list">
                      {serviceCategories.map((sc) => (
                        <option key={sc.id} value={sc.category_name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Collected Rate (₹)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-600 font-bold text-slate-900"
                      value={editItem.service_rate}
                      onChange={(e) => setEditItem({ ...editItem, service_rate: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Payout Description</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-600 font-medium text-slate-900"
                      value={editItem.description}
                      onChange={(e) => setEditItem({ ...editItem, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Expense Category</label>
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-600 text-slate-900 font-medium"
                      value={editItem.expense_category_id}
                      onChange={(e) => setEditItem({ ...editItem, expense_category_id: e.target.value })}
                    >
                      {expenseCategories.map((ec) => (
                        <option key={ec.id} value={ec.id}>{ec.category_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Amount Paid (₹)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-600 font-bold text-slate-900"
                      value={editItem.amount}
                      onChange={(e) => setEditItem({ ...editItem, amount: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* Shared items */}
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Payment Method</label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-600 text-slate-900 font-medium"
                  value={editItem.payment_method}
                  onChange={(e) => setEditItem({ ...editItem, payment_method: e.target.value })}
                >
                  <option value="GPay">GPay (UPI)</option>
                  <option value="Cash in Hand">Cash in Hand</option>
                  {activeTab === "expense" && (
                    <>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Other">Other</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Transaction Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-600 font-mono text-slate-900 font-medium"
                  value={editItem.transaction_date}
                  onChange={(e) => setEditItem({ ...editItem, transaction_date: e.target.value })}
                />
              </div>

              {/* Re-delegate employee (Owner only) */}
              {user.role === "owner" && (
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Re-assign Employee</label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-600 text-slate-900 font-medium"
                    value={editItem.employee_id}
                    onChange={(e) => setEditItem({ ...editItem, employee_id: e.target.value })}
                  >
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Audited Notes</label>
                <textarea
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-600 resize-none text-slate-900 font-medium"
                  rows={2}
                  value={editItem.notes || ""}
                  onChange={(e) => setEditItem({ ...editItem, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 flex gap-2 justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editLoading}
                className="px-4 py-2 bg-[#1e3a8a] hover:bg-blue-950 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                {editLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Save Ledger Changes</span>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Dialogue */}
      {showDeleteModal && deleteItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50 animate-fade-in" id="delete-modal">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 text-center space-y-4">
            
            <div className="inline-flex p-3 bg-rose-50 text-rose-700 rounded-full mb-1">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>

            <div>
              <h3 className="font-display font-bold text-slate-800 text-base">Soft Delete Ledger Record?</h3>
              <p className="text-slate-500 text-xs mt-1">
                Are you sure you want to delete this {activeTab} entry of{" "}
                <span className="font-bold text-slate-700 font-mono">
                  ₹{Number(activeTab === "income" ? deleteItem.service_rate : deleteItem.amount).toFixed(2)}
                </span>
                ? It will be archived and logged in audit logs.
              </p>
            </div>

            <div className="flex gap-2 pt-2" id="delete-modal-actions">
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                {deleteLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Confirm Deletion</span>}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
