// AutoDash — render/eventos.ts. Desenho dos eventos da Fase 5: posto, placas
// novas e o medidor de combustível. Cores de perigo da pesquisa visual-e-desafio
// 1.8 (âmbar #FF9F1C, branco #FFF4E0, preto #14110F, pisca #FFC23D ↔ #FF9F1C).
import { type AutoDashEngine, type RoadSign, H, W, PLAYER_Z } from "../engine"
import { KMH2UPS, SEG_LEN } from "../data"
import { shade } from "../math"
import { rr } from "./primitives"
import { glass } from "../ui/widgets"
import { type Ramal, ramalBordas, ramalPerfilOuZero } from "../world/ramais"
import { COMBUSTIVEL } from "../world/combustivel"
import { combustivelAtivo, postoAFrente, postoMeio } from "../world/posto"
import { wrapDz } from "../traffic/spawner"
import { RACHA } from "../world/racha"
import { vantagemM } from "../modes/racha"

export const PERIGO = { ambar: "#FF9F1C", branco: "#FFF4E0", preto: "#14110F", pisca: "#FFC23D" }

/** Pisca de alerta a ~2,5 Hz (true = aceso). Usa o relógio do render, como o giroflex. */
export function piscaAlerta(): boolean {
  return Math.floor(performance.now() / 200) % 2 === 0
}

/**
 * Cobertura do posto sobre a faixa de acesso, com as bombas na ilha de fora.
 * `x` e `w` são o centro e a meia-largura da pista na tela, no segmento do meio.
 */
export function drawPosto(eng: AutoDashEngine, r: Ramal, x: number, y: number, w: number, amb: number) {
  if (w < 3) return
  const ctx = eng.ctx
  const b = ramalBordas(r, ramalPerfilOuZero(r, postoMeio(r)))
  const L = r.lado
  const xa = x + L * w * (b.inner - 0.06), xb = x + L * w * (b.outer + 0.34)
  const esq = Math.min(xa, xb), dir = Math.max(xa, xb), larg = dir - esq
  const alto = w * 0.72, teto = Math.max(3, w * 0.13)
  const noite = amb < 0.62
  // pilares
  ctx.fillStyle = shade("#cbd5e1", Math.max(0.45, amb))
  const pw = Math.max(2, w * 0.05)
  ctx.fillRect(esq + larg * 0.04, y - alto, pw, alto)
  ctx.fillRect(dir - larg * 0.04 - pw, y - alto, pw, alto)
  // bombas na ilha, do lado de fora da faixa
  const ilha = x + L * w * (b.outer + 0.17)
  ctx.fillStyle = shade("#94a3b8", Math.max(0.45, amb))
  ctx.fillRect(ilha - w * 0.1, y - w * 0.02, w * 0.2, w * 0.02)
  for (const d of [-0.05, 0.05]) {
    const bx = ilha + d * w
    ctx.fillStyle = shade("#1d4ed8", Math.max(0.5, amb))
    rr(ctx, bx - w * 0.025, y - w * 0.16, w * 0.05, w * 0.15, w * 0.008)
    ctx.fillStyle = noite ? "#bae6fd" : shade("#e0f2fe", amb)
    ctx.fillRect(bx - w * 0.017, y - w * 0.14, w * 0.034, w * 0.03)
  }
  // luz embaixo da cobertura (à noite lava o asfalto)
  if (noite) {
    ctx.fillStyle = "rgba(240,253,250,0.10)"
    ctx.fillRect(esq, y - alto + teto, larg, alto - teto)
  }
  // laje e faixa luminosa da cobertura
  ctx.fillStyle = shade("#e2e8f0", Math.max(0.5, amb))
  ctx.fillRect(esq, y - alto - teto, larg, teto)
  ctx.fillStyle = noite ? "#22c55e" : shade("#16a34a", amb)
  ctx.fillRect(esq, y - alto - teto * 0.45, larg, teto * 0.45)
  if (teto > 6) {
    ctx.fillStyle = noite ? "#f0fdf4" : "#14532d"
    ctx.font = `bold ${Math.round(teto * 0.5)}px 'Space Grotesk', 'Segoe UI', sans-serif`
    ctx.textAlign = "center"
    ctx.fillText("⛽ POSTO 24h", (esq + dir) / 2, y - alto - teto * 0.55)
    ctx.textAlign = "left"
  }
}

/**
 * Placas dos eventos novos. Devolve false para tipos que não são daqui (o
 * chamador em render/objects.ts cai no desenho antigo). `cy` e `r` já vêm da
 * placa padrão (centro e raio).
 */
export function desenharPlacaEvento(eng: AutoDashEngine, sign: RoadSign, x: number, cy: number, r: number, amb: number): boolean {
  const ctx = eng.ctx
  if (sign.type === "posto") {
    // serviço: quadrado azul com bomba branca
    const s = r * 1.9
    ctx.fillStyle = shade("#1d4ed8", Math.max(0.55, amb))
    ctx.fillRect(x - s / 2, cy - s / 2, s, s)
    if (r > 5) {
      ctx.fillStyle = shade("#f8fafc", Math.max(0.6, amb))
      ctx.fillRect(x - r * 0.45, cy - r * 0.55, r * 0.6, r * 1.1)     // corpo da bomba
      ctx.fillRect(x + r * 0.2, cy - r * 0.3, r * 0.25, r * 0.12)     // bico
      ctx.fillRect(x + r * 0.38, cy - r * 0.3, r * 0.1, r * 0.6)      // mangueira
      ctx.fillStyle = shade("#1d4ed8", Math.max(0.55, amb))
      ctx.fillRect(x - r * 0.33, cy - r * 0.42, r * 0.36, r * 0.28)   // visor
    }
    return true
  }
  if (sign.type === "chegada") {
    // linha de chegada do racha: bandeira quadriculada
    const bw = r * 2.6, bh = r * 1.3, cols = 6, rows = 3
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? shade("#f8fafc", Math.max(0.6, amb)) : "#0f172a"
        ctx.fillRect(x - bw / 2 + (bw / cols) * i, cy - bh / 2 + (bh / rows) * j, bw / cols + 0.5, bh / rows + 0.5)
      }
    }
    return true
  }
  return false
}

/** Painel do racha: convite (como aceitar e quanto tempo falta) ou disputa (falta e vantagem). */
export function renderRacha(eng: AutoDashEngine) {
  const r = eng.racha
  if (!r || eng.mode !== "solo") return
  const ctx = eng.ctx
  const bw = 420, bx = W / 2 - bw / 2, by = 100
  glass(eng, bx, by, bw, 50, 12)
  ctx.textAlign = "center"
  ctx.font = "bold 16px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillStyle = r.def.cor
  if (r.fase === "convite") {
    const resta = Math.max(0, Math.ceil(RACHA.conviteS - r.t))
    ctx.fillText(`🏁 ${r.def.nome} te chamou pro racha`, W / 2, by + 21)
    ctx.font = "bold 13px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillStyle = piscaAlerta() ? PERIGO.pisca : "#f8fafc"
    ctx.fillText(`pisca o farol [F] pra aceitar · ${resta}s · reputação ${eng.cfg.reputacao ?? 0}`, W / 2, by + 40)
  } else {
    const faltaM = Math.max(0, Math.round((r.meta - r.eu) * 1000))
    ctx.fillText(`RACHA vs ${r.def.nome} · faltam ${faltaM} m`, W / 2, by + 21)
    // azul à frente, laranja atrás, com seta (legível para daltônico, pesquisa 1.6)
    const v = vantagemM(r)
    ctx.font = "bold 13px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillStyle = v >= 0 ? "#56B4E9" : "#E69F00"
    ctx.fillText(v >= 0 ? `▲ você na frente · ${v} m` : `▼ você atrás · ${-v} m`, W / 2, by + 40)
  }
  ctx.textAlign = "left"
}

/** Medidor de combustível ao lado do NOS, reserva piscando e distância até o posto. */
export function renderCombustivel(eng: AutoDashEngine) {
  if (!combustivelAtivo(eng)) return
  const ctx = eng.ctx
  const nx = 62, ny = eng.isTouch ? H - 230 : H - 160, nh = 120
  glass(eng, nx - 6, ny - 8, 34, nh + 34, 10)
  ctx.fillStyle = "rgba(148,163,184,0.3)"
  rr(ctx, nx, ny, 22, nh, 8)
  const f = eng.combustivel
  const fill = nh * f
  const reserva = f < COMBUSTIVEL.reserva
  ctx.fillStyle = eng.abastecendo ? "#86efac" : reserva ? (piscaAlerta() ? PERIGO.pisca : PERIGO.ambar) : "#4ade80"
  if (fill > 2) rr(ctx, nx, ny + nh - fill, 22, fill, 8)
  // marca da reserva
  ctx.fillStyle = "rgba(248,250,252,0.5)"
  ctx.fillRect(nx - 2, ny + nh * (1 - COMBUSTIVEL.reserva), 26, 1)
  ctx.fillStyle = reserva ? PERIGO.ambar : "#f8fafc"
  ctx.font = "bold 11px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("COMB", nx - 3, ny + nh + 18)
  // posto à frente: distância até a bomba
  const p = postoAFrente(eng)
  if (p) {
    const dz = wrapDz(eng, postoMeio(p) * SEG_LEN, eng.position + PLAYER_Z)
    // metros pela mesma escala do hodômetro (km/h × KMH2UPS = unidades/s)
    const m = Math.max(0, Math.round(dz / (KMH2UPS * 3.6) / 10) * 10)
    ctx.fillStyle = "#4ade80"
    ctx.font = "bold 12px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(dz > 0 ? `⛽ ${m} m` : "⛽ posto", nx - 40, ny - 16)
  }
}
