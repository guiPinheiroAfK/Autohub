// AutoDash — sim/partida.ts. Etapa de partida do motor, antes do semáforo.
//
// O carro "liga" numa animação de duração fixa. O tempo fixo vive na lógica (não
// no áudio): os testes rodam sem áudio e o resultado precisa ser o mesmo com ele.
// Durante a etapa o semáforo não acende, `countT` não anda e o pé não sobe giro;
// nada de pontuação, km, combustível ou polícia conta (o estado "countdown" já
// não roda esses sistemas).

/** Duração da partida (s): do motor de arranque até o motor pegar em lenta. */
export const PARTIDA_S = 1.3

/** Em que fração da etapa o motor pega (a partir daí o giro sobe até a lenta). */
const PEGA_EM = 0.62

const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Giro durante a partida: o arranque gira o motor devagar e, na pegada, ele sobe até a lenta. */
export function giroDaPartida(idle: number, restante: number): number {
  const prog = 1 - Math.min(1, Math.max(0, restante / PARTIDA_S))
  return idle * (0.22 + 0.78 * suave(PEGA_EM, 1, prog))
}

/** Tremida do carro na partida, 0..1: leve no arranque, um tranco na pegada que acalma. */
export function tremidaDaPartida(restante: number): number {
  if (restante <= 0) return 0
  const prog = 1 - Math.min(1, restante / PARTIDA_S)
  const arranque = 0.25 * suave(0, 0.3, prog) * (1 - suave(PEGA_EM, PEGA_EM + 0.1, prog))
  const pegada = prog >= PEGA_EM ? 1 - suave(PEGA_EM, 1, prog) : 0
  return Math.max(arranque, pegada)
}
