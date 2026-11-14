// AutoDash — sim/longitudinal.ts. O bloco longitudinal de um quadro de corrida:
// giro, turbo, câmbio automático, força, nitro, freio, arrasto, ladeira e teto.
// Extraído de sim/update.ts (refactor sem mudança de comportamento) para o teste
// de medidas (__tests__/medidas.test.ts) rodar a MESMA física que o jogo.
import type { AutoDashEngine } from "../engine"
import type { CarSpec } from "../data"
import { relacao, fatorMarcha } from "../physics/cambio"
import { emitSmoke, emitFlame } from "../fx/particles"
import { climaAtual } from "./clima"
import { type MotorFisico, forcaNoCorte, faseCorte, rampaGas, passoEixo, boostDoEixo, giroNaFrac, faixa, rpmPorKmh, boostAlvo, passoBoost, giroDeForca, taxaSolto } from "../physics/motores"
import { clamp } from "../math"
import { rpmFor, powerCurve } from "../physics/rpm"
import { accelK, finalDriveOf, usoTracao } from "../physics/traction"
import { autoShift } from "../physics/gearbox"
import { giroNaTroca, cambioDe, KICK } from "../physics/troca"

export interface EntradaLongitudinal {
  throttle: number  // 0 ou 1 (teclado, mouse, toque)
  braking: boolean
  centrif: number   // força centrífuga do quadro (mesma unidade de sim/update.ts)
  grade: number     // inclinação do segmento: < 0 desce, > 0 sobe
  dt: number
}

/** Avança motor e velocidade num quadro de corrida. Devolve se o nitro está ativo. */
export function passoLongitudinal(eng: AutoDashEngine, spec: CarSpec, mf: MotorFisico, e: EntradaLongitudinal): boolean {
  const { throttle, braking, centrif, grade, dt } = e

  // ---------- motor ----------
  // pé efetivo: segue o acelerador com o atraso do motor (só força e turbo usam)
  eng.gasF = rampaGas(mf, eng.gasF, throttle, dt)
  const emTroca = eng.shiftT > 0
  if (eng.shiftT > 0) eng.shiftT -= dt
  // fim da troca com o pé no fundo: a força volta e o carro cabeceia (só desenho)
  if (emTroca && eng.shiftT <= 0 && throttle && eng.gear >= 1) eng.pitchY += KICK[cambioDe(spec)]
  if (eng.wheelspinT > 0) eng.wheelspinT -= dt
  if (eng.bogT > 0) eng.bogT -= dt

  // marcha mudou desde o último quadro: anota se foi redução (para o blip)
  if (eng.gear !== eng.marchaDoGiro) { eng.reduzindo = eng.gear < eng.marchaDoGiro; eng.marchaDoGiro = eng.gear }
  if (eng.gear >= 1) {
    const alvo = rpmFor(eng, eng.speed, eng.gear)
    // na troca a embreagem está aberta: o giro cai (ou sobe, com blip na
    // redução) na rapidez do motor, sem saltar. Com a embreagem fechada o giro
    // volta a ser o da velocidade. Durante a troca a força é zero e nada da
    // física lê o giro: muda só o conta-giros e o som.
    if (eng.shiftT > 0) {
      const blip = eng.reduzindo && eng.shiftT > (spec.shiftMs / 1000) * 2 / 3
      eng.rpm = giroNaTroca(mf, eng.rpm, alvo, dt, cambioDe(spec), blip)
    } else eng.rpm = alvo
  } else {
    const targetRpm = mf.idle + throttle * (giroNaFrac(mf, 0.943) - mf.idle)
    // giro solto: motor leve sobe e cai rápido, motor pesado é preguiçoso
    eng.rpm += (targetRpm - eng.rpm) * Math.min(1, dt * taxaSolto(mf, targetRpm > eng.rpm))
  }
  // turbo: enche com giro e pé, com atraso; esvazia na troca e ao aliviar.
  // É aqui que nasce o "lag": sai de curva em giro baixo e a força demora a vir.
  // Na troca de marcha o boost se segura (troca curta, eixo ainda girando);
  // em ponto morto quase não enche (sem carga).
  // Engatado, o eixo do turbo tem memória (passoEixo/boostDoEixo): um alívio
  // curto não zera o boost.
  if (eng.gear >= 1 && eng.shiftT > 0) { /* segura o boost */ }
  else if (eng.gear >= 1) {
    const giroF = giroDeForca(mf, eng.rpm, eng.gear)
    eng.eixo = passoEixo(mf, eng.eixo, giroF, eng.gasF, dt)
    eng.boost = boostDoEixo(mf, eng.boost, eng.eixo, giroF, eng.gasF, dt)
  } else {
    const giroF = giroDeForca(mf, eng.rpm, eng.gear)
    // giro alto enche o turbo mais rápido (energia do escape)
    eng.boost = passoBoost(mf, eng.boost, boostAlvo(mf, giroF, throttle * 0.35), dt, giroF)
    eng.eixo = eng.boost
  }

  // câmbio automático
  if (eng.cfg.transmission === "auto" && eng.gear >= 1 && eng.shiftT <= 0) autoShift(eng, throttle > 0)

  let accel = 0
  let patina = 0
  if (eng.gear >= 1 && throttle && eng.shiftT <= 0) {
    const gearF = fatorMarcha(eng, eng.gear)
    const pc = powerCurve(eng, giroDeForca(mf, eng.rpm, eng.gear))
    accel = spec.power * pc * gearF * eng.gasF
    // tração: o eixo motor limita a aceleração (ADR 0012). Padrão RWD = 1, sem efeito.
    accel *= accelK(spec, pc * gearF, centrif)
    // patinada visível: o uso de tração passou de ~90% (1ª forte, saída de
    // curva no gás). Só fumaça, giro e chiado; a força acima não muda.
    patina = Math.min(0.6, Math.max(0, usoTracao(spec, pc * gearF, centrif) - 0.9))
    if (patina > 0) emitSmoke(eng, Math.ceil(patina * 8), "#e2e8f0")
    // limitador: corte duro pulsa com o som, corte suave segura o giro em rampa
    accel *= forcaNoCorte(mf, eng.rpm, eng.somT)
    // corte duro: cada pulso dá um tranco leve na câmera, na batida do som
    if (mf.corteDuro && eng.rpm >= mf.corte - 50 && faseCorte(eng.somT) < faseCorte(eng.somT - dt)) {
      eng.trauma = Math.min(1, Math.max(eng.trauma, 0.2) + 0.04)
    }
    if (eng.rpm >= mf.corte - 50 && Math.random() < 0.4) eng.audio.limiter()
    if (eng.wheelspinT > 0) { accel *= 0.35; emitSmoke(eng, 2, "#e2e8f0"); patina = Math.max(patina, 0.3) }
    if (eng.bogT > 0) accel *= 0.5
  }
  // suaviza para o giro e o chiado não piscarem quadro a quadro
  eng.patina += (patina - eng.patina) * Math.min(1, dt * 10)
  if (eng.nitroOn && eng.nitroMeter > 1 && eng.gear >= 1) {
    accel += 42
    eng.nitroMeter = Math.max(0, eng.nitroMeter - 38 * dt)
    emitFlame(eng)
  }
  const nitroActive = eng.nitroOn && eng.nitroMeter > 1

  eng.speed += accel * dt
  if (braking) eng.speed -= 105 * climaAtual(eng).freio * dt
  eng.speed -= (5 + eng.speed * 0.028) * dt // arrasto

  // FÍSICA DE LADEIRA: descida empurra o carro (dá pra passar do top speed —
  // segura no freio), subida cobra potência. O limite por marcha logo abaixo
  // age como freio motor: descer em marcha baixa segura o carro sozinho.
  if (grade < 0) eng.speed += -grade * 210 * dt
  else eng.speed -= grade * 120 * dt

  const maxSpd = spec.topSpeed * (nitroActive ? 1.12 : 1) + (grade < 0 ? -grade * 420 : 0)
  eng.speed = clamp(eng.speed, 0, maxSpd)
  // limite por marcha (estourou o giro = não anda mais) — e freio motor na descida
  if (eng.gear >= 1) {
    // igual para todo motor: o giro por km/h escala com a faixa (physics/motores.ts)
    const gearTop = faixa(mf) / (relacao(eng, eng.gear) * rpmPorKmh(mf) * finalDriveOf(spec))
    eng.speed = Math.min(eng.speed, gearTop)
  }
  return nitroActive
}
