// AutoDash — world/biomes.ts. Biomas como DADOS (ADR 0011): nome, céu, camadas de
// fundo, árvore de beira e climas permitidos. Solo e corrida leem daqui; o render
// não tem `if (bioma === ...)`. Para criar um bioma: preencher um registro e, se
// faltar um tipo de camada, escrever a função em render/backdrop.ts.

export interface SkyKey { t: number; top: string; bot: string; amb: number }
export interface SkyState { top: string; bot: string; amb: number }

// Tipos de camada conhecidos pelo render (registro CAMADAS em render/backdrop.ts).
export type LayerKind = "ceu-sol" | "montanhas" | "skyline" | "brilho-urbano" | "mar" | "palmeiras" | "pier"

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
  // climas que este bioma aceita (usado pelo sorteio de clima na Fase 4)
  climas: string[]
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

// Bioma da corrida. Fixo na cidade por enquanto: a escolha de bioma no lobby
// entra na Fase 3. Não mudar sem atualizar o golden master (corrida usa esta seed).
export function biomeDaCorrida(): BiomeDef {
  return BIOMES.cidade
}
