// AutoDash — render/tunel.ts. Desenho do túnel (Fase 8.7, world/tunel.ts).
// Cada segmento do túnel é um sprite (como o elevado): paredes com azulejo
// embaixo, teto, luzes em fila. Desenhados de trás para frente com os carros,
// então os carros lá dentro ficam por cima das paredes de trás e por baixo das
// da frente. A boca tem a montanha em volta; por dentro, o primeiro segmento
// cobre a tela fora do tubo (o teto acima da câmera).
import { type AutoDashEngine, W, H } from "../engine"
import { poly } from "./primitives"
import { shade } from "../math"

/** Um segmento do túnel já projetado: paredes em x, chão e teto em y, perto (1) e longe (2). */
export interface TunelSeg {
  idx: number
  xl1: number; xr1: number; xl2: number; xr2: number
  yb1: number; yb2: number; yt1: number; yt2: number
  boca: boolean      // primeiro segmento visto de fora: desenha a montanha e a boca
  cobre: boolean     // primeiro segmento visto de dentro: cobre a tela fora do tubo
  saida: boolean     // último segmento: a boca de saída (a luz no fim do túnel)
}

const AZULEJO = 0.42 // fração da parede com azulejo claro (de baixo para cima)

export function drawTunelSeg(eng: AutoDashEngine, t: TunelSeg, amb: number) {
  const ctx = eng.ctx
  // a luz do túnel é a dele, não a do céu: piso de 0,5 para não sumir à noite
  const luz = Math.max(0.5, Math.min(0.8, amb))
  const azul = shade("#b8c0cc", luz), azulEsc = shade("#9aa3b0", luz)
  const parede = shade("#454c58", luz), teto = shade("#2c323c", luz)
  const faixa = t.idx % 2 === 0 ? azul : azulEsc
  const meio1 = t.yb1 - (t.yb1 - t.yt1) * AZULEJO, meio2 = t.yb2 - (t.yb2 - t.yt2) * AZULEJO
  // paredes: azulejo embaixo, concreto em cima
  for (const [x1, x2] of [[t.xl1, t.xl2], [t.xr1, t.xr2]]) {
    ctx.fillStyle = faixa
    poly(ctx, x1, t.yb1, x1, meio1, x2, meio2, x2, t.yb2)
    ctx.fillStyle = parede
    poly(ctx, x1, meio1, x1, t.yt1, x2, t.yt2, x2, meio2)
  }
  // teto
  ctx.fillStyle = teto
  poly(ctx, t.xl1, t.yt1, t.xr1, t.yt1, t.xr2, t.yt2, t.xl2, t.yt2)
  // luzes em fila nos dois cantos do teto, a cada 3 segmentos
  if (t.idx % 3 === 0) {
    const w1 = t.xr1 - t.xl1, w2 = t.xr2 - t.xl2
    ctx.fillStyle = "#ffe8a3"
    for (const f of [0.14, 0.8]) {
      poly(ctx, t.xl1 + w1 * f, t.yt1, t.xl1 + w1 * (f + 0.06), t.yt1, t.xl2 + w2 * (f + 0.06), t.yt2, t.xl2 + w2 * f, t.yt2)
    }
    // brilho das luzes na parede
    ctx.fillStyle = "rgba(255,226,150,0.10)"
    poly(ctx, t.xl1, meio1, t.xl1, t.yt1, t.xl2, t.yt2, t.xl2, meio2)
    poly(ctx, t.xr1, meio1, t.xr1, t.yt1, t.xr2, t.yt2, t.xr2, meio2)
  }
  // placa de saída de emergência (verde) na parede da direita, de vez em quando
  if (t.idx % 40 === 20 && t.xr1 - t.xl1 > 40) {
    const h = (t.yb1 - t.yt1) * 0.12, w = h * 1.6
    ctx.fillStyle = "#16a34a"
    ctx.fillRect(t.xr1 - w * 1.3, meio1 - h * 1.6, w, h)
    ctx.fillStyle = "#f0fdf4"
    ctx.fillRect(t.xr1 - w * 1.15, meio1 - h * 1.3, w * 0.25, h * 0.4)
  }
  if (t.cobre) {
    // de dentro: tudo fora do tubo deste segmento é parede e teto (acima da câmera)
    ctx.fillStyle = parede
    ctx.beginPath()
    ctx.moveTo(-10, -10); ctx.lineTo(W + 10, -10); ctx.lineTo(W + 10, t.yb1)
    ctx.lineTo(t.xr1, t.yb1); ctx.lineTo(t.xr1, t.yt1); ctx.lineTo(t.xl1, t.yt1)
    ctx.lineTo(t.xl1, t.yb1); ctx.lineTo(-10, t.yb1); ctx.closePath(); ctx.fill()
    ctx.fillStyle = teto
    ctx.beginPath()
    ctx.moveTo(-10, -10); ctx.lineTo(W + 10, -10); ctx.lineTo(t.xr1, t.yt1); ctx.lineTo(t.xl1, t.yt1); ctx.closePath(); ctx.fill()
  }
  if (t.boca) drawBoca(eng, t, amb)
  // a luz do fim do túnel: a boca de saída brilha (de dia forte, de noite fraca)
  if (t.saida) {
    const cx = (t.xl2 + t.xr2) / 2, cy = (t.yt2 + t.yb2) / 2, rr = Math.max(4, (t.xr2 - t.xl2) * 0.9)
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, rr)
    const a = 0.25 + 0.5 * amb
    g.addColorStop(0, `rgba(255,250,230,${a})`); g.addColorStop(1, "rgba(255,250,230,0)")
    ctx.fillStyle = g
    ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2)
  }
}

/** A montanha em volta da boca e o pórtico de concreto, vistos de fora. */
function drawBoca(eng: AutoDashEngine, t: TunelSeg, amb: number) {
  const ctx = eng.ctx
  const larg = t.xr1 - t.xl1, cx = (t.xl1 + t.xr1) / 2, alto = t.yb1 - t.yt1
  const topo = t.yt1 - alto * 2.4
  // montanha: um morro largo com a boca recortada (evenodd)
  const g = ctx.createLinearGradient(0, topo, 0, t.yb1)
  g.addColorStop(0, shade("#3f6b3a", amb)); g.addColorStop(0.45, shade("#4b5a3c", amb)); g.addColorStop(1, shade("#5b5346", amb))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(cx - larg * 3.6, t.yb1)
  ctx.bezierCurveTo(cx - larg * 2.6, topo + alto * 0.9, cx - larg * 1.4, topo, cx - larg * 0.4, topo + alto * 0.15)
  ctx.bezierCurveTo(cx + larg * 0.4, topo - alto * 0.2, cx + larg * 1.6, topo + alto * 0.3, cx + larg * 2.4, topo + alto * 1.2)
  ctx.bezierCurveTo(cx + larg * 3.0, topo + alto * 2.2, cx + larg * 3.4, t.yb1 - alto * 0.3, cx + larg * 3.8, t.yb1)
  ctx.closePath()
  ctx.moveTo(t.xl1, t.yb1); ctx.lineTo(t.xl1, t.yt1); ctx.lineTo(t.xr1, t.yt1); ctx.lineTo(t.xr1, t.yb1); ctx.closePath()
  ctx.fill("evenodd")
  // pórtico: moldura de concreto em volta da boca e a placa com o nome
  const m = larg * 0.06
  ctx.fillStyle = shade("#a8afbb", amb)
  ctx.fillRect(t.xl1 - m, t.yt1 - m * 1.6, larg + 2 * m, m * 1.6)
  ctx.fillRect(t.xl1 - m, t.yt1, m, alto)
  ctx.fillRect(t.xr1, t.yt1, m, alto)
  if (larg > 80) {
    ctx.fillStyle = shade("#1e3a8a", Math.max(0.55, amb))
    const pw = larg * 0.36, ph = m * 1.2
    ctx.fillRect(cx - pw / 2, t.yt1 - m * 1.4, pw, ph)
    ctx.fillStyle = "#f8fafc"
    ctx.font = `bold ${Math.max(8, Math.round(ph * 0.62))}px 'Space Grotesk', 'Segoe UI', sans-serif`
    ctx.textAlign = "center"
    ctx.fillText("TÚNEL DA SERRA", cx, t.yt1 - m * 1.4 + ph * 0.74)
    ctx.textAlign = "left"
  }
}

/** Placa de aproximação do túnel: quadrado azul com a boca desenhada. */
export function drawPlacaTunel(ctx: CanvasRenderingContext2D, x: number, cy: number, r: number, amb: number) {
  const s = r * 1.9
  ctx.fillStyle = shade("#1d4ed8", Math.max(0.55, amb))
  ctx.fillRect(x - s / 2, cy - s / 2, s, s)
  if (r > 5) {
    ctx.fillStyle = shade("#f8fafc", Math.max(0.6, amb))
    ctx.beginPath()
    ctx.moveTo(x - r * 0.65, cy + r * 0.6); ctx.lineTo(x - r * 0.65, cy)
    ctx.arc(x, cy, r * 0.65, Math.PI, 0)
    ctx.lineTo(x + r * 0.65, cy + r * 0.6); ctx.closePath()
    ctx.moveTo(x - r * 0.35, cy + r * 0.6); ctx.lineTo(x - r * 0.35, cy + r * 0.05)
    ctx.arc(x, cy + r * 0.05, r * 0.35, Math.PI, 0)
    ctx.lineTo(x + r * 0.35, cy + r * 0.6); ctx.closePath()
    ctx.fill("evenodd")
  }
}

/** Clarão ao sair do túnel (o olho ainda acostumado ao escuro). */
export function drawClarao(eng: AutoDashEngine, t: number, total: number) {
  if (t <= 0) return
  eng.ctx.fillStyle = `rgba(255,252,235,${0.6 * (t / total)})`
  eng.ctx.fillRect(-10, -10, W + 20, H + 20)
}
