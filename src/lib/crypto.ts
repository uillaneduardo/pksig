import crypto from "crypto";
import fs from "fs";
import path from "path";

const KEY_FILE = path.join(process.cwd(), "storage", "config", "app.key");

// Ensure key exists
function getOrCreateAppKey(): Buffer {
  const dir = path.dirname(KEY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(KEY_FILE)) {
    const keyHex = fs.readFileSync(KEY_FILE, "utf8").trim();
    if (keyHex.length === 64) {
      return Buffer.from(keyHex, "hex");
    }
  }

  // Create new key
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key.toString("hex"), "utf8");
  return key;
}

export function encrypt(text: string): string {
  try {
    const key = getOrCreateAppKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return `${iv.toString("hex")}:${encrypted}`;
  } catch (err) {
    console.error("Encryption error:", err);
    throw new Error("Erro ao criptografar dados");
  }
}

export function decrypt(cipherText: string): string {
  try {
    const key = getOrCreateAppKey();
    const [ivHex, encryptedHex] = cipherText.split(":");
    if (!ivHex || !encryptedHex) {
      throw new Error("Formato de criptografia inválido");
    }
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted, undefined, "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Decryption error:", err);
    throw new Error("Erro ao descriptografar dados. Verifique a chave do aplicativo.");
  }
}
