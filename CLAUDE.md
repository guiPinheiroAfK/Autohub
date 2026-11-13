# Autohub — instruções para o Claude

Garagem automotiva online: builds de veículos com fases e itens, marketplace, tracks GPS, eventos, feed e o minigame AutoDash.

## Estrutura
- `web-garagem/` — front React 19 + Vite + Tailwind v4 (+ Leaflet/MapLibre).
- `api/` — backend Bun + Hono, DB Neon (Postgres via HTTP), deploy em Netlify Functions.
- `legacy/` — referência histórica (protótipo Java do AutoDash). Não editar.
- `docs/` — índice em `docs/README.md`: estado atual, ADRs e specs. **Leia o ADR/spec da área antes de mudar algo estrutural.**

## Comandos
```bash
# front
cd web-garagem && npm install && npm run dev      # porta 5173
cd web-garagem && npm run build                    # tsc -b + vite build (a verificação mínima)
cd web-garagem && npm run lint                     # oxlint

# api
cd api && bun install && bun run dev               # porta 8000
cd api && bun run setup                            # migrate + seed (uma vez)
```

## Convenções
- **Gerenciador de pacotes: npm.** O deploy (`netlify.toml`) e o Docker do front usam npm. Não criar `bun.lock`.
- **Um commit = uma mudança verificável.** Antes de commitar, rodar `npm run build` (front) ou o equivalente da api.
- Mensagens de commit no formato `tipo: descrição` (`feat`, `fix`, `refactor`, `chore`, `docs`, `test`), em português.
- Refatoração move código sem mudar comportamento. Se precisar mudar lógica, é commit separado.

## Armadilhas conhecidas
- `VITE_API_URL` é só para o proxy do Vite. **Nunca** pode aparecer no bundle do browser (`client.ts` usa caminhos relativos).
- `@neondatabase/serverless` usa HTTP: não funciona com Postgres TCP local. O banco é sempre o Neon cloud.
- **Migrations já aplicadas no Neon não são editadas.** Mudança de schema vira uma nova versão em `api/src/db/migrate.ts`.
- Custo de infra zero é restrição (Netlify + Neon free tier, Cloudinary unsigned). Ver ADR 0004.
- O engine do AutoDash (`web-garagem/src/game/autodash/`) está sendo dividido em módulos menores (ver `docs/plano-reorganizacao.md`). Não criar código novo dentro de `engine.ts` sem necessidade.

## Testes
Ainda não há suíte automatizada. A verificação atual é build + lint + teste manual no navegador. Vitest entra na Fase 2 do plano.
