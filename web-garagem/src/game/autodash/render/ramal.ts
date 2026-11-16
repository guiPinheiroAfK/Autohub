// AutoDash — render/ramal.ts. Desenho do ramal paralelo (atalho) na pista (ADR 0014).
// Chamado por render/road.ts para cada segmento visível, só quando a pista tem ramais.
import { type AutoDashEngine } from "../engine"
import { ramalPerfil, ramalPerfilOuZero, ramalBordas, elevacao, type Ramal } from "../world/ramais"
import { postoMeio, POSTO_FAIXA, POSTO_ILHA, BOMBA_SEGS } from "../world/posto"
import { poly } from "./primitives"
import { shade } from "../math"

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
    // trecho alto do elevado: vira sprite (drawElevadoSeg), por cima da pista
    if (r.alto && (elevacao(r, idx) > 0 || elevacao(r, idx + 1) > 0)) continue
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

const MURO_ALT = 1300

/** Segmento do elevado já projetado (montado em render/road.ts, desenhado de trás para frente). */
export interface ElevadoSeg {
  r: Ramal; idx: number
  // bordas (tela) perto/longe: x de dentro e de fora, y do tabuleiro e do chão, escala
  xi1: number; xo1: number; xi2: number; xo2: number
  yd1: number; yd2: number; yg1: number; yg2: number
  s1: number; s2: number
  h1: number; h2: number // altura do tabuleiro (mundo) perto/longe
  camAcima: boolean // câmera acima do tabuleiro: vê o asfalto; abaixo, vê o fundo da laje
  alt: boolean
}

/**
 * Elevado do viaduto (Fase 8.6): tabuleiro, mureta dos dois lados, parede de
 * concreto do lado da pista e pilares a cada 10 segmentos. Visto de baixo
 * aparece o fundo da laje em vez do asfalto.
 */
export function drawElevadoSeg(eng: AutoDashEngine, e: ElevadoSeg, amb: number, roadL: string, roadD: string, laneC: string) {
  const ctx = eng.ctx
  const esp1 = 260 * e.s1, esp2 = 260 * e.s2   // espessura da laje (unidades de mundo × escala)
  const mur1 = 210 * e.s1, mur2 = 210 * e.s2   // altura da mureta
  const conc = shade("#9aa3b5", amb), concEsc = shade("#6b7488", amb), concClaro = shade("#c3cad6", amb)
  // pilar (atrás da parede): do chão até o fundo da laje, no meio do tabuleiro
  if (e.idx % 10 === 0 && e.h1 >= MURO_ALT && e.yg1 - (e.yd1 + esp1) > 2) {
    const cx = (e.xi1 + e.xo1) / 2, pw = Math.max(2, (e.xo1 - e.xi1) * 0.22)
    ctx.fillStyle = concEsc
    ctx.fillRect(cx - pw / 2, e.yd1 + esp1, pw, e.yg1 - (e.yd1 + esp1))
    ctx.fillStyle = conc
    ctx.fillRect(cx - pw / 2, e.yd1 + esp1, pw * 0.6, e.yg1 - (e.yd1 + esp1))
  }
  // parede do lado de dentro (a que a pista vê): do tabuleiro até o chão na
  // subida; no alto, só a face da laje
  // começo da rampa (até MURO_ALT): aterro com muro até o chão; mais alto: só a
  // face da laje, com os pilares por baixo
  const baixo1 = e.h1 < MURO_ALT ? e.yg1 : e.yd1 + esp1
  const baixo2 = e.h2 < MURO_ALT ? e.yg2 : e.yd2 + esp2
  ctx.fillStyle = conc
  poly(ctx, e.xi1, e.yd1, e.xi1, baixo1, e.xi2, baixo2, e.xi2, e.yd2)
  if (!e.camAcima) {
    // fundo da laje (visto de baixo)
    ctx.fillStyle = concEsc
    poly(ctx, e.xi1, e.yd1 + esp1, e.xo1, e.yd1 + esp1, e.xo2, e.yd2 + esp2, e.xi2, e.yd2 + esp2)
    ctx.fillStyle = conc
    poly(ctx, e.xi1, e.yd1, e.xi1, e.yd1 + esp1, e.xi2, e.yd2 + esp2, e.xi2, e.yd2)
  } else {
    // asfalto do tabuleiro e as linhas de borda
    ctx.fillStyle = e.alt ? roadL : roadD
    poly(ctx, e.xi1, e.yd1, e.xo1, e.yd1, e.xo2, e.yd2, e.xi2, e.yd2)
    ctx.fillStyle = laneC
    const l1 = (e.xo1 - e.xi1) * 0.03, l2 = (e.xo2 - e.xi2) * 0.03
    poly(ctx, e.xi1 + l1, e.yd1, e.xi1 + 2 * l1, e.yd1, e.xi2 + 2 * l2, e.yd2, e.xi2 + l2, e.yd2)
    poly(ctx, e.xo1 - 2 * l1, e.yd1, e.xo1 - l1, e.yd1, e.xo2 - l2, e.yd2, e.xo2 - 2 * l2, e.yd2)
  }
  // muretas (New Jersey) dos dois lados, com junta de dilatação a cada 6 segmentos
  ctx.fillStyle = e.idx % 6 === 0 ? concEsc : concClaro
  poly(ctx, e.xi1, e.yd1 - mur1, e.xi1 + (e.xo1 - e.xi1) * 0.05, e.yd1, e.xi2 + (e.xo2 - e.xi2) * 0.05, e.yd2, e.xi2, e.yd2 - mur2)
  poly(ctx, e.xo1 - (e.xo1 - e.xi1) * 0.05, e.yd1, e.xo1, e.yd1 - mur1, e.xo2, e.yd2 - mur2, e.xo2 - (e.xo2 - e.xi2) * 0.05, e.yd2)
  // poste de luz na mureta de fora (aceso à noite)
  if (e.idx % 16 === 0) {
    const ph = 900 * e.s1
    ctx.fillStyle = concEsc
    ctx.fillRect(e.xo1 - 1, e.yd1 - mur1 - ph, Math.max(1, 30 * e.s1), ph)
    if (amb < 0.62) {
      ctx.fillStyle = "rgba(255,236,170,0.9)"
      ctx.fillRect(e.xo1 - 120 * e.s1, e.yd1 - mur1 - ph, 120 * e.s1, Math.max(1, 30 * e.s1))
    }
  }
}
