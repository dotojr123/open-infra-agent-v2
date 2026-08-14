# Control Plane — SaaS multi-tenant (Etapa 1)

Backend de autenticação + aprovação de acesso para transformar o [`cockpit/`](../cockpit/README.md) (hoje single-tenant) num SaaS onde cada cliente ganha seu próprio workspace isolado.

**Escopo desta etapa**: só cadastro/login/aprovação e o modelo de dados. Nenhuma chamada Docker ainda — a tabela `workspaces` existe e cada conta nova ganha uma linha `NOT_PROVISIONED`, pronta pra Etapa 2 (provisionador Docker) preencher.

> A Etapa 2 exige planejamento próprio antes de qualquer código: os workspaces de cliente vão rodar no mesmo VPS que já hospeda a produção da fazer-ai e que colapsou de RAM recentemente rodando **um único** desktop container. Provisionamento dinâmico com acesso à Docker API é, na prática, root no host — precisa de teto agressivo de tenants simultâneos e hibernação, decidido e revisado antes de implementar, não descoberto em produção.

## Stack

- Node.js + TypeScript + Express
- SQLite via `@libsql/client` + Drizzle ORM (não `better-sqlite3`: binários pré-compilados, zero build nativo local — mesmo raciocínio que levou o STT do `cockpit/backend` a rodar via subprocesso Python em vez de um binding nativo em memória)
- Senhas com `bcryptjs`; sessões como tokens opacos persistidos em SQLite (mesmo padrão simples do `cockpit/backend/src/server.ts`, aqui sobrevivendo a restart)

## Modelo de dados

- `users`: `id`, `email`, `passwordHash`, `role` (`ADMIN`|`USER`), `status` (`PENDING`|`APPROVED`|`BLOCKED`), `createdAt`
- `sessions`: `token`, `userId`, `createdAt`, `expiresAt`
- `workspaces`: `id`, `userId` (1:1 com `users`), `containerId`, `status` (`NOT_PROVISIONED`|`STOPPED`|`RUNNING`|`ERROR`), `port`, `lastActiveAt`, `createdAt`

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

`GET http://localhost:8090/api/health` deve responder `{"ok":true}`.

## Roadmap

- **Etapa 2**: `WorkspaceProvisioner` (dockerode) — `provision`/`start`/`stop`/`getStatus`, com cgroups (`2 CPU`/`4GB` por spec original, a rever contra a capacidade real do host) e hibernação automática.
- **Etapa 3**: painel admin (`/admin`) e portal do cliente (`/workspace`) no frontend.
- **Etapa 4**: `docker-compose.saas.yml`, deploy do Control Plane atrás do Caddy compartilhado.
