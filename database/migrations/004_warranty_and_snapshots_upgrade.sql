-- Migration 004: Warranty Rule FK and Snapshots Admin Tracking
-- Target: MySQL 8.0+ / MariaDB

-- 1. Add warranty_rule_id to warranties
ALTER TABLE warranties ADD COLUMN warranty_rule_id INT NULL;

-- 2. Add admin tracking columns to service_order_document_snapshots
ALTER TABLE service_order_document_snapshots ADD COLUMN generated_by_admin_id INT NULL;
ALTER TABLE service_order_document_snapshots ADD COLUMN generated_by_name VARCHAR(255) NULL;
