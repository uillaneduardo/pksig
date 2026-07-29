import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

async function runAdminActiveAndEmailTests() {
  console.log("=================================================");
  console.log("RUNNING ADMIN ACTIVE & EMAIL VALIDATION SUITE");
  console.log("=================================================");

  // Test 1: Codebase Static Analysis
  console.log("\n[Test 1] Codebase Static Analysis...");
  const serverCode = fs.readFileSync(path.join(process.cwd(), "server.ts"), "utf-8");
  const sessionCode = fs.readFileSync(path.join(process.cwd(), "src/lib/session.ts"), "utf-8");
  const installSql = fs.readFileSync(path.join(process.cwd(), "database/install.sql"), "utf-8");
  const migration007 = fs.readFileSync(path.join(process.cwd(), "database/migrations/007_ensure_admin_email_column.sql"), "utf-8");

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
    console.log("  ✅ Codebase Static Analysis Passed: No forbidden status references on admins.");
  } else {
    throw new Error("Static analysis failed: Found forbidden status references in admin code.");
  }

  // Test 2: Verify Login Query Pattern in server.ts
  console.log("\n[Test 2] Login Query Format Verification...");
  const expectedLoginPattern = "SELECT * FROM admins WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1";
  if (serverCode.includes(expectedLoginPattern)) {
    console.log("  ✅ Login query follows exact parameterized standard.");
  } else {
    throw new Error(`Login query standard mismatch. Expected: "${expectedLoginPattern}"`);
  }

  // Test 3: Schema & Migration Integrity Checks
  console.log("\n[Test 3] Schema & Migration Files Integrity...");
  if (!installSql.includes("email VARCHAR(255) NULL")) {
    throw new Error("database/install.sql is missing 'email VARCHAR(255) NULL'");
  }
  if (!installSql.includes("INDEX idx_admins_email (email)")) {
    throw new Error("database/install.sql is missing 'INDEX idx_admins_email (email)'");
  }
  if (!migration007.includes("ALTER TABLE admins ADD COLUMN email VARCHAR(255) NULL;")) {
    throw new Error("007_ensure_admin_email_column.sql is missing column addition");
  }
  console.log("  ✅ Clean install.sql and migration 007 include email column and index.");

  // Test 4: Logic Simulations (Username, Email, Email NULL, Non-existent Email, Password Reset)
  console.log("\n[Test 4] Authentication & Password Reset Logic Simulations...");

  const testPass = "TestPassword123!";
  const hash = bcrypt.hashSync(testPass, 10);

  const mockAdmins = [
    {
      id: 1,
      username: "admin_user",
      email: "admin@pksig.com",
      password_hash: hash,
      active: 1
    },
    {
      id: 2,
      username: "no_email_admin",
      email: null,
      password_hash: hash,
      active: 1
    },
    {
      id: 3,
      username: "disabled_admin",
      email: "disabled@pksig.com",
      password_hash: hash,
      active: 0
    }
  ];

  function findAdminForLogin(identifier: string) {
    const cleanId = identifier.trim().toLowerCase();
    return mockAdmins.find((a) => {
      const matchUsername = a.username.toLowerCase() === cleanId;
      const matchEmail = a.email ? a.email.toLowerCase() === cleanId : false;
      return matchUsername || matchEmail;
    });
  }

  // 4a. Login by username
  const loginByUsername = findAdminForLogin("ADMIN_USER");
  if (loginByUsername && Number(loginByUsername.active) === 1 && bcrypt.compareSync(testPass, loginByUsername.password_hash)) {
    console.log("  ✅ Login by username succeeded.");
  } else {
    throw new Error("Login by username failed.");
  }

  // 4b. Login by email
  const loginByEmail = findAdminForLogin("ADMIN@PKSIG.COM");
  if (loginByEmail && Number(loginByEmail.active) === 1 && bcrypt.compareSync(testPass, loginByEmail.password_hash)) {
    console.log("  ✅ Login by email succeeded.");
  } else {
    throw new Error("Login by email succeeded.");
  }

  // 4c. Login with non-existent email
  const loginNonExistent = findAdminForLogin("nonexistent@pksig.com");
  if (!loginNonExistent) {
    console.log("  ✅ Login with non-existent email correctly returns null/unauthenticated.");
  } else {
    throw new Error("Login with non-existent email allowed!");
  }

  // 4d. Login with admin having NULL email using username
  const loginNullEmailAdmin = findAdminForLogin("no_email_admin");
  if (loginNullEmailAdmin && Number(loginNullEmailAdmin.active) === 1 && bcrypt.compareSync(testPass, loginNullEmailAdmin.password_hash)) {
    console.log("  ✅ Admin with email=NULL can log in using username.");
  } else {
    throw new Error("Admin with email=NULL failed username login.");
  }

  // 4e. Password Reset for active admin vs disabled/non-existent
  function findAdminForReset(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    return mockAdmins.find((a) => a.email && a.email.toLowerCase() === cleanEmail && Number(a.active) === 1);
  }

  const resetActive = findAdminForReset("admin@pksig.com");
  const resetDisabled = findAdminForReset("disabled@pksig.com");
  const resetNonExistent = findAdminForReset("unknown@pksig.com");

  if (resetActive && resetActive.id === 1) {
    console.log("  ✅ Active admin correctly retrieved for password reset.");
  } else {
    throw new Error("Active admin password reset lookup failed.");
  }

  if (!resetDisabled) {
    console.log("  ✅ Inactive admin ignored for password reset.");
  } else {
    throw new Error("Inactive admin permitted for password reset!");
  }

  if (!resetNonExistent) {
    console.log("  ✅ Non-existent email yields no admin for password reset.");
  } else {
    throw new Error("Non-existent email returned admin!");
  }

  console.log("\n=================================================");
  console.log("ALL TESTS PASSED SUCCESSFULLY!");
  console.log("=================================================");
}

runAdminActiveAndEmailTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
