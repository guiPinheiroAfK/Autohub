# Revisão de qualidade de código — AutoDash (`web-garagem/src/game/autodash/`)

Branch: `claude/autodash-revisao-qualidade-ad9155`. Escopo: só limpezas que não mudam comportamento. Golden master (`npm test`) passou em todos os commits sem atualizar snapshot.

## Como foi feito

- Lidos: `CLAUDE.md`, `docs/specs/autodash/GUIA-V2.md` (golden master), `docs/plano-reorganizacao.md`.
- Verificação dos achados por busca no código: exports sem nenhuma referência em `src/`, `any`, supressões (`@ts-ignore`, `eslint-disable`), `!` não nulo, comentários em inglês, marcadores TODO/FIXME, tamanho de função (heurística por linhas entre declarações), cobertura de testes por módulo.
- Baseline antes de qualquer mudança: `npm run build` ok; `npm run lint` sem nenhum aviso dentro de `src/game/autodash/` (os avisos do projeto estão em outras pastas); `npm test` 167/167.
- Não foram editados `sound/`, `audio.ts`, `physics/`, `sim/`, `world/events.ts`, `traffic/`, `render/hud.ts` e `render/menus/`, como pedido. Achados nesses arquivos ficam só aqui.

Prioridade: **Alta** = risco de bug ou dívida que trava mudanças; **Média** = custo de manutenção ou falta de rede de segurança; **Baixa** = limpeza.

## Achados aplicados (commits desta sessão)

| Arquivo | Linha | Problema | Prioridade | Situação |
|---|---|---|---|---|
| `race/net.ts` | 70–71 | `// @ts-ignore` escondendo parameter properties (`private code`), que o tsconfig (`erasableSyntaxOnly`) proíbe. | Média | Corrigido em `e9abc5d`: campos explícitos no construtor. |
| `data.ts` | 11, 20, 167 | `LANES`, `RPM_REDLINE` e `WHEEL_NAMES` sem nenhuma referência. | Baixa | Removido em `c7c9abe`. |
| `race/session.ts` | 207–208 (e import) | `kmhToUps` sem nenhuma referência; `KMH2UPS` ficaria sem uso no import. | Baixa | Removido em `c7c9abe`. |
| `render/backdrop.ts` | 89 | Trecho de código comentado (`renderNeonCity`) com justificativa de otimização em texto solto. | Baixa | Removido em `c7c9abe`. |
| `world/biomes.ts` | 74–75 | Comentário de `biomeDaCorrida` dizia "entra na Fase 3" (futuro). A Fase 3 já está feita: o circuito fixo define o bioma via `buildCircuit`. | Baixa | Reescrito em `c7c9abe`. |
| `net.ts` | 22–57 | Bloco `method/headers/body` de POST repetido em 4 funções. | Média | Trocado por `postJson` em `8734a4d`. |
| `race/net.ts` | 21–22 | Helper `post` local, igual ao de `net.ts`. | Média | Movido para `net-http.ts` como `postJson` em `8734a4d`. |
| `net-http.ts` | 6 | Timeout `5000` sem nome. | Baixa | Virou `TIMEOUT_MS` em `8734a4d`. |
| `world/biomes.ts` | — | Único módulo de dados do autodash sem teste (`BIOMES`, `proximoBioma`, `biomeById`). | Média | Teste novo `__tests__/biomes.test.ts` (7 casos) em `f11ce18`. |

## Achados não aplicados

### Comportamento (exigem decisão ou commit `fix`, não `refactor`)

| Arquivo | Linha | Problema | Sugestão | Prioridade |
|---|---|---|---|---|
| `world/biomes.ts` | 35, 70–71 | `BIOMES` é um `Record<string, …>` comum. `biomeById("constructor")` ou `"toString"` passa no `(id && BIOMES[id])` e devolve uma propriedade do `Object`, não a cidade. Hoje ninguém passa esses ids, então é latente. Achado por leitura do código, não reproduzido no navegador. | `Object.hasOwn(BIOMES, id) ? BIOMES[id] : BIOMES.cidade`, em commit `fix(game)` separado. Mesmo ajuste em `proximoBioma` se o id vier de fora. | Alta (latente) |
| `net-http.ts` | 12–13 | Resposta da API vira `data as T` sem nenhuma validação. Se o servidor mudar o formato, o erro aparece longe da origem. | Validar os campos usados (ou ao menos um guarda de forma) nos clientes de rede. Muda comportamento em erro de contrato, por isso fica fora de refactor. | Média |
| `render/backdrop.ts` | 174 | `drawDeco` recebe `kind: number` com códigos mágicos (`0..7`). Em `world/biomes.ts` há `arvore: 7` apontando para o mesmo código. Mesmo padrão em `kind === 4/5/6/7` no mesmo arquivo. | Um `const DECO = { ARVORE: 0, POSTE: 1, OUTDOOR: 2, … } as const` e `arvore: DECO.PALMEIRA`. Só nomes, sem mudança de valor. Pode virar refactor depois, quando Fase 7 não estiver mexendo nesse arquivo. | Média |

### Estrutura (refactor grande; precisa de sessão própria, com golden master ligado)

| Arquivo | Linha | Problema | Sugestão | Prioridade |
|---|---|---|---|---|
| `render/road.ts` | 23 | `renderRoad` com ~474 linhas. É a função mais longa do jogo fora dos módulos proibidos. | Quebrar em etapas (horizonte/céu, segmentos, sprites de beira, sprites de tráfego) recebendo `eng` e um contexto de frame. Golden master cobre essa cena. Não apliquei: arquivo quente para Fase 7 (efeitos) e tamanho grande demais para esta passada. | Alta |
| `render/primitives.ts` | 20 | `drawPlayerCar` com ~317 linhas (carroceria, faróis, asas, rodas, pintura num só bloco). | Extrair um desenhista por parte (`drawBody`, `drawWheels`, `drawWing`, `drawLights`). Puro, sem `this`. | Média |
| `engine.ts` | 355, 98 | `render()` com ~292 linhas e a classe com ~677 linhas. O GUIA diz ~660 e o plano-alvo é ≤400. | Continuar a extração do plano (Fase 3 itens 26–32) quando as Fases 5–7 estiverem mescladas, para não gerar conflito. | Alta |
| `race/net.ts` | 78 | `RaceNet.update()` com ~60 linhas misturando dead reckoning, convergência suave e envio de telemetria. | Extrair `extrapolar(dt, trackLen)` e `enviar(dt, telemetria)`, mantendo a ordem. Antes: teste da corrida online (hoje o golden não cobre). | Média |

### Proibidos nesta revisão (só registro)

| Arquivo | Linha | Problema | Prioridade |
|---|---|---|---|
| `sim/update.ts` | 24 | `update()` com ~346 linhas. Principal ponto de entrada da simulação. | Alta |
| `sim/longitudinal.ts` | 63 | `if (eng.gear >= 1 && eng.shiftT > 0) { /* segura o boost */ }`: bloco vazio, código morto. | Baixa |
| `traffic/driver.ts` | 13 | `clamp` redefinido localmente; `math.ts` já exporta um igual. | Baixa |
| `audio.ts` | 88 | Cast `as unknown as { webkitAudioContext… }`. Aceitável para compatibilidade, mas é um ponto de tipo frouxo. | Baixa |
| `traffic/driver.ts` | 128, 201, 292 | Três `drive()` por papel com lógica parecida; fica para a Fase 6 (polícia), que mexe ali. | Média |

### Evitados por conflito com Fases 5–7 (só registro)

| Arquivo | Linha | Problema | Sugestão | Prioridade |
|---|---|---|---|---|
| `input/keyboard.ts` | 6–18 | Imports repetidos do mesmo módulo: `../flow` em 5 linhas, `../modes/race` em 4, `../modes/duel` em 2. | Unificar num import por módulo. Mudança pequena, mas as Fases 5–7 quase certamente acrescentam imports aqui. | Baixa |
| `input/pointer.ts` | 2–3 | `../flow` importado em duas linhas. | Unificar junto com o item acima. | Baixa |
| `input/keyboard.ts` | 43–134 | Teclas como strings soltas (`"o"`, `"k"`, `"v"`…) e uma lista literal `["c","v","b","r","g","t","y","x"].includes(k)` na linha 134 que repete as teclas que salvam config. | Constante `TECLAS_QUE_SALVAM` e, se der, mapa de teclas por estado. | Baixa |
| `data.ts` | 197 | `biome: string` sem tipo do id de bioma. | `BiomeId` como tipo literal, derivado de `BIOMES`, quando houver mudança no registro. | Baixa |

### Exports sem uso fora do próprio arquivo

Medido por busca em `src/` (inclui testes). Símbolos só usados dentro do arquivo; remover o `export` é seguro, mas espalha diff em arquivos quentes e alguns são simetria de API. Não apliquei.

- `math.ts`: `anyToRgb` (usado internamente).
- `net.ts`: `RematchStatus`, `RoomCreated`, `RoomJoined`, `RoomStatus`, `StateResponse` (tipos).
- `race/net.ts`: `LobbyInfo` (tipo). `race/bots.ts`: `RamalInfo`. `race/types.ts`: `CORES_RIVAL`.
- `input/keyboard.ts`: `toggleMute`. `modes/duel.ts`: `newDuelSession`.
- `data.ts`: `FOV`, `defaultConfig`.
- `physics/traction.ts`: `LOAD_TRANSFER`, `TRACTION_SCALE`, `LAT_REF`, `POWER_UNDERSTEER`, `LIFT_TUCK`.
- `physics/motores.ts`: `CORTE_DURO_FASE`, `CORTE_SUAVE_RPM`, `GIRO_SOM_TAU`, `ganhoMotor`, `motorIdDoCarro`. `physics/troca.ts`: `BLIP_FRAC`. `physics/gearbox.ts`: `popExhaust`.
- `render/camera.ts`: `NITRO_SOBE_S`, `NITRO_DESCE_S`, `ZOOM_VEL`, `ZOOM_NITRO`. `render/hud.ts`: `renderMinimap`, `renderDuelBar`, `renderTacho`. `render/menus/race.ts`: `tracadoCompleto`, `desenharTracado`.
- `world/biomes.ts`: `SKY_KEYS`, `BIOME_IDS`, `SkyState`. `world/clock.ts`: `HORA_MODOS`. `world/weather.ts`: `CLIMA_MODOS`, `ClimaDef`. `world/ramais.ts`: `RamalPerfil`, `RamalAqui`. `world/events.ts`: `spawnEvent`.
- `sim/clima.ts`: `setClima`. `traffic/spawner.ts`: `spawnTraffic`. `ui/widgets.ts`: `isHover`.
- `sound/profiles.ts`: `Inducao`, `EventoIgnicao`, `Gravacao`. `sound/waveguide-synth.ts`: `MotorGuias`.

Sugestão para o conjunto: rodar `knip` uma vez (ou regra equivalente) e decidir em lote.

### Cobertura de testes (funções puras sem teste direto)

- `world/ramais.ts`: `ramalBordas`, `ramalNoSeg`, `ganhoRamal` (só indiretamente via circuitos). **Média.**
- `world/track.ts`: `sinalizarCurvas`, `conesDeCurva`. **Média.**
- `world/zones.ts` (`updateZones`), `world/obstacles.ts` (`updateObstacles`). **Média.**
- `input/pointer.ts`: `regionAt` (lógica pura sobre `eng.uiRegions`). `ui/widgets.ts`: `isHover`. **Baixa**, fácil de testar com um objeto mínimo.
- `race/bots.ts`, `race/session.ts`, `race/net.ts` (`meuPlayerId` e o dead reckoning): sem teste direto. **Média**; dead reckoning é a parte mais sensível.
- `traffic/driver.ts` e `traffic/spawner.ts`: sem teste direto; cobertos só pelo golden. **Média** (a Fase 6 mexe aqui).

### Estabilidade dos testes

- Uma vez, a suíte completa falhou em 2 testes: `ganhos-motor.test.ts` ("tabela de volume por motor está atualizada…") e `waveguide-synth.test.ts` ("…todo perfil gera som finito e estável em todo o giro"). Os dois passam sozinhos e numa segunda rodada completa (167/167). A causa provável é o timeout padrão de 5 s do vitest sob carga, já que a suíte inteira leva ~190 s. Não reproduzido de forma determinística. **Média**: vale aumentar `testTimeout` para os testes pesados ou reduzir o trabalho deles.

## Lint e tipos

- `npm run lint`: nenhum aviso dentro de `src/game/autodash/`, antes e depois.
- Nenhum `any` em `src/game/autodash/` (fora de comentários).
- `!` (non-null) não encontrado em código de jogo.
- Casts `as` existentes: `net-http.ts` (resposta, ver acima) e `audio.ts` (webkit, proibido nesta revisão).
- Comentários: quase tudo em português, como o projeto pede. Nenhum comentário em inglês relevante; os termos técnicos (ex.: "DEAD RECKONING") ficam.

## Commits desta revisão

1. `c7c9abe` refactor(game): remove código morto e comentários desatualizados
2. `e9abc5d` refactor(game): RaceNet com campos explícitos, sem @ts-ignore
3. `8734a4d` refactor(game): POST JSON comum em net-http e timeout nomeado
4. `f11ce18` test(game): cobre registro de biomas, proximoBioma e biomeById

Verificação em cada commit: `npm run build` ok, `npm run lint` sem aviso em autodash, `npm test` passando (167/167 antes; 174/174 depois do teste novo). Nenhum snapshot do golden master foi alterado.

## Ambiente (para quem for commitar aqui)

- `core.autocrlf=true` neste Git: os arquivos do worktree estão em CRLF e o índice em LF. `git status` mostra `__tests__/__snapshots__/engine.golden.test.ts.snap` e `scenarios.golden.test.ts.snap` como modificados só por fim de linha (`git diff --ignore-cr-at-eol` fica vazio). **Não commitar esses dois arquivos.** Os commits desta revisão adicionaram só os arquivos alterados.
- `git status` também mostrou arquivos sem conteúdo alterado (ex.: `data.ts`) como `M` por causa de stat desatualizado; `git update-index --refresh` limpa isso.
