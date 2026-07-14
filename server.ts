import express from "express";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
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
  cloneDatabase,
  verifyDatabaseCompatibility
} from "./src/lib/database.js";
import { 
  createSession, 
  getSession, 
  destroySession, 
  cleanExpiredSessions 
} from "./src/lib/session.js";

const app = express();
const PORT = 3000;

// Increase JSON payload limit to support base64 attachments
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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

// Authentication middleware
async function requireAuth(req: any, res: any, next: any) {
  const token = req.cookies.session_token;
  if (!token) {
    return res.status(401).json({ error: "Sessão expirada ou não autenticada" });
  }

  const session = getSession(token);
  if (!session) {
    res.clearCookie("session_token", { sameSite: "none", secure: true, httpOnly: true });
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

    return res.json({
      configured: true,
      connected: true,
      hasAdmin: admins.length > 0,
      mode: config?.mode,
      host: config?.host,
      database: config?.database,
      user: config?.user,
      companyName,
      tradeName
    });
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
app.post("/api/setup/test-connection", async (req: any, res: any) => {
  const { mode, host, port, database, user, password, ssl } = req.body;
  if (mode !== "local" && (!host || !port || !database || !user)) {
    return res.status(400).json({ error: "Todos os campos de conexão são obrigatórios" });
  }

  const testResult = await testConnection({
    mode,
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
app.post("/api/setup/create-database", async (req: any, res: any) => {
  const { mode, host, port, database, user, password, ssl } = req.body;
  if (mode !== "local" && (!host || !port || !database || !user)) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes" });
  }

  const result = await createDatabaseAutomatically({
    mode,
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
app.post("/api/setup/verify-compatibility", async (req: any, res: any) => {
  const { mode, host, port, database, user, password, ssl, certificate } = req.body;
  if (mode !== "local" && (!host || !port || !database || !user)) {
    return res.status(400).json({ error: "Todos os campos de conexão são obrigatórios" });
  }

  const result = await verifyDatabaseCompatibility({
    mode,
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
app.post("/api/setup/install", async (req: any, res: any) => {
  const { connection, admin, company, useExistingDb } = req.body;
  if (!connection || !admin) {
    return res.status(400).json({ error: "Configurações de conexão e administrador são obrigatórias" });
  }

  try {
    // 1. Save Config First
    saveDatabaseConfig({
      mode: connection.mode,
      host: connection.mode === "local" ? "localhost" : connection.host,
      port: connection.mode === "local" ? 0 : parseInt(connection.port),
      database: connection.mode === "local" ? "pksig.db" : connection.database,
      user: connection.mode === "local" ? "local" : connection.user,
      password: connection.mode === "local" ? "" : connection.password,
      ssl: connection.mode === "local" ? false : !!connection.ssl
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

// Clone database endpoint (online <-> local)
app.post("/api/database/clone", requireAuth, async (req: any, res: any) => {
  const { direction, customRemoteConfig } = req.body;
  if (!direction || (direction !== "remote-to-local" && direction !== "local-to-remote")) {
    return res.status(400).json({ error: "Direção de clonagem inválida" });
  }

  try {
    const result = await cloneDatabase(direction, customRemoteConfig);
    if (result.success) {
      return res.json(result);
    } else {
      return res.status(500).json({ error: result.message });
    }
  } catch (err: any) {
    console.error("Database clone error:", err);
    return res.status(500).json({ error: err.message || "Erro interno ao clonar" });
  }
});

// Get database configuration
app.get("/api/database/config", requireAuth, (req: any, res: any) => {
  const config = getDatabaseConfig();
  if (!config) {
    return res.status(404).json({ error: "Banco de dados não configurado" });
  }
  const responseConfig = { ...config };
  delete responseConfig.password;
  return res.json(responseConfig);
});

// Update active database mode or configuration
app.post("/api/database/config", requireAuth, async (req: any, res: any) => {
  const { mode, host, port, database, user, password, ssl, certificate } = req.body;
  if (!mode || (mode !== "local" && mode !== "remoto")) {
    return res.status(400).json({ error: "Modo de banco de dados inválido. Escolha 'local' ou 'remoto'." });
  }

  try {
    const currentConfig = getDatabaseConfig() || {
      mode: "local",
      host: "localhost",
      port: 0,
      database: "pksig.db",
      user: "local",
      ssl: false
    };

    if (mode === "local") {
      saveDatabaseConfig({
        ...currentConfig,
        mode: "local"
      });
    } else {
      const newConfig: any = {
        ...currentConfig,
        mode: "remoto"
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
    }

    return res.json({ success: true, message: `Banco de dados configurado para o modo ${mode === "local" ? "Local (SQLite)" : "Remoto (MySQL)"} com sucesso!` });
  } catch (err: any) {
    console.error("Failed to save database config:", err);
    return res.status(500).json({ error: err.message || "Erro ao salvar configurações do banco de dados" });
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
app.post("/api/auth/login", async (req: any, res: any) => {
  const { username, password } = req.body;
  const ip = req.ip || "127.0.0.1";

  if (!username || !password) {
    return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
  }

  if (!isDatabaseConfigured()) {
    return res.status(400).json({ error: "Sistema não configurado. Por favor, faça o setup." });
  }

  try {
    // Basic rate limit check: count failures in last 5 mins
    const recentFailures = await query(
      "SELECT COUNT(*) as failures FROM login_attempts WHERE username = ? AND success = 0 AND attempted_at > NOW() - INTERVAL 5 MINUTE",
      [username]
    );
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
    const token = createSession(admin.id, admin.username, admin.name);

    // Set secure cookie for iframe compatibility in AI Studio preview
    res.cookie("session_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

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
app.post("/api/auth/logout", (req: any, res: any) => {
  const token = req.cookies.session_token;
  if (token) {
    destroySession(token);
  }
  res.clearCookie("session_token", { sameSite: "none", secure: true, httpOnly: true });
  return res.json({ success: true, message: "Logout efetuado com sucesso" });
});

// Me (Session status)
app.get("/api/auth/me", async (req: any, res: any) => {
  const token = req.cookies.session_token;
  if (!token) {
    return res.json({ authenticated: false });
  }

  const session = getSession(token);
  if (!session) {
    res.clearCookie("session_token", { sameSite: "none", secure: true, httpOnly: true });
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

// ==========================================
// Helper: Sequential Code Generators
// ==========================================
async function generateNextCode(type: "client" | "equipment" | "os" | "guide" | "warranty"): Promise<string> {
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
  let table = "";
  if (type === "client") {
    prefix = settings.prefix_client;
    table = "clients";
  } else if (type === "equipment") {
    prefix = settings.prefix_equipment;
    table = "equipments";
  } else if (type === "os") {
    prefix = settings.prefix_os;
    table = "service_orders";
  } else if (type === "guide") {
    prefix = settings.prefix_guide;
    table = "payment_guides";
  } else if (type === "warranty") {
    prefix = settings.prefix_warranty;
    table = "warranties";
  }

  const yearSuffix = settings.include_year_in_code ? `-${new Date().getFullYear()}` : "";
  
  // Find current count
  const countResult = await query(`SELECT COUNT(*) as total FROM ${table}`);
  const nextNumber = (countResult[0]?.total || 0) + 1;
  const paddedNumber = String(nextNumber).padStart(settings.digits_count, "0");

  return `${prefix}${yearSuffix}-${paddedNumber}`;
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
app.post("/api/clients", requireAuth, async (req: any, res: any) => {
  const { 
    type, name, cpf_cnpj, rg_ie, responsible, birth_date, 
    email, phone, whatsapp, zip_code, street, number, 
    complement, neighborhood, city, state, notes 
  } = req.body;

  if (!type || !name || !cpf_cnpj) {
    return res.status(400).json({ error: "Tipo, nome e CPF/CNPJ são obrigatórios" });
  }

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
app.post("/api/equipment", requireAuth, async (req: any, res: any) => {
  const { client_id, category_id, brand, model, serial_number, imei, asset_tag, responsible, color, notes, status } = req.body;

  if (!client_id || !category_id || !brand || !model) {
    return res.status(400).json({ error: "Cliente, categoria, marca e modelo são obrigatórios" });
  }

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
    
    // Dynamically resolve status_id for 'Recebida' to prevent FK failures
    const statuses = await query("SELECT id, name FROM service_order_statuses WHERE name = 'Recebida'");
    let targetStatusId = statuses[0]?.id;
    let targetStatusName = statuses[0]?.name || "Recebida";

    if (!targetStatusId) {
      const anyStatus = await query("SELECT id, name FROM service_order_statuses ORDER BY position ASC, id ASC LIMIT 1");
      if (anyStatus[0]) {
        targetStatusId = anyStatus[0].id;
        targetStatusName = anyStatus[0].name;
      } else {
        const insStatus = await execute("INSERT INTO service_order_statuses (name, position, is_system) VALUES ('Recebida', 1, 1)");
        targetStatusId = insStatus.insertId;
        targetStatusName = "Recebida";
      }
    }

    const result = await execute(`
      INSERT INTO service_orders 
        (client_id, equipment_id, code, technician_name, status_id, status_name, problem_reported, reception_equipment_state, reception_notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [client_id, equipment_id, code, technician_name || "Suporte TI (Administrador)", targetStatusId, targetStatusName, problem_reported, reception_equipment_state || null, reception_notes || null]
    );

    const osId = result.insertId;

    // Save accessories
    if (accessories && Array.isArray(accessories)) {
      for (const acc of accessories) {
        if (acc) {
          await execute("INSERT INTO service_order_accessories (service_order_id, accessory_name) VALUES (?, ?)", [osId, acc]);
        }
      }
    }

    // Update equipment status to "Em manutenção"
    await execute("UPDATE equipments SET status = 'Em manutenção' WHERE id = ?", [equipment_id]);

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

async function recalculateGuidePayments(guideId: number) {
  // 1. Get the guide
  const guides = await query("SELECT * FROM payment_guides WHERE id = ?", [guideId]);
  const guide = guides[0];
  if (!guide) return;

  // 2. Get all payments for this guide in chronological/insert order
  const payments = await query("SELECT * FROM payments WHERE payment_guide_id = ? ORDER BY id ASC", [guideId]);

  // 3. Reset all installments of this guide
  await execute(
    "UPDATE payment_installments SET paid_amount = 0, paid_date = NULL, status = 'Pendente' WHERE payment_guide_id = ?",
    [guideId]
  );

  // 4. Reset installments list in memory so we can update them
  const installments = await query("SELECT * FROM payment_installments WHERE payment_guide_id = ? ORDER BY installment_number ASC", [guideId]);

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
    await execute(
      "UPDATE payment_installments SET paid_amount = ?, paid_date = ?, status = ? WHERE id = ?",
      [inst.paid_amount, inst.paid_date || null, inst.status, inst.id]
    );
  }

  // 7. Calculate new total paid, balance, and status for the guide
  const totalPaid = payments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
  const guideTotalAmount = parseFloat(guide.total_amount) || 0;
  const newBalance = Math.max(0, +(guideTotalAmount - totalPaid).toFixed(2));
  const newStatus = newBalance <= 0 ? "Quitada" : (totalPaid > 0 ? "Parcial" : "Pendente");

  await execute(
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
    const guides = await query("SELECT * FROM payment_guides WHERE id = ?", [id]);
    const guide = guides[0];
    if (!guide) {
      return res.status(404).json({ error: "Guia de pagamento não encontrada" });
    }

    if (guide.status === "Cancelada") {
      return res.status(400).json({ error: "Esta guia foi cancelada" });
    }

    const methods = await query("SELECT name FROM payment_methods WHERE id = ?", [method_id]);
    const methodName = methods[0]?.name || "Outro";

    // 1. Log Payment
    await execute(`
      INSERT INTO payments (payment_guide_id, installment_id, amount, payment_date, method_id, method_name, notes) 
      VALUES (?, ?, ?, CURRENT_DATE(), ?, ?, ?)`,
      [id, installment_id || null, paymentAmount, method_id, methodName, notes || null]
    );

    // 2. Recalculate
    await recalculateGuidePayments(parseInt(id));

    // Get updated info
    const updatedGuides = await query("SELECT * FROM payment_guides WHERE id = ?", [id]);
    const updatedGuide = updatedGuides[0];

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
// 8. ATTACHMENT ENDPOINTS (Base64 uploads)
// ==========================================

app.post("/api/service-orders/:id/attachments", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { filename, fileBase64, mimeType, description } = req.body;

  if (!filename || !fileBase64 || !mimeType) {
    return res.status(400).json({ error: "Dados do anexo incompletos" });
  }

  try {
    // Strip header from base64 if present
    const base64Data = fileBase64.replace(/^data:.*?;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    
    // Save physical file
    const uniqueFilename = `${Date.now()}-${filename}`;
    const filePath = path.join(ATTACHMENTS_DIR, uniqueFilename);
    fs.writeFileSync(filePath, buffer);

    // Save to DB
    const result = await execute(`
      INSERT INTO attachments (service_order_id, filename, file_path, file_size, mime_type, description) 
      VALUES (?, ?, ?, ?, ?, ?)`,
      [id, filename, `storage/attachments/${uniqueFilename}`, buffer.length, mimeType, description || null]
    );

    return res.json({ 
      success: true, 
      attachment: {
        id: result.insertId,
        filename,
        file_size: buffer.length,
        mime_type: mimeType,
        description: description || null,
        uploaded_at: new Date()
      } 
    });
  } catch (err: any) {
    console.error("Upload attachment error:", err);
    return res.status(500).json({ error: err.message });
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
    const delayedResult = await query(`
      SELECT COUNT(*) as count 
      FROM service_orders 
      WHERE promise_date < NOW() 
        AND status_name NOT IN ('Pronta', 'Entregue', 'Cancelada')
    `);
    const delayedCount = delayedResult[0]?.count || 0;

    // 4. Monthly earnings
    const earningsResult = await query(`
      SELECT SUM(amount) as total 
      FROM payments 
      WHERE MONTH(payment_date) = MONTH(CURRENT_DATE()) 
        AND YEAR(payment_date) = YEAR(CURRENT_DATE())
    `);
    const monthlyEarnings = earningsResult[0]?.total || 0;

    // 5. Recent Service Orders
    const recentOrders = await query(`
      SELECT o.*, c.name as client_name, c.code as client_code, eq.brand, eq.model
      FROM service_orders o
      JOIN clients c ON o.client_id = c.id
      JOIN equipments eq ON o.equipment_id = eq.id
      ORDER BY o.entry_date DESC
      LIMIT 5
    `);

    // 6. Revenue Trend (last 6 months)
    const revenueTrendRaw = await query(`
      SELECT MONTHNAME(payment_date) as month_name, MONTH(payment_date) as month_num, SUM(amount) as amount
      FROM payments
      WHERE payment_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
      GROUP BY month_num, month_name
      ORDER BY month_num ASC
    `);
    const revenueTrend = revenueTrendRaw.map((r: any) => ({
      month: r.month_name || `Mês ${r.month_num}`,
      revenue: parseFloat(r.amount || 0)
    }));

    if (revenueTrend.length === 0) {
      revenueTrend.push({ month: "Mês Atual", revenue: 0 });
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

    for (const col of pwaColumns) {
      try {
        if (isMysql) {
          // MySQL schema check and alter
          const checkQuery = `SHOW COLUMNS FROM system_settings LIKE '${col.name}'`;
          const cols = await query(checkQuery);
          if (!cols || cols.length === 0) {
            await execute(`ALTER TABLE system_settings ADD COLUMN ${col.name} ${col.type}`);
            console.log(`Added column ${col.name} to system_settings (MySQL)`);
          }
        } else {
          // SQLite simple try/catch alter
          await execute(`ALTER TABLE system_settings ADD COLUMN ${col.name} ${col.type}`);
          console.log(`Added column ${col.name} to system_settings (SQLite)`);
        }
      } catch (e) {
        // Silently swallow if column already exists
      }
    }
  } catch (err) {
    console.error("Error ensuring PWA columns on system_settings:", err);
  }
}

// ==========================================
// VITE & FRONTEND BOOTSTRAP
// ==========================================
async function ensureAttachmentsDescriptionColumn() {
  try {
    if (!isDatabaseConfigured()) return;
    const columns = await query("SHOW COLUMNS FROM attachments LIKE 'description'");
    if (columns && columns.length === 0) {
      await execute("ALTER TABLE attachments ADD COLUMN description TEXT NULL");
      console.log("Added description column to attachments table");
    }
  } catch (err) {
    console.error("Error checking or adding description column to attachments:", err);
  }
}

async function startServer() {
  // Ensure table migration
  await ensureAttachmentsDescriptionColumn();
  await ensurePwaColumns();

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
