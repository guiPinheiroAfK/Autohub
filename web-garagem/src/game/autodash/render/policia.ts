// AutoDash — render/policia.ts. Desenho da polícia por estrelas (Fase 6):
// HUD de estrelas. As regras moram em world/policia.ts.
import { AutoDashEngine, W } from "../engine"
import { glass } from "../ui/widgets"
import { clamp } from "../math"
import { estrelasDe, nivelDe, ESTRELAS, ESFRIA_S } from "../world/policia"

const FONTE = "'Space Grotesk', 'Segoe UI', sans-serif"

function estrela(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 === 0 ? r : r * 0.45
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

/**
 * Estrelas de procurado no topo da tela. Só aparece com calor (sem perseguição
 * nem esfriamento, nada é desenhado). Embaixo, o estado: te viram (giroflex
 * vermelho/azul), despistando (barra enchendo) ou esfriando (estrelas piscam).
 */
export function renderEstrelas(eng: AutoDashEngine) {
  const p = eng.policia
  if (p.calor <= 0) return
  const ctx = eng.ctx
  const n = estrelasDe(p.calor)
  const perseguindo = eng.traffic.some(t => t.role === "police" && !t.parked)
  const esfriando = !perseguindo
  const agora = performance.now()
  // à direita do retrovisor (288 px no centro do topo, só na perseguição) e
  // abaixo da barra do duelo
  const pw = 196, ph = 50
  const px = W / 2 + 156, py = eng.mode === "duel" ? 62 : 10
  const mx = px + pw / 2
  glass(eng, px, py, pw, ph, 12)

  // estrelas: cheias até n; a próxima mostra o progresso do calor
  const r = 11, gap = 30, x0 = mx - gap * 2, cy = py + 18
  const giro = Math.floor(agora / 180) % 2 === 0
  const piscaApaga = esfriando && Math.floor(agora / 300) % 2 === 0
  for (let i = 0; i < 5; i++) {
    const cx = x0 + i * gap
    estrela(ctx, cx, cy, r)
    ctx.fillStyle = "rgba(148,163,184,0.25)"
    ctx.fill()
    if (i < n) {
      if (piscaApaga && i === n - 1) continue // a que vai cair pisca
      ctx.fillStyle = esfriando ? "#94a3b8" : p.visto ? (giro ? "#f87171" : "#60a5fa") : "#fbbf24"
      estrela(ctx, cx, cy, r)
      ctx.fill()
    } else if (i === n && perseguindo) {
      // progresso para a próxima estrela: preenche de baixo para cima
      const f = p.calor - n
      if (f > 0.01) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(cx - r, cy + r - 2 * r * f, 2 * r, 2 * r * f)
        ctx.clip()
        ctx.fillStyle = "rgba(248,113,113,0.55)"
        estrela(ctx, cx, cy, r)
        ctx.fill()
        ctx.restore()
      }
    }
  }

  // linha de estado
  const by = py + 36, bw = pw - 28, bx = px + 14
  ctx.font = `bold 11px ${FONTE}`
  ctx.textAlign = "center"
  if (esfriando) {
    ctx.fillStyle = "#94a3b8"
    ctx.fillText("ESFRIANDO", mx, by + 4)
    ctx.fillStyle = "rgba(148,163,184,0.3)"
    ctx.fillRect(bx, by + 8, bw, 3)
    ctx.fillStyle = "#94a3b8"
    ctx.fillRect(bx, by + 8, bw * clamp(1 - p.esfriaT / ESFRIA_S, 0, 1), 3)
  } else if (p.visto) {
    ctx.fillStyle = giro ? "#f87171" : "#60a5fa"
    ctx.fillText("TE VIRAM", mx, by + 4)
  } else {
    const nivel = nivelDe(n) ?? ESTRELAS[0]
    ctx.fillStyle = "#4ade80"
    ctx.fillText("DESPISTANDO", mx, by + 4)
    ctx.fillStyle = "rgba(74,222,128,0.25)"
    ctx.fillRect(bx, by + 8, bw, 3)
    ctx.fillStyle = "#4ade80"
    ctx.fillRect(bx, by + 8, bw * clamp(eng.policeEscapeT / nivel.despisteS, 0, 1), 3)
  }
  ctx.textAlign = "left"
}


