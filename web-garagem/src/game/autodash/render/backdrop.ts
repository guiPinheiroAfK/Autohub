// AutoDash — render/backdrop.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { neonGlow } from "./textures"
import { drawTraffic } from "./objects"
import { AutoDashEngine, H, W, PLAYER_Z } from "../engine"
import { SEG_LEN } from "../data"
import { type LayerKind } from "../world/biomes"
import { dayFrac } from "../world/clock"
import { climaAtual } from "../sim/clima"
import { faseNoSeg } from "../world/montanha"
import { shade, mix, mixHex } from "../math"
import { rr } from "./primitives"
import { type Traffic } from "../traffic/types"

// Camadas de fundo (ADR 0011). Cada tipo é uma função; o bioma escolhe quais
// e em que ordem (longe → meio → perto). Adicionar um tipo = nova função + registro aqui.
const CAMADAS: Record<LayerKind, (eng: AutoDashEngine, amb: number) => void> = {
  "ceu-sol": camadaCeuSol,
  montanhas: camadaMontanhas,
  skyline: camadaSkyline,
  "brilho-urbano": camadaBrilhoUrbano,
  mar: camadaMar,
  palmeiras: camadaPalmeiras,
  pier: camadaPier,
  pinheiral: camadaPinheiral,
  colinas: camadaColinas,
}

export function renderBackdrop(eng: AutoDashEngine, amb: number) {
  const c = eng.bioma.camadas
  for (const k of c.longe) CAMADAS[k](eng, amb)
  // montanha: do mirante para baixo o mar aparece no fundo (o "reveal" do doc)
  if (eng.montanha) {
    const f = faseNoSeg(eng, Math.floor((eng.position + PLAYER_Z) / SEG_LEN) % eng.segments.length)
    if (f === "mirante" || f === "serraDescida" || f === "serraBase" || f === "costeira") camadaMar(eng, amb)
  }
  for (const k of c.meio) CAMADAS[k](eng, amb)
  for (const k of c.perto) CAMADAS[k](eng, amb)
  // troca de região: o fundo de antes some aos poucos por cima do novo
  // (antes era um corte seco escondido por uma escurecida)
  const ant = eng.biomaAnt
  if (ant && eng.biomaMix < 1) {
    const ctx = eng.ctx
    ctx.save()
    ctx.globalAlpha = 1 - eng.biomaMix
    for (const k of [...ant.camadas.longe, ...ant.camadas.meio, ...ant.camadas.perto]) if (k !== "ceu-sol") CAMADAS[k](eng, amb)
    ctx.restore()
  }
}

// céu, nuvens, sol e lua
function camadaCeuSol(eng: AutoDashEngine, amb: number) {
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
}

// montanhas em parallax (2 faixas)
function camadaMontanhas(eng: AutoDashEngine, amb: number) {
  const ctx = eng.ctx
  const hz = H * 0.5
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
}

// serra (Fase 8.5): encosta de pinheiros escuros na frente das montanhas.
// Parallax baixo (0,12): é fundo, não pode "virar junto" na curva.
function camadaPinheiral(eng: AutoDashEngine, amb: number) {
  const ctx = eng.ctx
  const hz = H * 0.5
  const wrap = W + 60
  ctx.fillStyle = shade("#13261d", Math.max(0.35, amb))
  ctx.fillRect(-10, hz - 10, W + 20, 14)
  for (let i = 0; i < 60; i++) {
    const x = (((i * 23 - eng.bgShift * 0.12) % wrap) + wrap) % wrap - 30
    const h = 16 + ((i * 41) % 22), lw = 5 + ((i * 7) % 5)
    ctx.fillStyle = shade(i % 3 === 0 ? "#0f2219" : "#163024", Math.max(0.35, amb))
    ctx.beginPath(); ctx.moveTo(x, hz - 6 - h); ctx.lineTo(x + lw, hz + 2); ctx.lineTo(x - lw, hz + 2); ctx.closePath(); ctx.fill()
  }
}

// rodovia (Fase 8.5): colinas suaves e verdes até o horizonte
function camadaColinas(eng: AutoDashEngine, amb: number) {
  const ctx = eng.ctx
  const hz = H * 0.5
  const faixa = (col: string, amp: number, shift: number, freq: number) => {
    ctx.fillStyle = col
    ctx.beginPath(); ctx.moveTo(-20, hz + 4)
    for (let x = -20; x <= W + 20; x += 14) {
      const k = x + shift
      ctx.lineTo(x, hz - (Math.sin(k * freq) * 0.5 + 0.5) * amp - 4)
    }
    ctx.lineTo(W + 20, hz + 4); ctx.closePath(); ctx.fill()
  }
  faixa(shade("#5b7c3a", amb * 0.85), 30, eng.bgShift * 0.08, 0.008)
  faixa(shade("#4d6b2f", amb * 0.9), 18, eng.bgShift * 0.14, 0.013)
}

// skyline com janelas acesas à noite
function camadaSkyline(eng: AutoDashEngine, amb: number) {
  const ctx = eng.ctx
  const hz = H * 0.5
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

// brilho de poluição luminosa no horizonte: névoa neon sobre o skyline. Só à noite.
function camadaBrilhoUrbano(eng: AutoDashEngine, amb: number) {
  if (amb >= 0.6) return
  const ctx = eng.ctx
  const hz = H * 0.5
  const g = ctx.createLinearGradient(0, hz - 46, 0, hz + 2)
  g.addColorStop(0, "rgba(217,70,239,0)")
  g.addColorStop(0.7, "rgba(217,70,239,0.16)")
  g.addColorStop(1, "rgba(251,113,133,0.22)")
  ctx.fillStyle = g
  ctx.fillRect(0, hz - 46, W, 48)
}

// Costa: o mar, as palmeiras e o píer são a mesma margem distante e andam
// juntos na curva. Antes as palmeiras corriam a 0,6 por cima de um mar a 0,25
// e o píer ficava parado na tela: a paisagem "escorregava" e dava enjoo.
// 16/11: 0,25 ainda "virava junto" na curva (mais que as montanhas da cidade,
// 0,18). O mar é a margem mais distante: quase parado.
const COSTA_PARALLAX = 0.08

// mar no horizonte: faixa de água com cintilação que anda com a pista
function camadaMar(eng: AutoDashEngine, amb: number) {
  const ctx = eng.ctx
  const hz = H * 0.5
  const g = ctx.createLinearGradient(0, hz - 52, 0, hz + 2)
  g.addColorStop(0, shade("#0b4a5e", amb))
  g.addColorStop(1, shade("#1b8aa6", amb))
  ctx.fillStyle = g
  ctx.fillRect(-20, hz - 52, W + 40, 54)
  ctx.fillStyle = `rgba(224,242,254,${Math.max(0.08, amb * 0.22)})`
  const wrapM = W + 60
  for (let i = 0; i < 26; i++) {
    const x = (((i * 97 - eng.bgShift * COSTA_PARALLAX) % wrapM) + wrapM) % wrapM - 30
    ctx.fillRect(x, hz - 46 + ((i * 29) % 40), 14 + ((i * 7) % 16), 1.5)
  }
}

// fileira de palmeiras contra o mar (rola devagar com a pista, junto com o mar)
function camadaPalmeiras(eng: AutoDashEngine, amb: number) {
  const ctx = eng.ctx
  const hz = H * 0.5
  const wrap = W + 120
  const cor = shade("#0d3b2e", Math.max(0.35, amb))
  ctx.strokeStyle = cor
  for (let i = 0; i < 12; i++) {
    const x = (((i * 131 - eng.bgShift * COSTA_PARALLAX) % wrap) + wrap) % wrap - 60
    const h = 40 + ((i * 53) % 26)
    const lean = ((i % 3) - 1) * 10
    const tx = x + lean, ty = hz - h
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(x, hz + 4); ctx.quadraticCurveTo(x + lean * 0.2, hz - h * 0.5, tx, ty); ctx.stroke()
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let f = 0; f < 5; f++) {
      const a = Math.PI + (f / 4) * Math.PI
      const fx = tx + Math.cos(a) * 16, fy = ty + Math.sin(a) * 7 + 4
      ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + (fx - tx) * 0.5, ty - 8, fx, fy)
    }
    ctx.stroke()
  }
}

// píer de madeira entrando no mar (anda com o mar; começa à esquerda do horizonte)
function camadaPier(eng: AutoDashEngine, amb: number) {
  const ctx = eng.ctx
  const hz = H * 0.5
  const larg = W * 0.18, wrap = W * 2.2
  const x0 = (((W * 0.12 + larg - eng.bgShift * COSTA_PARALLAX) % wrap) + wrap) % wrap - larg, x1 = x0 + larg
  ctx.fillStyle = shade("#6b4f35", Math.max(0.4, amb))
  ctx.fillRect(x0, hz - 6, x1 - x0, 4)
  ctx.fillStyle = shade("#3f2d1d", Math.max(0.4, amb))
  for (let x = x0; x <= x1; x += 22) ctx.fillRect(x, hz - 2, 3, 12)
  if (amb < 0.6) {
    ctx.fillStyle = "rgba(253,224,71,0.8)"
    for (let x = x0 + 10; x < x1; x += 60) ctx.fillRect(x, hz - 9, 2, 3)
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
      // halo via sprite cacheado (só de perto: em Shinjuku há um a cada 3 segmentos)
      if (w > 40) {
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

    // janelas por ANDAR e COLUNA (playtest 16/11: "otimizar os vidros"): antes o
    // padrão vinha da posição na tela (wx, wy) e as janelas piscavam com o prédio
    // andando. Agora: uma faixa de vidro por andar e as acesas pelo índice.
    if (w > 6) {
      const andares = Math.max(3, Math.floor(h / Math.max(3, bw * 0.16)))
      const ah = (h - bw * 0.24) / andares
      ctx.fillStyle = lit ? "rgba(30,41,59,0.9)" : shade("#5b7a99", Math.max(0.4, amb))
      for (let a = 0; a < andares; a += 1) ctx.fillRect(x - bw * 0.42, y - h + bw * 0.12 + a * ah, bw * 0.84, ah * 0.55)
      if (lit && w > 10) {
        for (let a = 0; a < andares; a++) for (let c = 0; c < 4; c++) {
          if ((a * 7 + c * 3 + seed) % 5 !== 0) continue
          ctx.fillStyle = (a + c) % 3 === 0 ? "rgba(255,214,153,0.75)" : "rgba(226,240,255,0.7)"
          ctx.fillRect(x - bw * 0.42 + c * bw * 0.21 + bw * 0.01, y - h + bw * 0.12 + a * ah, bw * 0.19, ah * 0.55)
        }
      }
    }
    return
  }
  if (kind === 7) { // palmeira de beira (bioma costa): tronco curvo e folhas
    const h = w * 2.6
    const lean = w * 0.35
    ctx.strokeStyle = shade("#6b4f35", amb)
    ctx.lineWidth = Math.max(1, w * 0.12)
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 0.2, y - h * 0.5, x + lean, y - h); ctx.stroke()
    ctx.strokeStyle = shade("#14532d", amb)
    ctx.lineWidth = Math.max(1, w * 0.09)
    ctx.beginPath()
    for (let f = 0; f < 6; f++) {
      const a = Math.PI + (f / 5) * Math.PI
      const fx = x + lean + Math.cos(a) * w * 0.9, fy = y - h + Math.sin(a) * w * 0.35 + w * 0.2
      ctx.moveTo(x + lean, y - h); ctx.quadraticCurveTo(x + lean + (fx - x - lean) * 0.5, y - h - w * 0.5, fx, fy)
    }
    ctx.stroke()
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

export function drawBridge(eng: AutoDashEngine, x: number, y: number, w: number, amb: number, comElevado = false) {
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
  // pichação nos dois pilares de dentro (Fase 8.6): rabiscos coloridos fixos
  if (w > 6) {
    const tags: [number, string, string][] = [[x - w * 1.66, "#f472b6", "#22d3ee"], [x + w * 1.42, "#a3e635", "#f59e0b"]]
    for (const [px, c1, c2] of tags) {
      const pw = w * 0.26, by = y - w * 0.32
      ctx.lineWidth = Math.max(1, w * 0.018)
      ctx.strokeStyle = shade(c1, Math.max(0.55, amb))
      ctx.beginPath()
      ctx.moveTo(px + pw * 0.08, by)
      ctx.bezierCurveTo(px + pw * 0.3, by - w * 0.14, px + pw * 0.45, by + w * 0.08, px + pw * 0.62, by - w * 0.1)
      ctx.lineTo(px + pw * 0.9, by - w * 0.02)
      ctx.stroke()
      ctx.strokeStyle = shade(c2, Math.max(0.55, amb))
      ctx.beginPath()
      ctx.moveTo(px + pw * 0.12, by + w * 0.08)
      ctx.quadraticCurveTo(px + pw * 0.5, by - w * 0.04, px + pw * 0.85, by + w * 0.1)
      ctx.stroke()
    }
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
  // juntas de dilatação na face do tabuleiro
  ctx.fillStyle = deep
  for (let i = 1; i < 6; i++) ctx.fillRect(L + (R - L) * (i / 6) - Math.max(0.5, w * 0.006), deckY, Math.max(1, w * 0.012), deckH)

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
  // postes de luz no guarda-corpo; à noite, a luz lava o tabuleiro e a pista embaixo
  const noite = amb < 0.62
  for (let i = 0; i < 5; i++) {
    const lx = L + (R - L) * ((i + 0.5) / 5), lh = w * 0.55
    ctx.fillStyle = dark
    ctx.fillRect(lx - Math.max(0.5, w * 0.01), railY - lh, Math.max(1, w * 0.02), lh)
    ctx.fillRect(lx, railY - lh, w * 0.12, Math.max(1, w * 0.02))
    if (noite) {
      ctx.fillStyle = "rgba(255,226,150,0.95)"
      ctx.fillRect(lx + w * 0.07, railY - lh, w * 0.06, Math.max(1, w * 0.025))
      const g = ctx.createRadialGradient(lx + w * 0.1, railY - lh, 1, lx + w * 0.1, railY - lh, w * 0.5)
      g.addColorStop(0, "rgba(255,226,150,0.35)"); g.addColorStop(1, "rgba(255,226,150,0)")
      ctx.fillStyle = g
      ctx.fillRect(lx - w * 0.4, railY - lh - w * 0.5, w, w)
    }
  }
  if (noite) { // luz de baixo do viaduto na pista
    ctx.fillStyle = "rgba(255,226,150,0.08)"
    ctx.fillRect(x - w * 1.2, deckY + deckH, w * 2.4, y - deckY - deckH)
  }

  // ALÇA DE DESCIDA à direita: rampa saindo do tabuleiro até o nível da via —
  // o "motivo" do viaduto. Com o elevado (Fase 8.6) a alça de verdade é ele.
  const rampTopY = deckY + deckH * 0.35
  const r1x = x + w * 2.25, r2x = x + w * 3.15, r3x = x + w * 4.75, r4x = x + w * 3.85
  if (!comElevado) {
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
  }

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
    if (!comElevado) drawTraffic(eng, 
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
  const novo = ceuDoBioma(eng, eng.bioma)
  const ant = eng.biomaAnt
  if (!ant || eng.biomaMix >= 1) return novo
  // troca de região: o céu passa de um para o outro
  const velho = ceuDoBioma(eng, ant), k = eng.biomaMix
  return { top: mixHex(velho.top, novo.top, k), bot: mixHex(velho.bot, novo.bot, k), amb: velho.amb + (novo.amb - velho.amb) * k }
}

function ceuDoBioma(eng: AutoDashEngine, bio: AutoDashEngine["bioma"]) : { top: string; bot: string; amb: number } {
  // corrida à noite (padrão) mantém o céu neon fixo do bioma — o clima
  // "Velozes e Furiosos" vive de racha noturno. Os outros horários e o solo
  // seguem o relógio em ticks (ADR 0013) pelas chaves de céu do bioma.
  const cl = climaAtual(eng) // já misturado na troca de clima
  let top: string, bot: string, amb: number
  if (eng.mode === "race" && eng.horaModo === "noite") {
    const cr = bio.ceuCorrida
    top = cr.top; bot = cr.bot; amb = cl.chuva ? cr.ambChuva : cr.amb * cl.amb
  } else {
    // as chaves do bioma foram feitas com 0 = começo da manhã; o relógio usa
    // 0 = amanhecer (6h). O deslocamento de 0,125 deixa 12h no "dia", 18h no
    // "pôr do sol", 0h na "noite" e 6h no "amanhecer".
    const t = (dayFrac(eng.clock.tick) - 0.125 + 1) % 1
    const keys = bio.ceu
    let a = keys[keys.length - 1], b = keys[0], p = 0
    for (let i = 0; i < keys.length; i++) {
      const k1 = keys[i], k2 = keys[(i + 1) % keys.length]
      const t2 = k2.t > k1.t ? k2.t : k2.t + 1
      const tt = t >= k1.t ? t : t + 1
      if (tt >= k1.t && tt <= t2) { a = k1; b = k2; p = (tt - k1.t) / (t2 - k1.t); break }
    }
    top = mix(a.top, b.top, p); bot = mix(a.bot, b.bot, p)
    amb = (a.amb + (b.amb - a.amb) * p) * cl.amb
  }
  // nublado e neblina puxam o céu pro cinza (claro de dia, chumbo à noite)
  if (cl.cinza > 0) {
    const cz = amb > 0.6 ? "#8b94a3" : "#262b36"
    top = mixHex(top, cz, cl.cinza); bot = mixHex(bot, cz, cl.cinza * 0.8)
  }
  return { top, bot, amb }
}
