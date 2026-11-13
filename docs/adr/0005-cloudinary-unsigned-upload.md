# ADR 0005 — Imagens via Cloudinary com upload unsigned

**Status:** Aceito

## Contexto
Fotos de veículos, banners e logos de loja precisam de armazenamento. Sem S3 (ADR 0004).

## Decisão
O browser envia a imagem direto ao Cloudinary com um *upload preset* unsigned. O preset e o nome da conta vêm de `VITE_CLOUDINARY_CLOUD_NAME` e `VITE_CLOUDINARY_UPLOAD_PRESET`. A URL resultante é salva no banco.

## Consequências
- Não há assinatura no backend: quem tem o preset pode enviar. Aceito porque o preset só permite upload de imagem, e o escopo é baixo.
- Essas variáveis são públicas por natureza (vão para o bundle). Não usar para nada que exija segredo.
- Limites do tier gratuito do Cloudinary valem para o projeto inteiro.
