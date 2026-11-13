// AutoDash — input/pointer.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, W, H } from "../engine"
import { toNeutral, tryShift } from "./keyboard"
import { clamp } from "../math"

export function regionAt(eng: AutoDashEngine, x: number, y: number) {
  for (const r of eng.uiRegions) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r
  }
  return null
}

export function onMouseDown(eng: AutoDashEngine, e: MouseEvent) {
  eng.ensureAudio()
  if (e.button === 0) {
    if (eng.state === "racing" || eng.state === "countdown") {
      eng.mouseGas = true
    } else {
      const hit = regionAt(eng, eng.mousePx.x, eng.mousePx.y)
      if (hit) hit.act()
      else if (eng.state === "menu") eng.enterFromMenu()
    }
  }
  if (e.button === 2 && (eng.state === "racing" || eng.state === "countdown")) eng.mouseBrake = true
  if (e.button === 1) { e.preventDefault(); toNeutral(eng) }
  if (e.button === 3 || e.button === 4) { e.preventDefault(); eng.nitroOn = true }
}

export function onMouseUp(eng: AutoDashEngine, e: MouseEvent) {
  if (e.button === 0) eng.mouseGas = false
  if (e.button === 2) eng.mouseBrake = false
  if (e.button === 3 || e.button === 4) eng.nitroOn = false
}

export function onMouseMove(eng: AutoDashEngine, e: MouseEvent) {
  const rect = eng.canvas.getBoundingClientRect()
  eng.mouseXn = clamp((e.clientX - rect.left) / rect.width, 0, 1)
  eng.mousePx.x = ((e.clientX - rect.left) / rect.width) * W
  eng.mousePx.y = ((e.clientY - rect.top) / rect.height) * H
  const uiState = ["menu", "garage", "paused", "gameover", "nameentry"].includes(eng.state)
  eng.canvas.style.cursor = uiState && regionAt(eng, eng.mousePx.x, eng.mousePx.y) ? "pointer" : "default"
}

export function onWheel(eng: AutoDashEngine, e: WheelEvent) {
  e.preventDefault()
  if (eng.state !== "racing" && eng.state !== "countdown") return
  tryShift(eng, e.deltaY < 0 ? 1 : -1)
}

export function onCtx(_eng: AutoDashEngine, e: Event) {
return e.preventDefault()
}
