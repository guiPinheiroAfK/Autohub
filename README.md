# AutoHub Garagem — monorepo

**[English](#english) · [Português](#português)**

## English

```
web-garagem/        React 19 + Vite + Tailwind v4
api/                 Bun + Hono + postgres.js (same app serves Bun locally and as a Netlify Function)
docker-compose.yml   PostgreSQL 16 + api + front (local dev)
netlify.toml         front build + api Netlify Function (production)
```

### Quick setup (local dev, own Postgres)

```bash
cp .env.example .env
docker compose up --build
```

- Front: http://localhost:5173
- API:   http://localhost:8000
- DB:    localhost:5432 (autohub / autohub_dev)

Migrations and seed run automatically before the api comes up (`bun run migrate && bun run seed`).
The seed only populates on the first `up` — after that it's idempotent.

Login to see Gui's already-seeded garage (RX-8 K24 + Civic):
- **Email:** *********(netlify)
- **Password:** *********(netlify)

### Production deploy (Netlify + Neon)

Netlify only hosts the static site + **Functions** (Node.js — can't run a
standing Bun server). So the same Hono `app` that runs locally also becomes a
Netlify Function: `api/netlify/functions/api.mts` declares its own paths
(`/api/*` and `/auth/*`) and serves `app.fetch` directly, with no adapter at
all — regular Functions (not "Edge") run on real Node.js and support TCP, so
the `postgres.js` you already use doesn't change at all to talk to Neon.

#### 1. Database — Neon
1. Create a project at [neon.tech](https://neon.tech) (the free tier works
   fine for an app this size).
2. Copy the **pooled connection string** (it has `-pooler` in the hostname —
   this matters: each Function invocation can be a fresh instance, and their
   pooler avoids exhausting connections on Postgres). Something like:
   ```
   postgres://user:password@ep-xxx-pooler.sa-east-1.aws.neon.tech/autohub?sslmode=require
   ```
3. Run the migrations and seed **once**, from your own computer, pointing at
   that URL (no Docker needed for this):
   ```bash
   cd api
   npm install
   DATABASE_URL="postgres://...-pooler...neon.tech/autohub?sslmode=require" npx bun run migrate
   DATABASE_URL="postgres://...-pooler...neon.tech/autohub?sslmode=require" npx bun run seed
   ```
   (`db/client.ts` auto-detects the `neon.tech` host and turns on SSL + shrinks
   the connection pool — nothing else to configure besides `DATABASE_URL`.)

#### 2. Site — Netlify
1. Connect the repo on Netlify (Import an existing project). It already reads
   the root `netlify.toml` — no need to configure the build command/publish
   dir in the UI, it all comes from the file.
2. Under **Site settings → Environment variables**, add:
  - `DATABASE_URL` — the pooled Neon connection string (same one as above)
  - `JWT_SECRET` — any long random string (32+ chars)
  - `JWT_EXPIRES_IN` — `60m` (or whatever you prefer)
  - `NODE_ENV` — `production`
3. Deploy. Front and api live on the same Netlify domain — no need to
   configure `VITE_API_URL` or CORS in production, `client.ts` on the front
   already assumes same-origin when that variable doesn't exist.

If the first deploy doesn't route `/api/*` to the Function (falls through to
the SPA instead), check the ordering between the function's `config.path` and
the catch-all redirect in `netlify.toml`.

### API endpoints

#### Auth (public, no /api prefix)
| Method | Path | Body |
|--------|------|------|
| POST | /auth/register | `{ nome, email, password }` |
| POST | /auth/login | `{ email, password }` |

#### Protected (Bearer token, /api prefix)
| Method | Path | |
|--------|------|-|
| GET | /api/auth/me | logged-in user's profile |
| GET | /api/veiculos | garage list |
| POST | /api/veiculos | create vehicle |
| GET | /api/veiculos/:id | detail + phases + items |
| PATCH | /api/veiculos/:id | update fields (including `status`) |
| DELETE | /api/veiculos/:id | remove |
| POST | /api/veiculos/:id/fases | create phase |
| PATCH | /api/fases/:id | update phase |
| POST | /api/fases/:id/resetar | resets the phase and all its items back to "planned" |
| DELETE | /api/fases/:id | remove phase |
| POST | /api/itens | create item (`{ faseId, nome, precoMin, precoMax, moeda, ... }`) |
| PATCH | /api/itens/:id | update item — response includes the recalculated `faseStatus` |
| DELETE | /api/itens/:id | remove item — response includes the recalculated `faseStatus` |

**Automatic status cascade:** every mutation under `/api/itens/*` recalculates
the parent phase's status (`planned` → `in progress` → `done`, based on its
items) and returns it as `faseStatus`. This is what makes the phase turn green
on its own once every item is marked done, and fall back to yellow/gray if any
item gets unmarked.

### Database schema

```
users → garages → vehicles → phases → items → expenses
                       └─ documents
                            suppliers (global or per-user)
```

### Local dev without Docker

```bash
# Terminal 1 — database
docker compose up db

# Terminal 2 — api
cd api
bun install
DATABASE_URL=postgres://autohub:autohub_dev@localhost:5432/autohub bun run migrate
DATABASE_URL=postgres://autohub:autohub_dev@localhost:5432/autohub bun run seed
DATABASE_URL=postgres://autohub:autohub_dev@localhost:5432/autohub bun --watch src/index.ts

# Terminal 3 — front
cd web-garagem
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

## Português

```
web-garagem/        React 19 + Vite + Tailwind v4
api/                 Bun + Hono + postgres.js (mesma app serve Bun local e Netlify Function)
docker-compose.yml   PostgreSQL 16 + api + front (dev local)
netlify.toml         build do front + Netlify Function da api (produção)
```

### Setup rápido (dev local, Postgres próprio)

```bash
cp .env.example .env
docker compose up --build
```

- Front: http://localhost:5173
- API:   http://localhost:8000
- DB:    localhost:5432 (autohub / autohub_dev)

Migrations e seed rodam automático antes da api subir (`bun run migrate && bun run seed`).
O seed só popula no primeiro `up` — depois disso é idempotente.

Login pra ver a garagem do Gui já populada (RX-8 K24 + Civic):
- **E-mail:** *********(netlify)
- **Senha:** *********(netlify)

### Deploy em produção (Netlify + Neon)

Netlify só hospeda site estático + **Functions** (Node.js — não dá pra rodar um
servidor Bun de pé). Por isso a mesma `app` Hono que roda local também vira uma
Netlify Function: `api/netlify/functions/api.mts` declara os próprios paths
(`/api/*` e `/auth/*`) e serve `app.fetch` direto, sem adapter nenhum — Functions
normais (não as "Edge") rodam em Node.js de verdade e suportam TCP, então o
`postgres.js` que você já usa não muda nada pra falar com o Neon.

#### 1. Banco — Neon
1. Cria um projeto em [neon.tech](https://neon.tech) (free tier serve numa boa
   pra esse tamanho de app).
2. Copia a **connection string com pooling** (tem `-pooler` no hostname — isso
   importa: cada invocação de Function pode ser uma instância nova, e o pooler
   deles evita esgotar conexão no Postgres). Algo como:
   ```
   postgres://usuario:senha@ep-xxx-pooler.sa-east-1.aws.neon.tech/autohub?sslmode=require
   ```
3. Roda as migrations e o seed **uma vez**, do seu computador, apontando pra essa
   URL (não precisa Docker pra isso):
   ```bash
   cd api
   npm install
   DATABASE_URL="postgres://...-pooler...neon.tech/autohub?sslmode=require" npx bun run migrate
   DATABASE_URL="postgres://...-pooler...neon.tech/autohub?sslmode=require" npx bun run seed
   ```
   (`db/client.ts` detecta o host `neon.tech` automaticamente e liga SSL + reduz
   o pool de conexões — não precisa configurar nada além da `DATABASE_URL`.)

#### 2. Site — Netlify
1. Conecta o repo no Netlify (Import an existing project). Ele já lê o
   `netlify.toml` da raiz — não precisa configurar build command/publish dir
   na UI, já vem tudo do arquivo.
2. Em **Site settings → Environment variables**, adiciona:
  - `DATABASE_URL` — a connection string pooled do Neon (a mesma do passo acima)
  - `JWT_SECRET` — qualquer string aleatória longa (32+ chars)
  - `JWT_EXPIRES_IN` — `60m` (ou o que preferir)
  - `NODE_ENV` — `production`
3. Deploy. Front e api ficam no mesmo domínio Netlify — não precisa configurar
   `VITE_API_URL` nem CORS em produção, o `client.ts` do front já assume
   same-origin quando essa variável não existe.

Se o primeiro deploy não rotear `/api/*` pra Function (ficar caindo no SPA), o
ponto a checar é a ordem entre o `config.path` da function e o redirect catch-all
do `netlify.toml`.

### API endpoints

#### Auth (público, sem prefixo /api)
| Método | Path | Body |
|--------|------|------|
| POST | /auth/register | `{ nome, email, password }` |
| POST | /auth/login | `{ email, password }` |

#### Protegidos (Bearer token, prefixo /api)
| Método | Path | |
|--------|------|-|
| GET | /api/auth/me | perfil do usuário logado |
| GET | /api/veiculos | lista da garagem |
| POST | /api/veiculos | cria veículo |
| GET | /api/veiculos/:id | detalhe + fases + itens |
| PATCH | /api/veiculos/:id | atualiza campos (inclui `status`) |
| DELETE | /api/veiculos/:id | remove |
| POST | /api/veiculos/:id/fases | cria fase |
| PATCH | /api/fases/:id | atualiza fase |
| POST | /api/fases/:id/resetar | zera a fase e todos os itens dela pra "planejado" |
| DELETE | /api/fases/:id | remove fase |
| POST | /api/itens | cria item (`{ faseId, nome, precoMin, precoMax, moeda, ... }`) |
| PATCH | /api/itens/:id | atualiza item — resposta inclui `faseStatus` recalculado |
| DELETE | /api/itens/:id | remove item — resposta inclui `faseStatus` recalculado |

**Cascata automática de status:** toda mutação em `/api/itens/*` recalcula o
status da fase-mãe (`planejado` → `andamento` → `concluido`, conforme os itens
dela) e devolve em `faseStatus`. É o que faz a fase virar verde sozinha quando
todo item é marcado concluído, e voltar pra amarelo/cinza se algum item for
desmarcado.

### Schema do banco

```
usuarios → garagens → veiculos → fases → itens → despesas
                          └─ documentos
                               fornecedores (global ou por usuário)
```

### Dev local sem Docker

```bash
# Terminal 1 — banco
docker compose up db

# Terminal 2 — api
cd api
bun install
DATABASE_URL=postgres://autohub:autohub_dev@localhost:5432/autohub bun run migrate
DATABASE_URL=postgres://autohub:autohub_dev@localhost:5432/autohub bun run seed
DATABASE_URL=postgres://autohub:autohub_dev@localhost:5432/autohub bun --watch src/index.ts

# Terminal 3 — front
cd web-garagem
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```
