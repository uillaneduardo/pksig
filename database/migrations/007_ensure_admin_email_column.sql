-- Migration 007: Ensure email column and index exist on admins table
-- Target: MySQL 8.0+ / MariaDB

-- 1. Ensure email column exists on admins table
ALTER TABLE admins ADD COLUMN email VARCHAR(255) NULL;

-- 2. Ensure phone column exists on admins table
ALTER TABLE admins ADD COLUMN phone VARCHAR(50) NULL;

-- 3. Create index for fast email lookups
CREATE INDEX idx_admins_email ON admins (email);
