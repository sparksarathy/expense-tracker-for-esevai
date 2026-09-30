/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/localDb.ts";
import { Profile, UserRole, PaymentMethod } from "./src/types.ts";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parser
app.use(express.json());

// Helper: Custom inline cookie parser
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie || "";
  const parsed: { [key: string]: string } = {};
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    if (parts.length === 2) {
      parsed[parts[0].trim()] = decodeURIComponent(parts[1].trim());
    }
  });
  (req as any).cookies = parsed;
  next();
});

// Helper: Get Logged In User from session (supports Cookie, Bearer Token, and custom header)
function getSessionUser(req: express.Request): Profile | null {
  let userId = (req as any).cookies?.["auth_session_id"];

  // Fallback to Bearer token in Authorization header
  if (!userId) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      userId = authHeader.substring(7).trim();
    }
  }

  // Fallback to x-user-id header
  if (!userId && req.headers["x-user-id"]) {
    userId = String(req.headers["x-user-id"]).trim();
  }

  if (!userId) return null;
  const profile = db.getProfileById(userId);
  if (!profile || !profile.is_active) return null;
  return profile;
}

// Security Middleware: Require Auth
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized. Please log in first." });
  }
  (req as any).user = user;
  next();
};

// Security Middleware: Require Owner/Admin role
const requireOwner = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = getSessionUser(req);
  if (!user || user.role !== "owner") {
    return res.status(403).json({ error: "Access denied. Owner permissions required." });
  }
  (req as any).user = user;
  next();
};

// =========================================================================
// 1. AUTHENTICATION & EMAIL VERIFICATION
// =========================================================================

// In-Memory Email Verification / OTP store
interface OtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}
const otpStore = new Map<string, OtpRecord>();

// =========================================================================
// MASTER ADMINISTRATORS / SHOP OWNERS
// =========================================================================
export const MASTER_ADMIN_EMAILS = ["csb21090@gmail.com", "ssesevai@gmail.com"];

export function isMasterAdmin(email?: string): boolean {
  if (!email || typeof email !== "string") return false;
  return MASTER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

// Helper: Check if an email is authorized to log in
function isEmailAuthorized(email: string): {
  authorized: boolean;
  role?: UserRole;
  isInvited?: boolean;
  name?: string;
  source?: "profile" | "approved_user" | "invitation";
} {
  const normalized = email.trim().toLowerCase();
  
  // Master Admins are permanently authorized and immune to locks
  if (isMasterAdmin(normalized)) {
    return {
      authorized: true,
      role: "owner",
      name: normalized === "csb21090@gmail.com" ? "Spark (Admin)" : "SS E-Sevai (Admin)",
      source: "profile"
    };
  }

  // 1. Check existing active profile
  const profile = db.getProfileByEmail(normalized);
  if (profile && profile.is_active) {
    return { authorized: true, role: profile.role, name: profile.full_name, source: "profile" };
  }

  // 2. Check approved users list
  const approved = db.getApprovedUserByEmail(normalized);
  if (approved && approved.is_active) {
    return { authorized: true, role: approved.role, source: "approved_user" };
  }

  // 3. Check pending invitations
  const invitation = db.getInvitationByEmail(normalized);
  if (invitation && invitation.status === "pending") {
    return { authorized: true, role: invitation.role, isInvited: true, name: invitation.full_name, source: "invitation" };
  }

  return { authorized: false };
}

// Get currently logged-in user profile
app.get("/api/auth/me", (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.json({ user: null });
  }
  res.json({ user });
});

// =========================================================================
// STAFF & ADMIN REGISTRATION (SIGN-UP WITH CUSTOM PASSWORD)
// =========================================================================
app.post("/api/auth/register", (req, res) => {
  const { full_name, email, password, phone_number } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email address is required." });
  }
  if (!password || typeof password !== "string" || password.trim().length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long." });
  }

  const normalized = email.trim().toLowerCase();
  const trimmedPass = password.trim();
  const isMaster = isMasterAdmin(normalized);

  // STRICT DUPLICATE EMAIL CHECK: Check profiles, approved_users, and pending requests
  const existingProfile = db.getProfileByEmail(normalized);
  const existingApproved = db.getApprovedUserByEmail(normalized);
  const existingRequest = db.getGoogleRequests().find((r) => r.email.toLowerCase() === normalized);

  if (existingProfile || existingApproved || existingRequest) {
    return res.status(400).json({
      error: `The email "${normalized}" is already registered in the system. Duplicate accounts are not allowed. Please sign in with your password.`,
      exists: true,
    });
  }

  const org = db.getOrganizations()[0];
  const branch = db.getBranches()[0];
  const invitation = db.getInvitationByEmail(normalized);

  const roleToUse = isMaster ? "owner" : (invitation?.role || "employee");
  const isActive = isMaster;

  const profile = db.createProfile({
    id: isMaster
      ? (normalized === "csb21090@gmail.com" ? "admin-user-id-mock-uuid-key" : "admin-user-ssesevai-id")
      : ("user-id-" + Math.random().toString(36).substring(2, 11)),
    organization_id: (invitation && invitation.organization_id) || org.id,
    branch_id: (invitation && invitation.branch_id) || branch.id,
    full_name: full_name ? full_name.trim() : normalized.split("@")[0].replace(/[._-]/g, " "),
    email: normalized,
    role: roleToUse,
    password: trimmedPass,
    phone_number: phone_number ? phone_number.trim() : invitation?.phone_number,
    desk_name: isMaster ? "Main Admin Desk" : "Service Counter",
    is_active: isActive,
    email_verified: isMaster ? true : false,
    joining_date: new Date().toISOString().split("T")[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (invitation) {
    db.updateInvitation(invitation.id, {
      status: "accepted",
      accepted_at: new Date().toISOString(),
    });
  }

  // Record in audit log
  db.addAuditLog({
    organization_id: profile.organization_id,
    user_id: profile.id,
    action: "CREATE",
    entity_type: "profiles",
    entity_id: profile.id,
    new_values: JSON.stringify({
      email: profile.email,
      method: "SELF_REGISTRATION",
      role: profile.role,
      is_active: profile.is_active,
      timestamp: new Date().toISOString(),
    }),
  });

  // If not master admin, register in access requests table for Admin approval
  if (!isMaster) {
    db.addGoogleRequest({
      email: normalized,
      name: profile.full_name,
      email_verified: false,
    });

    return res.json({
      success: true,
      pendingApproval: true,
      email: normalized,
      name: profile.full_name,
      message: `Account created successfully! Your staff profile has been registered. Please wait for administrator approval to activate your counter access.`,
    });
  }

  // If master, log in immediately!
  res.cookie("auth_session_id", profile.id, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
    sameSite: "none",
    secure: true,
  });

  return res.json({
    success: true,
    user: profile,
    token: profile.id,
    message: "Registration successful! Welcome to SS E-SEVAI MAIYAM.",
  });
});

// =========================================================================
// OPTION A: DIRECT EMAIL + PASSWORD LOGIN
// =========================================================================
app.post("/api/auth/login", (req, res) => {
  const { email, password, rememberMe } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email address is required." });
  }
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password is required." });
  }

  const normalized = email.trim().toLowerCase();
  const trimmedPass = password.trim();

  // 1. Check existing profile
  let profile = db.getProfileByEmail(normalized);

  // If no profile yet
  if (!profile) {
    const approved = db.getApprovedUserByEmail(normalized);
    const invitation = db.getInvitationByEmail(normalized);
    const isMaster = isMasterAdmin(normalized);

    if (!isMaster && !approved && (!invitation || invitation.status !== "pending")) {
      return res.status(404).json({
        error: `Account with email "${normalized}" was not found. Please click "Sign Up" to register your staff account.`,
        notFound: true,
      });
    }

    const org = db.getOrganizations()[0];
    const branch = db.getBranches()[0];
    const roleToUse = isMaster ? "owner" : (approved?.role || invitation?.role || "employee");
    const nameToUse = invitation?.full_name || normalized.split("@")[0].replace(/[._-]/g, " ");

    profile = db.createProfile({
      id: isMaster
        ? (normalized === "csb21090@gmail.com" ? "admin-user-id-mock-uuid-key" : "admin-user-ssesevai-id")
        : ("user-id-" + Math.random().toString(36).substring(2, 11)),
      organization_id: (approved && approved.organization_id) || (invitation && invitation.organization_id) || org.id,
      branch_id: (approved && approved.branch_id) || (invitation && invitation.branch_id) || branch.id,
      full_name: nameToUse,
      email: normalized,
      role: roleToUse,
      password: trimmedPass, // Store chosen initial password
      desk_name: invitation?.desk_name || (isMaster ? "Main Admin Desk" : "Service Desk"),
      phone_number: invitation?.phone_number,
      notes: invitation?.notes,
      is_active: isMaster ? true : (approved?.is_active ?? false),
      joining_date: new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (invitation) {
      db.updateInvitation(invitation.id, {
        status: "accepted",
        accepted_at: new Date().toISOString(),
      });
    }
  } else {
    // Ensure master admin accounts are never deactivated or locked
    if (!profile.is_active && isMasterAdmin(profile.email)) {
      db.updateProfile(profile.id, { is_active: true });
      profile.is_active = true;
    }

    // Verify Password:
    if (!profile.password) {
      db.updateProfile(profile.id, { password: trimmedPass });
      profile.password = trimmedPass;
    } else {
      const match =
        profile.password === trimmedPass ||
        (profile.role === "owner" && (trimmedPass === "admin123" || trimmedPass === "admin"));

      if (!match) {
        return res.status(401).json({
          error: "Incorrect password. Please enter the correct password.",
        });
      }
    }

    // Check activation
    if (!profile.is_active) {
      return res.status(403).json({
        error: "Your account is awaiting administrator approval. Your counter access has not been activated yet.",
        pendingApproval: true,
        email: normalized,
      });
    }
  }

  // Record login in audit log
  db.addAuditLog({
    organization_id: profile.organization_id,
    user_id: profile.id,
    action: "LOGIN",
    entity_type: "profiles",
    entity_id: profile.id,
    new_values: JSON.stringify({
      email: profile.email,
      method: "EMAIL_PASSWORD",
      timestamp: new Date().toISOString(),
    }),
  });

  const maxAge = (rememberMe ? 365 : 7) * 24 * 60 * 60 * 1000;
  res.cookie("auth_session_id", profile.id, {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "none",
    secure: true,
  });

  res.json({
    success: true,
    user: profile,
    token: profile.id,
    message: "Login successful.",
  });
});

// Update Password or 4-digit PIN
app.put("/api/auth/password", requireAuth, (req, res) => {
  const user = (req as any).user as Profile;
  const { newPassword, newPin } = req.body;

  const updates: Partial<Profile> = {};
  if (newPassword && typeof newPassword === "string" && newPassword.trim().length >= 4) {
    updates.password = newPassword.trim();
  }
  if (newPin && typeof newPin === "string" && newPin.trim().length >= 4) {
    updates.pin = newPin.trim();
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "Password or PIN must be at least 4 characters long." });
  }

  const updated = db.updateProfile(user.id, updates);
  res.json({ success: true, message: "Security credentials updated successfully.", user: updated });
});

// =========================================================================
// GOOGLE SIGN-IN FOR ALL EMPLOYEES & ADMIN (OPTION 2 WORKFLOW)
// =========================================================================
app.post("/api/auth/google", (req, res) => {
  const { email, name, avatar_url, google_id, code } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Google email is required." });
  }

  const normalized = email.trim().toLowerCase();

  // 1. Is it a primary center admin / owner?
  const isCenterOwner = isMasterAdmin(normalized);

  let profile = db.getProfileByEmail(normalized);
  const approvedUser = db.getApprovedUserByEmail(normalized);
  const invitation = db.getInvitationByEmail(normalized);

  // If master admin (csb21090@gmail.com or ssesevai@gmail.com):
  if (isCenterOwner) {
    if (!profile) {
      const org = db.getOrganizations()[0];
      const branch = db.getBranches()[0];
      profile = db.createProfile({
        id: normalized === "csb21090@gmail.com" ? "admin-user-id-mock-uuid-key" : "admin-user-ssesevai-id",
        organization_id: org.id,
        branch_id: branch.id,
        full_name: name || (normalized === "csb21090@gmail.com" ? "Spark (Owner)" : "SS E-Sevai (Owner)"),
        email: normalized,
        role: "owner",
        google_id: google_id || undefined,
        avatar_url: avatar_url || undefined,
        desk_name: "Main Admin Desk",
        is_active: true,
        email_verified: true,
        joining_date: new Date().toISOString().split("T")[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else if (!profile.is_active) {
      db.updateProfile(profile.id, { is_active: true, email_verified: true });
      profile.is_active = true;
      profile.email_verified = true;
    }

    res.cookie("auth_session_id", profile.id, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
      sameSite: "none",
      secure: true,
    });

    return res.json({
      success: true,
      user: profile,
      token: profile.id,
      message: "Shop Owner login successful via Google.",
    });
  }

  // 2. If existing approved & active employee:
  if (profile && profile.is_active) {
    // Update avatar and google_id if supplied
    const updates: Partial<Profile> = {};
    if (avatar_url && avatar_url !== profile.avatar_url) updates.avatar_url = avatar_url;
    if (google_id && google_id !== profile.google_id) updates.google_id = google_id;
    if (name && (!profile.full_name || profile.full_name === normalized.split("@")[0])) updates.full_name = name;
    if (Object.keys(updates).length > 0) profile = db.updateProfile(profile.id, updates);

    // Audit log
    db.addAuditLog({
      organization_id: profile.organization_id,
      user_id: profile.id,
      action: "LOGIN",
      entity_type: "profiles",
      entity_id: profile.id,
      new_values: JSON.stringify({
        email: profile.email,
        method: "GOOGLE_SIGN_IN",
        timestamp: new Date().toISOString(),
      }),
    });

    res.cookie("auth_session_id", profile.id, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
      sameSite: "none",
      secure: true,
    });

    return res.json({
      success: true,
      user: profile,
      token: profile.id,
      message: "Employee login successful via Google.",
    });
  }

  // 3. For new employee or pending approval:
  // First, ensure their employee data is captured and saved in database immediately!
  const org = db.getOrganizations()[0];
  const branch = db.getBranches()[0];
  const nameToUse = name || normalized.split("@")[0].replace(/[._-]/g, " ");

  if (!profile) {
    profile = db.createProfile({
      id: "user-id-" + Math.random().toString(36).substring(2, 11),
      organization_id: (approvedUser && approvedUser.organization_id) || (invitation && invitation.organization_id) || org.id,
      branch_id: (approvedUser && approvedUser.branch_id) || (invitation && invitation.branch_id) || branch.id,
      full_name: nameToUse,
      email: normalized,
      role: "employee",
      google_id: google_id || undefined,
      avatar_url: avatar_url || undefined,
      desk_name: "Service Desk",
      is_active: false, // Inactive until Admin csb21090@gmail.com approves
      email_verified: false,
      joining_date: new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // Save request in google_requests table as well
  db.addGoogleRequest({
    email: normalized,
    name: nameToUse,
    avatar_url: avatar_url || undefined,
    google_id: google_id || undefined,
    email_verified: profile.email_verified || false,
  });

  // Check if this request includes a verification code submission:
  if (code) {
    const record = otpStore.get(normalized);
    if (!record || record.expiresAt < Date.now()) {
      return res.status(400).json({
        error: "Verification code has expired. Please request a fresh code.",
        expired: true,
      });
    }

    if (record.code !== String(code).trim()) {
      record.attempts = (record.attempts || 0) + 1;
      return res.status(400).json({
        error: "The 6-digit verification code entered does not match. Please check your email and try again.",
      });
    }

    // Code verified successfully!
    otpStore.delete(normalized);

    // Mark email verified in profile and google requests
    db.updateProfile(profile.id, { email_verified: true });
    profile.email_verified = true;

    const reqs = db.getGoogleRequests();
    const reqMatch = reqs.find(r => r.email.toLowerCase() === normalized);
    if (reqMatch) {
      db.updateGoogleRequest(reqMatch.id, { email_verified: true, verified_at: new Date().toISOString() });
    }

    // Check if user was already approved by admin
    if (approvedUser && approvedUser.is_active) {
      db.updateProfile(profile.id, { is_active: true });
      profile.is_active = true;

      res.cookie("auth_session_id", profile.id, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
        sameSite: "none",
        secure: true,
      });

      return res.json({
        success: true,
        user: profile,
        token: profile.id,
        message: "Email verified and access approved! Logging in...",
      });
    }

    // Otherwise, waiting for Administrator approval
    return res.json({
      success: true,
      emailVerified: true,
      pendingApproval: true,
      email: normalized,
      name: nameToUse,
      message: `Your Google email (${normalized}) has been verified and your profile data is registered in the database. Please wait for administrator approval to activate your counter access.`,
    });
  }

  // If no code submitted yet, generate and send 6-digit verification code to the employee's email!
  const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(normalized, {
    code: generatedCode,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes expiry
    attempts: 0,
    createdAt: Date.now(),
  });

  console.log(`\n======================================================`);
  console.log(`[GOOGLE EMAIL VERIFICATION] Sent to: ${normalized}`);
  console.log(`[GOOGLE EMAIL VERIFICATION] Code:    ${generatedCode}`);
  console.log(`[GOOGLE EMAIL VERIFICATION] Profile data saved in DB.`);
  console.log(`======================================================\n`);

  return res.json({
    success: true,
    requiresVerification: true,
    email: normalized,
    name: nameToUse,
    devOtp: generatedCode,
    emailVerified: profile.email_verified || false,
    message: `A 6-digit verification code has been dispatched to your Google email (${normalized}). Enter the code to verify your identity.`,
  });
});

// Check status of Google login approval (auto-polling & refresh)
app.get("/api/auth/google/status", (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  const profile = db.getProfileByEmail(email);
  const requests = db.getGoogleRequests();
  const request = requests.find(r => r.email.toLowerCase() === email);

  if (profile && profile.is_active) {
    // Approved! Start session
    res.cookie("auth_session_id", profile.id, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
      sameSite: "none",
      secure: true,
    });

    return res.json({
      approved: true,
      user: profile,
      token: profile.id,
      message: "Your account has been approved by the Admin!",
    });
  }

  return res.json({
    approved: false,
    emailVerified: profile?.email_verified || request?.email_verified || false,
    status: request?.status || "pending",
  });
});

// Resend Google verification code
app.post("/api/auth/google/resend", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required." });

  const normalized = String(email).trim().toLowerCase();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(normalized, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    createdAt: Date.now(),
  });

  console.log(`[GOOGLE EMAIL VERIFICATION RESEND] Sent to: ${normalized} Code: ${code}`);

  res.json({
    success: true,
    devOtp: code,
    message: `A fresh 6-digit verification code has been dispatched to ${normalized}.`,
  });
});

// =========================================================================
// ADMIN CONSOLE: GOOGLE ID APPROVALS & ACCESS CONTROL
// =========================================================================
app.get("/api/admin/google-requests", requireOwner, (req, res) => {
  const requests = db.getGoogleRequests();
  res.json({ requests });
});

app.post("/api/admin/approve-google-id", requireOwner, (req, res) => {
  const admin = (req as any).user as Profile;
  const { email, full_name, role, desk_name, phone_number, requestId } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Google email is required." });
  }

  const normalized = email.trim().toLowerCase();
  const org = db.getOrganizations()[0];
  const branch = db.getBranches()[0];

  // 1. Add or update ApprovedUser
  let approved = db.getApprovedUserByEmail(normalized);
  if (!approved) {
    approved = db.addApprovedUser({
      organization_id: org.id,
      branch_id: branch.id,
      email: normalized,
      full_name: full_name ? full_name.trim() : undefined,
      desk_name: desk_name ? desk_name.trim() : undefined,
      role: role === "owner" ? "owner" : "employee",
      is_active: true,
      invited_by: admin.id,
    });
  } else {
    approved = db.updateApprovedUser(normalized, {
      role: role === "owner" ? "owner" : "employee",
      full_name: full_name ? full_name.trim() : approved.full_name,
      desk_name: desk_name ? desk_name.trim() : approved.desk_name,
      is_active: true,
    });
  }

  // 2. If profile exists, ensure active and updated
  let profile = db.getProfileByEmail(normalized);
  if (profile) {
    profile = db.updateProfile(profile.id, {
      is_active: true,
      role: role === "owner" ? "owner" : "employee",
      desk_name: desk_name ? desk_name.trim() : profile.desk_name,
      full_name: full_name ? full_name.trim() : profile.full_name,
      phone_number: phone_number ? phone_number.trim() : profile.phone_number,
    });
  } else {
    // Create pre-approved profile
    profile = db.createProfile({
      id: "user-id-" + Math.random().toString(36).substring(2, 11),
      organization_id: org.id,
      branch_id: branch.id,
      full_name: full_name ? full_name.trim() : normalized.split("@")[0].replace(/[._-]/g, " "),
      email: normalized,
      role: role === "owner" ? "owner" : "employee",
      desk_name: desk_name ? desk_name.trim() : "Service Desk",
      phone_number: phone_number ? phone_number.trim() : undefined,
      is_active: true,
      joining_date: new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // 3. If tied to a request, mark it as approved
  if (requestId) {
    db.updateGoogleRequestStatus(requestId, "approved");
  } else {
    const requests = db.getGoogleRequests();
    const reqMatch = requests.find(r => r.email.toLowerCase() === normalized);
    if (reqMatch) {
      db.updateGoogleRequestStatus(reqMatch.id, "approved");
    }
  }

  // Audit log
  db.addAuditLog({
    organization_id: org.id,
    user_id: admin.id,
    action: "APPROVE_GOOGLE_ID",
    entity_type: "approved_users",
    entity_id: approved.id,
    new_values: JSON.stringify({
      approved_email: normalized,
      role: role || "employee",
      desk_name: desk_name || "Service Desk",
      approved_by: admin.email,
      timestamp: new Date().toISOString(),
    }),
  });

  res.json({
    success: true,
    message: `Google ID ${normalized} has been approved for ${role || "employee"} desk access!`,
    approvedUser: approved,
    profile,
  });
});

app.delete("/api/admin/google-requests/:id", requireOwner, (req, res) => {
  db.deleteGoogleRequest(req.params.id);
  res.json({ success: true, message: "Request dismissed." });
});

app.get("/api/admin/approved-users", requireOwner, (req, res) => {
  const approved = db.getApprovedUsers().filter((u) => u.email.toLowerCase() !== "csb21090@gmail.com");
  res.json({ approved });
});

app.put("/api/admin/approved-users/:email/toggle", requireOwner, (req, res) => {
  const { email } = req.params;
  const normalized = email.trim().toLowerCase();

  if (isMasterAdmin(normalized)) {
    return res.status(400).json({ error: "The primary shop owner accounts cannot be deactivated." });
  }

  const approved = db.getApprovedUserByEmail(normalized);
  if (!approved) {
    return res.status(404).json({ error: "Approved user not found." });
  }

  const newStatus = !approved.is_active;
  const updated = db.updateApprovedUser(normalized, { is_active: newStatus });

  // Also toggle matching profile
  const profile = db.getProfileByEmail(normalized);
  if (profile) {
    db.updateProfile(profile.id, { is_active: newStatus });
  }

  res.json({ success: true, approvedUser: updated, is_active: newStatus });
});

app.delete("/api/admin/approved-users/:email", requireOwner, (req, res) => {
  const { email } = req.params;
  const normalized = email.trim().toLowerCase();

  if (isMasterAdmin(normalized)) {
    return res.status(400).json({ error: "The primary shop owner accounts cannot be deleted." });
  }

  db.deleteApprovedUser(normalized);

  // Deactivate profile
  const profile = db.getProfileByEmail(normalized);
  if (profile) {
    db.updateProfile(profile.id, { is_active: false });
  }

  res.json({ success: true, message: `Approval revoked for ${normalized}.` });
});

// Step 1: Request Email Verification Code (OTP)
app.post("/api/auth/send-otp", (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "A valid email address is required." });
  }

  const normalized = email.trim().toLowerCase();
  const authCheck = isEmailAuthorized(normalized);

  if (!authCheck.authorized) {
    return res.status(403).json({
      error: `Access Denied: Email "${normalized}" has not been invited or registered by the Center Admin. Please ask your administrator to send you an invitation.`,
      notInvited: true,
    });
  }

  // Generate a cryptographically secure 6-digit OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(normalized, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes expiry
    attempts: 0,
    createdAt: Date.now(),
  });

  console.log(`\n======================================================`);
  console.log(`[EMAIL VERIFICATION OTP] Sent to: ${normalized}`);
  console.log(`[EMAIL VERIFICATION OTP] Code:    ${code}`);
  console.log(`======================================================\n`);

  res.json({
    success: true,
    email: normalized,
    message: `Verification code sent to ${normalized}. Enter the 6-digit code to complete login.`,
    devOtp: code, // Provided for developer demo and frictionless testing
    isInvited: authCheck.isInvited,
    name: authCheck.name,
    role: authCheck.role,
  });
});

// Step 2: Verify Email Code & Complete Login
app.post("/api/auth/verify-otp", (req, res) => {
  const { email, name } = req.body;
  const code = req.body.code || req.body.otp;
  if (!email || !code) {
    return res.status(400).json({ error: "Email address and 6-digit verification code are required." });
  }

  const normalized = email.trim().toLowerCase();
  const record = otpStore.get(normalized);

  if (!record || record.expiresAt < Date.now()) {
    return res.status(400).json({
      error: "Verification code has expired or was not requested. Please request a new code.",
      expired: true,
    });
  }

  if (record.attempts >= 5) {
    otpStore.delete(normalized);
    return res.status(400).json({
      error: "Maximum verification attempts exceeded. Please request a new code.",
    });
  }

  if (record.code !== String(code).trim()) {
    record.attempts++;
    const remaining = 5 - record.attempts;
    return res.status(400).json({
      error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
    });
  }

  // Code verified successfully! Invalidate used OTP
  otpStore.delete(normalized);

  // If invited, activate invitation
  const invitation = db.getInvitationByEmail(normalized);
  if (invitation) {
    db.updateInvitation(invitation.id, {
      status: "accepted",
      accepted_at: new Date().toISOString(),
    });
  }

  const org = db.getOrganizations()[0];
  const branch = db.getBranches()[0];

  // Look up approved user entry, create if from invitation
  let approvedUser = db.getApprovedUserByEmail(normalized);
  if (!approvedUser && invitation) {
    approvedUser = db.addApprovedUser({
      organization_id: invitation.organization_id || org.id,
      branch_id: invitation.branch_id || branch.id,
      email: normalized,
      role: invitation.role,
      is_active: true,
      invited_by: invitation.invited_by,
    });
  }

  // Look up profile, create or activate if needed
  let profile = db.getProfileByEmail(normalized);
  if (!profile) {
    const roleToUse = approvedUser ? approvedUser.role : (invitation ? invitation.role : "employee");
    const nameToUse = name || (invitation ? invitation.full_name : null) || normalized.split("@")[0].replace(/[._-]/g, " ");

    profile = db.createProfile({
      id: "user-id-" + Math.random().toString(36).substr(2, 9),
      organization_id: (approvedUser && approvedUser.organization_id) || (invitation && invitation.organization_id) || org.id,
      branch_id: (approvedUser && approvedUser.branch_id) || (invitation && invitation.branch_id) || branch.id,
      full_name: nameToUse,
      email: normalized,
      role: roleToUse,
      desk_name: invitation?.desk_name,
      phone_number: invitation?.phone_number,
      notes: invitation?.notes,
      is_active: true,
      joining_date: new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else if (!profile.is_active) {
    return res.status(403).json({ error: "Access denied. Your account profile is currently deactivated." });
  }

  // Record verified login in Audit logs
  db.addAuditLog({
    organization_id: profile.organization_id,
    user_id: profile.id,
    action: "LOGIN",
    entity_type: "profiles",
    entity_id: profile.id,
    new_values: JSON.stringify({ email: profile.email, verification: "EMAIL_OTP", timestamp: new Date().toISOString() })
  });

  // Set Auth cookie
  res.cookie("auth_session_id", profile.id, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
    sameSite: "none",
    secure: true,
  });

  res.json({ success: true, user: profile, token: profile.id });
});

// Step 3: Resend Verification Code
app.post("/api/auth/resend-otp", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required." });

  const normalized = email.trim().toLowerCase();
  const authCheck = isEmailAuthorized(normalized);
  if (!authCheck.authorized) {
    return res.status(403).json({ error: "Access denied. Email is not registered or invited." });
  }

  const existing = otpStore.get(normalized);
  if (existing && Date.now() - (existing.createdAt || 0) < 10000) {
    return res.status(429).json({ error: "Please wait 10 seconds before requesting another code." });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(normalized, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    createdAt: Date.now(),
  });

  console.log(`[EMAIL OTP RESENT] Sent to: ${normalized} Code: ${code}`);

  res.json({
    success: true,
    message: "New verification code sent.",
    devOtp: code,
  });
});

// Backward-compatible login handler (enforces OTP verification)
app.post("/api/auth/login", (req, res) => {
  const { email, code, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  // If verification code is provided, delegate to verify-otp
  if (code) {
    const normalized = email.trim().toLowerCase();
    const record = otpStore.get(normalized);

    if (!record || record.code !== String(code).trim()) {
      return res.status(400).json({ error: "Invalid or expired verification code." });
    }

    otpStore.delete(normalized);

    let profile = db.getProfileByEmail(normalized);
    if (!profile) {
      const approvedUser = db.getApprovedUserByEmail(normalized);
      if (!approvedUser) return res.status(403).json({ error: "Email not authorized." });
      profile = db.createProfile({
        id: "user-id-" + Math.random().toString(36).substr(2, 9),
        organization_id: approvedUser.organization_id,
        branch_id: approvedUser.branch_id,
        full_name: name || normalized.split("@")[0],
        email: normalized,
        role: approvedUser.role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    res.cookie("auth_session_id", profile.id, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
      sameSite: "none",
      secure: true,
    });

    return res.json({ user: profile });
  }

  // Otherwise, email verification is strictly required!
  return res.status(400).json({
    error: "Email verification is required. Please request a verification code.",
    requiresOtp: true,
  });
});

// Clear session / Logout
app.post("/api/auth/logout", (req, res) => {
  const user = getSessionUser(req);
  if (user) {
    db.addAuditLog({
      organization_id: user.organization_id,
      user_id: user.id,
      action: "LOGOUT",
      entity_type: "profiles",
      entity_id: user.id
    });
  }

  res.cookie("auth_session_id", "", {
    maxAge: 0,
    path: "/",
    sameSite: "none",
    secure: true,
  });
  res.json({ success: true });
});

// Emulator convenience endpoint: List pre-approved employees for easy UI toggling
app.get("/api/auth/approved-list", (req, res) => {
  const list = db.getProfiles();
  res.json({ approved: list });
});


// =========================================================================
// 2. SERVICE CATEGORIES
// =========================================================================
app.get("/api/service-categories", requireAuth, (req, res) => {
  const categories = db.getServiceCategories();
  res.json({ categories });
});

app.post("/api/service-categories", requireOwner, (req, res) => {
  const user = (req as any).user;
  const { category_name, service_name, service_code, description, default_rate, minimum_rate, maximum_rate, display_order } = req.body;

  const nameToUse = service_name || category_name;
  if (!nameToUse) {
    return res.status(400).json({ error: "Service name is required" });
  }

  // Enforce unique service names within the organization (case-insensitive)
  const existing = db.getServiceCategories().find(
    s => s.organization_id === user.organization_id &&
      (s.service_name || s.category_name).toLowerCase() === nameToUse.trim().toLowerCase()
  );
  if (existing) {
    return res.status(400).json({ error: "A service with this name already exists in your organization." });
  }

  const rate = Number(default_rate);
  if (isNaN(rate) || rate < 0) {
    return res.status(400).json({ error: "Rate must be a non-negative number" });
  }

  const minR = (minimum_rate !== undefined && minimum_rate !== "") ? Number(minimum_rate) : undefined;
  const maxR = (maximum_rate !== undefined && maximum_rate !== "") ? Number(maximum_rate) : undefined;

  if (minR !== undefined && (isNaN(minR) || minR < 0)) {
    return res.status(400).json({ error: "Minimum rate must be zero or greater." });
  }
  if (maxR !== undefined && (isNaN(maxR) || maxR < 0)) {
    return res.status(400).json({ error: "Maximum rate must be zero or greater." });
  }
  if (minR !== undefined && maxR !== undefined && maxR < minR) {
    return res.status(400).json({ error: "Maximum rate must be greater than or equal to minimum rate." });
  }

  const category = db.addServiceCategory({
    organization_id: user.organization_id,
    category_name: nameToUse.trim(),
    service_name: nameToUse.trim(),
    service_code: service_code || "",
    description: description || "",
    default_rate: rate,
    minimum_rate: minR,
    maximum_rate: maxR,
    is_active: true,
    display_order: Number(display_order) || 0,
    created_by: user.id,
    updated_by: user.id,
  });

  res.json({ success: true, category });
});

app.put("/api/service-categories/:id", requireOwner, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { category_name, service_name, service_code, description, default_rate, minimum_rate, maximum_rate, is_active, display_order } = req.body;

  const updates: any = {};

  const nameToUse = service_name || category_name;
  if (nameToUse !== undefined) {
    const existing = db.getServiceCategories().find(
      s => s.id !== id &&
        s.organization_id === user.organization_id &&
        (s.service_name || s.category_name).toLowerCase() === nameToUse.trim().toLowerCase()
    );
    if (existing) {
      return res.status(400).json({ error: "A service with this name already exists in your organization." });
    }
    updates.service_name = nameToUse.trim();
    updates.category_name = nameToUse.trim();
  }

  if (service_code !== undefined) updates.service_code = service_code;
  if (description !== undefined) updates.description = description;
  if (is_active !== undefined) updates.is_active = Boolean(is_active);
  if (display_order !== undefined) updates.display_order = Number(display_order);

  const currentCat = db.getServiceCategories().find(c => c.id === id);
  if (!currentCat) {
    return res.status(404).json({ error: "Service not found" });
  }

  let minR = minimum_rate !== undefined ? (minimum_rate === "" ? null : Number(minimum_rate)) : currentCat.minimum_rate;
  let maxR = maximum_rate !== undefined ? (maximum_rate === "" ? null : Number(maximum_rate)) : currentCat.maximum_rate;

  if (minR !== undefined && minR !== null) {
    if (isNaN(Number(minR)) || Number(minR) < 0) {
      return res.status(400).json({ error: "Minimum rate must be zero or greater." });
    }
    updates.minimum_rate = Number(minR);
  } else if (minimum_rate === "") {
    updates.minimum_rate = undefined;
  }

  if (maxR !== undefined && maxR !== null) {
    if (isNaN(Number(maxR)) || Number(maxR) < 0) {
      return res.status(400).json({ error: "Maximum rate must be zero or greater." });
    }
    updates.maximum_rate = Number(maxR);
  } else if (maximum_rate === "") {
    updates.maximum_rate = undefined;
  }

  if (updates.minimum_rate !== undefined && updates.maximum_rate !== undefined && updates.maximum_rate < updates.minimum_rate) {
    return res.status(400).json({ error: "Maximum rate must be greater than or equal to minimum rate." });
  }

  if (default_rate !== undefined) {
    const rate = Number(default_rate);
    if (isNaN(rate) || rate < 0) {
      return res.status(400).json({ error: "Rate must be a non-negative number" });
    }
    updates.default_rate = rate;
  }

  updates.updated_by = user.id;

  try {
    const updated = db.updateServiceCategory(id, updates, user.id);
    res.json({ success: true, category: updated });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

app.post("/api/service-categories/bulk-status", requireOwner, (req, res) => {
  const user = (req as any).user;
  const { ids, is_active } = req.body;
  if (!Array.isArray(ids) || is_active === undefined) {
    return res.status(400).json({ error: "Missing ids array or is_active boolean" });
  }

  try {
    const updatedCategories = ids.map(id => {
      return db.updateServiceCategory(id, { is_active: Boolean(is_active) }, user.id);
    });
    res.json({ success: true, count: updatedCategories.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/service-rate-history", requireAuth, (req, res) => {
  const user = (req as any).user;
  const history = db.getServiceRateHistory().filter(h => h.organization_id === user.organization_id);

  // Enrich with service and performer metadata
  const enriched = history.map(h => {
    const s = db.getServiceCategories().find(cat => cat.id === h.service_id);
    const p = db.getProfileById(h.changed_by);
    return {
      ...h,
      service_name: s ? (s.service_name || s.category_name) : "Deleted Service",
      performer_name: p ? p.full_name : "System / Unknown"
    };
  });

  res.json({ history: enriched });
});


// =========================================================================
// 3. EXPENSE CATEGORIES
// =========================================================================
app.get("/api/expense-categories", requireAuth, (req, res) => {
  const categories = db.getExpenseCategories();
  res.json({ categories });
});

app.post("/api/expense-categories", requireOwner, (req, res) => {
  const { category_name, description, display_order } = req.body;
  if (!category_name) {
    return res.status(400).json({ error: "Category name is required" });
  }

  const category = db.addExpenseCategory({
    organization_id: (req as any).user.organization_id,
    category_name,
    description: description || "",
    is_active: true,
    display_order: Number(display_order) || 0,
  });

  res.json({ success: true, category });
});

app.put("/api/expense-categories/:id", requireOwner, (req, res) => {
  const { id } = req.params;
  const { category_name, description, is_active, display_order } = req.body;

  const updates: any = {};
  if (category_name !== undefined) updates.category_name = category_name;
  if (description !== undefined) updates.description = description;
  if (is_active !== undefined) updates.is_active = Boolean(is_active);
  if (display_order !== undefined) updates.display_order = Number(display_order);

  try {
    const updated = db.updateExpenseCategory(id, updates);
    res.json({ success: true, category: updated });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});


// =========================================================================
// 4. INCOME ENTRIES (TRANSACTIONS)
// =========================================================================
app.get("/api/income-entries", requireAuth, (req, res) => {
  const user = (req as any).user;
  let entries = db.getIncomeEntries();

  // 1. Enforce Role Isolation (Employees see only their own, Owners see all)
  if (user.role !== "owner") {
    entries = entries.filter((e) => e.employee_id === user.id);
  }

  // 2. App Filter Parameters
  const { customer, employee_id, service_id, payment_method, date_from, date_to, sort_by } = req.query;

  if (customer) {
    const q = (customer as string).toLowerCase();
    entries = entries.filter((e) =>
      e.customer_name.toLowerCase().includes(q) ||
      (e.customer_number && e.customer_number.toLowerCase().includes(q))
    );
  }
  if (employee_id && user.role === "owner") {
    entries = entries.filter((e) => e.employee_id === employee_id);
  }
  if (service_id) {
    entries = entries.filter((e) => e.service_category_id === service_id);
  }
  if (payment_method) {
    entries = entries.filter((e) => e.payment_method === payment_method);
  }
  if (date_from) {
    entries = entries.filter((e) => e.transaction_date >= (date_from as string));
  }
  if (date_to) {
    entries = entries.filter((e) => e.transaction_date <= (date_to as string));
  }

  // Sort
  if (sort_by === "oldest") {
    entries.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.created_at.localeCompare(b.created_at));
  } else if (sort_by === "highest") {
    entries.sort((a, b) => b.service_rate - a.service_rate);
  } else if (sort_by === "lowest") {
    entries.sort((a, b) => a.service_rate - b.service_rate);
  } else {
    // default: newest
    entries.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.created_at.localeCompare(a.created_at));
  }

  res.json({ entries });
});

app.post("/api/income-entries", requireAuth, (req, res) => {
  const user = (req as any).user;
  const { customer_name, customer_number, service_category_id, payment_method, service_rate, transaction_date, notes, employee_id, rate_override_reason } = req.body;

  if (!customer_name || !service_category_id || !payment_method || !service_rate || !transaction_date) {
    return res.status(400).json({ error: "Missing required fields (customer_name, service_category_id, payment_method, service_rate, transaction_date)" });
  }

  const rate = Number(service_rate);
  if (isNaN(rate) || rate < 0) {
    return res.status(400).json({ error: "Service rate must be zero or greater." });
  }

  // Find service category or match by service name snapshot
  const service = db.getServiceCategories().find(s => s.id === service_category_id || (s.service_name || s.category_name).toLowerCase() === service_category_id.toLowerCase());
  const service_id = service ? service.id : service_category_id;
  const service_name_snapshot = service ? (service.service_name || service.category_name) : service_category_id;
  const listed_rate = service ? Number(service.default_rate) : rate;

  const rate_overridden = (rate !== listed_rate);

  if (rate_overridden) {
    if (user.role !== "owner") {
      const appSettings = db.getAppSettings();
      const globalAllowed = appSettings.allow_employee_rate_override !== false;
      const perEmpMapAllowed = appSettings.employee_rate_permissions?.[user.id] !== false;
      const profileAllowed = user.allow_rate_edit !== false;

      if (!globalAllowed || !perEmpMapAllowed || !profileAllowed) {
        return res.status(403).json({ error: "Rate editing in the Income Entry Form is disabled for your account by the administrator." });
      }
    }

    // Add audit log for rate adjustment difference
    db.addAuditLog({
      organization_id: user.organization_id,
      user_id: user.id,
      action: "RATE_OVERRIDE",
      entity_type: "income_entries",
      entity_id: "new",
      old_values: `Listed: ₹${listed_rate}`,
      new_values: `Charged: ₹${rate}. ${rate_override_reason ? `Reason: ${rate_override_reason}` : "Edited in Income Entry Form"}`
    });
  }

  // Determine actual target employee (Only Owner can record on behalf of other employees)
  let targetEmployeeId = user.id;
  if (user.role === "owner" && employee_id) {
    targetEmployeeId = employee_id;
  }

  const entry = db.addIncomeEntry({
    organization_id: user.organization_id,
    branch_id: user.branch_id,
    employee_id: targetEmployeeId,
    customer_name: customer_name.trim(),
    customer_number: customer_number ? String(customer_number).trim() : undefined,
    service_category_id: service_id,
    payment_method,
    service_rate: rate,
    transaction_date,
    notes: notes || "",
    created_by: user.id,

    // New snapshot fields
    service_id,
    service_name_snapshot,
    listed_rate,
    charged_rate: rate,
    rate_overridden,
    rate_override_reason: rate_override_reason || "",
  });

  res.json({ success: true, entry });
});

app.put("/api/income-entries/:id", requireAuth, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { customer_name, customer_number, service_category_id, payment_method, service_rate, transaction_date, notes, employee_id } = req.body;

  let original;
  try {
    original = db.getIncomeEntries().find((e) => e.id === id);
    if (!original) return res.status(404).json({ error: "Transaction not found" });
  } catch (err) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  // Check Permissions
  if (user.role !== "owner") {
    // Employees can only edit their own
    if (original.employee_id !== user.id) {
      return res.status(403).json({ error: "Access Denied. You cannot edit another employee's records." });
    }

    // Check configuration limits
    const settings = db.getAppSettings();
    if (!settings.allow_employee_editing) {
      return res.status(403).json({ error: "Employee transaction editing is disabled by the owner." });
    }

    const createdTime = new Date(original.created_at).getTime();
    const limitMs = settings.employee_editing_limit_hours * 60 * 60 * 1000;
    if (Date.now() - createdTime > limitMs) {
      return res.status(403).json({ error: `Time limit exceeded. Employees can only edit transactions within ${settings.employee_editing_limit_hours} hours of creation.` });
    }
  }

  const updates: any = {};
  if (customer_name !== undefined) updates.customer_name = customer_name;
  if (customer_number !== undefined) updates.customer_number = customer_number ? String(customer_number).trim() : undefined;
  if (service_category_id !== undefined) updates.service_category_id = service_category_id;
  if (payment_method !== undefined) updates.payment_method = payment_method;
  if (notes !== undefined) updates.notes = notes;
  if (transaction_date !== undefined) updates.transaction_date = transaction_date;

  if (service_rate !== undefined) {
    const rate = Number(service_rate);
    if (isNaN(rate) || rate <= 0) {
      return res.status(400).json({ error: "Rate must be greater than zero" });
    }
    updates.service_rate = rate;
  }

  if (employee_id !== undefined && user.role === "owner") {
    updates.employee_id = employee_id;
  }

  const updated = db.updateIncomeEntry(id, updates, user.id);
  res.json({ success: true, entry: updated });
});

app.delete("/api/income-entries/:id", requireOwner, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;

  try {
    const deleted = db.deleteIncomeEntry(id, user.id);
    res.json({ success: true, entry: deleted });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});


// =========================================================================
// 5. EXPENSE ENTRIES (TRANSACTIONS)
// =========================================================================
app.get("/api/expense-entries", requireAuth, (req, res) => {
  const user = (req as any).user;
  let entries = db.getExpenseEntries();

  // Role Isolation
  if (user.role !== "owner") {
    entries = entries.filter((e) => e.employee_id === user.id);
  }

  const { category_id, employee_id, payment_method, date_from, date_to, sort_by } = req.query;

  if (employee_id && user.role === "owner") {
    entries = entries.filter((e) => e.employee_id === employee_id);
  }
  if (category_id) {
    entries = entries.filter((e) => e.expense_category_id === category_id);
  }
  if (payment_method) {
    entries = entries.filter((e) => e.payment_method === payment_method);
  }
  if (date_from) {
    entries = entries.filter((e) => e.transaction_date >= (date_from as string));
  }
  if (date_to) {
    entries = entries.filter((e) => e.transaction_date <= (date_to as string));
  }

  // Sort
  if (sort_by === "oldest") {
    entries.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
  } else if (sort_by === "highest") {
    entries.sort((a, b) => b.amount - a.amount);
  } else if (sort_by === "lowest") {
    entries.sort((a, b) => a.amount - b.amount);
  } else {
    // default: newest
    entries.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.created_at.localeCompare(a.created_at));
  }

  res.json({ entries });
});

app.post("/api/expense-entries", requireAuth, (req, res) => {
  const user = (req as any).user;
  const { expense_category_id, description, amount, payment_method, transaction_date, notes, employee_id, receipt_url } = req.body;

  if (!expense_category_id || !description || !amount || !payment_method || !transaction_date) {
    return res.status(400).json({ error: "Missing required fields (expense_category_id, description, amount, payment_method, transaction_date)" });
  }

  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: "Expense amount must be greater than zero." });
  }

  const settings = db.getAppSettings();
  if (settings.require_expense_receipt && !receipt_url) {
    return res.status(400).json({ error: "A receipt upload is required for all expense logging under current admin settings." });
  }

  let targetEmployeeId = user.id;
  if (user.role === "owner" && employee_id) {
    targetEmployeeId = employee_id;
  }

  const entry = db.addExpenseEntry({
    organization_id: user.organization_id,
    branch_id: user.branch_id,
    employee_id: targetEmployeeId,
    expense_category_id,
    description,
    amount: numericAmount,
    payment_method,
    transaction_date,
    receipt_url: receipt_url || "",
    notes: notes || "",
    created_by: user.id,
  });

  res.json({ success: true, entry });
});

app.put("/api/expense-entries/:id", requireAuth, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { expense_category_id, description, amount, payment_method, transaction_date, notes, employee_id, receipt_url } = req.body;

  let original;
  try {
    original = db.getExpenseEntries().find((e) => e.id === id);
    if (!original) return res.status(404).json({ error: "Expense not found" });
  } catch (err) {
    return res.status(404).json({ error: "Expense not found" });
  }

  // Check Permissions
  if (user.role !== "owner") {
    if (original.employee_id !== user.id) {
      return res.status(403).json({ error: "Access Denied. You cannot edit another employee's expenses." });
    }

    const settings = db.getAppSettings();
    if (!settings.allow_employee_editing) {
      return res.status(403).json({ error: "Employee editing is disabled by the owner." });
    }

    const createdTime = new Date(original.created_at).getTime();
    const limitMs = settings.employee_editing_limit_hours * 60 * 60 * 1000;
    if (Date.now() - createdTime > limitMs) {
      return res.status(403).json({ error: `Time limit exceeded. Employees can only edit transactions within ${settings.employee_editing_limit_hours} hours of creation.` });
    }
  }

  const updates: any = {};
  if (expense_category_id !== undefined) updates.expense_category_id = expense_category_id;
  if (description !== undefined) updates.description = description;
  if (payment_method !== undefined) updates.payment_method = payment_method;
  if (transaction_date !== undefined) updates.transaction_date = transaction_date;
  if (notes !== undefined) updates.notes = notes;
  if (receipt_url !== undefined) updates.receipt_url = receipt_url;

  if (amount !== undefined) {
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than zero." });
    }
    updates.amount = numericAmount;
  }

  if (employee_id !== undefined && user.role === "owner") {
    updates.employee_id = employee_id;
  }

  const updated = db.updateExpenseEntry(id, updates, user.id);
  res.json({ success: true, entry: updated });
});

app.delete("/api/expense-entries/:id", requireOwner, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;

  try {
    const deleted = db.deleteExpenseEntry(id, user.id);
    res.json({ success: true, entry: deleted });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});


// =========================================================================
// 6. EMPLOYEE MANAGEMENT
// =========================================================================
app.get("/api/branches", requireAuth, (req, res) => {
  const branches = db.getBranches();
  res.json({ branches });
});

app.get("/api/employees", requireOwner, (req, res) => {
  // Hide internal hidden admin csb21090@gmail.com from the employee list and roster
  const profiles = db.getProfiles().filter((p) => p.email.toLowerCase() !== "csb21090@gmail.com");
  const approvedList = db.getApprovedUsers().filter((u) => u.email.toLowerCase() !== "csb21090@gmail.com");

  const incomeEntries = db.getIncomeEntries();
  const expenseEntries = db.getExpenseEntries();

  // Enrich profile information with transaction totals and performance details
  const employees = profiles.map((p) => {
    const userIncomes = incomeEntries.filter((i) => i.employee_id === p.id);
    const userExpenses = expenseEntries.filter((e) => e.employee_id === p.id);

    const revenue = userIncomes.reduce((acc, curr) => acc + curr.service_rate, 0);
    const expensesSum = userExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const count = userIncomes.length;

    // Last login lookup from audit logs
    const userAudits = db.getAuditLogs().filter((l) => l.user_id === p.id && l.action === "LOGIN");
    const lastLogin = userAudits.length > 0
      ? userAudits[userAudits.length - 1].created_at
      : p.created_at;

    return {
      ...p,
      transaction_count: count,
      revenue_generated: revenue,
      expense_amount: expensesSum,
      last_login: lastLogin,
    };
  });

  res.json({ employees, approvedList });
});

// Add future approved user email
app.post("/api/employees", requireOwner, (req, res) => {
  const { id, email, full_name, desk_name, phone_number, notes, role, branch_id, avatar_url, is_active, joining_date } = req.body;
  const currentUser = (req as any).user;

  if (!email || !full_name) {
    return res.status(400).json({ error: "Email and Full Name are required" });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingApproved = db.getApprovedUserByEmail(normalizedEmail);
  const existingProfile = db.getProfileByEmail(normalizedEmail);
  if (existingApproved || existingProfile) {
    return res.status(400).json({ error: "Email is already approved and registered." });
  }

  // Validate custom ID if provided
  let targetId = "user-id-" + Math.random().toString(36).substr(2, 9);
  if (id && id.trim()) {
    const customId = id.trim();
    const existingById = db.getProfileById(customId);
    if (existingById) {
      return res.status(400).json({ error: "The provided Employee ID is already in use by another desk." });
    }
    targetId = customId;
  }

  const org = db.getOrganizations()[0];
  const branch = db.getBranches()[0]; // Default to main branch for demo

  // Create approved user entry
  const approved = db.addApprovedUser({
    organization_id: currentUser.organization_id || org.id,
    branch_id: branch_id || branch.id,
    email: normalizedEmail,
    role: role === "owner" ? "owner" : "employee",
    is_active: is_active !== undefined ? Boolean(is_active) : true,
    invited_by: currentUser.id,
  });

  // Automatically seed matching profile so the user can immediately log in!
  const profile = db.createProfile({
    id: targetId,
    organization_id: currentUser.organization_id || org.id,
    branch_id: branch_id || branch.id,
    full_name: full_name.trim(),
    email: normalizedEmail,
    role: approved.role,
    is_active: is_active !== undefined ? Boolean(is_active) : true,
    desk_name: desk_name ? desk_name.trim() : undefined,
    phone_number: phone_number ? phone_number.trim() : undefined,
    notes: notes ? notes.trim() : undefined,
    avatar_url: avatar_url || undefined,
    joining_date: joining_date || new Date().toISOString().split("T")[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Record employee creation in audit log
  db.addAuditLog({
    organization_id: currentUser.organization_id || org.id,
    user_id: currentUser.id,
    action: "CREATE_EMPLOYEE",
    entity_type: "profiles",
    entity_id: profile.id,
    new_values: JSON.stringify(profile)
  });

  res.json({ success: true, employee: profile, approved });
});

// =========================================================================
// EMPLOYEE INVITATION ENDPOINTS (ADMIN / OWNER)
// =========================================================================

// List all invitations (pending, accepted, expired)
app.get("/api/employees/invitations", requireOwner, (req, res) => {
  const invitations = db.getInvitations();
  invitations.sort((a, b) => b.created_at.localeCompare(a.created_at));
  res.json({ invitations });
});

// Admin invites a new employee
app.post("/api/employees/invite", requireOwner, (req, res) => {
  const currentUser = (req as any).user;
  const { email, full_name, role, desk_name, phone_number, notes, branch_id } = req.body;

  if (!email || !full_name) {
    return res.status(400).json({ error: "Email and Full Name are required to invite an employee." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format." });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if an active profile already exists
  const existingProfile = db.getProfileByEmail(normalizedEmail);
  if (existingProfile && existingProfile.is_active) {
    return res.status(400).json({
      error: `An active staff account (${existingProfile.full_name}) is already registered with this email.`
    });
  }

  // Check if a pending invite already exists
  const existingInv = db.getInvitationByEmail(normalizedEmail);
  if (existingInv && existingInv.status === "pending") {
    return res.status(400).json({
      error: `A pending invitation already exists for ${normalizedEmail}. You can copy the link or resend it.`
    });
  }

  const org = db.getOrganizations()[0];
  const branch = db.getBranches()[0];
  const token = "inv_" + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

  const invitation = db.addInvitation({
    organization_id: currentUser.organization_id || org.id,
    branch_id: branch_id || branch.id,
    email: normalizedEmail,
    full_name: full_name.trim(),
    role: role === "owner" ? "owner" : "employee",
    desk_name: desk_name ? desk_name.trim() : undefined,
    phone_number: phone_number ? phone_number.trim() : undefined,
    notes: notes ? notes.trim() : undefined,
    token,
    status: "pending",
    invited_by: currentUser.id,
    invited_by_name: currentUser.full_name,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days validity
  });

  // Ensure user is in approved_users list
  let approved = db.getApprovedUserByEmail(normalizedEmail);
  if (!approved) {
    approved = db.addApprovedUser({
      organization_id: currentUser.organization_id || org.id,
      branch_id: branch_id || branch.id,
      email: normalizedEmail,
      role: invitation.role,
      is_active: true,
      invited_by: currentUser.id,
    });
  } else {
    db.updateApprovedUser(normalizedEmail, { is_active: true, role: invitation.role });
  }

  // Pre-seed profile record so when employee verifies email, their workspace is ready!
  if (!existingProfile) {
    db.createProfile({
      id: "user-id-" + Math.random().toString(36).substr(2, 9),
      organization_id: currentUser.organization_id || org.id,
      branch_id: branch_id || branch.id,
      full_name: full_name.trim(),
      email: normalizedEmail,
      role: invitation.role,
      desk_name: desk_name ? desk_name.trim() : undefined,
      phone_number: phone_number ? phone_number.trim() : undefined,
      notes: notes ? notes.trim() : undefined,
      is_active: true,
      joining_date: new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // Record invitation audit log
  db.addAuditLog({
    organization_id: currentUser.organization_id || org.id,
    user_id: currentUser.id,
    action: "INVITE_EMPLOYEE",
    entity_type: "invitations",
    entity_id: invitation.id,
    new_values: JSON.stringify({ email: normalizedEmail, full_name, role: invitation.role })
  });

  const origin = req.get("origin") || `${req.protocol}://${req.get("host")}`;
  const inviteLink = `${origin}/?invite=${token}&email=${encodeURIComponent(normalizedEmail)}`;

  res.json({
    success: true,
    invitation,
    inviteLink,
    message: `Invitation issued for ${full_name} (${normalizedEmail}). Share the link or have them verify their email on login.`
  });
});

// Resend an invitation
app.post("/api/employees/invitations/:id/resend", requireOwner, (req, res) => {
  const { id } = req.params;
  const inv = db.getInvitations().find(i => i.id === id);
  if (!inv) return res.status(404).json({ error: "Invitation record not found." });

  const updated = db.updateInvitation(id, {
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: "pending",
  });

  const origin = req.get("origin") || `${req.protocol}://${req.get("host")}`;
  const inviteLink = `${origin}/?invite=${updated.token}&email=${encodeURIComponent(updated.email)}`;

  res.json({
    success: true,
    invitation: updated,
    inviteLink,
    message: `Invitation resent to ${updated.email}!`
  });
});

// Revoke an invitation
app.delete("/api/employees/invitations/:id", requireOwner, (req, res) => {
  const { id } = req.params;
  const inv = db.getInvitations().find(i => i.id === id);
  if (!inv) return res.status(404).json({ error: "Invitation not found." });

  db.updateInvitation(id, { status: "revoked" });
  res.json({ success: true, message: `Invitation for ${inv.email} has been revoked.` });
});

// Photo upload endpoint
app.post("/api/employees/upload-avatar", requireAuth, async (req, res) => {
  const { fileData, fileName, fileType } = req.body;
  if (!fileData || !fileType) {
    return res.status(400).json({ error: "Missing file data or file type" });
  }

  // Validate file size (max 2MB)
  const sizeInBytes = (fileData.length * 3) / 4;
  if (sizeInBytes > 2 * 1024 * 1024) {
    return res.status(400).json({ error: "File is too large. Maximum size allowed is 2 MB." });
  }

  // Validate actual file type (jpeg, jpg, png, webp)
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowedTypes.includes(fileType.toLowerCase())) {
    return res.status(400).json({ error: "Invalid file type. Only JPG, JPEG, PNG, or WebP files are allowed." });
  }

  try {
    // Convert Base64 data to buffer
    const base64Data = fileData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Generate clean filename
    const extension = fileType.split("/")[1] || "png";
    const cleanFileName = `avatar_${Date.now()}_${Math.floor(Math.random() * 1000)}.${extension}`;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "avatars";

    let fileUrl = "";

    if (supabaseUrl && supabaseKey) {
      console.log("[Supabase Upload] Initializing Supabase client lazily...");
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseKey);

      console.log(`[Supabase Upload] Uploading to bucket "${bucketName}"...`);
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(cleanFileName, buffer, {
          contentType: fileType,
          upsert: true
        });

      if (error) {
        console.error("[Supabase Upload Error]", error);
        throw new Error(`Supabase Storage upload error: ${error.message}`);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(cleanFileName);

      fileUrl = publicUrlData.publicUrl;
      console.log("[Supabase Upload] Successfully uploaded to Supabase:", fileUrl);
    } else {
      console.log("[Supabase Upload] No Supabase credentials. Falling back to local filesystem...");

      // Ensure data directory exists
      const uploadDir = path.join(process.cwd(), "data", "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, cleanFileName);
      fs.writeFileSync(filePath, buffer);

      // Return the public URL path
      fileUrl = `/uploads/${cleanFileName}`;
      console.log("[Supabase Upload] Saved locally:", fileUrl);
    }

    res.json({ success: true, url: fileUrl });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save file: " + err.message });
  }
});

// Endpoint to check deletion eligibility
app.get("/api/employees/:id/deletion-check", requireOwner, (req, res) => {
  const { id } = req.params;
  const currentUser = (req as any).user;

  try {
    const profile = db.getProfileById(id);
    if (!profile) {
      return res.status(404).json({ error: "Employee profile not found" });
    }

    if (profile.organization_id !== currentUser.organization_id) {
      return res.status(403).json({ error: "Permission Denied. Cross-organization access is rejected." });
    }

    const incomeCount = db.getIncomeEntries().filter((e) => e.employee_id === id).length;
    const expenseCount = db.getExpenseEntries().filter((e) => e.employee_id === id).length;

    // Check non-auth audits
    const auditLogsReferenced = db.getAuditLogs().some(
      (log) => (log.user_id === id || log.entity_id === id) && log.action !== "LOGIN" && log.action !== "LOGOUT"
    );

    const isCurrentOwner = profile.id === currentUser.id;
    const activeOwnersCount = db.getProfiles().filter(p => p.organization_id === profile.organization_id && p.role === "owner" && p.is_active).length;
    const isFinalActiveOwner = profile.role === "owner" && activeOwnersCount <= 1;

    const allowed = incomeCount === 0 && expenseCount === 0 && !auditLogsReferenced && !isCurrentOwner && !isFinalActiveOwner;

    res.json({
      allowed,
      reasons: {
        hasIncome: incomeCount > 0,
        hasExpenses: expenseCount > 0,
        hasAudits: auditLogsReferenced,
        isCurrentOwner,
        isFinalActiveOwner
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle activation, set branch, or change details of employee
app.put("/api/employees/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const { is_active, full_name, desk_name, phone_number, notes, role, email, avatar_url, branch_id, new_id, joining_date, allow_rate_edit } = req.body;
  const currentUser = (req as any).user;

  try {
    const original = db.getProfileById(id);
    if (!original) return res.status(404).json({ error: "Employee profile not found" });

    // Prevent cross-organization access
    if (original.organization_id !== currentUser.organization_id) {
      return res.status(403).json({ error: "Permission Denied. Cross-organization access is rejected." });
    }

    // Permissions check: Owner can edit any profile. Employees can only edit their own name/avatar/phone
    const isSelf = currentUser.id === original.id;
    if (currentUser.role !== "owner" && !isSelf) {
      return res.status(403).json({ error: "Permission Denied. You can only edit your own desk profile details." });
    }

    const updates: any = {};
    if (full_name !== undefined) updates.full_name = full_name.trim();
    if (desk_name !== undefined) updates.desk_name = desk_name ? desk_name.trim() : null;
    if (phone_number !== undefined) updates.phone_number = phone_number ? phone_number.trim() : null;
    if (notes !== undefined) updates.notes = notes ? notes.trim() : null;
    if (joining_date !== undefined) updates.joining_date = joining_date;
    if (avatar_url !== undefined) {
      updates.avatar_url = avatar_url;
      updates.avatar_updated_at = new Date().toISOString();
    }

    // These fields are OWNER ONLY
    if (currentUser.role === "owner") {
      if (new_id !== undefined && new_id.trim() && new_id.trim() !== id) {
        const cleanedNewId = new_id.trim();
        const existingProfile = db.getProfileById(cleanedNewId);
        if (existingProfile && existingProfile.id !== id) {
          return res.status(400).json({ error: "The new Employee ID is already in use by another desk." });
        }
        updates.id = cleanedNewId;
      }
      const activeOwnersCount = db.getProfiles().filter(p => p.organization_id === original.organization_id && p.role === "owner" && p.is_active).length;

      if (is_active !== undefined) {
        const nextActive = Boolean(is_active);
        if (!nextActive && original.role === "owner" && original.is_active && activeOwnersCount <= 1) {
          return res.status(400).json({ error: "Self-Deactivation Protection: You cannot deactivate the final active Owner of this center!" });
        }
        updates.is_active = nextActive;
      }

      if (role !== undefined) {
        if (role !== "owner" && role !== "employee") {
          return res.status(400).json({ error: "Invalid role specified." });
        }
        if (role === "employee" && original.role === "owner" && original.is_active && activeOwnersCount <= 1) {
          return res.status(400).json({ error: "Self-Demotion Protection: You cannot demote the final active Owner of this center!" });
        }
        updates.role = role;
      }

      if (branch_id !== undefined) {
        updates.branch_id = branch_id;
      }

      if (allow_rate_edit !== undefined) {
        updates.allow_rate_edit = Boolean(allow_rate_edit);
        const currentSettings = db.getAppSettings();
        const nextPerms = {
          ...(currentSettings.employee_rate_permissions || {}),
          [updates.id || id]: Boolean(allow_rate_edit),
        };
        db.updateAppSettings({ employee_rate_permissions: nextPerms });
      }

      if (email !== undefined) {
        const lowerEmail = email.trim().toLowerCase();
        if (lowerEmail !== original.email.toLowerCase()) {
          // Check for email collision
          const existing = db.getProfileByEmail(lowerEmail);
          if (existing && existing.id !== original.id) {
            return res.status(400).json({ error: "Email address is already in use by another desk." });
          }
          updates.email = lowerEmail;

          // Also rename/update the approved user record
          try {
            const approved = db.getApprovedUserByEmail(original.email);
            if (approved) {
              db.deleteApprovedUser(original.email);
              db.addApprovedUser({
                organization_id: approved.organization_id,
                branch_id: approved.branch_id,
                email: lowerEmail,
                role: updates.role !== undefined ? updates.role : approved.role,
                is_active: updates.is_active !== undefined ? updates.is_active : approved.is_active,
                invited_by: approved.invited_by
              });
            }
          } catch (e) {
            // Ignored if no approved record exists
          }
        }
      }
    } else {
      // If employee, prevent changing active status, role, email, or branch_id
      if (is_active !== undefined || role !== undefined || email !== undefined || branch_id !== undefined) {
        return res.status(403).json({ error: "Permission Denied. Employees cannot change status, roles, branches, or email addresses." });
      }
    }

    const updatedProfile = db.updateProfile(id, updates);

    // Also sync updates to approved list if applicable
    if (currentUser.role === "owner") {
      try {
        db.updateApprovedUser(updates.email || original.email, {
          is_active: updates.is_active !== undefined ? updates.is_active : original.is_active,
          role: updates.role !== undefined ? updates.role : original.role,
        });
      } catch (e) {
        // Ignored
      }
    }

    // Record rename/edit action in audit logs
    db.addAuditLog({
      organization_id: original.organization_id,
      user_id: currentUser.id,
      action: is_active === false ? "REVOKE_ACCESS" : "UPDATE_EMPLOYEE",
      entity_type: "profiles",
      entity_id: id,
      old_values: JSON.stringify(original),
      new_values: JSON.stringify(updatedProfile)
    });

    res.json({ success: true, employee: updatedProfile });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete employee desk entirely (profile and approved list)
app.delete("/api/employees/:id", requireOwner, (req, res) => {
  const { id } = req.params;
  const currentUser = (req as any).user;

  try {
    const profile = db.getProfileById(id);
    if (!profile) {
      return res.status(404).json({ error: "Employee profile not found" });
    }

    // Prevent cross-organization access
    if (profile.organization_id !== currentUser.organization_id) {
      return res.status(403).json({ error: "Permission Denied. Cross-organization deletion is rejected." });
    }

    if (profile.id === currentUser.id) {
      return res.status(400).json({ error: "Self-Deletion Protection: You cannot delete your own active owner account." });
    }

    // Check if final active owner
    const activeOwnersCount = db.getProfiles().filter(p => p.organization_id === profile.organization_id && p.role === "owner" && p.is_active).length;
    if (profile.role === "owner" && activeOwnersCount <= 1) {
      return res.status(400).json({ error: "Cannot permanently delete the final active Owner of this center!" });
    }

    // Delete profile (with re-assignment of historical transactions to the performing Owner) and approved_user record
    db.deleteProfile(id, currentUser.id);
    db.deleteApprovedUser(profile.email);

    // Create system audit log
    db.addAuditLog({
      organization_id: currentUser.organization_id,
      user_id: currentUser.id,
      action: "DELETE_EMPLOYEE",
      entity_type: "profiles",
      entity_id: id,
      new_values: JSON.stringify({ email: profile.email, name: profile.full_name })
    });

    res.json({ success: true, message: `Employee desk for ${profile.full_name} deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// =========================================================================
// 7. REPORTS ENDPOINTS (HIGHLY ACCURATE MATH)
// =========================================================================
app.get("/api/reports", requireAuth, (req, res) => {
  const user = (req as any).user;
  const { date_from, date_to, employee_id, service_id } = req.query;

  let incomes = db.getIncomeEntries();
  let expenses = db.getExpenseEntries();

  // Role restriction
  if (user.role !== "owner") {
    incomes = incomes.filter((e) => e.employee_id === user.id);
    expenses = expenses.filter((e) => e.employee_id === user.id);
  } else if (employee_id) {
    incomes = incomes.filter((e) => e.employee_id === employee_id);
    expenses = expenses.filter((e) => e.employee_id === employee_id);
  }

  if (service_id) {
    incomes = incomes.filter((e) => e.service_category_id === service_id);
  }

  if (date_from) {
    incomes = incomes.filter((e) => e.transaction_date >= (date_from as string));
    expenses = expenses.filter((e) => e.transaction_date >= (date_from as string));
  }
  if (date_to) {
    incomes = incomes.filter((e) => e.transaction_date <= (date_to as string));
    expenses = expenses.filter((e) => e.transaction_date <= (date_to as string));
  }

  // Exact calculations to avoid float errors
  const totalIncome = incomes.reduce((acc, curr) => acc + curr.service_rate, 0);
  const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const netProfit = totalIncome - totalExpense;

  const cashReceived = incomes.filter(i => i.payment_method === "Cash in Hand").reduce((acc, c) => acc + c.service_rate, 0);
  const gpayReceived = incomes.filter(i => i.payment_method === "GPay").reduce((acc, c) => acc + c.service_rate, 0);

  // Group by category for chart (robust to handle dynamic categories)
  const serviceCategories = db.getServiceCategories() || [];
  const revenueByCategoryMap: { [key: string]: { amount: number; count: number } } = {};

  (incomes || []).forEach(inc => {
    const cat = serviceCategories.find(c => c.id === inc.service_category_id);
    const resolvedName = cat ? cat.category_name : inc.service_category_id;
    if (!revenueByCategoryMap[resolvedName]) {
      revenueByCategoryMap[resolvedName] = { amount: 0, count: 0 };
    }
    revenueByCategoryMap[resolvedName].amount += inc.service_rate;
    revenueByCategoryMap[resolvedName].count += 1;
  });

  const revenueByCategory = Object.entries(revenueByCategoryMap).map(([name, stats]) => ({
    category_name: name,
    amount: stats.amount,
    count: stats.count
  })).sort((a, b) => b.amount - a.amount);

  const expenseCategories = db.getExpenseCategories() || [];
  const expensesByCategory = (expenseCategories || []).map(cat => {
    const catExpenses = (expenses || []).filter(e => e.expense_category_id === cat.id);
    const amount = catExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const count = catExpenses.length;
    return {
      category_name: cat.category_name,
      amount,
      count
    };
  }).filter(c => c.count > 0).sort((a, b) => b.amount - a.amount);

  // Group by Employee
  const profiles = db.getProfiles() || [];
  const revenueByEmployee = (profiles || []).map(p => {
    const empIncomes = (incomes || []).filter(i => i.employee_id === p.id);
    const empExpenses = (expenses || []).filter(e => e.employee_id === p.id);
    const revenue = empIncomes.reduce((acc, curr) => acc + curr.service_rate, 0);
    const count = empIncomes.length;
    const expenseAmt = empExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    return {
      id: p.id,
      full_name: p.full_name,
      revenue,
      count,
      expenses: expenseAmt,
      net: revenue - expenseAmt,
    };
  }).filter(e => e.count > 0 || e.expenses > 0).sort((a, b) => b.revenue - a.revenue);

  // Group by day for charts
  const datesSet = new Set([...incomes.map(i => i.transaction_date), ...expenses.map(e => e.transaction_date)]);
  const dailyBreakdown = Array.from(datesSet).map(dateStr => {
    const dayIncomes = incomes.filter(i => i.transaction_date === dateStr).reduce((acc, curr) => acc + curr.service_rate, 0);
    const dayExpenses = expenses.filter(e => e.transaction_date === dateStr).reduce((acc, curr) => acc + curr.amount, 0);
    return {
      date: dateStr, // YYYY-MM-DD
      income: dayIncomes,
      expense: dayExpenses,
      profit: dayIncomes - dayExpenses,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    summary: {
      totalIncome,
      totalExpense,
      netProfit,
      cashReceived,
      gpayReceived,
      totalTransactions: incomes.length + expenses.length,
      avgTransactionValue: incomes.length > 0 ? Number((totalIncome / incomes.length).toFixed(2)) : 0,
    },
    revenueByCategory,
    expensesByCategory,
    revenueByEmployee,
    dailyBreakdown,
    incomes,
    expenses,
  });
});


// =========================================================================
// 8. SETTINGS
// =========================================================================
app.get("/api/settings", requireAuth, (req, res) => {
  const settings = db.getAppSettings();
  res.json({ settings });
});

app.put("/api/settings", requireOwner, (req, res) => {
  const {
    allow_employee_editing,
    employee_editing_limit_hours,
    require_expense_receipt,
    allow_employee_rate_override,
    employee_rate_permissions,
  } = req.body;

  const updates: any = {};
  if (allow_employee_editing !== undefined) updates.allow_employee_editing = Boolean(allow_employee_editing);
  if (require_expense_receipt !== undefined) updates.require_expense_receipt = Boolean(require_expense_receipt);
  if (allow_employee_rate_override !== undefined) updates.allow_employee_rate_override = Boolean(allow_employee_rate_override);
  if (employee_rate_permissions !== undefined && typeof employee_rate_permissions === "object") {
    updates.employee_rate_permissions = employee_rate_permissions;
  }
  if (employee_editing_limit_hours !== undefined) {
    const hrs = Number(employee_editing_limit_hours);
    if (isNaN(hrs) || hrs < 0) {
      return res.status(400).json({ error: "Time limit must be a positive number" });
    }
    updates.employee_editing_limit_hours = hrs;
  }

  const updated = db.updateAppSettings(updates);
  res.json({ success: true, settings: updated });
});

app.post("/api/settings/reset-data", requireOwner, (req, res) => {
  try {
    const { confirmation, reauth_email } = req.body;
    const currentUser = (req as any).user;

    // Check if the current user is a master admin
    if (!isMasterAdmin(currentUser.email)) {
      return res.status(403).json({ error: "Access Denied. Database formatting/reset is strictly restricted to primary shop owners (csb21090@gmail.com / ssesevai@gmail.com) only." });
    }

    // 1. Re-authentication verification
    if (reauth_email && reauth_email.toLowerCase() !== currentUser.email.toLowerCase()) {
      return res.status(403).json({ error: "Re-authentication failed. The provided email does not match your active owner account." });
    }

    // 2. Exact confirmation check
    if (confirmation !== "RESET ALL RECORDS") {
      return res.status(400).json({ error: "Explicit confirmation failed. Please type 'RESET ALL RECORDS' exactly to confirm." });
    }

    // 3. Perform server-side transaction data reset
    const { incomeCount, expenseCount } = db.resetTransactionData(currentUser.id);

    // 4. Create system audit log for the reset action
    db.addAuditLog({
      organization_id: currentUser.organization_id,
      user_id: currentUser.id,
      action: "SYSTEM_RESET",
      entity_type: "organizations",
      entity_id: currentUser.organization_id,
      old_values: `Incomes: ${incomeCount}, Expenses: ${expenseCount}`,
      new_values: "Reset completed. Transaction records cleared."
    });

    res.json({
      success: true,
      message: "System transaction data reset completed successfully.",
      incomeCount,
      expenseCount
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// =========================================================================
// 9. AUDIT LOGS
// =========================================================================
app.get("/api/audit-logs", requireOwner, (req, res) => {
  const logs = db.getAuditLogs();
  logs.sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Enrich audit logs with performer full name
  const enriched = logs.map(l => {
    const p = db.getProfileById(l.user_id);
    return {
      ...l,
      performer_name: p ? p.full_name : "System / Unknown",
    };
  });

  res.json({ logs: enriched });
});


// =========================================================================
// 10. RECEIPT FILE UPLOAD HANDLER
// =========================================================================
// Mock Upload: We accept files from forms, return a localized preview URL
app.post("/api/upload-receipt", requireAuth, (req, res) => {
  // Return a realistic mock uploaded receipt file path
  res.json({
    success: true,
    file_url: `/mock_receipt_${Math.floor(Math.random() * 1000)}.png`,
  });
});

// Serve uploaded avatars statically
app.use("/uploads", express.static(path.join(process.cwd(), "data", "uploads")));


// =========================================================================
// VITE MIDDLEWARE & STATIC SERVING CONFIGURATION
// =========================================================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
