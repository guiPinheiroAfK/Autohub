# ADR 0004 — Custo zero de infraestrutura

**Status:** Aceito

## Contexto
O projeto é pessoal, sem receita. Qualquer custo mensal recorrente não se paga.

## Decisão
Usar apenas serviços com tier gratuito: Netlify (front e Functions), Neon (Postgres), Cloudinary (imagens). Não usar S3, serviços de WebSocket pagos ou filas gerenciadas.

## Consequências
- Limites do tier gratuito viram restrição de design: upload de imagem vai direto ao Cloudinary, sem backend de armazenamento próprio.
- Sem WebSocket, o multiplayer usa polling (ADR 0009).
- Qualquer proposta que introduza custo recorrente precisa de nova decisão explícita, com um ADR novo.
