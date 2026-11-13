# ADR 0001 — Monorepo com `api/` e `web-garagem/`, sem renomear pastas

**Status:** Aceito

## Contexto
O projeto tem um backend e um front no mesmo repositório. Os caminhos estão em vários lugares: `netlify.toml`, `docker-compose.yml`, scripts npm e imports relativos.

## Decisão
Manter as duas pastas de topo como estão. Reorganizar por dentro (módulos, docs, legacy), nunca renomeando as pastas de topo.

## Consequências
- Nenhuma mudança de caminho em deploy ou Docker.
- Refatorações ficam restritas a cada pasta, com commits menores.
- Se o front e a API forem separados em repos no futuro, esta decisão precisa ser revista.
