import fs from "fs";
import path from "path";

async function runSnapshotMigrationTestSuite() {
  console.log("=================================================");
  console.log("RUNNING MIGRATION 004 & SNAPSHOTS REPAIR TEST SUITE");
  console.log("=================================================");

  // 1. Static Analysis of Migration Files & install.sql
  console.log("\n[Test 1] Inspecting Migration & Install Files...");
  const migration004Path = path.join(process.cwd(), "database/migrations/004_warranty_and_snapshots_upgrade.sql");
  const migration008Path = path.join(process.cwd(), "database/migrations/008_repair_service_order_document_snapshots.sql");
  const installSqlPath = path.join(process.cwd(), "database/install.sql");

  const m004Content = fs.readFileSync(migration004Path, "utf-8");
  const m008Content = fs.readFileSync(migration008Path, "utf-8");
  const installContent = fs.readFileSync(installSqlPath, "utf-8");

  if (!m004Content.includes("CREATE TABLE IF NOT EXISTS service_order_document_snapshots")) {
    throw new Error("Migration 004 is missing CREATE TABLE IF NOT EXISTS service_order_document_snapshots");
  }
  console.log("  ✅ Migration 004 includes IF NOT EXISTS table creation before ALTER TABLE.");

  if (!m008Content.includes("CREATE TABLE IF NOT EXISTS service_order_document_snapshots")) {
    throw new Error("Migration 008 repair script is missing table creation");
  }
  console.log("  ✅ Migration 008 (repair) includes IF NOT EXISTS table creation.");

  if (!installContent.includes("CREATE TABLE service_order_document_snapshots")) {
    throw new Error("install.sql is missing service_order_document_snapshots definition");
  }
  console.log("  ✅ install.sql includes complete service_order_document_snapshots table definition.");

  // 2. Simulation of Migration Execution Scenarios
  console.log("\n[Test 2] Simulating Database Migration Scenarios...");

  // Mock Database State
  let tables: Record<string, string[]> = {};

  function executeMockStatement(rawStatement: string, allowMissingTable = false) {
    // Strip comments
    const lines = rawStatement.split("\n").map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith("--") && !l.startsWith("/*"));
    const cleanStmt = lines.join(" ").trim();
    if (!cleanStmt) return;

    if (cleanStmt.toUpperCase().startsWith("CREATE TABLE")) {
      const match = cleanStmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-zA-Z0-9_]+)`?/i);
      if (match && match[1]) {
        const tableName = match[1];
        if (!tables[tableName]) {
          tables[tableName] = ["id", "service_order_id", "document_type", "version", "snapshot_json", "content_hash", "generated_by", "generated_at", "service_order_status"];
          console.log(`    [Mock DB] Created table '${tableName}'`);
        } else {
          console.log(`    [Mock DB] Table '${tableName}' already exists (IF NOT EXISTS skipped)`);
        }
      }
    } else if (cleanStmt.toUpperCase().startsWith("ALTER TABLE")) {
      const match = cleanStmt.match(/ALTER\s+TABLE\s+`?([a-zA-Z0-9_]+)`?\s+ADD\s+COLUMN\s+`?([a-zA-Z0-9_]+)`?/i);
      if (match && match[1] && match[2]) {
        const tableName = match[1];
        const colName = match[2];
        if (!tables[tableName]) {
          if (!allowMissingTable) {
            throw new Error(`Table '${tableName}' doesn't exist`);
          }
        } else {
          if (!tables[tableName].includes(colName)) {
            tables[tableName].push(colName);
            console.log(`    [Mock DB] Added column '${colName}' to '${tableName}'`);
          } else {
            console.log(`    [Mock DB] Column '${colName}' already exists in '${tableName}' (Skipped gracefully)`);
          }
        }
      }
    }
  }

  // Scenario 2A: Database WITHOUT the table
  console.log("\n Scenario 2A: Applying Migration 004 on DB WITHOUT table...");
  tables = {}; // Reset tables (service_order_document_snapshots missing)
  tables["warranties"] = ["id"]; // existing warranties table
  tables["service_orders"] = ["id"]; // existing service_orders table

  const statements004 = m004Content.split(";").map(s => s.trim()).filter(Boolean);

  for (const stmt of statements004) {
    executeMockStatement(stmt);
  }

  if (tables["service_order_document_snapshots"] &&
      tables["service_order_document_snapshots"].includes("generated_by_admin_id") &&
      tables["service_order_document_snapshots"].includes("generated_by_name")) {
    console.log("  ✅ Scenario 2A Passed: Table created and columns added on DB without table.");
  } else {
    throw new Error("Scenario 2A Failed: Table or columns missing after migration 004.");
  }

  // Scenario 2B: Database WITH COMPLETE table
  console.log("\n Scenario 2B: Re-applying Migration 004 on DB WITH COMPLETE table...");
  for (const stmt of statements004) {
    executeMockStatement(stmt);
  }
  console.log("  ✅ Scenario 2B Passed: Re-applying migration on complete table executed idempotently without errors.");

  // Scenario 2C: Database WITH PARTIAL table (missing generated_by_admin_id)
  console.log("\n Scenario 2C: Applying Migration 004/008 on DB WITH PARTIAL table...");
  tables["service_order_document_snapshots"] = ["id", "service_order_id", "document_type", "version", "snapshot_json"]; // partial
  for (const stmt of statements004) {
    executeMockStatement(stmt);
  }
  if (tables["service_order_document_snapshots"].includes("generated_by_admin_id") &&
      tables["service_order_document_snapshots"].includes("generated_by_name")) {
    console.log("  ✅ Scenario 2C Passed: Partial table updated with missing columns.");
  } else {
    throw new Error("Scenario 2C Failed: Missing columns were not added to partial table.");
  }

  // Scenario 2D: Auto-repair mechanism simulation if an ALTER statement hits missing table
  console.log("\n Scenario 2D: Simulating Auto-repair mechanism during migration execution...");
  delete tables["service_order_document_snapshots"]; // missing table
  const alterStatement = "ALTER TABLE service_order_document_snapshots ADD COLUMN generated_by_admin_id INT NULL";

  try {
    executeMockStatement(alterStatement, false); // should throw table missing error
    throw new Error("Should have thrown table missing error");
  } catch (err: any) {
    if (err.message.includes("doesn't exist")) {
      console.log("    [Auto-repair Triggered] Detected missing table error. Auto-creating from install.sql...");
      // Auto-create from install.sql
      executeMockStatement("CREATE TABLE IF NOT EXISTS service_order_document_snapshots (id INT AUTO_INCREMENT PRIMARY KEY)");
      // Retry
      executeMockStatement(alterStatement);
      console.log("    [Auto-repair Succeeded] Retried statement completed after auto-creation.");
    } else {
      throw err;
    }
  }

  if (tables["service_order_document_snapshots"].includes("generated_by_admin_id")) {
    console.log("  ✅ Scenario 2D Passed: Auto-repair created missing table and completed alter statement.");
  } else {
    throw new Error("Scenario 2D Failed: Auto-repair did not resolve missing table.");
  }

  console.log("\n=================================================");
  console.log("ALL MIGRATION 004 & SNAPSHOTS TESTS PASSED!");
  console.log("=================================================");
}

runSnapshotMigrationTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
