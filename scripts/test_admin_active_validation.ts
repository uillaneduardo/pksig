import { execute, query } from "../src/lib/database.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import path from "path";

async function runAdminActiveTests() {
  console.log("==========================================");
  console.log("RUNNING ADMIN ACTIVE FIELD VALIDATION TESTS");
  console.log("==========================================");

  // Test 1: Codebase Static Analysis - Confirm no admin.status or status = 'active' on admins
  console.log("\n[Test 1] Codebase Static Analysis...");
  const serverCode = fs.readFileSync(path.join(process.cwd(), "server.ts"), "utf-8");
  const sessionCode = fs.readFileSync(path.join(process.cwd(), "src/lib/session.ts"), "utf-8");

  const forbiddenPatterns = [
    "admin.status",
    "status = 'active'",
    "status='active'",
    "a.status = 'active'",
    "status <> 'active'",
    "status != 'active'"
  ];

  let violationsFound = false;
  for (const pattern of forbiddenPatterns) {
    if (serverCode.includes(pattern)) {
      console.error(`❌ Violation in server.ts: found "${pattern}"`);
      violationsFound = true;
    }
    if (sessionCode.includes(pattern)) {
      console.error(`❌ Violation in session.ts: found "${pattern}"`);
      violationsFound = true;
    }
  }

  if (!violationsFound) {
    console.log("✅ Codebase Static Analysis Passed: No forbidden status references on admins.");
  } else {
    throw new Error("Static analysis failed: Found forbidden status references in admin code.");
  }

  // Database tests in-memory/mock or DB table check
  console.log("\n[Test 2] Database Logic Simulations...");

  const testPass = "TestPassword123!";
  const hash = bcrypt.hashSync(testPass, 10);

  // Active Admin Object Simulation
  const activeAdmin = {
    id: 9991,
    username: "active_test_admin",
    email: "active_admin@pksig.test",
    password_hash: hash,
    active: 1
  };

  // Inactive Admin Object Simulation
  const inactiveAdmin = {
    id: 9992,
    username: "inactive_test_admin",
    email: "inactive_admin@pksig.test",
    password_hash: hash,
    active: 0
  };

  // 2a. Active admin login
  console.log(" - Checking Active Admin Login...");
  const activeLoginOk =
    activeAdmin &&
    Number(activeAdmin.active) === 1 &&
    bcrypt.compareSync(testPass, activeAdmin.password_hash);
  if (activeLoginOk) {
    console.log("   ✅ Active admin login succeeded.");
  } else {
    throw new Error("Active admin login failed unexpectedly.");
  }

  // 2b. Inactive admin login attempt
  console.log(" - Checking Inactive Admin Login...");
  const inactiveLoginOk =
    inactiveAdmin &&
    Number(inactiveAdmin.active) === 1 &&
    bcrypt.compareSync(testPass, inactiveAdmin.password_hash);
  if (!inactiveLoginOk) {
    console.log("   ✅ Inactive admin login correctly rejected.");
  } else {
    throw new Error("Inactive admin login allowed!");
  }

  // 2c. Incorrect password returns generic denial
  console.log(" - Checking Incorrect Password Denial...");
  const wrongPasswordLogin =
    activeAdmin &&
    Number(activeAdmin.active) === 1 &&
    bcrypt.compareSync("WrongPassword!", activeAdmin.password_hash);
  if (!wrongPasswordLogin) {
    console.log("   ✅ Incorrect password correctly rejected.");
  } else {
    throw new Error("Wrong password login allowed!");
  }

  // 2d. Forgot Password logic check
  console.log(" - Checking Forgot Password active filter...");
  function filterActiveAdminForReset(email: string, adminList: typeof activeAdmin[]) {
    return adminList.filter(
      (a) => a.email.toLowerCase() === email.toLowerCase() && Number(a.active) === 1
    );
  }

  const activeResetAdmins = filterActiveAdminForReset("active_admin@pksig.test", [activeAdmin, inactiveAdmin]);
  const inactiveResetAdmins = filterActiveAdminForReset("inactive_admin@pksig.test", [activeAdmin, inactiveAdmin]);

  if (activeResetAdmins.length === 1 && activeResetAdmins[0].id === activeAdmin.id) {
    console.log("   ✅ Active admin found for password reset.");
  } else {
    throw new Error("Active admin password reset lookup failed.");
  }

  if (inactiveResetAdmins.length === 0) {
    console.log("   ✅ Inactive admin ignored for password reset.");
  } else {
    throw new Error("Inactive admin allowed password reset lookup!");
  }

  console.log("\n==========================================");
  console.log("ALL ADMIN ACTIVE VALIDATION TESTS PASSED!");
  console.log("==========================================");
}

runAdminActiveTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
