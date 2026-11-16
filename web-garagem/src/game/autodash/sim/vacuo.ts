// AutoDash — sim/vacuo.ts. Vácuo (slipstream, E9 da pesquisa visual-e-desafio).
//
// Colado atrás de um veículo rápido, na mesma faixa, o ar já vem aberto: o carro
// ganha um empurrão até +4% da velocidade máxima. Sair do vácuo depois de um
// tempo nele dá um "estilingue" curto. É a contra-jogada do rival que fecha (E7)
// e o elástico honesto (pesquisa 4.3): recupera atraso por habilidade, sem mexer
// no carro de ninguém. Fica fora de sim/longitudinal.ts: é um empurrão somado
// depois do passo longitudinal, que não muda quando não há ninguém na frente.
import { type AutoDashEngine, H, PLAYER_Z } from "../engine"
import { type CarSpec } from "../data"
import { wrapDz } from "../traffic/spawner"

export const VACUO = {
  minZ: 260,         // mais perto que isso é encostar (a colisão cuida)
  alcanceZ: 1500,    // ~5 carros
  largura: 0.22,     // |dx| máximo: mesma faixa
  vMin: 90,          // km/h do jogador para valer
  razaoV: 0.65,      // o da frente precisa andar a pelo menos 65% da sua velocidade
  ganhoMax: 0.04,    // +4% de velocidade máxima na força total
  acel: 9,           // km/h/s de empurrão na força total
  minS: 0.8,         // s no vácuo para o estilingue valer
  estilingueS: 1.0,  // duração do estilingue
  estilingueAcel: 14, // km/h/s no começo do estilingue (cai até zero)
} as const

/**
 * Força do vácuo (0..1) atrás de um veículo a `gapZ` à frente (unidades de
 * mundo), deslocado `dx` na lateral, andando a `vFrente` km/h, com você a `vEu`.
 */
export function forcaVacuo(gapZ: number, dx: number, vFrente: number, vEu: number): number {
  if (vEu < VACUO.vMin || gapZ < VACUO.minZ || gapZ > VACUO.alcanceZ) return 0
  if (Math.abs(dx) > VACUO.largura || vFrente < vEu * VACUO.razaoV) return 0
  const perto = 1 - (gapZ - VACUO.minZ) / (VACUO.alcanceZ - VACUO.minZ)
  const lateral = 1 - Math.abs(dx) / VACUO.largura
  return Math.min(1, perto * 1.4) * (0.5 + 0.5 * lateral)
}

/** Empurrão (km/h/s) do vácuo: some acima de topSpeed × (1 + 4% × força). */
export function empurraoVacuo(forca: number, kmh: number, topSpeed: number): number {
  if (forca <= 0) return 0
  if (kmh >= topSpeed * (1 + VACUO.ganhoMax * forca)) return 0
  return VACUO.acel * forca
}

/**
 * Carro visto pelo passo longitudinal com o vácuo: o ar aberto sobe o teto em
 * até 4%. Sem vácuo devolve o MESMO objeto (nada muda, nem o golden). É assim
 * que o ganho passa da trava de segurança de sim/longitudinal.ts sem mexer nela.
 */
export function specComVacuo(spec: CarSpec, forca: number): CarSpec {
  if (forca <= 0) return spec
  return { ...spec, topSpeed: spec.topSpeed * (1 + VACUO.ganhoMax * forca) }
}

/** Força que sobe o teto: o vácuo, ou o estilingue caindo ao sair dele (o teto desce em 1 s, sem degrau). */
export function forcaTeto(eng: AutoDashEngine): number {
  return Math.max(eng.vacuo, eng.estilingueT / VACUO.estilingueS)
}

/** Melhor vácuo agora: trânsito no seu sentido, desafiante do racha e rivais da corrida. */
function vacuoAgora(eng: AutoDashEngine): number {
  const playerZ = eng.position + PLAYER_Z
  let melhor = 0
  for (const t of eng.traffic) {
    if (t.role === "oncoming" || t.parked) continue
    const f = forcaVacuo(wrapDz(eng, t.z, playerZ), t.offset - eng.playerX, t.speed, eng.speed)
    if (f > melhor) melhor = f
  }
  if (eng.race && eng.mode === "race") {
    for (const r of eng.race.rivais) {
      if (r.finished) continue
      const z = ((r.z % eng.trackLen) + eng.trackLen) % eng.trackLen
      const f = forcaVacuo(wrapDz(eng, z, playerZ), r.x - eng.playerX, r.v, eng.speed)
      if (f > melhor) melhor = f
    }
  }
  return melhor
}

/** Um quadro de vácuo e estilingue, depois do passo longitudinal. */
export function aplicarVacuo(eng: AutoDashEngine, spec: CarSpec, throttle: number, dt: number) {
  const f = vacuoAgora(eng)
  // suaviza a entrada e a saída (o ícone e o empurrão não piscam)
  eng.vacuo += (f - eng.vacuo) * Math.min(1, dt * 6)
  if (f === 0 && eng.vacuo < 0.02) eng.vacuo = 0 // fecha em zero (sem resto infinito)
  if (eng.vacuo > 0.15) eng.vacuoS += dt
  else {
    if (eng.vacuoS >= VACUO.minS && throttle > 0) {
      eng.estilingueT = VACUO.estilingueS
      eng.floaters.push({ text: "ESTILINGUE! 💨", color: "#56B4E9", y: H * 0.46, life: 0.9, big: false })
    }
    eng.vacuoS = 0
  }
  const estilingue = VACUO.estilingueAcel * (eng.estilingueT / VACUO.estilingueS)
  eng.estilingueT = Math.max(0, eng.estilingueT - dt)
  if (eng.gear < 1 || throttle <= 0) return
  eng.speed += (empurraoVacuo(eng.vacuo, eng.speed, spec.topSpeed) + estilingue) * dt
}
