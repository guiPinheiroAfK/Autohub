# ADR 0010 — Port do AutoDash para Roblox guiado por spec

**Status:** Aceito

## Contexto
Queremos o AutoDash também no Roblox, com multiplayer nativo em vez de polling. O port é grande, e a implementação anterior não tinha documento de referência.

## Decisão
- Escrever primeiro a spec completa (`docs/specs/autodash-roblox/autodash-roblox-spec.md`): arquitetura, contrato de Remotes, SPECs numeradas, roadmap em marcos testáveis e apêndice com as constantes de física portadas do web.
- Implementar marco por marco, entregando uma SPEC por vez.
- O projeto Rojo fica **fora deste repo** (`C:\Users\guiva\Downloads\autodash-roblox\`), porque é um projeto do Roblox Studio, não web.

## Consequências
- A spec é a fonte da verdade. Mudança de comportamento atualiza a spec antes do código.
- Marcos já implementados: 1 (Rojo e config), 2 (câmbio e RPM) e 3 (corrida multiplayer básica). Marco 3 aguardando playtest.
- Decisões de escopo ficam registradas na spec, não neste ADR.
