/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Profile, ServiceCategory } from "../types";
import { 
  Layers, Plus, Edit2, CheckCircle, XCircle, Search, 
  History, Sliders, ToggleLeft, ToggleRight, Save, X, Info
} from "lucide-react";

interface ServiceCategoriesProps {
  user: Profile;
}

interface RateHistoryItem {
  id: string;
  organization_id: string;
  service_id: string;
  old_rate: number | null;
  new_rate: number;
  changed_by: string;
  changed_at: string;
  service_name: string;
  performer_name: string;
}

export default function ServiceCategories({ user }: ServiceCategoriesProps) {
  const isOwner = user.role === "owner";
  
  const [services, setServices] = useState<ServiceCategory[]>([]);
  const [history, setHistory] = useState<RateHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"catalog" | "history">("catalog");

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Add Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [description, setDescription] = useState("");
  const [defaultRate, setDefaultRate] = useState("");
  const [minimumRate, setMinimumRate] = useState("");
  const [maximumRate, setMaximumRate] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Editing State (Modal-based or Panel-based for high quality)
  const [editingService, setEditingService] = useState<ServiceCategory | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editMinRate, setEditMinRate] = useState("");
  const [editMaxRate, setEditMaxRate] = useState("");
  const [editOrder, setEditOrder] = useState("");
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Load Catalog and Rate History data
  const fetchData = async () => {
    setLoading(true);
    try {
      const catRes = await fetch("/api/service-categories");
      if (catRes.ok) {
        const data = await catRes.json();
        const sorted = data.categories.sort((a: any, b: any) => {
          const ordA = a.display_order ?? 0;
          const ordB = b.display_order ?? 0;
          return ordA - ordB || (a.service_name || a.category_name).localeCompare(b.service_name || b.category_name);
        });
        setServices(sorted);
      }

      if (isOwner) {
        const histRes = await fetch("/api/service-rate-history");
        if (histRes.ok) {
          const histData = await histRes.json();
          // Sort newest first
          const sortedHist = histData.history.sort((a: any, b: any) => b.changed_at.localeCompare(a.changed_at));
          setHistory(sortedHist);
        }
      }
    } catch (e) {
      console.error("Failed loading service catalogue data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isOwner]);

  // Bulk state actions
  const handleBulkStatusChange = async (is_active: boolean) => {
    if (selectedIds.length === 0) return;
    try {
      const res = await fetch("/api/service-categories/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, is_active })
      });
      if (res.ok) {
        setSelectedIds([]);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update status.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle single status
  const handleToggleActive = async (service: ServiceCategory) => {
    if (!isOwner) return;
    try {
      const res = await fetch(`/api/service-categories/${service.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !service.is_active }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Form submission: Create service
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!serviceName.trim()) {
      setFormError("Service Name is required.");
      return;
    }

    const rate = Number(defaultRate);
    if (isNaN(rate) || rate < 0) {
      setFormError("Default Rate must be a valid, positive number.");
      return;
    }

    const minR = minimumRate ? Number(minimumRate) : undefined;
    const maxR = maximumRate ? Number(maximumRate) : undefined;

    if (minR !== undefined && (isNaN(minR) || minR < 0)) {
      setFormError("Minimum Rate must be zero or positive.");
      return;
    }
    if (maxR !== undefined && (isNaN(maxR) || maxR < 0)) {
      setFormError("Maximum Rate must be zero or positive.");
      return;
    }
    if (minR !== undefined && maxR !== undefined && maxR < minR) {
      setFormError("Maximum Permitted Rate cannot be less than Minimum Rate.");
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch("/api/service-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_name: serviceName.trim(),
          category_name: serviceName.trim(),
          service_code: serviceCode.trim() || undefined,
          description: description.trim() || undefined,
          default_rate: rate,
          minimum_rate: minR,
          maximum_rate: maxR,
          display_order: displayOrder ? Number(displayOrder) : services.length + 1
        })
      });

      if (res.ok) {
        setServiceName("");
        setServiceCode("");
        setDescription("");
        setDefaultRate("");
        setMinimumRate("");
        setMaximumRate("");
        setDisplayOrder("");
        setShowAddForm(false);
        fetchData();
      } else {
        const errData = await res.json();
        setFormError(errData.error || "Failed to create service.");
      }
    } catch (err) {
      console.error(err);
      setFormError("Connection error.");
    } finally {
      setFormLoading(false);
    }
  };

  // Begin inline/modal editing
  const handleStartEdit = (service: ServiceCategory) => {
    setEditingService(service);
    setEditName(service.service_name || service.category_name);
    setEditCode(service.service_code || "");
    setEditDescription(service.description || "");
    setEditRate(service.default_rate.toString());
    setEditMinRate(service.minimum_rate?.toString() || "");
    setEditMaxRate(service.maximum_rate?.toString() || "");
    setEditOrder((service.display_order ?? 0).toString());
    setEditError("");
  };

  // Form submission: Save edits
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    setEditError("");

    if (!editName.trim()) {
      setEditError("Service name is required.");
      return;
    }

    const rate = Number(editRate);
    if (isNaN(rate) || rate < 0) {
      setEditError("Default Rate must be a valid, positive number.");
      return;
    }

    const minR = editMinRate === "" ? "" : Number(editMinRate);
    const maxR = editMaxRate === "" ? "" : Number(editMaxRate);

    if (minR !== "" && (isNaN(Number(minR)) || Number(minR) < 0)) {
      setEditError("Minimum Rate must be zero or positive.");
      return;
    }
    if (maxR !== "" && (isNaN(Number(maxR)) || Number(maxR) < 0)) {
      setEditError("Maximum Rate must be zero or positive.");
      return;
    }
    if (minR !== "" && maxR !== "" && Number(maxR) < Number(minR)) {
      setEditError("Maximum rate cannot be less than minimum rate.");
      return;
    }

    setEditLoading(true);
    try {
      const res = await fetch(`/api/service-categories/${editingService.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_name: editName.trim(),
          category_name: editName.trim(),
          service_code: editCode.trim() || undefined,
          description: editDescription.trim() || undefined,
          default_rate: rate,
          minimum_rate: minR === "" ? "" : Number(minR),
          maximum_rate: maxR === "" ? "" : Number(maxR),
          display_order: Number(editOrder) || 0
        })
      });

      if (res.ok) {
        setEditingService(null);
        fetchData();
      } else {
        const data = await res.json();
        setEditError(data.error || "Failed to update service details.");
      }
    } catch (err) {
      console.error(err);
      setEditError("Connection error.");
    } finally {
      setEditLoading(false);
    }
  };

  // Helper toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = filteredServices.map(s => s.id);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Filtering services based on query and status selection
  const filteredServices = services.filter(s => {
    const name = (s.service_name || s.category_name || "").toLowerCase();
    const code = (s.service_code || "").toLowerCase();
    const desc = (s.description || "").toLowerCase();
    const matchesQuery = 
      name.includes(searchQuery.toLowerCase()) || 
      code.includes(searchQuery.toLowerCase()) ||
      desc.includes(searchQuery.toLowerCase());
    
    if (statusFilter === "active") return matchesQuery && s.is_active;
    if (statusFilter === "inactive") return matchesQuery && !s.is_active;
    return matchesQuery;
  });

  if (loading) {
    return (
      <div className="p-8 flex flex-col justify-center items-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-blue-900/10 border-t-blue-900 rounded-full animate-spin"></div>
        <p className="text-slate-500 text-xs mt-4 font-sans font-medium">Syncing Sevai catalogue rates...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" id="services-rates-wrapper">
      
      {/* Dynamic Title Headers */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-900" />
            <span>Service & Rates Catalogue</span>
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            {isOwner 
              ? "Add, modify, or deactivate available service templates, and track historical rate audit records."
              : "Search standard listed rates, and view employee permissible billing boundaries."}
          </p>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab("catalog");
                setShowAddForm(!showAddForm);
              }}
              className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow transition-all duration-150"
              id="new-service-btn"
            >
              <Plus className="w-4 h-4" />
              <span>New Sevai Service</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs and filters wrapper */}
      <div className="space-y-4">
        {/* Tab Selection (Only shown to Owner for rate audit visibility) */}
        {isOwner && (
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => { setActiveTab("catalog"); setShowAddForm(false); }}
              className={`py-2 px-4 text-xs font-bold border-b-2 transition-all ${
                activeTab === "catalog" 
                  ? "border-blue-900 text-blue-900" 
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Service Catalogue
            </button>
            <button
              onClick={() => { setActiveTab("history"); setShowAddForm(false); }}
              className={`py-2 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === "history" 
                  ? "border-blue-900 text-blue-900" 
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Rate Change Audit Logs</span>
            </button>
          </div>
        )}

        {/* Tab 1: Catalogue Management */}
        {activeTab === "catalog" && (
          <div className="space-y-4 animate-fade-in">
            {/* Create Service Form (Owner Only Drawer) */}
            {isOwner && showAddForm && (
              <form 
                onSubmit={handleCreateService} 
                className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm space-y-4 max-w-xl mr-auto text-xs relative"
                id="create-service-form"
              >
                <div className="absolute right-4 top-4">
                  <button 
                    type="button" 
                    onClick={() => setShowAddForm(false)}
                    className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-blue-900" />
                    <span>Create Manually Configured Sevai Service</span>
                  </h3>
                  <p className="text-slate-400 text-[10px] mt-0.5">Define standard pricing rates, permitted ranges, and display orders.</p>
                </div>

                {formError && (
                  <div className="p-2.5 bg-red-50 border border-red-100 text-red-700 rounded-xl font-medium">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-500 font-bold mb-1">Service Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aadhaar Address Change"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-900 text-xs"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Service Code (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. ADH-ADDR"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-900 text-xs font-mono uppercase"
                      value={serviceCode}
                      onChange={(e) => setServiceCode(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Default Rate (₹) *</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 50"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-900 text-xs font-semibold"
                      value={defaultRate}
                      onChange={(e) => setDefaultRate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Min Rate (Optional, ₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 30"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-900 text-xs"
                      value={minimumRate}
                      onChange={(e) => setMinimumRate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Max Rate (Optional, ₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 100"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-900 text-xs"
                      value={maximumRate}
                      onChange={(e) => setMaximumRate(e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-500 font-bold mb-1">Short Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Application submission for demographic address shifts"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-900 text-xs"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Display Order Index</label>
                    <input
                      type="number"
                      placeholder="e.g. 1"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-900 text-xs font-mono"
                      value={displayOrder}
                      onChange={(e) => setDisplayOrder(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-xl font-semibold flex items-center gap-1.5"
                  >
                    {formLoading ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      <span>Save Service</span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Editing Service Modal/Drawer Form */}
            {isOwner && editingService && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="edit-service-modal">
                <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-100 shadow-xl overflow-hidden text-xs">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="font-bold text-sm text-slate-950 flex items-center gap-1.5">
                      <Edit2 className="w-4 h-4 text-blue-900" />
                      <span>Edit Service Parameters</span>
                    </h3>
                    <button 
                      onClick={() => setEditingService(null)}
                      className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                    >
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
                    {editError && (
                      <div className="p-2.5 bg-red-50 border border-red-100 text-red-700 rounded-xl font-semibold">
                        {editError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-slate-500 font-bold mb-1">Service Name *</label>
                        <input
                          type="text"
                          required
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-900 text-sm font-semibold text-slate-950"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Service Code</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-900 text-xs font-mono uppercase"
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Display Order</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-900 text-xs font-mono"
                          value={editOrder}
                          onChange={(e) => setEditOrder(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Default Standard Rate (₹) *</label>
                        <input
                          type="number"
                          required
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-900 text-sm font-bold text-slate-900"
                          value={editRate}
                          onChange={(e) => setEditRate(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-500 font-bold mb-1">Min Rate (₹)</label>
                          <input
                            type="number"
                            placeholder="None"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-900 text-xs"
                            value={editMinRate}
                            onChange={(e) => setEditMinRate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-bold mb-1">Max Rate (₹)</label>
                          <input
                            type="number"
                            placeholder="None"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-900 text-xs"
                            value={editMaxRate}
                            onChange={(e) => setEditMaxRate(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-slate-500 font-bold mb-1">Service Description</label>
                        <textarea
                          rows={2}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-900 text-xs resize-none"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setEditingService(null)}
                        className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={editLoading}
                        className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-xl font-bold flex items-center gap-1.5"
                      >
                        {editLoading ? (
                          <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            <span>Save Changes</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search catalogue by name, code, description..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-900 text-xs text-slate-800"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-slate-500 font-semibold shrink-0">State:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-blue-900"
                >
                  <option value="all">All States</option>
                  <option value="active">Active Catalogues</option>
                  <option value="inactive">Disabled Catalogues</option>
                </select>

                {isOwner && selectedIds.length > 0 && (
                  <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
                    <span className="text-slate-500 text-[11px] font-bold">{selectedIds.length} chosen:</span>
                    <button
                      onClick={() => handleBulkStatusChange(true)}
                      className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 rounded-lg text-[10px] font-bold"
                    >
                      Bulk Active
                    </button>
                    <button
                      onClick={() => handleBulkStatusChange(false)}
                      className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100 rounded-lg text-[10px] font-bold"
                    >
                      Bulk Disable
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Service catalog table / layout */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    {isOwner && (
                      <th className="py-3 px-4 text-center w-10">
                        <input
                          type="checkbox"
                          className="rounded text-blue-900 focus:ring-blue-900"
                          checked={filteredServices.length > 0 && filteredServices.every(s => selectedIds.includes(s.id))}
                          onChange={toggleSelectAll}
                        />
                      </th>
                    )}
                    <th className="py-3 px-4 text-center w-12">Order</th>
                    <th className="py-3 px-4">Sevai Service</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Standard Rate</th>
                    <th className="py-3 px-4 text-center">Permissible Range</th>
                    <th className="py-3 px-4 text-center">Catalog State</th>
                    {isOwner && <th className="py-3 px-4 text-center w-16">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredServices.length === 0 ? (
                    <tr>
                      <td colSpan={isOwner ? 9 : 7} className="py-8 text-center text-slate-400">
                        No service categories matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredServices.map((service) => {
                      const isChosen = selectedIds.includes(service.id);
                      return (
                        <tr 
                          key={service.id} 
                          className={`hover:bg-slate-50/50 transition-all ${
                            !service.is_active ? "opacity-60 bg-slate-50/70" : ""
                          }`}
                        >
                          {isOwner && (
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                className="rounded text-blue-900 focus:ring-blue-900"
                                checked={isChosen}
                                onChange={() => toggleSelect(service.id)}
                              />
                            </td>
                          )}

                          {/* Order index */}
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-500">
                            {service.display_order ?? "—"}
                          </td>

                          {/* Service Name */}
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {service.service_name || service.category_name}
                          </td>

                          {/* Service Code */}
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500 uppercase">
                            {service.service_code || "—"}
                          </td>

                          {/* Description */}
                          <td className="py-3 px-4 text-slate-500 font-normal max-w-xs truncate">
                            {service.description || "—"}
                          </td>

                          {/* Standard Rate */}
                          <td className="py-3 px-4 text-right font-bold font-mono text-slate-900">
                            ₹{Number(service.default_rate).toFixed(2)}
                          </td>

                          {/* Permitted Billing Range */}
                          <td className="py-3 px-4 text-center font-mono font-bold text-xs">
                            {service.minimum_rate !== undefined || service.maximum_rate !== undefined ? (
                              <span className="inline-flex items-center gap-1 text-blue-950 bg-blue-50/70 px-2 py-0.5 rounded-lg text-[10px]">
                                {service.minimum_rate !== undefined && service.minimum_rate !== null ? `₹${service.minimum_rate}` : "₹0"}
                                <span className="text-slate-400">→</span>
                                {service.maximum_rate !== undefined && service.maximum_rate !== null ? `₹${service.maximum_rate}` : "∞"}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal text-[10px]">Standard only</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            {isOwner ? (
                              <button
                                type="button"
                                onClick={() => handleToggleActive(service)}
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase transition-all ${
                                  service.is_active 
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100" 
                                    : "bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100"
                                }`}
                              >
                                {service.is_active ? "Active" : "Disabled"}
                              </button>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase ${
                                service.is_active 
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                  : "bg-slate-100 text-slate-500"
                              }`}>
                                {service.is_active ? "Active" : "Deactivated"}
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          {isOwner && (
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleStartEdit(service)}
                                className="p-1 text-slate-400 hover:text-blue-900 hover:bg-slate-100 rounded-lg transition-all"
                                title="Edit Service"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Read-only Employee Context Notice */}
            {!isOwner && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-2.5 text-blue-950 text-xs">
                <Info className="w-4.5 h-4.5 text-blue-900 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Catalogue Read-Only Mode:</span> Employees can search standard rates to ensure precise compliance during customer intake. If an intake requires price adjustments, verify standard rate limits or consult with the Owner.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Rate Change Audit History (Owner Only) */}
        {activeTab === "history" && isOwner && (
          <div className="space-y-4 animate-fade-in" id="history-logs-tab">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4 text-right">Old Rate</th>
                    <th className="py-3 px-4 text-right">New Rate</th>
                    <th className="py-3 px-4">Rate Delta</th>
                    <th className="py-3 px-4">Authorized By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No service rate changes have been logged yet.
                      </td>
                    </tr>
                  ) : (
                    history.map((hist) => {
                      const oldRate = hist.old_rate !== null ? Number(hist.old_rate) : null;
                      const newRate = Number(hist.new_rate);
                      const delta = oldRate !== null ? newRate - oldRate : null;
                      
                      return (
                        <tr key={hist.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="py-3 px-4 font-mono text-[10.5px] text-slate-500">
                            {new Date(hist.changed_at).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              dateStyle: "medium",
                              timeStyle: "short"
                            })}
                          </td>

                          {/* Service name */}
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {hist.service_name}
                          </td>

                          {/* Old Rate */}
                          <td className="py-3 px-4 text-right font-mono text-slate-500">
                            {oldRate !== null ? `₹${oldRate.toFixed(2)}` : "—"}
                          </td>

                          {/* New Rate */}
                          <td className="py-3 px-4 text-right font-mono text-slate-950 font-bold">
                            ₹{newRate.toFixed(2)}
                          </td>

                          {/* Delta */}
                          <td className="py-3 px-4">
                            {delta !== null ? (
                              <span className={`inline-flex items-center gap-0.5 font-mono text-[11px] font-bold ${
                                delta > 0 ? "text-emerald-700" : delta < 0 ? "text-rose-700" : "text-slate-500"
                              }`}>
                                {delta > 0 ? `+₹${delta.toFixed(2)}` : delta < 0 ? `-₹${Math.abs(delta).toFixed(2)}` : "No change"}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">Initial Catalog Rate</span>
                            )}
                          </td>

                          {/* Performer name */}
                          <td className="py-3 px-4 text-slate-900 font-semibold">
                            {hist.performer_name}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
