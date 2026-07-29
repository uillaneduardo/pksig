import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { encrypt, decrypt } from "./crypto.js";
import { updateStepStatus, updateOperation, getOperation } from "./operationProgress.js";

const CONFIG_FILE = path.join(process.cwd(), "storage", "config", "database.json");
const CONNECTIONS_FILE = path.join(process.cwd(), "storage", "config", "database-connections.json");

let pool: mysql.Pool | null = null;
let currentConfig: any = null;

export interface DatabaseConfig {
  id?: string;
  name?: string;
  mode: "local" | "remoto";
  type?: "mysql" | "mariadb";
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
  connectionFingerprint?: string;
}

export interface DatabaseConnection {
  id: string;
  name: string;
  type: "mysql" | "mariadb";
  host: string;
  port: number;
  database: string;
  user: string;
  encryptedPassword: string;
  ssl: boolean;
  encryptedCertificate?: string;
  createdAt: string;
  updatedAt: string;
  lastTestAt?: string;
  lastTestSuccess?: boolean;
  serverHostname?: string;
  serverVersion?: string;
  authenticatedUser?: string;
  connectionFingerprint?: string;
  active: boolean;
}

export function generateFingerprint(
  host: string,
  port: number | string,
  database: string,
  user: string,
  serverHostname?: string
): string {
  const str = `${host || ""}:${port || 3306}:${database || ""}:${user || ""}:${serverHostname || ""}`;
  const hash = crypto.createHash("sha256").update(str).digest("hex").toUpperCase();
  return `${hash.slice(0, 4)}-${hash.slice(4, 8)}`;
}

export function ensureStorageDirsExist() {
  const subdirs = ["config", "backups", "attachments", "documents"];
  const storageRoot = path.join(process.cwd(), "storage");
  if (!fs.existsSync(storageRoot)) {
    fs.mkdirSync(storageRoot, { recursive: true });
  }
  for (const sub of subdirs) {
    const p = path.join(storageRoot, sub);
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
    }
  }
}

export function getDatabaseConnections(): DatabaseConnection[] {
  ensureStorageDirsExist();

  if (fs.existsSync(CONNECTIONS_FILE)) {
    try {
      const raw = fs.readFileSync(CONNECTIONS_FILE, "utf8");
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    } catch (err) {
      console.error("Failed to parse database-connections.json:", err);
    }
  }

  // Fallback / Migration from legacy single database.json
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const raw = fs.readFileSync(CONFIG_FILE, "utf8");
      const config = JSON.parse(raw);
      if (config && config.host && config.database) {
        const id = config.id || "conn_1";
        const fp = generateFingerprint(config.host, config.port, config.database, config.user);
        const legacyConn: DatabaseConnection = {
          id,
          name: config.name || "Conexão Principal",
          type: config.type || "mysql",
          host: config.host,
          port: config.port ? Number(config.port) : 3306,
          database: config.database,
          user: config.user,
          encryptedPassword: config.password && config.password.includes(":") ? config.password : (config.password ? encrypt(config.password) : ""),
          ssl: !!config.ssl,
          encryptedCertificate: config.certificate ? (config.certificate.includes(":") ? config.certificate : encrypt(config.certificate)) : undefined,
          createdAt: config.configDate || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastTestAt: config.lastTest || new Date().toISOString(),
          lastTestSuccess: true,
          active: true,
          connectionFingerprint: fp
        };

        const list = [legacyConn];
        fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(list, null, 2), "utf8");
        return list;
      }
    } catch (err) {
      console.error("Failed to migrate legacy database.json:", err);
    }
  }

  return [];
}

export function saveDatabaseConnections(connections: DatabaseConnection[]) {
  ensureStorageDirsExist();
  fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(connections, null, 2), "utf8");

  // Keep active connection synchronized in database.json for legacy compatibility
  const activeConn = connections.find(c => c.active) || connections[0];
  if (activeConn) {
    const legacyPayload = {
      id: activeConn.id,
      name: activeConn.name,
      mode: "remoto",
      type: activeConn.type,
      host: activeConn.host,
      port: activeConn.port,
      database: activeConn.database,
      user: activeConn.user,
      password: activeConn.encryptedPassword,
      ssl: activeConn.ssl,
      certificate: activeConn.encryptedCertificate ? decrypt(activeConn.encryptedCertificate) : undefined,
      configDate: activeConn.createdAt,
      lastTest: activeConn.lastTestAt,
      dbVersion: "1.0.0",
      connectionFingerprint: activeConn.connectionFingerprint
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(legacyPayload, null, 2), "utf8");
  }
}

export function sanitizeConnection(conn: DatabaseConnection) {
  return {
    id: conn.id,
    name: conn.name,
    type: conn.type,
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: conn.user,
    ssl: conn.ssl,
    createdAt: conn.createdAt,
    updatedAt: conn.updatedAt,
    lastTestAt: conn.lastTestAt,
    lastTestSuccess: conn.lastTestSuccess,
    serverHostname: conn.serverHostname,
    serverVersion: conn.serverVersion,
    authenticatedUser: conn.authenticatedUser,
    connectionFingerprint: conn.connectionFingerprint,
    active: conn.active,
    hasPassword: !!conn.encryptedPassword,
    hasCertificate: !!conn.encryptedCertificate
  };
}

export function getActiveConnection(): DatabaseConnection | null {
  const connections = getDatabaseConnections();
  if (connections.length === 0) return null;
  return connections.find(c => c.active) || connections[0];
}

export function getConnectionById(id: string): DatabaseConnection | null {
  const connections = getDatabaseConnections();
  return connections.find(c => c.id === id) || null;
}

export interface DatabaseDriver {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<any>;
  testConnection(): Promise<{ success: boolean; message: string }>;
  createDatabaseAutomatically(): Promise<{ success: boolean; message: string }>;
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
  const type = config.type || "mysql";

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
  const conn = getActiveConnection();
  return !!conn;
}

export function getDatabaseConfig(): DatabaseConfig | null {
  const conn = getActiveConnection();
  if (!conn) {
    return null;
  }
  return {
    id: conn.id,
    name: conn.name,
    mode: "remoto",
    type: conn.type,
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: conn.user,
    password: conn.encryptedPassword,
    ssl: conn.ssl,
    certificate: conn.encryptedCertificate ? decrypt(conn.encryptedCertificate) : undefined,
    configDate: conn.createdAt,
    lastTest: conn.lastTestAt,
    dbVersion: "1.0.0",
    connectionFingerprint: conn.connectionFingerprint
  };
}

export function saveDatabaseConfig(config: DatabaseConfig) {
  const connections = getDatabaseConnections();
  const encryptedPassword = config.password
    ? (config.password.includes(":") ? config.password : encrypt(config.password))
    : "";
  const encryptedCertificate = config.certificate
    ? (config.certificate.includes(":") ? config.certificate : encrypt(config.certificate))
    : undefined;

  const fp = generateFingerprint(config.host, config.port, config.database, config.user);

  let activeIndex = connections.findIndex(c => c.active);
  if (activeIndex === -1 && connections.length > 0) activeIndex = 0;

  if (activeIndex !== -1) {
    connections[activeIndex] = {
      ...connections[activeIndex],
      name: config.name || connections[activeIndex].name || "Conexão Principal",
      type: config.type || "mysql",
      host: config.host,
      port: Number(config.port),
      database: config.database,
      user: config.user,
      encryptedPassword: encryptedPassword || connections[activeIndex].encryptedPassword,
      ssl: !!config.ssl,
      encryptedCertificate: encryptedCertificate || connections[activeIndex].encryptedCertificate,
      updatedAt: new Date().toISOString(),
      lastTestAt: new Date().toISOString(),
      lastTestSuccess: true,
      connectionFingerprint: fp,
      active: true
    };
  } else {
    const newConn: DatabaseConnection = {
      id: config.id || "conn_1",
      name: config.name || "Conexão Principal",
      type: config.type || "mysql",
      host: config.host,
      port: Number(config.port),
      database: config.database,
      user: config.user,
      encryptedPassword,
      ssl: !!config.ssl,
      encryptedCertificate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastTestAt: new Date().toISOString(),
      lastTestSuccess: true,
      connectionFingerprint: fp,
      active: true
    };
    connections.push(newConn);
  }

  saveDatabaseConnections(connections);

  if (pool) {
    pool.end().catch(console.error);
    pool = null;
  }
  currentConfig = null;
}


export async function testConnection(config: DatabaseConfig): Promise<{ success: boolean; message: string }> {
  const type = config.type || "mysql";
  let driver: DatabaseDriver;
  
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
  return driver.testConnection();
}

export async function createDatabaseAutomatically(config: DatabaseConfig): Promise<{ success: boolean; message: string }> {
  const type = config.type || "mysql";
  let driver: DatabaseDriver;
  
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
  return driver.createDatabaseAutomatically();
}

export async function getPool(): Promise<any> {
  const config = getDatabaseConfig();
  if (!config) {
    throw new Error("Banco de dados não configurado");
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
  console.log("[Database] executeInstallSql has been routed to the migration engine. Schema is now managed exclusively by migrations.");
  return verifyAndRepairDatabaseSchema();
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

export async function verifyAndRepairDatabaseSchema(operationId?: string): Promise<{ success: boolean; message: string }> {
  try {
    const config = getDatabaseConfig();
    if (!config) {
      return { success: false, message: "Banco de dados não configurado para auto-reparo" };
    }

    const type = config.type || "mysql";

    console.log(`[Database Migration Engine] Running migrations for ${type}...`);

    if (operationId) {
      updateStepStatus(operationId, "Localizando migrations", "running");
      updateOperation(operationId, { message: "Verificando diretório de migrações..." });
    }

    // Ensure migrations directory exists
    const migrationsDir = path.join(process.cwd(), "database", "migrations");
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    // 1. Ensure schema_migrations table exists
    let hasMigrationTable = false;
    const rows = await query("SHOW TABLES LIKE 'schema_migrations'");
    hasMigrationTable = rows && rows.length > 0;

    let isUpgradeFromOldSystem = false;
    if (!hasMigrationTable) {
      console.log("[Database Migration Engine] Creating schema_migrations table...");
      
      // Check if this is an upgrade from an existing system that has tables (e.g. admins table exists)
      let tableCheck = false;
      const rows = await query("SHOW TABLES LIKE 'admins'");
      tableCheck = rows && rows.length > 0;
      
      if (tableCheck) {
        isUpgradeFromOldSystem = true;
        console.log("[Database Migration Engine] Existing tables detected. Initial schema migration (001) will be marked as pre-applied.");
      }

      await execute(`
        CREATE TABLE schema_migrations (
          version VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }

    // 2. Read migration files
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith(".sql"))
      .sort(); // guarantees chronological execution if prefixed with numbers (e.g., 001_, 002_)

    if (migrationFiles.length === 0) {
      console.log("[Database Migration Engine] No migrations found in database/migrations/");
    }

    // 3. Retrieve already applied migrations
    const appliedRows = await query("SELECT version FROM schema_migrations");
    const appliedSet = new Set(appliedRows.map((r: any) => r.version));

    // If it's an upgrade from the old system and '001_initial_schema.sql' is present but not in schema_migrations,
    // mark it as applied so we don't drop/recreate tables and wipe their database!
    if (isUpgradeFromOldSystem) {
      const initialFile = migrationFiles.find(f => f.includes("001_initial_schema") || f.startsWith("001_"));
      if (initialFile && !appliedSet.has(initialFile)) {
        await execute("INSERT INTO schema_migrations (version) VALUES (?)", [initialFile]);
        appliedSet.add(initialFile);
        console.log(`[Database Migration Engine] Marked ${initialFile} as already applied to preserve data.`);
      }
    }

    if (operationId) {
      updateStepStatus(operationId, "Localizando migrations", "success");
    }

    // 4. Run pending migrations
    if (operationId) {
      updateStepStatus(operationId, "Aplicando migrations", "running");
    }

    // Prepare migration status array for result
    const migrationsStatus: { name: string; status: "pending" | "running" | "success" | "failed"; error?: string }[] = migrationFiles.map((file) => ({
      name: file,
      status: appliedSet.has(file) ? ("success" as const) : ("pending" as const),
    }));

    if (operationId) {
      updateOperation(operationId, {
        result: { ...(getOperation(operationId)?.result || {}), migrations: migrationsStatus },
      });
    }

    for (let i = 0; i < migrationFiles.length; i++) {
      const file = migrationFiles[i];
      if (appliedSet.has(file)) {
        console.log(`[Database Migration Engine] Migration ${file} ignored (already applied).`);
        continue;
      }

      console.log(`[Database Migration Engine] Applying migration: ${file}...`);
      
      // Update migration status to running
      migrationsStatus[i].status = "running" as const;
      if (operationId) {
        updateOperation(operationId, {
          message: `Aplicando migração ${i + 1} de ${migrationFiles.length}: ${file}`,
          result: { ...(getOperation(operationId)?.result || {}), migrations: migrationsStatus },
        });
      }

      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, "utf8");

      // Split the script into statements
      const statements = sqlContent
        .split(/;(?=(?:[^'"`]*['"`][^'"`]*['"`])*[^'"`]*$)/g) // split on semicolons outside of quotes
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      // Execute each statement inside a transaction-like sequence
      try {
        for (const statement of statements) {
          if (statement.startsWith("--") || statement.startsWith("/*")) {
            continue;
          }
          try {
            await execute(statement);
          } catch (stmtErr: any) {
            const msg = (stmtErr.message || "").toLowerCase();
            const isDuplicate = 
              msg.includes("duplicate column") || 
              msg.includes("already exists") || 
              msg.includes("duplicate key name") ||
              stmtErr.code === "ER_DUP_FIELDNAME" ||
              stmtErr.code === "ER_DUP_KEYNAME" ||
              stmtErr.code === "ER_TABLE_EXISTS_ERROR";

            const isTableMissing = 
              stmtErr.code === "ER_NO_SUCH_TABLE" || 
              msg.includes("doesn't exist") || 
              (msg.includes("table") && msg.includes("exist"));

            if (isDuplicate) {
              console.log(`[Database Migration Engine] Skipping existing column/table/index in ${file}: ${stmtErr.message}`);
            } else if (isTableMissing) {
              console.log(`[Database Migration Engine] Table missing detected in ${file}: ${stmtErr.message}`);
              let missingTableName: string | null = null;
              const alterMatch = statement.match(/ALTER\s+TABLE\s+`?([a-zA-Z0-9_]+)`?/i);
              if (alterMatch && alterMatch[1]) {
                missingTableName = alterMatch[1];
              } else {
                const tableErrMatch = stmtErr.message.match(/Table '[^']+\.([^']+)' doesn't exist/i);
                if (tableErrMatch && tableErrMatch[1]) {
                  missingTableName = tableErrMatch[1];
                }
              }

              if (missingTableName) {
                console.log(`[Database Migration Engine] Attempting auto-creation for missing table: ${missingTableName}...`);
                const createStmt = getCreateTableStatement(missingTableName);
                if (createStmt) {
                  await execute(createStmt);
                  console.log(`[Database Migration Engine] Table '${missingTableName}' created successfully.`);
                  // Retry original statement
                  await execute(statement);
                  console.log(`[Database Migration Engine] Retried statement succeeded after auto-creating table '${missingTableName}'.`);
                  continue;
                }
              }
              throw stmtErr;
            } else {
              throw stmtErr;
            }
          }
        }
        
        // Record as applied ONLY after all statements succeed
        await execute("INSERT INTO schema_migrations (version) VALUES (?)", [file]);
        console.log(`[Database Migration Engine] Migration ${file} completed successfully.`);
        
        migrationsStatus[i].status = "success" as const;
        if (operationId) {
          updateOperation(operationId, {
            result: { ...(getOperation(operationId)?.result || {}), migrations: migrationsStatus },
          });
        }
      } catch (migrationErr: any) {
        console.error(`[Database Migration Engine] Error applying migration ${file}:`, migrationErr.message);
        migrationsStatus[i].status = "failed" as const;
        migrationsStatus[i].error = migrationErr.message;
        if (operationId) {
          updateOperation(operationId, {
            result: { ...(getOperation(operationId)?.result || {}), migrations: migrationsStatus },
          });
          updateStepStatus(operationId, "Aplicando migrations", "failed", migrationErr.message);
        }
        throw new Error(`Falha na migração ${file}: ${migrationErr.message}`);
      }
    }

    if (operationId) {
      updateStepStatus(operationId, "Aplicando migrations", "success");
    }

    // 5. Ensure master seed values are present
    if (operationId) {
      updateStepStatus(operationId, "Inserindo dados iniciais", "running");
      updateOperation(operationId, { message: "Inserindo dados e tabelas padrões..." });
    }

    await ensureMasterSeedData();

    if (operationId) {
      updateStepStatus(operationId, "Inserindo dados iniciais", "success");
    }

    return { success: true, message: "Migrações do banco de dados executadas com sucesso!" };
  } catch (err: any) {
    console.error("[Database Migration Engine] Migration check failed:", err);
    if (operationId) {
      const activeStep = getOperation(operationId)?.steps?.find(s => s.status === "running")?.name;
      if (activeStep) {
        updateStepStatus(operationId, activeStep, "failed", err.message);
      }
    }
    return { success: false, message: `Falha nas migrações do banco: ${err.message}` };
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
        await execute("INSERT INTO sequences (type, `last_value`) VALUES (?, 0)", [t]);
      }
    }

    // 8. Ensure Admin Profile & Security Columns and Tables
    await ensureAdminSecurityColumnsAndTables();

    // 9. Ensure Document & Attachment Tables and Columns
    await ensureAllSchemaTablesAndColumnsExist();
  } catch (err) {
    console.error("Error seeding default database records:", err);
  }
}

// Helper function to normalize budget item types cleanly
export function normalizeBudgetItemType(type: any): string {
  if (type === null || type === undefined) return "";
  return String(type)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

async function ensureAllSchemaTablesAndColumnsExist() {
  try {
    // 1. Consolidated Attachments table columns check
    const attachmentCols = [
      { name: "description", type: "TEXT NULL" },
      { name: "category", type: "VARCHAR(50) NULL" },
      { name: "uploaded_by", type: "INT NULL" },
      { name: "file_hash", type: "VARCHAR(64) NULL" },
      { name: "thumbnail_path", type: "VARCHAR(255) NULL" },
      { name: "print_path", type: "VARCHAR(255) NULL" },
      { name: "original_width", type: "INT NULL" },
      { name: "original_height", type: "INT NULL" },
      { name: "print_width", type: "INT NULL" },
      { name: "print_height", type: "INT NULL" },
      { name: "original_size", type: "INT NULL" },
      { name: "print_size", type: "INT NULL" },
      { name: "processing_status", type: "VARCHAR(30) NULL" },
      { name: "processing_error", type: "TEXT NULL" }
    ];
    for (const col of attachmentCols) {
      try {
        const cols = await query(`SHOW COLUMNS FROM attachments LIKE '${col.name}'`);
        if (!cols || cols.length === 0) {
          await execute(`ALTER TABLE attachments ADD COLUMN ${col.name} ${col.type}`);
          console.log(`[Database Repair] Added ${col.name} column to attachments table.`);
        }
      } catch (e) {
        // ignore
      }
    }

    // 2. Service Order Document Snapshots table and column validation
    try {
      await query("SELECT 1 FROM service_order_document_snapshots LIMIT 1");
    } catch (e) {
      console.log("[Database Repair] Creating service_order_document_snapshots table...");
      await execute(`
        CREATE TABLE IF NOT EXISTS service_order_document_snapshots (
            id INT AUTO_INCREMENT PRIMARY KEY,
            service_order_id INT NOT NULL,
            document_type VARCHAR(50) NOT NULL,
            version INT NOT NULL DEFAULT 1,
            snapshot_json LONGTEXT NOT NULL,
            content_hash VARCHAR(64) NULL,
            generated_by VARCHAR(255) NULL,
            generated_by_name VARCHAR(255) NULL,
            generated_by_admin_id INT NULL,
            generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            service_order_status VARCHAR(100) NULL,
            FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE CASCADE,
            INDEX idx_doc_so_type (service_order_id, document_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log("[Database Repair] service_order_document_snapshots table created successfully.");
    }

    // Individual column checks for service_order_document_snapshots
    const snapshotCols = [
      { name: "service_order_id", type: "INT NOT NULL" },
      { name: "document_type", type: "VARCHAR(50) NOT NULL" },
      { name: "version", type: "INT NOT NULL DEFAULT 1" },
      { name: "snapshot_json", type: "LONGTEXT NOT NULL" },
      { name: "content_hash", type: "VARCHAR(64) NULL" },
      { name: "generated_by", type: "VARCHAR(255) NULL" },
      { name: "generated_by_name", type: "VARCHAR(255) NULL" },
      { name: "generated_by_admin_id", type: "INT NULL" },
      { name: "generated_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
      { name: "service_order_status", type: "VARCHAR(100) NULL" }
    ];
    for (const col of snapshotCols) {
      try {
        const cols = await query(`SHOW COLUMNS FROM service_order_document_snapshots LIKE '${col.name}'`);
        if (!cols || cols.length === 0) {
          await execute(`ALTER TABLE service_order_document_snapshots ADD COLUMN ${col.name} ${col.type}`);
          console.log(`[Database Repair] Added ${col.name} column to service_order_document_snapshots table.`);
        }
      } catch (e) {
        // ignore
      }
    }

    // 3. Warranties columns check
    const warrantyCols = [
      { name: "warranty_rule_id", type: "INT NULL" }
    ];
    for (const col of warrantyCols) {
      try {
        const cols = await query(`SHOW COLUMNS FROM warranties LIKE '${col.name}'`);
        if (!cols || cols.length === 0) {
          await execute(`ALTER TABLE warranties ADD COLUMN ${col.name} ${col.type}`);
          console.log(`[Database Repair] Added ${col.name} column to warranties table.`);
        }
      } catch (e) {
        // ignore
      }
    }

    // 4. Service Orders columns
    const soCols = [
      { name: "technical_defect", type: "TEXT NULL" },
      { name: "technical_diagnosis", type: "TEXT NULL" },
      { name: "technical_service_recommended", type: "TEXT NULL" },
      { name: "technical_parts_needed", type: "TEXT NULL" },
      { name: "technical_estimated_hours", type: "DECIMAL(5,2) NULL" },
      { name: "technical_notes", type: "TEXT NULL" },
      { name: "reception_equipment_state", type: "TEXT NULL" },
      { name: "reception_notes", type: "TEXT NULL" }
    ];
    for (const col of soCols) {
      try {
        const cols = await query(`SHOW COLUMNS FROM service_orders LIKE '${col.name}'`);
        if (!cols || cols.length === 0) {
          await execute(`ALTER TABLE service_orders ADD COLUMN ${col.name} ${col.type}`);
          console.log(`[Database Repair] Added ${col.name} column to service_orders table.`);
        }
      } catch (e) {
        // ignore
      }
    }

    // 5. System Settings PWA columns
    const sysCols = [
      { name: "pwa_name", type: "VARCHAR(255) DEFAULT NULL" },
      { name: "pwa_short_name", type: "VARCHAR(100) DEFAULT NULL" },
      { name: "pwa_description", type: "TEXT DEFAULT NULL" },
      { name: "pwa_theme_color", type: "VARCHAR(50) DEFAULT '#0e131f'" },
      { name: "pwa_background_color", type: "VARCHAR(50) DEFAULT '#ffffff'" },
      { name: "pwa_display", type: "VARCHAR(50) DEFAULT 'standalone'" },
      { name: "pwa_icon_url", type: "LONGTEXT DEFAULT NULL" }
    ];
    for (const col of sysCols) {
      try {
        const cols = await query(`SHOW COLUMNS FROM system_settings LIKE '${col.name}'`);
        if (!cols || cols.length === 0) {
          await execute(`ALTER TABLE system_settings ADD COLUMN ${col.name} ${col.type}`);
          console.log(`[Database Repair] Added ${col.name} column to system_settings table.`);
        }
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    console.error("Error in ensureAllSchemaTablesAndColumnsExist:", err);
  }
}

async function ensureAdminSecurityColumnsAndTables() {
  try {
    // 1. Columns on admins table
    const adminCols = [
      { name: "email", type: "VARCHAR(255) NULL" },
      { name: "phone", type: "VARCHAR(50) NULL" },
      { name: "active", type: "TINYINT(1) NOT NULL DEFAULT 1" },
      { name: "email_verified_at", type: "TIMESTAMP NULL" },
      { name: "password_changed_at", type: "TIMESTAMP NULL" }
    ];

    for (const col of adminCols) {
      try {
        const cols = await query(`SHOW COLUMNS FROM admins LIKE '${col.name}'`);
        if (!cols || cols.length === 0) {
          await execute(`ALTER TABLE admins ADD COLUMN ${col.name} ${col.type}`);
          console.log(`[Database Migration] Added ${col.name} column to admins table.`);
        }
      } catch (e) {
        // Ignore column addition error
      }
    }

    // Safely migrate legacy status column if present on admins table
    try {
      const statusCols = await query("SHOW COLUMNS FROM admins LIKE 'status'");
      if (statusCols && statusCols.length > 0) {
        console.log("[Database Migration] Legacy status column found on admins table. Migrating values to active...");
        await execute("UPDATE admins SET active = 1 WHERE LOWER(status) = 'active'");
        await execute("UPDATE admins SET active = 0 WHERE LOWER(status) IN ('inactive', 'disabled', '0')");
        await execute("ALTER TABLE admins DROP COLUMN status");
        console.log("[Database Migration] Successfully converted status to active and removed legacy status column from admins.");
      }
    } catch (e) {
      // Ignore migration error if status column check/drop fails
    }

    // Ensure email index on admins
    try {
      const idxs = await query("SHOW INDEX FROM admins WHERE Key_name IN ('idx_admins_email', 'uq_admins_email')");
      if (!idxs || idxs.length === 0) {
        await execute("CREATE INDEX idx_admins_email ON admins (email)");
        console.log("[Database Migration] Created idx_admins_email index on admins table.");
      }
    } catch (e) {
      // Ignore index check error
    }

    // 2. password_reset_tokens table
    try {
      await query("SELECT 1 FROM password_reset_tokens LIMIT 1");
    } catch (e) {
      console.log("[Database Migration] Creating password_reset_tokens table...");
      await execute(`
        CREATE TABLE password_reset_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            admin_id INT NOT NULL,
            token_hash VARCHAR(64) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP NULL,
            requested_ip VARCHAR(45) NULL,
            requested_user_agent TEXT NULL,
            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
            INDEX idx_prt_admin_id (admin_id),
            INDEX idx_prt_token_hash (token_hash),
            INDEX idx_prt_expires_at (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log("[Database Migration] password_reset_tokens table created.");
    }

    // 3. admin_audit_logs table
    try {
      await query("SELECT 1 FROM admin_audit_logs LIMIT 1");
    } catch (e) {
      console.log("[Database Migration] Creating admin_audit_logs table...");
      await execute(`
        CREATE TABLE admin_audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            admin_id INT NULL,
            action VARCHAR(100) NOT NULL,
            entity_type VARCHAR(100) NULL,
            entity_id VARCHAR(100) NULL,
            description TEXT NOT NULL,
            metadata JSON NULL,
            ip_address VARCHAR(45) NULL,
            user_agent TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_aal_admin_id (admin_id),
            INDEX idx_aal_action (action),
            INDEX idx_aal_entity_type (entity_type),
            INDEX idx_aal_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log("[Database Migration] admin_audit_logs table created.");
    }
  } catch (err) {
    console.error("Error in ensureAdminSecurityColumnsAndTables:", err);
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

export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
    } catch (err) {
      console.error("Error ending database pool:", err);
    }
    pool = null;
  }
  currentConfig = null;
}

export async function recreateDatabaseFromZeroInternal(operationId?: string): Promise<{ success: boolean; message: string; steps: string[] }> {
  const config = getDatabaseConfig();
  if (!config) {
    if (operationId) {
      updateStepStatus(operationId, "Validando configurações", "failed", "Banco de dados não configurado");
    }
    throw new Error("Banco de dados não configurado");
  }

  const dbName = config.database;
  if (!dbName || dbName.trim() === "") {
    if (operationId) {
      updateStepStatus(operationId, "Validando configurações", "failed", "Nome do banco de dados na configuração é inválido ou vazio.");
    }
    throw new Error("Nome do banco de dados na configuração é inválido ou vazio.");
  }

  const blocklist = ["mysql", "information_schema", "performance_schema", "sys"];
  if (blocklist.includes(dbName.toLowerCase())) {
    if (operationId) {
      updateStepStatus(operationId, "Validando configurações", "failed", "Banco de dados de sistema não permitido.");
    }
    throw new Error(`Operação não permitida: o banco de dados '${dbName}' é reservado pelo sistema.`);
  }

  if (operationId) {
    updateStepStatus(operationId, "Validando configurações", "success");
  }

  const steps: string[] = [];

  // Step 2: Verificando conexão com o MySQL
  if (operationId) {
    updateStepStatus(operationId, "Verificando conexão com o MySQL", "running");
    updateOperation(operationId, { message: "Testando a conexão com o banco MySQL..." });
  }
  try {
    const activePool = await getPool();
    const connection = await activePool.getConnection();
    connection.release();
    if (operationId) {
      updateStepStatus(operationId, "Verificando conexão com o MySQL", "success");
    }
  } catch (connErr: any) {
    if (operationId) {
      updateStepStatus(operationId, "Verificando conexão com o MySQL", "failed", connErr.message);
    }
    throw connErr;
  }

  // Step 3: Verificando permissões
  if (operationId) {
    updateStepStatus(operationId, "Verificando permissões", "running");
    updateOperation(operationId, { message: "Validando privilégios e permissões de acesso..." });
  }
  try {
    await query("SHOW GRANTS");
    if (operationId) {
      updateStepStatus(operationId, "Verificando permissões", "success");
    }
  } catch (permErr: any) {
    console.warn("Permission warning during reset:", permErr);
    if (operationId) {
      updateStepStatus(operationId, "Verificando permissões", "success"); // proceed anyway
    }
  }

  // Step 4: Preparando recriação do banco
  if (operationId) {
    updateStepStatus(operationId, "Preparando recriação do banco", "running");
    updateOperation(operationId, { message: "Fechando conexões antigas do pool de banco..." });
  }

  // Close the current pool to release locks/connections
  await closePool();
  steps.push("Pool de conexões antigo encerrado com sucesso");

  if (operationId) {
    updateStepStatus(operationId, "Preparando recriação do banco", "success");
  }

  // Get a fresh pool and connection to perform cleanup
  const activePool = await getPool();
  const connection = await activePool.getConnection();

  try {
    // Step 5: Removendo views existentes
    if (operationId) {
      updateStepStatus(operationId, "Removendo views existentes", "running");
      updateOperation(operationId, { message: "Descobrindo e removendo views..." });
    }

    // 1. Query all views in this database from information_schema
    const [viewsRows] = await connection.query(
      "SELECT table_name FROM information_schema.views WHERE table_schema = ?",
      [dbName]
    );
    const views = (viewsRows as any[]).map(r => r.TABLE_NAME || r.table_name || Object.values(r)[0]);

    // Disable foreign key checks
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    steps.push("Verificação de chaves estrangeiras desativada temporariamente");

    // Drop views
    for (const view of views) {
      const escaped = "`" + view.replace(/`/g, "``") + "`";
      await connection.query(`DROP VIEW IF EXISTS ${escaped}`);
    }
    if (views.length > 0) {
      steps.push(`Removidas ${views.length} views: ${views.join(", ")}`);
    } else {
      steps.push("Nenhuma view encontrada para remoção");
    }

    if (operationId) {
      updateStepStatus(operationId, "Removendo views existentes", "success");
    }

    // Step 6: Removendo tabelas existentes
    if (operationId) {
      updateStepStatus(operationId, "Removendo tabelas existentes", "running");
      updateOperation(operationId, { message: "Descobrindo e removendo tabelas..." });
    }

    // 2. Query all tables in this database from information_schema
    const [tablesRows] = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE'",
      [dbName]
    );
    const tables = (tablesRows as any[]).map(r => r.TABLE_NAME || r.table_name || Object.values(r)[0]);

    // Drop tables (includes schema_migrations because it's a BASE TABLE in this schema)
    for (const table of tables) {
      const escaped = "`" + table.replace(/`/g, "``") + "`";
      await connection.query(`DROP TABLE IF EXISTS ${escaped}`);
    }
    if (tables.length > 0) {
      steps.push(`Removidas ${tables.length} tabelas (incluindo histórico de migrações): ${tables.join(", ")}`);
    } else {
      steps.push("Nenhuma tabela encontrada para remoção");
    }

    if (operationId) {
      updateStepStatus(operationId, "Removendo tabelas existentes", "success");
    }

  } catch (err: any) {
    if (operationId) {
      const activeStep = getOperation(operationId)?.steps?.find(s => s.status === "running")?.name;
      if (activeStep) {
        updateStepStatus(operationId, activeStep, "failed", err.message);
      }
    }
    throw new Error(`Falha ao limpar tabelas e views: ${err.message}`);
  } finally {
    // Always re-enable foreign key checks
    await connection.query("SET FOREIGN_KEY_CHECKS = 1").catch(err => {
      console.error("Erro ao reativar FOREIGN_KEY_CHECKS:", err);
    });
    steps.push("Verificação de chaves estrangeiras reativada");
    connection.release();
  }

  // 7, 8, 9. Run all migrations in chronological order
  const repairResult = await verifyAndRepairDatabaseSchema(operationId);
  if (!repairResult.success) {
    throw new Error(`Falha ao executar as migrações após a limpeza: ${repairResult.message}`);
  }
  steps.push("Todas as migrações de banco de dados executadas com sucesso na ordem cronológica");

  // Step 10: Validando tabelas criadas
  if (operationId) {
    updateStepStatus(operationId, "Validando tabelas criadas", "running");
    updateOperation(operationId, { message: "Checando estrutura de tabelas criada..." });
  }
  try {
    const finalTables = await query("SHOW TABLES");
    if (finalTables.length === 0) {
      throw new Error("Nenhuma tabela encontrada após migrações.");
    }
    if (operationId) {
      updateStepStatus(operationId, "Validando tabelas criadas", "success");
    }
  } catch (valErr: any) {
    if (operationId) {
      updateStepStatus(operationId, "Validando tabelas criadas", "failed", valErr.message);
    }
    throw valErr;
  }

  // Step 11: Finalizando configuração
  if (operationId) {
    updateStepStatus(operationId, "Finalizando configuração", "running");
    updateOperation(operationId, { message: "Concluindo configurações e salvando metadados..." });
  }

  // Execute seed.sql if it exists
  const seedPath = path.join(process.cwd(), "database", "seed.sql");
  if (fs.existsSync(seedPath)) {
    try {
      const seedSql = fs.readFileSync(seedPath, "utf8");
      const seedStatements = seedSql
        .split(/;(?=(?:[^'"`]*['"`][^'"`]*['"`])*[^'"`]*$)/g)
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0);

      for (const statement of seedStatements) {
        if (statement.startsWith("--") || statement.startsWith("/*")) {
          continue;
        }
        await execute(statement);
      }
      steps.push("Seed inicial de demonstração (seed.sql) executado com sucesso");
    } catch (seedErr: any) {
      throw new Error(`Falha ao executar seed.sql: ${seedErr.message}`);
    }
  } else {
    steps.push("Seed de demonstração não encontrado, pulado");
  }

  return { success: true, message: "Banco de dados recriado com sucesso do zero!", steps };
}

export async function generateDatabaseBackup(customBackupDir?: string): Promise<{
  success: boolean;
  filename: string;
  filePath: string;
  fileSize: number;
  tableCount: number;
}> {
  const config = getDatabaseConfig();
  if (!config) {
    throw new Error("Banco de dados não configurado para realizar o backup.");
  }

  const dbName = config.database;
  if (!dbName) {
    throw new Error("Nome do banco de dados não informado na configuração.");
  }

  const backupDir = customBackupDir || path.join(process.cwd(), "storage", "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, 19);
  const filename = `pksig-backup-${timestamp}.sql`;
  const filePath = path.join(backupDir, filename);

  const activePool = await getPool();
  const connection = await activePool.getConnection();

  try {
    const [tablesRows] = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE'",
      [dbName]
    );
    const tables = (tablesRows as any[]).map((r) => r.TABLE_NAME || r.table_name || Object.values(r)[0]);

    let sqlContent = `-- ==========================================\n`;
    sqlContent += `-- PKSIG DATABASE BACKUP\n`;
    sqlContent += `-- Data/Hora: ${new Date().toLocaleString("pt-BR")}\n`;
    sqlContent += `-- Host: ${config.host || "localhost"}\n`;
    sqlContent += `-- Database: ${dbName}\n`;
    sqlContent += `-- ==========================================\n\n`;
    sqlContent += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    for (const table of tables) {
      const escapedTable = "`" + table.replace(/`/g, "``") + "`";
      sqlContent += `-- ------------------------------------------\n`;
      sqlContent += `-- Table structure and data for ${escapedTable}\n`;
      sqlContent += `-- ------------------------------------------\n`;
      sqlContent += `DROP TABLE IF EXISTS ${escapedTable};\n`;

      const [createRows] = await connection.query(`SHOW CREATE TABLE ${escapedTable}`);
      const createStmt = (createRows as any[])[0]?.["Create Table"] || (createRows as any[])[0]?.["create table"];
      if (createStmt) {
        sqlContent += `${createStmt};\n\n`;
      }

      const [rows] = await connection.query(`SELECT * FROM ${escapedTable}`);
      const dataRows = rows as any[];
      if (dataRows.length > 0) {
        const columns = Object.keys(dataRows[0]).map((col) => "`" + col.replace(/`/g, "``") + "`").join(", ");
        
        for (const row of dataRows) {
          const values = Object.values(row).map((val) => {
            if (val === null || val === undefined) return "NULL";
            if (typeof val === "number") return String(val);
            if (typeof val === "boolean") return val ? "1" : "0";
            if (val instanceof Date) {
              return `'${val.toISOString().slice(0, 19).replace("T", " ")}'`;
            }
            if (Buffer.isBuffer(val)) {
              return `X'${val.toString("hex")}'`;
            }
            const escapedStr = String(val)
              .replace(/\\/g, "\\\\")
              .replace(/'/g, "\\'")
              .replace(/\n/g, "\\n")
              .replace(/\r/g, "\\r");
            return `'${escapedStr}'`;
          }).join(", ");

          sqlContent += `INSERT INTO ${escapedTable} (${columns}) VALUES (${values});\n`;
        }
        sqlContent += `\n`;
      }
    }

    sqlContent += `SET FOREIGN_KEY_CHECKS = 1;\n`;

    fs.writeFileSync(filePath, sqlContent, "utf8");
    const stats = fs.statSync(filePath);

    console.log(`[Backup Engine] Backup generated successfully: ${filename} (${stats.size} bytes, ${tables.length} tables)`);

    return {
      success: true,
      filename,
      filePath,
      fileSize: stats.size,
      tableCount: tables.length,
    };
  } finally {
    connection.release();
  }
}

export async function addDatabaseConnection(data: {
  name: string;
  type?: "mysql" | "mariadb";
  host: string;
  port: number | string;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean;
  certificate?: string;
}): Promise<DatabaseConnection> {
  const connections = getDatabaseConnections();

  const id = "conn_" + Date.now();
  const encryptedPassword = data.password ? encrypt(data.password) : "";
  const encryptedCertificate = data.certificate ? encrypt(data.certificate) : undefined;
  const fp = generateFingerprint(data.host, data.port, data.database, data.user);

  const newConn: DatabaseConnection = {
    id,
    name: data.name || `Conexão (${data.host})`,
    type: data.type || "mysql",
    host: data.host,
    port: Number(data.port) || 3306,
    database: data.database,
    user: data.user,
    encryptedPassword,
    ssl: !!data.ssl,
    encryptedCertificate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    connectionFingerprint: fp,
    active: connections.length === 0
  };

  // Test connection
  const driver = new MySqlDriver({
    mode: "remoto",
    type: newConn.type,
    host: newConn.host,
    port: newConn.port,
    database: newConn.database,
    user: newConn.user,
    password: data.password || "",
    ssl: newConn.ssl,
    certificate: data.certificate
  });

  const testRes = await driver.testConnection();
  newConn.lastTestAt = new Date().toISOString();
  newConn.lastTestSuccess = testRes.success;

  connections.push(newConn);
  saveDatabaseConnections(connections);
  return newConn;
}

export async function updateDatabaseConnection(
  id: string,
  data: {
    name?: string;
    type?: "mysql" | "mariadb";
    host?: string;
    port?: number | string;
    database?: string;
    user?: string;
    password?: string;
    ssl?: boolean;
    certificate?: string;
  }
): Promise<DatabaseConnection> {
  const connections = getDatabaseConnections();
  const index = connections.findIndex(c => c.id === id);
  if (index === -1) {
    throw new Error(`Conexão com ID '${id}' não encontrada.`);
  }

  const existing = connections[index];
  const newPassword = data.password && data.password.trim() !== ""
    ? encrypt(data.password)
    : existing.encryptedPassword;

  const newCertificate = data.certificate !== undefined
    ? (data.certificate ? encrypt(data.certificate) : undefined)
    : existing.encryptedCertificate;

  const updated: DatabaseConnection = {
    ...existing,
    name: data.name ?? existing.name,
    type: data.type ?? existing.type,
    host: data.host ?? existing.host,
    port: data.port ? Number(data.port) : existing.port,
    database: data.database ?? existing.database,
    user: data.user ?? existing.user,
    encryptedPassword: newPassword,
    ssl: data.ssl !== undefined ? !!data.ssl : existing.ssl,
    encryptedCertificate: newCertificate,
    updatedAt: new Date().toISOString()
  };

  updated.connectionFingerprint = generateFingerprint(updated.host, updated.port, updated.database, updated.user);

  // Test connection
  const plainPassword = data.password && data.password.trim() !== ""
    ? data.password
    : (existing.encryptedPassword ? decrypt(existing.encryptedPassword) : "");
  
  const plainCert = newCertificate ? decrypt(newCertificate) : undefined;

  const driver = new MySqlDriver({
    mode: "remoto",
    type: updated.type,
    host: updated.host,
    port: updated.port,
    database: updated.database,
    user: updated.user,
    password: plainPassword,
    ssl: updated.ssl,
    certificate: plainCert
  });

  const testRes = await driver.testConnection();
  updated.lastTestAt = new Date().toISOString();
  updated.lastTestSuccess = testRes.success;

  connections[index] = updated;
  saveDatabaseConnections(connections);

  if (updated.active) {
    if (pool) {
      await pool.end().catch(console.error);
      pool = null;
    }
  }

  return updated;
}

export function deleteDatabaseConnection(id: string): { success: boolean; message: string } {
  const connections = getDatabaseConnections();
  const target = connections.find(c => c.id === id);
  if (!target) {
    throw new Error(`Conexão com ID '${id}' não encontrada.`);
  }

  if (target.active) {
    throw new Error("Não é possível remover a conexão ativa. Ative outra conexão antes de remover esta.");
  }

  if (connections.length <= 1) {
    throw new Error("Não é possível remover a única conexão cadastrada.");
  }

  const updatedList = connections.filter(c => c.id !== id);
  saveDatabaseConnections(updatedList);
  return { success: true, message: `Cadastro da conexão '${target.name}' removido com sucesso.` };
}

export async function setActiveConnection(id: string): Promise<{ success: boolean; message: string; connection: any }> {
  const connections = getDatabaseConnections();
  const target = connections.find(c => c.id === id);
  if (!target) {
    throw new Error(`Conexão com ID '${id}' não encontrada.`);
  }

  if (target.active && pool) {
    return { success: true, message: `Conexão '${target.name}' já é a conexão ativa.`, connection: sanitizeConnection(target) };
  }

  // 1. Test target connection with temporary pool
  const plainPassword = target.encryptedPassword ? decrypt(target.encryptedPassword) : "";
  const plainCert = target.encryptedCertificate ? decrypt(target.encryptedCertificate) : undefined;

  let tempPool: mysql.Pool | null = null;
  let identity: any = null;

  try {
    tempPool = mysql.createPool({
      host: target.host,
      port: target.port,
      user: target.user,
      password: plainPassword,
      database: target.database,
      ssl: target.ssl ? (plainCert ? { ca: plainCert } : { rejectUnauthorized: false }) : undefined,
      connectTimeout: 8000
    });

    const [rows] = await tempPool.query(`
      SELECT 
        DATABASE() AS database_name,
        @@hostname AS server_hostname,
        @@port AS server_port,
        @@version AS server_version,
        @@version_comment AS server_type,
        CURRENT_USER() AS authenticated_user,
        CONNECTION_ID() AS connection_id
    `);

    identity = (rows as any[])[0];
  } catch (testErr: any) {
    if (tempPool) await tempPool.end().catch(console.error);
    throw new Error(`Falha ao testar conexão '${target.name}': ${testErr.message || "Não foi possível conectar ao servidor MySQL."}`);
  } finally {
    if (tempPool) await tempPool.end().catch(console.error);
  }

  const previousActiveId = connections.find(c => c.active)?.id;

  try {
    // 2. Close existing pool
    await closePool();

    // 3. Mark target connection as active
    const newConnections = connections.map(c => ({
      ...c,
      active: c.id === id,
      serverHostname: c.id === id ? identity?.server_hostname : c.serverHostname,
      serverVersion: c.id === id ? identity?.server_version : c.serverVersion,
      authenticatedUser: c.id === id ? identity?.authenticated_user : c.authenticatedUser,
      lastTestAt: c.id === id ? new Date().toISOString() : c.lastTestAt,
      lastTestSuccess: c.id === id ? true : c.lastTestSuccess
    }));

    saveDatabaseConnections(newConnections);

    // 4. Initialize official pool
    const newPool = await getPool();
    const conn = await newPool.getConnection();
    const [confirmRows] = await conn.query("SELECT DATABASE() AS db");
    conn.release();

    const activeDbName = (confirmRows as any[])[0]?.db;
    const activatedConnection = newConnections.find(c => c.id === id)!;

    return {
      success: true,
      message: `Conexão '${activatedConnection.name}' (Banco: ${activeDbName}) ativada com sucesso!`,
      connection: sanitizeConnection(activatedConnection)
    };
  } catch (err: any) {
    console.error("Failed to activate connection, performing rollback:", err);
    if (previousActiveId) {
      const rollbackConns = connections.map(c => ({
        ...c,
        active: c.id === previousActiveId
      }));
      saveDatabaseConnections(rollbackConns);
      await getPool().catch(console.error);
    }
    throw new Error(`Erro ao ativar a conexão: ${err.message}. A conexão anterior foi restaurada.`);
  }
}

export async function getDatabaseDiagnosticInfo(): Promise<any> {
  const activeConn = getActiveConnection();
  if (!activeConn) {
    return {
      savedConfig: null,
      liveConnection: { status: "Desconectado", error: "Nenhuma conexão cadastrada" },
      recordCounts: {},
      mismatches: []
    };
  }

  const savedConfig = sanitizeConnection(activeConn);
  let liveConnection: any = null;
  let recordCounts: any = {};
  const mismatches: string[] = [];

  try {
    const activePool = await getPool();

    const [identityRows] = await activePool.query(`
      SELECT 
        DATABASE() AS databaseName,
        @@hostname AS serverHostname,
        @@port AS serverPort,
        @@version AS serverVersion,
        @@version_comment AS serverType,
        CURRENT_USER() AS authenticatedUser,
        USER() AS connectionUser,
        CONNECTION_ID() AS connectionId
    `);

    const idData = (identityRows as any[])[0] || {};

    let sslActive = false;
    try {
      const [sslRows] = await activePool.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
      if (sslRows && (sslRows as any[]).length > 0) {
        const cipherVal = (sslRows as any[])[0].Value;
        if (cipherVal && cipherVal.trim() !== "") {
          sslActive = true;
        }
      }
    } catch (e) {
      // ignore
    }

    let probableOrigin = "Servidor Remoto";
    const hostLower = (activeConn.host || "").toLowerCase();
    if (hostLower === "localhost" || hostLower === "127.0.0.1" || hostLower === "::1") {
      probableOrigin = "Servidor Local (Loopback)";
    } else if (hostLower.startsWith("192.168.") || hostLower.startsWith("10.") || hostLower.startsWith("172.")) {
      probableOrigin = "Rede Local (LAN)";
    }

    const liveFp = generateFingerprint(
      activeConn.host,
      activeConn.port,
      idData.databaseName || activeConn.database,
      activeConn.user,
      idData.serverHostname
    );

    liveConnection = {
      status: "Conectado",
      databaseName: idData.databaseName,
      serverHostname: idData.serverHostname,
      serverPort: idData.serverPort,
      serverVersion: idData.serverVersion,
      serverType: idData.serverType,
      authenticatedUser: idData.authenticatedUser,
      connectionUser: idData.connectionUser,
      connectionId: idData.connectionId,
      sslActive,
      probableOrigin,
      connectionHash: liveFp,
      lastCheckedAt: new Date().toLocaleString("pt-BR")
    };

    if (idData.databaseName && idData.databaseName.toLowerCase() !== activeConn.database.toLowerCase()) {
      mismatches.push(`O banco selecionado no servidor (${idData.databaseName}) é diferente do banco cadastrado na configuração (${activeConn.database}).`);
    }

    try {
      const [[{ cnt: adminCount }]] = await activePool.query("SELECT COUNT(*) AS cnt FROM admins");
      const [[{ cnt: clientCount }]] = await activePool.query("SELECT COUNT(*) AS cnt FROM clients");
      const [[{ cnt: equipCount }]] = await activePool.query("SELECT COUNT(*) AS cnt FROM equipment");
      const [[{ cnt: soCount }]] = await activePool.query("SELECT COUNT(*) AS cnt FROM service_orders");
      const [[{ cnt: paymentCount }]] = await activePool.query("SELECT COUNT(*) AS cnt FROM payment_guides");
      const [[{ cnt: warrantyCount }]] = await activePool.query("SELECT COUNT(*) AS cnt FROM warranties");

      let latestClientAt = null;
      let latestServiceOrderAt = null;

      const [latestClientRows] = await activePool.query("SELECT created_at FROM clients ORDER BY id DESC LIMIT 1");
      if (latestClientRows && (latestClientRows as any[]).length > 0) {
        latestClientAt = (latestClientRows as any[])[0].created_at;
      }

      const [latestSoRows] = await activePool.query("SELECT created_at FROM service_orders ORDER BY id DESC LIMIT 1");
      if (latestSoRows && (latestSoRows as any[]).length > 0) {
        latestServiceOrderAt = (latestSoRows as any[])[0].created_at;
      }

      recordCounts = {
        admins: adminCount,
        clients: clientCount,
        equipment: equipCount,
        serviceOrders: soCount,
        payments: paymentCount,
        warranties: warrantyCount,
        latestClientAt,
        latestServiceOrderAt
      };
    } catch (cntErr: any) {
      console.warn("Could not query record counts:", cntErr.message);
    }

  } catch (err: any) {
    liveConnection = {
      status: "Erro na Conexão",
      error: err.message || "Não foi possível comunicar com o servidor de banco de dados",
      lastCheckedAt: new Date().toLocaleString("pt-BR")
    };
  }

  return {
    savedConfig,
    liveConnection,
    recordCounts,
    mismatches,
    connectionFingerprint: liveConnection?.connectionHash || savedConfig?.connectionFingerprint
  };
}

export async function exportFullDatabaseBackupForConnection(
  connectionId: string
): Promise<{
  success: boolean;
  filename: string;
  filePath: string;
  fileSize: number;
  tableCount: number;
  connectionName: string;
}> {
  const conn = getConnectionById(connectionId);
  if (!conn) {
    throw new Error(`Conexão com ID '${connectionId}' não encontrada.`);
  }

  const plainPassword = conn.encryptedPassword ? decrypt(conn.encryptedPassword) : "";
  const plainCert = conn.encryptedCertificate ? decrypt(conn.encryptedCertificate) : undefined;

  let tempPool: mysql.Pool | null = null;

  try {
    tempPool = mysql.createPool({
      host: conn.host,
      port: conn.port,
      user: conn.user,
      password: plainPassword,
      database: conn.database,
      ssl: conn.ssl ? (plainCert ? { ca: plainCert } : { rejectUnauthorized: false }) : undefined,
      connectTimeout: 10000
    });

    const connection = await tempPool.getConnection();

    try {
      const [tablesRows] = await connection.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE'",
        [conn.database]
      );
      const tables = (tablesRows as any[]).map((r) => r.TABLE_NAME || r.table_name || Object.values(r)[0]);

      const backupDir = path.join(process.cwd(), "storage", "backups");
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const safeName = conn.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, 19);
      const filename = `pksig-banco-${safeName}-${timestamp}.sql`;
      const filePath = path.join(backupDir, filename);

      let sqlContent = `-- ==========================================\n`;
      sqlContent += `-- PKSIG BACKUP COMPLETO DE BANCO DE DADOS\n`;
      sqlContent += `-- Conexão: ${conn.name} (${conn.id})\n`;
      sqlContent += `-- Host: ${conn.host}:${conn.port}\n`;
      sqlContent += `-- Banco de Dados: ${conn.database}\n`;
      sqlContent += `-- Fingerprint: ${conn.connectionFingerprint || generateFingerprint(conn.host, conn.port, conn.database, conn.user)}\n`;
      sqlContent += `-- Gerado em: ${new Date().toLocaleString("pt-BR")}\n`;
      sqlContent += `-- ==========================================\n\n`;
      sqlContent += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

      for (const table of tables) {
        const escapedTable = "`" + table.replace(/`/g, "``") + "`";
        sqlContent += `-- Structure and Data for ${escapedTable}\n`;
        sqlContent += `DROP TABLE IF EXISTS ${escapedTable};\n`;

        const [createRows] = await connection.query(`SHOW CREATE TABLE ${escapedTable}`);
        const createStmt = (createRows as any[])[0]?.["Create Table"] || (createRows as any[])[0]?.["create table"];
        if (createStmt) {
          sqlContent += `${createStmt};\n\n`;
        }

        const [rows] = await connection.query(`SELECT * FROM ${escapedTable}`);
        const dataRows = rows as any[];
        if (dataRows.length > 0) {
          const columns = Object.keys(dataRows[0]).map((col) => "`" + col.replace(/`/g, "``") + "`").join(", ");
          
          for (const row of dataRows) {
            const values = Object.values(row).map((val) => {
              if (val === null || val === undefined) return "NULL";
              if (typeof val === "number") return String(val);
              if (typeof val === "boolean") return val ? "1" : "0";
              if (val instanceof Date) {
                return `'${val.toISOString().slice(0, 19).replace("T", " ")}'`;
              }
              if (Buffer.isBuffer(val)) {
                return `X'${val.toString("hex")}'`;
              }
              const escapedStr = String(val)
                .replace(/\\/g, "\\\\")
                .replace(/'/g, "\\'")
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r");
              return `'${escapedStr}'`;
            }).join(", ");

            sqlContent += `INSERT INTO ${escapedTable} (${columns}) VALUES (${values});\n`;
          }
          sqlContent += `\n`;
        }
      }

      sqlContent += `SET FOREIGN_KEY_CHECKS = 1;\n`;

      fs.writeFileSync(filePath, sqlContent, "utf8");
      const stats = fs.statSync(filePath);

      return {
        success: true,
        filename,
        filePath,
        fileSize: stats.size,
        tableCount: tables.length,
        connectionName: conn.name
      };
    } finally {
      connection.release();
    }
  } finally {
    if (tempPool) await tempPool.end().catch(console.error);
  }
}

export async function transferDataBetweenConnections(params: {
  originConnectionId: string;
  targetConnectionId: string;
  transferMode: "copy_empty" | "merge";
  confirmationText: string;
}): Promise<{
  success: boolean;
  message: string;
  report: {
    originConnectionName: string;
    targetConnectionName: string;
    backupFilename: string;
    transferredTables: string[];
    recordCountsBefore: any;
    recordCountsAfter: any;
  };
}> {
  const { originConnectionId, targetConnectionId, transferMode, confirmationText } = params;

  if (confirmationText !== "COPIAR DADOS") {
    throw new Error("Texto de confirmação incorreto. Você deve digitar 'COPIAR DADOS'.");
  }

  if (originConnectionId === targetConnectionId) {
    throw new Error("A conexão de origem e de destino devem ser diferentes.");
  }

  if (transferMode === "merge") {
    throw new Error("Modo 'Mesclar dados' está em desenvolvimento. Utilize a opção 'Copiar para banco vazio'.");
  }

  const originConn = getConnectionById(originConnectionId);
  const targetConn = getConnectionById(targetConnectionId);

  if (!originConn || !targetConn) {
    throw new Error("Conexão de origem ou destino não encontrada.");
  }

  const originFp = originConn.connectionFingerprint || generateFingerprint(originConn.host, originConn.port, originConn.database, originConn.user);
  const targetFp = targetConn.connectionFingerprint || generateFingerprint(targetConn.host, targetConn.port, targetConn.database, targetConn.user);

  if (originFp === targetFp) {
    throw new Error("A conexão de origem e a conexão de destino possuem o mesmo fingerprint e referem-se ao mesmo banco de dados.");
  }

  const backupRes = await exportFullDatabaseBackupForConnection(targetConnectionId);

  const plainOriginPass = originConn.encryptedPassword ? decrypt(originConn.encryptedPassword) : "";
  const plainOriginCert = originConn.encryptedCertificate ? decrypt(originConn.encryptedCertificate) : undefined;

  const plainTargetPass = targetConn.encryptedPassword ? decrypt(targetConn.encryptedPassword) : "";
  const plainTargetCert = targetConn.encryptedCertificate ? decrypt(targetConn.encryptedCertificate) : undefined;

  const originPool = mysql.createPool({
    host: originConn.host,
    port: originConn.port,
    user: originConn.user,
    password: plainOriginPass,
    database: originConn.database,
    ssl: originConn.ssl ? (plainOriginCert ? { ca: plainOriginCert } : { rejectUnauthorized: false }) : undefined,
    connectTimeout: 10000
  });

  const targetPool = mysql.createPool({
    host: targetConn.host,
    port: targetConn.port,
    user: targetConn.user,
    password: plainTargetPass,
    database: targetConn.database,
    ssl: targetConn.ssl ? (plainTargetCert ? { ca: plainTargetCert } : { rejectUnauthorized: false }) : undefined,
    connectTimeout: 10000
  });

  const tablesInOrder = [
    "schema_migrations",
    "company_settings",
    "system_settings",
    "equipment_categories",
    "reception_accessories",
    "service_order_statuses",
    "payment_methods",
    "financial_categories",
    "sequences",
    "admins",
    "clients",
    "equipment",
    "service_orders",
    "budgets",
    "budget_items",
    "payment_guides",
    "financial_records",
    "warranty_rules",
    "warranties",
    "attachments",
    "service_order_document_snapshots",
    "idempotency_keys",
    "admin_audit_logs",
    "app_meta"
  ];

  const transferredTables: string[] = [];
  let recordCountsBefore: any = {};
  let recordCountsAfter: any = {};

  try {
    const originClient = await originPool.getConnection();
    const targetClient = await targetPool.getConnection();

    try {
      const [resClients] = await originClient.query("SELECT COUNT(*) AS cnt FROM clients").catch(() => [[{ cnt: 0 }]]);
      const origClients = (resClients as any[])?.[0]?.cnt || 0;

      const [resEq] = await originClient.query("SELECT COUNT(*) AS cnt FROM equipment").catch(() => [[{ cnt: 0 }]]);
      const origEq = (resEq as any[])?.[0]?.cnt || 0;

      const [resSO] = await originClient.query("SELECT COUNT(*) AS cnt FROM service_orders").catch(() => [[{ cnt: 0 }]]);
      const origSO = (resSO as any[])?.[0]?.cnt || 0;

      recordCountsBefore = { clients: origClients, equipment: origEq, serviceOrders: origSO };

      await targetClient.query("SET FOREIGN_KEY_CHECKS = 0");

      for (const table of tablesInOrder) {
        const [origTableCheck] = await originClient.query("SHOW TABLES LIKE ?", [table]);
        if (!origTableCheck || (origTableCheck as any[]).length === 0) {
          continue;
        }

        const [targetTableCheck] = await targetClient.query("SHOW TABLES LIKE ?", [table]);
        if (!targetTableCheck || (targetTableCheck as any[]).length === 0) {
          const [createStmtRows] = await originClient.query(`SHOW CREATE TABLE \`${table}\``);
          const stmt = (createStmtRows as any[])[0]?.["Create Table"] || (createStmtRows as any[])[0]?.["create table"];
          if (stmt) {
            await targetClient.query(stmt);
          }
        }

        await targetClient.query(`DELETE FROM \`${table}\``);

        const [rows] = await originClient.query(`SELECT * FROM \`${table}\``);
        const dataRows = rows as any[];

        if (dataRows.length > 0) {
          const cols = Object.keys(dataRows[0]).map(c => "`" + c.replace(/`/g, "``") + "`").join(", ");
          for (const row of dataRows) {
            const placeholders = Object.keys(dataRows[0]).map(() => "?").join(", ");
            const vals = Object.values(row);
            await targetClient.query(`INSERT INTO \`${table}\` (${cols}) VALUES (${placeholders})`, vals);
          }
        }

        transferredTables.push(table);
      }

      await targetClient.query("SET FOREIGN_KEY_CHECKS = 1");

      const [resTargClients] = await targetClient.query("SELECT COUNT(*) AS cnt FROM clients").catch(() => [[{ cnt: 0 }]]);
      const targClients = (resTargClients as any[])?.[0]?.cnt || 0;

      const [resTargEq] = await targetClient.query("SELECT COUNT(*) AS cnt FROM equipment").catch(() => [[{ cnt: 0 }]]);
      const targEq = (resTargEq as any[])?.[0]?.cnt || 0;

      const [resTargSO] = await targetClient.query("SELECT COUNT(*) AS cnt FROM service_orders").catch(() => [[{ cnt: 0 }]]);
      const targSO = (resTargSO as any[])?.[0]?.cnt || 0;

      recordCountsAfter = { clients: targClients, equipment: targEq, serviceOrders: targSO };

    } finally {
      originClient.release();
      targetClient.release();
    }
  } finally {
    await originPool.end().catch(console.error);
    await targetPool.end().catch(console.error);
  }

  return {
    success: true,
    message: `Dados transferidos com sucesso da conexão '${originConn.name}' para '${targetConn.name}'.`,
    report: {
      originConnectionName: originConn.name,
      targetConnectionName: targetConn.name,
      backupFilename: backupRes.filename,
      transferredTables,
      recordCountsBefore,
      recordCountsAfter
    }
  };
}

export async function exportSystemConfigurationsJson(): Promise<any> {
  const company = await query("SELECT * FROM company_settings WHERE id = 1").catch(() => []);
  const system = await query("SELECT * FROM system_settings WHERE id = 1").catch(() => []);
  const categories = await query("SELECT * FROM equipment_categories").catch(() => []);
  const accessories = await query("SELECT * FROM reception_accessories").catch(() => []);
  const statuses = await query("SELECT * FROM service_order_statuses").catch(() => []);
  const paymentMethods = await query("SELECT * FROM payment_methods").catch(() => []);
  const financialCategories = await query("SELECT * FROM financial_categories").catch(() => []);
  const warrantyRules = await query("SELECT * FROM warranty_rules").catch(() => []);

  return {
    exportType: "system_configurations_only",
    exportedAt: new Date().toISOString(),
    notice: "Esta exportação inclui apenas parâmetros de configuração do sistema (empresa, categorias, formas de pagamento, regras de garantia). NÃO inclui clientes, equipamentos, ordens de serviço, pagamentos, garantias emitidas, auditoria ou anexos.",
    companySettings: company[0] || null,
    systemSettings: system[0] || null,
    equipmentCategories: categories,
    receptionAccessories: accessories,
    serviceOrderStatuses: statuses,
    paymentMethods: paymentMethods,
    financialCategories: financialCategories,
    warrantyRules: warrantyRules
  };
}


