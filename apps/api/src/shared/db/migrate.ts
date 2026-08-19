import path from 'node:path';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { createDb, createPool } from './client';

/**
 * Standalone migration runner — no Nest bootstrap, so it can run as a one-shot
 * container command (see the `migrate` service in docker-compose.yml) that
 * exits instead of staying up as a server.
 */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set — refusing to run migrations.');
    process.exit(1);
  }

  const pool = createPool(connectionString);
  const db = createDb(pool);

  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
  console.log('Migrations complete.');

  await pool.end();
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
