# AutoDash v2 — guia vivo

Este arquivo é a fonte da verdade do próximo ciclo do AutoDash ("mini Most Wanted"). Quem for trabalhar nele (humano ou IA) lê este arquivo primeiro, confere as decisões e atualiza o status **no mesmo commit** da mudança.

Regras de atualização:
- Decisão nova do usuário: entra na seção "Decisões" com data.
- Fase concluída: marca o status e registra o hash do commit.
- Mudança de comportamento intencional: anota no "Log de mudanças" e diz qual snapshot do golden master mudou e por quê.
- Este arquivo não substitui os ADRs: decisão arquitetural vira ADR (em português), e aqui só se linka.

---

## 1. Objetivo

Evoluir o modo corrida e a geração de mapa do AutoDash para um jogo de corrida mais completo, mantendo a estética atual (pseudo-3D em Canvas 2D, neon noturno, arcade). Escopo de referência: biomas, pistas com atalhos, clima e ciclo de dia, carros com tração e câmbio, customização estética, eventos e perseguição estilo Most Wanted.

Prioridade: fazer tudo em fases, uma por vez, com parada para o usuário testar.

## 2. Não-objetivos (por agora)

- Tuning de desempenho (motor, turbo, suspensão que mudam velocidade). Fica só como ideia encaminhada.
- Backend em Rust. Ideia futura; a infra atual continua com custo zero (ADR 0004).
- Multiplayer com WebSocket. Continua polling (ADR 0009).
- Moeda/dinheiro. Ainda não decidido; ver "Decisões em aberto".
- Mundo aberto contínuo. A corrida continua separada do solo.

## 3. Restrições do projeto

- Idioma: comentários de código, ADRs e documentação de projeto em **português**. Prompts e mensagens internas podem ser em inglês.
- Commits: mensagens em português, uma preocupação por commit, linha `Co-Authored-By` ao final.
- Custo zero de infra (ADR 0004). Netlify + Neon free tier.
- Gerenciador de pacotes: **npm** em `web-garagem/` (não criar `bun.lock`).
- Migrations já aplicadas no Neon não são editadas; mudança de schema vira nova versão.
- Teclas de debug (`O L B V J K I U`) ficam ativas: são ferramenta de teste do usuário.

### Verificação obrigatória em cada commit
```bash
cd web-garagem
npm run build     # tsc -b + vite build
npm run lint      # sem erro novo (avisos antigos de react-hooks são aceitos)
npm test          # golden master + testes unitários
```
Para mudança visível: abrir `http://localhost:5173/autodash` no navegador e conferir menu, lobby da corrida, corrida e a mudança feita.

### Golden master
- `npm test` roda replays determinísticos (partida solo, corrida com bots, corrida por clique real, lobby do duelo) e compara o SHA-256 de tudo que o canvas desenha.
- Se a mudança **não** é intencional, o snapshot tem que continuar passando. Não atualizar snapshot para ficar verde.
- Se a mudança **é** intencional: atualizar o snapshot em commit próprio, com a justificativa na mensagem do commit e uma linha no Log de mudanças abaixo.

## 4. Mapa do código (já refatorado)

Pasta: `web-garagem/src/game/autodash/`

| Área | Arquivos | Responsabilidade |
|---|---|---|
| Entrada pública | `index.ts` | Páginas importam só daqui |
| Orquestração | `engine.ts` (~660 linhas) | Campos, render, bind/unbind. Módulos recebem `eng` como primeiro argumento |
| Simulação | `sim/update.ts` | Um quadro da simulação |
| Física | `physics/rpm.ts`, `physics/gearbox.ts` | Curva de torque, RPM, câmbio |
| Mundo | `world/track.ts`, `world/zones.ts`, `world/obstacles.ts`, `world/events.ts` | Geração de pista, zonas, obstáculos, eventos e perseguição |
| Tráfego | `traffic/types.ts`, `traffic/driver.ts`, `traffic/spawner.ts` | IA por papel (civil, polícia) com registro `DRIVERS` |
| Modos | `modes/solo.ts`, `modes/race.ts`, `modes/duel.ts` | Largada, colisão, lobbies |
| Corrida | `race/session.ts`, `race/bots.ts`, `race/net.ts`, `race/types.ts` | Sessão, bots, rede com dead reckoning |
| Rede | `net.ts` (duelo), `net-http.ts` (helper comum) | Polling |
| Render | `render/road.ts`, `render/backdrop.ts`, `render/objects.ts`, `render/player.ts`, `render/hud.ts`, `render/race-hud.ts`, `render/particles.ts`, `render/textures.ts`, `render/primitives.ts`, `render/menus/*.ts` | Desenho por área |
| Entrada | `input/keyboard.ts`, `input/pointer.ts`, `input/touch.ts` | Teclado, mouse, toque |
| UI e fluxo | `ui/widgets.ts`, `flow.ts` | Botões de canvas, navegação entre telas |
| Dados | `data.ts` | Carros (`CARS`), pinturas, faixas, neon, rodas, asas, constantes de câmbio, leaderboard, config |
| Áudio | `audio.ts` | Sons sintetizados com WebAudio |
| Testes | `__tests__/harness.ts`, `engine.golden.test.ts`, `scenarios.golden.test.ts`, `math.test.ts` | Replay determinístico e unitários |

API: `api/src/routes/autodash.ts`. Tabelas: `autodash_scores`, `autodash_rooms`, `autodash_race_rooms`, `autodash_race_players`.

## 5. Estado atual (fatos verificados no código)

- **Corrida:** até 4 pilotos, voltas configuráveis (padrão 3), uma pista gerada por seed (`buildTrack` com `corrida=true`), céu roxo fixo, sem ciclo de dia. Bots completam o grid. Multiplayer por sala com polling.
- **Clima:** chuva (`eng.raining`) só no modo solo. Sem neve, neblina ou efeito na física.
- **Ciclo de dia:** só no solo (`SKY_KEYS`).
- **Eventos (solo):** ponte, viaduto, obstáculos, mão dupla, blitz, radar (`speedtrap`), perseguição policial.
- **Cenário:** um tema urbano (árvores, postes, outdoors, prédios em `render/backdrop.ts`). Sem biomas.
- **Carros:** lista pequena em `CARS`. Customização estética: pintura, faixa, neon, rodas, asa.
- **Tração:** FWD, RWD e AWD com divisão e pneu, em `physics/traction.ts` (Fase 2). Padrão continua RWD com pneu padrão.
- **Câmbio:** ainda só marcha automática ou manual, com 6 marchas e 1 curva de torque. Relação final já vale. Tipo de câmbio pendente.

## 6. Decisões tomadas (com data)

Origem: QA respondido pelo usuário em 2026-11-13.

**Escopo**
- D1 (13/11): Ordem: tudo ao mesmo tempo, em fases.
- D2 (13/11): Corrida com bots **e** multiplayer online.
- D3 (13/11): Corrida continua separada do solo. Deve ganhar um lobby mais detalhado e um "reconhecimento de percurso" (preview da pista).

**Mapa e biomas**
- D4 (13/11): Criar todos os biomas planejados como dados e camadas, e implementar depois. Lista inicial: cidade (tipo Tokyo, prioridade), costa, deserto, floresta, neve, e mais alguns a definir.
- D5 (13/11): Corrida: pistas fixas, com trechos desafiadores (imersão nas curvas). Solo: pista procedural por seed, ou construída aos poucos enquanto dirige.
- D6 (13/11): Corrida pode ter atalhos e ramificações. **Sem checkpoints que reseta o piloto.** Batida só desabilita ou reduz velocidade, nunca teleporta de volta.
- D7 (13/11): Cenário por bioma, em camadas (longe, meio, perto). Ex.: cidade noturna tipo Tokyo.

**Clima e tempo**
- D8 (13/11): Ciclo de dia em **ticks** (estilo Minecraft), com modo custom opcional.
- D9 (13/11): Clima pode ser por bioma, por corrida, ou escolhido. Pode ser imersão ou desafio.
- D10 (13/11): Clima **altera a física** (aderência, visibilidade), não só o visual.

**Carros e tração**
- D11 (13/11): Quantidade de carros: não definida. Prioridade é variedade de condução e modos, não número.
- D12 (13/11): Desempenho de motor/turbo/suspensão: **não agora**. Customização é estética: pintura, bodykit, som de escape, efeitos (chama/estouro), câmera. Tuning de mapa (remap) fica como ideia encaminhada.
- D13 (13/11): Tração: FWD, RWD, AWD. AWD com divisão configurável (30/70, 50/50, 80/20...).
- D14 (13/11): Pneus: tipos afetam aderência e tração, com alguma faixa de torque para facilitar a condução.
- D15 (13/11): Câmbio: 5 e 6 marchas, CVT, manual, híbrido. Relação de diferencial (final) importa. Embreagem opcional (botão).
- D16 (13/11): Bodykit e câmera: começar a desenhar os dados. Novas câmeras e efeitos 3D ficam para depois, com cuidado de engenharia.

**Progressão**
- D17 (13/11): Tudo liberado, exceto tuning e aerodinâmica, que exigem km rodados e pontos farmados.

**Eventos e IA**
- D18 (13/11): Convite de racha: um personagem chama o jogador na seta para uma corrida. Tipo de evento novo.
- D19 (13/11): Combustível: postos para abastecer. Dá lógica ao câmbio. **Dinheiro: em aberto.** Não pode quebrar a ideia de rodadas infinitas.
- D20 (13/11): Polícia com nível de procurado (estrelas), estilo Most Wanted. **Estudar e propor**, não implementar tudo de uma vez.

**Modos e pontuação**
- D21 (13/11): Várias configurações de rodada de corrida, e um modo Drift. **Brainstorm** em documento, sem implementar.
- D22 (13/11): Modos desejados no futuro: Rally, Arrancada, Circuito, e um Lobby para mostrar builds.

**Técnico**
- D23 (13/11): Desempenho mínimo: 60 fps em celular. Meta: 144 fps no PC. Perfilar antes de otimizar.
- D24 (13/11): Custo zero continua como meta. Se não der, planejar hospedagem paga no futuro.
- D25 (13/11): Prazo informal: entregar o máximo até 17/11. Não é prazo fixo.

**Formato de trabalho**
- D26 (13/11): Este arquivo é o guia. O prompt apenas aponta para ele.

## 7. Decisões em aberto

- **Dinheiro / moeda do jogo:** tem que existir? Como combustível e progresso se encaixam sem quebrar as rodadas infinitas? Propor 2 ou 3 opções em documento.
- **Polícia:** escalas de estrelas, o que cada nível faz, como encerra a perseguição.
- **Drift:** pontuação, critérios e como entra nas rodadas.
- **Biomas:** lista final e ordem de implementação além de cidade e costa.
- **Modelo de física:** quantos parâmetros por pneu e por carro (ver ADR 0012 quando existir).

## 8. Fases

Cada fase termina com parada para o usuário testar. Não começar a próxima sem aprovação.

### Fase 0 — Planejamento (sem mudança de jogo) — `concluída` (hash no log)
- [x] Este guia completo e revisado.
- [x] ADR 0011: modelo de dados de bioma e camadas de cenário.
- [x] ADR 0012: modelo de física (tração, pneus, câmbio, clima como entrada da física).
- [x] ADR 0013: relógio em ticks e clima.
- [x] Lista de 10 ideias para rodadas de corrida e drift, neste arquivo, seção 9.
- [x] Spec `docs/specs/autodash/v2-mostwanted.md`.

Critério de aceite: usuário aprova os ADRs e a lista.

### Fase 1 — Biomas e camadas — `concluída` (hashes no log)
- [x] Tabela de dados de bioma (`world/biomes.ts`): nome, céu, camadas, árvore de beira, climas. Peso de decoração fica para a Fase 3 (hoje só a árvore).
- [x] Converter o cenário urbano atual no bioma "cidade", com 3 camadas (longe, meio, perto).
- [x] Bioma "costa" usando o mesmo sistema (horizonte com mar, palmeiras, píer).
- [x] Seletor de bioma na garagem (tecla X e pill).

Critério de aceite: solo e corrida leem o bioma da tabela. Snapshot do golden muda só pela camada intencional, em commit próprio. Browser: menu, corrida e troca de bioma funcionam.

### Fase 2 — Tração, pneus e câmbio (dados e física, sem visual novo) — `concluída` (hashes no log)
- [x] Carro ganha: tração (FWD/RWD/AWD + divisão), tipo de pneu, relação final.
- [ ] **Pendente (próxima fase de câmbio):** tipo de câmbio (5 e 6 marchas, CVT, manual, híbrido) e embreagem. Hoje `GEAR_RATIOS` tem 6 marchas fixas.
- [x] Física lê esses dados: limite de tração por eixo, perda de tração na saída de curva (círculo de atrito), aceleração em reta por tração, relação final.
- [x] Quatro carros de teste: FWD, RWD, AWD 50/50, AWD 30/70 (no fim de `CARS`).
- [x] Testes unitários da matemática de tração (`__tests__/traction.test.ts`, 14 casos).
- Nitro não passa pelo limite de tração (decisão registrada no ADR 0012).

Critério de aceite: o carro padrão continua idêntico (ou o snapshot muda com justificativa). Os quatro carros de teste se comportam diferente de forma perceptível no navegador.

### Fase 3 — Pistas de corrida e lobby — `concluída` (hashes no log; aguardando playtest)
Decisões e alternativa rejeitada em [ADR 0014](../../adr/0014-autodash-circuitos-e-ramais.md).
- [x] Circuitos fixos como dados (`world/circuits.ts`): Anel de Shibuya, Serra do Píer (costa), Marginal Neon.
- [x] Atalhos e ramificações como **ramal paralelo** na mesma fita (`world/ramais.ts`): sem checkpoint, sem teleporte; grama entre pista e ramal; `ganho` de avanço no miolo.
- [x] Bots pegam o ramal; minimapa e prévia mostram o ramal; placas de atalho.
- [x] Lobby com escolha de pista (P/setas), painel com traçado, km, curvas, atalhos e bioma.
- [x] Reconhecimento de percurso: sobrevoo de uma volta com nome dos trechos (tecla R).
- [x] Sala online: pista na seed (`seed % 8`); API aceita `seed` opcional, sem migration.
- [x] Tração agora também muda direção e patinada (correção da revisão da Fase 2).
- Pendente / não verificado: ramal com geometria própria (bifurcação de verdade); o trecho separado do ramal só foi visto no começo, no navegador; tsc da api não rodou; bots no ramal sem playtest; `ganho` e larguras são palpite a calibrar.

### Fase 4 — Clima e ciclo de dia em ticks, com efeito na física — `implementada` (hashes no log; aguardando playtest)
Decisões no [ADR 0013](../../adr/0013-autodash-relogio-em-ticks.md). Começada sem a aprovação da Fase 3 por pedido do usuário ("pode seguir").
- [x] Relógio em ticks (`world/clock.ts`): 1/20 s, dia de 24000 ticks (20 min), tick 0 = amanhecer. Pausa e menus não avançam.
- [x] Horários: ciclo (começa às 9h, mesmo céu de largada de antes), amanhecer, dia, pôr do sol, noite (fixos).
- [x] Clima como dados (`world/weather.ts`): limpo, nublado, chuva, neblina, com aderência, freio, visibilidade e luz. Chuva mantém os números de antes.
- [x] Clima vira só na janela de 1 minuto, pela seed da pista (largada sempre limpa). Antes era `Math.random` a cada 18 s.
- [x] Neblina: névoa por cima dos sprites esconde o trânsito distante. Nublado e neblina puxam o céu pro cinza.
- [x] Garagem (solo) e lobby (corrida com bots): horário [O] e clima [K]. Sala online e duelo usam o padrão (noite + sorteio / ciclo + sorteio).
- [x] HUD (solo e corrida) com relógio e ícone do clima. 11 testes (`__tests__/clock-weather.test.ts`).
- Pendente / não verificado: neve (sem bioma neve); velocidade do relógio `custom` (×0,5, ×2) existe no dado mas não tem botão; o ciclo agora leva 20 min (antes 10 km, ~3 min a 200 km/h) — calibrar no playtest; render conferido só por sondas de pixel (aba do navegador oculta), não por screenshot.
### Fase 5 — Eventos novos (racha, combustível) — `pendente`
### Fase 6 — Polícia por estrelas — `pendente`
### Fase 7 — Customização estética (bodykit, som, efeitos) — `pendente` (som do motor antecipado)
- [x] Som de motor por pulsos de combustão (`sound/`), um perfil por motor (14 motores) e um motor por carro; turbo, flutter/blow-off, compressor Roots, estouros. Pesquisa em [docs/pesquisa/som-motor.md](../../pesquisa/som-motor.md).
- [x] Motor original de cada carro segue a inspiração dele (Mustang 71 → V8 cruzado Ford, Miata → I4 1.6, Silvia S15 → I4 turbo, RX-7 FD → rotativo, Supra A80 → I6 biturbo, R32 → I6 de corrida, 911 992 → boxer 6 biturbo, Z → V6 aspirado). Decisão do usuário (13/11): "depende do carro"; por enquanto o jogador escolhe.
- [x] Garagem: seletor de motor [E] salvo por carro (`CarCustom.motor`), com acelerada de amostra ao trocar.
- [x] Motor real na física (`physics/motores.ts`): cada motor tem lenta, faixa vermelha, corte e curva de força de um motor real da mesma família (V8 de 71 corta em 6000 com força embaixo; VTEC e V10 passam de 8500; V12 vai a 9250), e o turbo tem atraso de verdade (enche com giro e pé, segura na troca, esvazia ao aliviar). Câmbio automático, largada, conta-giros e corte do som seguem a faixa do motor. A velocidade de cada marcha é a mesma para todo motor e a área da curva é igualada: o motor muda ONDE está a força, o `power` do carro continua decidindo quanto ele anda. Medido em reta (0–200 com largada): carros dentro de ±12% do antes, exceto SYLVA (+22%) e TARGA (+15%), que ficam perto da máxima e amplificam a diferença. Trocar o motor na garagem troca também a física (swap).
- Em aberto: inspiração do GT (V10), do NINJA (I4) e do ALTA (I4) foi palpite pelo nome; FANTASMA confirmado como Koenigsegg (V8 plano biturbo). Calibrar de ouvido: não foi ouvido, só medido offline.

Fases 4 em diante só são detalhadas quando a anterior for aprovada.

## 9. Ideias de rodadas e drift (para brainstorm, não implementar)

1. **Sprint A → B:** sem volta, do ponto A ao B. Ganha quem chega primeiro; o trajeto escolhido (atalho ou não) define o tempo.
2. **Arrancada (drag):** 400 m em reta, semáforo, troca de marcha. Pontua o tempo de 0 a 100 km/h e o tempo final.
3. **Rally:** trechos cronometrados em terra, com aderência variável. Estourar o tempo do trecho soma penalidade, sem reset.
4. **Contrarrelógio com fantasma:** corre contra o melhor tempo salvo. O fantasma é o replay do melhor tempo.
5. **Eliminação:** a cada volta sai o último colocado. Vence o último pé no acelerador. Sem teleporte.
6. **Corrida de rota:** pista com ramificações. Cada atalho tem mais risco e mais tráfego, mas economiza tempo.
7. **Drift por pontos:** ângulo e tempo de drift viram pontos, com combo por cadeia. Bater zera o combo, não a corrida.
8. **Drift em dupla (tandem):** dois carros, pontos por proximidade e sincronia. Quem sai na frente perde pontos.
9. **Corrida de chuva com névoa:** visibilidade cai e o alcance encurta. Pontua por volta limpa, sem bater.
10. **Racha com desafio:** duas ou três paradas com a posição final como desafio, sem dinheiro. Pontos de reputação, não moeda.

Itens 1, 2, 5 e 10 cabem nas fases 3 e 5. Drift (7 e 8) depende de definir pontuação (seção 7).

## 10. Log de mudanças

| Data | Commit | O que mudou | Snapshot do golden |
|---|---|---|---|
| 2026-11-13 | (esta spec) | Criação do guia vivo | não alterado |
| 2026-11-13 | ea1e68f | Fase 1a: `BIOMES` como dados, cidade com desenho idêntico. | não alterado |
| 2026-11-13 | c37ea84 | Fase 1b: camada perto da cidade (brilho urbano no horizonte, só à noite). | atualizado nas 2 cenas de corrida (noturnas). O replay solo não mudou (fato). O motivo escrito no commit ("trecho de dia") não foi verificado. |
| 2026-11-13 | c6d8999 | Fase 1c-i: bioma costa (mar, palmeiras, píer, palmeira de beira). | não alterado |
| 2026-11-13 | d0f8e39 | Fase 1c-ii: seletor de bioma na garagem (tecla X e pill). | atualizado no replay solo (+98 chamadas pela pill nova). Cenas de corrida não mudaram. |
| 2026-11-13 | b6451b0 | Fase 2a: tração, pneus e relação final na física (`physics/traction.ts`); carro padrão inalterado. | não alterado |
| 2026-11-13 | 9f4cd77 | Fase 2b: quatro carros de teste de tração. | atualizado no replay solo (garagem mostra "1 / 16"; só o hash muda, as chamadas de desenho não). Cenas de corrida não mudaram. |
| 2026-11-13 | d637260 | Revisão da Fase 2: `steerK` (direção por tração) e `wheelspinK` (patinada); seletor de bioma troca o cenário na hora. | não alterado |
| 2026-11-13 | 5ee3269 | Garagem mostra tração e pneu do carro. | atualizado no replay solo (+14 chamadas de texto). |
| 2026-11-13 | 81ce03d, e1174c3, 35a7804 | Fase 3a: ADR 0014; circuitos fixos e ramais (dados, física, render); bots, minimapa e prévia com ramais. | não alterado |
| 2026-11-13 | a87237c | Fase 3b: escolha de pista, prévia e reconhecimento no lobby; pista na seed; API aceita seed. | atualizado nas 2 cenas de corrida (largam no circuito fixo; lobby com painel). Solo e duelo não mudaram. |
| 2026-11-13 | 6cbd80b | Câmbio automático reduz marcha sem gás e faz kickdown (antes ficava preso na 6ª acima de ~42 km/h). | atualizado nas 2 cenas de corrida (dirigem no automático). |
| 2026-11-13 | fb780c5, d8efd4a | Fase 4: relógio em ticks e clima como dados; ligados à física, céu, névoa, HUD e menus. | atualizado nos 3 cenários: HUD com relógio, pills novas, sorteio de clima fora do `Math.random`. |
| 2026-11-13 | 5b01da3, dbb3f8a | Som de motor por pulsos (AudioWorklet), perfis por motor, turbo, compressor e estouros. | não alterado (harness sem áudio). |
| 2026-11-13 | f3e02e6 | Motor por carro segue a inspiração; seletor de motor na garagem [E] com acelerada de amostra. | atualizado no replay solo (pill nova na garagem). |
| 2026-11-13 | (este) | Motor real na física: lenta, corte, curva e turbo por motor; câmbio, largada e conta-giros seguem o motor. | atualizado nos 3 cenários (carro padrão agora com V10 de 8700 e conta-giros até 9). |
| 2026-11-13 | (Fase 0) | Fase 0: spec `v2-mostwanted.md`, ADRs 0011–0013 (propostos), 10 ideias de rodadas e drift. Guia trazido de `docs/autodash-v2-spec` para o branch `feat/autodash-v2-mostwanted`. | não alterado |
