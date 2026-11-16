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
// ZONA DE DRIFT (evento): um trecho de "S" fechados além do horizonte, com placa;
// lá dentro os pontos valem em dobro e o fim da zona mostra o total.
import { type AutoDashEngine, H } from "../engine"
import { DRAW_DIST, SEG_LEN } from "../data"
import { wrapDz } from "../traffic/spawner"
import { emitSmoke } from "../fx/particles"
import { avisar } from "./avisos"

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
  // zona de drift
  zonaSegs: 300,   // segmentos da zona (60 mil u)
  curvaS: 5.5,     // curva dos "S" (as do traçado vão de 2 a 6: aqui perto da mais fechada)
  periodo: 60,     // segmentos de cada lado do "S"
  zonaMult: 2,     // pontos em dobro dentro da zona
  chance: 0.35,    // chance de a zona entrar no sorteio de cada evento
  biomas: ["cidade", "serra"] as readonly string[], // onde a zona aparece sozinha (a tecla 0 abre em qualquer um)
}

/** Freio de mão: Shift (teclado). */
export function freioDeMao(eng: AutoDashEngine): boolean {
  return eng.keys.has("shift")
}

/** Está dentro de uma zona de drift? */
export function naZonaDrift(eng: AutoDashEngine, playerZ: number): boolean {
  return eng.zones.some(zn => zn.type === "drift" && wrapDz(eng, zn.z, playerZ) < 0 && wrapDz(eng, zn.end, playerZ) > 0)
}

/**
 * Um quadro de drift. Chamado logo depois da força da curva (sim/update.ts), com
 * a curva do segmento e a força que acabou de empurrar o carro. Devolve a
 * intensidade (0..1) para o chiado.
 */
export function passoDrift(eng: AutoDashEngine, dt: number, steerInput: number, curva: number, centrif: number, playerZ: number): number {
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
    const mult = naZonaDrift(eng, playerZ) ? DRIFT.zonaMult : 1
    eng.driftPts += eng.speed * ang * dt * DRIFT.pontosK * mult
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
  eng.driftZonaPts += pts
  eng.floaters.push({ text: `DRIFT +${pts}`, color: "#ff2e88", y: H * 0.34, life: 1.4, big: pts > 600 })
}

/** Batida no meio do drift: perde os pontos. */
export function perderDrift(eng: AutoDashEngine) {
  if (eng.driftPts < DRIFT.minPontos) { eng.driftPts = 0; return }
  eng.driftPts = 0
  eng.floaters.push({ text: "DRIFT PERDIDO", color: "#94a3b8", y: H * 0.34, life: 1.2, big: false })
}

/**
 * Abre uma zona de drift além do horizonte: o traçado vira uma sequência de "S"
 * fechados (curva suave nas pontas), com placas antes. Devolve false se não coube.
 */
export function spawnZonaDrift(eng: AutoDashEngine): boolean {
  const VIEW = DRAW_DIST * SEG_LEN, START = VIEW * 1.5
  const at = (d: number) => ((eng.position + d) % eng.trackLen + eng.trackLen) % eng.trackLen
  const comp = DRIFT.zonaSegs * SEG_LEN
  const z = at(START), end = at(START + comp)
  eng.zones.push({ type: "drift", z, end, spawnT: 0 })
  const N = eng.segments.length
  const a = Math.floor(z / SEG_LEN)
  for (let i = 0; i < DRIFT.zonaSegs; i++) {
    const s = eng.segments[(a + i) % N]
    // S: seno de período 2·periodo, com a entrada e a saída suaves (40 segmentos)
    const borda = Math.min(1, i / 40, (DRIFT.zonaSegs - i) / 40)
    s.curve = Math.sin((i / DRIFT.periodo) * Math.PI) * DRIFT.curvaS * borda
    s.sign = undefined
  }
  eng.roadSigns.push(
    { z: at(START - VIEW * 0.8), type: "drift", label: "ZONA DE DRIFT" },
    { z: at(START - VIEW * 0.35), type: "drift", label: "SHIFT: FREIO DE MÃO" },
  )
  avisar(eng, { icone: "🌀", titulo: "ZONA DE DRIFT", dica: "segure Shift na curva: pontos em dobro", nivel: "info", z, fim: end })
  return true
}

/** Um quadro: entrou ou saiu da zona? Na saída mostra o total da zona. */
export function atualizarZonaDrift(eng: AutoDashEngine, playerZ: number) {
  const dentro = naZonaDrift(eng, playerZ)
  if (dentro && !eng.naZonaDrift) eng.driftZonaPts = 0
  if (!dentro && eng.naZonaDrift) {
    if (eng.driftPts > 0) fecharDrift(eng)
    if (eng.driftZonaPts > 0) eng.floaters.push({ text: `ZONA DE DRIFT: ${eng.driftZonaPts} pts`, color: "#19e3ff", y: H * 0.28, life: 2.4, big: true })
  }
  eng.naZonaDrift = dentro
}
