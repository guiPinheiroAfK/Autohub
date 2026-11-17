// AutoDash — render/touge.ts. HUD do duelo de touge (world/touge.ts), com clima
// de chefe: faixas de cinema, a apresentação do rival, as duas barras de
// espírito, o ato (CAÇA / LIDERANÇA) com a distância, o medidor de ângulo no
// drift e, no treino, a dica embaixo. Os COMANDOS não ficam no meio da tela:
// estão pintados na pista (render/road.ts) com um painel em cima de cada marca
// (drawPainelTouge), que acende na hora. Os efeitos de luta de chefe (impacto,
// câmera lenta, dano nas barras, a apresentação) moram em render/tougeFx.ts.
import { type AutoDashEngine, W, H, PLAYER_Z } from "../engine"
import { rr } from "./primitives"
import { TOUGE, comandoAtual, emCena, type RotuloMarca } from "../world/touge"
import { wrapDz } from "../traffic/spawner"
import { renderTougeTela, renderTougeTextos, renderIntroTouge, barraTouge } from "./tougeFx"

const FONTE = "'Space Grotesk', 'Segoe UI', sans-serif"

/** Painel em cima de uma marca da pista: a tecla e o que ela faz; acende na hora. */
export function drawPainelTouge(eng: AutoDashEngine, x: number, y: number, w: number, r: RotuloMarca) {
  if (w < 6) return
  const ctx = eng.ctx
  const pw = Math.max(40, w * 0.55), ph = pw * 0.42
  ctx.globalAlpha = r.agora ? 1 : 0.75
  ctx.fillStyle = r.agora ? r.cor : "rgba(15,23,42,0.85)"
  rr(ctx, x - pw / 2, y - ph, pw, ph, ph * 0.18)
  ctx.strokeStyle = r.cor; ctx.lineWidth = Math.max(1.5, pw * 0.03)
  ctx.strokeRect(x - pw / 2, y - ph, pw, ph)
  ctx.fillStyle = r.agora ? "#0f172a" : r.cor
  ctx.textAlign = "center"
  ctx.font = `bold ${Math.round(ph * (r.txt.length > 2 ? 0.36 : 0.6))}px ${FONTE}`
  ctx.fillText(r.txt, x, y - ph * (r.txt.length > 2 ? 0.45 : 0.32))
  if (ph > 26) {
    ctx.font = `bold ${Math.round(ph * 0.2)}px ${FONTE}`
    ctx.fillText(r.dica, x, y - ph * 0.1)
  }
  ctx.textAlign = "left"
  ctx.globalAlpha = 1
}

/**
 * O botão da cena, grande e no meio (17/11: "poderia ter os botões mais claros"): a tecla SHIFT
 * e um anel que fecha até a linha amarela. Quando o anel encosta na tecla, é a hora.
 */
function botaoShift(ctx: CanvasRenderingContext2D, t: number, treino: boolean) {
  const cx = W / 2, cy = H * 0.5
  const k = Math.max(0, Math.min(1, t / 1.2)) // 1: longe, 0: na linha
  const quase = t < 0.25
  // anel que fecha
  ctx.lineWidth = 5
  ctx.strokeStyle = quase ? "#4ade80" : "#facc15"
  ctx.globalAlpha = 0.95
  ctx.beginPath(); ctx.arc(cx, cy, 44 + 110 * k, 0, Math.PI * 2); ctx.stroke()
  // a tecla
  const w = 150, h = 56
  ctx.fillStyle = quase ? "#4ade80" : "rgba(15,23,42,0.92)"
  rr(ctx, cx - w / 2, cy - h / 2, w, h, 12)
  ctx.strokeStyle = quase ? "#bbf7d0" : "#facc15"; ctx.lineWidth = 3
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h)
  ctx.fillStyle = quase ? "#052e16" : "#facc15"
  ctx.font = `bold 28px ${FONTE}`
  ctx.textAlign = "center"
  ctx.fillText("SHIFT", cx, cy + 10)
  ctx.font = `bold 13px ${FONTE}`
  ctx.fillStyle = "#f8fafc"
  ctx.fillText(quase ? "AGORA!" : treino ? "aperte quando o anel fechar" : "freio de mão", cx, cy + h / 2 + 22)
  ctx.textAlign = "left"
  ctx.globalAlpha = 1
}

/** Faixa de dica embaixo (cena de treino e atos). */
function dica(ctx: CanvasRenderingContext2D, txt: string, cor = "#fde047") {
  ctx.fillStyle = "rgba(15,23,42,0.85)"
  rr(ctx, W / 2 - 280, H * 0.84, 560, 30, 8)
  ctx.fillStyle = cor; ctx.font = `bold 14px ${FONTE}`
  ctx.textAlign = "center"; ctx.fillText(txt, W / 2, H * 0.84 + 20); ctx.textAlign = "left"
}

export function renderTouge(eng: AutoDashEngine) {
  const tg = eng.touge
  if (!tg || eng.state !== "racing") return
  const ctx = eng.ctx
  // por baixo de tudo: câmera lenta, vinheta vermelha do erro, linhas e clarão do impacto
  renderTougeTela(eng)
  if (tg.fase === "batalha") {
    ctx.fillStyle = "rgba(0,0,0,0.85)"
    ctx.fillRect(0, 0, W, H * 0.07)
    ctx.fillRect(0, H * 0.93, W, H * 0.07)
  }
  if (tg.introT > 0) renderIntroTouge(eng, tg)
  const bw = W * 0.26, y = H * 0.07 + 28
  barraTouge(eng, 0, W / 2 - bw - 30, y, bw, tg.vidaVoce, "#38bdf8", "VOCÊ", false, false)
  barraTouge(eng, 1, W / 2 + 30, y, bw, tg.vidaRival, tg.acordou ? "#ef4444" : tg.cor, tg.acordou ? `${tg.nome} ⚡` : tg.nome, true, tg.acordou)
  renderTougeTextos(eng)
  // ato e distância
  const gap = wrapDz(eng, tg.rival.z, eng.position + PLAYER_Z)
  const m = Math.round(Math.abs(gap) / 475) // metros (1 km/h = 132 u/s ⇒ ~475 u por metro)
  ctx.textAlign = "center"
  ctx.fillStyle = "#f8fafc"; ctx.font = `bold 15px ${FONTE}`
  const ato = tg.fase !== "batalha" ? "FIM" : tg.decisivo ? "DECISÃO" : tg.papel === "caca" ? "CAÇA" : "LIDERANÇA"
  ctx.fillText(`${ato} · ${m} m`, W / 2, y + 12)
  ctx.textAlign = "left"
  if (tg.fase !== "batalha") return

  const at = comandoAtual(eng)
  if (at && at.cmd === "shift" && at.t < 1.2 && at.t > -0.4) botaoShift(ctx, at.t, at.c.treino)
  if (at && at.c.treino) {
    dica(ctx, "TREINO: o carro pilota a curva. SHIFT ao cruzar a linha AMARELA (câmera lenta até apertar)")
    return
  }
  if (at && emCena(eng)) { dica(ctx, "CURVA: o carro pilota. Aperte SHIFT na linha AMARELA", "#facc15"); return }
  if (!emCena(eng)) {
    // trecho livre: o que conta é a distância
    const d = Math.abs(gap)
    if (tg.papel === "caca") dica(ctx, d < TOUGE.colado ? "COLADO NELE: ele está perdendo espírito!" : d > TOUGE.longe ? "VOCÊ ESTÁ FICANDO PARA TRÁS!" : "CAÇA: cole na traseira dele", d < TOUGE.colado ? "#4ade80" : d > TOUGE.longe ? "#ef4444" : "#e2e8f0")
    else dica(ctx, d < TOUGE.colado ? "ELE ESTÁ COLADO EM VOCÊ!" : d > TOUGE.longe ? "ABRIU DISTÂNCIA: ele está perdendo espírito!" : "LIDERANÇA: não deixe ele colar", d < TOUGE.colado ? "#ef4444" : d > TOUGE.longe ? "#4ade80" : "#e2e8f0")
  }
}
