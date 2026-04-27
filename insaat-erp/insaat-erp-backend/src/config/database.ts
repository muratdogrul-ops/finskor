import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'insaat_erp',
  user: process.env.DB_USER || 'erp_user',
  password: process.env.DB_PASSWORD,
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Veritabanı bağlantı hatası:', err);
});

pool.on('connect', () => {
  logger.debug('Yeni veritabanı bağlantısı kuruldu');
});

export const query = async (text: string, params?: unknown[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn(`Yavaş sorgu tespit edildi (${duration}ms): ${text}`);
    }
    return res;
  } catch (error) {
    logger.error('Sorgu hatası:', { text, error });
    throw error;
  }
};

export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * RLS veya host-based policy icin. tenantId enjekte edilmez; parametre guvenlidir.
 */
export const tenantQuery = async (
  tenantId: string,
  text: string,
  params?: unknown[]
) => {
  const client = await pool.connect();
  try {
    await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant', tenantId]);
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
};

export const checkDbConnection = async (): Promise<boolean> => {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
};

export default pool;
