// AutoDash — render/menus/main.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { enterFromMenu } from "../../flow"
import { confirmName } from "../../flow"
import { AutoDashEngine, W, H } from "../../engine"
import { pill, arrowBtn, glass } from "../../ui/widgets"
import { abrirRaceLobby, startRace } from "../../modes/race"
import { CARS, saveConfig, NEONS, PAINTS, WHEELS, STRIPES, WINGS, NEON_NAMES } from "../../data"
import { drawPlayerCar, rr } from "../primitives"
import { clamp } from "../../math"

export function renderMenu(eng: AutoDashEngine) {
  const ctx = eng.ctx
  dim(eng, 0.45)
  ctx.textAlign = "center"
  const tg = ctx.createLinearGradient(0, 118, 0, 185)
  tg.addColorStop(0, "#ff7a45")
  tg.addColorStop(0.55, "#e0342f")
  tg.addColorStop(1, "#9f1d1a")
  ctx.shadowColor = "rgba(224,52,47,0.6)"
  ctx.shadowBlur = 34
  ctx.fillStyle = tg
  ctx.font = "italic 900 78px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("AUTODASH", W / 2, 180)
  ctx.shadowBlur = 0
  ctx.fillStyle = "rgba(255,255,255,0.25)"
  ctx.font = "italic 900 78px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.save()
  ctx.scale(1, -0.28)
  ctx.globalAlpha = 0.18
  ctx.fillText("AUTODASH", W / 2, -680) // reflexo espelhado sob o título
  ctx.restore()
  ctx.globalAlpha = 1
  ctx.fillStyle = "rgba(248,250,252,0.85)"
  ctx.font = "18px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("costure o trânsito · respeite o câmbio · sobreviva", W / 2, 214)
  ctx.textAlign = "left"
  pill(eng, "BORA CORRER  [ENTER]", W / 2 - 150, 286, 300, () => enterFromMenu(eng, "garage"), { primary: true, h: 46, font: 18 })
  pill(eng, "⚔ DUELO ONLINE  [D]", W / 2 - 150, 342, 300, () => enterFromMenu(eng, "duellobby"), { h: 38, font: 15 })
  pill(eng, "🏁 CORRIDA  [C]", W / 2 - 150, 388, 300, () => abrirRaceLobby(eng), { h: 38, font: 15 })
  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(248,250,252,0.6)"
  ctx.font = "14px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("🖱 esq acelera · dir freia · scroll troca marcha · botão do meio = neutro", W / 2, 440)
  ctx.fillText("⌨ A/D ou ←→ dirigem · W/S gás/freio · Q/E marchas · ESPAÇO nitro · F farol alto", W / 2, 464)
  if (eng.cfg.pilotName) {
    ctx.fillStyle = "rgba(148,197,255,0.85)"
    ctx.fillText(`fala, ${eng.cfg.pilotName}! bora?`, W / 2, 496)
  }
  const best = eng.scores[0]
  if (best) {
    ctx.fillStyle = "rgba(253,224,71,0.9)"
    ctx.fillText(`recorde: ${best.score.toLocaleString("pt-BR")} — ${best.name}`, W / 2, eng.cfg.pilotName ? 520 : 500)
  }
  ctx.textAlign = "left"
}

export function renderGarage(eng: AutoDashEngine) {
  const ctx = eng.ctx
  dim(eng, 0.72)
  const spec = CARS[eng.cfg.carIdx]
  const custom = eng.cfg.customs[eng.cfg.carIdx]
  const save = () => saveConfig(eng.cfg)

  ctx.textAlign = "center"
  ctx.fillStyle = "#f8fafc"
  ctx.font = "bold 30px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("GARAGEM", W / 2, 44)
  ctx.fillStyle = "rgba(248,250,252,0.55)"
  ctx.font = "14px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(`${eng.cfg.carIdx + 1} / ${CARS.length}`, 240, 78)
  ctx.textAlign = "left"

  pill(eng, "← menu", 16, 16, 92, () => { eng.state = "menu" }, { h: 26, font: 12 })
  arrowBtn(eng, 38, 206, -1, () => { eng.cfg.carIdx = (eng.cfg.carIdx + CARS.length - 1) % CARS.length; save(); eng.audio.ui() })
  arrowBtn(eng, 396, 206, 1, () => { eng.cfg.carIdx = (eng.cfg.carIdx + 1) % CARS.length; save(); eng.audio.ui() })

  // plataforma + carro
  const px = 240, py = 316
  const pg = ctx.createRadialGradient(px, py, 10, px, py, 150)
  const neon = NEONS[custom.neon]
  pg.addColorStop(0, custom.neon > 0 ? neon + "55" : "rgba(148,163,184,0.25)")
  pg.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = pg
  ctx.beginPath(); ctx.ellipse(px, py, 160, 46, 0, 0, Math.PI * 2); ctx.fill()
  drawPlayerCar(ctx, px, py + 10, spec, custom, 0, false, 0.9, false, 1.5)

  ctx.textAlign = "center"
  ctx.fillStyle = PAINTS[custom.paint]
  ctx.font = "bold 25px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(spec.name, px, 392)
  ctx.fillStyle = "rgba(248,250,252,0.7)"
  ctx.font = "italic 13px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(spec.desc, px, 414)
  ctx.textAlign = "left"

  pill(eng, `piloto: ${eng.cfg.pilotName || "?"} · trocar [N]`, 120, 430, 240, () => {
    eng.nameBuf = eng.cfg.pilotName
    eng.afterName = "garage"
    eng.state = "nameentry"
    eng.audio.ui()
  })
  pill(eng, "ACELERAR!  [ENTER]", 120, 470, 240, () => { save(); startRace(eng) }, { primary: true, h: 42, font: 17 })

  // painel de specs e customização
  glass(eng, 486, 66, 456, 460, 18)
  const sx = 510
  const stat = (label: string, frac: number, x: number, y: number, invert = false) => {
    ctx.fillStyle = "rgba(248,250,252,0.75)"
    ctx.font = "11px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(label, x, y - 4)
    ctx.fillStyle = "rgba(148,163,184,0.25)"
    rr(ctx, x, y, 190, 9, 5)
    ctx.fillStyle = invert ? "#fb923c" : "#4ade80"
    rr(ctx, x, y, 190 * clamp(frac, 0.05, 1), 9, 5)
  }
  stat("POTÊNCIA", spec.power / 58, sx, 102)
  stat("ADERÊNCIA (curvas)", spec.grip / 0.9, sx + 226, 102)
  stat("VELOCIDADE FINAL", spec.topSpeed / 260, sx, 140)
  stat("LARGURA (atrapalha no corredor)", spec.width / 0.31, sx + 226, 140, true)

  // pintura e rodas — chips clicáveis
  ctx.fillStyle = "rgba(248,250,252,0.75)"
  ctx.font = "bold 11px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("PINTURA [C]", sx, 176)
  for (let i = 0; i < PAINTS.length; i++) {
    const cxp = sx + 10 + i * 26, cyp = 196
    ctx.fillStyle = PAINTS[i]
    ctx.beginPath(); ctx.arc(cxp, cyp, 9, 0, Math.PI * 2); ctx.fill()
    if (i === custom.paint) {
      ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(cxp, cyp, 12, 0, Math.PI * 2); ctx.stroke()
    }
    eng.uiRegions.push({ x: cxp - 12, y: cyp - 12, w: 24, h: 24, act: () => { custom.paint = i; save(); eng.audio.ui() } })
  }
  ctx.fillStyle = "rgba(248,250,252,0.75)"
  ctx.fillText("RODAS [R]", sx + 300, 176)
  for (let i = 0; i < WHEELS.length; i++) {
    const cxp = sx + 310 + i * 26, cyp = 196
    ctx.fillStyle = "#0a0a0c"
    ctx.beginPath(); ctx.arc(cxp, cyp, 9, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = WHEELS[i]
    ctx.beginPath(); ctx.arc(cxp, cyp, 5, 0, Math.PI * 2); ctx.fill()
    if (i === custom.wheel) {
      ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(cxp, cyp, 12, 0, Math.PI * 2); ctx.stroke()
    }
    eng.uiRegions.push({ x: cxp - 12, y: cyp - 12, w: 24, h: 24, act: () => { custom.wheel = i; save(); eng.audio.ui() } })
  }

  // pills de opções
  pill(eng, `faixa: ${STRIPES[custom.stripe]} [V]`, sx, 222, 200, () => { custom.stripe = (custom.stripe + 1) % STRIPES.length; save(); eng.audio.ui() })
  pill(eng, `aerofólio: ${WINGS[custom.wing]} [G]`, sx + 216, 222, 200, () => { custom.wing = (custom.wing + 1) % WINGS.length; save(); eng.audio.ui() })
  pill(eng, `neon: ${NEON_NAMES[custom.neon]} [B]`, sx, 258, 200, () => { custom.neon = (custom.neon + 1) % NEONS.length; save(); eng.audio.ui() })
  pill(eng, `direção: ${eng.cfg.steering === "mouse" ? "mouse" : "teclado"} [Y]`, sx + 216, 258, 200, () => { eng.cfg.steering = eng.cfg.steering === "mouse" ? "keyboard" : "mouse"; save(); eng.audio.ui() })
  pill(eng, `câmbio: ${eng.cfg.transmission === "auto" ? "automático" : "sequencial (scroll)"} [T]`, sx, 294, 416, () => { eng.cfg.transmission = eng.cfg.transmission === "auto" ? "manual" : "auto"; save(); eng.audio.ui() })

  // leaderboard global
  ctx.fillStyle = "rgba(253,224,71,0.9)"
  ctx.font = "bold 12px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("🌐 TOP 10 GLOBAL", sx, 348)
  ctx.font = "11px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillStyle = "rgba(248,250,252,0.7)"
  if (eng.scores.length === 0) ctx.fillText("— ainda sem recordes, seja o primeiro —", sx, 368)
  eng.scores.slice(0, 10).forEach((s, i) => {
    ctx.fillStyle = s.name === eng.cfg.pilotName ? "rgba(253,224,71,0.95)" : "rgba(248,250,252,0.7)"
    ctx.fillText(`${i + 1}. ${s.name || "???"} — ${s.score.toLocaleString("pt-BR")} (${s.km} km)`, sx, 368 + i * 15)
  })
}

export function renderPause(eng: AutoDashEngine) {
  const ctx = eng.ctx
  dim(eng)
  ctx.textAlign = "center"
  ctx.fillStyle = "#f8fafc"
  ctx.font = "bold 46px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("PAUSADO", W / 2, H / 2 - 60)
  ctx.textAlign = "left"
  pill(eng, "CONTINUAR  [ESC]", W / 2 - 115, H / 2 - 20, 230, () => { eng.state = "racing" }, { primary: true, h: 38, font: 15 })
  pill(eng, "RECOMEÇAR  [R]", W / 2 - 115, H / 2 + 28, 230, () => startRace(eng), { h: 32 })
  pill(eng, "MENU  [M]", W / 2 - 115, H / 2 + 68, 230, () => { eng.state = "menu" }, { h: 32 })
}

export function renderGameOver(eng: AutoDashEngine) {
  const ctx = eng.ctx
  dim(eng, 0.6)
  ctx.textAlign = "center"
  ctx.fillStyle = "#ef4444"
  ctx.font = `900 ${eng.crashByPolice ? 46 : 56}px 'Space Grotesk', 'Segoe UI', sans-serif`
  ctx.fillText(eng.crashByPolice ? "POLÍCIA TE PEGOU! 🚔" : "BATEU!", W / 2, 150)
  ctx.fillStyle = "#f8fafc"
  ctx.font = "bold 30px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(`${Math.floor(eng.score).toLocaleString("pt-BR")} pontos`, W / 2, 210)
  ctx.font = "16px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillStyle = "rgba(248,250,252,0.7)"
  ctx.fillText(`${eng.km.toFixed(1)} km percorridos, ${eng.cfg.pilotName || "PILOTO"}`, W / 2, 240)
  if (eng.newRecord) {
    ctx.fillStyle = "#fde047"
    ctx.font = "900 24px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("★ NOVO RECORDE! ★", W / 2, 272)
  }

  ctx.fillStyle = "rgba(253,224,71,0.9)"
  ctx.font = "bold 15px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("— 🌐 TOP 10 GLOBAL —", W / 2, 300)
  ctx.font = "13px 'Space Grotesk', 'Segoe UI', sans-serif"
  eng.scores.slice(0, 10).forEach((s, i) => {
    ctx.fillStyle = s.name === eng.cfg.pilotName ? "rgba(253,224,71,0.95)" : "rgba(248,250,252,0.8)"
    ctx.fillText(`${i + 1}. ${s.name || "???"} — ${s.score.toLocaleString("pt-BR")} (${s.km} km)`, W / 2, 322 + i * 16)
  })
  ctx.textAlign = "left"

  pill(eng, "CORRER DE NOVO  [ENTER]", W / 2 - 250, 490, 250, () => startRace(eng), { primary: true, h: 36, font: 14 })
  pill(eng, "GARAGEM  [G]", W / 2 + 16, 490, 130, () => { eng.state = "garage" }, { h: 36 })
  pill(eng, "MENU  [M]", W / 2 + 160, 490, 100, () => { eng.state = "menu" }, { h: 36 })
}

export function renderNameEntry(eng: AutoDashEngine) {
  const ctx = eng.ctx
  dim(eng, 0.7)
  glass(eng, W / 2 - 230, 140, 460, 270, 20)
  ctx.textAlign = "center"
  ctx.fillStyle = "#fde047"
  ctx.font = "900 38px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("QUEM TÁ PILOTANDO?", W / 2, 200)
  ctx.font = "14px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillStyle = "rgba(248,250,252,0.7)"
  ctx.fillText("seu nome fica salvo neste navegador e assina seus recordes", W / 2, 232)
  const cursor = Math.floor(performance.now() / 400) % 2 === 0 ? "▌" : " "
  ctx.fillStyle = "#f8fafc"
  ctx.font = "bold 36px 'Consolas', monospace"
  ctx.fillText((eng.nameBuf || "") + cursor, W / 2, 305)
  ctx.fillStyle = "rgba(255,255,255,0.25)"
  ctx.fillRect(W / 2 - 150, 320, 300, 2)
  ctx.textAlign = "left"
  pill(eng, "CONFIRMAR  [ENTER]", W / 2 - 115, 352, 230, () => confirmName(eng), { primary: true, h: 36, font: 14 })
}

export function dim(eng: AutoDashEngine, alpha = 0.55) {
  eng.ctx.fillStyle = `rgba(2,6,23,${alpha})`
  eng.ctx.fillRect(0, 0, W, H)
}
