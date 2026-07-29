-- Migration 002: Evolution of Admin Profile, Security, Password Recovery & Audit Logging
-- Target: MySQL 8.0+ / MariaDB

-- 1. Upgrade admins table
ALTER TABLE admins ADD COLUMN email VARCHAR(255) NULL;
ALTER TABLE admins ADD COLUMN phone VARCHAR(50) NULL;
ALTER TABLE admins ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE admins ADD COLUMN email_verified_at TIMESTAMP NULL;
ALTER TABLE admins ADD COLUMN password_changed_at TIMESTAMP NULL;

-- Unique index for email (allowing NULLs for existing legacy records)
CREATE UNIQUE INDEX uq_admins_email ON admins (email);

-- 2. Password Reset Tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Admin Audit Logs table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
