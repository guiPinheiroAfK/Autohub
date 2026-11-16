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
  apito: [number, number] // faixa do assobio do eixo (Hz): turbina pequena = mais aguda
  turbinas?: number       // 2 = biturbo, 4 = quadriturbo (assobios levemente desafinados)
  desce?: number          // segundos para o eixo desacelerar ao aliviar (padrão 1,5)
}

export interface MotorFisico {
  idle: number
  redline: number          // começo da faixa vermelha (troca ideal perto daqui)
  corte: number            // limitador
  curva: [number, number][] // (rpm, fração da potência máxima) com boost cheio
  turbo?: Turbo
  solto?: [number, number] // giro livre: rapidez para subir e para cair (padrão 5/5); motor leve = alto
  corteDuro?: boolean      // limitador de corte seco ("brap-brap") em vez do suave de fábrica
  lope?: number            // lenta irregular (rpm de oscilação): comando bravo, rotativo
  resposta?: number        // atraso do acelerador (s): borboletas individuais 0,04 … carburador de 71 0,11
  potencia: number         // cv do motor real de referência (só pesa na TROCA de motor: fatorTroca)
}

// Faixas e curvas aproximadas de motores reais da mesma família (estimativa a
// partir de curvas de dinamômetro publicadas; calibrar no playtest).
export const MOTORES: Record<string, MotorFisico> = {
  // 1.0 turbo de 3 cilindros: cheio cedo, morre em cima
  i3: { potencia: 125, resposta: 0.07, idle: 850, redline: 6200, corte: 6500, curva: [[850, 0.3], [2000, 0.7], [3500, 0.95], [5000, 1], [6500, 0.78]], solto: [6, 5],
    turbo: { spool: 1500, cheio: 2600, lag: 0.3, peso: 0.35, apito: [1800, 7500], desce: 1.1 } },
  // 4 em linha de giro alto com comando variável: fraco embaixo, acorda depois de 5800
  i4: { potencia: 240, resposta: 0.05, idle: 900, redline: 8600, corte: 8800, curva: [[900, 0.22], [3000, 0.48], [5000, 0.62], [5800, 0.82], [7500, 1], [8800, 0.9]], solto: [10, 7], corteDuro: true },
  // 4 em linha 2.0 turbo de rua (SR20DET): enche em ~3500 e empurra forte no
  // meio. Playtest 15/11: "muito fraco, parece um Onix turbo" — o atraso (0,45 s,
  // cheio só em 4000) e o peso do boost (0,4) deixavam o S15 o mais lento dos esportivos
  "i4-turbo": { potencia: 250, resposta: 0.07, idle: 850, redline: 7200, corte: 7500, curva: [[850, 0.25], [2500, 0.6], [3600, 0.97], [6400, 1], [7500, 0.85]], solto: [6, 5], corteDuro: true,
    turbo: { spool: 2300, cheio: 3500, lag: 0.33, peso: 0.3, apito: [1400, 6000] } },
  // 1.6 aspirado pequeno: linear, gira solto, pouca força
  "i4-pequeno": { potencia: 115, resposta: 0.05, idle: 850, redline: 7000, corte: 7200, curva: [[850, 0.3], [3000, 0.6], [5000, 0.85], [6500, 1], [7200, 0.92]], solto: [8, 6] },
  // boxer 2.5 turbo: atraso e depois uma pancada no meio
  boxer4: { potencia: 300, resposta: 0.07, idle: 800, redline: 6700, corte: 7000, curva: [[800, 0.25], [2500, 0.5], [3800, 0.98], [5800, 1], [7000, 0.8]], solto: [5, 4], corteDuro: true,
    turbo: { spool: 2400, cheio: 3800, lag: 0.45, peso: 0.4, apito: [1300, 5600] } },
  // 5 em linha 2.5 turbo: cheio cedo e largo
  i5: { potencia: 400, resposta: 0.07, idle: 800, redline: 6800, corte: 7000, curva: [[800, 0.3], [2200, 0.75], [3000, 0.97], [6000, 1], [7000, 0.88]], solto: [5, 4],
    turbo: { spool: 1700, cheio: 2800, lag: 0.35, peso: 0.35, apito: [1200, 5200], desce: 1.7 } },
  // 6 em linha 3.0 biturbo sequencial: primário cedo, secundário perto de 4000
  i6: { potencia: 320, resposta: 0.07, idle: 750, redline: 6800, corte: 7200, curva: [[750, 0.28], [2500, 0.62], [3800, 0.8], [4300, 0.98], [6000, 1], [7200, 0.84]], solto: [5, 4],
    turbo: { spool: 2000, cheio: 4200, lag: 0.4, peso: 0.4, apito: [1300, 5500], turbinas: 2 } },
  // 6 em linha 3.0 aspirado (2JZ-GE): mesma família do biturbo, sem turbina:
  // linear, sem atraso, gira menos e rende ~2/3 da força
  "i6-aspirado": { potencia: 220, resposta: 0.07, idle: 700, redline: 6200, corte: 6500, curva: [[700, 0.3], [2500, 0.66], [4000, 0.88], [5600, 1], [6500, 0.88]], solto: [6, 5] },
  // 6 em linha 2.6 biturbo de corrida: preguiçoso embaixo, gira até 8000
  "i6-corrida": { potencia: 330, resposta: 0.04, idle: 900, redline: 8000, corte: 8200, curva: [[900, 0.22], [3000, 0.48], [4500, 0.85], [6800, 1], [8200, 0.86]], solto: [7, 5], corteDuro: true,
    turbo: { spool: 3200, cheio: 4600, lag: 0.5, peso: 0.4, apito: [1500, 6200], turbinas: 2 } },
  // boxer 6 aspirado de pista: tudo em cima, gira até 9000
  boxer6: { potencia: 500, resposta: 0.04, idle: 900, redline: 9000, corte: 9200, curva: [[900, 0.25], [3500, 0.55], [6000, 0.82], [8400, 1], [9200, 0.93]], solto: [11, 8], corteDuro: true },
  // boxer 6 3.0 biturbo: torque plano no meio, perde fôlego depois de 6500
  "boxer6-turbo": { potencia: 450, resposta: 0.07, idle: 800, redline: 7200, corte: 7500, curva: [[800, 0.3], [2000, 0.7], [3000, 0.92], [6500, 1], [7500, 0.86]], solto: [6, 5],
    turbo: { spool: 1700, cheio: 2800, lag: 0.3, peso: 0.3, apito: [1500, 6000], turbinas: 2 } },
  // V6 3.5 aspirado: meio forte e largo
  v6: { potencia: 300, resposta: 0.07, idle: 700, redline: 6600, corte: 7000, curva: [[700, 0.32], [3000, 0.7], [4800, 0.92], [6200, 1], [7000, 0.85]], solto: [5, 4] },
  "v6-biturbo": { potencia: 400, resposta: 0.07, idle: 700, redline: 6800, corte: 7000, curva: [[700, 0.3], [2000, 0.72], [3000, 0.97], [6200, 1], [7000, 0.86]], solto: [5, 4],
    turbo: { spool: 1500, cheio: 2800, lag: 0.3, peso: 0.3, apito: [1500, 6200], turbinas: 2 } },
  // V8 com compressor Roots: força na hora, sem atraso; corte baixo
  "v8-cruzado": { potencia: 700, resposta: 0.09, idle: 700, redline: 6200, corte: 6400, curva: [[700, 0.45], [2000, 0.8], [3500, 0.95], [5800, 1], [6400, 0.9]], solto: [4, 3], corteDuro: true, lope: 60 },
  // V8 big block de 71: torque de caminhão embaixo, morre em cima, corta em 6000
  "v8-cruzado-ford": { potencia: 370, resposta: 0.11, idle: 650, redline: 5800, corte: 6000, curva: [[650, 0.5], [2000, 0.85], [3200, 1], [4800, 0.97], [6000, 0.78]], solto: [3, 2.2], corteDuro: true, lope: 90 },
  // V8 plano biturbo de hiperesportivo: absurdo em todo lugar depois que enche
  "v8-plano": { potencia: 720, resposta: 0.05, idle: 900, redline: 8250, corte: 8500, curva: [[900, 0.3], [2800, 0.7], [4000, 0.96], [7500, 1], [8500, 0.9]], solto: [8, 6], corteDuro: true,
    turbo: { spool: 2500, cheio: 4000, lag: 0.4, peso: 0.35, apito: [1200, 5000], turbinas: 2, desce: 1.8 } },
  // V10 aspirado: sobe até 8700 cantando
  v10: { potencia: 610, resposta: 0.04, idle: 900, redline: 8500, corte: 8700, curva: [[900, 0.25], [3500, 0.6], [6000, 0.86], [8000, 1], [8700, 0.94]], solto: [10, 7] },
  // V12 aspirado: o mais alto de todos
  v12: { potencia: 770, resposta: 0.04, idle: 950, redline: 9000, corte: 9250, curva: [[950, 0.28], [3500, 0.6], [6000, 0.84], [8500, 1], [9250, 0.95]], solto: [9, 6] },
  // W16 quadriturbo: enche cedo e corta cedo (motor enorme)
  w16: { potencia: 1500, resposta: 0.09, idle: 800, redline: 6700, corte: 6800, curva: [[800, 0.35], [2200, 0.85], [3000, 0.98], [6000, 1], [6800, 0.92]], solto: [3, 2.5],
    turbo: { spool: 1800, cheio: 3000, lag: 0.45, peso: 0.35, apito: [1100, 4600], turbinas: 4, desce: 2.2 } },
  // rotativo biturbo sequencial: fraco embaixo, gira solto até 8300
  rotativo: { potencia: 280, resposta: 0.05, idle: 800, redline: 8000, corte: 8300, curva: [[800, 0.2], [3000, 0.5], [4500, 0.88], [6500, 1], [8300, 0.9]], solto: [12, 9], corteDuro: true, lope: 70,
    turbo: { spool: 2800, cheio: 4500, lag: 0.45, peso: 0.4, apito: [1600, 6400], turbinas: 2 } },
}

// O motor de antes (todos os carros): 900–7900, mesmo formato de curva antigo.
export const MOTOR_PADRAO: MotorFisico = {
  potencia: 400, idle: RPM_IDLE, redline: 7600, corte: RPM_LIMITER,
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

// Troca de motor (swap): o `power` do carro foi calibrado com o motor ORIGINAL,
// então o carro de fábrica não muda. Com outro motor a força escala pela raiz da
// razão de potência (220 → 320 cv = +21%), limitada a −30%/+60% para um W16 no
// Miata não quebrar o jogo. Antes todo motor tinha a mesma área de curva e o
// Supra aspirado andava igual ao biturbo.
export function fatorTroca(spec: CarSpec, escolha?: string): number {
  const orig = motorFisico(spec), novo = motorFisico(spec, escolha)
  if (novo === orig) return 1
  return Math.min(1.6, Math.max(0.7, Math.sqrt(novo.potencia / orig.potencia)))
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

/**
 * Quanto o giro acelera o enchimento do turbo: mais giro = mais energia no
 * escape e o eixo acelera mais rápido. No giro de boost cheio vale 1; acima
 * dele até 0,6 (40% mais rápido), abaixo até 2 (mais lento). Sem giro: 1.
 */
export function fatorSpool(m: MotorFisico, rpm?: number): number {
  if (!m.turbo || rpm === undefined) return 1
  return Math.min(2, Math.max(0.6, m.turbo.cheio / Math.max(1, rpm)))
}

/** Avança o boost (enche devagar = atraso; esvazia rápido ao aliviar). */
export function passoBoost(m: MotorFisico, boost: number, alvo: number, dt: number, rpm?: number): number {
  if (!m.turbo) return 0
  // esvazia em ~0,2 s ao aliviar (a válvula alivia, mas o eixo ainda gira)
  const tau = alvo > boost ? m.turbo.lag * fatorSpool(m, rpm) : 0.2
  return boost + (alvo - boost) * Math.min(1, dt / tau)
}

// Limitador na FÍSICA, na mesma batida do som (giroDoSom): o corte duro tira a
// força inteira em pulsos de 13 Hz ("bate-volta", brap-brap); o suave de
// fábrica tira aos poucos nos últimos 50 rpm e segura o giro sem bater.
// A rampa começa onde o limitador antigo zerava a força (corte − 50): uma
// rampa de 2% da faixa (a da pesquisa) tirava força abaixo disso e baixava a
// máxima do ÁPEX de 262 para 260,7 km/h (o 262 dele fica perto do corte da 6ª).
export const CORTE_DURO_HZ = 13
export const CORTE_DURO_FASE = 0.55 // fração de cada pulso sem força
export const CORTE_SUAVE_RPM = 50

/** Fase do pulso do corte duro (0..1) no tempo `t` (s): a mesma do som. */
export function faseCorte(t: number): number {
  return t * CORTE_DURO_HZ - Math.floor(t * CORTE_DURO_HZ)
}

/** Fração da força que passa pelo limitador neste giro (1 = livre, 0 = cortado). */
export function forcaNoCorte(m: MotorFisico, rpm: number, t: number): number {
  if (m.corteDuro) {
    if (rpm < m.corte - 50) return 1
    return faseCorte(t) < CORTE_DURO_FASE ? 0 : 1
  }
  return Math.min(1, Math.max(0, (m.corte - rpm) / CORTE_SUAVE_RPM))
}

// Resposta do acelerador (R6): o gás de teclado e toque é 0/1, mas a força
// chega com um atraso curto de borboleta e coletor. Borboletas individuais
// (motor de corrida, V10, V12) respondem rápido; coletor grande e carburador,
// devagar. Só a SUBIDA da força passa por aqui: largar o pé corta na hora.
export const RESPOSTA_PADRAO = 0.07

export function respostaDe(m: MotorFisico): number {
  return m.resposta ?? RESPOSTA_PADRAO
}

/** Avança o pé "efetivo" (0..1) até o pedido, com a constante de tempo do motor. */
export function rampaGas(m: MotorFisico, gas: number, pedido: number, dt: number): number {
  const g = gas + (pedido - gas) * Math.min(1, dt / respostaDe(m))
  // encosta no pedido: sem isso a conta para em 0,9999999999999999 e o pé
  // "no fundo" nunca vale exatamente 1
  return Math.abs(pedido - g) < 1e-6 ? pedido : g
}

// Eixo do turbo com memória (P4). A válvula de alívio derruba a PRESSÃO na
// hora, mas o EIXO continua girando por 1–2 s (o `desce`, o mesmo que o som
// usa). Voltar ao gás logo depois de um toque no freio recupera o boost rápido
// em vez de recomeçar do zero. Em reta, sem tirar o pé, é igual ao modelo antigo.

/** Avança o giro do eixo (0..1): sobe com o atraso do turbo, cai em `desce` s. */
export function passoEixo(m: MotorFisico, eixo: number, rpm: number, gas: number, dt: number): number {
  if (!m.turbo) return 0
  const alvo = boostAlvo(m, rpm, gas)
  const tau = alvo > eixo ? m.turbo.lag * fatorSpool(m, rpm) : (m.turbo.desce ?? 1.5)
  return eixo + (alvo - eixo) * Math.min(1, dt / tau)
}

// Na troca a válvula de alívio abre e a pressão some neste tempo.
export const BOOST_ALIVIO_TROCA_S = 0.06

/**
 * Pressão (boost) a partir do eixo: com o pé, vai na hora até o que o eixo
 * entrega (sem passar do alvo do giro); ao aliviar, a válvula esvazia em ~0,2 s.
 */
export function boostDoEixo(m: MotorFisico, boost: number, eixo: number, rpm: number, gas: number, dt: number): number {
  if (!m.turbo) return 0
  const alvo = Math.min(eixo, boostAlvo(m, rpm, gas))
  if (alvo >= boost) return alvo
  return boost + (alvo - boost) * Math.min(1, dt / 0.2)
}

/**
 * Troca de marcha: borboleta fechada, a válvula de alívio esvazia o coletor
 * (o som faz o pssh e o apito cai). O eixo quase não perde giro numa troca
 * curta, então a marcha seguinte devolve a pressão que ele entrega: a força
 * depois da troca é a mesma de antes (na troca ela já é zero).
 */
export function aliviaNaTroca(m: MotorFisico, boost: number, dt: number): number {
  if (!m.turbo) return 0
  return boost * (1 - Math.min(1, dt / BOOST_ALIVIO_TROCA_S))
}

/** Fração do giro dentro da faixa do motor (0 = lenta, 1 = corte). */
export function fracGiro(m: MotorFisico, rpm: number): number {
  return (rpm - m.idle) / faixa(m)
}

/** Giro numa fração da faixa (para regras que antes usavam números fixos). */
export function giroNaFrac(m: MotorFisico, f: number): number {
  return m.idle + f * faixa(m)
}

/** Rapidez do giro livre (ponto morto, grid): sobe/cai por segundo, em fração do que falta. */
export function taxaSolto(m: MotorFisico, subindo: boolean): number {
  const [s, d] = m.solto ?? [5, 5]
  return subindo ? s : d
}

/**
 * Giro solto (ponto morto, grid): o motor acelera com o torque que tem, então o
 * giro sobe numa VELOCIDADE máxima (rpm/s), não pulando para perto do alvo no
 * primeiro quadro como na aproximação exponencial (que levava o VTEC ao corte em
 * ~0,2 s). Tempo para cruzar a faixa inteira: subindo 5/solto[0] s (VTEC 0,5 s,
 * 6 em linha 1 s, V8 de 71 e W16 ~1,7 s), descendo 8/solto[1] s. Perto do alvo a
 * aproximação fica suave (constante de 0,12 s).
 */
export const SOLTO_SOBE_S = 5, SOLTO_DESCE_S = 8
export function giroSolto(m: MotorFisico, rpm: number, alvo: number, dt: number): number {
  const [s, d] = m.solto ?? [5, 5]
  const f = faixa(m)
  const v = Math.max(-f * d / SOLTO_DESCE_S, Math.min(f * s / SOLTO_SOBE_S, (alvo - rpm) / 0.12))
  return rpm + v * dt
}

/**
 * Giro MOSTRADO e OUVIDO (conta-giros e som): segue o giro da física com um
 * amortecimento curto. A física pode saltar (fim da troca, embreagem fechando);
 * o ponteiro e o motor não — eles deslizam até lá em ~0,1 s.
 */
export const GIRO_SOM_TAU = 0.045
export function suavizarGiro(giroSom: number, rpm: number, dt: number): number {
  return giroSom + (rpm - giroSom) * Math.min(1, dt / GIRO_SOM_TAU)
}

/**
 * Giro que vai para o SOM (a física não muda): no limitador o giro "bate" num
 * dente de serra — corte duro cai mais e mais rápido, o suave de fábrica é
 * macio — e na lenta o comando bravo / rotativo oscila. `t` é o tempo em s.
 */
export function giroDoSom(m: MotorFisico, rpm: number, gas: number, noCorte: boolean, t: number): number {
  let r = rpm
  if (noCorte) {
    // o giro cai no corte e volta quando a ignição religa. Antes era dente de
    // serra (volta instantânea = degrau de afinação a cada pulso, soava como
    // glitch); agora cai e sobe por uma curva suave na mesma batida
    const hz = m.corteDuro ? 13 : 8, amp = (m.corteDuro ? 0.05 : 0.018) * faixa(m)
    const fase = t * hz - Math.floor(t * hz)
    r -= amp * 0.5 * (1 - Math.cos(2 * Math.PI * fase))
  }
  if (m.lope && gas < 0.2 && rpm < m.idle + 500) {
    const k = 1 - Math.max(0, rpm - m.idle) / 500
    r += m.lope * k * (Math.sin(t * 2 * Math.PI * 1.6) + 0.6 * Math.sin(t * 2 * Math.PI * 0.55 + 1.3))
  }
  return r
}
