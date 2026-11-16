// AutoDash — physics/gearbox.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, W, H } from "../engine"
import { rpmFor } from "./rpm"
import { CARS } from "../data"
import { motorDe, giroNaFrac, faixa, type MotorFisico } from "./motores"
import { nMarchas } from "./cambio"

// Marcha que o câmbio engata saindo do neutro em movimento: a mais alta que cai
// no meio da faixa do motor. Se nenhuma cai (velocidade entre duas marchas ou
// acima da faixa de todas), a mais baixa que não passa do topo dessa faixa —
// nunca uma que jogue o giro acima do corte. Antes, a 250 km/h nenhuma marcha
// ficava "no meio" e sobrava a 1ª: o giro estourava e o carro caía para a
// velocidade de corte da 1ª (~60 km/h).
export function marchaDoNeutro(eng: AutoDashEngine): number {
  const m = motorDe(eng), lo = giroNaFrac(m, 0.129), hi = giroNaFrac(m, 0.8)
  const n = nMarchas(eng)
  for (let g = n; g >= 1; g--) {
    const r = rpmFor(eng, eng.speed, g)
    if (r >= lo && r <= hi) return g
  }
  for (let g = 1; g <= n; g++) if (rpmFor(eng, eng.speed, g) <= hi) return g
  return n
}

export function shiftUp(eng: AutoDashEngine) {
  if (eng.gear === 0) {
    eng.gear = marchaDoNeutro(eng)
    eng.shiftT = CARS[eng.cfg.carIdx].shiftMs / 1000
    eng.audio.shift()
    popExhaust(eng)
    return
  }
  if (eng.gear >= nMarchas(eng)) return
  eng.gear++
  eng.shiftT = CARS[eng.cfg.carIdx].shiftMs / 1000
  if (rpmFor(eng, eng.speed, eng.gear) < giroNaFrac(motorDe(eng), 0.086)) eng.audio.bog()
  else { eng.audio.shift(); popExhaust(eng) }
}

export function shiftDown(eng: AutoDashEngine) {
  if (eng.gear <= 0) return
  if (eng.gear === 1) { eng.gear = 0; eng.audio.shift(); return }
  const next = eng.gear - 1
  const m = motorDe(eng)
  if (rpmFor(eng, eng.speed, next) > m.corte + 0.057 * faixa(m)) { eng.audio.limiter(); return } // protege o motor
  eng.gear = next
  eng.shiftT = CARS[eng.cfg.carIdx].shiftMs / 1000
  eng.audio.shift()
}

// Câmbio automático estilo conversor de torque (ZF): escolhe a marcha-alvo a cada
// quadro em vez de só reagir ao corte. Antes ele só reduzia abaixo de 2000 rpm —
// na 6ª isso era < ~42 km/h, então o carro ficava "preso" na marcha alta.
//   - no gás: sobe um pouco antes da faixa vermelha; kickdown pula direto pra
//     marcha mais baixa que ainda fica abaixo do giro de kickdown (6→4 numa
//     retomada, como um ZF8)
//   - sem gás / freando: reduz pra marcha mais alta que mantém o giro de rodagem
// Os três giros saem da faixa de cada motor (o V8 de 71 troca em ~5300, o VTEC
// em ~7800). A histerese (sobe > kickdown) evita o câmbio ficar caçando marcha.
export function limitesAuto(m: MotorFisico) {
  const f = faixa(m)
  const sobe = m.redline - 0.1 * f
  return { sobe, kickdown: sobe - 0.1 * f, rodagem: m.idle + 0.19 * f }
}

export function autoGearTarget(eng: AutoDashEngine, throttle: boolean) : number {
  const g = eng.gear
  const L = limitesAuto(motorDe(eng))
  if (throttle) {
    if (eng.rpm > L.sobe && g < nMarchas(eng)) return g + 1
    for (let t = 1; t < g; t++) if (rpmFor(eng, eng.speed, t) <= L.kickdown) return t
    return g
  }
  if (eng.rpm >= L.rodagem) return g
  for (let t = g - 1; t >= 1; t--) if (rpmFor(eng, eng.speed, t) >= L.rodagem) return t
  return 1
}

export function autoShift(eng: AutoDashEngine, throttle: boolean) {
  const target = autoGearTarget(eng, throttle)
  if (target > eng.gear) { shiftUp(eng); return }
  if (target >= eng.gear) return
  eng.gear = target
  eng.shiftT = CARS[eng.cfg.carIdx].shiftMs / 1000
  eng.audio.shift()
  if (throttle) popExhaust(eng)
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
