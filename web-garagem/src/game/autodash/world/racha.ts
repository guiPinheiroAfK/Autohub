// AutoDash — world/racha.ts. Convite de racha como dados (Fase 5, D18 e ideia 10).
//
// Um desafiante encosta na faixa ao lado com pisca-alerta e "chama na seta".
// Piscar o farol aceita. É um sprint de distância fixa; ganhar vale reputação
// (sem dinheiro, GUIA seção 7). O ritmo é relativo ao carro do jogador, para
// o desafio valer com qualquer carro; o trânsito e o vácuo fazem a diferença.

export interface Desafiante {
  nome: string
  cor: string      // destaque: faixa no teto, neon e o ponto no HUD
  pintura: string  // cor do carro
  ritmo: number    // velocidade máxima = ritmo × topSpeed do carro do jogador
  acel: number     // km/h por segundo (o carro do jogador faz ~8–12 entre 120 e 200)
  fecha: number    // 0..1: vontade de fechar a porta (E7)
  frase: string
}

export const DESAFIANTES: Desafiante[] = [
  { nome: "KAITO", cor: "#22d3ee", pintura: "#0f172a", ritmo: 0.97, acel: 12, fecha: 0.55, frase: "bora até o próximo viaduto?" },
  { nome: "DONA ROSA", cor: "#f472b6", pintura: "#be123c", ritmo: 0.94, acel: 13, fecha: 0.25, frase: "vamo ver se esse aí anda" },
  { nome: "BIGODE", cor: "#facc15", pintura: "#1e3a8a", ritmo: 0.99, acel: 10, fecha: 0.85, frase: "na minha frente ninguém passa" },
  { nome: "LUNA", cor: "#a78bfa", pintura: "#e2e8f0", ritmo: 1.01, acel: 11, fecha: 0.6, frase: "racha limpo, sem encostar" },
]

export const RACHA = {
  primeiroConviteS: 45,           // s de solo até o primeiro convite
  intervaloS: [55, 95] as const,  // s entre um racha e o próximo convite
  conviteS: 7,                    // s para aceitar (piscar o farol)
  distanciaKm: 2.5,               // tamanho do sprint
  pontosVitoria: 3000,
  nitroVitoria: 40,
  reputacaoVitoria: 1,
  // E7 — rival que fecha
  pertoZ: 2100,                   // ~8 carros: abaixo disso, com você atrás, ele pode fechar
  fechaCadaS: 10,                 // no máximo uma fechada a cada 10 s
  olharS: 0.5,                    // "olha" (freio e balanço) e só então fecha
  balanco: 0.03,                  // amplitude do balanço do olhar (offset)
  some: 9000,                     // rival que foi embora some a esta distância
} as const

/** Desafiante sorteado por um número em [0, 1). */
export function desafianteDe(u: number): Desafiante {
  return DESAFIANTES[Math.min(DESAFIANTES.length - 1, Math.floor(u * DESAFIANTES.length))]
}

/** Quem venceu o sprint: o jogador se chegou na meta antes (empate é do jogador). */
export function venceuRacha(eu: number, ele: number, meta: number): boolean | null {
  if (eu < meta && ele < meta) return null
  return eu >= ele
}
