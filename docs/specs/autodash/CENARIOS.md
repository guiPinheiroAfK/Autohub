# Bíblia de Cenários — Jogo de Trânsito

*Tokyo Drift (cidade) · Costa (serra/rodovia) · Costa – Praia*

---

## Contexto da conversa

**O projeto:** um joguinho de navegador de "picotar" no trânsito, com corrida entre amigos, duelo e outros game modes. A dificuldade atual é a **criação de cenário**.

**O pedido original:** uma pesquisa com certo aprofundamento sobre três cenários e seus designs:

1. **Tokyo Drift (cidade)**: cores, design, detalhes e áreas específicas da cidade, bem organizadas e explicadas, para criar profundidade e uma certa "história" no próprio jogo. Não é um jogo de história, mas a área de cidade precisa dessa identidade.
2. **Costa (serra/rodovia)**: rodovia de serra passando ao lado de um rio ou mar. Não precisa ser hiper longa como na vida real, mas com certa distância e completa, passando sensação de viagem tranquila, mantendo a dinâmica de trânsito intenso, especialmente com subidas, retas e, às vezes, pistas menores com fluxo menor (mas não tão menor).
3. **Costa – Praia**: o momento em que se chega na praia. Sem base de design prévia; o pedido foi desenvolver e melhorar a ideia.

**Pesquisa feita (referências reais usadas):**
- **Tokyo:** Shibuya Crossing e ruas de Shibuya, a vista neon da Yasukuni-dori em Shinjuku, Daikoku Parking Area (maior ponto de encontro de carros do Japão), Wangan Expressway, Rainbow Bridge, Tokyo Tower, Shinonome (Autobacs, Liberty Walk), Hakone Turnpike (touge) e a estética JDM de *Tokyo Drift* (visual mais técnico e funcional, em vez do cromado/neon-embaixo-do-carro dos filmes anteriores).
- **Costa:** Rodovia Rio-Santos (BR-101/SP-055), que alterna mar, serra, curvas e Mata Atlântica, e a Serra do Rio do Rastro (SC-438), famosa por curvas fechadas e mirantes. Pontos úteis: boa parte da Rio-Santos é pista simples (especialmente Ubatuba–Paraty); perto de Ubatuba a estrada desce em caracol a Serra do Mar, com curvas de quase 180°; em feriados o fluxo chega a quase dobrar; chuva forte e deslizamentos são um risco real da serra.

**Premissa assumida:** a câmera/engine é livre (2D pseudo-3D ou 3D low-poly). O documento é direção visual e de level design, não código.

**Pendência / próximo passo:** confirmar se o jogo é **2D (vista de cima/lateral)** ou **3D**, para adaptar o documento com lista exata de assets, JSON de configuração por cenário e layout de cada pista em passos de level design.

---

## 0. A ideia central: uma viagem de 24 horas

Os três cenários podem contar **uma única história sem texto**: a noite urbana, a estrada de dia e o fim de tarde na praia.

| Cenário | Hora do dia | Sensação | Papel no jogo |
|---|---|---|---|
| Tokyo Drift | Noite (com chuva opcional) | Tensão, adrenalina, território | Corrida, duelo, reputação |
| Costa | Amanhecer → tarde | Viagem, fluxo, descoberta | Corrida longa, modo cruzeiro |
| Costa – Praia | Pôr do sol | Chegada, alívio, comemoração | Hub social, duelo final, modo relax |

Se o jogador sente que "saiu da cidade pra viajar e chegou na praia", os cenários ganham identidade mesmo sem enredo.

---

## 1. Tokyo Drift — a cidade

### 1.1 Identidade

**Conceito:** a cidade que nunca dorme e onde a rua é o palco. Menos "carro bonito de revista", mais **ferramenta**: o estilo JDM de *Tokyo Drift* trocou o visual cromado dos filmes anteriores por algo mais técnico e funcional. Aplique a mesma ideia ao cenário: neon forte, mas **sujo, molhado e usado**.

**A "história" implícita:** você é o novato que chegou na cidade. Cada distrito é um degrau de reputação: começa no centro turístico (Shibuya), passa pelo território das crews (Shinjuku e a Expressa) e termina no ponto de encontro lendário (Daikoku). O jogador sente a progressão pela **mudança de cor e densidade**, não por diálogo.

### 1.2 Paleta base

| Função | Cor | Hex | Uso |
|---|---|---|---|
| Asfalto noturno | Azul-petróleo quase preto | #0B0E1A | Pista, prédios no fundo |
| Neon magenta | Rosa-choque | #FF2E88 | Letreiros, Shibuya, detalhes de crew |
| Neon ciano | Ciano elétrico | #19E3FF | Placas, LED de telas, reflexos |
| Sódio | Âmbar | #FFB347 | Postes da expressa, túneis |
| Konbini | Verde-menta | #3DDC97 | Lojas 24h, máquinas de venda |
| Luz de freio | Vermelho | #E6213A | Traseiras, torii, alertas |
| Branco LED | Branco-azulado | #F4F7FF | Faróis, faixas, telas |

**Regra de ouro:** cada distrito tem **1 cor dominante + 1 de acento**; o resto é azul-escuro. Isso dá identidade instantânea e barateia a produção.

### 1.3 Distritos (em ordem de percurso)

**1) Shibuya — "A vitrine"** · cor: magenta + branco LED
- Cruzamento tipo *scramble* (faixas de pedestre em X), telas LED gigantes nos prédios, estátua de cachorro como marco (referência ao Hachiko).
- Muita luz, calçada cheia, trânsito lento e denso. É o distrito mais "limpo" e acolhedor: o jogador aprende as regras aqui.
- Detalhe de história: adesivos de crews rivais já colados em postes, mostrando que a disputa existe, mas o centro ainda é neutro.

**2) Shinjuku / Kabukicho — "O neon vertical"** · cor: ciano + magenta
- Avenida larga com letreiros **verticais** de kanji sobrepostos (a famosa vista da Yasukuni-dori), becos laterais com lanternas de izakaya vermelhas, fumaça de bueiro, poças.
- Chuva fina deixa o asfalto como espelho: o reflexo vale mais que a luz real (ver seção 5).
- Detalhe de história: carros de crews estacionados em fila, alguém lavando carro às 2h da manhã, polícia ao fundo que nunca persegue (só "existe").

**3) Shuto Expressway — "A artéria"** · cor: âmbar de sódio
- Elevado de concreto com pilares, curvas fechadas e emendas de pista, luz sódio contínua, muros baixos, placas verdes de direção.
- Aqui o trânsito vira **fluxo rápido e agressivo**: o melhor trecho para corrida e duelo.
- Detalhe: nomes de saída em kanji + inglês, pedágio, câmeras (decoração).

**4) Shinonome / Distrito das oficinas — "A garagem"** · cor: verde-konbini + branco
- Galpões de tuning, fachadas de lojas de peças, pneus empilhados, macacos hidráulicos, carros erguidos. Referência real: lojas como Autobacs e ateliês de bodykit.
- Detalhe de história: um carro "em obra" que aparece **de novo no final** pronto (recompensa visual). Quadro de fotos de carros lendários na parede.

**5) Wangan / Baía — "O horizonte"** · cor: azul-ciano + luzes âmbar
- Pista larga à beira da baía, com a Rainbow Bridge iluminada e a Tokyo Tower ao fundo. Retas longas, velocidade alta, poucos obstáculos laterais.
- É o respiro do cenário: cidade ao longe, água escura refletindo.

**6) Daikoku PA — "O ponto de encontro lendário"** · cor: todas, em pequenas doses
- Estacionamento em rampa/espiral no mar, cheio de carros exibidos, luzes de LED, bandeiras de crews, vending machines, fumaça.
- Funciona como **hub do jogo**: menu de garagem, lobby de amigos, escolha de modo. Na vida real é o maior ponto de encontro de carros do Japão, então o jogador reconhece a ideia.

**Bônus) Touge — "A montanha"** · cor: verde-escuro + névoa
- Serra de curvas apertadas e guard-rail, inspirada em Hakone. Perfeito para duelo 1v1 (ver 1.6).

### 1.4 Props e detalhes que dão "vida"

- **Rua:** vending machines, konbini com luz verde, postes com emaranhado de fios, bicicletas encostadas, cones, setas amarelas, faixas de pedestre, placas de "Stop" em vermelho com kanji.
- **Prédios:** letreiros verticais, ar-condicionados na fachada, caixas d'água no topo, escadas de incêndio.
- **Pessoas (silhuetas):** guarda-chuva transparente, ternos, estudantes, grupos fotografando carros.
- **Marcas da cultura:** adesivos de crew em postes e carros, pichação estilizada (não ofensiva), faixas de times, bandeiras do sol nascente em oficinas.
- **Easter eggs:** um carro fantasma antigo em um canto, uma gata de rua em cima de capô, uma máquina de bebida com sua própria "mascote".

### 1.5 Trânsito (composição)

| Veículo | % no centro | % na expressa | Comportamento |
|---|---|---|---|
| Kei car / hatch | 30% | 20% | Lento, imprevisível |
| Sedã de salaryman | 25% | 25% | Constante, mantém faixa |
| Táxi | 15% | 5% | Freia de repente, vira sem sinal |
| Van / caminhonete kei | 10% | 15% | Largo, bloqueia |
| Carro tunado de crew | 10% | 25% | Rápido, agressivo, "NPC rival" |
| Ônibus | 5% | 5% | Pesado, faz fila |
| Moto | 5% | 5% | Corta, pode sumir em ponto cego |

Dica de design: crie "ondas" (3–5 carros em pelotão) em vez de espaçamento uniforme. Isso dá a sensação de cidade real e de risco.

### 1.6 Ligação com os modos de jogo

- **Corrida entre amigos:** Shibuya → Shinjuku → Expressa → Daikoku (loop de 3–4 minutos).
- **Duelo:** Touge ou Expressa à noite, com contagem regressiva num semáforo.
- **Modo reputação:** cada distrito vencido desbloqueia uma cor/adesivo de crew.
- **Chuva:** variante que muda aderência e deixa o cenário mais bonito (barato de implementar).

---

## 2. Costa — a serra e a estrada

### 2.1 Identidade

**Conceito:** a viagem de feriado que todo brasileiro conhece: estrada boa de dirigir, paisagem demais, e trânsito que nunca deixa você relaxar de verdade. Inspirações reais: a **Rio-Santos** (BR-101), onde a estrada alterna mar, serra, curvas e Mata Atlântica, e a **Serra do Rio do Rastro**, famosa pelas curvas fechadas e mirantes.

**Fatos reais úteis pro design:**
- A Rio-Santos é um corredor entre praias, ilhas e vilas históricas; boa parte é **pista simples** (uma faixa por sentido), especialmente entre Ubatuba e Paraty.
- Perto de Ubatuba a estrada **desce em caracol** a Serra do Mar, com curvas de quase 180°, onde duas pistas passam quase paralelas em alturas diferentes.
- Em dias normais passam algumas dezenas de milhares de veículos por dia; em feriado o fluxo **chega a quase dobrar**, o que justifica o trânsito intenso mesmo numa estrada cênica.
- Chuva forte e deslizamento são um risco real da serra: ótimo gancho de evento aleatório.

**A "história" implícita:** uma estrada de feriado. O jogador sente que todo mundo está indo pro mesmo lugar (a praia).

### 2.2 Estrutura do percurso (6 segmentos)

Tempo sugerido de volta completa: **5–7 minutos** em velocidade de corrida; para modo cruzeiro, uma volta contínua com mudança de luz.

| # | Segmento | Pista | Fluxo | Visual | Luz |
|---|---|---|---|---|---|
| 1 | **Portal / Pedágio** | 3 faixas | Denso | Praça de pedágio, placas azuis, vendedores, caminhões em fila | Amanhecer rosado |
| 2 | **Vale do Rio** | 2–3 faixas | Médio-alto | Reta ao lado de um rio largo, pontes curtas, bambuzais, casas de pedra | Manhã clara |
| 3 | **Subida da Serra** | 2 faixas + faixa de caminhão | Alto, lento por veículos pesados | Mata Atlântica densa, neblina, curvas médias, cachoeiras | Manhã com névoa |
| 4 | **Mirante / Cume** | 2 faixas | Médio | Primeira vista do mar, mirante com barraquinhas, ônibus de turismo | Sol alto |
| 5 | **Descida em Caracol** | Pista simples | Menor, mas constante | Curvas de ~180°, paredão de pedra, muro de contenção, ciclistas | Tarde |
| 6 | **Orla / Costão** | Pista simples | Médio-alto (feriado) | Mar à direita, costão, enseadas, vilas de pescadores | Dourado |

**Por que funciona:** o jogador ganha variedade de ritmo (reta → subida → vista → curva → mar) sem precisar de uma pista gigantesca. O "reveal" do mar no segmento 4 é o momento de ouro: segure a vista com a estrada fazendo uma curva aberta e pouco trânsito por 3–4 segundos.

### 2.3 Dinâmica de trânsito (o coração do jogo)

**Camadas de veículos:**

| Tipo | Papel |
|---|---|
| Carro de família com prancha/bagageiro | Lento, reto, previsível |
| Ônibus de excursão e van turística | Largo, para em mirante |
| Caminhão de carga e caçamba | Lentidão na subida, forma comboio |
| Moto de entrega | Rápida, passa entre faixas |
| Carro esportivo | Rival que acelera nas retas |
| Caminhonete de pescador | Aparece só na orla, devagar |

**Regras que mantêm a tensão:**
- **Comboios atrás de caminhão** na subida: obrigam ultrapassagem (decisão arriscada).
- **Pista simples = ultrapassagem pela contramão**, com carros vindo de frente. Faça o fluxo contrário menor, mas **nunca vazio**: 1 carro a cada 6–10 segundos já dá medo.
- **Reta curta de ultrapassagem** depois de cada curva, com sinalização ("Ultrapassagem permitida") para ensinar o jogador.
- **Pistas menores** (cume e orla) com acostamento: carro parado, ciclista, moto.

**Eventos aleatórios (1 por volta):**
- Neblina que reduz visibilidade na subida.
- Chuva forte com pista molhada.
- Obra com meia-pista.
- Pequeno deslizamento fechando uma faixa na descida (inspirado no risco real da serra).
- Carro quebrado no mirante.

### 2.4 Paleta e detalhes

- **Verde da serra:** #1F5D3C a #4C9A6A (folhagem), com névoa #D9E6E0.
- **Pedra e asfalto:** cinza quente #6B6B70, pedra #8C7B6B.
- **Rio e mar:** turquesa #2EC4B6 de dia; azul fundo #0B3C5D ao longe.
- **Acentos:** placas azuis e verdes de rodovia, amarelo de sinalização, laranja de cone.
- **Props:** guard-rail, balizadores, quebra-molas, barraquinhas de banana e artesanato, placas de "Mirante", cachoeira ao lado da pista, moto-táxi, igreja pequena numa curva, ponte de ferro no rio.
- **Som:** motor, vento, rio na reta, cigarras na mata, sino de igreja distante, buzina rara.

### 2.5 Dicas para parecer "mais longa" sem ser longa

- Repita os **blocos** (curva + reta + parede de pedra) mudando só a cor da luz e a vegetação.
- **Retorne ao rio** em dois momentos (início e meio) com ângulo diferente.
- Use **fundo parallax** (serras ao longe) que muda de tonalidade ao longo da volta.
- Mantenha ao menos **uma reta longa** (3–5 s sem curva) por volta: ela dá sensação de viagem.

---

## 3. Costa – Praia (design do zero)

Sem base prévia, então esta é uma estrutura completa. A ideia é que a praia **não seja só mais uma pista**: é o lugar onde o jogo respira e onde os amigos se encontram.

### 3.1 Conceito

**"A chegada."** Depois de uma viagem tensa, o jogador entra numa vila litorânea no **pôr do sol**. O ritmo cai, o trânsito vira passeio, e o jogo vira social: encontro, foto, duelo para fechar o dia.

Na mesma lógica do Daikoku PA, mas com clima oposto: **a mesma cultura de carro, outra atmosfera**. Isso conecta os dois cenários sem repetir.

### 3.2 Paleta (hora dourada)

| Elemento | Cor | Hex |
|---|---|---|
| Céu pôr do sol | Laranja-coral | #FF7A59 |
| Sol e reflexo | Âmbar | #FFB86B |
| Areia | Bege quente | #F2D9A6 |
| Água rasa | Turquesa | #2EC4B6 |
| Água funda | Azul-petróleo | #0E7C86 |
| Mar ao longe | Azul noturno | #0B3C5D |
| Palmeira e vegetação | Verde-folha | #2F8F5B |
| Quiosque e toldos | Vermelho/amarelo vivos | #E94F37 / #F6C945 |

O céu muda ao longo da partida (4 minutos): laranja → rosa → roxo → azul. É barato e muito bonito.

### 3.3 Mapa e zonas

1. **Arco de Chegada:** placa "Bem-vindo à [nome da cidade]", faixa de feriado, banca de picolé. Marca a transição serra → praia.
2. **Avenida Beira-Mar (circuito):** pista de **1–1,5 km em loop** com calçadão de um lado e quiosques do outro. É a pista principal de corrida e duelo.
3. **Quiosques e barracas:** guarda-sóis coloridos, mesas na calçada, caixas de som, luzes em cordão que acendem quando escurece.
4. **Orla / Calçadão:** vôlei, futevôlei, skatistas, ciclovia, ambulantes. É o obstáculo "vivo" (pedestres) e o cenário bonito.
5. **Marina / Pier:** barcos, redes de pesca, gaivotas, luz de poste amarelada. Ótimo para foto e para o menu do modo livre.
6. **Vila de Pescadores:** ruas estreitas de paralelepípedo, casas coloridas, barcos virados na rua, varal de peixe. Trecho curto de **curvas fechadas** para variar.
7. **Mirante do Pôr do Sol (hub):** estacionamento elevado no morro, vista da baía, carros expostos. É o ponto de encontro dos amigos, escolha de modo e garagem.

### 3.4 Trânsito e vida

- **Fluxo lento e denso** (passeio): carros devagar procurando vaga, buzinas curtas, gente atravessando fora da faixa.
- **Obstáculos "sociais":** carrinho de picolé, bicicleta, criança com boia, vendedor de milho, cachorro no meio da pista.
- **Contraste com a serra:** na estrada você ultrapassa por velocidade; na praia, por **precisão** (desviar sem bater).
- **Penalidade leve:** bater em pedestre/props = perda de tempo, não game over.

### 3.5 Ligação com os modos de jogo

- **Volta da Orla:** corrida em loop curto, 3 voltas, pôr do sol mudando.
- **Duelo do Pôr do Sol:** 1v1 no Beira-Mar com semáforo de largada em um quiosque; o perdedor "paga" o próximo pelo ranking.
- **Modo Cruzeiro / Relax:** sem tempo, só dirigir, tirar foto, escolher música.
- **Rolê:** lobby social no mirante, com amigos exibindo carros e customizações.
- **Corrida em linha reta (drag) na avenida:** versão curta, só retas, para duelo rápido.

### 3.6 Detalhes de "história" da praia

- Placa de quiosque: "Hoje tem peixe frito", "Fechado: jogo do Brasil".
- Um carro enfeitado de "Just Married" estacionado no mirante.
- Uma kombi vendendo coco gelado.
- Pichações de nomes e datas nos muros da vila ("Verão 2026").
- Barco com nome do jogo (assinatura do criador, ovo de Páscoa).
- Música ao vivo vindo de um quiosque, mais alta perto dele.

### 3.7 Áudio

Ondas ao fundo, gaivotas, conversa abafada, violão ao longe, motores baixos. Use faixas **royalty-free** ou originais para evitar problemas de direitos.

---

## 4. Como os três cenários se conectam

| Do cenário | Para o cenário | Transição visual |
|---|---|---|
| Tokyo Drift (Daikoku PA) | Costa (Portal) | Noite → amanhecer; neon apaga, sol aparece |
| Costa (Orla) | Praia (Arco) | Luz dourada fica laranja; estrada vira avenida |
| Praia (Mirante) | Tokyo Drift | Pôr do sol → noite; luzes de quiosque viram neon |

Isso cria um **ciclo contínuo** (e um possível modo campeonato de 3 etapas).

---

## 5. Checklist técnico para navegador

Se a performance for prioridade (jogo leve):

- **Chunks modulares:** monte cada cenário com 8–12 blocos reutilizáveis (reta, curva, ponte, cruzamento, etc.) e recicle com *object pooling*.
- **Instancing / sprites:** prédios, postes e árvores repetidos como instâncias; nunca um objeto único por prédio.
- **Emissivo em vez de luz real:** o neon é textura/material brilhante + um *bloom* barato; limite luzes dinâmicas a faróis e freios dos carros do jogador/rivais próximos.
- **Reflexo falso na chuva:** um plano com gradiente e textura de neon borrada sobre o asfalto resolve 90% do efeito molhado.
- **Névoa (fog) como máscara:** esconde o pop-in dos chunks, dá clima de serra e economiza draw distance.
- **Prédios distantes como billboards** (imagens planas) com parallax.
- **Atlas de texturas:** um único atlas por cenário (letreiros de kanji, placas, props).
- **Ciclo de céu por gradiente:** 4–5 cores interpoladas (barato e lindo, especialmente na praia).
- **Paletas por hex:** guarde as cores em um único JSON por cenário para trocar clima/hora sem refazer assets.

---

## 6. Prioridade de produção sugerida

1. **Costa (segmentos 1–6):** é a pista que mais define o jogo (trânsito + ultrapassagem).
2. **Tokyo Drift (Shibuya + Expressa + Daikoku):** só 3 distritos já entregam a identidade.
3. **Praia (Avenida Beira-Mar + Mirante):** menor e reaproveita o código de trânsito.
4. Depois, adicione os distritos extras (Shinjuku, oficinas, Wangan, Touge) e os eventos de clima.

**Próximo passo:** definir se o jogo é **2D (vista de cima/lateral)** ou **3D**, para gerar a lista exata de assets, o JSON de configuração por cenário e o layout de cada pista em passos de level design.
