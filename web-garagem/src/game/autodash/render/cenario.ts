// AutoDash — render/cenario.ts. Enfeites de beira novos (Fase 8.4, world/cenario.ts).
// Desenho em canvas, sem imagem externa. `w` é a largura do sprite na tela e
// (x, y) o pé dele no chão; `seed` varia cor e proporção. Longe (w pequeno) os
// detalhes somem: no horizonte eles viravam ruído caro de qualquer jeito.
import { type AutoDashEngine } from "../engine"
import { shade } from "../math"
import { rr } from "./primitives"
import { ENF } from "../world/cenario"
import { drawTokyo } from "./tokyo"

const CASAS = ["#f5e6c8", "#cfe3f0", "#f2d0c4", "#e6efc9", "#e7d7f2", "#f7f1e1"]
const TELHADOS = ["#9a3412", "#7c2d12", "#475569", "#334155"]
const PREDIOS = ["#cbd5e1", "#e2d6c3", "#b9c4cf", "#d6c7b2", "#a8b5c4"]
const GUARDA = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#ec4899"]

const de = <T,>(lista: readonly T[], seed: number): T => lista[Math.abs(seed) % lista.length]

/** Um segmento de guard-rail contínuo (os dois lados): bordas perto/longe na tela. */
export interface RailSeg { idx: number; xl1: number; xl2: number; xr1: number; xr2: number; y1: number; y2: number; s1: number; s2: number; so?: -1 | 0 | 1 } // so: só deste lado (0: os dois)

/**
 * Guard-rail da serra (playtest 16/11: "os guard-rails do começo são um monte de
 * desenho cinza que não faz nada"). Antes era um sprite solto por segmento,
 * alternando de lado; agora é a lâmina CONTÍNUA dos dois lados, ligando um
 * segmento ao outro, com o reflexo e um poste a cada 2 segmentos.
 */
export function drawGuardRail(eng: AutoDashEngine, r: RailSeg, amb: number) {
  const ctx = eng.ctx
  const luz = Math.max(0.4, amb)
  const topo = 230, base = 120, poste = 250 // altura (mundo) da lâmina e do poste
  const t1 = r.y1 - topo * r.s1, b1 = r.y1 - base * r.s1, t2 = r.y2 - topo * r.s2, b2 = r.y2 - base * r.s2
  const lados = r.so === -1 ? [[r.xl1, r.xl2]] : r.so === 1 ? [[r.xr1, r.xr2]] : [[r.xl1, r.xl2], [r.xr1, r.xr2]]
  for (const [x1, x2] of lados) {
    if (r.idx % 2 === 0) { // poste
      ctx.fillStyle = shade("#475569", luz)
      ctx.fillRect(x1 - Math.max(0.5, 18 * r.s1), r.y1 - poste * r.s1, Math.max(1, 36 * r.s1), poste * r.s1)
    }
    ctx.fillStyle = shade("#94a3b8", luz) // lâmina
    ctx.beginPath(); ctx.moveTo(x1, t1); ctx.lineTo(x2, t2); ctx.lineTo(x2, b2); ctx.lineTo(x1, b1); ctx.closePath(); ctx.fill()
    ctx.fillStyle = shade("#e2e8f0", luz) // reflexo no meio da lâmina
    const m1 = (t1 + b1) / 2, m2 = (t2 + b2) / 2, e1 = (b1 - t1) * 0.14, e2 = (b2 - t2) * 0.14
    ctx.beginPath(); ctx.moveTo(x1, m1 - e1); ctx.lineTo(x2, m2 - e2); ctx.lineTo(x2, m2 + e2); ctx.lineTo(x1, m1 + e1); ctx.closePath(); ctx.fill()
  }
}

/** Paredão de pedra da montanha: logo depois da zebra, alto, com cachoeira de vez em quando. */
export const PAREDAO = { dist: 1.2, altura: 2600, cachoeiraCada: 90 }

/**
 * Paredão de pedra (world/montanha.ts, meio e descida da serra): uma face
 * contínua do lado de dentro da serra, em faixas de rocha, com a mata no topo,
 * água escorrendo e, a cada `cachoeiraCada` segmentos, uma cachoeira.
 * `xl1/xl2` são o pé do paredão (perto/longe); `so` o lado.
 */
export function drawParedao(eng: AutoDashEngine, r: RailSeg, amb: number) {
  const ctx = eng.ctx
  const luz = Math.max(0.35, amb)
  const hp = PAREDAO.altura, lado = r.so ?? 1
  const t1 = r.y1 - hp * r.s1, t2 = r.y2 - hp * r.s2
  // a face vai do pé até a borda da tela daquele lado (o resto da encosta)
  const fora = lado > 0 ? 1e4 : -1e4
  ctx.fillStyle = shade(r.idx % 2 === 0 ? "#6b6258" : "#73695e", luz)
  ctx.beginPath(); ctx.moveTo(r.xl1, r.y1); ctx.lineTo(r.xl2, r.y2); ctx.lineTo(r.xl2, t2); ctx.lineTo(r.xl1, t1); ctx.closePath(); ctx.fill()
  // a encosta por trás da face (mesma cor, mais escura) até a borda da tela
  ctx.fillStyle = shade("#4d463f", luz)
  ctx.beginPath(); ctx.moveTo(r.xl1, t1); ctx.lineTo(r.xl2, t2); ctx.lineTo(fora, t2); ctx.lineTo(fora, t1); ctx.closePath(); ctx.fill()
  // estrato de rocha e a mata no topo
  if (r.idx % 3 === 0) {
    ctx.fillStyle = shade("#8c7b6b", luz)
    const m1 = r.y1 - hp * 0.45 * r.s1, m2 = r.y2 - hp * 0.45 * r.s2
    ctx.beginPath(); ctx.moveTo(r.xl1, m1); ctx.lineTo(r.xl2, m2); ctx.lineTo(r.xl2, m2 - 90 * r.s2); ctx.lineTo(r.xl1, m1 - 90 * r.s1); ctx.closePath(); ctx.fill()
  }
  ctx.fillStyle = shade("#1f5d3c", luz)
  ctx.beginPath(); ctx.moveTo(r.xl1, t1); ctx.lineTo(r.xl2, t2); ctx.lineTo(r.xl2, t2 - 260 * r.s2); ctx.lineTo(r.xl1, t1 - 320 * r.s1); ctx.closePath(); ctx.fill()
  // cachoeira: água branca descendo a face e a névoa no pé
  const k = r.idx % PAREDAO.cachoeiraCada
  if (k < 3) {
    ctx.fillStyle = "rgba(226,240,255,0.75)"
    ctx.beginPath(); ctx.moveTo(r.xl1, r.y1); ctx.lineTo(r.xl2, r.y2); ctx.lineTo(r.xl2, t2); ctx.lineTo(r.xl1, t1); ctx.closePath(); ctx.fill()
    if (k === 0 && r.s1 * hp > 12) {
      const fase = (performance.now() / 200) % 1
      ctx.fillStyle = "rgba(255,255,255,0.5)"
      for (let i = 0; i < 4; i++) ctx.fillRect(r.xl1 - 2, t1 + ((i / 4 + fase) % 1) * (r.y1 - t1), 4, Math.max(2, (r.y1 - t1) * 0.08))
      ctx.fillStyle = "rgba(226,240,255,0.25)"
      ctx.beginPath(); ctx.ellipse(r.xl1, r.y1, 400 * r.s1, 120 * r.s1, 0, 0, Math.PI * 2); ctx.fill()
    }
  } else if (r.idx % 11 === 0) { // água escorrendo
    ctx.fillStyle = "rgba(186,214,230,0.35)"
    ctx.fillRect(r.xl1 - 1, t1 + (r.y1 - t1) * 0.3, Math.max(1, 30 * r.s1), (r.y1 - t1) * 0.7)
  }
}

/**
 * Portal da serra: dois pilares de pedra nas bordas e a viga de madeira com a
 * placa "SERRA DO MAR" atravessando a pista. `x`/`w`: centro e meia-largura da
 * pista na tela, `y` o chão.
 */
export function drawPortal(eng: AutoDashEngine, x: number, y: number, w: number, amb: number) {
  if (w < 4) return
  const ctx = eng.ctx
  const luz = Math.max(0.45, amb)
  const h = w * 1.5, pw = w * 0.22
  for (const s of [-1, 1]) {
    const px = x + s * w * 1.3
    ctx.fillStyle = shade("#78716c", luz)
    ctx.fillRect(px - pw / 2, y - h, pw, h)
    ctx.fillStyle = shade("#57534e", luz) // pedras
    for (let k = 0; k < 5; k++) ctx.fillRect(px - pw / 2, y - h + (k + 0.5) * h / 5, pw, Math.max(1, h * 0.02))
    ctx.fillStyle = shade("#a8a29e", luz) // capitel
    ctx.fillRect(px - pw * 0.65, y - h - w * 0.06, pw * 1.3, w * 0.06)
  }
  // viga e placa
  ctx.fillStyle = shade("#6b4f35", luz)
  ctx.fillRect(x - w * 1.45, y - h - w * 0.06, w * 2.9, w * 0.1)
  ctx.fillStyle = shade("#14532d", Math.max(0.55, amb))
  rr(ctx, x - w * 0.9, y - h - w * 0.5, w * 1.8, w * 0.4, w * 0.04)
  if (w > 18) {
    ctx.fillStyle = "#f8fafc"
    ctx.font = `bold ${Math.round(w * 0.2)}px 'Space Grotesk', 'Segoe UI', sans-serif`
    ctx.textAlign = "center"; ctx.fillText("SERRA DO MAR", x, y - h - w * 0.23); ctx.textAlign = "left"
  }
}

/** Desenha um enfeite de beira novo. Devolve false se o `kind` não é daqui. */
export function drawEnfeite(eng: AutoDashEngine, kind: number, seed: number, x: number, y: number, w: number, amb: number): boolean {
  if (kind < 20) return false
  if (w < 1.5 && kind !== ENF.fiacao) return true // o fio cruza a pista: a largura do poste não diz o tamanho dele
  if (kind >= ENF.telaLED) return drawTokyo(eng, kind, seed, x, y, w, amb)
  const ctx = eng.ctx
  const noite = amb < 0.62
  const luz = Math.max(0.35, amb)
  switch (kind) {
    case ENF.casa: {
      const bw = w, bh = w * (0.5 + (seed % 20) / 100)
      ctx.fillStyle = shade(de(CASAS, seed), luz)
      ctx.fillRect(x - bw / 2, y - bh, bw, bh)
      // telhado
      ctx.fillStyle = shade(de(TELHADOS, seed >> 3), luz)
      ctx.beginPath()
      ctx.moveTo(x - bw * 0.58, y - bh); ctx.lineTo(x, y - bh - w * 0.32); ctx.lineTo(x + bw * 0.58, y - bh)
      ctx.closePath(); ctx.fill()
      if (w > 10) {
        // porta e janelas (acesas à noite)
        ctx.fillStyle = shade("#5b3a29", luz)
        ctx.fillRect(x - bw * 0.08, y - bh * 0.55, bw * 0.16, bh * 0.55)
        ctx.fillStyle = noite ? "#fde68a" : shade("#93c5fd", luz)
        ctx.fillRect(x - bw * 0.38, y - bh * 0.7, bw * 0.2, bh * 0.28)
        ctx.fillRect(x + bw * 0.18, y - bh * 0.7, bw * 0.2, bh * 0.28)
      }
      return true
    }
    case ENF.muro: {
      const bh = w * 0.2
      ctx.fillStyle = shade(seed % 2 ? "#d4d4d8" : "#e7e5e4", luz)
      ctx.fillRect(x - w / 2, y - bh, w, bh)
      ctx.fillStyle = shade("#a8a29e", luz)
      ctx.fillRect(x - w / 2, y - bh, w, Math.max(1, bh * 0.15))
      return true
    }
    case ENF.cerca: {
      const bh = w * 0.18
      ctx.fillStyle = shade("#8b6b4a", luz)
      for (let i = 0; i <= 4; i++) ctx.fillRect(x - w / 2 + (w / 4) * i - Math.max(0.5, w * 0.012), y - bh, Math.max(1, w * 0.025), bh)
      ctx.fillRect(x - w / 2, y - bh * 0.8, w, Math.max(1, bh * 0.12))
      ctx.fillRect(x - w / 2, y - bh * 0.4, w, Math.max(1, bh * 0.12))
      return true
    }
    case ENF.ponto: {
      // ponto de ônibus: cobertura, painel de vidro, banco e a placa
      const bh = w * 0.55
      ctx.fillStyle = shade("#64748b", luz)
      ctx.fillRect(x - w * 0.48, y - bh, w * 0.04, bh)
      ctx.fillRect(x + w * 0.44, y - bh, w * 0.04, bh)
      ctx.fillStyle = noite ? "rgba(186,230,253,0.55)" : `rgba(186,230,253,${0.35 * luz})`
      ctx.fillRect(x - w * 0.44, y - bh * 0.92, w * 0.88, bh * 0.75)
      ctx.fillStyle = shade("#1e293b", luz)
      ctx.fillRect(x - w * 0.55, y - bh - w * 0.06, w * 1.1, w * 0.06)
      ctx.fillStyle = shade("#475569", luz)
      ctx.fillRect(x - w * 0.3, y - bh * 0.32, w * 0.6, Math.max(1, w * 0.04))
      ctx.fillStyle = shade("#2563eb", Math.max(0.55, amb))
      ctx.fillRect(x + w * 0.56, y - bh * 1.25, w * 0.16, w * 0.16)
      ctx.fillStyle = shade("#64748b", luz)
      ctx.fillRect(x + w * 0.63, y - bh * 1.1, Math.max(1, w * 0.02), bh * 1.1)
      return true
    }
    case ENF.arvoreLarga: {
      const h = w * 1.9
      ctx.fillStyle = shade("#5b3a29", luz)
      ctx.fillRect(x - w * 0.07, y - h * 0.45, w * 0.14, h * 0.45)
      const verdes = ["#166534", "#15803d", "#3f6212"]
      ctx.fillStyle = shade(de(verdes, seed), luz)
      ctx.beginPath()
      ctx.arc(x, y - h * 0.7, w * 0.42, 0, Math.PI * 2)
      ctx.arc(x - w * 0.28, y - h * 0.55, w * 0.3, 0, Math.PI * 2)
      ctx.arc(x + w * 0.3, y - h * 0.56, w * 0.32, 0, Math.PI * 2)
      ctx.fill()
      return true
    }
    case ENF.pinheiro: {
      const h = w * 3.2
      ctx.fillStyle = shade("#4a3524", luz)
      ctx.fillRect(x - w * 0.06, y - h * 0.2, w * 0.12, h * 0.2)
      ctx.fillStyle = shade("#14532d", luz * 0.9)
      for (let i = 0; i < 3; i++) {
        const top = y - h + i * h * 0.22, base = y - h * (0.5 - i * 0.14), lw = w * (0.32 + i * 0.12)
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + lw, base); ctx.lineTo(x - lw, base); ctx.closePath(); ctx.fill()
      }
      return true
    }
    case ENF.plantacao: {
      // faixa de plantação vista de lado: base verde/dourada com as fileiras
      const bh = w * 0.05
      const cor = seed % 3 === 0 ? "#ca8a04" : seed % 3 === 1 ? "#4d7c0f" : "#65a30d"
      ctx.fillStyle = shade(cor, luz)
      ctx.fillRect(x - w / 2, y - bh, w, bh)
      if (w > 30) {
        ctx.fillStyle = shade("#365314", luz)
        for (let i = 0; i < 9; i++) ctx.fillRect(x - w / 2 + (w / 9) * i, y - bh * 1.4, Math.max(1, w * 0.012), bh * 1.4)
      }
      return true
    }
    case ENF.celeiro: {
      const bw = w, bh = w * 0.55
      ctx.fillStyle = shade("#b91c1c", luz)
      ctx.fillRect(x - bw / 2, y - bh, bw, bh)
      ctx.fillStyle = shade("#7f1d1d", luz)
      ctx.beginPath()
      ctx.moveTo(x - bw * 0.56, y - bh); ctx.lineTo(x - bw * 0.3, y - bh - w * 0.25)
      ctx.lineTo(x + bw * 0.3, y - bh - w * 0.25); ctx.lineTo(x + bw * 0.56, y - bh); ctx.closePath(); ctx.fill()
      if (w > 14) {
        ctx.strokeStyle = shade("#f8fafc", luz)
        ctx.lineWidth = Math.max(1, w * 0.02)
        const dx = x - bw * 0.15, dw = bw * 0.3, dh = bh * 0.6
        ctx.strokeRect(dx, y - dh, dw, dh)
        ctx.beginPath(); ctx.moveTo(dx, y - dh); ctx.lineTo(dx + dw, y); ctx.moveTo(dx + dw, y - dh); ctx.lineTo(dx, y); ctx.stroke()
      }
      return true
    }
    case ENF.quiosque: {
      // quiosque de praia: telhado de palha, balcão e a placa
      const bh = w * 0.4
      ctx.fillStyle = shade("#c2a26b", luz)
      ctx.fillRect(x - w * 0.42, y - bh, w * 0.84, bh)
      ctx.fillStyle = shade("#a16207", luz)
      ctx.beginPath()
      ctx.moveTo(x - w * 0.6, y - bh); ctx.lineTo(x, y - bh - w * 0.35); ctx.lineTo(x + w * 0.6, y - bh); ctx.closePath(); ctx.fill()
      ctx.fillStyle = noite ? "#fde68a" : shade("#f8fafc", luz)
      ctx.fillRect(x - w * 0.36, y - bh * 0.85, w * 0.72, bh * 0.25)
      if (w > 40) {
        ctx.fillStyle = "#14532d"
        ctx.font = `bold ${Math.round(bh * 0.2)}px 'Space Grotesk', 'Segoe UI', sans-serif`
        ctx.textAlign = "center"
        ctx.fillText("ÁGUA DE COCO", x, y - bh * 0.66)
        ctx.textAlign = "left"
      }
      return true
    }
    case ENF.guardaSol: {
      const h = w * 0.95
      ctx.fillStyle = shade("#e5e7eb", luz)
      ctx.fillRect(x - Math.max(0.5, w * 0.03), y - h, Math.max(1, w * 0.06), h)
      ctx.fillStyle = shade(de(GUARDA, seed), luz)
      ctx.beginPath(); ctx.arc(x, y - h, w * 0.55, Math.PI, 0); ctx.closePath(); ctx.fill()
      // cadeira de praia
      ctx.fillStyle = shade("#f8fafc", luz)
      ctx.fillRect(x + w * 0.15, y - w * 0.18, w * 0.35, Math.max(1, w * 0.05))
      return true
    }
    case ENF.calibrador: {
      // calibrador de pneu e água: poste azul com o visor e a mangueira enrolada
      const h = w * 1.6
      ctx.fillStyle = shade("#1d4ed8", Math.max(0.5, amb))
      rr(ctx, x - w * 0.18, y - h, w * 0.36, h, w * 0.05)
      ctx.fillStyle = noite ? "#bfdbfe" : shade("#e0f2fe", luz)
      ctx.fillRect(x - w * 0.12, y - h * 0.85, w * 0.24, h * 0.18)
      ctx.strokeStyle = shade("#0f172a", luz); ctx.lineWidth = Math.max(1, w * 0.05)
      ctx.beginPath(); ctx.arc(x + w * 0.28, y - h * 0.45, w * 0.14, 0, Math.PI * 2); ctx.stroke()
      if (w > 18) {
        ctx.fillStyle = "#f8fafc"; ctx.font = `bold ${Math.round(w * 0.16)}px 'Space Grotesk', 'Segoe UI', sans-serif`
        ctx.textAlign = "center"; ctx.fillText("AR", x, y - h * 0.5); ctx.textAlign = "left"
      }
      return true
    }
    case ENF.lavaRapido: {
      // lava-rápido: galpão aberto com os rolos de escova e o letreiro azul
      const bw = w, bh = w * 0.5
      ctx.fillStyle = shade("#e2e8f0", luz)
      ctx.fillRect(x - bw / 2, y - bh, bw, bh)
      ctx.fillStyle = shade("#1e293b", luz)
      ctx.fillRect(x - bw * 0.3, y - bh * 0.8, bw * 0.6, bh * 0.8) // boca do túnel de lavagem
      ctx.fillStyle = shade("#38bdf8", Math.max(0.5, amb))
      ctx.fillRect(x - bw * 0.22, y - bh * 0.75, bw * 0.08, bh * 0.7)
      ctx.fillRect(x + bw * 0.14, y - bh * 0.75, bw * 0.08, bh * 0.7)
      ctx.fillStyle = noite ? "#38bdf8" : shade("#0284c7", amb)
      ctx.fillRect(x - bw / 2, y - bh - w * 0.12, bw, w * 0.12)
      if (w > 40) {
        ctx.fillStyle = "#f8fafc"; ctx.font = `bold ${Math.round(w * 0.08)}px 'Space Grotesk', 'Segoe UI', sans-serif`
        ctx.textAlign = "center"; ctx.fillText("LAVA-RÁPIDO", x, y - bh - w * 0.035); ctx.textAlign = "left"
      }
      return true
    }
    case ENF.placaSaida: {
      // placa verde de SAÍDA do posto, com a seta para a pista
      const h = w * 2.2
      ctx.fillStyle = shade("#64748b", luz)
      ctx.fillRect(x - w * 0.04, y - h, w * 0.08, h)
      ctx.fillStyle = shade("#15803d", Math.max(0.55, amb))
      ctx.fillRect(x - w * 0.5, y - h - w * 0.45, w, w * 0.45)
      if (w > 16) {
        ctx.fillStyle = "#f8fafc"; ctx.font = `bold ${Math.round(w * 0.2)}px 'Space Grotesk', 'Segoe UI', sans-serif`
        ctx.textAlign = "center"; ctx.fillText("SAÍDA ←", x, y - h - w * 0.15); ctx.textAlign = "left"
      }
      return true
    }
    case ENF.guardRail: {
      // guard-rail metálico: postes e a lâmina com o reflexo
      const bh = w * 0.16
      ctx.fillStyle = shade("#64748b", luz)
      for (let i = 0; i <= 2; i++) ctx.fillRect(x - w / 2 + (w / 2) * i - Math.max(0.5, w * 0.01), y - bh, Math.max(1, w * 0.02), bh)
      ctx.fillStyle = shade("#cbd5e1", luz)
      ctx.fillRect(x - w / 2, y - bh * 0.95, w, Math.max(1, bh * 0.35))
      ctx.fillStyle = shade("#94a3b8", luz)
      ctx.fillRect(x - w / 2, y - bh * 0.62, w, Math.max(1, bh * 0.1))
      return true
    }
    case ENF.rocha: {
      // pedra grande de barranco
      ctx.fillStyle = shade(seed % 2 ? "#78716c" : "#6b7280", luz)
      ctx.beginPath()
      ctx.moveTo(x - w * 0.5, y); ctx.lineTo(x - w * 0.42, y - w * 0.35); ctx.lineTo(x - w * 0.1, y - w * 0.52)
      ctx.lineTo(x + w * 0.3, y - w * 0.44); ctx.lineTo(x + w * 0.5, y - w * 0.1); ctx.lineTo(x + w * 0.46, y)
      ctx.closePath(); ctx.fill()
      ctx.fillStyle = shade("#a8a29e", luz)
      ctx.beginPath(); ctx.moveTo(x - w * 0.1, y - w * 0.52); ctx.lineTo(x + w * 0.3, y - w * 0.44); ctx.lineTo(x + w * 0.05, y - w * 0.3); ctx.closePath(); ctx.fill()
      return true
    }
    case ENF.predioMedio: {
      // prédio residencial: varandas em faixas, janelas acesas à noite
      const bw = w, bh = w * (1.5 + (seed % 100) / 90)
      ctx.fillStyle = shade(de(PREDIOS, seed), luz)
      ctx.fillRect(x - bw / 2, y - bh, bw, bh)
      ctx.fillStyle = shade("#475569", luz)
      ctx.fillRect(x - bw / 2, y - bh, bw, Math.max(1, w * 0.04))
      if (w > 8) {
        const andar = Math.max(3, bh / Math.max(4, Math.floor(bh / (w * 0.18))))
        for (let wy = y - bh + andar * 0.6; wy < y - andar * 0.4; wy += andar) {
          ctx.fillStyle = shade("#64748b", luz)
          ctx.fillRect(x - bw / 2, wy + andar * 0.55, bw, Math.max(1, andar * 0.08)) // varanda
          if (w > 16) {
            for (let k = 0; k < 4; k++) {
              const acesa = noite && ((seed + k * 7 + Math.round((y - wy) / andar)) % 3 === 0) // pelo andar: não pisca
              ctx.fillStyle = acesa ? "#fde68a" : shade(noite ? "#1e293b" : "#93c5fd", luz)
              ctx.fillRect(x - bw / 2 + bw * (0.08 + k * 0.23), wy, bw * 0.14, andar * 0.42)
            }
          }
        }
      }
      // térreo com loja
      if (w > 20) {
        ctx.fillStyle = noite ? "#fef3c7" : shade("#fef3c7", luz)
        rr(ctx, x - bw * 0.42, y - w * 0.16, bw * 0.84, w * 0.13, w * 0.01)
      }
      return true
    }
  }
  return true
}
