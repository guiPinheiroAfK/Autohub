// AutoDash — render/backdrop.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { neonGlow } from "./textures"
import { drawTraffic } from "./objects"
import { AutoDashEngine, H, W, SKY_KEYS } from "../engine"
import { shade, mix } from "../math"
import { rr } from "./primitives"
import { type Traffic } from "../traffic/types"

export function renderBackdrop(eng: AutoDashEngine, amb: number) {
  const ctx = eng.ctx
  const hz = H * 0.5
  // nuvens macias em parallax
  const ca = Math.max(0.05, amb * 0.35)
  const wrapC = W + 220
  for (const cl of eng.clouds) {
    const x = (((cl.x - eng.bgShift * 0.05 - eng.km * 160) % wrapC) + wrapC) % wrapC - 110
    const cg = ctx.createRadialGradient(x, cl.y, 4, x, cl.y, cl.s)
    cg.addColorStop(0, `rgba(255,255,255,${ca})`)
    cg.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = cg
    ctx.beginPath(); ctx.ellipse(x, cl.y, cl.s * 1.7, cl.s * 0.55, 0, 0, Math.PI * 2); ctx.fill()
  }
  // sol / lua
  if (amb > 0.62) {
    const sg = ctx.createRadialGradient(W * 0.78, hz - 105, 8, W * 0.78, hz - 105, 70)
    sg.addColorStop(0, "rgba(255,240,190,0.9)")
    sg.addColorStop(0.4, "rgba(255,220,130,0.35)")
    sg.addColorStop(1, "rgba(255,220,130,0)")
    ctx.fillStyle = sg
    ctx.beginPath(); ctx.arc(W * 0.78, hz - 105, 70, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.fillStyle = "rgba(226,232,240,0.85)"
    ctx.beginPath(); ctx.arc(W * 0.24, hz - 120, 22, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = "rgba(148,163,184,0.5)"
    ctx.beginPath(); ctx.arc(W * 0.24 - 7, hz - 126, 5, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(W * 0.24 + 6, hz - 114, 3.5, 0, Math.PI * 2); ctx.fill()
  }
  // montanhas em parallax (2 camadas)
  const ridge = (col: string, amp: number, base: number, shift: number, step: number) => {
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.moveTo(-20, base + 4)
    for (let x = -20; x <= W + 20; x += step) {
      const k = x + shift
      const yy = base - Math.abs(Math.sin(k * 0.012) * 0.6 + Math.sin(k * 0.031) * 0.4) * amp
      ctx.lineTo(x, yy)
    }
    ctx.lineTo(W + 20, base + 4)
    ctx.closePath()
    ctx.fill()
  }
  ridge(shade("#2b3c56", amb), 72, hz + 2, eng.bgShift * 0.18, 16)
  ridge(shade("#1e2c40", amb), 46, hz + 3, eng.bgShift * 0.42, 12)
  // metrópole neon ATRÁS do skyline base (torres altas, letreiros) — só corrida
  // if (eng.mode === "race") eng.renderNeonCity(hz) - isso aq eu removi por causa de otimização
  // skyline com janelas acesas à noite
  const wrap = W + 90
  for (let i = 0; i < 24; i++) {
    const bw = 20 + ((i * 37) % 28)
    const bh = 22 + ((i * 53) % 48)
    let bx = (((i * 67 - eng.bgShift * 0.7) % wrap) + wrap) % wrap - 45
    ctx.fillStyle = shade("#131b2a", Math.max(0.35, amb))
    ctx.fillRect(bx, hz - bh + 4, bw, bh)
    if (amb < 0.6) {
      ctx.fillStyle = "rgba(253,224,71,0.45)"
      for (let wy = hz - bh + 9; wy < hz - 3; wy += 9) {
        ctx.fillRect(bx + 3 + ((i + wy) % 3) * 5, wy, 3, 4)
      }
    }
  }
}

export function drawDeco(eng: AutoDashEngine, kind: number, dir: number, x: number, y: number, w: number, amb: number) {
  if (w < 1.5) return
  const ctx = eng.ctx
  // paleta quente+neon de rua de Tokyo (Shibuya/Kabukicho).
  // `paleta()` NUNCA devolve undefined: um addColorStop com cor inválida
  // lança e derruba o render inteiro (tela congelada), então índice quebrado
  // cai no vermelho-lanterna em vez de matar o frame.
  const TOKYO = ["#e03131", "#fff3d6", "#ffd43b", "#ff2d95", "#22d3ee", "#ff8c42"]
  const paleta = (i: number) =>
    TOKYO[((Math.trunc(i) % TOKYO.length) + TOKYO.length) % TOKYO.length] ?? TOKYO[0]
  if (kind === 4) { // fachada baixa colada na borda, com letreiros horizontais empilhados
    const cor = paleta(dir)
    const bw = w * 0.85
    const h = bw * 1.2 // bloco baixo: altura ~1.2x a largura
    // corpo do prédio
    ctx.fillStyle = shade("#181022", Math.max(0.4, amb))
    ctx.fillRect(x - bw / 2, y - h, bw, h)
    // 4 a 6 barras horizontais de letreiro empilhadas, cada uma de cor diferente
    const seed = (dir * 2654435761) >>> 0
    const bars = 4 + (seed % 3)
    const barH = h / bars
    // barras chapadas — sem gradiente por barra (era o gargalo)
    for (let i = 0; i < bars; i++) {
      const by = y - h + i * barH
      ctx.fillStyle = paleta(dir + i)
      ctx.fillRect(x - bw / 2 + bw * 0.06, by + barH * 0.18, bw * 0.88, barH * 0.64)
    }
    // UM brilho pra fachada inteira, via sprite cacheado, e só quando é
    // grande o bastante pra aparecer
    if (w > 10) {
      const gw = bw * 2.4
      ctx.drawImage(neonGlow(eng, cor), x - gw / 2, y - h - gw * 0.18, gw, gw * 0.9)
    }
    // reflexo no asfalto (cor do letreiro dominante, alpha baixo)
    ctx.fillStyle = cor + "33"
    ctx.beginPath(); ctx.ellipse(x, y, w * 0.7, w * 0.14, 0, 0, Math.PI * 2); ctx.fill()
    return
  }
  if (kind === 5) { // blade sign vertical saindo da fachada, piscando devagar
    const cor = paleta(dir)
    const h = w * 3.4
    const bw = w * 0.22
    ctx.fillStyle = shade("#0d0a14", Math.max(0.4, amb))
    ctx.fillRect(x - bw / 2, y - h, bw, h)
    const on = Math.floor(performance.now() / 700 + dir) % 4 !== 0
    if (on) {
      ctx.fillStyle = cor
      ctx.fillRect(x - bw * 0.38, y - h + bw * 0.3, bw * 0.76, h - bw * 0.6)
      // traços claros simulando caracteres — só de perto (some no horizonte,
      // onde viravam ruído caro de qualquer jeito)
      if (w > 12) {
        ctx.strokeStyle = "rgba(255,255,255,0.85)"
        ctx.lineWidth = Math.max(1, bw * 0.09)
        ctx.beginPath()
        const rows = 6
        for (let r = 0; r < rows; r++) {
          const cy = y - h + bw * 0.5 + (h - bw) * (r + 0.5) / rows
          ctx.moveTo(x - bw * 0.22, cy - bw * 0.12)
          ctx.lineTo(x + bw * 0.22, cy - bw * 0.12)
          ctx.moveTo(x, cy - bw * 0.2)
          ctx.lineTo(x, cy + bw * 0.2)
        }
        ctx.stroke() // um stroke só pros 6 caracteres, não 6 strokes
      }
      // halo via sprite cacheado
      if (w > 8) {
        const gw = w * 2.6
        ctx.drawImage(neonGlow(eng, cor), x - gw / 2, y - h * 0.5 - gw / 2, gw, gw)
      }
      // reflexo no asfalto
      ctx.fillStyle = cor + "33"
      ctx.beginPath(); ctx.ellipse(x, y, w * 0.5, w * 0.12, 0, 0, Math.PI * 2); ctx.fill()
    }
    return
  }
  if (kind === 6) { // prédio alto de fundo de rua, com janelas acesas
    const seed = (dir * 2654435761) >>> 0
    const h = w * (5 + (seed % 700) / 100)
    const bw = w * (0.8 + ((seed >> 8) % 60) / 100)
    const lit = amb < 0.62

    ctx.fillStyle = shade(seed % 2 === 0 ? "#0b0f1a" : "#11101f", Math.max(0.4, amb))
    ctx.fillRect(x - bw / 2, y - h, bw, h)

    // janelas só de perto: no horizonte viram sub-pixel e custam à toa
    if (lit && w > 6) {
      for (let wy = y - h + bw * 0.12; wy < y - bw * 0.12; wy += Math.max(3, bw * 0.16)) {
        for (let wx = x - bw / 2 + bw * 0.08; wx < x + bw / 2 - bw * 0.05; wx += Math.max(3, bw * 0.22)) {
          if (Math.floor(seed + wx * 3 + wy * 7) % 5 === 0) {
            ctx.fillStyle = (wx + wy) % 4 === 0 ? "rgba(255,214,153,0.5)" : "rgba(226,240,255,0.5)"
            ctx.fillRect(wx, wy, Math.max(1, bw * 0.05), Math.max(1, bw * 0.06))
          }
        }
      }
    }
    return
  }
  if (kind === 0) { // árvore
    const h = w * 2.4
    ctx.fillStyle = shade("#4a3524", amb)
    ctx.fillRect(x - w * 0.07, y - h * 0.32, w * 0.14, h * 0.32)
    ctx.fillStyle = shade("#14532d", amb)
    ctx.beginPath()
    ctx.moveTo(x, y - h); ctx.lineTo(x + w * 0.5, y - h * 0.28); ctx.lineTo(x - w * 0.5, y - h * 0.28)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = shade("#166534", amb)
    ctx.beginPath()
    ctx.moveTo(x, y - h * 0.78); ctx.lineTo(x + w * 0.38, y - h * 0.22); ctx.lineTo(x - w * 0.38, y - h * 0.22)
    ctx.closePath(); ctx.fill()
  } else if (kind === 1) { // poste
    const h = w * 11
    ctx.fillStyle = shade("#475569", amb)
    ctx.fillRect(x - w * 0.4, y - h, w * 0.8, h)
    ctx.fillRect(x - w * 0.4, y - h, w * 3.4, w * 0.8)
    if (amb < 0.62) {
      const lg = ctx.createRadialGradient(x + w * 3, y - h + w, 1, x + w * 3, y - h + w, w * 5)
      lg.addColorStop(0, "rgba(255,235,160,0.8)")
      lg.addColorStop(1, "rgba(255,235,160,0)")
      ctx.fillStyle = lg
      ctx.beginPath(); ctx.arc(x + w * 3, y - h + w, w * 5, 0, Math.PI * 2); ctx.fill()
    }
  } else if (kind === 2) { // outdoor
    const h = w * 0.55
    ctx.fillStyle = shade("#334155", amb)
    ctx.fillRect(x - w * 0.32, y - h * 1.2, w * 0.08, h * 1.2)
    ctx.fillRect(x + w * 0.24, y - h * 1.2, w * 0.08, h * 1.2)
    ctx.fillStyle = shade("#0f172a", Math.max(0.5, amb))
    ctx.fillRect(x - w / 2, y - h * 2.1, w, h)
    ctx.strokeStyle = shade("#e0342f", amb + 0.2)
    ctx.lineWidth = Math.max(1, w * 0.02)
    ctx.strokeRect(x - w / 2, y - h * 2.1, w, h)
    if (w > 34) {
      ctx.fillStyle = shade("#e0342f", amb + 0.25)
      ctx.font = `900 ${h * 0.42}px 'Space Grotesk', 'Segoe UI', sans-serif`
      ctx.textAlign = "center"
      ctx.fillText("AUTOHUB", x, y - h * 1.55)
      ctx.textAlign = "left"
    }
  } else { // chevron de curva
    const h = w * 1.1
    ctx.fillStyle = shade("#64748b", amb)
    ctx.fillRect(x - w * 0.05, y - h * 1.7, w * 0.1, h * 0.75)
    ctx.fillStyle = shade("#facc15", Math.min(1, amb + 0.3))
    rr(ctx, x - w / 2, y - h * 2.4, w, h * 0.75, w * 0.08)
    ctx.strokeStyle = shade("#0f172a", 1)
    ctx.lineWidth = Math.max(1.5, w * 0.09)
    const cy = y - h * 2.02
    for (const off of [-w * 0.22, w * 0.08]) {
      ctx.beginPath()
      ctx.moveTo(x + off - dir * w * 0.1, cy - h * 0.2)
      ctx.lineTo(x + off + dir * w * 0.12, cy)
      ctx.lineTo(x + off - dir * w * 0.1, cy + h * 0.2)
      ctx.stroke()
    }
  }
}

export function drawBridge(eng: AutoDashEngine, x: number, y: number, w: number, amb: number) {
  const ctx = eng.ctx
  // paleta em camadas: topo claro, face frontal média, sombra por baixo —
  // é o que dá volume. Antes era tudo o mesmo cinza chapado.
  const top = shade("#a7b0c0", amb)
  const face = shade("#8b95a8", amb * 0.92)
  const dark = shade("#5b657d", amb * 0.8)
  const deep = shade("#3c4459", amb * 0.7)
  const ph = w * 1.62, deckH = w * 0.26
  const deckY = y - ph - deckH
  const L = x - w * 3.6, R = x + w * 3.6

  // sombra do viaduto projetada na pista (elipse achatada) — ancora ele no chão
  ctx.fillStyle = `rgba(0,0,0,${0.22 + (1 - amb) * 0.14})`
  ctx.beginPath(); ctx.ellipse(x, y + w * 0.04, w * 3.5, w * 0.16, 0, 0, Math.PI * 2); ctx.fill()

  // pilares: base alargada, fuste e capitel (SÓ fora da pista, que vai de -w a +w)
  for (const px of [x - w * 3.05, x - w * 1.66, x + w * 1.42, x + w * 2.81]) {
    const pw = w * 0.26
    ctx.fillStyle = face
    ctx.fillRect(px, y - ph, pw, ph)
    ctx.fillStyle = dark // lateral sombreada do fuste
    ctx.fillRect(px + pw * 0.66, y - ph, pw * 0.34, ph)
    ctx.fillStyle = dark // base
    ctx.fillRect(px - pw * 0.22, y - w * 0.1, pw * 1.44, w * 0.1)
    ctx.fillStyle = top // capitel
    ctx.fillRect(px - pw * 0.3, y - ph - w * 0.09, pw * 1.6, w * 0.09)
  }

  // vigas longitudinais sob o tabuleiro (a "estrutura" que segura o vão)
  ctx.fillStyle = deep
  ctx.fillRect(L, deckY + deckH, R - L, w * 0.11)
  ctx.fillStyle = dark
  for (let i = 0; i <= 12; i++) { // transversinas
    const bx = L + (R - L) * (i / 12)
    ctx.fillRect(bx - w * 0.02, deckY + deckH, w * 0.04, w * 0.11)
  }

  // tabuleiro: face frontal + fio claro no topo (espessura legível)
  ctx.fillStyle = face
  ctx.fillRect(L, deckY, R - L, deckH)
  ctx.fillStyle = top
  ctx.fillRect(L, deckY, R - L, deckH * 0.3)

  // guarda-corpo com balaústres, em cima do tabuleiro
  const railY = deckY - w * 0.16
  ctx.fillStyle = dark
  ctx.fillRect(L, railY, R - L, w * 0.05)
  if (w > 8) {
    for (let i = 0; i <= 26; i++) {
      const bx = L + (R - L) * (i / 26)
      ctx.fillRect(bx - w * 0.012, railY, w * 0.024, w * 0.16)
    }
  }

  // ALÇA DE DESCIDA à direita: rampa saindo do tabuleiro até o nível da via —
  // o "motivo" do viaduto. Agora com espessura, guard-rail e faixa de borda.
  const rampTopY = deckY + deckH * 0.35
  const r1x = x + w * 2.25, r2x = x + w * 3.15, r3x = x + w * 4.75, r4x = x + w * 3.85
  ctx.fillStyle = face
  ctx.beginPath()
  ctx.moveTo(r1x, rampTopY); ctx.lineTo(r2x, rampTopY)
  ctx.lineTo(r3x, y); ctx.lineTo(r4x, y)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = deep // espessura da laje da rampa
  ctx.beginPath()
  ctx.moveTo(r4x, y); ctx.lineTo(r3x, y)
  ctx.lineTo(r3x + w * 0.06, y + w * 0.09); ctx.lineTo(r4x + w * 0.06, y + w * 0.09)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = top // guard-rail da alça
  ctx.lineWidth = Math.max(1, w * 0.045)
  ctx.beginPath()
  ctx.moveTo(r1x, rampTopY - w * 0.12); ctx.lineTo(r4x, y - w * 0.12)
  ctx.stroke()

  // CARROS DE VERDADE em cima do viaduto e descendo a alça — mesmo desenho do
  // trânsito (carroceria, vidro, lanternas). É o que dá a sensação de trânsito
  // real cruzando por cima e entrando na sua via.
  if (w > 10) {
    const carW = w * 0.4
    const fake = (color: string): Traffic => ({
      z: 0, offset: 0, targetOffset: 0, speed: 90, kind: "car",
      role: "civilian", color, blinkT: 0, prevD: 1,
    })
    const t1 = (performance.now() / 3400) % 1
    const t2 = (performance.now() / 4100 + 0.5) % 1
    drawTraffic(eng, fake("#e2e8f0"), L + (R - L) * t1, deckY + deckH * 0.1, carW, amb * 0.9)
    drawTraffic(eng, fake("#64748b"), R - (R - L) * t2, deckY + deckH * 0.1, carW, amb * 0.9)
    const p = (performance.now() / 2800) % 1
    drawTraffic(eng, 
        fake("#eab308"),
        r1x + (r4x - r1x) * p,
        rampTopY + (y - rampTopY) * p,
        carW * (0.9 + 0.3 * p), amb * 0.95,
    )
  }
}

export function drawTower(eng: AutoDashEngine, x: number, y: number, w: number, amb: number) {
  const ctx = eng.ctx
  const red = shade("#c0392b", amb)
  const dark = shade("#8f2a20", amb * 0.9)
  const ph = w * 3.3 // BEM mais alta que o viaduto — escala de ponte suspensa
  // pernas
  ctx.fillStyle = red
  ctx.fillRect(x - w * 1.34, y - ph, w * 0.26, ph)
  ctx.fillRect(x + w * 1.08, y - ph, w * 0.26, ph)
  // travessas (três, estilo GG)
  ctx.fillStyle = dark
  ctx.fillRect(x - w * 1.34, y - ph, w * 2.68, w * 0.16)
  ctx.fillRect(x - w * 1.34, y - ph * 0.66, w * 2.68, w * 0.13)
  ctx.fillRect(x - w * 1.34, y - ph * 0.36, w * 2.68, w * 0.12)
  // cabos principais descendo das pontas da torre
  ctx.strokeStyle = red
  ctx.lineWidth = Math.max(1, w * 0.05)
  ctx.beginPath()
  ctx.moveTo(x - w * 1.21, y - ph); ctx.quadraticCurveTo(x - w * 2.6, y - ph * 0.55, x - w * 4.2, y - ph * 0.28)
  ctx.moveTo(x + w * 1.21, y - ph); ctx.quadraticCurveTo(x + w * 2.6, y - ph * 0.55, x + w * 4.2, y - ph * 0.28)
  ctx.stroke()
}

export function skyNow(eng: AutoDashEngine) : { top: string; bot: string; amb: number } {
  // corrida é SEMPRE noite neon — o clima "Velozes e Furiosos" vive de racha
  // noturno. Céu roxo-profundo com barra magenta no horizonte (poluição
  // luminosa da cidade), sem o ciclo de dia do modo solo.
  if (eng.mode === "race") {
    return { top: "#0a0618", bot: "#2a1140", amb: eng.raining ? 0.34 : 0.44 }
  }
  const t = (eng.km % 10) / 10
  const keys = SKY_KEYS
  let a = keys[keys.length - 1], b = keys[0], p = 0
  for (let i = 0; i < keys.length; i++) {
    const k1 = keys[i], k2 = keys[(i + 1) % keys.length]
    const t2 = k2.t > k1.t ? k2.t : k2.t + 1
    const tt = t >= k1.t ? t : t + 1
    if (tt >= k1.t && tt <= t2) { a = k1; b = k2; p = (tt - k1.t) / (t2 - k1.t); break }
  }
  const amb = a.amb + (b.amb - a.amb) * p
  return { top: mix(a.top, b.top, p), bot: mix(a.bot, b.bot, p), amb: eng.raining ? amb * 0.8 : amb }
}
