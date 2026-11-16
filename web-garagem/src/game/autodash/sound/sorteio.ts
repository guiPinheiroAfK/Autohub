// AutoDash — sound/sorteio.ts. Sorteio determinístico (mulberry32) dos
// sintetizadores: a mesma semente dá sempre o mesmo som (testes reproduzíveis).

export class Sorteio {
  private s: number
  /** Semente 0 vira `padrao` (cada sintetizador tem a sua). */
  constructor(semente: number, padrao: number) { this.s = semente >>> 0 || padrao }

  /** Número em [0, 1). */
  proximo(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
