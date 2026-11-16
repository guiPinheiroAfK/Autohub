// AutoDash — domínio do tráfego (tipos + constantes).
// Separado do engine pra que as IAs (ver ./driver.ts) e o render compartilhem
// o mesmo vocabulário sem depender da classe gigante do motor.

export type TrafficKind = "car" | "moto" | "truck" | "bus" | "police" | "roadblock"

// Papel do veículo: define QUAL IA dirige ele (ver DRIVERS em ./driver.ts).
//  - civilian: trânsito comum, respeita os outros e o jogador
//  - police:   perseguição — agressivo de propósito
//  - oncoming: contramão — vem no sentido oposto, reto na faixa (speed negativa)
//  - racha:    desafiante do convite de racha (Fase 5, modes/racha.ts)
//  - comboio:  membro de um comboio com fresta (Fase 5, world/comboio.ts)
export type TrafficRole = "civilian" | "police" | "oncoming" | "racha" | "comboio"

// Estado do desafiante do racha (a IA é stateless: o estado mora no veículo).
export interface RivalRacha {
  fase: "convite" | "corrida" | "saindo"
  vMax: number             // km/h
  acel: number             // km/h por segundo
  fecha: number            // 0..1, vontade de fechar a porta (E7)
  fechaT: number           // s até poder fechar de novo
  olharT: number           // s restantes do "olhar" antes de fechar
  alvoFaixa: number | null // faixa do jogador vista quando decidiu fechar
  base: number             // faixa onde estava ao começar a olhar (balanço volta pra ela)
}

// w = meia-largura na fração da pista (-1..1) · len = comprimento em unidades Z
// h = altura visual (sprite) · spd = faixa de velocidade de cruzeiro [min, max] km/h
export const KINDS: Record<TrafficKind, { w: number; len: number; h: number; spd: [number, number] }> = {
  car:    { w: 0.28, len: 260, h: 0.80, spd: [85, 125] },
  moto:   { w: 0.12, len: 190, h: 1.25, spd: [115, 150] },
  truck:  { w: 0.34, len: 540, h: 1.55, spd: [66, 88] },
  bus:    { w: 0.33, len: 470, h: 1.45, spd: [76, 95] },
  police: { w: 0.22, len: 230, h: 0.82, spd: [200, 240] }, // menor e ágil (só via spawnPoliceChase)
  roadblock: { w: 0.40, len: 200, h: 0.62, spd: [0, 0] },  // viatura atravessada do bloqueio (world/policia.ts, E10)
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
  alerta?: boolean     // pisca-alerta ligado (convite de racha, carro batido)
  freioT?: number      // >0: luz de freio acesa (o rival "olhando" antes de fechar)
  racha?: RivalRacha   // só no desafiante do racha
  vReal?: number       // km/h que andou de fato no último quadro (o civil freando anda abaixo de `speed`)
  presoT?: number      // civil: s parado atrás do jogador (passa de CIVIL.buzinaS: buzina e tenta passar)
  viaduto?: "sobe" | "entra" // civil usando o elevado do viaduto (world/zones.ts, Fase 8.6)
  giroflexAmbar?: boolean // batedor do comboio, guincho (Fase 8.3)
  placa?: string       // faixa escrita na traseira (o último caminhão do comboio: "CARGA LONGA")
  top?: number         // viatura: teto de velocidade (km/h) da estrela atual (world/policia.ts)
  accel?: number       // viatura: arrancada (km/h/s) da estrela atual
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
  curvaEm?(z: number): number // curvatura da pista em z (o desafiante do racha alivia nas fechadas)
  buzinar?(self: Traffic): void // civil preso atrás do jogador (o engine limita a frequência)
}
