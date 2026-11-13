# AutoDash v2 — "mini Most Wanted"

**Status:** Fases 0 a 3 implementadas, aguardando playtest. Status e commits no GUIA. Próxima: Fase 4.
**Guia vivo (fonte da verdade do ciclo):** [GUIA-V2.md](GUIA-V2.md). Esta spec detalha escopo, fases e critérios; decisões e log ficam no guia.

## 1. Escopo

Evoluir o modo corrida e a geração de mapa para um jogo de corrida mais completo, mantendo a estética atual (pseudo-3D em Canvas 2D, neon noturno, arcade).

Fases, uma por vez, com parada para o usuário testar no navegador:

| Fase | Tema | Mudança de jogo? |
|---|---|---|
| 0 | Planejamento: spec, ADRs 0011–0013, ideias | Não |
| 1 | Biomas em dados e camadas de cenário (cidade e costa) | Visual |
| 2 | Tração, pneus, câmbio e diferencial como dados e física | Física (carros novos) |
| 3 | Pistas fixas com atalhos e ramificações, lobby com reconhecimento de percurso | Corrida |
| 4 | Relógio em ticks e clima que altera a física | Física e visual |
| 5 | Eventos novos: convite de racha e combustível | Eventos |
| 6 | Polícia por estrelas (nível de procurado) | IA e eventos |
| 7 | Customização estética: bodykit, som, efeitos, câmera | Visual |

## 2. Não-escopo (por agora)

- Tuning de motor, turbo ou suspensão que mude velocidade. Fica como ideia "encaminhada" (apenas stub de dados).
- Peças de performance. Remap aparece só como item de design futuro.
- Backend em Rust. Ideia futura; a infra segue com custo zero (ADR 0004).
- WebSocket. Multiplayer continua por polling (ADR 0009).
- Moeda do jogo. Em aberto (ver GUIA, seção 7). Não implementar sem decisão.
- Mundo aberto contínuo. A corrida continua separada do solo.

## 3. Fases e critérios de aceite

### Fase 0 — Planejamento
- Esta spec, GUIA-V2 revisado, ADR 0011 (biomas), ADR 0012 (física), ADR 0013 (relógio e clima).
- Lista de 10 ideias de rodadas e drift no GUIA, seção 9.
- **Aceite:** usuário lê e aprova os ADRs. Nenhum código de jogo muda.

### Fase 1 — Biomas e camadas
- Tabela de dados `BIOMES` (nome, paleta, camadas, pesos de decoração, clima permitido).
- Cenário urbano atual vira o bioma `cidade`, com três camadas: longe, meio e perto.
- Bioma `costa` usando o mesmo sistema: horizonte com mar, palmeiras, píer.
- Solo e corrida leem o bioma da tabela (nada de `if (bioma === ...)` espalhado).
- **Aceite:** golden master muda somente pela camada intencional, em commit próprio com justificativa. No navegador: menu, corrida e troca de bioma funcionam. Sem queda de fps perceptível.

### Fase 2 — Tração, pneus e câmbio (dados e física)
- `CarSpec` ganha: `drive` (FWD, RWD, AWD), `frontBias` (fração do torque na dianteira, só AWD), `tyre`, `gearbox`, `finalDrive`.
- Física: limite de tração por eixo com transferência de carga, perda de potência do sistema de tração, pneu com aderência e tração próprias.
- Quatro carros de teste: FWD, RWD, AWD 50/50, AWD 30/70.
- Testes unitários da matemática de tração (funções puras).
- **Aceite:** o carro padrão (`gt`) continua idêntico no golden master. Os quatro carros de teste se comportam de forma perceptível no navegador.

### Fases 3 a 7
Detalhadas quando a fase anterior for aprovada (ver GUIA).

## 4. Restrições herdadas

- Comentários e ADRs em português. Commits em português, uma mudança por commit, com `Co-Authored-By`.
- `npm` em `web-garagem/`. Sem `bun.lock`.
- Teclas de debug (`O L B V J K I U`) continuam ativas.
- Verificação em cada commit: `npm run build`, `npm run lint`, `npm test`. Mudança visível: checar no navegador em `/autodash`.
- Golden master: snapshot só muda em commit próprio, com justificativa. Nunca atualizar snapshot para ficar verde.
- Meta de desempenho: 60 fps em celular, 144 fps no PC. Perfilar antes de otimizar.

## 5. Riscos

- **Churn do golden:** cada mudança visual muda o hash do canvas. Mitigação: mudanças visuais isoladas em commit próprio.
- **Desempenho:** camadas extras de fundo são mais desenho por quadro. Mitigação: cache de camadas em canvas offscreen (decidir na Fase 1 após medir).
- **Física que "parece errada":** o modelo de tração é simplificado. Mitigação: parâmetros em dados, ajuste pelo teste do usuário.

## 6. Documentos relacionados

- [GUIA-V2.md](GUIA-V2.md) — decisões, status e log.
- [ADR 0011](../../adr/0011-autodash-biomas-e-camadas.md) — biomas como dados e camadas.
- [ADR 0012](../../adr/0012-autodash-modelo-de-fisica.md) — tração, pneus, câmbio e clima como entrada da física.
- [ADR 0013](../../adr/0013-autodash-relogio-em-ticks.md) — relógio em ticks e clima.
- [ADR 0014](../../adr/0014-autodash-circuitos-e-ramais.md) — circuitos fixos, ramais e reconhecimento de percurso.
- [ADR 0007](../../adr/0007-autodash-canvas-sem-libs.md) e [ADR 0008](../../adr/0008-autodash-strategy-para-trafego.md) — base do engine atual.
