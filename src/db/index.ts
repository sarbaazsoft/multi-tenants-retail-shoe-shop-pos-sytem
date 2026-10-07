import 'dotenv/config';

import pg from 'pg';
import type { Pool as PgPool, PoolClient } from 'pg';
import { AsyncLocalStorage } from 'async_hooks';
import bcrypt from 'bcryptjs';

const Pool = pg.Pool;

// Transaction context storage to ensure queries between BEGIN and COMMIT/ROLLBACK
// execute on the same checked-out client from the pool.
interface TxContext {
  client: PoolClient | null;
}

export const txStorage = new AsyncLocalStorage<TxContext>();

export interface DbConnectionInfo {
  type: 'PostgreSQL Server';
  isStandardPostgres: true;
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  maskedUrl: string;
  connected?: boolean;
  lastError?: string;
}

const rawDatabaseUrl = process.env.DATABASE_URL?.trim();

export const isStandardPostgres = true;
let dbInfo: DbConnectionInfo;
let rawPool: PgPool | null = null;
let useMock = false;

// In-memory mock store used when DATABASE_URL is not configured or unreachable in AI Studio
const defaultPasswordHash = bcrypt.hashSync('admin123', 10);
const defaultStorePasswordHash = bcrypt.hashSync('stepsync@2026', 10);

const mockStore: Record<string, any[]> = {
  tenants: [
    {
      id: 1,
      name: 'StepSync Footwear',
      status: 'ACTIVE',
      subscription_plan: 'YEARLY',
      subscription_start_date: new Date(Date.now() - 86400000 * 30).toISOString(),
      subscription_end_date: new Date(Date.now() + 86400000 * 335).toISOString(),
      subscription_status: 'ACTIVE',
      theme_color: '#7C3AED',
      background_color: '#0F172A',
      logo_url: '/pwa-512x512.png',
      address: 'Main Boulevard, Retail District',
      tax_id: 'STRN-100200300',
      currency: 'PKR',
      onboarding_completed: true,
      deleted_product_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  users: [
    {
      id: 1,
      tenant_id: 1,
      name: 'Platform SuperAdmin',
      email: 'superadmin@stepsync.com',
      phone: '+923000000000',
      avatar_url: '',
      password_hash: defaultPasswordHash,
      quick_password: 'admin123',
      role: 'SUPERADMIN',
      status: 'APPROVED',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 2,
      tenant_id: 1,
      name: 'StepSync Store Owner',
      email: 'admin@stepsync.com',
      phone: '+923001234567',
      avatar_url: '',
      password_hash: defaultStorePasswordHash,
      quick_password: 'stepsync@2026',
      role: 'ADMIN',
      status: 'APPROVED',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  company_settings: [
    {
      id: 1,
      tenant_id: 1,
      name: 'StepSync Footwear',
      logo: '',
      address: 'Main Boulevard, Retail District',
      phone: '+923001234567',
      email: 'admin@stepsync.com',
      website: '',
      strn: 'STRN-100200300',
      tax_id: 'STRN-100200300',
      tax_rate: 0,
      currency: 'PKR',
      currency_name: 'Pakistani Rupee',
      currency_symbol: 'Rs.',
      invoice_prefix: 'INV-',
      purchase_prefix: 'PUR-',
      barcode_prefix: '',
      invoice_footer: 'Thank you for shopping with us!',
      show_receipt_logo: false,
      receipt_logo: '',
      low_stock_limit: 5,
      pricing_mode: 'FIXED',
      pricing_policy_locked: true,
      is_installed: true,
      updated_at: new Date().toISOString(),
    },
  ],
  brands: [
    { id: 1, tenant_id: 1, name: 'StepSync', created_at: new Date().toISOString() },
    { id: 2, tenant_id: 1, name: 'Local', created_at: new Date().toISOString() },
  ],
  categories: [
    { id: 1, tenant_id: 1, name: 'Casual Shoes', created_at: new Date().toISOString() },
    { id: 2, tenant_id: 1, name: 'Formal Dress Shoes', created_at: new Date().toISOString() },
    { id: 3, tenant_id: 1, name: 'Sandals & Chappals', created_at: new Date().toISOString() },
  ],
  products: [
    {
      id: 1,
      tenant_id: 1,
      tenant_product_no: 1,
      name: 'Classic Leather Runner',
      brand: 'StepSync',
      category: 'Casual Shoes',
      sku: 'STP-SF-0001-42',
      barcode: '890100000001',
      article: 'SF-0001',
      primary_image_url: '',
      description: 'Everyday comfort leather runner',
      cost_price: 2500,
      min_price: 3800,
      max_price: 4200,
      pricing_policy: 'FIXED',
      total_stock: 20,
      low_stock_limit: 5,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  customers: [],
  suppliers: [],
  sales: [],
  sale_items: [],
  returns: [],
  return_items: [],
  purchases: [],
  purchase_items: [],
  purchase_returns: [],
  purchase_return_items: [],
  supplier_payments: [],
  stock_movements: [],
  store_requests: [],
  deleted_store_requests: [
    { id: 1, request_id: 0, marker_key: '__schema_v6_talhah_ready__', deleted_at: new Date().toISOString() },
    { id: 2, request_id: 0, marker_key: '__seeded_stores_and_requests_removed_v1__', deleted_at: new Date().toISOString() },
  ],
};

let mockIdCounters: Record<string, number> = {
  tenants: 2,
  users: 3,
  company_settings: 2,
  brands: 3,
  categories: 4,
  products: 2,
  customers: 1,
  suppliers: 1,
  sales: 1,
  sale_items: 1,
  returns: 1,
  return_items: 1,
  purchases: 1,
  purchase_items: 1,
  purchase_returns: 1,
  purchase_return_items: 1,
  supplier_payments: 1,
  stock_movements: 1,
  store_requests: 1,
  deleted_store_requests: 3,
};

function nextMockId(table: string): number {
  const current = mockIdCounters[table] || (mockStore[table]?.length || 0) + 1;
  mockIdCounters[table] = current + 1;
  return current;
}

async function executeMockQuery<T = any>(text: string, params: any[] = []): Promise<{ rows: T[]; rowCount?: number }> {
  const sql = text.trim();
  const upper = sql.toUpperCase();

  if (
    upper === 'SELECT 1' ||
    upper === 'SELECT 1 AS OK' ||
    upper === 'BEGIN' ||
    upper === 'COMMIT' ||
    upper === 'ROLLBACK' ||
    upper.includes('PG_ADVISORY_XACT_LOCK')
  ) {
    return { rows: [{ ok: 1 } as unknown as T], rowCount: 1 };
  }

  // Public landing page aggregate stats (/api/saas/public-stats)
  if (upper.includes('AS STORE_COUNT') && upper.includes('AS PRODUCT_COUNT')) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const storeCount = mockStore.tenants.length;
    const productCount = mockStore.products.filter((p) => p.active !== false).length;
    const platformRevenue = Math.round(
      mockStore.sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0)
    );
    const invoicesTodayCount = mockStore.sales.filter((s) => s.sale_date === todayStr).length;
    return {
      rows: [
        {
          store_count: String(storeCount),
          product_count: String(productCount),
          platform_revenue: String(platformRevenue),
          invoices_today_count: String(invoicesTodayCount),
        } as unknown as T,
      ],
      rowCount: 1,
    };
  }

  if (upper.includes('TO_REGCLASS') && upper.includes('UNNEST')) {
    const tables: string[] = Array.isArray(params[0]) ? params[0] : [];
    const rows = tables.map((table_name) => ({ table_name, present: true })) as unknown as T[];
    return { rows, rowCount: rows.length };
  }

  // 7-day sales series chart query (WITH days AS (... generate_series ...))
  if (upper.includes('GENERATE_SERIES') && upper.includes('WITH DAYS AS')) {
    const tenantFilter = params.length > 0 ? Number(params[0]) : null;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const rows: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const label = dayNames[d.getDay()];
      const daySales = mockStore.sales.filter(
        (s) => s.sale_date === dateStr && (!tenantFilter || Number(s.tenant_id) === tenantFilter)
      );
      const amount = daySales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
      rows.push({
        date: dateStr,
        label,
        amount: String(amount),
        tx_count: String(daySales.length),
      });
    }
    return { rows: rows as unknown as T[], rowCount: rows.length };
  }

  // Deleted store requests tracking
  if (upper.includes('DELETED_STORE_REQUESTS')) {
    if (upper.startsWith('SELECT') && upper.includes('COUNT(*)')) {
      return { rows: [{ count: '1' } as unknown as T], rowCount: 1 };
    }
    if (upper.startsWith('INSERT INTO DELETED_STORE_REQUESTS')) {
      const entry = {
        id: nextMockId('deleted_store_requests'),
        request_id: Number(params[0] || 0),
        marker_key: String(params[1] || ''),
        deleted_at: new Date().toISOString(),
      };
      mockStore.deleted_store_requests.push(entry);
      return { rows: [entry as unknown as T], rowCount: 1 };
    }
    if (upper.startsWith('DELETE FROM DELETED_STORE_REQUESTS')) {
      const targetMarker = String(params[0] || '').toLowerCase();
      mockStore.deleted_store_requests = mockStore.deleted_store_requests.filter(
        (d) => String(d.marker_key || '').toLowerCase() !== targetMarker && Number(d.request_id) !== Number(params[0])
      );
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // SuperAdmin & Store report queries joining products + tenants
  if (upper.startsWith('SELECT') && upper.includes('FROM PRODUCTS P') && upper.includes('JOIN TENANTS T')) {
    if (upper.includes('GROUP BY COALESCE(NULLIF(TRIM(P.CATEGORY)')) {
      const map = new Map<string, { name: string; sku_count: number; total_stock: number; units_sold: number; total_revenue: number }>();
      for (const p of mockStore.products.filter((x) => x.active !== false)) {
        const key = (p.category || 'General').trim() || 'General';
        const cur = map.get(key) || { name: key, sku_count: 0, total_stock: 0, units_sold: 0, total_revenue: 0 };
        cur.sku_count += 1;
        cur.total_stock += Number(p.total_stock || 0);
        const items = mockStore.sale_items.filter((si) => Number(si.product_id) === Number(p.id));
        cur.units_sold += items.reduce((s, i) => s + Number(i.quantity || 0), 0);
        cur.total_revenue += items.reduce((s, i) => s + Number(i.subtotal || 0), 0);
        map.set(key, cur);
      }
      const rows = Array.from(map.values()).map((c) => ({
        name: c.name,
        sku_count: String(c.sku_count),
        total_stock: String(c.total_stock),
        units_sold: String(c.units_sold),
        total_revenue: String(c.total_revenue),
      })) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (upper.includes('GROUP BY COALESCE(NULLIF(TRIM(P.BRAND)')) {
      const map = new Map<string, { name: string; sku_count: number; total_stock: number; units_sold: number; total_revenue: number }>();
      for (const p of mockStore.products.filter((x) => x.active !== false)) {
        const key = (p.brand || 'Local').trim() || 'Local';
        const cur = map.get(key) || { name: key, sku_count: 0, total_stock: 0, units_sold: 0, total_revenue: 0 };
        cur.sku_count += 1;
        cur.total_stock += Number(p.total_stock || 0);
        const items = mockStore.sale_items.filter((si) => Number(si.product_id) === Number(p.id));
        cur.units_sold += items.reduce((s, i) => s + Number(i.quantity || 0), 0);
        cur.total_revenue += items.reduce((s, i) => s + Number(i.subtotal || 0), 0);
        map.set(key, cur);
      }
      const rows = Array.from(map.values()).map((b) => ({
        name: b.name,
        sku_count: String(b.sku_count),
        total_stock: String(b.total_stock),
        units_sold: String(b.units_sold),
        total_revenue: String(b.total_revenue),
      })) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    const rows = mockStore.products
      .filter((p) => p.active !== false)
      .map((p) => {
        const t = mockStore.tenants.find((tn) => Number(tn.id) === Number(p.tenant_id)) || mockStore.tenants[0];
        const cs = mockStore.company_settings.find((c) => Number(c.tenant_id) === Number(p.tenant_id));
        const items = mockStore.sale_items.filter((si) => Number(si.product_id) === Number(p.id));
        const unitsSold = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
        const totalRev = items.reduce((s, i) => s + Number(i.subtotal || 0), 0);
        return {
          id: p.id,
          tenant_id: p.tenant_id,
          store_name: t?.name || 'StepSync Footwear',
          currency: cs?.currency || 'PKR',
          product_name: p.article || p.name || 'Shoe Item',
          name: p.name || 'Shoe Item',
          article: p.article || '',
          sku: p.sku || '',
          barcode: p.barcode || '',
          brand: p.brand || 'Local',
          category: p.category || 'General',
          primary_image_url: p.primary_image_url || '',
          max_price: String(p.max_price || 0),
          selling_price: String(p.max_price || 0),
          cost_price: String(p.cost_price || 0),
          total_stock: String(p.total_stock || 0),
          low_stock_limit: String(p.low_stock_limit || 5),
          units_sold: String(unitsSold),
          total_revenue: String(totalRev),
          gross_revenue: String(totalRev),
          order_count: String(items.length),
        };
      }) as unknown as T[];
    return { rows, rowCount: rows.length };
  }

  // TENANTS queries (SELECT, INSERT, UPDATE, DELETE)
  if (upper.startsWith('SELECT') && upper.includes('FROM TENANTS')) {
    if (upper.includes('COUNT(*)::INT AS CNT') && upper.includes('MAX(ID)')) {
      const cnt = mockStore.tenants.length;
      const maxId = mockStore.tenants.reduce((m, t) => Math.max(m, Number(t.id || 0)), 0);
      return { rows: [{ cnt, max_id: maxId } as unknown as T], rowCount: 1 };
    }
    if (upper.includes('AS NEXT_ID') && upper.includes('LEFT JOIN TENANTS T2')) {
      const usedIds = new Set(mockStore.tenants.map((t) => Number(t.id)));
      let candidate = 1;
      while (usedIds.has(candidate)) {
        candidate++;
      }
      return { rows: [{ next_id: candidate } as unknown as T], rowCount: 1 };
    }

    let rows = mockStore.tenants.map((t) => {
      const owner = mockStore.users.find((u) => Number(u.tenant_id) === Number(t.id) && u.role === 'ADMIN');
      const cs = mockStore.company_settings.find((c) => Number(c.tenant_id) === Number(t.id));
      const storeProducts = mockStore.products.filter((p) => Number(p.tenant_id) === Number(t.id) && p.active !== false);
      const storeSales = mockStore.sales.filter((s) => Number(s.tenant_id) === Number(t.id));
      const storeSaleItems = mockStore.sale_items.filter((si) => Number(si.tenant_id) === Number(t.id));
      const storeStaff = mockStore.users.filter((u) => Number(u.tenant_id) === Number(t.id) && u.role !== 'SUPERADMIN');
      const storeCashiers = mockStore.users.filter((u) => Number(u.tenant_id) === Number(t.id) && u.role === 'CASHIER');
      const storeCustomers = mockStore.customers.filter((c) => Number(c.tenant_id) === Number(t.id));
      const storeSuppliers = mockStore.suppliers.filter((sp) => Number(sp.tenant_id) === Number(t.id));

      return {
        ...t,
        name: t.name || cs?.name || 'StepSync Footwear',
        admin_user_id: owner?.id || null,
        owner_name: owner?.name || 'Store Owner',
        admin_name: owner?.name || 'Store Owner',
        owner_email: owner?.email || cs?.email || `admin+${t.id}@store.com`,
        admin_email: owner?.email || cs?.email || `admin+${t.id}@store.com`,
        owner_phone: owner?.phone || cs?.phone || '',
        admin_phone: owner?.phone || cs?.phone || '',
        logo_url: cs?.logo || t.logo_url || '/pwa-512x512.png',
        address: cs?.address || t.address || '',
        tax_id: cs?.tax_id || t.tax_id || '',
        currency: cs?.currency || t.currency || 'PKR',
        product_count: String(storeProducts.length),
        total_stock_units: String(storeProducts.reduce((sum, p) => sum + Number(p.total_stock || 0), 0)),
        sales_count: String(storeSales.length),
        total_sales_revenue: String(storeSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0)),
        staff_count: String(storeStaff.length),
        cashier_count: storeCashiers.length,
        customer_count: String(storeCustomers.length),
        supplier_count: String(storeSuppliers.length),
        units_sold: String(storeSaleItems.reduce((sum, si) => sum + Number(si.quantity || 0), 0)),
        inventory_value: String(
          storeProducts.reduce((sum, p) => sum + Number(p.total_stock || 0) * Number(p.max_price || 0), 0)
        ),
      };
    });

    if (upper.includes('WHERE ($1::INTEGER IS NOT NULL AND ID = $1)')) {
      rows = rows.filter(
        (r) =>
          (params[0] !== null && params[0] !== undefined && Number(r.id) === Number(params[0])) ||
          String(r.name).toLowerCase() === String(params[1] || '').toLowerCase()
      );
    } else if (upper.includes('WHERE ID = ANY($1')) {
      const ids: number[] = Array.isArray(params[0]) ? params[0].map(Number) : [];
      rows = rows.filter((r) => ids.includes(Number(r.id)));
    } else if (upper.includes('WHERE T.ID = $1') || upper.includes('WHERE ID = $1')) {
      rows = rows.filter((r) => Number(r.id) === Number(params[0]));
    }
    return { rows: rows as unknown as T[], rowCount: rows.length };
  }

  if (upper.startsWith('INSERT INTO TENANTS')) {
    const hasExplicitId = params.length >= 7;
    const usedIds = new Set(mockStore.tenants.map((t) => Number(t.id)));
    let recycledId = 1;
    while (usedIds.has(recycledId)) {
      recycledId++;
    }
    const newTenant = {
      id: hasExplicitId ? Number(params[0]) || recycledId : recycledId,
      name: String((hasExplicitId ? params[1] : params[0]) || 'New Shoe Store').trim(),
      status: 'ACTIVE',
      subscription_plan: String((hasExplicitId ? params[2] : params[1]) || 'YEARLY'),
      subscription_start_date: (hasExplicitId ? params[3] : params[2]) || new Date().toISOString(),
      subscription_end_date: (hasExplicitId ? params[4] : params[3]) || new Date(Date.now() + 86400000 * 365).toISOString(),
      subscription_status: String((hasExplicitId ? params[5] : params[4]) || 'ACTIVE'),
      theme_color: String((hasExplicitId ? params[6] : params[5]) || '#7C3AED'),
      background_color: '#0F172A',
      logo_url: '/pwa-512x512.png',
      address: '',
      tax_id: '',
      currency: 'PKR',
      onboarding_completed: false,
      deleted_product_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockStore.tenants.push(newTenant);
    mockStore.tenants.sort((a, b) => Number(a.id) - Number(b.id));
    return { rows: [newTenant as unknown as T], rowCount: 1 };
  }

  if (upper.startsWith('UPDATE TENANTS')) {
    if (upper.includes('WHERE SUBSCRIPTION_END_DATE IS NOT NULL')) {
      for (const t of mockStore.tenants) {
        if (t.subscription_end_date && new Date(t.subscription_end_date).getTime() < Date.now() && t.subscription_status !== 'SUSPENDED') {
          t.subscription_status = 'EXPIRED';
        }
      }
      return { rows: [], rowCount: 0 };
    }
    const targetId = Number(params[params.length - 1]);
    const tenant = mockStore.tenants.find((t) => Number(t.id) === targetId);
    if (!tenant) return { rows: [], rowCount: 0 };

    if (upper.includes('ARRAY_REMOVE') && upper.includes('DELETED_PRODUCT_IDS')) {
      const usedNo = Number(params[0]);
      tenant.deleted_product_ids = (Array.isArray(tenant.deleted_product_ids) ? tenant.deleted_product_ids : []).filter(
        (n: number) => Number(n) !== usedNo
      );
      tenant.updated_at = new Date().toISOString();
      return { rows: [tenant as unknown as T], rowCount: 1 };
    }
    if (upper.includes('ARRAY_APPEND') && upper.includes('DELETED_PRODUCT_IDS')) {
      const deletedNo = Number(params[0]);
      if (Number.isInteger(deletedNo) && deletedNo >= 1) {
        const currentIds = Array.isArray(tenant.deleted_product_ids) ? tenant.deleted_product_ids.map(Number) : [];
        tenant.deleted_product_ids = [...new Set([...currentIds, deletedNo])]
          .filter((n) => Number.isInteger(n) && n >= 1)
          .sort((a, b) => a - b);
      }
      tenant.updated_at = new Date().toISOString();
      return { rows: [tenant as unknown as T], rowCount: 1 };
    }
    if (upper.includes('SET DELETED_PRODUCT_IDS = $1')) {
      const nextIds = Array.isArray(params[0]) ? params[0].map(Number).filter((n: number) => Number.isInteger(n) && n >= 1) : [];
      tenant.deleted_product_ids = [...new Set(nextIds)].sort((a, b) => a - b);
      tenant.updated_at = new Date().toISOString();
      return { rows: [tenant as unknown as T], rowCount: 1 };
    }

    if (upper.includes('SET NAME = $1') && upper.includes('SUBSCRIPTION_PLAN = $2') && params.length >= 7) {
      tenant.name = String(params[0] || tenant.name);
      tenant.subscription_plan = String(params[1] || tenant.subscription_plan);
      tenant.subscription_start_date = params[2] || tenant.subscription_start_date;
      tenant.subscription_end_date = params[3] || tenant.subscription_end_date;
      tenant.subscription_status = String(params[4] || tenant.subscription_status);
      tenant.status = String(params[5] || tenant.status);
    } else if (upper.includes('SET NAME = $1') && upper.includes('THEME_COLOR = $2')) {
      tenant.name = String(params[0] || tenant.name);
      tenant.theme_color = String(params[1] || tenant.theme_color);
      tenant.background_color = String(params[2] || tenant.background_color);
      tenant.status = 'ACTIVE';
      tenant.onboarding_completed = true;
    } else if (upper.includes('SET SUBSCRIPTION_PLAN = $1') && params.length === 5) {
      tenant.subscription_plan = String(params[0] || tenant.subscription_plan);
      tenant.subscription_start_date = params[1] || tenant.subscription_start_date;
      tenant.subscription_end_date = params[2] || tenant.subscription_end_date;
      tenant.subscription_status = String(params[3] || tenant.subscription_status);
    } else if (upper.includes('SET SUBSCRIPTION_PLAN = $1') && params.length === 4) {
      tenant.subscription_plan = String(params[0] || tenant.subscription_plan);
      tenant.subscription_start_date = params[1] || tenant.subscription_start_date;
      tenant.subscription_end_date = params[2] || tenant.subscription_end_date;
      tenant.subscription_status = 'ACTIVE';
      tenant.status = 'ACTIVE';
    } else if (upper.includes('SET STATUS = $1') && upper.includes('SUBSCRIPTION_STATUS = $2')) {
      tenant.status = String(params[0] || tenant.status);
      tenant.subscription_status = String(params[1] || tenant.subscription_status);
      tenant.subscription_end_date = params[2] || tenant.subscription_end_date;
    } else if (upper.includes("SET SUBSCRIPTION_STATUS = 'EXPIRED'")) {
      tenant.subscription_status = 'EXPIRED';
    }
    tenant.updated_at = new Date().toISOString();
    return { rows: [tenant as unknown as T], rowCount: 1 };
  }

  if (upper.startsWith('DELETE FROM TENANTS')) {
    const targetId = Number(params[0]);
    mockStore.tenants = mockStore.tenants.filter((t) => Number(t.id) !== targetId);
    return { rows: [], rowCount: 1 };
  }

  // STORE_REQUESTS queries (SELECT, INSERT, UPDATE, DELETE)
  if (upper.startsWith('SELECT') && upper.includes('FROM STORE_REQUESTS')) {
    let rows = [...mockStore.store_requests];
    if (upper.includes('WHERE ID = $1')) {
      rows = rows.filter((r) => Number(r.id) === Number(params[0]));
    } else if (upper.includes('LOWER(BTRIM(OWNER_EMAIL)) = LOWER(BTRIM($1))')) {
      const targetEmail = String(params[0] || '').trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          String(r.owner_email || '').trim().toLowerCase() === targetEmail &&
          (!upper.includes("STATUS = 'PENDING'") || r.status === 'PENDING')
      );
    } else if (upper.includes("WHERE STATUS = 'PENDING'")) {
      const tid = Number(params[0] || 0);
      rows = rows.filter(
        (r) =>
          r.status === 'PENDING' &&
          Number(r.provisioned_tenant_id) === tid
      );
    }
    return { rows: rows as unknown as T[], rowCount: rows.length };
  }

  if (upper.startsWith('INSERT INTO STORE_REQUESTS')) {
    const newReq = {
      id: nextMockId('store_requests'),
      store_name: String(params[0] || '').trim(),
      owner_email: String(params[1] || '').trim().toLowerCase(),
      owner_phone: String(params[2] || '').trim(),
      plan: String(params[3] || 'YEARLY').trim(),
      request_type: upper.includes("'RENEWAL'") ? 'RENEWAL' : 'NEW_STORE',
      notes: params.length > 4 ? String(params[4] || '') : '',
      provisioned_tenant_id: params.length > 5 ? Number(params[5]) || null : null,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockStore.store_requests.unshift(newReq);
    return { rows: [newReq as unknown as T], rowCount: 1 };
  }

  if (upper.startsWith('UPDATE STORE_REQUESTS')) {
    const targetId = Number(params[params.length - 1]);
    const reqRow = mockStore.store_requests.find((r) => Number(r.id) === targetId);
    if (!reqRow) return { rows: [], rowCount: 0 };

    if (upper.includes("SET STATUS = 'REJECTED'")) {
      reqRow.status = 'REJECTED';
    } else if (upper.includes("SET STATUS = 'APPROVED'") && params.length === 2) {
      reqRow.status = 'APPROVED';
      reqRow.provisioned_tenant_id = Number(params[0]);
    } else if (params.length >= 6) {
      reqRow.status = String(params[0] || reqRow.status);
      reqRow.store_name = String(params[1] || reqRow.store_name);
      reqRow.owner_email = String(params[2] || reqRow.owner_email);
      reqRow.owner_phone = String(params[3] ?? reqRow.owner_phone);
      reqRow.plan = String(params[4] || reqRow.plan);
    }
    reqRow.updated_at = new Date().toISOString();
    return { rows: [reqRow as unknown as T], rowCount: 1 };
  }

  if (upper.startsWith('DELETE FROM STORE_REQUESTS')) {
    if (params.length > 0) {
      const targetId = Number(params[0]);
      mockStore.store_requests = mockStore.store_requests.filter((r) => Number(r.id) !== targetId);
    }
    return { rows: [], rowCount: 1 };
  }

  // USERS count queries (only when querying FROM USERS directly)
  if (upper.startsWith('SELECT') && upper.includes('FROM USERS') && upper.includes('COUNT(*)') && !upper.includes('FROM TENANTS')) {
    if (upper.includes("UPPER(ROLE) = 'SUPERADMIN'")) {
      const count = mockStore.users.filter((u) => String(u.role).toUpperCase() === 'SUPERADMIN' && u.active).length;
      return { rows: [{ count: String(count) } as unknown as T], rowCount: 1 };
    }
    const total = mockStore.users.length;
    const admins = mockStore.users.filter((u) => u.role === 'ADMIN' && u.status === 'APPROVED').length;
    return { rows: [{ total: String(total), admins: String(admins) } as unknown as T], rowCount: 1 };
  }

  // COMPANY_SETTINGS queries (SELECT, INSERT, UPDATE, DELETE)
  if (upper.startsWith('SELECT') && upper.includes('FROM COMPANY_SETTINGS')) {
    let rows = mockStore.company_settings.map((cs) => ({
      ...cs,
      name: mockStore.tenants.find((t) => Number(t.id) === Number(cs.tenant_id))?.name || cs.name || 'StepSync Footwear',
    }));
    if (params.length > 0 && (upper.includes('TENANT_ID = $1') || upper.includes('COALESCE(TENANT_ID, 1) = $1'))) {
      rows = rows.filter((cs) => Number(cs.tenant_id) === Number(params[0]));
    }
    return { rows: rows as unknown as T[], rowCount: rows.length };
  }

  if (upper.startsWith('INSERT INTO COMPANY_SETTINGS')) {
    const tid = Number(params[0]) || 1;
    const tenant = mockStore.tenants.find((t) => Number(t.id) === tid);
    const newCs = {
      id: nextMockId('company_settings'),
      tenant_id: tid,
      name: tenant?.name || 'Shoe Store',
      logo: params[1] || '/pwa-512x512.png',
      address: params.length > 6 ? String(params[2] || '') : '',
      phone: params.length > 6 ? String(params[8] || '') : String(params[1] || ''),
      email: params.length > 6 ? String(params[9] || '') : String(params[2] || ''),
      website: '',
      strn: params.length > 6 ? String(params[4] || '') : '',
      tax_id: params.length > 6 ? String(params[3] || '') : '',
      tax_rate: params.length > 6 ? Number(params[5] || 0) : 0,
      currency: params.length > 6 ? String(params[6] || 'PKR') : String(params[3] || 'PKR'),
      currency_name: 'Pakistani Rupee',
      currency_symbol: params.length > 6 ? String(params[7] || 'Rs.') : 'Rs.',
      invoice_prefix: params.length > 6 ? String(params[10] || 'INV-') : 'INV-',
      purchase_prefix: params.length > 6 ? String(params[11] || 'PUR-') : 'PUR-',
      barcode_prefix: params.length > 6 ? String(params[12] || '') : '',
      invoice_footer:
        params.length > 6
          ? String(params[13] || 'Thank you for shopping with us!')
          : 'Thank you for shopping with us!',
      show_receipt_logo: false,
      receipt_logo: '',
      low_stock_limit: params.length > 6 ? Number(params[14] || 5) : 5,
      pricing_mode: params.length > 6 ? String(params[15] || 'FIXED') : 'FIXED',
      pricing_policy_locked: params.length > 6,
      is_installed: params.length > 6,
      updated_at: new Date().toISOString(),
    };
    mockStore.company_settings.push(newCs);
    return { rows: [newCs as unknown as T], rowCount: 1 };
  }

  if (upper.startsWith('UPDATE COMPANY_SETTINGS')) {
    const tid = Number(params[params.length - 1]) || 1;
    const cs = mockStore.company_settings.find((c) => Number(c.tenant_id) === tid);
    if (cs) {
      if (params.length >= 16) {
        cs.logo = params[0] ?? cs.logo;
        cs.address = params[1] ?? cs.address;
        cs.tax_id = params[2] ?? cs.tax_id;
        cs.strn = params[3] ?? cs.strn;
        cs.tax_rate = Number(params[4] ?? cs.tax_rate);
        cs.currency = params[5] ?? cs.currency;
        cs.currency_symbol = params[6] ?? cs.currency_symbol;
        if (params[7]) cs.phone = params[7];
        if (params[8]) cs.email = params[8];
        cs.invoice_prefix = params[9] ?? cs.invoice_prefix;
        cs.purchase_prefix = params[10] ?? cs.purchase_prefix;
        cs.barcode_prefix = params[11] ?? cs.barcode_prefix;
        cs.invoice_footer = params[12] ?? cs.invoice_footer;
        cs.low_stock_limit = Number(params[13] ?? cs.low_stock_limit);
        cs.pricing_mode = params[14] ?? cs.pricing_mode;
        cs.pricing_policy_locked = true;
        cs.is_installed = true;
      }
      cs.updated_at = new Date().toISOString();
      return { rows: [cs as unknown as T], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (upper.startsWith('DELETE FROM COMPANY_SETTINGS')) {
    const tid = Number(params[0]);
    mockStore.company_settings = mockStore.company_settings.filter((c) => Number(c.tenant_id) !== tid);
    return { rows: [], rowCount: 1 };
  }

  // USERS queries (SELECT, INSERT, UPDATE, DELETE)
  if (upper.startsWith('SELECT') && upper.includes('FROM USERS')) {
    let rows = [...mockStore.users];
    if (upper.includes('WHERE ID = $1')) {
      rows = rows.filter((u) => Number(u.id) === Number(params[0]));
    } else if (upper.includes('COALESCE(TENANT_ID, 1) = $2') && upper.includes('LOWER(EMAIL) = LOWER($1)')) {
      rows = rows.filter(
        (u) =>
          String(u.email).toLowerCase() === String(params[0] || '').toLowerCase() &&
          Number(u.tenant_id) === Number(params[1])
      );
    } else if (upper.includes("ROLE = 'ADMIN'") && upper.includes('TENANT_ID = $1')) {
      rows = rows.filter((u) => Number(u.tenant_id) === Number(params[0]) && u.role === 'ADMIN');
    } else if (upper.includes("ROLE = 'CASHIER'") && upper.includes('TENANT_ID = $1')) {
      rows = rows.filter((u) => Number(u.tenant_id) === Number(params[0]) && u.role === 'CASHIER');
    } else if (upper.includes("ROLE = 'SUPERADMIN'") && upper.includes('LOWER(EMAIL) = LOWER($1)')) {
      rows = rows.filter(
        (u) =>
          String(u.role).toUpperCase() === 'SUPERADMIN' &&
          String(u.email).toLowerCase() === String(params[0] || '').toLowerCase()
      );
    } else if (upper.includes('LOWER(BTRIM(EMAIL)) = LOWER(BTRIM($1))') && upper.includes('ID != COALESCE($2, 0)')) {
      rows = rows.filter(
        (u) =>
          String(u.email).trim().toLowerCase() === String(params[0] || '').trim().toLowerCase() &&
          Number(u.id) !== Number(params[1] || 0)
      );
    } else if (upper.includes('LOWER(EMAIL) = LOWER($1)') && params.length >= 2) {
      rows = rows.filter(
        (u) =>
          String(u.email).toLowerCase() === String(params[0] || '').toLowerCase() &&
          Number(u.tenant_id) === Number(params[1])
      );
    } else if (
      upper.includes('LOWER(EMAIL) = LOWER($1)') ||
      upper.includes('LOWER(BTRIM(EMAIL)) = $1') ||
      upper.includes('LOWER(BTRIM(EMAIL)) = LOWER(BTRIM($1))')
    ) {
      rows = rows.filter((u) => String(u.email).trim().toLowerCase() === String(params[0] || '').trim().toLowerCase());
    } else if (upper.includes("UPPER(ROLE) = 'SUPERADMIN'")) {
      rows = rows.filter((u) => String(u.role).toUpperCase() === 'SUPERADMIN');
    } else if (upper.includes('TENANT_ID = $1') || upper.includes('COALESCE(TENANT_ID, 1) = $1')) {
      rows = rows.filter((u) => Number(u.tenant_id) === Number(params[0]));
    }
    return { rows: rows as unknown as T[], rowCount: rows.length };
  }

  if (upper.startsWith('INSERT INTO USERS')) {
    const candidateEmail = String(params[2] || 'user@example.com').trim().toLowerCase();
    const duplicate = mockStore.users.find(
      (u) => String(u.email || '').trim().toLowerCase() === candidateEmail
    );
    if (duplicate) {
      if (upper.includes('ON CONFLICT')) {
        return { rows: [], rowCount: 0 };
      }
      const dupErr: any = new Error('duplicate key value violates unique constraint "users_email_key"');
      dupErr.code = '23505';
      dupErr.constraint = 'users_email_key';
      throw dupErr;
    }
    const newUser = {
      id: nextMockId('users'),
      tenant_id: Number(params[0]) || 1,
      name: String(params[1] || 'User').trim(),
      email: candidateEmail,
      phone: params.length > 4 ? String(params[3] || '').trim() : '',
      avatar_url: '',
      password_hash: params.length > 4 ? params[4] : params[2],
      quick_password: params.length > 5 ? params[5] : '',
      role: upper.includes("'SUPERADMIN'") ? 'SUPERADMIN' : upper.includes("'CASHIER'") ? 'CASHIER' : 'ADMIN',
      status: upper.includes("'PENDING'") ? 'PENDING' : 'APPROVED',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockStore.users.push(newUser);
    return { rows: [newUser as unknown as T], rowCount: 1 };
  }

  if (upper.startsWith('UPDATE USERS')) {
    if (upper.includes('SET PASSWORD_HASH = $1, QUICK_PASSWORD = $2')) {
      const uid = Number(params[2]);
      const u = mockStore.users.find((x) => Number(x.id) === uid);
      if (u) {
        u.password_hash = params[0];
        u.quick_password = params[1];
        u.status = 'APPROVED';
        u.active = true;
      }
      return { rows: u ? ([u] as unknown as T[]) : [], rowCount: u ? 1 : 0 };
    }
    if (upper.includes('SET QUICK_PASSWORD = $1')) {
      const uid = Number(params[1]);
      const u = mockStore.users.find((x) => Number(x.id) === uid);
      if (u) {
        u.quick_password = params[0];
        u.status = 'APPROVED';
        u.active = true;
      }
      return { rows: u ? ([u] as unknown as T[]) : [], rowCount: u ? 1 : 0 };
    }
    if (upper.includes('SET EMAIL = CASE WHEN $1')) {
      const uid = Number(params[2]);
      const u = mockStore.users.find((x) => Number(x.id) === uid);
      if (u) {
        if (params[0]) {
          const nextEmail = String(params[0]).trim().toLowerCase();
          const dup = mockStore.users.find(
            (x) => Number(x.id) !== uid && String(x.email || '').trim().toLowerCase() === nextEmail
          );
          if (dup) {
            const dupErr: any = new Error('duplicate key value violates unique constraint "users_email_key"');
            dupErr.code = '23505';
            dupErr.constraint = 'users_email_key';
            throw dupErr;
          }
          u.email = nextEmail;
        }
        u.phone = String(params[1] ?? u.phone);
      }
      return { rows: u ? ([u] as unknown as T[]) : [], rowCount: u ? 1 : 0 };
    }
    if (upper.includes('SET NAME = $1 WHERE ID = $2')) {
      const u = mockStore.users.find((x) => Number(x.id) === Number(params[1]));
      if (u) u.name = String(params[0]);
      return { rows: u ? ([u] as unknown as T[]) : [], rowCount: u ? 1 : 0 };
    }
    if (upper.includes('SET EMAIL = $1 WHERE ID = $2')) {
      const uid = Number(params[1]);
      const u = mockStore.users.find((x) => Number(x.id) === uid);
      if (u) {
        const nextEmail = String(params[0] || '').trim().toLowerCase();
        const dup = mockStore.users.find(
          (x) => Number(x.id) !== uid && String(x.email || '').trim().toLowerCase() === nextEmail
        );
        if (dup) {
          const dupErr: any = new Error('duplicate key value violates unique constraint "users_email_key"');
          dupErr.code = '23505';
          dupErr.constraint = 'users_email_key';
          throw dupErr;
        }
        u.email = nextEmail;
      }
      return { rows: u ? ([u] as unknown as T[]) : [], rowCount: u ? 1 : 0 };
    }
    if (upper.includes('SET PHONE = $1 WHERE ID = $2')) {
      const u = mockStore.users.find((x) => Number(x.id) === Number(params[1]));
      if (u) u.phone = String(params[0]);
      return { rows: u ? ([u] as unknown as T[]) : [], rowCount: u ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (upper.startsWith('DELETE FROM USERS')) {
    if (upper.includes("ROLE = 'CASHIER'")) {
      const tid = Number(params[0]);
      mockStore.users = mockStore.users.filter((u) => !(Number(u.tenant_id) === tid && u.role === 'CASHIER'));
    } else if (upper.includes("ROLE != 'SUPERADMIN'")) {
      const tid = Number(params[0]);
      mockStore.users = mockStore.users.filter((u) => !(Number(u.tenant_id) === tid && u.role !== 'SUPERADMIN'));
    } else if (params.length > 0) {
      const uid = Number(params[0]);
      mockStore.users = mockStore.users.filter((u) => Number(u.id) !== uid);
    }
    return { rows: [], rowCount: 1 };
  }

  // PRODUCTS queries
  if (upper.startsWith('SELECT') && upper.includes('FROM PRODUCTS')) {
    if (
      upper.includes('LOWER(BARCODE) = LOWER($1)') ||
      upper.includes('LOWER(TRIM(BARCODE)) = LOWER(TRIM($1))') ||
      upper.includes('LOWER(TRIM(BARCODE)) = LOWER($1)') ||
      upper.includes('BARCODE = $1')
    ) {
      const bc = String(params[0] || '').trim().toLowerCase();
      // Determine tenantId parameter index (usually $2, or $3 if id != $2)
      const hasIdNotEqualSecond = upper.includes('ID != $2');
      const tFilter = Number(hasIdNotEqualSecond ? params[2] : params[1]) || 1;
      const excludeId = hasIdNotEqualSecond
        ? (params[1] ? Number(params[1]) : null)
        : (params[2] ? Number(params[2]) : null);
      const matched = mockStore.products.filter(
        (p) =>
          Number(p.tenant_id || 1) === tFilter &&
          String(p.barcode || '').trim().toLowerCase() === bc &&
          (!excludeId || Number(p.id) !== excludeId)
      );
      return { rows: matched as unknown as T[], rowCount: matched.length };
    }
    if (
      upper.includes('LOWER(TRIM(ARTICLE)) = LOWER(TRIM($1))') ||
      upper.includes('LOWER(TRIM(ARTICLE)) = LOWER($1)') ||
      upper.includes('LOWER(ARTICLE) = LOWER($1)')
    ) {
      const art = String(params[0] || '').trim().toLowerCase();
      const hasIdNotEqualSecond = upper.includes('ID != $2');
      const tFilter = Number(hasIdNotEqualSecond ? params[2] : params[1]) || 1;
      const excludeId = hasIdNotEqualSecond
        ? (params[1] ? Number(params[1]) : null)
        : (params[2] ? Number(params[2]) : null);
      const matched = mockStore.products.filter(
        (p) =>
          Number(p.tenant_id || 1) === tFilter &&
          String(p.article || '').trim().toLowerCase() === art &&
          (!excludeId || Number(p.id) !== excludeId)
      );
      return { rows: matched as unknown as T[], rowCount: matched.length };
    }
    if (
      upper.includes('LOWER(TRIM(SKU)) = LOWER(TRIM($1))') ||
      upper.includes('LOWER(TRIM(SKU)) = LOWER($1)') ||
      upper.includes('LOWER(SKU) = LOWER($1)')
    ) {
      const sk = String(params[0] || '').trim().toLowerCase();
      const hasIdNotEqualSecond = upper.includes('ID != $2');
      const tFilter = Number(hasIdNotEqualSecond ? params[2] : params[1]) || 1;
      const excludeId = hasIdNotEqualSecond
        ? (params[1] ? Number(params[1]) : null)
        : (params[2] ? Number(params[2]) : null);
      const matched = mockStore.products.filter(
        (p) =>
          Number(p.tenant_id || 1) === tFilter &&
          String(p.sku || '').trim().toLowerCase() === sk &&
          (!excludeId || Number(p.id) !== excludeId)
      );
      return { rows: matched as unknown as T[], rowCount: matched.length };
    }
    if (
      (upper.includes('WHERE P.ID = $1') || upper.includes('WHERE ID = $1')) &&
      (upper.includes('TENANT_ID') || params.length >= 2)
    ) {
      const targetId = Number(params[0]);
      const tFilter = Number(params[1] || 1);
      const matched = mockStore.products.filter(
        (p) => Number(p.id) === targetId && Number(p.tenant_id || 1) === tFilter
      );
      return { rows: matched as unknown as T[], rowCount: matched.length };
    }

    const tid = params.length > 0 ? Number(params[0]) : null;
    const storeProds = mockStore.products.filter(
      (p) => p.active !== false && (!tid || Number(p.tenant_id) === tid)
    );
    if (upper.includes('AS TOTAL_PRODUCTS') && upper.includes('AS OUT_OF_STOCK_COUNT')) {
      return {
        rows: [
          {
            total_products: String(storeProds.length),
            total_stock_units: String(storeProds.reduce((s, p) => s + Number(p.total_stock || 0), 0)),
            low_stock_count: String(
              storeProds.filter((p) => Number(p.total_stock || 0) <= Number(p.low_stock_limit || 5) && Number(p.total_stock || 0) > 0).length
            ),
            out_of_stock_count: String(storeProds.filter((p) => Number(p.total_stock || 0) <= 0).length),
          } as unknown as T,
        ],
        rowCount: 1,
      };
    }
    if (upper.includes('COUNT(*)::INT AS CNT') && upper.includes('MAX(TENANT_PRODUCT_NO)')) {
      const allTenantProds = mockStore.products.filter((p) => !tid || Number(p.tenant_id) === tid);
      const maxNo = allTenantProds.reduce((m, p) => Math.max(m, Number(p.tenant_product_no || p.id || 0)), 0);
      return { rows: [{ cnt: allTenantProds.length, max_no: maxNo } as unknown as T], rowCount: 1 };
    }
    if (upper.includes('TENANT_PRODUCT_NO = ANY($2')) {
      const candidates: number[] = Array.isArray(params[1]) ? params[1].map(Number) : [];
      const matched = mockStore.products
        .filter((p) => Number(p.tenant_id || 1) === Number(params[0] || 1) && candidates.includes(Number(p.tenant_product_no)))
        .map((p) => ({ tenant_product_no: p.tenant_product_no }));
      return { rows: matched as unknown as T[], rowCount: matched.length };
    }
    if (upper.includes('AS PRODUCT_ID') && upper.includes('AS UNITS_SOLD')) {
      const rows = storeProds.slice(0, 4).map((p) => ({
        product_id: p.id,
        name: p.article || p.name,
        sku: p.sku,
        category_name: p.category || '',
        stock: String(p.total_stock || 0),
        brand_name: p.brand || 'Unbranded',
        brand_logo: '',
        primary_image_url: p.primary_image_url || '',
        units_sold: 0,
      })) as unknown as T[];
      return { rows, rowCount: rows.length };
    }
    if (upper.includes('AS STOCK_COUNT') && upper.includes('GROUP BY P.BRAND')) {
      const rows = storeProds.map((p) => ({
        name: p.brand || 'StepSync',
        stock_count: Number(p.total_stock || 0),
      })) as unknown as T[];
      return { rows, rowCount: rows.length };
    }
    return { rows: storeProds as unknown as T[], rowCount: storeProds.length };
  }

  if (upper.startsWith('INSERT INTO PRODUCTS')) {
    const tid = Number(params[0]) || 1;
    const storeProds = mockStore.products.filter((p) => Number(p.tenant_id) === tid);
    const isFullInsert = params.length >= 15;
    const newProd = isFullInsert
      ? {
          id: nextMockId('products'),
          tenant_id: tid,
          tenant_product_no: Number(params[1]) || storeProds.length + 1,
          name: String(params[2] || 'Shoe Product'),
          brand: String(params[3] || 'Local'),
          category: String(params[4] || 'Men'),
          sku: String(params[5] || `SKU-${Date.now()}`),
          article: String(params[6] || 'SH-01'),
          barcode: String(params[7] || `BC-${Date.now()}`),
          primary_image_url: String(params[8] || ''),
          description: String(params[9] || ''),
          cost_price: Number(params[10] || 0),
          min_price: Number(params[11] || 0),
          max_price: Number(params[12] || 0),
          total_stock: Number(params[13] || 0),
          low_stock_limit: Number(params[14] || 5),
          pricing_policy: String(params[15] || 'FIXED'),
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : {
          id: nextMockId('products'),
          tenant_id: tid,
          tenant_product_no: storeProds.length + 1,
          name: String(params[1] || 'Shoe Product'),
          article: String(params[1] || 'SH-01'),
          sku: String(params[2] || `SKU-${Date.now()}`),
          barcode: String(params[3] || `BC-${Date.now()}`),
          brand: String(params[4] || 'StepSync'),
          category: String(params[5] || 'Casual Shoes'),
          cost_price: Number(params[6] || 2000),
          min_price: Number(params[7] || 3000),
          max_price: Number(params[8] || 3500),
          pricing_policy: String(params[9] || 'FIXED'),
          total_stock: Number(params[10] || 15),
          low_stock_limit: Number(params[11] || 5),
          primary_image_url: '',
          description: '',
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
    mockStore.products.push(newProd);
    return { rows: [newProd as unknown as T], rowCount: 1 };
  }

  if (upper.startsWith('UPDATE PRODUCTS')) {
    if (upper.includes('WHERE ID = $16 AND COALESCE(TENANT_ID, 1) = $17')) {
      const targetId = Number(params[15]);
      const tid = Number(params[16]) || 1;
      const prod = mockStore.products.find((p) => Number(p.id) === targetId && Number(p.tenant_id || 1) === tid);
      if (prod) {
        prod.name = String(params[0] ?? prod.name);
        prod.brand = String(params[1] ?? prod.brand);
        prod.category = String(params[2] ?? prod.category);
        prod.sku = String(params[3] ?? prod.sku);
        prod.article = String(params[4] ?? prod.article);
        prod.barcode = String(params[5] ?? prod.barcode);
        prod.primary_image_url = String(params[6] ?? prod.primary_image_url);
        prod.description = String(params[7] ?? prod.description);
        prod.cost_price = Number(params[8] ?? prod.cost_price);
        prod.total_stock = Number(params[9] ?? prod.total_stock);
        prod.low_stock_limit = Number(params[10] ?? prod.low_stock_limit);
        prod.active = Boolean(params[11] ?? prod.active);
        prod.min_price = Number(params[12] ?? prod.min_price);
        prod.max_price = Number(params[13] ?? prod.max_price);
        prod.pricing_policy = String(params[14] ?? prod.pricing_policy);
        prod.updated_at = new Date().toISOString();
        return { rows: [prod as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (upper.includes('SET ACTIVE = FALSE') && upper.includes('WHERE ID = $1')) {
      const targetId = Number(params[0]);
      const tid = Number(params[1]) || 1;
      const prod = mockStore.products.find((p) => Number(p.id) === targetId && Number(p.tenant_id || 1) === tid);
      if (prod) {
        prod.active = false;
        prod.updated_at = new Date().toISOString();
      }
      return { rows: prod ? ([prod] as unknown as T[]) : [], rowCount: prod ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (upper.startsWith('DELETE FROM PRODUCTS')) {
    const targetId = Number(params[0]);
    const tid = params.length > 1 ? Number(params[1]) : null;
    mockStore.products = mockStore.products.filter(
      (p) => !(Number(p.id) === targetId && (!tid || Number(p.tenant_id || 1) === tid))
    );
    return { rows: [], rowCount: 1 };
  }

  // Sales / Dashboard aggregates
  if (upper.startsWith('SELECT') && upper.includes('FROM SALES')) {
    if (upper.includes('AS TOTAL_SALES') && upper.includes('AS TOTAL_DISCOUNT')) {
      return { rows: [{ count: '0', total_sales: '0', total_discount: '0' } as unknown as T], rowCount: 1 };
    }
    if (upper.includes('AS TOTAL_REVENUE') && upper.includes('AS TOTAL_PROFIT')) {
      return { rows: [{ total_revenue: '0', total_profit: '0', total_sales_count: '0' } as unknown as T], rowCount: 1 };
    }
    return { rows: mockStore.sales as unknown as T[], rowCount: mockStore.sales.length };
  }

  if (upper.startsWith('SELECT') && upper.includes('FROM SALE_ITEMS') && upper.includes('AS PROFIT')) {
    return { rows: [{ profit: '0', cost: '0' } as unknown as T], rowCount: 1 };
  }

  if (upper.startsWith('SELECT') && upper.includes('FROM CUSTOMERS') && upper.includes('COUNT(*)')) {
    return { rows: [{ count: String(mockStore.customers.length) } as unknown as T], rowCount: 1 };
  }

  if (upper.startsWith('SELECT') && upper.includes('FROM PURCHASES') && upper.includes('COUNT(*)')) {
    return { rows: [{ count: String(mockStore.purchases.length), total: '0' } as unknown as T], rowCount: 1 };
  }

  if (upper.startsWith('SELECT') && upper.includes('FROM BRANDS')) {
    return { rows: mockStore.brands as unknown as T[], rowCount: mockStore.brands.length };
  }

  if (upper.startsWith('SELECT') && upper.includes('FROM CATEGORIES')) {
    return { rows: mockStore.categories as unknown as T[], rowCount: mockStore.categories.length };
  }

  return { rows: [], rowCount: 0 };
}

function createDbInfo(url: string): DbConnectionInfo {
  let maskedUrl = 'postgresql://[in-memory-mock]';
  let host = 'in-memory-mock';
  let port = 5432;
  let database = 'postgres';
  let user = 'postgres';

  if (url) {
    try {
      const parsed = new URL(url);
      host = parsed.hostname || 'localhost';
      port = parsed.port ? parseInt(parsed.port, 10) : 5432;
      database = parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'postgres';
      user = parsed.username || 'postgres';
      maskedUrl = `${parsed.protocol}//${user}:****@${host}:${port}/${database}`;
    } catch (_) {
      // Keep credentials masked if DATABASE_URL cannot be parsed.
    }
  }

  return {
    type: 'PostgreSQL Server',
    isStandardPostgres: true,
    host,
    port,
    database,
    user,
    ssl: true,
    maskedUrl,
    connected: false,
  };
}

if (!rawDatabaseUrl || (!rawDatabaseUrl.startsWith('postgres://') && !rawDatabaseUrl.startsWith('postgresql://'))) {
  console.warn('[AI Studio] DATABASE_URL not configured — using in-memory PostgreSQL mock.');
  useMock = true;
  dbInfo = createDbInfo('');
  dbInfo.connected = true;
} else {
  dbInfo = createDbInfo(rawDatabaseUrl);
  try {
    console.log(`🔌 Initializing PostgreSQL Client Pool to ${dbInfo.host}:${dbInfo.port}/${dbInfo.database}...`);
    rawPool = new Pool({
      connectionString: rawDatabaseUrl,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    rawPool.on('error', (err: any) => {
      const msg = err?.message || String(err);
      if (
        msg.includes('Connection terminated unexpectedly') ||
        msg.includes('ECONNRESET') ||
        msg.includes('connection reset') ||
        msg.includes('client has been closed') ||
        err?.code === '57P01'
      ) {
        console.warn(`ℹ️ PostgreSQL pool pruned an idle connection (${msg}). Active connections will reconnect on-demand.`);
        return;
      }
      console.error('Unexpected PostgreSQL Pool Client Error:', err);
      dbInfo.lastError = msg;
    });
  } catch (err: any) {
    console.warn('[AI Studio] Failed to initialize pg Pool — falling back to in-memory mock:', err?.message);
    useMock = true;
    dbInfo.connected = true;
  }
}

let readinessPromise: Promise<void> | null = null;

async function waitForDatabaseReady(): Promise<void> {
  if (useMock || dbInfo.connected) return;
  if (!rawPool) {
    useMock = true;
    dbInfo.connected = true;
    return;
  }
  if (!readinessPromise) {
    readinessPromise = (async () => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await rawPool!.query('SELECT 1');
          console.log(`✅ Connected to PostgreSQL Server (${dbInfo.host}:${dbInfo.port}/${dbInfo.database})`);
          dbInfo.connected = true;
          dbInfo.lastError = undefined;
          return;
        } catch (err: any) {
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 500));
            continue;
          }
          console.warn(`[AI Studio] PostgreSQL connection failed (${err?.message || err}) — switching to in-memory mock.`);
          useMock = true;
          dbInfo.connected = true;
          dbInfo.lastError = undefined;
        }
      }
    })().finally(() => {
      readinessPromise = null;
    });
  }
  return readinessPromise!;
}

// Unified PostgreSQL client interface used throughout the application.
export const pgClient = {
  get waitReady() {
    return waitForDatabaseReady();
  },

  async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount?: number }> {
    await waitForDatabaseReady();
    if (useMock || !rawPool) {
      return executeMockQuery<T>(text, params);
    }

    const store = txStorage.getStore();
    const trimmed = text.trim().toUpperCase();

    const isTransientConnectionError = (err: any): boolean => {
      const msg = (err?.message || String(err)).toLowerCase();
      const code = err?.code;
      return (
        msg.includes('connection terminated') ||
        msg.includes('econnreset') ||
        msg.includes('connection reset') ||
        msg.includes('client was closed') ||
        msg.includes('socket hang up') ||
        msg.includes('terminating connection') ||
        msg.includes('closed the connection unexpectedly') ||
        code === '57P01' ||
        code === 'ECONNRESET' ||
        code === 'EPIPE'
      );
    };

    if (trimmed === 'BEGIN') {
      if (store) {
        if (!store.client) store.client = await rawPool.connect();
        const res = await store.client.query(text);
        return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
      }
      const client = await rawPool.connect();
      try {
        const res = await client.query(text);
        return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
      } finally {
        client.release();
      }
    }

    if (trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
      if (store?.client) {
        const client = store.client;
        store.client = null;
        try {
          const res = await client.query(text);
          client.release();
          return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
        } catch (txErr) {
          try { client.release(true); } catch (_) {}
          throw txErr;
        }
      }
      const res = await rawPool.query(text);
      return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
    }

    if (store?.client) {
      try {
        const res = await store.client.query(text, params);
        return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
      } catch (err: any) {
        if (isTransientConnectionError(err)) {
          try { store.client.release(true); } catch (_) {}
          store.client = null;
        }
        throw err;
      }
    }

    let lastErr: any;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await rawPool.query(text, params);
        return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
      } catch (err: any) {
        lastErr = err;
        if (attempt === 1 && isTransientConnectionError(err)) {
          console.warn(`⚠️ PostgreSQL connection reset during query (${err?.message || err}). Retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 150));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  },

  async exec(sql: string): Promise<void> {
    await waitForDatabaseReady();
    if (useMock || !rawPool) {
      return;
    }
    await rawPool.query(sql);
  },
};

export { dbInfo, rawPool };
