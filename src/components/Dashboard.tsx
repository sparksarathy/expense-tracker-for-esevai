/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Profile, IncomeEntry, ExpenseEntry } from "../types";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  Users,
  CreditCard,
  Percent,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  Search,
  ChevronRight
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

interface DashboardProps {
  user: Profile;
  onNavigate: (tab: string) => void;
  refreshCounter: number;
}

export default function Dashboard({ user, onNavigate, refreshCounter }: DashboardProps) {
  const [filter, setFilter] = useState<string>("this_month");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);

  // Calculate default dates based on filter preset
  useEffect(() => {
    const today = new Date();
    const format = (d: Date) => d.toISOString().split("T")[0];

    let from = "";
    let to = format(today);

    if (filter === "today") {
      from = format(today);
    } else if (filter === "this_week") {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(today.setDate(diff));
      from = format(monday);
    } else if (filter === "this_month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      from = format(firstDay);
    } else if (filter === "this_year") {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      from = format(firstDay);
    }

    if (filter !== "custom") {
      setDateFrom(from);
      setDateTo(to);
    }
  }, [filter]);

  // Fetch report data whenever filter parameters change
  const fetchReport = async () => {
    if (filter === "custom" && (!dateFrom || !dateTo)) return;

    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (dateFrom) query.append("date_from", dateFrom);
      if (dateTo) query.append("date_to", dateTo);
      
      const res = await fetch(`/api/reports?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (err) {
      console.error("Failed to load dashboard financials:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [dateFrom, dateTo, refreshCounter]);

  if (loading || !reportData) {
    return (
      <div className="p-6 space-y-6" id="dashboard-skeleton">
        <div className="h-10 w-48 bg-slate-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-80 bg-slate-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const { summary, revenueByCategory, expensesByCategory, revenueByEmployee, dailyBreakdown, incomes, expenses } = reportData;
  const isOwner = user.role === "owner";

  // Colors for charts
  const COLORS = ["#1e3a8a", "#7c3aed", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#6366f1", "#14b8a6"];

  // Cash vs GPay data
  const paymentMethodsData = [
    { name: "Cash in Hand", value: summary.cashReceived || 0 },
    { name: "GPay", value: summary.gpayReceived || 0 },
  ].filter(p => p.value > 0);

  return (
    <div className="p-4 md:p-8 space-y-6" id="dashboard-container">
      
      {/* Header and Filter Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5" id="dashboard-header">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
            <span>Vanakkam, {user.full_name.split(" ")[0]}!</span>
            <Sparkles className="w-5 h-5 text-[#7e22ce] animate-pulse" />
          </h1>
          <p className="text-slate-500 text-xs mt-1 font-medium">
            {isOwner ? "E-Sevai Admin Center Console" : `Employee Desk Dashboard - ${user.full_name}`}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2" id="filter-presets">
          {["today", "this_week", "this_month", "this_year", "custom"].map((preset) => (
            <button
              key={preset}
              onClick={() => setFilter(preset)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all capitalize border ${
                filter === preset
                  ? "bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {preset.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Picker Range */}
      {filter === "custom" && (
        <div className="flex flex-wrap gap-4 items-end bg-white p-5 rounded-2xl border border-slate-100 shadow-sm" id="custom-date-selectors">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">From Date</label>
            <input
              type="date"
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-900"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">To Date</label>
            <input
              type="date"
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-900"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <button
            onClick={fetchReport}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg"
          >
            Apply Range
          </button>
        </div>
      )}

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="summary-cards">
        
        {/* Total Income */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between" id="card-income">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Total Income</p>
            <h3 className="text-2xl font-bold text-slate-900">₹{Number(summary.totalIncome).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="mt-2 flex items-center text-emerald-600 text-xs font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><polyline points="18 15 12 9 6 15"/></svg>
            <span>Filing Inflows</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between" id="card-expenses">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Total Expenses</p>
            <h3 className="text-2xl font-bold text-slate-900">₹{Number(summary.totalExpense).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="mt-2 flex items-center text-rose-600 text-xs font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><polyline points="6 9 12 15 18 9"/></svg>
            <span>Center Payouts</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between" id="card-profit">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Net Profit</p>
            <h3 className="text-2xl font-bold text-[#1e3a8a]">
              ₹{Number(summary.netProfit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="mt-2 flex items-center text-emerald-600 text-xs font-bold">
            <span>High margin flow</span>
          </div>
        </div>

        {/* Transactions / Performance count */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between" id="card-volume">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Transactions</p>
            <h3 className="text-2xl font-bold text-slate-900">{summary.totalTransactions}</h3>
          </div>
          <div className="mt-2 flex items-center text-slate-400 text-xs font-medium">
            <span>Avg. ₹{Number(summary.avgTransactionValue).toFixed(0)} / receipt</span>
          </div>
        </div>
      </div>

      {/* Sub-distribution row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-medium text-slate-600" id="collection-breakdowns">
        <div className="bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between" id="sub-cash">
          <span>Collected in Cash</span>
          <span className="font-bold text-slate-900">₹{Number(summary.cashReceived).toLocaleString("en-IN")}</span>
        </div>
        <div className="bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between" id="sub-gpay">
          <span>Received via GPay</span>
          <span className="font-bold text-slate-900">₹{Number(summary.gpayReceived).toLocaleString("en-IN")}</span>
        </div>
        <div className="col-span-2 md:col-span-1 bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between" id="sub-avg">
          <span>Avg Ticket size</span>
          <span className="font-bold text-slate-900">₹{Number(summary.avgTransactionValue).toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Quick Action Buttons (Aligned with Theme Header style) */}
      <div className="flex gap-3 pt-2" id="quick-entry-buttons">
        <button
          onClick={() => onNavigate("Income Entry")}
          className="flex items-center gap-2 bg-[#7e22ce] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#6b1eb0] transition-colors shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Income
        </button>
        <button
          onClick={() => onNavigate("Expense Entry")}
          className="flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 bg-white transition-colors"
        >
          Log Expense
        </button>
      </div>

      {/* Visual Analytics Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="dashboard-charts">
        
        {/* Chart 1: Income vs Expense Timeline */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm" id="chart-timeline">
          <h3 className="font-display text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>Transaction Trends ({filter.replace("_", " ")})</span>
            <span className="text-[10px] font-normal text-slate-400">Values in ₹</span>
          </h3>
          <div className="h-64">
            {dailyBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No financial history found for this range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} style={{ fontSize: 9, fill: "#94a3b8" }} />
                  <YAxis tickLine={false} axisLine={false} style={{ fontSize: 9, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #f1f5f9" }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" name="Income" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={2} />
                  <Area type="monotone" name="Expense" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Revenue by Service Category (Bento-styled) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm" id="chart-service">
          <h3 className="font-display text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>Volume by Service Category</span>
            <span className="text-[10px] font-normal text-slate-400">Most requested first</span>
          </h3>
          <div className="h-64">
            {revenueByCategory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No service categories logged in this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByCategory.slice(0, 5)} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickLine={false} axisLine={false} style={{ fontSize: 9, fill: "#94a3b8" }} />
                  <YAxis type="category" dataKey="category_name" tickLine={false} axisLine={false} style={{ fontSize: 9, fill: "#475569" }} width={110} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar name="Revenue (₹)" dataKey="amount" fill="#1e3a8a" radius={[0, 4, 4, 0]} barSize={12}>
                    {revenueByCategory.slice(0, 5).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Collection Method Share */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm" id="chart-collections">
          <h3 className="font-display text-sm font-bold text-slate-800 mb-4">Payment Inflow Share</h3>
          <div className="h-64 flex flex-col justify-center">
            {paymentMethodsData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No payments recorded.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-around">
                <div className="w-40 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {paymentMethodsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? "#7c3aed" : "#10b981"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: number) => `₹${val.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-4 sm:mt-0 text-xs font-semibold text-slate-600">
                  {paymentMethodsData.map((entry, index) => {
                    const totalVal = paymentMethodsData.reduce((a, b) => a + b.value, 0);
                    const pct = ((entry.value / totalVal) * 100).toFixed(1);
                    return (
                      <div key={entry.name} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: index === 0 ? "#7c3aed" : "#10b981" }} />
                        <span>{entry.name}:</span>
                        <span className="font-bold text-slate-800">₹{entry.value.toLocaleString()} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chart 4: Employee Performance (Visible to Owner only) */}
        {isOwner && (
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm" id="chart-employees">
            <h3 className="font-display text-sm font-bold text-slate-800 mb-4">Employee Revenue Payout</h3>
            <div className="h-64">
              {revenueByEmployee.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No employee entries found.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByEmployee} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="full_name" tickLine={false} axisLine={false} style={{ fontSize: 9, fill: "#475569" }} />
                    <YAxis tickLine={false} axisLine={false} style={{ fontSize: 9, fill: "#94a3b8" }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar name="Generated Volume (₹)" dataKey="revenue" fill="#7c3aed" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recent Entries Lists */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6" id="recent-transactions-lists">
        
        {/* Recent Incomes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col" id="recent-incomes-card">
          <div className="p-5 border-b border-slate-50 flex items-center justify-between">
            <h4 className="font-bold text-slate-800">Recent Applications Filed</h4>
            <button
              onClick={() => onNavigate("Ledgers")}
              className="text-blue-600 text-xs font-bold uppercase tracking-wider hover:underline"
            >
              View All
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-600">
                {incomes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                      No recent filings recorded.
                    </td>
                  </tr>
                ) : (
                  incomes.slice(0, 5).map((inc: any) => (
                    <tr key={inc.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{inc.customer_name}</td>
                      <td className="px-4 py-3 text-xs">{inc.service_name || "e-Sevai filing"}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">₹{Number(inc.service_rate).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center text-xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-2"></span>
                          Success
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col" id="recent-expenses-card">
          <div className="p-5 border-b border-slate-50 flex items-center justify-between">
            <h4 className="font-bold text-slate-800">Recent Center Expenses</h4>
            <button
              onClick={() => onNavigate("Ledgers")}
              className="text-blue-600 text-xs font-bold uppercase tracking-wider hover:underline"
            >
              View All
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-600">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                      No recent expenses recorded.
                    </td>
                  </tr>
                ) : (
                  expenses.slice(0, 5).map((exp: any) => (
                    <tr key={exp.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900 truncate max-w-[120px]">{exp.description}</td>
                      <td className="px-4 py-3 text-xs">{exp.category_name || "Utility payout"}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">₹{Number(exp.amount).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center text-xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-2"></span>
                          Logged
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
