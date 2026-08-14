import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, sessions, workspaces } from '../db/schema';
import { hashPassword, verifyPassword } from '../auth/hash';
import { requireAuth } from '../auth/middleware';

const router = Router();

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.insert(sessions).values({ token, userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
  return token;
}

function publicUser(u: typeof users.$inferSelect) {
  return { id: u.id, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt };
}

router.post('/register', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password || password.length < 8) {
    res.status(400).json({ error: 'email e senha (mín. 8 caracteres) são obrigatórios' });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();

  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing) {
    res.status(409).json({ error: 'E-mail já cadastrado' });
    return;
  }

  const isBootstrapAdmin = ADMIN_EMAILS.includes(normalizedEmail);
  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();

  await db.insert(users).values({
    id: userId,
    email: normalizedEmail,
    passwordHash,
    role: isBootstrapAdmin ? 'ADMIN' : 'USER',
    status: isBootstrapAdmin ? 'APPROVED' : 'PENDING',
  });

  // Toda conta nasce com um workspace NOT_PROVISIONED — a Etapa 2 (provisionador
  // Docker) só precisa consultar/atualizar o status, nunca checar existência.
  await db.insert(workspaces).values({ id: crypto.randomUUID(), userId });

  const token = await createSession(userId);
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  res.status(201).json({ token, user: publicUser(user!) });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'email e senha são obrigatórios' });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();

  const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: 'Credenciais inválidas' });
    return;
  }
  if (user.status === 'BLOCKED') {
    res.status(403).json({ error: 'Conta bloqueada' });
    return;
  }

  const token = await createSession(user.id);
  res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: publicUser(req.user!) });
});

router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  const auth = req.headers.authorization!;
  await db.delete(sessions).where(eq(sessions.token, auth.slice(7)));
  res.json({ ok: true });
});

export default router;
