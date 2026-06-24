# AutoHubGaragem

Front-end (sem back-end) do módulo "Garagem → Veículo → Fase → Item" do
AutoHubGaragem — projeto independente do FrotaOS, sem nenhum tipo, tabela
ou backend compartilhado entre os dois.

Visual e tipografia (Inter + Space Grotesk, paleta escura roxo/âmbar/verde)
portados diretamente do build tracker HTML que serviu de referência. Dados
mockados: o build real do RX-8 K24 (Mazda RX-8 + motor Honda K24 + câmbio
BMW ZF6, com fases até a etapa de turbo) e um segundo veículo simples
("Civic do dia a dia") só pra provar a listagem com múltiplos projetos.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 (tokens próprios — sem shadcn aqui, o visual é bem
  específico/bespoke, não dashboard administrativo)
- react-router-dom
- lucide-react

## Como rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run lint     # oxlint
```

## Schema (src/types/index.ts)

```
Usuario
  └─ Garagem (1:N)
       └─ Veiculo (1:N)
            ├─ Fase (1:N)         — etapa do build
            │    └─ Item (1:N)    — componente/serviço estimado
            │         └─ Despesa (0:N)  — compra real registrada
            ├─ Documento (0:N)    — manual, recibo, NF, CRLV
            └─ Fornecedor (referenciado por Item/Despesa)
```

- `Item` guarda a **estimativa** (faixa de preço); `Despesa` guarda o
  **gasto real** — separados de propósito pra dar TCO de verdade depois.
- `Moeda` é `BRL | USD | PYG` — o build real do Gui já mistura USD (peças
  CDE) com BRL (mão de obra local), então isso não é feature especulativa.
- `ilustracaoTipo` em `Fase` é reservado pra diagramas SVG custom — só faz
  sentido pra builds "vitrine" (o do Gui), não para todo veículo cadastrado
  por qualquer usuário (ver decisão sobre fotos vs. diagramas no chat).

## Páginas

- `/` — visão geral da garagem (grid de veículos/projetos)
- `/veiculo/:id` — página do build: hero + métricas + fases em accordion
