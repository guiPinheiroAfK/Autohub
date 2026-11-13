# ADR 0002 — Banco Neon via driver HTTP

**Status:** Aceito

## Contexto
O backend roda em Netlify Functions, que são efêmeras e não mantêm conexão TCP persistente. O banco é Postgres no Neon (tier gratuito).

## Decisão
Usar `@neondatabase/serverless` no `api/src/db/client.ts`, que fala HTTP com o Neon. O `docker-compose` não tem serviço de banco local: a API aponta para o Neon cloud via `api/.env`.

## Consequências
- Não há Postgres local. Desenvolvimento usa o mesmo banco da produção (cuidado com migrations).
- O driver `postgres` (TCP) não funciona com o mesmo banco no ambiente serverless. Ver o plano de reorganização, item sobre o driver duplicado em `cotacao-diaria.mts`.
- Migrations já aplicadas no Neon não são editadas (ver `CLAUDE.md`).
