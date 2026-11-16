# Roteiro de teste — Fase 8 (mundo com detalhe)

Tudo no **solo**. As teclas de número só valem **correndo** (depois do verde).
Na garagem: **[X]** troca o bioma inicial (cidade → costa → serra → rodovia),
**[L]** entra no teste de polícia (já larga com 1★; os números viram estrelas).

Preencha a linha **Feedback** de cada item (ok / estranho / quebrado + o que viu).

| Tecla (correndo) | O que chama |
|---|---|
| **1** | posto à frente |
| **3** | obra |
| **4** | comboio |
| **5** | acidente com óleo |
| **6** | tanque na reserva |
| **7** | viaduto com elevado |
| **8** | túnel |
| **9** | próxima região (bioma) |
| **0** | zona de drift |

---

## 1. NPCs enxergam você (8.1)
Pare ou ande a 20–40 km/h numa faixa com trânsito vindo atrás (olhe o retrovisor).
- Esperado: o carro de trás acende a luz de freio, para atrás sem bater, buzina
  (baixinho) depois de ~1,5 s e passa pela faixa livre.

**Feedback:**

## 2. Posto de verdade (8.2) — tecla 1
Entre pela direita, fique na faixa de **dentro** e pare ao lado da ilha.
- Esperado: pátio com duas faixas e ilha amarela, cobertura "POSTO AUTOHUB 24h",
  loja de conveniência, totem de preço, 1–3 carros abastecendo na faixa de fora;
  parado na bomba o HUD mostra os litros e enche em ~2,5 s ("na bomba: rápido");
  passando devagar enche bem menos ("pare na bomba"); som de bomba.
- Chegando no posto, o carro da frente termina, sai pelo pátio e entra na pista
  com seta.

**Feedback:**

## 3. Eventos com mais detalhe (8.3)
- **Obra (3):** retroescavadeira na faixa fechada (bate como cavalete),
  trabalhadores com bandeira no acostamento, lâmpadas piscando nos cavaletes,
  britadeira ao se aproximar.
- **Acidente (5):** dois carros batidos com pisca-alerta, guincho amarelo com
  giroflex, triângulo antes, cacos no asfalto.
- **Óleo (5):** passe **reto, sem mexer no volante**, em cima da mancha: o carro
  dá um tranco de lado, rabeia forte por ~1 s, patina e solta fumaça.
- **Comboio (4):** faixa amarela "CARGA LONGA" nos caminhões, picape batedora
  com giroflex âmbar à frente no acostamento, buzina a ar quando você encosta.
- **Blitz/radar:** (saem sozinhos a partir do nível 4) guardas de colete com
  lanterna na blitz, sirene curta ao se aproximar; poste do radar com a câmera.

**Feedback obra:**

**Feedback acidente:**

**Feedback óleo:**

**Feedback comboio:**

**Feedback blitz/radar:**

## 4. Cenário por trechos (8.4) — só dirigir
A cada ~10–20 s a beira muda: **centro** (prédios, ponto de ônibus), **subúrbio**
(casas, muros, árvores), **campo** (cercas, plantação, celeiro). Na costa (**[X]**
na garagem): **orla** com quiosques, guarda-sóis e palmeiras.
- Costa: o mar e as palmeiras do fundo agora quase não andam na curva.

**Feedback cenário:**

**Feedback palmeiras da costa na curva:**

## 5. Biomas novos e região que muda (8.5) — tecla 9
- **Serra:** curvas mais fechadas e morros maiores, pinheiral no fundo, mata com
  guard-rail e pedras, neblina com mais frequência.
- **Rodovia:** retões, colinas verdes no fundo, campo, árvores largas.
- A região troca sozinha a cada 3 níveis ("NOVA REGIÃO: ..."); a tecla 9 troca na
  hora. As curvas mudam a partir de onde a tela não alcança.

**Feedback serra:**

**Feedback rodovia:**

**Feedback troca de região:**

## 6. Viaduto com elevado (8.6) — tecla 7
Na placa "SAÍDA", entre na faixa da direita e siga o elevado.
- Esperado: a câmera sobe, mureta dos dois lados (raspar segura o carro), nitro,
  pontos em dobro e nitro lá em cima, desce e devolve você à pista. Carros subindo
  e descendo. De baixo: viaduto com juntas, postes acesos à noite e pichação.
- Com estrelas (garagem **[L]**): viatura de tocaia embaixo do viaduto, que liga a
  sirene e sai atrás quando você passa.

**Feedback elevado:**

**Feedback tocaia:**

## 7. Túnel raro (8.7) — tecla 8
- Esperado: placas "TÚNEL 2 km / 1 km / ACENDA OS FARÓIS", boca na montanha
  ("TÚNEL DA SERRA"), dentro: luzes no teto, faróis acesos, eco, ronco de
  ventilação, sem chuva; a saída clara lá no fundo e o clarão ao sair. Com
  estrelas, o helicóptero te perde lá dentro.
- Sem a tecla, ele aparece raramente sozinho (bem menos que os outros eventos).

**Feedback túnel:**

## 8. Rodada de 16/11 (depois do primeiro teste da Fase 8)
- **Ladeira:** subida moderada não come mais a velocidade de quem está no pé; a
  mais forte cobra, mas devagar, e reduzir a marcha ajuda. Descendo a rampa do
  elevado (tecla 7) sem acelerar, o carro embala (~+30 km/h).
- **Cidade Tokyo** (bioma cidade, **[X]** na garagem até "Cidade"): sempre de
  noite. Os trechos alternam **Shibuya** (magenta e branco: telões que trocam de
  imagem, fachadas de letreiros, multidão com guarda-chuva transparente, máquina
  de bebida), **Shinjuku** (ciano e magenta: prédios de letreiros, letreiros
  verticais, izakaya com lanternas vermelhas, vapor de bueiro), **oficinas**
  (galpões de tuning com carro no elevador, pneus empilhados, konbini verde) e o
  subúrbio. Postes com fiação atravessando por cima da pista nos três.
- **Chegada e quarteirão (segunda rodada de 16/11):** a cidade começa no mato,
  passa por outdoors e só então entra em Shibuya. Os prédios variam de tamanho,
  largura, cor e recuo (lojinhas com toldo, prédios de 3 a 10 andares, terrenos de
  estacionamento, vãos), com pedestres andando nas calçadas. As janelas não piscam
  mais com o prédio andando.
- **Corte de giro:** no grid (ponto morto) o pé no fundo agora bate no corte; no
  corte, o ponteiro do conta-giros bate e volta junto com o som.
- **Posto:** pátio de concreto com setas, carros na loja, frentista, calibrador,
  lava-rápido e placa SAÍDA. **Viaduto:** ruas da cidade cruzando embaixo do elevado.
- **Drift (tecla 0 para a zona):** segure **Shift** (freio de mão) com o volante
  virado acima de 70 km/h: a traseira abre, fumaça e chiado, "DRIFT +N" ao
  soltar. Volante para dentro da curva segura o carro na curva fechada. Bater no
  meio perde os pontos. Na zona ("ZONA DE DRIFT", curvas em S) os pontos valem
  em dobro e o total aparece na saída.

**Feedback ladeira/viaduto:**

**Feedback cidade Tokyo (chegada, quarteirão, pedestres):**

**Feedback corte de giro:**

**Feedback posto/ruas do viaduto:**

**Feedback drift:**

## Geral
Desempenho (travou? caiu o fps em algum trecho?), o que mais incomodou, o que
mais gostou:

**Feedback geral:**
