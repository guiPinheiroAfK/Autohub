// AutoDash — physics/motores.ts. O lado FÍSICO de cada motor: marcha lenta,
// faixa vermelha, corte e curva de força, baseados em motores reais da mesma
// arquitetura. O lado sonoro está em sound/profiles.ts (mesmos ids).
//
// O que muda entre motores é ONDE está a força e até onde gira — não a
// velocidade de cada marcha: o giro por km/h escala com a faixa do motor, então
// a 3ª de um V8 que corta em 6000 chega na mesma velocidade que a 3ª de um VTEC
// que corta em 8800. Assim o equilíbrio entre carros (power, topSpeed) segue nos
// dados do carro, e o motor dá o caráter: força embaixo, atraso do turbo, VTEC.

import { RPM_IDLE, RPM_LIMITER, RPM_PER_KMH, CARS, type CarSpec } from "../data"
import { MOTOR_DO_CARRO } from "../sound/profiles"

export interface Turbo {
  spool: number   // rpm onde o boost começa a encher
  cheio: number   // rpm com boost cheio
  lag: number     // segundos para encher (atraso do eixo)
  peso: number    // quanto da força depende do boost (0..1)
}

export interface MotorFisico {
  idle: number
  redline: number          // começo da faixa vermelha (troca ideal perto daqui)
  corte: number            // limitador
  curva: [number, number][] // (rpm, fração da potência máxima) com boost cheio
  turbo?: Turbo
}

// Faixas e curvas aproximadas de motores reais da mesma família (estimativa a
// partir de curvas de dinamômetro publicadas; calibrar no playtest).
export const MOTORES: Record<string, MotorFisico> = {
  // 1.0 turbo de 3 cilindros: cheio cedo, morre em cima
  i3: { idle: 850, redline: 6200, corte: 6500, curva: [[850, 0.3], [2000, 0.7], [3500, 0.95], [5000, 1], [6500, 0.78]],
    turbo: { spool: 1500, cheio: 2600, lag: 0.3, peso: 0.35 } },
  // 4 em linha de giro alto com comando variável: fraco embaixo, acorda depois de 5800
  i4: { idle: 900, redline: 8600, corte: 8800, curva: [[900, 0.22], [3000, 0.48], [5000, 0.62], [5800, 0.82], [7500, 1], [8800, 0.9]] },
  // 4 em linha 2.0 turbo de rua: atraso até ~3500
  "i4-turbo": { idle: 850, redline: 7200, corte: 7500, curva: [[850, 0.25], [2500, 0.55], [4000, 0.95], [6400, 1], [7500, 0.82]],
    turbo: { spool: 2600, cheio: 4000, lag: 0.45, peso: 0.4 } },
  // 1.6 aspirado pequeno: linear, gira solto, pouca força
  "i4-pequeno": { idle: 850, redline: 7000, corte: 7200, curva: [[850, 0.3], [3000, 0.6], [5000, 0.85], [6500, 1], [7200, 0.92]] },
  // boxer 2.5 turbo: atraso e depois uma pancada no meio
  boxer4: { idle: 800, redline: 6700, corte: 7000, curva: [[800, 0.25], [2500, 0.5], [3800, 0.98], [5800, 1], [7000, 0.8]],
    turbo: { spool: 2400, cheio: 3800, lag: 0.45, peso: 0.4 } },
  // 5 em linha 2.5 turbo: cheio cedo e largo
  i5: { idle: 800, redline: 6800, corte: 7000, curva: [[800, 0.3], [2200, 0.75], [3000, 0.97], [6000, 1], [7000, 0.88]],
    turbo: { spool: 1700, cheio: 2800, lag: 0.35, peso: 0.35 } },
  // 6 em linha 3.0 biturbo sequencial: primário cedo, secundário perto de 4000
  i6: { idle: 750, redline: 6800, corte: 7200, curva: [[750, 0.28], [2500, 0.62], [3800, 0.8], [4300, 0.98], [6000, 1], [7200, 0.84]],
    turbo: { spool: 2000, cheio: 4200, lag: 0.4, peso: 0.4 } },
  // 6 em linha 2.6 biturbo de corrida: preguiçoso embaixo, gira até 8000
  "i6-corrida": { idle: 900, redline: 8000, corte: 8200, curva: [[900, 0.22], [3000, 0.48], [4500, 0.85], [6800, 1], [8200, 0.86]],
    turbo: { spool: 3200, cheio: 4600, lag: 0.5, peso: 0.4 } },
  // boxer 6 aspirado de pista: tudo em cima, gira até 9000
  boxer6: { idle: 900, redline: 9000, corte: 9200, curva: [[900, 0.25], [3500, 0.55], [6000, 0.82], [8400, 1], [9200, 0.93]] },
  // boxer 6 3.0 biturbo: torque plano no meio, perde fôlego depois de 6500
  "boxer6-turbo": { idle: 800, redline: 7200, corte: 7500, curva: [[800, 0.3], [2000, 0.7], [3000, 0.92], [6500, 1], [7500, 0.86]],
    turbo: { spool: 1700, cheio: 2800, lag: 0.3, peso: 0.3 } },
  // V6 3.5 aspirado: meio forte e largo
  v6: { idle: 700, redline: 6600, corte: 7000, curva: [[700, 0.32], [3000, 0.7], [4800, 0.92], [6200, 1], [7000, 0.85]] },
  "v6-biturbo": { idle: 700, redline: 6800, corte: 7000, curva: [[700, 0.3], [2000, 0.72], [3000, 0.97], [6200, 1], [7000, 0.86]],
    turbo: { spool: 1500, cheio: 2800, lag: 0.3, peso: 0.3 } },
  // V8 com compressor Roots: força na hora, sem atraso; corte baixo
  "v8-cruzado": { idle: 700, redline: 6200, corte: 6400, curva: [[700, 0.45], [2000, 0.8], [3500, 0.95], [5800, 1], [6400, 0.9]] },
  // V8 big block de 71: torque de caminhão embaixo, morre em cima, corta em 6000
  "v8-cruzado-ford": { idle: 650, redline: 5800, corte: 6000, curva: [[650, 0.5], [2000, 0.85], [3200, 1], [4800, 0.97], [6000, 0.78]] },
  // V8 plano biturbo de hiperesportivo: absurdo em todo lugar depois que enche
  "v8-plano": { idle: 900, redline: 8250, corte: 8500, curva: [[900, 0.3], [2800, 0.7], [4000, 0.96], [7500, 1], [8500, 0.9]],
    turbo: { spool: 2500, cheio: 4000, lag: 0.4, peso: 0.35 } },
  // V10 aspirado: sobe até 8700 cantando
  v10: { idle: 900, redline: 8500, corte: 8700, curva: [[900, 0.25], [3500, 0.6], [6000, 0.86], [8000, 1], [8700, 0.94]] },
  // V12 aspirado: o mais alto de todos
  v12: { idle: 950, redline: 9000, corte: 9250, curva: [[950, 0.28], [3500, 0.6], [6000, 0.84], [8500, 1], [9250, 0.95]] },
  // W16 quadriturbo: enche cedo e corta cedo (motor enorme)
  w16: { idle: 800, redline: 6700, corte: 6800, curva: [[800, 0.35], [2200, 0.85], [3000, 0.98], [6000, 1], [6800, 0.92]],
    turbo: { spool: 1800, cheio: 3000, lag: 0.45, peso: 0.35 } },
  // rotativo biturbo sequencial: fraco embaixo, gira solto até 8300
  rotativo: { idle: 800, redline: 8000, corte: 8300, curva: [[800, 0.2], [3000, 0.5], [4500, 0.88], [6500, 1], [8300, 0.9]],
    turbo: { spool: 2800, cheio: 4500, lag: 0.45, peso: 0.4 } },
}

// O motor de antes (todos os carros): 900–7900, mesmo formato de curva antigo.
export const MOTOR_PADRAO: MotorFisico = {
  idle: RPM_IDLE, redline: 7600, corte: RPM_LIMITER,
  curva: [[RPM_IDLE, 0.25], [1399, 0.25], [1400, 0.5], [4500, 1], [7000, 1], [RPM_LIMITER, 0.55]],
}

/** id do motor que o carro usa: escolha da garagem ou o original. */
export function motorIdDoCarro(spec: CarSpec, escolha?: string): string {
  if (escolha && MOTORES[escolha]) return escolha
  return MOTOR_DO_CARRO[spec.body] ?? ""
}

export function motorFisico(spec: CarSpec, escolha?: string): MotorFisico {
  return MOTORES[motorIdDoCarro(spec, escolha)] ?? MOTOR_PADRAO
}

/** Motor do carro atual do engine (lê só o que precisa: tolera stubs de teste). */
export function motorDe(eng: { cfg: { carIdx: number; customs?: { motor?: string }[] } }): MotorFisico {
  return motorFisico(CARS[eng.cfg.carIdx], eng.cfg.customs?.[eng.cfg.carIdx]?.motor)
}

/** Faixa útil do motor (corte − lenta). */
export function faixa(m: MotorFisico): number {
  return m.corte - m.idle
}

/** Giro por km/h por relação de marcha: escala com a faixa (velocidade por marcha igual entre motores). */
export function rpmPorKmh(m: MotorFisico): number {
  return RPM_PER_KMH * faixa(m) / (RPM_LIMITER - RPM_IDLE)
}

/** Fração da potência máxima com boost cheio, interpolada na curva; 0 no corte. */
export function curvaEm(m: MotorFisico, rpm: number): number {
  if (rpm >= m.corte) return 0
  const c = m.curva
  if (rpm <= c[0][0]) return c[0][1]
  for (let i = 1; i < c.length; i++) {
    if (rpm <= c[i][0]) {
      const [a, b] = c[i - 1], [x, y] = c[i]
      return b + (y - b) * (rpm - a) / (x - a)
    }
  }
  return c[c.length - 1][1]
}

// Equilíbrio: cada curva é escalada para ter a mesma ÁREA que a curva antiga na
// faixa em que se anda (de 35% da faixa até o corte, com boost cheio). Assim o
// motor muda ONDE está a força (V8 embaixo, VTEC em cima), não QUANTO o carro
// anda — isso continua no `power` do carro. O atraso do turbo fica de fora da
// conta de propósito: é limitação de verdade.
function mediaNaFaixa(m: MotorFisico): number {
  let s = 0
  const n = 64
  for (let i = 0; i < n; i++) s += curvaEm(m, giroNaFrac(m, 0.35 + 0.65 * (i + 0.5) / n))
  return s / n
}
const ganhoCache = new WeakMap<MotorFisico, number>()
export function ganhoMotor(m: MotorFisico): number {
  let g = ganhoCache.get(m)
  if (g === undefined) {
    g = Math.min(1.3, Math.max(0.85, mediaNaFaixa(MOTOR_PADRAO) / mediaNaFaixa(m)))
    ganhoCache.set(m, g)
  }
  return g
}

/** Força com o boost atual: sem boost o motor turbo rende só (1 − peso) da curva. */
export function forcaEm(m: MotorFisico, rpm: number, boost: number): number {
  const base = curvaEm(m, rpm) * ganhoMotor(m)
  if (!m.turbo) return base
  return base * (1 - m.turbo.peso * (1 - boost))
}

/**
 * Giro que o motor "segura" para gerar força. Em 1ª a embreagem patina na
 * saída: o motor fica perto de 30% da faixa mesmo com o carro quase parado
 * (senão um motor turbo de lenta fraca nem sairia do lugar).
 */
export function giroDeForca(m: MotorFisico, rpm: number, gear: number): number {
  return gear === 1 ? Math.max(rpm, giroNaFrac(m, 0.32)) : rpm
}

/** Boost alvo: depende do giro (spool) e do pé. */
export function boostAlvo(m: MotorFisico, rpm: number, gas: number): number {
  if (!m.turbo) return 0
  const t = m.turbo
  return gas * Math.min(1, Math.max(0, (rpm - t.spool) / (t.cheio - t.spool)))
}

/** Avança o boost (enche devagar = atraso; esvazia rápido ao aliviar). */
export function passoBoost(m: MotorFisico, boost: number, alvo: number, dt: number): number {
  if (!m.turbo) return 0
  // esvazia em ~0,2 s ao aliviar (a válvula alivia, mas o eixo ainda gira)
  const tau = alvo > boost ? m.turbo.lag : 0.2
  return boost + (alvo - boost) * Math.min(1, dt / tau)
}

/** Fração do giro dentro da faixa do motor (0 = lenta, 1 = corte). */
export function fracGiro(m: MotorFisico, rpm: number): number {
  return (rpm - m.idle) / faixa(m)
}

/** Giro numa fração da faixa (para regras que antes usavam números fixos). */
export function giroNaFrac(m: MotorFisico, f: number): number {
  return m.idle + f * faixa(m)
}
