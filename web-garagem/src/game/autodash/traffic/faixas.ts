// AutoDash — traffic/faixas.ts. Regras de faixa do trânsito civil (playtest 17/11).
//
// 1) Parede: "nunca fechar as 4 faixas" olhando só 900 u era inútil a 180 km/h
//    (900 u = 0,04 s). A janela agora é a que o jogador consegue ler e costurar.
// 2) Mão dupla: as 2 faixas da esquerda são da contramão. Civil não nasce, não
//    recicla e não troca para lá; e só sobram 2 faixas, que também nunca fecham.
import type { AutoDashEngine } from "../engine"

/** Janela (u) em que ocupar a última faixa livre vira parede. */
export const FECHA_Z = 6000
/** Antes de a mão dupla começar o civil já sai da esquerda (a seta tem tempo de acabar). */
export const MARGEM_MAO_DUPLA = 10000

const wrap = (len: number, a: number, b: number) => {
  let d = a - b
  if (d > len / 2) d -= len
  if (d < -len / 2) d += len
  return d
}

/** O ponto `z` está numa mão dupla (ou logo antes dela)? */
export function naMaoDupla(eng: Pick<AutoDashEngine, "zones" | "trackLen">, z: number): boolean {
  for (const zn of eng.zones) {
    if (zn.type !== "wrongway") continue
    if (wrap(eng.trackLen, z, zn.z) > -MARGEM_MAO_DUPLA && wrap(eng.trackLen, zn.end, z) > 0) return true
  }
  return false
}

/** Índices (0..3, da esquerda) das faixas em que o civil pode andar em `z`. */
export function faixasDoCivil(maoDupla: boolean): readonly number[] {
  return maoDupla ? [2, 3] : [0, 1, 2, 3]
}

/** Índice de faixa (0..3) de um offset. */
export const indiceFaixa = (offset: number) => Math.round((offset + 0.75) / 0.5)
