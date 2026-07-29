-- Migration 008: Repair and Ensure service_order_document_snapshots Table and Columns
-- Target: MySQL 8.0+ / MariaDB

-- 1. Ensure service_order_document_snapshots table exists
CREATE TABLE IF NOT EXISTS service_order_document_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_order_id INT NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    snapshot_json LONGTEXT NOT NULL,
    content_hash VARCHAR(64) NULL,
    generated_by VARCHAR(255) NULL,
    generated_by_name VARCHAR(255) NULL,
    generated_by_admin_id INT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    service_order_status VARCHAR(100) NULL,
    FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE CASCADE,
    INDEX idx_doc_so_type (service_order_id, document_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add columns if missing for existing tables
ALTER TABLE service_order_document_snapshots ADD COLUMN generated_by_admin_id INT NULL;
ALTER TABLE service_order_document_snapshots ADD COLUMN generated_by_name VARCHAR(255) NULL;
