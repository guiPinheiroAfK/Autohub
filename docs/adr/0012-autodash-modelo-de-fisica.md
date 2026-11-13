# ADR 0012 — Modelo de física do AutoDash: tração, pneus, câmbio e clima

**Status:** Implementado na Fase 2 (tração, pneus, relação final). Câmbio (tipo e número de marchas) segue pendente. Aguardando playtest.

## Contexto
Hoje o carro tem `power`, `grip` (aderência de direção), `topSpeed` e `shiftMs`. A aceleração não depende de tração: qualquer carro acelera igual em qualquer condição, e não há distinção entre tração dianteira, traseira ou integral. Clima (chuva) só reduz `grip` por um fator fixo, no modo solo. O usuário quer que tração, tipo de pneu e relação final mudem a condução e que o clima altere a física, não só o visual (GUIA, D10 a D15).

## Decisão

### Dados (por carro, opcionais com padrão)
- `drive`: `"FWD" | "RWD" | "AWD"`. Padrão: `RWD` (comportamento atual).
- `frontBias`: fração do torque na dianteira, só AWD. `0.5` = 50/50, `0.3` = 30/70. Padrão `0.5`.
- `tyre`: `"padrao" | "esportivo" | "macio" | "misto"`, com `grip` (multiplica o `grip` do carro) e `traction` (capacidade de tração do eixo). `padrao` vale `1` nos dois, é a referência.
- `finalDrive`: multiplicador da relação final sobre todas as marchas. Padrão `1`.
- Câmbio (5 ou 6 marchas, CVT, manual, híbrido) e embreagem: **não implementados nesta fase** (pendência registrada no GUIA). Ficam como próximo passo; `GEAR_RATIOS` continua com 6 marchas.

### Tração por eixo (funções puras em `physics/traction.ts`)
- `aN` = aceleração normalizada em reta = `powerCurve × fator de marcha`, em `[0, 1]`.
- Transferência de carga: `wf = 0.5 − 0.15·aN` (dianteira), `wr = 0.5 + 0.15·aN` (traseira).
- Capacidade do eixo: `cap = 2 · w · tyre.traction · lat`, onde `lat = √(1 − l²)` é o círculo de atrito com a força lateral `l = min(0,63; |centrífuga| / 0,35)` (perda na saída de curva).
- Demanda do eixo: `demanda = share · aN`, com `share` = 1/0 (FWD), 0/1 (RWD), `frontBias`/`1−frontBias` (AWD).
- Multiplicador: `k = clamp(min(1, cap/demanda) por eixo motor, 0,5, 1)`. A divisão por eixo usa o eixo mais limitado (modelo de divisão fixa, sem bloqueio de diferencial).
- Perda do sistema: FWD `2%`, RWD `0%`, AWD `5%`.
- Relação final: `× √finalDrive` na aceleração, e `× finalDrive` no giro por marcha (o limite de velocidade por marcha cai com a relação final curta).
- Aplicado só à aceleração de base (`power × powerCurve × marcha`). **Nitro não passa pelo limite de tração** nesta fase.

### Garantia de referência
Com o carro padrão (`RWD`, pneu `padrao`, `finalDrive = 1`) o multiplicador é exatamente `1`, porque `cap ≥ demanda` para todo `aN ∈ [0,1]` mesmo com a força lateral no limite (`0,63`). Por isso o golden master do carro `gt` não muda. O teste unitário cobre esse caso.

### Clima como entrada da física (Fase 4)
Clima vira uma entrada: `grip` (multiplicador), `traction` (multiplicador sobre o pneu), `visibilidade` (distância da névoa). Hoje, chuva fica como `0,62` fixo de aderência (`sim/update.ts`). A troca pelo modelo de clima é a Fase 4 e tem snapshot próprio.

## Consequências
- Carros de teste (FWD, RWD, AWD 50/50, AWD 30/70) ficam em `CARS` no fim da lista, para não mudar os índices salvos. Eles usam o mesmo corpo e os mesmos números do `gt`, mudando só a tração.
- Com pneu e tração padrão, nada muda. Mudanças aparecem só nos carros novos.
- Simplificações conhecidas: sem bloqueio de diferencial, sem torque por faixa de rotação, sem diferença de peso por carro. Os parâmetros (`0,15`, `2`, `0,35`, `0,63`, `0,5`) são constantes em `physics/traction.ts`; calibrar pelo teste no navegador.
- Torque legível: o nome do carro e a descrição explicam a tração. Mostrar o torque em tela fica para a Fase 7 (HUD).
- Tuning de motor, turbo e suspensão continua fora (D12).
