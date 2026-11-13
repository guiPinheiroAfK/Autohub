# Documentação do Autohub

Índice. Comece pelo [CLAUDE.md](../CLAUDE.md) na raiz.

## Estado e planejamento
- [status.md](status.md) — o que está pronto, stack e próximos passos.
- [plano-reorganizacao.md](plano-reorganizacao.md) — plano de refatoração em commits (em andamento).

## Decisões de arquitetura (ADR)
| # | Decisão |
|---|---|
| [0001](adr/0001-monorepo-sem-renomear-pastas.md) | Monorepo com `api/` e `web-garagem/`, sem renomear pastas |
| [0002](adr/0002-neon-http-driver.md) | Banco Neon via driver HTTP |
| [0003](adr/0003-netlify-functions-e-proxy-vite.md) | Netlify Functions em produção, proxy do Vite em dev |
| [0004](adr/0004-custo-zero-de-infra.md) | Custo zero de infraestrutura |
| [0005](adr/0005-cloudinary-unsigned-upload.md) | Imagens via Cloudinary com upload unsigned |
| [0006](adr/0006-fotos-indexeddb-local.md) | Galeria de fotos local no IndexedDB |
| [0007](adr/0007-autodash-canvas-sem-libs.md) | AutoDash em Canvas 2D e áudio WebAudio, sem bibliotecas |
| [0008](adr/0008-autodash-strategy-para-trafego.md) | Tráfego do AutoDash com padrão strategy |
| [0009](adr/0009-duelo-por-polling.md) | Multiplayer do AutoDash por polling |
| [0010](adr/0010-autodash-roblox-spec-driven.md) | Port do AutoDash para Roblox guiado por spec |

## Specs
- [autodash/](specs/autodash/README.md) — minigame web (descrição do que o código faz hoje).
- [autodash-roblox/](specs/autodash-roblox/autodash-roblox-spec.md) — spec completa do port para Roblox (fonte da verdade do port).

## Como adicionar um ADR
Copie o formato de um ADR existente (Status, Contexto, Decisão, Consequências). Número sequencial, nome `NNNN-slug.md`. ADR não é apagado: se a decisão mudar, o novo ADR marca o antigo como "Substituído por NNNN".
