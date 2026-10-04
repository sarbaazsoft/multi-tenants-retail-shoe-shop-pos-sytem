import 'dotenv/config'

import pg from 'pg';
import type { Pool as PgPool, PoolClient } from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

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

function createDbInfo(url: string): DbConnectionInfo {
  let maskedUrl = 'postgresql://[authenticated]';
  let host = 'localhost';
  let port = 5432;
  let database = 'postgres';
  let user = 'postgres';

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
  throw new Error('DATABASE_URL is required and must be a PostgreSQL connection URL. Embedded database is not supported.');
}

dbInfo = createDbInfo(rawDatabaseUrl);

console.log(`🔌 Initializing PostgreSQL Client Pool to ${dbInfo.host}:${dbInfo.port}/${dbInfo.database}...`);

rawPool = new Pool({
  connectionString: rawDatabaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 15000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

rawPool.on('error', (err: any) => {
  const msg = err?.message || String(err);
  // Ignore normal idle client pruning by cloud providers (Neon / AWS / Supabase PgBouncer).
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

let readinessPromise: Promise<void> | null = null;

async function waitForDatabaseReady(): Promise<void> {
  if (dbInfo.connected) return;
  if (!rawPool) throw new Error('PostgreSQL pool is not initialized.');
  if (!readinessPromise) {
    readinessPromise = rawPool.query('SELECT 1').then(() => {
      console.log(`✅ Connected to PostgreSQL Server (${dbInfo.host}:${dbInfo.port}/${dbInfo.database})`);
      dbInfo.connected = true;
      dbInfo.lastError = undefined;
    }).catch((err: any) => {
      dbInfo.connected = false;
      dbInfo.lastError = err?.message || String(err);
      throw new Error(`PostgreSQL connection failed: ${dbInfo.lastError}`);
    }).finally(() => {
      // Do not cache a failed first attempt forever. A later request can retry
      // after the database becomes reachable or its environment is corrected.
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
    if (!rawPool) throw new Error('PostgreSQL pool is not initialized.');

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
    if (!rawPool) throw new Error('PostgreSQL pool is not initialized.');
    await rawPool.query(sql);
  },
};

export { dbInfo, rawPool };
