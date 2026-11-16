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
- Teclas de debug ficam ativas: são ferramenta de teste do usuário. Das antigas (`O L B V J K I U`) só sobrou o `O` (sobe uma estrela); as outras viraram sorteio do jogo. Fase 5 somou `1`–`6` no solo (posto, racha, obra, comboio, óleo, reserva); no dev server elas também expõem o engine em `globalThis.__autodash`.

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
| Mundo | `world/track.ts`, `world/zones.ts`, `world/obstacles.ts`, `world/events.ts`, `world/policia.ts` | Geração de pista, zonas, obstáculos, eventos; polícia por estrelas (calor, despiste, pregos, bloqueio, helicóptero) |
| Tráfego | `traffic/types.ts`, `traffic/driver.ts`, `traffic/spawner.ts` | IA por papel (civil, polícia) com registro `DRIVERS` |
| Modos | `modes/solo.ts`, `modes/race.ts`, `modes/duel.ts` | Largada, colisão, lobbies |
| Corrida | `race/session.ts`, `race/bots.ts`, `race/net.ts`, `race/types.ts` | Sessão, bots, rede com dead reckoning |
| Rede | `net.ts` (duelo), `net-http.ts` (helper comum) | Polling |
| Render | `render/road.ts`, `render/backdrop.ts`, `render/objects.ts`, `render/player.ts`, `render/hud.ts`, `render/race-hud.ts`, `render/particles.ts`, `render/textures.ts`, `render/primitives.ts`, `render/policia.ts`, `render/menus/*.ts` | Desenho por área |
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
- **Fase 5 (solo):** combustível e posto (`world/combustivel.ts`, `world/posto.ts`), racha (`world/racha.ts`, `modes/racha.ts`), obra, comboio e óleo (`world/obra.ts`, `world/comboio.ts`, `world/oleo.ts`), caminhão que troca de faixa (`traffic/driver.ts`). Vácuo (`sim/vacuo.ts`) vale no solo e na corrida. Desenho em `render/eventos.ts`.
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

**Partida do motor**
- D27 (14/11): A partida do motor (chave virando, motor pegando) é só animação e **não conta tempo**. `PARTIDA_S = 1,3 s` em `sim/partida.ts`, na lógica, nunca no áudio (os testes rodam sem áudio). `eng.partidaT` conta para trás dentro do estado `countdown`: `countT` fica em 0, o semáforo não acende (o HUD diz "ligando…"), o pé não sobe giro (giro vai de ~22% da lenta até a lenta na pegada), a câmera dá um tranco, e o ronco só entra quando a etapa acaba. Pontuação, km, combustível e polícia já não rodam em `countdown`. Vale para solo, corrida com bots, corrida online e os modos de teste (`testeMotor`, `testeFase5`, `testePolicia`). **O duelo fica de fora** (`partidaT = 0`): `modes/duel.ts` calcula `countT` pelo relógio do servidor (`3,3 − restante`) e os dois lados precisam ver o verde no mesmo instante; encaixar a partida dentro desses 3,3 s tiraria o início do semáforo e o duelo já reserva esse tempo. No duelo o arranque gravado toca como antes. Na corrida online a sessão (`RaceSession`) só anda depois do verde, então a partida não mexe nela.

**Formato de trabalho**
- D26 (13/11): Este arquivo é o guia. O prompt apenas aponta para ele.

## 7. Decisões em aberto

- **Dinheiro / moeda do jogo:** tem que existir? Como combustível e progresso se encaixam sem quebrar as rodadas infinitas? Propor 2 ou 3 opções em documento.
- **Polícia:** escalas de estrelas, o que cada nível faz, como encerra a perseguição. **Escolha provisória (14/11, sessão da Fase 6, sem o dono):** escala de `docs/pesquisa/visual-e-desafio.md` 4.6 (★ radar, ★★ cola, ★★★ pregos, ★★★★ bloqueio, ★★★★★ helicóptero); perseguição encerra por despiste (ninguém te vê por N s) ou prisão (encostão te joga fora da pista, ou batida no bloqueio). Números na tabela `ESTRELAS` (`world/policia.ts`) e na Fase 6 abaixo. Confirmar no playtest.
- **Polícia — recompensa:** despistar dá pontos (1.500 × estrelas) e passar na fresta do bloqueio dá 2.500. Provisório até decidir moeda (ver Dinheiro).
- **Drift:** pontuação, critérios e como entra nas rodadas.
- **Biomas:** lista final e ordem de implementação além de cidade e costa.
- **Modelo de física:** quantos parâmetros por pneu e por carro (ver ADR 0012 quando existir).
- **Combustível acabar (Fase 5):** fim de corrida ou só perda de potência? **Escolha provisória: só perda de potência** (pane seca: motor engasga, posto garantido logo à frente). Motivo: D19 pede que o combustível não quebre as rodadas infinitas, e D6 diz que punição reduz velocidade, nunca encerra.
- **Combustível na corrida e no duelo (Fase 5):** **provisório: só no solo.** A corrida tem duração fixa em voltas e o duelo precisa dos dois carros iguais; posto na corrida exige decidir pit stop.
- **Preço do combustível (Fase 5):** **provisório: grátis**, custa só o tempo de passar a 70 km/h pela faixa do posto. Dinheiro segue em aberto (acima).
- **Recompensa do racha (Fase 5):** **provisório: reputação** (um contador salvo na config) mais pontos da rodada. Ideia 10 da seção 9: reputação, não moeda. O que a reputação libera fica para a decisão de progressão (D17).
- **Aceitar o racha (Fase 5):** **provisório: piscar o farol [F]**, que já é o gesto de "bora" na rua. No toque ainda não há botão de farol (pendente).
- **Estética (Fase 7, provisório desde 14/11):** bodykit só visual e liberado; rivais online sem bodykit; FOV dinâmico ligado por padrão (+4° no topo) com opção de desligar. Confirmar no playtest.

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
### Fase 5 — Eventos novos (racha, combustível) — `implementada` (hashes no log; aguardando playtest)
Começada em paralelo à Fase 4 em playtest, por pedido do usuário (Fases 5, 6 e 7 em sessões separadas). Eventos de tráfego vêm da pesquisa [visual-e-desafio.md](../../pesquisa/visual-e-desafio.md), seção 4.5. Dados em `world/` como tabela; lógica fora de `engine.ts` (o engine só ganha campos e tipos).

Checklist:
- [x] **Sorteio próprio dos eventos novos** (`eng.rngEv`, mulberry32 da seed do clima). Os eventos antigos passaram para o `eng.rngEv` em 15/11, junto com o ritmo dos eventos.
- [x] **Combustível (só solo):** tanque por carro em `world/combustivel.ts` (tabela). Consumo cresce com o pé, com o giro (fração da faixa do motor) e com o nitro: trocar cedo economiza, o que dá lógica ao câmbio (D19). HUD com barra "COMB" ao lado do NOS, aviso de reserva e distância até o posto.
- [x] **Posto de combustível:** aparece quando o tanque passa de 45% para baixo (e de novo se você passou reto e caiu para 20%). É uma "reta com posto": o trecho perde a curva (como a ponte) e ganha uma faixa de acesso à direita, feita com o **ramal paralelo** do ADR 0014 (`ganho = 1`). Abastece andando a até 70 km/h no miolo da faixa (+20% do tanque por segundo). Placas "POSTO 2 km / 1 km / ENTRADA". O posto é zona: não empilha com outro evento (alívio, pesquisa 4.2).
- [x] **Pane seca:** tanque vazio não encerra a rodada. O motor engasga (pé efetivo pulsando entre 0 e 35%) e um posto é garantido logo à frente.
- [x] **Convite de racha (D18, ideia 10):** depois de ~45 s de solo, um desafiante (tabela `DESAFIANTES` em `world/racha.ts`) encosta na faixa ao lado com pisca-alerta e "chama na seta". Piscar o farol [F] aceita. A disputa é um sprint de 2,5 km; ganhar vale **reputação** (+1, salva na config, sem dinheiro) e pontos. Ignorar por 7 s recusa: ele buzina e vai embora. Encostar no desafiante é encostão (empurra, perde velocidade), não batida fatal.
- [x] **E7 rival que fecha (no racha):** com você até ~8 carros atrás, numa faixa vizinha, ele "olha" (luz de freio e balanço de 0,03) e fecha a sua linha 0,5 s depois, no máximo 1 vez a cada 10 s. Reage com atraso: a finta funciona. Nunca entra na faixa se você está colado (a trava do `applyMovement` continua valendo).
- [x] **Desafiante do racha respeita o trânsito (15/11, playtest):** ele atravessava os carros, andava sem trânsito e abria mais de 1 km. No cenário `__tests__/racha.cenario.test.ts`, semente 11, eram 10 carros atravessados e média de 96% da máxima.
  - Agora ele freia a tempo pelo carro da frente (`freiaAte`, enxerga 9000 à frente, desconta o passo do quadro e usa a velocidade que o civil ANDOU, `vReal`, não o cruzeiro). Também tem freio de pânico quando alguém entra colado e acende a luz de freio ao frear forte.
  - Contorna cedo e alivia nas curvas fechadas. A arrancada perde fôlego perto da máxima, como a do seu carro. Não fica montado entre duas faixas.
  - Fora de vista, onde o jogo não tem trânsito, anda a 88% da máxima. O trânsito não nasce nem é reciclado na cara dele.
  - Resultado: 0 carros atravessados em 3 sementes, média de 70–73% da máxima. Números em `RACHA` (`world/racha.ts`).
- [x] **E9 vácuo (solo e corrida):** colado atrás de um veículo rápido (mesma faixa, até ~5 carros) o carro ganha até +4% de velocidade máxima. Ao sair do vácuo, "estilingue" de 1 s. HUD com ícone "VÁCUO" e linhas de ar. Vale para trânsito, desafiante do racha e rivais da corrida.
- [x] **E1 caminhão trocando de faixa:** caminhão passa a trocar de faixa às vezes, com seta acesa ≥ 1,2 s e "ensaio" de 0,05 de `offset` antes de ir. Nunca entra na sua faixa se você chegaria nele em menos de 1,2 s.
- [x] **E4 obra com estreitamento:** evento novo no sorteio. Duas faixas de um lado fecham por ~3 s a 200 km/h, com seta luminosa piscando (paleta de perigo da pesquisa 1.8), cones na divisa e cavaletes no trecho fechado. O trânsito migra para o lado livre.
- [x] **E6 comboio com fresta:** três veículos lado a lado no mesmo ritmo, uma faixa livre. A fresta anda: o vizinho dá seta 1,2 s e fecha, abrindo outra. Passar pela fresta vale bônus ×3 de quase-batida. Depois de ~16 s o comboio se desfaz.
- [x] **E15 óleo após acidente:** carro batido no acostamento com pisca-alerta e mancha de óleo na faixa ao lado. Em cima da mancha a aderência cai para 35% por 0,7 s (escorrega, sem morte).
- [x] Teclas de debug de playtest (só no solo, correndo): **1** posto, **2** convite de racha, **3** obra, **4** comboio, **5** óleo, **6** tanque na reserva, **7** viaduto com elevado (Fase 8.6), **8** túnel (Fase 8.7).
- [x] Testes unitários das funções puras (consumo, abastecimento, vácuo).

Critério de aceite: build, lint e testes verdes. Golden muda só em commits próprios (HUD do combustível; caminhão e vácuo mudam o trânsito e a corrida). No navegador: o posto aparece e abastece; a pane seca não encerra a rodada; o convite de racha aparece, aceita com [F] e termina com resultado; obra, comboio e óleo aparecem e se leem a tempo; vácuo aparece no HUD atrás de um carro.

**Como testar** (solo, `http://localhost:5173/autodash`):
1. Menu → [ENTER] → garagem → **[J]** (pílula "racha [J]"). Largada normal com o tanque em 40%.
2. Logo depois do verde: medidor **COMB** ao lado do NOS e "⛽ … m" acima dele; placas azuis com bomba (POSTO, À DIREITA, ENTRADA).
3. Pegue a faixa da direita que descola da pista e passe pela cobertura "POSTO 24h" a **até 70 km/h**: "ABASTECENDO", a barra sobe ~20% por segundo. Acima de 70 aparece "reduza pra 70".
4. ~4 s depois do verde (acima de 70 km/h) um desafiante encosta ao lado com **pisca-alerta** e o painel "te chamou pro racha". Pisque o farol **[F]** em até 7 s para aceitar (ou ignore: ele buzina e vai embora).
5. Na disputa: painel com "faltam … m" e a vantagem (▲ azul na frente, ▼ laranja atrás). Fique atrás dele numa faixa vizinha: ele acende o freio, balança e **fecha a sua faixa** 0,5 s depois. Finta (troca de lado) funciona. Encostar empurra, não mata.
6. Fim: placa quadriculada CHEGADA; vencer mostra "+1 REP" (a reputação fica salva na config).
7. Cole atrás de qualquer carro rápido na mesma faixa: "💨 VÁCUO +n%" acima do carro e linhas de ar; ao sair, "ESTILINGUE".
8. Durante o solo, teclas **3** obra, **4** comboio, **5** óleo, **6** tanque na reserva, **1** posto, **2** racha. Observe: seta âmbar piscando e trânsito saindo do lado fechado (obra); fresta que anda com seta de 1,3 s e "FRESTA!" ao passar (comboio); carro batido com pisca-alerta e "ÓLEO!" com o carro dançando (óleo); caminhões dando seta longa e "ensaiando" antes de trocar de faixa.
9. Pane seca: tecla 6, depois passe reto pelo posto. Com o tanque a zero o carro engasga, não acaba a rodada, e outro posto abre.

Como ficou (diferenças do plano):
- Vácuo passa da máxima porque `sim/update.ts` entrega ao passo longitudinal um `topSpeed` até 4% maior (`specComVacuo`); `sim/longitudinal.ts` não mudou. Medido em reta atrás de um caminhão (força 0,9): 246 → 253 km/h em 12 s. O teto desce em 1 s ao sair (estilingue), sem degrau.
- Desafiante do racha acelera ~10–13 km/h/s (o carro padrão faz ~8–12 entre 120 e 200). O primeiro valor (30–40) deixava o jogador para trás sem chance.
- Comboio fica 18 s (não 16) e a fresta só anda se a faixa destino estiver livre: com trânsito em volta ela anda pouco.
- Posto: placas "POSTO / À DIREITA / ENTRADA" (sem km: as distâncias do jogo não são km reais); o HUD mostra os metros até a bomba pela escala do hodômetro.

Pendente / não verificado:
- Playtest de verdade: tudo foi conferido no navegador avançando quadros por script (o painel do navegador estava oculto e o `requestAnimationFrame` parava), com teclas de debug e posições forçadas. Não foi jogado com teclado em tempo real; som não foi ouvido.
- Números de palpite a calibrar: consumo (tanque de ~4 min de pé no fundo), 20% por segundo na bomba, ritmo e `fecha` dos desafiantes, chance do caminhão (1 troca a cada ~11 s por caminhão), aderência no óleo (35%), força do vácuo.
- ~~Eventos antigos no `Math.random`~~: resolvido em 15/11 (ritmo dos eventos). A polícia (`world/policia.ts`) ainda usa `Math.random`.
- Achado fora do escopo: as viaturas estacionadas da blitz e do radar nascem a 102 mil unidades e o spawner mata estacionado acima de 88 mil, então provavelmente somem no primeiro quadro (leitura de código, não verificado; interessa à Fase 6).

Fora desta fase (registrado para depois): diretor de intensidade (pesquisa 4.2), quase-batida graduada (4.4), E7 nos bots da corrida, som do abastecimento (função `somAbastecer` existe e não toca nada: implementação fica com a sessão de som), botão de toque para aceitar o racha.
### Fase 6 — Polícia por estrelas — `implementada` (hashes no log; juntada à Fase 5 em 14/11; aguardando playtest)
Feita em paralelo com a Fase 5 por pedido do usuário. Insumo: `docs/pesquisa/visual-e-desafio.md` 4.5–4.6 (E8, E10, E13). Lógica em `world/policia.ts` (estado, tabela, regras), desenho em `render/policia.ts`; `engine.ts` ganha só o campo `policia`.

**Regras (provisórias, ver Decisões em aberto)**
- **Calor** de 0 a 5,99; estrelas = parte inteira. Sobe com infração e com tempo de perseguição; nunca passa de 5★.
  - Infrações: radar (+1), furar blitz (+2), encostão em viatura (+0,25), bater no bloqueio = preso.
  - Tempo: +1★ a cada 30 s em que a polícia te **vê** (viatura a menos de 10.000 u, ou você dentro do holofote).
- **Despiste:** depois de 6 s de perseguição, ficar sem ser visto pelo tempo da tabela faz as viaturas desistirem e o helicóptero ir embora (+1.500 pontos × estrelas). Aí o calor **esfria**: perde 1★ a cada 8 s, com as estrelas piscando. Infração nova durante o esfriamento reabre a perseguição no nível atual.
- **Prisão** (fim da partida solo, texto de polícia no game over): encostão que te joga fora da pista (já existia) ou batida em viatura do bloqueio.
- **Fuga honesta (ADR 0008):** o teto da viatura sobe com as estrelas, mas é sempre `topSpeed do carro − 8 km/h`, no máximo. O helicóptero segue a mesma regra (−10). Em reta limpa todo carro escapa.

| ★ | Viaturas | Teto (km/h) | Arrancada (km/h/s) | Despiste (s) | Evento |
|---|---|---|---|---|---|
| 1 | 1 | 205 | 50 | 3 | radar e blitz (o gatilho) |
| 2 | 2 | 215 | 55 | 4 | viaturas na cola (a perseguição de antes) |
| 3 | 3 | 222 | 60 | 5 | E8 tapete de pregos a cada ~22 s |
| 4 | 4 | 228 | 65 | 6 | + E10 bloqueio com fresta (alterna com os pregos) |
| 5 | 4 | 234 | 70 | 7 | + E13 helicóptero com holofote |

**Checklist**
- [x] Nível de procurado: tabela `ESTRELAS`, calor, infrações, tempo, despiste, esfriamento (`world/policia.ts`). Radar e blitz viram infração (`world/zones.ts`). 7 testes das regras puras (`__tests__/policia.test.ts`) e 3 cenários no engine real (`__tests__/policia.cenario.test.ts`, 3★, 4★ e 5★, sem render, menos de 1 s).
- [x] Viaturas como estratégia de tráfego: `PoliceDriver` lê teto e arrancada da viatura (`Traffic.top`, `Traffic.accel`), definidos pela estrela. Reforço chega por trás quando a estrela sobe (nunca nasce na frente).
- [x] HUD de estrelas no topo, à direita do retrovisor (abaixo da barra no duelo): estrelas cheias e vazias, progresso da próxima, "TE VIRAM" em vermelho e azul, barra de despiste, estrela piscando no esfriamento, aviso de pneu furado e de holofote.
- [x] E8 tapete de pregos (≥3★): placas, viatura no acostamento, tapete com reflexo âmbar em 2–3 faixas, sempre uma faixa livre. Pneu furado por 8 s: teto ×0,75, aderência ×0,8, faísca no aro. Não para nem teleporta.
- [x] E10 bloqueio com fresta (≥4★): três viaturas atravessadas (tipo `roadblock`), a fresta numa faixa do meio e o acostamento livre. Civis que chegam encostam na fresta. Fresta dá bônus; acostamento perde velocidade no chão; bater = preso.
- [x] E13 helicóptero (5★): holofote no asfalto logo à frente do carro, segue com atraso; dentro dele você é visto. Teto 230 (sempre 10 abaixo do carro). Embaixo do viaduto ele te perde por 4 s. Sprite no céu com facho e farol.
- [x] Tecla de debug **O** (só solo, correndo): sobe uma estrela. Volta para a lista O L B V J K I U.
- [x] Atalho de teste **[L] na garagem** (era [P]; mudou no merge com a Fase 7) (como o [Z] do motor): larga já perseguido em 1★, sem evento de mapa sorteado; correndo, **0–5** põem a caçada direto na estrela (0 encerra) e o calor não sobe sozinho. A garagem mostra "testes: [Z] motor · [P] polícia".
- [x] Gancho da sirene: `eng.policia.sirene` (0..1, pela viatura mais perto). **TODO (sessão do som):** tocar a sirene com pan pela viatura; aqui só o valor é calculado.

Critério de aceite: sem perseguição o jogo é idêntico (golden inalterado, ou muda só em commit próprio e justificado). No navegador: furar o radar dá 1★ e uma viatura; a estrela sobe com o tempo; 3★ traz pregos, 4★ bloqueio, 5★ helicóptero; despistar zera as viaturas e as estrelas esfriam. Build, lint e test verdes.

**Como testar** (garagem → **[L]**, pílula "polícia [L]"; segure W):
1. **1★** (largada): uma viatura chega por trás; o painel à direita do retrovisor diz "TE VIRAM" e o aviso "TESTE · estrelas nas teclas 0–5". Abra distância em reta: a barra "DESPISTANDO" enche, as viaturas desistem (+pontos) e a estrela esfria piscando.
2. **2★** (tecla 2): duas viaturas, o ritmo de perseguição de antes.
3. **3★** (tecla 3): três viaturas; em ~2 s, três placas PARE ("PREGOS 2 km/1 km") e um tapete prateado com reflexo âmbar em 2 faixas, viatura parada no acostamento. Ache a faixa livre; se passar por cima: "PNEU FURADO", faísca no aro, carro preso em 75% da velocidade final por 8 s.
4. **4★** (tecla 4): quatro viaturas; giroflex no horizonte e placas "BLOQUEIO"; três viaturas atravessadas com a fresta numa faixa do meio. Fresta = "PASSOU NA FRESTA! +2500"; acostamento passa mas freia na grama; bater = "POLÍCIA TE PEGOU". Os eventos alternam bloqueio e pregos.
5. **5★** (tecla 5): "HELICÓPTERO!", facho e círculo de luz no capô ("NO HOLOFOTE"). Pé no fundo em reta (acima de 230 km/h) deixa a luz para trás ("FORA DO HOLOFOTE"); embaixo de viaduto: "TE PERDEU DE VISTA".
6. **0** encerra a caçada. Fora do teste, o caminho natural é radar (1★) ou blitz (2★) a partir do nível 4, e a tecla **O** sobe uma estrela.

**Resultado (14/11):** golden inalterado em todos os commits. Conferido no navegador (porta 5182, quadro a quadro, porque o painel do navegador estava oculto e o `requestAnimationFrame` parava): HUD ao lado do retrovisor; 3★ com três viaturas no retrovisor; placa PARE de longe; tapete com faixa livre; bloqueio com giroflex visível de longe e "PASSOU NA FRESTA! +2500"; helicóptero com holofote no capô, que perde o carro acima de 230 km/h e deixa despistar.
- **Bug antigo corrigido no caminho** (380d989): as viaturas paradas da blitz e do radar morriam no quadro em que nasciam (o tráfego matava parado a mais de `DRAW_DIST + 140` segmentos, e os eventos nascem a 1,7 × `DRAW_DIST`). Agora aparecem.
- Pendente / não verificado:
  - Sirene: só o valor `eng.policia.sirene` existe. **TODO da sessão do som** (`audio.ts` e `sound/` não foram tocados).
  - Os eventos da polícia sorteiam com `Math.random` (como `world/events.ts`). Trocar pelo RNG da seed junto com o diretor de intensidade (pesquisa 4.2).
  - Eventos da polícia não criam zona: o sorteio comum (blitz, obra) pode cair perto de um tapete ou bloqueio.
  - `spawnPoliceChase` (`world/events.ts`) ficou sem uso. Não removido para não conflitar com a Fase 5; apagar depois do merge.
  - Balanço (tabela, 30 s por estrela, 8 s de esfriamento, despiste por estrela, alvo e teto do helicóptero) é palpite: calibrar no playtest. Reforço nasce a 150 km/h quando o carro está devagar e pode ultrapassar e "desistir" (lógica antiga do `PoliceDriver`); só aparece com a tecla O em baixa velocidade.
  - Não testado: duelo (HUD abaixo da barra), celular, helicóptero perdendo o carro sob o viaduto (só no teste de regra, não na tela), fila de civis na fresta.
### Fase 7 — Customização estética (bodykit, som, efeitos) — `pendente` (som do motor antecipado)
- [x] Som de motor por pulsos de combustão (`sound/`), um perfil por motor (14 motores) e um motor por carro; turbo, flutter/blow-off, compressor Roots, estouros. Pesquisa em [docs/pesquisa/som-motor.md](../../pesquisa/som-motor.md).
- [x] Motor original de cada carro segue a inspiração dele (Mustang 71 → V8 cruzado Ford, Miata → I4 1.6, Silvia S15 → I4 turbo, RX-7 FD → rotativo, Supra A80 → I6 biturbo, R32 → I6 de corrida, 911 992 → boxer 6 biturbo, Z → V6 aspirado). Decisão do usuário (13/11): "depende do carro"; por enquanto o jogador escolhe.
- [x] Garagem: seletor de motor [E] salvo por carro (`CarCustom.motor`), com acelerada de amostra ao trocar.
- [x] Motor real na física (`physics/motores.ts`): cada motor tem lenta, faixa vermelha, corte e curva de força de um motor real da mesma família (V8 de 71 corta em 6000 com força embaixo; VTEC e V10 passam de 8500; V12 vai a 9250), e o turbo tem atraso de verdade (enche com giro e pé, segura na troca, esvazia ao aliviar). Câmbio automático, largada, conta-giros e corte do som seguem a faixa do motor. A velocidade de cada marcha é a mesma para todo motor e a área da curva é igualada: o motor muda ONDE está a força, o `power` do carro continua decidindo quanto ele anda. Medido em reta (0–200 com largada): carros dentro de ±12% do antes, exceto SYLVA (+22%) e TARGA (+15%), que ficam perto da máxima e amplificam a diferença. Trocar o motor na garagem troca também a física (swap).
- [x] Som por **guias de onda** (modelo físico, `sound/waveguide-synth.ts`): port do enginesound (DasEtwas, MIT; Baldan et al. 2015) com carga do acelerador e corte por cilindro. Volume por tabela pré-calculada (`sound/ganhos-motor.ts`, regenerar com `GERAR_GANHOS=1`).
- [x] **Turbo** com eixo de inércia própria: apito sobe em cada marcha e desce assobiando depois do alívio; turbina por motor (faixa do apito, tempo de desaceleração, biturbo/quadri desafinados).
- [x] **Turbo por modelo no worklet** (`sound/turbo-synth.ts`, 15/11): o apito deixou de ser três senos. Agora é a passagem das pás com largura (ruído ressonante no tom), tremor do eixo e pulsar no ritmo do escape (biturbo: duas turbinas defasadas). O sopro do compressor pulsa com a admissão. Blow-off com estalo da válvula e jato que desce de tom com a pressão. Flutter em surtos cada vez mais lentos, com pio do eixo e apito engasgando. Assobio audível na descida do eixo depois do alívio. O gatilho do alívio agora trava entre 0,5 e 0,3 (`GatilhoAlivio`), então o pedal analógico também alivia. Render offline: `render-motor.test.ts` gera `_turbo.wav` (puxada, alívio, troca, alívio) para os motores turbo. Amostras em `docs/pesquisa/audio-turbo/`.
- [x] **Playtest 15/11 (tarde):**
  - Turbo: o eixo do som agora segue o fluxo do escape (giro), não só a pressão. Com o W sempre apertado o apito ficava parado no máximo; agora sobe dentro de cada marcha e cai na troca (`eixoDoSom`).
  - Costa: o mar, as palmeiras e o píer andam juntos na curva (`COSTA_PARALLAX`). As palmeiras corriam a 0,6 por cima de um mar a 0,25 e o píer ficava parado na tela, o que dava enjoo.
  - SYLVA (S15) era o esportivo mais lento ("parece um Onix turbo"): turbo cheio em 3500 com atraso de 0,33 e peso 0,3, e power 45 → 50. O 0–200 caiu de 30,7 s para 24,6 s (tabela em `medidas.test.ts`).
- [x] **Câmbio por carro** (`physics/cambio.ts`): MUSCLE 4, ROADSTER/ROTOR/KAIJU 5, TARGA 8, FANTASMA 9; 1ª e última iguais para todos.
- [x] **Giro com caráter**: giro solto por motor, limitador duro/suave, lenta irregular (V8 bravo e rotativo).
- [x] **V8 novo (14/11):** banco `v8-escape` (Chrysler 1964 na lenta + NASCAR no meio + Studebaker filtrado no alto) nos dois V8 cruzados; mixagem com a gravação mandando (`sint`, `corpo`, `topoHz`, `burble` em `Gravacao`); `v8-plano` com a mesma mixagem e o banco antigo. Diagnóstico, números e candidatos em [docs/pesquisa/som-motor-2.md](../../pesquisa/som-motor-2.md) (Parte V8); receita em `web-garagem/tools/som/README.md`; áudio de antes e depois em `docs/pesquisa/audio-v8/`. **Falta ouvir.** Roteiro abaixo.
- Próximo passo de fidelidade (precisa de aprovação para baixar arquivos): híbrido com gravações CC0 (pesquisa, seção 4) como textura e eventos (partida, pops reais).
- Em aberto: inspiração do GT (V10), do NINJA (I4) e do ALTA (I4) foi palpite pelo nome; FANTASMA confirmado como Koenigsegg (V8 plano biturbo). Calibrar de ouvido: não foi ouvido, só medido offline.

#### Roteiro de escuta dos V8 (teste de motor: garagem → [Z]; `[` e `]` trocam o motor)

Para cada um dos três (`V8 virabrequim cruzado`, `V8 cruzado aspirado, ordem Ford`, `V8 virabrequim plano`), com o carro que quiser. Antes, ouça `docs/pesquisa/audio-v8/antes_*.mp3` e `depois_*.mp3` (varredura de 15 s feita offline, sem estouros nem compressor do jogo).

1. **Lenta** (solto, motor ligado): tem de soar como escape grave e irregular (cruzado), sem zumbido liso de um tom só. Era síntese pura; agora é a gravação do Chrysler.
2. **Acelerada no grid** (segure o gás na contagem, ou em ponto morto com [N]): o giro sobe de ~800 a ~4000; ouça se há um "degrau" de timbre em torno de 1000–2000 rpm (o buraco entre as gravações, onde o grão é esticado) e se a subida fica fraca demais perto de 1500 rpm (a lenta ficou mais baixa que antes).
3. **Puxada em 3ª** de 2000 até o corte: o timbre deve engrossar e subir de forma contínua. Pontos a conferir: a emenda em ~3500 rpm (NASCAR → Studebaker) e o alto (5000–6000), que antes era fino e agora é filtrado em 3 kHz: abafado demais ou bom?
4. **Corte de giro** (6200–6400 nos cruzados): o limitador bate com falha de ignição; a síntese assume acima de ~7600 rpm.
5. **Desaceleração**: tire o pé a partir de ~3000 rpm. O cruzado deve "borbulhar" (estouros graves e mais seguidos que antes); o plano não borbulha.

Se algo estiver errado, os botões são `sint` (mais síntese = mais corpo e mais zumbido), `corpo` e `topoHz` (timbre) e `burble` em `GRAVACAO_DO_PERFIL`, em `sound/profiles.ts`; o filtro do Studebaker e a curva de volume por giro estão no comando de `juntar.py` do README das ferramentas.

#### Fase 7 — parte visual (bodykit, efeitos, prévia, câmera, torque) — `implementada` (hashes no log; aguardando playtest)
Fontes: D12, D16 e D17; `docs/pesquisa/visual-e-desafio.md` §1.4 (prévia da pintura contra a cena) e §2.2 (FOV dinâmico); `docs/pesquisa/fisica-carro.md` R2 (zoom ≤ 1,05, `PLAYER_Z` não pode mudar); ADR 0012 (torque no HUD). **Estética não muda a física**: nenhum campo novo é lido por `sim/`, `physics/` ou pela colisão.

Checklist:
- [x] **Bodykit como dados** (`cosmetic/bodykit.ts`), salvo em `CarCustom` por carro: kit de carroceria (sem kit, saias laterais, saias + difusor, widebody), aerofólio (os 3 de antes + asa alta), aro (padrão, aro fundo, corrida, turbofan), altura (original, rebaixado, stance com cambagem). Desenhado no sprite do carro (`drawPlayerCar`) e na garagem. Configuração salva por versão antiga carrega com o padrão (sem kit, aro padrão, altura original), que desenha **igual** a antes.
- [x] **Efeitos**: cor da fumaça do escape (padrão, branca, preta, azul, rosa, verde) e cor da chama do nitro (laranja, azul, roxa, verde). Neon por baixo continua o de antes (`NEONS`). Padrão desenha igual.
- [x] **Atalho de vitrine** [1] (garagem e prévia): presets prontos de bodykit, neon e escape para comparar; volta ao seu no fim do ciclo.
- [x] **Garagem, aba estética** [H]: as opções novas ficam numa aba própria do painel, para não espremer a aba do carro. Teclas novas: [S] kit, [W] aro, [A] altura, [F] fumaça, [Q] chama, [D] câmera; as antigas ([C] [V] [B] [R] [G]) seguem valendo nas duas abas.
- [x] **Prévia na pista** [P]: esconde o painel e mostra o carro no tamanho do jogo, na pista do bioma escolhido, no horário e clima escolhidos (O, K e X trocam ao vivo). Mostra o contraste da pintura contra o asfalto da cena (razão WCAG, §1.4) e avisa quando a pintura "some" (< 2:1).
- [x] **FOV dinâmico** (só desenho): o campo de visão abre de 100° para até 104° entre 150 km/h e a máxima, com a câmera andando junto para o carro do jogador ficar no mesmo lugar e no mesmo tamanho ("dolly zoom"). `CAM_DEPTH` e `PLAYER_Z` não mudam; a colisão não muda. Opção na garagem para desligar ("câmera: fixa"), contra enjoo.
- [x] **Torque no HUD**: mini curva de força do motor ao lado do conta-giros, com um ponto no giro atual e a faixa de força máxima marcada (pendência do ADR 0012).

Critério de aceite:
- Carro com customização padrão desenha igual a antes: o golden só muda pelos itens novos de tela (aba da garagem, câmera, torque), cada um em commit `test:` próprio com linha no Log.
- Nenhum valor de física muda: `medidas.test.ts` e os testes de tração passam sem mexer.
- Navegador: cada peça do bodykit aparece na garagem e na pista; fumaça e chama trocam de cor; a prévia muda com bioma, horário e clima; a 200 km/h o fundo "abre" sem o carro mexer na tela; nada de tremor novo.
- Desempenho: o bodykit são até ~8 formas a mais por quadro, sem gradiente novo por quadro.

Decisões provisórias (a confirmar pelo dono, ver seção 7):
- Bodykit é **só visual** e liberado desde o começo (D17 trava só tuning e aerodinâmica com efeito). Aerofólio e difusor não dão pressão aerodinâmica.
- Na corrida online e nos bots, os outros veem só a pintura (a rede leva só `paint`); bodykit dos rivais fica para depois.
- FOV dinâmico ligado por padrão, com teto de +4° (abaixo dos +6° da pesquisa) por ainda existir o zoom de velocidade do R2; os dois juntos ficam ≤ 1,05 de escala no carro.
- Luz de recorte, grading (G2), bloom falso (G6) e a opção "Visual leve/completo" da pesquisa ficam fora desta leva.

Como testar (garagem do solo, `/autodash` → ENTER):
1. **[H]** abre a aba estética. **[1]** é o atalho de vitrine: cada toque troca o carro inteiro por um visual pronto (rua limpa, drift JDM, time attack, neon noturno; a pintura fica a sua) e, depois do último, volta exatamente ao seu. Observe: saias, difusor, alargadores com rebites, aro, carro mais baixo com roda inclinada (stance), asa alta.
2. **[S] [W] [A] [G]** trocam kit, aro, altura e aerofólio uma peça por vez; **[F] [Q]** a cor da fumaça e da chama; **[C]** a pintura. A linha "pintura no asfalto desta cena" fica vermelha quando a pintura some (< 2:1).
3. **[P]** prévia na pista: o carro no tamanho do jogo. **[X] [O] [K]** trocam bioma, horário e clima ao vivo; **[1]** continua trocando o visual. Segure **[espaço]** (chama do nitro) e **[W]** (fumaça). Observe se a pintura e o neon aparecem à noite e na chuva. **[P]** ou **[ESC]** volta.
4. **FOV e câmera:** **ENTER** (ou **[Z]**, pista vazia), acelere até passar de 150 km/h e segure; depois o nitro. Observe: o fundo e a pista "abrem" devagar (uns 7% no longe) sem o carro mudar de lugar nem de tamanho, e sem tremor novo; numa batida a lente fecha em ~0,6 s, sem tranco. Compare com **[D]** na aba estética (câmera: fixa). Se der enjoo, anote a velocidade.
5. **Torque:** ao lado do conta-giros (só no PC). O ponto deve andar pela curva com o giro; nos turbo, a curva azul sobe até a cinza quando o turbo enche. A faixa verde é o pico de força: trocar perto dela.

Pendente / não verificado:
- Playtest: nada foi jogado por gente; os números (altura, abertura da lente, tamanho dos alargadores) são palpite a calibrar.
- O FOV foi conferido por teste numérico da lente (`__tests__/fov.test.ts`) e por screenshot a ~210 km/h sem defeito, mas não lado a lado com a câmera fixa; enjoo só se mede jogando. No navegador, o painel ficou oculto e os quadros foram tocados por um laço de `MessageChannel` no lugar do `requestAnimationFrame` (ADR 0007).
- Vitrine [1]: o "seu" visual guardado vive só na sessão; recarregar a página no meio do ciclo faz o preset atual virar o seu. Trocar de carro no meio deixa o carro anterior com o preset aplicado.
- Asa alta encosta de leve no texto de crédito da gravação na garagem (motor com gravação real).
- Bodykit não vai para a rede: rivais online e o fantasma do duelo aparecem sem kit.
- Torque no HUD fica fora no celular; sem lugar definido para ele com os botões de toque.
- Estouro do escape (pop) com chama visual: depende do evento de estouro do som (`sound/`, outra sessão); não ligado.

Fases 4 em diante só são detalhadas quando a anterior for aprovada.

### Fase 8 — Mundo com detalhe (NPCs, posto, eventos, cenário, biomas) — `planejada` (16/11)

Pedido do playtest de 15–16/11: "elevar os detalhes do jogo". A jogabilidade base
foi aprovada; esta fase é sobre o mundo ao redor. Ordem por impacto e risco: primeiro
o que é bug ou atrito em toda partida, depois o que é visual.

Fatos do código hoje (16/11):
- `CivilianDriver` (traffic/driver.ts) procura o carro da frente só em `world.traffic`:
  **o jogador não entra na busca**. Parado ou lento na faixa, o civil chega por trás e
  só a colisão do spawner resolve. É a queixa "eles não param quando eu tô na frente".
- Cenário de beira (render/road.ts) é um padrão fixo de 3 enfeites: árvore do bioma a
  cada 4 segmentos, poste a cada 10, prédio a cada 51. Nada muda ao longo da pista.
- Bioma (world/biomes.ts) muda só céu, camadas de fundo e a árvore. O traçado
  (world/track.ts) é o mesmo para qualquer bioma: a costa tem o mesmo desenho de pista.
- Posto (world/posto.ts, render/eventos.ts) é cobertura + bombas num ramal; não há
  carros, loja nem parada de verdade (abastece andando a até 70 km/h).

Checklist (cada item é um commit verificável; golden muda só em commit próprio):

**8.1 NPCs respeitam o jogador** (bug de jogo, pequeno) — feito em 16/11, exceto o farol alto e o racha
- [x] Civil, caminhão e comboio (o desafiante do racha ainda não) veem o jogador como "carro da
  frente" na faixa (mesma busca de `ahead`, com a velocidade real do jogador).
- [x] Freio com distância de parada (a regra `vAtras` da viatura, 15/11) em vez de
  `ahead.speed × 0,7` quando o gap fica curto; luz de freio acesa quando freia.
- [x] Parado atrás de você por mais de ~1,5 s: buzina curta e tenta passar pela faixa
  livre (sem cortar ninguém). Lento demais na faixa da esquerda: farol alto.
- [x] Teste (unidade, `civil-jogador.test.ts`): jogador parado numa faixa por 10 s com trânsito, zero
  sobreposição de corpo com civis; civil desvia ou para atrás.

**8.2 Posto de verdade** (o pedido mais citado) — feito em 16/11, exceto o carro saindo do posto
- [x] Cenário do posto: cobertura com teto iluminado à noite, 2–3 ilhas de bombas,
  loja de conveniência com vitrine, totem de preço na entrada, faixa pintada de
  entrada e saída, calçada. Marca genérica (nada de marca real).
- [x] Carros no posto: 1–3 civis parados nas bombas (sprites `parked`). Falta: às vezes um
  saindo pela faixa de aceleração e entrando na pista com seta (usa a regra do 8.1).
- [x] Parada de verdade: parar no box da bomba (≤ 5 km/h) enche rápido (bico + barra
  de litros); passar devagar continua enchendo devagar como hoje. Som de bomba.
- [x] Teste: posto gera carros parados que nunca ficam na pista; abastecer parado é
  mais rápido que passando.

**8.3 Eventos com mais detalhe** (visual + leitura)
- [ ] Obra: máquina (retroescavadeira), cavaletes com luz piscando, trabalhador com
  bandeira, placas "OBRAS 500 m".
- [ ] Acidente/óleo: dois carros batidos no acostamento com pisca-alerta, triângulo,
  viatura ou guincho parado; mancha com reflexo.
- [ ] Blitz/radar: cones em funil, viatura com giroflex, guarda com colete; placa do
  radar com a velocidade.
- [ ] Comboio: batedor com giroflex âmbar na frente e placa "CARGA LONGA".
- [ ] Cada evento com 1 som próprio curto (buzina de caminhão, sirene curta, britadeira).

**8.4 Cenário por trechos** (sistema, depois conteúdo)
- [ ] `world/cenario.ts`: o bioma passa a ter TRECHOS (dados): tipo, comprimento,
  densidade e lista de enfeites com lado, distância da pista e variação. A pista
  alterna trechos (ex.: cidade densa → subúrbio → campo) com transição.
- [ ] Enfeites novos (sprites em canvas, sem imagem externa): prédios de alturas e
  cores variadas, casas e muros, outdoor, ponto de ônibus, passarela, guard-rail
  contínuo, cerca, plantação, placas de saída, árvores de 3 tipos.
- [ ] Orçamento de desempenho: teto de enfeites por quadro e o corte de distância que
  a corrida já usa (o desenho de beira era 70% do quadro na corrida).

**8.5 Biomas novos e pista por bioma**
- [ ] Traçado por bioma (perfil de curvas e morros como dados): cidade (curvas médias),
  costa (orla com curvas longas e abertas), serra (curvas fechadas e subidas).
- [ ] Bioma **serra**: montanhas perto, pinheiros, neblina frequente, guard-rail,
  túnel curto (reaproveita o eco do viaduto no som).
- [ ] Bioma **rodovia/interior**: retas longas, campo, caminhões mais frequentes,
  pôr do sol largo, postos mais espaçados (o combustível passa a importar).
- [ ] Bioma no solo muda ao longo da partida (a cada N níveis) com transição suave,
  em vez de ser escolhido só no menu.

**8.6 Viaduto de verdade** (pedido de 16/11: "mais funcional e mais bonito") — feito em 16/11 (elevado no lugar de "subir no viaduto"; falta a viatura de tocaia e o carro parado na alça)
- [x] Hoje o viaduto é um sprite que cruza por cima mais uma alça de acesso à direita
  com carros entrando. Passa a ser um trevo: alça de SAÍDA antes (carros saindo da
  pista com seta) e alça de ENTRADA depois, com carros usando as duas.
- [x] Caminho para subir: ramal (ADR 0014) que sobe a alça e cruza por cima do viaduto
  e volta à pista mais à frente (atalho ou caminho alternativo com trânsito próprio).
- [ ] Mais eventos no viaduto: carro parado no acostamento da alça, viatura de tocaia
  embaixo (com estrelas), helicóptero perdendo você embaixo (já existe, fica visível).
- [x] Visual: pilares com sombra, juntas de dilatação, iluminação à noite, pichação.

**8.7 Túnel raro** (como a ponte: zona longa que aparece de vez em quando) — feito em 16/11
- [x] Zona `tunnel`: entrada com boca de concreto, teto e paredes com luzes em fila
  passando, escuro com faróis, saída com o clarão. Rara no sorteio (peso baixo).
- [x] Som: eco forte do motor (reaproveita o eco do viaduto). Helicóptero te perde lá dentro.
  Falta: o ronco de ventilação e o radar.
- [x] Cartão de aviso "TÚNEL" e placa de faróis; chuva para lá dentro.

Pendências que ficaram da rodada de som (15/11), fora desta fase: V6 biturbo ainda no
VQ35 aproximado; W16 e rotativo só síntese; puxada de pé leve (E) não gravada.

Critério de aceite da fase: build, lint e testes verdes; golden muda só em commits
próprios com linha no log. No navegador: civil não bate na sua traseira parado; o
posto tem carros e dá para parar na bomba; cada evento tem um detalhe novo visível de
longe; dá para ver pelo menos 2 tipos de trecho de cenário numa partida; serra jogável;
o viaduto tem carros saindo e entrando e um caminho por cima; o túnel aparece de vez em quando.

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
| 2026-11-13 | 8cceb5a | Motor real na física: lenta, corte, curva e turbo por motor; câmbio, largada e conta-giros seguem o motor. | atualizado nos 3 cenários (carro padrão agora com V10 de 8700 e conta-giros até 9). |
| 2026-11-14 | 115de27, 684bca6, b0a95b7, b1e8816 | Som por guias de onda, turbo com eixo, câmbio por carro (4 a 9 marchas), giro com caráter. | atualizado (solo pela garagem; cenários pelo giro do grid). |
| 2026-11-14 | 9f709ef … c5d95e7 | Feel da física (R1–R6, P4, P5 de `docs/pesquisa/fisica-carro.md`): giro na troca, limitador físico, patinada visível, câmera (zoom, trauma, chute), spool por giro, rampa do acelerador, eixo do turbo com memória, teto suave. Trava de equilíbrio em `__tests__/medidas.test.ts`. | atualizado em R1 e R3 (giro no hash), R2 (câmera nas 2 corridas), P5 (corrida com bots) e em 2904a91 (estado do áudio). Detalhe na seção "Aplicado" da pesquisa. |
| 2026-11-14 | dc3a831 … e0b6a30 | Motor com gravação real CC0 (Renault 19, grãos síncronos ao giro, `sound/motor-gravado.ts`, `tools/som/`) nos 4 cilindros e como textura nos demais; partida com chave no grid; ambiente por convolução e eco sob o viaduto; revisão do som (janela com giro variando, falha do limitador, NaN, corrida no carregamento, folga antes da saturação). Pesquisa de gravações por família em `docs/pesquisa/gravacoes-motor.md` (baixar exige aprovação por arquivo). | atualizado em 2904a91 (estado do áudio). |
| 2026-11-14 | (este) | Giro solto com velocidade máxima por motor (`giroSolto`); conta-giros e som seguem `giroSom`, que desliza até o giro da física (τ 45 ms) e não pula na troca; carga mínima de 0,45 na troca (som não corta); apito do turbo pela pressão da física. Modo de teste de motor: garagem [Z], pista vazia, `[ ]` troca o motor. | atualizado nos 3 cenários: conta-giros desenha `giroSom` e o giro do grid sobe mais devagar. |
| 2026-11-14 | c5a233d | Fase 5 detalhada no guia (checklist, aceite, decisões provisórias). | não alterado |
| 2026-11-14 | 6f350ff, 4f8689f | Fase 5: combustível e posto no solo (tanque, consumo por pé/giro/nitro, posto como ramal, pane seca). | atualizado no replay solo: medidor COMB no HUD. |
| 2026-11-14 | dccd3c0 | Fase 5: convite de racha com reputação e rival que fecha (E7). | não alterado (o convite vem depois do fim dos replays). |
| 2026-11-14 | b0f8e84, 9e5cc4c | Fase 5: obra com estreitamento (E4), comboio com fresta (E6), óleo após acidente (E15) no sorteio de eventos. | atualizado no replay solo: o evento sorteado do replay mudou. |
| 2026-11-14 | c9d0bcd, 754833d, 661cf0a | Fase 5: vácuo com estilingue (E9) e caminhão trocando de faixa (E1). | atualizado: corrida com bots pelo vácuo, solo pelo caminhão (atribuição medida). Clique e duelo não mudam. |
| 2026-11-14 | 87fbcba | Atalho de teste da Fase 5 na garagem [H] e roteiro "Como testar". | atualizado no replay solo: pílula nova na garagem (+98 chamadas). |
| 2026-11-14 | 606bfc6, aeac94c, ad362c4, e29459e, e334e16 | Fase 6: GUIA detalhado; nível de procurado (calor, infrações, despiste, esfriamento, viaturas por estrela, tecla O); HUD de estrelas; tapete de pregos (E8); teste de cenário com sonda no harness. | não alterado |
| 2026-11-14 | 380d989 | Viaturas paradas da blitz e do radar morriam ao nascer (limite à frente menor que o ponto de nascimento dos eventos). | não alterado (os replays não chegam à blitz) |
| 2026-11-14 | cdabbe9, 221bdd3, f124c6f | Fase 6: bloqueio com fresta (E10), helicóptero com holofote (E13), anúncio de estrela sem empilhar. | não alterado |
| 2026-11-14 | 6d3adc8, (este) | Atalho de teste de polícia: garagem [P], estrelas 0–5. Texto "testes: [Z] motor · [P] polícia" na garagem. | atualizado no replay solo (+35 chamadas: o texto na garagem). Cenas de corrida e duelo não mudaram. |
| 2026-11-14 | (merge da Fase 6) | Fases 5 e 6 juntas no branch do v2. Atalhos de teste da garagem viram três pílulas: motor [Z], racha [H], polícia [P] (depois [J] e [L], no merge da Fase 7); no teste de polícia os dígitos são só estrelas (eventos 1–6 da Fase 5 desligados). `limparTestes` em flow.ts. | atualizado no replay solo (+196 chamadas: as três pílulas no lugar de pílula + texto). Fim de partida igual. |
| 2026-11-14 | 64129fa, 4ad9eb5 | Fase 7 visual: guia detalhado; bodykit (kit, aro, altura, asa alta) e cor de fumaça e chama como dados em `CarCustom`, desenhados no sprite. Padrão desenha igual. | não alterado |
| 2026-11-14 | 582df8a, a8f9843 | Garagem: aba estética [H] e prévia na pista [P] com contraste da pintura no asfalto. | atualizado no replay solo (pills das abas, +196 chamadas). |
| 2026-11-14 | 32d23eb, 082980c | FOV dinâmico (dolly zoom, só desenho; `CAM_DEPTH`/`PLAYER_Z` iguais), desligável na garagem. | atualizado no replay solo e na corrida com bots (passam de 150 km/h). |
| 2026-11-14 | f733ffd, fb74fe0 | Torque do motor no HUD (mini curva e ponto no giro). | atualizado nos 3 cenários que dirigem. |
| 2026-11-14 | (merge da Fase 7) | Fases 5, 6 e 7 juntas. [H] e [P] da garagem ficam com a Fase 7 (aba estética e prévia); teste da Fase 5 vai para [J] e teste de polícia para [L]. O [F] não colide (farol na corrida, cor da fumaça na garagem). | atualizado (solo e cenários) pela soma das três fases. |
| 2026-11-15 | (neutro, aceleração, este) | Neutro escolhe a marcha pela velocidade; ESCALA_ACEL 0,65 (aceleração mais real, mesma final); fatorTroca e motor i6-aspirado; corte sem ruído sorteado; limitador no master. | atualizado (solo e cenários): as arrancadas ficam mais longas com ESCALA_ACEL. Fim das partidas igual. |
| 2026-11-14 | (partida) | Partida do motor como animação de 1,3 s antes do semáforo (D27): `countT` parado, sem luzes, sem gás, sem contagem de nada; HUD "ligando…" e tranco da câmera; ronco entra no fim. Duelo fica de fora. Teste em `__tests__/partida.test.ts`. | atualizado nos 3 cenários que largam (solo, corrida com bots, clique): a largada atrasa ~1,3 s. Duelo não mudou. |
| 2026-11-14 | (som V8) | V8 novo: banco `v8-escape` (CC BY: lonemonk e enginemusic, créditos atualizados), `juntar.py`, render offline do motor (`render-motor.test.ts`, só com `RENDER_MOTOR`), mixagem `sint`/`corpo`/`topoHz`/`burble` por gravação, `bancos-som.test.ts`. | não alterado (os replays usam o V10 e não carregam áudio) |
| 2026-11-15 | (merge partida + V8) | Branch da partida e do V8 junto às correções de neutro e aceleração. | atualizado (solo e cenários): soma da largada 1,3 s mais tarde com ESCALA_ACEL. |
| 2026-11-15 | (som: corte e V8, este) | Corte do limitador no som na batida da física (13 Hz, 55% cortado), na gravação e na síntese; antes era falha sorteada por explosão (chiado) e, no V8, a falha nem acontecia (sem grão de alívio no giro do corte). Estampido do corte grave. Grão em banco ralo: sorteio entre ≥12 candidatos sem repetir os 4 últimos (fim do pente acima de 4800 rpm). Alto do `v8-escape` com timbre casado ao meio (`casar_timbre.py`). Medido no render offline (`render-motor.test.ts` agora com 1,5 s de corte): ritmo do corte 1,2 → 9,1 no V8 cruzado; laço 0%. Pendente: V8 plano acima de 4200 rpm é só síntese (periódica). Playtest de 15/11: ainda ruim — começa razoável e, ao acelerar, "perde a textura original" e fica opaco (troca de fonte e esticamento). Precisa de outra abordagem, não de mais ajuste. | não alterado (som não entra no golden) |
| 2026-11-15 | (som: bancos do simulador, este) | Nova abordagem do som: 7 motores gravados no Engine Simulator (MIT) com puxada no dinamômetro, um motor da lenta ao corte, sem emenda: V8 GM LS, V10 LFA, V12 412 T2, I4 VTEC (B18C5), V6 (VQ35 aprox.), I6 2JZ e I6 (RB26 aprox.). Bancos `sim-*` (`trilha_dino.py`, `nivelar_lenta.py`); perfis quase só gravação (sint 0,05). V8 aprovado de ouvido pelo usuário antes de virar banco. Piso do ajuste de nível 0,4 → 0,25. | atualizado no replay solo (+35 chamadas: crédito da gravação do V10 na garagem). |
| 2026-11-15 | (eventos e polimento, este) | Cartão de aviso dos eventos no HUD (`world/avisos.ts`, `render/avisos.ts`): ícone, nome, dica, segundos até chegar, "AGORA" e "fim N s" nas zonas longas; substitui o texto de 1,6 s em todos os eventos (inclusive pregos e bloqueio). Textos flutuantes não se sobrepõem (`arrumarFloaters`). Ritmo (`RITMO` em `world/events.ts`): o relógio só conta sem evento rolando, 20–30 s no nível 1 caindo 2,5 s por nível até 9–16 s, 8 s de respiro na virada de nível, sem repetir os 2 últimos; sorteio dos eventos antigos no `eng.rngEv`. Teste em `__tests__/eventos-ritmo.test.ts`. | atualizado no replay solo (14479914 → 14487408 chamadas): o primeiro evento, aos 12 s, agora desenha o cartão e o sorteio interno vem da seed. Fim de partida igual. |
| 2026-11-15 | 931dfef, 9bda450, (volume, este) | Playtest 15/11. Turbo: na troca de marcha a pressão alivia (`aliviaNaTroca`) e o som do turbo vê carga zero (pssh e apito caindo); antes ficava cheio, como antilag. Força depois da troca igual (medidas inalteradas). Polícia: viatura olha o trânsito até 13 mil u e freia a tempo (não passa por dentro dos carros), só troca para faixa com folga, não fica parada logo à sua frente; 1★ com teto 195 e arrancada 42. Volume do motor 0,5 → 0,8 no master (+4 dB, `VOLUME_MOTOR`). | não alterado |
| 2026-11-15 | (som: segunda sessão do simulador, este) | Bancos novos gravados no Engine Simulator: Ferrari F136 no V8 plano (era a Ferrari 360 só até 4400 rpm; banco `v8-plano` removido), Chevrolet 454 no V8 do Ford, Audi 2.3 no 5 cilindros, Subaru EJ25 no boxer 4 e um VQ35HR nosso (coletores longos de mesmo comprimento num escape só, Tomei 264, volante leve) no V6; V10 e V12 regravados (V12 da lenta a 11690 rpm). `trilha_dino.py` ganha `LENTA=` (o pente pega o dobro da lenta no boxer e no VQ35HR). Piso do ajuste de nível 0,25 → 0,2 (`NIVEL_PISO`). Janelas e arquivos `.mr` no README de `tools/som`. Não ouvido no jogo ainda. | não alterado (som não entra no golden) |
| 2026-11-15 | (som: terceira sessão do simulador, este) | BMW M52 no 6 em linha aspirado (era o 2JZ), boxer 6 nosso (derivado do EJ25, ignição alternada como no 911) nos dois boxer 6 (era a gravação do 911 só até 3200 rpm; banco `boxer6` removido) e 3 em linha 1.0 nosso (derivado do Audi 5) no i3, que era só síntese. `marcas.py`: limiar 15/max(K,4) (no 3 cilindros a puxada virava "estável"). Não ouvido no jogo ainda. | não alterado (som não entra no golden) |
| 2026-11-16 | (Fase 8.1, este) | Civil e comboio enxergam o jogador na faixa (até 12 mil u) e freiam a tempo (v² = v_jogador² + 2·75·folga), parando atrás; luz de freio nos civis abaixo do cruzeiro; preso atrás de você por 1,5 s buzina (baixa, no máximo a cada 1,2 s) e tenta passar pela faixa livre. Teste em `__tests__/civil-jogador.test.ts`. Desafiante do racha ainda não vê o jogador. | atualizado nos 3 cenários (luz de freio dos civis, inclusive no trânsito de fundo do menu, e a freada atrás do jogador); fim das partidas igual. |
| 2026-11-16 | (Fase 8.2, este) | Posto de verdade: pátio com duas faixas de bomba e ilha no meio (guia amarela), cobertura com a marca genérica "POSTO AUTOHUB 24h", duas bombas com visor e mangueira, loja de conveniência com vitrine acesa à noite, totem de preço na entrada; 1–3 carros abastecendo na faixa de fora (estacionados, `eng.rngEv`). Bomba: passando devagar 4 L/s (era 10); parado ao lado da ilha 20 L/s; HUD com litros e dica. Som da bomba (clique, zumbido, trava). Estacionados vivem até 2×DRAW_DIST + 300 à frente (os do posto morriam ao nascer). Teste em `__tests__/posto.cenario.test.ts`. | não alterado (o posto não aparece nos replays) |
| 2026-11-16 | (Fase 8.6, este) | Viaduto vira trevo com ELEVADO: ramal à direita (ADR 0014) que sai colado da pista, descola, sobe até 4100 u no cruzamento (platô) e desce, devolvendo à pista (`alto`/`topo` no Ramal, `elevacao`, `VIADUTO` em world/events.ts). Câmera sobe junto (`eng.elevJogador`); mureta dos dois lados no alto (raspar segura o carro); embaixo não dá para entrar nos pilares. Desenho do elevado como sprite por segmento (tabuleiro, muretas com junta, parede, pilares, fundo da laje visto de baixo, postes). Carros sobem (seta na faixa colada) e descem entrando na via; nitro, x2 e nitro no platô. Viaduto com juntas, postes acesos à noite e pichação nos pilares; a alça desenhada antiga e a faixa de aceleração saíram. Reciclagem limpa o estado de elevado do carro (ele voltava teleportado para cima). Teste em `__tests__/viaduto.cenario.test.ts`. | não alterado (o viaduto não aparece nos replays) |
| 2026-11-16 | (Fase 8.7, este) | Túnel raro (`world/tunel.ts`, `render/tunel.ts`): zona de 280 segmentos (cabe na distância de desenho: a saída aparece no fundo), relevo plano e curvas suavizadas; entra no sorteio só com 30% de chance por evento. Boca com montanha e pórtico "TÚNEL DA SERRA"; dentro, paredes com azulejo, teto, duas filas de luz, placa de emergência, asfalto escurecido, faróis acesos, sem chuva, eco (o mesmo do viaduto) e o helicóptero cego; a luz do fim do túnel e o clarão na saída. Placas "TÚNEL 2 km / 1 km / ACENDA OS FARÓIS" e cartão. Tecla 8 no solo. Teste em `__tests__/tunel.cenario.test.ts`. | atualizado no replay solo: o sorteio do túnel usa um número a mais de `eng.rngEv`, então o evento sorteado no replay muda. Fim de partida igual. |
| 2026-11-13 | (Fase 0) | Fase 0: spec `v2-mostwanted.md`, ADRs 0011–0013 (propostos), 10 ideias de rodadas e drift. Guia trazido de `docs/autodash-v2-spec` para o branch `feat/autodash-v2-mostwanted`. | não alterado |
