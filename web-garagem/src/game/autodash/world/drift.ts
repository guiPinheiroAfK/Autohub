// AutoDash — world/drift.ts. Drift com freio de mão (playtest 16/11: "seria legal
// ter uns trechos que o carro faz tipo um drift").
//
// [Shift] é o freio de mão. Segurando com o volante virado acima de DRIFT.vMin, o
// carro sai de lado: a traseira abre (desenho), o pneu fuma e chia, a velocidade
// cai devagar e, se o volante aponta para DENTRO da curva, o drift segura parte da
// força que joga o carro para fora (é assim que se contorna a curva fechada sem
// frear). Enquanto está de lado, junta pontos (velocidade × ângulo); soltar o
// Shift fecha o drift e soma os pontos. Bater no meio perde tudo.
//
// A zona de drift (curvas em S, pontos em dobro) saiu no playtest de 16/11 ("ficou
// confuso"): o desafio de drift agora é o duelo de TOUGE (world/touge.ts), de
// tempo certo. Durante o duelo, o drift é o dele.
import { type AutoDashEngine, H } from "../engine"
import { emitSmoke } from "../fx/particles"
import { passoTouge } from "./touge"

export const DRIFT = {
  vMin: 70,        // km/h para o freio de mão abrir a traseira
  ang: 0.5,        // ângulo máximo do desenho (rad), a 150 km/h ou mais
  abre: 6,         // rapidez com que o ângulo chega ao alvo (1/s)
  fecha: 5,        // rapidez com que volta a reto ao soltar (1/s)
  segura: 0.6,     // fração da força da curva que o drift anula com o volante para dentro
  perdaV: 7,       // km/h/s de velocidade perdida de lado (freio: 105)
  pontosK: 0.5,    // pontos por km/h·rad·s
  fechaS: 0.35,    // s reto depois de soltar para o drift fechar e somar
  minPontos: 30,   // abaixo disso não conta (toque de freio de mão)
}

/** Freio de mão: Shift (teclado). */
export function freioDeMao(eng: AutoDashEngine): boolean {
  return eng.keys.has("shift")
}

/**
 * Um quadro de drift. Chamado logo depois da força da curva (sim/update.ts), com
 * a curva do segmento e a força que acabou de empurrar o carro. Devolve a
 * intensidade (0..1) para o chiado.
 */
export function passoDrift(eng: AutoDashEngine, dt: number, steerInput: number, curva: number, centrif: number): number {
  if (eng.touge) return passoTouge(eng, dt, curva, centrif)
  const puxando = freioDeMao(eng) && eng.speed > DRIFT.vMin
  if (puxando && (steerInput !== 0 || eng.driftAng !== 0)) {
    const dir = steerInput !== 0 ? Math.sign(steerInput) : Math.sign(eng.driftAng)
    const alvo = dir * DRIFT.ang * Math.min(1, eng.speed / 150)
    eng.driftAng += (alvo - eng.driftAng) * Math.min(1, dt * DRIFT.abre)
    eng.driftRetoT = 0
    // volante para dentro da curva: o drift segura parte da força que joga para fora
    if (curva !== 0 && Math.sign(dir) === Math.sign(curva)) eng.playerX += centrif * DRIFT.segura * dt
    eng.speed = Math.max(0, eng.speed - DRIFT.perdaV * dt)
    const ang = Math.abs(eng.driftAng)
    eng.driftPts += eng.speed * ang * dt * DRIFT.pontosK
    if (Math.random() < 0.8) emitSmoke(eng, 2, "#e5e7eb")
    return Math.min(1, ang / DRIFT.ang + 0.3)
  }
  // soltou: volta a reto e, depois de um instante, fecha o drift
  eng.driftAng += (0 - eng.driftAng) * Math.min(1, dt * DRIFT.fecha)
  if (Math.abs(eng.driftAng) < 0.01) eng.driftAng = 0
  if (eng.driftPts > 0) {
    eng.driftRetoT += dt
    if (eng.driftRetoT >= DRIFT.fechaS) fecharDrift(eng)
  }
  return 0
}

/** Soma os pontos do drift (ou descarta um toque curto). */
export function fecharDrift(eng: AutoDashEngine) {
  const pts = Math.round(eng.driftPts)
  eng.driftPts = 0
  eng.driftRetoT = 0
  if (pts < DRIFT.minPontos) return
  eng.score += pts
  eng.floaters.push({ text: `DRIFT +${pts}`, color: "#ff2e88", y: H * 0.34, life: 1.4, big: pts > 600 })
}

/** Batida no meio do drift: perde os pontos. */
export function perderDrift(eng: AutoDashEngine) {
  if (eng.driftPts < DRIFT.minPontos) { eng.driftPts = 0; return }
  eng.driftPts = 0
  eng.floaters.push({ text: "DRIFT PERDIDO", color: "#94a3b8", y: H * 0.34, life: 1.2, big: false })
}
