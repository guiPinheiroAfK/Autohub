// AutoDash — domínio do tráfego (tipos + constantes).
// Separado do engine pra que as IAs (ver ./driver.ts) e o render compartilhem
// o mesmo vocabulário sem depender da classe gigante do motor.

export type TrafficKind = "car" | "moto" | "truck" | "bus" | "police"

// Papel do veículo: define QUAL IA dirige ele (ver DRIVERS em ./driver.ts).
//  - civilian: trânsito comum, respeita os outros e o jogador
//  - police:   perseguição — agressivo de propósito
//  - oncoming: contramão — vem no sentido oposto, reto na faixa (speed negativa)
export type TrafficRole = "civilian" | "police" | "oncoming"

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
  backoffT?: number    // >0: viatura acabou de dar encostão, alivia e abre distância
  wasAhead?: boolean   // viatura já esteve à frente do jogador (pra detectar a ultrapassagem)
  beaten?: boolean     // jogador a ultrapassou: desiste da caçada e recua até o despiste
  engaged?: boolean    // já colou no jogador uma vez: daqui em diante é física pura (sem mola)
  parked?: boolean     // estacionado (blitz): sem IA, sem reciclagem, colisão normal
  label?: string       // nome exibido em cima do carro (rivais do modo corrida)
  accent?: string      // cor de destaque do rival (teto/faixa), pra distinguir na pista
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
