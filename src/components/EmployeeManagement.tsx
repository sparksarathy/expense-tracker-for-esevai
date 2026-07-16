/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useRef } from "react";
import { Profile } from "../types";
import { 
  Users, UserPlus, ToggleLeft, ToggleRight, Search, Activity, 
  ShieldCheck, Mail, Briefcase, RefreshCw, XCircle, Trash2, 
  MoreVertical, Edit2, Camera, Upload, Network, Info, Check, X,
  Phone, FileText, MapPin, Shield, User
} from "lucide-react";

interface EmployeeManagementProps {
  user: Profile;
  onRefresh: () => void;
}

// Beautiful preset avatars representing diverse office staff
const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80"
];

export default function EmployeeManagement({ user, onRefresh }: EmployeeManagementProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Highlight state for Node <-> Card interaction
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Add Employee Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"owner" | "employee">("employee");
  const [addDeskName, setAddDeskName] = useState("");
  const [addPhoneNumber, setAddPhoneNumber] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addBranchId, setAddBranchId] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Three-dot action menus state
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [dropdownIndex, setDropdownIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Modal Dialog States
  const [viewingEmployee, setViewingEmployee] = useState<any | null>(null);
  
  const [renamingEmployee, setRenamingEmployee] = useState<any | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"owner" | "employee">("employee");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editDeskName, setEditDeskName] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editBranchId, setEditBranchId] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [photoEmployee, setPhotoEmployee] = useState<any | null>(null);
  const [photoVal, setPhotoVal] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [accessEmployee, setAccessEmployee] = useState<any | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [deleteEmployee, setDeleteEmployee] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletionCheckResult, setDeletionCheckResult] = useState<any | null>(null);

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees");
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees);
      }
    } catch (err) {
      console.error("Failed to load employee roster:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch("/api/branches");
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
        if (data.branches && data.branches.length > 0) {
          setAddBranchId(data.branches[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load branches:", err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchBranches();
  }, []);

  // Handle clicking outside to close the 3-dot dropdown menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Reset dropdown focused option when dropdown ID changes
  useEffect(() => {
    setDropdownIndex(-1);
  }, [activeDropdownId]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName) {
      setErrorMsg("Email and Full Name are mandatory.");
      return;
    }

    setFormLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email, 
          full_name: fullName, 
          role,
          desk_name: addDeskName || undefined,
          phone_number: addPhoneNumber || undefined,
          notes: addNotes || undefined,
          branch_id: addBranchId || undefined,
          is_active: true
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Roster addition failed.");
      }

      setSuccessMsg("Staff member pre-approved and added to e-Sevai Roster!");
      setEmail("");
      setFullName("");
      setAddDeskName("");
      setAddPhoneNumber("");
      setAddNotes("");
      
      // Refresh Lists
      fetchEmployees();
      onRefresh();
      
      setTimeout(() => {
        setShowAddForm(false);
        setSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (target: any, desiredActive?: boolean) => {
    if (target.id === user.id) {
      alert("Self-Lockout Protection: You cannot deactivate your own active Owner account.");
      return;
    }

    const nextStatus = desiredActive !== undefined ? desiredActive : !target.is_active;

    try {
      const res = await fetch(`/api/employees/${target.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextStatus }),
      });

      if (res.ok) {
        fetchEmployees();
        onRefresh();
        setActiveDropdownId(null);
      } else {
        const data = await res.json();
        alert(data.error || "Deactivation/Activation action failed.");
      }
    } catch (e) {
      console.error("Failed toggling status:", e);
    }
  };

  const handleRemoveAccessSubmit = async () => {
    if (!accessEmployee) return;
    setAccessLoading(true);
    setAccessError(null);

    try {
      const res = await fetch(`/api/employees/${accessEmployee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove employee access.");
      }

      setAccessEmployee(null);
      fetchEmployees();
      onRefresh();
    } catch (err: any) {
      setAccessError(err.message);
    } finally {
      setAccessLoading(false);
    }
  };

  const checkDeletionEligibility = async (empId: string) => {
    try {
      const res = await fetch(`/api/employees/${empId}/deletion-check`);
      if (res.ok) {
        const data = await res.json();
        setDeletionCheckResult(data);
      }
    } catch (e) {
      console.error("Failed checking deletion eligibility:", e);
    }
  };

  const handlePermanentDeleteSubmit = async () => {
    if (!deleteEmployee) return;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/employees/${deleteEmployee.id}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to permanently delete.");
      }

      setDeleteEmployee(null);
      fetchEmployees();
      onRefresh();
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingEmployee) return;
    if (!renameVal.trim()) {
      setRenameError("Name cannot be empty.");
      return;
    }

    setRenameLoading(true);
    setRenameError(null);

    try {
      const res = await fetch(`/api/employees/${renamingEmployee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: renameVal.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to rename desk.");
      }

      setRenamingEmployee(null);
      fetchEmployees();
      onRefresh();
    } catch (err: any) {
      setRenameError(err.message);
    } finally {
      setRenameLoading(false);
    }
  };

  const openEditModal = (emp: any) => {
    setEditingEmployee(emp);
    setEditFullName(emp.full_name);
    setEditEmail(emp.email);
    setEditRole(emp.role);
    setEditAvatarUrl(emp.avatar_url || "");
    setEditDeskName(emp.desk_name || "");
    setEditPhoneNumber(emp.phone_number || "");
    setEditNotes(emp.notes || "");
    setEditBranchId(emp.branch_id || "");
    setEditError(null);
    setActiveDropdownId(null);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFullName || !editEmail) {
      setEditError("Full Name and Email cannot be blank.");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/employees/${editingEmployee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editFullName,
          email: editEmail,
          role: editRole,
          avatar_url: editAvatarUrl || null,
          desk_name: editDeskName ? editDeskName.trim() : null,
          phone_number: editPhoneNumber ? editPhoneNumber.trim() : null,
          notes: editNotes ? editNotes.trim() : null,
          branch_id: editBranchId || null
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed updating employee desk.");
      }

      setEditingEmployee(null);
      fetchEmployees();
      onRefresh();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Upload or update profile picture via server API
  const handlePhotoUploadApi = async (file: File, empId: string, isFromPhotoModal: boolean = false) => {
    if (file.size > 2 * 1024 * 1024) {
      alert("Photo too large! Please upload an image smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        if (isFromPhotoModal) {
          setPhotoLoading(true);
          setPhotoError(null);
        } else {
          setEditLoading(true);
          setEditError(null);
        }

        const uploadRes = await fetch("/api/employees/upload-avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileData: base64,
            fileName: file.name,
            fileType: file.type
          })
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "Failed to upload photo to server.");
        }

        const fileUrl = uploadData.url;

        // Save immediately to employee profile via PUT API
        const updateRes = await fetch(`/api/employees/${empId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar_url: fileUrl })
        });

        if (!updateRes.ok) {
          const updateData = await updateRes.json();
          throw new Error(updateData.error || "Failed to update profile picture URL.");
        }

        fetchEmployees();
        onRefresh();

        if (isFromPhotoModal) {
          setPhotoVal(fileUrl);
          setPhotoEmployee(null);
        } else {
          setEditAvatarUrl(fileUrl);
        }
      } catch (err: any) {
        if (isFromPhotoModal) setPhotoError(err.message);
        else setEditError(err.message);
      } finally {
        if (isFromPhotoModal) setPhotoLoading(false);
        else setEditLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePresetPhotoSelect = async (url: string, empId: string, isFromPhotoModal: boolean = false) => {
    try {
      if (isFromPhotoModal) {
        setPhotoLoading(true);
        setPhotoError(null);
      } else {
        setEditLoading(true);
        setEditError(null);
      }

      const res = await fetch(`/api/employees/${empId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: url })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile photo.");
      }

      fetchEmployees();
      onRefresh();

      if (isFromPhotoModal) {
        setPhotoVal(url);
        setPhotoEmployee(null);
      } else {
        setEditAvatarUrl(url);
      }
    } catch (err: any) {
      if (isFromPhotoModal) setPhotoError(err.message);
      else setEditError(err.message);
    } finally {
      if (isFromPhotoModal) setPhotoLoading(false);
      else setEditLoading(false);
    }
  };

  // Keyboard navigation through dropdown items
  const handleDropdownKeyDown = (e: React.KeyboardEvent, emp: any) => {
    const actions = getAvailableActions(emp);
    if (e.key === "Escape") {
      e.preventDefault();
      setActiveDropdownId(null);
      const trigger = document.getElementById(`actions-trigger-${emp.id}`);
      trigger?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setDropdownIndex((prev) => (prev + 1) % actions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDropdownIndex((prev) => (prev - 1 + actions.length) % actions.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (dropdownIndex >= 0 && dropdownIndex < actions.length) {
        triggerAction(actions[dropdownIndex].id, emp);
      } else {
        setActiveDropdownId(emp.id);
      }
    }
  };

  const getAvailableActions = (emp: any) => {
    const actions = [
      { id: "view", label: "View Employee", icon: Info },
      { id: "edit", label: "Edit Employee", icon: Briefcase },
      { id: "rename", label: "Rename Employee", icon: Edit2 },
      { id: "photo", label: "Change Profile Photo", icon: Camera },
    ];

    if (user.role === "owner" && emp.id !== user.id) {
      if (emp.is_active) {
        actions.push({ id: "suspend", label: "Suspend Access", icon: ToggleRight });
        actions.push({ id: "remove_access", label: "Remove Employee Access", icon: XCircle });
      } else {
        actions.push({ id: "restore", label: "Activate Access", icon: ToggleLeft });
      }
    }

    const hasHistory = (emp.transaction_count || 0) > 0 || (emp.revenue_generated || 0) > 0 || (emp.expense_amount || 0) > 0;
    const isCurrentOwner = emp.id === user.id;
    const activeOwnersCount = employees.filter(p => p.role === "owner" && p.is_active).length;
    const isFinalActiveOwner = emp.role === "owner" && activeOwnersCount <= 1 && emp.is_active;

    if (user.role === "owner" && !hasHistory && !isCurrentOwner && !isFinalActiveOwner) {
      actions.push({ id: "delete", label: "Permanently Delete Employee", icon: Trash2 });
    }

    return actions;
  };

  const triggerAction = (actionId: string, emp: any) => {
    setActiveDropdownId(null);
    if (actionId === "view") {
      setViewingEmployee(emp);
    } else if (actionId === "rename") {
      setRenamingEmployee(emp);
      setRenameVal(emp.full_name);
      setRenameError(null);
    } else if (actionId === "edit") {
      openEditModal(emp);
    } else if (actionId === "photo") {
      setPhotoEmployee(emp);
      setPhotoVal(emp.avatar_url || "");
      setPhotoError(null);
    } else if (actionId === "suspend") {
      handleToggleActive(emp, false);
    } else if (actionId === "remove_access") {
      setAccessEmployee(emp);
      setAccessError(null);
    } else if (actionId === "restore") {
      handleToggleActive(emp, true);
    } else if (actionId === "delete") {
      setDeleteEmployee(emp);
      setDeleteError(null);
      setDeletionCheckResult(null);
      checkDeletionEligibility(emp.id);
    }
  };

  // Custom styled CSS fallback with initials
  const renderAvatar = (emp: any, sizeClasses: string = "w-10 h-10") => {
    if (emp.avatar_url) {
      return (
        <img
          src={emp.avatar_url}
          alt={emp.full_name}
          referrerPolicy="no-referrer"
          className={`${sizeClasses} rounded-full object-cover border border-purple-100 shadow-xs shrink-0`}
        />
      );
    }
    
    const initials = emp.full_name ? emp.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "EM";
    const bgColors = ["bg-purple-600", "bg-indigo-600", "bg-emerald-600", "bg-teal-600", "bg-blue-600", "bg-rose-600"];
    const colorIndex = initials.charCodeAt(0) % bgColors.length;
    const bgColor = bgColors[colorIndex];

    return (
      <div className={`${sizeClasses} rounded-full ${bgColor} flex items-center justify-center text-white font-bold text-xs border border-white shadow-xs shrink-0`}>
        {initials}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex flex-col justify-center items-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-[#7e22ce] animate-spin" />
        <p className="text-slate-500 text-xs mt-3 font-medium">Syncing employee registry & structure...</p>
      </div>
    );
  }

  // Filter employees based on search
  const filteredEmployees = employees.filter((emp) => {
    const term = searchTerm.toLowerCase();
    const branchName = branches.find(b => b.id === emp.branch_id)?.branch_name || "";
    return (
      emp.full_name.toLowerCase().includes(term) ||
      emp.email.toLowerCase().includes(term) ||
      emp.role.toLowerCase().includes(term) ||
      (emp.desk_name && emp.desk_name.toLowerCase().includes(term)) ||
      branchName.toLowerCase().includes(term)
    );
  });

  const primaryOwner = employees.find((emp) => emp.role === "owner" && emp.is_active) || employees.find((emp) => emp.role === "owner") || employees[0];
  const childNodes = employees.filter((emp) => emp.id !== primaryOwner?.id);

  return (
    <div className="p-4 md:p-6 space-y-6" id="employees-manager">
      
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5" id="emp-header">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-[#7e22ce]" />
            <span>Staff Management Center</span>
          </h1>
          <p className="text-slate-500 text-xs mt-1">Configure workspace desks, customize avatar profiles, and audit structure mapping</p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-[#7e22ce] hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all self-start cursor-pointer font-sans"
        >
          <UserPlus className="w-4 h-4" />
          <span>Authorize Employee Login</span>
        </button>
      </div>

      {/* Add Employee Form Drawer */}
      {showAddForm && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4 max-w-lg mx-auto" id="add-employee-form">
          <div className="flex justify-between items-center">
            <h3 className="font-display font-semibold text-sm text-slate-800">Pre-Approve New Staff Email</h3>
            <button 
              onClick={() => setShowAddForm(false)} 
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-900 border border-rose-100 rounded-xl text-xs font-medium flex items-center gap-2">
              <XCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-100 rounded-xl text-xs font-medium flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleAddEmployee} className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Email Address (Google Account)</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. arun@gmail.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none text-sm text-slate-800 font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={formLoading}
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arun Kumar"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none text-sm text-slate-800 font-medium"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={formLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Desk Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Desk 1 - Aadhaar Services"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none text-sm text-slate-800 font-medium"
                  value={addDeskName}
                  onChange={(e) => setAddDeskName(e.target.value)}
                  disabled={formLoading}
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none text-sm text-slate-800 font-medium"
                  value={addPhoneNumber}
                  onChange={(e) => setAddPhoneNumber(e.target.value)}
                  disabled={formLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Allocated Branch Office</label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none text-sm text-slate-800 font-medium"
                  value={addBranchId}
                  onChange={(e) => setAddBranchId(e.target.value)}
                  disabled={formLoading}
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.branch_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">System Role</label>
                <div className="flex gap-4 pt-2">
                  <label className="flex items-center gap-1.5 font-bold cursor-pointer text-slate-700">
                    <input
                      type="radio"
                      name="form-role"
                      checked={role === "employee"}
                      onChange={() => setRole("employee")}
                      disabled={formLoading}
                    />
                    <span>Employee Desk</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-bold cursor-pointer text-slate-700">
                    <input
                      type="radio"
                      name="form-role"
                      checked={role === "owner"}
                      onChange={() => setRole("owner")}
                      disabled={formLoading}
                    />
                    <span>Co-Owner / Admin</span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-500 font-semibold mb-1">Work Description / Private Notes</label>
              <textarea
                placeholder="Shift details, specialization, account limits..."
                rows={2}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none text-sm text-slate-800 font-medium"
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                disabled={formLoading}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 bg-[#7e22ce] hover:bg-purple-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {formLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Approve Staff Access</span>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Roster Columns Layout: Left Roster Grid (65%) & Right Tree Map (35%) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6" id="roster-workspace-grid">
        
        {/* Left Column (65% -> xl:col-span-8): Roster Grid with 3-dot Menu Controls */}
        <div className="xl:col-span-8 space-y-4 order-2 xl:order-1" id="roster-desks-section">
          
          {/* Search bar row */}
          <div className="flex gap-2 bg-white rounded-xl border border-slate-100 p-2 shadow-xs items-center">
            <Search className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
            <input
              type="text"
              placeholder="Search employees by name, email, role, desk name, branch..."
              className="w-full text-xs font-semibold focus:outline-none bg-transparent py-1 text-slate-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")} 
                className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 hover:bg-slate-100 rounded-lg font-sans"
              >
                Clear
              </button>
            )}
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-500 font-sans">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">No matching employee desks found</p>
              <p className="text-xs text-slate-400 mt-1">Try tweaking your search keywords or pre-approve a new email address.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="employee-roster-grid">
              {filteredEmployees.map((emp) => {
                const dropdownOpen = activeDropdownId === emp.id;
                const branchName = branches.find(b => b.id === emp.branch_id)?.branch_name || "Main Office";
                const isSelected = selectedEmployeeId === emp.id;

                return (
                  <div
                    key={emp.id}
                    id={`employee-card-${emp.id}`}
                    onClick={() => {
                      setSelectedEmployeeId(emp.id);
                      setTimeout(() => {
                        const nodeEl = document.getElementById(`employee-tree-node-${emp.id}`);
                        if (nodeEl) {
                          nodeEl.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                      }, 50);
                    }}
                    className={`bg-white rounded-2xl border p-5 shadow-xs space-y-4 transition-all relative flex flex-col justify-between cursor-pointer ${
                      isSelected 
                        ? "ring-4 ring-purple-500 border-transparent shadow-lg scale-[1.01]" 
                        : "border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    } ${
                      !emp.is_active ? "opacity-65 bg-slate-50 border-slate-200" : ""
                    }`}
                  >
                    {/* Upper Core Panel */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        
                        {/* Avatar and Name */}
                        <div className="flex items-center gap-3">
                          {renderAvatar(emp, "w-11 h-11")}
                          <div className="space-y-0.5 min-w-0 text-left">
                            <h3 className="font-display font-bold text-slate-800 text-sm flex flex-wrap items-center gap-1.5 leading-tight">
                              <span className="truncate max-w-[120px]">{emp.full_name}</span>
                              <span className={`text-[9px] uppercase tracking-wide font-extrabold px-2.5 py-0.5 rounded-full border ${
                                emp.role === "owner" ? "bg-purple-50 text-purple-800 border-purple-100" : "bg-blue-50 text-blue-900 border-blue-100"
                              }`}>
                                {emp.role === "owner" ? "Owner" : "Employee"}
                              </span>
                            </h3>
                            <p className="text-slate-400 text-xs flex items-center gap-1 font-mono truncate max-w-[160px]" title={emp.email}>
                              <Mail className="w-3 h-3 text-slate-300 shrink-0" />
                              <span className="truncate">{emp.email}</span>
                            </p>
                          </div>
                        </div>

                        {/* Three-dot context trigger menu */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            id={`actions-trigger-${emp.id}`}
                            aria-label="Employee actions"
                            aria-haspopup="menu"
                            aria-expanded={dropdownOpen}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownId(dropdownOpen ? null : emp.id);
                            }}
                            onKeyDown={(e) => handleDropdownKeyDown(e, emp)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-xl transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
                            title="Desk settings menu"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Dropdown Options Popup */}
                          {dropdownOpen && (
                            <div 
                              ref={dropdownRef}
                              role="menu"
                              className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-150 rounded-2xl shadow-xl py-2 z-50 text-xs font-sans animate-in fade-in slide-in-from-top-1 duration-100"
                            >
                              <div className="px-3.5 py-1.5 border-b border-slate-50 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                Desk Actions
                              </div>
                              
                              {getAvailableActions(emp).map((act, index) => {
                                const IconComp = act.icon;
                                const isFocused = dropdownIndex === index;
                                const isDestructive = act.id === "delete";
                                const isWarning = act.id === "revoke";

                                return (
                                  <button
                                    key={act.id}
                                    type="button"
                                    role="menuitem"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerAction(act.id, emp);
                                    }}
                                    className={`w-full text-left px-4 py-2.5 font-bold flex items-center gap-2 border-l-2 transition-all cursor-pointer ${
                                      isFocused 
                                        ? "bg-purple-50 border-[#7e22ce] text-purple-900" 
                                        : isDestructive 
                                        ? "text-rose-600 border-transparent hover:bg-rose-50/50 hover:border-rose-400" 
                                        : isWarning
                                        ? "text-orange-700 border-transparent hover:bg-orange-50/50 hover:border-orange-400"
                                        : "text-slate-700 border-transparent hover:bg-slate-50"
                                    }`}
                                  >
                                    <IconComp className={`w-3.5 h-3.5 shrink-0 ${
                                      isDestructive ? "text-rose-500" : isWarning ? "text-orange-500" : "text-slate-400"
                                    }`} />
                                    <span>{act.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                      </div>

                      {/* Display Desk details & Branch info */}
                      <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-50 pt-2 font-medium text-left">
                        {emp.desk_name && (
                          <p className="flex items-center gap-1.5 text-slate-700 text-[11px] font-bold">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                            <span>{emp.desk_name}</span>
                          </p>
                        )}
                        <p className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>Branch: {branchName}</span>
                        </p>
                      </div>

                      {/* Productivity Analytics metrics */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-xl p-3 border border-slate-100" id="emp-perf-metrics">
                        <div className="text-left">
                          <span className="text-slate-400 block text-[10px] font-semibold">Filing Count</span>
                          <span className="font-bold text-slate-800 font-mono text-sm">{emp.transaction_count || 0}</span>
                        </div>
                        <div className="text-left">
                          <span className="text-slate-400 block text-[10px] font-semibold">Revenue Earned</span>
                          <span className="font-bold text-emerald-700 font-mono text-sm">₹{Number(emp.revenue_generated || 0).toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>

                    {/* Last active login & Date added */}
                    <div className="border-t border-slate-50 pt-2.5 mt-2 space-y-1.5" id="emp-footer">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                        <span className="flex items-center gap-1">
                          <Activity className="w-3 h-3 text-slate-300" />
                          <span>Status: {emp.is_active ? "Authorized" : "Revoked"}</span>
                        </span>
                        <span className="font-mono">Added: {emp.created_at ? new Date(emp.created_at).toLocaleDateString("en-IN") : "Never"}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                        <span>Role: <span className="capitalize">{emp.role}</span></span>
                        <span>Last Active: {emp.last_login ? new Date(emp.last_login).toLocaleDateString("en-IN") : "Never"}</span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Right Column (35% -> xl:col-span-4): Tree Map Organizational Chart */}
        <div className="xl:col-span-4 space-y-4 order-1 xl:order-2" id="org-structure-sidebar">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <Network className="w-5 h-5 text-[#7e22ce]" />
              <div>
                <h2 className="font-display font-bold text-slate-900 text-sm">Center Org Structure</h2>
                <p className="text-slate-400 text-[10px]">Reporting structure hierarchy mapped with photos</p>
              </div>
            </div>

            <div className="bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-4 space-y-6 relative overflow-hidden flex flex-col items-center">
              
              {/* TOP Node: Owner */}
              {primaryOwner && (
                <div className="flex flex-col items-center relative z-10">
                  <button 
                    id={`employee-tree-node-${primaryOwner.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEmployeeId(primaryOwner.id);
                      setTimeout(() => {
                        const cardEl = document.getElementById(`employee-card-${primaryOwner.id}`);
                        if (cardEl) {
                          cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                      }, 50);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      openEditModal(primaryOwner);
                    }}
                    className={`group flex flex-col items-center focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-xl p-2.5 bg-white border transition-all cursor-pointer text-center max-w-[180px] ${
                      selectedEmployeeId === primaryOwner.id
                        ? "ring-4 ring-purple-600 border-transparent shadow-lg scale-105"
                        : "border-purple-200 shadow-xs hover:shadow-md hover:border-purple-300"
                    }`}
                    title="Click to select/highlight. Double click to edit details."
                  >
                    <div className="relative mb-2">
                      {renderAvatar(primaryOwner, "w-14 h-14")}
                      <div className="absolute -bottom-1 -right-1 bg-purple-600 text-white p-1 rounded-full shadow border border-white">
                        <Camera className="w-2.5 h-2.5" />
                      </div>
                    </div>
                    <span className="font-bold text-slate-800 text-xs truncate max-w-[150px] block">{primaryOwner.full_name}</span>
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-purple-700 mt-0.5 px-2 py-0.5 bg-purple-50 rounded-full inline-block">
                      {primaryOwner.role} (Root)
                    </span>
                  </button>
                </div>
              )}

              {/* Connecting Vertical Line */}
              {childNodes.length > 0 && (
                <div className="w-0.5 h-6 bg-purple-200 relative -mt-3 mb-2 z-0"></div>
              )}

              {/* Connected Peer Children Structure */}
              {childNodes.length > 0 ? (
                <div className="w-full space-y-3.5 relative z-10">
                  <div className="relative pl-4 border-l-2 border-purple-200 space-y-3">
                    {childNodes.map((child) => {
                      const isSelected = selectedEmployeeId === child.id;
                      return (
                        <div key={child.id} className="relative flex items-center gap-3">
                          <div className="absolute -left-4 w-4 h-0.5 bg-purple-200"></div>
                          
                          <button
                            id={`employee-tree-node-${child.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmployeeId(child.id);
                              setTimeout(() => {
                                const cardEl = document.getElementById(`employee-card-${child.id}`);
                                if (cardEl) {
                                  cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
                                }
                              }, 50);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              openEditModal(child);
                            }}
                            className={`flex items-center gap-2.5 bg-white border shadow-xs rounded-xl p-2 text-left transition-all w-full group cursor-pointer ${
                              isSelected
                                ? "ring-4 ring-purple-600 border-transparent shadow-lg scale-[1.03]"
                                : "border-slate-100 hover:border-purple-200 hover:shadow-sm"
                            }`}
                            title="Click to select/highlight. Double click to edit details."
                          >
                            <div className="relative">
                              {renderAvatar(child, "w-9 h-9")}
                              <div className="absolute -bottom-0.5 -right-0.5 bg-slate-500 group-hover:bg-purple-600 text-white p-0.5 rounded-full border border-white transition-all">
                                <Camera className="w-2 h-2" />
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-slate-800 text-[11px] block truncate group-hover:text-purple-700 transition-colors">
                                {child.full_name}
                              </span>
                              <span className="text-[9px] text-slate-400 capitalize block font-medium">
                                {child.role === "owner" ? "Co-Owner" : "Employee"} &bull; {child.is_active ? "Active" : "Locked"}
                              </span>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-2 text-slate-400 text-[10px] space-y-1">
                  <p>No reporting employees linked yet.</p>
                  <p className="text-[9px]">Click "Authorize Employee Login" to populate this chart.</p>
                </div>
              )}

              {/* Quick informational banner */}
              <div className="w-full mt-4 p-2.5 bg-purple-50/50 border border-purple-100 rounded-lg text-[10px] text-purple-950 flex gap-1.5 items-start">
                <Info className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                <p className="leading-normal text-left">
                  <strong>Interactive Chart:</strong> Single click any workspace node above to highlight and scroll their desk card into view. Double click to edit!
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* 1. VIEW DETAILS MODAL */}
      {viewingEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] text-slate-800 font-sans">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-display font-bold text-slate-900 text-sm">Employee Profile Card</h3>
              <button 
                onClick={() => setViewingEmployee(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              <div className="flex flex-col items-center text-center space-y-2 pb-4 border-b border-slate-100">
                {renderAvatar(viewingEmployee, "w-16 h-16")}
                <h4 className="font-display font-bold text-slate-900 text-base">{viewingEmployee.full_name}</h4>
                <p className="text-slate-400 text-xs flex items-center gap-1 font-mono">{viewingEmployee.email}</p>
                <span className={`text-[10px] uppercase tracking-wider font-extrabold px-3 py-1 rounded-full border ${
                  viewingEmployee.role === "owner" ? "bg-purple-50 text-purple-800 border-purple-100" : "bg-blue-50 text-blue-900 border-blue-100"
                }`}>
                  {viewingEmployee.role === "owner" ? "Owner / Administrator" : "Employee Desk Staff"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 text-slate-600">
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">Desk Code</span>
                  <span className="font-bold text-slate-800 text-sm">{viewingEmployee.desk_name || "Not Designated"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">Phone Contact</span>
                  <span className="font-bold text-slate-800 text-sm">{viewingEmployee.phone_number || "No Contact"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">Filing Count</span>
                  <span className="font-bold text-slate-800 text-sm">{viewingEmployee.transaction_count || 0} applications</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">Total Revenue</span>
                  <span className="font-bold text-emerald-700 text-sm">₹{Number(viewingEmployee.revenue_generated || 0).toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">Allocated Branch</span>
                <span className="text-slate-700 font-bold block bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-xs">
                  {branches.find(b => b.id === viewingEmployee.branch_id)?.branch_name || "Main Head Office"}
                </span>
              </div>

              {viewingEmployee.notes && (
                <div className="space-y-1">
                  <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">Private Work Notes</span>
                  <p className="text-slate-600 bg-slate-50 rounded-xl p-2.5 border border-slate-100 leading-normal">
                    {viewingEmployee.notes}
                  </p>
                </div>
              )}

              <div className="flex gap-1.5 pt-2 text-[10px] text-slate-400">
                <Shield className="w-3.5 h-3.5 text-slate-300" />
                <span>Authorized for secure e-Sevai single sign-on access.</span>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setViewingEmployee(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. RENAME DESK QUICK MODAL */}
      {renamingEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] text-slate-800 font-sans">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-display font-bold text-slate-900 text-sm">Rename Desk / Staff Member</h3>
              <button onClick={() => setRenamingEmployee(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameSubmit} className="p-5 space-y-4 text-xs">
              {renameError && (
                <div className="p-3 bg-rose-50 text-rose-900 border border-rose-100 rounded-xl font-medium">
                  {renameError}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-slate-500 font-semibold">New Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none text-slate-800 text-sm font-semibold"
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRenamingEmployee(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renameLoading}
                  className="px-4 py-2 bg-[#7e22ce] hover:bg-purple-800 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                >
                  {renameLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Apply Name</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. EDIT DETAILS FULL DIALOG MODAL */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] text-slate-800 font-sans">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-display font-bold text-slate-900 text-sm">Edit Desk Details</h3>
                <p className="text-[10px] text-slate-400">Modify profile name, email, system role, and custom photo</p>
              </div>
              <button 
                onClick={() => setEditingEmployee(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdateEmployee} className="p-5 space-y-4 overflow-y-auto text-xs">
              {editError && (
                <div className="p-3 bg-rose-50 text-rose-900 border border-rose-100 rounded-xl flex items-center gap-2">
                  <XCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Profile Photo Upload & Selector */}
              <div className="space-y-2">
                <label className="block text-slate-500 font-semibold">Desk Profile Photo / Avatar</label>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="relative shrink-0">
                    {editAvatarUrl ? (
                      <img
                        src={editAvatarUrl}
                        alt="Preview"
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-full object-cover border-2 border-[#7e22ce] shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-purple-100 border-2 border-purple-200 flex items-center justify-center text-purple-700 font-bold text-lg">
                        {editFullName ? editFullName.slice(0, 2).toUpperCase() : "??"}
                      </div>
                    )}
                    
                    {/* Hidden input trigger */}
                    <label className="absolute -bottom-1 -right-1 bg-[#7e22ce] text-white p-1.5 rounded-full shadow border border-white cursor-pointer hover:bg-purple-800 transition-all">
                      <Camera className="w-3 h-3" />
                      <input 
                        type="file" 
                        accept="image/png, image/jpeg, image/jpg, image/webp" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUploadApi(file, editingEmployee.id, false);
                        }} 
                        className="hidden" 
                      />
                    </label>
                  </div>

                  <div className="flex-1 space-y-1.5 min-w-0">
                    <p className="font-bold text-slate-700 text-[11px]">Choose a quick preset or upload photo:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_AVATARS.map((av, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handlePresetPhotoSelect(av, editingEmployee.id, false)}
                          className={`w-7 h-7 rounded-full overflow-hidden border-2 relative transition-all cursor-pointer ${
                            editAvatarUrl === av ? "border-purple-600 scale-110 shadow-xs" : "border-transparent opacity-80 hover:opacity-100"
                          }`}
                        >
                          <img src={av} alt="Preset" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          {editAvatarUrl === av && (
                            <div className="absolute inset-0 bg-purple-600/30 flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white stroke-[3px]" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 text-[10px] text-slate-500">
                      <Upload className="w-3.5 h-3.5 text-slate-400" />
                      <span>Upload customized PNG, JPG, or WebP up to 2MB using the camera icon.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Name & Google Email Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-500 font-semibold">Full Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none text-slate-800 font-bold text-sm"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-500 font-semibold">Google Email Address</label>
                  <input
                    type="email"
                    required
                    disabled={user.role !== "owner"}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none text-slate-800 disabled:opacity-50 text-sm font-semibold"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Desk Designation & Phone Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-500 font-semibold">Desk Code / Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none text-slate-800 font-bold text-sm"
                    placeholder="e.g. Front Counter Aadhaar"
                    value={editDeskName}
                    onChange={(e) => setEditDeskName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-500 font-semibold">Phone Contact Number</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none text-slate-800 font-bold text-sm"
                    placeholder="e.g. +91 94440 12345"
                    value={editPhoneNumber}
                    onChange={(e) => setEditPhoneNumber(e.target.value)}
                  />
                </div>
              </div>

              {/* System Permission & Allocated Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-500 font-semibold">System Permission Role</label>
                  {user.role === "owner" && editingEmployee.id !== user.id ? (
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none text-slate-800 text-sm font-bold"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as any)}
                    >
                      <option value="employee">Employee Desk</option>
                      <option value="owner">Co-Owner / Admin</option>
                    </select>
                  ) : (
                    <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-sm font-bold capitalize">
                      {editRole === "owner" ? "Owner / Director (Unmodifiable)" : "Employee Desk"}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-500 font-semibold">Allocated Office Branch</label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none text-slate-800 text-sm font-bold"
                    value={editBranchId}
                    onChange={(e) => setEditBranchId(e.target.value)}
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.branch_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Work Specialization Description */}
              <div className="space-y-1">
                <label className="block text-slate-500 font-semibold">Work Description & Notes</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-600 focus:outline-none text-slate-800 font-semibold text-sm"
                  placeholder="Specializations, hours, shift, internal comments..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              {/* Actions Footer */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 bg-white rounded-xl hover:bg-slate-50 transition-all font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-[#7e22ce] hover:bg-purple-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow"
                >
                  {editLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Apply Changes</span>}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 4. CHANGE PHOTO MODAL */}
      {photoEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] text-slate-800 font-sans">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-display font-bold text-slate-900 text-sm">Update Profile Avatar</h3>
                <p className="text-[10px] text-slate-400">Quickly select a diverse workspace cartoon preset or upload an image file</p>
              </div>
              <button onClick={() => setPhotoEmployee(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {photoError && (
                <div className="p-3 bg-rose-50 text-rose-900 border border-rose-100 rounded-xl font-medium">
                  {photoError}
                </div>
              )}

              <div className="flex flex-col items-center justify-center space-y-3 bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <div className="relative">
                  {photoVal ? (
                    <img
                      src={photoVal}
                      alt="Avatar Preview"
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-full object-cover border-4 border-[#7e22ce] shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-2xl border-4 border-indigo-200">
                      {photoEmployee.full_name ? photoEmployee.full_name.slice(0,2).toUpperCase() : "??"}
                    </div>
                  )}

                  <label className="absolute bottom-0 right-0 bg-[#7e22ce] text-white p-2 rounded-full shadow border-2 border-white cursor-pointer hover:bg-purple-800 transition-all">
                    <Camera className="w-3.5 h-3.5" />
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg, image/jpg, image/webp" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUploadApi(file, photoEmployee.id, true);
                      }} 
                      className="hidden" 
                    />
                  </label>
                </div>

                <div className="text-center">
                  <span className="font-bold text-slate-800 text-[11px] block">{photoEmployee.full_name}</span>
                  <span className="text-[10px] text-slate-400 font-medium">Maximum upload file size limit: 2 MB</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-slate-700 text-[11px] block">Or Pick a Diverse Workspace Preset Avatar:</span>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_AVATARS.map((av, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handlePresetPhotoSelect(av, photoEmployee.id, true)}
                      className={`aspect-square rounded-2xl overflow-hidden border-2 relative transition-all cursor-pointer ${
                        photoVal === av ? "border-purple-600 scale-105 shadow-sm" : "border-slate-200 opacity-80 hover:opacity-100 hover:scale-[1.02]"
                      }`}
                    >
                      <img src={av} alt="Preset" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      {photoVal === av && (
                        <div className="absolute inset-0 bg-purple-600/30 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white stroke-[3px]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-[10px] text-slate-400">
              <span>Automatically updates in hierarchy charts</span>
              <button 
                onClick={() => setPhotoEmployee(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. REMOVE ACCESS MODAL / DRAWER */}
      {accessEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] text-slate-800 font-sans">
          <div className="bg-white rounded-2xl border border-rose-100 shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-rose-50 flex justify-between items-center bg-rose-50/50">
              <div>
                <h3 className="font-display font-bold text-rose-900 text-sm flex items-center gap-1.5">
                  <Shield className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                  <span>Remove Employee Access Lock</span>
                </h3>
                <p className="text-[10px] text-rose-500 font-medium">Deauthorize workspace login instantly and secure e-Sevai records</p>
              </div>
              <button onClick={() => setAccessEmployee(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {accessError && (
                <div className="p-3 bg-rose-100 text-rose-900 border border-rose-200 rounded-xl font-bold">
                  {accessError}
                </div>
              )}

              <div className="flex items-center gap-3 bg-rose-50/50 border border-rose-100 rounded-xl p-3">
                {renderAvatar(accessEmployee, "w-11 h-11")}
                <div>
                  <span className="font-bold text-slate-800 text-xs block">{accessEmployee.full_name}</span>
                  <span className="text-slate-500 font-medium text-[10px] font-mono">{accessEmployee.email}</span>
                </div>
              </div>

              <div className="space-y-2 text-slate-600 leading-relaxed font-semibold">
                <p className="text-amber-800">⚠️ <strong>Critical Security Notice:</strong></p>
                <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                  <li>Will immediately deactivate Google account pre-approval login.</li>
                  <li>They will be locked out and cannot access dashboards or file forms.</li>
                  <li><strong className="text-slate-800">Preserved:</strong> All past transaction receipts and filing entries remain unchanged for auditing.</li>
                  <li><strong className="text-slate-800">Preserved:</strong> Full administrative audit logs tracking past actions are kept.</li>
                </ul>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAccessEmployee(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveAccessSubmit}
                disabled={accessLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {accessLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Lock Out Employee</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. PERMANENT DELETE ADVANCED CONFIRMATION MODAL */}
      {deleteEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] text-slate-800 font-sans">
          <div className="bg-white rounded-2xl border border-rose-100 shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-rose-50/50">
              <div>
                <h3 className="font-display font-bold text-rose-900 text-sm flex items-center gap-1.5">
                  <Trash2 className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                  <span>Permanent Erasure - Desk #{deleteEmployee.id.slice(-4)}</span>
                </h3>
                <p className="text-[10px] text-rose-500 font-medium">Verify workspace eligibility and wipe metadata permanently</p>
              </div>
              <button onClick={() => setDeleteEmployee(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {deleteError && (
                <div className="p-3 bg-rose-100 text-rose-900 border border-rose-200 rounded-xl font-bold">
                  {deleteError}
                </div>
              )}

              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                {renderAvatar(deleteEmployee, "w-11 h-11")}
                <div>
                  <span className="font-bold text-slate-800 text-xs block">{deleteEmployee.full_name}</span>
                  <span className="text-slate-500 font-medium text-[10px] font-mono">{deleteEmployee.email}</span>
                </div>
              </div>

              {/* Server Eligibility Check Feedback */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <span className="font-bold text-slate-700 text-[11px] block uppercase tracking-wider">Workspace Deletion Check</span>
                
                {!deletionCheckResult ? (
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing transaction history, system dependency &amp; lockout criteria...</span>
                  </div>
                ) : (
                  <div className="space-y-2 text-[11px] font-semibold">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Historical Income Records:</span>
                      <span className={`font-bold ${deletionCheckResult.reasons.hasIncome ? "text-rose-600" : "text-emerald-600"}`}>
                        {deletionCheckResult.reasons.hasIncome ? "Detected (Forbidden)" : "None"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Historical Expense Records:</span>
                      <span className={`font-bold ${deletionCheckResult.reasons.hasExpenses ? "text-rose-600" : "text-emerald-600"}`}>
                        {deletionCheckResult.reasons.hasExpenses ? "Detected (Forbidden)" : "None"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Operational Audit Trail:</span>
                      <span className={`font-bold ${deletionCheckResult.reasons.hasAudits ? "text-rose-600" : "text-emerald-600"}`}>
                        {deletionCheckResult.reasons.hasAudits ? "Referenced (Forbidden)" : "None"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Current Login Session:</span>
                      <span className={`font-bold ${deletionCheckResult.reasons.isCurrentOwner ? "text-rose-600" : "text-emerald-600"}`}>
                        {deletionCheckResult.reasons.isCurrentOwner ? "Yes (Forbidden)" : "No"}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold text-xs">
                      <span className="text-slate-700">Overall Status:</span>
                      {deletionCheckResult.allowed ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <Check className="w-4 h-4 stroke-[3px]" />
                          <span>Eligible for Erasure</span>
                        </span>
                      ) : (
                        <span className="text-rose-600 flex items-center gap-1">
                          <X className="w-4 h-4 stroke-[3px]" />
                          <span>Ineligible</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {deletionCheckResult && !deletionCheckResult.allowed && (
                <div className="p-3 bg-amber-50 text-amber-900 border border-amber-100 rounded-xl leading-normal font-semibold">
                  ⚠️ <strong>Deletion Restricted:</strong> This employee desk cannot be permanently deleted because they have associated business transactions or operational audits. Use the <strong>"Remove Employee Access"</strong> option instead, which instantly blocks logins while preserving accounting integrity.
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteEmployee(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              {deletionCheckResult && deletionCheckResult.allowed && (
                <button
                  type="button"
                  onClick={handlePermanentDeleteSubmit}
                  disabled={deleteLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {deleteLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Permanently Erase Profile</span>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
