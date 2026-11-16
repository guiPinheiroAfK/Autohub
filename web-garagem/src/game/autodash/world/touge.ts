// AutoDash — world/touge.ts. Duelo de TOUGE na descida da serra (playtest 16/11:
// "batalha de chefe de PS2: aperta na hora certa e escorrega", "tinha que ser na
// serra, com curvas e drift de verdade, e não só o Shift: segurar o W, frear (S),
// nitro (Espaço)").
//
// O rival da serra chama no mirante da montanha (world/montanha.ts) e o duelo é
// a descida: TOUGE.curvas curvas fechadas, sem trânsito. Cada curva pede, na tela,
// uma sequência de comandos, cada um com um anel que fecha na hora certa:
//   S       frear antes da curva           (anel fecha um pouco antes da entrada)
//   SHIFT   freio de mão na entrada        (anel fecha no ponto de entrada)
//   W       segurar o acelerador no drift  (barra enchendo durante a curva)
//   ESPAÇO  nitro na saída                 (anel fecha no fim da curva)
// O SHIFT decide o carro: no tempo, ele escorrega de lado pela curva (drift de
// roteiro, sem perder a linha); fora do tempo, sai de frente. A soma dos quatro
// dá a nota da curva: PERFEITO / ÓTIMO / BOM tiram vida do rival; ERROU tira a sua.
// Quem zerar a barra primeiro perde. O rival anda à sua frente na distância da
// diferença entre as barras.
import { type AutoDashEngine, H, PLAYER_Z } from "../engine"
import { DRAW_DIST, SEG_LEN, KMH2UPS, saveConfig } from "../data"
import { wrapDz } from "../traffic/spawner"
import { emitSmoke } from "../fx/particles"
import { avisar } from "./avisos"
import { hash01 } from "./cenario"
import type { Traffic } from "../traffic/types"

export const TOUGE = {
  curvas: 6,          // curvas do duelo
  aproxSegs: 70,      // reta antes da primeira curva
  entraSegs: 10,      // segmentos de entrada da curva (a curva fecha neles)
  seguraSegs: 34,     // segmentos de curva cheia
  saiSegs: 12,        // saída
  retaSegs: 110,      // reta entre curvas (cabe o nitro de uma e o freio da outra)
  curva: 6.8,         // curva cheia (a mais fechada do traçado normal é 6)
  anelS: 1.3,         // o anel de cada comando aparece este tanto antes da hora
  freioAntesS: 0.6,   // o S é para esta antecedência da entrada
  perfeito: 0.12,     // s de folga do SHIFT perfeito
  bom: 0.3,           // s de folga do SHIFT bom, do S e do ESPAÇO
  wMin: 0.75,         // fração da curva com o W segurado que vale o ponto
  nitroSaida: 18,     // km/h de empurrão do nitro na hora certa
  // pontos da curva (S 1, SHIFT 2/1/0, W 1, ESPAÇO 1 = até 5) → dano
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
export type Comando = "freio" | "shift" | "w" | "nitro"

export interface CurvaTouge {
  entradaZ: number; fimZ: number; dir: number
  nota: Nota | null       // o SHIFT (decide o drift)
  freio: boolean | null   // S no tempo?
  wT: number; curvaT: number // s com o W segurado / s dentro da curva
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
}

const vUps = (eng: AutoDashEngine) => Math.max(20, eng.speed) * KMH2UPS

/** Segundos até o ponto de entrada da curva (negativo: já passou). */
export function tempoAteEntrada(eng: AutoDashEngine, c: CurvaTouge): number {
  return wrapDz(eng, c.entradaZ, eng.position + PLAYER_Z) / vUps(eng)
}

/** Segundos até o fim da curva (a hora do nitro). */
export function tempoAteSaida(eng: AutoDashEngine, c: CurvaTouge): number {
  return wrapDz(eng, c.fimZ, eng.position + PLAYER_Z) / vUps(eng)
}

/** O comando que a tela pede agora e quanto falta para a hora dele (s). */
export function comandoAtual(eng: AutoDashEngine): { cmd: Comando; t: number; c: CurvaTouge } | null {
  const tg = eng.touge
  if (!tg || tg.fase !== "batalha") return null
  const c = tg.curvas[tg.atual]
  if (!c) return null
  const te = tempoAteEntrada(eng, c)
  if (c.freio === null && te > TOUGE.freioAntesS - TOUGE.bom) return { cmd: "freio", t: te - TOUGE.freioAntesS, c }
  if (c.nota === null) return { cmd: "shift", t: te, c }
  const ts = tempoAteSaida(eng, c)
  if (ts > 0.05 && te <= 0 && ts > TOUGE.anelS * 0.6) return { cmd: "w", t: ts, c }
  if (c.nitro === null) return { cmd: "nitro", t: ts, c }
  return null
}

/**
 * Abre o duelo além do horizonte: reta de aproximação e TOUGE.curvas curvas
 * fechadas alternando de lado, com placas. O rival aparece à sua frente.
 */
export function spawnTouge(eng: AutoDashEngine): boolean {
  if (eng.touge) return false
  const VIEW = DRAW_DIST * SEG_LEN, START = VIEW * 1.05
  const N = eng.segments.length
  const at = (d: number) => ((eng.position + d) % eng.trackLen + eng.trackLen) % eng.trackLen
  const z0 = at(START)
  const a = Math.floor(z0 / SEG_LEN)
  const T = TOUGE
  const porCurva = T.entraSegs + T.seguraSegs + T.saiSegs + T.retaSegs
  const total = T.aproxSegs + T.curvas * porCurva
  const curvas: CurvaTouge[] = []
  let i = 0
  const seg = (k: number) => eng.segments[(a + k) % N]
  for (; i < T.aproxSegs; i++) { seg(i).curve = 0; seg(i).sign = undefined }
  const lado0 = hash01(a, 3) < 0.5 ? -1 : 1
  for (let c = 0; c < T.curvas; c++) {
    const dir = c % 2 === 0 ? lado0 : -lado0
    const entra = i
    for (let k = 0; k < T.entraSegs; k++, i++) { seg(i).curve = dir * T.curva * ((k + 1) / T.entraSegs); seg(i).sign = undefined }
    for (let k = 0; k < T.seguraSegs; k++, i++) { seg(i).curve = dir * T.curva; seg(i).sign = undefined }
    for (let k = 0; k < T.saiSegs; k++, i++) { seg(i).curve = dir * T.curva * (1 - (k + 1) / T.saiSegs); seg(i).sign = undefined }
    const fim = i
    for (let k = 0; k < T.retaSegs; k++, i++) { seg(i).curve = 0; seg(i).sign = undefined }
    curvas.push({ entradaZ: ((a + entra) % N) * SEG_LEN, fimZ: ((a + fim) % N) * SEG_LEN, dir, nota: null, freio: null, wT: 0, curvaT: 0, nitro: null, final: null })
  }
  const end = at(START + total * SEG_LEN)
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
  eng.touge = { fase: "batalha", curvas, atual: 0, vidaVoce: 100, vidaRival: 100, rival, nome: def.nome, cor: def.cor, z: z0, end }
  eng.roadSigns.push(
    { z: at(START - VIEW * 0.8), type: "drift", label: `TOUGE: ${def.nome}` },
    { z: at(START - VIEW * 0.3), type: "drift", label: "S · SHIFT · W · ESPAÇO" },
  )
  for (const c of curvas) eng.roadSigns.push({ z: c.entradaZ, type: "drift", label: c.dir > 0 ? "▶ ▶" : "◀ ◀", lado: -c.dir })
  avisar(eng, { icone: "⛰️", titulo: `TOUGE · ${def.nome}`, dica: "siga os comandos: S, Shift, W, Espaço", nivel: "info", z: z0, fim: end })
  eng.floaters.push({ text: `${def.nome} te desafiou na descida!`, color: def.cor, y: H * 0.36, life: 2.4, big: true })
  eng.audio.horn()
  return true
}

/** Um comando do teclado no duelo. `false` se não era hora dele (não pune aperto à toa na reta). */
export function comandoTouge(eng: AutoDashEngine, cmd: "freio" | "shift" | "nitro"): boolean {
  const atual = comandoAtual(eng)
  if (!atual || atual.t > TOUGE.anelS) return false
  const { c } = atual
  if (cmd === "freio") {
    if (atual.cmd !== "freio") return false
    c.freio = Math.abs(atual.t) <= TOUGE.bom
    marca(eng, c.freio ? "FREIO ✓" : "FREIO ✗", c.freio)
    return true
  }
  if (cmd === "shift") {
    if (atual.cmd === "freio") { c.freio = false; marca(eng, "FREIO ✗", false) } // pulou o freio
    if (atual.cmd !== "shift" && atual.cmd !== "freio") return false
    const t = tempoAteEntrada(eng, c), d = Math.abs(t)
    julgarShift(eng, c, d <= TOUGE.perfeito ? "perfeito" : d <= TOUGE.bom ? "bom" : "erro")
    return true
  }
  // nitro
  if (atual.cmd !== "nitro" && atual.cmd !== "w") return false
  const ts = tempoAteSaida(eng, c)
  c.nitro = Math.abs(ts) <= TOUGE.bom
  if (c.nitro) eng.speed += TOUGE.nitroSaida
  marca(eng, c.nitro ? "NITRO ✓" : "NITRO ✗", c.nitro)
  return true
}

/** Compatível com o v1: Shift. */
export function apertouShift(eng: AutoDashEngine) { comandoTouge(eng, "shift") }

function marca(eng: AutoDashEngine, txt: string, ok: boolean) {
  eng.floaters.push({ text: txt, color: ok ? "#4ade80" : "#ef4444", y: H * 0.5, life: 0.7, big: false })
}

function julgarShift(eng: AutoDashEngine, c: CurvaTouge, nota: Nota) {
  c.nota = nota
  if (c.freio === null) c.freio = false
  const txt = nota === "perfeito" ? "DRIFT PERFEITO!" : nota === "bom" ? "DRIFT BOM" : "SAIU DE FRENTE"
  eng.floaters.push({ text: txt, color: nota === "perfeito" ? "#4ade80" : nota === "bom" ? "#facc15" : "#ef4444", y: H * 0.28, life: 0.9, big: nota !== "bom" })
  if (nota === "erro") { eng.shakeT = Math.max(eng.shakeT, 0.25); eng.audio.offroad() }
  else eng.audio.ui()
}

/** Fecha a curva: soma os comandos e aplica o dano. */
function fecharCurva(eng: AutoDashEngine, c: CurvaTouge) {
  const tg = eng.touge!
  const shift = c.nota === "perfeito" ? 2 : c.nota === "bom" ? 1 : 0
  const w = c.curvaT > 0 && c.wT / c.curvaT >= TOUGE.wMin ? 1 : 0
  const pts = (c.freio ? 1 : 0) + shift + w + (c.nitro ? 1 : 0)
  const final: NotaCurva = c.nota === "erro" || pts <= 2 ? "erro" : pts >= 5 ? "perfeito" : pts === 4 ? "otimo" : "bom"
  c.final = final
  if (final === "erro") tg.vidaVoce = Math.max(0, tg.vidaVoce - TOUGE.dano.erro)
  else tg.vidaRival = Math.max(0, tg.vidaRival - TOUGE.dano[final])
  const txt = { perfeito: "CURVA PERFEITA!", otimo: "ÓTIMO", bom: "BOM", erro: "ERROU A CURVA" }[final]
  eng.floaters.push({ text: `${txt}  ${pts}/5`, color: final === "erro" ? "#ef4444" : final === "bom" ? "#facc15" : "#4ade80", y: H * 0.32, life: 1.2, big: final !== "bom" })
  tg.atual++
}

/**
 * Um quadro do duelo dentro da física (sim/update.ts, logo depois da força da
 * curva): julga o que passou da hora, conta o W e faz o drift de roteiro.
 * Devolve a intensidade do chiado (0..1).
 */
export function passoTouge(eng: AutoDashEngine, dt: number, curva: number, centrif: number): number {
  const tg = eng.touge
  if (!tg || tg.fase !== "batalha") return 0
  const playerZ = eng.position + PLAYER_Z
  const c = tg.curvas[tg.atual]
  if (c) {
    const te = tempoAteEntrada(eng, c), ts = tempoAteSaida(eng, c)
    // passou da hora sem apertar
    if (c.freio === null && te < TOUGE.freioAntesS - TOUGE.bom) { c.freio = false; marca(eng, "FREIO ✗", false) }
    if (c.nota === null && te < -TOUGE.bom) julgarShift(eng, c, "erro")
    // W segurado dentro da curva
    if (te <= 0 && ts > 0) { c.curvaT += dt; if (eng.gasF > 0.6) c.wT += dt }
    if (c.nitro === null && ts < -TOUGE.bom) { c.nitro = false; marca(eng, "NITRO ✗", false) }
    if (c.nota !== null && c.nitro !== null && ts < 0) fecharCurva(eng, c)
  }
  // dentro de alguma curva já julgada pelo SHIFT?
  const k = tg.curvas.find(q => q.nota && wrapDz(eng, q.entradaZ, playerZ) <= 0 && wrapDz(eng, q.fimZ, playerZ) > 0)
  if (!k) {
    eng.driftAng += (0 - eng.driftAng) * Math.min(1, dt * 5)
    if (Math.abs(eng.driftAng) < 0.01) eng.driftAng = 0
    return 0
  }
  if (k.nota === "erro") {
    // sai de frente: a curva joga para fora mais forte e a velocidade cai
    eng.playerX -= centrif * 0.5 * dt
    eng.speed = Math.max(0, eng.speed - 22 * dt)
    eng.driftAng += (0 - eng.driftAng) * Math.min(1, dt * 5)
    return 0.4
  }
  // drift de roteiro: a traseira abre bem para fora, a força da curva some e o
  // carro segura a linha do meio. Sem o W, o drift morre e perde velocidade.
  const perf = k.nota === "perfeito"
  const noGas = eng.gasF > 0.6
  eng.playerX += centrif * (perf ? 1 : 0.75) * dt
  eng.playerX += (0 - eng.playerX) * Math.min(1, dt * (perf ? 1.2 : 0.6))
  eng.speed = Math.max(0, eng.speed + (noGas ? (perf ? 2 : -4) : -14) * dt)
  const alvo = Math.sign(curva || k.dir) * (noGas ? (perf ? 0.8 : 0.6) : 0.35)
  eng.driftAng += (alvo - eng.driftAng) * Math.min(1, dt * 7)
  emitSmoke(eng, perf ? 4 : 3, "#e5e7eb")
  if (Math.random() < 0.5) emitSmoke(eng, 1, "#1f2937") // borracha queimada
  return perf ? 1 : 0.8
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
    const acabou = tg.vidaVoce <= 0 || tg.vidaRival <= 0 || tg.atual >= tg.curvas.length
    if (acabou || eng.crashed) encerrarTouge(eng, !eng.crashed && tg.vidaRival < tg.vidaVoce)
    return
  }
  // fim: o rival sai de cena (perdeu: fica para trás; ganhou: some na frente)
  r.speed = Math.max(0, eng.speed + (r.alerta ? -50 : 60))
  if (Math.abs(gap) > DRAW_DIST * SEG_LEN * 0.8) { r.dead = true; eng.touge = null }
}

/** Fecha o duelo: resultado, reputação e pontos. */
export function encerrarTouge(eng: AutoDashEngine, venceu: boolean) {
  const tg = eng.touge
  if (!tg || tg.fase === "fim") return
  tg.fase = "fim"
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
