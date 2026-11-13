# ADR 0008 — Tráfego do AutoDash com padrão strategy

**Status:** Aceito

## Contexto
O tráfego (civis, motos, polícia, contramão) tinha comportamento misturado dentro do engine. Adicionar um novo tipo de IA significava mexer no engine inteiro.

## Decisão
- `traffic/types.ts`: domínio. `Traffic` com `role: "civilian" | "police" | ...`, `TrafficKind`, `KINDS`, e `WorldView` (contrato somente leitura do mundo).
- `traffic/driver.ts`: `Driver` base com helpers compartilhados (`laneFree`, `tryLaneChange`, `applyMovement`, `antiOverlap`), `CivilianDriver`, `PoliceDriver` e o registro `DRIVERS` por role.
- O engine monta o `WorldView` por frame e chama `DRIVERS[t.role].drive(t, world, dt)`.
- Colisão, pontuação, near-miss, reciclagem e render continuam no engine.
- Motos não têm classe própria: são civis com `kind` mais agressivo.

## Consequências
- Novas IAs (contramão, blitz) são uma classe nova e um registro, sem mexer no loop.
- Regra de design validada no jogo: polícia respeita o trânsito (`antiOverlap`). Atravessar carros quebra a sensação de perseguição.
- A polícia usa `TOP = 215`, abaixo da velocidade máxima dos carros, de propósito. Ver `docs/specs/autodash/README.md`.
- Entidades persistentes (polícia, eventos) não passam pelo reciclador do trânsito.
