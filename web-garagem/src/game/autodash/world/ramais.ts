// AutoDash — world/ramais.ts. Ramal paralelo: atalho ou ramificação (ADR 0014).
//
// Um ramal é uma segunda faixa de asfalto ao lado da pista, entre os segmentos
// `a` e `b` da MESMA fita. Ele compartilha o `z` da pista: quem está no ramal é
// só um `x` além da borda. Por isso bots, rivais de rede, minimapa e contagem de
// voltas não precisam saber que ele existe. Aqui ficam só funções puras.

export interface Ramal {
  id: string
  nome: string
  a: number        // segmento onde a pista começa a alargar
  b: number        // segmento onde o ramal termina de fundir (a < b, não cruza a largada)
  lado: 1 | -1     // 1 = direita, -1 = esquerda
  afast: number    // faixa de grama entre a pista e o ramal no miolo (meias-pistas)
  larg: number     // largura do ramal (meias-pistas; a pista inteira vale 2)
  ganho: number    // multiplicador do avanço de quem anda no miolo do ramal
  posto?: boolean  // faixa de acesso de um posto de combustível (Fase 5, world/posto.ts)
}

// Perfil ao longo do ramal, das pontas para o miolo (em segmentos):
// a pista alarga, o ramal corre COLADO (faixa de entrada, dá tempo de mudar de
// faixa), descola e segue separado. Na saída, o mesmo ao contrário.
export const RAMAL_ABRE = 10
export const RAMAL_COLADO = 110
export const RAMAL_DESCOLA = 40
// tamanho mínimo: duas pontas completas e um miolo que valha a pena
export const RAMAL_MIN = 2 * (RAMAL_ABRE + RAMAL_COLADO + RAMAL_DESCOLA) + 60

export interface RamalPerfil {
  f: number   // 0 = colado na pista, 1 = totalmente separado
  w: number   // 0..1 fração da largura (abre e fecha nas pontas)
}

const SEM_PERFIL: RamalPerfil = { f: 0, w: 0 }

/** Perfil do ramal no segmento `idx`, ou null fora do trecho dele. */
export function ramalPerfil(r: Ramal, idx: number): RamalPerfil | null {
  if (idx < r.a || idx > r.b) return null
  const e = Math.min(idx - r.a, r.b - idx) // distância até a ponta mais próxima
  const w = Math.min(1, e / RAMAL_ABRE)
  const t = Math.min(1, Math.max(0, (e - RAMAL_ABRE - RAMAL_COLADO) / RAMAL_DESCOLA))
  return { f: t * t * (3 - 2 * t), w }
}

/** Igual a ramalPerfil, mas devolve perfil zerado fora do trecho (para o render). */
export function ramalPerfilOuZero(r: Ramal, idx: number): RamalPerfil {
  return ramalPerfil(r, idx) ?? SEM_PERFIL
}

/**
 * Bordas do asfalto do ramal, em meias-pistas a partir do centro, no lado dele.
 * Colado (f = 0) a borda interna encosta no asfalto da pista (0.97); separado
 * (f = 1) ela fica depois da zebra (1.11) mais a grama do afastamento.
 */
export function ramalBordas(r: Ramal, p: RamalPerfil): { inner: number; outer: number } {
  const inner = 0.97 + (0.14 + r.afast) * p.f
  return { inner, outer: inner + r.larg * p.w }
}

export interface RamalAqui {
  r: Ramal
  p: RamalPerfil
  inner: number
  outer: number
}

/** Ramal que cobre o segmento `idx` (o primeiro, se houver mais de um). */
export function ramalNoSeg(ramais: Ramal[], idx: number): RamalAqui | null {
  for (const r of ramais) {
    const p = ramalPerfil(r, idx)
    if (!p) continue
    const b = ramalBordas(r, p)
    return { r, p, inner: b.inner, outer: b.outer }
  }
  return null
}

/** O carro em `x` (meias-pistas, com sinal) está sobre o asfalto do ramal? */
export function sobreRamal(q: RamalAqui, x: number): boolean {
  const xs = x * q.r.lado
  return xs >= q.inner - 0.08 && xs <= q.outer + 0.05
}

/**
 * Multiplicador de avanço em `x`. Só vale no miolo (ramal já separado) e com o
 * carro realmente fora da pista principal; na faixa colada de entrada vale 1.
 */
export function ganhoRamal(q: RamalAqui | null, x: number): number {
  if (!q || q.p.f <= 0.5 || !sobreRamal(q, x)) return 1
  return x * q.r.lado > 1.08 ? q.r.ganho : 1
}

/** Centro do ramal (com sinal), para bots e para o desenho de placas. */
export function ramalCentro(q: RamalAqui): number {
  return ((q.inner + q.outer) / 2) * q.r.lado
}
