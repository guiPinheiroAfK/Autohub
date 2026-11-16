// AutoDash — world/touge.ts. Duelo de TOUGE na descida da serra: o chefe da serra.
//
// Histórico do playtest de 16/11: "batalha de chefe de PS2: aperta na hora certa
// e escorrega" → "na serra, com curvas e drift de verdade, não só o Shift" →
// "liberdade, parecer uma mini boss fight" → "o carro tinha que fazer mais
// manobras, e a parte de acelerar confunde no começo".
//
// O rival chama no fim do mirante (world/montanha.ts) e o duelo é a descida, sem
// trânsito. Um roteiro de curvas (grampo, "S", rápida...), cada uma pedindo:
//   S       frear antes da curva           (anel fecha um pouco antes da entrada)
//   SHIFT   freio de mão na entrada        (anel fecha no ponto de entrada; o
//           jogo fica em câmera lenta até você apertar)
//   DRIFT   o ângulo é SEU, só no volante: para dentro da curva abre, para fora
//           fecha. O medidor mostra a faixa verde e a seta de qual lado apertar.
//           Na faixa verde o carro segura a linha; quase reto sai de frente;
//           passou do vermelho RODA. O W só segura a velocidade.
//   TROCA   no "S", no meio da curva, o drift troca de lado: aperte o lado de
//           FORA (a próxima perna) quando o anel fechar
//   ESPAÇO  nitro na saída
// A soma dá a nota da curva (PERFEITA / ÓTIMO / BOM tiram vida do rival; ERROU
// tira a sua). A primeira curva é de TREINO (mais lenta, com dica, sem dano em
// você). Com metade da vida o rival ACORDA (janelas mais curtas, fecha a sua
// linha). No fim, quem perdeu fica para trás: você passa por ele (ou ele some).
import { type AutoDashEngine, H, PLAYER_Z } from "../engine"
import { DRAW_DIST, SEG_LEN, KMH2UPS, saveConfig } from "../data"
import { wrapDz } from "../traffic/spawner"
import { emitSmoke } from "../fx/particles"
import { avisar } from "./avisos"
import { hash01 } from "./cenario"
import type { Traffic } from "../traffic/types"

export type TipoCurva = "grampo" | "s" | "rapida"

export const TOUGE = {
  roteiro: ["grampo", "s", "rapida", "grampo", "s", "grampo"] as TipoCurva[],
  aproxSegs: 70,      // reta antes da primeira curva
  retaSegs: 110,      // reta entre curvas (cabe o nitro de uma e o freio da outra)
  // geometria (segmentos) e curva de cada tipo
  grampo: { entra: 10, segura: 34, sai: 12, curva: 6.8 },
  s: { entra: 8, perna: 22, troca: 10, sai: 8, curva: 6.2 },
  rapida: { entra: 12, segura: 26, sai: 12, curva: 4.2 },
  anelS: 1.3,         // o anel de cada comando aparece este tanto antes da hora
  freioAntesS: 0.6,   // o S é para esta antecedência da entrada
  perfeito: 0.12,     // s de folga do SHIFT perfeito
  bom: 0.3,           // s de folga do SHIFT bom, do S, da TROCA e do ESPAÇO
  // drift no volante (rad): faixa verde de cada tipo, onde roda, onde perde
  zona: [0.45, 0.85] as const,
  zonaRapida: [0.3, 0.6] as const,
  roda: 1.15,
  perde: 0.18,
  abre: 0.9, fecha: 1.3, solto: 0.15, // rad/s: volante para dentro, para fora, sem volante
  semGas: 10,         // km/h/s perdidos no drift sem o W
  lento: 0.4,         // escala do tempo na entrada da curva (câmera lenta)
  lentoTreino: 0.28,  // na curva de treino, mais lento ainda
  lentoDrift: 0.8,    // escala do tempo durante o drift
  introS: 2.6,        // s da apresentação do rival
  fase2: { perfeito: 0.09, bom: 0.22 }, // janelas com o rival acordado
  nitroSaida: 18,     // km/h de empurrão do nitro na hora certa
  // pontos da curva (S 1, SHIFT 2/1/0, DRIFT 2/1/0, TROCA 1 no "S", ESPAÇO 1) → dano
  dano: { perfeito: 25, otimo: 18, bom: 10, erro: 25 },
  gapBase: 800,       // u: o rival começa a esta distância à sua frente
  gapPorPonto: 9,     // u de distância por ponto de diferença entre as barras
  pontosVitoria: 3000,
  rivais: [
    { nome: "RYO", cor: "#f97316", pintura: "#f8fafc" },
    { nome: "KEN", cor: "#facc15", pintura: "#111827" },
    { nome: "NAOMI", cor: "#ec4899", pintura: "#7c3aed" },
  ],
}

export type Nota = "perfeito" | "bom" | "erro"
export type NotaCurva = "perfeito" | "otimo" | "bom" | "erro"
export type Comando = "freio" | "shift" | "drift" | "troca" | "nitro"

export interface CurvaTouge {
  tipo: TipoCurva
  entradaZ: number; fimZ: number; dir: number
  trocaZ: number | null   // "S": onde o drift troca de lado
  treino: boolean
  nota: Nota | null       // o SHIFT (abre o drift)
  freio: boolean | null   // S no tempo?
  troca: boolean | null   // "S": trocou de lado no tempo?
  zonaT: number; curvaT: number // s com o ângulo na faixa verde / s dentro da curva
  rodou: boolean
  nitro: boolean | null   // ESPAÇO no tempo?
  final: NotaCurva | null // nota da curva, quando fecha
}

export interface Touge {
  fase: "batalha" | "fim"
  curvas: CurvaTouge[]
  atual: number          // índice da próxima curva a fechar
  vidaVoce: number
  vidaRival: number
  rival: Traffic
  nome: string
  cor: string
  z: number; end: number // trecho do duelo
  acordou: boolean       // segunda fase: o rival com metade da vida
  introT: number         // s restantes da apresentação
  passou: boolean        // no fim, você passou pelo rival
}

const janelas = (eng: AutoDashEngine) => eng.touge?.acordou ? TOUGE.fase2 : { perfeito: TOUGE.perfeito, bom: TOUGE.bom }
const vUps = (eng: AutoDashEngine) => Math.max(20, eng.speed) * KMH2UPS
const ate = (eng: AutoDashEngine, z: number) => wrapDz(eng, z, eng.position + PLAYER_Z) / vUps(eng)

/** Segundos até o ponto de entrada da curva (negativo: já passou). */
export function tempoAteEntrada(eng: AutoDashEngine, c: CurvaTouge): number { return ate(eng, c.entradaZ) }
/** Segundos até o fim da curva (a hora do nitro). */
export function tempoAteSaida(eng: AutoDashEngine, c: CurvaTouge): number { return ate(eng, c.fimZ) }

/** Direção da curva no ponto do jogador (o "S" troca no meio). */
function dirAgora(eng: AutoDashEngine, c: CurvaTouge): number {
  if (c.trocaZ === null) return c.dir
  if (c.troca === true) return -c.dir // trocou (pode ser um tico antes do ponto)
  return wrapDz(eng, c.trocaZ, eng.position + PLAYER_Z) > 0 ? c.dir : -c.dir
}

/** Faixa verde do ângulo nesta curva. */
export function zonaDa(c: CurvaTouge): readonly [number, number] { return c.tipo === "rapida" ? TOUGE.zonaRapida : TOUGE.zona }

/** O comando que a tela pede agora e quanto falta para a hora dele (s). */
export function comandoAtual(eng: AutoDashEngine): { cmd: Comando; t: number; c: CurvaTouge } | null {
  const tg = eng.touge
  if (!tg || tg.fase !== "batalha") return null
  const c = tg.curvas[tg.atual]
  if (!c) return null
  const te = tempoAteEntrada(eng, c)
  if (c.freio === null && te > TOUGE.freioAntesS - TOUGE.bom) return { cmd: "freio", t: te - TOUGE.freioAntesS, c }
  if (c.nota === null) return { cmd: "shift", t: te, c }
  if (c.trocaZ !== null && c.troca === null && c.nota !== "erro") return { cmd: "troca", t: ate(eng, c.trocaZ), c }
  const ts = tempoAteSaida(eng, c)
  if (ts > 0.05 && te <= 0 && ts > TOUGE.anelS * 0.6) return { cmd: "drift", t: ts, c }
  if (c.nitro === null) return { cmd: "nitro", t: ts, c }
  return null
}

/**
 * Abre o duelo além do horizonte: reta de aproximação e o roteiro de curvas,
 * com placas. O rival aparece à sua frente.
 */
export function spawnTouge(eng: AutoDashEngine): boolean {
  if (eng.touge) return false
  const VIEW = DRAW_DIST * SEG_LEN, START = VIEW * 1.05
  const N = eng.segments.length
  const at = (d: number) => ((eng.position + d) % eng.trackLen + eng.trackLen) % eng.trackLen
  const z0 = at(START)
  const a = Math.floor(z0 / SEG_LEN)
  const T = TOUGE
  const curvas: CurvaTouge[] = []
  let i = 0
  const seg = (k: number) => eng.segments[(a + k) % N]
  const poe = (c: number) => { seg(i).curve = c; seg(i).sign = undefined; i++ }
  const zDe = (k: number) => ((a + k) % N) * SEG_LEN
  for (let k = 0; k < T.aproxSegs; k++) poe(0)
  const lado0 = hash01(a, 3) < 0.5 ? -1 : 1
  T.roteiro.forEach((tipo, n) => {
    const dir = n % 2 === 0 ? lado0 : -lado0
    const entra = i
    let trocaZ: number | null = null
    if (tipo === "s") {
      const g = T.s
      for (let k = 0; k < g.entra; k++) poe(dir * g.curva * ((k + 1) / g.entra))
      for (let k = 0; k < g.perna; k++) poe(dir * g.curva)
      const meio = i + Math.floor(g.troca / 2)
      for (let k = 0; k < g.troca; k++) poe(dir * g.curva * (1 - 2 * (k + 1) / g.troca))
      trocaZ = zDe(meio)
      for (let k = 0; k < g.perna; k++) poe(-dir * g.curva)
      for (let k = 0; k < g.sai; k++) poe(-dir * g.curva * (1 - (k + 1) / g.sai))
    } else {
      const g = tipo === "grampo" ? T.grampo : T.rapida
      for (let k = 0; k < g.entra; k++) poe(dir * g.curva * ((k + 1) / g.entra))
      for (let k = 0; k < g.segura; k++) poe(dir * g.curva)
      for (let k = 0; k < g.sai; k++) poe(dir * g.curva * (1 - (k + 1) / g.sai))
    }
    const fim = i
    for (let k = 0; k < T.retaSegs; k++) poe(0)
    curvas.push({ tipo, entradaZ: zDe(entra), fimZ: zDe(fim), dir, trocaZ, treino: n === 0, nota: null, freio: null, troca: null, zonaT: 0, curvaT: 0, rodou: false, nitro: null, final: null })
  })
  const end = at(START + i * SEG_LEN)
  eng.zones.push({ type: "touge", z: z0, end, spawnT: 0 })
  // o chefe: carro de racha sem estado de racha (anda na velocidade que o duelo manda)
  const def = T.rivais[Math.floor(hash01(a, 9) * T.rivais.length)]
  const playerZ = eng.position + PLAYER_Z
  const zr = ((playerZ + T.gapBase) % eng.trackLen + eng.trackLen) % eng.trackLen
  const rival: Traffic = {
    z: zr, offset: 0.25, targetOffset: 0.25, speed: eng.speed,
    kind: "car", role: "racha", color: def.pintura, blinkT: 0, prevD: T.gapBase,
    label: def.nome, accent: def.cor,
  }
  // a descida é do duelo: tira o trânsito (e não nasce mais nenhum até acabar)
  eng.traffic = eng.traffic.filter(t => t.role === "police" || wrapDz(eng, t.z, playerZ) < -2000)
  eng.traffic.push(rival)
  eng.touge = { fase: "batalha", curvas, atual: 0, vidaVoce: 100, vidaRival: 100, rival, nome: def.nome, cor: def.cor, z: z0, end, acordou: false, introT: TOUGE.introS, passou: false }
  eng.roadSigns.push(
    { z: at(START - VIEW * 0.8), type: "drift", label: `TOUGE: ${def.nome}` },
    { z: at(START - VIEW * 0.3), type: "drift", label: "S · SHIFT · ◀ ▶ · ESPAÇO" },
  )
  for (const c of curvas) eng.roadSigns.push({ z: c.entradaZ, type: "drift", label: c.tipo === "s" ? "S" : c.dir > 0 ? "▶ ▶" : "◀ ◀", lado: -c.dir })
  avisar(eng, { icone: "⛰️", titulo: `TOUGE · ${def.nome}`, dica: "siga os comandos na tela", nivel: "info", z: z0, fim: end })
  eng.audio.horn()
  return true
}

/** Um comando do teclado no duelo. `false` se não era hora dele (não pune aperto à toa na reta). */
export function comandoTouge(eng: AutoDashEngine, cmd: "freio" | "shift" | "troca" | "nitro"): boolean {
  const atual = comandoAtual(eng)
  if (!atual || atual.t > TOUGE.anelS) return false
  const { c } = atual
  const j = janelas(eng)
  if (cmd === "freio") {
    if (atual.cmd !== "freio") return false
    c.freio = Math.abs(atual.t) <= j.bom
    marca(eng, c.freio ? "FREIO ✓" : "FREIO ✗", c.freio)
    return true
  }
  if (cmd === "shift") {
    if (atual.cmd === "freio") { c.freio = false; marca(eng, "FREIO ✗", false) } // pulou o freio
    if (atual.cmd !== "shift" && atual.cmd !== "freio") return false
    const d = Math.abs(tempoAteEntrada(eng, c))
    julgarShift(eng, c, d <= j.perfeito ? "perfeito" : d <= j.bom ? "bom" : "erro")
    return true
  }
  if (cmd === "troca") {
    if (atual.cmd !== "troca") return false
    trocar(eng, c, Math.abs(atual.t) <= j.bom)
    return true
  }
  // nitro
  if (atual.cmd !== "nitro" && atual.cmd !== "drift") return false
  const ts = tempoAteSaida(eng, c)
  c.nitro = Math.abs(ts) <= j.bom
  if (c.nitro) eng.speed += TOUGE.nitroSaida
  marca(eng, c.nitro ? "NITRO ✓" : "NITRO ✗", c.nitro)
  return true
}

/** Shift (teclado). */
export function apertouShift(eng: AutoDashEngine) { comandoTouge(eng, "shift") }

function marca(eng: AutoDashEngine, txt: string, ok: boolean) {
  eng.floaters.push({ text: txt, color: ok ? "#4ade80" : "#ef4444", y: H * 0.5, life: 0.7, big: false })
}

function julgarShift(eng: AutoDashEngine, c: CurvaTouge, nota: Nota) {
  c.nota = nota
  if (c.freio === null) c.freio = false
  // o drift começa com o ângulo pela nota: perfeito já no meio da faixa verde
  const z = zonaDa(c)
  if (nota !== "erro") eng.driftAng = c.dir * (nota === "perfeito" ? (z[0] + z[1]) / 2 : z[0] - 0.03)
  const txt = nota === "perfeito" ? "ENTRADA PERFEITA!" : nota === "bom" ? "ENTRADA BOA" : "SAIU DE FRENTE"
  eng.floaters.push({ text: txt, color: nota === "perfeito" ? "#4ade80" : nota === "bom" ? "#facc15" : "#ef4444", y: H * 0.28, life: 0.9, big: nota !== "bom" })
  if (nota === "erro") { eng.shakeT = Math.max(eng.shakeT, 0.25); eng.audio.offroad() }
  else { eng.audio.ui(); eng.pitchY -= 3 } // a traseira solta: o carro mergulha um tico
}

/** "S": troca o drift de lado (no tempo) ou perde o drift (fora dele). */
function trocar(eng: AutoDashEngine, c: CurvaTouge, ok: boolean) {
  c.troca = ok
  if (ok) {
    eng.driftAng = -eng.driftAng // a traseira passa para o outro lado
    eng.trauma = Math.min(1, eng.trauma + 0.25)
    eng.floaters.push({ text: "TROCA!", color: "#4ade80", y: H * 0.3, life: 0.8, big: true })
    emitSmoke(eng, 10, "#e5e7eb")
  } else {
    eng.driftAng *= 0.3
    marca(eng, "PERDEU A TROCA", false)
  }
}

/** Fecha a curva: soma os comandos e aplica o dano. */
function fecharCurva(eng: AutoDashEngine, c: CurvaTouge) {
  const tg = eng.touge!
  const shift = c.nota === "perfeito" ? 2 : c.nota === "bom" ? 1 : 0
  const fz = c.curvaT > 0 ? c.zonaT / c.curvaT : 0
  const drift = c.rodou ? 0 : fz >= 0.6 ? 2 : fz >= 0.3 ? 1 : 0
  const troca = c.trocaZ !== null ? (c.troca ? 1 : 0) : 0
  const max = c.trocaZ !== null ? 7 : 6
  const pts = (c.freio ? 1 : 0) + shift + drift + troca + (c.nitro ? 1 : 0)
  const falta = max - pts
  const final: NotaCurva = c.nota === "erro" || c.rodou || falta >= 3 ? "erro" : falta === 0 ? "perfeito" : falta === 1 ? "otimo" : "bom"
  c.final = final
  if (final === "erro") { if (!c.treino) tg.vidaVoce = Math.max(0, tg.vidaVoce - TOUGE.dano.erro) }
  else tg.vidaRival = Math.max(0, tg.vidaRival - TOUGE.dano[final])
  const txt = { perfeito: "CURVA PERFEITA!", otimo: "ÓTIMO", bom: "BOM", erro: c.treino ? "TREINO: TENTE DE NOVO NA PRÓXIMA" : "ERROU A CURVA" }[final]
  eng.floaters.push({ text: `${txt}  ${pts}/${max}`, color: final === "erro" ? "#ef4444" : final === "bom" ? "#facc15" : "#4ade80", y: H * 0.32, life: 1.2, big: final !== "bom" })
  tg.atual++
}

/**
 * Um quadro do duelo dentro da física (sim/update.ts, logo depois da força da
 * curva): julga o que passou da hora, faz o drift no volante, a troca do "S" e a
 * câmera lenta. Devolve a intensidade do chiado (0..1).
 */
export function passoTouge(eng: AutoDashEngine, dt: number, curva: number, centrif: number, steerInput = 0): number {
  const tg = eng.touge
  if (!tg || tg.fase !== "batalha") { eng.escalaTempo += (1 - eng.escalaTempo) * Math.min(1, dt * 4); return 0 }
  if (tg.introT > 0) tg.introT = Math.max(0, tg.introT - dt)
  const playerZ = eng.position + PLAYER_Z
  const c = tg.curvas[tg.atual]
  let lento = 1
  if (c) {
    const te = tempoAteEntrada(eng, c), ts = tempoAteSaida(eng, c), j = janelas(eng)
    // passou da hora sem apertar
    if (c.freio === null && te < TOUGE.freioAntesS - j.bom) { c.freio = false; marca(eng, "FREIO ✗", false) }
    if (c.nota === null && te < -j.bom) julgarShift(eng, c, "erro")
    // a troca do "S" é no volante: apertar o lado de fora (a próxima perna) na janela
    if (c.trocaZ !== null && c.troca === null && c.nota && c.nota !== "erro") {
      const tt = ate(eng, c.trocaZ)
      if (Math.abs(tt) <= j.bom && steerInput * c.dir < 0) trocar(eng, c, true)
      else if (tt < -j.bom) trocar(eng, c, false)
      else if (tt < 0.4 && tt > -j.bom) lento = Math.min(lento, TOUGE.lento)
    }
    if (c.nitro === null && ts < -j.bom) { c.nitro = false; marca(eng, "NITRO ✗", false) }
    if (c.nota !== null && c.nitro !== null && ts < 0) fecharCurva(eng, c)
    // câmera lenta: chegando no ponto de entrada sem ter apertado o Shift
    if (c.nota === null && te < (c.treino ? 0.9 : 0.5) && te > -j.bom) lento = Math.min(lento, c.treino ? TOUGE.lentoTreino : TOUGE.lento)
  }
  // dentro de alguma curva já aberta pelo SHIFT?
  const k = tg.curvas.find(q => q.nota && wrapDz(eng, q.entradaZ, playerZ) <= 0 && wrapDz(eng, q.fimZ, playerZ) > 0)
  let chiado = 0
  const perdeuTroca = k && k.trocaZ !== null && k.troca === false && wrapDz(eng, k.trocaZ, playerZ) <= 0
  if (!k || k.nota === "erro" || k.rodou || perdeuTroca) {
    if (k) { // saiu de frente (ou rodou): a curva joga para fora e a velocidade cai
      k.curvaT += dt
      eng.playerX -= centrif * 0.5 * dt
      eng.speed = Math.max(0, eng.speed - 22 * dt)
      chiado = 0.4
    }
    eng.driftAng += (0 - eng.driftAng) * Math.min(1, dt * (k?.rodou ? 1.5 : 5))
    if (Math.abs(eng.driftAng) < 0.01) eng.driftAng = 0
  } else {
    // DRIFT NO VOLANTE: para dentro da curva abre, para fora fecha, solto
    // fecha devagar. O W só segura a velocidade.
    const dir = dirAgora(eng, k)
    const volante = steerInput * dir // > 0 para dentro da curva, < 0 para fora
    let ang = Math.max(0, eng.driftAng * dir)
    ang += (volante > 0 ? volante * TOUGE.abre : volante < 0 ? volante * TOUGE.fecha : -TOUGE.solto) * dt
    ang += Math.abs(curva) * 0.02 * dt
    k.curvaT += dt
    if (ang > TOUGE.roda) {
      // RODOU: perde vida e velocidade, o carro gira e o drift acaba
      k.rodou = true
      if (!k.treino) tg.vidaVoce = Math.max(0, tg.vidaVoce - 15)
      eng.speed *= 0.55
      eng.shakeT = Math.max(eng.shakeT, 0.5)
      eng.driftAng = dir * 1.7
      eng.floaters.push({ text: "RODOU!", color: "#ef4444", y: H * 0.3, life: 1.1, big: true })
      eng.audio.crash()
      return 1
    }
    const z = zonaDa(k)
    const naZona = ang >= z[0] && ang <= z[1]
    if (naZona) k.zonaT += dt
    // na faixa verde a força da curva some e o carro puxa para o meio da pista
    // (a linha do drift); fora dela segura menos; quase reto sai de frente
    const segura = naZona ? 1 : ang < TOUGE.perde ? 0.2 : 0.6
    eng.playerX += centrif * segura * dt
    eng.playerX += (0 - eng.playerX) * Math.min(1, dt * (naZona ? 1 : 0.4))
    const gas = eng.gasF > 0.6
    eng.speed = Math.max(0, eng.speed + (gas ? (naZona ? 1.5 : -4) : -TOUGE.semGas) * dt)
    eng.driftAng = dir * ang
    emitSmoke(eng, naZona ? 4 : 2, "#e5e7eb")
    if (Math.random() < 0.5) emitSmoke(eng, 1, "#1f2937") // borracha queimada
    lento = Math.min(lento, TOUGE.lentoDrift)
    chiado = naZona ? 1 : 0.7
  }
  eng.escalaTempo += (lento - eng.escalaTempo) * Math.min(1, dt * 6)
  return chiado
}

/** Ângulo do drift em relação à curva agora (para o medidor), ou null fora de drift. */
export function anguloDrift(eng: AutoDashEngine): { ang: number; c: CurvaTouge; dir: number } | null {
  const tg = eng.touge
  if (!tg || tg.fase !== "batalha") return null
  const playerZ = eng.position + PLAYER_Z
  const k = tg.curvas.find(q => q.nota && q.nota !== "erro" && !q.rodou && wrapDz(eng, q.entradaZ, playerZ) <= 0 && wrapDz(eng, q.fimZ, playerZ) > 0)
  if (!k || (k.trocaZ !== null && k.troca === false && wrapDz(eng, k.trocaZ, playerZ) <= 0)) return null
  const dir = dirAgora(eng, k)
  return { ang: Math.max(0, eng.driftAng * dir), c: k, dir }
}

/** O duelo está correndo (o trânsito não nasce). */
export function emDuelo(eng: AutoDashEngine): boolean {
  return !!eng.touge && eng.touge.fase === "batalha"
}

/** Um quadro do duelo fora da física: rival, fim e saída do rival. */
export function atualizarTouge(eng: AutoDashEngine, dt: number, playerZ: number) {
  const tg = eng.touge
  if (!tg) return
  const r = tg.rival
  const gap = wrapDz(eng, r.z, playerZ)
  if (tg.fase === "batalha") {
    // pista fora: perde vida devagar
    if (eng.offroadT > 0) tg.vidaVoce = Math.max(0, tg.vidaVoce - 8 * dt)
    // o rival segue a diferença entre as barras: ganhando você encosta
    const alvoGap = TOUGE.gapBase + (tg.vidaRival - tg.vidaVoce) * TOUGE.gapPorPonto - (100 - tg.vidaRival) * 6
    r.speed = Math.max(0, eng.speed + Math.max(-45, Math.min(45, (alvoGap - gap) / 18)))
    // o rival também derrapa: a traseira abre com a curva onde ele está (desenho)
    const cr = eng.segments[Math.floor(r.z / SEG_LEN) % eng.segments.length].curve
    r.ang = Math.sign(cr) * Math.min(0.6, Math.abs(cr) * 0.09)
    // metade da vida: ACORDA (janelas mais curtas, e passa a fechar a sua linha)
    if (!tg.acordou && tg.vidaRival <= 50) {
      tg.acordou = true
      eng.floaters.push({ text: `${tg.nome} ACORDOU!`, color: tg.cor, y: H * 0.3, life: 1.8, big: true })
      eng.trauma = Math.min(1, eng.trauma + 0.4)
      eng.audio.horn()
    }
    if (tg.acordou && gap > 250 && gap < 2200) r.targetOffset = r.offset = r.offset + (Math.max(-0.75, Math.min(0.75, eng.playerX)) - r.offset) * Math.min(1, dt * 1.5)
    const acabou = tg.vidaVoce <= 0 || tg.vidaRival <= 0 || tg.atual >= tg.curvas.length
    if (acabou || eng.crashed) encerrarTouge(eng, !eng.crashed && tg.vidaRival < tg.vidaVoce)
    return
  }
  // fim: quem perdeu fica para trás. Ganhando, o rival abre a faixa e você passa.
  if (r.alerta) {
    r.targetOffset = r.offset = r.offset + ((eng.playerX > 0 ? -0.75 : 0.75) - r.offset) * Math.min(1, dt * 2)
    if (!tg.passou && gap < -300) {
      tg.passou = true
      eng.floaters.push({ text: `PASSOU O ${tg.nome}!`, color: "#4ade80", y: H * 0.3, life: 1.8, big: true })
      eng.trauma = Math.min(1, eng.trauma + 0.3)
    }
  }
  r.speed = Math.max(0, eng.speed + (r.alerta ? -50 : 60))
  if (Math.abs(gap) > DRAW_DIST * SEG_LEN * 0.8) { r.dead = true; eng.touge = null }
}

/** Fecha o duelo: resultado, reputação e pontos. */
export function encerrarTouge(eng: AutoDashEngine, venceu: boolean) {
  const tg = eng.touge
  if (!tg || tg.fase === "fim") return
  tg.fase = "fim"
  tg.rival.ang = 0
  eng.escalaTempo = 1
  tg.rival.alerta = venceu // perdedor liga o pisca-alerta e fica para trás
  eng.driftAng = 0
  if (venceu) {
    eng.cfg.reputacao = (eng.cfg.reputacao ?? 0) + 1
    saveConfig(eng.cfg)
    eng.score += TOUGE.pontosVitoria
    eng.floaters.push({ text: `VOCÊ DERROTOU ${tg.nome}! +1 REP`, color: "#4ade80", y: H * 0.28, life: 2.6, big: true })
    eng.floaters.push({ text: `+${TOUGE.pontosVitoria} pontos`, color: "#f8fafc", y: H * 0.36, life: 2.2, big: false })
    eng.audio.levelUp()
  } else {
    eng.floaters.push({ text: `${tg.nome} VENCEU O TOUGE`, color: "#ef4444", y: H * 0.28, life: 2.4, big: true })
    eng.audio.horn()
  }
}
