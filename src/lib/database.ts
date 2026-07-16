import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { encrypt, decrypt } from "./crypto.js";

const CONFIG_FILE = path.join(process.cwd(), "storage", "config", "database.json");

let pool: mysql.Pool | null = null;
let currentConfig: any = null;

export interface DatabaseConfig {
  mode: "remoto";
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

export async function getPool(): Promise<mysql.Pool> {
  if (pool) {
    return pool;
  }

  const config = getDatabaseConfig();
  if (!config) {
    throw new Error("Banco de dados não configurado");
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
