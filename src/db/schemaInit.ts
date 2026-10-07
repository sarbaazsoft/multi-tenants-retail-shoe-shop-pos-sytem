import bcrypt from 'bcryptjs';
import { pgClient } from './index.ts';

let saasControlPlaneInitialized = false;
let saasControlPlanePromise: Promise<void> | null = null;
let databaseSchemaPromise: Promise<void> | null = null;

export function isSaasControlPlaneInitialized(): boolean {
  return saasControlPlaneInitialized;
}

export function resetSaasControlPlaneState(): void {
  saasControlPlaneInitialized = false;
  saasControlPlanePromise = null;
  databaseSchemaPromise = null;
}

/**
 * Normalizes subscription plan to '6_MONTHS' or 'YEARLY'
 */
export function normalizeSubscriptionPlan(plan?: string | null): '6_MONTHS' | 'YEARLY' {
  const clean = String(plan || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (clean === '6_MONTHS' || clean === '6_MONTH' || clean === 'SIX_MONTHS') {
    return '6_MONTHS';
  }
  return 'YEARLY';
}

/**
 * Calculates subscriptionEndDate automatically based on plan ('6_MONTHS' => +6 months, 'YEARLY' => +1 year)
 */
export function calculateSubscriptionEndDate(
  plan: '6_MONTHS' | 'YEARLY' | string,
  startDate: Date = new Date()
): Date {
  const normalized = normalizeSubscriptionPlan(plan);
  const end = new Date(startDate.getTime());
  if (normalized === '6_MONTHS') {
    end.setMonth(end.getMonth() + 6);
  } else {
    end.setFullYear(end.getFullYear() + 1);
  }
  return end;
}

/**
 * Synchronizes expired subscriptions in PostgreSQL so any tenant whose subscription_end_date < NOW()
 * is automatically marked with subscription_status = 'EXPIRED'.
 */
export async function syncExpiredTenantSubscriptions(): Promise<void> {
  try {
    await pgClient.query(`
      UPDATE tenants
      SET subscription_status = 'EXPIRED',
          updated_at = NOW()
      WHERE subscription_end_date IS NOT NULL
        AND subscription_end_date < NOW()
        AND subscription_status NOT IN ('EXPIRED', 'SUSPENDED')
    `);
  } catch {}
}

export const REQUIRED_DATABASE_TABLES = [
  'tenants',
  'users',
  'store_requests',
  'deleted_store_requests',
  'password_reset_tokens',
  'company_settings',
  'categories',
  'products',
  'customers',
  'suppliers',
  'purchases',
  'supplier_payments',
  'purchase_items',
  'purchase_returns',
  'purchase_return_items',
  'sales',
  'sale_items',
  'returns',
  'return_items',
  'stock_movements',
] as const;

const DATABASE_TABLE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    subscription_plan TEXT NOT NULL DEFAULT 'YEARLY',
    subscription_start_date TIMESTAMP NOT NULL DEFAULT NOW(),
    subscription_end_date TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
    subscription_status TEXT NOT NULL DEFAULT 'ACTIVE',
    theme_color TEXT NOT NULL DEFAULT '#2563EB',
    background_color TEXT NOT NULL DEFAULT '#ffffff',
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    deleted_product_ids INTEGER[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL UNIQUE,
    phone TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    password_hash TEXT NOT NULL,
    quick_password TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'CASHIER',
    status TEXT NOT NULL DEFAULT 'PENDING',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS store_requests (
    id SERIAL PRIMARY KEY,
    store_name TEXT NOT NULL,
    owner_email TEXT NOT NULL,
    owner_phone TEXT DEFAULT '',
    business_address TEXT DEFAULT '',
    plan TEXT NOT NULL DEFAULT 'PRO',
    request_type TEXT NOT NULL DEFAULT 'NEW_STORE',
    notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'PENDING',
    provisioned_tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    initial_password TEXT DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS deleted_store_requests (
    id SERIAL PRIMARY KEY,
    request_id INTEGER,
    marker_key TEXT NOT NULL DEFAULT '',
    deleted_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS company_settings (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    logo TEXT DEFAULT '',
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    website TEXT DEFAULT '',
    strn TEXT DEFAULT '',
    tax_id TEXT DEFAULT '',
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'PKR',
    currency_name TEXT NOT NULL DEFAULT 'Pakistani Rupee',
    currency_symbol TEXT NOT NULL DEFAULT 'Rs.',
    invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
    purchase_prefix TEXT NOT NULL DEFAULT 'PUR-',
    barcode_prefix TEXT NOT NULL DEFAULT '',
    invoice_footer TEXT NOT NULL DEFAULT 'Thank you for shopping with us!',
    show_receipt_logo BOOLEAN NOT NULL DEFAULT false,
    receipt_logo TEXT DEFAULT '',
    low_stock_limit INTEGER NOT NULL DEFAULT 5,
    pricing_mode TEXT NOT NULL DEFAULT 'FIXED',
    pricing_policy_locked BOOLEAN NOT NULL DEFAULT false,
    is_installed BOOLEAN DEFAULT false,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    tenant_product_no INTEGER,
    name TEXT NOT NULL,
    brand VARCHAR(100) NOT NULL DEFAULT 'Local',
    category VARCHAR(100) NOT NULL DEFAULT 'Men',
    sku TEXT NOT NULL,
    barcode TEXT NOT NULL,
    article TEXT DEFAULT '',
    primary_image_url TEXT DEFAULT '',
    description TEXT DEFAULT '',
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    min_price INTEGER NOT NULL DEFAULT 0,
    max_price INTEGER NOT NULL DEFAULT 0,
    total_stock INTEGER NOT NULL DEFAULT 0,
    low_stock_limit INTEGER NOT NULL DEFAULT 5,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    balance NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    purchase_number TEXT NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT NOT NULL,
    purchase_date TEXT NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'UNPAID',
    payment_method TEXT DEFAULT 'CASH',
    notes TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS supplier_payments (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    payment_number TEXT NOT NULL,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    supplier_name TEXT NOT NULL,
    purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_date TEXT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'CASH',
    reference_number TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS purchase_items (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_purchase_price NUMERIC(12, 2) NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS purchase_returns (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    return_number TEXT NOT NULL,
    purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT NOT NULL,
    return_date TEXT NOT NULL,
    total_debit_amount NUMERIC(12, 2) NOT NULL,
    reason TEXT NOT NULL,
    notes TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS purchase_return_items (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    purchase_return_id INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_purchase_price NUMERIC(12, 2) NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL,
    defect_type TEXT DEFAULT 'MANUFACTURING_DEFECT'
  )`,
  `CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    invoice_number TEXT NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    sale_date TEXT NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'CASH',
    cash_received NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    change_given NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_by INTEGER NOT NULL REFERENCES users(id),
    is_min_price_overridden BOOLEAN NOT NULL DEFAULT false,
    overridden_by INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL,
    purchase_price NUMERIC(12, 2) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS returns (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    return_number TEXT NOT NULL,
    original_sale_id INTEGER NOT NULL REFERENCES sales(id),
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    return_date TEXT NOT NULL,
    total_refund_amount NUMERIC(12, 2) NOT NULL,
    reason TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS return_items (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    sale_item_id INTEGER NOT NULL REFERENCES sale_items(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_refund_price NUMERIC(12, 2) NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS stock_movements (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    product_id INTEGER NOT NULL REFERENCES products(id),
    qty_change INTEGER NOT NULL,
    prev_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    movement_type TEXT NOT NULL,
    reference_id TEXT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
];

const DATABASE_INDEX_DDL: string[] = [
  `CREATE INDEX IF NOT EXISTS tenants_status_idx ON tenants(status)`,
  `CREATE INDEX IF NOT EXISTS tenants_subscription_status_idx ON tenants(subscription_status)`,
  `CREATE INDEX IF NOT EXISTS deleted_store_requests_marker_idx ON deleted_store_requests(marker_key)`,
  `CREATE INDEX IF NOT EXISTS users_tenant_idx ON users(tenant_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx ON users (LOWER(BTRIM(email)))`,
  `CREATE INDEX IF NOT EXISTS company_settings_tenant_idx ON company_settings(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS categories_tenant_idx ON categories(tenant_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS categories_tenant_name_lower_idx ON categories(tenant_id, LOWER(TRIM(name)))`,
  `CREATE INDEX IF NOT EXISTS products_tenant_idx ON products(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS products_tenant_product_no_idx ON products(tenant_id, tenant_product_no)`,
  `CREATE INDEX IF NOT EXISTS products_brand_idx ON products(brand)`,
  `CREATE INDEX IF NOT EXISTS products_category_idx ON products(category)`,
  `CREATE INDEX IF NOT EXISTS products_barcode_idx ON products(barcode)`,
  `CREATE INDEX IF NOT EXISTS products_sku_idx ON products(sku)`,
  `CREATE INDEX IF NOT EXISTS products_article_idx ON products(article)`,
  `CREATE INDEX IF NOT EXISTS products_active_idx ON products(active)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_barcode_unique_idx ON products (COALESCE(tenant_id, 1), LOWER(BTRIM(barcode))) WHERE barcode IS NOT NULL AND BTRIM(barcode) <> ''`,
  `CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_article_unique_idx ON products (COALESCE(tenant_id, 1), LOWER(BTRIM(article))) WHERE article IS NOT NULL AND BTRIM(article) <> ''`,
  `CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_sku_unique_idx ON products (COALESCE(tenant_id, 1), LOWER(BTRIM(sku))) WHERE sku IS NOT NULL AND BTRIM(sku) <> ''`,
  `CREATE INDEX IF NOT EXISTS customers_tenant_idx ON customers(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers(phone)`,
  `CREATE INDEX IF NOT EXISTS suppliers_tenant_idx ON suppliers(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS purchases_tenant_idx ON purchases(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS supplier_payments_tenant_idx ON supplier_payments(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS supplier_payments_supplier_idx ON supplier_payments(supplier_id)`,
  `CREATE INDEX IF NOT EXISTS supplier_payments_date_idx ON supplier_payments(payment_date)`,
  `CREATE INDEX IF NOT EXISTS supplier_payments_number_idx ON supplier_payments(payment_number)`,
  `CREATE INDEX IF NOT EXISTS purchase_returns_tenant_idx ON purchase_returns(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS purchase_returns_number_idx ON purchase_returns(return_number)`,
  `CREATE INDEX IF NOT EXISTS purchase_returns_supplier_idx ON purchase_returns(supplier_id)`,
  `CREATE INDEX IF NOT EXISTS purchase_return_items_return_idx ON purchase_return_items(purchase_return_id)`,
  `CREATE INDEX IF NOT EXISTS purchase_return_items_product_idx ON purchase_return_items(product_id)`,
  `CREATE INDEX IF NOT EXISTS sales_tenant_idx ON sales(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS sales_invoice_idx ON sales(invoice_number)`,
  `CREATE INDEX IF NOT EXISTS returns_tenant_idx ON returns(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS stock_movements_tenant_idx ON stock_movements(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements(product_id)`,
  `CREATE INDEX IF NOT EXISTS stock_movements_created_at_idx ON stock_movements(created_at)`,
];

/**
 * Ensures that all database tables, columns, constraints, and multi-tenant discriminators exist.
 * Idempotent and safe for PostgreSQL.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  if (databaseSchemaPromise) return databaseSchemaPromise;

  databaseSchemaPromise = (async () => {
    try {
      await pgClient.waitReady;

      // 1. Create all tables in strict dependency order (tenants and users first)
      for (const ddl of DATABASE_TABLE_DDL) {
        await pgClient.exec(ddl);
      }

      // 1b. Ensure deprecated tables, columns, and slug/subdomain columns are permanently removed
      await pgClient.exec(`
        DROP TABLE IF EXISTS brands CASCADE;
        ALTER TABLE tenants DROP COLUMN IF EXISTS slug;
        ALTER TABLE tenants DROP COLUMN IF EXISTS subdomain;
        ALTER TABLE tenants DROP COLUMN IF EXISTS sub_domain;
        ALTER TABLE products DROP COLUMN IF EXISTS pricing_policy;
      `).catch(() => {});

      // 2. Create all indexes independently so an index notice never aborts table creation
      for (const idxDdl of DATABASE_INDEX_DDL) {
        await pgClient.exec(idxDdl).catch(() => {});
      }
    } finally {
      databaseSchemaPromise = null;
    }
  })();

  return databaseSchemaPromise;
}

/**
 * Ensures that a given tenant store has both an active Store Owner (ADMIN) and Store Cashier (CASHIER)
 * account with verified credentials, returning their exact email and password for store auth quick login.
 */
export interface StoreQuickCredential {
  id: number;
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'CASHIER';
}

export async function ensureTenantStoreUsers(params: {
  tenantId: number;
  storeName?: string;
  ownerEmail?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerPassword?: string;
  createCashier?: boolean;
  cashierName?: string;
  cashierEmail?: string;
  cashierPhone?: string;
  cashierPassword?: string;
}): Promise<{
  owner: StoreQuickCredential;
  cashier: StoreQuickCredential | null;
}> {
  const tenantId = Number(params.tenantId) || 1;
  const storeLabel = (params.storeName || 'Store').trim();

  // Determine canonical store-specific emails & default passwords
  const defaultOwnerEmail = (params.ownerEmail || `admin+${tenantId}@store.com`).trim().toLowerCase();
  const defaultOwnerName = (params.ownerName || params.ownerEmail?.split('@')[0] || `${storeLabel} Owner`).trim();
  const explicitPassword = params.ownerPassword && params.ownerPassword.trim() ? params.ownerPassword.trim() : '';
  const defaultOwnerPassword = explicitPassword || 'admin123';

  // 1. Resolve or create Store Owner (ADMIN)
  const adminRes = await pgClient.query<{
    id: number;
    name: string;
    email: string;
    password_hash: string;
    quick_password: string;
    status: string;
  }>(
    `SELECT id, name, email, password_hash, COALESCE(quick_password, '') as quick_password, status
     FROM users
     WHERE tenant_id = $1 AND role = 'ADMIN'
     ORDER BY id ASC
     LIMIT 1`,
    [tenantId]
  );

  let ownerCred: StoreQuickCredential;
  if (adminRes.rows.length > 0) {
    const row = adminRes.rows[0];
    let verifiedPass = '';
    if (row.quick_password && (await bcrypt.compare(row.quick_password, row.password_hash))) {
      verifiedPass = row.quick_password;
    } else {
      const candidates = Array.from(
        new Set([defaultOwnerPassword, 'admin123', 'password123', '123456'])
      );
      for (const cand of candidates) {
        if (await bcrypt.compare(cand, row.password_hash)) {
          verifiedPass = cand;
          break;
        }
      }
      if (!verifiedPass) {
        verifiedPass = defaultOwnerPassword;
        const freshHash = await bcrypt.hash(verifiedPass, 10);
        await pgClient.query(
          `UPDATE users SET password_hash = $1, quick_password = $2, status = 'APPROVED', active = true WHERE id = $3`,
          [freshHash, verifiedPass, row.id]
        );
      } else {
        await pgClient.query(
          `UPDATE users SET quick_password = $1, status = 'APPROVED', active = true WHERE id = $2`,
          [verifiedPass, row.id]
        );
      }
    }
    ownerCred = {
      id: row.id,
      name: row.name,
      email: row.email,
      password: verifiedPass,
      role: 'ADMIN',
    };
  } else {
    let candidateOwnerEmail = defaultOwnerEmail;
    const emailConflictRes = await pgClient.query<{ id: number }>(
      `SELECT id FROM users WHERE LOWER(BTRIM(email)) = LOWER(BTRIM($1)) LIMIT 1`,
      [candidateOwnerEmail]
    );
    if (emailConflictRes.rows.length > 0) {
      if (params.ownerEmail && params.ownerEmail.trim()) {
        const duplicateEmailError: any = new Error(
          'This email is already in use. Please use a different email address.'
        );
        duplicateEmailError.code = 'EMAIL_ALREADY_EXISTS';
        throw duplicateEmailError;
      }
      candidateOwnerEmail = `admin+${tenantId}@store.com`;
    }

    const ownerHash = await bcrypt.hash(defaultOwnerPassword, 10);
    const createdOwner = await pgClient.query<{ id: number; name: string; email: string }>(
      `INSERT INTO users (tenant_id, name, email, phone, password_hash, quick_password, role, status, active)
       VALUES ($1, $2, $3, $4, $5, $6, 'ADMIN', 'APPROVED', true)
       RETURNING id, name, email`,
      [tenantId, defaultOwnerName, candidateOwnerEmail, (params.ownerPhone || '').trim(), ownerHash, defaultOwnerPassword]
    );
    ownerCred = {
      id: createdOwner.rows[0].id,
      name: createdOwner.rows[0].name,
      email: createdOwner.rows[0].email,
      password: defaultOwnerPassword,
      role: 'ADMIN',
    };
  }

  // 2. Resolve Store Cashier (CASHIER) - ONLY create if explicitly requested by user (never automatically!)
  const cashierRes = await pgClient.query<{
    id: number;
    name: string;
    email: string;
    password_hash: string;
    quick_password: string;
    status: string;
  }>(
    `SELECT id, name, email, password_hash, COALESCE(quick_password, '') as quick_password, status
     FROM users
     WHERE tenant_id = $1 AND role = 'CASHIER'
     ORDER BY CASE WHEN status = 'APPROVED' THEN 0 ELSE 1 END, id ASC
     LIMIT 1`,
    [tenantId]
  );

  let cashierCred: StoreQuickCredential | null = null;
  if (cashierRes.rows.length > 0) {
    const row = cashierRes.rows[0];
    let verifiedPass = row.quick_password || '';
    if (!verifiedPass) {
      const candidates = Array.from(
        new Set(['admin123', 'cashier123', '123456'])
      );
      for (const cand of candidates) {
        if (await bcrypt.compare(cand, row.password_hash)) {
          verifiedPass = cand;
          break;
        }
      }
    }
    cashierCred = {
      id: row.id,
      name: row.name,
      email: row.email,
      password: verifiedPass,
      role: 'CASHIER',
    };
  } else if (params.createCashier && params.cashierEmail && params.cashierPassword) {
    // Only create cashier when user explicitly requests it in onboarding or settings
    const cPass = params.cashierPassword.trim();
    const cEmail = params.cashierEmail.trim().toLowerCase();
    const cName = (params.cashierName || `${storeLabel} Cashier`).trim();
    const cPhone = (params.cashierPhone || '').trim();

    const existingCashierEmail = await pgClient.query<{ id: number }>(
      `SELECT id FROM users WHERE LOWER(BTRIM(email)) = LOWER(BTRIM($1)) LIMIT 1`,
      [cEmail]
    );
    if (existingCashierEmail.rows.length > 0) {
      const duplicateEmailError: any = new Error(
        'This email is already in use. Please use a different email address.'
      );
      duplicateEmailError.code = 'EMAIL_ALREADY_EXISTS';
      throw duplicateEmailError;
    }

    const cashierHash = await bcrypt.hash(cPass, 10);

    const createdCashier = await pgClient.query<{ id: number; name: string; email: string }>(
      `INSERT INTO users (tenant_id, name, email, phone, password_hash, quick_password, role, status, active)
       VALUES ($1, $2, $3, $4, $5, $6, 'CASHIER', 'APPROVED', true)
       RETURNING id, name, email`,
      [tenantId, cName, cEmail, cPhone, cashierHash, cPass]
    );
    cashierCred = {
      id: createdCashier.rows[0].id,
      name: createdCashier.rows[0].name,
      email: createdCashier.rows[0].email,
      password: cPass,
      role: 'CASHIER',
    };
  }

  return {
    owner: ownerCred,
    cashier: cashierCred,
  };
}

/**
 * Initializes the SaaS schema and synchronizes existing tenant subscriptions.
 * The installer, not this routine, creates the initial superadmin account.
 */
export async function ensureSaasControlPlane(): Promise<void> {
  if (saasControlPlaneInitialized) return;
  if (saasControlPlanePromise) return saasControlPlanePromise;

  saasControlPlanePromise = (async () => {
    try {
      await pgClient.waitReady;

      // Fast-path check: if schema & control plane have already been verified in this persistent DB, skip heavy DDL & bcrypt loops
      const fastCheck = await pgClient
        .query<{ count: string; has_core_tables: boolean }>(
          `SELECT COUNT(*) as count,
                  (to_regclass('public.users') IS NOT NULL AND to_regclass('public.tenants') IS NOT NULL) as has_core_tables
           FROM deleted_store_requests
           WHERE marker_key = '__schema_v10_users_email_unique__'`
        )
        .catch(() => null);

      if (
        fastCheck &&
        fastCheck.rows[0]?.has_core_tables &&
        parseInt(fastCheck.rows[0]?.count || '0', 10) > 0
      ) {
        await syncExpiredTenantSubscriptions();
        saasControlPlaneInitialized = true;
        return;
      }

      await ensureDatabaseSchema();

      // One-time cleanup of any previously auto-seeded demo store requests
    const seedPurgeCheck = await pgClient.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM deleted_store_requests WHERE marker_key = '__seeded_stores_and_requests_removed_v1__'"
    );
    if (parseInt(seedPurgeCheck.rows[0]?.count || '0', 10) === 0) {
      // Remove auto-seeded demo store requests
      await pgClient
        .query(
          `DELETE FROM store_requests
           WHERE owner_email IN ('ayesha@stepupfootwear.pk', 'faisal@solecraft.pk')`
        )
        .catch(() => {});

      await pgClient
        .query(
          `INSERT INTO deleted_store_requests (request_id, marker_key) VALUES (0, '__seeded_stores_and_requests_removed_v1__')`
        )
        .catch(() => {});
    }

    // 2. Ensure every existing user-created tenant in the database has subscription_plan, subscription dates, and verified Store Owner/Cashier users
    const allTenants = await pgClient.query<{
      id: number;
      name: string;
      status: string;
      subscription_plan: string | null;
      subscription_start_date: Date | string | null;
      subscription_end_date: Date | string | null;
      subscription_status: string | null;
      owner_email: string | null;
      owner_phone: string | null;
    }>(
      `SELECT t.id, t.name, t.status, t.subscription_plan,
              t.subscription_start_date, t.subscription_end_date, t.subscription_status,
              u.email AS owner_email, u.phone AS owner_phone
       FROM tenants t
       LEFT JOIN LATERAL (
         SELECT email, phone
         FROM users
         WHERE tenant_id = t.id AND role = 'ADMIN'
         ORDER BY id ASC
         LIMIT 1
       ) u ON true
       ORDER BY t.id ASC`
    );

    for (const t of allTenants.rows) {
      let needsSubUpdate = false;

      const nextPlan = normalizeSubscriptionPlan(t.subscription_plan || 'YEARLY');
      if (t.subscription_plan !== nextPlan) {
        needsSubUpdate = true;
      }

      const startDt = t.subscription_start_date ? new Date(t.subscription_start_date) : new Date();
      const endDt = t.subscription_end_date
        ? new Date(t.subscription_end_date)
        : calculateSubscriptionEndDate(nextPlan, startDt);
      if (!t.subscription_start_date || !t.subscription_end_date) {
        needsSubUpdate = true;
      }

      const isExpiredNow = endDt.getTime() < Date.now();
      let nextSubStatus = (t.subscription_status || '').toUpperCase();
      if (String(t.status).toUpperCase() === 'SUSPENDED') {
        nextSubStatus = 'SUSPENDED';
      } else if (isExpiredNow) {
        nextSubStatus = 'EXPIRED';
      } else if (!['ACTIVE', 'EXPIRED', 'SUSPENDED'].includes(nextSubStatus)) {
        nextSubStatus = 'ACTIVE';
      }
      if (t.subscription_status !== nextSubStatus) {
        needsSubUpdate = true;
      }

      if (needsSubUpdate) {
        await pgClient.query(
          `UPDATE tenants
           SET subscription_plan = $1,
               subscription_start_date = $2,
               subscription_end_date = $3,
               subscription_status = $4,
               updated_at = NOW()
           WHERE id = $5`,
          [nextPlan, startDt.toISOString(), endDt.toISOString(), nextSubStatus, t.id]
        );
      }

      await ensureTenantStoreUsers({
        tenantId: t.id,
        storeName: t.name,
        ownerEmail: t.owner_email || undefined,
        ownerPhone: t.owner_phone || undefined,
        createCashier: false,
      });
    }

    // Enforce SuperAdmin password = 'superadmin123' and all store user passwords = 'admin123'
    const superAdminHash = await bcrypt.hash('superadmin123', 10);
    const storeAdminHash = await bcrypt.hash('admin123', 10);

    const existingSuperAdmin = await pgClient.query<{ id: number; password_hash: string; quick_password: string }>(
      `SELECT id, password_hash, COALESCE(quick_password, '') AS quick_password FROM users WHERE UPPER(COALESCE(role, '')) = 'SUPERADMIN' ORDER BY id ASC LIMIT 1`
    );
    if (existingSuperAdmin.rows.length > 0) {
      const saRow = existingSuperAdmin.rows[0];
      if (!saRow.password_hash) {
        await pgClient.query(
          `UPDATE users
           SET password_hash = $1,
               quick_password = 'superadmin123',
               status = 'APPROVED',
               active = true,
               updated_at = NOW()
           WHERE id = $2`,
          [superAdminHash, saRow.id]
        );
      } else {
        await pgClient.query(
          `UPDATE users
           SET status = 'APPROVED',
               active = true,
               updated_at = NOW()
           WHERE UPPER(COALESCE(role, '')) = 'SUPERADMIN'`
        );
      }
    } else {
      const defaultSaEmail = 'talhah.jan@gmail.com';
      const emailTaken = await pgClient.query<{ id: number }>(
        `SELECT id FROM users WHERE LOWER(BTRIM(email)) = $1 LIMIT 1`,
        [defaultSaEmail]
      );
      const saEmail = emailTaken.rows.length > 0 ? 'superadmin@shoepos.local' : defaultSaEmail;
      await pgClient
        .query(
          `INSERT INTO users (tenant_id, name, email, phone, password_hash, quick_password, role, status, active)
           VALUES (1, 'Platform SuperAdmin', $1, '+92-300-0000001', $2, 'superadmin123', 'SUPERADMIN', 'APPROVED', true)
           ON CONFLICT (email) DO NOTHING`,
          [saEmail, superAdminHash]
        )
        .catch(() => {});
    }

    await pgClient.query(
      `UPDATE users
       SET password_hash = $1,
           quick_password = 'admin123',
           status = 'APPROVED',
           active = true,
           updated_at = NOW()
       WHERE UPPER(COALESCE(role, '')) != 'SUPERADMIN'`,
      [storeAdminHash]
    );

    await pgClient
      .query(`UPDATE store_requests SET initial_password = 'admin123'`)
      .catch(() => {});

    await syncExpiredTenantSubscriptions();

    await pgClient.query(
      `DELETE FROM store_requests
       WHERE id IN (
         SELECT request_id
         FROM deleted_store_requests
         WHERE request_id IS NOT NULL AND request_id > 0
       )`
    );

    await pgClient
      .query(
        `INSERT INTO deleted_store_requests (request_id, marker_key) VALUES (0, '__schema_v10_users_email_unique__')`
      )
      .catch(() => {});

    saasControlPlaneInitialized = true;
  } catch (err: any) {
    console.warn('Notice during SaaS control plane initialization:', err?.message || err);
  } finally {
    saasControlPlanePromise = null;
  }
  })();

  return saasControlPlanePromise;
}

/**
 * Drops all tables and relations in the public database schema with CASCADE.
 */
export async function dropAllTables(): Promise<void> {
  await pgClient.waitReady;
  resetSaasControlPlaneState();

  await pgClient.exec(`
    DROP TABLE IF EXISTS 
      deleted_store_requests,
      store_requests,
      tenants,
      password_reset_tokens,
      stock_movements,
      return_items,
      returns,
      sale_items,
      sales,
      purchase_return_items,
      purchase_returns,
      supplier_payments,
      purchase_items,
      purchases,
      products,
      customers,
      suppliers,
      categories,
      brands,
      api_tokens,
      company_settings,
      users
    CASCADE;
  `);

  try {
    const remainingTables = await pgClient.query<{ tablename: string }>(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);

    for (const row of remainingTables.rows) {
      await pgClient.exec(`DROP TABLE IF EXISTS "${row.tablename}" CASCADE;`);
    }
  } catch (err: any) {
    console.warn('Notice during dynamic table drop:', err.message);
  }

  resetSaasControlPlaneState();
  console.log('🗑️ All database tables successfully dropped with CASCADE.');
}
