# AutoHub Garagem — monorepo

```
autohub-garagem/   React 19 + Vite + Tailwind v4
autohub-api/       Bun + Hono + postgres.js
docker-compose.yml PostgreSQL 16 + api + front
```

## Setup rápido

```bash
cp .env.example .env
docker compose up --build
```

- Front: http://localhost:5173
- API:   http://localhost:8000
- DB:    localhost:5432 (autohub / autohub_dev)

As migrations e o seed rodam automático antes da api subir
(`bun run migrate && bun run seed`). O seed só popula no primeiro `up` —
depois disso é idempotente.

## API endpoints

### Auth (público)
| Método | Path | Body |
|--------|------|------|
| POST | /auth/register | `{ nome, email, password }` |
| POST | /auth/login | `{ email, password }` |

### Protegidos (Bearer token)
| Método | Path | |
|--------|------|-|
| GET | /api/auth/me | perfil do usuário logado |
| GET | /api/veiculos | lista da garagem |
| POST | /api/veiculos | cria veículo |
| GET | /api/veiculos/:id | detalhe + fases + itens |
| PATCH | /api/veiculos/:id | atualiza campos |
| DELETE | /api/veiculos/:id | remove |
| GET | /api/veiculos/:id/fases | lista fases |
| POST | /api/veiculos/:id/fases | cria fase |
| PATCH | /api/fases/:id | atualiza fase |
| DELETE | /api/fases/:id | remove fase |

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

## Changelog desta sessão (continuação)

A sessão anterior tinha ficado pela metade — o zip entregue compilava, mas o front
ainda lia 100% de `data/*.ts` (mock) e tinha bugs reais no backend que só apareceriam
em runtime. O que foi corrigido/terminado:

**Bugs reais corrigidos (backend):**
- `index.ts` montava `veiculosRoutes` na raiz (`/`) em vez de `/veiculos` — `GET /api/veiculos`
  nunca resolvia, só `/api/` e `/api/:id`.
- `routes/veiculos.ts` tinha `ORDER BY i.rowid` na query de detalhe — `rowid` não existe no
  Postgres, ia quebrar a request com erro de coluna inexistente.
- `routes/auth.ts` importava `@hono/zod-validator`, que não está instalado — ia crashar a
  API inteira na primeira request (módulo não resolve em runtime).
- `routes/auth.ts` tinha um `GET /me` morto e duplicado no router público (sem o
  authMiddleware aplicado, nunca teria `userId` no contexto). Removido — a versão real
  e protegida já existe em `/api/auth/me`.
- Tipagem do contexto Hono (`c.get("userId")`) não tinha o `Variables` declarado —
  não quebrava o Bun (que não type-checa), mas dava erro em qualquer `tsc --noEmit`.
  Adicionado `src/types.ts` com `AppEnv` e aplicado nos routers.

**O que estava faltando de verdade (não só bug, ausência mesmo):**
- `GaragemOverview`, `VeiculoDetalhe`, `VeiculoCard` e `FaseCard` ainda importavam de
  `data/*.ts` — agora consomem a API real via `src/lib/api/veiculos.ts` (camada nova,
  com adapters snake_case → camelCase e parsing de `NUMERIC` do Postgres, que volta
  como string).
- Página `/novo` (criação de veículo) não existia, só era mencionada na conversa.
  Criada em `src/pages/NovoVeiculo.tsx` e plugada na rota.
- `lib/metrics.ts` (operava sobre mock) foi removido — a lógica equivalente
  (progresso, totais por moeda, contagem de itens) agora vive em `lib/api/veiculos.ts`,
  operando sobre a resposta real da API.

`tsc -b` (front), `tsc --noEmit` (api) e `oxlint` passam limpos. `vite build` gera o
bundle de produção sem erro. Não rodei o `docker compose up` de fato porque este
ambiente não tem acesso ao Postgres/rede pra isso — então o fluxo completo (banco
subindo, migrations rodando, registro → login → criar veículo → ver na listagem)
precisa ser validado por você na sua máquina. Se algo travar no `docker compose up
--build`, me chama com o log de erro que eu sigo dali.

Os arquivos `src/data/*.ts` (mock do RX-8 K24 e do Civic) foram removidos. Os dados
não desapareceram — virou `autohub-api/src/db/seed.ts`, que insere esse build real
(usuário, garagem, 2 veículos, 7 fases, 43 itens, 3 fornecedores) direto no Postgres
depois das migrations. É idempotente: roda em todo `docker compose up` e só insere
na primeira vez (verifica se o e-mail seed já existe).

Login pra ver a garagem do Gui já populada:
- **E-mail:** guilherme@pinedevs.com.br
- **Senha:** autohub_dev_2026

(Troca essa senha à vontade direto no `seed.ts` antes do primeiro `docker compose up`,
ou cria sua própria conta normalmente — o seed não interfere em nada.)

