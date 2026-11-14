// AutoDash — cosmetic/bodykit.ts. Customização estética da Fase 7 como DADOS:
// kit de carroceria, aro, altura, fumaça do escape e chama do nitro.
//
// Regra da fase: estética não muda a física. Nada aqui é lido por sim/,
// physics/ ou pela colisão; só pelo desenho (render/bodykit.ts) e pelas
// partículas (fx/particles.ts). O índice 0 de cada tabela é o desenho de antes,
// então uma configuração salva por versão antiga (sem os campos) fica igual.
import type { CarCustom } from "../data"

export interface KitDef { nome: string; saias: boolean; difusor: boolean; widebody: boolean }
export const KITS: KitDef[] = [
  { nome: "sem kit", saias: false, difusor: false, widebody: false },
  { nome: "saias laterais", saias: true, difusor: false, widebody: false },
  { nome: "saias + difusor", saias: true, difusor: true, widebody: false },
  { nome: "widebody", saias: true, difusor: true, widebody: true },
]

// Aro visto de trás: o que aparece é a borda externa da roda (a "aba"), e na
// garagem o ícone de frente mostra os raios.
export interface AroDef {
  nome: string
  aba: number   // largura da borda polida, fração da largura do carro
  raios: number // raios no ícone da garagem (0 = disco fechado)
  pinca: boolean // pinça de freio vermelha aparecendo por dentro
}
export const AROS: AroDef[] = [
  { nome: "padrão", aba: 0.024, raios: 5, pinca: false },
  { nome: "aro fundo", aba: 0.04, raios: 8, pinca: false },
  { nome: "corrida", aba: 0.028, raios: 10, pinca: true },
  { nome: "turbofan", aba: 0.034, raios: 0, pinca: false },
]

export interface AlturaDef {
  nome: string
  desce: number    // quanto a carroceria desce, fração da altura do sprite
  cambagem: number // inclinação das rodas (rad), topo para dentro
}
export const ALTURAS: AlturaDef[] = [
  { nome: "original", desce: 0, cambagem: 0 },
  { nome: "rebaixado", desce: 0.05, cambagem: 0 },
  { nome: "stance", desce: 0.09, cambagem: 0.12 },
]

// Fumaça do escape: `null` = a cor de antes (cinza na arrancada e na rodagem).
export const FUMACAS: { nome: string; cor: string | null }[] = [
  { nome: "padrão", cor: null },
  { nome: "branca", cor: "#e5e7eb" },
  { nome: "preta", cor: "#27272a" },
  { nome: "azul", cor: "#60a5fa" },
  { nome: "rosa", cor: "#f472b6" },
  { nome: "verde", cor: "#4ade80" },
]

// Chama do nitro: [corpo, miolo]. A primeira é a de antes.
export const CHAMAS: { nome: string; cores: [string, string] }[] = [
  { nome: "laranja", cores: ["#fb923c", "#fde047"] },
  { nome: "azul", cores: ["#3b82f6", "#a5f3fc"] },
  { nome: "roxa", cores: ["#a855f7", "#f0abfc"] },
  { nome: "verde", cores: ["#22c55e", "#d9f99d"] },
]

/** Índice seguro numa tabela (campo ausente, fora da faixa ou NaN vira 0). */
export function idx(v: number | undefined, n: number): number {
  return v !== undefined && Number.isInteger(v) && v >= 0 && v < n ? v : 0
}

export function proximo(v: number | undefined, n: number): number {
  return (idx(v, n) + 1) % n
}

export const kitDe = (c: CarCustom): KitDef => KITS[idx(c.kit, KITS.length)]
export const aroDe = (c: CarCustom): AroDef => AROS[idx(c.aro, AROS.length)]
export const alturaDe = (c: CarCustom): AlturaDef => ALTURAS[idx(c.altura, ALTURAS.length)]

/** Cor da fumaça do escape: a escolhida ou, no padrão, a cor de antes (`base`). */
export function corFumaca(c: CarCustom | undefined, base: string): string {
  return (c && FUMACAS[idx(c.fumaca, FUMACAS.length)].cor) || base
}

export function coresChama(c: CarCustom | undefined): [string, string] {
  return CHAMAS[c ? idx(c.chama, CHAMAS.length) : 0].cores
}
