import crypto from "crypto";
import { query, execute } from "./database.js";

export interface SessionData {
  userId: number;
  username: string;
  name: string;
  createdAt: number;
  expiresAt: number;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function formatDatetime(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

// Session duration: 24 hours
const SESSION_DURATION = 24 * 60 * 60 * 1000;

export async function createSession(
  userId: number,
  username: string,
  name: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION);

  await execute(
    `INSERT INTO admin_sessions (admin_id, token_hash, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)`,
    [userId, tokenHash, formatDatetime(expiresAt), ipAddress || null, userAgent || null]
  );

  return token;
}

export async function getSession(token: string): Promise<SessionData | null> {
  if (!token) return null;
  try {
    const tokenHash = hashToken(token);
    const nowStr = formatDatetime(new Date());

    const sessions = await query(
      `SELECT s.*, a.username, a.name 
       FROM admin_sessions s
       JOIN admins a ON s.admin_id = a.id
       WHERE s.token_hash = ? AND s.expires_at > ?
       LIMIT 1`,
      [tokenHash, nowStr]
    );

    if (!sessions || sessions.length === 0) {
      return null;
    }

    const s = sessions[0];

    // Update last_activity_at to prevent premature cleanup
    await execute(
      `UPDATE admin_sessions SET last_activity_at = ? WHERE id = ?`,
      [formatDatetime(new Date()), s.id]
    );

    return {
      userId: s.admin_id,
      username: s.username,
      name: s.name,
      createdAt: new Date(s.created_at).getTime(),
      expiresAt: new Date(s.expires_at).getTime(),
    };
  } catch (err) {
    console.warn("Failed to retrieve session from database (this is normal if system is not setup):", err);
    return null;
  }
}

export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  const tokenHash = hashToken(token);
  await execute(`DELETE FROM admin_sessions WHERE token_hash = ?`, [tokenHash]);
}

export async function destroyAllUserSessions(adminId: number): Promise<void> {
  await execute(`DELETE FROM admin_sessions WHERE admin_id = ?`, [adminId]);
}

export async function cleanExpiredSessions(): Promise<void> {
  const nowStr = formatDatetime(new Date());
  await execute(`DELETE FROM admin_sessions WHERE expires_at <= ?`, [nowStr]);
}

export async function clearAllSessions(): Promise<void> {
  await execute(`DELETE FROM admin_sessions`);
}
