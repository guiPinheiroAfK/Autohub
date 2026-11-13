# Estado atual do Autohub

Atualizado em 2026-11-13, a partir da memória de sessões anteriores e do código em `master`. Itens marcados **(verificar)** não foram conferidos no código nesta revisão.

## Stack
- **Front:** React 19, Vite, Tailwind v4, react-router, Leaflet e MapLibre (mapas), Lucide. Pasta `web-garagem/`.
- **API:** Bun + Hono, Zod, JWT (`jose`), bcryptjs, Resend (e-mail), webhook do Discord. Pasta `api/`.
- **Banco:** Neon Postgres via `@neondatabase/serverless` (HTTP).
- **Deploy:** Netlify (front estático + Netlify Functions para a API). Produção: `autohubbr.netlify.app`.
- **Imagens:** Cloudinary (upload unsigned).

## Funcionalidades
- **Auth:** e-mail/senha com JWT, verificação de e-mail, reset de senha, OAuth Google.
- **Garagem:** veículos por usuário, perfis (daily, street_build, restomod, track, project), colaboração em veículos, follows.
- **Builds:** fases com orçamento mínimo/máximo por moeda (BRL, USD, PYG), itens com cascata de status, catálogo de ~185 sugestões de peças com busca.
- **Fotos:** galeria no IndexedDB (local ao aparelho, não sincroniza). Upload para Cloudinary (ver ADR 0005).
- **Feed público**, curtidas e comentários em builds públicos.
- **Tracks:** rotas com GPS, runs, telemetria e badges (**verificar** estado atual da tela de Run).
- **Eventos e calendário.**
- **Notificações**, incluindo Web Push (**verificar**).
- **Marketplace:** listagem pública, busca e filtros, interesse, patrocínio, CRUD de anúncios. Minha Loja com preview ao vivo.
- **AutoDash** (`/autodash`): minigame de corrida em Canvas, com leaderboard global, duelo 1v1 online e modo corrida de até 4 pilotos. Ver [specs/autodash](specs/autodash/README.md).

## Em andamento
- Refatoração em commits, conforme [plano-reorganizacao.md](plano-reorganizacao.md). Branch `chore/reorganizacao`.
- Port do AutoDash para Roblox (projeto separado, fora deste repo). Spec em [specs/autodash-roblox](specs/autodash-roblox/autodash-roblox-spec.md). Marco 3 implementado, aguardando playtest.

## Próximos passos já planejados
- Merge do PR de marketplace na master (**verificar** se já foi feito).
- Página pública de loja (`/loja/:slug`) pode precisar de polimento.
- AutoDash: validar perseguição e blitz, depois remover as teclas de debug (plano, Fase 3).
- Integrar carros do AutoDash com os veículos reais do usuário.
