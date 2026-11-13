# Spec — AutoDash (web)

Descrição do que o minigame faz hoje, derivada do código. Mudou de comportamento? Atualize esta spec no mesmo commit.

**Rota:** `/autodash` (pública, tela cheia, fora do `Layout`). Página: `web-garagem/src/pages/AutoDashPage.tsx`.
**Código:** `web-garagem/src/game/autodash/`, ponto de entrada `index.ts`. Módulos: `engine.ts` (orquestra), `sim/` (quadro), `physics/`, `world/`, `traffic/`, `modes/` (solo, corrida, duelo), `render/`, `input/`, `ui/`, `fx/`, `flow.ts`. Ver `docs/plano-reorganizacao.md`.

## Visão
Corrida pseudo-3D em Canvas 2D (segmentos estilo OutRun). Estética de jogo de PSP. Dados em `localStorage`, ranking global e multiplayer pela API. Ver ADR 0007.

## Modos
| Modo | `mode` no engine | Descrição |
|---|---|---|
| Solo | `solo` | Corrida contra o tempo e o trânsito. Níveis sobem com o progresso. |
| Duelo | `duel` | 1v1 online por código de sala. Pista igual nos dois lados (seed). Ver ADR 0009. |
| Corrida | `race` | Até 4 pilotos por voltas, com bots ou jogadores remotos. Lobby, contagem, pódio. |

Estados da máquina (`GameState` em `engine.ts`): `menu`, `garage`, `countdown`, `racing`, `paused`, `gameover`, `nameentry`, lobbies e telas de duelo (`duellobby`, `duelcode`, `duelwaiting`, `duelspectate`, `duelresult`) e de corrida (`racelobby`, `racecode`, `racewait`, `raceresult`).

## Física e veículo
- Câmbio sequencial, no scroll ou nas teclas, com modo automático (toggle).
- RPM com redline e *launch control* no semáforo (modo corrida).
- Curva de torque em `powerCurve`, RPM por marcha e velocidade em `rpmFor`.
- Carros com largura própria. Carro estreito consegue passar entre dois carros lado a lado; carro largo não.
- Descida empurra e permite passar da velocidade máxima. Subida cobra. Freio motor pelo limite da marcha.

## Trânsito
Três papéis, em `traffic/`:
- **civilian**: anda na pista, troca de faixa, pode ser mais agressivo (motos).
- **police**: perseguição. Respeita o trânsito. Velocidade máxima (`TOP = 215`) abaixo da dos carros mais rápidos, de propósito. Ao alcançar o jogador, o contato inicia a perseguição. Escapar: manter distância por 3 s (despiste). Viaturas aparecem no retrovisor, nas setas de ameaça e no minimapa.
- **oncoming**: tráfego em contramão (mão dupla / contramão).

## Eventos e zonas
- **Zonas** (`Zone`): `bridge`, `viaduct`, `wrongway`, `blitz`, `speedtrap`.
- **Obstáculos** (`Obstacle`): cone (perdoável) ou barreira (letal). Colisão com varredura, para não atravessar obstáculo em alta velocidade.
- **Placas** (`RoadSign`): limite 90, limite 60, contramão.
- **Blitz**: duas vias bloqueadas, carros parados e viaturas, limite de 60 km/h. Passar acima do limite ou furar o bloqueio inicia perseguição.
- **Radar 90**: tocaia no acostamento. Acima de 96 km/h, perseguição.
- Perseguições têm no máximo 2 min e só começam depois do nível 3 de trânsito.

## Pontuação
Combo de *near-miss* (passar perto de carros), nitro, pickups (escudo com 2 s de imunidade após uso) e pontos por distância.

## Persistência e rede
| Dado | Onde | Endpoint / tabela |
|---|---|---|
| Garagem e customização (pintura, faixa, neon), ranking local | `localStorage` (`data.ts` → `storage.ts` após a Fase 3) | — |
| Ranking global | API | `GET /api/autodash/leaderboard`, `POST /api/autodash/score`. Tabela `autodash_scores` |
| Duelo | API | `POST /api/autodash/room`, `POST .../room/:code/join`, `GET .../room/:code`, `POST .../room/:code/state`, `POST .../room/:code/rematch`. Tabela `autodash_rooms` |
| Corrida | API | `POST /api/autodash/race`, `POST .../race/:code/join`, `GET .../race/:code`, `POST .../race/:code/start`, `POST .../race/:code/state`. Tabelas `autodash_race_rooms`, `autodash_race_players` |

Rede por polling (~1 s). Rival remoto é extrapolado entre um poll e outro (dead reckoning). Ver ADR 0009.

## Controles
- **Teclado:** W/↑ acelera, S/↓ freia, A/D ou ←/→ viram.
- **Mouse:** botão esquerdo acelera, direito freia, volante opcional.
- **Toque:** controles na tela (`buildTouchControls`).
- Marcha: scroll do mouse e teclas de câmbio (**verificar** mapeamento exato).
- Menus são clicáveis por mouse (regiões `uiRegions` e `pill`).

## Áudio
Sintetizado com WebAudio em `audio.ts`. Sem arquivos de som. Mute no menu.

## Debug (temporário)
Teclas de atalho para testar perseguição, blitz, pontes e obstáculos (`O`, `L`, `B`, `V`, `J`, `K`, `I`, `U`, segundo a memória de desenvolvimento). **Devem sair ou ficar atrás de `import.meta.env.DEV`** (plano, Fase 3, item 34).

## Testes
- `npm test` em `web-garagem/` (vitest).
- `math.test.ts`: `mulberry32` (reprodutível), cores e `clamp`.
- `engine.golden.test.ts` e `scenarios.golden.test.ts`: replay determinístico com canvas e relógio falsos. Partida solo, corrida com bots, corrida por clique e lobby do duelo. Compara um hash de tudo que o engine desenha. Os snapshots são do código original, antes da divisão em módulos. Mudança de comportamento intencional exige atualizar o snapshot de propósito.
- O golden não cobre a rede (duelo online e corrida online). Isso é verificação manual.

## Roadmap
- Validar perseguição e blitz no navegador com o usuário.
- Remover ou proteger as teclas de debug.
- Integrar carros do jogo com os veículos reais do usuário (`CARS` em `data.ts`).
- Port para Roblox: [spec separada](../autodash-roblox/autodash-roblox-spec.md).
