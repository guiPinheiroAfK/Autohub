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
export const MARGEM_MAO_DUPLA = 25000

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

/** Distância até o começo da próxima mão dupla à frente de `z` (dentro da margem), ou null. */
export function inicioMaoDupla(eng: Pick<AutoDashEngine, "zones" | "trackLen">, z: number): number | null {
  let best: number | null = null
  for (const zn of eng.zones) {
    if (zn.type !== "wrongway") continue
    const d = wrap(eng.trackLen, zn.z, z)
    if (d > 0 && d < MARGEM_MAO_DUPLA && (best === null || d < best)) best = d
  }
  return best
}

/** Índices (0..3, da esquerda) das faixas em que o civil pode andar em `z`. */
export function faixasDoCivil(maoDupla: boolean): readonly number[] {
  return maoDupla ? [2, 3] : [0, 1, 2, 3]
}

/** Índice de faixa (0..3) de um offset. */
export const indiceFaixa = (offset: number) => Math.round((offset + 0.75) / 0.5)

/**
 * Nasce uma mão dupla: o trânsito que já está nas faixas da esquerda do trecho e
 * ainda está além do horizonte (ninguém vê) vai para a direita na hora, ou sai de
 * cena se não houver vaga. O que já está à vista sai pela IA, com seta. Antes todos
 * migravam de uma vez, na cara do jogador (playtest 17/11: "os carros dão uma
 * baita bugada ao entrar na mão dupla").
 */
export function limparEsquerdaInvisivel(eng: AutoDashEngine, zn: { z: number; end: number }, visao: number) {
  const pz = eng.position
  for (const t of eng.traffic) {
    if (t.role !== "civilian" || t.parked || t.dead) continue
    if (t.offset > 0.05 && t.targetOffset > 0.05) continue
    if (wrap(eng.trackLen, t.z, zn.z) < -MARGEM_MAO_DUPLA || wrap(eng.trackLen, zn.end, t.z) < 0) continue
    if (wrap(eng.trackLen, t.z, pz) < visao * 1.05) continue // à vista: a IA resolve
    const lane = [0.25, 0.75].find(l => !eng.traffic.some(o => o !== t && !o.dead && Math.abs(wrap(eng.trackLen, o.z, t.z)) < 1500 && (Math.abs(o.offset - l) < 0.3 || Math.abs(o.targetOffset - l) < 0.3)))
    if (lane === undefined) { t.dead = true; continue }
    t.offset = lane; t.targetOffset = lane; t.blinkT = 0
  }
}
