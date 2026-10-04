import type { Request, Response, NextFunction } from 'express';
import { pgClient } from '../../db/index.ts';
import {
  ensureSaasControlPlane,
  generateUniqueAppKey,
  normalizeSubscriptionPlan,
  calculateSubscriptionEndDate,
} from '../../db/schemaInit.ts';

export interface TenantRouteResolution {
  mode: 'LANDING' | 'SUPERADMIN' | 'TENANT_ACTIVE' | 'TENANT_SUSPENDED' | 'TENANT_EXPIRED' | 'TENANT_NOT_FOUND';
  host: string;
  rewrittenPath: string;
  tenant: {
    id: number;
    slug: string;
    name: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
    appKey: string;
    subscriptionPlan: '6_MONTHS' | 'YEARLY' | string;
    subscriptionStartDate: string;
    subscriptionEndDate: string;
    subscriptionStatus: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
    themeColor: string;
    backgroundColor: string;
    logoUrl: string;
    address: string;
    taxId: string;
    currency: string;
    onboardingCompleted: boolean;
  } | null;
}

/** Resolve tenant identity from the shared tenantId selector. */
export function parseTenantSelectionFromRequest(req: Request): {
  host: string;
  isSuperAdminRoute: boolean;
} {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
  const pathname = req.path || '/';
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return { host, isSuperAdminRoute: true };
  }
  return { host, isSuperAdminRoute: false };
}
/**
 * Resolves the tenant context for any incoming request
 */
export async function resolveTenantContext(req: Request): Promise<TenantRouteResolution> {
  await ensureSaasControlPlane();
  const parsed = parseTenantSelectionFromRequest(req);

  if (parsed.isSuperAdminRoute) {
    return {
      mode: 'SUPERADMIN',
      host: parsed.host,
      rewrittenPath: '/admin',
      tenant: null,
    };
  }

  const tenantId = Number(req.query?.tenantId ?? req.query?.tenant_id ?? req.headers['x-tenant-id']);
  if (!Number.isSafeInteger(tenantId) || tenantId <= 0) {
    return {
      mode: 'LANDING',
      host: parsed.host,
      rewrittenPath: '/',
      tenant: null,
    };
  }

  const tenantRes = await pgClient.query<{
    id: number;
    slug: string;
    name: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
    app_key: string;
    subscription_plan: string;
    subscription_start_date: string;
    subscription_end_date: string;
    subscription_status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
    theme_color: string;
    background_color: string;
    logo_url: string;
    address: string;
    tax_id: string;
    currency: string;
    onboarding_completed: boolean;
  }>(
    `SELECT t.id, t.slug, t.name, t.status, t.app_key, t.subscription_plan,
            t.subscription_start_date, t.subscription_end_date, t.subscription_status,
            t.theme_color, t.background_color, t.onboarding_completed,
            COALESCE(NULLIF(cs.logo, ''), '/pwa-512x512.png') AS logo_url,
            COALESCE(cs.address, '') AS address,
            COALESCE(cs.tax_id, '') AS tax_id,
            COALESCE(cs.currency, 'PKR') AS currency
     FROM tenants t
     LEFT JOIN company_settings cs ON cs.tenant_id = t.id
     WHERE t.id = $1
     LIMIT 1`,
    [tenantId]
  );

  if (tenantRes.rows.length === 0) {
    return {
      mode: 'TENANT_NOT_FOUND',
      host: parsed.host,
      rewrittenPath: '/',
      tenant: null,
    };
  }

  const row = tenantRes.rows[0];
  let effectiveAppKey = row.app_key && String(row.app_key).trim() ? String(row.app_key).trim() : '';
  const effectivePlan = normalizeSubscriptionPlan(
    row.subscription_plan || (row.slug === 'mystore' || row.slug === 'apex-boots' ? '6_MONTHS' : 'YEARLY')
  );
  const effectiveStartDt = row.subscription_start_date ? new Date(row.subscription_start_date) : new Date();
  const effectiveEndDt = row.subscription_end_date
    ? new Date(row.subscription_end_date)
    : calculateSubscriptionEndDate(effectivePlan, effectiveStartDt);

  let effectiveSubscriptionStatus: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' =
    (String(row.subscription_status || 'ACTIVE').toUpperCase() as 'ACTIVE' | 'EXPIRED' | 'SUSPENDED');

  // Automatic Expiry Tracking: Check if subscriptionEndDate < currentTimestamp
  if (effectiveEndDt.getTime() < Date.now()) {
    effectiveSubscriptionStatus = 'EXPIRED';
  } else if (row.status === 'SUSPENDED') {
    effectiveSubscriptionStatus = 'SUSPENDED';
  }

  if (!effectiveAppKey || !row.subscription_start_date || !row.subscription_end_date || String(row.subscription_status).toUpperCase() !== effectiveSubscriptionStatus) {
    if (!effectiveAppKey) {
      effectiveAppKey = await generateUniqueAppKey();
    }
    await pgClient
      .query(
        `UPDATE tenants
         SET app_key = $1,
             subscription_plan = $2,
             subscription_start_date = $3,
             subscription_end_date = $4,
             subscription_status = $5,
             updated_at = NOW()
         WHERE id = $6`,
        [
          effectiveAppKey,
          effectivePlan,
          effectiveStartDt.toISOString(),
          effectiveEndDt.toISOString(),
          effectiveSubscriptionStatus,
          row.id,
        ]
      )
      .catch(() => {});
  }

  const tenant = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    appKey: effectiveAppKey,
    subscriptionPlan: effectivePlan,
    subscriptionStartDate: effectiveStartDt.toISOString(),
    subscriptionEndDate: effectiveEndDt.toISOString(),
    subscriptionStatus: effectiveSubscriptionStatus,
    themeColor: row.theme_color || '#7C3AED',
    backgroundColor: row.background_color || '#0F172A',
    logoUrl: row.logo_url || '/pwa-512x512.png',
    address: row.address || '',
    taxId: row.tax_id || '',
    currency: row.currency || 'PKR',
    onboardingCompleted: Boolean(row.onboarding_completed),
  };

  if (row.status === 'SUSPENDED' || effectiveSubscriptionStatus === 'SUSPENDED') {
    return {
      mode: 'TENANT_SUSPENDED',
      host: parsed.host,
      rewrittenPath: `/?tenantId=${row.id}`,
      tenant,
    };
  }

  if (effectiveSubscriptionStatus === 'EXPIRED' || row.status === 'EXPIRED') {
    return {
      mode: 'TENANT_EXPIRED',
      host: parsed.host,
      rewrittenPath: `/?tenantId=${row.id}`,
      tenant,
    };
  }

  return {
    mode: 'TENANT_ACTIVE',
    host: parsed.host,
    rewrittenPath: `/?tenantId=${row.id}`,
    tenant,
  };
}

/**
 * Shared-domain multi-tenant routing middleware
 * Attaches resolved tenant metadata to `req` and enforces real-time suspension and subscription expiry checks on API calls.
 */
export async function tenantRoutingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // The installer must remain reachable before the application schema exists.
  // Browser document/static requests do not need database tenant resolution.
  if (req.path.startsWith('/api/install/') || !req.path.startsWith('/api/')) {
    return next();
  }

  try {
    // Skip static assets
    if (
      req.path.startsWith('/assets/') ||
      req.path.startsWith('/node_modules/') ||
      req.path.startsWith('/src/') ||
      req.path.startsWith('/@') ||
      req.path.endsWith('.png') ||
      req.path.endsWith('.svg') ||
      req.path.endsWith('.ico') ||
      req.path.endsWith('.jpg')
    ) {
      return next();
    }

    const resolution = await resolveTenantContext(req);
    (req as any).tenantResolution = resolution;

    // Set informational headers for debugging and PWA scope inspection
    res.setHeader('X-SaaS-Mode', resolution.mode);
    if (resolution.tenant) {
      res.setHeader('X-Tenant-Id', String(resolution.tenant.id));
      res.setHeader('X-Tenant-Status', resolution.tenant.status);
      res.setHeader('X-Subscription-Status', resolution.tenant.subscriptionStatus);
    }

    // Real-time middleware enforcement: block API calls to expired or suspended tenants (except superadmin, auth & saas resolution)
    if (
      req.path.startsWith('/api/') &&
      !req.path.startsWith('/api/superadmin') &&
      !req.path.startsWith('/api/saas') &&
      !req.path.startsWith('/api/tenants/') &&
      !req.path.startsWith('/api/auth')
    ) {
      if (resolution.mode === 'TENANT_EXPIRED' || resolution.tenant?.subscriptionStatus === 'EXPIRED') {
        return res.status(403).json({
          error: 'Your subscription key has expired. Please contact support to renew.',
          code: 'SUBSCRIPTION_EXPIRED',
          tenant: resolution.tenant,
        });
      }
      if (resolution.mode === 'TENANT_SUSPENDED') {
        return res.status(423).json({
          error: `Store "${resolution.tenant?.name || 'this tenant'}" is currently suspended. Please contact platform billing or support.`,
          code: 'TENANT_SUSPENDED',
          tenant: resolution.tenant,
        });
      }
    }

    next();
  } catch (err) {
    next();
  }
}
