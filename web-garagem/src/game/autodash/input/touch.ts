// AutoDash — input/touch.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { enterFromMenu } from "../flow"
import { ensureAudio } from "../flow"
import { AutoDashEngine, W, H } from "../engine"
import { tryShift } from "./keyboard"
import { regionAt } from "./pointer"
import { clamp } from "../math"

export function buildTouchControls(eng: AutoDashEngine) {
  const wrap = document.createElement("div")
  wrap.style.position = "fixed"
  wrap.style.inset = "0"
  wrap.style.margin = "auto"
  wrap.style.width = "min(100vw, 177.8vh)"
  wrap.style.aspectRatio = "16 / 9"
  wrap.style.pointerEvents = "none"
  wrap.style.zIndex = "50"
  wrap.style.touchAction = "none"
  noCallout(eng, wrap)
  document.body.appendChild(wrap)
  eng.touchControlsEl = wrap

  // % de largura e % de altura a partir do MESMO valor em unidades de canvas
  // (960x540) dão o mesmo tamanho físico na tela — é assim que um botão fica
  // redondo de verdade em vez de esticado.
  const pctW = (px: number) => `${(px / W) * 100}%`
  const pctH = (px: number) => `${(px / H) * 100}%`

  // Estilo Brawl Stars: botão redondo, escuro translúcido, anel colorido por
  // função; ao apertar enche da cor e encolhe um tico (feedback físico).
  const makeButton = (label: string, left: number, top: number, size: number, accent: string) => {
    const btn = document.createElement("div")
    btn.textContent = label
    btn.style.position = "absolute"
    btn.style.left = pctW(left)
    btn.style.top = pctH(top)
    btn.style.width = pctW(size)
    btn.style.height = pctH(size)
    btn.style.display = "flex"
    btn.style.alignItems = "center"
    btn.style.justifyContent = "center"
    btn.style.borderRadius = "999px"
    btn.style.background = "rgba(10,12,20,0.42)"
    btn.style.border = `2.5px solid ${accent}66`
    btn.style.boxShadow = "0 4px 14px rgba(0,0,0,0.45), inset 0 2px 3px rgba(255,255,255,0.12)"
    btn.style.color = accent
    btn.style.fontFamily = "'Space Grotesk', 'Segoe UI', sans-serif"
    btn.style.fontWeight = "900"
    btn.style.fontSize = `${size * 0.34}px`
    btn.style.letterSpacing = "0.5px"
    btn.style.pointerEvents = "auto"
    btn.style.touchAction = "none"
    btn.style.transition = "transform .07s ease, background .07s ease, border-color .07s ease"
    noCallout(eng, btn)
    btn.dataset.accent = accent
    wrap.appendChild(btn)
    return btn
  }
  const setPressed = (btn: HTMLDivElement, on: boolean) => {
    const accent = btn.dataset.accent!
    btn.style.background = on ? `${accent}dd` : "rgba(10,12,20,0.42)"
    btn.style.borderColor = on ? accent : `${accent}66`
    btn.style.color = on ? "#0a0c14" : accent
    btn.style.transform = on ? "scale(0.9)" : "scale(1)"
  }

  // segura pra manter o estado ligado (gás/freio/direção). PointerEvent
  // unifica touch e mouse, e cada botão captura o próprio dedo — pointerup
  // ainda chega mesmo se o dedo escorregar pra fora (setPointerCapture).
  const bindHold = (btn: HTMLDivElement, onChange: (pressed: boolean) => void) => {
    const press = (e: PointerEvent) => {
      e.preventDefault()
      try { btn.setPointerCapture(e.pointerId) } catch { /* nem todo browser */ }
      setPressed(btn, true); onChange(true)
    }
    const release = () => { setPressed(btn, false); onChange(false) }
    btn.addEventListener("pointerdown", press)
    btn.addEventListener("pointerup", release)
    btn.addEventListener("pointercancel", release)
  }
  const bindTap = (btn: HTMLDivElement, onTap: () => void) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault(); setPressed(btn, true); onTap()
    })
    const up = () => setPressed(btn, false)
    btn.addEventListener("pointerup", up)
    btn.addEventListener("pointercancel", up)
  }

  const EDGE = 22
  // direção — canto inferior esquerdo, dois botões grandes e separados
  const ST = 96, SGAP = 16
  const steerLeft = makeButton("◀", EDGE, H - EDGE - ST, ST, "#e2e8f0")
  const steerRight = makeButton("▶", EDGE + ST + SGAP, H - EDGE - ST, ST, "#e2e8f0")
  bindHold(steerLeft, (p) => { eng.touchSteerLeft = p })
  bindHold(steerRight, (p) => { eng.touchSteerRight = p })

  // ação — canto inferior direito, em leque (gás grande no canto)
  const GAS = 108, BR = 84, NI = 72, GE = 54
  const gas = makeButton("GÁS", W - EDGE - GAS, H - EDGE - GAS, GAS, "#22c55e")
  const brake = makeButton("FREIO", W - EDGE - GAS - 16 - BR, H - EDGE - BR, BR, "#ef4444")
  gas.style.fontSize = "26px"; brake.style.fontSize = "17px"
  bindHold(gas, (p) => { eng.touchThrottle = p })
  bindHold(brake, (p) => { eng.touchBrake = p })

  // nitro logo acima dos pedais; marchas menores num arco mais pra cima/esquerda
  const nitro = makeButton("NOS", W - EDGE - NI, H - EDGE - GAS - 16 - NI, NI, "#38bdf8")
  const upRowY = H - EDGE - GAS - 16 - NI + (NI - GE) / 2
  const gearUp = makeButton("▲", W - EDGE - NI - 14 - GE, upRowY, GE, "#fbbf24")
  const gearDown = makeButton("▼", W - EDGE - NI - 14 - GE - 12 - GE, upRowY, GE, "#fbbf24")
  gearUp.style.fontSize = "24px"; gearDown.style.fontSize = "24px"
  bindHold(nitro, (p) => { eng.nitroOn = p })
  bindTap(gearUp, () => tryShift(eng, 1))
  bindTap(gearDown, () => tryShift(eng, -1))
}

export function noCallout(_eng: AutoDashEngine, el: HTMLElement) {
  const s = el.style as CSSStyleDeclaration & Record<string, string>
  s.userSelect = "none"
  s.webkitUserSelect = "none"
  s.webkitTouchCallout = "none"
  s.webkitTapHighlightColor = "transparent"
  el.setAttribute("draggable", "false")
  el.addEventListener("contextmenu", (e) => e.preventDefault())
  el.addEventListener("dragstart", (e) => e.preventDefault())
}

export function onTouchStart(eng: AutoDashEngine, e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  ensureAudio(eng)
  const rect = eng.canvas.getBoundingClientRect()
  eng.mousePx.x = ((touch.clientX - rect.left) / rect.width) * W
  eng.mousePx.y = ((touch.clientY - rect.top) / rect.height) * H
  if (eng.state === "racing" || eng.state === "countdown") {
    eng.mouseGas = true
  } else {
    const hit = regionAt(eng, eng.mousePx.x, eng.mousePx.y)
    if (hit) hit.act()
    else if (eng.state === "menu") enterFromMenu(eng)
  }
}

export function onTouchMove(eng: AutoDashEngine, e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  e.preventDefault()
  const rect = eng.canvas.getBoundingClientRect()
  eng.mouseXn = clamp((touch.clientX - rect.left) / rect.width, 0, 1)
  eng.mousePx.x = ((touch.clientX - rect.left) / rect.width) * W
  eng.mousePx.y = ((touch.clientY - rect.top) / rect.height) * H
}
