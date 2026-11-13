# ADR 0006 — Galeria de fotos local no IndexedDB

**Status:** Aceito

## Contexto
A galeria de fotos de uma fase ou veículo tem muitas imagens. Enviar todas para o Cloudinary não é o caso de uso principal, e o tier gratuito tem limite (ADR 0004).

## Decisão
A galeria de fotos fica no IndexedDB do navegador (`web-garagem/src/lib/fotos.ts`). Fica no aparelho, não sincroniza entre dispositivos.

## Consequências
- Trocar de aparelho ou limpar os dados do navegador apaga as fotos.
- Para compartilhar uma foto publicamente, o fluxo usa o Cloudinary (ADR 0005). Ou seja: a foto local e a foto publicada são coisas diferentes.
- Se a sincronização entre dispositivos virar requisito, é uma decisão nova, com custo de storage a avaliar.
