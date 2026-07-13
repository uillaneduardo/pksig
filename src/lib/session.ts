import crypto from "crypto";

interface SessionData {
  userId: number;
  username: string;
  name: string;
  createdAt: number;
  expiresAt: number;
}

// In-memory server-side session store
const sessionStore: Map<string, SessionData> = new Map();

// Session duration: 24 hours
const SESSION_DURATION = 24 * 60 * 60 * 1000;

export function createSession(userId: number, username: string, name: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  sessionStore.set(token, {
    userId,
    username,
    name,
    createdAt: now,
    expiresAt: now + SESSION_DURATION,
  });
  return token;
}

export function getSession(token: string): SessionData | null {
  const session = sessionStore.get(token);
  if (!session) {
    return null;
  }

  // Check expiration
  if (Date.now() > session.expiresAt) {
    sessionStore.delete(token);
    return null;
  }

  return session;
}

export function destroySession(token: string): void {
  sessionStore.delete(token);
}

export function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of sessionStore.entries()) {
    if (now > session.expiresAt) {
      sessionStore.delete(token);
    }
  }
}

export function clearAllSessions(): void {
  sessionStore.clear();
}
