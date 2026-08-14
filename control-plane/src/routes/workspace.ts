import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../auth/middleware';
import {
  start,
  stop,
  heartbeat,
  getStatus,
  ForbiddenError,
  CapacityError,
  NotFoundError,
} from '../provisioner/workspaceProvisioner';

const router = Router();
router.use(requireAuth);

function handleProvisionerError(err: unknown, res: Response): void {
  if (err instanceof ForbiddenError) {
    res.status(403).json({ error: err.message });
  } else if (err instanceof CapacityError) {
    res.status(503).json({ error: err.message });
  } else if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
  } else {
    console.error('[workspace]', err);
    res.status(500).json({ error: 'Erro interno ao operar o workspace' });
  }
}

router.post('/start', async (req: Request, res: Response) => {
  try {
    await start(req.user!.id);
    res.json({ ok: true });
  } catch (err) {
    handleProvisionerError(err, res);
  }
});

router.post('/stop', async (req: Request, res: Response) => {
  try {
    await stop(req.user!.id);
    res.json({ ok: true });
  } catch (err) {
    handleProvisionerError(err, res);
  }
});

router.post('/heartbeat', async (req: Request, res: Response) => {
  try {
    await heartbeat(req.user!.id);
    res.json({ ok: true });
  } catch (err) {
    handleProvisionerError(err, res);
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const workspace = await getStatus(req.user!.id);
    res.json({ workspace });
  } catch (err) {
    handleProvisionerError(err, res);
  }
});

export default router;
