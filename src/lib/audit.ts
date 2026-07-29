import { execute } from "./database.js";

export interface LogAdminActionParams {
  adminId?: number | null;
  action: string;
  entityType?: string | null;
  entityId?: string | number | null;
  description: string;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
  try {
    const {
      adminId = null,
      action,
      entityType = null,
      entityId = null,
      description,
      metadata = null,
      ipAddress = null,
      userAgent = null,
    } = params;

    // Filter out sensitive fields if present in metadata
    let sanitizedMetadata = metadata ? { ...metadata } : null;
    if (sanitizedMetadata) {
      delete sanitizedMetadata.password;
      delete sanitizedMetadata.password_hash;
      delete sanitizedMetadata.current_password;
      delete sanitizedMetadata.new_password;
      delete sanitizedMetadata.confirmPassword;
      delete sanitizedMetadata.token;
      delete sanitizedMetadata.token_hash;
      delete sanitizedMetadata.resetToken;
      delete sanitizedMetadata.session_token;
      delete sanitizedMetadata.admin_password;
    }

    const metadataJson = sanitizedMetadata ? JSON.stringify(sanitizedMetadata) : null;
    const strEntityId = entityId !== null && entityId !== undefined ? String(entityId) : null;

    await execute(
      `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, description, metadata, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        adminId || null,
        action,
        entityType || null,
        strEntityId,
        description,
        metadataJson,
        ipAddress || null,
        userAgent ? userAgent.substring(0, 500) : null,
      ]
    );
  } catch (err) {
    console.error("Failed to log admin action:", err);
    // Non-blocking: audit log failure should not crash the main business process
  }
}
