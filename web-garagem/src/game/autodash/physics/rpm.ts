// AutoDash — physics/rpm.ts. Giro e força do motor do carro atual (physics/motores.ts).
import { AutoDashEngine } from "../engine"
import { GEAR_RATIOS, CARS } from "../data"
import { finalDriveOf } from "./traction"
import { motorDe, forcaEm, rpmPorKmh } from "./motores"

/** Fração da potência máxima neste giro, já com o boost atual do turbo. */
export function powerCurve(eng: AutoDashEngine, rpm: number) : number {
  return forcaEm(motorDe(eng), rpm, eng.boost ?? 0)
}

export function rpmFor(eng: AutoDashEngine, speed: number, gear: number) : number {
  if (gear <= 0) return eng.rpm
  const m = motorDe(eng)
  return m.idle + speed * GEAR_RATIOS[gear - 1] * rpmPorKmh(m) * finalDriveOf(CARS[eng.cfg.carIdx])
}
