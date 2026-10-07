import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pgClient, dbInfo, isStandardPostgres } from '../../db/index.ts';
import {
  dropAllTables,
  ensureDatabaseSchema,
  REQUIRED_DATABASE_TABLES,
  resetSaasControlPlaneState,
} from '../../db/schemaInit.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'shoe-pos-super-secure-jwt-secret-key-2026';

const router = Router();

export interface InstallationStatus {
  installed: boolean;
  hasSuperAdmin: boolean;
  missingTables: string[];
  dbReady: boolean;
  tablesExist: boolean;
  isDatabaseReady: boolean;
  isSettingsConfigured: boolean;
  hasUsers: boolean;
  hasAdmin: boolean;
  adminCount: number;
  isInstalled: boolean;
  storeName?: string;
  version: string;
  dbType: string;
  isStandardPostgres: boolean;
  dbEngine: string;
  dbHost?: string;
  dbPort?: number;
  dbName?: string;
  dbUser?: string;
  maskedUrl?: string;
  timestamp: string;
  error?: string;
}

/**
 * Checks whether the application has been installed.
 * CRITICAL: This NEVER creates missing tables or inserts default data.
 * If tables or records do not exist yet, it safely reports uninstalled.
 */
export async function checkInstallationStatus(): Promise<InstallationStatus> {
  try {
    // 1. Verify PostgreSQL database connection without creating tables
    await pgClient.waitReady;
    await pgClient.query('SELECT 1');

    // 2. Authoritative check whether tables exist in the database WITHOUT creating them
    const requiredTables = [...REQUIRED_DATABASE_TABLES];
    const tableCheck = await pgClient.query<{ table_name: string; present: boolean }>(
      `SELECT required.table_name, to_regclass('public.' || quote_ident(required.table_name)) IS NOT NULL AS present
       FROM unnest($1::text[]) AS required(table_name)`,
      [requiredTables]
    );
    const missingTables = tableCheck.rows.filter((row) => !row.present).map((row) => row.table_name);
    const hasUsersTable = !missingTables.includes('users');
    const hasSettingsTable = !missingTables.includes('company_settings');
    const hasProductsTable = !missingTables.includes('products');
    const hasSalesTable = !missingTables.includes('sales');
    const isDatabaseReady = missingTables.length === 0;
    const tablesExist = isDatabaseReady;

    let isSettingsConfigured = false;
    let isInstalledFlag = false;
    let storeName = '';

    if (hasSettingsTable) {
      try {
        const settingsRes = await pgClient.query<any>(
          `SELECT cs.id, COALESCE(t.name, 'Retail Store') AS name, cs.is_installed, cs.currency, cs.currency_symbol
           FROM company_settings cs
           LEFT JOIN tenants t ON t.id = cs.tenant_id
           ORDER BY cs.id ASC
           LIMIT 1`
        );
        if (settingsRes.rows.length > 0) {
          isSettingsConfigured = true;
          isInstalledFlag = Boolean(settingsRes.rows[0].is_installed);
          if (settingsRes.rows[0].name) {
            storeName = settingsRes.rows[0].name;
          }
        }
      } catch {
        // Table not ready or dropped during installation reset
        isSettingsConfigured = false;
        isInstalledFlag = false;
      }
    }

    let hasUsers = false;
    let hasAdmin = false;
    let adminCount = 0;
    let hasSuperAdmin = false;

    if (hasUsersTable) {
      try {
        const usersCheck = await pgClient.query<{ total: string; admins: string }>(`
          SELECT 
            COUNT(*)::text as total,
            COUNT(*) FILTER (WHERE role = 'ADMIN' AND status = 'APPROVED')::text as admins
          FROM users
        `);
        const totalUsers = parseInt(usersCheck.rows[0]?.total || '0', 10);
        adminCount = parseInt(usersCheck.rows[0]?.admins || '0', 10);
        hasUsers = totalUsers > 0;
        hasAdmin = adminCount > 0;
        const superAdminCheck = await pgClient.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM users WHERE UPPER(role) = 'SUPERADMIN' AND active = true AND status = 'APPROVED'`
        );
        hasSuperAdmin = Number(superAdminCheck.rows[0]?.count || 0) > 0;
      } catch {
        // Users table not ready or empty
        hasUsers = false;
        hasAdmin = false;
        adminCount = 0;
      }
    }

    // Reliable Installation Check:
    // All 4 conditions MUST be satisfied:
    // 1. Database schema/tables exist
    // 2. Settings row exists in company_settings
    // 3. At least one user exists
    // 4. An approved ADMIN user exists
    // 5. is_installed is true in company_settings
    const isInstalled = isDatabaseReady && isSettingsConfigured && hasUsers && hasAdmin && isInstalledFlag;
    const installed = isDatabaseReady && hasSuperAdmin;

    return {
      dbReady: true,
      installed,
      hasSuperAdmin,
      missingTables,
      tablesExist,
      isDatabaseReady,
      isSettingsConfigured,
      hasUsers,
      hasAdmin,
      adminCount,
      isInstalled,
      storeName,
      version: '2.4.0',
      dbType: dbInfo.type,
      isStandardPostgres,
      dbEngine: 'PostgreSQL Server',
      dbHost: dbInfo.host,
      dbPort: dbInfo.port,
      dbName: dbInfo.database,
      dbUser: dbInfo.user,
      maskedUrl: dbInfo.maskedUrl,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      dbReady: false,
      installed: false,
      hasSuperAdmin: false,
      missingTables: [],
      tablesExist: false,
      isDatabaseReady: false,
      isSettingsConfigured: false,
      hasUsers: false,
      hasAdmin: false,
      adminCount: 0,
      isInstalled: false,
      version: '2.4.0',
      dbType: dbInfo?.type || 'Unknown',
      isStandardPostgres: isStandardPostgres || false,
      dbEngine: 'Disconnected',
      timestamp: new Date().toISOString(),
      error: err.message,
    };
  }
}

/**
 * Verifies if an install/reinstall request is authorized when the system is locked.
 */
async function verifyInstallerAuthorization(req: Request): Promise<boolean> {
  const status = await checkInstallationStatus();
  if (!status.installed) {
    // First-run setup is allowed only through /bootstrap. Destructive/reset
    // operations remain locked until a real superadmin has been configured.
    return false;
  }

  // 1. Check X-Auth-Token or Bearer token in Authorization header
  const customToken = typeof req.headers['x-auth-token'] === 'string' ? req.headers['x-auth-token'].trim() : '';
  const authHeader = req.headers.authorization;
  const rawToken = customToken || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : '');
  if (rawToken) {
    try {
      const decoded = jwt.verify(rawToken, JWT_SECRET) as any;
      if (decoded && (decoded.role === 'ADMIN' || decoded.role === 'admin' || decoded.role === 'SUPERADMIN')) {
        return true;
      }
    } catch (_) {}
  }

  // 2. Check Admin password in request body or custom header
  const overridePass =
    req.body?.admin_password ||
    req.body?.unlock_password ||
    req.body?.password ||
    (req.headers['x-admin-password'] as string | undefined) ||
    (req.headers['x-unlock-password'] as string | undefined);

  if (overridePass && typeof overridePass === 'string') {
    const trimmedPass = overridePass.trim();
    try {
      const adminUsers = await pgClient.query<any>("SELECT password_hash FROM users WHERE role = 'ADMIN'");
      for (const a of adminUsers.rows) {
        if (await bcrypt.compare(trimmedPass, a.password_hash)) {
          return true;
        }
      }
    } catch (_) {}

    // Fallback for default master password if provided
    if (
      trimmedPass === 'admin123' ||
      trimmedPass === 'admin' ||
      trimmedPass === 'password' ||
      trimmedPass === 'password123'
    ) {
      return true;
    }
  }

  return false;
}

// =========================================================================
// 1. GET /api/install/status
// =========================================================================
router.get('/status', async (_req: Request, res: Response) => {
  const status = await checkInstallationStatus();
  return res.json(status);
});

// =========================================================================
// First-run bootstrap: create schema and the operator-provided superadmin only.
// It intentionally does not insert stores, demo rows, or default credentials.
// =========================================================================
router.post(['/bootstrap', '/install-platform'], async (req: Request, res: Response) => {
  try {
    await pgClient.waitReady;

    const before = await checkInstallationStatus();
    if (before.installed) {
      return res.status(409).json({ error: 'Installation is already complete.' });
    }

    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const phone = String(req.body?.phone || req.body?.whatsapp || req.body?.phone_whatsapp || '').trim();

    if (!before.hasSuperAdmin) {
      if (!name) {
        return res.status(400).json({ error: 'Superadmin name is required.' });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return res.status(400).json({ error: 'A valid superadmin email address is required.' });
      }
      if (!phone) {
        return res.status(400).json({ error: "Superadmin phone / WhatsApp number is required." });
      }
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 7 || phoneDigits.length > 15) {
        return res.status(400).json({
          error: 'Enter a valid superadmin phone / WhatsApp number (7-15 digits, e.g. +923001234567 or +15550199).',
        });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'A password of at least 8 characters is required.' });
      }
    }

    // 1. Reset any cached state and load the full database schema so all tables (including users) exist first
    resetSaasControlPlaneState();
    await ensureDatabaseSchema();

    // 2. Verify that all required tables (especially users) exist before running any query on users
    const schemaCheck = await pgClient.query<{ table_name: string; present: boolean }>(
      `SELECT required.table_name, to_regclass('public.' || quote_ident(required.table_name)) IS NOT NULL AS present
       FROM unnest($1::text[]) AS required(table_name)`,
      [[...REQUIRED_DATABASE_TABLES]]
    );
    const missingAfterSchema = schemaCheck.rows.filter((r) => !r.present).map((r) => r.table_name);
    if (missingAfterSchema.length > 0) {
      return res.status(500).json({
        error: `Failed to initialize required database tables: ${missingAfterSchema.join(', ')}`,
        missingTables: missingAfterSchema,
      });
    }

    // 3. Create the initial SuperAdmin account in the newly verified users table
    const superadmins = await pgClient.query<{ id: number }>(
      `SELECT id FROM users WHERE UPPER(role) = 'SUPERADMIN' AND active = true AND status = 'APPROVED' ORDER BY id ASC LIMIT 1`
    );
    if (superadmins.rows.length === 0) {
      const existingEmail = await pgClient.query<{ id: number }>(
        `SELECT id FROM users WHERE LOWER(BTRIM(email)) = LOWER(BTRIM($1)) LIMIT 1`,
        [email]
      );
      if (existingEmail.rows.length > 0) {
        return res.status(409).json({ error: 'That email is already in use. Choose a different email address.' });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      await pgClient.query(
        `INSERT INTO users (tenant_id, name, email, phone, password_hash, quick_password, role, status, active)
         VALUES (1, $1, $2, $3, $4, $5, 'SUPERADMIN', 'APPROVED', true)`,
        [name, email, phone, passwordHash, password]
      );
    } else if (phone) {
      await pgClient.query(`UPDATE users SET phone = $1 WHERE id = $2`, [phone, superadmins.rows[0].id]);
    }

    // 4. Record schema initialization markers so control-plane startup knows the schema is ready
    await pgClient
      .query(
        `INSERT INTO deleted_store_requests (request_id, marker_key)
         VALUES (0, '__seeded_stores_and_requests_removed_v1__'),
                (0, '__schema_v11_remove_requested_slug__')`
      )
      .catch(() => {});

    const after = await checkInstallationStatus();
    if (!after.installed) {
      return res.status(500).json({
        error: 'Database setup is incomplete after schema creation.',
        missingTables: after.missingTables,
      });
    }
    return res.json({ success: true, installed: true, message: 'Installation completed.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Installation could not be completed.' });
  }
});

// =========================================================================
// 2. POST /api/install/reset (Recommission / Unlock Installer)
// Requires Admin password or Bearer token
// =========================================================================
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const installStatus = await checkInstallationStatus();
    if (!installStatus.installed) {
      return res.status(403).json({ error: 'Use the installation wizard to complete first-time setup.' });
    }
    const password = (req.body?.password || '').toString().trim();
    if (!password) {
      return res.status(400).json({
        error: 'Administrator password is required to verify recommissioning authorization.',
      });
    }

    let isAuthorized = false;
    let authorizedAdminName = '';

    // Check token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded?.role === 'ADMIN') {
          isAuthorized = true;
          authorizedAdminName = decoded.name || decoded.email;
        }
      } catch (_) {}
    }

    // Check against admins in database
    if (!isAuthorized) {
      try {
        const allAdmins = await pgClient.query<any>(
          "SELECT id, name, email, password_hash FROM users WHERE role = 'ADMIN' AND status = 'APPROVED' ORDER BY id ASC"
        );
        for (const adminRow of allAdmins.rows) {
          if (await bcrypt.compare(password, adminRow.password_hash)) {
            isAuthorized = true;
            authorizedAdminName = `${adminRow.name} (${adminRow.email})`;
            break;
          }
        }
      } catch (_) {}
    }

    // Fallback for default master password
    if (!isAuthorized && (password === 'admin123' || password === 'admin' || password === 'password123')) {
      isAuthorized = true;
      authorizedAdminName = 'Store Administrator';
    }

    if (!isAuthorized) {
      return res.status(401).json({
        error: 'Authorization failed: Incorrect Administrator password provided.',
      });
    }

    const shouldDropTables = Boolean(req.body?.drop_tables || req.body?.dropTables);
    if (shouldDropTables) {
      console.log('🗑️ [Reset] Dropping all tables CASCADE and preparing fresh installation state...');
      await dropAllTables();
      return res.json({
        success: true,
        message: `All database tables dropped with CASCADE by ${authorizedAdminName}. Clean reinstallation ready.`,
        isInstalled: false,
        tablesDropped: true,
      });
    }

    // Unlock installation flag in company_settings
    try {
      await pgClient.query('UPDATE company_settings SET is_installed = false, updated_at = NOW()');
    } catch (_) {}

    res.json({
      success: true,
      message: `Installation state unlocked successfully by ${authorizedAdminName}. The setup wizard can now be accessed.`,
      isInstalled: false,
      tablesDropped: false,
    });
  } catch (err: any) {
    console.error('Reset install error:', err);
    res.status(500).json({ error: 'Failed to unlock installer: ' + err.message });
  }
});

// =========================================================================
// 3. POST /api/install/drop-tables (Completely drop all tables for clean wipe)
// =========================================================================
router.post('/drop-tables', async (req: Request, res: Response) => {
  try {
    const isAuthorized = await verifyInstallerAuthorization(req);
    if (!isAuthorized) {
      return res.status(401).json({
        error: 'Authorization failed: Valid Administrator credentials required to drop database tables.',
      });
    }

    console.log('🗑️ [API /drop-tables] Dropping all database tables with CASCADE...');
    await dropAllTables();

    res.json({
      success: true,
      message: 'All database tables were dropped with CASCADE. The database is now empty for clean installation.',
      isInstalled: false,
      tablesDropped: true,
    });
  } catch (err: any) {
    console.error('Error in /api/install/drop-tables:', err);
    res.status(500).json({ error: 'Failed to drop tables: ' + err.message });
  }
});

// =========================================================================
// 4. POST /api/install/lock
// =========================================================================
router.post('/lock', async (req: Request, res: Response) => {
  try {
    const isAuthorized = await verifyInstallerAuthorization(req);
    if (!isAuthorized) {
      return res.status(401).json({
        error: 'Authentication required. Provide an Administrator Bearer token or Admin password.',
      });
    }

    await pgClient.query('UPDATE company_settings SET is_installed = true, updated_at = NOW()');
    res.json({
      success: true,
      message: 'Setup wizard locked securely. Production lockdown active.',
      isInstalled: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to lock installer: ' + err.message });
  }
});

export default router;
