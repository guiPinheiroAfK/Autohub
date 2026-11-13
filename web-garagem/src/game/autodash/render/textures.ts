// AutoDash — render/textures.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, W, H } from "../engine"

export function vignetteTex(eng: AutoDashEngine) : HTMLCanvasElement {
  if (eng.vignetteSprite) return eng.vignetteSprite
  const cv = document.createElement("canvas")
  cv.width = W; cv.height = H
  const c = cv.getContext("2d")!
  const vg = c.createRadialGradient(W / 2, H * 0.55, H * 0.38, W / 2, H * 0.55, H * 0.95)
  vg.addColorStop(0, "rgba(0,0,0,0)")
  vg.addColorStop(1, "rgba(0,0,0,0.38)")
  c.fillStyle = vg
  c.fillRect(0, 0, W, H)
  eng.vignetteSprite = cv
  return cv
}

export function neonGlow(eng: AutoDashEngine, cor: string) : HTMLCanvasElement {
  const hit = eng.glowCache.get(cor)
  if (hit) return hit
  const cv = document.createElement("canvas")
  cv.width = 64; cv.height = 64
  const c = cv.getContext("2d")!
  const g = c.createRadialGradient(32, 32, 1, 32, 32, 32)
  g.addColorStop(0, cor + "cc")
  g.addColorStop(0.45, cor + "55")
  g.addColorStop(1, cor + "00")
  c.fillStyle = g
  c.fillRect(0, 0, 64, 64)
  eng.glowCache.set(cor, cv)
  return cv
}

export function glowTex(eng: AutoDashEngine) : HTMLCanvasElement {
  if (eng.glowSprite) return eng.glowSprite
  const cv = document.createElement("canvas")
  cv.width = 64; cv.height = 64
  const c = cv.getContext("2d")!
  const g = c.createRadialGradient(32, 32, 2, 32, 32, 32)
  g.addColorStop(0, "rgba(255,233,168,0.4)")
  g.addColorStop(1, "rgba(255,233,168,0)")
  c.fillStyle = g
  c.fillRect(0, 0, 64, 64)
  eng.glowSprite = cv
  return cv
}
