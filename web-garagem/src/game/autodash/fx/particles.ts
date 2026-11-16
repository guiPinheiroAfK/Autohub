// AutoDash — fx/particles.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, W, H } from "../engine"
import { coresChama, corFumaca } from "../cosmetic/bodykit"
import { CARS } from "../data"

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

/**
 * Onde estão as rodas traseiras do seu carro na tela agora, com o giro do
 * drift (render/player.ts: o carro anda -driftAng·70 px e gira -driftAng·0,5
 * em volta de (W/2, H-90)). [esquerda, direita].
 */
export function rodasTraseiras(eng: AutoDashEngine): [{ x: number; y: number }, { x: number; y: number }] {
  const largura = CARS[eng.cfg.carIdx].width * 640 // a largura do desenho (drawPlayerCar)
  const giro = eng.driftAng
  const bounce = Math.sin(eng.position * 0.03) * Math.min(3, eng.speed / 60) + eng.pitchY
  const px = W / 2, py = H - 90 + bounce
  const cx = W / 2 - giro * 70, cy = H - 38 + bounce
  const cos = Math.cos(-giro * 0.5), sin = Math.sin(-giro * 0.5)
  const roda = (lado: number) => {
    const x = cx + lado * largura * 0.4 - px, y = cy - py
    return { x: px + x * cos - y * sin, y: py + x * sin + y * cos }
  }
  return [roda(-1), roda(1)]
}

/** Índice da roda de fora (a traseira que escapa): o giro anti-horário leva a traseira para a direita. */
export const rodaDeFora = (eng: AutoDashEngine): 0 | 1 => (eng.driftAng > 0 ? 1 : 0)

/**
 * Fumaça do drift saindo das rodas traseiras (a de fora solta mais). Gasta
 * exatamente os mesmos sorteios por partícula que emitSmoke: trocar uma pela
 * outra não mexe na sequência do Math.random semeado dos testes.
 */
export function emitSmokeRodas(eng: AutoDashEngine, n: number, color: string) {
  const rodas = rodasTraseiras(eng)
  const fora = rodaDeFora(eng)
  const meio = W / 2 - eng.driftAng * 70
  for (let i = 0; i < n; i++) {
    const r = rodas[Math.random() < 0.7 ? fora : 1 - fora]
    const lado = r.x < meio ? -1 : 1
    eng.particles.push({
      x: r.x + lado * Math.random() * 10,
      y: r.y - 4 + Math.random() * 8,
      vx: (Math.random() - 0.5) * 50 + lado * 40, vy: 40 + Math.random() * 60,
      size: 7 + Math.random() * 11, life: 0.95, maxLife: 0.95, color,
    })
  }
}

export function emitFlame(eng: AutoDashEngine) {
  // cor da chama escolhida na garagem (Fase 7); a primeira é a laranja de antes
  const [corpo, miolo] = coresChama(eng.cfg.customs[eng.cfg.carIdx])
  for (let i = 0; i < 2; i++) {
    eng.particles.push({
      x: W / 2 + (i === 0 ? -22 : 22) + (Math.random() - 0.5) * 8,
      y: H - 58,
      vx: (Math.random() - 0.5) * 30, vy: 90 + Math.random() * 80,
      size: 5 + Math.random() * 7, life: 0.35, maxLife: 0.35,
      color: Math.random() < 0.5 ? corpo : miolo,
    })
  }
}

/** Fumaça do escape na cor escolhida na garagem; no padrão, a cor `base` de antes. */
export function emitEscape(eng: AutoDashEngine, n: number, base: string) {
  emitSmoke(eng, n, corFumaca(eng.cfg.customs[eng.cfg.carIdx], base))
}

export function initRain(eng: AutoDashEngine) {
  eng.drops = []
  for (let i = 0; i < 90; i++) {
    eng.drops.push({ x: Math.random() * W, y: Math.random() * H, len: 10 + Math.random() * 18, spd: 500 + Math.random() * 400 })
  }
}

/** Altura de um texto flutuante na tela (fonte 34 ou 20 + respiro). */
const alturaFloater = (big: boolean) => big ? 40 : 26

/**
 * Texto novo que cairia em cima de outro ainda na tela desce para baixo dele
 * (uma vez, quando nasce). Antes dois avisos no mesmo quadro se sobrepunham e
 * nenhum dava para ler.
 */
export function arrumarFloaters(eng: AutoDashEngine) {
  const postos = eng.floaters.filter(f => f.posto)
  for (const f of eng.floaters) {
    if (f.posto) continue
    f.posto = true
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      const bate = postos.find(g => Math.abs(g.y - f.y) < (alturaFloater(g.big) + alturaFloater(f.big)) / 2)
      if (!bate) break
      f.y = bate.y + (alturaFloater(bate.big) + alturaFloater(f.big)) / 2
    }
    postos.push(f)
  }
}

export function updateFx(eng: AutoDashEngine, dt: number) {
  for (let i = eng.particles.length - 1; i >= 0; i--) {
    const p = eng.particles[i]
    p.x += p.vx * dt; p.y += p.vy * dt; p.size += 14 * dt
    p.life -= dt
    if (p.life <= 0) eng.particles.splice(i, 1)
  }
  arrumarFloaters(eng)
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
