// AutoDash — physics/gearbox.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, W, H } from "../engine"
import { rpmFor } from "./rpm"
import { CARS, RPM_LIMITER } from "../data"

export function shiftUp(eng: AutoDashEngine) {
  if (eng.gear === 0) {
    let best = 1
    for (let g = 6; g >= 1; g--) {
      const r = rpmFor(eng, eng.speed, g)
      if (r >= 1800 && r <= 6500) { best = g; break }
      if (r < 1800) best = Math.max(1, g - 0)
    }
    eng.gear = Math.max(1, Math.min(6, best))
    eng.shiftT = CARS[eng.cfg.carIdx].shiftMs / 1000
    eng.audio.shift()
    popExhaust(eng)
    return
  }
  if (eng.gear >= 6) return
  eng.gear++
  eng.shiftT = CARS[eng.cfg.carIdx].shiftMs / 1000
  if (rpmFor(eng, eng.speed, eng.gear) < 1500) eng.audio.bog()
  else { eng.audio.shift(); popExhaust(eng) }
}

export function shiftDown(eng: AutoDashEngine) {
  if (eng.gear <= 0) return
  if (eng.gear === 1) { eng.gear = 0; eng.audio.shift(); return }
  const next = eng.gear - 1
  if (rpmFor(eng, eng.speed, next) > RPM_LIMITER + 400) { eng.audio.limiter(); return } // protege o motor
  eng.gear = next
  eng.shiftT = CARS[eng.cfg.carIdx].shiftMs / 1000
  eng.audio.shift()
}

export function popExhaust(eng: AutoDashEngine) {
  if (eng.state !== "racing" || eng.speed < 30) return
  for (const sx of [-22, 22]) {
    for (let i = 0; i < 3; i++) {
      eng.particles.push({
        x: W / 2 + sx + (Math.random() - 0.5) * 6, y: H - 56,
        vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 60,
        size: 3 + Math.random() * 4, life: 0.18, maxLife: 0.18,
        color: Math.random() < 0.5 ? "#fb923c" : "#fde047",
      })
    }
  }
}
