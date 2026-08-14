← [Índice de documentação](../README.md)

# Control Plane — SaaS multi-tenant (Etapas 1 e 2)

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
| `POST /api/workspace/start` | Bearer (dono) | Provisiona (se preciso) e inicia o próprio workspace. `403` se não `APPROVED`; `503` se já tem outro `RUNNING` (admission control) |
| `POST /api/workspace/stop` | Bearer (dono) | Para o próprio workspace (idempotente) |
| `POST /api/workspace/heartbeat` | Bearer (dono) | Reseta o timer de ociosidade — chamar periodicamente enquanto a aba do cliente está aberta (Etapa 3) |
| `GET /api/workspace/status` | Bearer (dono) | Status + IDs dos containers do próprio workspace |

## Provisionamento (`src/provisioner/workspaceProvisioner.ts`)

- `provision(userId)`: cria a network `saas-net-<userId>`, o diretório `WORKSPACE_DATA_DIR/<userId>` (bind mount, `chmod 777` — o UID do `user` dentro da imagem `iagencia-desktop` não bate com quem cria o diretório no host, sem isso o boot do XFCE falha com "Permission denied") e os 2 containers, parados. Idempotente.
- `start(userId)`: exige `status=APPROVED`; aplica admission control (`MAX_CONCURRENT_WORKSPACES`); provisiona se ainda não provisionado; inicia os 2 containers.
- `stop(userId)`: para os 2 containers (idempotente).
- `startHibernationLoop()`: a cada 30s, para workspaces `RUNNING` ociosos há mais de `IDLE_TIMEOUT_MIN` (sem heartbeat) ou com sessão mais longa que `MAX_SESSION_MIN` (teto duro, independente de heartbeat). Testado de ponta a ponta: um workspace real foi criado, hibernado automaticamente após o timeout, e o segundo tenant conseguiu iniciar assim que a capacidade foi liberada.

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

## Roadmap

- **Etapa 3**: painel admin (`/admin`) e portal do cliente (`/workspace`) no frontend — incluindo o heartbeat periódico que a Etapa 2 já expõe.
- **Etapa 4**: `docker-compose.saas.yml` com o `docker-socket-proxy` de verdade, deploy do Control Plane atrás do Caddy compartilhado. Rollout no meu-vps é uma decisão separada e deliberada — o provisionador foi testado contra uma VM isolada, não a produção.

---

## Relacionados

- [cockpit/README.md](../cockpit/README.md) — a imagem que este serviço provisiona por cliente
- ↑ [Índice de documentação](../README.md)
