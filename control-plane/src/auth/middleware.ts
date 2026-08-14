import type { Request, Response, NextFunction } from 'express';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/client';
import { sessions, users, type User } from '../db/schema';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const token = auth.slice(7);

  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) {
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return;
  }

  req.user = row.user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Acesso restrito a administradores' });
    return;
  }
  next();
}
