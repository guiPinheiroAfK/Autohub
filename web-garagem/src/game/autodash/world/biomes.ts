// AutoDash — world/biomes.ts. Biomas como DADOS (ADR 0011): nome, céu, camadas de
// fundo, árvore de beira e climas permitidos. Solo e corrida leem daqui; o render
// não tem `if (bioma === ...)`. Para criar um bioma: preencher um registro e, se
// faltar um tipo de camada, escrever a função em render/backdrop.ts.

export interface SkyKey { t: number; top: string; bot: string; amb: number }
export interface SkyState { top: string; bot: string; amb: number }

// Tipos de camada conhecidos pelo render (registro CAMADAS em render/backdrop.ts).
export type LayerKind = "ceu-sol" | "montanhas" | "skyline" | "brilho-urbano" | "mar" | "palmeiras" | "pier" | "pinheiral" | "colinas"

/**
 * Traçado do bioma (Fase 8.5): multiplica a curva e o morro de cada trecho da
 * pista procedural e o comprimento das retas. Sem `tracado` (cidade) a pista é
 * exatamente a de antes.
 */
export interface Tracado { curva: number; morro: number; reta: number }

export interface BiomeDef {
  id: string
  nome: string
  // céu do modo solo, por hora do dia (t = fração do ciclo)
  ceu: SkyKey[]
  // céu fixo da corrida (noite neon). `amb` e `ambChuva` são a luminosidade.
  ceuCorrida: SkyState & { ambChuva: number }
  // camadas do fundo, desenhadas em ordem: longe → meio → perto
  camadas: { longe: LayerKind[]; meio: LayerKind[]; perto: LayerKind[] }
  // kind da decoração de beira que faz o papel de árvore (0 = árvore padrão)
  arvore: number
  // climas que este bioma aceita (usado pelo sorteio de clima na Fase 4).
  // Repetir um clima dobra o peso dele (a serra tem neblina duas vezes).
  climas: string[]
  tracado?: Tracado
}

// paleta do ciclo de dia do solo (cidade). Movida de engine.ts para cá.
export const SKY_KEYS: SkyKey[] = [
  { t: 0.125, top: "#2b8fd6", bot: "#bfe6f7", amb: 1.0 },
  { t: 0.375, top: "#3b2a63", bot: "#fb923c", amb: 0.8 },
  { t: 0.625, top: "#050816", bot: "#16233f", amb: 0.42 },
  { t: 0.875, top: "#33507c", bot: "#fcd9a0", amb: 0.78 },
]

export const BIOMES: Record<string, BiomeDef> = {
  cidade: {
    id: "cidade",
    nome: "Cidade",
    ceu: SKY_KEYS,
    ceuCorrida: { top: "#0a0618", bot: "#2a1140", amb: 0.44, ambChuva: 0.34 },
    camadas: { longe: ["ceu-sol", "montanhas"], meio: ["skyline"], perto: ["brilho-urbano"] },
    arvore: 0,
    climas: ["limpo", "nublado", "chuva", "neblina"],
  },
  // costa: mesmo sistema de camadas. Horizonte com mar, palmeiras e um píer.
  costa: {
    id: "costa",
    nome: "Costa",
    ceu: [
      { t: 0.125, top: "#38bdf8", bot: "#cffafe", amb: 1.0 },
      { t: 0.375, top: "#7c2d12", bot: "#fb923c", amb: 0.82 },
      { t: 0.625, top: "#041c2b", bot: "#0f4c5c", amb: 0.42 },
      { t: 0.875, top: "#0e7490", bot: "#fde68a", amb: 0.8 },
    ],
    ceuCorrida: { top: "#04161c", bot: "#0e3b43", amb: 0.46, ambChuva: 0.36 },
    camadas: { longe: ["ceu-sol", "mar"], meio: ["palmeiras"], perto: ["pier"] },
    arvore: 7, // palmeira de beira (drawDeco, kind 7)
    climas: ["limpo", "nublado", "chuva", "neblina"],
    tracado: { curva: 0.8, morro: 0.5, reta: 1.2 }, // orla: curvas longas e abertas
  },
  // serra (Fase 8.5): curvas fechadas e morros, pinheiral no fundo, neblina frequente
  serra: {
    id: "serra",
    nome: "Serra",
    ceu: [
      { t: 0.125, top: "#5b8fc7", bot: "#d7e6ef", amb: 0.95 },
      { t: 0.375, top: "#4b3b62", bot: "#e7a56b", amb: 0.78 },
      { t: 0.625, top: "#060b16", bot: "#1b2a3a", amb: 0.4 },
      { t: 0.875, top: "#3c5a78", bot: "#efd3a6", amb: 0.76 },
    ],
    ceuCorrida: { top: "#070d18", bot: "#1d2c3c", amb: 0.42, ambChuva: 0.33 },
    camadas: { longe: ["ceu-sol", "montanhas"], meio: ["pinheiral"], perto: [] },
    arvore: 24, // pinheiro (render/cenario.ts)
    climas: ["limpo", "nublado", "neblina", "neblina", "chuva"],
    tracado: { curva: 1.2, morro: 1.8, reta: 0.6 }, // 1,2: as fechadas da cidade (6) viram 7,2
  },
  // rodovia (Fase 8.5): retas longas no campo, colinas, pôr do sol largo
  rodovia: {
    id: "rodovia",
    nome: "Rodovia",
    ceu: [
      { t: 0.125, top: "#3a9be0", bot: "#f3e8c8", amb: 1.0 },
      { t: 0.375, top: "#5b2b52", bot: "#ff9a4d", amb: 0.82 },
      { t: 0.625, top: "#070a18", bot: "#20203a", amb: 0.42 },
      { t: 0.875, top: "#4a5f8c", bot: "#ffd29a", amb: 0.8 },
    ],
    ceuCorrida: { top: "#0b0a1a", bot: "#2b1c36", amb: 0.44, ambChuva: 0.34 },
    camadas: { longe: ["ceu-sol"], meio: ["colinas"], perto: [] },
    arvore: 23, // árvore larga (render/cenario.ts)
    climas: ["limpo", "limpo", "nublado", "chuva"],
    tracado: { curva: 0.55, morro: 0.6, reta: 1.8 },
  },
}

export const BIOME_IDS = Object.keys(BIOMES)

// Próximo bioma na ordem do registro (usado pelo seletor do menu).
export function proximoBioma(id: string): string {
  const i = BIOME_IDS.indexOf(id)
  return BIOME_IDS[(i + 1) % BIOME_IDS.length]
}

export function biomeById(id: string | undefined): BiomeDef {
  return (id && BIOMES[id]) || BIOMES.cidade
}

// Bioma da corrida sem circuito fixo (buildTrack com corrida=true). Com circuito,
// buildCircuit troca pelo bioma dele (world/circuits.ts). Não mudar sem atualizar o
// golden master (corrida usa esta seed).
export function biomeDaCorrida(): BiomeDef {
  return BIOMES.cidade
}
