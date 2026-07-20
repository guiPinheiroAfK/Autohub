// AutoDash — domínio do tráfego (tipos + constantes).
// Separado do engine pra que as IAs (ver ./driver.ts) e o render compartilhem
// o mesmo vocabulário sem depender da classe gigante do motor.

export type TrafficKind = "car" | "moto" | "truck" | "bus" | "police"

// Papel do veículo: define QUAL IA dirige ele (ver DRIVERS em ./driver.ts).
//  - civilian: trânsito comum, respeita os outros e o jogador
//  - police:   perseguição — agressivo de propósito (feature futura)
export type TrafficRole = "civilian" | "police"

// w = meia-largura na fração da pista (-1..1) · len = comprimento em unidades Z
// h = altura visual (sprite) · spd = faixa de velocidade de cruzeiro [min, max] km/h
export const KINDS: Record<TrafficKind, { w: number; len: number; h: number; spd: [number, number] }> = {
  car:    { w: 0.28, len: 260, h: 0.80, spd: [85, 125] },
  moto:   { w: 0.12, len: 190, h: 1.25, spd: [115, 150] },
  truck:  { w: 0.34, len: 540, h: 1.55, spd: [66, 88] },
  bus:    { w: 0.33, len: 470, h: 1.45, spd: [76, 95] },
  police: { w: 0.22, len: 230, h: 0.82, spd: [200, 240] }, // menor e ágil (só via spawnPoliceChase)
}

export const TRAFFIC_COLORS = ["#64748b", "#0ea5e9", "#84cc16", "#ec4899", "#eab308", "#e2e8f0", "#7c3aed", "#b45309"]

export interface Traffic {
  z: number
  offset: number       // faixa atual (-1..1, fração da meia-pista)
  targetOffset: number // faixa desejada; a IA interpola offset -> targetOffset
  speed: number        // velocidade de cruzeiro (km/h)
  kind: TrafficKind
  role: TrafficRole
  color: string
  blinkT: number       // >0: seta ligada antes/durante a troca de faixa
  prevD: number        // distância Z ao jogador no frame anterior (near-miss)
  dead?: boolean       // marcado pra remoção (ex.: destruído pelo escudo)
  yieldT?: number      // >0: levou farol alto, tenta abrir caminho
}

// Visão read-only do mundo que uma IA precisa pra decidir. O engine constrói
// isso a cada frame e passa pro driver — a IA nunca toca no motor direto.
export interface WorldView {
  traffic: Traffic[]
  playerX: number      // faixa do jogador (-1..1)
  playerZ: number
  playerSpeed: number  // km/h — a polícia usa pra "grudar" (pace) no jogador
  trackLen: number
  demo: boolean        // tela de atração (menu): ignora o jogador
  // menor distância com sinal entre dois pontos Z (trata o loop da pista)
  wrapDz(a: number, b: number): number
}
