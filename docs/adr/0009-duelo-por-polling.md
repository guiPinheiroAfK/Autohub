# ADR 0009 — Multiplayer do AutoDash por polling

**Status:** Aceito

## Contexto
O duelo 1v1 e o modo corrida precisam trocar telemetria entre jogadores. A API roda em Netlify Functions (ADR 0003), que não mantém WebSocket.

## Decisão
- Salas identificadas por código, guardadas em `autodash_rooms` (migração v7) e em `autodash_race_rooms` + `autodash_race_players` (v8).
- Telemetria por **polling a cada ~1 s** (`duelNet` no engine, `net.ts` e `race/net.ts`).
- Para esconder o atraso, o cliente faz **dead reckoning**: entre um poll e outro, o rival segue pela última velocidade conhecida.
- A largada usa o timestamp do servidor. A pista é idêntica nos dois lados porque usa a mesma seed (`mulberry32`).
- Leaderboard global em `autodash_scores` (migração v6).

## Consequências
- Latência visível em alguma situação: o rival pode aparecer defasado. Dead reckoning reduz o erro em reta, não em curva.
- Custo de função: cada poll é uma invocação. Aceito pelo tier gratuito (ADR 0004).
- Os dois módulos de rede (`net.ts` e `race/net.ts`) duplicam lógica de polling. Unificar está no plano (Fase 3).
- A migração v6 e v7 já rodaram no Neon. Migrations novas entram como versões seguintes.
