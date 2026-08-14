import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { eq, and, ne } from 'drizzle-orm';
import { db } from '../db/client';
import { users, workspaces } from '../db/schema';
import { docker } from './dockerProxy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DESKTOP_IMAGE = process.env.WORKSPACE_DESKTOP_IMAGE || 'iagencia-desktop:latest';
const COCKPIT_IMAGE = process.env.WORKSPACE_COCKPIT_IMAGE || 'cockpit:latest';
const DATA_DIR = process.env.WORKSPACE_DATA_DIR || '/var/saas-data/workspaces';

// Bem abaixo do spec original (2 CPU / 4GB): o host de referência já roda a
// produção da fazer-ai com pouquíssima folga (ver Etapa 2 do plano) — 1 CPU /
// 1.5GB pro desktop e 0.5 CPU / 512MB pro cockpit é o que sobra com segurança
// pra 1 workspace de cliente rodando por vez.
const DESKTOP_MEM_MB = Number(process.env.WORKSPACE_DESKTOP_MEM_MB) || 1536;
const DESKTOP_CPUS = Number(process.env.WORKSPACE_DESKTOP_CPUS) || 1;
const COCKPIT_MEM_MB = Number(process.env.WORKSPACE_COCKPIT_MEM_MB) || 512;
const COCKPIT_CPUS = Number(process.env.WORKSPACE_COCKPIT_CPUS) || 0.5;

const MAX_CONCURRENT_WORKSPACES = Number(process.env.MAX_CONCURRENT_WORKSPACES) || 1;
const IDLE_TIMEOUT_MIN = Number(process.env.IDLE_TIMEOUT_MIN) || 10;
const MAX_SESSION_MIN = Number(process.env.MAX_SESSION_MIN) || 60;
const HIBERNATION_CHECK_MS = 30_000;

export class ForbiddenError extends Error {}
export class CapacityError extends Error {}
export class NotFoundError extends Error {}

function assertUserId(userId: string): void {
  if (!UUID_RE.test(userId)) {
    // userId entra em nome de container/network/caminho de volume — nunca
    // confiar sem validar, mesmo vindo de um id de sessão já autenticado.
    throw new Error(`userId inválido: ${userId}`);
  }
}

function names(userId: string) {
  return {
    network: `saas-net-${userId}`,
    desktop: `workspace-${userId}-desktop`,
    cockpit: `workspace-${userId}-cockpit`,
    dataDir: path.join(DATA_DIR, userId),
  };
}

async function ensureNetwork(networkName: string): Promise<void> {
  const existing = docker.getNetwork(networkName);
  try {
    await existing.inspect();
    return; // já existe — idempotente
  } catch {
    // não existe, cria
  }
  await docker.createNetwork({ Name: networkName, CheckDuplicate: true });
}

async function ensureContainer(opts: {
  name: string;
  image: string;
  env: string[];
  memMb: number;
  cpus: number;
  network: string;
  binds?: string[];
  shmSizeGb?: number;
}): Promise<string> {
  const existing = docker.getContainer(opts.name);
  try {
    const info = await existing.inspect();
    return info.Id; // já existe — idempotente, não recria
  } catch {
    // não existe, cria abaixo
  }

  const container = await docker.createContainer({
    name: opts.name,
    Image: opts.image,
    Env: opts.env,
    HostConfig: {
      Memory: opts.memMb * 1024 * 1024,
      NanoCpus: Math.round(opts.cpus * 1e9),
      NetworkMode: opts.network,
      Binds: opts.binds,
      ShmSize: opts.shmSizeGb ? opts.shmSizeGb * 1024 * 1024 * 1024 : undefined,
      RestartPolicy: { Name: 'no' }, // hibernação é controlada por nós, não pelo Docker
    },
  });
  return container.id;
}

/**
 * Cria a network, o diretório de dados e os 2 containers (parados) de um
 * workspace de cliente. Idempotente — chamar de novo não duplica nada.
 */
export async function provision(userId: string): Promise<void> {
  assertUserId(userId);
  const { network, desktop, cockpit, dataDir } = names(userId);

  fs.mkdirSync(dataDir, { recursive: true });
  // O container roda como UID interno próprio (ex.: 1001 na imagem
  // iagencia-desktop), diferente de quem cria o diretório no host — sem isso
  // o boot do XFCE falha com "Permission denied" ao escrever em /home/user.
  // Chmod em vez de chown: não precisa de root pra funcionar com qualquer UID.
  fs.chmodSync(dataDir, 0o777);
  await ensureNetwork(network);

  const desktopContainerId = await ensureContainer({
    name: desktop,
    image: DESKTOP_IMAGE,
    env: ['DISPLAY=:0'],
    memMb: DESKTOP_MEM_MB,
    cpus: DESKTOP_CPUS,
    network,
    binds: [`${dataDir}:/home/user`],
    shmSizeGb: 2,
  });

  const cockpitPassword = crypto.randomBytes(16).toString('hex');
  const cockpitContainerId = await ensureContainer({
    name: cockpit,
    image: COCKPIT_IMAGE,
    env: [
      'PORT=8080',
      `COCKPIT_PASSWORD=${cockpitPassword}`,
      'LLM_PROVIDER=codex',
      `MCP_URL=http://${desktop}:9990/mcp`,
    ],
    memMb: COCKPIT_MEM_MB,
    cpus: COCKPIT_CPUS,
    network,
  });

  await db
    .update(workspaces)
    .set({ desktopContainerId, cockpitContainerId, networkName: network, status: 'STOPPED' })
    .where(eq(workspaces.userId, userId));
}

async function runningCountExcluding(userId: string): Promise<number> {
  const rows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.status, 'RUNNING'), ne(workspaces.userId, userId)));
  return rows.length;
}

export async function start(userId: string): Promise<void> {
  assertUserId(userId);

  const [row] = await db
    .select({ user: users, workspace: workspaces })
    .from(workspaces)
    .innerJoin(users, eq(workspaces.userId, users.id))
    .where(eq(workspaces.userId, userId))
    .limit(1);
  if (!row) throw new NotFoundError('Workspace não encontrado');
  if (row.user.status !== 'APPROVED') {
    throw new ForbiddenError('Conta ainda não aprovada');
  }

  if ((await runningCountExcluding(userId)) >= MAX_CONCURRENT_WORKSPACES) {
    throw new CapacityError('Capacidade máxima de workspaces simultâneos atingida — tente novamente em instantes');
  }

  if (row.workspace.status === 'NOT_PROVISIONED') {
    await provision(userId);
  }

  const { desktop, cockpit } = names(userId);
  await docker.getContainer(desktop).start().catch(ignoreAlreadyStarted);
  await docker.getContainer(cockpit).start().catch(ignoreAlreadyStarted);

  const now = new Date();
  await db
    .update(workspaces)
    .set({ status: 'RUNNING', lastActiveAt: now, startedAt: now })
    .where(eq(workspaces.userId, userId));
}

export async function stop(userId: string): Promise<void> {
  assertUserId(userId);
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.userId, userId)).limit(1);
  if (!workspace) throw new NotFoundError('Workspace não encontrado');

  if (workspace.desktopContainerId) {
    await docker.getContainer(workspace.desktopContainerId).stop().catch(ignoreAlreadyStopped);
  }
  if (workspace.cockpitContainerId) {
    await docker.getContainer(workspace.cockpitContainerId).stop().catch(ignoreAlreadyStopped);
  }

  await db
    .update(workspaces)
    .set({ status: 'STOPPED', startedAt: null })
    .where(eq(workspaces.userId, userId));
}

export async function heartbeat(userId: string): Promise<void> {
  assertUserId(userId);
  await db.update(workspaces).set({ lastActiveAt: new Date() }).where(eq(workspaces.userId, userId));
}

export async function getStatus(userId: string) {
  assertUserId(userId);
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.userId, userId)).limit(1);
  if (!workspace) throw new NotFoundError('Workspace não encontrado');
  return workspace;
}

function ignoreAlreadyStarted(err: { statusCode?: number }) {
  if (err?.statusCode !== 304) throw err; // 304 = "container already started" na Docker API
}
function ignoreAlreadyStopped(err: { statusCode?: number }) {
  if (err?.statusCode !== 304 && err?.statusCode !== 404) throw err;
}

/**
 * Loop de hibernação: para workspaces ociosos (sem heartbeat há
 * IDLE_TIMEOUT_MIN) ou que estouraram o teto duro de sessão (MAX_SESSION_MIN),
 * independente de heartbeat. Não é opcional dado o teto de 1 tenant
 * simultâneo — sem isso um workspace esquecido aberto trava a capacidade
 * inteira pros outros usuários aprovados.
 */
export function startHibernationLoop(): NodeJS.Timeout {
  return setInterval(async () => {
    const running = await db.select().from(workspaces).where(eq(workspaces.status, 'RUNNING'));
    const now = Date.now();
    for (const ws of running) {
      const idleMs = ws.lastActiveAt ? now - ws.lastActiveAt.getTime() : Infinity;
      const sessionMs = ws.startedAt ? now - ws.startedAt.getTime() : Infinity;
      if (idleMs > IDLE_TIMEOUT_MIN * 60_000 || sessionMs > MAX_SESSION_MIN * 60_000) {
        console.log(`[hibernation] parando workspace de ${ws.userId} (idle=${idleMs}ms sessão=${sessionMs}ms)`);
        await stop(ws.userId).catch((err) => console.error(`[hibernation] falha ao parar ${ws.userId}:`, err));
      }
    }
  }, HIBERNATION_CHECK_MS);
}
