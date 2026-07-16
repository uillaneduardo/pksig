import express from "express";
import { z } from "zod";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import multer from "multer";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { 
  isDatabaseConfigured, 
  getDatabaseConfig, 
  saveDatabaseConfig, 
  testConnection, 
  createDatabaseAutomatically, 
  executeInstallSql, 
  query, 
  execute,
  getPool,
  verifyDatabaseCompatibility,
  runInTransaction,
  verifyAndRepairDatabaseSchema
} from "./src/lib/database.js";
import { 
  createSession, 
  getSession, 
  destroySession, 
  cleanExpiredSessions,
  destroyAllUserSessions
} from "./src/lib/session.js";

// ==========================================
// Zod Input Validation Schemas & Middleware
// ==========================================

function validateBody(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errorMsg = result.error.issues.map(err => `${err.path.join(".")}: ${err.message}`).join(", ");
      return res.status(400).json({ error: `Falha na validação: ${errorMsg}` });
    }
    req.body = result.data;
    next();
  };
}

const loginSchema = z.object({
  username: z.string().min(3, "Usuário deve conter pelo menos 3 caracteres"),
  password: z.string().min(4, "Senha deve conter pelo menos 4 caracteres")
});

const setupInstallSchema = z.object({
  connection: z.object({
    mode: z.enum(["local", "remoto"]),
    type: z.enum(["sqlite", "mysql", "mariadb", "postgresql", "sqlserver"]).optional(),
    host: z.string().optional().nullable().or(z.literal("")),
    port: z.string().optional().nullable().or(z.literal("")),
    database: z.string().min(1, "Nome do banco de dados é obrigatório"),
    user: z.string().optional().nullable().or(z.literal("")),
    password: z.string().optional().nullable().or(z.literal("")),
    ssl: z.boolean().optional()
  }),
  admin: z.object({
    name: z.string().min(2, "Nome do administrador deve ter pelo menos 2 caracteres"),
    username: z.string().min(3, "Username deve ter pelo menos 3 caracteres"),
    password: z.string().min(4, "Senha do administrador deve ter pelo menos 4 caracteres")
  }),
  company: z.object({
    name: z.string().optional().nullable().or(z.literal("")),
    tradeName: z.string().optional().nullable().or(z.literal("")),
    taxId: z.string().optional().nullable().or(z.literal("")),
    phone: z.string().optional().nullable().or(z.literal("")),
    whatsapp: z.string().optional().nullable().or(z.literal("")),
    email: z.string().optional().nullable().or(z.literal("")),
    address: z.string().optional().nullable().or(z.literal("")),
    notes: z.string().optional().nullable().or(z.literal(""))
  }).optional(),
  useExistingDb: z.boolean().optional()
});

const clientSchema = z.object({
  type: z.enum(["PF", "PJ"]),
  name: z.string().min(2, "Nome é obrigatório e deve ter pelo menos 2 caracteres"),
  cpf_cnpj: z.string().min(11, "CPF/CNPJ é obrigatório e deve ter pelo menos 11 caracteres"),
  rg_ie: z.string().optional().nullable(),
  responsible: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  zip_code: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

const equipmentSchema = z.object({
  client_id: z.union([z.number(), z.string().transform(v => parseInt(v))]),
  category_id: z.union([z.number(), z.string().transform(v => parseInt(v))]),
  brand: z.string().min(1, "Marca é obrigatória"),
  model: z.string().min(1, "Modelo é obrigatório"),
  serial_number: z.string().optional().nullable(),
  imei: z.string().optional().nullable(),
  asset_tag: z.string().optional().nullable(),
  responsible: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.string().optional().nullable()
});

const app = express();
const PORT = 3000;

app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Central cookie generator options helper
export function getCookieOptions(req: any) {
  const isProd = process.env.NODE_ENV === "production" || 
                 req.secure || 
                 req.headers["x-forwarded-proto"] === "https" ||
                 (req.headers.host && req.headers.host.includes("run.app"));
                 
  return {
    httpOnly: true,
    path: "/",
    secure: isProd,
    sameSite: isProd ? "none" : "lax" as const,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  };
}

// Check if system is already installed (has database config and has admin user)
export async function isSystemInstalled(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const admins = await query("SELECT id FROM admins LIMIT 1");
    return admins && admins.length > 0;
  } catch (err) {
    return false;
  }
}

// Setup protection middleware
async function checkSetupProtection(req: any, res: any, next: any) {
  const installed = await isSystemInstalled();
  if (installed) {
    if (req.path === "/api/setup/install" || req.path === "/install") {
      return res.status(403).json({ error: "Instalação bloqueada: o sistema já possui um administrador configurado." });
    }
    // Check if user is authenticated for other setup routes
    const token = req.cookies.session_token;
    if (!token) {
      return res.status(403).json({ error: "Acesso negado: o sistema já está configurado. Requer autenticação." });
    }
    const session = await getSession(token);
    if (!session) {
      return res.status(403).json({ error: "Acesso negado: sessão inválida." });
    }
    req.session = session;
  }
  next();
}

// Ensure Idempotency table exists for PWA offline requests
async function ensureIdempotencyTable() {
  try {
    if (!isDatabaseConfigured()) return;
    const dbConfig = getDatabaseConfig();
    const isMysql = dbConfig?.mode === "remoto";

    try {
      await query("SELECT 1 FROM idempotency_keys LIMIT 1");
    } catch (e) {
      console.log("Creating idempotency_keys table for offline sync protection...");
      if (isMysql) {
        await execute(`
          CREATE TABLE idempotency_keys (
            \`key\` VARCHAR(100) PRIMARY KEY,
            \`response_body\` LONGTEXT NOT NULL,
            \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
      } else {
        await execute(`
          CREATE TABLE idempotency_keys (
            \`key\` TEXT PRIMARY KEY,
            \`response_body\` TEXT NOT NULL,
            \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }
      console.log("idempotency_keys table created successfully.");
    }
  } catch (err) {
    console.error("Error ensuring idempotency_keys table:", err);
  }
}

// Idempotency Middleware for replaying offline sync submissions safely
async function idempotencyMiddleware(req: any, res: any, next: any) {
  const key = req.headers["x-idempotency-key"] || req.query.idempotency_key;
  if (!key) {
    return next();
  }

  try {
    await ensureIdempotencyTable();
    const records = await query("SELECT response_body FROM idempotency_keys WHERE `key` = ?", [key]);
    if (records && records.length > 0) {
      console.log(`[Idempotency] Replaying cached response for key: ${key}`);
      try {
        const parsed = JSON.parse(records[0].response_body);
        return res.json(parsed);
      } catch (err) {
        return res.send(records[0].response_body);
      }
    }

    // Capture the JSON response to cache it
    const originalJson = res.json;
    res.json = function (body: any) {
      res.json = originalJson;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        execute(
          "INSERT INTO idempotency_keys (`key`, `response_body`) VALUES (?, ?)",
          [key, JSON.stringify(body)]
        ).catch((err) => console.error("Failed to store idempotency response:", err));
      }
      return originalJson.call(this, body);
    };

    next();
  } catch (err) {
    console.error("Idempotency middleware error:", err);
    next();
  }
}

// Increase JSON payload limit to support base64 attachments
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(idempotencyMiddleware);

// Custom simple cookie parser middleware
app.use((req: any, res: any, next) => {
  const cookieHeader = req.headers.cookie || "";
  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((cookie: string) => {
    const parts = cookie.split("=");
    if (parts.length === 2) {
      cookies[parts[0].trim()] = parts[1].trim();
    }
  });
  req.cookies = cookies;
  next();
});

// CSRF dynamic token generator
export function generateCsrfToken(sessionToken: string): string {
  return crypto.createHmac("sha256", "pksig-csrf-secret-key-1337").update(sessionToken).digest("hex");
}

// CSRF Verification Middleware
async function verifyCsrf(req: any, res: any, next: any) {
  // GET, HEAD, OPTIONS do not require CSRF token
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const token = req.cookies.session_token;
  if (!token) {
    // If no session token, it's either an anonymous request (like login or initial setup), which are handled separately
    return next();
  }

  const session = await getSession(token);
  if (!session) {
    // Session is invalid or expired, let it pass so authentication middleware can handle it
    return next();
  }

  const expectedCsrfToken = generateCsrfToken(token);
  const receivedCsrfToken = req.headers["x-csrf-token"];

  if (!receivedCsrfToken || receivedCsrfToken !== expectedCsrfToken) {
    return res.status(403).json({ error: "Falha na validação de segurança: Token CSRF inválido ou ausente." });
  }

  next();
}

app.use("/api", verifyCsrf);

// Authentication middleware
async function requireAuth(req: any, res: any, next: any) {
  const token = req.cookies.session_token;
  if (!token) {
    return res.status(401).json({ error: "Sessão expirada ou não autenticada" });
  }

  const session = await getSession(token);
  if (!session) {
    res.clearCookie("session_token", getCookieOptions(req));
    return res.status(401).json({ error: "Sessão inválida" });
  }

  req.session = session;
  next();
}

// Ensure local directories exist for attachments and documents
const STORAGE_DIR = path.join(process.cwd(), "storage");
const ATTACHMENTS_DIR = path.join(STORAGE_DIR, "attachments");
const CONFIG_DIR = path.join(STORAGE_DIR, "config");
[STORAGE_DIR, ATTACHMENTS_DIR, CONFIG_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ==========================================
// 1. SETUP & CONFIGURATION ENDPOINTS
// ==========================================

// Get system setup and connection status
app.get("/api/status", async (req: any, res: any) => {
  const configured = isDatabaseConfigured();
  if (!configured) {
    return res.json({ configured: false });
  }

  try {
    const config = getDatabaseConfig();
    const test = await testConnection(config!);
    if (!test.success) {
      return res.json({ 
        configured: true, 
        connected: false, 
        error: test.message,
        mode: config?.mode 
      });
    }

    // Check if an administrator exists
    const admins = await query("SELECT id, name, username FROM admins LIMIT 1");
    let companyName = "PK SIG Assistência";
    let tradeName = "";
    try {
      const company = await query("SELECT company_name, trade_name FROM company_settings LIMIT 1");
      if (company && company.length > 0) {
        companyName = company[0].company_name || "PK SIG Assistência";
        tradeName = company[0].trade_name || "";
      }
    } catch (e) {
      console.error("Error reading company settings in status endpoint:", e);
    }

    let last_sync_at = null;
    let last_sync_direction = null;
    try {
      const metaRows = await query("SELECT meta_key, meta_value FROM app_meta WHERE meta_key IN ('last_sync_at', 'last_sync_direction')");
      for (const row of metaRows) {
        if (row.meta_key === "last_sync_at") last_sync_at = row.meta_value;
        if (row.meta_key === "last_sync_direction") last_sync_direction = row.meta_value;
      }
    } catch (e: any) {
      console.warn("Could not read sync metadata from app_meta:", e.message);
    }

    const token = req.cookies.session_token;
    const session = token ? await getSession(token) : null;
    const isAuthenticated = !!session;

    const responseData: any = {
      configured: true,
      connected: true,
      hasAdmin: admins.length > 0,
      mode: config?.mode,
      type: (config?.mode as string) === "local" ? "sqlite" : (config?.type || "mysql"),
      last_sync_at,
      last_sync_direction,
      companyName,
      tradeName
    };

    if (isAuthenticated) {
      responseData.host = config?.host;
      responseData.database = config?.database;
      responseData.user = config?.user;
    }

    return res.json(responseData);
  } catch (err: any) {
    return res.json({ 
      configured: true, 
      connected: false, 
      error: err.message || "Erro de conexão",
      mode: getDatabaseConfig()?.mode
    });
  }
});

// Test database connection
app.post("/api/setup/test-connection", checkSetupProtection, async (req: any, res: any) => {
  const { mode, type, host, port, database, user, password, ssl } = req.body;
  if (mode !== "local" && (!host || !port || !database || !user)) {
    return res.status(400).json({ error: "Todos os campos de conexão são obrigatórios" });
  }

  const testResult = await testConnection({
    mode,
    type: type || (mode === "local" ? "sqlite" : "mysql"),
    host: mode === "local" ? "localhost" : host,
    port: mode === "local" ? 0 : parseInt(port),
    database: mode === "local" ? "pksig.db" : database,
    user: mode === "local" ? "local" : user,
    password,
    ssl: !!ssl
  });

  return res.json(testResult);
});

// Create database automatically
app.post("/api/setup/create-database", checkSetupProtection, async (req: any, res: any) => {
  const { mode, type, host, port, database, user, password, ssl } = req.body;
  if (mode !== "local" && (!host || !port || !database || !user)) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes" });
  }

  const result = await createDatabaseAutomatically({
    mode,
    type: type || (mode === "local" ? "sqlite" : "mysql"),
    host: mode === "local" ? "localhost" : host,
    port: mode === "local" ? 0 : parseInt(port),
    database: mode === "local" ? "pksig.db" : database,
    user: mode === "local" ? "local" : user,
    password,
    ssl: !!ssl
  });

  return res.json(result);
});

// Verify database compatibility
app.post("/api/setup/verify-compatibility", checkSetupProtection, async (req: any, res: any) => {
  const { mode, type, host, port, database, user, password, ssl, certificate } = req.body;
  if (mode !== "local" && (!host || !port || !database || !user)) {
    return res.status(400).json({ error: "Todos os campos de conexão são obrigatórios" });
  }

  const result = await verifyDatabaseCompatibility({
    mode,
    type: type || (mode === "local" ? "sqlite" : "mysql"),
    host: mode === "local" ? "localhost" : host,
    port: mode === "local" ? 0 : parseInt(port),
    database: mode === "local" ? "pksig.db" : database,
    user: mode === "local" ? "local" : user,
    password,
    ssl: !!ssl,
    certificate
  });

  return res.json(result);
});

// Install schema & setup administrator
app.post("/api/setup/install", checkSetupProtection, validateBody(setupInstallSchema), async (req: any, res: any) => {
  const { connection, admin, company, useExistingDb } = req.body;

  try {
    const isRemoteIncomplete = connection.mode === "remoto" && (!connection.host || !connection.database);
    const resolvedMode = isRemoteIncomplete ? "local" : connection.mode;
    const resolvedType = resolvedMode === "local" ? "sqlite" : (connection.type || "mysql");

    // 1. Save Config First
    saveDatabaseConfig({
      mode: resolvedMode,
      type: resolvedType,
      host: resolvedMode === "local" ? "localhost" : connection.host,
      port: resolvedMode === "local" ? 0 : parseInt(connection.port || "3306"),
      database: resolvedMode === "local" ? "pksig.db" : connection.database,
      user: resolvedMode === "local" ? "local" : connection.user,
      password: resolvedMode === "local" ? "" : connection.password,
      ssl: resolvedMode === "local" ? false : !!connection.ssl
    });

    // 2. Install Schema (Skip if using existing compatible database)
    if (!useExistingDb) {
      const installResult = await executeInstallSql();
      if (!installResult.success) {
        return res.status(500).json({ error: installResult.message });
      }
    }

    // 3. Create Admin
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(admin.password, salt);
    
    let adminCreated = false;
    if (useExistingDb) {
      try {
        const existingAdmins = await query("SELECT * FROM admins WHERE username = ?", [admin.username]);
        if (!existingAdmins || existingAdmins.length === 0) {
          await execute(
            "INSERT INTO admins (name, username, password_hash) VALUES (?, ?, ?)",
            [admin.name, admin.username, passwordHash]
          );
          adminCreated = true;
        } else {
          console.log(`Admin user ${admin.username} already exists in existing database.`);
        }
      } catch (err) {
        console.error("Failed to query/insert admin in existing database:", err);
      }
    } else {
      await execute(
        "INSERT INTO admins (name, username, password_hash) VALUES (?, ?, ?)",
        [admin.name, admin.username, passwordHash]
      );
      adminCreated = true;
    }

    // 4. Set Company Settings (if provided)
    if (company && company.name) {
      await execute(
        `INSERT INTO company_settings (id, company_name, trade_name, tax_id, phone, whatsapp, email, address_text, notes) 
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE company_name=?, trade_name=?, tax_id=?, phone=?, whatsapp=?, email=?, address_text=?, notes=?`,
        [
          company.name, company.tradeName || null, company.taxId || null, company.phone || null, 
          company.whatsapp || null, company.email || null, company.address || null, company.notes || null,
          company.name, company.tradeName || null, company.taxId || null, company.phone || null, 
          company.whatsapp || null, company.email || null, company.address || null, company.notes || null
        ]
      );
    } else if (!useExistingDb) {
      // Default company settings placeholder
      await execute(
        "INSERT INTO company_settings (id, company_name) VALUES (1, 'Minha Assistência Técnica') ON DUPLICATE KEY UPDATE company_name='Minha Assistência Técnica'"
      );
    }

    // 5. Run automatic integrity check and repair to make sure everything matches perfectly
    const repairResult = await verifyAndRepairDatabaseSchema();
    if (!repairResult.success) {
      console.warn("Integrity repair warning during setup:", repairResult.message);
    }

    return res.json({ 
      success: true, 
      message: "Sistema PK SIG inicializado com sucesso!",
      adminCreated 
    });
  } catch (err: any) {
    console.error("Setup error:", err);
    return res.status(500).json({ error: err.message || "Falha ao inicializar o sistema" });
  }
});

// Get database configuration
app.get("/api/database/config", requireAuth, (req: any, res: any) => {
  const config = getDatabaseConfig();
  if (!config) {
    return res.status(404).json({ error: "Banco de dados não configurado" });
  }
  const responseConfig = { ...config, mode: "remoto" };
  delete responseConfig.password;
  return res.json(responseConfig);
});

// Update active database configuration (MySQL only)
app.post("/api/database/config", requireAuth, async (req: any, res: any) => {
  const { type, host, port, database, user, password, ssl, certificate } = req.body;

  try {
    const oldConfig = getDatabaseConfig();

    const currentConfig = oldConfig || {
      mode: "remoto",
      type: "mysql",
      host: "",
      port: 3306,
      database: "pksig",
      user: "root",
      ssl: false
    };

    const newConfig: any = {
      ...currentConfig,
      mode: "remoto",
      type: type || "mysql"
    };
    if (host !== undefined) newConfig.host = host;
    if (port !== undefined) newConfig.port = parseInt(port);
    if (database !== undefined) newConfig.database = database;
    if (user !== undefined) newConfig.user = user;
    if (password) {
      newConfig.password = password; // Plain text here, will be encrypted by saveDatabaseConfig
    }
    if (ssl !== undefined) newConfig.ssl = !!ssl;
    if (certificate !== undefined) newConfig.certificate = certificate;
    
    saveDatabaseConfig(newConfig);

    return res.json({ success: true, message: `Banco de dados configurado para o modo Remoto (${newConfig.type?.toUpperCase() || "MYSQL"}) com sucesso!` });
  } catch (err: any) {
    console.error("Failed to save database config:", err);
    return res.status(500).json({ error: err.message || "Erro ao salvar configurações do banco de dados" });
  }
});

// Export application configurations
app.get("/api/settings/export", requireAuth, async (req: any, res: any) => {
  try {
    const tables = [
      "system_settings",
      "company_settings",
      "equipment_categories",
      "payment_methods",
      "financial_categories",
      "warranty_rules",
      "reception_accessories",
      "equipment_category_accessories"
    ];
    const exportData: any = {};
    for (const table of tables) {
      exportData[table] = await query(`SELECT * FROM \`${table}\``);
    }
    return res.json(exportData);
  } catch (err: any) {
    console.error("Export settings error:", err);
    return res.status(500).json({ error: "Erro ao exportar configurações: " + err.message });
  }
});

// Import application configurations
app.post("/api/settings/import", requireAuth, async (req: any, res: any) => {
  const data = req.body;
  if (!data || typeof data !== "object") {
    return res.status(400).json({ error: "Dados de importação inválidos" });
  }

  const tables = [
    "system_settings",
    "company_settings",
    "equipment_categories",
    "payment_methods",
    "financial_categories",
    "warranty_rules",
    "reception_accessories",
    "equipment_category_accessories"
  ];

  try {
    const activePool = await getPool();
    const connection = await activePool.getConnection();
    try {
      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
      for (const table of tables) {
        if (!data[table] || !Array.isArray(data[table])) {
          continue;
        }
        // Wipes existing data
        await connection.query(`DELETE FROM \`${table}\``);
        const rows = data[table];
        if (rows.length === 0) continue;

        for (const row of rows) {
          const keys = Object.keys(row).filter(k => k.toLowerCase() !== "total_value");
          const columns = keys.map(k => `\`${k}\``).join(", ");
          const placeholders = keys.map(() => "?").join(", ");
          const values = keys.map(k => {
            const val = row[k];
            if (typeof val === "boolean") return val ? 1 : 0;
            if (val instanceof Date) {
              return (val as any).toISOString().slice(0, 19).replace('T', ' ');
            }
            return val;
          });
          await connection.query(`INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`, values);
        }
      }
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    } finally {
      connection.release();
    }
    return res.json({ success: true, message: "Configurações importadas com sucesso!" });
  } catch (err: any) {
    console.error("Import settings error:", err);
    return res.status(500).json({ error: "Erro ao importar configurações: " + err.message });
  }
});

// Import complete SQL backup file
app.post("/api/database/import-sql", requireAuth, async (req: any, res: any) => {
  const { sql } = req.body;
  if (!sql || typeof sql !== "string") {
    return res.status(400).json({ error: "Conteúdo SQL inválido" });
  }

  try {
    const activePool = await getPool();
    const connection = await activePool.getConnection();
    
    const statements = sql
      .split(/;(?=(?:[^'"`]*['"`][^'"`]*['"`])*[^'"`]*$)/g) // split on semicolons outside quotes
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    try {
      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
      for (const statement of statements) {
        // Filter lines to ignore comments
        const cleanStatement = statement
          .split("\n")
          .filter(line => !line.trim().startsWith("--") && !line.trim().startsWith("/*") && !line.trim().startsWith("#"))
          .join("\n")
          .trim();

        if (cleanStatement.length === 0) {
          continue;
        }

        try {
          await connection.query(cleanStatement);
          successCount++;
        } catch (err: any) {
          failureCount++;
          errors.push(`Erro na query: "${cleanStatement.slice(0, 100)}..." -> ${err.message}`);
        }
      }
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    } finally {
      connection.release();
    }

    if (failureCount > 0) {
      return res.json({
        success: true,
        message: `Importação parcial realizada com ${successCount} queries bem-sucedidas. Ocorreram ${failureCount} erros na importação.`,
        errors: errors.slice(0, 10)
      });
    }

    return res.json({
      success: true,
      message: `Backup .SQL importado com sucesso total! ${successCount} queries executadas no banco ativo.`
    });

  } catch (err: any) {
    console.error("SQL Import route failed:", err);
    return res.status(500).json({ error: `Falha na restauração do backup SQL: ${err.message}` });
  }
});

// Verify the integrity and compatibility of the active database
app.get("/api/database/verify", requireAuth, async (req: any, res: any) => {
  const config = getDatabaseConfig();
  if (!config) {
    return res.status(404).json({ error: "Banco de dados não configurado" });
  }

  try {
    const result = await verifyDatabaseCompatibility(config);
    return res.json(result);
  } catch (err: any) {
    console.error("Failed to verify active database:", err);
    return res.status(500).json({ error: err.message || "Erro ao verificar o banco de dados ativo" });
  }
});

// Reset and regenerate default system database
app.post("/api/database/reset", requireAuth, async (req: any, res: any) => {
  const config = getDatabaseConfig();
  if (!config) {
    return res.status(404).json({ error: "Banco de dados não configurado" });
  }

  try {
    // 1. Fetch current admin details to preserve credentials
    let currentUser: any = null;
    if (req.session && req.session.username) {
      try {
        const userRows = await query("SELECT name, username, password_hash FROM admins WHERE username = ?", [req.session.username]);
        if (userRows && userRows.length > 0) {
          currentUser = userRows[0];
        }
      } catch (err) {
        console.warn("Could not retrieve current admin details to preserve:", err);
      }
    }

    // 2. Fetch current company settings to preserve if possible
    let currentCompany: any = null;
    try {
      const companyRows = await query("SELECT * FROM company_settings LIMIT 1");
      if (companyRows && companyRows.length > 0) {
        currentCompany = companyRows[0];
      }
    } catch (err) {
      console.warn("Could not retrieve current company settings to preserve:", err);
    }

    // 3. Execute installation SQL to drop and recreate tables and insert default values
    const installResult = await executeInstallSql();
    if (!installResult.success) {
      return res.status(500).json({ error: installResult.message || "Erro ao gerar as tabelas do sistema" });
    }

    // 4. Restore preserved admin user
    if (currentUser) {
      await execute(
        "INSERT INTO admins (name, username, password_hash) VALUES (?, ?, ?)",
        [currentUser.name, currentUser.username, currentUser.password_hash]
      );
    } else {
      // Fallback default admin
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync("admin", salt);
      await execute(
        "INSERT INTO admins (name, username, password_hash) VALUES (?, ?, ?)",
        ["Administrador", "admin", passwordHash]
      );
    }

    // 5. Restore preserved company settings
    if (currentCompany) {
      await execute(
        `INSERT INTO company_settings (id, company_name, trade_name, tax_id, phone, whatsapp, email, address_text, notes)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          currentCompany.company_name,
          currentCompany.trade_name,
          currentCompany.tax_id,
          currentCompany.phone,
          currentCompany.whatsapp,
          currentCompany.email,
          currentCompany.address_text,
          currentCompany.notes
        ]
      );
    } else {
      // Default placeholder if none existed
      await execute(
        `INSERT INTO company_settings (id, company_name) VALUES (1, ?)`,
        ["PK SIG Informática"]
      );
    }

    return res.json({
      success: true,
      message: "Todas as tabelas e dados padrão foram redefinidos com sucesso! Seu usuário e senha de acesso foram mantidos por segurança."
    });
  } catch (err: any) {
    console.error("Failed to reset database:", err);
    return res.status(500).json({ error: err.message || "Erro interno ao redefinir banco de dados" });
  }
});

// ==========================================
// 2. AUTHENTICATION ENDPOINTS
// ==========================================

// Login endpoint
app.post("/api/auth/login", validateBody(loginSchema), async (req: any, res: any) => {
  const { username, password } = req.body;
  const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";

  if (!isDatabaseConfigured()) {
    return res.status(400).json({ error: "Sistema não configurado. Por favor, faça o setup." });
  }

  try {
    // Basic rate limit check: count failures in last 5 mins
    const config = getDatabaseConfig();
    const isSqlite = !config || config.mode === "local" || config.type === "sqlite";

    let recentFailures;
    if (isSqlite) {
      recentFailures = await query(
        "SELECT COUNT(*) as failures FROM login_attempts WHERE username = ? AND success = 0 AND attempted_at > datetime('now', '-5 minutes')",
        [username]
      );
    } else {
      recentFailures = await query(
        "SELECT COUNT(*) as failures FROM login_attempts WHERE username = ? AND success = 0 AND attempted_at > NOW() - INTERVAL 5 MINUTE",
        [username]
      );
    }
    if (recentFailures[0]?.failures >= 5) {
      return res.status(429).json({ error: "Muitas tentativas malsucedidas. Tente novamente em 5 minutos." });
    }

    const admins = await query("SELECT * FROM admins WHERE username = ?", [username]);
    const admin = admins[0];

    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      // Log failed attempt
      await execute("INSERT INTO login_attempts (username, ip_address, success) VALUES (?, ?, 0)", [username, ip]);
      return res.status(401).json({ error: "Usuário ou senha incorretos" });
    }

    // Log success
    await execute("INSERT INTO login_attempts (username, ip_address, success) VALUES (?, ?, 1)", [username, ip]);
    await execute("UPDATE admins SET last_login_at = NOW() WHERE id = ?", [admin.id]);

    // Create session token
    const token = await createSession(admin.id, admin.username, admin.name, ip, req.headers["user-agent"]);

    // Set secure/lax cookie dynamically
    res.cookie("session_token", token, getCookieOptions(req));

    return res.json({
      success: true,
      user: {
        id: admin.id,
        username: admin.username,
        name: admin.name
      }
    });
  } catch (err: any) {
    console.error("Login endpoint error:", err);
    return res.status(500).json({ error: err.message || "Erro no servidor" });
  }
});

// Logout endpoint
app.post("/api/auth/logout", async (req: any, res: any) => {
  const token = req.cookies.session_token;
  if (token) {
    await destroySession(token);
  }
  res.clearCookie("session_token", getCookieOptions(req));
  return res.json({ success: true, message: "Logout efetuado com sucesso" });
});

// Me (Session status)
app.get("/api/auth/me", async (req: any, res: any) => {
  const token = req.cookies.session_token;
  if (!token) {
    return res.json({ authenticated: false });
  }

  const session = await getSession(token);
  if (!session) {
    res.clearCookie("session_token", getCookieOptions(req));
    return res.json({ authenticated: false });
  }

  try {
    const comp = await query("SELECT company_name FROM company_settings LIMIT 1");
    const sys = await query("SELECT system_name, currency FROM system_settings LIMIT 1");
    return res.json({
      authenticated: true,
      user: {
        id: session.userId,
        username: session.username,
        name: session.name
      },
      companyName: comp[0]?.company_name || "Assistência Técnica",
      systemName: sys[0]?.system_name || "PK SIG",
      currency: sys[0]?.currency || "BRL"
    });
  } catch (err) {
    return res.json({ authenticated: true, user: { id: session.userId, username: session.username, name: session.name } });
  }
});

// Endpoint to fetch the session's CSRF token
app.get("/api/auth/csrf-token", requireAuth, (req: any, res: any) => {
  const token = req.cookies.session_token;
  const csrfToken = generateCsrfToken(token);
  return res.json({ csrfToken });
});

// ==========================================
// Helper: Sequential Code Generators (Concurrency-Safe)
// ==========================================

class SimpleMutex {
  private queue: Promise<any> = Promise.resolve();

  async acquire(): Promise<() => void> {
    let release: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const current = this.queue;
    this.queue = current.then(() => next);
    await current;
    return release!;
  }
}

const sequenceMutex = new SimpleMutex();

async function ensureSequencesTable() {
  try {
    if (!isDatabaseConfigured()) return;
    const dbConfig = getDatabaseConfig();
    const isMysql = dbConfig?.mode === "remoto";

    try {
      await query("SELECT 1 FROM sequences LIMIT 1");
    } catch (e) {
      console.log("Creating sequences table for safe sequential codes...");
      if (isMysql) {
        await execute(`
          CREATE TABLE sequences (
            \`type\` VARCHAR(50) PRIMARY KEY,
            \`last_value\` INT NOT NULL DEFAULT 0
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
      } else {
        await execute(`
          CREATE TABLE sequences (
            \`type\` TEXT PRIMARY KEY,
            \`last_value\` INTEGER NOT NULL DEFAULT 0
          )
        `);
      }

      // Seed initial values safely from existing table sizes
      const entities = [
        { type: "client", table: "clients" },
        { type: "equipment", table: "equipments" },
        { type: "os", table: "service_orders" },
        { type: "guide", table: "payment_guides" },
        { type: "warranty", table: "warranties" }
      ];

      for (const ent of entities) {
        let initialVal = 0;
        try {
          const currentCount = await query(`SELECT COUNT(*) as total FROM ${ent.table}`);
          initialVal = currentCount[0]?.total || 0;
        } catch (err) {
          // Table doesn't exist or is empty
        }
        await execute("INSERT INTO sequences (`type`, `last_value`) VALUES (?, ?)", [ent.type, initialVal]);
      }
      console.log("sequences table initialized successfully.");
    }
  } catch (err) {
    console.error("Error ensuring or seeding sequences table:", err);
  }
}

async function generateNextCode(type: "client" | "equipment" | "os" | "guide" | "warranty"): Promise<string> {
  await ensureSequencesTable();

  const release = await sequenceMutex.acquire();
  try {
    const sysSettings = await query("SELECT * FROM system_settings LIMIT 1");
    const settings = sysSettings[0] || {
      prefix_client: "CLI",
      prefix_equipment: "EQP",
      prefix_os: "OS",
      prefix_guide: "GUIA",
      prefix_warranty: "GAR",
      include_year_in_code: 1,
      digits_count: 6
    };

    let prefix = "";
    if (type === "client") {
      prefix = settings.prefix_client;
    } else if (type === "equipment") {
      prefix = settings.prefix_equipment;
    } else if (type === "os") {
      prefix = settings.prefix_os;
    } else if (type === "guide") {
      prefix = settings.prefix_guide;
    } else if (type === "warranty") {
      prefix = settings.prefix_warranty;
    }

    // Atomically increment the sequence counter
    await execute("UPDATE sequences SET `last_value` = `last_value` + 1 WHERE `type` = ?", [type]);

    // Retrieve the newly incremented sequence counter
    const seqResult = await query("SELECT `last_value` FROM sequences WHERE `type` = ?", [type]);
    let nextNumber = seqResult[0]?.last_value;

    if (!nextNumber) {
      // Emergency fallback in case the type was somehow not seeded
      const countTable = type === "client" ? "clients" :
                         type === "equipment" ? "equipments" :
                         type === "os" ? "service_orders" :
                         type === "guide" ? "payment_guides" : "warranties";
      const countResult = await query(`SELECT COUNT(*) as total FROM ${countTable}`);
      nextNumber = (countResult[0]?.total || 0) + 1;
      
      const isMysql = getDatabaseConfig()?.mode === "remoto";
      if (isMysql) {
        await execute("INSERT IGNORE INTO sequences (`type`, `last_value`) VALUES (?, ?)", [type, nextNumber]);
      } else {
        await execute("INSERT OR IGNORE INTO sequences (`type`, `last_value`) VALUES (?, ?)", [type, nextNumber]);
      }
    }

    const yearSuffix = settings.include_year_in_code ? `-${new Date().getFullYear()}` : "";
    const paddedNumber = String(nextNumber).padStart(settings.digits_count, "0");

    return `${prefix}${yearSuffix}-${paddedNumber}`;
  } finally {
    release();
  }
}

// ==========================================
// 3. CLIENTS ENDPOINTS
// ==========================================

// List & Search clients
app.get("/api/clients", requireAuth, async (req: any, res: any) => {
  const { q, type, status } = req.query;

  try {
    let sql = `
      SELECT c.*, 
             (SELECT COUNT(*) FROM equipments e WHERE e.client_id = c.id) as equipment_count,
             (SELECT COUNT(*) FROM service_orders o JOIN service_order_statuses s ON o.status_id = s.id WHERE o.client_id = c.id AND s.name != 'Entregue' AND s.name != 'Cancelada') as open_os_count,
             (SELECT MAX(entry_date) FROM service_orders o WHERE o.client_id = c.id) as last_service_date
      FROM clients c 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q) {
      sql += " AND (c.name LIKE ? OR c.cpf_cnpj LIKE ? OR c.phone LIKE ? OR c.whatsapp LIKE ? OR c.code LIKE ?)";
      const searchWild = `%${q}%`;
      params.push(searchWild, searchWild, searchWild, searchWild, searchWild);
    }

    if (type && (type === "PF" || type === "PJ")) {
      sql += " AND c.type = ?";
      params.push(type);
    }

    if (status && (status === "ativo" || status === "inativo")) {
      sql += " AND c.status = ?";
      params.push(status);
    }

    sql += " ORDER BY c.id DESC";
    const clientsList = await query(sql, params);
    return res.json(clientsList);
  } catch (err: any) {
    console.error("List clients error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Create client
app.post("/api/clients", requireAuth, validateBody(clientSchema), async (req: any, res: any) => {
  const { 
    type, name, cpf_cnpj, rg_ie, responsible, birth_date, 
    email, phone, whatsapp, zip_code, street, number, 
    complement, neighborhood, city, state, notes 
  } = req.body;

  try {
    const code = await generateNextCode("client");
    const birthVal = birth_date ? birth_date : null;

    const result = await execute(`
      INSERT INTO clients 
        (code, type, name, cpf_cnpj, rg_ie, responsible, birth_date, email, phone, whatsapp, zip_code, street, number, complement, neighborhood, city, state, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code, type, name, cpf_cnpj, rg_ie || null, responsible || null, birthVal, 
        email || null, phone || null, whatsapp || null, zip_code || null, street || null, 
        number || null, complement || null, neighborhood || null, city || null, state || null, notes || null
      ]
    );

    return res.json({ success: true, clientId: result.insertId, code });
  } catch (err: any) {
    console.error("Create client error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Get client profile
app.get("/api/clients/:id", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;

  try {
    const clients = await query("SELECT * FROM clients WHERE id = ?", [id]);
    const client = clients[0];
    if (!client) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }

    // Equipments
    const equipments = await query(`
      SELECT e.*, c.name as category_name 
      FROM equipments e 
      JOIN equipment_categories c ON e.category_id = c.id 
      WHERE e.client_id = ? 
      ORDER BY e.id DESC`, [id]
    );

    // Service Orders
    const orders = await query(`
      SELECT o.*, e.brand, e.model, e.serial_number, 
             (SELECT SUM(total_value) FROM budget_items b WHERE b.service_order_id = o.id) as total_value
      FROM service_orders o
      JOIN equipments e ON o.equipment_id = e.id
      WHERE o.client_id = ?
      ORDER BY o.id DESC`, [id]
    );

    // Payment Guides
    const guides = await query(`
      SELECT g.*, o.code as os_code 
      FROM payment_guides g
      JOIN service_orders o ON g.service_order_id = o.id
      WHERE g.client_id = ?
      ORDER BY g.id DESC`, [id]
    );

    // Warranties
    const warranties = await query(`
      SELECT w.*, o.code as os_code, e.brand, e.model
      FROM warranties w
      JOIN service_orders o ON w.service_order_id = o.id
      JOIN equipments e ON w.equipment_id = e.id
      WHERE w.client_id = ?
      ORDER BY w.id DESC`, [id]
    );

    return res.json({
      client,
      equipments,
      orders,
      guides,
      warranties
    });
  } catch (err: any) {
    console.error("Get client profile error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Update client
app.put("/api/clients/:id", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { 
    name, cpf_cnpj, rg_ie, responsible, birth_date, 
    email, phone, whatsapp, zip_code, street, number, 
    complement, neighborhood, city, state, notes, status 
  } = req.body;

  try {
    const birthVal = birth_date ? birth_date : null;
    await execute(`
      UPDATE clients 
      SET name=?, cpf_cnpj=?, rg_ie=?, responsible=?, birth_date=?, email=?, phone=?, whatsapp=?, 
          zip_code=?, street=?, number=?, complement=?, neighborhood=?, city=?, state=?, notes=?, status=?
      WHERE id=?`,
      [
        name, cpf_cnpj, rg_ie || null, responsible || null, birthVal, email || null, phone || null, whatsapp || null,
        zip_code || null, street || null, number || null, complement || null, neighborhood || null, city || null, state || null, notes || null, status, id
      ]
    );
    return res.json({ success: true });
  } catch (err: any) {
    console.error("Update client error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Toggle status client (Inativar/Reativar)
app.put("/api/clients/:id/status", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { status } = req.body;

  if (status !== "ativo" && status !== "inativo") {
    return res.status(400).json({ error: "Status inválido" });
  }

  try {
    await execute("UPDATE clients SET status = ? WHERE id = ?", [status, id]);
    return res.json({ success: true, status });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. EQUIPMENT ENDPOINTS
// ==========================================

// Create equipment
app.post("/api/equipment", requireAuth, validateBody(equipmentSchema), async (req: any, res: any) => {
  const { client_id, category_id, brand, model, serial_number, imei, asset_tag, responsible, color, notes, status } = req.body;

  try {
    const code = await generateNextCode("equipment");
    const result = await execute(`
      INSERT INTO equipments 
        (client_id, code, category_id, brand, model, serial_number, imei, asset_tag, responsible, color, notes, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client_id, code, category_id, brand, model, serial_number || null, 
        imei || null, asset_tag || null, responsible || null, color || null, notes || null, status || "Disponível"
      ]
    );
    return res.json({ success: true, equipmentId: result.insertId, code });
  } catch (err: any) {
    console.error("Create equipment error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Update equipment
app.put("/api/equipment/:id", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { category_id, brand, model, serial_number, imei, asset_tag, responsible, color, notes, status } = req.body;

  try {
    await execute(`
      UPDATE equipments 
      SET category_id=?, brand=?, model=?, serial_number=?, imei=?, asset_tag=?, responsible=?, color=?, notes=?, status=?
      WHERE id=?`,
      [category_id, brand, model, serial_number || null, imei || null, asset_tag || null, responsible || null, color || null, notes || null, status, id]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. SERVICE ORDER (OS) ENDPOINTS
// ==========================================

// List & Search service orders
app.get("/api/service-orders", requireAuth, async (req: any, res: any) => {
  const { q, status } = req.query;

  try {
    let sql = `
      SELECT o.*, 
             c.name as client_name, c.code as client_code,
             e.brand as brand, e.model as model, e.serial_number as serial_number,
             (SELECT COALESCE(SUM(total_value), 0) FROM budget_items WHERE service_order_id = o.id) as total_value
      FROM service_orders o
      JOIN clients c ON o.client_id = c.id
      JOIN equipments e ON o.equipment_id = e.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q) {
      sql += " AND (o.code LIKE ? OR c.name LIKE ? OR e.serial_number LIKE ? OR e.brand LIKE ? OR e.model LIKE ?)";
      const searchWild = `%${q}%`;
      params.push(searchWild, searchWild, searchWild, searchWild, searchWild);
    }

    if (status) {
      sql += " AND o.status_name = ?";
      params.push(status);
    }

    sql += " ORDER BY o.id DESC";
    const ordersList = await query(sql, params);
    return res.json(ordersList);
  } catch (err: any) {
    console.error("List service orders error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Create Service Order
app.post("/api/service-orders", requireAuth, async (req: any, res: any) => {
  const { client_id, equipment_id, technician_name, problem_reported, reception_equipment_state, reception_notes, accessories } = req.body;

  if (!client_id || !equipment_id || !problem_reported) {
    return res.status(400).json({ error: "Cliente, equipamento e problema informado são obrigatórios" });
  }

  try {
    const code = await generateNextCode("os");
    
    const osId = await runInTransaction(async (exec) => {
      // Dynamically resolve status_id for 'Recebida' to prevent FK failures
      const statuses = await exec("SELECT id, name FROM service_order_statuses WHERE name = 'Recebida'");
      let targetStatusId = statuses[0]?.id;
      let targetStatusName = statuses[0]?.name || "Recebida";

      if (!targetStatusId) {
        const anyStatus = await exec("SELECT id, name FROM service_order_statuses ORDER BY position ASC, id ASC LIMIT 1");
        if (anyStatus[0]) {
          targetStatusId = anyStatus[0].id;
          targetStatusName = anyStatus[0].name;
        } else {
          const insStatus = await exec("INSERT INTO service_order_statuses (name, position, is_system) VALUES ('Recebida', 1, 1)");
          targetStatusId = insStatus.insertId || insStatus.id;
          targetStatusName = "Recebida";
        }
      }

      const result = await exec(`
        INSERT INTO service_orders 
          (client_id, equipment_id, code, technician_name, status_id, status_name, problem_reported, reception_equipment_state, reception_notes) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [client_id, equipment_id, code, technician_name || "Suporte TI (Administrador)", targetStatusId, targetStatusName, problem_reported, reception_equipment_state || null, reception_notes || null]
      );

      const newOsId = result.insertId || result.id;

      // Save accessories
      if (accessories && Array.isArray(accessories)) {
        for (const acc of accessories) {
          if (acc) {
            await exec("INSERT INTO service_order_accessories (service_order_id, accessory_name) VALUES (?, ?)", [newOsId, acc]);
          }
        }
      }

      // Update equipment status to "Em manutenção"
      await exec("UPDATE equipments SET status = 'Em manutenção' WHERE id = ?", [equipment_id]);

      return newOsId;
    });

    return res.json({ success: true, osId, code });
  } catch (err: any) {
    console.error("Create OS error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Get Service Order detail
app.get("/api/service-orders/:id", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;

  try {
    const orders = await query(`
      SELECT o.*, 
             c.name as client_name, c.code as client_code, c.phone as client_phone, c.whatsapp as client_whatsapp, c.cpf_cnpj as client_cpf_cnpj,
             e.brand as equip_brand, e.model as equip_model, e.serial_number as equip_serial, e.code as equip_code, e.asset_tag as equip_asset, e.category_id as equip_category_id
      FROM service_orders o
      JOIN clients c ON o.client_id = c.id
      JOIN equipments e ON o.equipment_id = e.id
      WHERE o.id = ?`, [id]
    );
    const order = orders[0];
    if (!order) {
      return res.status(404).json({ error: "Ordem de serviço não encontrada" });
    }

    // Load accessories associated
    const accessories = await query("SELECT accessory_name FROM service_order_accessories WHERE service_order_id = ?", [id]);

    // Load budget items
    const budgetItems = await query("SELECT * FROM budget_items WHERE service_order_id = ? ORDER BY id ASC", [id]);

    // Load payment guide if exists
    const guides = await query("SELECT * FROM payment_guides WHERE service_order_id = ?", [id]);

    // Load warranty if exists
    const warranties = await query("SELECT * FROM warranties WHERE service_order_id = ?", [id]);

    // Load attachments
    const attachmentRecords = await query("SELECT id, filename, file_size, mime_type, description, uploaded_at FROM attachments WHERE service_order_id = ? ORDER BY id DESC", [id]);

    return res.json({
      order,
      accessories: accessories.map(a => a.accessory_name),
      budgetItems,
      guide: guides[0] || null,
      warranty: warranties[0] || null,
      attachments: attachmentRecords
    });
  } catch (err: any) {
    console.error("Get OS details error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Delete Service Order (Concurrency and Transaction-Safe)
app.delete("/api/service-orders/:id", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;

  try {
    // 1. Fetch physical attachments list first (so we know what to delete physically if DB transaction succeeds)
    const attachments = await query("SELECT file_path FROM attachments WHERE service_order_id = ?", [id]);

    // 2. Perform database deletes inside a single unified transaction
    await runInTransaction(async (exec) => {
      // Delete budget items
      await exec("DELETE FROM budget_items WHERE service_order_id = ?", [id]);

      // Delete service order accessories
      await exec("DELETE FROM service_order_accessories WHERE service_order_id = ?", [id]);

      // Delete attachments meta
      await exec("DELETE FROM attachments WHERE service_order_id = ?", [id]);

      // Delete payment guides associated
      await exec("DELETE FROM payment_guides WHERE service_order_id = ?", [id]);

      // Delete warranties associated
      await exec("DELETE FROM warranties WHERE service_order_id = ?", [id]);

      // Delete service order logs/history if any
      try {
        await exec("DELETE FROM service_order_logs WHERE service_order_id = ?", [id]);
      } catch (logErr) {
        // Table may not exist, ignore
      }

      // Finally, delete the service order itself
      const deleteResult = await exec("DELETE FROM service_orders WHERE id = ?", [id]);
      // For MySQL, deleteResult can be okPacket. SQLite can be { affectedRows }. Handle both safely:
      const affected = deleteResult?.affectedRows !== undefined ? deleteResult.affectedRows : 1; 
      if (affected === 0) {
        throw new Error("Ordem de serviço não encontrada para exclusão.");
      }
    });

    // 3. Only if database transaction committed successfully, delete the physical files
    for (const attachment of attachments) {
      try {
        const absolutePath = path.join(process.cwd(), attachment.file_path);
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      } catch (err) {
        console.error("Error unlinking physical file on deleted OS:", attachment.file_path, err);
      }
    }

    return res.json({ success: true, message: "Ordem de serviço e todos os registros vinculados foram excluídos com sucesso." });
  } catch (err: any) {
    console.error("Delete Service Order error:", err);
    return res.status(500).json({ error: err.message || "Erro interno ao excluir ordem de serviço." });
  }
});

// Update Service Order (including analysis, budget state, statuses)
app.put("/api/service-orders/:id", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { 
    technician_name, status_id, problem_reported,
    technical_defect, technical_diagnosis, technical_service_recommended, 
    technical_parts_needed, technical_estimated_hours, technical_notes,
    reception_equipment_state, reception_notes, promise_date, completion_date,
    accessories
  } = req.body;

  try {
    // Fetch status name to cache it
    const statuses = await query("SELECT name FROM service_order_statuses WHERE id = ?", [status_id]);
    const statusName = statuses[0]?.name || "Recebida";

    const compDate = statusName === "Entregue" || statusName === "Pronta" ? (completion_date || new Date().toISOString().slice(0, 19).replace('T', ' ')) : null;
    const promiseVal = promise_date ? promise_date : null;

    await execute(`
      UPDATE service_orders 
      SET technician_name=?, status_id=?, status_name=?, problem_reported=?,
          technical_defect=?, technical_diagnosis=?, technical_service_recommended=?,
          technical_parts_needed=?, technical_estimated_hours=?, technical_notes=?,
          reception_equipment_state=?, reception_notes=?, promise_date=?, completion_date=?
      WHERE id=?`,
      [
        technician_name, status_id, statusName, problem_reported,
        technical_defect || null, technical_diagnosis || null, technical_service_recommended || null,
        technical_parts_needed || null, technical_estimated_hours || null, technical_notes || null,
        reception_equipment_state || null, reception_notes || null, promiseVal, compDate, id
      ]
    );

    // Save accessories
    if (accessories && Array.isArray(accessories)) {
      await execute("DELETE FROM service_order_accessories WHERE service_order_id = ?", [id]);
      for (const acc of accessories) {
        if (acc) {
          await execute("INSERT INTO service_order_accessories (service_order_id, accessory_name) VALUES (?, ?)", [id, acc]);
        }
      }
    }

    // If status is "Entregue", update equipment status to "Disponível"
    if (statusName === "Entregue") {
      const orders = await query("SELECT equipment_id FROM service_orders WHERE id = ?", [id]);
      if (orders[0]?.equipment_id) {
        await execute("UPDATE equipments SET status = 'Disponível' WHERE id = ?", [orders[0].equipment_id]);
      }
    }

    return res.json({ success: true, statusName });
  } catch (err: any) {
    console.error("Update OS error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Add budget item
app.post("/api/service-orders/:id/budget", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { description, type, quantity, unit_value } = req.body;

  if (!description || !type || quantity === undefined || unit_value === undefined) {
    return res.status(400).json({ error: "Descrição, tipo, quantidade e valor unitário são obrigatórios" });
  }

  try {
    // Check if payment guide already has payments. If yes, block additions as per rule "bloquear a alteração do valor total após primeiro pagamento"
    const guides = await query("SELECT * FROM payment_guides WHERE service_order_id = ?", [id]);
    if (guides[0] && guides[0].paid_amount > 0) {
      return res.status(400).json({ error: "Este orçamento não pode ser alterado pois já existem pagamentos registrados. Cancele a guia atual se necessário." });
    }

    const result = await execute(
      "INSERT INTO budget_items (service_order_id, description, type, quantity, unit_value) VALUES (?, ?, ?, ?, ?)",
      [id, description, type, parseFloat(quantity), parseFloat(unit_value)]
    );

    return res.json({ success: true, itemId: result.insertId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete budget item
app.delete("/api/service-orders/:id/budget/:itemId", requireAuth, async (req: any, res: any) => {
  const { id, itemId } = req.params;

  try {
    const guides = await query("SELECT * FROM payment_guides WHERE service_order_id = ?", [id]);
    if (guides[0] && guides[0].paid_amount > 0) {
      return res.status(400).json({ error: "Este orçamento não pode ser alterado pois já existem pagamentos registrados." });
    }

    await execute("DELETE FROM budget_items WHERE id = ? AND service_order_id = ?", [itemId, id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update budget item
app.put("/api/service-orders/:id/budget/:itemId", requireAuth, async (req: any, res: any) => {
  const { id, itemId } = req.params;
  const { description, type, quantity, unit_value } = req.body;

  if (!description || !type || quantity === undefined || unit_value === undefined) {
    return res.status(400).json({ error: "Descrição, tipo, quantidade e valor unitário são obrigatórios" });
  }

  try {
    const guides = await query("SELECT * FROM payment_guides WHERE service_order_id = ?", [id]);
    if (guides[0] && guides[0].paid_amount > 0) {
      return res.status(400).json({ error: "Este orçamento não pode ser alterado pois já existem pagamentos registrados." });
    }

    await execute(
      "UPDATE budget_items SET description = ?, type = ?, quantity = ?, unit_value = ? WHERE id = ? AND service_order_id = ?",
      [description, type, parseFloat(quantity), parseFloat(unit_value), itemId, id]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Generate Payment Guide (Guia de Pagamento)
app.post("/api/service-orders/:id/guide", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { expected_method_id, installments_count, due_date, notes } = req.body;

  try {
    // 1. Calculate budget total
    const totals = await query("SELECT SUM(total_value) as total FROM budget_items WHERE service_order_id = ?", [id]);
    const totalAmount = parseFloat(totals[0]?.total || 0);

    if (totalAmount <= 0) {
      return res.status(400).json({ error: "Não é possível gerar uma guia para orçamento zerado." });
    }

    // Fetch OS details
    const osRecords = await query("SELECT client_id FROM service_orders WHERE id = ?", [id]);
    const clientId = osRecords[0]?.client_id;

    if (!clientId) {
      return res.status(404).json({ error: "Ordem de serviço inválida" });
    }

    // Check if a guide already exists
    const existingGuides = await query("SELECT * FROM payment_guides WHERE service_order_id = ?", [id]);
    const existingGuide = existingGuides[0];

    if (existingGuide) {
      if (existingGuide.paid_amount > 0) {
        // "Se o orçamento mudar depois de um pagamento, cancelar a guia anterior e gerar uma nova, preservando o histórico."
        // We cancel the active guide and preserve its historic entries, then we generate a completely new guide.
        await execute("UPDATE payment_guides SET status = 'Cancelada' WHERE id = ?", [existingGuide.id]);
        await execute("UPDATE payment_installments SET status = 'Cancelado' WHERE payment_guide_id = ?", [existingGuide.id]);
      } else {
        // No payment made yet: delete the old one to rebuild clean
        await execute("DELETE FROM payment_guides WHERE id = ?", [existingGuide.id]);
      }
    }

    // 2. Insert payment guide
    const guideCode = await generateNextCode("guide");
    const today = new Date().toISOString().slice(0, 10);
    const dueVal = due_date || today;

    const result = await execute(`
      INSERT INTO payment_guides 
        (client_id, service_order_id, code, total_amount, expected_method_id, installments_count, issue_date, due_date, paid_amount, balance_amount, status, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, 'Em aberto', ?)`,
      [clientId, id, guideCode, totalAmount, expected_method_id || null, installments_count || 1, today, dueVal, totalAmount, notes || null]
    );

    const guideId = result.insertId;

    // 3. Generate installments (parcelas)
    const instCount = parseInt(installments_count) || 1;
    const baseAmount = +(totalAmount / instCount).toFixed(2);
    let remainingAmount = totalAmount;

    for (let i = 1; i <= instCount; i++) {
      let currentInstAmount = baseAmount;
      if (i === instCount) {
        // Adjust final installment with rounding differences
        currentInstAmount = remainingAmount;
      } else {
        remainingAmount = +(remainingAmount - baseAmount).toFixed(2);
      }

      // Calculate future installment due date (+30 days for each installment)
      const due = new Date();
      due.setDate(due.getDate() + (i - 1) * 30);
      const instDueDate = due.toISOString().slice(0, 10);

      await execute(`
        INSERT INTO payment_installments (payment_guide_id, installment_number, amount, due_date, status) 
        VALUES (?, ?, ?, ?, 'Pendente')`,
        [guideId, i, currentInstAmount, instDueDate]
      );
    }

    return res.json({ success: true, guideId, code: guideCode });
  } catch (err: any) {
    console.error("Generate guide error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. PAYMENTS & FINANCES ENDPOINTS
// ==========================================

async function recalculateGuidePayments(guideId: number, txExec?: (sql: string, params?: any[]) => Promise<any>) {
  const runQuery = txExec || query;
  const runExecute = txExec || execute;

  // 1. Get the guide
  const guides = await runQuery("SELECT * FROM payment_guides WHERE id = ?", [guideId]);
  const guide = guides[0];
  if (!guide) return;

  // 2. Get all payments for this guide in chronological/insert order
  const payments = await runQuery("SELECT * FROM payments WHERE payment_guide_id = ? ORDER BY id ASC", [guideId]);

  // 3. Reset all installments of this guide
  await runExecute(
    "UPDATE payment_installments SET paid_amount = 0, paid_date = NULL, status = 'Pendente' WHERE payment_guide_id = ?",
    [guideId]
  );

  // 4. Reset installments list in memory so we can update them
  const installments = await runQuery("SELECT * FROM payment_installments WHERE payment_guide_id = ? ORDER BY installment_number ASC", [guideId]);

  // 5. Distribute payments over installments
  for (const payment of payments) {
    let remainingPayment = parseFloat(payment.amount) || 0;

    if (payment.installment_id) {
      // Direct payment to a specific installment
      const inst = installments.find(i => i.id === payment.installment_id);
      if (inst) {
        const instAmount = parseFloat(inst.amount) || 0;
        const instPaidAmount = parseFloat(inst.paid_amount) || 0;
        const needed = instAmount - instPaidAmount;
        const paying = Math.min(remainingPayment, needed);
        inst.paid_amount = +(instPaidAmount + paying).toFixed(2);
        inst.status = inst.paid_amount >= instAmount ? "Pago" : "Pendente";
        inst.paid_date = payment.payment_date || new Date().toISOString().slice(0, 10);
      }
    } else {
      // Auto-distribute sequentially
      for (const inst of installments) {
        if (remainingPayment <= 0) break;
        const instAmount = parseFloat(inst.amount) || 0;
        const instPaidAmount = parseFloat(inst.paid_amount) || 0;
        if (instPaidAmount >= instAmount) continue;

        const needed = instAmount - instPaidAmount;
        const paying = Math.min(remainingPayment, needed);
        inst.paid_amount = +(instPaidAmount + paying).toFixed(2);
        inst.status = inst.paid_amount >= instAmount ? "Pago" : "Pendente";
        inst.paid_date = payment.payment_date || new Date().toISOString().slice(0, 10);
        remainingPayment = +(remainingPayment - paying).toFixed(2);
      }
    }
  }

  // 6. Save updated installments back to DB
  for (const inst of installments) {
    await runExecute(
      "UPDATE payment_installments SET paid_amount = ?, paid_date = ?, status = ? WHERE id = ?",
      [inst.paid_amount, inst.paid_date || null, inst.status, inst.id]
    );
  }

  // 7. Calculate new total paid, balance, and status for the guide
  const totalPaid = payments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
  const guideTotalAmount = parseFloat(guide.total_amount) || 0;
  const newBalance = Math.max(0, +(guideTotalAmount - totalPaid).toFixed(2));
  const newStatus = newBalance <= 0 ? "Quitada" : (totalPaid > 0 ? "Parcial" : "Pendente");

  await runExecute(
    "UPDATE payment_guides SET paid_amount = ?, balance_amount = ?, status = ? WHERE id = ?",
    [totalPaid, newBalance, newStatus, guideId]
  );
}

// Register payment against a guide
app.post("/api/payment-guides/:id/pay", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { amount, method_id, notes, installment_id } = req.body;

  if (!amount || !method_id) {
    return res.status(400).json({ error: "Valor e forma de pagamento são obrigatórios" });
  }

  const paymentAmount = parseFloat(amount);
  if (paymentAmount <= 0) {
    return res.status(400).json({ error: "Valor do pagamento deve ser maior que zero" });
  }

  try {
    const updatedGuide = await runInTransaction(async (exec) => {
      const guides = await exec("SELECT * FROM payment_guides WHERE id = ?", [id]);
      const guide = guides[0];
      if (!guide) {
        throw new Error("Guia de pagamento não encontrada");
      }

      if (guide.status === "Cancelada") {
        throw new Error("Esta guia foi cancelada");
      }

      const methods = await exec("SELECT name FROM payment_methods WHERE id = ?", [method_id]);
      const methodName = methods[0]?.name || "Outro";

      // 1. Log Payment
      const paymentResult = await exec(`
        INSERT INTO payments (payment_guide_id, installment_id, amount, payment_date, method_id, method_name, notes) 
        VALUES (?, ?, ?, CURRENT_DATE(), ?, ?, ?)`,
        [id, installment_id || null, paymentAmount, method_id, methodName, notes || null]
      );

      const paymentId = paymentResult.insertId || paymentResult.id;

      // Get client / OS information to build description in Financial Transaction
      const osInfo = await exec(`
        SELECT o.id as os_id, o.code as os_code, cl.name as client_name 
        FROM payment_guides g
        JOIN service_orders o ON g.service_order_id = o.id
        LEFT JOIN clients cl ON o.client_id = cl.id
        WHERE g.id = ?`, [id]);
      
      if (osInfo && osInfo[0]) {
        const osId = osInfo[0].os_id;
        const osCode = osInfo[0].os_code;
        const clientName = osInfo[0].client_name || "";
        const paymentDesc = `Pagamento da OS ${osCode} - ${clientName} (${methodName})`;

        // Find 'Serviço de OS' category
        const finCats = await exec("SELECT id FROM financial_categories WHERE name = 'Serviço de OS' AND active = 1 LIMIT 1");
        const categoryId = finCats[0]?.id || null;

        // Log in financial_transactions
        await exec(`
          INSERT INTO financial_transactions (description, type, amount, transaction_date, category_id, os_id, payment_id)
          VALUES (?, 'entrada', ?, CURRENT_DATE(), ?, ?, ?)`,
          [paymentDesc, paymentAmount, categoryId, osId, paymentId]
        );
      }

      // 2. Recalculate using the same transaction connection
      await recalculateGuidePayments(parseInt(id), exec);

      // Get updated info
      const updatedGuides = await exec("SELECT * FROM payment_guides WHERE id = ?", [id]);
      return updatedGuides[0];
    });

    return res.json({ 
      success: true, 
      paidAmount: parseFloat(updatedGuide.paid_amount), 
      balanceAmount: parseFloat(updatedGuide.balance_amount), 
      status: updatedGuide.status 
    });
  } catch (err: any) {
    console.error("Register payment error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Edit a payment
app.put("/api/payments/:id", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { amount, method_id, notes, payment_date } = req.body;

  if (!amount || !method_id) {
    return res.status(400).json({ error: "Valor e forma de pagamento são obrigatórios" });
  }

  const paymentAmount = parseFloat(amount);
  if (paymentAmount <= 0) {
    return res.status(400).json({ error: "Valor do pagamento deve ser maior que zero" });
  }

  try {
    const payments = await query("SELECT * FROM payments WHERE id = ?", [id]);
    const payment = payments[0];
    if (!payment) {
      return res.status(404).json({ error: "Pagamento não encontrado" });
    }

    const guides = await query("SELECT * FROM payment_guides WHERE id = ?", [payment.payment_guide_id]);
    const guide = guides[0];
    if (!guide) {
      return res.status(404).json({ error: "Guia de faturamento não encontrada" });
    }

    if (guide.status === "Cancelada") {
      return res.status(400).json({ error: "Esta guia de faturamento está cancelada" });
    }

    const methods = await query("SELECT name FROM payment_methods WHERE id = ?", [method_id]);
    const methodName = methods[0]?.name || "Outro";

    // Update payment record
    await execute(
      "UPDATE payments SET amount = ?, method_id = ?, method_name = ?, notes = ?, payment_date = COALESCE(?, payment_date) WHERE id = ?",
      [paymentAmount, method_id, methodName, notes || null, payment_date || null, id]
    );

    // Sync to financial_transactions
    const updatedPayment = (await query("SELECT * FROM payments WHERE id = ?", [id]))[0];
    if (updatedPayment) {
      const osInfo = await query(`
        SELECT o.id as os_id, o.code as os_code, cl.name as client_name 
        FROM payment_guides g
        JOIN service_orders o ON g.service_order_id = o.id
        LEFT JOIN clients cl ON o.client_id = cl.id
        WHERE g.id = ?`, [updatedPayment.payment_guide_id]);
      
      if (osInfo && osInfo[0]) {
        const osId = osInfo[0].os_id;
        const osCode = osInfo[0].os_code;
        const clientName = osInfo[0].client_name || "";
        const paymentDesc = `Pagamento da OS ${osCode} - ${clientName} (${methodName})`;

        // Check if there is an existing transaction for this payment
        const existingTx = await query("SELECT id FROM financial_transactions WHERE payment_id = ?", [id]);
        if (existingTx && existingTx.length > 0) {
          await execute(`
            UPDATE financial_transactions 
            SET description = ?, amount = ?, transaction_date = ?, os_id = ?
            WHERE payment_id = ?`,
            [paymentDesc, paymentAmount, updatedPayment.payment_date, osId, id]
          );
        } else {
          // If none exists, create it
          const finCats = await query("SELECT id FROM financial_categories WHERE name = 'Serviço de OS' AND active = 1 LIMIT 1");
          const categoryId = finCats[0]?.id || null;

          await execute(`
            INSERT INTO financial_transactions (description, type, amount, transaction_date, category_id, os_id, payment_id)
            VALUES (?, 'entrada', ?, ?, ?, ?, ?)`,
            [paymentDesc, paymentAmount, updatedPayment.payment_date, categoryId, osId, id]
          );
        }
      }
    }

    // Recalculate
    await recalculateGuidePayments(payment.payment_guide_id);

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Edit payment error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Delete a payment
app.delete("/api/payments/:id", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;

  try {
    const payments = await query("SELECT * FROM payments WHERE id = ?", [id]);
    const payment = payments[0];
    if (!payment) {
      return res.status(404).json({ error: "Pagamento não encontrado" });
    }

    const guides = await query("SELECT * FROM payment_guides WHERE id = ?", [payment.payment_guide_id]);
    const guide = guides[0];
    if (!guide) {
      return res.status(404).json({ error: "Guia de faturamento não encontrada" });
    }

    if (guide.status === "Cancelada") {
      return res.status(400).json({ error: "Esta guia de faturamento está cancelada" });
    }

    // Delete payment record
    await execute("DELETE FROM payments WHERE id = ?", [id]);

    // Delete corresponding financial transaction
    await execute("DELETE FROM financial_transactions WHERE payment_id = ?", [id]);

    // Recalculate
    await recalculateGuidePayments(payment.payment_guide_id);

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Delete payment error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Load payment installments & payments details for a guide
app.get("/api/payment-guides/:id", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;

  try {
    const guides = await query("SELECT * FROM payment_guides WHERE id = ?", [id]);
    const guide = guides[0];
    if (!guide) {
      return res.status(404).json({ error: "Guia não encontrada" });
    }

    const installments = await query("SELECT * FROM payment_installments WHERE payment_guide_id = ? ORDER BY installment_number ASC", [id]);
    const payments = await query("SELECT * FROM payments WHERE payment_guide_id = ? ORDER BY id DESC", [id]);

    return res.json({
      guide,
      installments,
      payments
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6.5. FINANCE ENDPOINTS
// ==========================================

// Get financial categories
app.get("/api/finance/categories", requireAuth, async (req: any, res: any) => {
  try {
    const rows = await query("SELECT * FROM financial_categories ORDER BY type ASC, name ASC");
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Create financial category
app.post("/api/finance/categories", requireAuth, async (req: any, res: any) => {
  const { name, type } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: "Nome e tipo (entrada/saida) são obrigatórios" });
  }
  if (type !== "entrada" && type !== "saida") {
    return res.status(400).json({ error: "Tipo deve ser 'entrada' ou 'saida'" });
  }
  try {
    await execute(
      "INSERT INTO financial_categories (name, type, active) VALUES (?, ?, 1)",
      [name, type]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update financial category
app.put("/api/finance/categories/:id", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { name, type, active } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: "Nome e tipo são obrigatórios" });
  }
  try {
    await execute(
      "UPDATE financial_categories SET name = ?, type = ?, active = ? WHERE id = ?",
      [name, type, active !== false ? 1 : 0, id]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get financial transactions with filters
app.get("/api/finance/transactions", requireAuth, async (req: any, res: any) => {
  const { startDate, endDate, categoryId, type, searchQuery, osId } = req.query;
  try {
    let sql = `
      SELECT 
        t.*, 
        c.name AS category_name, 
        o.code AS os_code, 
        cl.name AS client_name, 
        e.brand AS equipment_brand, 
        e.model AS equipment_model
      FROM financial_transactions t
      LEFT JOIN financial_categories c ON t.category_id = c.id
      LEFT JOIN service_orders o ON t.os_id = o.id
      LEFT JOIN clients cl ON o.client_id = cl.id
      LEFT JOIN equipments e ON o.equipment_id = e.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate) {
      sql += " AND t.transaction_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      sql += " AND t.transaction_date <= ?";
      params.push(endDate);
    }
    if (categoryId) {
      sql += " AND t.category_id = ?";
      params.push(categoryId);
    }
    if (type) {
      sql += " AND t.type = ?";
      params.push(type);
    }
    if (osId) {
      sql += " AND t.os_id = ?";
      params.push(osId);
    }
    if (searchQuery) {
      sql += " AND (t.description LIKE ? OR o.code LIKE ? OR cl.name LIKE ?)";
      const searchWild = `%${searchQuery}%`;
      params.push(searchWild, searchWild, searchWild);
    }

    sql += " ORDER BY t.transaction_date DESC, t.id DESC";
    const rows = await query(sql, params);
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Create financial transaction
app.post("/api/finance/transactions", requireAuth, async (req: any, res: any) => {
  const { description, type, amount, transaction_date, category_id, os_id } = req.body;
  if (!description || !type || amount === undefined || !transaction_date) {
    return res.status(400).json({ error: "Descrição, tipo, valor e data são obrigatórios" });
  }
  if (type !== "entrada" && type !== "saida") {
    return res.status(400).json({ error: "Tipo deve ser 'entrada' ou 'saida'" });
  }
  try {
    await execute(
      `INSERT INTO financial_transactions 
       (description, type, amount, transaction_date, category_id, os_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        description,
        type,
        parseFloat(amount),
        transaction_date,
        category_id ? parseInt(category_id) : null,
        os_id ? parseInt(os_id) : null
      ]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update financial transaction
app.put("/api/finance/transactions/:id", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { description, type, amount, transaction_date, category_id, os_id } = req.body;
  if (!description || !type || amount === undefined || !transaction_date) {
    return res.status(400).json({ error: "Descrição, tipo, valor e data são obrigatórios" });
  }
  try {
    await execute(
      `UPDATE financial_transactions 
       SET description = ?, type = ?, amount = ?, transaction_date = ?, category_id = ?, os_id = ? 
       WHERE id = ?`,
      [
        description,
        type,
        parseFloat(amount),
        transaction_date,
        category_id ? parseInt(category_id) : null,
        os_id ? parseInt(os_id) : null,
        id
      ]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete financial transaction
app.delete("/api/finance/transactions/:id", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  try {
    await execute("DELETE FROM financial_transactions WHERE id = ?", [id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get financial statistics and groupings
app.get("/api/finance/stats", requireAuth, async (req: any, res: any) => {
  const { startDate, endDate } = req.query;
  try {
    let filterSql = "";
    const params: any[] = [];
    if (startDate) {
      filterSql += " AND transaction_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      filterSql += " AND transaction_date <= ?";
      params.push(endDate);
    }

    // 1. Inflows and Outflows
    const totals = await query(
      `SELECT 
         SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END) as inflows,
         SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END) as outflows
       FROM financial_transactions
       WHERE 1=1 ${filterSql}`,
      params
    );

    const inflows = parseFloat(totals[0]?.inflows || 0);
    const outflows = parseFloat(totals[0]?.outflows || 0);
    const balance = inflows - outflows;

    // 2. Group by category
    const byCategory = await query(
      `SELECT 
         c.name as category_name,
         c.type as category_type,
         SUM(t.amount) as total_amount
       FROM financial_transactions t
       JOIN financial_categories c ON t.category_id = c.id
       WHERE 1=1 ${filterSql}
       GROUP BY c.name, c.type
       ORDER BY total_amount DESC`,
      params
    );

    // 3. Daily grouping for cash flow chart
    const dailyFlow = await query(
      `SELECT 
         transaction_date as date,
         SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END) as inflows,
         SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END) as outflows
       FROM financial_transactions
       WHERE 1=1 ${filterSql}
       GROUP BY transaction_date
       ORDER BY transaction_date ASC`,
      params
    );

    return res.json({
      inflows,
      outflows,
      balance,
      byCategory,
      dailyFlow
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. WARRANTY ENDPOINTS
// ==========================================

// Create Warranty Certificate
app.post("/api/service-orders/:id/warranty", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { rule_id, start_date, notes } = req.body;

  try {
    const osRecords = await query("SELECT * FROM service_orders WHERE id = ?", [id]);
    const os = osRecords[0];
    if (!os) {
      return res.status(404).json({ error: "Ordem de serviço não encontrada" });
    }

    // "Só pode ser gerada quando a OS estiver finalizada, a guia estiver quitada"
    // Let's verify status and payment guide
    const statusResult = await query("SELECT name FROM service_order_statuses WHERE id = ?", [os.status_id]);
    const statusName = statusResult[0]?.name;
    if (statusName !== "Entregue" && statusName !== "Pronta") {
      return res.status(400).json({ error: "Garantia só pode ser gerada quando a OS estiver Pronta ou Entregue" });
    }

    const guides = await query("SELECT * FROM payment_guides WHERE service_order_id = ?", [id]);
    const guide = guides[0];
    if (!guide || guide.status !== "Quitada") {
      return res.status(400).json({ error: "Garantia só pode ser gerada após a quitação total da guia de pagamento" });
    }

    // Load rule details for duration
    let durationDays = 90; // Fallback
    if (rule_id) {
      const rules = await query("SELECT duration_days FROM warranty_rules WHERE id = ?", [rule_id]);
      if (rules[0]) durationDays = rules[0].duration_days;
    }

    // Calculate dates
    const start = start_date ? new Date(start_date) : new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + durationDays);

    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const warrantyCode = await generateNextCode("warranty");
    const result = await execute(`
      INSERT INTO warranties (client_id, equipment_id, service_order_id, code, start_date, end_date, status, pdf_reference) 
      VALUES (?, ?, ?, ?, ?, ?, 'Vigente', ?)`,
      [os.client_id, os.equipment_id, id, warrantyCode, startStr, endStr, `cert-${warrantyCode}.pdf`]
    );

    return res.json({ success: true, warrantyId: result.insertId, code: warrantyCode });
  } catch (err: any) {
    console.error("Create warranty error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. ATTACHMENT ENDPOINTS (Secure Multipart Uploads)
// ==========================================

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ATTACHMENTS_DIR);
  },
  filename: (req, file, cb) => {
    // Generate secure randomized physical name and sanitize ext
    const randomName = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomName}${ext}`);
  }
});

const uploadAttachment = multer({
  storage: attachmentStorage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB limit
  },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("MimeTypeNotAllowed"));
    }
  }
});

const uploadSingle = (req: any, res: any, next: any) => {
  uploadAttachment.single("file")(req, res, (err: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "O tamanho máximo do arquivo é de 20 MB." });
      }
      if (err.message === "MimeTypeNotAllowed") {
        return res.status(400).json({ error: "Formato de arquivo não suportado. Tipos permitidos: JPEG, PNG, WebP, PDF, MP4, DOC, DOCX." });
      }
      return res.status(400).json({ error: err.message || "Erro no upload do arquivo." });
    }
    next();
  });
};

app.post("/api/service-orders/:id/attachments", requireAuth, uploadSingle, async (req: any, res: any) => {
  const { id } = req.params;
  const { description } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado ou dados incompletos." });
  }

  const filename = file.originalname;
  const mimeType = file.mimetype;
  const uniqueFilename = file.filename;
  const fileSize = file.size;
  const relativePath = `storage/attachments/${uniqueFilename}`;

  // Validate uploaded metadata with Zod
  const attachmentMetadataResult = z.object({
    description: z.string().max(500, "A descrição deve ter no máximo 500 caracteres").optional().nullable(),
    filename: z.string().min(1, "Nome do arquivo é inválido"),
    mimeType: z.string().refine(
      (mime) => [
        "image/jpeg", "image/png", "image/webp", "application/pdf", 
        "video/mp4", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ].includes(mime),
      { message: "Tipo de arquivo não permitido." }
    ),
    fileSize: z.number().max(20 * 1024 * 1024, "O tamanho do arquivo excede o limite de 20MB")
  }).safeParse({
    description,
    filename,
    mimeType,
    fileSize
  });

  if (!attachmentMetadataResult.success) {
    try {
      const fullPath = path.join(process.cwd(), relativePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (e) {
      // ignore unlink error
    }
    const errorMsg = attachmentMetadataResult.error.issues.map(err => `${err.path.join(".")}: ${err.message}`).join(", ");
    return res.status(400).json({ error: `Dados de upload inválidos: ${errorMsg}` });
  }

  try {
    // Save to DB
    const result = await execute(`
      INSERT INTO attachments (service_order_id, filename, file_path, file_size, mime_type, description) 
      VALUES (?, ?, ?, ?, ?, ?)`,
      [id, filename, relativePath, fileSize, mimeType, description || null]
    );

    // SQLite compatibility check for inserted ID
    const insertId = result.insertId || result.id || 0;

    return res.json({ 
      success: true, 
      attachment: {
        id: insertId,
        filename,
        file_size: fileSize,
        mime_type: mimeType,
        description: description || null,
        uploaded_at: new Date()
      } 
    });
  } catch (err: any) {
    // Remove orphaned file from storage
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (unlinkErr) {
      console.error("Error removing orphaned file on DB fail:", unlinkErr);
    }
    console.error("Upload attachment database error:", err);
    return res.status(500).json({ error: "Erro interno ao salvar os metadados do anexo no banco de dados." });
  }
});

// Update attachment (e.g. caption / description)
app.put("/api/attachments/:id", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { description } = req.body;

  try {
    const records = await query("SELECT * FROM attachments WHERE id = ?", [id]);
    if (records.length === 0) {
      return res.status(404).json({ error: "Anexo não encontrado" });
    }

    await execute("UPDATE attachments SET description = ? WHERE id = ?", [description !== undefined ? description : null, id]);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("Update attachment error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Delete attachment
app.delete("/api/attachments/:id", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;

  try {
    const records = await query("SELECT * FROM attachments WHERE id = ?", [id]);
    const record = records[0];
    if (!record) {
      return res.status(404).json({ error: "Anexo não encontrado" });
    }

    // Delete physical file
    const absolutePath = path.join(process.cwd(), record.file_path);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    // Delete from DB
    await execute("DELETE FROM attachments WHERE id = ?", [id]);

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Delete attachment error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Download attachment
app.get("/api/attachments/:id", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;

  try {
    const records = await query("SELECT * FROM attachments WHERE id = ?", [id]);
    const record = records[0];
    if (!record) {
      return res.status(404).send("Anexo não encontrado");
    }

    const absolutePath = path.join(process.cwd(), record.file_path);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).send("Arquivo físico não encontrado");
    }

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(record.filename)}"`);
    res.setHeader("Content-Type", record.mime_type);
    return res.sendFile(absolutePath);
  } catch (err) {
    return res.status(500).send("Erro ao processar download");
  }
});

// ==========================================
// 8B. DASHBOARD ENDPOINTS
// ==========================================
app.get("/api/dashboard", requireAuth, async (req: any, res: any) => {
  try {
    // 1. Client count
    const clientsResult = await query("SELECT COUNT(*) as count FROM clients WHERE status = 'ativo'");
    const clientsCount = clientsResult[0]?.count || 0;

    // 2. Equipments in maintenance
    const equipResult = await query("SELECT COUNT(*) as count FROM equipments WHERE status = 'Em manutenção'");
    const equipmentsCount = equipResult[0]?.count || 0;

    // 3. Delayed service orders (not Ready, Delivered, or Cancelled)
    const config = getDatabaseConfig();
    const isSqlite = !config || config.mode === "local" || config.type === "sqlite";

    let delayedResult;
    if (isSqlite) {
      delayedResult = await query(`
        SELECT COUNT(*) as count 
        FROM service_orders 
        WHERE promise_date < datetime('now') 
          AND status_name NOT IN ('Pronta', 'Entregue', 'Cancelada')
      `);
    } else {
      delayedResult = await query(`
        SELECT COUNT(*) as count 
        FROM service_orders 
        WHERE promise_date < NOW() 
          AND status_name NOT IN ('Pronta', 'Entregue', 'Cancelada')
      `);
    }
    const delayedCount = delayedResult[0]?.count || 0;

    // 4. Monthly earnings
    let earningsResult;
    if (isSqlite) {
      earningsResult = await query(`
        SELECT SUM(amount) as total 
        FROM payments 
        WHERE strftime('%m', payment_date) = strftime('%m', 'now') 
          AND strftime('%Y', payment_date) = strftime('%Y', 'now')
      `);
    } else {
      earningsResult = await query(`
        SELECT SUM(amount) as total 
        FROM payments 
        WHERE MONTH(payment_date) = MONTH(CURRENT_DATE()) 
          AND YEAR(payment_date) = YEAR(CURRENT_DATE())
      `);
    }
    const monthlyEarnings = earningsResult[0]?.total || 0;

    // 5. Recent Service Orders
    // 5. Recent Service Orders
    const recentOrders = await query(`
      SELECT o.*, c.name as client_name, c.code as client_code, eq.brand, eq.model
      FROM service_orders o
      JOIN clients c ON o.client_id = c.id
      JOIN equipments eq ON o.equipment_id = eq.id
      ORDER BY o.entry_date DESC
      LIMIT 5
    `);

    // 6. Dynamic Revenue Trend
    const period = req.query.period as string || "6m";
    const groupBy = req.query.groupBy as string || "month";

    const today = new Date();
    let startDate = new Date();
    if (period === "15d") {
      startDate.setDate(today.getDate() - 15);
    } else if (period === "30d") {
      startDate.setDate(today.getDate() - 30);
    } else if (period === "90d") {
      startDate.setDate(today.getDate() - 90);
    } else if (period === "12w") {
      startDate.setDate(today.getDate() - 12 * 7);
    } else if (period === "6m") {
      startDate.setMonth(today.getMonth() - 6);
    } else if (period === "1y") {
      startDate.setFullYear(today.getFullYear() - 1);
    } else {
      startDate.setMonth(today.getMonth() - 6);
    }

    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(today);

    // Query all payments in that range
    const paymentsRaw = await query(
      "SELECT amount, payment_date FROM payments WHERE payment_date >= ? AND payment_date <= ? ORDER BY payment_date ASC",
      [startDateStr, endDateStr]
    );

    const chartData: any[] = [];

    if (groupBy === "day") {
      const current = new Date(startDate);
      while (current <= today) {
        const dateStr = formatDate(current);
        const parts = dateStr.split("-");
        const label = `${parts[2]}/${parts[1]}`;
        chartData.push({
          key: dateStr,
          label: label,
          revenue: 0
        });
        current.setDate(current.getDate() + 1);
      }

      for (const p of paymentsRaw) {
        const pDate = p.payment_date;
        let pDateStr = "";
        if (pDate instanceof Date) {
          pDateStr = formatDate(pDate);
        } else if (typeof pDate === "string") {
          pDateStr = pDate.split(" ")[0];
        }
        const match = chartData.find(d => d.key === pDateStr);
        if (match) {
          match.revenue += parseFloat(p.amount || 0);
        }
      }
    } else if (groupBy === "week") {
      const start = new Date(startDate);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      const alignedStart = new Date(start.setDate(diff));

      const current = new Date(alignedStart);
      while (current <= today) {
        const dateStr = formatDate(current);
        const parts = dateStr.split("-");
        const label = `Sem ${parts[2]}/${parts[1]}`;
        chartData.push({
          key: dateStr,
          label: label,
          revenue: 0
        });
        current.setDate(current.getDate() + 7);
      }

      for (const p of paymentsRaw) {
        const pDate = p.payment_date;
        let pDateStr = "";
        if (pDate instanceof Date) {
          pDateStr = formatDate(pDate);
        } else if (typeof pDate === "string") {
          pDateStr = pDate.split(" ")[0];
        }

        const pDateTime = new Date(pDateStr).getTime();
        let bestWeek: any = null;
        for (const bucket of chartData) {
          const bucketTime = new Date(bucket.key).getTime();
          if (bucketTime <= pDateTime) {
            bestWeek = bucket;
          } else {
            break;
          }
        }
        if (bestWeek) {
          bestWeek.revenue += parseFloat(p.amount || 0);
        }
      }
    } else {
      // month
      const current = new Date(startDate);
      current.setDate(1);

      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

      while (current <= today) {
        const yr = current.getFullYear();
        const mo = current.getMonth();
        const key = `${yr}-${String(mo + 1).padStart(2, "0")}`;
        const label = `${monthNames[mo]}/${String(yr).slice(-2)}`;
        chartData.push({
          key: key,
          label: label,
          revenue: 0
        });
        current.setMonth(current.getMonth() + 1);
      }

      for (const p of paymentsRaw) {
        const pDate = p.payment_date;
        let pDateStr = "";
        if (pDate instanceof Date) {
          pDateStr = formatDate(pDate);
        } else if (typeof pDate === "string") {
          pDateStr = pDate.split(" ")[0];
        }

        if (pDateStr) {
          const parts = pDateStr.split("-");
          const key = `${parts[0]}-${parts[1]}`;
          const match = chartData.find(d => d.key === key);
          if (match) {
            match.revenue += parseFloat(p.amount || 0);
          }
        }
      }
    }

    const revenueTrend = chartData.map(d => ({
      month: d.label,
      label: d.label,
      revenue: d.revenue
    }));

    if (revenueTrend.length === 0) {
      revenueTrend.push({ month: "Mês Atual", label: "Mês Atual", revenue: 0 });
    }

    // 7. Categories distribution
    const categoriesRaw = await query(`
      SELECT ec.name as category, COUNT(o.id) as count
      FROM service_orders o
      JOIN equipments eq ON o.equipment_id = eq.id
      JOIN equipment_categories ec ON eq.category_id = ec.id
      GROUP BY ec.name
    `);

    return res.json({
      stats: {
        clients_total: clientsCount,
        equipments_maintenance: equipmentsCount,
        os_delayed: delayedCount,
        monthly_earnings: parseFloat(monthlyEarnings || 0)
      },
      recent_orders: recentOrders,
      chart_earnings: revenueTrend,
      chart_categories: categoriesRaw
    });
  } catch (err: any) {
    console.error("Dashboard endpoint error:", err);
    return res.json({
      stats: { clients_total: 0, equipments_maintenance: 0, os_delayed: 0, monthly_earnings: 0 },
      recent_orders: [],
      chart_earnings: [{ month: "Mês Atual", revenue: 0 }],
      chart_categories: []
    });
  }
});

// ==========================================
// 9. SETTINGS ENDPOINTS
// ==========================================

async function ensureDefaultStatuses() {
  try {
    const existing = await query("SELECT * FROM service_order_statuses");
    const defaults = [
      { name: "Recebida", position: 1 },
      { name: "Em análise", position: 2 },
      { name: "Aguardando aprovação", position: 3 },
      { name: "Aguardando peça", position: 4 },
      { name: "Em manutenção", position: 5 },
      { name: "Pronta", position: 6 },
      { name: "Entregue", position: 7 },
      { name: "Cancelada", position: 8 }
    ];
    if (existing.length < defaults.length) {
      for (const def of defaults) {
        const found = existing.find(e => e.name.toLowerCase() === def.name.toLowerCase());
        if (!found) {
          await execute("INSERT INTO service_order_statuses (name, position, is_system) VALUES (?, ?, 1)", [def.name, def.position]);
        }
      }
    }
  } catch (err) {
    console.error("Error ensuring default statuses:", err);
  }
}

// Get all settings
app.get("/api/settings", requireAuth, async (req: any, res: any) => {
  try {
    const company = await query("SELECT * FROM company_settings LIMIT 1");
    const system = await query("SELECT * FROM system_settings LIMIT 1");
    const categories = await query("SELECT * FROM equipment_categories ORDER BY name ASC");
    const accessories = await query("SELECT * FROM reception_accessories ORDER BY name ASC");
    const paymentMethods = await query("SELECT * FROM payment_methods ORDER BY id ASC");
    const warrantyRules = await query("SELECT * FROM warranty_rules ORDER BY id ASC");
    
    await ensureDefaultStatuses();
    
    const statuses = await query("SELECT * FROM service_order_statuses ORDER BY position ASC, id ASC");
    const dbConfig = getDatabaseConfig();

    return res.json({
      company: company[0] || { company_name: "PK SIG Assistência" },
      system: system[0] || {},
      categories,
      accessories,
      paymentMethods,
      warrantyRules,
      statuses,
      storage: {
        mode: dbConfig?.mode,
        host: dbConfig?.host,
        port: dbConfig?.port,
        database: dbConfig?.database,
        user: dbConfig?.user,
        ssl: dbConfig?.ssl,
        configDate: dbConfig?.configDate,
        lastTest: dbConfig?.lastTest,
        dbVersion: dbConfig?.dbVersion
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update Company Settings
app.post("/api/settings/company", requireAuth, async (req: any, res: any) => {
  const { company_name, trade_name, tax_id, phone, whatsapp, email, address_text, notes, logo_path } = req.body;

  if (!company_name) {
    return res.status(400).json({ error: "Nome da assistência é obrigatório" });
  }

  try {
    await execute(`
      INSERT INTO company_settings (id, company_name, trade_name, tax_id, phone, whatsapp, email, address_text, notes, logo_path) 
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
      ON DUPLICATE KEY UPDATE 
        company_name=?, trade_name=?, tax_id=?, phone=?, whatsapp=?, email=?, address_text=?, notes=?, logo_path=?`,
      [
        company_name, trade_name || null, tax_id || null, phone || null, whatsapp || null, email || null, address_text || null, notes || null, logo_path || null,
        company_name, trade_name || null, tax_id || null, phone || null, whatsapp || null, email || null, address_text || null, notes || null, logo_path || null
      ]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update System Settings
app.post("/api/settings/system", requireAuth, async (req: any, res: any) => {
  const { system_name, currency, date_format, timezone, records_per_page, prefix_client, prefix_equipment, prefix_os, prefix_guide, prefix_warranty, include_year_in_code, digits_count } = req.body;

  try {
    await execute(`
      INSERT INTO system_settings 
        (id, system_name, currency, date_format, timezone, records_per_page, prefix_client, prefix_equipment, prefix_os, prefix_guide, prefix_warranty, include_year_in_code, digits_count) 
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
      ON DUPLICATE KEY UPDATE 
        system_name=?, currency=?, date_format=?, timezone=?, records_per_page=?, prefix_client=?, prefix_equipment=?, prefix_os=?, prefix_guide=?, prefix_warranty=?, include_year_in_code=?, digits_count=?`,
      [
        system_name, currency, date_format, timezone, records_per_page, prefix_client, prefix_equipment, prefix_os, prefix_guide, prefix_warranty, include_year_in_code ? 1 : 0, digits_count,
        system_name, currency, date_format, timezone, records_per_page, prefix_client, prefix_equipment, prefix_os, prefix_guide, prefix_warranty, include_year_in_code ? 1 : 0, digits_count
      ]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update General Settings (Parameters)
app.put("/api/settings/general", requireAuth, async (req: any, res: any) => {
  const { currency, default_delay_alert_days, default_tax_rate } = req.body;
  try {
    // Ensure columns exist dynamically
    try {
      await execute("ALTER TABLE system_settings ADD COLUMN default_delay_alert_days INT DEFAULT 5");
    } catch (e) {}
    try {
      await execute("ALTER TABLE system_settings ADD COLUMN default_tax_rate DECIMAL(5,2) DEFAULT 0.00");
    } catch (e) {}

    await execute(`
      INSERT INTO system_settings (id, currency, default_delay_alert_days, default_tax_rate)
      VALUES (1, ?, ?, ?)
      ON DUPLICATE KEY UPDATE currency = ?, default_delay_alert_days = ?, default_tax_rate = ?
    `, [
      currency || "R$",
      parseInt(default_delay_alert_days) !== undefined ? parseInt(default_delay_alert_days) : 5,
      parseFloat(default_tax_rate) !== undefined ? parseFloat(default_tax_rate) : 0.0,
      currency || "R$",
      parseInt(default_delay_alert_days) !== undefined ? parseInt(default_delay_alert_days) : 5,
      parseFloat(default_tax_rate) !== undefined ? parseFloat(default_tax_rate) : 0.0
    ]);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("PUT /api/settings/general error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Settings: Add category (with notes support)
app.post("/api/settings/categories", requireAuth, async (req: any, res: any) => {
  const { name, notes } = req.body;
  if (!name) return res.status(400).json({ error: "Nome obrigatório" });

  try {
    try {
      await execute("ALTER TABLE equipment_categories ADD COLUMN notes TEXT");
    } catch (e) {}

    await execute(
      "INSERT INTO equipment_categories (name, notes, active) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE notes = ?, active = 1",
      [name, notes || null, notes || null]
    );
    return res.json({ success: true });
  } catch (err: any) {
    console.error("POST /api/settings/categories error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Settings: Update equipment category
app.put("/api/settings/categories/:id", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { name, notes } = req.body;
  if (!name) return res.status(400).json({ error: "Nome obrigatório" });

  try {
    await execute(
      "UPDATE equipment_categories SET name = ?, notes = ? WHERE id = ?",
      [name, notes || null, id]
    );
    return res.json({ success: true });
  } catch (err: any) {
    console.error("PUT /api/settings/categories/:id error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Settings: Add Payment Method
app.post("/api/settings/payment-methods", requireAuth, async (req: any, res: any) => {
  const { name, max_installments } = req.body;
  if (!name) return res.status(400).json({ error: "Nome obrigatório" });

  try {
    const allows_installments = max_installments > 1 ? 1 : 0;
    await execute(
      "INSERT INTO payment_methods (name, allows_installments, max_installments, active) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE active=1, allows_installments=?, max_installments=?",
      [name, allows_installments, parseInt(max_installments) || 1, allows_installments, parseInt(max_installments) || 1]
    );
    return res.json({ success: true });
  } catch (err: any) {
    console.error("POST /api/settings/payment-methods error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Settings: Add Warranty Rule
app.post("/api/settings/warranty-rules", requireAuth, async (req: any, res: any) => {
  const { name, duration_days, terms_description } = req.body;
  if (!name || !duration_days) return res.status(400).json({ error: "Nome e duração são obrigatórios" });

  try {
    try {
      await execute("ALTER TABLE warranty_rules ADD COLUMN terms_description TEXT");
    } catch (e) {}

    await execute(
      "INSERT INTO warranty_rules (name, duration_days, terms_description, active) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE duration_days = ?, terms_description = ?, active = 1",
      [name, parseInt(duration_days), terms_description || null, parseInt(duration_days), terms_description || null]
    );
    return res.json({ success: true });
  } catch (err: any) {
    console.error("POST /api/settings/warranty-rules error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Settings: Add Accessory
app.post("/api/settings/accessories", requireAuth, async (req: any, res: any) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Nome obrigatório" });

  try {
    await execute("INSERT INTO reception_accessories (name, active) VALUES (?, 1) ON DUPLICATE KEY UPDATE active=1", [name]);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("POST /api/settings/accessories error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Settings: Toggle Active Status Generic Endpoint
app.put("/api/settings/toggle-active", requireAuth, async (req: any, res: any) => {
  const { table, id, active } = req.body;
  const allowedTables = ["equipment_categories", "payment_methods", "warranty_rules", "reception_accessories"];

  if (!allowedTables.includes(table)) {
    return res.status(400).json({ error: "Tabela inválida" });
  }

  try {
    const activeVal = active ? 1 : 0;
    await execute(`UPDATE ?? SET active = ? WHERE id = ?`, [table, activeVal, id]);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("PUT /api/settings/toggle-active error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Settings: Add category
app.post("/api/settings/equipment/categories", requireAuth, async (req: any, res: any) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Nome obrigatório" });

  try {
    await execute("INSERT INTO equipment_categories (name, active) VALUES (?, 1) ON DUPLICATE KEY UPDATE active=1", [name]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Settings: Toggle active category
app.post("/api/settings/equipment/categories/:id/toggle", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { active } = req.body;

  try {
    await execute("UPDATE equipment_categories SET active = ? WHERE id = ?", [active ? 1 : 0, id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Settings: Add accessory
app.post("/api/settings/equipment/accessories", requireAuth, async (req: any, res: any) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Nome obrigatório" });

  try {
    await execute("INSERT INTO reception_accessories (name, active) VALUES (?, 1) ON DUPLICATE KEY UPDATE active=1", [name]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Settings: Toggle active accessory
app.post("/api/settings/equipment/accessories/:id/toggle", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { active } = req.body;

  try {
    await execute("UPDATE reception_accessories SET active = ? WHERE id = ?", [active ? 1 : 0, id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Settings: Add Payment Method
app.post("/api/settings/finance/methods", requireAuth, async (req: any, res: any) => {
  const { name, allows_installments, max_installments, notes } = req.body;
  if (!name) return res.status(400).json({ error: "Nome obrigatório" });

  try {
    await execute(
      "INSERT INTO payment_methods (name, allows_installments, max_installments, notes, active) VALUES (?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE active=1",
      [name, allows_installments ? 1 : 0, parseInt(max_installments) || 1, notes || null]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Settings: Add Warranty Rule
app.post("/api/settings/warranties/rules", requireAuth, async (req: any, res: any) => {
  const { name, duration_days, category_id, service_type } = req.body;
  if (!name || !duration_days) return res.status(400).json({ error: "Nome e duração são obrigatórios" });

  try {
    await execute(
      "INSERT INTO warranty_rules (name, duration_days, category_id, service_type, active) VALUES (?, ?, ?, ?, 1)",
      [name, parseInt(duration_days), category_id || null, service_type || null]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Settings: Save database configuration after authentication verification
app.post("/api/settings/storage/test-and-save", requireAuth, async (req: any, res: any) => {
  const { admin_password, config } = req.body;
  if (!admin_password || !config) {
    return res.status(400).json({ error: "Senha e nova configuração são obrigatórias" });
  }

  try {
    // 1. Verify admin password
    const adminId = req.session.userId;
    const admins = await query("SELECT password_hash FROM admins WHERE id = ?", [adminId]);
    if (!admins[0] || !bcrypt.compareSync(admin_password, admins[0].password_hash)) {
      return res.status(401).json({ error: "Senha de administrador incorreta" });
    }

    // 2. Test Connection
    const test = await testConnection({
      mode: config.mode,
      host: config.host,
      port: parseInt(config.port),
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: !!config.ssl
    });

    if (!test.success) {
      return res.status(400).json({ error: `Falha no teste de conexão: ${test.message}` });
    }

    // 3. Save Config (this recycles current pool)
    saveDatabaseConfig({
      mode: config.mode,
      host: config.host,
      port: parseInt(config.port),
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: !!config.ssl
    });

    return res.json({ success: true, message: "Conectado e salvo com sucesso" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Settings: Security change login profile
app.post("/api/settings/security/update", requireAuth, async (req: any, res: any) => {
  const { name, username, current_password, new_password } = req.body;
  const adminId = req.session.userId;

  if (!current_password) {
    return res.status(400).json({ error: "Sua senha atual é obrigatória para efetuar alterações." });
  }

  try {
    const admins = await query("SELECT * FROM admins WHERE id = ?", [adminId]);
    const admin = admins[0];

    if (!admin || !bcrypt.compareSync(current_password, admin.password_hash)) {
      return res.status(401).json({ error: "Senha atual incorreta" });
    }

    let passHash = admin.password_hash;
    if (new_password) {
      if (new_password.length < 8) {
        return res.status(400).json({ error: "A nova senha deve ter no mínimo 8 caracteres." });
      }
      const salt = bcrypt.genSaltSync(10);
      passHash = bcrypt.hashSync(new_password, salt);
    }

    await execute(
      "UPDATE admins SET name=?, username=?, password_hash=? WHERE id=?",
      [name || admin.name, username || admin.username, passHash, adminId]
    );

    if (new_password) {
      await destroyAllUserSessions(adminId);
      res.clearCookie("session_token", getCookieOptions(req));
    }

    return res.json({ success: true, message: "Perfil de segurança atualizado com sucesso!" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Settings: Fetch security logs (attempts)
app.get("/api/settings/security/logs", requireAuth, async (req: any, res: any) => {
  try {
    const logs = await query("SELECT * FROM login_attempts ORDER BY attempted_at DESC LIMIT 30");
    return res.json(logs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PWA & APP CUSTOMIZATION SERVICES
// ==========================================

// Serve default PWA icon
app.get("/assets/icon.svg", (req: any, res: any) => {
  res.header("Content-Type", "image/svg+xml");
  res.send(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#4f46e5;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#grad)" />
  <circle cx="256" cy="256" r="160" fill="none" stroke="url(#accent)" stroke-width="24" />
  <circle cx="256" cy="256" r="110" fill="url(#accent)" opacity="0.15" />
  <g transform="translate(192, 160)" stroke="url(#accent)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M128,128 L128,152" />
    <rect x="16" y="0" width="96" height="192" rx="16" stroke="#ffffff" stroke-width="20" />
    <line x1="48" y1="160" x2="80" y2="160" stroke="#ffffff" stroke-width="12" />
  </g>
  <circle cx="256" cy="225" r="32" fill="#ffffff" />
  <path d="M240,225 L252,237 L272,217" stroke="#4f46e5" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none" />
</svg>
  `.trim());
});

// Serve Service Worker dynamically
app.get("/sw.js", (req: any, res: any) => {
  res.header("Content-Type", "application/javascript");
  res.header("Service-Worker-Allowed", "/");
  res.send(`
    const CACHE_NAME = 'pksig-cache-v1';
    const ASSETS_TO_CACHE = [
      '/',
      '/index.html',
      '/manifest.json',
      '/assets/icon.svg'
    ];

    self.addEventListener('install', event => {
      event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
          return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
      );
    });

    self.addEventListener('activate', event => {
      event.waitUntil(
        caches.keys().then(keys => {
          return Promise.all(
            keys.map(key => {
              if (key !== CACHE_NAME) {
                return caches.delete(key);
              }
            })
          );
        }).then(() => self.clients.claim())
      );
    });

    self.addEventListener('fetch', event => {
      // Avoid intercepting API calls or dynamic posts
      if (event.request.url.includes('/api/') || event.request.method !== 'GET') {
        return;
      }
      event.respondWith(
        fetch(event.request)
          .catch(() => {
            return caches.match(event.request);
          })
      );
    });
  `.trim());
});

// Serve Manifest dynamically
app.get("/manifest.json", async (req: any, res: any) => {
  try {
    let systemName = "PK SIG";
    let pwaName = "PK SIG - Gestão de OS";
    let pwaShortName = "PK SIG";
    let pwaDesc = "Sistema de Gestão de Ordens de Serviço";
    let themeColor = "#0e131f";
    let bgColor = "#ffffff";
    let display = "standalone";
    let iconUrl = "/assets/icon.svg";

    if (isDatabaseConfigured()) {
      const system = await query("SELECT * FROM system_settings LIMIT 1");
      if (system && system.length > 0) {
        const sys = system[0];
        systemName = sys.system_name || systemName;
        pwaName = sys.pwa_name || sys.system_name || pwaName;
        pwaShortName = sys.pwa_short_name || sys.system_name || pwaShortName;
        pwaDesc = sys.pwa_description || pwaDesc;
        themeColor = sys.pwa_theme_color || themeColor;
        bgColor = sys.pwa_background_color || bgColor;
        display = sys.pwa_display || display;
        if (sys.pwa_icon_url) {
          iconUrl = sys.pwa_icon_url;
        }
      }
    }

    const manifest = {
      name: pwaName,
      short_name: pwaShortName,
      description: pwaDesc,
      start_url: "/",
      display: display,
      background_color: bgColor,
      theme_color: themeColor,
      orientation: "any",
      icons: [
        {
          src: iconUrl,
          sizes: "192x192",
          type: iconUrl.startsWith("data:image/") ? iconUrl.split(";")[0].split(":")[1] : "image/svg+xml",
          purpose: "any maskable"
        },
        {
          src: iconUrl,
          sizes: "512x512",
          type: iconUrl.startsWith("data:image/") ? iconUrl.split(";")[0].split(":")[1] : "image/svg+xml",
          purpose: "any maskable"
        }
      ]
    };

    res.header("Content-Type", "application/json");
    return res.send(JSON.stringify(manifest, null, 2));
  } catch (err) {
    const manifest = {
      name: "PK SIG - Gestão de OS",
      short_name: "PK SIG",
      description: "Sistema de Gestão de Ordens de Serviço",
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#0e131f",
      icons: [
        {
          src: "/assets/icon.svg",
          sizes: "192x192",
          type: "image/svg+xml",
          purpose: "any maskable"
        }
      ]
    };
    res.header("Content-Type", "application/json");
    return res.send(JSON.stringify(manifest, null, 2));
  }
});

// Update PWA Settings
app.post("/api/settings/pwa", requireAuth, async (req: any, res: any) => {
  const { pwa_name, pwa_short_name, pwa_description, pwa_theme_color, pwa_background_color, pwa_display, pwa_icon_url } = req.body;

  try {
    const existing = await query("SELECT id FROM system_settings WHERE id = 1");
    if (!existing || existing.length === 0) {
      await execute("INSERT INTO system_settings (id) VALUES (1)");
    }

    await execute(`
      UPDATE system_settings SET 
        pwa_name = ?, 
        pwa_short_name = ?, 
        pwa_description = ?, 
        pwa_theme_color = ?, 
        pwa_background_color = ?, 
        pwa_display = ?, 
        pwa_icon_url = ? 
      WHERE id = 1`,
      [
        pwa_name || null,
        pwa_short_name || null,
        pwa_description || null,
        pwa_theme_color || "#0e131f",
        pwa_background_color || "#ffffff",
        pwa_display || "standalone",
        pwa_icon_url || null
      ]
    );

    return res.json({ success: true, message: "Configurações do PWA salvas com sucesso!" });
  } catch (err: any) {
    console.error("POST /api/settings/pwa error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Helper migration function to add PWA columns to system_settings dynamically
async function ensurePwaColumns() {
  try {
    if (!isDatabaseConfigured()) return;

    // Check if columns exist
    const pwaColumns = [
      { name: "pwa_name", type: "VARCHAR(255) NULL" },
      { name: "pwa_short_name", type: "VARCHAR(100) NULL" },
      { name: "pwa_description", type: "TEXT NULL" },
      { name: "pwa_theme_color", type: "VARCHAR(50) DEFAULT '#0e131f'" },
      { name: "pwa_background_color", type: "VARCHAR(50) DEFAULT '#ffffff'" },
      { name: "pwa_display", type: "VARCHAR(50) DEFAULT 'standalone'" },
      { name: "pwa_icon_url", type: "LONGTEXT NULL" }
    ];

    const dbConfig = getDatabaseConfig();
    const isMysql = dbConfig?.mode === "remoto";

    if (isMysql) {
      for (const col of pwaColumns) {
        try {
          // MySQL schema check and alter
          const checkQuery = `SHOW COLUMNS FROM system_settings LIKE '${col.name}'`;
          const cols = await query(checkQuery);
          if (!cols || cols.length === 0) {
            await execute(`ALTER TABLE system_settings ADD COLUMN ${col.name} ${col.type}`);
            console.log(`Added column ${col.name} to system_settings (MySQL)`);
          }
        } catch (e) {
          // Silently swallow
        }
      }
    } else {
      // SQLite: fetch columns of system_settings
      try {
        const cols = await query("PRAGMA table_info(system_settings)");
        if (cols && cols.length > 0) {
          const colNames = cols.map((c: any) => c.name);
          for (const col of pwaColumns) {
            if (!colNames.includes(col.name)) {
              await execute(`ALTER TABLE system_settings ADD COLUMN ${col.name} ${col.type}`);
              console.log(`Added column ${col.name} to system_settings (SQLite)`);
            }
          }
        }
      } catch (e) {
        // Table system_settings doesn't exist yet, ignore
      }
    }
  } catch (err) {
    console.error("Error ensuring PWA columns on system_settings:", err);
  }
}

async function ensureFinancialTables() {
  try {
    if (!isDatabaseConfigured()) return;

    const dbConfig = getDatabaseConfig();
    const isMysql = dbConfig?.mode === "remoto";

    // 1. Check or create financial_categories
    let hasCategoriesTable = false;
    try {
      await query("SELECT 1 FROM financial_categories LIMIT 1");
      hasCategoriesTable = true;
    } catch (e) {
      // Table doesn't exist
    }

    if (!hasCategoriesTable) {
      console.log("Creating financial_categories table...");
      if (isMysql) {
        await execute(`
          CREATE TABLE financial_categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            type ENUM('entrada', 'saida') NOT NULL,
            active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
      } else {
        await execute(`
          CREATE TABLE financial_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }

      // Seed default categories
      const defaults = [
        ["Serviço de OS", "entrada"],
        ["Venda de Produto", "entrada"],
        ["Outras Receitas", "entrada"],
        ["Compra de Peças", "saida"],
        ["Aluguel / Condomínio", "saida"],
        ["Salários e Pró-labore", "saida"],
        ["Energia / Água / Internet", "saida"],
        ["Impostos e Taxas", "saida"],
        ["Outras Despesas", "saida"]
      ];
      for (const [name, type] of defaults) {
        await execute(
          "INSERT INTO financial_categories (name, type, active) VALUES (?, ?, 1)",
          [name, type]
        );
      }
      console.log("financial_categories table created and seeded.");
    }

    // 2. Check or create financial_transactions
    let hasTransactionsTable = false;
    try {
      await query("SELECT 1 FROM financial_transactions LIMIT 1");
      hasTransactionsTable = true;
    } catch (e) {
      // Table doesn't exist
    }

    if (!hasTransactionsTable) {
      console.log("Creating financial_transactions table...");
      if (isMysql) {
        await execute(`
          CREATE TABLE financial_transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            description VARCHAR(255) NOT NULL,
            type ENUM('entrada', 'saida') NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            transaction_date DATE NOT NULL,
            category_id INT,
            os_id INT NULL,
            payment_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES financial_categories(id) ON DELETE SET NULL,
            FOREIGN KEY (os_id) REFERENCES service_orders(id) ON DELETE SET NULL
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
      } else {
        await execute(`
          CREATE TABLE financial_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            type TEXT NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            transaction_date TEXT NOT NULL,
            category_id INTEGER,
            os_id INTEGER NULL,
            payment_id INTEGER NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES financial_categories(id) ON DELETE SET NULL,
            FOREIGN KEY (os_id) REFERENCES service_orders(id) ON DELETE SET NULL
          )
        `);
      }
      console.log("financial_transactions table created.");
    }
  } catch (err) {
    console.error("Error in ensureFinancialTables:", err);
  }
}

// Ensure payment_id column exists on financial_transactions for backward compatibility
async function ensureFinancialTransactionsPaymentIdColumn() {
  try {
    if (!isDatabaseConfigured()) return;
    const dbConfig = getDatabaseConfig();
    const isMysql = dbConfig?.mode === "remoto";
    try {
      if (isMysql) {
        const columns = await query("SHOW COLUMNS FROM financial_transactions LIKE 'payment_id'");
        if (!columns || columns.length === 0) {
          await execute("ALTER TABLE financial_transactions ADD COLUMN payment_id INT NULL");
          console.log("Added payment_id column to financial_transactions (MySQL)");
        }
      } else {
        const columns = await query("PRAGMA table_info(financial_transactions)");
        if (columns && columns.length > 0) {
          const hasCol = columns.some((col: any) => col.name === "payment_id");
          if (!hasCol) {
            await execute("ALTER TABLE financial_transactions ADD COLUMN payment_id INTEGER NULL");
            console.log("Added payment_id column to financial_transactions (SQLite)");
          }
        }
      }
    } catch (e) {
      // Column already exists or table doesn't exist, ignore
    }
  } catch (err) {
    console.error("Error ensuring payment_id column in financial_transactions:", err);
  }
}

// ==========================================
// VITE & FRONTEND BOOTSTRAP
// ==========================================
async function ensureAttachmentsDescriptionColumn() {
  try {
    if (!isDatabaseConfigured()) return;
    const dbConfig = getDatabaseConfig();
    const isMysql = dbConfig?.mode === "remoto";

    try {
      if (isMysql) {
        const columns = await query("SHOW COLUMNS FROM attachments LIKE 'description'");
        if (!columns || columns.length === 0) {
          await execute("ALTER TABLE attachments ADD COLUMN description TEXT NULL");
          console.log("Added description column to attachments table (MySQL)");
        }
      } else {
        const columns = await query("PRAGMA table_info(attachments)");
        if (columns && columns.length > 0) {
          const hasCol = columns.some((col: any) => col.name === "description");
          if (!hasCol) {
            await execute("ALTER TABLE attachments ADD COLUMN description TEXT NULL");
            console.log("Added description column to attachments table (SQLite)");
          }
        }
      }
    } catch (e) {
      // Ignore
    }
  } catch (err) {
    console.error("Error checking or adding description column to attachments:", err);
  }
}

async function ensureAdminSessionsTable() {
  try {
    if (!isDatabaseConfigured()) return;
    const dbConfig = getDatabaseConfig();
    const isMysql = dbConfig?.mode === "remoto";

    // Try querying the admin_sessions table to see if it exists
    try {
      await query("SELECT 1 FROM admin_sessions LIMIT 1");
    } catch (e) {
      console.log("Creating admin_sessions table...");
      if (isMysql) {
        await execute(`
          CREATE TABLE admin_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            admin_id INT NOT NULL,
            token_hash VARCHAR(64) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            ip_address VARCHAR(45) NULL,
            user_agent TEXT NULL,
            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
            INDEX idx_sessions_token_hash (token_hash)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
      } else {
        await execute(`
          CREATE TABLE admin_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT,
            user_agent TEXT,
            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
          )
        `);
        try {
          await execute(`CREATE INDEX idx_sessions_token_hash ON admin_sessions(token_hash)`);
        } catch (indexErr) {
          // Index might already exist
        }
      }
      console.log("admin_sessions table checked/created successfully.");
    }
  } catch (err) {
    console.error("Error checking or creating admin_sessions table:", err);
  }
}

async function startServer() {
  // Run automatic database schema verification and repair if configured
  if (isDatabaseConfigured()) {
    try {
      const repairRes = await verifyAndRepairDatabaseSchema();
      if (repairRes.success) {
        console.log("Database integrity verification completed successfully.");
      } else {
        console.warn("Database integrity verification warning:", repairRes.message);
      }
    } catch (err: any) {
      console.error("Database integrity and repair failed during startup:", err.message);
    }
  } else {
    console.log("Database is not configured yet. Skipping schema verification on startup.");
  }

  // Periodically clean expired sessions every hour
  setInterval(() => {
    cleanExpiredSessions().catch((err) => console.error("Error cleaning expired sessions:", err));
  }, 60 * 60 * 1000);

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: any, res: any) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PK SIG backend running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
