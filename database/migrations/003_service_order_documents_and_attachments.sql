-- Migration 003: Service Order Document Snapshots & Attachment Classification
-- Target: MySQL 8.0+ / MariaDB

-- 1. Upgrade attachments table
ALTER TABLE attachments 
  ADD COLUMN category VARCHAR(50) NULL,
  ADD COLUMN uploaded_by INT NULL,
  ADD COLUMN file_hash VARCHAR(64) NULL;

-- 2. Service Order Document Snapshots table
CREATE TABLE IF NOT EXISTS service_order_document_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_order_id INT NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    snapshot_json LONGTEXT NOT NULL,
    content_hash VARCHAR(64) NULL,
    generated_by VARCHAR(255) NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    service_order_status VARCHAR(100) NULL,
    FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE CASCADE,
    INDEX idx_doc_so_type (service_order_id, document_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
