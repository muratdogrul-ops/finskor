import fs from 'fs';
import path from 'path';
import { query, withTransaction } from '../config/database';
import logger from './logger';

export const runMigrations = async (): Promise<void> => {
  // Migration takip tablosu
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version  VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Eğer tenants tablosu varsa 001 zaten uygulanmış demektir (ilk kurulum dışı)
  const tenantsResult = await query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants'`
  );
  if ((tenantsResult.rowCount ?? 0) > 0) {
    await query(
      `INSERT INTO schema_migrations (version) VALUES ('001_schema') ON CONFLICT DO NOTHING`
    );
  }

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    logger.warn('Migrations klasörü bulunamadı, geçiliyor.');
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => {
      if (!f.endsWith('.sql')) return false;
      const fullPath = path.join(migrationsDir, f);
      return fs.statSync(fullPath).isFile();
    })
    .sort();

  for (const file of files) {
    const version = file.replace('.sql', '');
    const applied = await query(
      'SELECT 1 FROM schema_migrations WHERE version = $1',
      [version]
    );
    if ((applied.rowCount ?? 0) > 0) {
      logger.debug(`Migration zaten uygulandı: ${version}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await withTransaction(async (client) => {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING',
          [version]
        );
      });
      logger.info(`✅ Migration uygulandı: ${version}`);
    } catch (error) {
      logger.error(`❌ Migration hatası: ${version}`, error);
      throw error;
    }
  }

  logger.info('Migration kontrolü tamamlandı.');
};
