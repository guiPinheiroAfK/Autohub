# ADR 0003 — Netlify Functions em produção, proxy do Vite em dev

**Status:** Aceito

## Contexto
O front é uma SPA estática. A API precisa ser servida no mesmo domínio para evitar CORS e cookies entre domínios.

## Decisão
- **Produção:** o front é publicado em `web-garagem/dist`, e a API roda como Netlify Functions (`api/netlify/functions/`). O `netlify.toml` faz o redirect `/*` → `index.html`.
- **Dev:** o Vite faz proxy de `/api` e `/auth` para o servidor local da API (porta 8000). O `client.ts` usa caminhos relativos (`BASE = ""`).
- `VITE_API_URL` existe só para o proxy do Vite. Nunca pode ser lido no código do browser.

## Consequências
- Não há hostname da API no bundle. Testes em dev e em produção usam o mesmo código do cliente.
- O `docker-compose` do front usa `VITE_API_URL=http://api:8000`, o que é específico do Docker.
- Netlify Functions não mantêm WebSocket, por isso o multiplayer do AutoDash usa polling (ADR 0009).
