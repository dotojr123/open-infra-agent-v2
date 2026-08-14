import os from 'node:os';
import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, workspaces } from '../db/schema';
import { requireAuth, requireAdmin } from '../auth/middleware';
import { stop as stopWorkspace, NotFoundError } from '../provisioner/workspaceProvisioner';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/users', async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users);
  res.json({ users: rows });
});

async function setUserStatus(id: string, status: 'APPROVED' | 'BLOCKED') {
  const result = await db.update(users).set({ status }).where(eq(users.id, id));
  return result.rowsAffected > 0;
}

function paramId(req: Request, key = 'id'): string {
  const raw = req.params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

router.post('/users/:id/approve', async (req: Request, res: Response) => {
  if (!(await setUserStatus(paramId(req), 'APPROVED'))) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }
  res.json({ ok: true });
});

router.post('/users/:id/block', async (req: Request, res: Response) => {
  if (!(await setUserStatus(paramId(req), 'BLOCKED'))) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }
  res.json({ ok: true });
});

router.get('/workspaces', async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: workspaces.id,
      userId: workspaces.userId,
      userEmail: users.email,
      desktopContainerId: workspaces.desktopContainerId,
      cockpitContainerId: workspaces.cockpitContainerId,
      status: workspaces.status,
      port: workspaces.port,
      lastActiveAt: workspaces.lastActiveAt,
    })
    .from(workspaces)
    .innerJoin(users, eq(workspaces.userId, users.id));
  res.json({ workspaces: rows });
});

// Kill switch do painel admin — reaproveita o stop() da Etapa 2, só que com o
// userId de outra conta em vez do dono logado (requireAuth normal não permitiria).
router.post('/workspaces/:userId/stop', async (req: Request, res: Response) => {
  try {
    await stopWorkspace(paramId(req, 'userId'));
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
    } else {
      console.error('[admin] falha ao forçar stop:', err);
      res.status(500).json({ error: 'Erro ao parar o workspace' });
    }
  }
});

router.get('/host-stats', (_req: Request, res: Response) => {
  res.json({
    totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
    freeMemMb: Math.round(os.freemem() / 1024 / 1024),
    loadAvg: os.loadavg(),
    cpus: os.cpus().length,
  });
});

export default router;
