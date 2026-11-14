// AutoDash — physics/traction.ts. Tração por eixo, pneus e relação final (ADR 0012).
// Funções puras: recebem o carro e devolvem multiplicadores. Sem estado, sem DOM.
// Referência: RWD com pneu padrão e relação final 1 dá multiplicador EXATAMENTE 1,
// então o carro padrão continua idêntico (golden master).
import { type CarSpec, type Drive, TYRES, type TyreId } from "../data"

export const LOAD_TRANSFER = 0.15   // fração do peso que vai para a traseira em aceleração máxima
export const TRACTION_SCALE = 2     // capacidade de um eixo com metade do peso e pneu padrão = 1
export const MIN_TRACTION = 0.5     // piso: perder tração reduz a aceleração, nunca zera
export const LAT_REF = 0.35         // força centrífuga que consome todo o círculo de atrito
export const LAT_CLAMP = 0.63       // teto da força lateral: com ele, RWD padrão nunca perde tração
export const DRIVE_LOSS: Record<Drive, number> = { FWD: 0.02, RWD: 0, AWD: 0.05 }

export function tyreOf(spec: CarSpec) {
  return TYRES[(spec.tyre ?? "padrao") as TyreId] ?? TYRES.padrao
}

export function finalDriveOf(spec: CarSpec): number {
  return spec.finalDrive ?? 1
}

// Fração do torque que vai para cada eixo motor.
export function driveSplit(spec: CarSpec): { front: number; rear: number } {
  const d = spec.drive ?? "RWD"
  if (d === "FWD") return { front: 1, rear: 0 }
  if (d === "AWD") {
    const f = spec.frontBias ?? 0.5
    return { front: f, rear: 1 - f }
  }
  return { front: 0, rear: 1 }
}

// Texto curto da tração e do pneu, para a garagem e o lobby ("torque legível").
export function driveLabel(spec: CarSpec): string {
  const d = spec.drive ?? "RWD"
  const s = driveSplit(spec)
  const tracao = d === "FWD" ? "dianteira (FWD)" : d === "RWD" ? "traseira (RWD)"
    : `integral ${Math.round(s.front * 100)}/${Math.round(s.rear * 100)} (AWD)`
  return `tração ${tracao} · pneu ${tyreOf(spec).name}`
}

// Direção por tração. Eixo dianteiro com torque "puxa reto" quando se acelera
// (subesterço de potência) e fecha a curva quando se alivia o pé (tuck-in).
// Vale na proporção do torque dianteiro: FWD inteiro, AWD pela divisão, RWD nada
// (devolve exatamente 1, então o carro padrão não muda).
//   aN: aceleração normalizada 0..1; passe 0 quando o acelerador está solto.
export const POWER_UNDERSTEER = 0.35
export const LIFT_TUCK = 0.12
export function steerK(spec: CarSpec, aN: number): number {
  const f = driveSplit(spec).front
  if (f === 0) return 1
  return aN > 0 ? 1 - POWER_UNDERSTEER * f * aN : 1 + LIFT_TUCK * f
}

// Duração da patinada (largada queimada, saída de batida). Tração integral
// divide o torque e agarra antes; FWD descarrega a dianteira e patina mais.
// RWD = exatamente 1.
export function wheelspinK(spec: CarSpec): number {
  if ((spec.drive ?? "RWD") === "FWD") return 1.25
  const f = driveSplit(spec).front
  return 1 - 1.4 * Math.min(f, 1 - f)
}

// Uso de tração do eixo mais exigido: demanda ÷ capacidade, a mesma conta de
// accelK (transferência de carga, pneu, círculo de atrito). Acima de 1 o eixo
// passa do limite. `mu` é a aderência do piso (1 = seco). Hoje só alimenta a
// patinada VISÍVEL (fumaça, giro, chiado); a força continua vindo de accelK.
export function usoTracao(spec: CarSpec, aN: number, centrif: number, mu = 1): number {
  if (aN <= 0) return 0
  const split = driveSplit(spec)
  const traction = tyreOf(spec).traction * mu
  const l = Math.min(LAT_CLAMP, Math.abs(centrif) / LAT_REF)
  const lat = Math.sqrt(1 - l * l)
  const capF = TRACTION_SCALE * (0.5 - LOAD_TRANSFER * aN) * traction * lat
  const capR = TRACTION_SCALE * (0.5 + LOAD_TRANSFER * aN) * traction * lat
  let u = 0
  if (split.front > 0) u = Math.max(u, (split.front * aN) / capF)
  if (split.rear > 0) u = Math.max(u, (split.rear * aN) / capR)
  return u
}

// Multiplicador da aceleração de base.
//   aN:      aceleração normalizada em reta, 0..1 (powerCurve × fator de marcha)
//   centrif: força centrífuga atual (mesma unidade de sim/update.ts)
// Limite de tração por eixo = capacidade (com transferência de carga e pneu) ÷ demanda
// (fração do torque × aN). O eixo mais limitado manda. Depois, perda do sistema de
// tração e raiz da relação final (relação mais curta = mais torque no chão).
export function accelK(spec: CarSpec, aN: number, centrif: number): number {
  const split = driveSplit(spec)
  const traction = tyreOf(spec).traction
  let k = 1
  if (aN > 0) {
    // círculo de atrito: a curva come aderência do eixo motor (saída de curva)
    const l = Math.min(LAT_CLAMP, Math.abs(centrif) / LAT_REF)
    const lat = Math.sqrt(1 - l * l)
    const capF = TRACTION_SCALE * (0.5 - LOAD_TRANSFER * aN) * traction * lat
    const capR = TRACTION_SCALE * (0.5 + LOAD_TRANSFER * aN) * traction * lat
    let lim = 1
    if (split.front > 0) lim = Math.min(lim, capF / (split.front * aN))
    if (split.rear > 0) lim = Math.min(lim, capR / (split.rear * aN))
    k = Math.max(MIN_TRACTION, lim)
  }
  return k * (1 - DRIVE_LOSS[spec.drive ?? "RWD"]) * Math.sqrt(finalDriveOf(spec))
}
