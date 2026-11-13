# AutoDash Roblox — Spec Driven Development

> **Status:** rascunho para implementação futura · **Fonte:** protótipo web (`web-garagem/src/game/autodash/*`, mergeado em `master` via [PR #24](https://github.com/guiPinheiroAfK/Autohub/pull/24))
> **Objetivo:** portar o *game feel* já validado (câmbio sequencial, curva de RPM, powerups, combo, largada) para uma engine 3D real (Roblox/Luau), com multiplayer nativo em vez do polling que usamos na web.
> **Como usar este documento:** cada SPEC-XX é autocontida (objetivo → requisitos → algoritmo → payloads → critérios de aceite → testes). Dá pra entregar uma SPEC de cada vez pra implementação sem reler o documento inteiro. Os valores numéricos do Apêndice A são a "bíblia de física" — não são sugestão, são o que já foi jogado e validado no web.

---

## 0. Índice

1. Visão e pilares de design
2. Glossário
3. Web → Roblox: o que muda e o que não muda
4. Arquitetura de pastas
5. Contrato de Remotes (Events/Functions)
6. Modelos de dados (Luau types)
7. SPEC-01 · Veículo — câmbio sequencial + RPM
8. SPEC-02 · Powerups
9. SPEC-03 · Sistema de combo
10. SPEC-04 · Corrida multiplayer (N jogadores)
11. SPEC-05 · Pista (Circuito 1)
12. SPEC-06 · HUD
13. SPEC-07 · Câmera
14. SPEC-08 · Anti-cheat e validação server-side
15. SPEC-09 · Persistência (DataStore)
16. SPEC-10 · Garagem e customização
17. Requisitos não-funcionais (performance, escala)
18. Roadmap de implementação (granular, por marco testável)
19. Checklist de QA consolidado
20. Perguntas em aberto (com recomendação)
21. Apêndice A — Bíblia de física (valores portados do web)
22. Apêndice B — Tabelas de configuração prontas (Luau)
23. Apêndice C — Payloads de Remote prontos (Luau types)

---

## 1. Visão e pilares de design

AutoDash Roblox é a mesma promessa do protótipo web — **corrida arcade, câmbio manual que importa, trânsito/pista que pune quem exagera, powerups que recompensam risco** — só que rodando em engine 3D real, com física de verdade e multiplayer que não depende de gambiarra de rede.

**Pilares (em ordem de prioridade, não sacrificar um pilar por outro):**

1. **O câmbio é o coração do jogo.** RPM, redline, limitador e a curva de torque por marcha são a diferença entre "carro anda" e "carro dirige". Isso é a primeira coisa a validar na nova engine (SPEC-01) — se não sentir igual ao web, nada mais importa.
2. **Servidor é a fonte da verdade.** Toda decisão que afeta o resultado da corrida (troca de marcha válida, powerup pego, combo, posição) é calculada e validada no servidor. Cliente só *sugere* intenção e *exibe* o que o servidor confirmou.
3. **Multiplayer é nativo, não emulado.** No web tivemos que inventar salas por código + polling porque a API roda em serverless sem WebSocket. No Roblox, RemoteEvents resolvem isso de graça — a SPEC-04 já nasce pensando em N jogadores, não em duelo 1v1 como gambiarra.
4. **Testável em fatias.** Cada SPEC tem que rodar sozinha antes da próxima ser somada (ver Roadmap, seção 18). Nunca construir tudo junto pra só descobrir se funciona no final.

---

## 2. Glossário

| Termo | Significado |
|---|---|
| **Gear feel** | A sensação de trocar de marcha na hora certa (potência plena) vs errada (engasgo/corte de torque) |
| **Redline** | RPM a partir do qual a potência começa a cair (zona vermelha do conta-giros) |
| **Limiter** | RPM máximo absoluto — acelerador não passa disso, corta potência a zero |
| **Launch control** | Mecânica de largada: segurar RPM numa faixa ideal no semáforo dá um boost de saída |
| **Combo** | Sequência de "quase bateu" (near-miss) ou ações que multiplicam pontuação, com janela de tempo pra não zerar |
| **Fonte da verdade (authoritative)** | O lado (sempre o servidor) cujo cálculo vale — cliente que discordar é ignorado/corrigido |
| **Remote** | RemoteEvent (fire-and-forget) ou RemoteFunction (pergunta/resposta), o canal de comunicação cliente↔servidor no Roblox |
| **Checkpoint** | Marco de progresso na pista — define quem está "na frente" sem precisar cortar caminho |
| **Rabeio** | Evento visual de subida de nível (a cada 10k pontos no web): fumaça + trânsito mais denso |

---

## 3. Web → Roblox: o que muda e o que não muda

| Sistema | Web (pseudo-3D Canvas) | Roblox (3D real) | O que aproveitar |
|---|---|---|---|
| Renderização de pista | Segmentos projetados manualmente (`SEG_LEN`, curve/y por segmento) | Parts/MeshParts reais no Workspace, ou terreno + track pieces | A **matemática da curva** (como a curva acumula e afeta a física) vira input pro Part de checkpoint, não pro desenho |
| Física do carro | Simulada a mão (`speed`, `steerVel`, centrífuga calculada por fórmula) | `VehicleSeat`/`AlignPosition`/`BodyVelocity` ou motor de veículo custom com `RaycastVehicle`-like | Reaproveitar as **curvas de resposta** (torque por RPM, grip por carro) como multiplicadores em cima da física real |
| Câmbio/RPM | `RPM_IDLE`, `GEAR_RATIOS[]`, `powerCurve(rpm)` — funções puras | Mesmas fórmulas, rodando no servidor a cada `Heartbeat`/`RunService.Stepped` | **100% portável** — é matemática, não depende de canvas. Ver Apêndice A |
| Trânsito/pista dinâmica | Segmentos infinitos gerados por seed | Circuito fixo desenhado no Studio (SPEC-05) — decisão de escopo pro protótipo 1 | A regra de "retão ocasional a cada N segmentos" pode inspirar o traçado do circuito fixo |
| Powerups | Sprites 2D com pickup por distância | Parts com `Touched`/proximity + validação server | Os **3 tipos e seus efeitos numéricos** (Apêndice A) são idênticos |
| Combo | Client calcula, sem validação (web não tinha adversário competindo por pontos reais) | **Precisa** ser server-authoritative agora (multiplayer = motivo pra trapacear) | A janela de tempo e a curva de multiplicador (1x→8x) se mantêm |
| Duelo 1v1 online | Salas por código + polling ~1s + RNG determinístico compartilhado (seed) | Vira **SPEC-04**: corrida com N jogadores usando o sistema nativo de matchmaking/teleport do Roblox ou um lobby simples | A ideia de "seed compartilhada = mesma pista pros dois" não é mais necessária — todos already estão no mesmo Workspace |
| Leaderboard global | Postgres via API Hono própria | `DataStoreService` + `OrderedDataStore` (nativo do Roblox) | Estrutura de "1 entrada por jogador, melhor tempo" se mantém (dedupe que já implementamos na query SQL) |
| Customização (pintura/rodas/aerofólio) | Canvas redesenhado por carro | `Color3`/`SurfaceAppearance` trocados em runtime, ou modelos intercambiáveis | Mesmas categorias: pintura, rodas, aerofólio, neon — ver SPEC-10 |

---

## 4. Arquitetura de pastas

```
AutoDash (Place)
│
├── ServerScriptService
│   └── Server
│       ├── Core
│       │   ├── GameManager.lua              -- boot do jogo, orquestra os outros managers
│       │   ├── RaceManager.lua               -- ciclo: lobby → countdown → corrida → resultado
│       │   └── PlayerSessionManager.lua      -- estado por jogador durante a sessão (não persistente)
│       │
│       ├── Vehicle
│       │   ├── VehicleController.server.lua  -- física autoritativa, valida input do client
│       │   ├── GearboxService.lua            -- SPEC-01: valida troca de marcha
│       │   ├── RPMService.lua                -- SPEC-01: calcula RPM/torque por frame
│       │   └── LaunchControlService.lua      -- SPEC-01: mecânica de largada
│       │
│       ├── Powerups
│       │   ├── PowerupSpawner.lua            -- SPEC-02: spawn/respawn nos pontos da pista
│       │   └── PowerupEffects.lua            -- SPEC-02: aplica efeito, fonte de verdade
│       │
│       ├── Combo
│       │   └── ComboService.lua              -- SPEC-03: valida e autoriza combo por jogador
│       │
│       ├── Ranking
│       │   ├── LeaderboardService.lua        -- SPEC-04: ranking ao vivo da corrida atual
│       │   └── PersistentRankingService.lua  -- SPEC-09: best times entre sessões (DataStore)
│       │
│       ├── Anticheat
│       │   └── ValidationService.lua         -- SPEC-08: sanity checks centralizados
│       │
│       └── Track                             -- pasta nova (2026-07-13, não prevista aqui originalmente)
│           └── TrackBuilder.server.lua       -- SPEC-05: constrói Track_Circuit01 por código — ver nota de escopo no roadmap
│
├── ReplicatedStorage
│   └── Shared
│       ├── Modules                            -- "números validados" — client E server importam daqui
│       │   ├── VehicleConfig.lua              -- Apêndice B.1
│       │   ├── PowerupConfig.lua              -- Apêndice B.2
│       │   ├── ComboConfig.lua                -- Apêndice B.3
│       │   ├── TrackConfig.lua                -- Apêndice B.4
│       │   └── CustomizationConfig.lua        -- Apêndice B.5
│       │
│       ├── Types                              -- definições de tipo compartilhadas (SPEC-06)
│       │   └── AutoDashTypes.lua
│       │
│       └── Remotes
│           ├── Events                         -- RemoteEvent (fire-and-forget) — ver seção 5
│           │   ├── RE_GearShift
│           │   ├── RE_ThrottleInput
│           │   ├── RE_PowerupPickupRequest
│           │   ├── RE_PowerupApplied
│           │   ├── RE_ComboUpdate
│           │   ├── RE_RaceStateChanged
│           │   ├── RE_RaceCountdown
│           │   ├── RE_CheckpointCrossed
│           │   ├── RE_LeaderboardUpdate
│           │   └── RE_LevelUp
│           └── Functions                      -- RemoteFunction (pergunta/resposta)
│               ├── RF_GetPlayerStats
│               ├── RF_GetPersistentBestTimes
│               └── RF_SaveCustomization
│
├── StarterPlayer
│   └── StarterPlayerScripts
│       └── Client
│           ├── Input
│           │   └── InputController.client.lua      -- captura input, envia intenção (nunca decide)
│           ├── Camera
│           │   └── RaceCameraController.client.lua  -- SPEC-07
│           ├── Vehicle
│           │   └── VehiclePredictionController.lua  -- client-side prediction (ver SPEC-08 §3)
│           └── HUD
│               ├── HUDController.client.lua         -- SPEC-06
│               ├── RPMGaugeUI.lua
│               ├── GearIndicatorUI.lua
│               ├── ComboMeterUI.lua
│               ├── SpeedometerUI.lua
│               ├── PowerupBarUI.lua
│               └── MiniLeaderboardUI.lua
│
├── StarterGui
│   └── RaceHUD (ScreenGui)
│       ├── RPMGauge (Frame + análogo/digital — ver wireframe SPEC-06)
│       ├── GearIndicator
│       ├── ComboMeter
│       ├── SpeedText
│       ├── PowerupBar
│       └── MiniLeaderboard
│
├── ServerStorage
│   └── PlayerVehicleModels                    -- 1 Model por carroceria (ver SPEC-10), não fica no client até spawn
│
└── Workspace
    └── Track_Circuit01 (Model)                -- SPEC-05
        ├── Checkpoints (Folder)               -- Parts ordenadas 1..N, atributo `Order:number`
        ├── PowerupSpawns (Folder)             -- Parts nomeadas `Nitro_01`, `Shield_01`, `X2_01`...
        ├── SpawnPoints (Folder)                -- Parts para grid de largada, atributo `GridSlot:number`
        └── TrackMesh (Model)                   -- geometria visual/colisão da pista
```

**Regra de ouro:** tudo que decide o resultado mora no `Server`. O `Client` só manda intenção (`RE_GearShift: "up"`) e recebe confirmação (`RE_ComboUpdate: {value = 4}`). Ver SPEC-08 para os detalhes de validação.

---

## 5. Contrato de Remotes (Events/Functions)

Tabela completa — toda comunicação cliente↔servidor do jogo passa por aqui. Nenhum remote novo deve ser criado fora desta tabela sem atualizar este documento primeiro.

| Nome | Tipo | Direção | Frequência | Payload (ver Apêndice C) | Validação server obrigatória |
|---|---|---|---|---|---|
| `RE_GearShift` | RemoteEvent | Client → Server | Sob demanda (input do jogador) | `{ direction: "up" \| "down" }` | Cooldown de troca, marcha atual válida, não em countdown antes do verde |
| `RE_ThrottleInput` | RemoteEvent | Client → Server | Alta freq. (a cada input change, throttled a ~20Hz) | `{ throttle: number (0-1), brake: number (0-1), steer: number (-1..1) }` | Clamp de range, rate-limit de chamadas |
| `RE_PowerupPickupRequest` | RemoteEvent | Client → Server | Sob demanda (colisão detectada no client) | `{ powerupId: string }` | Powerup existe, não foi pego por outro jogador antes, distância plausível (anti-teleport) |
| `RE_PowerupApplied` | RemoteEvent | Server → Client (broadcast pra todos na corrida) | Sob confirmação | `{ playerId, powerupType, duration, expiresAt }` | — (já veio validado) |
| `RE_ComboUpdate` | RemoteEvent | Server → Client (individual) | Sob mudança | `{ combo: number, multiplier: number, windowExpiresAt: number }` | — |
| `RE_RaceStateChanged` | RemoteEvent | Server → Client (broadcast) | Em cada transição de estado | `{ state: "Lobby" \| "Countdown" \| "Racing" \| "Finished", data: table? }` | — |
| `RE_RaceCountdown` | RemoteEvent | Server → Client (broadcast) | 1x por tick de countdown | `{ secondsRemaining: number, rpmWindow: {min, max}? }` | — |
| `RE_CheckpointCrossed` | RemoteEvent | Client → Server → (broadcast pro leaderboard) | Sob trigger físico | `{ checkpointOrder: number, timestamp: number }` | Ordem sequencial (não pode pular), jogador está na corrida ativa |
| `RE_LeaderboardUpdate` | RemoteEvent | Server → Client (broadcast) | ~1x/seg durante corrida | `{ standings: {playerId, position, progress, lastCheckpoint}[] }` | — |
| `RE_LevelUp` | RemoteEvent | Server → Client (broadcast) | Ao cruzar 10k pontos | `{ playerId, newLevel: number }` | — |
| `RF_GetPlayerStats` | RemoteFunction | Client → Server | Sob demanda (abrir menu) | requisição: `{}` · resposta: `PlayerStats` (Apêndice C) | — |
| `RF_GetPersistentBestTimes` | RemoteFunction | Client → Server | Sob demanda (tela de resultado/leaderboard) | requisição: `{ trackId: string }` · resposta: `BestTimeEntry[]` (top 10, 1 por jogador) | — |
| `RF_SaveCustomization` | RemoteFunction | Client → Server | Sob demanda (garagem) | requisição: `CustomizationChoice` · resposta: `{ success: boolean, error: string? }` | Valores dentro dos índices válidos de `CustomizationConfig` |

**Nota de performance:** `RE_ThrottleInput` é o único remote de alta frequência. Ele deve ser throttled no client (não enviar mais que ~20x/seg mesmo que o input mude a cada frame) e o servidor deve descartar pacotes fora de ordem (usar timestamp incremental no payload).

---

## 6. Modelos de dados (Luau types)

Ver Apêndice C para os tipos completos. Os principais, resumidos:

- **`VehicleSpec`** — specs de uma carroceria (potência, grip, topSpeed, largura, shiftMs) — 1 por carro, 4 no protótipo (GT, Muscle, Ninja, Ghost)
- **`PlayerRaceState`** — estado runtime de um jogador numa corrida (marcha, RPM, combo, powerups ativos, checkpoint atual)
- **`PowerupInstance`** — um powerup spawnado no mundo (id, tipo, posição, disponível/pego)
- **`CustomizationChoice`** — escolhas salvas de um jogador (pintura, faixa, neon, roda, aerofólio, por carro)
- **`BestTimeEntry`** — 1 linha do leaderboard persistente (playerId, nome, tempo, data)

---

## 7. SPEC-01 · Veículo — câmbio sequencial + RPM

**Objetivo:** reproduzir, com a mesma sensação, a curva de câmbio e resposta de RPM já validada no protótipo web (Apêndice A.1-A.3).

### Requisitos funcionais

- Input de troca de marcha (`up`/`down`) via `InputController.client.lua`, enviado como intenção (`RE_GearShift`) — o client nunca troca a marcha localmente sem confirmação.
- `GearboxService.lua` no servidor:
  - Marcha vai de **0 (neutro) a 6**.
  - Troca só é aceita se `now - lastShiftTime >= shiftMs` da carroceria atual (Apêndice A.2 — varia de 180ms a 300ms por carro).
  - Não pode subir acima da 6ª nem descer abaixo do neutro.
  - Reduzir com RPM que estouraria o limitador na marcha de destino é **rejeitada** (mesma regra do web: protege o motor).
- `RPMService.lua` calcula, a cada `Heartbeat`, para cada jogador em corrida:
  - `rpm = RPM_IDLE + speed_kmh * gearRatio[gear] * RPM_PER_KMH` (marcha ≥ 1)
  - Em neutro, RPM sobe/desce suavemente em direção a `RPM_IDLE + throttle * (7500 - RPM_IDLE)` (efeito "acelerando parado")
  - Fator de torque aplicado à aceleração vem de `powerCurve(rpm)` — ver Apêndice A.3 (curva por faixas: baixo giro fraco, meio giro rampa, giro alto pleno, acima de 7000 cai até o limiter)
- Câmbio automático (modo alternativo, configurável por jogador): sobe sozinho se `throttle && rpm > 6900 && gear < 6`; desce se `rpm < 2000 && gear > 1`.
- Launch control no countdown de largada (ver SPEC-04 para o ciclo completo):
  - Girar entre **3600–6300 RPM** no instante do verde → largada perfeita (`speed = 52 km/h` instantâneo + bônus de nitro)
  - Girar acima de **6800 RPM** → patinada (`speed = 18`, penalidade temporária de tração)
  - Girar abaixo de **2200 RPM** → engasgo (`speed = 10`, penalidade maior)
  - Fora dessas faixas → largada neutra (`speed = 32`)

### Algoritmo (pseudocódigo)

```
-- roda no servidor, por jogador, a cada RunService.Heartbeat
function UpdateVehiclePhysics(player, dt)
    local state = PlayerRaceState[player]
    local spec = VehicleConfig[state.vehicleId]

    -- 1. RPM
    if state.gear >= 1 then
        state.rpm = RPM_IDLE + state.speedKmh * GEAR_RATIOS[state.gear] * RPM_PER_KMH
    else
        local targetRpm = RPM_IDLE + state.throttle * (7500 - RPM_IDLE)
        state.rpm = Lerp(state.rpm, targetRpm, clamp(dt * 5, 0, 1))
    end

    -- 2. torque disponível
    local powerFactor = PowerCurve(state.rpm)  -- ver Apêndice A.3
    local gearFactor = (GEAR_RATIOS[state.gear] / GEAR_RATIOS[1]) ^ 0.9

    local accel = 0
    if state.gear >= 1 and state.throttle > 0 and (now - state.lastShiftTime) > spec.shiftMs / 1000 then -- shiftMs é ms, now/dt são segundos
        accel = spec.power * powerFactor * gearFactor
        if state.rpm >= RPM_LIMITER - 50 then accel = 0 end  -- corte na limitadora
    end

    -- 3. integra velocidade (aplicar em cima da física real do veículo)
    state.speedKmh += accel * dt
    if state.brake > 0 then state.speedKmh -= brakeDecel(spec) * dt end  -- brakeDecel = BRAKE_DECEL (Apêndice A.1)
    state.speedKmh -= dragDecel(state.speedKmh) * dt  -- dragDecel(kmh) = DRAG_BASE + kmh * DRAG_COEFF (Apêndice A.1)
    state.speedKmh = clamp(state.speedKmh, 0, spec.topSpeed * (state.nitroActive and 1.12 or 1))

    -- 4. limite por marcha (não passa do RPM que a marcha atual permite)
    if state.gear >= 1 then
        local gearTopSpeed = (RPM_LIMITER - RPM_IDLE) / (GEAR_RATIOS[state.gear] * RPM_PER_KMH)
        state.speedKmh = min(state.speedKmh, gearTopSpeed)
    end
end
```

**Correção de unidade (achada na implementação do Marco 2):** o pseudocódigo original comparava `now - state.lastShiftTime` (segundos) direto com `spec.shiftMs` (milissegundos) — o gate de cooldown nunca destravaria certo. `GearboxService.TryShift` e `VehicleController` já implementam com `spec.shiftMs / 1000`.

### Payloads relevantes

- `RE_GearShift` (C→S): `{ direction: "up" | "down" }`
- `RE_ThrottleInput` (C→S): `{ throttle: number, brake: number, steer: number, seq: number }` — `seq` incremental pra servidor descartar pacotes fora de ordem
- Estado de RPM/marcha é replicado via `Attributes` no `Character`/veículo (mais barato que remote a cada frame) ou via `RE_RaceStateChanged` throttled

### Critérios de aceite

- [ ] Trocar marcha fora da janela ótima gera perda de torque perceptível (igual ao web).
- [ ] RPM sobe/desce com a mesma curva de resposta do protótipo original (validar lado a lado: mesmo throttle contínuo, tempo até redline deve bater em ±10%).
- [ ] Latência entre input de troca e feedback visual no HUD < 100ms.
- [ ] Reduzir marcha com RPM de destino acima do limiter é rejeitado silenciosamente (sem erro visível, só não troca).
- [ ] Launch control produz as 4 saídas esperadas (perfeita/patinada/engasgo/neutra) nas faixas de RPM corretas.
- [ ] Câmbio automático nunca deixa o RPM passar do redline por mais de 1 frame.

### Testes

1. **Unit (config):** validar que `PowerCurve(rpm)` retorna os valores esperados nos pontos de quebra (1400, 4500, 7000, 7600, 7900).
2. **Integração (servidor sozinho, sem client):** simular jogador com throttle=1 constante por 10s, marcha manual subindo no ponto ótimo — comparar curva de velocidade x tempo com o log do protótipo web.
3. **Manual (playtest):** 1 jogador, checar "sensação" nas 4 carrocerias — cada uma deve se sentir visivelmente diferente (Muscle pesada/torque, Ninja ágil, etc.)

---

## 8. SPEC-02 · Powerups

**Objetivo:** pickups na pista que aplicam efeito temporário — os mesmos 3 tipos do web (Apêndice A.4).

### Requisitos funcionais

- `PowerupSpawner.lua` spawna/respawna powerups nos pontos definidos em `Workspace/Track_Circuit01/PowerupSpawns`.
- Tipos (ver Apêndice A.4 para valores exatos):
  - **Nitro (azul):** ao coletar, enche o medidor de nitro em +40 (de um máximo de 100). Ativar consome o medidor a ~38/seg enquanto segurado, dá +42 de aceleração extra e permite ultrapassar o `topSpeed` em até 12%.
  - **Escudo (azul-claro):** absorve **uma** colisão (com trânsito, obstáculo ou — em multiplayer — talvez com outro jogador, decisão de design em aberto, ver seção 20). Visual: aura ao redor do carro.
  - **2x (amarelo):** dobra o multiplicador de pontuação por 8 segundos. Empilha com o multiplicador de combo (multiplicativo, não aditivo).
- Colisão com o powerup é detectada no **client** (performance — não vale a pena rodar detecção fina no servidor pra todo mundo), mas a aplicação do efeito **só é confirmada pelo servidor** via `RE_PowerupPickupRequest` → validação → `RE_PowerupApplied`.
- Servidor rejeita pickup:
  - Se o powerup já foi marcado como "pego" por outro jogador no mesmo tick (lock otimista: primeiro request que chega vence, os outros recebem rejeição silenciosa).
  - Se a posição do jogador no momento do request está implausivelmente longe do powerup (anti-teleport/anti-speedhack — margem de tolerância configurável, ex: 15 studs).
- Respawn: cada tipo tem um tempo de respawn configurável (Apêndice A.4) após ser coletado.

### Algoritmo (pseudocódigo)

```
-- Client: detecção de proximidade (roda em RunService.RenderStepped, throttled)
function CheckPowerupProximity()
    for _, powerup in ipairs(VisiblePowerups) do
        if powerup.available and Distance(LocalCar.Position, powerup.Position) < PICKUP_RADIUS then
            RE_PowerupPickupRequest:FireServer(powerup.id)
            powerup.available = false -- otimista, servidor pode reverter
        end
    end
end

-- Server: validação
function OnPowerupPickupRequest(player, powerupId)
    local powerup = ActivePowerups[powerupId]
    if not powerup or not powerup.available then return end -- já foi pego

    local playerPos = GetServerAuthoritativePosition(player)
    if Distance(playerPos, powerup.position) > PICKUP_TOLERANCE then
        return -- rejeitado, posição implausível
    end

    powerup.available = false
    ApplyPowerupEffect(player, powerup.type)
    RE_PowerupApplied:FireAllClients({
        playerId = player.UserId,
        powerupType = powerup.type,
        duration = PowerupConfig[powerup.type].duration,
        expiresAt = os.time() + PowerupConfig[powerup.type].duration,
    })

    task.delay(PowerupConfig[powerup.type].respawnSeconds, function()
        powerup.available = true
        -- opcional: RE broadcast de "powerup voltou" pro client reativar o visual
    end)
end
```

### Critérios de aceite

- [ ] Powerup só desaparece pra todo mundo depois da confirmação do servidor (nunca "some" no client de quem pegou antes de confirmar, se der rejeitado ele volta a aparecer).
- [ ] Dois jogadores tentando pegar o mesmo powerup no mesmo frame: só um recebe o efeito, o outro não trava nem gera erro.
- [ ] Efeito (duração/intensidade) idêntico ao `PowerupConfig` — sem drift entre o que o client mostra e o que o server aplicou.
- [ ] Respawn ocorre no tempo configurado, visível pra todos os jogadores da corrida.
- [ ] Pickup rejeitado por distância implausível não quebra a UI do client (reverte o estado otimista sem soluço visual).

### Testes

1. **Concorrência:** 2+ jogadores de teste (ou bots) convergindo pro mesmo powerup — validar que só 1 recebe o efeito.
2. **Anti-cheat:** simular um client que manda `RE_PowerupPickupRequest` de um powerup que está a 500 studs de distância — deve ser rejeitado e logado.
3. **Visual:** confirmar que o respawn é sincronizado (não pode um jogador ver o powerup e outro não, fora da janela normal de replicação).

---

## 9. SPEC-03 · Sistema de combo

**Objetivo:** manter a recompensa por sequência de near-misses que já funciona no web — mas agora **server-authoritative**, porque em multiplayer existe motivo real pra tentar trapacear.

### Requisitos funcionais

- `ComboService.lua` no servidor mantém a contagem real de combo por jogador — client nunca calcula, só exibe o que recebe via `RE_ComboUpdate`.
- Gatilho de combo: near-miss (passar raspando por um obstáculo/veículo de trânsito sem colidir, acima de uma velocidade relativa mínima) — mesma lógica conceitual do web, adaptada pra detecção de colisão real do Roblox (ver nota abaixo).
- Combo vai de 0 a 7 (multiplicador efetivo de 1x a 8x — `multiplier = 1 + combo`).
- Cada near-miss válido:
  - Incrementa o combo em 1 (até o teto de 7).
  - Reseta a janela de tempo pra **4 segundos**.
  - Concede pontos: `200 * multiplier` (multiplicado também por 2x se o powerup estiver ativo).
- Se a janela de 4s expira sem novo near-miss, combo zera para 0.
- Sair da pista (offroad) ou colidir zera o combo instantaneamente.

> **Nota de adaptação:** no web, "near-miss" era geometricamente simples (objeto 2D passando pela lateral do carro numa pista de 4 faixas fixas). No Roblox 3D, isso precisa de uma detecção equivalente — ex: raycast lateral checando "objeto dentro de X studs sem ter havido `Touched`" durante uma janela curta, ou zonas de trigger ao redor de obstáculos/carros de NPC. **Este é um ponto que precisa de prototipagem própria antes da implementação final** — a regra de negócio (o que conta como near-miss e a pontuação) é a que está especificada aqui; a detecção geométrica exata é decisão de implementação.

### Algoritmo (pseudocódigo)

```
function OnNearMissDetected(player, obstacleId, relativeSpeed)
    local state = PlayerRaceState[player]
    if relativeSpeed < MIN_SPEED_FOR_COMBO then return end -- muito devagar não conta

    state.combo = math.min(7, state.combo + 1)
    state.comboWindowExpiresAt = os.clock() + COMBO_WINDOW_SECONDS -- 4s

    local multiplier = (1 + state.combo) * (state.x2Active and 2 or 1)
    local points = 200 * multiplier
    state.score += points

    RE_ComboUpdate:FireClient(player, {
        combo = state.combo,
        multiplier = multiplier,
        windowExpiresAt = state.comboWindowExpiresAt,
    })
end

-- roda a cada Heartbeat, por jogador em corrida
function UpdateComboDecay(player, dt)
    local state = PlayerRaceState[player]
    if state.combo > 0 and os.clock() >= state.comboWindowExpiresAt then
        state.combo = 0
        RE_ComboUpdate:FireClient(player, { combo = 0, multiplier = 1, windowExpiresAt = 0 })
    end
end

function OnPlayerCrashOrOffroad(player)
    local state = PlayerRaceState[player]
    state.combo = 0
    RE_ComboUpdate:FireClient(player, { combo = 0, multiplier = 1, windowExpiresAt = 0 })
end
```

### Critérios de aceite

- [ ] Combo zera automaticamente se o intervalo entre near-misses passar de 4s (validado por timer no servidor, não no client).
- [ ] Combo não pode ser manipulado client-side — um client modificado que finja near-misses infinitos deve ser detectado (rate-limit: no máximo 1 combo válido por N ms, configurável, pra impedir spam).
- [ ] Multiplicador de combo afeta a pontuação final da corrida exibida no resultado.
- [ ] Colisão ou saída de pista zera o combo imediatamente, refletido no HUD em < 1 frame de rede.

### Testes

1. **Timer:** validar que o combo zera exatamente após 4s sem nova ação (não antes, não muito depois).
2. **Rate-limit:** simular client tentando disparar near-miss 100x/segundo — servidor deve limitar e não deixar o combo/pontuação explodir.
3. **Integração com SPEC-02:** validar que 2x + combo alto multiplicam corretamente (multiplicativo: `combo_mult * 2`, não `combo_mult + 2`).

---

## 10. SPEC-04 · Corrida multiplayer (N jogadores)

**Objetivo:** substituir o modelo de duelo 1v1-por-código do web por corrida nativa com N jogadores e ranking ao vivo — aproveitando que o Roblox resolve rede de graça.

### Requisitos funcionais

- `RaceManager.lua` controla o ciclo de estados: **Lobby → Countdown → Racing → Finished**, replicado via `RE_RaceStateChanged`.
  - **Lobby:** aguardando jogadores. Corrida inicia quando atingir `MIN_PLAYERS` (configurável, sugestão inicial: 2) **ou** o timeout de lobby expirar (sugestão: 30s) com pelo menos 1 jogador.
  - **Countdown:** semáforo de largada, mesma mecânica do web (3 luzes vermelhas + verde), com a janela de launch control (SPEC-01). Duração fixa (~3.3s, igual ao valor usado no duelo web) pra todos os jogadores começarem exatamente juntos.
  - **Racing:** corrida ativa, checkpoints e leaderboard ao vivo.
  - **Finished:** todos cruzaram a linha de chegada, ou timeout de corrida expirou (configurável, ex: 5 minutos) — quem não terminou é marcado como DNF.
- Checkpoints definem progresso (`Workspace/Track_Circuit01/Checkpoints`, ordenados por atributo `Order`). Cruzar fora de ordem é ignorado (não dá pra pular etapa cortando caminho).
- `LeaderboardService.lua` atualiza a posição de todos em tempo real (`RE_LeaderboardUpdate`, ~1x/seg), calculada por: **último checkpoint cruzado, desempatado por timestamp de quando cruzou**.
- Jogador que desconecta durante a corrida:
  - É marcado como DNF, não trava os demais.
  - Se desconectar antes do fim do countdown, é removido do grid sem afetar a largada dos outros.

### Algoritmo (pseudocódigo)

```
function RaceManager:Run()
    self.state = "Lobby"
    self:BroadcastStateChange()

    self:WaitForPlayers(MIN_PLAYERS, LOBBY_TIMEOUT_SECONDS)

    self.state = "Countdown"
    self:BroadcastStateChange()
    self:RunCountdown(COUNTDOWN_DURATION_SECONDS) -- dispara RE_RaceCountdown a cada tick

    self.state = "Racing"
    self.raceStartedAt = os.clock()
    self:BroadcastStateChange()

    -- loop até todos terminarem ou timeout
    while not self:AllFinishedOrTimedOut() do
        task.wait(RACE_TICK_INTERVAL)
        self:UpdateLeaderboard() -- calcula posições, dispara RE_LeaderboardUpdate
    end

    self.state = "Finished"
    self:BroadcastStateChange()
    self:PersistResults() -- SPEC-09
end

function LeaderboardService:UpdateLeaderboard()
    local standings = {}
    for player, state in pairs(PlayerRaceState) do
        table.insert(standings, {
            playerId = player.UserId,
            lastCheckpoint = state.lastCheckpointOrder,
            checkpointTimestamp = state.lastCheckpointAt,
            finished = state.finished,
            finishTime = state.finishTime,
        })
    end
    table.sort(standings, function(a, b)
        if a.finished ~= b.finished then return a.finished end -- quem terminou vem primeiro
        if a.finished then return a.finishTime < b.finishTime end
        if a.lastCheckpoint ~= b.lastCheckpoint then return a.lastCheckpoint > b.lastCheckpoint end
        return a.checkpointTimestamp < b.checkpointTimestamp -- quem chegou primeiro no mesmo checkpoint
    end)
    RE_LeaderboardUpdate:FireAllClients({ standings = standings })
end
```

### Critérios de aceite

- [ ] Corrida só começa com no mínimo `MIN_PLAYERS` ou após o timeout de lobby (configurável), nunca com 0 jogadores.
- [ ] Todos os jogadores recebem o sinal verde no mesmo instante (tolerância de rede aceitável: < 200ms de diferença percebida).
- [ ] Posição no ranking atualiza ao vivo conforme progresso nos checkpoints, não só na chegada.
- [ ] Cortar caminho (pular um checkpoint) não conta como progresso válido.
- [ ] Jogador que desconecta não trava a corrida dos demais — corrida segue e ele é marcado DNF.
- [ ] Corrida com timeout expira corretamente e ainda gera resultado consistente pra quem não terminou.

### Testes

1. **Ciclo completo:** 1 sessão de teste com 2-4 jogadores (ou bots simulando input) do lobby até o resultado final.
2. **Desconexão:** derrubar 1 jogador no meio da corrida — validar que os demais completam normalmente.
3. **Corte de caminho:** tentar (propositalmente) pular um checkpoint — validar que o progresso não avança.
4. **Timeout:** simular corrida onde 1 jogador nunca termina — validar que o timeout dispara e o resultado final inclui ele como DNF.

---

## 11. SPEC-05 · Pista (Circuito 1 — fixo)

**Objetivo:** primeiro circuito fechado, desenhado à mão no Studio — não procedural como no web. Decisão de escopo (ver seção 20): começar fixo dá controle visual total e é mais fácil de testar/balancear que gerar pista por seed.

### Requisitos funcionais

- Checkpoints como Parts invisíveis (`CanCollide = false`, `Transparency = 1`) sequenciais em `Workspace/Track_Circuit01/Checkpoints`, cada uma com atributo `Order: number` (1, 2, 3...).
- Pontos de spawn de powerup marcados como Parts nomeadas por tipo (`Nitro_01`, `Shield_01`, `X2_01`, ...) em `PowerupSpawns`.
- Pontos de largada (grid) como Parts nomeadas com atributo `GridSlot: number`, em `SpawnPoints` — define onde cada jogador aparece no countdown (evita todo mundo nascer empilhado no mesmo ponto).
- `TrackConfig.lua` referencia os nomes/posições das Parts — **nunca hardcodar posição no código**, sempre ler do Workspace via nome/atributo.
- Geometria de pista (visual + colisão) num `Model` separado (`TrackMesh`) pra poder trocar/iterar sem mexer nos Folders de lógica.
- Inspiração de traçado (do gerador procedural do web, Apêndice A.5): misturar retas longas (pra usar a 6ª marcha e nitro), curvas médias contínuas e pelo menos 1-2 curvas fechadas que exigem frear — não fazer um circuito só de curvas suaves, perde o "medo de ir rápido" que era um pilar do web.

### Critérios de aceite

- [ ] Circuito completável do início ao fim sem colisão quebrada (sem buracos na malha, sem countdown physics bugado nas transições de Part).
- [ ] Checkpoints disparam em ordem — fisicamente não dá pra cortar caminho pela geometria da pista (ou o checkpoint está posicionado de forma que cortar não seja vantajoso).
- [ ] Ao menos 1 trecho de reta longa o suficiente pra alcançar a 6ª marcha em velocidade máxima com um carro médio (ex: GT).
- [ ] Grid de largada comporta o `MIN_PLAYERS`/`MAX_PLAYERS` da SPEC-04 sem sobreposição de spawn.

### Testes

1. **Percurso manual:** completar o circuito inteiro dirigindo manualmente, sem travar em nenhuma geometria.
2. **Checkpoint order:** tentar cruzar checkpoints fora de ordem propositalmente (andar de ré, atravessar por fora) — validar que não conta progresso.
3. **Grid:** spawnar `MAX_PLAYERS` jogadores simultaneamente e verificar que nenhum nasce dentro do outro.

---

## 12. SPEC-06 · HUD

**Objetivo:** interface de corrida que comunica RPM, marcha, velocidade, combo e powerups sem poluir a visão da pista — mesma filosofia visual do web (glassmorphism, conta-giros com zona vermelha).

### Wireframe (referência de layout, canto inferior = HUD principal)

```
┌─────────────────────────────────────────────────────────────┐
│  [Pontos: 12.450]                          [Posição: 2/4]   │  <- topo
│  [Combo: x3 ●●●○○○○]                                         │
│                                                                │
│                         (viewport 3D)                         │
│                                                                │
│  [NOS ▓▓▓▓▓░░░]                    ╭───────────╮             │
│                                     │   RPM      │             │
│                                     │  (análogo)  │  [Marcha]  │
│                                     │  0..8 x1000 │    [3]     │
│                                     ╰───────────╯             │
│                                        [128 km/h]              │
└─────────────────────────────────────────────────────────────┘
```

### Requisitos funcionais

- `RPMGaugeUI.lua`: conta-giros analógico (ou híbrido análogo+digital), zona vermelha a partir do redline, agulha/arco reage em tempo real ao RPM recebido do servidor (via attribute replicado ou remote throttled).
- `GearIndicatorUI.lua`: número da marcha atual (0 = N), destaque visual na troca (flash rápido).
- `ComboMeterUI.lua`: multiplicador atual + indicador visual da janela de tempo restante (ex: barra que esvazia em 4s).
- `SpeedometerUI.lua`: velocidade em km/h, texto direto.
- `PowerupBarUI.lua`: medidor de nitro (0-100) + ícones de powerups ativos com contagem regressiva (escudo, 2x).
- `MiniLeaderboardUI.lua`: posição atual do jogador + 2-3 rivais mais próximos (não a lista inteira, pra não poluir).
- Todo dado do HUD é **somente leitura** — vem do servidor via remote/attribute, o client nunca calcula RPM/combo/posição pra exibir (mesmo que pareça redundante, evita drift visual entre jogadores).

### Critérios de aceite

- [ ] HUD não bloqueia a visão do carro nem da pista à frente (posicionamento nas bordas, como no web).
- [ ] Atualização do conta-giros e velocímetro perceptivelmente fluida (sem stutter — usar `RunService.RenderStepped` pro visual, não esperar remote a cada frame).
- [ ] Combo e powerups refletem exatamente o que o servidor confirmou (testável comparando log do server com o que aparece na tela).

---

## 13. SPEC-07 · Câmera

**Objetivo:** câmera de corrida (chase cam) que mantém a leitura da pista e do carro, inspirada na visão "atrás do carro" do web.

### Requisitos funcionais

- `RaceCameraController.client.lua`: câmera fixa atrás e um pouco acima do veículo, seguindo suavemente (lerp, não teleporte) posição e rotação.
- Leve reação a eventos: aproximação de FOV no nitro (o web tinha um "FOV pump" de +2.5% durante nitro — reaproveitar a ideia), leve inclinação em curvas fortes (efeito "peso" já validado no web como resposta positiva do usuário).
- Câmera não deve atravessar geometria da pista/obstáculos (colisão de câmera padrão do Roblox, ajustada pro contexto de corrida).

### Critérios de aceite

- [ ] Câmera nunca perde o carro de vista mesmo em curvas fechadas ou colisões.
- [ ] Transições (nitro, colisão, respawn) são suaves, sem corte brusco de posição.

---

## 14. SPEC-08 · Anti-cheat e validação server-side

**Objetivo:** consolidar as regras de "o que o servidor nunca confia no cliente" — já mencionadas em cada SPEC, mas centralizadas aqui pra referência rápida de implementação.

### Matriz de validação

| Ação do cliente | O que o cliente manda | O que o servidor valida | Consequência se inválido |
|---|---|---|---|
| Trocar marcha | Direção (up/down) | Cooldown de `shiftMs`, marcha atual dentro do range, RPM de destino não estourar o limiter | Ignorado silenciosamente |
| Acelerar/frear/esterçar | Valores de input (0-1, -1..1) | Range válido, rate-limit de chamadas | Clamp automático, ignora excesso de chamadas |
| Pegar powerup | ID do powerup | Powerup existe e está disponível, posição do jogador é plausível | Rejeitado, estado revertido no client |
| Cruzar checkpoint | Ordem do checkpoint + timestamp | Ordem sequencial (não pula), corrida está no estado "Racing" | Ignorado, não conta progresso |
| Reportar near-miss (combo) | Evento de proximidade | Velocidade relativa mínima, rate-limit (não infinitos combos por segundo) | Ignorado, sem pontos |
| Salvar customização | Índices de pintura/roda/etc | Índices dentro do range válido de `CustomizationConfig` | Rejeitado com erro |

### Requisitos funcionais adicionais

- **Client-side prediction:** pra não sentir input lag, o client pode prever localmente o resultado de acelerar/esterçar (`VehiclePredictionController.lua`), mas a posição final exibida é sempre reconciliada com a autoritativa do servidor (correção suave, não teleporte brusco, exceto discrepância grande — aí sim snap).
- **Rate-limiting genérico:** todo RemoteEvent que aceita input livre do cliente deve ter um limite de chamadas por segundo configurável em `ValidationService.lua`, com log de quem excede repetidamente (sinal de possível cheat/bug de client).
- **Logging:** rejeições de validação devem gerar log server-side (não necessariamente visível ao jogador) pra permitir auditoria depois — especialmente pickups de powerup rejeitados por distância e checkpoints fora de ordem.

### Critérios de aceite

- [ ] Nenhuma ação que afete pontuação, posição na corrida ou progresso pode ser forjada só com um client modificado (validar tentando manualmente via um script de teste que manda payloads inválidos).
- [ ] Rate-limits não afetam jogadores legítimos jogando normalmente (calibrar os limites com folga generosa acima do que um humano real consegue disparar).

---

## 15. SPEC-09 · Persistência (DataStore)

**Objetivo:** salvar progresso entre sessões — best times por circuito e (se decidido, ver seção 20) progressão de customização.

### Requisitos funcionais

- `PersistentRankingService.lua` usa `OrderedDataStore` para o ranking de melhores tempos por circuito (`trackId` como chave de escopo).
- Regra de dedupe (mesma decisão que tomamos no leaderboard web): **1 entrada por jogador, apenas o melhor tempo** — nunca acumular múltiplas corridas do mesmo jogador na mesma tabela.
- `PlayerDataManager` (Core) carrega os dados do jogador no `PlayerAdded` e salva no `PlayerRemoving` + a cada N minutos (autosave) + após eventos críticos (ex: fim de corrida, compra de customização).
- Estrutura de dados por jogador (ver Apêndice C para o type completo): nome do piloto, melhores tempos por circuito, customizações desbloqueadas/equipadas.
- Tratamento de falha do DataStore (Roblox pode ter outage): retry com backoff, e nunca travar o jogador de jogar por causa de falha de save (falha de save é logada, mas o jogador segue jogando normalmente).

### Critérios de aceite

- [ ] Melhor tempo de um jogador só é sobrescrito se o novo tempo for melhor (nunca perde o recorde por engano).
- [ ] Dados sobrevivem a um restart do servidor (testar em ambiente de Studio com "Save" manual e reload).
- [ ] Falha simulada de DataStore não impede o jogador de completar uma corrida normalmente (apenas o save falha, com retry).

---

## 16. SPEC-10 · Garagem e customização

**Objetivo:** portar a customização visual do web (pintura, faixa, neon, roda, aerofólio) pro Roblox.

### Requisitos funcionais

- Categorias (mesmas do web, ver Apêndice B.5): **Pintura** (10 cores), **Faixa** (4 estilos), **Neon** (6 cores incluindo desligado), **Roda** (4 estilos), **Aerofólio** (3 estilos, varia disponibilidade por carroceria).
- Aplicação em runtime: trocar `Color3` de partes específicas do modelo (carroceria, roda) e alternar visibilidade de meshes opcionais (aerofólio, neon).
- 4 carrocerias base (GT, Muscle, Ninja, Ghost — Apêndice A.2), cada uma como um `Model` próprio em `ServerStorage/PlayerVehicleModels`, clonado ao spawnar o jogador com as customizações aplicadas.
- Escolhas salvas via `RF_SaveCustomization` → `PersistentRankingService`/`PlayerDataManager` (SPEC-09).

### Critérios de aceite

- [ ] Trocar customização na garagem reflete visualmente no carro assim que o jogador entra na próxima corrida (não precisa nesta fase ser em tempo real durante a corrida).
- [ ] Customizações persistem entre sessões (via SPEC-09).
- [ ] Aerofólio "sem" é uma opção válida (nem toda carroceria "puxa" pra um aerofólio, como no web onde Ninja/Muscle vinham com ducktail por padrão e GT/Ghost com asa).

---

## 17. Requisitos não-funcionais (performance, escala)

| Requisito | Alvo |
|---|---|
| Jogadores simultâneos por corrida | 2 a 8 no protótipo 1 (configurável via `TrackConfig`/`RaceManager`) |
| Frequência de `RE_ThrottleInput` | ≤ 20 Hz por jogador (client-throttled) |
| Frequência de `RE_LeaderboardUpdate` | ~1 Hz (não precisa ser por frame) |
| Latência percebida input→feedback visual (RPM, marcha) | < 100ms |
| Tempo de carregamento do circuito | < 5s em conexão padrão |
| Física do veículo | Roda no servidor a `Heartbeat` (~60Hz), replicada de forma otimizada (não remote por frame — usar `Attributes`/`NetworkOwnership` quando fizer sentido) |

---

## 18. Roadmap de implementação (granular, por marco testável)

Cada marco deve ser jogável/testável sozinho antes de somar o próximo — não construir tudo junto.

### Marco 1 — Fundação estática
1. Estrutura de pastas completa (seção 4), mesmo que vazia (arquivos placeholder).
2. SPEC-05: circuito 1 desenhado no Studio, sem lógica nenhuma — só andar de carro padrão do Roblox nele.
3. `VehicleConfig.lua`, `TrackConfig.lua` preenchidos com os valores do Apêndice A/B (dados, sem lógica ainda).

### Marco 2 — Câmbio e RPM solo
4. SPEC-01 completa, testável com **1 jogador sozinho**, sem multiplayer, sem powerup, sem combo.
5. SPEC-06 (HUD) parcial: só RPM gauge + gear indicator + speedometer.
6. **Critério de saída do marco:** dirigir sozinho no circuito e a sensação de câmbio "bater" com o protótipo web (comparação lado a lado).

**Decisões de escopo tomadas na implementação (2026-07-13):**
- **Sem modelo de carro/chassi ainda.** O `Character` do jogador é usado como stand-in dirigível (WalkSpeed=0, CFrame movido pelo servidor a cada Heartbeat). Carro real (mesh, `VehicleSeat` ou o que for decidido) entra junto de SPEC-10 (Marco 6) ou antes, se a sensação em 3D pedir ajuste. Isso não afeta a validação de RPM/câmbio, que é o único critério deste marco.
- **Launch control adiado pro Marco 3.** Requisito funcional existe na SPEC-01, mas depende de um countdown de largada (`RE_RaceCountdown`), que só existe na SPEC-04. Implementar sem isso seria simular uma largada falsa — melhor esperar o RaceManager real.
- **Câmbio automático: lógica pronta, sem toggle ainda.** O algoritmo (auto-sobe >6900rpm, auto-desce <2000rpm) está implementado em `RPMService`, mas não há Remote pra alternar manual/automático (a tabela de Remotes da seção 5 não previa isso). Todo mundo começa em manual. Adicionar `RE_SetTransmissionMode` à tabela de Remotes antes de expor o toggle.
- **Steering evoluiu de "yaw puro" pra um modelo de deslizamento simples** (2026-07-13, feedback de playtest: sem peso/derrapagem não parecia carro de verdade). A direção do nariz (yaw) e a velocidade real do carro agora são desacopladas: a velocidade persegue a direção do nariz numa taxa dada pelo `grip` (Apêndice A.3) em vez de ir junto instantaneamente — isso é o que cria derrapagem em curva fechada (Muscle grip 0.55 desliza mais, Ninja grip 0.90 corrige rápido). Ainda não é a centrífuga/`steerVel` do web nem física de pneu de verdade; refinar mais fica pra quando a pista real (SPEC-05) e a câmera (SPEC-07) existirem — mas já usa o `grip` de cada carro pra valer, que antes só afetava a taxa de esterço.

### Marco 3 — Multiplayer básico
7. SPEC-04 completa (lobby/countdown/racing/finished), **sem** powerup/combo ainda.
8. SPEC-08 (validação básica: input clamp, rate-limit).
9. SPEC-06 completo: mini leaderboard.
10. **Critério de saída:** 2+ jogadores completam uma corrida do lobby ao resultado, ranking correto.

**Decisões de escopo tomadas na implementação (2026-07-13):**
- **SPEC-05 construída por código, não à mão no Studio.** A spec original (seção 4, marco 1) previa desenhar a pista no Studio; como não tenho acesso ao Studio (só edito `.lua`, Rojo sincroniza), `TrackBuilder.server.lua` gera o Circuito 1 no boot do servidor: formato "estádio" (2 retas + 2 curvas fechadas) com uma chicane em S numa reta — cobre reta longa / curva fechada / S-curve da Apêndice A.7, mas não é gerador procedural por seed (isso continua vetado pro protótipo 1). Tem guard-rails (paredes) nas duas laterais.
- **"Terminar a corrida" = alcançar o último checkpoint, não completar 1 volta fechada.** O circuito é um loop fechado e o Checkpoint 1 fica na mesma posição da largada; fazer "finish" = cruzar a linha de novo depois da volta completa exigiria lógica extra de contagem de volta. Simplificação válida pro protótipo 1 — multi-volta pode virar um refinamento futuro.
- **`VehicleController` virou ModuleScript** (era `.server.lua`) — o `RaceManager` precisa comandar reset pro grid (`ResetToGrid`), travar câmbio fora do verde (`SetRacingEnabled`) e aplicar a largada (`ApplyLaunchControl`/`GetRPM`), e um Script sozinho não pode ser `require()`ado por outro.
- **Launch control implementado** (`LaunchControlService.lua`), usando as faixas de RPM que já estavam prontas em `TrackConfig.Circuit01.launchControl` desde o Marco 1 (Apêndice B.4) — sem bônus de nitro ainda (isso é SPEC-02/Marco 4).
- **SPEC-08 (anti-cheat) ainda não entrou nesta passada** — o Marco 3 original pedia validação básica (clamp/rate-limit), que em parte já existe desde o Marco 2 (`RE_ThrottleInput` já clampa e descarta `seq` fora de ordem). Uma auditoria dedicada de SPEC-08 fica pendente.
- **Checkpoint com 8 studs de espessura (não 1)** — em alta velocidade o carro desloca ~4 studs por frame; um gate fino demais deixava o `Touched` pular a detecção (tunneling).
- **SPEC-07 (câmera) adiantada do Marco 7 pra esta sessão** — pedido direto do usuário no playtest: sem câmera seguindo o carro, a câmera orbital padrão do Roblox (controlada por mouse, sem relação com o heading do veículo) faz perder o carro de vista toda hora que ele curva. `RaceCameraController.client.lua` implementa o essencial do SPEC-07 (chase cam atrás/acima, suavizada por lerp) — ainda falta o FOV pump de nitro e a inclinação em curva (fazem sentido só depois do nitro/nitro existir de verdade, SPEC-02).
- **Física do veículo deixou de ser kinemática (2026-07-13, feedback: "dá pra recriar a pegada do No Hesi com algoritmo de verdade?").** O carro (`VehicleModelFactory`) virou um corpo físico de verdade — unanchored, soldado (chassi+cabine+rodas via `WeldConstraint`), com fricção propositalmente baixa (`PhysicalProperties`, 0.05) pra não brigar com o grip calculado por script. `VehicleController` aplica **forças reais** nesse corpo (`VectorForce`: motor via F=massa×aceleração da curva de torque existente, freio, arrasto, e uma força de grip lateral proporcional a `spec.grip` que empurra a velocidade real de volta pra direção do nariz — isso é o que gera derrapagem de verdade, emergente do momento físico, não mais um lerp escrito à mão) e guinada via `AlignOrientation` (torque real perseguindo um alvo, não rotação direta).
- **Bug real na primeira versão da física nova: `AlignOrientation.MaxTorque = math.huge` causava o carro "convulsionar"** (relatado pelo usuário: quicando sem parar assim que o carro nascia, mesmo parado/neutro). Torque infinito brigando pra manter o carro nivelado contra a gravidade/normal do chão em terreno não perfeitamente plano gera uma guerra sem fim. Fix: `MaxTorque = chassis.AssemblyMass * 40` (finito, escalado pela massa), `Responsiveness` de 30→20, e margem de queda no spawn aumentada (+2 studs, não +0.2) pra evitar nascer encravado na geometria.
- **Pista procedural (`TrackBuilder.server.lua`) removida** (2026-07-13, pedido direto do usuário) — as duas pistas (a minha + a do template) coexistiam e colidiam uma com a outra, contribuindo pro caos físico. A pista agora vem exclusivamente do template oficial "Racing"/"Classic Racing" do Roblox, montada à mão pelo usuário — só precisa estar num Model `Track_Circuit01` com `Checkpoints`/`SpawnPoints` (contrato inalterado, ver seção 4). O Character do jogador deixou de ser o "corpo" e virou só um seguidor cosmético do chassi (câmera/checkpoint continuam funcionando do mesmo jeito).
- **Marcha ré adicionada (2026-07-13) — desvio consciente do web.** O web era corrida só pra frente (nunca precisou de ré); em mundo 3D real, sem ré, qualquer batida em obstáculo vira beco sem saída — playtest mostrou o carro entalado numa pedra com throttle=1 e velocidade 0, sem saída possível. Comportamento (padrão arcade): segurar S/freio andando pra frente = freio normal; segurar com o carro ~parado (<2 km/h) = empuxo reverso (`REVERSE_ACCEL=25 km/h/s`, teto `REVERSE_TOP_SPEED_KMH=30`). Sem marcha "R" no câmbio — é automático pelo contexto, o HUD não muda.

### Marco 4 — Powerups
11. SPEC-02 completa.
12. SPEC-06: powerup bar.
13. **Critério de saída:** powerups spawnam, são pegos, aplicam efeito, respawnam — testado com 2+ jogadores disputando o mesmo powerup.

### Marco 5 — Combo
14. SPEC-03 completa (depende de 01 e 02 estáveis).
15. SPEC-06: combo meter.
16. **Critério de saída:** combo sobe/zera corretamente, multiplica pontuação junto com powerup 2x.

### Marco 6 — Persistência e garagem
17. SPEC-09 (DataStore de best times).
18. SPEC-10 (garagem/customização básica — pode começar só com pintura, adicionar o resto depois).
19. **Critério de saída:** jogador sai e volta, recorde e customização estão salvos.

### Marco 7 — Polish
20. SPEC-07 (câmera com FOV pump/inclinação).
21. Efeitos visuais (rabeio de level-up, faíscas de near-miss, etc — inspirados no web, escopo aberto).
22. Balanceamento final de números (Apêndice A pode precisar de ajuste fino específico pra física 3D real, que se comporta diferente da simulação 2D).

---

## 19. Checklist de QA consolidado

Antes de considerar o protótipo 1 "pronto pra mostrar":

- [ ] Todos os critérios de aceite de SPEC-01 a SPEC-10 marcados.
- [ ] Testado com o número mínimo e máximo de jogadores configurados (`MIN_PLAYERS`, `MAX_PLAYERS`).
- [ ] Testado com 1 jogador desconectando no meio da corrida (não trava os demais).
- [ ] Testado client modificado tentando: pular checkpoint, forjar combo, pegar powerup à distância, trocar marcha em cooldown — todos rejeitados.
- [ ] Best times persistem entre sessões de servidor (restart de Studio ou publish).
- [ ] HUD legível e sem sobreposição em pelo menos 2 resoluções de tela diferentes (desktop e um teste em mobile, se for meta da plataforma).
- [ ] Nenhum warning/erro no Output do Studio durante uma corrida completa do início ao fim.

---

## 20. Perguntas em aberto (com recomendação)

| Pergunta | Recomendação | Por quê |
|---|---|---|
| Best times por circuito ficam salvos desde o protótipo 1? | **Sim, desde o início** (SPEC-09 no Marco 6, não deixar pro fim) | É mais barato construir a persistência cedo do que migrar dados depois; e "bater recorde" é parte do gancho de retenção do jogo |
| Quantos jogadores por corrida no protótipo 1? | **2 a 8**, com `MIN_PLAYERS = 2` | Grande o suficiente pra sentir "corrida", pequeno o suficiente pra não precisar de matchmaking sofisticado ainda |
| Câmera fixa ou alternável? | **Fixa (chase cam) no protótipo 1**, alternância de ângulos fica pra polish (Marco 7) | Reduz escopo sem perder a identidade — o web também não tinha troca de câmera |
| Escudo absorve colisão com outro jogador (PvP) ou só obstáculos/trânsito? | **Só obstáculos/trânsito no protótipo 1** — colisão entre jogadores provavelmente nem deveria ser sólida (deixar atravessar, tipo kart casual) pra evitar frustração de "bater sem querer" | Decisão de design maior (corrida competitiva de posição vs. corrida de sobrevivência tipo o duelo web) — vale uma conversa própria antes de implementar |
| Circuito procedural (como o web) entra em algum momento? | **Não no protótipo 1.** Pode ser um Marco 8 futuro, gerando o `TrackConfig` proceduralmente em vez de fixo no Studio | Circuito fixo é testável e ajustável visualmente; procedural em 3D real é um projeto à parte (geração de mesh, não só matemática de curva) |
| Existe progressão/desbloqueio de customização (ganhar pintura nova jogando) ou tudo já vem liberado? | **Tudo liberado no protótipo 1** — progressão fica pra depois de validar que o core loop (corrida) é divertido | Não vale investir em sistema de progressão antes de saber se as pessoas querem correr de novo só pela corrida em si |

---

## Apêndice A — Bíblia de física (valores portados do web)

Estes são os números **já validados** no protótipo web. Servem de ponto de partida — podem precisar de ajuste fino ao rodar em física 3D real (Marco 7), mas a proporção entre eles deve se manter.

### A.1 — Motor / câmbio (global)

| Constante | Valor | Observação |
|---|---|---|
| `RPM_IDLE` | 900 | RPM em marcha lenta |
| `RPM_REDLINE` | 7600 | Início da zona vermelha no conta-giros |
| `RPM_LIMITER` | 7900 | Corte de potência (motor não passa disso) |
| `RPM_PER_KMH` | 30 | Fator de conversão: `rpm = RPM_IDLE + kmh * gearRatio * 30` |
| `GEAR_RATIOS` | `[3.4, 2.35, 1.75, 1.38, 1.12, 0.93]` | Índices 1-6 (1ª a 6ª marcha) |
| `BRAKE_DECEL` | 105 (km/h por segundo) | Faltava nesta tabela — portado de `engine.ts:610`. No web varia com chuva (78 na chuva); sem clima no protótipo 1, usar sempre 105 |
| `DRAG_BASE` / `DRAG_COEFF` | 5 / 0.028 | Arrasto: `dragDecel(kmh) = DRAG_BASE + kmh * DRAG_COEFF` (km/h por segundo) — portado de `engine.ts:611` |

**Nota de conversão de unidades (Roblox-específico, não existe no web):** o web usa `KMH2UPS = 132` (unidades arbitrárias da projeção pseudo-3D). Isso não é portável — Roblox tem escala real de studs. Convenção adotada: `1 stud = 0.28m` (padrão da engine), logo `STUDS_PER_KMH = (1000/3600)/0.28 ≈ 0.9921`. Usado só pra mover o veículo no `Workspace`; não afeta nenhuma das fórmulas de RPM/torque acima.

### A.2 — Curva de torque por RPM (`PowerCurve(rpm)`)

```
se rpm >= RPM_LIMITER:        retorna 0
senão se rpm < 1400:          retorna 0.25
senão se rpm < 4500:          retorna 0.5 + 0.5 * ((rpm - 1400) / 3100)
senão se rpm < 7000:          retorna 1.0
senão:                        retorna 1.0 - 0.45 * ((rpm - 7000) / (RPM_LIMITER - 7000))
```

Interpretação: giro baixo (abaixo de 1400) tem só 25% de torque disponível (engasgado). Rampa linear até giro médio-alto. Pico de potência entre 4500-7000. Acima de 7000, potência cai progressivamente até a limitadora.

### A.3 — Specs das 4 carrocerias

| Carro | `power` | `grip` | `topSpeed` (km/h) | `width` | `shiftMs` | Perfil |
|---|---|---|---|---|---|---|
| **GT** (AUTOHUB GT) | 46 | 0.72 | 232 | 0.26 | 220ms | Equilibrado |
| **Muscle** (MUSCLE 71) | 58 | 0.55 | 248 | 0.31 | 300ms | Torque bruto, traseira solta, largo |
| **Ninja** (NINJA RS) | 40 | 0.90 | 216 | 0.20 | 180ms | Ágil, estreito, grudado no chão |
| **Ghost** (FANTASMA X) | 50 | 0.78 | 244 | 0.25 | 240ms | Final de reta assustador |

`power` = aceleração base em km/h por segundo na 1ª marcha. `grip` = fator de aderência em curva (0-1, quanto maior mais fácil segurar curva fechada). `width` = fração da meia-pista ocupada (afeta se cabe em espaços apertados no trânsito). `shiftMs` = tempo de troca de marcha em milissegundos (menor = câmbio mais rápido).

### A.4 — Powerups

| Tipo | Efeito | Intensidade | Duração |
|---|---|---|---|
| **Nitro** | +medidor de nitro ao coletar; enquanto ativo: +42 de aceleração extra, consumo de 38/seg, permite exceder `topSpeed` em até 12% | +40 no medidor por pickup (máx. 100) | Enquanto o medidor durar |
| **Escudo** | Absorve 1 colisão | — | Até ser usado (sem timer) |
| **2x** | Dobra o multiplicador de pontuação | ×2 (multiplicativo com combo) | 8 segundos |

### A.5 — Combo (near-miss)

| Parâmetro | Valor |
|---|---|
| Combo máximo | 7 (multiplicador efetivo até 8x: `1 + combo`) |
| Janela de tempo pra manter o combo vivo | 4 segundos |
| Pontos por near-miss | `200 * multiplicador` (multiplicador já inclui combo e 2x se ativo) |
| Velocidade relativa mínima pra contar | Deve ser sensivelmente maior que a do obstáculo (no web: `speed > obstacleSpeed + 15 km/h`) |

### A.6 — Level up

| Parâmetro | Valor |
|---|---|
| Threshold | A cada 10.000 pontos |
| Efeito | Evento visual (rabeio/fumaça) + aumento de dificuldade (no web: +3 veículos de trânsito por nível) |

### A.7 — Geração de pista (inspiração para o layout do Circuito 1 fixo)

Do gerador procedural do web — não implementar como gerador no Roblox (SPEC-05 é fixo), mas usar como guia de proporção ao desenhar o circuito manualmente:

| Tipo de trecho | Frequência no gerador original | Nota |
|---|---|---|
| Reta longa (pra usar 6ª marcha/nitro) | ~10% dos trechos | Essencial ter pelo menos 1-2 no circuito fixo |
| Reta curta/média | ~20% | |
| Curva simples (uma direção) | ~32% | A maioria do traçado |
| S-curve (duas curvas opostas em sequência) | ~24% | Testa troca de direção rápida |
| Curva fechada (exige frear) | ~14% | Não pode faltar — é o que cria "medo de ir rápido" |

### A.8 — Customização (categorias e contagem)

| Categoria | Opções | Observação |
|---|---|---|
| Pintura | 10 cores | Paleta livre |
| Faixa | 4 estilos | Sem faixa, central, dupla, lateral |
| Neon | 6 (incluindo desligado) | Azul, roxo, verde, rosa, amarelo + desligado |
| Roda | 4 estilos | Preta, prata, dourada, branca |
| Aerofólio | 3 estilos | Sem, ducktail, asa GT — disponibilidade padrão varia por carroceria (Muscle/Ninja tendem a ducktail; GT/Ghost tendem a asa) |

---

## Apêndice B — Tabelas de configuração prontas (Luau)

> Estas são **tabelas de dados**, não lógica de jogo — podem ser copiadas quase diretamente para os módulos `ReplicatedStorage/Shared/Modules/*` na implementação.

### B.1 — `VehicleConfig.lua`

```lua
return {
	RPM_IDLE = 900,
	RPM_REDLINE = 7600,
	RPM_LIMITER = 7900,
	RPM_PER_KMH = 30,
	GEAR_RATIOS = { 3.4, 2.35, 1.75, 1.38, 1.12, 0.93 },

	Vehicles = {
		GT = {
			displayName = "AUTOHUB GT",
			power = 46,
			grip = 0.72,
			topSpeed = 232,
			width = 0.26,
			shiftMs = 220,
			description = "Equilibrado. O clássico da casa.",
		},
		Muscle = {
			displayName = "MUSCLE 71",
			power = 58,
			grip = 0.55,
			topSpeed = 248,
			width = 0.31,
			shiftMs = 300,
			description = "Torque bruto e traseira solta. Largo demais pro corredor.",
		},
		Ninja = {
			displayName = "NINJA RS",
			power = 40,
			grip = 0.90,
			topSpeed = 216,
			width = 0.20,
			shiftMs = 180,
			description = "Estreito e grudado no chão. Costura qualquer comboio.",
		},
		Ghost = {
			displayName = "FANTASMA X",
			power = 50,
			grip = 0.78,
			topSpeed = 244,
			width = 0.25,
			shiftMs = 240,
			description = "Final de reta assustador. Exige mão calma.",
		},
	},
}
```

### B.2 — `PowerupConfig.lua`

```lua
return {
	Nitro = {
		meterGain = 40,       -- ganho no medidor ao coletar (máx 100)
		burnRatePerSecond = 38,
		accelBonus = 42,
		topSpeedMultiplier = 1.12,
		respawnSeconds = 20,
	},
	Shield = {
		hits = 1,              -- absorve 1 colisão
		respawnSeconds = 25,
	},
	X2 = {
		durationSeconds = 8,
		scoreMultiplier = 2,
		respawnSeconds = 30,
	},
}
```

### B.3 — `ComboConfig.lua`

```lua
return {
	MaxCombo = 7,
	WindowSeconds = 4,
	PointsPerHit = 200,
	MinRelativeSpeedKmh = 15, -- diferença mínima de velocidade pro near-miss contar
}
```

### B.4 — `TrackConfig.lua` (esqueleto — preencher IDs conforme o circuito for construído no Studio)

```lua
return {
	Circuit01 = {
		displayName = "Circuito 1",
		minPlayers = 2,
		maxPlayers = 8,
		lobbyTimeoutSeconds = 30,
		countdownDurationSeconds = 3.3,
		raceTimeoutSeconds = 300,
		launchControl = {
			perfectMinRpm = 3600,
			perfectMaxRpm = 6300,
			wheelspinMinRpm = 6800,
			bogMaxRpm = 2200,
		},
		-- checkpoints/spawns/powerupSpawns são lidos do Workspace por nome/atributo,
		-- não hardcoded aqui — ver SPEC-05.
	},
}
```

### B.5 — `CustomizationConfig.lua`

```lua
return {
	Paints = {
		Color3.fromRGB(224, 52, 47),   -- vermelho (padrão)
		Color3.fromRGB(245, 158, 11),  -- laranja
		Color3.fromRGB(34, 211, 238),  -- ciano
		Color3.fromRGB(139, 92, 246),  -- roxo
		Color3.fromRGB(74, 222, 128),  -- verde
		Color3.fromRGB(244, 114, 182), -- rosa
		Color3.fromRGB(248, 250, 252), -- branco
		Color3.fromRGB(51, 65, 85),    -- grafite
		Color3.fromRGB(250, 204, 21),  -- amarelo
		Color3.fromRGB(29, 78, 216),   -- azul
	},
	Stripes = { "None", "Center", "Double", "Side" },
	Neons = { "Off", "Blue", "Purple", "Green", "Pink", "Yellow" },
	Wheels = { "Black", "Silver", "Gold", "White" },
	Wings = { "None", "Ducktail", "GTWing" },

	-- aerofólio padrão sugerido por carroceria (pode ser sobrescrito pelo jogador)
	DefaultWingByVehicle = {
		GT = "GTWing",
		Muscle = "Ducktail",
		Ninja = "Ducktail",
		Ghost = "GTWing",
	},
}
```

---

## Apêndice C — Payloads de Remote prontos (Luau types)

> Tipos usados nos payloads da seção 5. Definir em `ReplicatedStorage/Shared/Types/AutoDashTypes.lua` usando `--!strict` e `export type`.

```lua
--!strict

export type GearShiftPayload = {
	direction: "up" | "down",
}

export type ThrottleInputPayload = {
	throttle: number, -- 0..1
	brake: number,    -- 0..1
	steer: number,    -- -1..1
	seq: number,       -- incremental, para descarte de pacotes fora de ordem
}

export type PowerupPickupRequestPayload = {
	powerupId: string,
}

export type PowerupType = "Nitro" | "Shield" | "X2"

export type PowerupAppliedPayload = {
	playerId: number,
	powerupType: PowerupType,
	duration: number,  -- segundos; 0 ou -1 para "sem timer" (ex: Shield)
	expiresAt: number, -- os.time() previsto de expiração
}

export type ComboUpdatePayload = {
	combo: number,               -- 0..7
	multiplier: number,          -- 1..8 (ou 2..16 com X2 ativo)
	windowExpiresAt: number,     -- os.clock() previsto; 0 se combo == 0
}

export type RaceState = "Lobby" | "Countdown" | "Racing" | "Finished"

export type RaceStateChangedPayload = {
	state: RaceState,
	data: { [string]: any }?,   -- payload extra dependente do estado (ex: resultados finais)
}

export type RaceCountdownPayload = {
	secondsRemaining: number,
	rpmWindow: { min: number, max: number }?, -- só presente durante a janela de launch control
}

export type CheckpointCrossedPayload = {
	checkpointOrder: number,
	timestamp: number,
}

export type LeaderboardEntry = {
	playerId: number,
	position: number,
	lastCheckpoint: number,
	finished: boolean,
	finishTime: number?,
}

export type LeaderboardUpdatePayload = {
	standings: { LeaderboardEntry },
}

export type LevelUpPayload = {
	playerId: number,
	newLevel: number,
}

export type PlayerStats = {
	pilotName: string,
	currentVehicleId: string,
	bestTimesByTrack: { [string]: number }, -- trackId -> segundos
}

export type BestTimeEntry = {
	playerId: number,
	pilotName: string,
	timeSeconds: number,
	achievedAt: number,
}

export type CustomizationChoice = {
	vehicleId: string,
	paintIndex: number,
	stripeIndex: number,
	neonIndex: number,
	wheelIndex: number,
	wingIndex: number,
}

export type SaveCustomizationResponse = {
	success: boolean,
	error: string?,
}

return {}
```

---

**Fim do documento.** Próximo passo sugerido: validar as respostas da seção 20 (perguntas em aberto) e então começar pelo **Marco 1** do roadmap (seção 18).
