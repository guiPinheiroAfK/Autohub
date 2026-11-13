// AutoDash — render/particles.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine } from "../engine"
import { clamp } from "../math"

export function renderParticles(eng: AutoDashEngine) {
  const ctx = eng.ctx
  for (const p of eng.particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1) * 0.8
    ctx.fillStyle = p.color
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
}
