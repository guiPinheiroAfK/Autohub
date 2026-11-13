# ADR 0011 — Biomas do AutoDash como dados e camadas de cenário

**Status:** Proposto (Fase 0 do ciclo v2)

## Contexto
O cenário do AutoDash é um único tema urbano, desenhado em `render/backdrop.ts` (árvores, postes, outdoors e prédios) com cor de céu fixa por ciclo (`SKY_KEYS`). Para o "mini Most Wanted" o usuário quer vários biomas (cidade tipo Tokyo, costa, deserto, floresta, neve e outros), cada um com seu fundo. Escrever um `if` por bioma dentro do render cresceria sem controle e misturaria dados com código.

## Decisão
- Um bioma é um **registro de dados**, não uma classe nem um ramo de código. Campos previstos:
  - `id`, `nome`
  - `paleta`: céu (por hora), névoa, cor do asfalto e da linha
  - `camadas`: lista de até três camadas de fundo (`longe`, `meio`, `perto`), cada uma com um tipo de desenho e parâmetros
  - `decoracao`: pesos de decoração (ex.: `arvore: 3, poste: 2, predio: 1`)
  - `climas`: climas permitidos (ADR 0013)
  - `geometria` (opcional): tipo de terreno (plano, colina, mar) para a fase de pistas
- A tabela `BIOMES` fica em `data.ts` (ou arquivo próprio `world/biomes.ts` se crescer). Solo e corrida leem o bioma pelo id, nunca pelo nome.
- Cada camada é uma função de desenho `(ctx, eng, bioma, t) => void` registrada por tipo. O backdrop percorre as camadas na ordem longe → meio → perto. Um tipo de camada novo é uma função nova, sem mexer no loop.
- A troca de bioma é por corrida (solo e corrida). Mudança no meio da corrida não entra nesta versão.

## Consequências
- Adicionar um bioma é preencher um registro e, se faltar um tipo de camada, escrever uma função. Não há `if (bioma === "neve")` no render.
- A camada `cidade` precisa reproduzir o visual atual. Por isso a conversão do urbano é a primeira coisa da Fase 1, e a única mudança no golden master deve ser a camada intencional.
- Desempenho: três camadas a mais por quadro. Antes de implementar cache offscreen, medir o custo (regra do GUIA: perfilar antes de otimizar).
- Nada de assets externos. Continua tudo em Canvas 2D, como no ADR 0007.
