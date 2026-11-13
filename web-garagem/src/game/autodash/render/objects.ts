// AutoDash — render/objects.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, type Pickup, PU_NITRO, PU_SHIELD, type Obstacle, type RoadSign } from "../engine"
import { shade, clamp } from "../math"
import { CARS, type CarCustom, PAINTS } from "../data"
import { drawPlayerCar, rr } from "./primitives"
import { type Traffic, KINDS } from "../traffic/types"

export function drawPickup(eng: AutoDashEngine, p: Pickup, x: number, y: number, w: number, amb: number) {
  if (w < 2.5) return
  const ctx = eng.ctx
  const r = w * (1 + Math.sin(p.pulse) * 0.12)
  const c = p.type === PU_NITRO ? "#38bdf8" : p.type === PU_SHIELD ? "#60a5fa" : "#fde047"
  const cy = y - r * 1.4
  const halo = ctx.createRadialGradient(x, cy, 2, x, cy, r * 2.4)
  halo.addColorStop(0, c + "66")
  halo.addColorStop(1, c + "00")
  ctx.fillStyle = halo
  ctx.beginPath(); ctx.arc(x, cy, r * 2.4, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = shade("#0f172a", Math.max(0.6, amb))
  ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = c
  ctx.lineWidth = Math.max(1.5, r * 0.14)
  ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = c
  if (p.type === PU_NITRO) {
    ctx.beginPath()
    ctx.moveTo(x + r * 0.18, cy - r * 0.55)
    ctx.lineTo(x - r * 0.42, cy + r * 0.12)
    ctx.lineTo(x - r * 0.05, cy + r * 0.12)
    ctx.lineTo(x - r * 0.18, cy + r * 0.55)
    ctx.lineTo(x + r * 0.42, cy - r * 0.12)
    ctx.lineTo(x + r * 0.05, cy - r * 0.12)
    ctx.closePath(); ctx.fill()
  } else if (p.type === PU_SHIELD) {
    ctx.beginPath()
    ctx.moveTo(x, cy - r * 0.5)
    ctx.lineTo(x + r * 0.45, cy - r * 0.25)
    ctx.lineTo(x + r * 0.45, cy + r * 0.1)
    ctx.lineTo(x, cy + r * 0.55)
    ctx.lineTo(x - r * 0.45, cy + r * 0.1)
    ctx.lineTo(x - r * 0.45, cy - r * 0.25)
    ctx.closePath(); ctx.fill()
  } else {
    ctx.font = `bold ${Math.max(8, r * 0.9)}px 'Space Grotesk', 'Segoe UI', sans-serif`
    ctx.textAlign = "center"
    ctx.fillText("2X", x, cy + r * 0.32)
    ctx.textAlign = "left"
  }
}

export function drawGhost(eng: AutoDashEngine, x: number, y: number, w: number, amb: number) {
  if (w < 24) return
  const ctx = eng.ctx
  const d = eng.duel
  const opp = d?.opp
  const spec = CARS[clamp(Math.floor(opp?.car ?? 0), 0, CARS.length - 1)]
  const custom: CarCustom = {
    paint: clamp(Math.floor(opp?.paint ?? 0), 0, PAINTS.length - 1),
    stripe: 0, neon: 0, wheel: 0,
    wing: spec.body === "muscle" || spec.body === "ninja" ? 1 : 2,
  }
  ctx.save()
  ctx.globalAlpha = 0.55
  drawPlayerCar(ctx, x, y, spec, custom, 0, false, amb, false, w / 640)
  ctx.restore()
  const carW = spec.width * w
  if (carW > 34 && d) {
    ctx.fillStyle = "rgba(56,189,248,0.95)"
    ctx.font = `bold ${Math.max(9, carW * 0.14)}px 'Space Grotesk', sans-serif`
    ctx.textAlign = "center"
    ctx.fillText(d.oppName || "RIVAL", x, y - carW * 0.72)
    ctx.textAlign = "left"
  }
}

export function drawObstacle(eng: AutoDashEngine, o: Obstacle, x: number, y: number, w: number, amb: number) {
  if (w < 2) return
  const ctx = eng.ctx
  if (o.kind === "cone") {
    const h = w * 1.5
    ctx.fillStyle = "rgba(0,0,0,0.3)"
    ctx.beginPath(); ctx.ellipse(x, y, w * 0.7, w * 0.16, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = shade("#f97316", amb)
    ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w * 0.55, y); ctx.lineTo(x - w * 0.55, y); ctx.closePath(); ctx.fill()
    ctx.fillStyle = shade("#f8fafc", amb)
    ctx.fillRect(x - w * 0.3, y - h * 0.48, w * 0.6, h * 0.16)
  } else {
    // cavalete zebrado vermelho/branco com pernas
    const h = w * 0.32
    ctx.fillStyle = "rgba(0,0,0,0.3)"
    ctx.beginPath(); ctx.ellipse(x, y, w * 0.55, w * 0.07, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = shade("#475569", amb)
    ctx.fillRect(x - w * 0.42, y - h * 1.5, w * 0.06, h * 1.5)
    ctx.fillRect(x + w * 0.36, y - h * 1.5, w * 0.06, h * 1.5)
    const by = y - h * 2.0
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = shade(i % 2 === 0 ? "#ef4444" : "#f8fafc", amb)
      ctx.fillRect(x - w / 2 + (w / 6) * i, by, w / 6 + 1, h)
    }
  }
}

export function drawRoadSign(eng: AutoDashEngine, sign: RoadSign, x: number, y: number, w: number, amb: number) {
  if (w < 3) return
  const ctx = eng.ctx
  const poleH = w * 2.8, r = w * 0.95
  ctx.fillStyle = shade("#64748b", amb)
  ctx.fillRect(x - w * 0.06, y - poleH, w * 0.12, poleH)
  const cy = y - poleH - r * 0.4
  if (sign.type === "limit90" || sign.type === "limit60") {
    // placa de limite: círculo branco, anel vermelho, número
    ctx.fillStyle = shade("#f8fafc", amb)
    ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = shade("#dc2626", amb)
    ctx.lineWidth = Math.max(1.5, r * 0.26)
    ctx.beginPath(); ctx.arc(x, cy, r * 0.82, 0, Math.PI * 2); ctx.stroke()
    if (r > 6) {
      ctx.fillStyle = "#0f172a"
      ctx.font = `bold ${Math.max(7, Math.round(r * 0.85))}px 'Space Grotesk', 'Segoe UI', sans-serif`
      ctx.textAlign = "center"
      ctx.fillText(sign.type === "limit90" ? "90" : "60", x, cy + r * 0.32)
      ctx.textAlign = "left"
    }
  } else if (sign.type === "works") {
    // OBRAS: losango laranja com um cone desenhado (aviso de obstáculo)
    ctx.fillStyle = shade("#f97316", amb)
    ctx.beginPath()
    ctx.moveTo(x, cy - r * 1.05); ctx.lineTo(x + r * 1.05, cy)
    ctx.lineTo(x, cy + r * 1.05); ctx.lineTo(x - r * 1.05, cy)
    ctx.closePath(); ctx.fill()
    if (r > 5) {
      ctx.fillStyle = "#0f172a"
      ctx.beginPath()
      ctx.moveTo(x, cy - r * 0.5); ctx.lineTo(x + r * 0.38, cy + r * 0.42)
      ctx.lineTo(x - r * 0.38, cy + r * 0.42); ctx.closePath(); ctx.fill()
    }
  } else if (sign.type === "merge") {
    // ENTRADA/ACESSO: losango amarelo com duas setas convergindo
    ctx.fillStyle = shade("#fbbf24", amb)
    ctx.beginPath()
    ctx.moveTo(x, cy - r * 1.05); ctx.lineTo(x + r * 1.05, cy)
    ctx.lineTo(x, cy + r * 1.05); ctx.lineTo(x - r * 1.05, cy)
    ctx.closePath(); ctx.fill()
    if (r > 5) {
      ctx.strokeStyle = "#0f172a"
      ctx.lineWidth = Math.max(1.2, r * 0.16)
      ctx.beginPath()
      ctx.moveTo(x - r * 0.1, cy + r * 0.5); ctx.lineTo(x - r * 0.1, cy - r * 0.5)
      ctx.moveTo(x + r * 0.52, cy + r * 0.5); ctx.lineTo(x + r * 0.05, cy - r * 0.1)
      ctx.stroke()
    }
  } else if (sign.type === "bridgewarn") {
    // aviso de ponte: losango amarelo com o vão desenhado
    ctx.fillStyle = shade("#fbbf24", amb)
    ctx.beginPath()
    ctx.moveTo(x, cy - r * 1.05); ctx.lineTo(x + r * 1.05, cy)
    ctx.lineTo(x, cy + r * 1.05); ctx.lineTo(x - r * 1.05, cy)
    ctx.closePath(); ctx.fill()
    if (r > 5) {
      ctx.fillStyle = "#0f172a"
      ctx.fillRect(x - r * 0.55, cy - r * 0.06, r * 1.1, r * 0.14) // tabuleiro
      ctx.fillRect(x - r * 0.38, cy + r * 0.08, r * 0.1, r * 0.3)  // pilares
      ctx.fillRect(x + r * 0.28, cy + r * 0.08, r * 0.1, r * 0.3)
    }
  } else {
    // mão dupla/contramão: proibido (círculo vermelho, barra branca)
    ctx.fillStyle = shade("#dc2626", amb)
    ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = shade("#f8fafc", amb)
    ctx.fillRect(x - r * 0.62, cy - r * 0.17, r * 1.24, r * 0.34)
  }
  // plaquinha extra embaixo (ex.: extensão do trecho — "2 km")
  if (sign.label && r > 5) {
    const lw = r * 1.9, lh = r * 0.72
    ctx.fillStyle = shade("#f8fafc", amb)
    ctx.fillRect(x - lw / 2, cy + r * 1.12, lw, lh)
    ctx.fillStyle = "#0f172a"
    ctx.font = `bold ${Math.max(6, Math.round(lh * 0.72))}px 'Space Grotesk', 'Segoe UI', sans-serif`
    ctx.textAlign = "center"
    ctx.fillText(sign.label, x, cy + r * 1.12 + lh * 0.76)
    ctx.textAlign = "left"
  }
}

export function drawTraffic(eng: AutoDashEngine, t: Traffic, x: number, y: number, w: number, amb: number) {
  if (w < 2) return
  const ctx = eng.ctx
  const k = KINDS[t.kind]
  const h = w * k.h
  const body = shade(t.color, amb * 0.95)
  const dark = shade(t.color, amb * 0.55)

  ctx.fillStyle = "rgba(0,0,0,0.35)"
  ctx.beginPath(); ctx.ellipse(x, y, w * 0.62, w * 0.10, 0, 0, Math.PI * 2); ctx.fill()

  // NEON sob o carro (rivais da corrida têm accent) — a lavada colorida no
  // asfalto é a assinatura visual de racha noturno
  if (t.accent && w > 6) {
    const g = ctx.createRadialGradient(x, y + h * 0.05, w * 0.1, x, y + h * 0.05, w * 0.95)
    g.addColorStop(0, t.accent + "cc")
    g.addColorStop(0.5, t.accent + "55")
    g.addColorStop(1, t.accent + "00")
    ctx.fillStyle = g
    ctx.beginPath(); ctx.ellipse(x, y + h * 0.05, w * 0.95, w * 0.34, 0, 0, Math.PI * 2); ctx.fill()
  }

  const bx = x - w / 2, by = y - h
  ctx.fillStyle = body
  rr(ctx, bx, by, w, h * 0.96, w * 0.14)
  if (w > 9) { // verniz só em quem está perto o bastante pra valer
    const gl = ctx.createLinearGradient(0, by, 0, by + h)
    gl.addColorStop(0, "rgba(255,255,255,0.22)")
    gl.addColorStop(0.4, "rgba(255,255,255,0.03)")
    gl.addColorStop(1, "rgba(0,0,0,0.18)")
    ctx.fillStyle = gl
    rr(ctx, bx, by, w, h * 0.96, w * 0.14)
  }
  ctx.fillStyle = dark
  // vidro traseiro
  rr(ctx, bx + w * 0.14, by + h * 0.10, w * 0.72, h * 0.30, w * 0.08)
  if (t.kind === "bus") {
    ctx.fillStyle = shade("#0f172a", Math.max(0.6, amb))
    rr(ctx, bx + w * 0.10, by + h * 0.08, w * 0.80, h * 0.22, w * 0.05)
  }
  if (t.kind === "truck") {
    ctx.strokeStyle = dark
    ctx.lineWidth = Math.max(1, w * 0.02)
    ctx.strokeRect(bx + w * 0.08, by + h * 0.12, w * 0.84, h * 0.62)
    ctx.beginPath(); ctx.moveTo(x, by + h * 0.12); ctx.lineTo(x, by + h * 0.74); ctx.stroke()
  }
  if (t.kind === "moto") {
    ctx.fillStyle = shade("#111827", Math.max(0.5, amb))
    ctx.beginPath(); ctx.arc(x, by + h * 0.28, w * 0.34, 0, Math.PI * 2); ctx.fill() // capacete
  }
  if (t.role === "police") {
    // faixa branca na lateral + giroflex no teto alternando vermelho/azul
    ctx.fillStyle = `rgba(241,245,249,${0.55 + amb * 0.35})`
    rr(ctx, bx, by + h * 0.52, w, h * 0.16, 0)
    const barW = w * 0.62, barH = Math.max(2, h * 0.13)
    const barX = x - barW / 2, barY = by - barH * 0.7
    ctx.fillStyle = shade("#0f172a", Math.max(0.5, amb))
    rr(ctx, barX, barY, barW, barH, barH * 0.35)
    // pisca em fases opostas: metade vermelha, metade azul, alternando
    const on = Math.floor(performance.now() / 110) % 2 === 0
    const L = on ? "#ef4444" : "#1e293b", R = on ? "#1e293b" : "#3b82f6"
    ctx.fillStyle = L; rr(ctx, barX, barY, barW / 2, barH, barH * 0.35)
    ctx.fillStyle = R; rr(ctx, barX + barW / 2, barY, barW / 2, barH, barH * 0.35)
    // halo: à noite o giroflex lava a pista em volta
    if (w > 5) {
      const glow = ctx.createRadialGradient(x, barY, barH * 0.4, x, barY, w * 1.15)
      const c = on ? "239,68,68" : "59,130,246"
      glow.addColorStop(0, `rgba(${c},${0.22 + (1 - amb) * 0.4})`)
      glow.addColorStop(1, `rgba(${c},0)`)
      ctx.fillStyle = glow
      ctx.beginPath(); ctx.ellipse(x, barY, w * 1.15, w * 0.62, 0, 0, Math.PI * 2); ctx.fill()
    }
  }
  // lanternas (contramão vem DE FRENTE: farol branco, não lanterna vermelha)
  const tail = t.role === "oncoming"
      ? (amb < 0.62 ? "#fff7cf" : shade("#e8e4c9", amb + 0.25))
      : (amb < 0.62 ? "#ff3b30" : shade("#c81e1e", amb + 0.25))
  ctx.fillStyle = tail
  const th = Math.max(2, h * 0.07)
  rr(ctx, bx + w * 0.06, y - th * 2.2, w * 0.22, th, th / 2)
  rr(ctx, bx + w * 0.72, y - th * 2.2, w * 0.22, th, th / 2)
  if (amb < 0.62) {
    ctx.fillStyle = "rgba(255,60,48,0.25)"
    ctx.beginPath(); ctx.ellipse(x, y - th * 1.6, w * 0.55, th * 2, 0, 0, Math.PI * 2); ctx.fill()
    // light trails: lanternas riscando a noite quando você fecha rápido
    const rel = Math.max(0, eng.speed - t.speed)
    const len = Math.min(w * 1.6, rel * w * 0.012)
    if (len > 3 && w > 6) {
      const trail = ctx.createLinearGradient(0, y - th * 2.2, 0, y - th * 2.2 + len)
      trail.addColorStop(0, "rgba(255,60,48,0.32)")
      trail.addColorStop(1, "rgba(255,60,48,0)")
      ctx.fillStyle = trail
      ctx.fillRect(bx + w * 0.06, y - th * 2.2, w * 0.22, len)
      ctx.fillRect(bx + w * 0.72, y - th * 2.2, w * 0.22, len)
    }
  }
  // RIVAL da corrida: faixa colorida no teto (mesma cor do minimapa) + nome
  // em cima. Sem isso todos os carros da pista são iguais e não dá pra saber
  // quem você está ultrapassando.
  if (t.accent) {
    ctx.fillStyle = t.accent
    rr(ctx, bx + w * 0.2, by + h * 0.04, w * 0.6, Math.max(1.5, h * 0.13), w * 0.05)
    if (w > 26 && t.label) {
      const fs = Math.max(9, Math.min(15, w * 0.17))
      ctx.font = `bold ${fs}px 'Space Grotesk', 'Segoe UI', sans-serif`
      ctx.textAlign = "center"
      const tw = ctx.measureText(t.label).width
      ctx.fillStyle = "rgba(8,13,26,0.6)"
      rr(ctx, x - tw / 2 - 5, by - fs * 1.75, tw + 10, fs * 1.35, 4)
      ctx.fillStyle = t.accent
      ctx.fillText(t.label, x, by - fs * 0.72)
      ctx.textAlign = "left"
    }
  }
  // seta
  if (t.blinkT > 0 && Math.floor(t.blinkT * 6) % 2 === 0) {
    ctx.fillStyle = "#fb923c"
    const side = t.targetOffset > t.offset ? 1 : -1
    ctx.beginPath(); ctx.arc(x + side * w * 0.52, y - h * 0.28, Math.max(2, w * 0.06), 0, Math.PI * 2); ctx.fill()
  }
  // alerta de colisão: triângulo vermelho piscando em cima do veículo
  if (t === eng.collWarn && Math.floor(performance.now() / 170) % 2 === 0) {
    const ty = y - h - Math.max(10, w * 0.4)
    const s = Math.max(7, w * 0.22)
    ctx.fillStyle = "#ef4444"
    ctx.beginPath()
    ctx.moveTo(x, ty - s); ctx.lineTo(x + s * 0.9, ty + s * 0.6); ctx.lineTo(x - s * 0.9, ty + s * 0.6)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = "#fff"
    ctx.font = `bold ${s * 1.1}px 'Space Grotesk', 'Segoe UI', sans-serif`
    ctx.textAlign = "center"
    ctx.fillText("!", x, ty + s * 0.45)
    ctx.textAlign = "left"
  }
}
