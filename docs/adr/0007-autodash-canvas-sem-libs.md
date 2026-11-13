# ADR 0007 — AutoDash em Canvas 2D e áudio WebAudio, sem bibliotecas

**Status:** Aceito

## Contexto
O AutoDash é uma corrida pseudo-3D (técnica de segmentos estilo OutRun). Começou como protótipo Java Swing (`legacy/autodash-java/`). Precisava rodar bem no navegador, com 60 fps e sem peso de bundle.

## Decisão
- Renderização em **Canvas 2D**, sem engine de jogo nem three.js. A projeção é feita manualmente, por segmentos.
- Áudio **sintetizado** com WebAudio (`audio.ts`), sem arquivos de som.
- Fonte do canvas: Space Grotesk.
- Persistência local em `localStorage` (`data.ts`).

## Consequências
- Sem dependências de jogo: o código do jogo é todo nosso, e o custo de bundle é pequeno.
- O engine virou arquivo grande (5.000+ linhas numa classe). A divisão em módulos está no plano de reorganização.
- Medição de performance importa: já houve otimização de rua de Tokyo (12.5 ms → 4.2 ms por frame).
- Testes visuais são manuais. A aba de preview do navegador não roda `requestAnimationFrame` quando está oculta, então a verificação é feita chamando `update()` e `render()` direto.
