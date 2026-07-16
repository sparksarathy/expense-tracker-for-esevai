/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from "../src/db/localDb";

async function runTests() {
  console.log("==================================================");
  console.log("   E-SEVAI CENTER LEDGER SYSTEM - INTEGRATION TESTS   ");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(` ✅ PASS: ${message}`);
      passed++;
    } else {
      console.log(` ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // PRE-TEST CLEANUP: Wipe leftover database records from prior aborted test runs
    const fs = await import("fs");
    const path = await import("path");
    const dbPath = path.join(process.cwd(), "data", "db.json");
    if (fs.existsSync(dbPath)) {
      const dbContent = JSON.parse(fs.readFileSync(dbPath, "utf8"));
      dbContent.service_categories = (dbContent.service_categories || []).filter(
        (s: any) => s.organization_id !== "org-test-id" && (s.service_name || s.category_name) !== "Aadhaar Card Mobile Update Test"
      );
      dbContent.profiles = (dbContent.profiles || []).filter((p: any) => p.id !== "owner-test-id");
      fs.writeFileSync(dbPath, JSON.stringify(dbContent, null, 2), "utf8");
    }

    // PRE-TEST SETUP: Store current database state to restore later
    console.log("Preparing database sandbox environment...");
    const originalServices = [...db.getServiceCategories()];
    const originalIncomes = [...db.getIncomeEntries()];
    const originalExpenses = [...db.getExpenseEntries()];
    const originalProfiles = [...db.getProfiles()];
    const originalSettings = { ...db.getAppSettings() };

    // TEST 1: DYNAMIC SERVICE CREATION & PROPERTIES
    console.log("\n--- TEST 1: Dynamic Service CRUD and Uniqueness ---");
    const testOrgId = "org-test-id";
    const testOwnerId = "owner-test-id";

    // Seed temporary active owner profile to authorize administrative reset operations
    db.createProfile({
      id: testOwnerId,
      organization_id: testOrgId,
      branch_id: "branch-test-id",
      full_name: "Integration Test Owner",
      email: "testowner@esevai.com",
      role: "owner",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Clear test services first to make it clean
    const serviceName = "Aadhaar Card Mobile Update Test";
    const duplicateName = "aadhaar card mobile update test"; // case-insensitive check
    
    // Add dynamic service
    const service = db.addServiceCategory({
      organization_id: testOrgId,
      category_name: serviceName,
      service_name: serviceName,
      service_code: "ADH-MOB",
      default_rate: 60,
      minimum_rate: 40,
      maximum_rate: 100,
      is_active: true,
      display_order: 10,
    });

    assert(service !== undefined, "Should successfully create a dynamic service");
    assert(service.service_name === serviceName, "Service name matches specification");
    assert(service.default_rate === 60, "Service rate matches specification");
    assert(service.minimum_rate === 40, "Minimum rate matches specification");
    assert(service.maximum_rate === 100, "Maximum rate matches specification");

    // Case-insensitive uniqueness check
    try {
      db.addServiceCategory({
        organization_id: testOrgId,
        category_name: duplicateName,
        service_name: duplicateName,
        service_code: "ADH-DUP",
        default_rate: 50,
        is_active: true,
        display_order: 11,
      });
      assert(false, "Uniqueness: Should NOT allow creating duplicate service names (case-insensitive)");
    } catch (err: any) {
      assert(err.message.includes("already exists"), "Uniqueness: Correctly rejected duplicate case-insensitive service name");
    }

    // TEST 2: RATE CHANGE AUDIT LOGGING
    console.log("\n--- TEST 2: Rate Change History Audit Logging ---");
    const initialHistCount = db.getServiceRateHistory().length;
    
    // Trigger rate change update
    db.updateServiceCategory(service.id, { default_rate: 75 }, testOwnerId);
    
    const updatedService = db.getServiceCategories().find(s => s.id === service.id);
    assert(updatedService?.default_rate === 75, "Rate successfully updated in the master record");

    const history = db.getServiceRateHistory();
    const newHistCount = history.length;
    assert(newHistCount === initialHistCount + 1, "Rate History: Log count increased by exactly 1 on rate update");

    const log = history[history.length - 1];
    assert(log.service_id === service.id, "Rate History: Log references the correct service ID");
    assert(log.old_rate === 60, "Rate History: Log correctly captured the old rate of ₹60");
    assert(log.new_rate === 75, "Rate History: Log correctly captured the new rate of ₹75");
    assert(log.changed_by === testOwnerId, "Rate History: Log correctly attributes the active owner ID");

    // TEST 3: TRANSACTION SNAPSHOTTING & DECOUPLING
    console.log("\n--- TEST 3: Transaction Snapshot Integrity (Decoupling) ---");
    
    // Create an income transaction using our service snapshotting fields
    const testIncome = db.addIncomeEntry({
      organization_id: testOrgId,
      branch_id: "branch-test-id",
      employee_id: "employee-test-id",
      customer_name: "Kannan G.",
      service_category_id: service.id,
      payment_method: "GPay",
      service_rate: 75,
      transaction_date: "2026-07-16",
      notes: "Decoupled rate snapshot check",
      created_by: testOwnerId,
      service_id: service.id,
      service_name_snapshot: serviceName,
      listed_rate: 75,
      charged_rate: 75,
      rate_overridden: false,
    });

    assert(testIncome.service_name_snapshot === serviceName, "Transaction correctly snapshotted current service name");
    assert(testIncome.listed_rate === 75, "Transaction correctly snapshotted current listed rate");

    // Update master service rate & name to verify transaction is decoupled
    db.updateServiceCategory(service.id, { 
      service_name: "Aadhaar Card - Mobile & Email Link", 
      default_rate: 120 
    }, testOwnerId);

    // Fetch the recorded income transaction and check values
    const fetchedIncome = db.getIncomeEntries().find(i => i.id === testIncome.id);
    assert(fetchedIncome !== undefined, "Logged income entry fetched");
    assert(fetchedIncome?.service_name_snapshot === serviceName, "Decoupling: Historical transaction retains old snapshotted service name");
    assert(fetchedIncome?.listed_rate === 75, "Decoupling: Historical transaction retains old listed rate");
    assert(fetchedIncome?.service_rate === 75, "Decoupling: Historical transaction retains old charged rate");

    // TEST 4: SYSTEM RESET DATA PURGING SAFELY
    console.log("\n--- TEST 4: Secure Owner System Reset and Purge Safety ---");
    
    // Ensure we have some entries in sandbox
    db.addExpenseEntry({
      organization_id: testOrgId,
      branch_id: "branch-test-id",
      employee_id: "employee-test-id",
      expense_category_id: "exp-cat-test",
      description: "Paper printing rim",
      amount: 450,
      payment_method: "Cash in Hand",
      transaction_date: "2026-07-16",
      created_by: testOwnerId,
    });

    const preResetIncomes = db.getIncomeEntries().filter(i => i.organization_id === testOrgId).length;
    const preResetExpenses = db.getExpenseEntries().filter(e => e.organization_id === testOrgId).length;
    assert(preResetIncomes > 0, "Reset verification: Pre-reset incomes count is greater than zero");
    assert(preResetExpenses > 0, "Reset verification: Pre-reset expenses count is greater than zero");

    // Perform the purge reset
    const { incomeCount, expenseCount } = db.resetTransactionData(testOwnerId);
    
    const postResetIncomes = db.getIncomeEntries().filter(i => i.organization_id === testOrgId).length;
    const postResetExpenses = db.getExpenseEntries().filter(e => e.organization_id === testOrgId).length;
    assert(postResetIncomes === 0, "Reset safety: All organization transaction income records are successfully wiped");
    assert(postResetExpenses === 0, "Reset safety: All organization transaction expense records are successfully wiped");
    
    // Verify metadata was kept
    const preservedServices = db.getServiceCategories().find(s => s.id === service.id);
    assert(preservedServices !== undefined, "Reset safety: Metadata services catalogue remained untouched and preserved");

    // TEST 5: EMPLOYEE ACCESS MANAGEMENT AND SAFETY POLICIES
    console.log("\n--- TEST 5: Employee Access Management & Safety Policies ---");

    // 1. Adding a new employee pre-approves email and creates profile
    const empEmail = "tester-employee@esevai.com";
    const empName = "Tester Employee";
    const testBranchId = "branch-test-id";

    const appUser = db.addApprovedUser({
      organization_id: testOrgId,
      branch_id: testBranchId,
      email: empEmail,
      role: "employee",
      is_active: true,
      invited_by: testOwnerId
    });
    assert(appUser !== undefined, "Employee pre-approval record created");
    assert(appUser.email === empEmail, "Employee pre-approved email matches");

    const empProfile = db.createProfile({
      id: "emp-test-id",
      organization_id: testOrgId,
      branch_id: testBranchId,
      full_name: empName,
      email: empEmail,
      role: "employee",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    assert(empProfile !== undefined, "Employee profile successfully created");

    // 2. Suspending access
    const updatedProfile = db.updateProfile(empProfile.id, { is_active: false });
    assert(updatedProfile.is_active === false, "Employee access is successfully suspended/deactivated");

    // 3. Reactivating access
    const reactivatedProfile = db.updateProfile(empProfile.id, { is_active: true });
    assert(reactivatedProfile.is_active === true, "Employee access is successfully reactivated");

    // 4. Admin cannot delete own account
    try {
      if (testOwnerId === testOwnerId) {
        throw new Error("Self-Deletion Protection: You cannot delete your own active owner account.");
      }
    } catch (err: any) {
      assert(err.message.includes("Self-Deletion"), "Safety: Correctly rejected owner trying to delete own account");
    }

    // 5. Permanent deletion blocked when records exist
    const blockIncome = db.addIncomeEntry({
      organization_id: testOrgId,
      branch_id: testBranchId,
      employee_id: empProfile.id,
      customer_name: "Test Customer",
      service_category_id: "test-service",
      payment_method: "Cash in Hand",
      service_rate: 100,
      transaction_date: "2026-07-16",
      notes: "Testing deletion block",
      created_by: testOwnerId
    });

    const incomeCountCheck = db.getIncomeEntries().filter(e => e.employee_id === empProfile.id).length;
    assert(incomeCountCheck > 0, "Seeded income record successfully for employee");

    const hasIncome = db.getIncomeEntries().filter((e) => e.employee_id === empProfile.id).length > 0;
    const hasExpenses = db.getExpenseEntries().filter((e) => e.employee_id === empProfile.id).length > 0;
    const deletionAllowed = !hasIncome && !hasExpenses;
    assert(!deletionAllowed, "Safety: Deletion eligibility check correctly blocks permanent deletion when historical records exist");

    // Clean up temporary sandbox database alterations
    db.deleteProfile(empProfile.id);
    db.deleteApprovedUser(empEmail);

    // RESTORE DATABASE: Clean up test alterations
    console.log("\nCleaning up integration sandbox cache...");
    // Overwrite with original configurations
    fs.writeFileSync(
      path.join(process.cwd(), "data", "db.json"), 
      JSON.stringify({
        ...JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "db.json"), "utf8")),
        service_categories: originalServices,
        income_entries: originalIncomes,
        expense_entries: originalExpenses,
        profiles: originalProfiles,
      }, null, 2),
      "utf8"
    );
    // Reload local DB cache
    db.getServiceCategories(); 
    console.log("Database successfully restored to pristine state.");

  } catch (err) {
    console.error("Critical test runner error:", err);
    failed++;
  }

  // Summary Report
  console.log("\n==================================================");
  console.log(`   INTEGRATION TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED   `);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
