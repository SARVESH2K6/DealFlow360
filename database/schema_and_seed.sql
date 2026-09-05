-- =============================================================================
-- DealFlow360 - PostgreSQL Schema + Seed Data
-- Derived from server/store.js
-- Run this file in psql or pgAdmin Query Tool against your target database.
-- =============================================================================


-- =============================================================================
-- SECTION 1: DROP TABLES (clean slate - safe to re-run)
-- =============================================================================

DROP TABLE IF EXISTS activity                     CASCADE;
DROP TABLE IF EXISTS portal_messages              CASCADE;
DROP TABLE IF EXISTS deal_health                  CASCADE;
DROP TABLE IF EXISTS invoice_lines                CASCADE;
DROP TABLE IF EXISTS invoices                     CASCADE;
DROP TABLE IF EXISTS subscription_recurring_lines CASCADE;
DROP TABLE IF EXISTS subscription_onetime_lines   CASCADE;
DROP TABLE IF EXISTS subscriptions                CASCADE;
DROP TABLE IF EXISTS fulfillment_suggested        CASCADE;
DROP TABLE IF EXISTS fulfillment_lines            CASCADE;
DROP TABLE IF EXISTS fulfillment_orders           CASCADE;
DROP TABLE IF EXISTS approval_audit_log           CASCADE;
DROP TABLE IF EXISTS approvals                    CASCADE;
DROP TABLE IF EXISTS quotation_lines              CASCADE;
DROP TABLE IF EXISTS quotations                   CASCADE;
DROP TABLE IF EXISTS stock                        CASCADE;
DROP TABLE IF EXISTS pricelist_rules              CASCADE;
DROP TABLE IF EXISTS pricelists                   CASCADE;
DROP TABLE IF EXISTS product_variants             CASCADE;
DROP TABLE IF EXISTS products                     CASCADE;
DROP TABLE IF EXISTS discount_category_ceilings   CASCADE;
DROP TABLE IF EXISTS discount_tier_discounts      CASCADE;
DROP TABLE IF EXISTS discount_approval_chain      CASCADE;
DROP TABLE IF EXISTS discount_thresholds          CASCADE;
DROP TABLE IF EXISTS users                        CASCADE;
DROP TABLE IF EXISTS customers                    CASCADE;


-- =============================================================================
-- SECTION 2: CREATE TABLES
-- =============================================================================

-- customers
CREATE TABLE customers (
    id          VARCHAR(50)  PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    tier        VARCHAR(20)  NOT NULL CHECK (tier IN ('Bronze','Silver','Gold')),
    region      VARCHAR(100) NOT NULL,
    terms       VARCHAR(50)  NOT NULL
);

-- users
CREATE TABLE users (
    id           VARCHAR(50)  PRIMARY KEY,
    email        VARCHAR(255) NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,
    name         VARCHAR(255) NOT NULL,
    role         VARCHAR(20)  NOT NULL CHECK (role IN ('rep','manager','finance','admin','customer')),
    customer_id  VARCHAR(50)  REFERENCES customers(id) ON DELETE SET NULL
);

-- products
CREATE TABLE products (
    id              VARCHAR(50)   PRIMARY KEY,
    name            VARCHAR(255)  NOT NULL,
    category        VARCHAR(20)   NOT NULL CHECK (category IN ('Hardware','Services')),
    price           NUMERIC(12,2) NOT NULL,
    unit            VARCHAR(50)   NOT NULL,
    tax_percent     NUMERIC(5,2)  NOT NULL DEFAULT 0,
    status          VARCHAR(20)   NOT NULL DEFAULT 'active',
    description     TEXT,
    is_subscription BOOLEAN       NOT NULL DEFAULT FALSE,
    cycle           VARCHAR(20),
    quantity        INTEGER
);

-- product_variants
CREATE TABLE product_variants (
    id          VARCHAR(50)   PRIMARY KEY,
    product_id  VARCHAR(50)   NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute   VARCHAR(100)  NOT NULL,
    values      VARCHAR(255)  NOT NULL,
    extra_price NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- pricelists
CREATE TABLE pricelists (
    id       VARCHAR(50)  PRIMARY KEY,
    name     VARCHAR(255) NOT NULL,
    currency VARCHAR(10)  NOT NULL
);

-- pricelist_rules
CREATE TABLE pricelist_rules (
    id           SERIAL       PRIMARY KEY,
    pricelist_id VARCHAR(50)  NOT NULL REFERENCES pricelists(id) ON DELETE CASCADE,
    tier         VARCHAR(20)  NOT NULL,
    currency     VARCHAR(10)  NOT NULL,
    price_rule   VARCHAR(100) NOT NULL
);

-- stock
CREATE TABLE stock (
    id           SERIAL        PRIMARY KEY,
    warehouse    VARCHAR(100)  NOT NULL,
    product_id   VARCHAR(50)   NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_name VARCHAR(255)  NOT NULL,
    in_stock     INTEGER       NOT NULL DEFAULT 0,
    reserved     INTEGER       NOT NULL DEFAULT 0
);

-- discount_tier_discounts
CREATE TABLE discount_tier_discounts (
    id           VARCHAR(50)  PRIMARY KEY,
    tier         VARCHAR(20)  NOT NULL,
    max_discount NUMERIC(5,2) NOT NULL
);

-- discount_category_ceilings
CREATE TABLE discount_category_ceilings (
    id           VARCHAR(50)  PRIMARY KEY,
    category     VARCHAR(50)  NOT NULL,
    max_discount NUMERIC(5,2) NOT NULL
);

-- discount_approval_chain
CREATE TABLE discount_approval_chain (
    id       VARCHAR(50)  PRIMARY KEY,
    range    VARCHAR(100) NOT NULL,
    routing  VARCHAR(100) NOT NULL,
    trigger  VARCHAR(20)  NOT NULL
);

-- discount_thresholds (single-row config)
CREATE TABLE discount_thresholds (
    id      SERIAL       PRIMARY KEY,
    medium  NUMERIC(5,2) NOT NULL,
    high    NUMERIC(5,2) NOT NULL
);

-- quotations
CREATE TABLE quotations (
    id                      VARCHAR(50)   PRIMARY KEY,
    number                  VARCHAR(20)   NOT NULL UNIQUE,
    customer_id             VARCHAR(50)   NOT NULL REFERENCES customers(id),
    customer_name           VARCHAR(255),
    customer_tier           VARCHAR(20),
    date                    TIMESTAMPTZ   NOT NULL,
    rep_id                  VARCHAR(50)   REFERENCES users(id),
    rep_name                VARCHAR(255),
    status                  VARCHAR(30)   NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','pending_approval','negotiation','approved','confirmed','rejected')),
    portal_status           VARCHAR(30),
    currency                VARCHAR(10)   NOT NULL DEFAULT 'USD',
    region                  VARCHAR(100),
    terms                   VARCHAR(50),
    price_list_id           VARCHAR(50)   REFERENCES pricelists(id),
    amount                  NUMERIC(14,2) NOT NULL DEFAULT 0,
    risk_score              INTEGER       NOT NULL DEFAULT 0,
    risk_level              VARCHAR(10)   NOT NULL DEFAULT 'LOW'
                                CHECK (risk_level IN ('LOW','MEDIUM','HIGH')),
    blended_risk            NUMERIC(6,2)  NOT NULL DEFAULT 0,
    flag_reasons            JSONB,
    requested_delivery_date DATE
);

-- quotation_lines
CREATE TABLE quotation_lines (
    id               VARCHAR(50)   PRIMARY KEY,
    quotation_id     VARCHAR(50)   NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id       VARCHAR(50)   REFERENCES products(id),
    product_name     VARCHAR(255)  NOT NULL,
    category         VARCHAR(20)   NOT NULL,
    qty              INTEGER       NOT NULL DEFAULT 1,
    price            NUMERIC(12,2) NOT NULL,
    discount_percent NUMERIC(5,2)  NOT NULL DEFAULT 0,
    counter_discount NUMERIC(5,2),
    comment          TEXT,
    line_limit       NUMERIC(5,2),
    line_status      VARCHAR(10)
);

-- approvals
CREATE TABLE approvals (
    id            VARCHAR(50) PRIMARY KEY,
    quotation_id  VARCHAR(50) NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    status        VARCHAR(20) NOT NULL CHECK (status IN ('pending','approved','returned','rejected')),
    stage         VARCHAR(30) NOT NULL,
    assigned_to   VARCHAR(255),
    assigned_role VARCHAR(20),
    days_pending  INTEGER     NOT NULL DEFAULT 0
);

-- approval_audit_log
CREATE TABLE approval_audit_log (
    id          SERIAL       PRIMARY KEY,
    approval_id VARCHAR(50)  NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
    user_name   VARCHAR(255) NOT NULL,
    user_id     VARCHAR(50),
    action      VARCHAR(100) NOT NULL,
    date        TIMESTAMPTZ  NOT NULL,
    note        TEXT
);

-- fulfillment_orders
CREATE TABLE fulfillment_orders (
    id             VARCHAR(50)  PRIMARY KEY,
    quotation_id   VARCHAR(50)  REFERENCES quotations(id),
    order_number   VARCHAR(30)  NOT NULL,
    customer_id    VARCHAR(50)  REFERENCES customers(id),
    customer_name  VARCHAR(255),
    status         VARCHAR(30)  NOT NULL,
    warehouse      VARCHAR(100),
    split_accepted BOOLEAN      NOT NULL DEFAULT FALSE,
    overridden     BOOLEAN      NOT NULL DEFAULT FALSE
);

-- fulfillment_lines
CREATE TABLE fulfillment_lines (
    id             SERIAL       PRIMARY KEY,
    fulfillment_id VARCHAR(50)  NOT NULL REFERENCES fulfillment_orders(id) ON DELETE CASCADE,
    product_id     VARCHAR(50)  REFERENCES products(id),
    product_name   VARCHAR(255) NOT NULL,
    qty            INTEGER      NOT NULL
);

-- fulfillment_suggested (warehouse splits per line)
CREATE TABLE fulfillment_suggested (
    id                  SERIAL        PRIMARY KEY,
    fulfillment_line_id INTEGER       NOT NULL REFERENCES fulfillment_lines(id) ON DELETE CASCADE,
    warehouse           VARCHAR(100)  NOT NULL,
    qty_fulfilled       INTEGER       NOT NULL DEFAULT 0,
    est_shipments       INTEGER       NOT NULL DEFAULT 1,
    cost                NUMERIC(10,2) NOT NULL DEFAULT 0,
    available           INTEGER       NOT NULL DEFAULT 0
);

-- subscriptions
CREATE TABLE subscriptions (
    id                   VARCHAR(50)   PRIMARY KEY,
    customer_id          VARCHAR(50)   REFERENCES customers(id),
    customer_name        VARCHAR(255),
    plan                 VARCHAR(255)  NOT NULL,
    cycle                VARCHAR(20)   NOT NULL,
    next_bill            DATE,
    amount               NUMERIC(12,2) NOT NULL DEFAULT 0,
    status               VARCHAR(20)   NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','paused','cancelled')),
    originating_order_id VARCHAR(50)   REFERENCES quotations(id) ON DELETE SET NULL
);

-- subscription_onetime_lines
CREATE TABLE subscription_onetime_lines (
    id              SERIAL        PRIMARY KEY,
    subscription_id VARCHAR(50)   NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    product_name    VARCHAR(255)  NOT NULL,
    qty             INTEGER       NOT NULL DEFAULT 1,
    amount          NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- subscription_recurring_lines
CREATE TABLE subscription_recurring_lines (
    id              SERIAL        PRIMARY KEY,
    subscription_id VARCHAR(50)   NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    plan            VARCHAR(255)  NOT NULL,
    cycle           VARCHAR(20)   NOT NULL,
    next_bill_date  VARCHAR(30),
    amount          NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- invoices
CREATE TABLE invoices (
    id                   VARCHAR(50)   PRIMARY KEY,
    number               VARCHAR(30)   NOT NULL UNIQUE,
    customer_id          VARCHAR(50)   REFERENCES customers(id),
    customer_name        VARCHAR(255),
    amount               NUMERIC(12,2) NOT NULL DEFAULT 0,
    status               VARCHAR(20)   NOT NULL CHECK (status IN ('unpaid','paid','overdue')),
    issued_date          DATE,
    due_date             DATE,
    terms                VARCHAR(50),
    region               VARCHAR(100),
    step                 VARCHAR(20),
    note                 TEXT,
    items                JSONB         NOT NULL DEFAULT '[]',
    approved_by          JSONB         NOT NULL DEFAULT '[]',
    payment_recorded_by  JSONB
);

-- invoice_lines
CREATE TABLE invoice_lines (
    id         SERIAL        PRIMARY KEY,
    invoice_id VARCHAR(50)   NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    number     VARCHAR(30),
    amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    status     VARCHAR(20),
    due_date   DATE
);

-- deal_health
CREATE TABLE deal_health (
    id           VARCHAR(50)  PRIMARY KEY,
    deal         VARCHAR(255) NOT NULL,
    quotation_id VARCHAR(50)  REFERENCES quotations(id) ON DELETE CASCADE,
    issue        TEXT,
    flagged      TIMESTAMPTZ,
    type         VARCHAR(20)  NOT NULL CHECK (type IN ('stalled','anomaly','slippage')),
    escalated    BOOLEAN      NOT NULL DEFAULT FALSE,
    nudged       BOOLEAN      NOT NULL DEFAULT FALSE
);

-- portal_messages
CREATE TABLE portal_messages (
    id           VARCHAR(50)  PRIMARY KEY,
    customer_id  VARCHAR(50)  REFERENCES customers(id),
    quotation_id VARCHAR(50)  REFERENCES quotations(id) ON DELETE CASCADE,
    from_name    VARCHAR(255) NOT NULL,
    body         TEXT         NOT NULL,
    date         TIMESTAMPTZ  NOT NULL
);

-- activity
CREATE TABLE activity (
    id        VARCHAR(100) PRIMARY KEY,
    text      TEXT         NOT NULL,
    timestamp TIMESTAMPTZ  NOT NULL
);


-- =============================================================================
-- SECTION 3: SEED DATA
-- (matches server/store.js seed() exactly)
-- =============================================================================

-- customers
INSERT INTO customers (id, name, tier, region, terms) VALUES
  ('c-acme',     'Acme Corp',           'Gold',   'North America', 'Net 30'),
  ('c-globex',   'Globex Industries',   'Silver', 'EMEA',          'Net 45'),
  ('c-initech',  'Initech',             'Bronze', 'North America', 'Net 15'),
  ('c-umbrella', 'Umbrella LLC',        'Gold',   'APAC',          'Net 30'),
  ('c-stark',    'Stark Manufacturing', 'Silver', 'North America', 'Net 30');

-- users (password: "password" - use bcrypt hashes in production!)
INSERT INTO users (id, email, password, name, role, customer_id) VALUES
  ('u-rep',   'ivan.p@example.net',   'password', 'Alex Rivera',  'rep',      NULL),
  ('u-mgr',   'olivia.t@example.org', 'password', 'Jordan Chen',  'manager',  NULL),
  ('u-fin',   'quinn.m@example.net',  'password', 'Sam Patel',    'finance',  NULL),
  ('u-adm',   'beth.t@example.com',   'password', 'Taylor Kim',   'admin',    NULL),
  ('u-cust1', 'marco.r@example.org',  'password', 'Riley Hart',   'customer', 'c-acme'),
  ('u-cust2', 'uma.s@example.org',    'password', 'Casey Nguyen', 'customer', 'c-globex');

-- products
INSERT INTO products (id, name, category, price, unit, tax_percent, status, description, is_subscription, cycle, quantity) VALUES
  ('p-sensor',  'Industrial Sensor Array',      'Hardware', 12500, 'unit',       8, 'active', 'Factory-floor sensor pack with 24-month hardware warranty.',        FALSE, NULL,      NULL),
  ('p-gateway', 'Edge Gateway Pro',             'Hardware',  8900, 'unit',       8, 'active', 'On-prem edge appliance for plant telemetry.',                        FALSE, NULL,      NULL),
  ('p-maint',   'Predictive Maintenance Suite', 'Services', 24000, 'seat',       0, 'active', 'Recurring analytics suite billed at the start of each cycle.',      TRUE,  'annual',  1),
  ('p-install', 'Onsite Installation',          'Services',  4500, 'engagement', 0, 'active', 'Certified field install and commissioning.',                         FALSE, NULL,      NULL),
  ('p-support', '24/7 Support Retainer',        'Services', 18000, 'year',       0, 'active', 'Named-engineer retainer, billed at period start.',                  TRUE,  'annual',  1),
  ('p-spares',  'Spare Parts Kit',              'Hardware',  2100, 'kit',        8, 'active', 'Critical spares for first-year coverage.',                           FALSE, NULL,      NULL);

-- product_variants
INSERT INTO product_variants (id, product_id, attribute, values, extra_price) VALUES
  ('v1', 'p-sensor',  'Range',      '50m / 120m',       900),
  ('v2', 'p-sensor',  'Housing',    'Standard / IP67',  400),
  ('v3', 'p-gateway', 'Throughput', '1Gb / 10Gb',      1200),
  ('v4', 'p-maint',   'Tier',       'Standard / Plus', 6000);

-- pricelists
INSERT INTO pricelists (id, name, currency) VALUES
  ('pl-usd', 'Standard USD', 'USD'),
  ('pl-eur', 'EMEA EUR',     'EUR');

INSERT INTO pricelist_rules (pricelist_id, tier, currency, price_rule) VALUES
  ('pl-usd', 'Bronze', 'USD', 'List'),
  ('pl-usd', 'Silver', 'USD', 'List - 3%'),
  ('pl-usd', 'Gold',   'USD', 'List - 6%'),
  ('pl-eur', 'Bronze', 'EUR', 'List x 0.92'),
  ('pl-eur', 'Silver', 'EUR', 'List x 0.89'),
  ('pl-eur', 'Gold',   'EUR', 'List x 0.86');

-- stock
INSERT INTO stock (warehouse, product_id, product_name, in_stock, reserved) VALUES
  ('East DC',    'p-sensor',  'Industrial Sensor Array', 42, 8),
  ('East DC',    'p-gateway', 'Edge Gateway Pro',        18, 6),
  ('East DC',    'p-spares',  'Spare Parts Kit',         60, 4),
  ('West DC',    'p-sensor',  'Industrial Sensor Array', 11, 9),
  ('West DC',    'p-gateway', 'Edge Gateway Pro',         7, 7),
  ('West DC',    'p-spares',  'Spare Parts Kit',         22, 2),
  ('Central DC', 'p-sensor',  'Industrial Sensor Array', 28, 3),
  ('Central DC', 'p-gateway', 'Edge Gateway Pro',        14, 1),
  ('Central DC', 'p-spares',  'Spare Parts Kit',         40, 0);

-- discount config
INSERT INTO discount_tier_discounts (id, tier, max_discount) VALUES
  ('td-bronze', 'Bronze',  8),
  ('td-silver', 'Silver', 12),
  ('td-gold',   'Gold',   18);

INSERT INTO discount_category_ceilings (id, category, max_discount) VALUES
  ('cc-hw', 'Hardware', 15),
  ('cc-sv', 'Services', 25);

INSERT INTO discount_approval_chain (id, range, routing, trigger) VALUES
  ('ac-1', 'Within limit',               'No approval',               'within'),
  ('ac-2', 'Over limit - blended medium','Sales Manager',              'medium'),
  ('ac-3', 'Over limit - blended high',  'Sales Manager then Finance', 'high');

INSERT INTO discount_thresholds (medium, high) VALUES (0, 4);

-- quotations (amount/risk computed by app; seeded as 0 here)
INSERT INTO quotations (id, number, customer_id, customer_name, customer_tier, date, rep_id, rep_name, status, portal_status, currency, region, terms, price_list_id, amount, risk_score, risk_level, blended_risk, requested_delivery_date) VALUES
  ('q-1042','Q-1042','c-acme',    'Acme Corp',           'Gold',  '2026-09-01 14:12:00+00','u-rep','Alex Rivera','pending_approval',NULL,               'USD','North America','Net 30','pl-usd',0,0,'LOW',0,NULL),
  ('q-1043','Q-1043','c-globex',  'Globex Industries',   'Silver','2026-09-04 11:12:00+00','u-rep','Alex Rivera','draft',           NULL,               'EUR','EMEA',         'Net 45','pl-eur',0,0,'LOW',0,NULL),
  ('q-1044','Q-1044','c-initech', 'Initech',             'Bronze','2026-08-24 09:12:00+00','u-rep','Alex Rivera','approved',        NULL,               'USD','North America','Net 15','pl-usd',0,0,'LOW',0,NULL),
  ('q-1045','Q-1045','c-acme',    'Acme Corp',           'Gold',  '2026-09-03 16:12:00+00','u-rep','Alex Rivera','negotiation',     'under_negotiation','USD','North America','Net 30','pl-usd',0,0,'LOW',0,'2026-10-12'),
  ('q-1046','Q-1046','c-stark',   'Stark Manufacturing', 'Silver','2026-08-18 13:12:00+00','u-rep','Alex Rivera','confirmed',       NULL,               'USD','North America','Net 30','pl-usd',0,0,'LOW',0,NULL),
  ('q-1047','Q-1047','c-umbrella','Umbrella LLC',        'Gold',  '2026-08-30 08:12:00+00','u-rep','Alex Rivera','pending_approval',NULL,               'USD','APAC',         'Net 30','pl-usd',0,0,'LOW',0,NULL),
  ('q-1048','Q-1048','c-globex',  'Globex Industries',   'Silver','2026-08-27 15:12:00+00','u-rep','Alex Rivera','confirmed',       NULL,               'EUR','EMEA',         'Net 45','pl-eur',0,0,'LOW',0,NULL);

-- quotation_lines
INSERT INTO quotation_lines (id, quotation_id, product_id, product_name, category, qty, price, discount_percent, counter_discount, comment) VALUES
  ('l-1042-1','q-1042','p-sensor', 'Industrial Sensor Array',     'Hardware', 6,12500,22,NULL,''),
  ('l-1042-2','q-1042','p-maint',  'Predictive Maintenance Suite', 'Services', 1,24000,20,NULL,''),
  ('l-1042-3','q-1042','p-install','Onsite Installation',          'Services', 2, 4500, 5,NULL,''),
  ('l-1043-1','q-1043','p-gateway','Edge Gateway Pro',             'Hardware', 4, 8900, 6,NULL,''),
  ('l-1044-1','q-1044','p-spares', 'Spare Parts Kit',             'Hardware',10, 2100, 4,NULL,''),
  ('l-1045-1','q-1045','p-sensor', 'Industrial Sensor Array',     'Hardware', 8,12500,16,19, 'Need better pricing to match incumbent.'),
  ('l-1045-2','q-1045','p-support','24/7 Support Retainer',       'Services', 1,18000,10,12, ''),
  ('l-1046-1','q-1046','p-gateway','Edge Gateway Pro',             'Hardware',12, 8900, 8,NULL,''),
  ('l-1046-2','q-1046','p-install','Onsite Installation',          'Services', 3, 4500, 0,NULL,''),
  ('l-1047-1','q-1047','p-maint',  'Predictive Maintenance Suite', 'Services', 2,24000,19,NULL,''),
  ('l-1048-1','q-1048','p-sensor', 'Industrial Sensor Array',     'Hardware', 3,12500, 9,NULL,''),
  ('l-1048-2','q-1048','p-spares', 'Spare Parts Kit',             'Hardware', 6, 2100, 5,NULL,'');

-- approvals
INSERT INTO approvals (id, quotation_id, status, stage, assigned_to, assigned_role, days_pending) VALUES
  ('a-1042','q-1042','pending',  'sales_manager','Jordan Chen','manager',2),
  ('a-1045','q-1045','pending',  'sales_manager','Jordan Chen','manager',1),
  ('a-1047','q-1047','pending',  'finance',      'Sam Patel',  'finance',4),
  ('a-1044','q-1044','approved', 'confirmed',    '--',         'none',   0);

-- approval_audit_log
INSERT INTO approval_audit_log (approval_id, user_name, user_id, action, date, note) VALUES
  ('a-1042','Alex Rivera','u-rep',  'Submitted',    '2026-09-03 14:12:00+00','Gold account - requested aggressive hardware discount to close this quarter.'),
  ('a-1045','Alex Rivera','u-rep',  'Submitted',    '2026-09-03 16:12:00+00','Sent to Acme for review.'),
  ('a-1045','Riley Hart', 'u-cust1','Negotiation',  '2026-09-04 09:12:00+00','Customer requested 19% on sensors and delivery by 12 Oct 2026.'),
  ('a-1047','Alex Rivera','u-rep',  'Submitted',    '2026-08-30 08:12:00+00','Services-heavy deal for APAC gold account.'),
  ('a-1047','Jordan Chen','u-mgr',  'Approved',     '2026-09-01 11:12:00+00','Commercial fit is sound. Routing to Finance for blended-high review.'),
  ('a-1044','Alex Rivera','u-rep',  'Submitted',    '2026-08-24 09:12:00+00','Within policy.'),
  ('a-1044','System',     'system', 'Auto-approved','2026-08-24 09:12:00+00','All lines within tier and category limits.');

-- fulfillment_orders
INSERT INTO fulfillment_orders (id, quotation_id, order_number, customer_id, customer_name, status, warehouse) VALUES
  ('f-1046','q-1046','SO-1046','c-stark', 'Stark Manufacturing','split_pending','West DC'),
  ('f-1048','q-1048','SO-1048','c-globex','Globex Industries',  'backorder',    'East DC'),
  ('f-1044','q-1044','SO-1044','c-initech','Initech',           'ready',        'East DC');

-- fulfillment_lines
INSERT INTO fulfillment_lines (id, fulfillment_id, product_id, product_name, qty) VALUES
  (1,'f-1046','p-gateway','Edge Gateway Pro',       12),
  (2,'f-1046','p-install','Onsite Installation',     3),
  (3,'f-1048','p-sensor', 'Industrial Sensor Array', 3),
  (4,'f-1048','p-spares', 'Spare Parts Kit',         6),
  (5,'f-1044','p-spares', 'Spare Parts Kit',        10);

-- Reset sequence so future inserts don't collide with explicit IDs above
SELECT setval(pg_get_serial_sequence('fulfillment_lines','id'), 10);

-- fulfillment_suggested
INSERT INTO fulfillment_suggested (fulfillment_line_id, warehouse, qty_fulfilled, est_shipments, cost, available) VALUES
  (1,'West DC',    0,1,210, 0),
  (1,'East DC',    8,1,340,12),
  (1,'Central DC', 4,1,180,13),
  (2,'Services desk',3,1,  0,99),
  (3,'East DC',    2,1,120,34),
  (3,'Central DC', 1,1, 95,25),
  (4,'East DC',    6,1, 80,56),
  (5,'East DC',   10,1, 90,56);

-- subscriptions
INSERT INTO subscriptions (id, customer_id, customer_name, plan, cycle, next_bill, amount, status, originating_order_id) VALUES
  ('s-1','c-acme',   'Acme Corp',           'Predictive Maintenance Suite','annual',    '2026-10-01',24000,'active',   'q-1042'),
  ('s-2','c-acme',   'Acme Corp',           '24/7 Support Retainer',      'annual',    '2026-11-15',18000,'active',   'q-1045'),
  ('s-3','c-stark',  'Stark Manufacturing', 'Predictive Maintenance Suite','quarterly', '2026-09-30', 6000,'paused',   'q-1046'),
  ('s-4','c-initech','Initech',             '24/7 Support Retainer',      'annual',    '2026-01-12',18000,'cancelled','q-1044');

-- subscription_onetime_lines
INSERT INTO subscription_onetime_lines (subscription_id, product_name, qty, amount) VALUES
  ('s-1','Industrial Sensor Array', 6, 58500),
  ('s-1','Onsite Installation',     2,  8550),
  ('s-2','Industrial Sensor Array', 8, 84000),
  ('s-3','Edge Gateway Pro',       12, 98256),
  ('s-4','Spare Parts Kit',        10, 20160);

-- subscription_recurring_lines
INSERT INTO subscription_recurring_lines (subscription_id, plan, cycle, next_bill_date, amount) VALUES
  ('s-1','Predictive Maintenance Suite','annual',    '2026-10-01',19200),
  ('s-2','24/7 Support Retainer',       'annual',    '2026-11-15',16200),
  ('s-3','Predictive Maintenance Suite','quarterly', '2026-09-30', 6000),
  ('s-4','24/7 Support Retainer',       'annual',    '--',             0);

-- invoices
INSERT INTO invoices (id, number, customer_id, customer_name, amount, status, issued_date, due_date, terms, region, step, note, items, approved_by, payment_recorded_by) VALUES
  ('inv-2201','INV-2201','c-stark',  'Stark Manufacturing',98256,'unpaid','2026-08-21','2026-09-20','Net 30','North America','invoiced',
   'Partial delivery: 8 of 12 gateways shipped from East DC. Remainder on split shipment — invoice reflects shipped quantity plus committed install.',
   '[{"description":"Edge Gateway Pro","qty":8,"unitPrice":8900,"amount":71200},{"description":"Committed remainder — site install","qty":1,"unitPrice":27056,"amount":27056}]'::jsonb,
   '[{"name":"Jordan Chen","role":"manager","roleLabel":"Sales Manager"}]'::jsonb,
   NULL),
  ('inv-2198','INV-2198','c-globex', 'Globex Industries',  44100,'paid',  '2026-07-16','2026-08-30','Net 45','EMEA','paid',
   'Delivery and invoice quantities match. No reconciliation exception.',
   '[{"description":"Industrial Sensor Array","qty":3,"unitPrice":12500,"amount":37500},{"description":"Commissioning visit","qty":1,"unitPrice":6600,"amount":6600}]'::jsonb,
   '[{"name":"Jordan Chen","role":"manager","roleLabel":"Sales Manager"},{"name":"Sam Patel","role":"finance","roleLabel":"Finance"}]'::jsonb,
   '{"name":"Alex Rivera","role":"rep","roleLabel":"Sales Rep"}'::jsonb),
  ('inv-2194','INV-2194','c-initech','Initech',            20160,'unpaid','2026-08-18','2026-09-02','Net 15','North America','invoiced',
   'Overdue. Delivery complete; payment not yet recorded.',
   '[{"description":"Spare Parts Kit","qty":10,"unitPrice":2016,"amount":20160}]'::jsonb,
   '[{"name":"Policy engine","role":"system","roleLabel":"Within-limit auto-approval"}]'::jsonb,
   NULL),
  ('inv-2188','INV-2188','c-acme',   'Acme Corp',          19200,'paid',  '2026-07-02','2026-08-01','Net 30','North America','paid',
   'Recurring line invoiced at start of billing period.',
   '[{"description":"Predictive Maintenance Suite — annual","qty":1,"unitPrice":19200,"amount":19200}]'::jsonb,
   '[{"name":"Jordan Chen","role":"manager","roleLabel":"Sales Manager"}]'::jsonb,
   '{"name":"Alex Rivera","role":"rep","roleLabel":"Sales Rep"}'::jsonb);

-- invoice_lines
INSERT INTO invoice_lines (invoice_id, number, amount, status, due_date) VALUES
  ('inv-2201','INV-2201',98256,'unpaid','2026-09-20'),
  ('inv-2198','INV-2198',44100,'paid',  '2026-08-30'),
  ('inv-2194','INV-2194',20160,'unpaid','2026-09-02'),
  ('inv-2188','INV-2188',19200,'paid',  '2026-08-01');

-- deal_health
INSERT INTO deal_health (id, deal, quotation_id, issue, flagged, type) VALUES
  ('dh-1','Q-1047 Umbrella LLC',      'q-1047','Stalled in Finance approval (4 days)',        '2026-09-04 08:12:00+00','stalled'),
  ('dh-2','Q-1042 Acme Corp',         'q-1042','Hardware discount 7pts over category ceiling','2026-09-03 14:12:00+00','anomaly'),
  ('dh-3','SO-1048 Globex Industries','q-1048','Delivery slippage - backorder on sensors',    '2026-09-05 07:12:00+00','slippage'),
  ('dh-4','Q-1045 Acme Corp',         'q-1045','Customer negotiation open > 24h',             '2026-09-04 09:12:00+00','stalled');

-- portal_messages
INSERT INTO portal_messages (id, customer_id, quotation_id, from_name, body, date) VALUES
  ('m-1','c-acme','q-1045','Riley Hart',  'Can you move delivery to mid-October and improve the sensor discount?','2026-09-04 09:12:00+00'),
  ('m-2','c-acme','q-1045','Alex Rivera', 'Logged. Pricing is with our sales manager - you will see an updated quote shortly.','2026-09-04 10:12:00+00');

-- activity
INSERT INTO activity (id, text, timestamp) VALUES
  ('act-1','Acme Corp quotation Q-1042 submitted for approval (blended HIGH)',     '2026-09-03 14:12:00+00'),
  ('act-2','Riley Hart opened negotiation on Q-1045',                              '2026-09-04 09:12:00+00'),
  ('act-3','Jordan Chen approved Q-1047 - routed to Finance',                      '2026-09-01 11:12:00+00'),
  ('act-4','Initech quotation Q-1044 auto-approved (within limits)',               '2026-08-24 09:12:00+00'),
  ('act-5','Stark Manufacturing order SO-1046 flagged split-pending at West DC',   '2026-09-02 12:12:00+00'),
  ('act-6','Invoice INV-2198 marked paid - Globex Industries',                     '2026-08-31 16:12:00+00');


-- =============================================================================
-- DONE. 22 tables created, all seed data inserted.
-- =============================================================================
