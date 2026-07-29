-- Migration 006: Standardize admins table to use active TINYINT(1) column exclusively
-- Target: MySQL 8.0+ / MariaDB

-- 1. Ensure active column exists on admins table
ALTER TABLE admins ADD COLUMN IF NOT EXISTS active TINYINT(1) NOT NULL DEFAULT 1;

-- 2. Note: Migration of legacy values ('active' -> 1, 'inactive'/'disabled' -> 0)
-- and safe dropping of the status column (if present) is handled in database startup
-- routines (src/lib/database.ts) to guarantee cross-version compatibility.
