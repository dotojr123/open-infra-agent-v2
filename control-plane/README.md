← [Índice de documentação](../README.md)

# Control Plane — SaaS multi-tenant (Etapas 1, 2 e 3)

**Tags:** `#control-plane` `#saas` `#auth` `#docker-provisioning` `#status/em-andamento`

Backend de autenticação + provisionamento dinâmico pra transformar o [`cockpit/`](../cockpit/README.md) (hoje single-tenant) num SaaS onde cada cliente ganha seu próprio workspace isolado (2 containers: `iagencia-desktop` + `cockpit`, numa network Docker por tenant).

> **Teto de 1 workspace de cliente rodando por vez**, não é sugestão — é o limite real medido no host de referência: a produção da fazer-ai já roda com pouquíssima folga (`free -h` mostrou 3.3GB dos 4GB de swap em uso, mesmo em repouso), e o `iagencia-desktop` sozinho usa ~2.1GB parado. Configurável via `MAX_CONCURRENT_WORKSPACES`, mas suba esse número medindo o host real, não por suposição.

## Stack

- Node.js + TypeScript + Express
- SQLite via `@libsql/client` + Drizzle ORM (não `better-sqlite3`: binários pré-compilados, zero build nativo local — mesmo raciocínio que levou o STT do `cockpit/backend` a rodar via subprocesso Python em vez de um binding nativo em memória)
- Senhas com `bcryptjs`; sessões como tokens opacos persistidos em SQLite
- `dockerode` **nunca** apontado direto pro `docker.sock` — sempre pro [`tecnativa/docker-socket-proxy`](https://github.com/Tecnativa/docker-socket-proxy), liberando só `CONTAINERS`/`NETWORKS`/`IMAGES`. Acesso irrestrito ao socket a partir de um serviço que recebe `userId` de fora é, na prática, dar root no host pra um bug de validação.

## Modelo de dados

- `users`: `id`, `email`, `passwordHash`, `role` (`ADMIN`|`USER`), `status` (`PENDING`|`APPROVED`|`BLOCKED`), `createdAt`
- `sessions`: `token`, `userId`, `createdAt`, `expiresAt`
- `workspaces`: `id`, `userId` (1:1 com `users`), `desktopContainerId`, `cockpitContainerId`, `networkName`, `status` (`NOT_PROVISIONED`|`STOPPED`|`RUNNING`|`ERROR`), `port`, `lastActiveAt`, `startedAt`, `createdAt`

## Endpoints

| Rota | Auth | Descrição |
|---|---|---|
| `POST /api/auth/register` | — | Cria conta (`PENDING` por padrão) + workspace `NOT_PROVISIONED` |
| `POST /api/auth/login` | — | Rejeita se `BLOCKED`; emite token mesmo se `PENDING` (o front decide a tela) |
| `GET /api/auth/me` | Bearer | Dados da conta logada |
| `POST /api/auth/logout` | Bearer | Invalida a sessão atual |
| `GET /api/admin/users` | Bearer + ADMIN | Lista todas as contas |
| `POST /api/admin/users/:id/approve` | Bearer + ADMIN | `status -> APPROVED` |
| `POST /api/admin/users/:id/block` | Bearer + ADMIN | `status -> BLOCKED` |
| `GET /api/admin/workspaces` | Bearer + ADMIN | Lista todos os workspaces com status |
| `POST /api/admin/workspaces/:userId/stop` | Bearer + ADMIN | Kill switch — força o stop do workspace de qualquer conta |
| `GET /api/admin/host-stats` | Bearer + ADMIN | Memória/CPU/load average do host (via `os.*`, não precisa de mais permissão no socket-proxy) |
| `POST /api/workspace/start` | Bearer (dono) | Provisiona (se preciso) e inicia o próprio workspace. `403` se não `APPROVED`; `503` se já tem outro `RUNNING` (admission control) |
| `POST /api/workspace/stop` | Bearer (dono) | Para o próprio workspace (idempotente) |
| `POST /api/workspace/heartbeat` | Bearer (dono) | Reseta o timer de ociosidade — chamar periodicamente enquanto a aba do cliente está aberta (Etapa 3) |
| `GET /api/workspace/status` | Bearer (dono) | Status + IDs dos containers do próprio workspace |

## Provisionamento (`src/provisioner/workspaceProvisioner.ts`)

- `provision(userId)`: cria a network `saas-net-<userId>`, o diretório `WORKSPACE_DATA_DIR/<userId>` (bind mount, `chmod 777` — o UID do `user` dentro da imagem `iagencia-desktop` não bate com quem cria o diretório no host, sem isso o boot do XFCE falha com "Permission denied") e os 2 containers, parados. Idempotente.
- `start(userId)`: exige `status=APPROVED`; aplica admission control (`MAX_CONCURRENT_WORKSPACES`); provisiona se ainda não provisionado; inicia os 2 containers.
- `stop(userId)`: para os 2 containers (idempotente).
- `startHibernationLoop()`: a cada 30s, para workspaces `RUNNING` ociosos há mais de `IDLE_TIMEOUT_MIN` (sem heartbeat) ou com sessão mais longa que `MAX_SESSION_MIN` (teto duro, independente de heartbeat). Testado de ponta a ponta: um workspace real foi criado, hibernado automaticamente após o timeout, e o segundo tenant conseguiu iniciar assim que a capacidade foi liberada.

## Frontend (`frontend/`)

React + Vite + TS, mesmo padrão do `cockpit/frontend` (sem router library, sem CSS framework), mesma paleta visual (design tokens reaproveitados de `cockpit/frontend/src/style.css`):

- `AuthView` — login/registro.
- `PendingView` / `BlockedView` — telas de status pra quem não é `APPROVED`.
- `DashboardView` — status do próprio workspace, botão iniciar/parar, heartbeat automático a cada 60s enquanto `RUNNING`, polling de status a cada 5s.
- `AdminView` — tabela de usuários (aprovar/bloquear), tabela de workspaces (kill switch), card de memória do host.

**Limite conhecido, de propósito**: o `DashboardView` mostra o status do workspace mudando pra `RUNNING` de verdade, mas não redireciona pro Cockpit isolado do cliente — os containers da Etapa 2 não têm rota externa ainda (isso é Etapa 4). A tela deixa isso explícito em vez de simular um link que não funciona.

**Verificação feita nesta etapa**: build TypeScript limpo dos dois lados e todo o contrato de API testado via `curl` simulando exatamente as chamadas que cada view faz (registro → `PENDING` → aprovação → `/me` reflete `APPROVED` → `/workspace/status` no formato exato que `DashboardView` espera → `/admin/host-stats`/`/admin/workspaces` no formato que `AdminView` espera). **Não foi testado interativamente num navegador real nesta sessão** (sem ferramenta de browser disponível) — recomendado rodar localmente e clicar antes de considerar a etapa 100% fechada.

## Bootstrap do primeiro admin

Sem cadastro de admin dedicado — resolve o problema do ovo-e-galinha via env var: qualquer e-mail listado em `ADMIN_EMAILS` (separado por vírgula) que se registrar nasce direto `role=ADMIN, status=APPROVED`.

## Rodando local

```bash
cd control-plane
npm install
cp .env.example .env   # defina ADMIN_EMAILS com o seu e-mail
npm run db:generate    # só necessário se você alterar src/db/schema.ts
npm run build
npm start
```

`GET http://localhost:8090/api/health` deve responder `{"ok":true}`. As rotas `/api/workspace/*` também precisam de um `docker-socket-proxy` rodando e acessível (`DOCKER_PROXY_HOST`/`DOCKER_PROXY_PORT`) e das imagens `iagencia-desktop:latest`/`cockpit:latest` já buildadas no host Docker de destino.

## Rodando o frontend local

```bash
cd control-plane/frontend
npm install
npm run dev   # http://localhost:5173, com /api proxiado pro backend em :8090
```

Pra servir o build direto do backend (como em produção): `npm run build` aqui, copiar `dist/` pra `control-plane/public/`, então `npm start` no backend.

## Roadmap

- **Etapa 4**: `docker-compose.saas.yml` com o `docker-socket-proxy` de verdade, `Dockerfile` que builda o `frontend/` pro `public/`, deploy do Control Plane atrás do Caddy compartilhado — incluindo a rota externa por tenant que falta pro `DashboardView` conseguir levar o cliente até o Cockpit dele de verdade. Rollout no meu-vps é uma decisão separada e deliberada — tudo testado até aqui foi contra uma VM isolada, não a produção.

---

## Relacionados

- [cockpit/README.md](../cockpit/README.md) — a imagem que este serviço provisiona por cliente
- ↑ [Índice de documentação](../README.md)
