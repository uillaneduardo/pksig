import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { encrypt, decrypt } from "./crypto.js";

const CONFIG_FILE = path.join(process.cwd(), "storage", "config", "database.json");
let pool: mysql.Pool | null = null;
let currentConfig: any = null;

export interface DatabaseConfig {
  mode: "local" | "remoto";
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

  // Reset current pool so next query recreates it
  if (pool) {
    pool.end().catch(console.error);
    pool = null;
  }
  currentConfig = null;
}

export async function testConnection(config: DatabaseConfig): Promise<{ success: boolean; message: string }> {
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
    const connection = await tempPool.getConnection();
    connection.release();
    return { success: true, message: "Conexão estabelecida com sucesso!" };
  } catch (err: any) {
    console.error("Test connection failed:", err);
    let msg = err.message || "Erro desconhecido ao conectar";
    if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") {
      msg = "Servidor não encontrado (DNS/IP inválido)";
    } else if (err.code === "ECONNREFUSED") {
      msg = `Conexão recusada na porta ${config.port}`;
    } else if (err.code === "ER_ACCESS_DENIED_ERROR") {
      msg = "Acesso negado: Usuário ou senha incorretos";
    } else if (err.code === "ER_BAD_DB_ERROR") {
      msg = `O banco de dados "${config.database}" não existe no servidor`;
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

export async function createDatabaseAutomatically(config: DatabaseConfig): Promise<{ success: boolean; message: string }> {
  let tempPool: mysql.Pool | null = null;
  try {
    const connectionOptions: mysql.PoolOptions = {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password && config.password.includes(":") ? decrypt(config.password) : config.password,
      connectTimeout: 8000,
      ssl: config.ssl ? (config.certificate ? { ca: config.certificate } : { rejectUnauthorized: false }) : undefined,
    };

    tempPool = mysql.createPool(connectionOptions);
    await tempPool.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    return { success: true, message: `Banco de dados "${config.database}" criado com sucesso!` };
  } catch (err: any) {
    console.error("Failed to create database:", err);
    return { success: false, message: `Falha ao criar banco: ${err.message || "Erro de permissão"}` };
  } finally {
    if (tempPool) {
      await tempPool.end().catch(console.error);
    }
  }
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
    const activePool = await getPool();

    // Split SQL by semicolons, taking care not to break functions or triggers (which we don't have, making it simpler)
    // We clean up comments and split carefully
    const statements = rawSql
      .split(/;(?=(?:[^'"`]*['"`][^'"`]*['"`])*[^'"`]*$)/g) // split on semicolons outside of quotes
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    const connection = await activePool.getConnection();
    try {
      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
      for (const statement of statements) {
        // Skip comments or blank lines
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
  const activePool = await getPool();
  const [rows] = await activePool.query(sql, params);
  return rows as T[];
}

export async function execute(sql: string, params?: any[]): Promise<any> {
  const activePool = await getPool();
  const [result] = await activePool.execute(sql, params);
  return result;
}
