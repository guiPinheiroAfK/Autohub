# Pesquisa: som de motor do AutoDash

> Documento de pesquisa (13/11/2026). **Não é spec nem ADR**: serve de base para decidir e planejar a reforma do `web-garagem/src/game/autodash/audio.ts`.
> Convenções: `[Fn]` = fonte numerada na seção [Fontes](#10-fontes). **(estimativa)** = número sem fonte direta: derivado de física simples, de engenharia reversa ou de gosto, e deve ser calibrado de ouvido.
> Alvo: um som de motor "fino, profundo" e **diferente para cada motor**, partindo do sintetizador por pulsos de combustão (simulador do Civic G8) que o dono já aprovou.

---

## 0. Resumo executivo

1. **O caráter de um motor vem do tempo entre os pulsos**, não do "timbre" do oscilador. Firing order, ângulo do V, plano do virabrequim e geometria do escapamento definem quando cada pulso chega ao ouvinte. O sintetizador de referência já gera pulsos. Para diferenciar motores, falta trocar o "contador uniforme" por uma **tabela de ângulos de ignição por cilindro (0–720°)**, mais **atraso por coletor (ms)** e **barramentos por bancada**.
2. Quase todo motor em V ou boxer pode ser descrito como **duas bancadas em linha defasadas de um ângulo** (`bankOffsetDeg`). Os exemplos: V6 ímpar = dois I3 a 90°, V10 ímpar = dois I5 a 54°, V8 flat-plane = dois I4 a 90°, V12 = dois I6 a 60°. A exceção é o **V8 cross-plane**, que é irregular dentro de cada bancada (90-180-270-180°) e por isso tem o "burble" [F3].
3. "Rumble" e "burble" são, no espectro, **meias-ordens** (múltiplos de rpm/120 Hz) roubando energia das ordens inteiras. Elas criam batimento (modulação de amplitude), e o ouvido é mais sensível a modulação perto de 4 Hz [F12].
4. Escapamento é outra camada, com parâmetros próprios: comprimento de header (atraso), agrupamento (quais cilindros dividem um coletor), crossover X/H (mistura entre bancadas), ressonância do tubo ("boom" ≈ c/2L), catalisador/abafador (passa-baixa e prateleiras).
5. Indução forçada tem números bem documentados. Assobio audível de turbo em 1,2–4,5 kHz [F21], whoosh de banda larga em 4–11 kHz [F21], surge (flutter) em 3–10 Hz [F20], blow-off "pssh". O whine de compressor volumétrico vem do rpm do rotor × lóbulos, com rotor a 14–18 mil rpm [F23].
6. Implementação: **AudioWorklet** (thread de áudio, blocos de 128 amostras) [F27]. O pulso bi-exponencial vira **dois filtros de 1 polo excitados por impulsos**: custo O(1) por amostra, independente do rpm e do número de cilindros. ScriptProcessor está depreciado e roda na thread principal, junto do Canvas.
7. Perfis de motor viram **dados** (`EngineSoundProfile`), um por carro. Há uma proposta de mapeamento dos 12 carros do jogo na [seção 2.15](#215-proposta-de-perfil-para-os-12-carros-do-jogo).
8. Amostras gratuitas com licença verificada existem, mas são poucas e não são "loops de rpm" prontos. Servem de camada de textura (mecânica, admissão, partida), não de motor principal (seção 4).

---

## 1. Fundamentos que valem para todas as arquiteturas

### 1.1 Fórmulas

| Grandeza | Fórmula | Exemplo |
|---|---|---|
| Rotação do virabrequim | `f_rev = rpm / 60` (Hz) | 3000 rpm → 50 Hz |
| Frequência de ignição (4 tempos, ignição uniforme) | `f_ign = rpm/60 × N/2` | I4 a 3000 rpm → 100 Hz |
| Ordem do motor | ordem `k` = `k × f_rev`. A ordem de ignição é `N/2` | I4 → ordem 2; V8 → ordem 4 |
| Intervalo de ignição uniforme | `720° / N` [F1] | I5 → 144°; W16 → 45° |
| Graus de virabrequim → tempo | `Δt = Δθ / (6 × rpm)` s | 180° a 3000 rpm = 10 ms |
| Meia-ordem (período do ciclo completo) | `rpm / 120` Hz | 800 rpm → 6,7 Hz |
| Atraso de header | `Δt = ΔL / c_gás`, com `c_gás ≈ 500–590 m/s` a 400–600 °C **(estimativa: c = 331·√(T/273))** | 0,5 m a mais → ≈ 0,9 ms |
| Ressonância de tubo aberto-aberto ("boom") | `f ≈ c_gás / (2L)` **(estimativa)** | L = 2,9 m, c = 550 → 95 Hz (o "boom" da referência) |
| Rotativo (Wankel) | 1 ignição por rotor por volta do eixo excêntrico [F9] → `f_ign = rpm/60 × rotores` | 2 rotores a 3000 rpm → 100 Hz |

> **Verificar na referência:** a descrição diz que a fase "avança rpm/120 × nº de cilindros/2 por segundo". Para um I4 isso dá rpm/60 (ordem 1). A frequência de ignição correta do I4 é rpm/30 (ordem 2): 100 eventos/s a 3000 rpm. Pode ser só a forma de descrever (por exemplo, um contador por par de cilindros), mas vale conferir no código do simulador antes de portar. No modelo generalizado abaixo, a questão some, porque a fase passa a ser em graus.

### 1.2 Ordens dominantes e o que é "caráter"

- **Ignição uniforme** concentra energia nas ordens `k·N/2`: I4 → 2, 4, 6…; I6 → 3, 6, 9…; V8 → 4, 8…
- **Variação entre cilindros** (cv, comprimento de header, combustão) e **ignição irregular** espalham energia para meias-ordens (0,5; 1; 1,5…). Quando duas componentes vizinhas têm frequência e amplitude parecidas, há **batimento** [F12]. Em marcha lenta isso aparece entre as ordens 4 e 4,5; a 4000 rpm, entre 2 e 2,5 [F12].
- Ouvido: modulação de amplitude perto de **4 Hz** soa mais alta e mais "viva" [F12]. A taxa de meia-ordem (rpm/120) passa por 4–8 Hz entre 500 e 1000 rpm. É por isso que a marcha lenta de um V8 ou de um Subaru "galopa".
- Motores com 8+ cilindros costumam ter harmônico forte em 3× a fundamental. O V12 Ferrari tem também 5× e espectro mais rico. Lamborghini V12 e Lexus LFA (V10) puxam um harmônico alto com o escapamento, e daí vem o "grito" [F13].
- **Ignição uniforme soa lisa, irregular soa "throaty/burble"** [F1][F4][F13].

### 1.3 Generalização do sintetizador de pulsos

Hoje a referência dispara pulsos a uma taxa uniforme. A proposta mantém o envelope, a cadeia de filtros e as leis de amplitude da referência e troca só o **agendador**:

```
φ ← (φ + 6·rpm·dt) mod 720            // fase do ciclo em graus de virabrequim
para cada cilindro i com ângulo θ_i:   // tabela do perfil
  se φ cruzou θ_i neste bloco:
    t_evento = instante do cruzamento + headerDelayMs_i + jitter
    amp      = A(rpm, carga) · (1 + cv_i) · (1 + N(0, jitter))
    intervalo_i = (θ_próximo_no_mesmo_bus − θ_i) / (6·rpm)
    t1 = min(t1Max · tauScale_i, 0.42 · intervalo_i);  t2 = 0.22 · t1
    injeta impulso(amp) no bus[bank_i] com (t1, t2)
```

- `A(rpm, carga) = (0,3 + 0,7·carga) · min(1, √(2200/rpm))`, igual à referência.
- **bus por bancada ou coletor**: cada bus tem pan, peaking do coletor e um passa-baixa próprio. Depois vem uma matriz de **crossfeed** (0 = escapamentos independentes; 0,3–0,4 ≈ H-pipe; 0,6–0,8 ≈ X-pipe; 1 = tubo único) **(estimativa)**. A partir daí segue a cadeia da referência: highpass 35 → boom → coletor → lowpass dinâmico → highshelf → tanh → compressor.
- **`headerDelayMs_i` é tempo fixo**, então o desvio angular cresce com o rpm (1 ms = 18° a 3000 rpm e 36° a 6000 rpm). Isso é fisicamente certo. Para um efeito audível também em marcha lenta, o perfil pode ter um **modo artístico**, com offset fixo em graus (`angleJitterDeg`) somado a θ_i.

### 1.4 Ordem de ignição × escapamento (camadas separadas)

| Camada | O que define | Parâmetros no perfil |
|---|---|---|
| **Motor** | instante de combustão de cada cilindro | `firing[i].angleDeg`, `cv`, `jitter`, `t1Max`, `bank` |
| **Header / coletor** | quando o pulso chega ao coletor e com que forma | `headerDelayMs`, `tauScale` (runner longo amolece o pulso), `collectorHz/Db` |
| **Crossover (X/H) e bancadas** | quanto uma bancada "vaza" na outra | `crossfeed`, `pan` por bus |
| **Tubulação** | ressonâncias (boom, drone) | `boomHz/Db`, `droneHz/Db` |
| **Catalisador / abafador / ponteira** | brilho, aspereza, volume | `lpBase/lpPerRpm/lpMax`, `shelfDb`, `drive` (saturação) |

Efeito de cada componente de escapamento (direção do ajuste; as quantidades são **estimativas**):

| Componente | Efeito sonoro (fontes) | Ajuste no sintetizador |
|---|---|---|
| Header de comprimentos iguais (EL) | pulsos chegam em intervalos iguais; som liso [F12][F14] | `headerDelayMs` = 0 para todos |
| Header desigual (UEL, Subaru) | pulsos chegam desencontrados; mais meias-ordens; batimento ("rumble") [F12][F14] | delays de 0,5–1,5 ms nos runners longos, `cv` −0,1 a −0,18 e `tauScale` 1,15–1,25 nos longos |
| Coletor 4-1 (corrida) | "rasp", agudo **(estimativa)** | `collectorHz` +20%, `shelfDb` +2 |
| Coletor 4-2-1 / 3-3 separado (I6) | cada coletor vê metade dos pulsos (ordem N/4), o "silk" do I6 [F15] | dois buses (`bank` 0/1) com `crossfeed` 0,8–0,9 |
| H-pipe | mais grave e "limpo" no rumble grave [F16] | `crossfeed` 0,3–0,4, boom +1 dB |
| X-pipe | mais agudo, "exótico", mais raspado em baixa [F16] | `crossfeed` 0,6–0,8, `lpMax` +15% |
| Duplo independente (true duals) | cada bancada soa sozinha; máxima irregularidade audível no cross-plane | `crossfeed` 0, pan ±0,3 |
| Catalisador | a colmeia dissipa pulsos e age como ressonador adicional [F17] | `lpMax` −10 a −20%, `drive` −20% |
| Abafador de câmaras | soa alto e raspado, sem material absorvente [F17] | peaking +2 dB em 500–900 Hz **(estimativa)** |
| Straight-through / glasspack | pouca contrapressão, mais ondas passam [F17] | `lpMax` +25%, boom +2 dB, `drive` +30% |
| Cano reto (sem abafador) | alto, áspero, drone em cruzeiro **(estimativa)** | sem lowpass dinâmico (só `lpMax` fixo e alto), `droneHz` = ressonância do tubo |
| Turbo no caminho | a turbina absorve parte da energia dos pulsos e o escape fica mais abafado **(estimativa)** | `lpMax` −25%, amplitude dos pulsos −3 dB, whoosh do turbo por cima |

---

## 2. Por arquitetura de motor

Formato de cada item: **ignição** → **fundamental/ordens** → **caráter** → **parâmetros para o sintetizador**. Ângulos `θ` em graus de virabrequim dentro de 0–720 (quatro tempos). A cadeia base é a da referência (I4): highpass 35 Hz, boom 95 Hz +6 dB, coletor 360 Hz +3 dB, lowpass `950 + 0,19·rpm (+1200·acel, teto 3300)`, highshelf 2,4 kHz +3 dB. Todos os números de filtro e cv abaixo são **(estimativa)** a calibrar; ângulos e ordens têm fonte ou são aritmética.

### 2.1 I3 (três em linha)
- **Ignição:** virabrequim a 120°, ignição a cada **240°**, ordem 1-2-3 ou 1-3-2 (sem diferença efetiva) [F1][F11]. Existe uma variante "T-plane" (Triumph, motos), irregular 180-270-270 [F11].
- **Fundamental:** ordem **1,5**. 900 rpm → 22,5 Hz; 3000 → 75 Hz; 7000 → 175 Hz. Harmônicos fortes em 3 e 4,5.
- **Caráter:** pulsos espaçados ("metade de um V6"), batida grave e áspera em baixa; em alta lembra um V6 rouco.
- **Parâmetros:**

| cil | θ | cv | bank |
|---|---|---|---|
| 1 | 0 | 0 | 0 |
| 2 | 240 | −0,12 | 0 |
| 3 | 480 | +0,08 | 0 |

`t1Max` 3,2 ms (intervalo longo: pulso um pouco mais encorpado), jitter 0,08, boom 105 Hz +5 dB, coletor 420 Hz +3 dB, lowpass `900 + 0,20·rpm` (teto 3000).

### 2.2 I4 (quatro em linha) — referência aprovada
- **Ignição:** 1-3-4-2 (algumas inglesas 1-2-4-3), a cada **180°** [F1].
- **Fundamental:** ordem **2**. 900 rpm → 30 Hz; 3000 → 100 Hz; 8000 → 267 Hz. Ordens 2, 4, 6. A ordem 1 e as meias-ordens aparecem só pelo cv.
- **Caráter:** "zumbido" que sobe de forma limpa; em alta fica metálico e a admissão domina (VTEC).
- **Parâmetros (= referência):**

| cil | θ | cv | bank |
|---|---|---|---|
| 1 | 0 | 0 | 0 |
| 3 | 180 | +0,10 | 0 |
| 4 | 360 | −0,07 | 0 |
| 2 | 540 | −0,16 | 0 |

O cv da referência é `[0, −0,16, +0,1, −0,07]`. A tabela assume que esse vetor é indexado por cilindro (1, 2, 3, 4) e o reordena pela ignição. Se na referência o índice for por evento de ignição, use o vetor na ordem original: o som muda pouco, mas confira antes de portar. Variante **VTEC**: acima de ~5500 rpm **(estimativa)**, ganho de admissão +4 dB e banda de admissão subindo para 1,2–2,2 kHz.

### 2.3 I5 (cinco em linha)
- **Ignição:** **1-2-4-5-3** (Audi, Volvo, VW, GM, Honda), a cada **144°** [F1][F5]. A alternativa 1-5-2-3-4 tem momento oscilante grande [F5].
- **Fundamental:** ordem **2,5**, uma meia-ordem, o que é a assinatura do cinco cilindros. 900 rpm → 37,5 Hz; 3000 → 125 Hz; 7000 → 292 Hz. Harmônicos em 5 e 7,5. A ordem 5 coincide com a fundamental de um V10, daí a comparação comum "parece meio V10" [F5].
- **Caráter:** "warble" característico (Audi Quattro/RS3), entre o I4 e o I6, com aspereza de meia-ordem.
- **Parâmetros:**

| cil | θ | cv | bank |
|---|---|---|---|
| 1 | 0 | 0 | 0 |
| 2 | 144 | −0,10 | 0 |
| 4 | 288 | −0,12 | 0 |
| 5 | 432 | +0,05 | 0 |
| 3 | 576 | +0,07 | 0 |

jitter 0,07, `t1Max` 2,8 ms, boom 90 Hz +6 dB, coletor 330 Hz +3 dB, lowpass `900 + 0,21·rpm` (teto 3600). Quase sempre turbo (seção 3).
- **Material de referência:** o pacote "Volvo S60 Engine Ramp Test" (Freesound, I5 2.4) tem **marcadores de rpm** nas rampas, feitos justamente para conferir a conversão Hz↔rpm em motor de número ímpar de cilindros. A licença é CC BY-NC 4.0: serve só para análise e calibração, não para embutir no jogo (seção 4).

### 2.4 I6 (seis em linha)
- **Ignição:** **1-5-3-6-2-4** (BMW aspirado, 2JZ, RB26), a cada **120°** [F1][F15]. Há variante 1-3-5-6-2-4 citada para um 3.0 turbo BMW [F15].
- **Fundamental:** ordem **3**. 900 rpm → 45 Hz; 3000 → 150 Hz; 7000 → 350 Hz. Ordens 3, 6, 9: balanceamento perfeito e espectro "limpo".
- **Caráter:** liso e cantado ("silk"). Com **coletor dividido 3+3** (dianteiro 1-2-3, traseiro 4-5-6), cada coletor recebe pulsos a cada 240° (ordem 1,5), e a soma volta para a ordem 3 [F15]. Um pequeno descompasso entre os dois coletores devolve um pouco de ordem 1,5: o "rasp" do 2JZ/RB.
- **Parâmetros:**

| cil | θ | cv | bank (coletor) |
|---|---|---|---|
| 1 | 0 | 0 | 0 |
| 5 | 120 | −0,04 | 1 |
| 3 | 240 | +0,03 | 0 |
| 6 | 360 | −0,05 | 1 |
| 2 | 480 | +0,02 | 0 |
| 4 | 600 | −0,03 | 1 |

`headerDelayMs` bank 1 = +0,15 ms (descompasso leve), `crossfeed` 0,85 (os coletores se juntam antes do abafador), jitter 0,05, `t1Max` 2,4 ms, boom 85 Hz +5 dB, coletor 300 Hz +2 dB, lowpass `950 + 0,24·rpm` (teto 4200).

### 2.5 Boxer 4 (Subaru EJ) — o "rumble"
- **Ignição:** **1-3-2-4** a cada 180°. Pela numeração Subaru, 1 e 3 ficam numa bancada e 2 e 4 na outra **(verificar a convenção)**, então cada bancada dispara **duas vezes seguidas** (0° e 180°; depois 360° e 540°).
- **Fundamental:** ordem **2**, igual ao I4. O que diferencia é o **escapamento**.
- **Caráter:** com header de comprimentos desiguais (UEL), os pulsos chegam ao coletor fora de compasso: "um pulso forte (dois se fundindo) seguido de uma nota mais suave" [F14]. No espectro, a energia se espalha entre ordens inteiras e meias-ordens, e o batimento resultante é o rumble [F12]. A boxer em si **não** é a causa: o WRX 2015+ com header EL soa liso [F14].
- **Parâmetros (modo UEL):**

| cil | θ | cv | bank | headerDelayMs | tauScale |
|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0,0 | 1,00 |
| 3 | 180 | +0,05 | 0 | 0,3 | 1,05 |
| 2 | 360 | −0,15 | 1 | 1,0 | 1,20 |
| 4 | 540 | −0,18 | 1 | 1,3 | 1,25 |

Os delays são **(estimativa)**: runner ~0,5–0,7 m mais longo do lado que cruza sob o motor. `angleJitterDeg` artístico ±8° para o galope aparecer em marcha lenta. `crossfeed` 1 (tubo único depois do coletor), jitter 0,10, boom 90 Hz +7 dB, coletor 280 Hz +4 dB, lowpass `850 + 0,17·rpm` (teto 3000). **Modo EL:** delays e tauScale zerados → soa como I4 grave.

### 2.6 Boxer 6 / flat-6 (Porsche) — incluído porque o jogo tem o TARGA 992
- **Ignição:** 1-6-2-4-3-5 (Porsche; bancada A = 1-2-3, B = 4-5-6) a cada 120°. Wikipedia lista R1-L2-R3-L1-R2-L3 [F1]. Cada bancada é um **I3 a 240°**.
- **Fundamental:** ordem 3 no total, ordem 1,5 por bancada.
- **Caráter:** como as bancadas têm escapamentos separados até tarde, a ordem 1,5 de cada lado sobrevive: o "uivo" metálico do 911 **(estimativa)**.
- **Parâmetros:** θ: 1→0, 6→120, 2→240, 4→360, 3→480, 5→600; bank A = {1,2,3}, B = {4,5,6}; `bankOffsetDeg` 120; cv pequeno (±0,04); `crossfeed` 0,25; pan ±0,25; boom 100 Hz +4 dB; coletor 420 Hz +3 dB; lowpass `1100 + 0,26·rpm` (teto 4800); highshelf +4 dB.

### 2.7 V6 60° (ignição uniforme)
- **Ignição:** R1-L1-R2-L2-R3-L3 [F1]. No Nissan VQ, 1-2-3-4-5-6, com ímpares numa bancada e pares na outra. A cada **120°**.
- **Fundamental:** ordem 3. Cada bancada a 240° (ordem 1,5), **bankOffset = 120°**.
- **Caráter:** mais áspero que o I6, porque cada bancada tem o próprio coletor: o "trompete" do VQ em alta **(estimativa)**.
- **Parâmetros:** θ: 1→0, 2→120, 3→240, 4→360, 5→480, 6→600; bank A = {1,3,5}, B = {2,4,6}; cv ±0,06; `crossfeed` 0,5 (Y-pipe); jitter 0,06; boom 95 Hz +5 dB; coletor 380 Hz +3 dB; lowpass `1000 + 0,24·rpm` (teto 4400).

### 2.8 V6 90°: ignição irregular (odd-fire) × uniforme (even-fire)
- **Odd-fire (Buick 231 antes de 1977, moentes compartilhados):** intervalos alternados de **90° e 150°** [F6]. Com a ordem Buick 1-6-5-4-3-2: θ = 1→0, 6→90, 5→240, 4→330, 3→480, 2→570. Cada bancada continua uniforme a 240° (A: 0/240/480; B: 90/330/570): são **dois I3 defasados de 90°** em vez de 120° (aritmética a partir de [F6]).
- **Even-fire (split-pin, moentes defasados ~30°):** intervalos uniformes de **120°** [F6]. Tabela igual à do V6 60°.
- **Fundamental:** ordem 3 nominal. No odd-fire, a **ordem 1,5** (período de 240°) fica forte e a 3 perde força, e daí vem o som "manco, de trator" e áspero [F6].
- **Parâmetros (odd):** `bankOffsetDeg` 90; cv ±0,08; `crossfeed` 0,6; jitter 0,09; boom 85 Hz +6 dB; coletor 300 Hz +3 dB; lowpass `850 + 0,18·rpm` (teto 3000).

### 2.9 V8 cross-plane — o "burble"
- **Ignição:** GM/Chrysler **1-8-4-3-6-5-7-2** [F2], a cada 90° no total. Ford Windsor/Coyote: 1-5-4-2-6-3-7-8 [F2].
- **Por bancada (GM, ímpares à esquerda):** L = 1→0, 3→270, 5→450, 7→540; R = 8→90, 4→180, 6→360, 2→630. Intervalos por bancada: **270-180-90-180** e **90-180-270-180** [F3]. Duas ignições seguidas na mesma bancada (5→7 e 8→4) "empilham" pulsos, e os pulsos colidem no coletor [F2].
- **Fundamental:** ordem **4** no total (3000 rpm → 200 Hz; marcha lenta de 700 rpm → 47 Hz). Por bancada, energia forte em **ordem 2 e meias-ordens**: o burble [F2][F13].
- **Caráter:** grave, irregular, "batimento" em marcha lenta; com H-pipe, mais grave; com X-pipe, mais raspado [F16].
- **Parâmetros:**

| cil | θ | bank | cv |
|---|---|---|---|
| 1 | 0 | L | 0 |
| 8 | 90 | R | −0,05 |
| 4 | 180 | R | +0,06 |
| 3 | 270 | L | −0,08 |
| 6 | 360 | R | +0,03 |
| 5 | 450 | L | +0,07 |
| 7 | 540 | L | −0,10 |
| 2 | 630 | R | +0,04 |

`crossfeed` 0 (true duals), 0,35 (H) ou 0,7 (X); pan L/R ±0,3; jitter 0,10; `t1Max` 3,2 ms; boom **75 Hz +8 dB** (tubulação longa); coletor 250 Hz +4 dB; lowpass `700 + 0,15·rpm` (teto 2600). Em marcha lenta, "lope" de comando bravo: modulação de amplitude 0,85–1,15 na taxa de meia-ordem e jitter 0,15 abaixo de 1200 rpm **(estimativa)**.

### 2.10 V8 flat-plane
- **Ignição:** moentes a 180°, então **cada bancada dispara a cada 180°** (é um I4) e as bancadas se alternam [F14]. Ordem Ferrari citada em fórum: 1-5-3-7-4-8-2-6 **(não verificada)**. Com ela, A = {1,3,4,2} em 0/180/360/540 e B = {5,7,8,6} em 90/270/450/630: **dois I4 defasados de 90°**.
- **Fundamental:** ordem 4 no total; cada bancada na ordem 2. Revisões de F355 notam que alguns flat-plane realçam ou atenuam a ordem 8 via escapamento [F14].
- **Caráter:** mais agudo e liso que o cross-plane, "grito" de alta rotação [F13][F14].
- **Parâmetros:** `bankOffsetDeg` 90; cv ±0,04; `crossfeed` 0,2; jitter 0,05; `t1Max` 2,0 ms; boom 95 Hz +4 dB; coletor 450 Hz +3 dB; lowpass `1200 + 0,30·rpm` (teto 5500); highshelf +4 dB.

### 2.11 V10
- **Ignição uniforme (72°):** exige moentes defasados (split-pin 18°) [F7][F13]. Exemplos: Lamborghini/Audi 5.0 (Gallardo inicial) e Ford Triton [F7]. Ordem Wikipedia: R1-L5-R5-L2-R2-L3-R3-L4-R4-L1 [F1]. Com ela, a bancada R fica em 0/144/288/432/576 (um I5 na ordem 1-5-2-3-4) e a L é a mesma coisa deslocada **72°**.
- **Ignição irregular (54°/90°):** moentes compartilhados num bloco a 90°. Exemplos: Dodge Viper [F7] e Lamborghini 5.2 (LP560-4), com fontes citando 90/54 ou 90/58 [F7]. Equivale a dois I5 deslocados **90°** (ou 54°).
- **Fundamental:** ordem **5** (3000 rpm → 250 Hz; 9000 → 750 Hz). Cada bancada fica na ordem 2,5, a mesma do I5. No odd-fire, essa ordem 2,5 fica forte, e por isso o Viper tem um som "de caminhão" rouco.
- **Caráter:** uniforme = grito agudo (LFA, Gallardo 5.0); irregular = mais rouco e áspero.
- **Parâmetros:** `bankOffsetDeg` 72 (even) ou 90 (odd); cv ±0,05; `crossfeed` 0,3; jitter 0,05 (even) ou 0,08 (odd); `t1Max` 1,8 ms; boom 100 Hz +4 dB; coletor 480 Hz +3 dB; lowpass `1200 + 0,30·rpm` (teto 6000).

### 2.12 V12 60°
- **Ignição:** cada bancada é um **I6 (1-5-3-6-2-4)**, com as bancadas deslocadas **60°**: um pulso a cada 60° no total. Ordem frequentemente citada para Ferrari: 1-7-5-11-3-9-6-12-2-8-4-10 **(não verificada)**. A Wikipedia só diz que as ordens de V12 variam [F1].
- **Fundamental:** ordem **6** (3000 rpm → 300 Hz; 9000 → 900 Hz). Harmônicos em 3× e 5× a fundamental dão o "calor" do Ferrari V12 [F13].
- **Caráter:** liso, denso, quase contínuo. Em alta vira um tom cantado; o Lamborghini V12 tem menos harmônicos e soa mais "cortante" [F13].
- **Parâmetros:** `bankOffsetDeg` 60; cv ±0,03; jitter 0,04; `t1Max` 1,6 ms; `crossfeed` 0,3; boom 100 Hz +3 dB; coletor 500 Hz +2 dB; lowpass `1300 + 0,30·rpm` (teto 6500); highshelf +4 dB; saturação (drive) +20% para gerar harmônicos 3× e 5×.

### 2.13 W16 (Bugatti)
- **Ignição:** **45°** entre ignições, em ordem "assimétrica" entre bancadas [F8]. A ordem 1-14-9-4-7-12-15-6-13-8-3-16-11-2-5-10 é citada por WhichCar para o Veyron [F8] e diverge de outra fonte de menor qualidade.
- **Fundamental:** ordem **8** (3000 rpm → 400 Hz; 6700 → 893 Hz).
- **Caráter:** quatro turbos abafam os pulsos. O som é grave, denso, com muito sopro (whoosh) e pouca "nota" de escapamento **(estimativa)**.
- **Parâmetros:** θ_k = 45·k na ordem acima; 4 buses (um por turbo), com o evento k indo para o bus k mod 4 (cada bus a 180°, **atribuição artística, estimativa**); cv ±0,03; jitter 0,04; boom **70 Hz +6 dB**; coletor 220 Hz +3 dB; lowpass `600 + 0,12·rpm` (teto 2000); turbo com 4 eixos levemente desafinados (±1,5%) para dar batimento no assobio.

### 2.14 Rotativo (Wankel)
- **Ignição:** cada rotor faz 3 ciclos por volta própria, e o eixo excêntrico gira 3× mais rápido que o rotor. Resultado: **1 pulso por rotor por volta do eixo** [F9]. No 13B (2 rotores, defasados 180°): θ = rotor A em 0 e 360, rotor B em 180 e 540, dentro de uma janela de 720°. No 20B (3 rotores), a 120°.
- **Fundamental:** 2 rotores → ordem **2**, a mesma do I4. 3 rotores → ordem 3.
- **Caráter:** o que o diferencia do I4 é a **forma do pulso**. A janela de escape fica aberta ~270° de eixo (duty ~75%, contra ~25% num pistão), e a porta periférica abre de forma abrupta [F9]. Isso dá ataque seco e corpo longo, um som "rasgado" e agudo. Em marcha lenta, motores com **bridgeport** têm overlap grande entre admissão e escape, o que dá reversão e falhas de combustão: o "brap-brap" irregular [F10].
- **Parâmetros:** `t1Max` 4,0 ms, `t1Frac` 0,6 (corpo mais longo), `t2Frac` **0,10** (ataque mais seco); cv ±0,05; jitter 0,12; `missChance` em marcha lenta 0,05 (porting de rua) ou 0,15 (bridgeport), caindo a 0 acima de 3000 rpm **(estimativa)**; boom 110 Hz +4 dB; coletor 600 Hz +4 dB; lowpass `1400 + 0,32·rpm` (teto 5500); highshelf **+5 dB**; redline de áudio 8500.

### 2.15 Proposta de perfil para os 12 carros do jogo

Hoje o jogo tem `ENGINE_VOICE` (pitch, brilho) por carroceria em `engine.ts`, e todos os carros compartilham `RPM_IDLE = 900` e `RPM_LIMITER = 7900` (`data.ts`). Sugestão de perfis (a decisão é do dono):

| Carro (`body`) | Perfil sugerido | Indução | Redline de áudio | Alternativa |
|---|---|---|---|---|
| AUTOHUB GT (`gt`) | I5 2.5 (Audi-like) | turbo simples | 7000 | I6 aspirado |
| MUSCLE 71 (`muscle`) | V8 cross-plane, H-pipe, glasspack | aspirado (opcional Roots) | 6200 | X-pipe |
| NINJA RS (`ninja`) | I4 VTEC (referência Civic aprovada) | aspirado | 8000 | — |
| FANTASMA X (`ghost`) | V12 60° | twin-turbo paralelo | 7000 | V10 even-fire aspirado (8700) |
| NOTURNO Z (`zcoupe`) | V6 60° (VQ) | aspirado | 7000 | V6 twin-turbo |
| ROTOR FD (`rotor`) | Rotativo 2 rotores (13B) | twin-turbo sequencial (2º turbo ~4000–4500 rpm [F24]) | 8500 | bridgeport sem turbo |
| ÁPEX A80 (`apex`) | I6 (2JZ) | twin-turbo sequencial | 6800 | single turbo grande (lag e flutter) |
| KAIJU R32 (`kaiju`) | I6 (RB26), borboletas individuais (admissão forte) | twin-turbo paralelo | 8000 | — |
| SYLVA S15 (`sylva`) | I4 (SR20) | turbo, BOV atmosférica "pssh" | 7500 | — |
| ROADSTER MK1 (`roadster`) | I4 1.6 pequeno, boom 110 Hz | aspirado | 7000 | — |
| ALTA IS (`alta`) | I4 (3S-GE, Altezza RS200) | aspirado | 7600 | I6 aspirado (IS300) |
| TARGA 992 (`flat6`) | Flat-6 | twin-turbo paralelo | 7500 | flat-6 aspirado (GT3, 9000) |
| Polícia (IA) | V8 cross-plane, X-pipe | aspirado | 6000 | — |
| Tráfego | voz barata (seção 3.7/5.4) | — | — | — |

Isso cobre I4 (×3), I5, I6 (×2), V6, V8, V12, flat-6 e rotativo. Boxer-4 Subaru, flat-plane V8, V10 e W16 ficam documentados para carros futuros.

**Decisão em aberto:** o rpm da física vai de 900 a 7900 para todos. Duas opções:
- (a) **mapear** o rpm do jogo para a faixa do perfil (`rpmAudio = idle + (rpmJogo − 900)/7000 · (redline − idle)`), sem mudar gameplay, mas com o conta-giros do HUD mostrando outro número;
- (b) dar redline por carro na física, o que é mudança de gameplay e vai em commit separado, conforme o CLAUDE.md.

---

## 3. Indução forçada

### 3.1 Turbo: spool, assobio, whoosh
- **Física do eixo:** rodas de turbo giram tipicamente a **100–150 mil rpm** [F21]. A **frequência de passagem de pás** (BPF = rpm/60 × nº de pás) cai em ~16–22 kHz para rodas de 10–13 pás, quase inaudível.
- **O assobio audível** que reconhecemos é outro fenômeno. É o "unbalance whistle", ligado à excentricidade do rotor e à geometria das pás, em **1,2–4,5 kHz** e fortemente dependente da rotação [F21]. Um boletim de serviço Audi descreve assobio de **2,8–3,2 kHz** a 1500–2200 rpm e ~70% de carga [F21]. A faixa 1100→3400 Hz da referência corresponde a um eixo a ~66 mil→204 mil rpm, se o tom for síncrono com a rotação: está **coerente**.
- **Whoosh:** ruído de **banda larga em 4–11 kHz**, que aparece quando o compressor opera perto da linha de surge durante a aceleração [F21]. A referência usa 2–3,8 kHz. Sugestão: dois ruídos, um em 2–3,8 kHz (corpo) e um em 5–9 kHz (ar) com ganho baixo **(estimativa)**.
- **Spool:** modelar `boost` como sistema de 1ª ordem. Alvo `boostAlvo = clamp((rpm − rpmSpool)/(rpmPleno − rpmSpool)) · acel`, com constante de tempo τ de 0,25 s (turbo pequeno) a 1,0 s (turbo grande) **(estimativa)**. Velocidade do eixo `∝ √boost`. A pressão sobe com o quadrado da velocidade do compressor, então o pitch sobe rápido no início e satura **(estimativa, física de compressor centrífugo)**.
- **Wastegate:** ao atingir o boost alvo, a válvula abre e o assobio para de subir. Com wastegate externa e "screamer pipe", há um chiado raspado sincronizado aos pulsos do motor. Modelo: ruído passa-banda 1–3 kHz multiplicado pelo envelope dos pulsos, ganho ∝ abertura da wastegate **(estimativa)**. O "chirp" curto ao soltar o pedal, em sistemas de recirculação, é um flutter curto (2–4 ciclos).

### 3.2 Flutter (surge do compressor) × blow-off ("pssh")
- **São fenômenos diferentes.** Ao fechar a borboleta com boost, o ar comprimido não tem para onde ir e reverte pelo compressor: isso é o **surge** [F19]. O som de "stu-tu-tu" vem **do turbo, não da válvula** [F19]. A BOV existe para impedir o surge e, quando ventila para a atmosfera, faz o "pssh" [F19].
- **Frequência do surge:** surge leve medido em **9,6 Hz e 5,1 Hz** em dois compressores de produção [F20]; surge profundo com oscilações de **3–10 Hz** [F20]. A frequência acompanha a ressonância de Helmholtz do sistema e cai no surge profundo [F20]. A referência (13 Hz desacelerando até 7,5 Hz) está na faixa certa. Sugestão: começar em 10–13 Hz e cair até 5–7 Hz, com profundidade proporcional ao boost no momento do corte.
- **Blow-off:** a referência (ruído highpass 3 kHz + pico 6,5 kHz, decaimento 0,15–0,3 s) é adequada. Variações por perfil:
  - atmosférica "pssh" (Sylva S15): ganho alto, pico 5–7 kHz;
  - recirculação (OEM): ganho −12 dB, mais grave (pico 2–3 kHz) e com flutter curto;
  - "sem BOV": só flutter **(estimativa)**.
- **Twin-turbo paralelo:** dois assobios desafinados ±1–3% geram batimento lento; os flutters ficam levemente defasados **(estimativa)**.
- **Twin-turbo sequencial (RX-7 FD, Supra A80):** só o primário até ~4000–4500 rpm (FD) [F24]. Na transição, há uma queda breve de boost e o 2º assobio entra num tom mais grave, o que é uma ótima pista sonora. O ponto de troca é ajustável no ECU [F24].

### 3.3 Anti-lag (ALS) e 2-step
- **Como funciona:** atrasa a ignição e enriquece a mistura (às vezes injeta ar no coletor de escape). O combustível queima no escapamento e mantém a turbina girando sem pé no acelerador [F22]. Os estouros são essas explosões controladas no escape [F22]. Em rali (Mitsubishi, Toyota), o sistema desvia ar de admissão direto para o coletor [F22].
- **Síntese:** com ALS ativo e `acel < 0,1`, cada evento de ignição tem chance de 0,3–0,6 de virar estouro. Use o buffer de "pop" da referência com ganho +6 dB e senoide 60–110 Hz, mais ruído. O boost fica em ~50% do alvo enquanto o ALS estiver ligado **(estimativa)**. Somar crepitar contínuo (o trem de cliques da referência) com densidade 2×.
- **2-step (largada):** na largada com semáforo, limita o rpm em ~4000–5000 com corte de ignição. Dá estouros ritmados (bom para `semaphoreRed/Green` e `perfectLaunch`) [F22].

### 3.4 Compressor volumétrico (supercharger)
Fórmula geral do whine:

```
f_whine = rpm_motor / 60 × relação_da_polia × pulsos_por_volta_do_rotor
```

- **Roots (Eaton M90/M112, 3 lóbulos):** uma fonte dá **6 pulsos por volta do motor** para polia 2:1 × 3 lóbulos [F23], o que conta um rotor só. Pela geometria, cada rotor descarrega um "bolso" por lóbulo; com os dois rotores, seriam 2 × 3 = 6 pulsos por volta **do rotor** **(estimativa, verificar)**. Relação típica ~1,8:1 (M90 GM: polia 3,8" com balanceador 7") e rotor a ~14 mil rpm no limite [F23]. Exemplo: 6000 rpm de motor × 1,82 = 10,9 mil rpm de rotor = 182 rev/s. Isso dá **~546 Hz** (3 pulsos/volta) ou **~1092 Hz** (6 pulsos/volta), com harmônicos.
- **Eaton TVS (R1900; 4 lóbulos, torção 160°):** rotação máxima típica de **18.000 rpm** [F23]. Relações de 1:1 ou 2:1 aparecem nas especificações de outros modelos TVS [F23]. A 18 mil rpm, 300 rev/s × 4 = 1,2 kHz (ou 2,4 kHz contando os dois rotores) **(estimativa)**. Por causa da torção, o whine é mais suave que o de um Roots antigo **(estimativa)**.
- **Twin-screw (Whipple, Lysholm):** rotor macho de 3 lóbulos e fêmea de 5 (o macho gira ~1,66× a fêmea); o Gen-5 usa 4×6 [F23]. Máximo de **18.000 rpm** para o W175AX [F23]. Frequência de engrenamento = rpm_macho/60 × lóbulos_macho: 18 mil rpm → 900 Hz (3 lóbulos), com harmônicos. É descrito como "mais agudo e mecânico" que o Roots [F23].
- **Centrífugo (ProCharger P-1SC-1):** rotor até **65.000 rpm**, com multiplicação interna de **4,10:1** [F23]. O whine é o assobio do rotor, parecido com turbo, mas **travado ao rpm do motor** e sem lag, com o boost crescendo com ~rpm². As engrenagens de dentes retos fazem barulho, e a ProCharger oferece engrenagens helicoidais opcionais para reduzir o ruído [F23].
- **Carga:** com a borboleta parcial, a válvula de bypass abre e o whine cai bastante. Em carga plena, o whine vai ao máximo. Modelo: `ganhoWhine = 0,25 + 0,75·carga` **(estimativa)**.
- **Síntese:** 2–3 senoides (fundamental + 2× + 3×) com pequena modulação de amplitude na taxa de lóbulos/rotor, e ruído passa-banda Q 6 na fundamental. Pitch **exatamente proporcional** ao rpm (sem lag), o que reforça a leitura do rpm.

### 3.5 Como o som muda com a carga (resumo)
| Situação | Pulsos | Admissão | Turbo | Overrun |
|---|---|---|---|---|
| Carga plena | amplitude máx., lowpass aberto (+1200 Hz da referência) | forte | assobio + whoosh subindo | — |
| Cruzeiro | ~40% | média | assobio estável, baixo | — |
| Pé fora em alta (off-load) | 0,3 de amplitude, mais grave | chiado de vácuo leve (bandpass ~1 kHz, −18 dB) | BOV/flutter, assobio caindo | pops acima de 3300 rpm (referência) |
| Freio-motor prolongado | pulsos fracos, ordem 1 mais audível | — | eixo desacelerando ~1,5 s | crepitar esparso |

---

## 4. Amostras gratuitas (para um modelo híbrido)

**Regra:** a licença vale por arquivo. Conferir na página de cada arquivo antes de baixar e registrar autor, URL e licença em `web-garagem/public/.../CREDITS` (não existe ainda). Custo zero (ADR 0004): servir o arquivo estático pelo próprio Netlify.

| Fonte | Conteúdo | Licença (verificada em) | Uso sugerido |
|---|---|---|---|
| Freesound #141240 "Renault 19 underhood acceleration" (lovretta) | 1:22, FLAC 24-bit/44,1 kHz, estéreo; partidas, aceleração a 6000 rpm, blips a 7000, derrapagem | **CC0** (página do Freesound, 13/11/2026) [F32] | textura mecânica e de admissão de I4 carburado; análise espectral |
| Freesound #669622 "Car Engine Contact Recording – Mini Cooper S" (TheLittleCrow) | 32 s, WAV 24-bit/48 kHz; microfones de contato (um canal no bloco, outro no chassi) | **CC0** (página do Freesound) [F32] | camada estrutural ("booming") da perspectiva interna |
| Freesound #50898 "Car Ignition Key – Engine Starting Running Idle 2" (RutgerMuller) | 4,8 s, WAV 16-bit/44,1 kHz, mono | **CC0** (página do Freesound) [F32] | evento de partida (chave e arranque) |
| OpenGameArt "racing car engine sound loops" | loops feitos para banditracer.eu, a partir de gravação em domínio público; diferem só em pitch | **CC0** segundo a listagem do site [F32] (a página bloqueou acesso automatizado: conferir manualmente) | voz barata para tráfego |
| OpenGameArt "motor sound effect" | loop de motor feito com a boca (moto/scooter) | **CC0** segundo a listagem [F32] | cômico/scooter, opcional |
| muted.io "Performance Cars" | 68 gravações de carros esportivos, WAV 96 kHz/24-bit | **CC0** (página do muted.io) [F32]; download via Ko-fi (conferir se é gratuito ou "pague quanto quiser") | passagens, aceleração, partidas; fonte de pops reais |
| Sonniss "GameAudioGDC" (pacotes anuais) | dezenas de GB de efeitos profissionais | **não é CC**: royalty-free, uso comercial, sem atribuição, **proibido treinar IA**; conferir a licença do ano [F32] | colisões, vidro, pneus, ambiente de túnel |
| Freesound pack "Volvo S60 Engine Ramp Test" (el-bee) | rampas de I5 2.4 com **marcadores de rpm**, WAV 96 kHz/24-bit | **CC BY-NC 4.0** (não comercial; crédito "Arto Koivisto") [F32] | **só análise e calibração** do perfil I5; não embutir |
| Kenney (kenney.nl) | pacotes de corrida são gráficos (CC0), sem áudio de motor [F32] | CC0 | não serve para motor |

Dicas:
- No Freesound, dá para filtrar por licença na busca (filtro "Creative Commons 0").
- **Formato:** converter para mono 48 kHz em OGG/Opus ou AAC (~64 kbps): um loop de 3 s fica com ~24 KB **(estimativa)**. MP3 insere silêncio de "priming" e quebra loops; se usar MP3, cortar com `loopStart/loopEnd` no `AudioBufferSourceNode`. O suporte a Opus no `decodeAudioData` do Safari precisa ser testado **(verificar)**.
- **Híbrido recomendado:** a síntese faz a nota (pulsos), e as amostras entram só como textura não tonal, sem pitch-shift grande:
  - ruído mecânico filtrado e em loop, com o playbackRate preso em 0,8–1,25;
  - eventos one-shot (partida, pops reais, colisão).

  Assim não aparecem os artefatos de crossfade entre loops que os jogos AAA tratam com dezenas de amostras por carro [F25].

---

## 5. Mixagem e design de som de jogo

### 5.1 Como a indústria trata rpm e carga
- **Loops com crossfade (o método mais comum):** um conjunto de loops on-load e outro off-load em rpm fixos, com crossfade por rpm. O estado estável é uma mistura sutil dos dois [F25]. No Wwise, a carga é um RTPC em 0..1 ou −1..1 e o rpm é normalizado entre marcha lenta e redline. O off-load é definido como "sem acelerador, rpm acima da marcha lenta" [F25]. Dica do Audiokinetic: desenhar os loops para que os crossfades on-load e off-load **nunca aconteçam ao mesmo tempo** [F25]. No FMOD, o equivalente é uma Blend Track com "Crossfade" ligada ao parâmetro de rpm [F25].
- **Granular:** analisa uma rampa de aceleração, fatia por **ciclo de combustão** e concatena, pula ou repete ciclos para tocar mais rápido ou mais devagar. Faz isso com a carga e um câmbio/embreagem virtuais. É o caso do **REV** da Crankcase, que leva ~10 minutos por modelo contra 3–4 dias de pilha de loops [F25]. O **AudioMotors** (AudioGaming, plugin FMOD, usado em WRC5) detecta as posições do ciclo do motor automaticamente, tem controle de rpm e "drive" (carga on/off) e modela carga em aceleração, desaceleração e troca de marcha [F25]. No Wwise, quem faz o granular é o REV (RTPCs de rpm, carga 0–1 e acelerador) [F25].
- **AAA:** o Project CARS usa bem mais de 100 arquivos por carro. O Forza modela motor, admissão, escape, transmissão, turbo e supercharger como fontes separadas [F25]. A transmissão "geme" com o esforço, e o som do pneu é exagerado para comunicar o limite de aderência [F25].
- **Burnout:** o Burnout 1 ressintetizava parciais tonais por Fourier e cruzava o ruído. O Burnout 2 adicionou wavefolder e clipping para dar "mordida" em alta rotação, além de modelos de turbo e supercharger [F26]. O turbo era um glissando de **Shepard-Risset**, com sensação constante de aceleração. A "Infinite Gear" se aproxima assintoticamente de um whine e troca de marcha de novo [F26]. **O foco migrou do motor para pistas de velocidade** (passagens, buzinas) [F26].
- **O que o AutoDash herda disso:** o sintetizador de pulsos já é, na prática, um "granular de um ciclo só" com parâmetros físicos. Ele cobre o que o REV e o AudioMotors fazem, sem amostras. O modelo de pesquisa SDT/SkAT-VG (`sdt.motor`) é uma referência aberta para os parâmetros: nº de cilindros, tempo de faísca, assimetria, comprimentos de admissão, headers, tubo principal e ponteira, abafador e backfire. Ele usa guias de onda digitais e tem três saídas (admissão/frente, vibração/interior, escape/traseira) [F18].

### 5.2 Camadas on-load / off-load no sintetizador
Não precisa de dois conjuntos de amostras: a carga muda parâmetros contínuos.

| Parâmetro | Off-load (carga 0) | On-load (carga 1) |
|---|---|---|
| Amplitude do pulso | 0,3 | 1,0 (referência) |
| Lowpass | base | base + 1200 Hz (referência) |
| `t2Frac` (ataque) | 0,30 (mais mole) | 0,22 |
| Drive do waveshaper | 0,6 | 0,8–1,0 |
| Admissão | chiado de vácuo −18 dB | rugido bandpass 600–1500 Hz subindo |
| Overrun | pops / crepitar (referência) | — |

Suavização dos controles: rpm com τ ~30 ms, carga com τ ~60 ms. Carga e acelerador são coisas diferentes: em subida de marcha a carga cai a zero durante o `shiftMs` **(estimativa)**.

### 5.3 Perspectiva interna × externa
O jogo usa câmera de perseguição, então a perspectiva padrão é **externa traseira**: escape dominante. Para uma futura câmera de capô ou cockpit, ou para a "câmera de capacete" do Project CARS (filtro pente e passa-baixa variando com a força G [F25]):

| Camada | Externa traseira | Interna (cockpit) |
|---|---|---|
| Escape | 0 dB | −6 dB, passa-baixa 1,8–2,5 kHz |
| Admissão | −8 dB | 0 dB (fica na frente do motorista) |
| Estrutural (vibração do bloco) | −20 dB | −6 dB, banda 20–300 Hz, a faixa de "booming" da cabine [F29] |
| Turbo / whine | −6 dB | 0 dB |
| Vento | −10 dB | −14 dB (a cabine filtra) |

O ganho em dB é **(estimativa)**. O booming da cabine é a ressonância do ar da cabine excitada pelo motor. A 2ª ordem do motor é a maior contribuição num caso medido, com pico perto de 50 Hz [F29].

### 5.4 Outros carros: Doppler, distância, passagens
- **Doppler no Web Audio:** o Doppler do `PannerNode` foi **removido da especificação**, e `setVelocity()` está depreciado [F27]. É preciso implementar à mão:
  - **Opção A (barata):** para vozes sintetizadas, multiplicar a base de tempo (a fase em graus) por `c / (c − v_r)`, com `v_r` = velocidade radial de aproximação e `c` = 343 m/s, limitado a [0,8; 1,25].
  - **Opção B (física):** um `DelayNode` com `delayTime = distância / c`, que dá Doppler e atraso juntos (custa uma linha de atraso por voz).
- **Exagero de passagem (o "Minto effect" do Burnout):** amplitude elevada a uma potência, para ataque e queda mais agudos, e pitch subindo na aproximação e caindo depois, sugerindo aceleração [F26]. Os whooshes são sincronizados para que o **meio da amostra coincida com o ponto de maior aproximação** [F26].
- **Distância:** ganho `ref / max(ref, d)` e passa-baixa de absorção do ar, de 18 kHz a 3 kHz conforme a distância vai de 0 a ~200 m **(estimativa)**.
- **Orçamento de vozes:** jogador com o modelo completo; 2 rivais mais próximos com 1 bus, sem admissão e sem turbo detalhado; tráfego com voz barata (um bus compartilhado de pulsos de I4 com rpm aleatório, ou o loop CC0 do OpenGameArt). Roubo de voz por distância.

### 5.5 Reverb de túnel e ponte
- Túneis longos sem tratamento acústico são **muito reverberantes**: as ondas refletem várias vezes nas paredes, e túneis mais longos decaem pior [F28]. Asfalto poroso encurta a reverberação [F28]. Nas fontes encontradas, o valor exato de RT60 não ficou legível. Usar **RT60 de 1,5–3 s** para túnel e **0,3–0,6 s** para passagem sob viaduto **(estimativa)**.
- **Implementação:** `ConvolverNode` com uma resposta ao impulso sintética gerada no `ensure()`: ruído estéreo descorrelacionado com decaimento exponencial e lowpass progressivo, sem asset. Mais uma reflexão inicial ("slap") de **20–30 ms** (parede a ~9 m: 9/343 ≈ 26 ms) **(estimativa)**. Wet de −10 dB no túnel e −16 dB sob ponte; transição de 250–400 ms na entrada e na saída.
- **Truque clássico:** no túnel, motor +2 a +3 dB e lowpass +15%. Os jogadores reduzem marcha no túnel para ouvir o motor, então vale dar recompensa sonora **(estimativa)**. Ligar às zonas e biomas que já existem em `world/zones.ts` e `world/biomes.ts`.

### 5.6 Buses, ducking, loudness, limitador
- **Estrutura:** `motor do jogador` / `outros carros` / `SFX de eventos` / `UI` / `ambiente (chuva, vento)` / `música` → `master` → limitador → saída. Hoje tudo vai direto para `master`, com ganho 0,5.
- **Ducking:** o Web Audio **não tem sidechain** no `DynamicsCompressorNode`. Usar **ducking dirigido por eventos**, no estilo dos "mixer events" do Split/Second, que mexem em volume e em filtros passa-alta e passa-baixa quando há explosão próxima e priorizam o que está perto e em foco [F26]:
  - colisão: música −8 dB (ataque 20 ms, release 600 ms), outros carros −6 dB;
  - quase-batida: motor −3 dB por 200 ms, whoosh em evidência;
  - nitro: música +1 a +2 dB (o Burnout aumentava a música no boost [F26]), motor com lowpass aberto.

  Os dB e tempos são **(estimativa)**.
- **Ducking espectral barato:** o Split/Second compara a música e o motor por FFT e corta na música as frequências em conflito [F26]. Versão simples: na música, um peaking de −3 a −4 dB centrado na fundamental atual do motor do jogador (100–400 Hz), com ganho ∝ acelerador **(estimativa)**.
- **Loudness:** não há norma para web. A referência mais próxima é a da Sony (ASWG-R001): **−24 LUFS ±2** em consoles de mesa e **−18 LUFS ±2** em portáteis, **true peak −1 dBTP** [F30]. Para navegador, que costuma tocar em notebook ou fone, mirar em **−18 a −16 LUFS integrados** e pico ≤ −1 dBTP [F30]. Medir gravando 5 minutos de corrida (o Chrome grava aba via `MediaRecorder` ou ferramenta externa) e passando num medidor EBU R128.
- **Limitador:** `DynamicsCompressorNode` no master com threshold −3 dB, ratio 20, knee 0, attack 0,002 s, release 0,1 s, seguido de waveshaper soft-clip (tanh) com ganho de compensação. Não é true-peak, então deixar −1 dB de margem **(estimativa)**.

### 5.7 Evitar fadiga auditiva em sessões longas
- **Faixa dinâmica:** um mix sempre alto cansa, e um mix com mais faixa dinâmica parece mais baixo no começo, mas cansa menos [F31]. Normas de loudness dão espaço para contraste [F31].
- **Repetição:** pools de variações, com variação leve de pitch, volume e timing nos one-shots [F31]. No motor, deriva lenta e aleatória de ±0,5 dB e ±3 cents com período de 5–20 s **(estimativa)**.
- **Faixa sensível:** o ouvido é mais sensível em 2–5 kHz. Manter o assobio do turbo e o whine 12–18 dB abaixo do motor em regime e limitar o highshelf **(estimativa)**.
- **Mix por atenção:** em cruzeiro estável por mais de 8 s, baixar o motor 2–3 dB e subir vento e ambiente. Qualquer evento (acelerar, trocar, quase bater) restaura **(estimativa)**. O Burnout misturava vários modelos (motor, pista, transmissão, turbo) com relações de pitch diferentes por situação, exatamente para reduzir fadiga [F26].
- **Modulação de 4 Hz:** é ótima para dar vida (rumble), mas um galope forte e constante cansa. Limitar a profundidade do "lope" a ±15% e só abaixo de ~1500 rpm **(estimativa)**.
- **Opção para o jogador:** sliders de volume separados (motor, efeitos, música) e um modo "fone/noite" com compressão mais forte.

---

## 6. Plano de implementação em fases (sem código no repo agora)

### 6.1 Dados: `EngineSoundProfile`

Proposta de forma (TypeScript, para referência):

```ts
type Induction =
  | { kind: "na" }
  | { kind: "turbo" | "twin-parallel" | "twin-sequential"
      spoolRpm: number; fullRpm: number; tauS: number           // lag
      shaftHz: [number, number]                                 // ex.: [1100, 3400]
      bov: "atmo" | "recirc" | "none"; seqSwitchRpm?: number; antiLag?: boolean }
  | { kind: "roots" | "twin-screw" | "centrifugal"
      pulleyRatio: number; pulsesPerRev: number; stepUp?: number }

interface FiringEvent { cyl: number; angleDeg: number; bank: number; cv: number
                        headerDelayMs?: number; tauScale?: number }

interface EngineSoundProfile {
  id: string; label: string                    // "I6 2JZ twin-turbo"
  cycle: "four-stroke" | "rotary"
  idleRpm: number; redlineRpm: number; limiterRpm: number
  firing: FiringEvent[]                        // tabelas da seção 2
  jitter: number; angleJitterDeg?: number; missChanceIdle?: number
  pulse: { t1MaxMs: number; t1Frac: number; t2Frac: number }
  buses: { pan: number; collectorHz: number; collectorDb: number }[]
  crossfeed: number                            // 0 duals … 1 tubo único
  exhaust: { hpHz: number; boomHz: number; boomDb: number
             lpBase: number; lpPerRpm: number; lpThrottle: number; lpMax: number
             shelfHz: number; shelfDb: number; drive: number; droneHz?: number }
  intake: { bpLowHz: number; bpHighHz: number; gain: number; vtecRpm?: number }
  induction: Induction
  overrun: { popsAboveRpm: number; popGapMs: [number, number]; crackle: number }
  mech?: { gearWhine?: number; valvetrain?: number }
}
```

- Onde morar: `web-garagem/src/game/autodash/audio/profiles.ts` (dados) e um mapa `CarSpec.id → profileId`. `ENGINE_VOICE` e `setEngine(pitch, bright)` viram compatibilidade e depois saem.
- **Determinismo:** o áudio **não pode consumir o RNG semeado da simulação**, por causa do golden master e do relógio em ticks (ADR 0013). O jitter do áudio usa um PRNG próprio, que pode ser semeado por carro.

### 6.2 Mudanças no pipeline

```
[AudioWorkletNode "engine-pulses"]  (por voz)
   ├─ out0: bus A ─┐
   ├─ out1: bus B ─┼─ matriz crossfeed (GainNodes) → por tubo: boom → coletor → lowpass dinâmico → pan ─┐
   ├─ out2: admissão (ruído com envelope) → bandpass ──────────────────────────────────────────────────┤
   └─ out3: overrun (pops/crepitar) ────────────────────────────────────────────────────────────────────┤
[turbo/supercharger: osciladores + ruído nativos, ou dentro do worklet] ────────────────────────────────┤
                                                    highshelf → waveshaper tanh → compressor → busMotor ┘
busMotor ─┐
busOutros ─┼─ (send) ConvolverNode túnel/ponte ─┐
busSFX ────┤                                    ├─ master → limitador → destination
busMúsica ─┘ (peaking dinâmico anti-conflito)  ─┘
```

- O worklet faz só o que é por amostra e barato: agendador por ângulo e pulsos bi-exponenciais. Filtros, waveshaper e compressor ficam nos nós nativos, que são rápidos e já existem.
- **Truque de custo:** o pulso `e(t) = exp(−t/t1) − exp(−t/t2)` é a diferença de **dois filtros de 1 polo** (`y = a·y + x`, com `a = exp(−1/(τ·fs))`) excitados por impulsos de amplitude `amp`. O custo por amostra é constante, ~6 operações por bus, com qualquer rpm ou número de cilindros. Os coeficientes são recalculados por bloco de 128 amostras.
- **Controles:** `AudioParam`s k-rate do worklet (`rpm`, `load`, `throttle`, `boost`), automatizados com `setTargetAtTime` a cada frame, como hoje. Os eventos discretos (troca de marcha, corte, perfil novo) vão por `port.postMessage`.

### 6.3 CPU: ScriptProcessor × AudioWorklet × nós por evento

| Abordagem | Onde roda | Latência / bloco | Problema |
|---|---|---|---|
| `ScriptProcessorNode` | **thread principal**, junto do Canvas e da física | buffer de 256–16384 frames [F27] (1024 a 48 kHz ≈ 21 ms) | **depreciado** [F27]; engasga quando o frame atrasa |
| `AudioBufferSourceNode` por pulso | nós nativos | — | V12 a 9000 rpm = **900 nós/s**: churn e GC; inviável |
| **`AudioWorkletNode`** | **thread de áudio** | blocos fixos de **128 frames** (≈ 2,67 ms a 48 kHz) [F27] | estourar o orçamento do bloco causa glitches [F27]; mensagens via `postMessage` não servem para sincronia fina [F27] |

- **Estimativa de custo:** jogador (4 buses + ruídos) mais 2 rivais simplificados dá algo como 200–400 operações por amostra × 48 mil, ou seja ~10–20 MFLOP/s. Isso é bem abaixo de 1% de uma CPU moderna **(estimativa)**. O gargalo realista são os biquads nativos por voz (~8 por voz).
- **Fallback:** se `audioWorklet` não existir (navegador antigo), manter o motor atual de dois osciladores.
- **Carregamento no Vite:** o módulo do worklet precisa ser servido como arquivo separado. Testar `import url from "./engine-worklet.ts?worker&url"` com `ctx.audioWorklet.addModule(url)` no `npm run build` **(verificar no build)**. `VITE_API_URL` não é afetado.

### 6.4 Fases

Cada fase é um ou mais commits verificáveis, conforme o CLAUDE.md: `npm run build` + `npm run lint` + teste manual. Refatoração e mudança de som vão em commits separados.

| Fase | Entrega | Verificação |
|---|---|---|
| **A0, refactor** | separar `audio.ts` em `audio/bus.ts` (contexto, buses, limitador), `audio/engine-voice.ts` (motor atual), `audio/sfx.ts`, `audio/music.ts`. Sem mudar o som | build/lint; A/B de ouvido igual |
| **A1, perfis como dados** | `EngineSoundProfile`, `profiles.ts`, mapa carro → perfil, função `rpmAudio()` e testes Vitest (quando existir) de θ → tempos de evento e mapeamento de rpm | testes puros; som ainda igual |
| **A2, worklet I4** | worklet de pulsos replicando a referência Civic aprovada; perfil `ninja`; fallback | gravar e ver no espectrograma (Audacity) a ordem 2: 100 Hz a 3000 rpm; A/B com a referência |
| **A3, arquiteturas** | agendador por ângulo, buses, crossfeed, header delay; perfis da seção 2.15; botão "ouvir motor" na garagem ou no lobby (rev de 900 a redline) | espectrograma por perfil: I5 em 125 Hz a 3000 rpm, V8 com meias-ordens, etc. |
| **A4, indução e overrun** | turbo (spool, wastegate, BOV, flutter, sequencial), supercharger, pops, ALS/2-step | cenários: lift-off a 6000 rpm; largada com 2-step |
| **A5, eventos de gameplay** | troca de marcha, limitador por corte de pulsos, nitro, pneus por slip, colisão em camadas, quase-batida, polícia (seção 7) | checklist de leitura: de olhos fechados, dá para saber o que aconteceu? |
| **A6, espaço e mix** | vozes dos rivais e do tráfego, Doppler, passagens, túnel/ponte, buses, ducking, loudness | medir LUFS em 5 min de corrida; sessão de 30 min sem fadiga |
| **A7, híbrido (opcional)** | camadas CC0 (mecânica, partida, pops reais, colisão) com `CREDITS` | licenças registradas; peso total < 300 KB **(estimativa)** |

---

## 7. Eventos sonoros que dão leitura de gameplay

| Evento | O que comunica | Receita (números = estimativa salvo indicação) | Estado hoje (`audio.ts`) |
|---|---|---|---|
| **Troca de marcha (subida)** | ritmo, momento certo | durante o `shiftMs` do carro (150–300 ms): carga → 0 e pulsos −12 dB (corte); turbo: chirp ou BOV curto; rpm cai pelo `GEAR_RATIOS`; volta com um "tranco" (+2 dB por 80 ms) | `shift()`: ruído + blip |
| **Redução** | controle, agressividade | blip de rev-match +800–1500 rpm em 150 ms; pops de overrun com chance ×2 | — |
| **Troca perfeita / atrasada** | habilidade | perfeita: tranco limpo; atrasada (bateu no limitador): stutter | `perfectLaunch()`, `bog()` |
| **Limitador** | "troque agora" | **pular eventos de ignição** em padrão (1 a cada 2–3) enquanto o rpm ≥ limiter, criando um "brap" a ~10–20 Hz, mais pops leves | `limiter()`: ruído highpass |
| **2-step / largada** | preparação da largada | rpm preso em 4000–5000 com corte de ignição, estouros ritmados e chamas (já existe `emitFlame`) [F22] | `semaphoreRed/Green` |
| **Nitro** | potência extra | purga "psshhh" (ruído highpass 4 kHz, 300 ms) na ativação; chiado leve em loop; motor com lowpass +900 Hz e boom +2 dB; música +1–2 dB [F26] | `nitro()` |
| **Pneu (derrapagem)** | limite de aderência | squeal com banda de energia em **500–1500 Hz** [F31b]: bandpass Q 4–8, centro 700–1200 Hz subindo com o slip, AM de 15–30 Hz (stick-slip); exagerar como no Forza [F25] | `skid()`: bandpass fixo 900 Hz |
| **Off-road / zebra** | saída de pista | cascalho: ruído LP 400 Hz + grãos aleatórios; zebra: pulsos na taxa `velocidade / espaçamento das faixas` | `offroad()` |
| **Colisão** | gravidade do impacto | camadas por energia: thump (seno 60 → 35 Hz, 300 ms), lata (ruído BP 1–3 kHz + banco de ressonadores), vidro (HP 5 kHz granular, só em impacto forte); pool de variantes; ducking da música −8 dB; no Burnout, o crash tinha impacto longo + "mangling" com volume pela intensidade [F26] | `crash()` |
| **Quase-batida** | risco e recompensa | whoosh sincronizado ao ponto de maior aproximação [F26], Doppler descendente, motor −3 dB por 200 ms, stinger de pontuação | `nearMiss()` |
| **Polícia** | perseguição e "heat" | sirene **wail** 650–1800 Hz a ~11–12 ciclos/min, **yelp** ~200 ciclos/min, hi-lo [F30b]; posicional (pan + distância + Doppler); a sirene muda de modo com o nível de heat; rádio = ruído bandpass 300–3000 Hz em rajadas; motor V8 da polícia | — |
| **Turbo** | resposta do motor | spool, BOV, flutter (seção 3) | — |
| **Vento** | sensação de velocidade | ruído LP com corte 300 Hz → 1,5 kHz e ganho ∝ v² | — |
| **Chuva / poça** | clima | já existe chuva; poça = splash curto LP 2 kHz | `rain()` |
| **Partida do motor** | começo da corrida | amostra CC0 (#50898) ou síntese: arranque a ~10–15 Hz com 3–5 explosões crescentes | — |

---

## 8. Riscos e perguntas em aberto

1. **Rpm do jogo × rpm do perfil** (seção 2.15): mapear no áudio ou mudar a física (gameplay)?
2. **Vozes simultâneas** com rivais e tráfego densos: definir orçamento (sugestão: 1 completa, 2 reduzidas, tráfego barato).
3. **iOS/Safari:** `AudioContext` precisa de gesto do usuário (já tratado em `ensure()`). Testar o worklet no Safari e o consumo de bateria.
4. **Calibração de ouvido:** quase todos os números de filtro, cv e delay são estimativas. Um "laboratório de som" na garagem (sliders ao vivo, como o Split/Second fazia com app e mesa de controle [F26]) acelera muito.
5. **Ordens não verificadas:** a ordem do flat-plane Ferrari, a do V12 Ferrari e a convenção de bancadas Subaru estão marcadas no texto. Não afetam o método (só os ângulos), mas confirmar se for anunciar "fiel".
6. **Licenças:** OpenGameArt bloqueou leitura automática e o download do muted.io passa pelo Ko-fi. Conferir à mão antes de baixar.

---

## 9. Glossário rápido
- **Ordem do motor:** múltiplo da rotação do virabrequim (ordem 2 = 2 × rpm/60).
- **Meia-ordem:** múltiplo de rpm/120; aparece com irregularidades e cria batimento.
- **Even/odd fire:** intervalo de ignição uniforme ou irregular.
- **Cross-plane / flat-plane:** moentes do V8 a 90° ou a 180°.
- **EL/UEL:** header de comprimentos iguais ou desiguais.
- **BOV:** válvula de alívio (blow-off). **Surge/flutter:** reversão de fluxo no compressor.
- **ALS:** anti-lag. **2-step:** limitador de largada.

---

## 10. Fontes

**Firing order, arquiteturas e escapamento**
- [F1] Wikipedia, "Firing order": https://en.wikipedia.org/wiki/Firing_order
- [F2] Wikipedia, "Crossplane": https://en.wikipedia.org/wiki/Crossplane · Car Throttle, demonstração de firing order de V8: https://www.carthrottle.com/news/heres-visual-demonstration-v8s-firing-order-using-bunch-lights-and-relays?page=2
- [F3] SAE 2011-01-0337, "Blowdown Interference on a V8 Twin-Turbocharged Engine" (intervalos 90-180-270-180 por bancada): https://saemobilus.sae.org/articles/blowdown-interference-a-v8-twin-turbocharged-engine-2011-01-0337
- [F4] Jalopnik, "What's The Difference Between Even Firing And Odd Firing Engines?": https://jalopnik.com/2097604/difference-between-even-firing-odd-firing-engines/
- [F5] Jalopnik, "The Pros & Cons Of 5 Cylinder Engines": https://jalopnik.com/2029238/5-cylinder-engines-pros-cons/ · EngineLabs, "Gimme 5! How the Inline-Five Cylinder Engine Works": https://www.enginelabs.com/?p=287688 · Car Throttle, I5: https://carthrottle.com/news/advantages-and-disadvantages-inline-five-cylinder-engine
- [F6] SAE 770821, "Buick's New Even Firing 90° V-6 Engine": https://saemobilus.sae.org/content/770821 · British V8, "Tuning Odd-Fire V6 Engines": https://www.britishv8.org/Articles/Buick-Odd-Fire-V6 · TurboBuick, "odd fire" (90/150): https://turbobuick.com/threads/odd-fire.171540 · SlashGear, odd × even fire V6: https://www.slashgear.com/2225832/odd-vs-even-fire-v6-engines-whats-the-difference/
- [F7] Wikipedia, "Lamborghini V10": https://en.wikipedia.org/wiki/Lamborghini_V10 · evo, Gallardo LP560-4: https://www.evo.co.uk/lamborghini/gallardo/8876/lamborghini-gallardo-lp560-4-new-gallardo-v10-bends-design-rules · Viper Club, "uneven engine firing": https://viperclub.org/vca/threads/uneven-engine-firing.593970
- [F8] Bugatti Newsroom, "Bugatti W16 engine – the last of its kind": https://newsroom.bugatti.com/press-releases/bugatti-w16-engine-the-last-of-its-kind · WhichCar (ordem do Veyron): https://www.whichcar.com.au/?p=541933
- [F9] Wikipedia, "Wankel engine": https://en.wikipedia.org/wiki/Wankel_engine · Patente US 9194232 "Compound cycle engine" (duty de escape ~75% × ~25%): https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9194232
- [F10] Rotary Car Club, discussão de overlap e reversão em bridgeport: https://www.rotarycarclub.com/rotary_forum/showthread.php?p=124303 · ACRE, P-port × bridgeport: https://mickaircraft.com/ACRE/ACRE200607/messages/20060719-P%20Ports-7739009.html
- [F11] kfz-tech, "Three-cylinder in-line engine": https://www.kfz-tech.de/Engl/Dreizylinder-Reihenmotor.htm · Wikipedia, "Big-bang firing order": https://en.wikipedia.org/wiki/Big_bang_engine
- [F12] carnoise (Substack), "Dat sweet rumble tho" (meias-ordens, batimento, sensibilidade a 4 Hz): https://carnoise.substack.com/p/dat-sweet-rumble-tho
- [F13] Car Throttle, "A Musician's Analysis of Engine Notes": https://www.carthrottle.com/news/musicians-analysis-engine-notes
- [F14] SlashGear, "How Subaru's Unequal Length Headers Create That Distinctive Rumble Sound": https://www.slashgear.com/1970710/subaru-unequal-length-headers-rumble-sound · Jalopnik, "Why Unequal Length Headers Make Subarus Sound So Unique": https://jalopnik.com/1933843/subaru-unequal-header-length-exhaust-sound/ · Crawford Performance, UEL × EL: https://crawfordperformance.com/blogs/news/unequal-length-headers-pros-cons · FerrariChat, flat-plane × cross-plane: https://www.ferrarichat.com/forum/posts/137654744 · Yahoo Autos, "Why the Ferrari F355 Sounds So Good": https://autos.yahoo.com/why-ferrari-f355-sounds-good-171700108.html
- [F15] GT Spark Plugs, "BMW Inline 6 Firing Order": https://gtsparkplugs.com/firing-order-bmw-inline-6.html · e31.net, motores: https://e31.net/engines_e.html
- [F16] FMS, "X-Pipe vs. H-Pipe": https://fmsperformance.com/x-pipe-vs-h-pipe/ · Jalopnik, H-pipe × X-pipe: https://www.jalopnik.com/1975592/h-pipe-vs-x-pipe-pros-cons/ · LMR, "Mustang H Pipe Vs X Pipe": https://lmr.com/products/Mustang-H-Pipe-Vs-X-Pipe
- [F17] CarTech Books, "Exhaust Systems: Mufflers and Catalytic Converter Guide": https://cartechbooks.com/techtips/exhaust-systems-mufflers-and-catalytic-converter-guide · Brake & Front End, "Finding the Right Level of Exhaust Noise": https://www.brakeandfrontend.com/?p=41001
- [F18] SkAT-VG, Deliverable D6.6.1 (Sound Design Toolkit, modelo `sdt.motor`, guias de onda, três saídas): https://skatvg.unipa.it/wp-content/uploads/2015/03/SkATVGDeliverableD6.6.1bis.pdf · Baldan, Lachambre, Delle Monache, Boussard (2015), "Physically informed car engine sound synthesis for virtual and augmented environments": https://core.ac.uk/download/53578982.pdf · engine-sim (Ange Yaghi), simulador físico de motor: https://github.com/ange-yaghi/engine-sim

**Indução forçada**
- [F19] GFB, "What is a blow off valve and how does it work?": https://gfb.com.au/tech/tech-articles/62-all-you-ever-needed-to-know-about-blow-off-valves/ · Motor1, "Why Do Turbo Cars Make That Famous Whoosh?": https://www.motor1.com/features/809044/why-turbochargers-make-whooshing-sound/ · HP Academy, "Do You Need a Blow Off Valve?": https://www.hpacademy.com/webinars/256-do-you-need-a-blow-off-valve · CJ Pony Parts, "What Is Turbo Flutter?": https://www.cjponyparts.com/resources/what-is-turbo-flutter
- [F20] Gharaibeh, tese (Imperial College), surge leve medido em 9,6 Hz e 5,1 Hz: https://spiral.imperial.ac.uk/handle/10044/1/99659 · TCD, surge profundo 3–10 Hz: https://www.tara.tcd.ie/bitstreams/16e2add5-7fcb-43ff-a757-9001981f7c0e/download · SAE 2013-01-1886, "Instabilities at the Low-Flow Range of a Turbocharger Compressor": https://saemobilus.sae.org/content/2013-01-1886
- [F21] NAFEMS NWC21, whoosh 4–11 kHz perto do surge: https://www.nafems.org/publications/resource_center/nwc21-547-b/ · SAE 2015-26-0129, unbalance whistle 1,2–4,5 kHz: https://saemobilus.sae.org/content/2015-26-0129 · Patente US 9303561 (BPF ∝ rotação × nº de pás; 100–150 mil rpm): https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9303561 · Boletins NHTSA 2024 (assobio de turbo Audi 2,8–3,2 kHz): https://static.nhtsa.gov/odi/tsbs/2024/MC-10249578-0001.pdf e https://static.nhtsa.gov/odi/tsbs/2024/MC-11011243-0001.pdf · EngineLabs, "Powerstroke Turbo Whistle": https://www.enginelabs.com/?p=296529
- [F22] Wikipedia, "Antilag system": https://en.wikipedia.org/wiki/Antilag_system · RallyCars, "How the turbo Anti-Lag System works": https://rallycars.com/technical-stuff/bang-bang-or-anti-lag-system/ · HP Academy, "Anti-Lag VS 2-Step Launch Control": https://hpacademy.com/q-and-a/anti-lag-vs-2-step-launch-control-not-just-for-pops-and-bangs
- [F23] Low Offset, "Supercharger Whine Explained": https://low-offset.com/workshop/supercharger-whine · Eaton TVS R1900: https://www.eaton.com/tr/tr-tr/catalog/engine-solutions/tvs-r1900.html · Eaton TVS R1320: https://www.eaton.com/us/en-us/catalog/engine-solutions/tvs-r1320.html · ProCharger, especificações: https://www.procharger.com/supercharger-specs/ · Whipple FAQ: https://whipplesuperchargers.com/ft-2434-faq.html · Whipple W175AX: https://whipplesuperchargers.com/i-2376-w175ax-2-9l-direct-drive-twin-screw-supercharger-wsc-175axb-dd.html · EngineLabs, Whipple Gen-5: https://www.enginelabs.com/?p=6545 · The Ranger Station, Eaton M62/M90/M112: https://www.therangerstation.com/tech/eaton-m62-m90-m112-superchargers/
- [F24] Haltech, "Sequential Twin Turbo – RX-7": https://support.haltech.com/portal/en/kb/articles/sequential-twin-turbo-rx-7 · Haltech, guia de twin-turbo sequencial: https://support.haltech.com/portal/en/kb/articles/sequential-twin-turbo-user-s-guide · evo, Mazda RX-7: https://www.evo.co.uk/mazda/rx-7

**Áudio de jogo, mixagem, Web Audio**
- [F25] Designing Sound, "Vehicle Engine Design: Project CARS, Forza Motorsport 5 and REV": https://designingsound.org/2014/08/11/vehicle-engine-design-project-cars-forza-motorsport-5-and-rev/ · MCV, "How to make racing car engines roar using AudioMotors & FMOD": https://www.mcvuk.com/development/how-to-make-racing-car-engines-roar-using-audiomotors-fmod · Designing Sound, "AudioMotors review": https://designingsound.org/2013/04/audiomotors-review/ · Audiokinetic, "Loop-Based Car Engine Design with Wwise" (partes 1 e 2): https://audiokinetic.com/loop-based-car-engine-design-with-wwise-part-1 e https://www.audiokinetic.com/en/loop-based-car-engine-design-with-wwise-part-2/ · Audiokinetic, "Engine Sound Modeling: From Sampling to Granular Synthesis in Wwise": https://www.audiokinetic.com/engine-sound-modeling-from-sampling-to-granular-synthesis-in-wwise · Audiokinetic, REV2: https://www.audiokinetic.com/en/make-racing-engine-sound-based-on-rev2/ · Game Developer, "Capturing Engine Sounds for Games": https://www.gamedeveloper.com/audio/capturing-engine-sounds-for-games · MSFS SDK, "Engine Audio Setup" (Blend Track FMOD): https://docs.flightsimulator.com/msfs2024/html/4_Sound/Aircraft_Audio/Engine_Audio_Setup.htm
- [F26] Designing Sound, "Burnout: A Sound Design Retrospective with Ben Minto": https://designingsound.org/2017/08/31/burnout-a-sound-design-retrospective-with-ben-minto/ · MCV, "Heard about Split/Second?" (mixer events, ducking espectral): https://mcvuk.com/development-news/heard-about-split-second/
- [F27] Chrome Developers, "Audio Worklet is now available by default": https://developer.chrome.com/blog/audio-worklet · Chrome Developers, "Audio worklet design pattern": https://developer.chrome.com/blog/audio-worklet-design-pattern · blink-dev, "Intent to Deprecate: WebAudio doppler effect": https://groups.google.com/a/chromium.org/g/blink-dev/c/-1SI1GoHYO8 · MDN, `PannerNode.setVelocity()` (depreciado): https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/setVelocity · MDN, `DynamicsCompressorNode`: https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode · MDN, `ConvolverNode`: https://developer.mozilla.org/en-US/docs/Web/API/ConvolverNode
- [F28] MDPI Coatings 14(9):1213 (reverberação em túneis e asfalto poroso): https://mdpi.com/2079-6412/14/9/1213 · PolyU, acústica de túneis longos: https://ira.lib.polyu.edu.hk/bitstream/10397/111543/1/1138_1_online.pdf
- [F29] SAE 2016-28-0039, "High Speed Booming Noise Reduction in Passenger Car": https://saemobilus.sae.org/papers/high-speed-booming-noise-reduction-passenger-car-application-cost-optimized-nvh-solution-2016-28-0039 · SAE 2019-26-0171, "Low Frequency In-Cab Booming Noise Reduction": https://saemobilus-test.cld.sae.org/papers/low-frequency-cab-booming-noise-reduction-passenger-car-2019-26-0171
- [F30] Designing Sound, entrevista com Garry Taylor (Sony) sobre loudness: https://designingsound.org/2012/07/30/video-games-and-loudness-standards-interview-with-sonys-garry-taylor/ · Audiokinetic, "Mastering a Game with Wwise, Part 1": https://audiokinetic.com/en/mastering-a-game-with-wwise-part1 · Voxbooster, compliance de loudness (ASWG-R001 v1.10): https://voxbooster.com/blog/game-loudness-lufs-compliance-statistics-2026/
- [F30b] Sirenes: Code 3 Undercover, especificações: https://www.manualsdir.com/manuals/635385/code-3-undercover-siren.html?page=9 · Fire Engineering, "How sirens vary as attention getters": https://www.fireengineering.com/firefighting/how-sirens-vary-as-attention-getters/ · KKK-A-1822E (especificação de sirene): https://passengermotorvehicles.emilspec.com/KKK-A-1822/page67.html
- [F31] MCV, Simon Pressey (Crytek), "Audio loudness for gaming: the battle against ear fatigue": https://mcvuk.com/development-news/audio-loudness-for-gaming-the-battle-against-ear-fatigue · Game Developer, "Soundscapes: what sound does to games and brains": https://gamedeveloper.com/audio/soundscapes-what-sound-does-to-games-and-brains · SFX Engine, erros comuns de áudio de jogo: https://sfxengine.com/blog/common-game-audio-mistakes
- [F31b] Squeal de pneu 500–1500 Hz e stick-slip 500–1000 Hz (patentes): https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7672772 e https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/6959593

**Amostras e licenças**
- [F32] Freesound #141240 (CC0): https://freesound.org/people/lovretta/sounds/141240/ · Freesound #669622 (CC0): https://freesound.org/people/TheLittleCrow/sounds/669622/ · Freesound #50898 (CC0): https://freesound.org/people/RutgerMuller/sounds/50898/ · Freesound pack Volvo S60 (CC BY-NC 4.0): https://freesound.org/people/el-bee/sounds/644878/ · OpenGameArt "racing car engine sound loops" (CC0): https://opengameart.org/content/racing-car-engine-sound-loops · OpenGameArt "motor sound effect" (CC0): https://opengameart.org/content/motor-sound-effect · muted.io "Performance Cars" (CC0): https://muted.io/performance-cars · Sonniss GDC 2024 (licença, cláusula de IA): https://gamefromscratch.com/sonniss-27-5gb-sound-effect-giveaway-at-gdc-2024/ · Kenney Racing Pack (CC0, gráfico): https://kenney.nl/assets/racing-pack
