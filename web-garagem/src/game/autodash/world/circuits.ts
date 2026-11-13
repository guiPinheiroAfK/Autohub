// AutoDash — world/circuits.ts. Circuitos FIXOS da corrida, como dados (ADR 0014).
//
// Um circuito é uma lista de trechos escritos à mão (reta, curva, esse, grampo)
// mais os ramais (atalhos). `montarCircuito` vira isso em segmentos sem nenhum
// sorteio: a mesma definição gera sempre a mesma pista, em qualquer cliente.
// Para criar um circuito novo: adicionar um registro em CIRCUITS. O teste
// unitário confere se ele fecha o loop e se os ramais cabem.

import { type AutoDashEngine, type Seg } from "../engine"
import { SEG_LEN } from "../data"
import { biomeById } from "./biomes"
import { type Ramal, RAMAL_MIN } from "./ramais"
import { sinalizarCurvas, conesDeCurva } from "./track"

// [entrada, miolo, saída, curvatura, desnível] — mesma forma do addRoad de track.ts
type Parte = [number, number, number, number, number]

export interface TrechoDef {
  nome?: string      // aparece no reconhecimento de percurso
  marca?: string     // âncora para ramais
  partes: Parte[]
}

export interface RamalDef {
  id: string
  nome: string
  em: string         // marca do trecho que o ramal contorna
  antes: number      // segmentos antes do início do trecho
  depois: number     // segmentos depois do fim do trecho
  lado: 1 | -1
  afast: number
  larg: number
  ganho: number
}

export interface CircuitDef {
  id: string
  nome: string
  bioma: string
  descricao: string
  trechos: TrechoDef[]
  ramais: RamalDef[]
}

interface Extra { nome?: string; marca?: string; dy?: number; ent?: number; sai?: number }

// ── construtores de trecho (só açúcar para escrever o traçado) ──────────────
const reta = (len: number, o: Extra = {}): TrechoDef =>
  ({ nome: o.nome, marca: o.marca, partes: [[0, len, 0, 0, o.dy ?? 0]] })
/** Curva simples. `c` > 0 vira à direita. Acima de ~5 pede freio. */
const curva = (c: number, mio: number, o: Extra = {}): TrechoDef =>
  ({ nome: o.nome, marca: o.marca, partes: [[o.ent ?? 30, mio, o.sai ?? 30, c, o.dy ?? 0]] })
/** Esse: curva e contracurva de mesmo raio. */
const esse = (c: number, mio: number, o: Extra = {}): TrechoDef => ({
  nome: o.nome, marca: o.marca,
  partes: [[24, mio, 24, c, (o.dy ?? 0) / 2], [24, mio, 24, -c, (o.dy ?? 0) / 2]],
})
/** Grampo: curva fechada com entrada longa (dá tempo de ler e frear). */
const grampo = (c: number, mio: number, o: Extra = {}): TrechoDef =>
  ({ nome: o.nome, marca: o.marca, partes: [[o.ent ?? 44, mio, o.sai ?? 36, c, o.dy ?? 0]] })

export const CIRCUITS: CircuitDef[] = [
  {
    id: "anel-shibuya",
    nome: "Anel de Shibuya",
    bioma: "cidade",
    descricao: "Rápido e fluido. Um curvão longo com atalho por dentro.",
    trechos: [
      reta(140, { nome: "Reta dos Boxes" }),
      curva(3.2, 70, { nome: "Curva 1" }),
      reta(170, { dy: 600 }),
      esse(4.2, 40, { nome: "S do Cruzamento", dy: -300 }),
      reta(230, { nome: "Avenida", dy: -500 }),
      grampo(-5.4, 56, { nome: "Cotovelo" }),
      reta(200, { dy: 400 }),
      curva(3.4, 150, { nome: "Curvão", marca: "curvao", dy: 700 }),
      reta(210, { dy: -900 }),
      esse(-5.2, 28, { nome: "Chicane" }),
      reta(260, { nome: "Reta Oposta", dy: 300 }),
      curva(-3.0, 120, { nome: "Curva do Parque", dy: 500 }),
      reta(180, { dy: -800 }),
      esse(3.8, 36, { nome: "S do Mercado" }),
      reta(190),
      curva(4.4, 80, { nome: "Última Curva" }),
      reta(120),
    ],
    ramais: [
      { id: "dentro-curvao", nome: "Atalho do Curvão", em: "curvao", antes: 170, depois: 170, lado: 1, afast: 0.5, larg: 0.62, ganho: 1.2 },
    ],
  },
  {
    id: "serra-do-pier",
    nome: "Serra do Píer",
    bioma: "costa",
    descricao: "Técnico e cheio de morro. Dois grampos e uma variante larga.",
    trechos: [
      reta(140, { nome: "Reta do Píer" }),
      curva(-3.8, 60, { nome: "Subida", dy: 1400 }),
      reta(110, { dy: 900 }),
      grampo(6.6, 46, { nome: "Grampo do Mirante", dy: 300 }),
      reta(200, { dy: -700 }),
      esse(4.8, 34, { nome: "Esses da Encosta", marca: "esses", dy: -900 }),
      esse(-4.4, 30, { dy: -500 }),
      reta(220, { dy: -400 }),
      curva(-4.6, 90, { nome: "Curva do Farol", dy: 200 }),
      reta(180, { dy: 500 }),
      grampo(-6.9, 42, { nome: "Grampo da Praia", marca: "praia", dy: -300 }),
      reta(200, { dy: -300 }),
      curva(4.2, 100, { nome: "Curva da Baía", dy: 600 }),
      reta(170, { dy: -600 }),
      esse(-5.0, 30, { nome: "Esses do Coqueiral" }),
      reta(160),
      curva(-3.2, 80, { nome: "Enseada", dy: 300 }),
      reta(210, { dy: -300 }),
      curva(3.6, 70, { nome: "Volta ao Píer" }),
      reta(130),
    ],
    ramais: [
      { id: "variante-encosta", nome: "Variante da Encosta", em: "esses", antes: 170, depois: 60, lado: -1, afast: 0.45, larg: 0.95, ganho: 1.08 },
      { id: "corte-praia", nome: "Corte da Praia", em: "praia", antes: 175, depois: 175, lado: -1, afast: 0.55, larg: 0.56, ganho: 1.25 },
    ],
  },
  {
    id: "marginal-neon",
    nome: "Marginal Neon",
    bioma: "cidade",
    descricao: "Retões de sexta marcha e freadas fortes. Atalho estreito na chicane.",
    trechos: [
      reta(160, { nome: "Reta Principal" }),
      curva(2.8, 60, { nome: "Curva da Ponte", dy: 500 }),
      reta(300, { nome: "Retão Norte", dy: -500 }),
      esse(5.8, 24, { nome: "Chicane Norte", marca: "chicane" }),
      reta(260, { dy: 300 }),
      grampo(6.2, 50, { nome: "Retorno", dy: 200 }),
      reta(320, { nome: "Retão Sul", dy: -500 }),
      curva(-4.0, 100, { nome: "Curva do Viaduto", dy: 400 }),
      reta(150, { dy: -400 }),
      esse(-4.6, 36, { nome: "S da Marginal" }),
      reta(280, { nome: "Retão Leste" }),
      curva(3.4, 110, { nome: "Curva do Estádio", dy: 300 }),
      reta(200, { dy: -300 }),
      grampo(-6.4, 44, { nome: "Grampo do Porto" }),
      reta(200),
      curva(5.0, 60, { nome: "Última Freada" }),
      reta(130),
    ],
    ramais: [
      { id: "fura-chicane", nome: "Fura-Chicane", em: "chicane", antes: 180, depois: 180, lado: 1, afast: 0.6, larg: 0.54, ganho: 1.22 },
    ],
  },
]

export function circuitById(id: string | null | undefined): CircuitDef | null {
  return CIRCUITS.find(c => c.id === id) ?? null
}

export interface TrechoInfo { ini: number; fim: number; nome: string }

export interface CircuitoMontado {
  segments: Seg[]
  ramais: Ramal[]
  trechos: TrechoInfo[]   // só os que têm nome
}

/** Monta os segmentos, os ramais e os nomes dos trechos. Função pura, sem sorteio. */
export function montarCircuito(def: CircuitDef): CircuitoMontado {
  const segments: Seg[] = []
  let lastY = 0
  const seg = (curve: number, y: number) => { segments.push({ curve, y1: lastY, y2: y }); lastY = y }
  const easeIO = (a: number, b: number, p: number) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5)
  const addRoad = ([enter, hold, leave, curve, dy]: Parte) => {
    const y0 = lastY, total = enter + hold + leave
    let i = 0
    for (let n = 0; n < enter; n++, i++) seg(curve * (n / enter), easeIO(y0, y0 + dy, i / total))
    for (let n = 0; n < hold; n++, i++) seg(curve, easeIO(y0, y0 + dy, i / total))
    for (let n = 0; n < leave; n++, i++) seg(curve * (1 - n / leave), easeIO(y0, y0 + dy, i / total))
  }

  const trechos: TrechoInfo[] = []
  const marcas = new Map<string, { ini: number; fim: number }>()
  for (const t of def.trechos) {
    const ini = segments.length
    for (const p of t.partes) addRoad(p)
    const fim = segments.length - 1
    if (t.nome) trechos.push({ ini, fim, nome: t.nome })
    if (t.marca) marcas.set(t.marca, { ini, fim })
  }
  // fecha o loop plano: a última reta devolve a altura a zero
  addRoad([40, 40, 40, 0, -lastY])

  const ramais: Ramal[] = []
  for (const r of def.ramais) {
    const m = marcas.get(r.em)
    if (!m) throw new Error(`circuito ${def.id}: ramal ${r.id} aponta para a marca inexistente "${r.em}"`)
    ramais.push({
      id: r.id, nome: r.nome, a: m.ini - r.antes, b: m.fim + r.depois,
      lado: r.lado, afast: r.afast, larg: r.larg, ganho: r.ganho,
    })
  }
  return { segments, ramais, trechos }
}

/** Erros de autoria de um circuito (lista vazia = válido). Usado no teste unitário. */
export function validarCircuito(def: CircuitDef): string[] {
  const erros: string[] = []
  const m = montarCircuito(def)
  const n = m.segments.length
  if (n < 1800 || n > 4200) erros.push(`tamanho fora da faixa: ${n} segmentos`)
  // a suavização da última reta para a uma fração de unidade do zero (igual à pista
  // procedural); o que não pode é sobrar um degrau visível na linha de chegada
  if (Math.abs(m.segments[n - 1].y2) > 2) erros.push("o loop não fecha na altura zero")
  if (!biomeById(def.bioma) || biomeById(def.bioma).id !== def.bioma) erros.push(`bioma desconhecido: ${def.bioma}`)
  const ordenados = [...m.ramais].sort((x, y) => x.a - y.a)
  for (let i = 0; i < ordenados.length; i++) {
    const r = ordenados[i]
    if (r.a < 60) erros.push(`ramal ${r.id} começa em cima da largada`)
    if (r.b > n - 60) erros.push(`ramal ${r.id} termina em cima da chegada`)
    if (r.b - r.a < RAMAL_MIN) erros.push(`ramal ${r.id} curto demais: ${r.b - r.a} < ${RAMAL_MIN}`)
    if (i > 0 && r.a <= ordenados[i - 1].b) erros.push(`ramal ${r.id} sobrepõe ${ordenados[i - 1].id}`)
  }
  return erros
}

/** Aplica o circuito ao engine: segmentos, bioma, ramais, placas e cones. */
export function buildCircuit(eng: AutoDashEngine, def: CircuitDef) {
  const m = montarCircuito(def)
  eng.bioma = biomeById(def.bioma)
  eng.segments = m.segments
  eng.trackLen = m.segments.length * SEG_LEN
  eng.ramais = m.ramais
  eng.trechos = m.trechos
  eng.pistaId = def.id
  sinalizarCurvas(eng, true)
  conesDeCurva(eng)
  // cones FIXOS no bico de cada ramal (onde ele descola e onde volta a colar):
  // marcam a divisão e punem quem decide tarde. Ficam a corrida inteira.
  for (const o of eng.obstacles) o.fixo = true
  for (const r of m.ramais) {
    for (const base of [r.a + 124, r.b - 124]) {
      for (let k = 0; k < 3; k++) {
        const idx = base + (base === r.a + 124 ? k * 5 : -k * 5)
        eng.obstacles.push({
          z: idx * SEG_LEN, offset: r.lado * (1.04 + 0.05 * k),
          kind: "cone", w: 0.10, len: 90, fixo: true,
        })
      }
    }
  }
}
