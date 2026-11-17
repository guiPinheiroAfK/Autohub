// AutoDash — world/cenario.ts. Cenário de beira por TRECHOS (Fase 8.4).
//
// Antes a beira da pista era um padrão fixo de três enfeites (árvore a cada 4
// segmentos, poste a cada 10, outdoor a cada 51), igual a pista inteira. Agora a
// pista é dividida em trechos (centro, subúrbio, campo, orla) que se alternam,
// cada bioma com os seus. Cada segmento escolhe os enfeites por um hash fixo do
// índice: sem sorteio no render, a mesma pista desenha sempre o mesmo cenário.
// Desenho dos enfeites novos em render/cenario.ts.

// Cidade (playtest 16/11, "mais cara de Tokyo Drift"; bíblia de cenários em
// docs/specs/autodash/CENARIOS.md): distritos com 1 cor dominante + 1 de acento.
// shibuya: magenta + branco LED (telas, multidão, fachadas); shinjuku: ciano +
// magenta (letreiros verticais, lanternas de izakaya, vapor de bueiro);
// oficinas: verde konbini + branco (galpões de tuning, pneus, máquinas de bebida).
export type TipoTrecho = "centro" | "suburbio" | "campo" | "orla" | "mata" | "shibuya" | "shinjuku" | "oficinas" | "entrada"
  | "portal" | "serraPe" | "serraMeio" | "mirante" | "serraDescida" | "serraBase" | "costeira" // viagem da serra (world/montanha.ts)

export interface Trecho { a: number; b: number; tipo: TipoTrecho }

export const CENARIO = {
  trechoMin: 320,  // segmentos (~64 mil u: uns 9 s a 200 km/h)
  trechoMax: 720,
  transicao: 40,   // segmentos no começo de cada trecho em que os dois tipos se misturam
}

export const TRECHOS_DO_BIOMA: Record<string, TipoTrecho[]> = {
  cidade: ["shibuya", "shinjuku", "oficinas", "suburbio"],
  costa: ["orla", "suburbio", "campo"],
  serra: ["mata", "campo", "suburbio"],   // Fase 8.5
  rodovia: ["campo", "suburbio", "campo", "mata"], // campo repetido: aparece mais
}

/** Tipos de enfeite (os números são os `kind` do drawDeco; 20+ moram em render/cenario.ts). */
export const ENF = {
  arvore: 0, poste: 1, outdoor: 2, predioAlto: 6, palmeira: 7,
  casa: 20, muro: 21, ponto: 22, arvoreLarga: 23, pinheiro: 24, plantacao: 25,
  celeiro: 26, quiosque: 27, guardaSol: 28, predioMedio: 29, cerca: 30,
  guardRail: 31, rocha: 32,
  calibrador: 33, lavaRapido: 34, placaSaida: 35, // posto (Fase 8.2, polimento)
  letreiroVertical: 5, // render/backdrop.ts (drawDeco); seed é o índice da cor TOKYO
  telaLED: 36, izakaya: 37, maquinaBebida: 38, konbini: 39, fiacao: 40,
  pneus: 41, galpao: 42, multidao: 43, vapor: 44, fachadaShibuya: 45, fachadaShinjuku: 46,
  lojinha: 47, predioJP: 48, estacionamento: 49, pedestres: 50,
  capela: 51, barraca: 52, marcoKm: 53, // serra (doc MONTANHA-COSTA-PRAIA: capelinha, barraquinha, marco de km)
} as const

/** Guard-rail contínuo dos trechos de mata: distância da borda (meias-pistas). */
export const GUARD_RAIL = { dist: 1.16 }

/** Trechos de cidade de verdade: o chão ao lado da pista é concreto e calçada, não grama (17/11: "tem prédios e o chão é grama"). */
export const TRECHO_URBANO = new Set<TipoTrecho>(["shibuya", "shinjuku", "oficinas", "centro", "entrada"])

/** Tipos de trecho com guard-rail contínuo; os de paredão só têm do lado do barranco. */
export const COM_GUARD_RAIL = new Set<TipoTrecho>(["mata", "serraPe", "serraMeio", "serraDescida", "serraBase"])
export const COM_PAREDAO = new Set<TipoTrecho>(["serraMeio", "serraDescida"])

/** Poste com fiação: fica sempre à esquerda nesta distância e escala; o desenho acha o par da direita por elas. */
export const FIACAO = { dist: 1.22, escala: 0.05 }

// letreiro vertical de Shinjuku: índices da paleta TOKYO de drawDeco (3 magenta, 4 ciano, 0 vermelho)
const COR_SHINJUKU = [4, 3, 4, 0]

export interface Enfeite {
  kind: number
  lado: -1 | 1
  dist: number    // meias-pistas do centro da pista
  escala: number  // largura do sprite em fração da meia-pista
  seed: number    // variação do desenho (cor, altura)
}

interface Lote { kind: number; dist: number; escala: number }
// pesos de cada distrito: [lote, peso]. `null` é vão (terreno vazio, recuo).
const LOTES: Record<string, [Lote | null, number][]> = {
  shibuya: [
    [{ kind: ENF.telaLED, dist: 2.0, escala: 0.7 }, 1], [{ kind: ENF.fachadaShibuya, dist: 1.75, escala: 0.55 }, 1.3],
    [{ kind: ENF.predioJP, dist: 1.85, escala: 0.6 }, 2.8], [{ kind: ENF.lojinha, dist: 1.55, escala: 0.42 }, 2],
    [{ kind: ENF.predioAlto, dist: 2.3, escala: 0.16 }, 0.8], [{ kind: ENF.estacionamento, dist: 1.7, escala: 0.6 }, 0.9], [null, 1.1],
  ],
  shinjuku: [
    [{ kind: ENF.fachadaShinjuku, dist: 1.75, escala: 0.55 }, 1.8], [{ kind: ENF.predioJP, dist: 1.85, escala: 0.6 }, 2.6],
    [{ kind: ENF.lojinha, dist: 1.55, escala: 0.42 }, 1.4], [{ kind: ENF.izakaya, dist: 1.45, escala: 0.42 }, 1.2],
    [{ kind: ENF.predioAlto, dist: 2.3, escala: 0.16 }, 1], [{ kind: ENF.estacionamento, dist: 1.7, escala: 0.6 }, 0.8], [null, 0.9],
  ],
  oficinas: [
    [{ kind: ENF.galpao, dist: 1.95, escala: 0.8 }, 2.4], [{ kind: ENF.lojinha, dist: 1.55, escala: 0.42 }, 1.4],
    [{ kind: ENF.predioJP, dist: 2.0, escala: 0.6 }, 1.2], [{ kind: ENF.konbini, dist: 1.75, escala: 0.65 }, 0.5],
    [{ kind: ENF.estacionamento, dist: 1.7, escala: 0.6 }, 1], [null, 1],
  ],
}

function loteDoDistrito(tipo: string, u: number): Lote | null {
  const lista = LOTES[tipo]
  let total = 0
  for (const [, p] of lista) total += p
  let r = u * total
  for (const [l, p] of lista) { if ((r -= p) < 0) return l }
  return null
}

/** Hash inteiro → [0, 1). Estável: o mesmo (n, k) dá sempre o mesmo número. */
export function hash01(n: number, k = 0): number {
  let x = (Math.imul(n | 0, 374761393) + Math.imul(k | 0, 668265263)) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

/** Chegada na cidade: [tipo, segmentos] antes dos distritos. */
export const CHEGADA_CIDADE: [TipoTrecho, number][] = [["mata", 360], ["entrada", 420]]

/** Divide a pista de `N` segmentos em trechos do bioma, sem dois iguais seguidos. */
export function gerarTrechos(N: number, seed: number, biomaId: string): Trecho[] {
  const tipos = TRECHOS_DO_BIOMA[biomaId] ?? TRECHOS_DO_BIOMA.cidade
  const out: Trecho[] = []
  let i = 0, k = 0, ultimo = -1
  // cidade (playtest 16/11: "o começo só tem casinha escrito TUNE"): chega pelo
  // mato, passa pela entrada com outdoors e só então entra em Shibuya
  if (biomaId === "cidade") {
    for (const [tipo, len] of CHEGADA_CIDADE) { if (i >= N) break; out.push({ a: i, b: Math.min(N, i + len), tipo }); i += len }
    ultimo = -1
    const s = tipos.indexOf("shibuya")
    if (i < N && s >= 0) { const len = CENARIO.trechoMax; out.push({ a: i, b: Math.min(N, i + len), tipo: "shibuya" }); i += len; ultimo = s }
  }
  while (i < N) {
    const len = CENARIO.trechoMin + Math.floor(hash01(seed, k) * (CENARIO.trechoMax - CENARIO.trechoMin))
    let t = Math.floor(hash01(seed, k + 997) * tipos.length)
    // nunca o mesmo TIPO seguido (a lista pode repetir um tipo para pesar mais)
    for (let tent = 0; tent < tipos.length && ultimo >= 0 && tipos[t] === tipos[ultimo]; tent++) t = (t + 1) % tipos.length
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
  } else if (tipo === "shibuya" || tipo === "shinjuku" || tipo === "oficinas") {
    // QUARTEIRÃO VARIADO (playtest 16/11: "tudo do mesmo tamanho, cheio de
    // prédio, sem personalidade" e, depois, "ainda meio poluída"): um lote a
    // cada 4 segmentos de cada lado, os dois lados desencontrados, sorteado pelo
    // peso do distrito. Largura de 0,7× a 1,4×; um em quatro bem recuado (fica
    // atrás, dá respiro). Nem todo prédio tem neon; tem lojinha, estacionamento e vão.
    for (const l of [-1, 1] as const) {
      if ((idx + (l < 0 ? 0 : 2)) % 4 !== 0) continue
      const u = (k: number) => hash01(idx * 2 + (l < 0 ? 0 : 1), k)
      const lote = loteDoDistrito(tipo, u(1))
      if (!lote) continue
      const recuo = u(2) < 0.25 ? 0.4 + u(3) * 0.5 : u(3) * 0.25
      out.push({ kind: lote.kind, lado: l, dist: lote.dist + recuo, escala: lote.escala * (0.7 + u(4) * 0.7), seed: Math.floor(u(5) * 1e6) })
    }
    if (tipo !== "oficinas" && idx % 6 === 4) add(ENF.pedestres, lado(8), 1.24, 0.3)
    if (tipo === "shibuya" && idx % 23 === 11) add(ENF.multidao, lado(12), 1.3, 0.34)
    if (tipo === "shinjuku" && idx % 4 === 1 && h(9) < 0.4) out.push({ kind: ENF.letreiroVertical, lado: lado(10), dist: 1.38, escala: 0.2, seed: COR_SHINJUKU[Math.floor(h(11) * 4)] + 6 * idx })
    if (tipo === "shinjuku" && idx % 29 === 14) add(ENF.vapor, lado(13), 1.08, 0.3)
    if (tipo === "oficinas" && idx % 8 === 4) add(ENF.pneus, lado(14), 1.32, 0.16)
    if (idx % 37 === 20) add(ENF.maquinaBebida, lado(15), 1.32, 0.16)
    if (idx % 22 === 13) add(ENF.fiacao, -1, FIACAO.dist, FIACAO.escala)
  } else if (tipo === "entrada") {
    // entrada da cidade: outdoors dos dois lados, postes, casas espaçadas e árvores
    if (idx % 14 === 7) add(ENF.outdoor, idx % 28 === 7 ? -1 : 1, 1.7 + h(1) * 0.3, 0.55)
    if (idx % 10 === 5) add(ENF.poste, -1, 1.28, 0.05)
    if (idx % 9 === 2 && h(2) < 0.5) add(ENF.casa, lado(3), 1.9 + h(4) * 0.6, 0.5)
    if (idx % 4 === 1) add(h(5) < 0.5 ? arvore : ENF.arvoreLarga, lado(6), 1.6 + h(7) * 0.8, 0.24)
    if (idx % 41 === 30) add(ENF.lojinha, lado(8), 1.6, 0.42)
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
  } else if (tipo === "costeira") {
    // rodovia beira-mar: o mar de um lado (fundo), palmeiras, quiosques e postes
    if (idx % 5 === 0) add(ENF.palmeira, -1, 1.5 + h(1) * 0.4, 0.22)
    if (idx % 40 === 20) add(ENF.quiosque, -1, 1.7, 0.45)
    if (idx % 10 === 5) add(ENF.poste, 1, 1.28, 0.05)
    if (idx % 3 === 1) add(h(2) < 0.6 ? ENF.pinheiro : arvore, 1, 1.7 + h(3) * 1.2, 0.22)
  } else if (tipo === "portal" || tipo === "serraPe" || tipo === "serraMeio" || tipo === "serraDescida" || tipo === "serraBase") {
    // montanha (world/montanha.ts): mata fechada; o paredão de pedra e o
    // guard-rail são contínuos e saem do render da pista
    if (idx % 2 === 1) add(h(1) < 0.7 ? ENF.pinheiro : arvore, lado(2), 1.6 + h(3) * 1.2, 0.22 + h(4) * 0.08)
    if (idx % 3 === 0 && h(5) < 0.55) add(ENF.pinheiro, lado(6), 2.3 + h(7) * 1.2, 0.24)
    if (idx % 31 === 9) add(ENF.rocha, lado(8), 1.45, 0.3)
    // o que dá vida à estrada da serra (o lado do vale some no render: lá não tem chão)
    if (idx % 250 === 0) add(ENF.marcoKm, lado(9), 1.12, 0.07)
    if ((tipo === "portal" || tipo === "serraPe") && idx % 90 === 40) add(ENF.barraca, lado(10), 1.32, 0.42)
    if ((tipo === "serraPe" || tipo === "serraMeio") && idx % 700 === 350) add(ENF.capela, lado(11), 1.15, 0.38)
  } else if (tipo === "mirante") {
    // mirante: a mata abre; barraquinha e quiosque, poucas árvores, o mar no
    // fundo. Playtest 16/11 ("mais completa"): estacionamento com carros de quem
    // parou e gente na beira olhando a vista
    if (idx % 9 === 4 && h(1) < 0.5) add(ENF.pinheiro, lado(2), 2.2 + h(3), 0.22)
    if (idx % 70 === 30) add(ENF.quiosque, lado(4), 1.6, 0.45)
    if (idx % 45 === 10) add(ENF.guardaSol, lado(5), 1.9, 0.2)
    if (idx % 35 === 20) add(ENF.estacionamento, lado(9), 1.75, 0.6)
    if (idx % 8 === 2) add(ENF.pedestres, lado(10), 1.3, 0.3)
  } else if (tipo === "mata") {
    // mata de serra: pinheiros fechados e pedras. O guard-rail é contínuo e
    // desenhado pelo render da pista (GUARD_RAIL, render/cenario.ts drawGuardRail)
    if (idx % 2 === 1) add(h(1) < 0.75 ? ENF.pinheiro : arvore, lado(2), 1.5 + h(3) * 1.4, 0.22 + h(4) * 0.08)
    if (idx % 3 === 0 && h(5) < 0.5) add(ENF.pinheiro, lado(6), 2.2 + h(7) * 1.2, 0.24)
    if (idx % 37 === 9) add(ENF.rocha, lado(8), 1.45, 0.3)
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
