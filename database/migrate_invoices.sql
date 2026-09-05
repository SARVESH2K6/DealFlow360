-- Migration: Add missing invoice columns for InvoiceDocument.tsx and invoicePdf.ts
-- Run this against your dealflow360 database

-- 1. Add the missing columns
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issued_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS region VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS approved_by JSONB NOT NULL DEFAULT '[]';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_recorded_by JSONB;

-- 2. Populate existing rows with real data (matching store.js seed)

UPDATE invoices SET
  issued_date = '2026-08-21',
  terms = 'Net 30',
  region = 'North America',
  items = '[{"description":"Edge Gateway Pro","qty":8,"unitPrice":8900,"amount":71200},{"description":"Committed remainder — site install","qty":1,"unitPrice":27056,"amount":27056}]'::jsonb,
  approved_by = '[{"name":"Jordan Chen","role":"manager","roleLabel":"Sales Manager"}]'::jsonb,
  payment_recorded_by = NULL
WHERE id = 'inv-2201';

UPDATE invoices SET
  issued_date = '2026-07-16',
  terms = 'Net 45',
  region = 'EMEA',
  items = '[{"description":"Industrial Sensor Array","qty":3,"unitPrice":12500,"amount":37500},{"description":"Commissioning visit","qty":1,"unitPrice":6600,"amount":6600}]'::jsonb,
  approved_by = '[{"name":"Jordan Chen","role":"manager","roleLabel":"Sales Manager"},{"name":"Sam Patel","role":"finance","roleLabel":"Finance"}]'::jsonb,
  payment_recorded_by = '{"name":"Alex Rivera","role":"rep","roleLabel":"Sales Rep"}'::jsonb
WHERE id = 'inv-2198';

UPDATE invoices SET
  issued_date = '2026-08-18',
  terms = 'Net 15',
  region = 'North America',
  items = '[{"description":"Spare Parts Kit","qty":10,"unitPrice":2016,"amount":20160}]'::jsonb,
  approved_by = '[{"name":"Policy engine","role":"system","roleLabel":"Within-limit auto-approval"}]'::jsonb,
  payment_recorded_by = NULL
WHERE id = 'inv-2194';

UPDATE invoices SET
  issued_date = '2026-07-02',
  terms = 'Net 30',
  region = 'North America',
  items = '[{"description":"Predictive Maintenance Suite — annual","qty":1,"unitPrice":19200,"amount":19200}]'::jsonb,
  approved_by = '[{"name":"Jordan Chen","role":"manager","roleLabel":"Sales Manager"}]'::jsonb,
  payment_recorded_by = '{"name":"Alex Rivera","role":"rep","roleLabel":"Sales Rep"}'::jsonb
WHERE id = 'inv-2188';

-- Done!
