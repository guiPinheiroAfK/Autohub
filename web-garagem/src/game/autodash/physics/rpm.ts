// AutoDash — physics/rpm.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine } from "../engine"
import { RPM_LIMITER, RPM_IDLE, GEAR_RATIOS, RPM_PER_KMH } from "../data"

export function powerCurve(_eng: AutoDashEngine, rpm: number) : number {
  if (rpm >= RPM_LIMITER) return 0
  if (rpm < 1400) return 0.25
  if (rpm < 4500) return 0.5 + 0.5 * ((rpm - 1400) / 3100)
  if (rpm < 7000) return 1.0
  return 1.0 - 0.45 * ((rpm - 7000) / (RPM_LIMITER - 7000))
}

export function rpmFor(eng: AutoDashEngine, speed: number, gear: number) : number {
  if (gear <= 0) return eng.rpm
  return RPM_IDLE + speed * GEAR_RATIOS[gear - 1] * RPM_PER_KMH
}
