import path from 'node:path';
import fs from 'node:fs';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema';

// @libsql/client em vez de better-sqlite3: binários pré-compilados pra
// Windows/Linux, evita depender de build tools nativas do host (mesmo
// motivo que já guiou a escolha do faster-whisper via subprocess no
// cockpit/backend — não assumir toolchain de compilação disponível).
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/control-plane.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const client = createClient({ url: `file:${DB_PATH}` });

export const db = drizzle(client, { schema });

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });
}
