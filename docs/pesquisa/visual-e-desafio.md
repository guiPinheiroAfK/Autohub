# AutoDash — pesquisa: cor, cenário e desafio

**Status:** pesquisa (não é spec nem ADR). Nada aqui está decidido. Serve de insumo para as fases 4 a 7 do [v2-mostwanted](../specs/autodash/v2-mostwanted.md) e para o [GUIA-V2](../specs/autodash/GUIA-V2.md).
**Data:** 2026-11-13. Código lido no branch `feat/autodash-v2-mostwanted` (commit `6cbd80b`).

Legenda usada no texto:
- **[fonte N]**: afirmação apoiada na fonte N da seção "Fontes".
- **[calculado]**: número que eu calculei (contraste WCAG ou conta de velocidade) a partir de valores do código.
- **[proposta]**: opinião ou desenho meu. Tem que passar por playtest.
- **[estimativa]**: número chutado com base em experiência. Medir antes de confiar.

O dono gosta do jogo como está. Então tudo aqui é **evolução**: manter a cara neon noturna arcade, deixar as cores mais vivas e mais bem encaixadas, os cenários mais ricos e os eventos mais desafiadores, sem trocar a identidade.

---

## 0. Diagnóstico rápido do que existe hoje

Fatos lidos no código, com o que eles significam para cor e desafio.

| Onde | O que faz hoje | Consequência |
|---|---|---|
| `math.ts` `shade(hex, f)` | Escurece tudo multiplicando RGB por `amb` (0,42 a 1,0). | Noite = mesma paleta do dia, só mais escura. A saturação e o matiz não mudam com a hora, e as diferenças de luminância somem perto do preto. Ex.: pintura vermelha padrão sobre o asfalto à noite tem contraste **1,11:1** **[calculado]**. |
| `render/road.ts` | Grama `#0c6b3c`/`#0f8a4c` e asfalto `#66666d`/`#616167` fixos para **todos** os biomas. | A cidade tem grama verde e a costa também. O chão não pertence ao bioma. Grama x asfalto: **1,07:1** **[calculado]**. A borda só é lida pela zebra. |
| `render/road.ts` zebra | Corrida: roxo `#7c3aed` + branco. Solo: vermelho `#e0342f` + branco. `RUMBLE = 3`. | Bom contraste do branco. Ver "aliasing" na seção 2.3. |
| `render/road.ts` névoa | Uma faixa de gradiente perto do horizonte (`maxY - 34` até `+120`), cor = `sky.bot`. | Não há perspectiva atmosférica por distância. Sprites a 80% da distância têm o mesmo contraste que os de perto. |
| `render/road.ts` corrida | "Beira limpa na corrida": nenhuma decoração lateral, por desempenho (era 70% do quadro). | A corrida perde a principal fonte de sensação de velocidade, que é a taxa de bordas passando (seção 2.2). |
| `traffic/types.ts` `TRAFFIC_COLORS` | 8 cores. | De dia, 5 das 8 ficam abaixo de 2,3:1 contra o asfalto atual (`#64748b` 1,3; `#7c3aed` 1,1; `#b45309` 1,2; `#ec4899` 1,7; `#0ea5e9` 2,2) **[calculado]**. Elas se leem só pelo matiz. |
| `render/backdrop.ts` `TOKYO` | Letreiros: vermelho, creme, **amarelo `#ffd43b`**, magenta, ciano, **laranja `#ff8c42`**. | Amarelo e laranja do cenário disputam o matiz com cones (`#f97316`) e placas de obra (`#fbbf24`). O perigo e a decoração falam a mesma "língua". |
| `world/events.ts` | Perigo nasce em `1,7 × VIEW` e as três placas entram antes. | Já é uma regra de justiça excelente. Manter em todo evento novo. |
| `traffic/spawner.ts` | "QUASE!" com combo e multiplicador já existe. | Base pronta para risco e recompensa (seção 4.4). |
| `race/bots.ts` | Sem rubber band. Bots têm `erro` aleatório que vira penalidade de tempo (sem teleporte). | Boa base para um "elástico honesto" (seção 4.3). |
| `sim/update.ts` chuva | `grip × 0,62`, freio 78 em vez de 105. | O clima já mexe na física. A Fase 4 generaliza isso (ADR 0013). |

---

## 1. Cor

### 1.1 Hierarquia de valor (o que o olho precisa achar primeiro)

Em arte de jogo, a "análise de valor" (só claro e escuro, sem matiz) é a ferramenta clássica para separar o que é jogável do que é cenário. Quando fundo, inimigos e chão têm o mesmo cinza, o jogo fica ilegível. Ajustar só claros e escuros já resolve boa parte **[fonte 4]**. O fundo só "ganha o direito" de ter detalhe depois de ser empurrado para trás em valor e saturação **[fonte 4]**. A silhueta é reconhecida antes da cor **[fonte 4]**.

Para um jogo de corrida a 200 km/h, a ordem proposta é esta **[proposta]**:

| Nível | Elemento | Regra de valor e cor | Meta de contraste (WCAG, ver 1.5) |
|---|---|---|---|
| 1 | **Carro do jogador** | Saturação mais alta da tela. Sombra de contato escura, luz de recorte (1–2 px na cor da luz-chave) e neon de baixo. Não depende da pintura escolhida. | Contorno ≥ 4,5:1 contra o asfalto |
| 2 | **Rivais, polícia, trânsito** | Rivais: cor de destaque (`accent`) saturada, um degrau abaixo do jogador. Trânsito: saturação média. À noite, a leitura vem das **luzes** (lanternas e faróis). | Corpo ≥ 2:1 de dia. Lanternas ≥ 4,5:1 à noite |
| 3 | **Perigos e obstáculos** | Matiz **reservado**: âmbar + branco + preto (ver 1.8). Nenhum elemento de cenário usa esse trio perto da pista. | ≥ 3:1 contra o asfalto **e** contra o acostamento |
| 4 | **Pista** | Asfalto de saturação baixa e valor médio-escuro. Faixas com o valor mais alto da pista. Zebra com um tom de identidade do bioma e um tom claro. | Faixa ≥ 4,5:1 contra o asfalto |
| 5 | **Fundo** | Valor puxado para a cor da névoa e do céu, saturação baixa, contraste interno ≤ 1,5:1. | Longe x névoa ≤ 1,5:1 (é desejado) |

Teste prático: tirar um print, converter para cinza e "apertar os olhos" (squint test) **[fonte 4]**. Na escala de cinza, o carro, as lanternas e os cones têm que ser as primeiras manchas que aparecem.

**Alavanca principal no AutoDash [proposta]:** separar a luz de **cenário** da luz de **atores**. Hoje `shade(cor, amb)` escurece tudo por igual. A proposta:
- a pista e o fundo usam a **paleta da hora** (seção 1.7), não `shade()`;
- os atores (jogador, trânsito, rivais, obstáculos) usam `shade(cor, max(0,7, amb))` mais as próprias luzes. Na prática, é como se fossem iluminados pelos postes e pelos faróis.

Isso abre de graça a distância de valor entre o ator e a pista, que é o que mais falta à noite.

### 1.2 Perspectiva atmosférica

Com a distância caem o contraste e a saturação, e o matiz vai para a cor do céu, geralmente azul por espalhamento Rayleigh. Não é desfoque: o contorno continua nítido e o que diminui é o contraste **[fonte 3]**. Há exceções. No nascer e no pôr do sol, e com poeira ou poluição, o matiz puxa para o vermelho ou o laranja **[fonte 3]**. Em composição, o primeiro plano tem cor forte e o fundo tem pouca **[fonte 5, 6]**.

Como aplicar barato, no estilo dos racers em JS **[fonte 2]**: o *javascript-racer* calcula `fog = 1 / e^(d² · densidade)` e pinta, por segmento, um `fillRect` da cor da névoa com `globalAlpha = 1 − fog` por cima da faixa do segmento.

**[proposta]** Para o AutoDash:
- Normalizar `d = n / DRAW_DIST` (n = índice do segmento à frente).
- Densidade por clima: limpo **1,2** (em d = 1 sobram ~30% de cor), chuva **3**, neblina **9** **[estimativa]**.
- Aplicar a névoa por segmento **ao asfalto e ao chão** (um `fillRect` por segmento já pintado, ou misturar a cor com `mix()` antes de pintar, sem desenho extra). Aplicar também aos sprites: `globalAlpha` + uma camada de cor, ou cores pré-misturadas por faixa de distância.
- **Emissivos atravessam a névoa:** lanternas, faróis, neon e giroflex usam `fog' = 1 − (1 − fog) × 0,35`. Assim, a luz chega antes do corpo do carro. É isso que torna a neblina justa (ver o evento E3).
- A faixa de névoa atual no horizonte continua, como "costura" do recorte de distância.

Custo: pré-misturar a cor com `mix()` é praticamente grátis. Um `fillRect` extra por segmento são até 300 retângulos finos por quadro (só os visíveis). É barato, mas muda o golden master, então vai em commit próprio.

### 1.3 Vibrância x saturação: o "orçamento de saturação"

Saturação aumenta todas as cores por igual. Vibrância aumenta mais as cores apagadas e preserva as que já estão vivas **[fonte 7]**. Aumentar cor rapidamente fica feio, e reduzir é seguro **[fonte 7]**.

Tradução para jogo **[proposta]**:
- "Cores mais vivas" **não** é subir a saturação de tudo. É criar **contraste de saturação**: fundo e pista mais neutros, e poucos elementos muito saturados. O cérebro lê o que está vivo em relação ao entorno.
- **Orçamento:** no máximo ~10–15% da área da tela com saturação HSL > 70% **[estimativa]**. Esse orçamento vai para o carro do jogador, os acentos dos rivais, os perigos e um ou dois letreiros neon por trecho.
- "Vibrância" em Canvas 2D: puxar as cores de **cenário** em direção a um cinza do mesmo valor (`mix(cor, cinzaDeMesmoValor, 0,2–0,4)`) e deixar os emissivos intactos. É mais barato e mais controlável do que filtro.

### 1.4 Harmonias e como "encaixar" o carro no cenário

As harmonias clássicas são **[fonte 8]**:
- **Complementar:** opostos no círculo cromático, contraste máximo. Uma cor domina e a outra é acento.
- **Análoga:** vizinhas, calma e coesa.
- **Triádica:** três cores a 120°, vibrante. Uma domina e as outras aparecem pouco.
- **Complementar dividida (split):** a base mais as duas vizinhas do complemento. Contraste quase igual ao da complementar, com mais margem.

O caso "laranja e azul-petróleo" (teal and orange) do cinema mostra o mecanismo: a pele fica na faixa do laranja, então sombras e fundo azul-petróleo destacam o sujeito por complementaridade **[fonte 9]**. O carro do jogador é o "sujeito" do AutoDash.

**Receita de encaixe [proposta]:**
1. Cada bioma × horário tem uma **cor dominante de ambiente** (céu e névoa) e uma **cor de acento** complementar (ou split). Exemplos: cidade à noite = violeta/magenta dominante com acento ciano; costa ao pôr do sol = laranja/coral dominante com acento azul-petróleo.
2. A zebra usa o acento do bioma. A pista fica neutra.
3. A **luz de recorte** do carro do jogador usa a cor da luz-chave (sol, poste, lua), e o **neon de baixo** padrão usa o acento. Assim, qualquer pintura que o jogador escolher "pertence" à cena.
4. Pinturas que somem: a tabela abaixo diz quais pinturas de `PAINTS` desaparecem em cada cena. A garagem pode mostrar a prévia contra a cena do bioma escolhido (fica para a Fase 7).

Contraste de cada pintura (`PAINTS`) contra o asfalto atual e contra os asfaltos propostos na seção 1.7 **[calculado]**:

| Pintura | atual `#616167` | cidade dia | cidade pôr | cidade noite | costa dia | costa noite |
|---|---|---|---|---|---|---|
| `#e0342f` vermelho | **1,4** | **1,6** | 2,2 | 3,5 | **1,5** | 3,2 |
| `#f59e0b` âmbar | 2,9 | 3,4 | 4,6 | 7,2 | 3,2 | 6,6 |
| `#22d3ee` ciano | 3,4 | 4,1 | 5,4 | 8,6 | 3,8 | 7,9 |
| `#8b5cf6` violeta | **1,5** | **1,7** | 2,3 | 3,7 | **1,6** | 3,4 |
| `#4ade80` verde | 3,5 | 4,2 | 5,6 | 8,9 | 3,9 | 8,2 |
| `#f472b6` rosa | 2,3 | 2,8 | 3,7 | 5,8 | 2,6 | 5,4 |
| `#f8fafc` branco | 5,9 | 7,0 | 9,4 | 14,8 | 6,6 | 13,6 |
| `#334155` grafite | **1,7** | **1,4** | **1,1** | **1,5** | **1,5** | **1,4** |
| `#facc15` amarelo | 4,0 | 4,8 | 6,4 | 10,1 | 4,5 | 9,3 |
| `#1d4ed8` azul | **1,1** | **1,1** | **1,5** | 2,3 | **1,0** | 2,1 |

Leitura: vermelho, violeta, grafite e azul são pinturas "de matiz". Elas só se destacam se o carro tiver sombra de contato e luz de recorte. Por isso a regra do nível 1 independe da pintura.

### 1.5 Contraste mínimo para leitura em movimento

Referência formal: o WCAG 1.4.11 pede **3:1** para partes de gráfico necessárias ao entendimento, contra as cores vizinhas **[fonte 10]**. A fórmula usa luminância relativa: linearizar o sRGB, fazer `L = 0,2126 R + 0,7152 G + 0,0722 B` e calcular a razão `(L1 + 0,05) / (L2 + 0,05)` **[fonte 10]**. O WCAG foi feito para interface estática. Em movimento, com tempo de exposição curto, o certo é tratar 3:1 como **piso**, e não como meta **[proposta]**.

Metas para o AutoDash **[proposta]**:
- Perigo contra o asfalto: **≥ 3:1 no pior horário**. O cone laranja puro de dia fica perto de 2,8–3,0:1 **[calculado]**, por isso o cone precisa da **faixa branca** (≥ 5:1) e de base escura, como os cones reais.
- Faixa contra o asfalto: ≥ 4,5:1 (todas as paletas da seção 1.7 passam de 5,7:1).
- Lanternas à noite contra o asfalto: ≥ 4,5:1 (`#FF3B30` sobre `#24232F` = 4,4:1, então use núcleo `#FF5A4F` e um halo).
- Ator contra o asfalto de dia: ≥ 2:1 no corpo, ou contorno e sombra que garantam isso.

Para conferir valores, o script do cálculo está descrito na seção 6 (Apêndice A). Dá para virar teste unitário puro (`__tests__/paleta.test.ts`) que falha se alguma paleta nova violar a meta **[proposta]**.

### 1.6 Daltonismo (sinais e HUD)

- Regra base: **nenhuma informação essencial só por cor fixa**. Combine com forma, ícone, texto, posição ou som **[fonte 11]**.
- Deficiência vermelho-verde atinge algo entre 6% e 10% dos homens, conforme a fonte. Um medidor que vai de verde a vermelho "não diz nada" a um deuteranope **[fonte 11]**.
- O eixo **azul x laranja** é preservado nos três tipos comuns. A paleta **Okabe-Ito** (`#E69F00`, `#56B4E9`, `#009E73`, `#F0E442`, `#0072B2`, `#D55E00`, `#CC79A7`, `#000000`) é a referência segura para categorias **[fonte 13]**.
- Simulação: o modelo de Machado, Oliveira e Fernandes (2009) é o padrão para simular deuteranopia e protanopia. Há errata nas equações 17 e 18, então use a página dos autores **[fonte 14]**.

Auditoria do HUD atual **[calculado, com simulação Machado de severidade 1,0]**:

| Elemento | Hoje | Problema | Sugestão |
|---|---|---|---|
| Delta do duelo (`hud.ts`) | `#4ade80` / `#ef4444` + sinal `+`/`−` | Para deuteranope vira 1,7:1, oliva contra bege. O **sinal salva**. | Manter o sinal. Trocar para azul `#56B4E9` (à frente) e laranja `#E69F00` (atrás) e uma seta ▲/▼. |
| Conta-giros | azul → laranja → vermelho | Laranja e vermelho se confundem. | Adicionar pulso ou piscada no corte e mudar a espessura do arco. |
| "Última volta" (`race-hud.ts`) | vermelho x branco | Lê pela luminância (ok). | Ok. |
| Giroflex da polícia | vermelho `#ef4444` / azul `#3B82F6` | Luminância quase igual (1,02:1), mas o matiz separa até em deuteranopia (azul x oliva). | Ok. Manter a alternância temporal, que é um segundo canal. |
| Cones e placas de obra | laranja e amarelo | Para deuteranope, laranja e amarelo viram amarelo. Contra o magenta do neon (que vira cinza) o contraste fica em 1,4:1. | Matiz reservado (1.8), faixa branca e forma de triângulo ou losango. |

**[proposta]** Ligar um modo debug que aplica a matriz de Machado ao quadro inteiro, com uma tecla nova, já que as teclas de debug são ferramenta do dono. Faz `getImageData` uma vez por segundo numa cópia reduzida. É caro, mas só serve para inspeção.

### 1.7 Paletas concretas por bioma × horário × clima

**Formato [proposta]:** a paleta vira dado em `world/biomes.ts`, por exemplo um campo `paleta: Record<Horario, PaletaHora>` mais modificadores por clima. O render interpola entre horários pelo relógio em ticks (ADR 0013), como já faz `skyNow`.

Campos: céu (topo, meio, horizonte), névoa, longe (montanha, skyline ou mar), chão A/B (acostamento ou calçada, alternado pelo `RUMBLE`), asfalto A/B, faixa, zebra A/B, luz-chave e acentos (emissivos). `amb` é o valor para sprites de cenário.

Todas as combinações abaixo foram conferidas **[calculado]**: faixa contra asfalto ≥ 5,7:1, e perigo `#FF9F1C` contra asfalto ≥ 3,3:1 (dia) e ≥ 4,8:1 (pôr do sol e noite).

#### Cidade (referência: rua neon tipo Tóquio)

| Campo | Amanhecer | Dia | Pôr do sol | Noite |
|---|---|---|---|---|
| Céu topo | `#2D3E6E` | `#2E8BEF` | `#2A1B4F` | `#07051A` |
| Céu meio | `#8A6C9E` | `#7DB8F2` | `#8E3B7A` | `#1A0F3D` |
| Céu horizonte | `#FFC59A` | `#CDEBFF` | `#FF8A4C` | `#4A1D5E` |
| Névoa | `#E8B9A8` | `#BFD6EA` | `#C8607A` | `#2B1748` |
| Longe (montanha / skyline) | `#A79BB5` / `#8C86A6` | `#B4C6DA` / `#9DB3CC` | `#6E3F6E` / `#2A1838` (contraluz) | `#1E1638` / `#140F2A` |
| Chão A / B (calçada, **não** grama) | `#6E6A7A` / `#67637A` | `#9AA3AE` / `#8E97A3` | `#3D3348` / `#382F44` | `#1B1A2A` / `#201F31` |
| Asfalto A / B | `#575667` / `#535263` | `#53565F` / `#585A63` | `#4A3F55` / `#463B51` | `#24232F` / `#282735` |
| Faixa | `#F4F1F8` | `#FFFFFF` | `#FBEFF2` | `#E8ECF5` |
| Zebra A / B | `#E23A5A` / `#F4F1F8` | `#E0342F` / `#F4F6FA` | `#D7265E` / `#FBEFF2` | solo `#FF2E63` · corrida `#B026FF` / `#E8ECF5` |
| Luz-chave | sol baixo `#FFD7A8` | sol `#FFF4D6`, sombra `#3A4A6B` | sol atrás do skyline `#FF9E5E` | postes `#FFE3B3`, lua `#DDE6F5` |
| Acentos (emissivos) | `#FF6FB1`, `#5ED8FF` (a 60%) | letreiros apagados `#D94A6A`, `#2A9FD6` | `#FF4FA3`, `#3FE0FF` | `#FF2E88`, `#2BD9FF`, `#8B5CFF`, `#FFF3D6` |
| Janelas | apagando `#FFD9A0` α .3 | — | acendendo `#FFD9A0` α .35 | `#FFD9A0` / `#E2F0FF` α .5 |
| Brilho urbano no horizonte | — | — | `#FF4FA3` α .10 | `#FF4FA3` α .18 → `#FB7185` α .22 |
| `amb` | 0,78 | 1,0 | 0,80 | 0,44 |

Harmonia: noite = violeta/magenta dominante e acento ciano (complementar dividida). Pôr do sol = laranja dominante e acento ciano (complementar). Dia = azul dominante e acento vermelho na zebra.

#### Costa (mar, palmeiras, píer)

| Campo | Amanhecer | Dia | Pôr do sol | Noite |
|---|---|---|---|---|
| Céu topo | `#24406E` | `#1E9BE8` | `#3B1E5C` | `#020F1A` |
| Céu meio | `#9A7FA8` | `#6CCBF5` | `#C2456E` | `#06263A` |
| Céu horizonte | `#FFD3A8` | `#D5F6FF` | `#FFB35C` | `#0E3B4A` |
| Névoa | `#F0C9B5` | `#C9ECF5` | `#E58A7A` | `#0F3442` |
| Mar (fundo → horizonte) | `#3B5F86` → reflexo `#E9B7A0` | `#0B6E8E` → `#3FC1D9`, espuma `#E6FBFF` | `#6B3A6E` → trilha de sol `#F08A5D` | `#062633`, trilha de lua `#9FD8E6` α .35 |
| Longe (ilhas e morros) | `#7F8FB0` | `#7FC8DC` | `#8A4A6A` | `#123A48` |
| Palmeiras (meio) | `#3E4E5E` | folha `#1E6B4A`, tronco `#8A6A48` | silhueta `#24122E` | silhueta `#04141B` |
| Chão A / B (areia) | `#B9A68A` / `#B19E82` | `#E9D3A1` / `#E1CA95` | `#8A5A55` / `#82534F` | `#2B2A2E` / `#302F34` |
| Asfalto A / B | `#5A5866` / `#565462` | `#585A63` / `#5C5E67` | `#4B3B4F` / `#47374B` | `#252B33` / `#29303A` |
| Faixa | `#F6F2EE` | `#FFFFFF` | `#FFF1E6` | `#E6F4F5` |
| Zebra A / B | `#E85D75` / `#F6F2EE` | `#E23B3B` / `#F7F7F2` | `#2F7F8F` (petróleo, complementar ao céu) / `#FFF1E6` | `#14B8A6` / `#E6F4F5` |
| Luz-chave | sol `#FFE1B8` | sol `#FFF1C9` | sol `#FFB070` | lua `#CFEFF5`, píer `#FFE3A3` |
| Acentos | farol do píer `#FFE3A3` | guarda-sol `#FF6B9A`, `#2EC4B6` | `#2DF5D0` | `#2DF5D0`, coral `#FF5E7E` |
| `amb` | 0,80 | 1,0 | 0,82 | 0,46 |

Harmonia: dia = azul-petróleo análogo (mar e céu) e acento coral. Pôr do sol = laranja e magenta dominantes, com a zebra azul-petróleo complementar. Noite = petróleo profundo e acento coral.

#### Modificadores de clima (valores prontos)

Regra **[proposta]**, a partir da paleta "limpo":
- **Chuva:** céu misturado a 45% (topo) e 40% (horizonte) com `#5A6472` (de dia) ou `#1A1F2B` (à noite). Névoa misturada a 50% com `#8A96A6` ou `#2A3040`. Densidade da névoa × 2,5. Asfalto −12% de valor. Saturação do cenário × 0,8, com os **emissivos intactos e refletidos no asfalto**. `amb × 0,8` (já existe).
- **Neblina:** a cor da névoa fica clara e neutra. O céu vai 70% (topo) e 85% (horizonte) em direção a ela. Densidade × 6–9. Halo dos emissivos × 1,6.

| Bioma × horário | Chuva: céu topo / horizonte / névoa | Neblina: céu topo / horizonte / névoa |
|---|---|---|
| cidade amanhecer | `#414F70` / `#BD9E8A` / `#B9A8A7` | `#ACA4AC` / `#E7CEC0` / `#E3CFC7` |
| cidade dia | `#4279B7` / `#9FB5C7` / `#A5B6C8` | `#9BBBDE` / `#CAD3DC` / `#C9CFD6` |
| cidade pôr do sol | `#403C5F` / `#BD7B5B` / `#A97B90` | `#997A8A` / `#D19F96` / `#C9A3A3` |
| cidade noite | `#101122` / `#371E4A` / `#2B2444` | `#362A48` / `#4A365C` / `#4A3A5C` (névoa tingida pelo neon) |
| costa amanhecer | `#3C5070` / `#BDA792` / `#BDB0AE` | `#ACA7AF` / `#EAD3C6` / `#E6D3CB` |
| costa dia | `#3982B3` / `#A4BCC7` / `#AAC1CE` | `#9DCAE4` / `#D3E2E6` / `#D3DEE2` |
| costa pôr do sol | `#493E66` / `#BD9365` / `#B89090` | `#A37C89` / `#D6A692` / `#CFA49C` |
| costa noite | `#0D1622` / `#13303E` / `#1D3241` | `#213841` / `#294851` / `#2E4A52` |

Asfalto molhado (chuva) à noite: cidade `#1E1F2A` / `#222330`, costa `#1F252D` / `#232A33`, com reflexos verticais de emissivos (ver 1.9).

#### Paletas-base dos cenários novos (seção 2.6) **[proposta]**

| Cenário | Dia: céu topo / horizonte / névoa | Dia: chão / asfalto | Noite: céu topo / horizonte / névoa | Noite: asfalto | Luz-chave e acentos |
|---|---|---|---|---|---|
| Serra | `#3C8DDB` / `#D8ECF7` / `#C3D3DD` | grama `#4E7A3E`/`#476F38`, asfalto `#4F525A`/`#53565E` | `#050B18` / `#1B2B45` / `#1E2A3A` | `#22252D` | cordilheira `#8FA6BC`, pinheiros `#1F4A3A`, abismo `#2E4252`. Noite: olhos-de-gato `#F5F7FA` |
| Deserto | `#1F7FD6` / `#F6E3C0` / `#F1DDB9` | areia `#D9B27C`/`#D0A872`, asfalto `#5B5552`/`#5F5956` | `#0B0A1F` / `#2A1E4A` / `#2A2240` | `#26242C` | mesas `#D9926A`, dunas `#E6B47C`, cacto `#3E6B47`. Noite: neon de motel `#FF2E88`, `#2BD9FF`. Pôr do sol: céu `#3A1E4F`→`#FF7A3D` |
| Túnel | (interior) teto `#1C1E24` | paredes `#3A3D46`/`#34373F`, asfalto `#2B2D33` | igual | igual | luminárias `#FFE3B3` em ritmo, faixa de azulejo de identidade `#2BD9FF`, boca de saída `#FFFFFF` → céu |
| Porto industrial | `#6F8FAF` / `#D9DEE2` / `#B8C0C8` | concreto `#8A8F96`/`#848990`, asfalto `#4B4F57` | `#0A0F1A` / `#2B2F3A` / `#2E3540` | `#1F2229` | contêineres `#B23A3A`, `#2F5D8C`, `#3C7D5A`, `#8A8F99`. Torres `#FFE7C2` e LED `#BFE3FF`. Luz de aviação `#FF3B30` piscando |
| Rodovia molhada à noite | — | — | `#05070F` / `#1A2236` / `#1C2333` | `#15171E`/`#181A22` | faixa retrorrefletiva `#DDE3EE`, reflexo de farol `#FFF4D6`, reflexo de lanterna `#FF3B30`, placa de rodovia `#0E6B3C` com texto branco, spray `#8A93A6` α .25 |

Os contêineres do porto evitam laranja de propósito: é o matiz reservado aos perigos (1.8).

### 1.8 Paleta de perigo reservada (igual em todos os biomas) **[proposta]**

| Papel | Cor | Uso |
|---|---|---|
| Âmbar de perigo | `#FF9F1C` | cones, barreiras, placas de obra e de aviso, poça marcada, pregos (reflexo) |
| Branco de perigo | `#FFF4E0` | faixas refletivas dos cones, setas |
| Preto de perigo | `#14110F` | base, contorno, listras de barreira |
| Pisca de alerta | `#FFC23D` ↔ `#FF9F1C` a 2–3 Hz | evento ativo à frente (seta luminosa da obra, pisca-alerta) |

Consequências:
- Tirar `#ffd43b` e `#ff8c42` da paleta `TOKYO` dos letreiros e trocar por `#FFE9B0` (branco quente) e `#FF5E7E` (coral).
- O carro de trânsito amarelo `#eab308` pode ficar (ele é ator, não perigo), mas sem pisca.
- Em deuteranopia o âmbar vira amarelo e o magenta vira cinza **[calculado]**. Eles continuam distintos no matiz, mas com luminância parecida (1,4:1). A **forma** (triângulo, listra diagonal) e a **piscada** fazem o resto.

### 1.9 Color grading como pós-processo barato em Canvas 2D

Ferramentas disponíveis:
- `globalCompositeOperation` com `multiply`, `screen`, `overlay`, `soft-light`, `color`, `lighter` etc. **[fonte 15]**.
- Compor via API do canvas é muito mais rápido do que mexer pixel a pixel com `getImageData` **[fonte 18]**.
- Trocar de modo de composição tem custo. Há relatos de `multiply` lento no Firefox em canvas grande **[fonte 18]**. Não achei benchmark comparando `overlay`, `screen` e `multiply`. A recomendação é medir no aparelho alvo **[fonte 18]**.
- `ctx.filter` (`saturate()`, `contrast()`, `blur()`) teve suporte ausente no Safari por muito tempo, e a situação atual é confusa nas fontes **[fonte 17]**. **Não depender dele.**
- Evitar `shadowBlur`. Pré-renderizar em canvas fora da tela e reaproveitar **[fonte 16]**.

Técnicas, da mais barata para a mais cara **[proposta; custos são estimativa a medir]**:

| # | Técnica | Como | Custo por quadro (960×540) |
|---|---|---|---|
| G1 | **Paleta por hora em vez de `shade()`** | dados da seção 1.7, interpolados com `mix()` | ~0 (só troca de string de cor) |
| G2 | **Tinta de sombra e de luz** (split toning) | 1 `fillRect` de tela cheia com `soft-light` ou `overlay` numa cor (ex.: noite `#3A1F6B` a α .18). Opcional: gradiente vertical, quente no céu e frio no chão. | 1 passada de tela cheia. **[estimativa]** < 0,3 ms no desktop, 0,3–1 ms no celular |
| G3 | **Vinheta** | já existe (`vignetteTex`, sprite em cache). Pode ganhar tinta do bioma em vez de preto. | ~0 (já paga) |
| G4 | **Brilho falso por sprite** | halos em cache (`neonGlow`, `glowTex` já existem) desenhados com `lighter`, agora também em lanternas, faróis, giroflex e postes. Agrupar todos os halos num único trecho com o modo `lighter` ligado uma vez. | proporcional ao número de luzes. Ok se agrupado |
| G5 | **Reflexo molhado** | por emissivo perto da pista, um retângulo vertical com gradiente (em cache por cor), espelhado abaixo do ponto de contato, com `lighter` a α .25 | parecido com G4 |
| G6 | **Bloom falso por redução** | (1) `drawImage(canvas → 120×68)`; (2) desenhar essa miniatura sobre ela mesma com `multiply` 2 vezes (≈ cor³, que apaga os meios-tons e deixa as luzes: um "limiar" sem filtro); (3) desenhar ampliada sobre a tela com `lighter` ou `screen` a α .2–.35, com suavização ligada (o borrão vem de graça na ampliação) | 3 `drawImage`, 1 em tela cheia. **[estimativa]** 0,5–1,5 ms no celular |
| G7 | **Mudança de matiz no pôr do sol** | `color` ou `hue` com uma cor quente a α baixo, só no céu e no fundo (antes de pintar a pista) | 1 passada parcial |

Ordem sugerida: G1 → G4/G5 → G2 → G6 (por último, e só se o perfil permitir). G6 talvez fique só no desktop, para respeitar a meta de 60 fps no celular (D23).

Esboço de G2 e G6 (ilustrativo, não é código pronto):

```ts
// G2 — split toning (depois da cena, antes do HUD)
ctx.save()
ctx.globalCompositeOperation = "soft-light"
ctx.fillStyle = grade.tinta            // ex.: "#3A1F6B" na cidade à noite
ctx.globalAlpha = grade.forca          // 0.12–0.22
ctx.fillRect(0, 0, W, H)
ctx.restore()

// G6 — bloom por redução (bc: canvas 120x68 criado uma vez)
bctx.globalCompositeOperation = "copy";     bctx.drawImage(eng.canvas, 0, 0, 120, 68)
bctx.globalCompositeOperation = "multiply"; bctx.drawImage(bc, 0, 0); bctx.drawImage(bc, 0, 0)
ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.25
ctx.imageSmoothingEnabled = true; ctx.drawImage(bc, 0, 0, W, H); ctx.restore()
```

Golden master: cada técnica muda o hash do canvas. Entra uma por commit, com justificativa e linha no Log do GUIA (regra do projeto). Uma opção "Visual: leve / completo" na garagem permite desligar G2 e G6 no celular **[proposta]**.

---

## 2. Cenário

### 2.1 Composição em camadas de parallax

Estado atual (`render/backdrop.ts`), com o fator multiplicado por `eng.bgShift`:

| Camada | Fator hoje |
|---|---|
| nuvens | 0,05 |
| montanhas (2 faixas) | 0,18 e 0,42 |
| mar (cintilação) | 0,25 |
| palmeiras | 0,6 |
| skyline | 0,7 |

Princípios:
- Em pseudo-3D, perto da entrada de uma curva o horizonte quase não se move. Depois ele corre rápido no sentido contrário e continua correndo enquanto a pista endireita **[fonte 1]**.
- Em morros, o horizonte desce quando a pista sobe e sobe quando a câmera passa da crista **[fonte 1]**.
- Exagerar a curvatura ao longe convence mais do que a realidade **[fonte 1]**.
- Composição clássica: primeiro plano, centro de interesse e fundo **[fonte 6]**.

Proposta de pilha (7 camadas, do fundo para a frente) **[proposta]**:

| # | Camada | Fator horizontal | Fator vertical (com `camY`) | Conteúdo | Cache |
|---|---|---|---|---|---|
| L0 | céu em gradiente + estrelas | 0 | 0 | gradiente de 3 tons (já existe) | não precisa |
| L1 | astro (sol ou lua) e nuvens altas | 0,02 | 0,05 | sol, lua, nuvens | sprite em cache |
| L2 | longe | 0,10 | 0,15 | cordilheira, skyline distante, linha do mar | **canvas fora da tela, 2× a largura, rolando** |
| L3 | meio-longe | 0,30 | 0,30 | morros, prédios médios, ilhas | canvas fora da tela |
| L4 | meio | 0,55 | 0,50 | palmeiras, guindastes, torres de transmissão | desenho direto ou faixa em cache |
| L5 | perto do horizonte | 0,75 | 0,70 | brilho urbano, névoa do horizonte, píer | direto |
| L6 | beira de pista | projeção real | projeção real | sprites por segmento (`drawDeco`) | — |

A progressão geométrica dos fatores (~×2–3 entre camadas) dá profundidade legível. O fator vertical faz o fundo "assentar" nos morros em vez de ficar colado ao horizonte. O risco previsto na spec (custo das camadas) é tratado com cache em canvas fora da tela para L2 e L3, que são o desenho mais caro e mais estático **[fonte 16]**.

### 2.2 Sensação de velocidade

Evidência:
- Para perceber a velocidade de deslocamento, a **taxa de bordas** (quantos elementos discretos passam por segundo) pesa mais do que o fluxo óptico global. Os dois somam, mas a taxa de bordas explica a maior parte **[fonte 19]**.
- Em ambiente vazio a taxa de bordas cai e a velocidade parece menor **[fonte 19]**.
- Em racer 3D em terceira pessoa, campo de visão geométrico e câmera mais alta aumentam a velocidade percebida. O desfoque de movimento tem resultado misto, e um estudo com *Split/Second* não achou diferença **[fonte 20]**.

O que isso diz ao AutoDash:
1. **A corrida está com taxa de bordas baixa** porque a beira foi limpa por desempenho (`road.ts`, "beira limpa na corrida"). Só a zebra e as faixas carregam a velocidade.
   **[proposta]** Voltar com **marcos de ritmo baratos**: postes de corpo e braço com 2 `fillRect`, sem gradiente, a cada 12 segmentos, nos dois lados, desenhados só quando `sw1 > 8` (perto). Halo noturno só quando `sw1 > 26`, como já se faz na ponte. Custo: ~25 postes visíveis × 2 retângulos.
   **[calculado]** A 200 km/h passam 132 segmentos/s. Um poste a cada 12 segmentos dá 11 passagens/s por lado. No máximo com nitro (~297 km/h) são 16/s, ainda abaixo de 30 Hz (metade de 60 fps), sem efeito estroboscópico.
2. **Contraste de borda:** os marcos de ritmo precisam de contraste alto contra o fundo imediato (poste claro sobre fundo escuro à noite, poste escuro contra céu claro de dia). Marco de ritmo com contraste baixo não conta como borda.
3. **Campo de visão dinâmico:** já existe um "FOV pump" no nitro (escala 1,025). **[proposta]** Fazer o FOV crescer suavemente com a velocidade (ex.: `FOV` de 100 a 106 entre 150 e 260 km/h). A câmera não é toda alterada; mexe só em `CAM_DEPTH` do render, sem mexer na física. Mudança de câmera é da Fase 7 (D16, "com cuidado de engenharia").
4. **Linhas de velocidade** ("streaks") já existem nas bordas. Ok.
5. **Som** é a outra metade. O motor já é sintetizado. **[proposta]** Um "whoosh" curto, com pan estéreo, ao passar cada poste ou carro perto (o near-miss já tem som).

### 2.3 Aliasing temporal das listras (hipótese a verificar)

Uma roda filmada abaixo da taxa de quadros necessária parece parar ou girar ao contrário (efeito roda de carroça). Isso também acontece em jogos e diminui ao dobrar a taxa de quadros **[fonte 21]**.

**[calculado]** Zebra e faixas alternam a cada `RUMBLE = 3` segmentos, então o período é de 6 segmentos. A 60 fps, o deslocamento por quadro é `km/h × 132 / 200 / 60 ≈ 0,011 × km/h` segmentos. A metade do período (3 segmentos por quadro) acontece em **~272 km/h**. Perto disso, com nitro, as listras podem piscar a 30 Hz. Acima disso (até ~297 km/h) elas podem parecer andar **para trás**. A 144 fps o limite vai a ~655 km/h, sem problema.

**[proposta]** Testar no celular a 60 fps com nitro. Se aparecer, há duas saídas:
- separar a faixa central em traço e vão mais longos (período de 8 segmentos, que leva o limite a ~364 km/h), mantendo a zebra;
- reduzir o contraste da zebra acima de 240 km/h (um "borrão" barato).

Mudança visual, então commit próprio.

### 2.4 Ritmo de objetos ao lado da pista

Princípios **[proposta, apoiada em fonte 22 para marcos]**:
- **Três frequências sobrepostas:**
  - (a) **ritmo** constante: postes e balizas a cada 8–16 segmentos, para dar velocidade;
  - (b) **textura** agrupada: árvores, prédios e palmeiras em grupos de 3–7 com vãos de 20–60 segmentos, para dar respiro e variedade;
  - (c) **marcos** raros: 1 a cada 30–60 s de jogo, algo grande e único (torre, ponte, farol, roda-gigante, guindaste).
- **Marcos ("weenies"):** objetos grandes, visíveis de longe, que dão orientação **[fonte 22]**. Nos **circuitos fixos** (Fase 3), cada trecho com nome ("Curvão", "Chicane") ganha um marco no lado de fora. O jogador aprende o traçado pelo marco ("freia na torre vermelha"). É o reconhecimento de percurso feito com cenário.
- **Hoje no solo:** árvore a cada 4 segmentos, poste a cada 10, outdoor a cada 51 (`road.ts`). É um ritmo único e regular demais, que vira "papel de parede". **[proposta]** Usar uma semente por trecho para decidir o padrão (grupo, vão, marco) e manter o ritmo do poste fixo.
- **Proibido na faixa de leitura:** nada de cenário com cor de perigo nem pisca em até ~1,6 de `offset` (perto da beira).
- **Variedade sem ruído:**
  - variar a **silhueta** (altura e largura) mais do que a cor;
  - limitar cada bioma a 3–4 matizes de cenário mais 1–2 acentos;
  - detalhe só quando o sprite é grande (o código já faz isso com `w > 10`, `w > 12`, o que é ótimo);
  - longe = silhuetas chapadas.

### 2.5 Transições entre biomas

Técnicas **[proposta]**:
1. **Portal:** a troca acontece dentro de um túnel, sob um viaduto ou no meio da ponte (as duas últimas já existem como zona). Ao sair, o bioma é outro. É o truque mais barato e mais limpo, porque nada precisa misturar.
2. **Mistura de paleta por distância:** `mix(paletaA, paletaB, p)` com `p` por segmento ao longo de ~300 segmentos (uma distância de desenho). Como a paleta é dado, custa quase zero.
3. **Fundo com fusão:** L2 e L3 com `globalAlpha` cruzado ao longo de 2–3 s. São 2 `drawImage` em cache durante a transição.
4. **Pesos de decoração:** num trecho de ~150 segmentos, os sprites de beira sorteiam de A e de B com probabilidade crescente (ex.: palmeiras começam a aparecer entre os prédios). A Fase 1 deixou "peso de decoração" pendente. Esta é a hora de implementar.

Na corrida (circuito fixo), a transição pode ser escrita no próprio trecho do circuito (`TrechoDef` ganha `bioma?`). A volta passa a ter "cidade → túnel → costa → ponte → cidade".

### 2.6 Ideias de cenários novos e o que cada um exige

Os nomes abaixo são genéricos. Nada de copiar fase, arte ou nome de jogo existente.

| Cenário | Camadas (L2 / L3 / L4) | Sprites de beira (L6) | Chão e efeitos | Ganchos de jogo | Esforço |
|---|---|---|---|---|---|
| **Serra (estrada de montanha)** | cordilheira azulada / encosta com pinheiros / pinheiros escuros | guard-rail contínuo (faixa na borda, igual à mureta da ponte), placas de curva, pedras, cascata ocasional | grama de altitude. **Abismo de um lado**: o chão de um lado vira gradiente para `#2E4252` (vazio) | curvas fechadas e encadeadas, vento lateral (E11), queda de pedras (E14), neblina de vale (E3) | M |
| **Deserto** | mesas e chapadões avermelhados / dunas / cactos e postes de madeira | cacto (2 formas), poste de telégrafo (ritmo), carcaça e placa de motel | areia. Ar quente: ondulação **só** no horizonte (deslocar 1–2 px linhas de L2 por seno, barato) | retas longas com caminhões (E1, E4), tempestade de areia = neblina laranja (E3 com névoa `#E0B07A`) | M |
| **Túnel** | não tem fundo: teto e paredes por segmento (como a mureta da ponte, nos dois lados e em cima) | luminárias no teto a cada 4 segmentos (taxa de bordas máxima, muito rápido), saídas de emergência verdes com pictograma | eco no áudio, escuro. Saída com clarão (`screen` branco em 0,5 s) | transição de bioma (portal), ofuscamento na saída (E12), helicóptero perde o jogador (E13) | M (G se tiver curva interna com teto) |
| **Porto industrial** | guindastes com luz vermelha / pilhas de contêiner / cercas e postes altos | contêiner (bloco de 4 cores, sem laranja), empilhadeira, cerca, poste alto | concreto. Linha férrea cruzando (faixa de trilhos no asfalto) | caminhões de contêiner (E1, E4), cruzamento de trem com cancela (evento futuro), pátio sinuoso | M |
| **Rodovia molhada à noite** | skyline muito distante / pórticos de sinalização / defensas de concreto | pórtico verde de rodovia (marco), defensa central (New Jersey), postes altos de luz branca | asfalto muito escuro com reflexos verticais (G5), spray atrás dos caminhões | aquaplanagem (E2), ofuscamento (E5), spray que tapa a visão atrás de caminhões (E2b) | M (reaproveita a cidade) |

Cada bioma é um registro em `BIOMES` com camadas e funções novas em `render/backdrop.ts` (como manda o ADR 0011): sem `if (bioma === ...)`.

### 2.7 Referências estudadas (só princípios)

- **Racer arcade de 1986 com bifurcações:** ao fim de cada etapa a estrada se divide e o jogador escolhe a rota, o que dá várias combinações de percurso **[fonte 23]**. O autor viajou de carro pela Europa para colher cenário porque o cenário americano "não mudava o bastante" **[fonte 23]**. A cor do carro foi pensada contra o céu: um vermelho vivo sob céu azul e nuvens brancas **[fonte 23]**. Princípios para nós: variedade de cenário é design, não enfeite; o carro do jogador é escolhido pelo contraste com a cena; a bifurcação cria decisão (o AutoDash já tem ramais).
- **Tutoriais de pseudo-3D** (página de Lou e *javascript-racer*): listras claras e escuras alternadas dão o movimento, a névoa exponencial custa pouco, o parallax tem 3 camadas, e o exagero de curva ao longe vende velocidade **[fonte 1, 2]**.

---

## 3. Onde cada ideia de cor e cenário entra nas fases

| Fase (spec) | Cor e cenário que cabem nela |
|---|---|
| **4 — ticks e clima** | Paleta por hora (G1), névoa por distância (1.2), modificadores de chuva e neblina (1.7), reflexo molhado (G5), emissivos atravessando a névoa. Tudo isso é o "visual" do clima. |
| **5 — eventos (racha, combustível)** | Paleta de perigo reservada (1.8), marcos de ritmo na corrida (2.2), posto de combustível como marco e respiro. |
| **6 — polícia por estrelas** | Brilho falso no giroflex (G4), luz de helicóptero, leitura de bloqueio de longe. |
| **7 — customização estética e câmera** | Luz de recorte e neon de baixo por bioma (1.4), prévia da pintura contra a cena, FOV dinâmico (2.2), tinta de sombra e luz (G2), bloom falso (G6), opção "Visual leve/completo". |
| **Biomas (D4, sem fase fixa)** | Serra, deserto, túnel, porto e rodovia molhada (2.6). Transições (2.5). |

---

## 4. Desafio e eventos

### 4.1 Princípios de dificuldade justa (arcade)

1. **Telegrafar:** um sinal claro com tempo de reação suficiente faz o erro parecer do jogador, não do jogo **[fonte 26]**. Perigo justo é o que dá para reconhecer e evitar com habilidade **[fonte 26]**. Um "falso aviso" só funciona se o aviso continuar legível **[fonte 26]**.
2. **Janela mínima de leitura.** Tempo entre o perigo ficar legível e o contato, com a distância de desenho de `DRAW_DIST × SEG_LEN = 60.000` unidades **[calculado]**:

   | Visibilidade | 120 km/h | 200 km/h | 260 km/h |
   |---|---|---|---|
   | 100% (limpo) | 3,8 s | 2,3 s | 1,75 s |
   | 60% (chuva forte) | 2,3 s | 1,4 s | 1,05 s |
   | 35% (neblina) | 1,3 s | 0,8 s | 0,6 s |

   **[proposta]** Meta arcade: **≥ 1,2 s** de leitura em qualquer situação. Na neblina, a 200 km/h, a regra só fecha se:
   - os perigos dentro do banco de neblina forem **emissivos** (luz atravessa a névoa, 1.2);
   - ou o banco de neblina for visível antes e "pedir" para tirar o pé.

   Os eventos atuais já nascem a `1,7 × VIEW`, com placas antes, e isso continua valendo.
3. **Curva em dente de serra:** a dificuldade sobe e desce dentro de cada trecho. Curva plana cansa e picos o tempo todo viram caos **[fonte 27]**.
4. **Tensão e alívio (diretor de intensidade):** o "diretor" de um jogo cooperativo de zumbis cicla entre crescer, sustentar o pico e relaxar, e só gera hordas na fase de crescimento **[fonte 28]**. DDA e "canal de fluxo": manter o jogador entre o tédio e a frustração **[fonte 29]**.
5. **Risco e recompensa:** no arcade de batidas de referência, o boost vem de direção perigosa (contramão, passar raspando, drift). Bater custa boost **[fonte 25]**. O AutoDash já tem "QUASE!" e combo, e falta graduar.
6. **Elástico honesto:** o rubber band existe para manter a corrida disputada. As versões óbvias (IA teleportando, IA parada em último) parecem trapaça **[fonte 24]**. Feito errado, torna a boa pilotagem irrelevante **[fonte 24]**.
7. **Regras do próprio projeto que entram aqui:** sem checkpoint e sem teleporte, batida só reduz velocidade ou desabilita (D6); determinismo por seed (ADR 0013); clima mexe na física (D10).

### 4.2 Diretor de intensidade para o AutoDash **[proposta]**

Hoje o evento sai a cada 15–30 s (`updateEventSpawner`), e o trânsito cresce com km e nível. A proposta troca o timer por um **orçamento**:
- Medidor `tensao` de 0 a 1, que sobe com densidade de trânsito à frente, velocidade, perigo ativo e quase-batidas, e desce com o tempo sem perigo.
- Estados:
  - **crescer:** pode lançar evento, com custo por evento (ex.: obra 0,2; neblina 0,35; pregos 0,4);
  - **pico** (sustenta 8–15 s);
  - **alívio** (15–25 s sem evento novo, trânsito mais ralo, **reta com posto de combustível** como respiro natural da Fase 5).
- **Dente de serra por nível:** dentro de um nível a tensão alvo sobe. Na virada de nível (já existe `levelUpT`) há alívio garantido e a meta seguinte fica um pouco acima.
- **Determinismo:** o sorteio usa o RNG da seed da pista (ADR 0013), nunca `Math.random()`, para o golden master repetir. Hoje `events.ts` usa `Math.random()`, e isso precisa mudar antes de qualquer evento novo entrar.

### 4.3 Elástico honesto na corrida **[proposta]**

- **Nunca** acelerar um bot além do `topSpeed` do carro dele, nem teleportar (D6).
- O ajuste é só pela **taxa de erro**: quem lidera com folga erra um pouco mais (`perfil.erro` × 1,0–1,4 conforme a distância). Quem está muito atrás erra menos. É invisível porque o bot já erra hoje.
- **Vácuo (slipstream) físico para todos:** quem está colado atrás ganha até +4% de velocidade máxima. Recupera atraso por habilidade e vale para o jogador e para os bots (E9).
- Mostrar no HUD um ícone de vácuo quando ativo. Transparência evita a sensação de trapaça (as fontes de DDA citam a transparência como cuidado **[fonte 29]**).

### 4.4 Quase-batida graduada **[proposta]**

- **Três faixas por distância lateral na hora do cruzamento:** "raspão" (< 0,08 de `offset` livre), "perto" e "quase". Pontos 3×, 2× e 1×.
- **Contramão vale 2×** (zona de mão dupla). É risco real, e no arcade de referência a contramão já alimenta o boost **[fonte 25]**.
- **Quase-batida enche o nitro** (+6 por quase-batida): o risco vira recurso, como no arcade de referência **[fonte 25]**. Isso não mexe na velocidade-base do carro, então respeita o não-escopo de tuning.
- Bater zera o combo (já é assim).

### 4.5 Lista priorizada de eventos e jogadas novas

Prioridade = (ganho de desafio justo × encaixe na fase) ÷ esforço. P = até ~1 dia, M = 2–4 dias, G = 1 semana ou mais **[estimativa]**.

| # | Evento | Fase | Esforço | Por que nesta ordem |
|---|---|---|---|---|
| E1 | Caminhão trocando de faixa | 5 | P | Usa `blinkT` e o driver civil que já existem. Desafio novo com risco quase zero. |
| E2 | Poça e aquaplanagem | 4 | P/M | É **o** efeito de chuva na física que a Fase 4 pede (D10). |
| E3 | Banco de neblina | 4 | M | Faz o clima "neblina" do ADR 0013 virar desafio. Depende da névoa por distância (1.2). |
| E4 | Obra com estreitamento e seta luminosa | 5 | P | Estende `obstacles` e usa a paleta de perigo. |
| E5 | Ofuscamento por farol na contramão | 4 | P | Usa a mão dupla e o farol alto (`beamT`), que já existem. Só à noite. |
| E6 | Comboio com fresta | 5 | M | Risco e recompensa clara (fresta = quase-batida). |
| E7 | Rival que fecha | 5 | M | Dá personalidade aos bots na corrida. |
| E8 | Tapete de pregos | 6 | M | Primeiro "dente" da polícia por estrelas, com punição sem teleporte. |
| E9 | Vácuo (jogada) | 5 | P/M | Contra-jogada de E7 e base do elástico honesto. |
| E10 | Bloqueio policial com fresta | 6 | M | Pico de tensão da perseguição, com atalho como fuga. |
| E11 | Vento lateral | 4 | P | Clima com efeito físico barato. Combina com ponte e serra. |
| E12 | Saída de túnel com clarão | 4 / bioma | M | Depende do cenário túnel. |
| E13 | Helicóptero com holofote | 6 | G | Nível alto de estrelas. Sprite e sombra novos. |
| E14 | Queda de pedras na serra | bioma | M | Depende do bioma serra. |
| E15 | Óleo na pista após acidente | 5 | P/M | Evento de "consequência" do trânsito. Lê bem com o pisca-alerta. |

Detalhe de cada um (leitura antecipada, contra-jogada, encaixe e notas técnicas). Todos **[proposta]**.

**E1 — Caminhão trocando de faixa** (Fase 5, P)
- **Leitura:** a seta acende ≥ 1,2 s antes (`blinkT`) e o caminhão "ensaia", deslocando 0,05 de `offset` para o lado 0,4 s antes de ir. À noite a seta é emissiva e atravessa a névoa.
- **Contra-jogada:** frear e ficar atrás, ou passar pelo lado oposto antes que ele termine. Se passar no vão enquanto ele troca, ganha "raspão".
- **Técnico:** nova regra no driver civil para `kind === "truck"`. Nunca troca para a faixa do jogador se `dz` for menor que a janela de 1,2 s na velocidade atual.

**E2 — Poça e aquaplanagem** (Fase 4, P/M)
- **Fundamento:** aquaplanagem de carro começa por volta de 72–93 km/h em lâmina d'água. Pneu gasto baixa o limite **[fonte 30]**. Regra prática: com pneu bom, a partir de 80 km/h já se "esquia" **[fonte 30]**.
- **Leitura:**
  - mancha escura e espelhada na faixa, refletindo céu e neon (G5), visível a ≥ 60% da distância;
  - placa "PISTA ESCORREGADIA" 1 km antes;
  - som de spray dos carros à frente ao passar por ela.
- **Contra-jogada:** tirar o pé e manter o volante reto, ou mudar de faixa antes. Esterçar dentro da poça é o erro.
- **Efeito:** acima de 90 km/h, `grip × 0,25` por 0,35–0,6 s e direção com atraso. Abaixo disso não acontece nada. O pneu (D14) muda o limite: pneu de chuva +20 km/h.
- **E2b (variação):** atrás de caminhão na chuva o **spray** reduz a visibilidade local (sprite cinza translúcido). A contra-jogada é não ficar colado, o que cria tensão com o vácuo (E9).

**E3 — Banco de neblina** (Fase 4, M)
- **Leitura:**
  - a parede cinza é visível no horizonte antes de entrar (desenhada como faixa de névoa densa a partir do `z` da zona);
  - placa "NEBLINA" e pisca de alerta;
  - dentro dela, **só luzes** (lanternas e faróis) aparecem primeiro.
- **Contra-jogada:** reduzir até a janela de 1,2 s fechar (≈ 130 km/h com visibilidade de 35%, pela tabela de 4.1) e seguir as lanternas. Recompensa: "travessia limpa" vale bônus × 2 (casa com a ideia 9 do GUIA, "corrida de chuva com névoa").
- **Técnico:** zona `neblina` com densidade de névoa interpolada nas bordas. A física não muda, mas a visibilidade sim (D10).

**E4 — Obra com estreitamento e seta luminosa** (Fase 5, P)
- **Leitura:**
  - placas de 2 km e 1 km (já existem);
  - **seta luminosa piscando** (painel âmbar com chevrons) sobre a faixa fechada, visível de longe;
  - trânsito comprimindo antes.
- **Contra-jogada:** entrar cedo na faixa livre. Quem fura no último segundo arrisca o cone (o tranco já existe, sem morte).
- **Técnico:** padrão novo em `spawnEvent("obstacles")`: 4 → 2 faixas por ~1.500 segmentos, com o trânsito civil migrando como na mão dupla (`updateZones` já faz algo parecido).

**E5 — Ofuscamento na contramão** (Fase 4, só à noite, P)
- **Fundamento:** o ofuscamento por farol tem efeito que dura depois que o carro passa, e a recuperação é mais lenta na periferia e com mais luz **[fonte 31]**. A recuperação real é da ordem de segundos. No arcade, usar ~1 s.
- **Leitura:** um par de faróis brancos crescendo na contramão, com um flash de farol alto do outro motorista 0,5 s antes.
- **Contra-jogada:**
  - piscar o farol alto de volta (`beamT` já existe): o motorista baixa o farol e o clarão cai pela metade;
  - ou olhar a **linha de borda da direita**, que continua com contraste alto (regra: o clarão nunca cobre a faixa da direita).
- **Efeito:** `screen` branco-quente `#FFF4D6` a α 0,35 → 0 em 1,0 s, com centro no farol.

**E6 — Comboio com fresta** (Fase 5, M)
- **Leitura:** grupo de 3–4 veículos lado a lado, visível de longe pelas lanternas em linha. A fresta (uma faixa livre) **anda devagar** de um lado para o outro, com a seta de quem vai fechar acesa.
- **Contra-jogada:** ler a fresta e passar no tempo certo (multiplicador de quase-batida × 3), ou esperar atrás até o comboio abrir (ele abre em 4–6 s).
- **Técnico:** grupo de `Traffic` com o mesmo `speed` e um líder. Regra: sempre resta uma faixa transitável.

**E7 — Rival que fecha** (Fase 5, corrida, M)
- **Leitura:** quando o jogador está a menos de ~8 carros atrás, o rival "olha": acende a luz de freio por um instante e oscila 0,03 de `offset`. Fecha a linha 0,5 s depois. No máximo 1 fechada a cada 10 s por rival.
- **Contra-jogada:** fintar (ir para um lado e cortar para o outro). O rival reage com atraso de 0,4 s, então a finta funciona. Ou usar o vácuo (E9) para ganhar velocidade e passar.
- **Técnico:** `race/bots.ts` ganha "agressão defensiva" dentro do `perfil.agressao`. O bot nunca bate de propósito. Ele só ocupa a faixa.

**E8 — Tapete de pregos** (Fase 6, a partir de 3 estrelas, M)
- **Leitura:**
  - viatura parada no acostamento com giroflex visível de longe;
  - o tapete é uma faixa prateada com **reflexos âmbar piscando**, atravessando 2–3 faixas;
  - placa "PARE" e som de sirene com pan estéreo.
- **Contra-jogada:** a faixa livre (sempre existe uma) ou o ramal ou atalho, se houver.
- **Punição (D6):** pneu furado, `topSpeed × 0,75` e `grip × 0,8` por 8 s, com faísca no aro. Não para o carro e não teleporta. A perseguição continua, e o jogo segue.

**E9 — Vácuo** (Fase 5, jogada, P/M)
- **Leitura:** linhas de ar no HUD e um ícone quando colado atrás (≤ 3 carros, mesma faixa).
- **Risco:** colado atrás de caminhão = spray na chuva (E2b) e freada brusca. Recompensa: até +4% de velocidade máxima. Soltar do vácuo dá um "estilingue" curto.
- **Técnico:** vale para bots e jogador (elástico honesto, 4.3).

**E10 — Bloqueio policial com fresta** (Fase 6, a partir de 4 estrelas, M)
- **Leitura:**
  - luzes vermelhas e azuis no horizonte bem antes do corpo das viaturas (emissivos atravessando a névoa);
  - placas;
  - as viaturas ficam atravessadas com **um vão** entre elas, mais o acostamento livre.
- **Contra-jogada:** passar no vão (bônus grande), ir pelo acostamento (perde velocidade no chão) ou pegar o ramal.
- **Técnico:** generaliza a `blitz` atual (cones, barreira e `parked`), com viaturas e outro layout.

**E11 — Vento lateral** (Fase 4, P)
- **Leitura:** biruta ou bandeiras na beira, partículas horizontais e placa "VENTOS LATERAIS". **Cada rajada é avisada 0,5 s antes pelo som** e por uma onda de partículas.
- **Contra-jogada:** contra-esterçar. Na ponte (zona `bridge` já existe), o vento é mais forte.
- **Efeito:** empurrão lateral em `playerX` proporcional à velocidade, sem tirar o controle.

**E12 — Saída de túnel com clarão** (Fase 4 ou bioma túnel, M)
- **Leitura:** placa "SAÍDA" e a boca de saída visível como um retângulo branco crescendo.
- **Regra de justiça:** o clarão (0,5 s de `screen` branco) **nunca esconde lanternas**. Elas são desenhadas por cima do clarão. Não pode haver obstáculo nos primeiros 0,8 s depois da saída.
- **Contra-jogada:** sair na faixa onde as lanternas não estão.

**E13 — Helicóptero com holofote** (Fase 6, 5 estrelas, G)
- **Leitura:** um círculo de luz no asfalto à frente, que segue o jogador com atraso, e som de rotor.
- **Contra-jogada:** túnel ou viaduto quebram a linha de visão, e a perseguição perde força enquanto o jogador estiver fora do círculo. É o "como encerra a perseguição" que o GUIA deixou em aberto.
- **Técnico:** o círculo é um gradiente em cache com `lighter`. O helicóptero em si é sprite pequeno no céu.

**E14 — Queda de pedras na serra** (bioma serra, M)
- **Leitura:** placa "QUEDA DE PEDRAS", poeira subindo da encosta 1,5 s antes e pedras rolando visíveis do lado da encosta.
- **Contra-jogada:** desviar para o lado do abismo, com guard-rail.
- **Punição:** a pedra é obstáculo fixo depois que para. Pedra pequena funciona como o cone de hoje (tranco), e pedra grande como barreira.

**E15 — Óleo após acidente** (Fase 5, P/M)
- **Leitura:** carro batido no acostamento com **pisca-alerta** âmbar e mancha com reflexo arco-íris na faixa.
- **Contra-jogada:** desviar. Em cima da mancha a perda de aderência é curta, como na poça.
- **Técnico:** reaproveita o efeito de E2 com outra textura.

### 4.6 Onde os eventos encaixam (resumo por fase)

| Fase | Eventos e jogadas |
|---|---|
| 4 — clima e ticks | E2 poça (+E2b spray), E3 neblina, E5 ofuscamento, E11 vento, E12 túnel (se o cenário existir) |
| 5 — eventos | E1 caminhão, E4 obra, E6 comboio, E7 rival que fecha, E9 vácuo, E15 óleo, quase-batida graduada (4.4), diretor de intensidade (4.2), posto como alívio |
| 6 — polícia por estrelas | E8 pregos (★★★), E10 bloqueio (★★★★), E13 helicóptero (★★★★★), elástico honesto aplicado às viaturas |
| 7 — estética e câmera | sem evento novo. Entram o FOV dinâmico e o grading, que **melhoram a leitura** dos eventos |
| Biomas futuros | E14 pedras (serra), E12 túnel |

Sugestão de escalas de estrela para a Fase 6 (insumo para a decisão em aberto do GUIA) **[proposta]**:
- ★ radar e blitz atuais;
- ★★ viaturas na cola (a perseguição atual);
- ★★★ pregos;
- ★★★★ bloqueio com fresta;
- ★★★★★ helicóptero.

A perseguição termina por distância sem ser visto (fora do holofote ou do campo das viaturas) por N segundos, ou atravessando um túnel. Nunca termina por teleporte.

---

## 5. Plano de adoção sugerido (commits pequenos) **[proposta]**

Respeita "um commit = uma mudança verificável" e a regra do golden master.

1. `test:` teste unitário puro de contraste das paletas (Apêndice A). Não muda o golden.
2. `refactor:` paleta por bioma × hora como **dado** em `biomes.ts`, ainda sem uso. Não muda o golden.
3. `feat:` pista e chão leem a paleta (fim da grama verde fixa). **Muda o golden**, em commit próprio, com justificativa.
4. `feat:` névoa por distância e emissivos atravessando. Muda o golden.
5. `feat:` paleta de perigo reservada (cones com faixa branca, `TOKYO` sem âmbar). Muda o golden.
6. `feat:` marcos de ritmo baratos na corrida. Muda o golden e precisa de perfil de fps.
7. `refactor:` eventos usam o RNG da seed (pré-requisito da Fase 4 e do ADR 0013). Pode mudar o golden do solo.
8. Eventos da Fase 4 (E2, E3, E5, E11), um por commit.

---

## 6. Apêndice A — como os contrastes foram calculados

- Luminância relativa WCAG: linearizar o canal (`c ≤ 0,04045 ? c/12,92 : ((c+0,055)/1,055)^2,4`), fazer `L = 0,2126R + 0,7152G + 0,0722B` e `razão = (Lmaior + 0,05) / (Lmenor + 0,05)` **[fonte 10]**.
- Simulação de deuteranopia: matriz de Machado et al. (2009), severidade 1,0, aplicada em RGB linear **[fonte 14]**. Os coeficientes usados foram os mais citados em implementações abertas. **Conferir com a página dos autores (há errata) antes de virar teste.**
- Os cálculos foram feitos com um script Node descartável (fora do repositório). Para virar teste no projeto, basta portar as 4 funções para `math.ts` como funções puras.

---

## Fontes

1. Lou Gorenfeld — *Lou's Pseudo 3D Page*: https://extentofthejam.com/pseudo/
2. Jake Gordon — *How to build a racing game* (artigo): https://jakesgordon.com/writing/javascript-racer-v1-straight/ · código (`exponentialFog`, `Render.fog`, `COLORS`): https://github.com/jakesgordon/javascript-racer/blob/master/common.js
3. Aerial perspective: https://studiochalkboard.evansville.edu/ap-aerial.html · https://eclecticlight.co/2015/04/23/making-space-4-aerial-perspective/
4. Redução de confusão visual e análise de valor: https://www.gamedeveloper.com/design/how-to-reduce-visual-confusion-in-your-game · https://icewyrmgames.github.io/research/reducing-visual-confusion-in-your-game · https://bugnet.io/blog/readable-game-art-why-clarity-beats-detail
5. Room 8 — *Game art analysis pt. 2: atmosphere*: https://room8studio.com/news/game-art-analysis-pt-2-atmosphere/
6. *Composition in level design*: https://gamedeveloper.com/design/composition-in-level-design
7. Vibrância x saturação: https://petapixel.com/2017/09/28/difference-vibrance-saturation
8. Harmonia de cores: https://en.wikipedia.org/wiki/Harmony_(color) · https://www.sessions.edu/notes-on-design/color-series-intro-to-color-harmony/
9. Laranja e azul-petróleo: https://www.adobe.com/creativecloud/video/hub/features/why-use-orange-teal-grading · https://petapixel.com/2017/02/23/orange-teal-look-popular-hollywood/
10. WCAG 2.1 — *Understanding Non-text Contrast (1.4.11)*: https://w3c.github.io/wcag21/understanding/21/graphics-contrast.html
11. Game Accessibility Guidelines — informação essencial não só por cor: https://gameaccessibilityguidelines.com/ensure-no-essential-information-is-conveyed-by-a-fixed-colour-alone/ · Filament Games: https://www.filamentgames.com/blog/color-blindness-accessibility-in-video-games
12. Xbox Accessibility Guideline 102: https://devdocs.xbox.com/gaming/accessibility/xbox-accessibility-guidelines/102
13. Paleta Okabe-Ito: https://siegal.bio.nyu.edu/color-palette/
14. Machado, Oliveira e Fernandes (2009), simulação de CVD: https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
15. MDN — `globalCompositeOperation`: https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
16. MDN — *Optimizing canvas*: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas · web.dev: https://web.dev/articles/canvas-performance
17. MDN — `CanvasRenderingContext2D.filter`: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter · caniuse: https://caniuse.com/mdn-api_canvasrenderingcontext2d_filter · WebKit bug 198416: https://bugs.webkit.org/show_bug.cgi?id=198416
18. Custo de blend modes (relatos): https://discourse.processing.org/t/blendmode-multiply-is-slow-in-firefox/38156 · https://www.construct.net/en/forum/construct-2/javascript-sdk-32/blend-mode-performance-test-57608 · https://bugzilla.mozilla.org/show_bug.cgi?id=762973
19. Larish e Flach (1990), taxa de bordas x fluxo óptico global: https://corescholar.libraries.wright.edu/psychology/367
20. Holm, Skovhus e Kraus (2017), FOV, motion blur e altura de câmera: https://eudl.eu/doi/10.1007/978-3-319-55834-9_14 · Disney Research (motion blur em racer): https://studios.disneyresearch.com/2013/11/06/simulated-motion-blur-does-not-improve-player-experience-in-racing-game/
21. Efeito roda de carroça e efeito estroboscópico: https://en.wikipedia.org/wiki/Wagon-wheel_effect · https://blurbusters.com/stroboscopic
22. Marcos e orientação ("weenies"): https://www.gamedeveloper.com/design/navigation-and-wayfinding-in-a-quot-dark-game-quot-part-1 · https://era.library.ualberta.ca/files/cgh93gz674/Nisbet_Brett_A_201604_MA.pdf
23. Racer arcade de 1986 (bifurcações, viagem, cor do carro): https://en.wikipedia.org/wiki/Out_Run · https://timeextension.com/features/flashback-yu-suzukis-real-life-200kph-drive-to-create-outrun
24. Rubber band: https://www.gamedeveloper.com/design/rubber-banding-as-a-design-requirement · https://lawofgamedesign.com/2014/08/25/theory-rubber-bands/
25. Arcade de batidas (boost por direção arriscada): https://en.wikipedia.org/wiki/Burnout_3:_Takedown · https://www.gamespot.com/reviews/burnout-3-takedown-review/1900-6106835/
26. Telegrafar perigo: https://www.gamedeveloper.com/game-platforms/designing-for-difficulty-readability-in-arpgs · https://bugnet.io/blog/how-to-design-environmental-hazards-that-are-fair · https://www.wayline.io/blog/the-art-of-the-fakeout-combat-design
27. Ritmo e dente de serra: https://www.gamedeveloper.com/design/gameplay-fundamentals-revisited-part-2-building-a-pacing-structure · https://www.gamedeveloper.com/game-platforms/reflections-on-difficulty-pacing-in-i-puzzledorf-i-
28. Diretor de IA (crescer, pico, relaxar): https://cdn.fastly.steamstatic.com/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf · https://developer.valvesoftware.com/wiki/Left_4_Dead_2/Scripting/Director_Scripts
29. DDA e canal de fluxo: https://users.cs.northwestern.edu/~hunicke/pubs/Hamlet.pdf · https://arxiv.org/pdf/2007.07220
30. Aquaplanagem: https://en.wikipedia.org/wiki/Aquaplaning · https://www.dekra-roadsafety.com/en/beware-of-hydroplaning/
31. Ofuscamento por farol: https://www.lrc.rpi.edu/programs/transportation/projects/HeadlightGlare.asp · https://www.nhtsa.gov/sites/nhtsa.gov/files/811043.pdf
