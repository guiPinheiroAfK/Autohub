// AutoDash — world/obstacles.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { crash } from "../modes/solo"
import { burst } from "../fx/particles"
import { AutoDashEngine, W, H } from "../engine"
import { CARS, SEG_LEN } from "../data"
import { wrapDz } from "../traffic/spawner"

export function updateObstacles(eng: AutoDashEngine, playerZ: number) {
  const spec = CARS[eng.cfg.carIdx]
  for (const o of eng.obstacles) {
    const d = wrapDz(eng, o.z, playerZ)
    if (d < -35 * SEG_LEN) { o.dead = true; continue }
    const halfSum = (o.w + spec.width) / 2 * 0.85
    // obstáculo é ESTÁTICO: a velocidade de fechamento é a do jogador — acima
    // de ~45 km/h a janela em Z é pulada entre frames. A varredura (cruzou o
    // ponto neste frame?) é obrigatória aqui, não otimização.
    const prev = o.prevD ?? d
    o.prevD = d
    const swept = prev > 0 && d <= 0 && prev < 1200 && prev - d < 2000
    if ((Math.abs(d) < o.len / 2 + 40 || swept) && Math.abs(o.offset - eng.playerX) < halfSum && !eng.crashed && eng.immuneT <= 0) {
      if (o.kind === "cone") {
        // cone é perdoável: tranco, perde velocidade e combo — não mata
        o.dead = true
        eng.speed *= 0.78
        eng.combo = 0
        eng.shakeT = Math.max(eng.shakeT, 0.3)
        eng.immuneT = Math.max(eng.immuneT, 0.25)
        eng.audio.offroad()
        burst(eng, W / 2, H - 110, 10, ["#fb923c", "#fde68a"])
        eng.floaters.push({ text: "CONE! 🚧", color: "#fb923c", y: H * 0.44, life: 0.9, big: false })
      } else if (eng.shield) {
        eng.shield = false
        eng.immuneT = 2.0
        o.dead = true
        eng.audio.shieldBreak()
        burst(eng, W / 2, H - 110, 20, ["#60a5fa", "#bfdbfe"])
        eng.floaters.push({ text: "ESCUDO QUEBROU!", color: "#60a5fa", y: H * 0.4, life: 1.3, big: false })
      } else {
        crash(eng)
      }
    }
  }
  if (eng.obstacles.some(o => o.dead)) eng.obstacles = eng.obstacles.filter(o => !o.dead)
}
