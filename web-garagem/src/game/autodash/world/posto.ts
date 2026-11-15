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
import { type Ramal, RAMAL_MIN, ramalNoSeg, sobreRamal } from "./ramais"
import { COMBUSTIVEL, consumoDoCarro, consumoLs, gastar, abastecer, tetoDoPe } from "./combustivel"
import { avisar } from "./avisos"

// tamanho do posto em segmentos: um ramal mínimo mais um miolo de bomba
export const POSTO_SEGS = RAMAL_MIN + 120
// largura da faixa do posto (meias-pistas; uma faixa da pista vale 0,5) e o
// canteiro entre ela e a pista no miolo
const POSTO_LARG = 0.6
const POSTO_AFAST = 0.22

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
  const az = a * SEG_LEN
  const at = (d: number) => ((az + d) % eng.trackLen + eng.trackLen) % eng.trackLen
  eng.roadSigns.push(
      { z: at(-VIEW * 0.95), type: "posto", label: "POSTO" },
      { z: at(-VIEW * 0.6), type: "posto", label: "À DIREITA" },
      { z: at(-VIEW * 0.28), type: "posto", label: "ENTRADA" },
  )
  avisar(eng, { icone: "⛽", titulo: "POSTO", dica: `pela direita, até ${COMBUSTIVEL.abasteceVmax} km/h`, nivel: "info", z: az, fim: b * SEG_LEN })
  return true
}

/**
 * TODO(som): bomba de combustível. A sessão de som implementa um
 * `AudioBus.abastecer(ligado)`; até lá isto não toca nada (sound/ e audio.ts
 * estão com outra frente de trabalho).
 */
export function somAbastecer(_eng: AutoDashEngine, _ligado: boolean) { /* TODO(som) */ }

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
  if (enchendo) eng.combustivel = abastecer(eng.combustivel, eng.speed, dt)
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
}

/** O spawner de eventos deve segurar? (posto pedido e ainda não aberto) */
export function postoPedido(eng: AutoDashEngine): boolean {
  return combustivelAtivo(eng) && eng.combustivel < eng.postoLimite && !postoAFrente(eng)
}
