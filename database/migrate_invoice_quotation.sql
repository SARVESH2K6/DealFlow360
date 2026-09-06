-- Migration: Add quotation_id to invoices, drop deal_health table
-- Run this against your dealflow360 database

-- 1. Add quotation_id column to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS quotation_id VARCHAR(50) REFERENCES quotations(id) ON DELETE SET NULL;

-- 2. Drop deal_health table (feature removed)
DROP TABLE IF EXISTS deal_health CASCADE;

-- Done!
