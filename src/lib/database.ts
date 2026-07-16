import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { encrypt, decrypt } from "./crypto.js";
import { DatabaseSync } from "node:sqlite";

const CONFIG_FILE = path.join(process.cwd(), "storage", "config", "database.json");

let pool: mysql.Pool | null = null;
let currentConfig: any = null;
let sqliteDbInstance: DatabaseSync | null = null;

function getSqliteInstance(databaseName: string): DatabaseSync {
  if (sqliteDbInstance) {
    return sqliteDbInstance;
  }
  const dbPath = path.join(process.cwd(), "storage", databaseName || "pksig.db");
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  sqliteDbInstance = new DatabaseSync(dbPath);
  return sqliteDbInstance;
}

export interface DatabaseConfig {
  mode: "local" | "remoto";
  type?: "mysql" | "mariadb" | "sqlite";
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string; // plain text when passing around for test, encrypted in file
  ssl: boolean;
  certificate?: string;
  configDate?: string;
  lastTest?: string;
  dbVersion?: string;
}

export interface DatabaseDriver {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<any>;
  testConnection(): Promise<{ success: boolean; message: string }>;
  createDatabaseAutomatically(): Promise<{ success: boolean; message: string }>;
}

export function translateMySqlToSqlite(sql: string): string {
  let cleanSql = sql.trim();

  // 1. Handle SET FOREIGN_KEY_CHECKS
  if (cleanSql.toUpperCase().startsWith("SET FOREIGN_KEY_CHECKS")) {
    const enable = cleanSql.includes("1") ? "ON" : "OFF";
    return `PRAGMA foreign_keys = ${enable}`;
  }

  // 2. Translate ON DUPLICATE KEY UPDATE
  if (/ON\s+DUPLICATE\s+KEY\s+UPDATE/i.test(cleanSql)) {
    const tableMatch = cleanSql.match(/INSERT\s+INTO\s+`?([a-zA-Z0-9_]+)`?/i);
    if (tableMatch) {
      const tableName = tableMatch[1].toLowerCase();
      let conflictTarget = "id";
      if (["equipment_categories", "payment_methods", "reception_accessories", "warranty_rules"].includes(tableName)) {
        conflictTarget = "name";
      }
      cleanSql = cleanSql.replace(/ON\s+DUPLICATE\s+KEY\s+UPDATE/i, `ON CONFLICT(${conflictTarget}) DO UPDATE SET`);
    }
  }

  // 3. Translate MySQL datatypes/constraints for CREATE TABLE
  if (/CREATE\s+TABLE/i.test(cleanSql)) {
    // Strip MySQL engine/charset/collate options
    cleanSql = cleanSql.replace(/\)\s*ENGINE\s*=\s*[a-zA-Z0-9_]+\s*(?:DEFAULT\s+CHARSET\s*=\s*[a-zA-Z0-9_]+\s*)?(?:COLLATE\s*=\s*[a-zA-Z0-9_]+\s*)?;?/i, ")");
    
    // Autoincrement translation
    cleanSql = cleanSql.replace(/INT\s+(?:NOT\s+NULL\s+)?AUTO_INCREMENT\s+PRIMARY\s+KEY/ig, "INTEGER PRIMARY KEY AUTOINCREMENT");
    cleanSql = cleanSql.replace(/INTEGER\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/ig, "INTEGER PRIMARY KEY AUTOINCREMENT");
    cleanSql = cleanSql.replace(/`?id`?\s+INT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/ig, "id INTEGER PRIMARY KEY AUTOINCREMENT");
    cleanSql = cleanSql.replace(/`?id`?\s+int\(11\)\s+NOT\s+NULL\s+AUTO_INCREMENT/ig, "id INTEGER PRIMARY KEY AUTOINCREMENT");
    
    // Replace column datatypes
    cleanSql = cleanSql.replace(/\bINT\(\d+\)/ig, "INTEGER");
    cleanSql = cleanSql.replace(/\bINT\b/ig, "INTEGER");
    cleanSql = cleanSql.replace(/\bTINYINT\(1\)/ig, "INTEGER");
    cleanSql = cleanSql.replace(/\bTINYINT\b/ig, "INTEGER");
    cleanSql = cleanSql.replace(/\bDATETIME\b/ig, "TEXT");
    cleanSql = cleanSql.replace(/\bTIMESTAMP\b/ig, "TEXT");
    cleanSql = cleanSql.replace(/\bDECIMAL\(\d+,\d+\)/ig, "NUMERIC");
    
    // Translate ENUM(...) to TEXT
    cleanSql = cleanSql.replace(/\bENUM\([^)]+\)/ig, "TEXT");
    
    // Strip ON UPDATE CURRENT_TIMESTAMP
    cleanSql = cleanSql.replace(/DEFAULT\s+CURRENT_TIMESTAMP\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP/ig, "DEFAULT CURRENT_TIMESTAMP");
    cleanSql = cleanSql.replace(/DEFAULT\s+current_timestamp\(\)\s+ON\s+UPDATE\s+current_timestamp\(\)/ig, "DEFAULT current_timestamp()");
    cleanSql = cleanSql.replace(/ON\s+UPDATE\s+current_timestamp\(\)/ig, "");
    cleanSql = cleanSql.replace(/ON\s+UPDATE\s+CURRENT_TIMESTAMP/ig, "");

    // SQLite doesn't support inline UNIQUE KEY uq_name (cols)
    // Translate "UNIQUE KEY uq_name (col1, col2)" to "UNIQUE (col1, col2)"
    cleanSql = cleanSql.replace(/UNIQUE\s+KEY\s+`?[a-zA-Z0-9_]+`?\s*\(([^)]+)\)/ig, "UNIQUE ($1)");

    // Inline index declarations (e.g. INDEX idx_name (cols)) are not supported in SQLite's CREATE TABLE.
    // Strip them out.
    const lines = cleanSql.split("\n");
    const filteredLines: string[] = [];
    for (const line of lines) {
      if (/^\s*(?:INDEX|KEY)\s+`?[a-zA-Z0-9_]+`?\s*\([^)]+\),?/i.test(line)) {
        continue;
      }
      filteredLines.push(line);
    }
    cleanSql = filteredLines.join("\n");
    // Clean up trailing commas before closing brackets
    cleanSql = cleanSql.replace(/,\s*\)/g, ")");
  }

  return cleanSql;
}

export class SqliteDriver implements DatabaseDriver {
  config: DatabaseConfig;
  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  get db() {
    return getSqliteInstance(this.config.database || "pksig.db");
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const cleanSql = translateMySqlToSqlite(sql);
      const stmt = this.db.prepare(cleanSql);
      const rows = stmt.all(...params);
      return rows as T[];
    } catch (err: any) {
      console.error("SQLite query error:", err.message, "SQL:", sql);
      throw err;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    try {
      const cleanSql = translateMySqlToSqlite(sql);
      if (cleanSql.includes(";") && !cleanSql.startsWith("INSERT") && !cleanSql.startsWith("UPDATE")) {
        // Handle multiple statements split by semicolon (e.g. installation scripts)
        const statements = cleanSql.split(/;(?=(?:[^'"`]*['"`][^'"`]*['"`])*[^'"`]*$)/g)
          .map(s => s.trim())
          .filter(s => s.length > 0);
        let lastResult: any = { affectedRows: 0, insertId: 0 };
        for (const stmtSql of statements) {
          const stmt = this.db.prepare(stmtSql);
          const result = stmt.run(...params);
          lastResult = {
            insertId: Number(result.lastInsertRowid),
            affectedRows: result.changes,
            changes: result.changes,
            lastInsertRowid: Number(result.lastInsertRowid)
          };
        }
        return lastResult;
      } else {
        const stmt = this.db.prepare(cleanSql);
        const result = stmt.run(...params);
        return {
          insertId: Number(result.lastInsertRowid),
          affectedRows: result.changes,
          changes: result.changes,
          lastInsertRowid: Number(result.lastInsertRowid)
        };
      }
    } catch (err: any) {
      console.error("SQLite execute error:", err.message, "SQL:", sql);
      throw err;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      this.db.prepare("SELECT 1").all();
      return { success: true, message: "Conexão estabelecida com sucesso com o SQLite local!" };
    } catch (err: any) {
      return { success: false, message: `Erro ao conectar ao SQLite local: ${err.message}` };
    }
  }

  async createDatabaseAutomatically(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: "Banco de dados SQLite local inicializado com sucesso!" };
  }
}

export class SqliteMockPool {
  async getConnection() {
    return {
      query: async (sql: string, params: any[] = []) => {
        let cleanSql = sql.trim();
        if (cleanSql.toUpperCase().startsWith("SET FOREIGN_KEY_CHECKS")) {
          const enable = cleanSql.includes("1") ? "ON" : "OFF";
          cleanSql = `PRAGMA foreign_keys = ${enable}`;
          const driver = getDbDriver();
          await driver.execute(cleanSql, params);
          return [[{}]];
        }
        
        const driver = getDbDriver();
        const rows = await driver.query(cleanSql, params);
        return [rows];
      },
      release: () => {}
    };
  }
  async query(sql: string, params: any[] = []) {
    const driver = getDbDriver();
    const rows = await driver.query(sql, params);
    return [rows];
  }
  async execute(sql: string, params: any[] = []) {
    const driver = getDbDriver();
    const result = await driver.execute(sql, params);
    return [result];
  }
  async end() {}
}

export class MySqlDriver implements DatabaseDriver {
  config: DatabaseConfig;
  constructor(config: DatabaseConfig) {
    this.config = config;
  }
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const activePool = await getPool();
    const [rows] = await activePool.query(sql, params);
    return rows as T[];
  }
  async execute(sql: string, params: any[] = []): Promise<any> {
    const activePool = await getPool();
    const [result] = await activePool.execute(sql, params);
    return result;
  }
  async testConnection(): Promise<{ success: boolean; message: string }> {
    let tempPool: mysql.Pool | null = null;
    try {
      const connectionOptions: mysql.PoolOptions = {
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password && this.config.password.includes(":") ? decrypt(this.config.password) : this.config.password,
        database: this.config.database,
        connectTimeout: 8000,
        ssl: this.config.ssl ? (this.config.certificate ? { ca: this.config.certificate } : { rejectUnauthorized: false }) : undefined,
      };

      tempPool = mysql.createPool(connectionOptions);
      const connection = await tempPool.getConnection();
      connection.release();
      return { success: true, message: "Conexão estabelecida com sucesso com o MySQL!" };
    } catch (err: any) {
      console.error("Test connection failed:", err);
      let msg = err.message || "Erro desconhecido ao conectar";
      if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") {
        msg = "Servidor não encontrado (DNS/IP inválido)";
      } else if (err.code === "ECONNREFUSED") {
        msg = `Conexão recusada na porta ${this.config.port}`;
      } else if (err.code === "ER_ACCESS_DENIED_ERROR") {
        msg = "Acesso negado: Usuário ou senha incorretos";
      } else if (err.code === "ER_BAD_DB_ERROR") {
        msg = `O banco de dados "${this.config.database}" não existe no servidor`;
      } else if (err.code === "ETIMEDOUT") {
        msg = "Tempo limite excedido ao tentar conectar";
      }
      return { success: false, message: msg };
    } finally {
      if (tempPool) {
        await tempPool.end().catch(console.error);
      }
    }
  }
  async createDatabaseAutomatically(): Promise<{ success: boolean; message: string }> {
    let tempPool: mysql.Pool | null = null;
    try {
      const connectionOptions: mysql.PoolOptions = {
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password && this.config.password.includes(":") ? decrypt(this.config.password) : this.config.password,
        connectTimeout: 8000,
        ssl: this.config.ssl ? (this.config.certificate ? { ca: this.config.certificate } : { rejectUnauthorized: false }) : undefined,
      };

      tempPool = mysql.createPool(connectionOptions);
      await tempPool.query(`CREATE DATABASE IF NOT EXISTS \`${this.config.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      return { success: true, message: `Banco de dados "${this.config.database}" criado com sucesso!` };
    } catch (err: any) {
      console.error("Failed to create database:", err);
      return { success: false, message: `Falha ao criar banco: ${err.message || "Erro de permissão"}` };
    } finally {
      if (tempPool) {
        await tempPool.end().catch(console.error);
      }
    }
  }
}

export class MariaDbDriver extends MySqlDriver {
  override async testConnection(): Promise<{ success: boolean; message: string }> {
    const testRes = await super.testConnection();
    if (testRes.success) {
      return { success: true, message: "Conectado ao MariaDB remoto com sucesso!" };
    }
    return testRes;
  }
}

export function getDbDriver(): DatabaseDriver {
  const config = getDatabaseConfig();
  if (!config) {
    throw new Error("Banco de dados não configurado");
  }
  const mode = config.mode || "remoto";
  const type = config.type || "mysql";
  
  if (mode === "local" || type === "sqlite") {
    return new SqliteDriver(config);
  }

  switch (type) {
    case "mysql":
      return new MySqlDriver(config);
    case "mariadb":
      return new MariaDbDriver(config);
    default:
      return new MySqlDriver(config);
  }
}

export function isDatabaseConfigured(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

export function getDatabaseConfig(): DatabaseConfig | null {
  if (!isDatabaseConfigured()) {
    return null;
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.error("Failed to read database config:", err);
    return null;
  }
}

export function saveDatabaseConfig(config: DatabaseConfig) {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Encrypt password if present in plain text
  const payload = { ...config };
  if (payload.password && !payload.password.includes(":")) {
    payload.password = encrypt(payload.password);
  }

  payload.configDate = new Date().toISOString();
  payload.lastTest = new Date().toISOString();
  payload.dbVersion = "1.0.0";

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(payload, null, 2), "utf8");

  // Reset current pool/db so next query recreates it
  if (pool) {
    pool.end().catch(console.error);
    pool = null;
  }
  sqliteDbInstance = null;
  currentConfig = null;
}

export async function testConnection(config: DatabaseConfig): Promise<{ success: boolean; message: string }> {
  const mode = config.mode || "remoto";
  const type = config.type || "mysql";
  let driver: DatabaseDriver;
  
  if (mode === "local" || type === "sqlite") {
    driver = new SqliteDriver(config);
  } else {
    switch (type) {
      case "mysql":
        driver = new MySqlDriver(config);
        break;
      case "mariadb":
        driver = new MariaDbDriver(config);
        break;
      default:
        driver = new MySqlDriver(config);
    }
  }
  return driver.testConnection();
}

export async function createDatabaseAutomatically(config: DatabaseConfig): Promise<{ success: boolean; message: string }> {
  const mode = config.mode || "remoto";
  const type = config.type || "mysql";
  let driver: DatabaseDriver;
  
  if (mode === "local" || type === "sqlite") {
    driver = new SqliteDriver(config);
  } else {
    switch (type) {
      case "mysql":
        driver = new MySqlDriver(config);
        break;
      case "mariadb":
        driver = new MariaDbDriver(config);
        break;
      default:
        driver = new MySqlDriver(config);
    }
  }
  return driver.createDatabaseAutomatically();
}

export async function getPool(): Promise<any> {
  const config = getDatabaseConfig();
  if (!config) {
    throw new Error("Banco de dados não configurado");
  }

  const mode = config.mode || "remoto";
  const type = config.type || "mysql";

  if (mode === "local" || type === "sqlite") {
    return new SqliteMockPool();
  }

  if (pool) {
    return pool;
  }

  try {
    const decrytedPassword = config.password ? decrypt(config.password) : "";
    const connectionOptions: mysql.PoolOptions = {
      host: config.host,
      port: config.port,
      user: config.user,
      password: decrytedPassword,
      database: config.database,
      ssl: config.ssl ? (config.certificate ? { ca: config.certificate } : { rejectUnauthorized: false }) : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };

    pool = mysql.createPool(connectionOptions);
    currentConfig = config;
    return pool;
  } catch (err) {
    console.error("Failed to create main database pool:", err);
    throw new Error("Erro ao estabelecer conexão com o banco de dados");
  }
}

export async function executeInstallSql(): Promise<{ success: boolean; message: string }> {
  try {
    const sqlPath = path.join(process.cwd(), "database", "install.sql");
    if (!fs.existsSync(sqlPath)) {
      return { success: false, message: "Arquivo de instalação install.sql não encontrado" };
    }

    const rawSql = fs.readFileSync(sqlPath, "utf8");

    const statements = rawSql
      .split(/;(?=(?:[^'"`]*['"`][^'"`]*['"`])*[^'"`]*$)/g) // split on semicolons outside of quotes
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    const activePool = await getPool();
    const connection = await activePool.getConnection();
    try {
      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
      for (const statement of statements) {
        if (statement.startsWith("--") || statement.startsWith("/*")) {
          continue;
        }
        await connection.query(statement);
      }
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    } finally {
      connection.release();
    }

    return { success: true, message: "Banco de dados estruturado com sucesso!" };
  } catch (err: any) {
    console.error("Installation script execution failed:", err);
    return { success: false, message: `Erro ao executar scripts: ${err.message}` };
  }
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const driver = getDbDriver();
  return driver.query<T>(sql, params);
}

export async function execute(sql: string, params?: any[]): Promise<any> {
  const driver = getDbDriver();
  return driver.execute(sql, params);
}

function sanitizeValue(val: any): any {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) {
    return val.toISOString().slice(0, 19).replace('T', ' ');
  }
  if (typeof val === "boolean") {
    return val ? 1 : 0;
  }
  return val;
}

export async function verifyDatabaseCompatibility(config: DatabaseConfig): Promise<{
  success: boolean;
  message: string;
  hasCompatibleTables: boolean;
  existingTables: string[];
  existingAdmins: string[];
}> {
  const coreTables = ["admins", "clients", "service_orders", "company_settings"];
  let foundTables: string[] = [];
  let adminsList: { username: string; name: string }[] = [];

  const mode = config.mode || "remoto";
  const type = config.type || "mysql";

  if (mode === "local" || type === "sqlite") {
    try {
      const db = getSqliteInstance(config.database || "pksig.db");
      const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
      foundTables = rows.map(r => r.name);
      
      const hasAdminsTable = foundTables.includes("admins");
      if (hasAdminsTable) {
        try {
          const adminsRows = db.prepare("SELECT username, name FROM admins").all() as any[];
          adminsList = adminsRows;
        } catch (adminErr) {
          console.warn("Could not query admins table in SQLite:", adminErr);
        }
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao conectar e verificar banco SQLite local: ${err.message}`,
        hasCompatibleTables: false,
        existingTables: [],
        existingAdmins: []
      };
    }
  } else {
    let tempPool: mysql.Pool | null = null;
    try {
      const connectionOptions: mysql.PoolOptions = {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password && config.password.includes(":") ? decrypt(config.password) : config.password,
        database: config.database,
        connectTimeout: 8000,
        ssl: config.ssl ? (config.certificate ? { ca: config.certificate } : { rejectUnauthorized: false }) : undefined,
      };

      tempPool = mysql.createPool(connectionOptions);
      const [rows] = await tempPool.query("SHOW TABLES");
      foundTables = (rows as any[]).map(r => Object.values(r)[0] as string);

      const hasAdminsTable = foundTables.includes("admins");
      if (hasAdminsTable) {
        try {
          const [adminRows] = await tempPool.query("SELECT username, name FROM admins");
          adminsList = adminRows as any[];
        } catch (adminErr) {
          console.warn("Could not query admins table:", adminErr);
        }
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao conectar e verificar banco MySQL remoto: ${err.message}`,
        hasCompatibleTables: false,
        existingTables: [],
        existingAdmins: []
      };
    } finally {
      if (tempPool) {
        await tempPool.end().catch(console.error);
      }
    }
  }

  // Check if core tables are present
  const matchingCoreTables = coreTables.filter(t => foundTables.includes(t));
  const hasCompatibleTables = matchingCoreTables.length === coreTables.length;

  const existingAdmins = adminsList.map(a => `${a.name} (${a.username})`);

  let message = "";
  if (hasCompatibleTables) {
    message = `Banco de dados compatível detectado! Encontramos todas as tabelas principais (${matchingCoreTables.join(", ")}).`;
  } else if (matchingCoreTables.length > 0) {
    message = `Banco de dados parcialmente compatível detectado. Encontramos algumas tabelas: ${matchingCoreTables.join(", ")}.`;
  } else {
    message = "O banco de dados está vazio ou não possui tabelas compatíveis.";
  }

  return {
    success: true,
    message,
    hasCompatibleTables,
    existingTables: foundTables,
    existingAdmins
  };
}

export async function verifyAndRepairDatabaseSchema(): Promise<{ success: boolean; message: string }> {
  try {
    const config = getDatabaseConfig();
    if (!config) {
      return { success: false, message: "Banco de dados não configurado para auto-reparo" };
    }

    const mode = config.mode || "remoto";
    const type = config.type || "mysql";
    const isSqlite = mode === "local" || type === "sqlite";

    console.log(`[Database Integrity Check] Running integrity and correction check for ${type} in ${mode} mode...`);

    // 1. Run low-level DB health check if SQLite
    if (isSqlite) {
      try {
        const integrityCheck = await query("PRAGMA integrity_check");
        if (integrityCheck && integrityCheck.length > 0 && Object.values(integrityCheck[0])[0] !== "ok") {
          console.error("[Database Integrity Check] PRAGMA integrity_check failed:", integrityCheck);
        } else {
          console.log("[Database Integrity Check] SQLite file physical integrity: OK");
        }
        
        const fkCheck = await query("PRAGMA foreign_key_check");
        if (fkCheck && fkCheck.length > 0) {
          console.warn("[Database Integrity Check] SQLite foreign key violations detected:", fkCheck);
        }
      } catch (e: any) {
        console.error("[Database Integrity Check] Low-level SQLite health check failed:", e.message);
      }
    }

    // 2. Systematic Table Presence Verification and Repair
    const expectedTables = [
      "app_meta", "admins", "admin_sessions", "login_attempts", "company_settings", 
      "system_settings", "sequences", "idempotency_keys", "clients", 
      "equipment_categories", "reception_accessories", "equipment_category_accessories", 
      "equipments", "service_order_statuses", "service_orders", "service_order_accessories", 
      "budget_items", "payment_methods", "payment_guides", "payment_installments", 
      "payments", "warranty_rules", "warranties", "attachments", 
      "financial_categories", "financial_transactions"
    ];

    let existingTables: string[] = [];
    if (isSqlite) {
      const rows = await query("SELECT name FROM sqlite_master WHERE type='table'");
      existingTables = rows.map((r: any) => r.name);
    } else {
      const rows = await query("SHOW TABLES");
      existingTables = rows.map((r: any) => Object.values(r)[0] as string);
    }

    // Detect and repair missing tables
    for (const table of expectedTables) {
      if (!existingTables.includes(table)) {
        console.log(`[Database Integrity Check] Table "${table}" is missing. Repairing...`);
        const ddl = getCreateTableStatement(table);
        if (ddl) {
          await execute(ddl);
          console.log(`[Database Integrity Check] Table "${table}" restored successfully.`);
        } else {
          console.error(`[Database Integrity Check] Could not locate CREATE TABLE statement for "${table}" in install.sql`);
        }
      }
    }

    // 3. Columns Verification and Repair
    // Check specific columns added by migrations or official updates
    const columnChecks = [
      {
        table: "attachments",
        column: "description",
        sqliteType: "TEXT",
        mysqlType: "TEXT NULL"
      },
      {
        table: "financial_transactions",
        column: "payment_id",
        sqliteType: "INTEGER",
        mysqlType: "INT DEFAULT NULL"
      },
      {
        table: "system_settings",
        column: "pwa_name",
        sqliteType: "TEXT",
        mysqlType: "VARCHAR(255) DEFAULT NULL"
      },
      {
        table: "system_settings",
        column: "pwa_short_name",
        sqliteType: "TEXT",
        mysqlType: "VARCHAR(100) DEFAULT NULL"
      },
      {
        table: "system_settings",
        column: "pwa_description",
        sqliteType: "TEXT",
        mysqlType: "TEXT DEFAULT NULL"
      },
      {
        table: "system_settings",
        column: "pwa_theme_color",
        sqliteType: "TEXT DEFAULT '#0e131f'",
        mysqlType: "VARCHAR(50) DEFAULT '#0e131f'"
      },
      {
        table: "system_settings",
        column: "pwa_background_color",
        sqliteType: "TEXT DEFAULT '#ffffff'",
        mysqlType: "VARCHAR(50) DEFAULT '#ffffff'"
      },
      {
        table: "system_settings",
        column: "pwa_display",
        sqliteType: "TEXT DEFAULT 'standalone'",
        mysqlType: "VARCHAR(50) DEFAULT 'standalone'"
      },
      {
        table: "system_settings",
        column: "pwa_icon_url",
        sqliteType: "TEXT",
        mysqlType: "LONGTEXT DEFAULT NULL"
      }
    ];

    for (const check of columnChecks) {
      // Check column existence
      let columnExists = false;
      if (isSqlite) {
        try {
          const colInfo = await query(`PRAGMA table_info(${check.table})`);
          columnExists = colInfo.some((col: any) => col.name === check.column);
        } catch (err) {
          console.error(`Failed to verify SQLite column ${check.table}.${check.column}`);
        }
      } else {
        try {
          const colInfo = await query(`SHOW COLUMNS FROM \`${check.table}\` LIKE ?`, [check.column]);
          columnExists = colInfo && colInfo.length > 0;
        } catch (err) {
          console.error(`Failed to verify MySQL column ${check.table}.${check.column}`);
        }
      }

      if (!columnExists) {
        console.log(`[Database Integrity Check] Column "${check.column}" is missing in table "${check.table}". Repairing...`);
        const typeDefinition = isSqlite ? check.sqliteType : check.mysqlType;
        try {
          await execute(`ALTER TABLE \`${check.table}\` ADD COLUMN \`${check.column}\` ${typeDefinition}`);
          console.log(`[Database Integrity Check] Column "${check.column}" in "${check.table}" added successfully.`);
        } catch (alterErr: any) {
          console.error(`[Database Integrity Check] Failed to add column ${check.table}.${check.column}:`, alterErr.message);
        }
      }
    }

    // 4. Ensure master/initial seed values are present
    await ensureMasterSeedData();

    return { success: true, message: "Integridade do banco de dados verificada e corrigida com sucesso!" };
  } catch (err: any) {
    console.error("[Database Integrity Check] Integrity and repair failed:", err);
    return { success: false, message: `Falha no teste de integridade do banco: ${err.message}` };
  }
}

// Extract a specific CREATE TABLE statement from install.sql
function getCreateTableStatement(tableName: string): string | null {
  try {
    const sqlPath = path.join(process.cwd(), "database", "install.sql");
    if (!fs.existsSync(sqlPath)) return null;
    const rawSql = fs.readFileSync(sqlPath, "utf8");
    const statements = rawSql
      .split(/;(?=(?:[^'"`]*['"`][^'"`]*['"`])*[^'"`]*$)/g)
      .map((stmt) => stmt.trim());
    
    for (const stmt of statements) {
      const regex = new RegExp(`CREATE\\s+TABLE\\s+\`?${tableName}\`?\\s*\\(`, "i");
      if (regex.test(stmt)) {
        return stmt;
      }
    }
  } catch (e) {
    console.error("Error reading install.sql for CREATE TABLE statement:", e);
  }
  return null;
}

// Safe seed function to guarantee defaults are populated
async function ensureMasterSeedData() {
  try {
    // 1. Check & Seed system_settings row 1
    const sysSet = await query("SELECT id FROM system_settings WHERE id = 1");
    if (!sysSet || sysSet.length === 0) {
      console.log("[Database Seeding] Seeding default row 1 in system_settings...");
      await execute("INSERT INTO system_settings (id) VALUES (1)");
    }

    // 2. Check & Seed equipment_categories
    const categories = await query("SELECT id FROM equipment_categories LIMIT 1");
    if (!categories || categories.length === 0) {
      console.log("[Database Seeding] Seeding default equipment_categories...");
      const defaultCategories = ['Notebook', 'Desktop / PC', 'Smartphone', 'Tablet', 'Impressora', 'Videogame / Console', 'Monitor'];
      for (const cat of defaultCategories) {
        await execute("INSERT INTO equipment_categories (name) VALUES (?)", [cat]);
      }
    }

    // 3. Check & Seed reception_accessories
    const accessories = await query("SELECT id FROM reception_accessories LIMIT 1");
    if (!accessories || accessories.length === 0) {
      console.log("[Database Seeding] Seeding default reception_accessories...");
      const defaultAccessories = [
        'Carregador / Fonte', 'Cabo de Força', 'Bateria', 'Capa Protetora', 
        'Película de Proteção', 'Controle / Joystick', 'Cartão de Memória', 
        'Cabo HDMI', 'Mouse sem Fio', 'Teclado'
      ];
      for (const acc of defaultAccessories) {
        await execute("INSERT INTO reception_accessories (name) VALUES (?)", [acc]);
      }
    }

    // 4. Check & Seed service_order_statuses
    const statuses = await query("SELECT id FROM service_order_statuses LIMIT 1");
    if (!statuses || statuses.length === 0) {
      console.log("[Database Seeding] Seeding default service_order_statuses...");
      const defaultStatuses = [
        { name: 'Recebida', pos: 1 },
        { name: 'Em análise', pos: 2 },
        { name: 'Aguardando aprovação', pos: 3 },
        { name: 'Aguardando peça', pos: 4 },
        { name: 'Em manutenção', pos: 5 },
        { name: 'Pronta', pos: 6 },
        { name: 'Entregue', pos: 7 },
        { name: 'Cancelada', pos: 8 }
      ];
      for (const st of defaultStatuses) {
        await execute("INSERT INTO service_order_statuses (name, position, is_system) VALUES (?, ?, 1)", [st.name, st.pos]);
      }
    }

    // 5. Check & Seed payment_methods
    const methods = await query("SELECT id FROM payment_methods LIMIT 1");
    if (!methods || methods.length === 0) {
      console.log("[Database Seeding] Seeding default payment_methods...");
      const defaultMethods = [
        { name: 'Dinheiro', allow: 0, max: 1 },
        { name: 'PIX', allow: 0, max: 1 },
        { name: 'Cartão de Crédito', allow: 1, max: 12 },
        { name: 'Cartão de Débito', allow: 0, max: 1 },
        { name: 'Boleto Bancário', allow: 1, max: 3 }
      ];
      for (const m of defaultMethods) {
        await execute("INSERT INTO payment_methods (name, allows_installments, max_installments) VALUES (?, ?, ?)", [m.name, m.allow, m.max]);
      }
    }

    // 6. Check & Seed financial_categories
    const finCats = await query("SELECT id FROM financial_categories LIMIT 1");
    if (!finCats || finCats.length === 0) {
      console.log("[Database Seeding] Seeding default financial_categories...");
      const defaultFinCats = [
        { name: 'Serviço de OS', type: 'entrada' },
        { name: 'Venda de Produto', type: 'entrada' },
        { name: 'Outras Receitas', type: 'entrada' },
        { name: 'Compra de Peças', type: 'saida' },
        { name: 'Aluguel / Condomínio', type: 'saida' },
        { name: 'Salários e Pró-labore', type: 'saida' },
        { name: 'Energia / Água / Internet', type: 'saida' },
        { name: 'Impostos e Taxas', type: 'saida' },
        { name: 'Outras Despesas', type: 'saida' }
      ];
      for (const fc of defaultFinCats) {
        await execute("INSERT INTO financial_categories (name, type, active) VALUES (?, ?, 1)", [fc.name, fc.type]);
      }
    }

    // 7. Check & Seed sequences
    const seqs = await query("SELECT type FROM sequences LIMIT 1");
    if (!seqs || seqs.length === 0) {
      console.log("[Database Seeding] Seeding initial sequences values...");
      const types = ["client", "equipment", "os", "guide", "warranty"];
      for (const t of types) {
        await execute("INSERT INTO sequences (type, last_value) VALUES (?, 0)", [t]);
      }
    }
  } catch (err) {
    console.error("Error seeding default database records:", err);
  }
}

export async function runInTransaction<T>(
  callback: (exec: (sql: string, params?: any[]) => Promise<any>) => Promise<T>
): Promise<T> {
  const config = getDatabaseConfig();
  const type = config?.type || "mysql";

  if (type === "mysql" || type === "mariadb") {
    const activePool = await getPool();
    const connection = await activePool.getConnection();
    await connection.beginTransaction();

    const exec = async (sql: string, params: any[] = []): Promise<any> => {
      const [results] = await connection.query(sql, params);
      return results;
    };

    try {
      const result = await callback(exec);
      await connection.commit();
      return result;
    } catch (err) {
      await connection.rollback().catch(console.error);
      throw err;
    } finally {
      connection.release();
    }
  } else {
    throw new Error(`Transações não são suportadas pelo tipo de banco: ${type}`);
  }
}
