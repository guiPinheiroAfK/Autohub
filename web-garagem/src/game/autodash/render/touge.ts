// AutoDash — render/touge.ts. HUD do duelo de touge (world/touge.ts), com clima
// de chefe: faixas de cinema em cima e embaixo, a apresentação do rival, as duas
// barras de vida, a curva atual e o COMANDO da vez (um círculo com a tecla e um
// anel que fecha na hora exata). Dentro da curva, o MEDIDOR DE ÂNGULO: um arco
// com a faixa verde, a vermelha (roda) e o ponteiro do seu ângulo.
import { type AutoDashEngine, W, H } from "../engine"
import { rr } from "./primitives"
import { TOUGE, comandoAtual, anguloDrift } from "../world/touge"

const FONTE = "'Space Grotesk', 'Segoe UI', sans-serif"
const TECLA = { freio: "S", shift: "SHIFT", drift: "", nitro: "ESPAÇO" }
const DICA = { freio: "FREIA", shift: "FREIO DE MÃO", drift: "", nitro: "NITRO" }

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

/** Medidor de ângulo do drift: arco de 0 a 1,3 rad, faixa verde e vermelha. */
function medidor(ctx: CanvasRenderingContext2D, ang: number) {
  const cx = W / 2, cy = H * 0.62, r = 70, MAX = 1.3
  const a = (v: number) => Math.PI + (Math.min(MAX, v) / MAX) * Math.PI // 180° → 360°
  ctx.lineWidth = 12
  ctx.strokeStyle = "rgba(15,23,42,0.6)"
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI); ctx.stroke()
  ctx.strokeStyle = "rgba(74,222,128,0.9)"
  ctx.beginPath(); ctx.arc(cx, cy, r, a(TOUGE.zona[0]), a(TOUGE.zona[1])); ctx.stroke()
  ctx.strokeStyle = "rgba(239,68,68,0.9)"
  ctx.beginPath(); ctx.arc(cx, cy, r, a(TOUGE.roda), 2 * Math.PI); ctx.stroke()
  const naZona = ang >= TOUGE.zona[0] && ang <= TOUGE.zona[1]
  const p = a(ang)
  ctx.strokeStyle = naZona ? "#4ade80" : ang > TOUGE.zona[1] ? "#ef4444" : "#facc15"
  ctx.lineWidth = 4
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(p) * (r + 8), cy + Math.sin(p) * (r + 8)); ctx.stroke()
  ctx.fillStyle = "#f8fafc"
  ctx.font = `bold 13px ${FONTE}`
  ctx.textAlign = "center"
  ctx.fillText(naZona ? "SEGURA!" : ang > TOUGE.zona[1] ? "CONTRA-ESTERÇA!" : "MAIS GÁS (W)!", cx, cy + 18)
  ctx.textAlign = "left"
}

export function renderTouge(eng: AutoDashEngine) {
  const tg = eng.touge
  if (!tg || eng.state !== "racing") return
  const ctx = eng.ctx
  // faixas de cinema (só na batalha)
  if (tg.fase === "batalha") {
    ctx.fillStyle = "rgba(0,0,0,0.85)"
    ctx.fillRect(0, 0, W, H * 0.07)
    ctx.fillRect(0, H * 0.93, W, H * 0.07)
  }
  // apresentação do rival
  if (tg.introT > 0) {
    const k = Math.min(1, tg.introT / 0.4, (TOUGE.introS - tg.introT) / 0.3)
    ctx.globalAlpha = Math.max(0, k)
    ctx.fillStyle = "rgba(15,23,42,0.85)"
    rr(ctx, W / 2 - 230, H * 0.3, 460, 110, 14)
    ctx.fillStyle = tg.cor
    ctx.fillRect(W / 2 - 230, H * 0.3, 8, 110)
    ctx.textAlign = "center"
    ctx.fillStyle = "#94a3b8"; ctx.font = `bold 13px ${FONTE}`
    ctx.fillText("DESAFIO NA DESCIDA", W / 2, H * 0.3 + 26)
    ctx.fillStyle = tg.cor; ctx.font = `bold 34px ${FONTE}`
    ctx.fillText(tg.nome, W / 2, H * 0.3 + 64)
    ctx.fillStyle = "#e2e8f0"; ctx.font = `13px ${FONTE}`
    ctx.fillText(`${tg.curvas.length} curvas · S freia · SHIFT entra · W/volante seguram o ângulo · ESPAÇO sai`, W / 2, H * 0.3 + 92)
    ctx.textAlign = "left"; ctx.globalAlpha = 1
  }
  const bw = W * 0.26, y = H * 0.07 + 28
  barra(ctx, W / 2 - bw - 30, y, bw, tg.vidaVoce / 100, "#38bdf8", "VOCÊ", false)
  barra(ctx, W / 2 + 30, y, bw, tg.vidaRival / 100, tg.acordou ? "#ef4444" : tg.cor, tg.acordou ? `${tg.nome} ⚡` : tg.nome, true)
  ctx.fillStyle = "#f8fafc"
  ctx.font = `bold 15px ${FONTE}`
  ctx.textAlign = "center"
  const n = Math.min(tg.atual + 1, tg.curvas.length)
  ctx.fillText(tg.fase === "batalha" ? `CURVA ${n}/${tg.curvas.length}` : "FIM", W / 2, y + 12)
  ctx.textAlign = "left"

  // medidor de ângulo enquanto está de lado
  const dr = anguloDrift(eng)
  if (dr) medidor(ctx, dr.ang)

  const at = comandoAtual(eng)
  if (!at || at.t > TOUGE.anelS || at.cmd === "drift") return
  const cx = W / 2, cy = H * 0.36, r0 = 32
  ctx.textAlign = "center"
  const d = Math.abs(at.t)
  const janela = at.cmd === "shift" ? (tg.acordou ? TOUGE.fase2.perfeito : TOUGE.perfeito) : TOUGE.bom
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
