// AutoDash — world/posto.ts. Combustível no solo e posto de abastecimento (Fase 5).
//
// O posto é uma "reta com posto": o trecho perde a curva (como a ponte) e ganha
// uma faixa de acesso à direita feita com o RAMAL PARALELO do ADR 0014, com
// `ganho = 1` (não é atalho). Entrar e sair é dirigir; a física do ramal já tira
// a punição de fora de pista ali. No miolo da faixa, a até 70 km/h, a bomba
// enche o tanque. O posto é uma zona: não empilha com outro evento (é o respiro
// do diretor de intensidade, pesquisa visual-e-desafio 4.2).
import { type AutoDashEngine, H, PLAYER_Z } from "../engine"
import { CARS, DRAW_DIST, SEG_LEN } from "../data"
import { wrapDz } from "../traffic/spawner"
import { motorDe, fracGiro } from "../physics/motores"
import { type Ramal, RAMAL_MIN, RAMAL_ABRE, RAMAL_COLADO, ramalBordas, ramalNoSeg, sobreRamal } from "./ramais"
import { TRAFFIC_COLORS } from "../traffic/types"
import { COMBUSTIVEL, consumoDoCarro, consumoLs, gastar, abastecer, tetoDoPe } from "./combustivel"
import { avisar } from "./avisos"

// tamanho do posto em segmentos: um ramal mínimo mais um miolo de bomba
export const POSTO_SEGS = RAMAL_MIN + 120
// largura do pátio do posto (meias-pistas; uma faixa da pista vale 0,5) e o
// canteiro entre ele e a pista no miolo. Fase 8.2: duas faixas de bomba com a
// ilha no meio. A de dentro é a sua; na de fora ficam os carros abastecendo.
const POSTO_LARG = 1.1
const POSTO_AFAST = 0.22
export const POSTO_FAIXA = 0.5   // largura de cada faixa de bomba
export const POSTO_ILHA = 0.1    // largura da ilha entre as faixas
export const BOMBA_SEGS = 9      // meia-extensão da ilha (segmentos): parar aqui enche rápido

/** Bordas do pátio no miolo e o centro de cada faixa (meias-pistas, sem sinal do lado). */
export function postoPatio(r: Ramal): { inner: number; outer: number; suaFaixa: number; ilha: number; outraFaixa: number } {
  const b = ramalBordas(r, { f: 1, w: 1 })
  return {
    inner: b.inner, outer: b.outer,
    suaFaixa: b.inner + POSTO_FAIXA / 2,
    ilha: b.inner + POSTO_FAIXA + POSTO_ILHA / 2,
    outraFaixa: b.inner + POSTO_FAIXA + POSTO_ILHA + POSTO_FAIXA / 2,
  }
}

/** Segmentos do posto onde ficam a loja e o totem de preço (para o cenário). */
export function postoLoja(r: Ramal): number { return postoMeio(r) + 14 }
export function postoTotem(r: Ramal): number { return r.a + RAMAL_ABRE + RAMAL_COLADO + 4 }

/** O combustível vale nesta rodada? Só no solo de verdade (não no teste de motor). */
export function combustivelAtivo(eng: AutoDashEngine): boolean {
  return eng.mode === "solo" && !eng.testeMotor
}

/** Segmento do meio do posto (onde ficam a cobertura e as bombas). */
export function postoMeio(r: Ramal): number {
  return Math.floor((r.a + r.b) / 2)
}

/** O segmento `idx` está no trecho de algum posto (com folga nas pontas)? Para o cenário. */
export function naFaixaDoPosto(ramais: Ramal[], idx: number): boolean {
  for (const r of ramais) if (r.posto && idx >= r.a - 12 && idx <= r.b + 12) return true
  return false
}

/** Posto à frente (ainda não passou do fim), se houver. */
export function postoAFrente(eng: AutoDashEngine): Ramal | null {
  const playerZ = eng.position + PLAYER_Z
  for (const r of eng.ramais) {
    if (r.posto && wrapDz(eng, r.b * SEG_LEN, playerZ) > 0) return r
  }
  return null
}

/**
 * Abre um posto além do horizonte. Devolve false se não coube (ele não pode
 * cruzar a largada, regra do ramal) ou se já há evento à frente.
 */
export function spawnPosto(eng: AutoDashEngine): boolean {
  const playerZ = eng.position + PLAYER_Z
  if (eng.zones.some(z => wrapDz(eng, z.end, playerZ) > 0)) return false
  const N = eng.segments.length
  const VIEW = DRAW_DIST * SEG_LEN
  // começa além do horizonte, como os outros eventos (placas entram antes)
  const a = Math.floor((playerZ + VIEW * 1.7) / SEG_LEN)
  const b = a + POSTO_SEGS
  if (b >= N - 2) return false // cruzaria a largada: tenta de novo depois da volta
  // reta: zera a curva do trecho e um pouco antes e depois (entrada limpa)
  for (let i = Math.max(0, a - 40); i <= Math.min(N - 1, b + 40); i++) {
    eng.segments[i].curve = 0
    eng.segments[i].sign = undefined
  }
  eng.ramais.push({
    id: `posto-${a}`, nome: "Posto", a, b, lado: 1,
    afast: POSTO_AFAST, larg: POSTO_LARG, ganho: 1, posto: true,
  })
  eng.zones.push({ type: "posto", z: a * SEG_LEN, end: b * SEG_LEN, spawnT: 0 })
  // carros abastecendo na faixa de fora (estacionados: sem IA, somem quando ficam para trás)
  const r = eng.ramais[eng.ramais.length - 1]
  const pt = postoPatio(r)
  const n = 1 + Math.floor(eng.rngEv() * 3)
  const z0 = postoMeio(r) * SEG_LEN
  for (let i = 0; i < n; i++) {
    const z = z0 + (i - (n - 1) / 2) * 520 + (eng.rngEv() - 0.5) * 120
    eng.traffic.push({
      z: ((z % eng.trackLen) + eng.trackLen) % eng.trackLen, offset: pt.outraFaixa * r.lado, targetOffset: pt.outraFaixa * r.lado,
      speed: 0, kind: "car", role: "civilian", parked: true, blinkT: 0, prevD: 1, posto: r.id,
      color: TRAFFIC_COLORS[Math.floor(eng.rngEv() * TRAFFIC_COLORS.length)],
    })
  }
  const az = a * SEG_LEN
  const at = (d: number) => ((az + d) % eng.trackLen + eng.trackLen) % eng.trackLen
  eng.roadSigns.push(
      { z: at(-VIEW * 0.95), type: "posto", label: "POSTO" },
      { z: at(-VIEW * 0.6), type: "posto", label: "À DIREITA" },
      { z: at(-VIEW * 0.28), type: "posto", label: "ENTRADA" },
  )
  avisar(eng, { icone: "⛽", titulo: "POSTO", dica: "pela direita: pare na bomba que enche rápido", nivel: "info", z: az, fim: b * SEG_LEN })
  return true
}

/** Som da bomba (motor elétrico e o fluxo), ligado enquanto enche. */
export function somAbastecer(eng: AutoDashEngine, ligado: boolean) { eng.audio.bomba(ligado) }

/** Teto do pé pelo combustível (1 = normal; pane seca engasga). */
export function peDoCombustivel(eng: AutoDashEngine): number {
  return combustivelAtivo(eng) ? tetoDoPe(eng.combustivel, eng.somT) : 1
}

/** Um quadro de combustível: gasta, abastece no posto, avisa e abre o próximo posto. */
export function atualizarCombustivel(eng: AutoDashEngine, dt: number, pe: number, nitro: boolean) {
  if (!combustivelAtivo(eng)) return
  const playerZ = eng.position + PLAYER_Z
  const antes = eng.combustivel
  const spec = CARS[eng.cfg.carIdx]
  const ls = consumoLs(pe, eng.gear >= 1 ? fracGiro(motorDe(eng), eng.rpm) : 0, nitro, consumoDoCarro(spec.body))
  eng.combustivel = gastar(eng.combustivel, ls, dt)

  // bomba: no miolo da faixa do posto, devagar
  const q = eng.ramais.length ? ramalNoSeg(eng.ramais, Math.floor(playerZ / SEG_LEN) % eng.segments.length) : null
  const naBomba = !!q && !!q.r.posto && q.p.f > 0.5 && sobreRamal(q, eng.playerX) && eng.playerX > 1.05
  const enchendo = naBomba && eng.speed <= COMBUSTIVEL.abasteceVmax && eng.combustivel < 1
  // parado só enche rápido junto da ilha; no resto do pátio vale a vazão de passagem
  eng.juntoDaBomba = !!q && naBomba && Math.abs(Math.floor(playerZ / SEG_LEN) % eng.segments.length - postoMeio(q.r)) <= BOMBA_SEGS
  if (enchendo) eng.combustivel = abastecer(eng.combustivel, eng.juntoDaBomba ? eng.speed : Math.max(eng.speed, COMBUSTIVEL.paradoVmax + 1), dt)
  if (enchendo !== eng.abastecendo) {
    eng.abastecendo = enchendo
    somAbastecer(eng, enchendo)
    if (enchendo) eng.floaters.push({ text: "⛽ ABASTECENDO", color: "#4ade80", y: H * 0.4, life: 1.2, big: false })
    else if (eng.combustivel >= 0.999) eng.floaters.push({ text: "TANQUE CHEIO ✅", color: "#4ade80", y: H * 0.4, life: 1.4, big: false })
  }
  if (naBomba && !enchendo && eng.combustivel < 1 && eng.speed > COMBUSTIVEL.abasteceVmax && Math.floor(eng.somT * 2) !== Math.floor((eng.somT - dt) * 2)) {
    eng.floaters.push({ text: `reduza pra ${COMBUSTIVEL.abasteceVmax} pra abastecer`, color: "#fbbf24", y: H * 0.44, life: 0.6, big: false })
  }

  // avisos de reserva e de pane seca (só na descida)
  if (antes >= COMBUSTIVEL.reserva && eng.combustivel < COMBUSTIVEL.reserva) {
    eng.floaters.push({ text: "⛽ RESERVA!", color: "#FF9F1C", y: H * 0.36, life: 1.8, big: true })
    eng.audio.warn()
  }
  if (antes > 0 && eng.combustivel <= 0) {
    eng.floaters.push({ text: "PANE SECA! o motor está engasgando", color: "#ef4444", y: H * 0.34, life: 2.2, big: true })
    eng.postoLimite = 1 // posto garantido assim que couber
    eng.audio.warn()
  }

  // posto que ficou para trás sai da lista de ramais. Passou reto com o tanque
  // baixo: o próximo só abre na reserva (não vira perseguição de posto).
  const atras = (r: Ramal) => r.posto && wrapDz(eng, r.b * SEG_LEN, playerZ) < -60 * SEG_LEN
  if (eng.ramais.some(atras)) {
    eng.ramais = eng.ramais.filter(r => !atras(r))
    eng.postoLimite = eng.combustivel <= 0 ? 1
      : eng.combustivel < COMBUSTIVEL.chamaPosto ? COMBUSTIVEL.chamaPostoDeNovo : COMBUSTIVEL.chamaPosto
  }
  // depois de encher, volta à regra normal
  if (eng.combustivel >= COMBUSTIVEL.chamaPosto && eng.postoLimite < COMBUSTIVEL.chamaPosto) eng.postoLimite = COMBUSTIVEL.chamaPosto

  // tanque abaixo do limite e nenhum posto à frente: abre um
  if (eng.combustivel < eng.postoLimite && !postoAFrente(eng)) spawnPosto(eng)
  atualizarCarrosDoPosto(eng, dt, playerZ)
}

export const SAIDA_POSTO = {
  quandoPerto: 9000, // u: com você a esta distância atrás, o da frente termina e sai
  arrancada: 28,     // km/h por s saindo do pátio
  vMax: 88,          // km/h quando entra na pista
}

/**
 * Fase 8.2: o carro da frente do posto termina de abastecer quando você chega
 * e sai pelo pátio, acelerando, até fundir na faixa da direita no fim do ramal.
 */
function atualizarCarrosDoPosto(eng: AutoDashEngine, dt: number, playerZ: number) {
  const N = eng.segments.length
  for (const r of eng.ramais) {
    if (!r.posto) continue
    const meus = eng.traffic.filter(t => t.posto === r.id && t.parked)
    if (!meus.length || meus.some(t => t.saindoPosto)) continue
    const frente = meus.reduce((a, b) => (wrapDz(eng, b.z, a.z) > 0 ? b : a))
    const d = wrapDz(eng, frente.z, playerZ)
    if (d > 0 && d < SAIDA_POSTO.quandoPerto) { frente.parked = false; frente.saindoPosto = true; frente.speed = 12 }
  }
  for (const t of eng.traffic) {
    if (!t.saindoPosto) continue
    t.speed = Math.min(SAIDA_POSTO.vMax, t.speed + SAIDA_POSTO.arrancada * dt)
    const idx = Math.floor(t.z / SEG_LEN) % N
    const q = ramalNoSeg(eng.ramais, idx)
    if (!q || !q.r.posto || (q.p.f <= 0.01 && idx > postoMeio(q.r))) {
      // fim do pátio: seta e entra na faixa da direita
      if (t.offset > 0.95) { t.targetOffset = 0.75; t.blinkT = Math.max(t.blinkT, 0.5) }
      else { t.saindoPosto = false; t.posto = undefined }
      continue
    }
    // no pátio, na faixa de fora; quando o ramal fecha, vem para o centro dele
    const alvo = q.p.f >= 0.999 ? postoPatio(q.r).outraFaixa * q.r.lado : ((q.inner + q.outer) / 2) * q.r.lado
    if (Math.abs(t.offset - alvo) < 0.25) t.offset = alvo
    t.targetOffset = alvo
  }
}

/** O spawner de eventos deve segurar? (posto pedido e ainda não aberto) */
export function postoPedido(eng: AutoDashEngine): boolean {
  return combustivelAtivo(eng) && eng.combustivel < eng.postoLimite && !postoAFrente(eng)
}
