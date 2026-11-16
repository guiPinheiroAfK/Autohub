// AutoDash — render/ramal.ts. Desenho do ramal paralelo (atalho) na pista (ADR 0014).
// Chamado por render/road.ts para cada segmento visível, só quando a pista tem ramais.
import { type AutoDashEngine } from "../engine"
import { ramalPerfil, ramalPerfilOuZero, ramalBordas } from "../world/ramais"
import { postoMeio, POSTO_FAIXA, POSTO_ILHA, BOMBA_SEGS } from "../world/posto"
import { poly } from "./primitives"

/**
 * Asfalto, zebras e faixa do ramal neste segmento. `sx/sw/ry` são a projeção das
 * duas bordas do segmento (1 = perto, 2 = longe), iguais às do asfalto principal.
 */
export function drawRamalSeg(
  eng: AutoDashEngine, idx: number,
  sx1: number, sw1: number, ry1: number, sx2: number, sw2: number, ry2: number,
  alt: boolean, roadL: string, roadD: string, rumbA: string, rumbB: string, laneC: string,
) {
  const ctx = eng.ctx
  for (const r of eng.ramais) {
    const p1 = ramalPerfil(r, idx)
    if (!p1) continue
    const p2 = ramalPerfilOuZero(r, idx + 1)
    const b1 = ramalBordas(r, p1), b2 = ramalBordas(r, p2)
    const L = r.lado
    // asfalto do ramal (cobre a zebra da pista enquanto corre colado)
    ctx.fillStyle = alt ? roadL : roadD
    poly(ctx,
      sx1 + L * sw1 * b1.inner, ry1, sx1 + L * sw1 * b1.outer, ry1,
      sx2 + L * sw2 * b2.outer, ry2, sx2 + L * sw2 * b2.inner, ry2)
    // zebra na borda de fora
    ctx.fillStyle = alt ? rumbA : rumbB
    poly(ctx,
      sx1 + L * sw1 * b1.outer, ry1, sx1 + L * sw1 * (b1.outer + 0.1 * p1.w), ry1,
      sx2 + L * sw2 * (b2.outer + 0.1 * p2.w), ry2, sx2 + L * sw2 * b2.outer, ry2)
    if (p1.f > 0.3) {
      // separado: zebra também na borda de dentro (do lado da grama)
      poly(ctx,
        sx1 + L * sw1 * (b1.inner - 0.09), ry1, sx1 + L * sw1 * b1.inner, ry1,
        sx2 + L * sw2 * b2.inner, ry2, sx2 + L * sw2 * (b2.inner - 0.09), ry2)
    } else if (alt && p1.w >= 1) {
      // colado: tracejado separando a faixa de entrada da pista
      ctx.fillStyle = laneC
      poly(ctx,
        sx1 + L * sw1 * 0.975, ry1, sx1 + L * sw1 * 0.995, ry1,
        sx2 + L * sw2 * 0.995, ry2, sx2 + L * sw2 * 0.975, ry2)
    }
    // pátio do posto (Fase 8.2): ilha de concreto entre as duas faixas de bomba,
    // com a guia amarela; fora da ilha, o tracejado que separa as faixas
    if (r.posto && p1.f >= 0.999 && p2.f >= 0.999) {
      const m = postoMeio(r)
      const a = b1.inner + POSTO_FAIXA, c = a + POSTO_ILHA
      const a2 = b2.inner + POSTO_FAIXA, c2 = a2 + POSTO_ILHA
      if (Math.abs(idx - m) <= BOMBA_SEGS) {
        ctx.fillStyle = "rgba(226,232,240,0.55)"
        poly(ctx, sx1 + L * sw1 * a, ry1, sx1 + L * sw1 * c, ry1, sx2 + L * sw2 * c2, ry2, sx2 + L * sw2 * a2, ry2)
        ctx.fillStyle = "rgba(250,204,21,0.75)"
        poly(ctx, sx1 + L * sw1 * a, ry1, sx1 + L * sw1 * (a + 0.012), ry1, sx2 + L * sw2 * (a2 + 0.012), ry2, sx2 + L * sw2 * a2, ry2)
        poly(ctx, sx1 + L * sw1 * (c - 0.012), ry1, sx1 + L * sw1 * c, ry1, sx2 + L * sw2 * c2, ry2, sx2 + L * sw2 * (c2 - 0.012), ry2)
      } else if (alt) {
        const d = (a + c) / 2, d2 = (a2 + c2) / 2
        ctx.fillStyle = laneC
        poly(ctx, sx1 + L * sw1 * (d - 0.01), ry1, sx1 + L * sw1 * (d + 0.01), ry1, sx2 + L * sw2 * (d2 + 0.01), ry2, sx2 + L * sw2 * (d2 - 0.01), ry2)
      }
    }
  }
}
