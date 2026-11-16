# Montanha, Costa e Praia — definição

## Costa — a montanha

### Subida da Serra — subindo a montanha (segmento 3, detalhado)

**Sensação:** o trecho mais cinematográfico. A estrada sai do vale e começa a subir. O jogador sente **altura** crescendo, o rio ficando para trás e para baixo.

**Fases da subida (~90–120 s):**

| Fase | O que acontece | Level design |
|---|---|---|
| **Pé da serra** | Placa "Serra: reduza", início da faixa extra de caminhão, mata fecha | Curvas suaves, ensina o ritmo |
| **Meio da serra** | Serpentinas, curvas em S e cotovelos, paredão de pedra de um lado e barranco do outro, cachoeiras ao lado da pista, neblina | Curva forte a cada ~8–10 s, 2 retas curtas de recuperação |
| **Topo / aproximação do mirante** | Mata abre, céu aparece, primeira vista do mar | Curva aberta longa, trânsito mais leve |

**Como mostrar a subida (técnicas visuais, vale pra 2D e 3D):**
- **Inclinação da câmera** e ponto de fuga mais alto: a estrada "sobe" na tela.
- **Parallax vertical:** o vale vai ficando para baixo, o rio vira um fio prateado e depois some atrás da neblina.
- A **neblina fica na altura da pista** na parte alta, com os morros aparecendo acima dela.
- O motor fica mais grave, o carro perde velocidade nas retas íngremes, e caminhões ficam ainda mais lentos.
- Os morros do fundo ficam mais próximos e mais escuros (verde → quase azul), com picos mais afiados.

**Detalhes visuais da serra:**
- Mata fechada com samambaias, palmeiras de palmito, árvores altas e cipós, troncos cobertos de musgo.
- Paredão de pedra com água escorrendo, pequenas cachoeiras, barranco de terra vermelha.
- Guard-rail, defensas, balizadores refletivos, placas de curva (30 km/h), marcos de km, áreas de escape de caminhão.
- Pontos de parada: pequeno mirante com barraquinha, borracharia, capelinha à beira da estrada.
- Gotas no para-brisa quando passa por cachoeira, lente embaçada em trechos úmidos.

**Trânsito na subida (o desafio):**
- **Comboios** formados atrás de caminhões pesados a 30–40 km/h.
- **Faixa extra de subida** em alguns trechos (3 faixas) e **pista simples** em outros, onde só dá para ultrapassar pela contramão.
- Fluxo contrário **menor, mas constante** (1 carro a cada 6–10 s), como você pediu.
- Zonas de ultrapassagem **sinalizadas** (pista tracejada, reta visível) alternando com zonas proibidas (faixa dupla contínua, curva cega).
- Ônibus de excursão e vans turísticas lentas, carro com pisca-alerta quebrado, moto cortando no meio.

**Eventos aleatórios na serra:** neblina densa (faróis acendem automaticamente), chuva rápida e pista molhada, caminhão quebrado numa curva, pequeno deslizamento tomando meia pista (raro).

**Áudio:** motor em marcha baixa, freio de motor de caminhão, cachoeira, pássaros, vento, silêncio breve ao entrar na neblina.

---

## Costa — do topo até a orla

### Do topo da serra até a praia (segmentos 4 a 6)

| # | Segmento | Pista | Fluxo | Visual | Luz |
|---|---|---|---|---|---|
| 4 | **Mirante / Cume** | 2 faixas | Médio | Primeira vista do mar, mirante com barraquinhas, ônibus de turismo | Sol alto |
| 5 | **Descida em Caracol** | Pista simples | Menor, mas constante | Curvas de ~180°, paredão de pedra, muro de contenção, ciclistas | Tarde |
| 6 | **Orla / Costão** | Pista simples | Médio-alto (feriado) | Mar à direita, costão, enseadas, vilas de pescadores | Dourado |

O "reveal" do mar no segmento 4 é o momento de ouro: segure a vista com a estrada fazendo uma curva aberta e pouco trânsito por 3–4 segundos. A descida em caracol e a orla mantêm o trânsito (fluxo menor, mas nunca vazio) até a chegada na praia.

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
