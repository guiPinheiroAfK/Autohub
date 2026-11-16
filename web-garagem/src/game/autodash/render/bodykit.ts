// AutoDash — render/bodykit.ts. Desenho das peças estéticas da Fase 7 no carro
// visto de trás (chamado por drawPlayerCar em render/primitives.ts). Os dados
// ficam em cosmetic/bodykit.ts.
//
// Coordenadas: as de drawPlayerCar, origem no centro do eixo traseiro no chão,
// `w` largura do carro, `h` altura, `bx = -w/2`. Peça no índice 0 (padrão) não
// desenha nada além do desenho de antes: o golden master do carro padrão não muda.
import type { CarCustom } from "../data"
import { aroDe, alturaDe, kitDe } from "../cosmetic/bodykit"
import { shade } from "../math"
import { rr } from "./primitives"

/**
 * Pneus e aros. Com aro padrão e sem cambagem, são exatamente as mesmas
 * chamadas de antes (por isso o ramo padrão fica escrito à parte).
 */
export function desenharRodas(ctx: CanvasRenderingContext2D, w: number, h: number, bx: number, rim: string, custom: CarCustom) {
  const aro = aroDe(custom), alt = alturaDe(custom)
  if (custom.aro === undefined || custom.aro === 0) {
    if (alt.cambagem === 0) {
      ctx.fillStyle = "#0a0a0c"
      rr(ctx, bx - w * 0.05, -h * 0.36, w * 0.10, h * 0.36, w * 0.025)
      rr(ctx, bx + w - w * 0.05, -h * 0.36, w * 0.10, h * 0.36, w * 0.025)
      ctx.fillStyle = rim
      rr(ctx, bx - w * 0.038, -h * 0.26, w * 0.024, h * 0.16, w * 0.012)
      rr(ctx, bx + w + w * 0.014, -h * 0.26, w * 0.024, h * 0.16, w * 0.012)
      return
    }
  }
  for (const lado of [-1, 1]) {
    const cx = lado < 0 ? bx : bx + w // centro do pneu
    ctx.save()
    if (alt.cambagem > 0) {
      // stance: gira em volta do ponto de apoio, topo para dentro do carro
      ctx.translate(cx, 0)
      ctx.rotate(-lado * alt.cambagem)
      ctx.translate(-cx, 0)
    }
    ctx.fillStyle = "#0a0a0c"
    rr(ctx, cx - w * 0.05, -h * 0.36, w * 0.10, h * 0.36, w * 0.025)
    // aba do aro na face de fora do pneu
    const aw = w * aro.aba
    const ax = lado < 0 ? cx - w * 0.038 : cx + w * 0.038 - aw
    ctx.fillStyle = rim
    rr(ctx, ax, -h * 0.26, aw, h * 0.16, w * 0.012)
    if (aro.raios === 0) {
      // turbofan: tampa fechada, com um vinco escuro no meio da aba
      ctx.fillStyle = shade(rim, 0.6)
      ctx.fillRect(ax + aw * 0.4, -h * 0.25, aw * 0.2, h * 0.14)
    } else if (aro.aba >= 0.04) {
      // aro fundo: brilho na borda polida
      ctx.fillStyle = "rgba(255,255,255,0.45)"
      ctx.fillRect(lado < 0 ? ax : ax + aw - w * 0.006, -h * 0.25, w * 0.006, h * 0.14)
    }
    if (aro.pinca) {
      // pinça de freio aparecendo por dentro da aba
      ctx.fillStyle = "#dc2626"
      rr(ctx, lado < 0 ? ax + aw : ax - w * 0.012, -h * 0.22, w * 0.012, h * 0.08, w * 0.004)
    }
    ctx.restore()
  }
}

/**
 * Rebaixamento, parte 1 (antes da carroceria): a borda do para-lama desce
 * sobre o topo do pneu, que fica "engolido". Desenhada antes da silhueta, então
 * a carroceria cobre o lado de dentro e só o lábio sobre o pneu aparece.
 */
export function labioRebaixado(ctx: CanvasRenderingContext2D, w: number, h: number, bx: number, dark: string, custom: CarCustom) {
  const alt = alturaDe(custom)
  if (alt.desce <= 0) return
  ctx.fillStyle = dark
  const lh = h * (0.07 + alt.desce * 1.6)
  rr(ctx, bx - w * 0.062, -h * 0.385, w * 0.124, lh, w * 0.03)
  rr(ctx, bx + w - w * 0.062, -h * 0.385, w * 0.124, lh, w * 0.03)
}

/**
 * Rebaixamento, parte 2: a carroceria encolhe na vertical com o chão fixo
 * (teto mais baixo em relação às rodas). Devolve true se abriu um `save`, que o
 * chamador fecha com `ctx.restore()` no fim do desenho da carroceria.
 */
export function abaixarCarroceria(ctx: CanvasRenderingContext2D, custom: CarCustom): boolean {
  const alt = alturaDe(custom)
  if (alt.desce <= 0) return false
  ctx.save()
  ctx.scale(1, 1 - alt.desce)
  return true
}

/** Widebody: alargadores na cor da pintura por cima dos pneus, com rebites. */
export function alargadores(ctx: CanvasRenderingContext2D, w: number, h: number, bx: number, body: string, dark: string, custom: CarCustom) {
  if (!kitDe(custom).widebody) return
  for (const cx of [bx - w * 0.005, bx + w + w * 0.005]) {
    ctx.fillStyle = body
    ctx.beginPath(); ctx.ellipse(cx, -h * 0.27, w * 0.085, h * 0.15, 0, Math.PI, Math.PI * 2); ctx.fill()
    ctx.fillRect(cx - w * 0.085, -h * 0.27, w * 0.17, h * 0.05)
    ctx.fillStyle = dark
    ctx.fillRect(cx - w * 0.085, -h * 0.225, w * 0.17, h * 0.012)
    // rebites
    ctx.fillStyle = "rgba(226,232,240,0.7)"
    for (const f of [-0.6, 0, 0.6]) ctx.fillRect(cx + f * w * 0.07, -h * 0.36 + Math.abs(f) * h * 0.06, w * 0.008, w * 0.008)
  }
}

/** Saias laterais e difusor, na base da traseira (desenhados antes das lanternas). */
export function saiasEDifusor(ctx: CanvasRenderingContext2D, w: number, h: number, bx: number, dark: string, custom: CarCustom) {
  const kit = kitDe(custom)
  if (kit.saias) {
    ctx.fillStyle = dark
    // ponta das saias saindo um pouco para fora nas quinas de baixo
    rr(ctx, bx - w * 0.025, -h * 0.085, w * 0.15, h * 0.06, w * 0.015)
    rr(ctx, bx + w - w * 0.125, -h * 0.085, w * 0.15, h * 0.06, w * 0.015)
    // lábio do para-choque
    ctx.fillStyle = "#16161a"
    ctx.fillRect(bx + w * 0.04, -h * 0.03, w * 0.92, h * 0.03)
  }
  if (kit.difusor) {
    ctx.fillStyle = "#111318"
    ctx.beginPath()
    ctx.moveTo(-w * 0.27, 0); ctx.lineTo(-w * 0.22, -h * 0.11)
    ctx.lineTo(w * 0.22, -h * 0.11); ctx.lineTo(w * 0.27, 0)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = "#3f3f46"
    for (let i = -2; i <= 2; i++) ctx.fillRect(i * w * 0.09 - w * 0.004, -h * 0.105, w * 0.008, h * 0.105)
  }
}

/** Asa alta ("pescoço de cisne"): plano bem acima do teto, preso por cima. */
export function asaAlta(ctx: CanvasRenderingContext2D, w: number, h: number, bx: number, by: number) {
  // suportes presos por cima do plano
  ctx.fillRect(bx + w * 0.22, by - h * 0.10, w * 0.035, h * 0.24)
  ctx.fillRect(bx + w * 0.745, by - h * 0.10, w * 0.035, h * 0.24)
  // plano principal e flap
  rr(ctx, bx - w * 0.06, by - h * 0.13, w * 1.12, h * 0.065, w * 0.03)
  rr(ctx, bx - w * 0.02, by - h * 0.165, w * 1.04, h * 0.04, w * 0.02)
  // placas laterais
  ctx.fillRect(bx - w * 0.07, by - h * 0.18, w * 0.025, h * 0.15)
  ctx.fillRect(bx + w * 1.045, by - h * 0.18, w * 0.025, h * 0.15)
}
