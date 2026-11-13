// AutoDash — fx/particles.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, W, H } from "../engine"

export function burst(eng: AutoDashEngine, x: number, y: number, n: number, colors: string[]) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 260
    eng.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
      size: 4 + Math.random() * 9, life: 0.9, maxLife: 0.9,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }
}

export function emitSmoke(eng: AutoDashEngine, n: number, color: string) {
  for (let i = 0; i < n; i++) {
    eng.particles.push({
      x: W / 2 + (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 25),
      y: H - 62 + Math.random() * 8,
      vx: (Math.random() - 0.5) * 60, vy: 30 + Math.random() * 60,
      size: 6 + Math.random() * 10, life: 0.7, maxLife: 0.7, color,
    })
  }
}

export function emitFlame(eng: AutoDashEngine) {
  for (let i = 0; i < 2; i++) {
    eng.particles.push({
      x: W / 2 + (i === 0 ? -22 : 22) + (Math.random() - 0.5) * 8,
      y: H - 58,
      vx: (Math.random() - 0.5) * 30, vy: 90 + Math.random() * 80,
      size: 5 + Math.random() * 7, life: 0.35, maxLife: 0.35,
      color: Math.random() < 0.5 ? "#fb923c" : "#fde047",
    })
  }
}

export function initRain(eng: AutoDashEngine) {
  eng.drops = []
  for (let i = 0; i < 90; i++) {
    eng.drops.push({ x: Math.random() * W, y: Math.random() * H, len: 10 + Math.random() * 18, spd: 500 + Math.random() * 400 })
  }
}

export function updateFx(eng: AutoDashEngine, dt: number) {
  for (let i = eng.particles.length - 1; i >= 0; i--) {
    const p = eng.particles[i]
    p.x += p.vx * dt; p.y += p.vy * dt; p.size += 14 * dt
    p.life -= dt
    if (p.life <= 0) eng.particles.splice(i, 1)
  }
  for (let i = eng.floaters.length - 1; i >= 0; i--) {
    const f = eng.floaters[i]
    f.y -= 24 * dt; f.life -= dt
    if (f.life <= 0) eng.floaters.splice(i, 1)
  }
  if (eng.raining) {
    for (const d of eng.drops) {
      d.y += d.spd * dt; d.x -= 60 * dt
      if (d.y > H) { d.y = -20; d.x = Math.random() * (W + 100) }
    }
  }
  if (eng.shakeT > 0) eng.shakeT -= dt
}
