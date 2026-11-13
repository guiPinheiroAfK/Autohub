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
- **Tração e câmbio:** sem distinção FWD/RWD/AWD. Câmbio é só marcha automática ou manual com 1 curva de torque.

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

### Fase 0 — Planejamento (sem mudança de jogo) — `pendente`
- [ ] Este guia completo e revisado.
- [ ] ADR 0011: modelo de dados de bioma e camadas de cenário.
- [ ] ADR 0012: modelo de física (tração, pneus, câmbio, clima como entrada da física).
- [ ] ADR 0013: relógio em ticks e clima.
- [ ] Lista de 10 ideias para rodadas de corrida e drift, neste arquivo, seção 9.

Critério de aceite: usuário aprova os ADRs e a lista.

### Fase 1 — Biomas e camadas — `pendente`
- [ ] Tabela de dados de bioma: nome, paleta, camadas, pesos de decoração, clima permitido.
- [ ] Converter o cenário urbano atual no bioma "cidade", com 3 camadas (longe, meio, perto).
- [ ] Bioma "costa" usando o mesmo sistema (horizonte com mar, palmeiras, píer).

Critério de aceite: solo e corrida leem o bioma da tabela. Snapshot do golden muda só pela camada intencional, em commit próprio. Browser: menu, corrida e troca de bioma funcionam.

### Fase 2 — Tração, pneus e câmbio (dados e física, sem visual novo) — `pendente`
- [ ] Carro ganha: tração (FWD/RWD/AWD + divisão), tipo de pneu, tipo de câmbio, relação final.
- [ ] Física lê esses dados: limite de tração por eixo, perda de tração na saída de curva, aceleração em reta por tração.
- [ ] Quatro carros de teste: FWD, RWD, AWD 50/50, AWD 30/70.
- [ ] Testes unitários da matemática de tração (funções puras).

Critério de aceite: o carro padrão continua idêntico (ou o snapshot muda com justificativa). Os quatro carros de teste se comportam diferente de forma perceptível no navegador.

### Fase 3 — Pistas de corrida e lobby — `pendente`
### Fase 4 — Clima e ciclo de dia em ticks, com efeito na física — `pendente`
### Fase 5 — Eventos novos (racha, combustível) — `pendente`
### Fase 6 — Polícia por estrelas — `pendente`
### Fase 7 — Customização estética (bodykit, som, efeitos) — `pendente`

Fases 3 em diante só são detalhadas quando a anterior for aprovada.

## 9. Ideias de rodadas e drift (para brainstorm, não implementar)

_Preencher na Fase 0._

## 10. Log de mudanças

| Data | Commit | O que mudou | Snapshot do golden |
|---|---|---|---|
| 2026-11-13 | (esta spec) | Criação do guia vivo | não alterado |
