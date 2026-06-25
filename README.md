# AutoHub Garagem — monorepo

```
web-garagem/        React 19 + Vite + Tailwind v4
api/                 Bun + Hono + postgres.js (mesma app serve Bun local e Netlify Function)
docker-compose.yml   PostgreSQL 16 + api + front (dev local)
netlify.toml         build do front + Netlify Function da api (produção)
```

## Setup rápido (dev local, Postgres próprio)

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

## Deploy em produção (Netlify + Neon)

Netlify só hospeda site estático + **Functions** (Node.js — não dá pra rodar um
servidor Bun de pé). Por isso a mesma `app` Hono que roda local também vira uma
Netlify Function: `api/netlify/functions/api.mts` declara os próprios paths
(`/api/*` e `/auth/*`) e serve `app.fetch` direto, sem adapter nenhum — Functions
normais (não as "Edge") rodam em Node.js de verdade e suportam TCP, então o
`postgres.js` que você já usa não muda nada pra falar com o Neon.

### 1. Banco — Neon
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

### 2. Site — Netlify
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
do `netlify.toml` — me chama com o log do deploy que eu sigo dali.

## API endpoints

### Auth (público, sem prefixo /api)
| Método | Path | Body |
|--------|------|------|
| POST | /auth/register | `{ nome, email, password }` |
| POST | /auth/login | `{ email, password }` |

### Protegidos (Bearer token, prefixo /api)
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

## Schema do banco

```
usuarios → garagens → veiculos → fases → itens → despesas
                          └─ documentos
                               fornecedores (global ou por usuário)
```

## Dev local sem Docker

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

## Changelog desta sessão

Você mandou o projeto já com bastante coisa sua (login, CRUD de veículo/fase,
`itens.ts` novo, o `FaseCard.tsx` com checkbox otimista e bandeirinha de país —
ficou ótimo). O que eu adicionei/corrigi em cima disso:

**Bug de rota (real, ia quebrar em runtime):**
- `fasesRoutes` tinha os paths internos absolutos (`/veiculos/:id/fases`,
  `/fases/:id`) mas tava montado em `/fases` — isso duplicava o prefixo
  (`/api/fases/fases/:id`). Voltei a montar na raiz, como os paths já esperavam.

**Item 1 — Neon:**
- `db/client.ts` detecta `neon.tech` na `DATABASE_URL` e ajusta sozinho: liga
  SSL e reduz o pool pra 1 conexão (cada invocação de Function pode ser uma
  instância nova — pool grande só desperdiça conexão do lado do Neon).

**Item 2 — Netlify:**
- `api/src/app.ts` — extraí a `app` Hono pra um módulo compartilhado; o
  entrypoint Bun (`index.ts`) e a Netlify Function (`netlify/functions/api.mts`)
  agora montam a mesma instância, sem rota duplicada.
- A function usa Functions normais do Netlify (Node.js/Lambda), não Edge — por
  isso não precisa do adapter `hono/netlify` (esse é pra Deno) nem de driver
  HTTP especial pro Neon: TCP direto via `postgres.js` funciona igual ao local.
- `netlify.toml` na raiz com o build do front + a pasta de functions da api.
- `client.ts` do front: fallback de `BASE` mudou de `localhost:8000` pra vazio
  (same-origin), porque em produção front e api ficam no mesmo domínio.

**Item 3 — criar peças na mão:**
- `POST /api/itens` (criar) e `DELETE /api/itens/:id` (excluir) — só existia
  o `PATCH`. `POST /api/veiculos/:id/fases` já existia mas não tinha UI; agora
  tem o botão "+ Adicionar fase" na página do veículo.
- `FaseCard.tsx`: form simples (nome, detalhe, preço mín/máx, moeda, link) pra
  adicionar item dentro de uma fase, sem sugestão nem autocomplete — só os
  campos. Cada item ganhou um ícone de editar (abre o mesmo form preenchido)
  e de excluir.

**Item 4 — editar, "destransformar" e feedback visual:**
- `StatusVeiculoMenu` no topo da página do veículo: dropdown pra mudar o status
  pra qualquer um dos 4 (`planejamento` / `em_andamento` / `concluido` /
  `pausado`) a qualquer momento — é o "destransformar de concluído" que você
  pediu. Junto com o "+ Adicionar fase", cobre o fluxo de reabrir um projeto.
- `POST /api/fases/:id/resetar` + botão de reset (ícone de "voltar") no header
  de cada fase — zera a fase e todos os itens dela pra "planejado" de uma vez,
  pro caso do eterno stage 0.
- A cascata de status (ver seção da API acima): isso é o que faz a barra da
  fase ir de amarela pra verde e o badge virar "Concluído" sozinho quando você
  marca o último item — antes disso só existia client-side, sem persistir, então
  um reload perdia o estado visual.

`tsc -b` (front), `tsc --noEmit` (api), `oxlint` e `vite build` passam limpos.
Não dá pra testar o `docker compose up` nem um deploy de verdade no Netlify
aqui no sandbox (sem rede pra isso) — então o fluxo ponta a ponta (criar item,
ver a fase ficar verde, reabrir um veículo concluído, deploy no Netlify) precisa
ser validado na sua máquina. Me chama com o log se algo travar.
