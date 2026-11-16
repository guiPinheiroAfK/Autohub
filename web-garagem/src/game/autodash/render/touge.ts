// AutoDash — render/touge.ts. HUD do duelo de touge (world/touge.ts): as duas
// barras de vida no alto (você à esquerda, o rival à direita), a curva atual e o
// ANEL DE TEMPO: um círculo fixo no meio da tela e um anel que fecha até ele na
// hora exata de apertar Shift. Verde dentro da janela do PERFEITO, amarelo na do
// BOM. A seta mostra o lado da curva.
import { type AutoDashEngine, W, H } from "../engine"
import { rr } from "./primitives"
import { TOUGE, tempoAteEntrada } from "../world/touge"

const FONTE = "'Space Grotesk', 'Segoe UI', sans-serif"

function barra(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, cor: string, nome: string, direita: boolean) {
  ctx.fillStyle = "rgba(15,23,42,0.75)"
  rr(ctx, x - 3, y - 3, w + 6, 20, 6)
  ctx.fillStyle = "rgba(148,163,184,0.25)"
  ctx.fillRect(x, y, w, 14)
  ctx.fillStyle = cor
  const fw = w * Math.max(0, Math.min(1, frac))
  ctx.fillRect(direita ? x + w - fw : x, y, fw, 14)
  ctx.fillStyle = "#f8fafc"
  ctx.font = `bold 13px ${FONTE}`
  ctx.textAlign = direita ? "right" : "left"
  ctx.fillText(nome, direita ? x + w : x, y - 8)
  ctx.textAlign = "left"
}

export function renderTouge(eng: AutoDashEngine) {
  const tg = eng.touge
  if (!tg || eng.state !== "racing") return
  const ctx = eng.ctx
  const bw = W * 0.26, y = 92
  barra(ctx, W / 2 - bw - 30, y, bw, tg.vidaVoce / 100, "#38bdf8", "VOCÊ", false)
  barra(ctx, W / 2 + 30, y, bw, tg.vidaRival / 100, tg.cor, tg.nome, true)
  ctx.fillStyle = "#f8fafc"
  ctx.font = `bold 15px ${FONTE}`
  ctx.textAlign = "center"
  const n = Math.min(tg.atual + 1, tg.curvas.length)
  ctx.fillText(tg.fase === "batalha" ? `CURVA ${n}/${tg.curvas.length}` : "FIM", W / 2, y + 12)
  ctx.textAlign = "left"
  if (tg.fase !== "batalha") return

  const c = tg.curvas[tg.atual]
  if (!c || c.nota) return
  const t = tempoAteEntrada(eng, c)
  if (t > TOUGE.anelS || t < -TOUGE.bom) return
  // anel de tempo: alvo fixo e o anel fechando até ele em t = 0
  const cx = W / 2, cy = H * 0.36, r0 = 30
  const r = r0 + Math.max(0, t) * 60 // começa com ~130 px e fecha no alvo
  const d = Math.abs(t)
  const cor = d <= TOUGE.perfeito ? "#4ade80" : d <= TOUGE.bom ? "#facc15" : "#f8fafc"
  ctx.lineWidth = 4
  ctx.strokeStyle = "rgba(248,250,252,0.35)"
  ctx.beginPath(); ctx.arc(cx, cy, r0, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = cor
  ctx.lineWidth = d <= TOUGE.bom ? 6 : 3
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
  // seta do lado da curva e o botão
  ctx.fillStyle = cor
  ctx.beginPath()
  const s = c.dir
  ctx.moveTo(cx + s * 16, cy); ctx.lineTo(cx - s * 8, cy - 12); ctx.lineTo(cx - s * 8, cy + 12); ctx.closePath(); ctx.fill()
  ctx.font = `bold 14px ${FONTE}`
  ctx.textAlign = "center"
  ctx.fillText("SHIFT", cx, cy + r0 + 22)
  ctx.textAlign = "left"
}
