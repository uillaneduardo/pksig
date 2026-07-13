import mysql from "mysql2/promise";
import sqlite3Pkg from "sqlite3";
import fs from "fs";
import path from "path";
import { encrypt, decrypt } from "./crypto.js";

const sqlite3 = (sqlite3Pkg as any).default || sqlite3Pkg;

const CONFIG_FILE = path.join(process.cwd(), "storage", "config", "database.json");
const SQLITE_DB_PATH = path.join(process.cwd(), "storage", "pksig.db");

let pool: mysql.Pool | null = null;
let sqliteDb: any | null = null;
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

  // Reset current pool/db so next query recreates it
  if (pool) {
    pool.end().catch(console.error);
    pool = null;
  }
  if (sqliteDb) {
    sqliteDb.close((err: any) => {
      if (err) console.error("Error closing SQLite database:", err);
    });
    sqliteDb = null;
  }
  currentConfig = null;
}

export function getSqliteDb(): any {
  if (sqliteDb) {
    return sqliteDb;
  }

  const dir = path.dirname(SQLITE_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  sqliteDb = new sqlite3.Database(SQLITE_DB_PATH);
  
  // Enable foreign keys
  sqliteDb.run("PRAGMA foreign_keys = ON");
  
  return sqliteDb;
}

export function translateSqlForSqlite(sql: string): string {
  // Convert basic table attributes and storage engines
  let clean = sql
    .replace(/ENGINE\s*=\s*InnoDB\s*(DEFAULT\s+CHARSET\s*=\s*[a-zA-Z0-9_]+\s*(COLLATE\s*=\s*[a-zA-Z0-9_]+)?)?/gi, "")
    .replace(/DEFAULT\s+CHARSET\s*=\s*[a-zA-Z0-9_]+\s*(COLLATE\s*=\s*[a-zA-Z0-9_]+)?/gi, "");

  // Convert auto-increment syntax
  clean = clean.replace(/(\w+)\s+INT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, "$1 INTEGER PRIMARY KEY AUTOINCREMENT");
  clean = clean.replace(/(\w+)\s+INT\s+PRIMARY\s+KEY\s+AUTO_INCREMENT/gi, "$1 INTEGER PRIMARY KEY AUTOINCREMENT");
  clean = clean.replace(/(\w+)\s+INTEGER\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, "$1 INTEGER PRIMARY KEY AUTOINCREMENT");
  clean = clean.replace(/AUTO_INCREMENT/gi, "AUTOINCREMENT");

  // Convert ENUM type to TEXT
  clean = clean.replace(/\bENUM\([^)]*\)/gi, "TEXT");

  // Convert TINYINT(1) to INTEGER
  clean = clean.replace(/\bTINYINT\(\d+\)/gi, "INTEGER");
  clean = clean.replace(/\bTINYINT\b/gi, "INTEGER");

  // Convert TIMESTAMP/DATETIME and ON UPDATE CURRENT_TIMESTAMP
  clean = clean.replace(/ON UPDATE CURRENT_TIMESTAMP/gi, "");
  clean = clean.replace(/\bTIMESTAMP\b/gi, "DATETIME");

  // Replace foreign key checks
  clean = clean.replace(/SET\s+FOREIGN_KEY_CHECKS\s*=\s*0/gi, "PRAGMA foreign_keys = OFF");
  clean = clean.replace(/SET\s+FOREIGN_KEY_CHECKS\s*=\s*1/gi, "PRAGMA foreign_keys = ON");

  // Handle datetime intervals in select/update queries
  clean = clean.replace(/NOW\(\)\s*-\s*INTERVAL\s*(\d+)\s*MINUTE/gi, "datetime('now', '-$1 minutes')");
  clean = clean.replace(/NOW\(\)\s*-\s*INTERVAL\s*(\d+)\s*HOUR/gi, "datetime('now', '-$1 hours')");
  clean = clean.replace(/NOW\(\)\s*-\s*INTERVAL\s*(\d+)\s*DAY/gi, "datetime('now', '-$1 days')");
  clean = clean.replace(/NOW\(\)/gi, "CURRENT_TIMESTAMP");

  // Translate ON DUPLICATE KEY UPDATE to ON CONFLICT
  if (clean.toLowerCase().includes("on duplicate key update")) {
    let tableName = "";
    const insertMatch = clean.match(/insert\s+into\s+([a-zA-Z0-9_]+)/i);
    if (insertMatch) {
      tableName = insertMatch[1].toLowerCase();
    }
    let conflictKey = "id";
    if (["equipment_categories", "payment_methods", "warranty_rules", "reception_accessories"].includes(tableName)) {
      conflictKey = "name";
    }
    clean = clean.replace(/ON DUPLICATE KEY UPDATE/i, `ON CONFLICT(${conflictKey}) DO UPDATE SET`);
  }

  // Handle inline INDEX definitions inside CREATE TABLE
  if (clean.toLowerCase().includes("create table")) {
    const lines = clean.split("\n");
    const filteredLines: string[] = [];
    const indexMatches: { table: string; indexName: string; columns: string }[] = [];
    let currentTable = "";

    for (let line of lines) {
      const trimmed = line.trim();
      const createTableMatch = line.match(/CREATE\s+TABLE\s+([a-zA-Z0-9_]+)/i);
      if (createTableMatch) {
        currentTable = createTableMatch[1];
      }

      const indexMatch = trimmed.match(/^INDEX\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\),?/i);
      if (indexMatch && currentTable) {
        indexMatches.push({
          table: currentTable,
          indexName: indexMatch[1],
          columns: indexMatch[2]
        });
        continue;
      }

      filteredLines.push(line);
    }

    let processed = filteredLines.join("\n");
    processed = processed.replace(/,\s*\n\s*\)/g, "\n)");

    for (const idx of indexMatches) {
      processed += `;\nCREATE INDEX IF NOT EXISTS ${idx.indexName} ON ${idx.table} (${idx.columns})`;
    }
    clean = processed;
  }

  return clean;
}

export function sqliteQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const db = getSqliteDb();
    const translatedSql = translateSqlForSqlite(sql);
    
    db.all(translatedSql, params, (err: any, rows: any[]) => {
      if (err) {
        console.error("SQLite query error:", err, "SQL:", translatedSql, "Params:", params);
        reject(err);
      } else {
        resolve(rows as T[]);
      }
    });
  });
}

export function sqliteExecute(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    const db = getSqliteDb();
    const translatedSql = translateSqlForSqlite(sql);
    
    db.run(translatedSql, params, function (this: any, err: any) {
      if (err) {
        console.error("SQLite execute error:", err, "SQL:", translatedSql, "Params:", params);
        reject(err);
      } else {
        resolve({
          insertId: this ? this.lastID : null,
          affectedRows: this ? this.changes : 0,
        });
      }
    });
  });
}

export async function testConnection(config: DatabaseConfig): Promise<{ success: boolean; message: string }> {
  if (config.mode === "local") {
    try {
      getSqliteDb();
      return { success: true, message: "Banco de dados SQLite (Local) iniciado com sucesso!" };
    } catch (err: any) {
      console.error("Test local SQLite connection failed:", err);
      return { success: false, message: `Erro ao iniciar SQLite: ${err.message}` };
    }
  }

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
    return { success: true, message: "Conexão estabelecida com sucesso com o MySQL!" };
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
  if (config.mode === "local") {
    return { success: true, message: "Banco de dados SQLite local pronto!" };
  }

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
    const config = getDatabaseConfig();
    const isLocal = config?.mode === "local";

    const statements = rawSql
      .split(/;(?=(?:[^'"`]*['"`][^'"`]*['"`])*[^'"`]*$)/g) // split on semicolons outside of quotes
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    if (isLocal) {
      const db = getSqliteDb();
      
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run("BEGIN TRANSACTION", (err: any) => {
            if (err) return reject(err);
          });
          
          db.run("PRAGMA foreign_keys = OFF", (err: any) => {
            if (err) return reject(err);
          });

          for (const statement of statements) {
            const trimmed = statement.trim();
            if (!trimmed || trimmed.startsWith("--") || trimmed.startsWith("/*")) {
              continue;
            }
            
            const translated = translateSqlForSqlite(statement);
            if (!translated.trim()) continue;

            const subStatements = translated.split(";").map(s => s.trim()).filter(s => s.length > 0);
            for (const subStmt of subStatements) {
              db.run(subStmt, (err: any) => {
                if (err) {
                  // Ignore error for DROP TABLE if it fails (doesn't exist)
                  if (!subStmt.toUpperCase().startsWith("DROP TABLE")) {
                    console.error("Failed to run SQLite install statement:", subStmt, "Error:", err);
                  }
                }
              });
            }
          }

          db.run("PRAGMA foreign_keys = ON", (err: any) => {
            if (err) return reject(err);
          });

          db.run("COMMIT", (err: any) => {
            if (err) {
              db.run("ROLLBACK");
              reject(err);
            } else {
              resolve();
            }
          });
        });
      });

      return { success: true, message: "Banco de dados local SQLite estruturado com sucesso!" };
    }

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
  const config = getDatabaseConfig();
  if (config?.mode === "local") {
    return sqliteQuery<T>(sql, params);
  }
  const activePool = await getPool();
  const [rows] = await activePool.query(sql, params);
  return rows as T[];
}

export async function execute(sql: string, params?: any[]): Promise<any> {
  const config = getDatabaseConfig();
  if (config?.mode === "local") {
    return sqliteExecute(sql, params);
  }
  const activePool = await getPool();
  const [result] = await activePool.execute(sql, params);
  return result;
}
