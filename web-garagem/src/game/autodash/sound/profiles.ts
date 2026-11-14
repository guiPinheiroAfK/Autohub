// AutoDash — sound/profiles.ts. Perfis de som de motor como DADOS.
// O caráter de um motor vem de três coisas, nesta ordem:
//   1. ordem/ângulo de ignição (quando cada pulso de escape nasce, em graus do
//      ciclo de 720°) — define a frequência de disparo e os sub-harmônicos;
//   2. caminho do escape (coletor igual/desigual, uma ou duas bancadas) — vira
//      atraso e ganho por pulso: é o "rumble" do boxer e o "burble" do V8 cruzado;
//   3. filtros (corpo, coletor, abafador) e indução (turbo, compressor).
// Frequência de disparo = rpm/60 × nº de eventos por ciclo / 2.

export type Inducao = "aspirado" | "turbo" | "biturbo" | "roots" | "centrifugo"

export interface EventoIgnicao {
  ang: number      // grau do ciclo de 720° em que o pulso nasce
  atrasoMs: number // caminho extra do escape até a ponteira
  ganho: number    // 1 = pulso médio; coletores e bancadas diferentes variam
}

export interface EngineSoundProfile {
  id: string
  nome: string        // ex.: "V8 virabrequim cruzado"
  eventos: EventoIgnicao[]
  pulsoMs: number     // corpo do pulso (decaimento); motor grande = pulso mais gordo
  aspereza: number    // 0..1 de ruído dentro do pulso (rotativo e escape direto rasgam)
  jitter: number      // variação aleatória de amplitude por pulso (0,04 = 4%)
  boomHz: number      // ressonância de corpo (graves)
  boomDb: number
  coletorHz: number   // ressonância do coletor/abafador (médios)
  coletorDb: number
  lpBase: number      // filtro do abafador: base + rpm × lpPorRpm + gás × lpGas, até lpTeto
  lpPorRpm: number
  lpGas: number
  lpTeto: number
  admissao: number    // ruído de admissão no alto giro (0 = nada)
  inducao: Inducao
  pops: number        // 0..1: tendência a estourar ao tirar o pé
}

// Ângulos uniformes: n eventos espaçados igualmente em 720°.
function uniforme(n: number, atraso: (i: number) => number = () => 0, ganho: (i: number) => number = () => 1): EventoIgnicao[] {
  return Array.from({ length: n }, (_, i) => ({ ang: (720 / n) * i, atrasoMs: atraso(i), ganho: ganho(i) }))
}

// V8 virabrequim cruzado, ordem 1-8-4-3-6-5-7-2 (GM). Ímpares na bancada
// esquerda, pares na direita: E D D E D E E D. Cada bancada dispara em
// intervalos desiguais (90/180/270°) — com escapes separados isso vira o burble.
const V8_CRUZADO_BANCADA = [0, 1, 1, 0, 1, 0, 0, 1]

export const ENGINE_PROFILES: Record<string, EngineSoundProfile> = {
  i3: {
    id: "i3", nome: "3 cilindros em linha", eventos: uniforme(3, () => 0, i => [1, 0.9, 0.95][i]),
    pulsoMs: 2.6, aspereza: 0.12, jitter: 0.05, boomHz: 85, boomDb: 5, coletorHz: 420, coletorDb: 3,
    lpBase: 900, lpPorRpm: 0.2, lpGas: 1100, lpTeto: 3200, admissao: 0.4, inducao: "turbo", pops: 0.4,
  },
  i4: {
    id: "i4", nome: "4 cilindros em linha", eventos: uniforme(4, () => 0, i => [1, 0.84, 1.1, 0.93][i]),
    pulsoMs: 2.4, aspereza: 0.1, jitter: 0.08, boomHz: 95, boomDb: 5, coletorHz: 380, coletorDb: 3,
    lpBase: 950, lpPorRpm: 0.21, lpGas: 1200, lpTeto: 3400, admissao: 0.7, inducao: "aspirado", pops: 0.5,
  },
  "i4-turbo": {
    id: "i4-turbo", nome: "4 em linha turbo", eventos: uniforme(4, () => 0, i => [1, 0.86, 1.08, 0.94][i]),
    pulsoMs: 2.5, aspereza: 0.08, jitter: 0.07, boomHz: 95, boomDb: 7, coletorHz: 360, coletorDb: 3,
    lpBase: 900, lpPorRpm: 0.14, lpGas: 750, lpTeto: 2400, admissao: 0.25, inducao: "turbo", pops: 0.8,
  },
  // boxer: ignição par (180°), mas coletor desigual: os pulsos de uma bancada
  // chegam atrasados e o som "galopa" (rumble).
  boxer4: {
    id: "boxer4", nome: "boxer 4 coletor desigual", eventos: uniforme(4, i => [0, 1.6, 0, 1.6][i], i => [1, 0.8, 1.05, 0.82][i]),
    pulsoMs: 2.8, aspereza: 0.08, jitter: 0.06, boomHz: 85, boomDb: 8, coletorHz: 300, coletorDb: 4,
    lpBase: 850, lpPorRpm: 0.15, lpGas: 800, lpTeto: 2500, admissao: 0.2, inducao: "turbo", pops: 0.6,
  },
  // 5 em linha: 144° entre disparos, ordem 1-2-4-5-3. Frequência 2,5× a rotação.
  i5: {
    id: "i5", nome: "5 cilindros em linha", eventos: uniforme(5, () => 0, i => [1, 0.9, 1.06, 0.92, 1.02][i]),
    pulsoMs: 2.6, aspereza: 0.08, jitter: 0.05, boomHz: 90, boomDb: 6, coletorHz: 340, coletorDb: 4,
    lpBase: 900, lpPorRpm: 0.17, lpGas: 900, lpTeto: 2900, admissao: 0.35, inducao: "turbo", pops: 0.7,
  },
  i6: {
    id: "i6", nome: "6 em linha", eventos: uniforme(6, () => 0, i => [1, 0.95, 1.03, 0.97, 1.01, 0.96][i]),
    pulsoMs: 2.4, aspereza: 0.06, jitter: 0.04, boomHz: 100, boomDb: 5, coletorHz: 420, coletorDb: 3,
    lpBase: 1000, lpPorRpm: 0.19, lpGas: 1000, lpTeto: 3300, admissao: 0.45, inducao: "biturbo", pops: 0.5,
  },
  boxer6: {
    id: "boxer6", nome: "boxer 6 aspirado", eventos: uniforme(6, i => [0, 0.5, 0, 0.5, 0, 0.5][i], i => [1, 0.92, 1.02, 0.93, 1, 0.94][i]),
    pulsoMs: 2.3, aspereza: 0.07, jitter: 0.04, boomHz: 105, boomDb: 4, coletorHz: 520, coletorDb: 4,
    lpBase: 1100, lpPorRpm: 0.24, lpGas: 1200, lpTeto: 3800, admissao: 0.9, inducao: "aspirado", pops: 0.35,
  },
  v6: {
    id: "v6", nome: "V6 60° biturbo", eventos: uniforme(6, i => [0, 0.7, 0, 0.7, 0, 0.7][i], i => [1, 0.9, 1.04, 0.92, 1.01, 0.9][i]),
    pulsoMs: 2.6, aspereza: 0.07, jitter: 0.05, boomHz: 90, boomDb: 6, coletorHz: 360, coletorDb: 3,
    lpBase: 900, lpPorRpm: 0.15, lpGas: 800, lpTeto: 2600, admissao: 0.3, inducao: "biturbo", pops: 0.6,
  },
  "v8-cruzado": {
    id: "v8-cruzado", nome: "V8 virabrequim cruzado",
    eventos: uniforme(8, i => V8_CRUZADO_BANCADA[i] ? 0.9 : 0, i => (V8_CRUZADO_BANCADA[i] ? 0.82 : 1.08) * [1, 0.95, 1.02, 0.97, 1, 0.94, 1.03, 0.96][i]),
    pulsoMs: 3.2, aspereza: 0.05, jitter: 0.07, boomHz: 70, boomDb: 9, coletorHz: 260, coletorDb: 4,
    lpBase: 700, lpPorRpm: 0.13, lpGas: 900, lpTeto: 2300, admissao: 0.3, inducao: "roots", pops: 0.5,
  },
  "v8-plano": {
    id: "v8-plano", nome: "V8 virabrequim plano", eventos: uniforme(8, () => 0, i => [1, 0.97, 1.02, 0.98, 1, 0.97, 1.01, 0.98][i]),
    pulsoMs: 2.3, aspereza: 0.07, jitter: 0.03, boomHz: 95, boomDb: 5, coletorHz: 480, coletorDb: 4,
    lpBase: 1100, lpPorRpm: 0.24, lpGas: 1300, lpTeto: 4000, admissao: 0.7, inducao: "biturbo", pops: 0.45,
  },
  v10: {
    id: "v10", nome: "V10 aspirado", eventos: uniforme(10, i => i % 2 ? 0.35 : 0, i => i % 2 ? 0.95 : 1.02),
    pulsoMs: 2.1, aspereza: 0.06, jitter: 0.03, boomHz: 100, boomDb: 4, coletorHz: 560, coletorDb: 5,
    lpBase: 1200, lpPorRpm: 0.27, lpGas: 1400, lpTeto: 4500, admissao: 0.9, inducao: "aspirado", pops: 0.4,
  },
  v12: {
    id: "v12", nome: "V12 aspirado", eventos: uniforme(12, () => 0, i => i % 2 ? 0.97 : 1.01),
    pulsoMs: 1.9, aspereza: 0.05, jitter: 0.02, boomHz: 110, boomDb: 3, coletorHz: 620, coletorDb: 5,
    lpBase: 1300, lpPorRpm: 0.3, lpGas: 1500, lpTeto: 5000, admissao: 1, inducao: "aspirado", pops: 0.25,
  },
  w16: {
    id: "w16", nome: "W16 quadriturbo", eventos: uniforme(16, () => 0, () => 1),
    pulsoMs: 2.2, aspereza: 0.04, jitter: 0.03, boomHz: 75, boomDb: 7, coletorHz: 300, coletorDb: 3,
    lpBase: 750, lpPorRpm: 0.1, lpGas: 600, lpTeto: 2000, admissao: 0.2, inducao: "biturbo", pops: 0.2,
  },
  // rotativo 2 rotores: 2 pulsos por volta do eixo (como um 4 cilindros), mas a
  // janela periférica abre de uma vez: pulso curto e áspero, o "brap".
  rotativo: {
    id: "rotativo", nome: "rotativo 2 rotores", eventos: uniforme(4, () => 0, i => [1, 0.9, 1.04, 0.88][i]),
    pulsoMs: 1.5, aspereza: 0.45, jitter: 0.1, boomHz: 110, boomDb: 4, coletorHz: 700, coletorDb: 6,
    lpBase: 1300, lpPorRpm: 0.28, lpGas: 1500, lpTeto: 4600, admissao: 0.5, inducao: "turbo", pops: 0.9,
  },
}

// Qual motor cada carro do jogo usa (por `body`). Carros fictícios: o motor é
// escolha de som, não cópia de um carro real.
export const MOTOR_DO_CARRO: Record<string, string> = {
  gt: "v10",
  muscle: "v8-cruzado",
  ninja: "i4",
  ghost: "w16",
  zcoupe: "v6",
  rotor: "rotativo",
  apex: "i6",
  kaiju: "i6",
  sylva: "i4-turbo",
  roadster: "i4",
  alta: "i5",
  flat6: "boxer6",
}

export function perfilDoCarro(body: string): EngineSoundProfile {
  return ENGINE_PROFILES[MOTOR_DO_CARRO[body] ?? "i4"] ?? ENGINE_PROFILES.i4
}
