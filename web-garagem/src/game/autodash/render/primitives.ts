// AutoDash — render/primitives.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { type CarSpec, type CarCustom, PAINTS, WHEELS, NEONS } from "../data"
import { shade } from "../math"

// ---------- helpers de desenho ----------
export function poly(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4)
  ctx.closePath()
  ctx.fill()
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, Math.max(h, 1), Math.min(r, h / 2, w / 2))
  ctx.fill()
}

/** Carro do jogador visto de trás — silhueta própria por carroceria + customização completa. */
export function drawPlayerCar(
    ctx: CanvasRenderingContext2D, cx: number, cy: number, spec: CarSpec,
    custom: CarCustom, steer: number, braking: boolean, amb: number, nitro: boolean, scale = 1,
) {
  const w = spec.width * 640 * scale
  const h = w * 0.62
  const paint = PAINTS[custom.paint]
  const body = shade(paint, Math.max(0.5, amb))
  const dark = shade(paint, Math.max(0.3, amb * 0.55))
  const rim = WHEELS[custom.wheel]

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(steer * 0.05)

  // neon
  if (custom.neon > 0) {
    const neon = NEONS[custom.neon]
    const strength = amb < 0.7 ? 0.75 : 0.35
    const ng = ctx.createRadialGradient(0, 6, 4, 0, 6, w * 0.85)
    ng.addColorStop(0, neon + Math.round(strength * 255).toString(16).padStart(2, "0"))
    ng.addColorStop(1, neon + "00")
    ctx.fillStyle = ng
    ctx.beginPath(); ctx.ellipse(0, 6, w * 0.85, w * 0.22, 0, 0, Math.PI * 2); ctx.fill()
  }
  // sombra
  ctx.fillStyle = "rgba(0,0,0,0.4)"
  ctx.beginPath(); ctx.ellipse(0, 2, w * 0.62, w * 0.10, 0, 0, Math.PI * 2); ctx.fill()

  const bx = -w / 2, by = -h
  // pneus + rodas coloridas
  ctx.fillStyle = "#0a0a0c"
  rr(ctx, bx - w * 0.05, -h * 0.36, w * 0.10, h * 0.36, w * 0.025)
  rr(ctx, bx + w - w * 0.05, -h * 0.36, w * 0.10, h * 0.36, w * 0.025)
  ctx.fillStyle = rim
  rr(ctx, bx - w * 0.038, -h * 0.26, w * 0.024, h * 0.16, w * 0.012)
  rr(ctx, bx + w + w * 0.014, -h * 0.26, w * 0.024, h * 0.16, w * 0.012)

  // ---- silhueta por carroceria (curvas, não caixas) ----
  ctx.fillStyle = body
  const roofY = by
  if (spec.body === "gt") {
    // cupê: traseira larga, cabine afunilada com teto em arco
    ctx.beginPath()
    ctx.moveTo(bx + w * 0.02, 0)
    ctx.quadraticCurveTo(bx - w * 0.03, by + h * 0.52, bx + w * 0.07, by + h * 0.40)
    ctx.quadraticCurveTo(bx + w * 0.13, by + h * 0.06, bx + w * 0.32, roofY + h * 0.02)
    ctx.quadraticCurveTo(0, roofY - h * 0.04, bx + w * 0.68, roofY + h * 0.02)
    ctx.quadraticCurveTo(bx + w * 0.87, by + h * 0.06, bx + w * 0.93, by + h * 0.40)
    ctx.quadraticCurveTo(bx + w * 1.03, by + h * 0.52, bx + w * 0.98, 0)
    ctx.closePath()
    ctx.fill()
    // ombros dos para-lamas
    ctx.fillStyle = dark
    ctx.beginPath(); ctx.ellipse(bx + w * 0.075, -h * 0.26, w * 0.055, h * 0.20, 0.2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(bx + w * 0.925, -h * 0.26, w * 0.055, h * 0.20, -0.2, 0, Math.PI * 2); ctx.fill()
  } else if (spec.body === "muscle") {
    // muscle: quadris largos, cabine achatada, capô com scoop
    ctx.beginPath()
    ctx.moveTo(bx - w * 0.02, 0)
    ctx.quadraticCurveTo(bx - w * 0.06, by + h * 0.62, bx + w * 0.04, by + h * 0.44)
    ctx.quadraticCurveTo(bx + w * 0.16, by + h * 0.10, bx + w * 0.30, by + h * 0.06)
    ctx.lineTo(bx + w * 0.70, by + h * 0.06)
    ctx.quadraticCurveTo(bx + w * 0.84, by + h * 0.10, bx + w * 0.96, by + h * 0.44)
    ctx.quadraticCurveTo(bx + w * 1.06, by + h * 0.62, bx + w * 1.02, 0)
    ctx.closePath()
    ctx.fill()
    // quadris musculosos
    ctx.fillStyle = dark
    ctx.beginPath(); ctx.ellipse(bx + w * 0.05, -h * 0.28, w * 0.075, h * 0.26, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(bx + w * 0.95, -h * 0.28, w * 0.075, h * 0.26, 0, 0, Math.PI * 2); ctx.fill()
    // scoop no capô espiando por cima
    rr(ctx, -w * 0.11, by, w * 0.22, h * 0.10, w * 0.03)
  } else if (spec.body === "ninja") {
    // gota aerodinâmica: um arco só, sem vinco
    ctx.beginPath()
    ctx.moveTo(bx + w * 0.03, 0)
    ctx.quadraticCurveTo(bx - w * 0.02, by + h * 0.45, bx + w * 0.16, by + h * 0.14)
    ctx.quadraticCurveTo(0, roofY - h * 0.10, bx + w * 0.84, by + h * 0.14)
    ctx.quadraticCurveTo(bx + w * 1.02, by + h * 0.45, bx + w * 0.97, 0)
    ctx.closePath()
    ctx.fill()
  } else if (spec.body === "zcoupe") {
    // cupê 2 lugares: ombros traseiros marcados, vidro largo e baixo
    ctx.beginPath()
    ctx.moveTo(bx + w * 0.01, 0)
    ctx.quadraticCurveTo(bx - w * 0.05, by + h * 0.56, bx + w * 0.06, by + h * 0.34)
    ctx.quadraticCurveTo(bx + w * 0.15, by + h * 0.02, bx + w * 0.30, roofY + h * 0.04)
    ctx.lineTo(bx + w * 0.70, roofY + h * 0.04)
    ctx.quadraticCurveTo(bx + w * 0.85, by + h * 0.02, bx + w * 0.94, by + h * 0.34)
    ctx.quadraticCurveTo(bx + w * 1.05, by + h * 0.56, bx + w * 0.99, 0)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = dark
    ctx.beginPath(); ctx.ellipse(bx + w * 0.07, -h * 0.30, w * 0.07, h * 0.24, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(bx + w * 0.93, -h * 0.30, w * 0.07, h * 0.24, 0, 0, Math.PI * 2); ctx.fill()
  } else if (spec.body === "rotor") {
    // rotativo: tudo arredondado, traseira curta e baixinha
    ctx.beginPath()
    ctx.moveTo(bx + w * 0.05, 0)
    ctx.quadraticCurveTo(bx - w * 0.03, by + h * 0.50, bx + w * 0.14, by + h * 0.20)
    ctx.quadraticCurveTo(0, roofY - h * 0.02, bx + w * 0.86, by + h * 0.20)
    ctx.quadraticCurveTo(bx + w * 1.03, by + h * 0.50, bx + w * 0.95, 0)
    ctx.closePath(); ctx.fill()
  } else if (spec.body === "apex") {
    // GT de reta: carroceria larga e o bocão do aerofólio alto
    ctx.beginPath()
    ctx.moveTo(bx - w * 0.03, 0)
    ctx.quadraticCurveTo(bx - w * 0.07, by + h * 0.58, bx + w * 0.05, by + h * 0.36)
    ctx.quadraticCurveTo(bx + w * 0.17, by + h * 0.04, bx + w * 0.34, roofY + h * 0.05)
    ctx.lineTo(bx + w * 0.66, roofY + h * 0.05)
    ctx.quadraticCurveTo(bx + w * 0.83, by + h * 0.04, bx + w * 0.95, by + h * 0.36)
    ctx.quadraticCurveTo(bx + w * 1.07, by + h * 0.58, bx + w * 1.03, 0)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = dark // difusor
    rr(ctx, bx + w * 0.22, -h * 0.09, w * 0.56, h * 0.09, w * 0.02)
  } else if (spec.body === "kaiju") {
    // caixa-forte: linhas retas, quadrado, traseira reta e larga
    ctx.beginPath()
    ctx.moveTo(bx - w * 0.01, 0)
    ctx.lineTo(bx + w * 0.02, by + h * 0.40)
    ctx.lineTo(bx + w * 0.14, by + h * 0.08)
    ctx.lineTo(bx + w * 0.32, roofY + h * 0.03)
    ctx.lineTo(bx + w * 0.68, roofY + h * 0.03)
    ctx.lineTo(bx + w * 0.86, by + h * 0.08)
    ctx.lineTo(bx + w * 0.98, by + h * 0.40)
    ctx.lineTo(bx + w * 1.01, 0)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = dark
    rr(ctx, bx + w * 0.02, -h * 0.34, w * 0.10, h * 0.30, w * 0.02)
    rr(ctx, bx + w * 0.88, -h * 0.34, w * 0.10, h * 0.30, w * 0.02)
  } else if (spec.body === "sylva") {
    // esportivo estreito: cabine afilada, quadris discretos
    ctx.beginPath()
    ctx.moveTo(bx + w * 0.04, 0)
    ctx.quadraticCurveTo(bx - w * 0.01, by + h * 0.48, bx + w * 0.11, by + h * 0.24)
    ctx.quadraticCurveTo(bx + w * 0.20, by + h * 0.01, bx + w * 0.36, roofY + h * 0.03)
    ctx.lineTo(bx + w * 0.64, roofY + h * 0.03)
    ctx.quadraticCurveTo(bx + w * 0.80, by + h * 0.01, bx + w * 0.89, by + h * 0.24)
    ctx.quadraticCurveTo(bx + w * 1.01, by + h * 0.48, bx + w * 0.96, 0)
    ctx.closePath(); ctx.fill()
  } else if (spec.body === "roadster") {
    // conversível pequeno: sem teto, para-brisa baixinho e santantônio
    ctx.beginPath()
    ctx.moveTo(bx + w * 0.06, 0)
    ctx.quadraticCurveTo(bx - w * 0.01, by + h * 0.52, bx + w * 0.13, by + h * 0.30)
    ctx.quadraticCurveTo(0, by + h * 0.16, bx + w * 0.87, by + h * 0.30)
    ctx.quadraticCurveTo(bx + w * 1.01, by + h * 0.52, bx + w * 0.94, 0)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = dark // santantônios atrás dos bancos
    rr(ctx, bx + w * 0.26, by + h * 0.10, w * 0.16, h * 0.20, w * 0.04)
    rr(ctx, bx + w * 0.58, by + h * 0.10, w * 0.16, h * 0.20, w * 0.04)
  } else if (spec.body === "alta") {
    // sedã: teto mais alto e comprido, traseira alta e reta
    ctx.beginPath()
    ctx.moveTo(bx + w * 0.01, 0)
    ctx.quadraticCurveTo(bx - w * 0.04, by + h * 0.54, bx + w * 0.05, by + h * 0.30)
    ctx.quadraticCurveTo(bx + w * 0.12, by - h * 0.04, bx + w * 0.26, roofY - h * 0.06)
    ctx.lineTo(bx + w * 0.74, roofY - h * 0.06)
    ctx.quadraticCurveTo(bx + w * 0.88, by - h * 0.04, bx + w * 0.95, by + h * 0.30)
    ctx.quadraticCurveTo(bx + w * 1.04, by + h * 0.54, bx + w * 0.99, 0)
    ctx.closePath(); ctx.fill()
    // faróis retráteis: os cantos levantados espiando por cima do capô
    ctx.fillStyle = dark
    rr(ctx, bx + w * 0.10, roofY - h * 0.16, w * 0.18, h * 0.09, w * 0.02)
    rr(ctx, bx + w * 0.72, roofY - h * 0.16, w * 0.18, h * 0.09, w * 0.02)
  } else if (spec.body === "flat6") {
    // motor traseiro: para-lamas redondos e cheios, teto que escorre numa
    // rabeta baixa (a curva clássica). Traseira mais larga que a frente.
    ctx.beginPath()
    ctx.moveTo(bx - w * 0.01, 0)
    ctx.quadraticCurveTo(bx - w * 0.06, by + h * 0.60, bx + w * 0.06, by + h * 0.34)
    ctx.quadraticCurveTo(bx + w * 0.16, by + h * 0.06, bx + w * 0.34, roofY + h * 0.04)
    ctx.quadraticCurveTo(bx + w * 0.55, roofY - h * 0.08, bx + w * 0.80, by + h * 0.20)
    ctx.quadraticCurveTo(bx + w * 0.96, by + h * 0.42, bx + w * 1.01, 0)
    ctx.closePath(); ctx.fill()
    // para-lamas traseiros salientes (bojo redondo dos dois lados)
    ctx.fillStyle = dark
    ctx.beginPath(); ctx.ellipse(bx + w * 0.06, -h * 0.30, w * 0.08, h * 0.26, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(bx + w * 0.94, -h * 0.30, w * 0.08, h * 0.26, 0, 0, Math.PI * 2); ctx.fill()
  } else {
    // ghost: cunha facetada, ângulos duros
    ctx.beginPath()
    ctx.moveTo(0, roofY - h * 0.02)
    ctx.lineTo(bx + w * 0.72, by + h * 0.10)
    ctx.lineTo(bx + w * 0.98, by + h * 0.36)
    ctx.lineTo(bx + w * 1.02, by + h * 0.78)
    ctx.lineTo(bx + w * 0.90, 0)
    ctx.lineTo(bx + w * 0.10, 0)
    ctx.lineTo(bx - w * 0.02, by + h * 0.78)
    ctx.lineTo(bx + w * 0.02, by + h * 0.36)
    ctx.lineTo(bx + w * 0.28, by + h * 0.10)
    ctx.closePath()
    ctx.fill()
    // vinco central afiado
    ctx.strokeStyle = dark
    ctx.lineWidth = Math.max(1, w * 0.012)
    ctx.beginPath(); ctx.moveTo(0, roofY); ctx.lineTo(0, -h * 0.36); ctx.stroke()
  }

  // faixas
  ctx.fillStyle = "rgba(255,255,255,0.35)"
  if (custom.stripe === 1) ctx.fillRect(-w * 0.05, by + h * 0.06, w * 0.10, h * 0.86)
  if (custom.stripe === 2) { ctx.fillRect(-w * 0.11, by + h * 0.06, w * 0.07, h * 0.86); ctx.fillRect(w * 0.04, by + h * 0.06, w * 0.07, h * 0.86) }
  if (custom.stripe === 3) { ctx.fillRect(bx + w * 0.06, by + h * 0.30, w * 0.05, h * 0.62); ctx.fillRect(bx + w * 0.89, by + h * 0.30, w * 0.05, h * 0.62) }

  // verniz: brilho no teto, sombra na base
  const gloss = ctx.createLinearGradient(0, by, 0, by + h)
  gloss.addColorStop(0, "rgba(255,255,255,0.30)")
  gloss.addColorStop(0.32, "rgba(255,255,255,0.06)")
  gloss.addColorStop(0.6, "rgba(0,0,0,0)")
  gloss.addColorStop(1, "rgba(0,0,0,0.22)")
  ctx.fillStyle = gloss
  rr(ctx, bx + w * 0.02, by + h * 0.04, w * 0.96, h * 0.9, w * 0.14)

  // vidro traseiro acompanhando a cabine
  ctx.fillStyle = shade("#0f172a", Math.max(0.6, amb))
  if (spec.body === "ghost") {
    ctx.beginPath()
    ctx.moveTo(0, by + h * 0.06)
    ctx.lineTo(bx + w * 0.68, by + h * 0.18)
    ctx.lineTo(bx + w * 0.62, by + h * 0.36)
    ctx.lineTo(bx + w * 0.38, by + h * 0.36)
    ctx.lineTo(bx + w * 0.32, by + h * 0.18)
    ctx.closePath()
    ctx.fill()
  } else if (spec.body !== "roadster") { // conversível não tem vidro traseiro
    const vwPorCorpo: Partial<Record<typeof spec.body, number>> = {
      ninja: 0.56, muscle: 0.44, kaiju: 0.58, alta: 0.60,
      zcoupe: 0.54, rotor: 0.52, apex: 0.50, sylva: 0.48, flat6: 0.50,
    }
    const vw = vwPorCorpo[spec.body] ?? 0.52
    ctx.beginPath()
    ctx.moveTo(-w * vw / 2, by + h * 0.36)
    ctx.quadraticCurveTo(-w * vw * 0.42, by + h * 0.10, -w * vw * 0.30, by + h * 0.10)
    ctx.lineTo(w * vw * 0.30, by + h * 0.10)
    ctx.quadraticCurveTo(w * vw * 0.42, by + h * 0.10, w * vw / 2, by + h * 0.36)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = "rgba(190,215,245,0.18)"
  ctx.beginPath()
  ctx.moveTo(bx + w * 0.36, by + h * 0.12)
  ctx.lineTo(bx + w * 0.46, by + h * 0.12)
  ctx.lineTo(bx + w * 0.38, by + h * 0.33)
  ctx.lineTo(bx + w * 0.30, by + h * 0.33)
  ctx.closePath()
  ctx.fill()

  // aerofólio customizável
  ctx.fillStyle = dark
  if (custom.wing === 1) { // ducktail
    rr(ctx, bx + w * 0.10, by + h * 0.34, w * 0.80, h * 0.055, w * 0.02)
  } else if (custom.wing === 2) { // asa GT
    rr(ctx, bx - w * 0.03, by - h * 0.10, w * 1.06, h * 0.075, w * 0.03)
    ctx.fillRect(bx + w * 0.14, by - h * 0.04, w * 0.05, h * 0.14)
    ctx.fillRect(bx + w * 0.81, by - h * 0.04, w * 0.05, h * 0.14)
  }

  // lanternas
  const glow = braking ? 1 : amb < 0.62 ? 0.8 : 0.45
  ctx.fillStyle = `rgba(255,45,40,${glow})`
  const th = h * 0.09
  // ASSINATURA de lanterna por carro — é o que o jogador vê o tempo todo, então
  // é o que mais dá identidade de trás.
  if (spec.body === "ninja") {
    rr(ctx, bx + w * 0.08, -th * 2.4, w * 0.30, th, th / 2)
    rr(ctx, bx + w * 0.62, -th * 2.4, w * 0.30, th, th / 2)
  } else if (spec.body === "ghost" || spec.body === "flat6" || spec.body === "apex") {
    // faixa VAZADA de ponta a ponta (traço moderno)
    rr(ctx, bx + w * 0.08, -th * 2.6, w * 0.84, th * 0.7, th / 3)
    ctx.save(); ctx.fillStyle = shade(paint, Math.max(0.2, amb * 0.4))
    ctx.fillRect(bx + w * 0.46, -th * 2.7, w * 0.08, th) ; ctx.restore()
  } else if (spec.body === "rotor" || spec.body === "roadster") {
    // dois círculos (redondos, retrô)
    ctx.beginPath(); ctx.arc(bx + w * 0.20, -th * 1.9, th * 0.9, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(bx + w * 0.80, -th * 1.9, th * 0.9, 0, Math.PI * 2); ctx.fill()
  } else if (spec.body === "muscle") {
    // três segmentos empilhados de cada lado (muscle clássico)
    for (let s = 0; s < 3; s++) {
      rr(ctx, bx + w * 0.08 + s * w * 0.075, -th * 2.4, w * 0.06, th, th * 0.2)
      rr(ctx, bx + w * 0.70 + s * w * 0.075, -th * 2.4, w * 0.06, th, th * 0.2)
    }
  } else if (spec.body === "kaiju") {
    // quatro anéis (o quarteto redondo do R32)
    for (const cxr of [0.16, 0.30, 0.70, 0.84]) {
      ctx.beginPath(); ctx.arc(bx + w * cxr, -th * 1.9, th * 0.7, 0, Math.PI * 2); ctx.fill()
    }
  } else {
    // padrão (gt, zcoupe, sylva, alta): par de barras
    rr(ctx, bx + w * 0.07, -th * 2.4, w * 0.24, th, th / 2)
    rr(ctx, bx + w * 0.69, -th * 2.4, w * 0.24, th, th / 2)
  }
  if (braking || amb < 0.62) {
    ctx.fillStyle = `rgba(255,45,40,${braking ? 0.35 : 0.18})`
    ctx.beginPath(); ctx.ellipse(0, -th * 1.8, w * 0.58, th * 2.4, 0, 0, Math.PI * 2); ctx.fill()
  }

  // escapamentos
  ctx.fillStyle = "#18181b"
  ctx.beginPath(); ctx.arc(bx + w * 0.20, -h * 0.03, w * 0.035, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(bx + w * 0.80, -h * 0.03, w * 0.035, 0, Math.PI * 2); ctx.fill()
  if (nitro) {
    ctx.fillStyle = "#fde047"
    ctx.beginPath(); ctx.arc(bx + w * 0.20, -h * 0.03, w * 0.05, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(bx + w * 0.80, -h * 0.03, w * 0.05, 0, Math.PI * 2); ctx.fill()
  }

  // placa
  ctx.fillStyle = shade("#e2e8f0", Math.max(0.55, amb))
  rr(ctx, -w * 0.14, -h * 0.16, w * 0.28, h * 0.09, 2)
  ctx.fillStyle = "#0f172a"
  ctx.font = `bold ${Math.max(6, h * 0.06)}px 'Space Grotesk', 'Segoe UI', sans-serif`
  ctx.textAlign = "center"
  ctx.fillText("AUTOHUB", 0, -h * 0.093)
  ctx.textAlign = "left"

  ctx.restore()
}
