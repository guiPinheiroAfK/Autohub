# ADR 0014 — Circuitos fixos, ramais (atalhos) e reconhecimento de percurso

**Status:** Implementado na Fase 3. Aguardando playtest.

## Contexto
A corrida usava uma pista gerada por seed (`buildTrack` com `corrida = true`): toda corrida era um traçado novo, sem identidade e sem como decorar uma curva. O usuário pediu (GUIA, D3, D5, D6):
- pistas **fixas**, com trechos desafiadores;
- **atalhos e ramificações**;
- **nenhum checkpoint que reseta o piloto** (batida só reduz velocidade, nunca teleporta);
- lobby mais detalhado e **reconhecimento de percurso**.

O engine é uma fita única de segmentos (`eng.segments`). Tráfego, obstáculos, bots, telemetria de rede, minimapa e contagem de voltas indexam essa fita pelo `z`. Qualquer desenho de ramificação tem que conviver com isso, e com o multiplayer por polling (ADR 0009).

## Decisão

### 1. Circuito é dado (`world/circuits.ts`)
- `CIRCUITS`: lista de registros com `id`, `nome`, `bioma`, `descricao`, `trechos` e `ramais`.
- Um trecho é `reta`, `curva`, `esse` ou `grampo`, com entrada, miolo, saída, raio (curvatura) e desnível. Um trecho pode ter uma `marca` (nome), que os ramais usam como âncora.
- `buildCircuit(eng, def)` monta os segmentos **sem sorteio**: a mesma definição gera sempre a mesma pista. O desnível acumulado é zerado na reta final, para o loop fechar plano.
- A pista procedural continua existindo como opção "aleatória" do lobby e como pista do solo e do duelo.
- O bioma da corrida vem do circuito (`def.bioma`), pela tabela `BIOMES` (ADR 0011).

### 2. Ramal paralelo (atalho ou ramificação)
Um ramal é uma **segunda faixa de asfalto ao lado da pista**, entre dois pontos da mesma fita:
- `inicio`, `fim`: marcas de trecho (viram índices de segmento).
- `lado`: `-1` esquerda, `1` direita.
- `afastamento`: distância entre a pista e o ramal no miolo. Nas pontas ele vale zero: a pista alarga, o ramal descola, corre separado e volta a fundir.
- `largura`: largura do ramal (mais estreito que a pista).
- `ganho`: multiplicador do avanço de quem está no ramal. `1.2` = corta 20% do caminho (linha de dentro). Ramificação "segura e longa" pode ter `ganho < 1` com largura maior.

Regras:
- **Sem checkpoint e sem teleporte.** Entrar e sair é dirigir. Entre a pista e o ramal é grama: quem cai ali perde velocidade como em qualquer fora de pista.
- O bico da divisão tem barreira e cones. Bater ali é batida de corrida comum (perde velocidade, não reseta).
- O ramal **compartilha o `z`** da pista. Rival, bot e jogador remoto no ramal são só um `x` maior que 1. Por isso minimapa, placar, dead reckoning e contagem de voltas não mudam, e o multiplayer funciona sem mexer no protocolo.
- Bots podem pegar o ramal (chance por perfil) e levam o mesmo `ganho`.
- Trânsito comum não entra no ramal.

### 3. Escolha da pista
- Corrida com bots: seletor no lobby (circuitos fixos e "aleatória").
- Sala online: a pista vai **codificada na seed** (`seed % 8`: `0` = aleatória, `1..N` = circuito). O dono manda a seed na criação da sala; a API passa a aceitar `seed` opcional no `POST /autodash/race`. Não há migration: a coluna `seed` já existe. Sala criada por cliente antigo (seed sorteada no servidor) cai pelo mesmo cálculo: `0` é a pista procedural, o resto um circuito. Todos os pilotos da sala veem a mesma pista.

### 4. Reconhecimento de percurso
- O lobby mostra o traçado do circuito escolhido (com os ramais), extensão, número de curvas fechadas, ramais e bioma.
- "Reconhecer" faz um sobrevoo: a câmera percorre uma volta sozinha, sem rivais e sem tempo, com o mapa e o nome de cada trecho marcado. Qualquer tecla volta ao lobby.

## Alternativa rejeitada: ramo com geometria própria
Um ramo com sua própria lista de segmentos (curvas e morros diferentes da pista) é o desenho "verdadeiro" de bifurcação. Foi rejeitado **por agora** porque:
- cada entidade teria que saber em qual fita está (tráfego, obstáculos, bots, rivais de rede);
- a telemetria de rede precisaria de um campo novo e de conversão de `z` entre fitas;
- o render da pista precisaria de uma visão composta de segmentos, mexendo no laço mais sensível do jogo (e no golden master).

O ramal paralelo entrega a decisão de corrida (risco estreito e curto contra seguro e largo) com uma fração do risco. Se o playtest pedir bifurcação com geometria própria, ela entra como evolução deste ADR, reaproveitando `ramais` como dado.

## Consequências
- O "atalho" é sempre visível da pista (corre ao lado). Não existe atalho escondido atrás de um morro nesta versão.
- O `ganho` é um multiplicador de avanço, não geometria: no ramal o cenário passa mais rápido para a mesma velocidade no velocímetro. É a leitura de "linha de dentro". O valor é dado, calibrado no playtest.
- Circuitos novos são só dados. Um teste unitário garante que cada circuito fecha o loop, tem tamanho razoável e que as marcas dos ramais existem.
- Golden master: as cenas de corrida passam a largar no primeiro circuito fixo (padrão do lobby), então o snapshot delas muda em commit próprio.
