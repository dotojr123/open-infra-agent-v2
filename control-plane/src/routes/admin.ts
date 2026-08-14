import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, workspaces } from '../db/schema';
import { requireAuth, requireAdmin } from '../auth/middleware';

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
  // Ponto de extensão pra Etapa 2: quando status vira APPROVED, o provisionador
  // Docker pode ser acionado aqui (ou por um listener) pra criar o workspace.
}

function paramId(req: Request): string {
  return Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
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

export default router;
