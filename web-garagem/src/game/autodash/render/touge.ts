// AutoDash — render/touge.ts. HUD do duelo de touge (world/touge.ts): as duas
// barras de vida no alto (você à esquerda, o rival à direita), a curva atual e o
// COMANDO da vez: um círculo fixo no meio da tela com a tecla dentro e um anel que
// fecha até ele na hora exata (verde na janela boa). O W é uma barra que enche
// enquanto você segura o acelerador dentro da curva.
import { type AutoDashEngine, W, H } from "../engine"
import { rr } from "./primitives"
import { TOUGE, comandoAtual } from "../world/touge"

const FONTE = "'Space Grotesk', 'Segoe UI', sans-serif"
const TECLA = { freio: "S", shift: "SHIFT", w: "W", nitro: "ESPAÇO" }
const DICA = { freio: "FREIA", shift: "FREIO DE MÃO", w: "SEGURA O GÁS", nitro: "NITRO" }

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

  const at = comandoAtual(eng)
  if (!at || at.t > TOUGE.anelS) return
  const cx = W / 2, cy = H * 0.36, r0 = 32
  ctx.textAlign = "center"
  if (at.cmd === "w") {
    // barra do W: enche com o tempo de gás segurado dentro da curva
    const frac = at.c.curvaT > 0 ? at.c.wT / at.c.curvaT : 0
    const ok = frac >= TOUGE.wMin
    ctx.fillStyle = "rgba(15,23,42,0.7)"; rr(ctx, cx - 90, cy - 16, 180, 32, 10)
    ctx.fillStyle = ok ? "#4ade80" : "#facc15"; ctx.fillRect(cx - 84, cy - 10, 168 * frac, 20)
    ctx.fillStyle = "#f8fafc"; ctx.font = `bold 16px ${FONTE}`
    ctx.fillText("SEGURA O W", cx, cy + 6)
    ctx.textAlign = "left"
    return
  }
  const d = Math.abs(at.t)
  const janela = at.cmd === "shift" ? TOUGE.perfeito : TOUGE.bom
  const cor = d <= janela ? "#4ade80" : d <= TOUGE.bom ? "#facc15" : "#f8fafc"
  const r = r0 + Math.max(0, at.t) * 60
  ctx.fillStyle = "rgba(15,23,42,0.55)"
  ctx.beginPath(); ctx.arc(cx, cy, r0, 0, Math.PI * 2); ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = "rgba(248,250,252,0.4)"
  ctx.beginPath(); ctx.arc(cx, cy, r0, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = cor
  ctx.lineWidth = d <= TOUGE.bom ? 6 : 3
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = cor
  const tecla = TECLA[at.cmd]
  ctx.font = `bold ${tecla.length > 1 ? 13 : 24}px ${FONTE}`
  ctx.fillText(tecla, cx, cy + (tecla.length > 1 ? 5 : 9))
  ctx.font = `bold 13px ${FONTE}`
  ctx.fillText(DICA[at.cmd] + (at.cmd === "shift" ? (at.c.dir > 0 ? "  ▶" : "  ◀") : ""), cx, cy + r0 + 20)
  ctx.textAlign = "left"
}
