import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { runMigrations } from './db/client';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import workspaceRoutes from './routes/workspace';
import { startHibernationLoop } from './provisioner/workspaceProvisioner';

async function main() {
  await runMigrations();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/workspace', workspaceRoutes);

  // Frontend compilado (mesmo padrão do cockpit/backend/src/server.ts)
  const publicDir = path.join(__dirname, '../public');
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

  startHibernationLoop();

  const port = Number(process.env.PORT) || 8090;
  app.listen(port, '0.0.0.0', () => {
    console.log(`🎛️  Control Plane ouvindo em http://0.0.0.0:${port}`);
  });
}

main().catch((err) => {
  console.error('Falha ao iniciar o Control Plane:', err);
  process.exit(1);
});
