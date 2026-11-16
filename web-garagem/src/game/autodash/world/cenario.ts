// AutoDash — world/cenario.ts. Cenário de beira por TRECHOS (Fase 8.4).
//
// Antes a beira da pista era um padrão fixo de três enfeites (árvore a cada 4
// segmentos, poste a cada 10, outdoor a cada 51), igual a pista inteira. Agora a
// pista é dividida em trechos (centro, subúrbio, campo, orla) que se alternam,
// cada bioma com os seus. Cada segmento escolhe os enfeites por um hash fixo do
// índice: sem sorteio no render, a mesma pista desenha sempre o mesmo cenário.
// Desenho dos enfeites novos em render/cenario.ts.

export type TipoTrecho = "centro" | "suburbio" | "campo" | "orla"

export interface Trecho { a: number; b: number; tipo: TipoTrecho }

export const CENARIO = {
  trechoMin: 320,  // segmentos (~64 mil u: uns 9 s a 200 km/h)
  trechoMax: 720,
  transicao: 40,   // segmentos no começo de cada trecho em que os dois tipos se misturam
}

export const TRECHOS_DO_BIOMA: Record<string, TipoTrecho[]> = {
  cidade: ["centro", "suburbio", "campo"],
  costa: ["orla", "suburbio", "campo"],
}

/** Tipos de enfeite (os números são os `kind` do drawDeco; 20+ moram em render/cenario.ts). */
export const ENF = {
  arvore: 0, poste: 1, outdoor: 2, predioAlto: 6, palmeira: 7,
  casa: 20, muro: 21, ponto: 22, arvoreLarga: 23, pinheiro: 24, plantacao: 25,
  celeiro: 26, quiosque: 27, guardaSol: 28, predioMedio: 29, cerca: 30,
} as const

export interface Enfeite {
  kind: number
  lado: -1 | 1
  dist: number    // meias-pistas do centro da pista
  escala: number  // largura do sprite em fração da meia-pista
  seed: number    // variação do desenho (cor, altura)
}

/** Hash inteiro → [0, 1). Estável: o mesmo (n, k) dá sempre o mesmo número. */
export function hash01(n: number, k = 0): number {
  let x = (Math.imul(n | 0, 374761393) + Math.imul(k | 0, 668265263)) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

/** Divide a pista de `N` segmentos em trechos do bioma, sem dois iguais seguidos. */
export function gerarTrechos(N: number, seed: number, biomaId: string): Trecho[] {
  const tipos = TRECHOS_DO_BIOMA[biomaId] ?? TRECHOS_DO_BIOMA.cidade
  const out: Trecho[] = []
  let i = 0, k = 0, ultimo = -1
  while (i < N) {
    const len = CENARIO.trechoMin + Math.floor(hash01(seed, k) * (CENARIO.trechoMax - CENARIO.trechoMin))
    let t = Math.floor(hash01(seed, k + 997) * tipos.length)
    if (t === ultimo) t = (t + 1) % tipos.length
    out.push({ a: i, b: Math.min(N, i + len), tipo: tipos[t] })
    ultimo = t; i += len; k++
  }
  return out
}

/** Tipo de trecho no segmento `idx`; no começo de cada trecho mistura com o anterior. */
export function tipoNoSeg(trechos: Trecho[], idx: number): TipoTrecho {
  if (trechos.length === 0) return "suburbio"
  for (let j = 0; j < trechos.length; j++) {
    const t = trechos[j]
    if (idx < t.a || idx >= t.b) continue
    const dentro = idx - t.a
    if (j > 0 && dentro < CENARIO.transicao && hash01(idx, 7) > dentro / CENARIO.transicao) return trechos[j - 1].tipo
    return t.tipo
  }
  return trechos[trechos.length - 1].tipo
}

/**
 * Enfeites de beira deste segmento (0 a 3). `arvore` é a árvore do bioma.
 * Densidade pensada para no máximo ~2 sprites por segmento em média.
 */
export function enfeitesDoSegmento(trechos: Trecho[], idx: number, arvore: number): Enfeite[] {
  const tipo = tipoNoSeg(trechos, idx)
  const h = (k: number) => hash01(idx, k)
  const lado = (k: number): -1 | 1 => (h(k) < 0.5 ? -1 : 1)
  const out: Enfeite[] = []
  const add = (kind: number, l: -1 | 1, dist: number, escala: number) => out.push({ kind, lado: l, dist, escala, seed: Math.floor(h(31) * 1e6) })
  if (tipo === "centro") {
    // prédios dos dois lados, alternando altos e médios, colados um no outro
    if (idx % 3 === 0) {
      add(h(1) < 0.45 ? ENF.predioAlto : ENF.predioMedio, -1, 1.95 + h(2) * 0.5, h(1) < 0.45 ? 0.16 : 0.62)
      add(h(3) < 0.45 ? ENF.predioAlto : ENF.predioMedio, 1, 1.95 + h(4) * 0.5, h(3) < 0.45 ? 0.16 : 0.62)
    }
    if (idx % 10 === 5) add(ENF.poste, -1, 1.28, 0.05)
    if (idx % 90 === 45) add(ENF.ponto, 1, 1.42, 0.36)
    if (idx % 70 === 20) add(ENF.outdoor, 1, 1.75, 0.55)
  } else if (tipo === "suburbio") {
    if (idx % 6 === 0) add(ENF.casa, lado(1), 1.75 + h(2) * 0.5, 0.5)
    if (idx % 6 === 3) add(ENF.muro, lado(3), 1.42, 0.45)
    if (idx % 4 === 2) add(h(5) < 0.5 ? arvore : ENF.arvoreLarga, lado(6), 1.55 + h(7) * 0.5, h(5) < 0.5 ? 0.22 : 0.3)
    if (idx % 10 === 5) add(ENF.poste, -1, 1.28, 0.05)
  } else if (tipo === "campo") {
    if (idx % 2 === 0) add(ENF.cerca, (idx / 2) % 2 === 0 ? -1 : 1, 1.4, 0.4)
    if (idx % 5 === 1 && h(1) < 0.6) add(h(2) < 0.5 ? ENF.pinheiro : ENF.arvoreLarga, lado(3), 1.8 + h(4) * 1.2, h(2) < 0.5 ? 0.22 : 0.3)
    if (idx % 12 === 6) add(ENF.plantacao, lado(5), 2.6, 1.4)
    if (idx % 160 === 80) add(ENF.celeiro, lado(6), 2.5, 0.7)
    if (idx % 97 === 40) add(ENF.outdoor, lado(7), 1.75, 0.55)
  } else { // orla
    if (idx % 4 === 0) add(ENF.palmeira, -1, 1.55 + h(1) * 0.3, 0.22)
    if (idx % 30 === 15) add(ENF.quiosque, -1, 1.65, 0.45)
    if (idx % 7 === 3 && h(2) < 0.6) add(ENF.guardaSol, -1, 1.95 + h(3) * 0.6, 0.2)
    if (idx % 10 === 5) add(ENF.poste, 1, 1.28, 0.05)
    if (idx % 50 === 25) add(ENF.predioMedio, 1, 2.0, 0.62)
    if (idx % 8 === 4) add(arvore, 1, 1.6, 0.22)
  }
  // teto de desempenho: quando as regras coincidem, fica com os 3 primeiros
  return out.length > 3 ? out.slice(0, 3) : out
}
