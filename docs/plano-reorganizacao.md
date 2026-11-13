# Plano de reorganização do Autohub

Status: **Fases 0, 1, 2, 4 e 5 concluídas; Fase 3 quase toda concluída** (branch `chore/reorganizacao`, não enviada). Engine do AutoDash foi de 5.091 para ~660 linhas, com golden master cobrindo partida solo, corrida e duelo. Pendências: teclas de debug (decisão do dono), unificar os dois módulos de rede e a checagem de tipos da API. Fase 6 (memória) em andamento.

Decisões tomadas: D1 (protótipo em `legacy/`), D3 (Rojo fora do repo). D2 virou **npm**, não bun: o `netlify.toml` e o Docker do front usam npm, então o `package-lock.json` ficou e os `bun.lock` saíram.

---

## 1. Diagnóstico (medido no repo)

| Problema | Evidência | Impacto |
|---|---|---|
| Engine do AutoDash é um monólito | `web-garagem/src/game/autodash/engine.ts` tem **5.091 linhas / 233 KB**, uma classe `AutoDashEngine` com ~100 métodos (física, pista, tráfego, eventos, input, duelo, corrida, render inteiro, HUD, menus, áudio) | Qualquer mudança exige o Claude ler o arquivo inteiro. É o principal consumo de tokens. |
| Já existe um padrão bom, mas parcial | `game/autodash/traffic/` (strategy: `types.ts`, `driver.ts`) e `race/` foram separados; o resto não | Mostra que a divisão funciona no próprio projeto |
| Dois módulos de rede do jogo | `game/autodash/net.ts` (duelo) e `game/autodash/race/net.ts` (corrida) | Duplicação conceitual de polling/dead-reckoning |
| Páginas React gigantes | `VeiculoDetalhe.tsx` 931 linhas, `EventosPage.tsx` 891, `MarketplacePage.tsx` 872, `FaseCard.tsx` 770, `GaragemOverview.tsx` 667 | Difíceis de revisar e de editar sem reler tudo |
| Migrations em um arquivo só | `api/src/db/migrate.ts` (491 linhas) com v2…v8 empilhadas | Cada nova versão toca o mesmo arquivo |
| Auth espalhado em 3 arquivos | `routes/auth.ts`, `auth-v2.ts`, `auth-google.ts` | Não é claro onde mexer |
| Dois drivers de banco | `@neondatabase/serverless` em `db/client.ts`; `postgres` só em `netlify/functions/cotacao-diaria.mts` | Dependência extra sem motivo aparente (a validar) |
| Lockfiles duplicados | `bun.lock` **e** `package-lock.json` em `api/` e `web-garagem/` | Ambiguidade sobre qual gerenciador é o oficial |
| Lixo versionado / fora do git | `.idea/` está commitada apesar do `.gitignore`; `autodash/` (protótipo Java + ~15 `.class`) é untracked na raiz | Ruído no repo |
| Sem CLAUDE.md, sem ADR, sem specs no repo | Nenhum `CLAUDE.md`; `docs/` não existe; a spec do Roblox está em `C:\Users\guiva\Downloads\autodash-roblox-spec.md`, fora do repo | Cada sessão começa do zero e relê código para entender decisões |
| Debug no código de produção | Teclas de debug da perseguição/eventos (memória cita `O L B V J K I U`) ainda presentes | Precisam sair ou ficar atrás de `import.meta.env.DEV` |
| Memória com documentos longos | `project_autohub_estado.md` e `project_autodash_roblox.md` são grandes e duplicam o que deveria estar em docs | Custo de contexto em toda sessão. Memória deveria ter ponteiros, não o conteúdo |
| Memória desatualizada | Memória diz que `feat/autodash-web-game` aguarda merge; `master` já contém o merge do PR #28 | Corrigir ao final |
| Sem testes | Não há nenhum teste automatizado; a verificação é `tsc -b && vite build` + `oxlint` | Refatorar sem rede de segurança. Por isso o plano começa com testes de funções puras |

---

## 2. Princípios

1. **Um commit = uma mudança verificável.** Cada commit de refatoração deve deixar o projeto compilando (`npm run build` em `web-garagem/`) e sem regressão visual/funcional.
2. **Mover antes de reescrever.** Primeiro extrair código idêntico para outro arquivo (sem mudar lógica). Só depois simplificar.
3. **Não renomear pastas de topo.** `api/` e `web-garagem/` ficam como estão. Renomear custa churn de imports e de deploy (Netlify) sem ganho real.
4. **Arquivos pequenos e com nome de responsabilidade.** Meta: nenhum arquivo de código do jogo acima de ~400 linhas.
5. **Docs curtos, por assunto, com links.** `CLAUDE.md` é o índice de entrada; detalhes ficam em `docs/`. Memória guarda preferências e ponteiros, não documentos.
6. **Não escrever spec de tudo.** Spec/ADR nasce para a área que você vai mexer, não para o projeto inteiro de uma vez. Isso evita gastar tokens em documento que ninguém relê.

---

## 3. Estrutura alvo

```
Autohub/
├── CLAUDE.md                     # curto: stack, comandos, convenções, ponteiros p/ docs/
├── README.md                     # (já bilíngue) sem mudança de conteúdo
├── docs/
│   ├── README.md                 # índice de docs/
│   ├── status.md                 # estado atual (features, o que falta) — substitui a memória longa
│   ├── plano-reorganizacao.md    # este arquivo (remover ao final)
│   ├── adr/                      # decisões de arquitetura, uma por arquivo
│   │   ├── 0001-monorepo-sem-renomear-pastas.md
│   │   ├── 0002-neon-http-driver.md
│   │   ├── 0003-netlify-functions-e-proxy-vite.md
│   │   ├── 0004-custo-zero-de-infra.md
│   │   ├── 0005-cloudinary-unsigned-upload.md
│   │   ├── 0006-fotos-indexeddb-local.md
│   │   ├── 0007-autodash-canvas-sem-libs.md
│   │   ├── 0008-autodash-strategy-para-trafego.md
│   │   ├── 0009-duelo-por-polling.md
│   │   └── 0010-autodash-roblox-spec-driven.md
│   └── specs/
│       ├── autodash/             # spec do jogo web (curta, derivada do código)
│       └── autodash-roblox/      # spec movida de Downloads/ (fonte da verdade do port)
├── api/
│   └── src/
│       ├── db/
│       │   ├── client.ts
│       │   ├── migrations/       # 0002-... 0008-... (um arquivo por versão)
│       │   ├── migrate.ts        # só o runner
│       │   └── seed.ts
│       ├── routes/
│       │   └── auth/             # auth.ts + auth-v2.ts + auth-google.ts fundidos por responsabilidade
│       └── ...
├── web-garagem/
│   └── src/
│       ├── game/autodash/
│       │   ├── index.ts          # API pública do jogo (o que a página importa)
│       │   ├── engine/           # loop, máquina de estados, orquestração (engine slim, ~300–400 linhas)
│       │   ├── physics/          # rpm.ts, gearbox.ts, vehicle.ts (puros, testáveis)
│       │   ├── world/            # track.ts (gera pista), zones.ts, obstacles.ts, events.ts, signs.ts
│       │   ├── traffic/          # já existe: types.ts, driver.ts + spawner.ts
│       │   ├── fx/               # particles.ts (burst, fumaça, chama, chuva)
│       │   ├── input/            # keyboard.ts, mouse.ts, touch.ts
│       │   ├── modes/            # solo.ts, race.ts (bots), duel.ts
│       │   ├── net/              # duel-client.ts + race-client.ts (unificar os dois net.ts)
│       │   ├── render/           # road.ts, backdrop.ts, player.ts, traffic.ts, hud.ts, minimap.ts, tacho.ts, menus/
│       │   ├── ui/               # glass.ts, pill.ts, arrow-button.ts (widgets de canvas)
│       │   ├── math.ts           # mulberry32, clamp, mix, shade, hexToRgb
│       │   ├── audio.ts          # já existe
│       │   └── storage.ts        # antigo data.ts (persistência localStorage)
│       ├── components/           # quebra de FaseCard, VeiculoCard etc.
│       └── pages/                # páginas viram composição de hooks + subcomponentes
└── legacy/
    └── autodash-java/            # protótipo Java (se decidir manter — ver §5)
```

---

## 4. Sequência de commits

Cada linha é **um commit**. Ordem pensada para que qualquer um possa ser revertido sem quebrar os seguintes. Verificação mínima após cada commit: `npm run build` e `npm run lint` em `web-garagem/` (e typecheck da `api/`, se aplicável).

### Fase 0 — Higiene (sem mudança de comportamento)
1. `chore: ignora *.class e .idea/` — adicionar ao `.gitignore`.
2. `chore: remove .idea/ do git` — `git rm -r --cached .idea/`.
3. `chore: move protótipo Java para legacy/` — ou apagar (ver decisão D1).
4. `chore: escolhe um gerenciador de pacotes` — remover o lockfile não escolhido em `api/` e `web-garagem/` (ver decisão D2).

### Fase 1 — Documentação e contexto (zero código)
5. `docs: adiciona CLAUDE.md curto` — stack, comandos, convenções de commit, ponteiros para `docs/`.
6. `docs: cria docs/README.md e docs/status.md` — índice + estado atual consolidado.
7. `docs: ADRs 0001–0004` — decisões de infra e monorepo (fonte: memória + README).
8. `docs: ADRs 0005–0010` — Cloudinary, IndexedDB, Canvas, strategy de tráfego, polling, port Roblox.
9. `docs: move spec do Roblox para docs/specs/autodash-roblox/` — copiar `autodash-roblox-spec.md` do Downloads. O projeto Rojo continua fora do repo (ver D3).
10. `docs: spec curta do AutoDash web` — `docs/specs/autodash/README.md` descrevendo o que o código faz hoje (modos, física, eventos, duelo, corrida). Derivada do código, não inventada.

### Fase 2 — Rede de segurança (testes)
11. `test: configura vitest` — dependência de dev + script `test`.
12. `test: cobre math.ts e gerador de pista` — seed determinística (mesmo seed → mesma pista), mulberry32 reproduzível. Ainda sem mexer no engine.
13. `test: cobre physics do câmbio` — `powerCurve`, `rpmFor` e limites de marcha, extraídos como estão (o teste fixa o comportamento atual).

### Fase 3 — Engine do AutoDash (extração por responsabilidade)
Regra: cada commit move código **sem alterar lógica**; o método vira função que recebe o estado necessário (ou um objeto de contexto). Não trocar `this.x` por estado global.

14. `refactor(game): extrai math.ts` — `mulberry32`, `hexToRgb`, `mix`, `shade`, `clamp`.
15. `refactor(game): extrai render/primitives.ts` — `poly`, `rr`, `drawPlayerCar` (puros, sem `this`).
16. `refactor(game): extrai physics/rpm.ts e gearbox.ts` — `powerCurve`, `rpmFor`, `shiftUp`, `shiftDown`, `popExhaust` (esses dependem de estado — passar `GearboxState`).
17. `refactor(game): extrai world/track.ts` — `buildTrack`, `segAt`. Retorna dados da pista, não mexe em `this`.
18. `refactor(game): extrai traffic/spawner.ts` — `seedTraffic`, `spawnTraffic`, `updateTraffic` (usa os drivers já existentes).
19. `refactor(game): extrai world/zones.ts e obstacles.ts` — `updateZones`, `updateObstacles`.
20. `refactor(game): extrai world/events.ts` — `spawnEvent`, `spawnPoliceChase`, `updateEventSpawner`.
21. `refactor(game): extrai fx/particles.ts` — `burst`, `emitSmoke`, `emitFlame`, `initRain`, `updateFx`.
22. `refactor(game): extrai input/` — `onKeyDown/Up`, `onMouseDown/Up/Move`, `onWheel`, `onTouch*`, `buildTouchControls`, `bind`/`unbind`.
23. `refactor(game): unifica net/` — `net.ts` e `race/net.ts` viram `net/duel-client.ts` e `net/race-client.ts`, com o helper de polling/dead reckoning compartilhado.
24. `refactor(game): extrai modes/duel.ts` — `duelNet`, `duelCreate`, `duelJoin`, `duelFinish`, lobbies e telas de duelo.
25. `refactor(game): extrai modes/race.ts` — `startRace`, `correrComBots`, lobby/resultado/preview da corrida.
26. `refactor(game): extrai render/road.ts` — `renderRoad` (é o maior método de render, ~450 linhas).
27. `refactor(game): extrai render/backdrop.ts` — `renderBackdrop`, `drawDeco`, `drawBridge`, `drawTower`.
28. `refactor(game): extrai render/traffic.ts e player.ts` — `drawTraffic`, `drawObstacle`, `drawRoadSign`, `drawPickup`, `drawGhost`, `renderPlayer`, `renderRearView`, `renderRearThreat`.
29. `refactor(game): extrai render/hud.ts, minimap.ts, tacho.ts, semaphore` — `renderHud`, `renderMinimap`, `renderTacho`, `renderSemaphore`, `renderDuelBar`, `renderRaceHud`.
30. `refactor(game): extrai render/menus/` — `renderMenu`, `renderGarage`, `renderPause`, `renderGameOver`, `renderNameEntry`, telas de duelo/corrida (resultado, código de sala, preview da pista).
31. `refactor(game): extrai ui/` — `glass`, `pill`, `arrowBtn`, `isHover`, `regionAt`.
32. `refactor(game): engine vira orquestrador` — o que sobrar de `AutoDashEngine` (loop, `update`, `render` chamando os módulos). Alvo: ≤ 400 linhas.
33. `refactor(game): index.ts como API pública` — `AutoDashPage.tsx` importa só de `game/autodash/index.ts`.
34. `chore(game): remove teclas de debug` — `O L B V J K I U` saem ou ficam atrás de `import.meta.env.DEV`. **Só depois de validação com você** (decisão D5).
35. `docs: atualiza ADR 0007/0008 e spec do AutoDash` — refletir a nova estrutura.

### Fase 4 — Frontend (páginas e componentes grandes)
Uma página por commit, sempre: extrair hooks (`useX`) → extrair subcomponentes → mover tipos para `types/`.
36. `refactor: VeiculoDetalhe.tsx` (931 linhas)
37. `refactor: EventosPage.tsx` (891)
38. `refactor: MarketplacePage.tsx` (872)
39. `refactor: FaseCard.tsx` (770)
40. `refactor: GaragemOverview.tsx` (667)
41. `refactor: i18n.ts` — separar por idioma/namespace se o arquivo continuar crescendo (269 linhas; baixa prioridade).

### Fase 5 — Backend
42. `refactor(api): migrations em arquivos separados` — `db/migrations/0002-...ts` até `0008-...ts`, `migrate.ts` vira só o runner. **Não reescreve migrations já aplicadas no Neon**; só move o código.
43. `refactor(api): agrupa auth em routes/auth/` — `auth.ts`, `auth-v2.ts`, `auth-google.ts`, com a mesma ordem de montagem em `app.ts`. Confirmar antes se há rotas duplicadas entre `auth.ts` e `auth-v2.ts`.
44. `chore(api): remove driver duplicado` — se `postgres` não for necessário, trocar `cotacao-diaria.mts` para `@neondatabase/serverless` e remover a dependência (decisão D6).

### Fase 6 — Memória e pastas externas
45. Reduzir memórias de projeto a ponteiros: `project_autohub_estado` → aponta para `docs/status.md`; `project_autodash_game` e `project_autodash_roblox` → apontam para `docs/specs/` e ADRs. Manter só as preferências e decisões de QA/design (que são do usuário, não do código).
46. Corrigir a memória que diz que a branch do AutoDash não foi mergeada (master já tem o PR #28).

---

## 5. Decisões que preciso de você

Tudo abaixo tem uma recomendação. Se não responder, sigo com a recomendação na Fase 0/1.

- **D1 — Protótipo Java (`autodash/` na raiz, não commitado).** Recomendo **mover para `legacy/autodash-java/`** e commitar (41 KB de código de referência histórica). Os `.class` apago.
- **D2 — Gerenciador de pacotes.** `api/` já usa **bun** (scripts com `bun`), e `web-garagem/` tem scripts com `bun` também (`icons`, `og`). Recomendo **bun** como oficial e remover `package-lock.json`. Alternativa: npm, se o Netlify estiver configurado para isso (conferir `netlify.toml` antes).
- **D3 — Projeto Rojo do Roblox (`C:\Users\guiva\Downloads\autodash-roblox\`).** Recomendo **manter como repositório separado** (é um projeto Studio, não web), e só a spec entra em `docs/specs/autodash-roblox/`.
- **D4 — Testes.** Recomendo **vitest** (leve, funciona com o Vite já existente). Alternativa: `bun test`, sem dependência nova, mas aí o runner fica diferente do front.
- **D5 — Teclas de debug.** Quando a perseguição/eventos estiverem validados, remover. Recomendo **trocar para `import.meta.env.DEV`** em vez de apagar, para manter a ferramenta de QA.
- **D6 — Driver de banco duplicado.** Confirmar se `cotacao-diaria.mts` pode usar o cliente Neon do `db/client.ts`. Recomendo sim.

---

## 6. Estratégia de tokens (por que isso reduz custo)

- **Engine de 233 KB → arquivos de até ~400 linhas.** Uma mudança no HUD passa a exigir ler `render/hud.ts` (~150 linhas), não o engine inteiro.
- **`CLAUDE.md` curto** (≈ 60–80 linhas) carregado em toda sessão, com ponteiros para o que é específico.
- **Memória com ponteiros, não documentos.** Os dois arquivos longos de projeto viram resumos curtos.
- **Specs e ADRs por assunto.** Claude lê só o ADR relevante, em vez de reconstruir a decisão a partir do código.
- **Haiku para as extrações mecânicas** (Fases 0, 1, 3-mover e 4), que são movimentação de código idêntico. Reservar um modelo maior só para a Fase 3 itens 32–33 (orquestrador) e para a validação de regressão do jogo, se você quiser.

---

## 7. Riscos

- **Estado compartilhado do engine.** O engine usa `this.*` em quase tudo. A extração precisa ser feita com um objeto de contexto explícito, por isso as fases 3.14–3.31 são uma por commit e cada uma verificada no navegador (o jogo roda em `/autodash`).
- **Regressão visual do canvas.** Não há teste visual. Após cada commit da Fase 3, abrir `/autodash` e conferir corrida, duelo e menu. Sugestão: usar a técnica de QA já documentada na memória (renderizar ~25 frames antes de amostrar pixel).
- **Migrations em produção.** A Fase 5.42 só move código; não altera o que já rodou no Neon. Conferir com o `db/migrate.ts` antes de qualquer alteração de SQL.
- **Deploy do Netlify.** Mudar `api/netlify/functions/` quebra o deploy se o caminho mudar. Não mexer em `netlify.toml` nem em nomes de função sem necessidade.

---

## 8. Próximo passo sugerido

Aprovando este plano, começo pela **Fase 0 + Fase 1** (higiene e documentação, sem mexer em código do jogo), que são baratas e já reduzem o contexto de cada sessão. Depois sigo para a Fase 2 (testes) antes de tocar no engine.
