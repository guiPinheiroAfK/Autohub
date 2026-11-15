// AutoDash — render/eventos.ts. Desenho dos eventos da Fase 5: posto, placas
// novas e o medidor de combustível. Cores de perigo da pesquisa visual-e-desafio
// 1.8 (âmbar #FF9F1C, branco #FFF4E0, preto #14110F, pisca #FFC23D ↔ #FF9F1C).
import { type AutoDashEngine, type RoadSign, type Obstacle, H, W, PLAYER_Z } from "../engine"
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
  if (sign.type === "acidente") {
    // aviso de acidente: triângulo âmbar com "!" (paleta de perigo)
    ctx.fillStyle = shade(PERIGO.ambar, Math.max(0.6, amb))
    ctx.beginPath()
    ctx.moveTo(x, cy - r * 1.05); ctx.lineTo(x + r * 1.1, cy + r * 0.85); ctx.lineTo(x - r * 1.1, cy + r * 0.85)
    ctx.closePath(); ctx.fill()
    if (r > 5) {
      ctx.fillStyle = PERIGO.preto
      ctx.fillRect(x - r * 0.08, cy - r * 0.45, r * 0.16, r * 0.75)
      ctx.fillRect(x - r * 0.08, cy + r * 0.45, r * 0.16, r * 0.16)
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

/**
 * Obstáculos dos eventos novos. Devolve false para os antigos (cone, barreira).
 * `w` já é a largura do obstáculo na tela.
 */
export function desenharObstaculoEvento(eng: AutoDashEngine, o: Obstacle, x: number, y: number, w: number, amb: number): boolean {
  const ctx = eng.ctx
  if (o.kind === "seta") {
    // reboque com painel de seta luminosa: chevrons âmbar piscando para o lado livre
    const ph = w * 0.62, py = y - w * 0.95
    ctx.fillStyle = "rgba(0,0,0,0.3)"
    ctx.beginPath(); ctx.ellipse(x, y, w * 0.55, w * 0.08, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = shade("#475569", amb)
    ctx.fillRect(x - w * 0.04, py + ph, w * 0.08, y - py - ph)          // mastro
    ctx.fillRect(x - w * 0.42, y - w * 0.16, w * 0.84, w * 0.12)         // reboque
    ctx.fillStyle = PERIGO.preto
    ctx.fillRect(x - w / 2, py, w, ph)
    const aceso = piscaAlerta()
    if (aceso && w > 6) {
      const dir = -(o.lado ?? 1) // aponta para o lado livre
      ctx.strokeStyle = PERIGO.pisca
      ctx.lineWidth = Math.max(1.5, w * 0.06)
      ctx.beginPath()
      for (let i = -1; i <= 1; i++) {
        const cx = x + i * w * 0.24
        ctx.moveTo(cx - dir * w * 0.08, py + ph * 0.2)
        ctx.lineTo(cx + dir * w * 0.08, py + ph * 0.5)
        ctx.lineTo(cx - dir * w * 0.08, py + ph * 0.8)
      }
      ctx.stroke()
    }
    // halo: a seta acesa atravessa a névoa (emissivo, pesquisa 1.2)
    if (aceso && amb < 0.75) {
      ctx.fillStyle = "rgba(255,159,28,0.18)"
      ctx.beginPath(); ctx.ellipse(x, py + ph / 2, w * 0.9, ph, 0, 0, Math.PI * 2); ctx.fill()
    }
    return true
  }
  if (o.kind === "oleo") {
    // mancha escura achatada com reflexo arco-íris
    const rh = Math.max(1, w * 0.12)
    ctx.fillStyle = "rgba(10,10,14,0.72)"
    ctx.beginPath(); ctx.ellipse(x, y, w * 0.55, rh, 0, 0, Math.PI * 2); ctx.fill()
    if (w > 8) {
      const g = ctx.createLinearGradient(x - w * 0.4, y, x + w * 0.4, y)
      g.addColorStop(0, "rgba(168,85,247,0.35)")
      g.addColorStop(0.35, "rgba(34,211,238,0.35)")
      g.addColorStop(0.65, "rgba(250,204,21,0.3)")
      g.addColorStop(1, "rgba(236,72,153,0.3)")
      ctx.fillStyle = g
      ctx.beginPath(); ctx.ellipse(x + w * 0.05, y - rh * 0.2, w * 0.36, rh * 0.45, 0, 0, Math.PI * 2); ctx.fill()
    }
    return true
  }
  return false
}

/** Vácuo (E9): linhas de ar nas bordas e o selo "VÁCUO" (transparência, pesquisa 4.3). */
export function renderVacuo(eng: AutoDashEngine) {
  const f = eng.vacuo
  if (f < 0.15 && eng.estilingueT <= 0) return
  const ctx = eng.ctx
  if (f >= 0.15) {
    // linhas de ar: riscos claros correndo pelas bordas em direção ao centro
    ctx.strokeStyle = `rgba(224,242,254,${0.12 + 0.25 * f})`
    ctx.lineWidth = 2
    ctx.beginPath()
    const t = performance.now() / 1000
    for (let i = 0; i < 8; i++) {
      const lado = i % 2 === 0 ? -1 : 1
      const fase = (t * 2.2 + i * 0.37) % 1
      const y = H * 0.35 + (i * 41) % (H * 0.45)
      const x0 = W / 2 + lado * (W * 0.5 - fase * W * 0.18)
      ctx.moveTo(x0, y)
      ctx.lineTo(x0 - lado * W * 0.07 * f, y + 4)
    }
    ctx.stroke()
  }
  ctx.textAlign = "center"
  ctx.font = "bold 15px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillStyle = eng.estilingueT > 0 ? PERIGO.pisca : "#56B4E9"
  ctx.fillText(eng.estilingueT > 0 ? "💨 ESTILINGUE" : `💨 VÁCUO +${Math.round(f * 4)}%`, W / 2, H * 0.6) // acima do carro, sem cobrir a placa
  ctx.textAlign = "left"
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
