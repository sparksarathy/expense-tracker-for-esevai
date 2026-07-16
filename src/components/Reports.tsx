/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Profile, ServiceCategory, ExpenseCategory } from "../types";
import {
  Calendar,
  Printer,
  Download,
  Filter,
  Users,
  Briefcase,
  Layers,
  ChevronDown,
  ChevronUp,
  FileText,
  RefreshCw
} from "lucide-react";

interface ReportsProps {
  user: Profile;
}

export default function Reports({ user }: ReportsProps) {
  const [filterPreset, setFilterPreset] = useState<string>("this_month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterServiceId, setFilterServiceId] = useState("");

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [services, setServices] = useState<ServiceCategory[]>([]);

  // Update default dates based on preset selection
  useEffect(() => {
    const today = new Date();
    const format = (d: Date) => d.toISOString().split("T")[0];

    let from = "";
    let to = format(today);

    if (filterPreset === "today") {
      from = format(today);
    } else if (filterPreset === "this_week") {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      from = format(new Date(today.setDate(diff)));
    } else if (filterPreset === "this_month") {
      from = format(new Date(today.getFullYear(), today.getMonth(), 1));
    } else if (filterPreset === "this_year") {
      from = format(new Date(today.getFullYear(), 0, 1));
    }

    if (filterPreset !== "custom") {
      setDateFrom(from);
      setDateTo(to);
    }
  }, [filterPreset]);

  // Fetch report and filters
  const loadFiltersAndReport = async () => {
    try {
      const [scRes] = await Promise.all([
        fetch("/api/service-categories"),
      ]);
      if (scRes.ok) {
        const scData = await scRes.json();
        setServices(scData.categories);
      }

      if (user.role === "owner") {
        const empRes = await fetch("/api/employees");
        if (empRes.ok) {
          const empData = await empRes.json();
          setEmployees(empData.employees);
        }
      }
    } catch (err) {
      console.error("Failed loading report lists:", err);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (dateFrom) query.append("date_from", dateFrom);
      if (dateTo) query.append("date_to", dateTo);
      if (filterEmployeeId) query.append("employee_id", filterEmployeeId);
      if (filterServiceId) query.append("service_id", filterServiceId);

      const res = await fetch(`/api/reports?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (err) {
      console.error("Failed generating financials:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiltersAndReport();
  }, [user]);

  useEffect(() => {
    generateReport();
  }, [dateFrom, dateTo, filterEmployeeId, filterServiceId]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportReportCSV = () => {
    if (!reportData) return;
    const { incomes, expenses } = reportData;

    let headers = ["Record Type", "Date", "Customer Name/Description", "Category", "Payment Method", "Amount (INR)"];
    let rows: string[][] = [];

    incomes.forEach((i: any) => {
      rows.push([
        "Income",
        i.transaction_date,
        i.customer_name,
        i.service_name || "e-Sevai Service",
        i.payment_method,
        i.service_rate.toString()
      ]);
    });

    expenses.forEach((e: any) => {
      rows.push([
        "Expense",
        e.transaction_date,
        e.description,
        e.category_name || "Office operating cost",
        e.payment_method,
        e.amount.toString()
      ]);
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `e-sevai-financial-statement-${dateFrom}-to-${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || !reportData) {
    return (
      <div className="p-6 space-y-4" id="report-skeleton">
        <div className="h-8 w-40 bg-slate-200 rounded animate-pulse" />
        <div className="h-28 bg-slate-200 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const { summary, revenueByCategory, expensesByCategory, revenueByEmployee, dailyBreakdown } = reportData;

  return (
    <div className="p-4 md:p-6 space-y-6" id="reports-module">
      
      {/* Page Title & Actions (Hidden during native print layout) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 no-print" id="reports-header">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">Financial Reports & Statements</h1>
          <p className="text-slate-500 text-xs mt-1">Audit profit margins, operating overheads, and employee service breakdowns</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 border border-slate-200 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleExportReportCSV}
            className="px-3.5 py-2 bg-blue-900 hover:bg-blue-950 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Report Controls Panel (Hidden during native printing) */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-4 no-print" id="report-query-filters">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          
          {/* Preset Period */}
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Time Presets</label>
            <select
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              value={filterPreset}
              onChange={(e) => setFilterPreset(e.target.value)}
            >
              <option value="today">Today (24 Hours)</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Employee isolation (Owner only) */}
          {user.role === "owner" && (
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Filter Employee Desk</label>
              <select
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                value={filterEmployeeId}
                onChange={(e) => setFilterEmployeeId(e.target.value)}
              >
                <option value="">All Desks</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </div>
          )}

          {/* Service filter */}
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Filter Service Category</label>
            <select
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              value={filterServiceId}
              onChange={(e) => setFilterServiceId(e.target.value)}
            >
              <option value="">All Services</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.category_name}</option>)}
            </select>
          </div>

          {/* Date range manual inputs if custom */}
          {filterPreset === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Start Date</label>
                <input
                  type="date"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-mono"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1">End Date</label>
                <input
                  type="date"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-mono"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Sheet Layout (This is styled beautifully for PDF generation & printing) */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-sm space-y-6 print:border-none print:shadow-none" id="printable-financial-sheet">
        
        {/* Print Only Header (Visible only on printing) */}
        <div className="hidden print-only text-center border-b border-slate-200 pb-5 mb-5" id="printable-letterhead">
          <h2 className="font-display text-xl font-bold text-slate-900">e-Sevai Maiyam Center</h2>
          <p className="text-xs text-slate-500 mt-1">Operational Financial Audit Statement</p>
          <div className="flex justify-between text-[10px] text-slate-400 mt-4 font-mono">
            <span>Period: {dateFrom || "Start"} to {dateTo || "Today"}</span>
            <span>Generated on: {new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
          </div>
        </div>

        {/* Statement Overview Cards */}
        <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-6 text-xs" id="statement-overview">
          <div>
            <span className="text-slate-500 uppercase font-semibold text-[10px] tracking-wider block mb-1">Total Income Inflows</span>
            <span className="text-xl md:text-2xl font-bold text-emerald-700">₹{Number(summary.totalIncome).toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase font-semibold text-[10px] tracking-wider block mb-1">Total Expenses Outflows</span>
            <span className="text-xl md:text-2xl font-bold text-rose-700">₹{Number(summary.totalExpense).toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase font-semibold text-[10px] tracking-wider block mb-1">Net Operating Surplus</span>
            <span className={`text-xl md:text-2xl font-bold ${summary.netProfit >= 0 ? "text-blue-900" : "text-rose-700"}`}>
              ₹{Number(summary.netProfit).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Breakdown Tables Side-by-Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-xs pt-4" id="statement-breakdowns">
          
          {/* Revenue by Service Table */}
          <div className="space-y-3" id="breakdown-services">
            <h3 className="font-display font-bold text-slate-800 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-blue-900 shrink-0" />
              <span>Service category distribution</span>
            </h3>
            
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-500 border-b border-slate-100">
                    <th className="p-3">Category Name</th>
                    <th className="p-3 text-center">Applications</th>
                    <th className="p-3 text-right">Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {revenueByCategory.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-400 italic">No category volumes recorded.</td>
                    </tr>
                  ) : (
                    revenueByCategory.map((c: any) => (
                      <tr key={c.category_name} className="hover:bg-slate-50/50">
                        <td className="p-3 font-medium text-slate-800">{c.category_name}</td>
                        <td className="p-3 text-center font-semibold text-slate-500">{c.count}</td>
                        <td className="p-3 text-right font-bold font-mono text-slate-800">₹{Number(c.amount).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Revenue by Expense Categories Table */}
          <div className="space-y-3" id="breakdown-expenses">
            <h3 className="font-display font-bold text-slate-800 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-700 shrink-0" />
              <span>Expense category distribution</span>
            </h3>
            
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-500 border-b border-slate-100">
                    <th className="p-3">Expense Head</th>
                    <th className="p-3 text-center">Vouchers</th>
                    <th className="p-3 text-right">Payout Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {expensesByCategory.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-400 italic">No business operating costs logged.</td>
                    </tr>
                  ) : (
                    expensesByCategory.map((c: any) => (
                      <tr key={c.category_name} className="hover:bg-slate-50/50">
                        <td className="p-3 font-medium text-slate-800">{c.category_name}</td>
                        <td className="p-3 text-center font-semibold text-slate-500">{c.count}</td>
                        <td className="p-3 text-right font-bold font-mono text-slate-800">₹{Number(c.amount).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Employee Performance Breakdown (Owners only) */}
        {user.role === "owner" && (
          <div className="space-y-3 pt-6 border-t border-slate-100 text-xs" id="breakdown-employees">
            <h3 className="font-display font-bold text-slate-800 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-700 shrink-0" />
              <span>Operator desk productivity audit</span>
            </h3>
            
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-500 border-b border-slate-100">
                    <th className="p-3">Staff Operator</th>
                    <th className="p-3 text-center">Filing Volume</th>
                    <th className="p-3 text-right">Revenue Generated</th>
                    <th className="p-3 text-right">Cash Outflows Logged</th>
                    <th className="p-3 text-right">Net Desk Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {revenueByEmployee.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 italic">No employee transactions recorded in this range.</td>
                    </tr>
                  ) : (
                    revenueByEmployee.map((e: any) => (
                      <tr key={e.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-900">{e.full_name}</td>
                        <td className="p-3 text-center text-slate-500 font-medium">{e.count}</td>
                        <td className="p-3 text-right font-bold font-mono text-emerald-700">₹{Number(e.revenue).toFixed(2)}</td>
                        <td className="p-3 text-right font-bold font-mono text-rose-700">₹{Number(e.expenses).toFixed(2)}</td>
                        <td className={`p-3 text-right font-bold font-mono ${e.net >= 0 ? "text-blue-900" : "text-rose-700"}`}>
                          ₹{Number(e.net).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Printable Footer (Visible only on print layouts) */}
        <div className="hidden print-only border-t border-dashed border-slate-200 pt-8 flex justify-between text-[10px] text-slate-400" id="print-signature-section">
          <div>
            <p className="font-semibold text-slate-700">Prepared By:</p>
            <p className="mt-8 border-t border-slate-200 w-32 pt-1">{user.full_name}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-700">Approved Center Seal / Owner Signature:</p>
            <p className="mt-8 border-t border-slate-200 w-48 pt-1 ml-auto">Ganesan (Center Owner / Auditor)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
