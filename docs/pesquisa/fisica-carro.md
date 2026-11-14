# Pesquisa: física do carro do AutoDash

Documento de pesquisa (sem código no repo). Objetivo: **evoluir** a física longitudinal e do motor do AutoDash sem mudar o equilíbrio que o usuário aprovou. Toda recomendação traz arquivo/função, fórmula, constantes sugeridas, efeito medido e risco.

Convenções deste documento:
- **[fato]** foi lido no código ou medido.
- **[medido]** saiu do simulador offline descrito na seção 8 (réplica do bloco longitudinal de `sim/update.ts`, dt = 1/120 s, reta plana, câmbio automático, largada perfeita a 52 km/h).
- **[fonte N]** aponta para a lista no fim.
- **[estimativa]** é palpite de engenharia, a calibrar no playtest.
- **[seguro agora]**: não muda tempo de volta nem 0–200 de forma mensurável (≤ 2%). Ainda muda o golden master quando mexe no desenho; atualizar o snapshot em commit próprio, como manda o GUIA-V2.
- **[playtest]**: muda o equilíbrio ou a pilotagem; precisa do usuário jogar antes de ficar.

---

## 0. Resumo executivo

1. **A escala de tempo do jogo é ~3× a real.** 0–100 leva 2,0–3,3 s com largada perfeita, freio de 105 km/h/s (~3 g) e arrasto de ~12 km/h/s a 244 km/h **[medido]**. Toda fórmula real tem de ser traduzida para essa escala. Não basta copiar constantes de simulador.
2. **O que mais falta é "feel", não física.** O giro salta na troca, o limitador é um zero seco, a patinada só existe como cronômetro da largada, e a câmera treme com `Math.random`. Dá para resolver tudo isso sem tocar no 0–200 (recomendações R1–R6, **[seguro agora]**).
3. **O clima não entra na tração** **[fato]**: `CLIMAS[...].grip` só mexe em direção e força centrífuga. Pela decisão D10, a chuva deveria pesar na arrancada. Ligar o clima ao `accelK` e escalar a demanda pelo `power` do carro deixa o seco **idêntico (0,0%)** e tira de 0 a 5% do 0–100 dos RWD na chuva **[medido]** (P1).
4. **Não trocar o arrasto linear por quadrático no geral.** Mantendo o mesmo arrasto a 244 km/h, o 0–200 cai de 12% a 25% **[medido]**, porque o arrasto no meio da faixa diminui. Usar o termo quadrático **só acima do `topSpeed`** (nitro e descida), onde hoje existe uma trava seca (P5).
5. **Não aplicar a inércia rotacional "de livro".** O fator de massa γ = 1,04 + 0,0025·i² **[fonte 2]** encurta o 0–200 em 22–36% **[medido]**. O expoente 0,9 em `fatorMarcha` já faz esse papel em versão arcade.
6. **Achado lateral:** o ROADSTER MK1 não chega ao `topSpeed` de 220. Aos 60 s está em ~207–210 km/h **[medido]**. É uma "máxima de ficha" que ninguém alcança. Vale decidir se é intencional.

### Ranking (impacto ÷ risco)

| # | Recomendação | Onde | Efeito em 0–100 / 0–200 / máxima | Rótulo |
|---|---|---|---|---|
| R1 | Giro cai e sobe **durante** a troca (sem salto), com "blip" na redução | `sim/update.ts` (bloco motor), `physics/gearbox.ts` | 0 / 0 / 0 | seguro agora |
| R2 | Câmera: zoom por velocidade, chute de troca, tremor por "trauma" com ruído | `engine.ts` `render()`, `physics/gearbox.ts` | 0 / 0 / 0 | seguro agora |
| R3 | Patinada visível (fumaça, giro que dispara, chiado) pelo uso de tração | `physics/traction.ts` (novo `usoTracao`), `sim/update.ts` | 0 / 0 / 0 | seguro agora |
| R4 | Limitador físico: corte duro pulsado e corte suave em rampa | `sim/update.ts` (linha do `mf.corte - 50`) | 0 / 0 / 0 | seguro agora |
| R5 | Turbo enche mais rápido em giro alto (energia do escape) | `physics/motores.ts` `passoBoost` | −0 a −1,7% / −0,3% / 0 | seguro agora |
| R6 | Acelerador com rampa curta por motor | `sim/update.ts` | 0 na largada; +0,05 s na retomada | seguro agora |
| P1 | Clima e `power` no limite de tração | `physics/traction.ts` `accelK` | seco 0%; chuva +0 a +5% (FWD +33%) / ≤ +1% / 0 | playtest |
| P2 | Freio-motor por marcha e por motor (redistribuído) | `sim/update.ts`, `physics/motores.ts` | 0 / 0 / 0 no gás; −1 a −3 km/h em 2 s de alívio | playtest |
| P3 | Tipo de câmbio: torque na troca (DCT), sangria de boost (H), conversor | `data.ts` `CarSpec`, `sim/update.ts`, `gearbox.ts` | TARGA −4,4% e FANTASMA −6,7% no 0–200 (compensável) | playtest |
| P4 | Eixo do turbo com memória: alívio curto não zera o boost | `physics/motores.ts`, `sim/update.ts` | 0 em reta; turbo mais forte no trânsito | playtest |
| P5 | Teto de velocidade suave e arrasto quadrático só acima do topo | `sim/update.ts` (`maxSpd`) | 0 até 95% do topo; +1,3 a 3,9 s até 99,5% | playtest |
| — | Inércia rotacional real, arrasto quadrático global, aero por carro, Pacejka completo | — | 0–200 de −36% a +80% | **não fazer** |

---

## 1. Como a física funciona hoje (fatos do código)

### 1.1 O laço longitudinal (`sim/update.ts`, `update`)

Por quadro, na corrida:
1. `rpm = rpmFor(speed, gear)` (`physics/rpm.ts`). O giro é **travado** na velocidade: embreagem sempre fechada, sem patinada de roda.
2. O boost anda em primeira ordem até `boostAlvo` (`passoBoost`, τ = `turbo.lag` para encher e 0,2 s para esvaziar). Na troca, **o boost congela**.
3. O câmbio automático decide a marcha (`autoShift`). A troca põe `shiftT = spec.shiftMs/1000`, e enquanto `shiftT > 0` a aceleração é **zero**.
4. `accel = power · forcaEm(giroDeForca) · fatorMarcha · accelK`. `fatorMarcha = (r_g/r_1)^0,9`. `accelK` aplica o círculo de atrito, a perda do sistema de tração e a raiz da relação final.
5. Limitador: `rpm ≥ corte − 50` → `accel = 0`.
6. Nitro soma +42 km/h/s e não passa pelo limite de tração (ADR 0012).
7. Freio: `−105 · clima.freio`. Arrasto: `−(5 + 0,028·v)` km/h/s, **linear**.
8. Ladeira: `+210·|grade|` na descida e `−120·grade` na subida.
9. Teto: `clamp(v, 0, topSpeed·(nitro?1,12:1) + descida)`. Depois vem o teto por marcha `gearTop`, que também faz de freio-motor em descida.

### 1.2 Números de hoje **[medido]**

Largada perfeita (52 km/h no verde), câmbio automático, reta plana, clima limpo. "veq" é a velocidade em que a força da última marcha empata com o arrasto, sem o teto `topSpeed`.

| Carro | Motor | Marchas | topSpeed | 0–100 (s) | 0–160 (s) | 0–200 (s) | v aos 40 s | veq |
|---|---|---|---|---|---|---|---|---|
| AUTOHUB GT | v10 | 6 | 244 | 2,62 | 8,55 | 18,0 | 244 | 263 |
| MUSCLE 71 | v8-cruzado-ford | 4 | 260 | 2,02 | 7,55 | 13,6 | 260 | 262 |
| NINJA RS | i4 | 6 | 228 | 2,77 | 9,33 | 22,2 | 228 | 263 |
| FANTASMA X | v8-plano | 9 | 256 | 2,77 | 8,66 | 16,4 | 256 | 263 |
| NOTURNO Z | v6 | 6 | 248 | 2,48 | 8,03 | 16,0 | 248 | 263 |
| ROTOR FD | rotativo | 5 | 244 | 2,67 | 8,31 | 17,9 | 244 | 263 |
| ÁPEX A80 | i6 | 6 | 262 | 2,31 | 6,89 | 12,4 | 262 | 263 |
| KAIJU R32 | i6-corrida | 5 | 240 | 2,45 | 7,16 | 14,1 | 240 | 263 |
| SYLVA S15 | i4-turbo | 6 | 238 | 2,80 | 9,35 | 20,7 | 236 | 247 |
| ROADSTER MK1 | i4-pequeno | 5 | 220 | 3,31 | 12,09 | — | 190 | 250 |
| ALTA IS | i4 | 6 | 242 | 2,33 | 7,27 | 14,0 | 242 | 263 |
| TARGA 992 | boxer6-turbo | 8 | 258 | 2,28 | 6,89 | 13,3 | 258 | 263 |

O que a tabela mostra:
- **A máxima é o teto `topSpeed`, não a física.** Quase todos teriam fôlego para ~263 km/h (o corte da última marcha). O carro sobe com 1–4 km/h/s de sobra e bate no teto (seção 5, P5).
- Para chegar a 95% da máxima são precisos 20–32 s **[medido]**. Com trânsito, a máxima quase nunca é vista. O que o jogador sente é a faixa de 100–200 km/h.
- O ROADSTER fica em ~190 km/h aos 40 s e ~207 aos 60 s. Os 220 da ficha são assintóticos.

### 1.3 Lacunas observadas **[fato]**

| Lacuna | Onde | Consequência |
|---|---|---|
| Clima não entra na tração | `accelK` usa `tyreOf(spec).traction`, sem `climaAtual` | Chuva não muda arrancada nem saída de curva no gás (contraria D10) |
| Demanda de tração normalizada, sem `power` | `accelK(spec, pc·gearF, …)` | O MUSCLE (power 58) "patina" tanto quanto o ROADSTER (38) |
| RWD no seco nunca é limitado | uso de tração na 1ª: 0,75–0,86 para todos **[medido]** | Não existe patinada de potência; só a de largada (`wheelspinT`) |
| Giro salta na troca | `eng.rpm = rpmFor(...)` logo depois de `gear++` | Conta-giros e som "teleportam"; não se ouve a queda de giro |
| Troca corta 100% da força em todo câmbio | `accel` só com `shiftT <= 0` | DCT de 8 ou 9 marchas é penalizado igual ao H de 4 |
| Boost congela na troca para todos | bloco do turbo | Câmbio H lento devia perder boost; DCT segura |
| Sem freio-motor | não existe termo | Alívio a 200 km/h desacelera igual em 6ª ou 3ª |
| Limitador = zero seco | `rpm ≥ corte − 50` | Sem "bate-volta" físico; só o som pulsa |
| Curva chamada de "potência" age como **torque** | `motores.ts`: "fração da potência" × relação | A força na roda é torque × relação; potência seria P/v. Só documentação, não mudar valores |
| Câmera treme com `Math.random` | `engine.ts` `render()` | Tremor "chiado", sem decaimento nem escala de intensidade |
| `PLAYER_Z = CAM_HEIGHT · CAM_DEPTH` | `engine.ts` | **Armadilha:** mexer no FOV via `CAM_DEPTH` mexe na física (posição de colisão). FOV dinâmico tem de ser só no desenho |

---

## 2. Dinâmica longitudinal: o que a física real diz

### 2.1 Arrasto aerodinâmico e resistência ao rolamento
- **Arrasto:** F = ½·ρ·Cd·A·v². No exemplo do Marco Monster, Cdrag = 0,5·0,30·2,2·1,29 ≈ 0,43 **[fonte 1]**.
- **Rolamento:** Monster usa F = Crr·v com Crr ≈ 30·Cdrag e diz que não confirmou o valor. Os dois termos empatam perto de 100 km/h **[fonte 1]**. Na engenharia de tráfego o rolamento é quase constante e cresce devagar: f = 0,01·(1 + V/147), com V em ft/s **[fonte 2]**.
- **Tradução para o jogo:** o arrasto do AutoDash (`5 + 0,028v`) é rolamento constante mais um termo linear. A ~244 km/h ele vale 11,8 km/h/s, ~3,3× o real (um carro de rua perde ~3,5 km/h/s a 240 km/h). Isso é coerente com a escala de tempo ~3×.
- **Por que não trocar por v²:** para o arrasto quadrático empatar com o atual no topo, ele precisa ser **menor** no meio da faixa (5,8 contra 7,8 km/h/s a 100 km/h). Isso acelera todo mundo de 100 a 200 km/h. Duas calibragens testadas **[medido]**:
  - `4 + 0,008v + 9,876e-5·v²`: 0–200 de −12% a −25%. O ROADSTER passa a chegar a 220.
  - `5 + 0,013v + 6,13e-5·v²`: 0–200 de −6% a −15%.
  Não serve sem rebalancear o `power` de cada carro. Conclusão: v² **só acima do `topSpeed`** (P5).

### 2.2 Tração, razão de escorregamento e a "fórmula mágica"
- **Razão de escorregamento:** SR = (ω·R − v)/|v|. A força longitudinal sobe quase linear com o SR, tem pico perto de 6% de escorregamento (um pouco acima da carga na roda) e cai depois **[fonte 1]**. Beckman define o escorregamento longitudinal da mesma forma (zero com a roda livre) e trata a aderência combinada (longitudinal + lateral) como um círculo ou elipse **[fonte 3]**.
- **Pacejka:** F = D·sin(C·arctan(B·x − E·(B·x − arctan(B·x)))). D é o pico, B·C·D é a rigidez na origem, E molda a queda depois do pico **[fonte 4]**. Para jogo, a versão simplificada basta. Ela diverge em velocidade muito baixa porque divide pela velocidade da roda **[fonte 5]**.
- **Atrito pneu × piso:** asfalto seco 0,8–0,9, molhado 0,5–0,7 **[fonte 6]**. O `grip` 0,62 da chuva no jogo cai nessa razão (0,6/0,9 ≈ 0,67).
- **Tradução:** integrar a velocidade da roda (ω) a 60 fps com o giro travado no chão não compensa aqui. Precisaria de sub-passos e brigaria com o modelo "giro = velocidade". O equivalente arcade é o **uso de tração** u = demanda/capacidade, que `accelK` já calcula por dentro. Se u > 1, a roda patina: a força cai para `cap · k_din` (k_din ≈ 0,85–0,9, o lado de lá do pico) e o giro **dispara** acima de `rpmFor`. Isso dá o "giro solto" da patinada sem integrar ω (R3 e P1).

### 2.3 Transferência de peso
- W_traseira = (b/L)·W + (h/L)·M·a. Sob aceleração, a carga vai para trás. No freio, para a frente **[fonte 1]** **[fonte 3]**.
- O jogo já faz isso em `LOAD_TRANSFER = 0,15` (fração do peso que vai para trás com `aN = 1`). É um h/L ≈ 0,15 por g normalizado: valor plausível para carro de rua (h ≈ 0,5 m, L ≈ 2,6 m dá 0,19).
- **No freio** a dianteira ganha carga e a traseira alivia. O efeito jogável clássico é o *trail braking*: freio leve na entrada aumenta a aderência dianteira e o carro fecha melhor a curva. Fica como ideia para a fase de handling, não nesta pesquisa (mexe em direção).

### 2.4 Perdas do trem de força
- Marco Monster usa rendimento de transmissão de 0,7 como valor típico, não medido **[fonte 1]**. Valores reais modernos ficam em 0,85–0,92 (manual) e um pouco menos em automático com conversor e em AWD.
- O jogo já tem `DRIVE_LOSS` (FWD 2%, RWD 0, AWD 5%). Está bom. Não aplicar 0,7 por cima: seria só um corte de `power` disfarçado.

### 2.5 Inércia rotacional (massa efetiva por marcha)
- Fator de massa: γ = 1,04 + 0,0025·ε², com ε a redução total (marcha × diferencial) **[fonte 2]**. Com diferencial 3,7: 1ª (3,4) → ε ≈ 12,6 → γ ≈ 1,44; 6ª (0,88) → ε ≈ 3,3 → γ ≈ 1,07. Outra referência usa 1,05 a 1,25 como coeficiente fixo **[fonte 7]**.
- Efeito real: na 1ª, ~30% da força vai para girar motor e rodas. Por isso a 1ª é "menos forte" do que a relação sugere.
- **No jogo:** `fatorMarcha = (r_g/r_1)^0,9` já dá às marchas altas mais força relativa do que a relação pura, que é o efeito da inércia em versão suave. Aplicar γ de verdade (normalizado na 1ª) equivale a um expoente ~0,78 e encurta o 0–200 em 22% a 36% **[medido]**. **Não fazer.** Se um dia for preciso mudar o caráter das marchas, mexer no expoente (0,85–0,9) junto com o `power`.

### 2.6 Embreagem, conversor e largada
- **Embreagem patinando na 1ª:** o jogo já faz o que modelos de jogo fazem. `giroDeForca` segura o giro em 32% da faixa na 1ª, igual ao `clutch_rpm = idle + throttle·clutch_out_rpm` do GDSim **[fonte 8]**.
- **Conversor de torque:** multiplica o torque na saída (razão de estol típica 1,8–2,5) e a multiplicação cai rápido até 1:1 conforme a turbina alcança a bomba **[fonte 9]**. Em jogo dá para usar `k_conv = 1 + (STR − 1)·max(0, 1 − v/v_acopla)`, com v_acopla ≈ 25 km/h na escala do jogo (P3).
- **Largada:** `launch()` (`modes/solo.ts`) dá 52 km/h na largada perfeita. É uma trapaça arcade boa e reconhecível; manter.

### 2.7 Freio-motor
- Com a borboleta fechada, o motor gasta trabalho de bombeamento contra o vácuo, mais atrito interno e acessórios. O efeito cresce com o giro e é multiplicado pela relação da marcha. Por isso reduzir freia mais **[fonte 10]**.
- Simuladores modelam como atrito constante mais um termo que cresce com o giro. No BeamNG: `friction` (base, que dobra com o pedal fechado), `dynamicFriction` (proporcional a ω) e `engineBrakeTorque × (1 − carga)` **[fonte 11]**. No GDSim: `drag = engine_brake + rpm·engine_drag` **[fonte 8]**. Racer (racer.nl), segundo relato de terceiros: torque de freio = coeficiente × rps **[fonte 12]**.
- Motor rotativo tem freio-motor notoriamente fraco. V8 grande e W16 têm forte. **[estimativa]**, com base no deslocamento e no atrito.

### 2.8 Tempo de troca por tipo de câmbio
- **Manual H:** 0,5 s ou mais com embreagem, conforme o motorista **[fonte 13]**.
- **Sequencial (dog box / automatizado de embreagem única):** Ferrari F430 Scuderia ~60 ms, Enzo ~150 ms **[fonte 14]**.
- **DCT:** o "8 ms" do VW é tempo de engate; a troca completa fica perto de 100–200 ms. **Na subida o torque não é interrompido**: uma embreagem solta enquanto a outra pega **[fonte 14]** **[fonte 15]**. A redução do DCT é mais lenta (até ~600 ms com rev-match) **[fonte 13]**.
- **Automático com conversor (ZF 8):** ~200 ms, com torque parcial durante a troca **[estimativa]**.
- **No jogo:** `shiftMs` já vai de 150 (TARGA) a 300 (MUSCLE), coerente. O que falta é a **forma** da troca: quanto torque passa durante ela e o que acontece com o boost e o giro (P3, R1).

### 2.9 Rev-match na redução
- Na redução, o giro tem de subir até `rpmFor(v, g−1)`. Sem *blip*, a embreagem faz isso à força: tranco e chiado de pneu. DCT e sequencial modernos dão o *blip* sozinhos.
- No jogo, `shiftDown` troca na hora e o giro salta. O *blip* é cosmético (som e conta-giros), em R1.

### 2.10 Patinada de potência por clima
- Capacidade de tração ∝ μ·carga. Na chuva μ cai ~35–40% **[fonte 6]**. Com o mesmo torque, a 1ª e a 2ª passam do limite.
- **Medido no modelo atual:** uso de tração na 1ª com força máxima, RWD:

| Carro | Seco | Chuva (μ × 0,62) | 2ª na chuva | Chuva com demanda × power/46 |
|---|---|---|---|---|
| AUTOHUB GT | 0,83 | 1,34 | 1,03 | 1,34 |
| MUSCLE 71 | 0,76 | 1,23 | 0,84 | 1,55 |
| ÁPEX A80 | 0,78 | 1,26 | 0,97 | 1,56 |
| TARGA 992 | 0,76 | 1,22 | 1,01 | 1,43 |
| ROADSTER MK1 | 0,83 | 1,34 | 1,00 | 1,11 |

  Ou seja: no seco ninguém passa de 1 (mesmo escalando pelo `power`). Na chuva, a 1ª patina para todos, e o MUSCLE e o ÁPEX ("traseira solta", "dono das retas") patinam mais. É exatamente o caráter da descrição deles.

---

## 3. Dinâmica do motor

### 3.1 Inércia do virabrequim e volante (giro livre)
- dω/dt = (T_comb − T_atrito)/I. Com inércia menor o giro sobe e cai mais rápido. No BeamNG o padrão é I = 0,1 kg·m², somando virabrequim, volante e embreagem **[fonte 11]**. O GDSim usa 0,25 **[fonte 8]**. O Engine Simulator do AngeTheGreat modela virabrequim, bielas e pistões como corpos rígidos, com massa do volante, momento de inércia e torque de atrito por componente. O próprio autor avisa que não é ferramenta científica **[fonte 16]**.
- **No jogo:** `solto: [sobe, cai]` já cumpre esse papel em ponto morto e no grid. **Ponto bom do código atual.** Falta usar o mesmo parâmetro **durante a troca**, quando a embreagem está aberta e o motor gira livre (R1).

### 3.2 Atrito e bombeamento × giro
- O FMEP (pressão média de atrito) cresce com o giro. Correlações empíricas usam a forma `a + b·N + c·N²` ou `K1 + K2·N·(velocidade média do pistão)²` **[fonte 17]**. A correlação de Heywood não foi conferida na fonte; tratar a forma, não os números.
- **No jogo:** a curva de força já é "líquida" (pós-atrito). O atrito só importa sem gás, e aí ele **é** o freio-motor (P2). Forma sugerida: `fe(frac) = (0,25 + 0,75·frac)²`, que é ~quadrática no giro, com piso na lenta.

### 3.3 Resposta do acelerador
- Borboleta eletrônica mais enchimento do coletor dão dezenas a ~150 ms entre o pé e o torque **[estimativa]**. Borboletas individuais (ITB: R32, GT3, V10 e V12 de corrida) respondem mais rápido que borboleta única com coletor grande.
- No jogo, o gás é 0/1 (teclado). Uma rampa curta suaviza o "liga-desliga" de força e de som sem mudar a largada, porque no verde o pé já está no fundo há segundos (R6).

### 3.4 Turbo
- **Mapa simplificado:** o boost alvo cresce com o fluxo de massa do escape (∝ giro × carga) até a wastegate limitar. A wastegate desvia escape da turbina e segura o boost no alvo **[fonte 18]**. *Boost creep* é o boost passando do alvo em giro alto quando a wastegate não dá vazão (ex.: alvo de 20 psi indo a 25 perto do corte) **[fonte 19]**.
- **Assetto Corsa** expõe o modelo em poucos números **[fonte 20]**:
  - `LAG_UP` e `LAG_DN`: interpolação por quadro para encher e esvaziar, valores perto de 0,99.
  - `REFERENCE_RPM`: giro em que o turbo atinge o boost máximo com pé no fundo.
  - `GAMMA`: sensibilidade ao pedal.
  - `WASTEGATE`: teto.
  - Torque escalado por (1 + boost).
  
  O modelo do AutoDash (`spool`, `cheio`, `lag`, `peso`) é desse mesmo tipo: está no nível certo de detalhe.
- **O que dá para evoluir:**
  1. **Spool depende do giro:** com mais giro há mais energia no escape e o eixo acelera mais rápido. Hoje τ = `lag` fixo (R5).
  2. **Eixo com memória:** a válvula de alívio (BOV) derruba a **pressão** na hora, mas o **eixo** continua girando por 1–2 s (é o `desce` que o som já usa). Voltar ao gás logo depois recupera o boost rápido. Hoje a física esvazia em 0,2 s e recomeça do zero (P4).
  3. **Creep e overshoot:** um pico de 3–5% acima do alvo na hora de encher dá o "coice" do turbo antigo (i4-turbo, boxer4). Opcional, cosmético-físico.
  4. **Anti-lag (ALS):** queima no escape para manter o eixo girando com o pé fora. Pela D12 (sem tuning de desempenho agora) fica como **mod futuro**, junto com o 2-step de largada.

### 3.5 Compressor mecânico (supercharger)
- **Roots e parafuso duplo** (deslocamento positivo): boost praticamente plano desde baixo. **Centrífugo**: boost sobe com o giro e só chega ao pico perto do corte **[fonte 21]**.
- Perda parasita: Roots > parafuso > centrífugo. No centrífugo a perda é pequena em giro baixo **[fonte 22]**.
- **No jogo:** o `v8-cruzado` é o Roots, sem turbo e com curva cheia embaixo. Está correto na forma. Para um centrífugo futuro, basta a curva subir ~linear com o giro, sem atraso. Não precisa de estado novo.

### 3.6 Ressonância de admissão e VTEC
- Motores aspirados têm "degraus" de torque onde a ressonância do coletor ou o comando variável (VTEC) entra. O VTEC troca de came numa faixa estreita, perto de 5500–6000 rpm nos B/K da Honda.
- No jogo, o `i4` sobe de 0,62 (5000) para 0,82 (5800). A rampa de 800 rpm é suave; um VTEC de verdade é mais **degrau**. Sugestão opcional: inserir o ponto `[5700, 0,66]` antes do `[5800, 0,82]`, o que deixa o degrau em 100 rpm. Mudança mínima de área (o `ganhoMotor` reequilibra). **[playtest leve]**, porque mexe no ganho do NINJA e do ALTA.

### 3.7 Limitador
- **Corte duro:** tira combustível ou faísca por completo; o giro cai e volta a subir ("bate-volta"). **Corte suave:** corta parcialmente e atrasa o ponto, segurando o giro no limite sem bater **[fonte 23]** **[fonte 24]**. ECUs combinam os dois: suave antes, duro depois.
- O som já diferencia (`corteDuro`, 13 Hz contra 8 Hz em `giroDoSom`). A física não: é zero seco nos dois casos (R4).

---

## 4. O que dá "feel" em jogos arcade

### 4.1 Evidência (pesquisa)
- **FOV e altura de câmera:** aumentar o FOV geométrico aumenta a velocidade percebida, e câmera mais alta em alta velocidade também. Desfoque de movimento **forte reduz** a velocidade percebida **[fonte 25]**.
- **Desfoque:** num estudo com *Split/Second*, o desfoque simulado não melhorou a experiência de velocidade nem a diversão **[fonte 26]**. A pesquisa anterior do projeto chegou à mesma conclusão (`visual-e-desafio.md` §2.2).
- **Tremor de câmera:** o modelo de "trauma" de Squirrel Eiserloh (GDC 2016) acumula trauma de 0 a 1, que decai linearmente. O tremor visível é trauma elevado a uma potência (quadrado ou cubo) e é amostrado com **ruído Perlin**, não com aleatório puro **[fonte 27]**. Assim, pancada pequena quase não aparece, e pancada grande aparece muito.
- **Opinião de comunidade e crítica** (não é dado de desenvolvedor): FOV e tremor são as alavancas principais, com desfoque de apoio. No *Forza Horizon 4*, a câmera lisa e sem tremor é lembrada como fraqueza **[fonte 28]**. Em *NFS Heat*, citam tremor, HUD discreto e nitro com impacto visual **[fonte 29]**. A equipe de *Formula Fusion* fala de uma câmera que distorce sutilmente com a velocidade **[fonte 30]**.

### 4.2 Como os jogos de referência trapaceiam
- **Burnout 3:** as pistas têm cerca do **dobro** da largura real, para a velocidade caber e ser legível **[fonte 31]**. Câmera de lente "olho de peixe", muito desfoque e 60 fps sustentados **[fonte 32]**. Boost como recompensa de risco.
- **OutRun 2:** o modelo é assumidamente exagerado: faixa de potência estrita, direção dura em alta e drift que **drena velocidade de forma linear** até sair dele **[fonte 33]**. Na Sumo Digital, o modelo foi descrito como física "fake", de jogo de plataforma, ajustada para cada carro parecer ter peso e aderência próprios. A declaração é sobre outro jogo da casa **[fonte 34]**.
- **NFS Most Wanted (2005):** não achei material de desenvolvedor sobre o modelo (a busca devolve o reboot de 2012 da Criterion). O que é observável no jogo, sem fonte de desenvolvedor: nitro com zoom e desfoque radial, *speedbreaker* (câmera lenta), câmera que "afunda" e treme na alta, e polícia com "elástico".
- **Padrões arcade comuns** (síntese): freio muito mais forte que o real (o AutoDash já tem ~3 g); máxima alcançada cedo; aderência que perdoa; trânsito legível; colisão que custa velocidade sem encerrar (o AutoDash já faz na corrida); e som e câmera que exageram cada evento (troca, corte, nitro).

### 4.3 O que isso vira no AutoDash
- **Chute de troca:** o carro "cabeceia" para a frente quando a força volta depois da troca. Fica maior no H, pequeno no DCT e quase nulo no conversor. Hoje só existe `pitchY` de gás e freio.
- **Zoom por velocidade:** em vez de mexer em `CAM_DEPTH` (que alimenta `PLAYER_Z` e a colisão), usar o mesmo truque do nitro, `ctx.scale` em volta do centro, de 1,00 a ~1,03 entre 150 km/h e o topo. O nitro sobe para 1,05 com **rampa**, em vez do salto de hoje.
- **Ronco na pele:** micro-tremor contínuo ∝ (v/top)³ com ruído de baixa frequência (~6–9 Hz), menos de 1 px. Mais um pulso no limitador duro, em sincronia com os 13 Hz do som.
- **Patinada que se vê e se ouve:** fumaça, giro disparando e chiado quando o uso de tração passa de ~0,9.

---

## 5. Recomendações concretas

Cada item lista: arquivo e função, fórmula, constantes, efeito medido e risco. Onde não há número **[medido]**, o efeito é zero por construção (só desenho ou som), ou é **[estimativa]**.

### R1 — Giro contínuo na troca e "blip" na redução **[seguro agora]**
- **Onde:** `sim/update.ts`, bloco `---------- motor ----------`. Hoje faz `if (eng.gear >= 1) eng.rpm = rpmFor(...)`.
- **Fórmula:**
  ```
  alvo = rpmFor(eng, eng.speed, eng.gear)
  se shiftT > 0:
      // embreagem aberta: motor gira livre na taxa dele
      taxa = taxaSolto(mf, alvo > eng.rpm) * K_TROCA[tipoCambio]   // H 1, seq 2, dct 4, conv 1,5
      eng.rpm += (alvo - eng.rpm) * min(1, dt * taxa)
      // redução com blip: alvo + 4% da faixa no primeiro terço da troca
  senão:
      eng.rpm = alvo   // embreagem fechada (como hoje)
  ```
- **Por que é seguro:** durante `shiftT > 0`, nada da física lê `eng.rpm`. A força é zero, o boost está congelado, o `autoShift` só roda com `shiftT <= 0` e `aNdir` já exige `shiftT <= 0`. Mudam só o conta-giros e o som.
- **Constantes:** usa o `solto` de cada motor. O rotativo (12/9) cai na hora. O big block de 71 (3/2,2) cai preguiçoso, e com `shiftMs` de 300 ms o ponteiro nem chega ao giro novo antes de a embreagem fechar. Esse "tranco" final é o caráter certo de um câmbio H de 4 marchas.
- **Efeito:** 0 / 0 / 0. **Golden:** muda (HUD e som).

### R2 — Câmera: zoom por velocidade, chute de troca, tremor por trauma **[seguro agora]**
- **Onde:** `engine.ts`, `render()` (bloco `shakeT`, "FOV pump", rotação do volante). Em `physics/gearbox.ts`, `shiftUp` e `autoShift` disparam o chute.
- **Fórmulas:**
  - Zoom: `z = 1 + 0,03·smoothstep(150, top, v) + (nitro ? 0,025·rampa : 0)`, onde `rampa` sobe em ~0,25 s e desce em ~0,4 s. Aplicar com `ctx.scale` em volta de `(W/2, H·0,55)`, o horizonte. **Não tocar em `CAM_DEPTH`** (ele define `PLAYER_Z`).
  - Chute de troca: ao fim da troca (`shiftT` cruzando 0 com gás), `eng.pitchY += KICK[tipo]` com KICK = H −2,5, seq −1,8, dct −0,8, conv −0,5. O amortecimento que já existe (`dt·8`) devolve.
  - Trauma: trocar `shakeT` por `trauma ∈ [0,1]`. Batida soma 0,6, raspão 0,25, limitador duro 0,04 por pulso. Decai 1,5/s. Deslocamento = `14·trauma²·ruido(t·25)` em x e `10·trauma²·ruido(t·25 + 100)` em y, com ruído de valor suavizado (barato) em vez de `Math.random`.
  - Ronco: `0,8·(v/top)³·ruido(t·7)` px, sempre ligado em corrida.
- **Constantes por carro:** nenhuma obrigatória. Opcional: o `width` do carro escala o ronco (carro largo, mais massa).
- **Efeito:** 0 / 0 / 0. **Risco:** enjoo se exagerar; manter o zoom ≤ 1,05 e o ronco < 1 px. Mudança de câmera é Fase 7 (D16, "com cuidado"); este item é só pós-transformação 2D.

### R3 — Patinada visível pelo uso de tração **[seguro agora]**
- **Onde:** `physics/traction.ts`, nova função pura `usoTracao(spec, aN, centrif, mu = 1): number` que devolve `max(demanda/capacidade)` por eixo, a mesma conta de `accelK`. Em `sim/update.ts`, depois do cálculo de `accel`.
- **Fórmula (cosmética nesta etapa):**
  ```
  u = usoTracao(spec, pc*gearF, centrif)
  se u > 0,9 e gás: emitSmoke(eng, ceil((u-0,9)*20), "#e2e8f0"); audio.skid(u-0,9)
  giro mostrado = rpm * (1 + 0,25*clamp(u-0,9, 0, 0,6))   // só para HUD e som
  ```
- **Efeito:** 0 / 0 / 0 (`accel` não muda). No seco, só a 1ª dos carros com u ≈ 0,83–0,86 (GT, NINJA, ALTA, ROADSTER) solta um fiapo de fumaça. Com P1 ativo, a chuva acende tudo.
- **Teste unitário:** `usoTracao ≤ 1` para RWD padrão no seco e `accelK` inalterado.

### R4 — Limitador físico **[seguro agora]**
- **Onde:** `sim/update.ts`, linha `if (eng.rpm >= mf.corte - 50) { accel = 0; ... }`.
- **Fórmula:**
  - Corte duro (`mf.corteDuro`): `fase = frac(somT·13)`. A força é zero em `fase < 0,55` e cheia no resto, na mesma batida do som. Soma `trauma += 0,04` a cada pulso (R2).
  - Corte suave: força × `clamp((corte − rpm)/(0,02·faixa), 0, 1)`. A rampa nos últimos 2% da faixa segura o giro sem bater.
- **Por que é seguro:** no limitador, a velocidade já é travada por `gearTop`. A força a mais nunca vira velocidade, e o automático troca antes. Só se sente no manual, como "bate-volta".
- **Efeito:** 0 / 0 / 0.

### R5 — Spool do turbo dependente do giro **[seguro agora]**
- **Onde:** `physics/motores.ts`, `passoBoost(m, boost, alvo, dt)`. Passa a receber `rpm` (os chamadores em `sim/update.ts` já têm o giro).
- **Fórmula:** ao encher, `τ = turbo.lag · clamp(turbo.cheio / rpm, 0,6, 2)`. Abaixo do `cheio` fica mais lento, acima fica até 40% mais rápido. O esvaziamento continua em 0,2 s.
- **Efeito [medido]:** 0–100 de −0,7% a −1,7% (turbos). 0–160 ≈ −0,5%. 0–200 ≤ −0,3%. Aspirados: 0.
- **Teste:** o caso "turbo tem atraso" de `motores.test.ts` continua passando (5000 rpm no i4-turbo dá τ × 0,8).

### R6 — Rampa do acelerador por motor **[seguro agora]**
- **Onde:** `sim/update.ts`. Novo estado `eng.gasF` (0..1) que segue `throttle` com τ do motor. Usar `gasF` **só** na força (`accel *= gasF`) e no `boostAlvo`. As decisões (câmbio, fumaça, som) continuam no `throttle` binário.
- **Constantes (`MotorFisico.resposta`, s) [estimativa]:**

| Motor | τ (s) | Motivo |
|---|---|---|
| i6-corrida, boxer6, v10, v12 | 0,04 | borboletas individuais, coletor curto |
| i4, i4-pequeno, rotativo, v8-plano | 0,05 | giro alto, inércia baixa |
| i3, i4-turbo, boxer4, i5, i6, v6, v6-biturbo, boxer6-turbo | 0,07 | borboleta única |
| v8-cruzado, w16 | 0,09 | coletor grande |
| v8-cruzado-ford | 0,11 | carburador de 4 corpos de 71 |

- **Efeito [medido]:** na largada é 0, porque o pé já está no fundo no grid (`gasF` = 1 no verde). Numa retomada a partir de gás zero, o 0–100 equivalente ganha +2,5% a +4% (≈ +0,05–0,1 s).
- **Risco:** baixíssimo. No celular (toque binário) suaviza solavancos.

### P1 — Clima e potência no limite de tração **[playtest]**
- **Onde:** `physics/traction.ts`, `accelK(spec, aN, centrif, mu = 1)`. O chamador em `sim/update.ts` passa `climaAtual(eng).grip`.
- **Fórmula:**
  ```
  demanda = aN * (spec.power / POWER_REF)       // POWER_REF = 46 (AUTOHUB GT)
  capF = TRACTION_SCALE*(0,5 − LOAD_TRANSFER*demanda)*traction*mu*lat
  capR = TRACTION_SCALE*(0,5 + LOAD_TRANSFER*demanda)*traction*mu*lat
  lim  = min(capF/(front*demanda), capR/(rear*demanda))
  se lim < 1: k = max(MIN_TRACTION, lim * K_DIN)   // K_DIN = 0,9: passou do pico, a roda patina
  ```
  Observação: com `K_DIN < 1` há uma pequena descontinuidade em lim = 1. Para suavizar, usar `k = lim·(1 − 0,1·smoothstep(1, 1,2, 1/lim))`.
- **Constantes:** `mu` sai de `CLIMAS` (limpo 1, nublado 1, chuva 0,62, neblina 0,93). Os valores já existem e só passam a valer também na tração. `POWER_REF` = 46.
- **Efeito [medido]**, largada perfeita, sem `K_DIN`:

| Carro | Seco (0–100) | Chuva 0–100 | Chuva 0–200 |
|---|---|---|---|
| AUTOHUB GT | 0,0% | +2,9% | +0,4% |
| MUSCLE 71 | 0,0% | +3,7% | +0,6% |
| ÁPEX A80 | 0,0% | +5,4% | +1,0% |
| TARGA 992 | 0,0% | +5,1% | +0,8% |
| ROTOR FD | 0,0% | +0,6% | 0,0% |
| ROADSTER MK1 | 0,0% | +1,0% | — |
| TESTE FWD | 0,0% | +33% | +5,9% |

  O efeito é pequeno porque a largada perfeita já sai a 52 km/h (meio da 1ª). Ele aparece forte onde importa no jogo: **depois de batida** na corrida (`speed × 0,1`), em **largada normal ou engasgada** e na **saída de curva lenta**. Com R3, o jogador **vê** a patinada.
- **Golden:** a janela 0 do clima é sempre "limpo" e a demanda escalada não passa de 1 no seco. Os replays curtos tendem a não mudar. Conferir.
- **Risco:** médio-baixo. Pode tornar o FWD de teste ruim demais na chuva (realista, mas checar). Opcional: `launch()` pode estreitar a janela perfeita na chuva (0,386–0,70 em vez de 0,771). Isso é playtest separado.

### P2 — Freio-motor por marcha e por motor, redistribuído **[playtest]**
- **Onde:** `sim/update.ts`, logo depois do arrasto. Novo campo `MotorFisico.freioMotor` (fator, padrão 1).
- **Fórmula:**
  ```
  se gear ≥ 1, sem gás, shiftT ≤ 0:
      fr = fracGiro(mf, rpm)
      eb = EB · freioMotor · fatorMarcha(g) · (0,25 + 0,75·fr)²
      eng.speed -= eb · dt
  // redistribuição: tirar do rolamento o que a última marcha ganharia a ~200 km/h
  arrasto = (5 − EB_TOPO) + 0,028·v     com EB_TOPO ≈ 1 (só sem gás)
  ```
  Assim o alívio na última marcha continua igual a hoje, e as marchas baixas seguram mais.
- **Constantes:** `EB = 8` km/h/s. `freioMotor` **[estimativa]**:

| Motor | Fator | Motivo |
|---|---|---|
| rotativo | 0,55 | rotativo tem freio-motor fraco |
| i4, i4-pequeno, i4-turbo, i3 | 0,8 | |
| boxer4, i6-corrida, boxer6 | 0,9 | |
| i5, i6, v6, v6-biturbo, boxer6-turbo | 1,0 | |
| v8-plano, v10 | 1,1 | |
| v12 | 1,2 | |
| v8-cruzado | 1,3 | |
| v8-cruzado-ford | 1,4 | |
| w16 | 1,5 | |

- **Efeito [medido]**, sem redistribuição: 2 s sem gás a partir de 200 km/h, câmbio automático, cai para 176 km/h em vez de 179. A partir de 120 km/h, cai para 98–100 em vez de 104. 0–100, 0–200 e máxima no gás: 0.
- **Risco:** médio. No automático, `autoGearTarget` reduz sem gás para manter o giro de rodagem, e isso **soma** freio-motor na entrada de curva: o carro chega mais lento, e os tempos de volta pioram um pouco para todos. No manual, reduzir passa a servir para frear, e esse é o ganho de jogo.

### P3 — Tipo de câmbio: forma da troca **[playtest]**
- **Onde:** `data.ts`, `CarSpec.cambioTipo?: "H" | "seq" | "dct" | "conv"` (padrão "H"). `sim/update.ts` (força e boost durante `shiftT`). `physics/gearbox.ts` (chute e blip, ver R1 e R2).
- **Sugestão por carro** (pela inspiração; `shiftMs` não muda):

| Carro | Tipo | Inspiração |
|---|---|---|
| MUSCLE 71 | H | manual de 4 marchas de 71 |
| ROADSTER, ROTOR, KAIJU, SYLVA, NOTURNO Z, ALTA, NINJA | H | manuais de 5 e 6 marchas |
| ÁPEX A80 | H | manual de 6 marchas do A80 |
| AUTOHUB GT | seq | V10 com automatizado de embreagem única |
| TARGA 992 | dct | PDK de 8 marchas |
| FANTASMA X | dct | multi-embreagem de 9 marchas |

- **Fórmulas durante `shiftT > 0` (subida com gás):**
  - Torque que passa: H 0, seq 0, **dct 0,3**, conv 0,2.
  - Boost: H `boost *= exp(−dt/0,5)` (tirou o pé para pisar na embreagem); seq e dct seguram (como hoje); conv segura.
  - Conversor (só "conv", ninguém hoje): multiplicação na saída `k = 1 + 0,8·max(0, 1 − v/25)`. Substitui o piso de 32% de `giroDeForca` nesse tipo.
- **Efeito [medido]:**
  - TARGA, DCT 0,3: 0–100 2,28 → 2,11 (−7,5%); 0–200 13,27 → 12,68 (**−4,4%**).
  - FANTASMA, DCT 0,3: 0–100 2,77 → 2,51 (−9,4%); 0–200 16,42 → 15,32 (**−6,7%**).
  - Sangria de boost no H: afeta só turbos com H (SYLVA, ROTOR, KAIJU, ÁPEX). Não medido em separado; espera-se +1 a +3% no 0–200 **[estimativa]**, porque o boost hoje fica congelado durante 170–250 ms.
- **Compensação** se o usuário quiser 0–200 igual: TARGA `power` 54 → ~52,5 e FANTASMA 50 → ~47,5 **[estimativa]**, a conferir no simulador. Ou manter o ganho como identidade do DCT e cobrar no `grip` ou na largura.
- **Risco:** médio-alto. Mexe nos dois carros mais rápidos. Fazer em commit próprio, medir e mostrar.

### P4 — Eixo do turbo com memória **[playtest]**
- **Onde:** `physics/motores.ts` (função nova `passoEixo`) e `sim/update.ts`. Novo estado `eng.eixo` (0..1), igual ao que o som já usa com `desce`.
- **Fórmula:**
  ```
  alvoEixo = boostAlvo(m, rpm, gás=1)              // giro e carga
  eixo += (alvoEixo − eixo)·min(1, dt/τ)           // τ = lag ao subir; turbo.desce (1,1–2,2 s) ao cair sem gás
  alvoBoost = gás · min(eixo, alvoEixo)
  boost += (alvoBoost − boost)·min(1, dt/0,08)     // pressão no coletor: rápida
  ```
- **Efeito:** em reta, sem tirar o pé, é igual a hoje (0 / 0 / 0). Num alívio de 0,5 s, o boost volta em ~0,1 s em vez de ~`lag` (0,3–0,5 s). Recompensa quem "dá um toque" no trânsito sem largar o pé.
- **Risco:** médio. Os turbos ficam um pouco mais fortes em percurso com trânsito e curvas.

### P5 — Teto suave e arrasto quadrático acima do topo **[playtest]**
- **Onde:** `sim/update.ts`, onde hoje estão `maxSpd` e `clamp`.
- **Fórmula:**
  - Teto suave: com sobra de força, `a_ef = d + (a − d)·sqrt(clamp((top − v)/(0,04·top), 0, 1))`, com `d` o arrasto atual. O excedente some suave nos últimos 4%.
  - Acima do topo (nitro e descida), em vez de `clamp` seco: `arrasto += K_EXC·max(0, v − top)²`, com K_EXC ≈ 0,05 (km/h/s por (km/h)²). O nitro (+42 mais ~2 de sobra) se equilibra em ~top + 30 km/h, igual ao ×1,12 de hoje num carro de 244. A descida mais forte (grade ≈ 0,13, +27 km/h/s) se equilibra em ~top + 24, abaixo do `+420·grade` (+55) de hoje. Se a descida tiver de continuar "assustadora", usar K_EXC menor só para a parte da ladeira. Manter o `clamp` antigo como segurança.
- **Efeito [medido]**, teto suave:

| Carro | Até 95% do topo | Até 98% | Até 99,5% |
|---|---|---|---|
| AUTOHUB GT | 27,9 → 27,9 s | 30,2 → 30,4 s | 31,3 → 32,6 s |
| FANTASMA X | 31,5 → 31,5 s | 36,2 → 36,8 s | 39,2 → 42,6 s |
| SYLVA S15 | 32,3 → 32,3 s | 37,3 → 38,0 s | 41,0 → 44,9 s |
| TARGA 992 | 24,6 → 24,6 s | 27,9 → 28,3 s | 29,9 → 32,2 s |

  0–100, 0–160 e 0–200: 0.
- **Ganho de feel:** some a "parede" em que o velocímetro trava exato em 244. O ponteiro passa a "rastejar" os últimos km/h, como num carro de verdade.
- **Risco:** baixo a médio. Muda o momento exato em que se atinge a máxima, e a pontuação por velocidade (`score += speed·…`) muda um pouco em retas longas.

### Não fazer (por enquanto)

| Ideia | Por quê |
|---|---|
| Inércia rotacional γ real | 0–200 de −22% a −36% **[medido]**; o expoente 0,9 já cumpre o papel |
| Arrasto quadrático global | 0–200 de −6% a −25% **[medido]** |
| Aero por carro substituindo o teto | "Até 95% do topo" fica de +4 a +21 s mais lento, e o NINJA cai de 228 para 221 aos 60 s **[medido]** |
| Pacejka completo com roda integrada | O giro travado na velocidade é premissa do modelo; ω integrado a 60 fps exige sub-passos e diverge em baixa velocidade **[fonte 5]** |
| ALS, 2-step, remap | Tuning de desempenho fica fora agora (D12) |
| Rendimento de transmissão 0,7 | É só um corte de `power` disfarçado |

---

## 6. Ordem de commits sugerida

Um commit por item, cada um com `npm run build`, `npm run lint` e `npm test`. Atualizar o golden em commit próprio, com a justificativa, quando o desenho mudar.

1. `feat(game): giro contínuo na troca e blip na redução` (R1)
2. `feat(game): limitador físico duro e suave` (R4)
3. `feat(game): patinada visível pelo uso de tração` (R3, com teste de `usoTracao`)
4. `feat(game): câmera com zoom por velocidade, chute de troca e tremor por trauma` (R2)
5. `feat(game): spool do turbo depende do giro` (R5) e `feat(game): rampa do acelerador por motor` (R6)
6. **Parada para playtest.**
7. P1 (clima na tração), depois P5 (teto suave), P2 (freio-motor), P4 (eixo do turbo), P3 (tipo de câmbio), um por vez e com parada.

Registrar cada um no Log de mudanças do GUIA-V2.

## 7. Perguntas para o usuário

1. O ROADSTER MK1 nunca chegar a 220 km/h (fica em ~207–210) é intencional?
2. A chuva pode deixar o FWD de teste ~33% mais lento no 0–100? Ou o FWD deve ganhar compensação?
3. O DCT (TARGA, FANTASMA) deve ganhar o 0–200 como identidade, ou compensar no `power`?
4. Freio-motor: mais forte no manual (incentiva reduzir) ou igual nos dois modos?

## 8. Método de medição

Os números **[medido]** vêm de um script Bun fora do repo que importa direto `physics/motores.ts`, `physics/cambio.ts`, `physics/traction.ts` e `data.ts`, e replica o bloco longitudinal de `sim/update.ts`:
- dt = 1/120 s, reta plana, clima limpo;
- `autoShift` só na subida (gás no fundo);
- largada perfeita: 52 km/h, giro em 55% da faixa, boost = 0,35 × alvo;
- tempos contados a partir do verde.

Ele ignora tráfego, curvas, nitro e ramais. **Sugestão:** transformar isso num teste Vitest de "medidas" (`__tests__/medidas.test.ts`) que imprime a tabela da seção 1.2 e falha se algum 0–200 andar mais de ±3% sem atualização intencional. Esse seria o golden master do **equilíbrio**, complementar ao golden de pixels.

---

## Fontes

1. Marco Monster, "Car Physics for Games" (espelho): https://asawicki.info/Mirror/Car%20Physics%20for%20Games/Car%20Physics%20for%20Games.html
2. SwashSim, cap. 26 "Maximum Acceleration" (fator de massa γ = 1,04 + 0,0025ε², arrasto e rolamento, segundo Mannering & Washburn): https://swash17.github.io/SwashSim/ChapterMaxAccel.html
3. Brian Beckman, "The Physics of Racing" (índice; parte 1, transferência de peso; partes 21–25, escorregamento e aderência combinada): https://miata.net/sport/Physics/index.html · https://gamedev.net/tutorials/programming/math-and-physics/the-physics-of-racing-part-1-weight-transfer-r1610 · https://cygnus-supra.duckdns.org/Supra/Library/PhysicsOfRacing/physics_of_racing_25.html
4. OpenVD, modelos de pneu (fórmula mágica): https://andresmendes.github.io/openvd/build/html/tire.html
5. GameDev.net, "Simplified Pacejka magic formula": https://gamedev.net/forums/topic/462784-simplified-pacejka-magic-formula/
6. HPWizard, coeficientes de atrito do pneu (seco 0,8–0,9, molhado 0,5–0,7): https://hpwizard.com/tire-friction-coefficient.html
7. x-engineer, modelo de veículo (coeficiente de inércia rotacional): https://x-engineer.org/modeling-simulation-vehicle-automatic-transmission/5
8. GDSim, "Workshop V – Start Your Engines" (torque, arrasto do motor, inércia, embreagem na 1ª): https://lupine-vidya.itch.io/gdsim/devlog/677594/workshop-v-start-your-engines-mirror
9. Torque converter (Wikipedia) e Gearstar, "Talk the Torque": https://en.wikipedia.org/wiki/Torque_converter · https://gearstar.com/blog/talk-the-torque/
10. Engine braking (Wikipedia): https://en.wikipedia.com/wiki/Engine_brake
11. BeamNG wiki, CombustionEngine (inertia, friction, dynamicFriction, idleRPM) e fórum sobre friction e brakingCoefRPS: https://wiki.beamng.com/CombustionEngine · https://www.beamng.com/posts/125147/
12. Physics Forums, "Engine Braking" (cita a referência do Racer: torque de freio = coeficiente × rps): https://www.physicsforums.com/threads/engine-braking.179641/
13. Speedhunters, câmbio manual × DCT (tempos de troca e redução): https://www.speedhunters.com/?p=379543
14. Shift time (Wikipedia; DSG e PDK perto de 200 ms, F430 Scuderia 60 ms, Enzo 150 ms): https://en.wikipedia.org/wiki/Shift_time
15. Renndriver, Porsche PDK: https://renndriver.com/guides/porsche-pdk/
16. AngeTheGreat, Engine Simulator (repositório) e cobertura: https://github.com/ange-yaghi/engine-sim · https://www.thedrive.com/news/hear-this-absurdly-accurate-homebrew-engine-sim-rev-a-chevy-big-block
17. Grand Prix Engines, Note 99 (correlação de atrito e bombeamento × giro): https://www.grandprixengines.co.uk/Note_99.pdf
18. Wastegate (Wikipedia): https://en.wikipedia.org/wiki/Wastegate
19. COBB Tuning, "A Quick Look into Boost Creep": https://www.cobbtuning.com/subaru-tuning-a-quick-look-into-boost-creep/
20. Parâmetros de turbo do Assetto Corsa e CSP (LAG_UP/DN, REFERENCE_RPM, GAMMA, WASTEGATE): https://github.com/ac-custom-shaders-patch/acc-extension-config/wiki/Cars-%E2%80%93-Extra-turbo-options · https://www.racedepartment.com/threads/engine-ini-turbo-configuration.174373/
21. Street Muscle, "Grade on a Curve: Choosing the Right Supercharger" e Speedhunters (curva de boost por tipo de compressor): https://www.streetmusclemag.com/?p=5714 · https://www.speedhunters.com/?p=238885
22. Driving Line, centrífugo × Roots × parafuso duplo (perda parasita): https://drivingline.com/articles/centrifugal-vs-roots-vs-twin-screw-how-to-choose-the-right-supercharger-for-your-truck
23. Rev limiter (Wikipedia): https://en.wikipedia.org/wiki/Rev_limiter
24. HP Academy, limitador suave × duro: https://www.hpacademy.com/q-and-a/what-is-a-soft-and-hard-rev-limiter-how-do-they-work/
25. Holm, Skovhus e Kraus, "Increasing the Perceived Camera Velocity in 3D Racing Games by Changing Camera Attributes" (Springer, 2017): https://rd.springer.com/chapter/10.1007/978-3-319-55834-9_14
26. Disney Research, "Simulated motion blur does not improve player experience in racing game": https://studios.disneyresearch.com/?p=32591
27. Squirrel Eiserloh, "Math for Game Programmers: Juicing Your Cameras With Math" (GDC 2016) e exemplo do Bevy baseado no talk: https://gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing · https://bevy.org/examples/camera/2d-screen-shake/
28. Fórum Forza, tremor de câmera e sensação de velocidade: https://forums.forza.net/t/camera-shake-for-increased-sense-of-speed/708232
29. Operation Sports, "Why is speed so hard to capture in racing games": https://www.operationsports.com/why-is-speed-so-hard-to-capture-in-racing-games/
30. Unreal Engine, "How Formula Fusion nailed the feeling of fast": https://www.unrealengine.com/developer-interviews/how-formula-fusion-nailed-the-feeling-of-fast
31. PlayStation Blog, "Classic Levels Deconstructed: Burnout 3: Takedown's Alpine track": https://blog.eu.playstation.com/2017/08/31/classic-levels-deconstructed-burnout-3-takedowns-blistering-alpine-track
32. Gamestyle, análise de Burnout 3: https://gamestyle.com/?p=227
33. Hardcore Gaming 101, OutRun 2 / 2006 Coast 2 Coast: https://www.hardcoregaming101.net/outrun-2-outrun-2006-coast-2-coast/
34. Sonic Retro, entrevista com Steve Lycett (Sumo Digital): https://sonicretro.org/2012/10/retro-interview-steve-lycett-on-sonic-and-sega-all-stars-racing/

Pesquisas anteriores do projeto: [som-motor.md](som-motor.md) (turbo, compressor, limitador no som) e [visual-e-desafio.md](visual-e-desafio.md) (§2.2, taxa de bordas e FOV).

Não encontrei documentação pública do Edy's Vehicle Physics sobre atrito e inércia do motor, nem a página de referência do Racer (racer.nl) diretamente. O que está acima sobre o Racer vem de citação de terceiros **[fonte 12]**.

---

## Aplicado em 2026-11-14

Branch `feat/autodash-v2-mostwanted`. Cada item num commit, com `npm run build`, `npm run lint` e `npm test` verdes.

| Commit | Item | O que entrou |
|---|---|---|
| 9f709ef | (base) | `sim/longitudinal.ts`: o bloco longitudinal saiu de `sim/update.ts` sem mudar nada, para o teste de medidas rodar a mesma física do jogo |
| d2a91ee | (base) | `__tests__/medidas.test.ts`: trava de equilíbrio da seção 8 (0–100, 0–160, 0–200 e até 95% do topo a ±3%; velocidade aos 40 s a ±1%) |
| 0ca8e2e | R1 | Giro contínuo na troca (`physics/troca.ts`, `giroNaTroca`) e blip de 4% na redução. `CarSpec.cambio` (GT `seq`, TARGA e FANTASMA `dct`, resto `H`), só cosmético |
| 98ec486 | R4 | Limitador físico: corte duro pulsado a 13 Hz na fase do som; corte suave em rampa (`forcaNoCorte`) |
| 601b0f1 | R4 (correção) | A rampa de 2% da faixa baixava a máxima do ÁPEX de 262 para 260,7 km/h (o 262 dele fica dentro da rampa do i6, na 6ª). A rampa passou a ir de `corte − 50` (onde o limitador antigo zerava) até o corte. A trava de medidas ganhou a velocidade aos 60 s a ±0,3% |
| cca53b8 | R3 | `usoTracao()` em `physics/traction.ts`; acima de 0,9: fumaça, giro mostrado até +15% (`giroVisto`, conta-giros e som) e `AudioBus.skid`. A força não muda |
| e7e6c70 | R2 | `render/camera.ts`: zoom 1,00–1,03 por velocidade e +0,025 do nitro com rampa (ctx.scale no horizonte); tremor por trauma (trauma², ruído de valor suave, sem `Math.random`); ronco < 1 px; chute de troca por tipo de câmbio; tranco leve a cada pulso do corte duro |
| 2904a91 | — | Golden master regravado no estado do áudio do HEAD (o hash também depende de `sound/` e `audio.ts`, que mudavam em paralelo) |
| 985a257 | R5 | `fatorSpool`: o turbo enche até 40% mais rápido acima do giro de boost cheio |
| 0b20ea1 | R6 | `MotorFisico.resposta` (0,04–0,11 s) e `eng.gasF`; só força e boost usam. A rampa encosta exatamente em 1 (senão parava em 0,9999999999999999 e mudava o replay) |
| 4c59917 | P4 | `eng.eixo` com memória (`passoEixo`, `boostDoEixo`): sem gás o eixo cai em `turbo.desce`; voltar ao gás devolve o boost em ~0,1 s |
| c5d95e7 | P5 | `physics/arrasto.ts`: teto suave nos últimos 4% e arrasto `0,05·(v − topo)²` acima do topo. A trava antiga ficou como segurança |

### Efeito medido (dt = 1/60, largada perfeita, reta, automático)

- 0–100, 0–160, 0–200: iguais nos aspirados. Turbos (R5): 0–100 de −1,2% a −1,4% (ÁPEX, KAIJU, SYLVA, ROTOR, TARGA, FANTASMA), 0–200 ≤ −0,3%.
- Até 95% do topo: igual em todos. Até 98%: +0,25 a +0,65 s. Até 99,5%: +1,3 a +3,8 s (P5, como previsto).
- Máxima (aos 60 s): igual em todos. Aos 40 s, quem ainda chegava ao topo anda até 0,8% menos (FANTASMA 255,4 → 253,3; SYLVA 235,8 → 234,6).
- Retomada 100–160 saindo do pé solto (R6): +0,02 a +0,13 s (MUSCLE, τ 0,11 s, é o maior).
- Golden master: atualizado quando o desenho mudou (R1, R3, R2, P5), com o motivo no commit. R1 e R3 foram conferidos com um replay que só hasheia velocidade, marcha, posição, X e pontos: idêntico ao de antes.

### Diferenças em relação às fórmulas acima

- R3: fumaça com `ceil(patina × 8)` partículas por quadro, não × 20 (com 20 chegava a 12 por quadro). A largada queimada (`wheelspinT`) também solta o giro.
- R2: o tremor do limitador duro usa piso de trauma 0,2 + 0,04 por pulso (~1 px). Só com +0,04 o trauma² ficava invisível. Os `shakeT` antigos viram trauma por `0,3 + shakeT` (raspão ~2 px, batida ~11 px no pico).
- P4: o alvo do eixo usa o pé efetivo (`gasF`), não gás = 1. Sem gás o eixo não enche (senão um alívio longo em giro alto deixaria o turbo sempre cheio).
- P5: K_EXC único (0,05). Na descida forte (−13%), quem não está preso pelo teto da última marcha para em ~topo + 23 (SYLVA 261 em vez de 265). Se a descida tiver de continuar "assustadora", baixar K_EXC só para a parte da ladeira.

### Fica para o usuário (não aplicado)

- **P1** (clima e `power` no limite de tração): a chuva pode deixar o FWD de teste ~33% mais lento no 0–100? Ou o FWD ganha compensação?
- **P2** (freio-motor por marcha e por motor): mais forte no manual (incentiva reduzir) ou igual nos dois modos? No automático ele soma freio na entrada de curva e piora um pouco a volta de todos.
- **P3** (forma da troca por tipo de câmbio): o DCT (TARGA −4,4%, FANTASMA −6,7% no 0–200) fica como identidade ou compensa no `power`? O campo `CarSpec.cambio` já existe; falta só a física.
- O ROADSTER MK1 nunca chegar a 220 km/h (~206 aos 60 s) é intencional?
