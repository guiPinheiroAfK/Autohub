// AutoDash — sim/longitudinal.ts. O bloco longitudinal de um quadro de corrida:
// giro, turbo, câmbio automático, força, nitro, freio, arrasto, ladeira e teto.
// Extraído de sim/update.ts (refactor sem mudança de comportamento) para o teste
// de medidas (__tests__/medidas.test.ts) rodar a MESMA física que o jogo.
import type { AutoDashEngine } from "../engine"
import { ESCALA_ACEL, type CarSpec } from "../data"
import { relacao, fatorMarcha } from "../physics/cambio"
import { emitSmoke, emitFlame } from "../fx/particles"
import { climaAtual } from "./clima"
import { type MotorFisico, forcaNoCorte, faseCorte, rampaGas, passoEixo, boostDoEixo, aliviaNaTroca, faixa, rpmPorKmh, boostAlvo, passoBoost, giroDeForca, giroSolto } from "../physics/motores"
import { clamp } from "../math"
import { rpmFor, powerCurve } from "../physics/rpm"
import { accelK, finalDriveOf, usoTracao } from "../physics/traction"
import { autoShift } from "../physics/gearbox"
import { arrasto, arrastoExcedente, tetoSuave } from "../physics/arrasto"
import { giroNaTroca, cambioDe, KICK } from "../physics/troca"

/** Ladeira (km/h/s por unidade de inclinação). grade 0,13 é a mais forte da pista. */
export const LADEIRA = { sobe: 45, desce: 210 }

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
    const targetRpm = mf.idle + throttle * (mf.corte + 20 - mf.idle) // pé no fundo bate no corte (antes parava em 94% da faixa)
    // giro solto: motor leve sobe e cai rápido, motor pesado é preguiçoso
    eng.rpm = Math.min(mf.corte, giroSolto(mf, eng.rpm, targetRpm, dt))
  }
  // turbo: enche com giro e pé, com atraso; esvazia na troca e ao aliviar.
  // É aqui que nasce o "lag": sai de curva em giro baixo e a força demora a vir.
  // Na troca de marcha a borboleta fecha: a válvula alivia a pressão (pssh, o
  // apito cai) e o eixo segue girando; a marcha seguinte devolve a pressão do
  // eixo e o som reenche o apito. Antes a pressão ficava parada na troca, como
  // antilag (playtest 15/11). Em ponto morto quase não enche (sem carga).
  // Engatado, o eixo do turbo tem memória (passoEixo/boostDoEixo): um alívio
  // curto não zera o boost.
  if (eng.gear >= 1 && eng.shiftT > 0) eng.boost = aliviaNaTroca(mf, eng.boost, dt)
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
    // e um estalo curto no escape na mesma batida. Antes o estalo saía com 40% de
    // chance A CADA QUADRO (~24/s, aleatório): virava um chiado digital constante
    // perto do corte. O corte suave não estala: o som já segura o giro sozinho.
    if (mf.corteDuro && eng.rpm >= mf.corte - 50 && faseCorte(eng.somT) < faseCorte(eng.somT - dt)) {
      eng.trauma = Math.min(1, Math.max(eng.trauma, 0.2) + 0.04)
      eng.audio.limiter()
    }
    if (eng.wheelspinT > 0) { accel *= 0.35; emitSmoke(eng, 2, "#e2e8f0"); patina = Math.max(patina, 0.3) }
    if (eng.bogT > 0) accel *= 0.5
  }
  // teto suave: perto do topSpeed a sobra de força some aos poucos (P5)
  accel = tetoSuave(accel, eng.speed, spec.topSpeed)
  // suaviza para o giro e o chiado não piscarem quadro a quadro
  eng.patina += (patina - eng.patina) * Math.min(1, dt * 10)
  if (eng.nitroOn && eng.nitroMeter > 1 && eng.gear >= 1) {
    accel += 42
    eng.nitroMeter = Math.max(0, eng.nitroMeter - 38 * dt)
    emitFlame(eng)
  }
  const nitroActive = eng.nitroOn && eng.nitroMeter > 1

  // força, nitro e arrasto na mesma escala de tempo (ESCALA_ACEL): a máxima não
  // muda, só a rapidez. Freio e ladeira ficam fora (são do pneu e da gravidade)
  eng.speed += accel * ESCALA_ACEL * dt
  if (braking) eng.speed -= 105 * climaAtual(eng).freio * dt
  eng.speed -= arrasto(eng.speed) * ESCALA_ACEL * dt
  // acima do topo (nitro, descida) o ar cobra caro: equilibra em vez de bater no teto
  eng.speed -= arrastoExcedente(eng.speed, spec.topSpeed) * ESCALA_ACEL * dt

  // FÍSICA DE LADEIRA: descida empurra o carro (dá pra passar do top speed —
  // segura no freio), subida cobra potência. O limite por marcha logo abaixo
  // age como freio motor: descer em marcha baixa segura o carro sozinho.
  // Playtest 16/11: "subindo o carro pesa demais, só perde velocidade e nem a
  // marcha de baixo muda nada". A subida tirava 120·grade km/h/s, umas 3× a
  // força do motor em marcha alta; agora tira LADEIRA.sobe·grade, perto do
  // que o motor empurra numa marcha abaixo: reduzir segura a velocidade.
  if (grade < 0) eng.speed += -grade * LADEIRA.desce * dt
  else eng.speed -= grade * LADEIRA.sobe * dt

  // trava antiga, agora só de segurança (o arrasto excedente segura antes)
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
