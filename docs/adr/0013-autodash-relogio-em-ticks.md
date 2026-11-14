# ADR 0013 — Relógio em ticks e clima do AutoDash

**Status:** Aceito. Implementado na Fase 4 (commits fb780c5, d8efd4a). Janela de clima ficou em 1 minuto.

## Contexto
O ciclo de dia atual (`SKY_KEYS`, só no solo) anda com o tempo real. O usuário quer um relógio discreto, estilo Minecraft: o tempo do jogo avança em ticks, pausa com o jogo, e pode ter um modo personalizado. O clima precisa ser escolhido por bioma ou por corrida, e precisa alterar a física (ADR 0012).

## Decisão

### Relógio
- O relógio conta **ticks** de simulação. Um tick = 1/20 s de tempo de simulação, acumulado a partir do `dt` do quadro (pausa e menus não avançam).
- Um dia = `TICKS_PER_DAY = 24000` ticks, ou seja 20 min de jogo. Hora do dia = `(tick mod 24000) / 1000`.
- Modos:
  - `ciclo`: o relógio anda sozinho (padrão do solo).
  - `fixo`: uma hora escolhida (ex.: noite, para a corrida).
  - `custom`: velocidade do relógio escolhida (×0, ×0,5, ×1, ×2) e horário inicial. Não muda a regra de física.
- A cor do céu vem da hora do dia por interpolação em `SKY_KEYS`, como hoje. Só a fonte do tempo muda.
- Corrida: o horário é definido pelo lobby (fixo ou ciclo), para que todos os pilotos vejam o mesmo céu. Multiplayer sincroniza pelo servidor (polling), não pelo relógio local.

### Clima
- Clima é um estado discreto: `limpo`, `nublado`, `chuva`, `neblina`, `neve` (neve prevista para o bioma neve).
- Cada clima define três entradas da física (ADR 0012): `grip`, `traction` e `visibilidade`. Não é só visual.
- Escolha:
  - por bioma (padrão do bioma, em `BIOMES[].climas`),
  - por corrida (lobby escolhe ou sorteia dentro dos permitidos),
  - `custom`: o jogador escolhe no solo.
- Troca de clima durante a corrida: só em transições marcadas no tick (ex.: a cada 2 minutos de jogo, com chance). Nunca no meio de um quadro, para não quebrar o replay determinístico.
- Determinismo: o sorteio do clima usa a seed da pista, para que o golden master e os testes repitam.

## Consequências
- O relógio em ticks é determinístico e testável sem tempo real. Os testes passam a poder avançar N ticks.
- O solo perde a dependência do relógio de parede, o que é necessário para o golden master ser estável.
- O clima novo depende da física (ADR 0012). Por isso a Fase 4 vem depois da Fase 2.
- Impacto de desempenho: a interpolação de céu é barata; o custo está no desenho das camadas (ADR 0011).
- Chuva no solo hoje (`eng.raining`) migra para o modelo de clima. Até lá, o comportamento atual fica intacto.
