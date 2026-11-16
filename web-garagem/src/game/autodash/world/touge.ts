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
//   DRIFT   dentro da curva o ÂNGULO é seu (playtest 16/11, 2: "botar liberdade,
//           parecer uma mini boss fight"): W abre a traseira, tirar o pé fecha,
//           contra-esterço fecha rápido, volante para dentro abre um pouco. Na
//           faixa verde o carro segura a linha; pouco ângulo sai de frente;
//           demais, RODA (perde vida e velocidade).
//   ESPAÇO  nitro na saída                 (anel fecha no fim da curva)
// O SHIFT abre o drift (no tempo, já no meio da faixa verde); fora do tempo sai
// de frente. A soma dá a nota da curva: PERFEITA / ÓTIMO / BOM tiram vida do
// rival; ERROU (ou rodou) tira a sua. Clima de chefe: faixas de cinema, a
// apresentação do rival, câmera lenta na entrada de cada curva e, com metade da
// vida, o rival ACORDA: janelas mais curtas e ele passa a fechar a sua linha.
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
  // drift com controle (rad): faixa verde, onde roda, onde perde
  zona: [0.45, 0.85] as const,
  roda: 1.15,
  perde: 0.18,
  abreGas: 0.55, fechaSemGas: 0.9, contra: 1.2, paraDentro: 0.3, // rad/s
  lento: 0.4,         // escala do tempo na entrada da curva (câmera lenta)
  lentoDrift: 0.8,    // escala do tempo durante o drift
  introS: 2.6,        // s da apresentação do rival
  fase2: { perfeito: 0.09, bom: 0.22 }, // janelas com o rival acordado
  nitroSaida: 18,     // km/h de empurrão do nitro na hora certa
  // pontos da curva (S 1, SHIFT 2/1/0, DRIFT 2/1/0, ESPAÇO 1 = até 6) → dano
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
export type Comando = "freio" | "shift" | "drift" | "nitro"

export interface CurvaTouge {
  entradaZ: number; fimZ: number; dir: number
  nota: Nota | null       // o SHIFT (decide o drift)
  freio: boolean | null   // S no tempo?
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
}

const janelas = (eng: AutoDashEngine) => eng.touge?.acordou ? TOUGE.fase2 : { perfeito: TOUGE.perfeito, bom: TOUGE.bom }

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
  if (ts > 0.05 && te <= 0 && ts > TOUGE.anelS * 0.6) return { cmd: "drift", t: ts, c }
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
    curvas.push({ entradaZ: ((a + entra) % N) * SEG_LEN, fimZ: ((a + fim) % N) * SEG_LEN, dir, nota: null, freio: null, zonaT: 0, curvaT: 0, rodou: false, nitro: null, final: null })
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
  eng.touge = { fase: "batalha", curvas, atual: 0, vidaVoce: 100, vidaRival: 100, rival, nome: def.nome, cor: def.cor, z: z0, end, acordou: false, introT: TOUGE.introS }
  eng.roadSigns.push(
    { z: at(START - VIEW * 0.8), type: "drift", label: `TOUGE: ${def.nome}` },
    { z: at(START - VIEW * 0.3), type: "drift", label: "S · SHIFT · W · ESPAÇO" },
  )
  for (const c of curvas) eng.roadSigns.push({ z: c.entradaZ, type: "drift", label: c.dir > 0 ? "▶ ▶" : "◀ ◀", lado: -c.dir })
  avisar(eng, { icone: "⛰️", titulo: `TOUGE · ${def.nome}`, dica: "siga os comandos: S, Shift, W, Espaço", nivel: "info", z: z0, fim: end })
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
    const t = tempoAteEntrada(eng, c), d = Math.abs(t), j = janelas(eng)
    julgarShift(eng, c, d <= j.perfeito ? "perfeito" : d <= j.bom ? "bom" : "erro")
    return true
  }
  // nitro
  if (atual.cmd !== "nitro" && atual.cmd !== "drift") return false
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
  // o drift começa com o ângulo pela nota: perfeito já no meio da faixa verde
  if (nota !== "erro") eng.driftAng = c.dir * (nota === "perfeito" ? 0.65 : 0.42)
  const txt = nota === "perfeito" ? "ENTRADA PERFEITA!" : nota === "bom" ? "ENTRADA BOA" : "SAIU DE FRENTE"
  eng.floaters.push({ text: txt, color: nota === "perfeito" ? "#4ade80" : nota === "bom" ? "#facc15" : "#ef4444", y: H * 0.28, life: 0.9, big: nota !== "bom" })
  if (nota === "erro") { eng.shakeT = Math.max(eng.shakeT, 0.25); eng.audio.offroad() }
  else eng.audio.ui()
}

/** Fecha a curva: soma os comandos e aplica o dano. */
function fecharCurva(eng: AutoDashEngine, c: CurvaTouge) {
  const tg = eng.touge!
  const shift = c.nota === "perfeito" ? 2 : c.nota === "bom" ? 1 : 0
  const fz = c.curvaT > 0 ? c.zonaT / c.curvaT : 0
  const drift = c.rodou ? 0 : fz >= 0.65 ? 2 : fz >= 0.35 ? 1 : 0
  const pts = (c.freio ? 1 : 0) + shift + drift + (c.nitro ? 1 : 0)
  const final: NotaCurva = c.nota === "erro" || c.rodou || pts <= 3 ? "erro" : pts >= 6 ? "perfeito" : pts === 5 ? "otimo" : "bom"
  c.final = final
  if (final === "erro") tg.vidaVoce = Math.max(0, tg.vidaVoce - TOUGE.dano.erro)
  else tg.vidaRival = Math.max(0, tg.vidaRival - TOUGE.dano[final])
  const txt = { perfeito: "CURVA PERFEITA!", otimo: "ÓTIMO", bom: "BOM", erro: "ERROU A CURVA" }[final]
  eng.floaters.push({ text: `${txt}  ${pts}/6`, color: final === "erro" ? "#ef4444" : final === "bom" ? "#facc15" : "#4ade80", y: H * 0.32, life: 1.2, big: final !== "bom" })
  tg.atual++
}

/**
 * Um quadro do duelo dentro da física (sim/update.ts, logo depois da força da
 * curva): julga o que passou da hora, faz o drift com controle e a câmera lenta.
 * Devolve a intensidade do chiado (0..1).
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
    if (c.nitro === null && ts < -j.bom) { c.nitro = false; marca(eng, "NITRO ✗", false) }
    if (c.nota !== null && c.nitro !== null && ts < 0) fecharCurva(eng, c)
    // câmera lenta: chegando no ponto de entrada sem ter apertado o Shift
    if (c.nota === null && te < 0.5 && te > -j.bom) lento = TOUGE.lento
  }
  // dentro de alguma curva já julgada pelo SHIFT?
  const k = tg.curvas.find(q => q.nota && wrapDz(eng, q.entradaZ, playerZ) <= 0 && wrapDz(eng, q.fimZ, playerZ) > 0)
  let chiado = 0
  if (!k || k.nota === "erro" || k.rodou) {
    if (k) { // saiu de frente (ou rodou): a curva joga para fora e a velocidade cai
      k.curvaT += dt
      eng.playerX -= centrif * 0.5 * dt
      eng.speed = Math.max(0, eng.speed - 22 * dt)
      chiado = 0.4
    }
    eng.driftAng += (0 - eng.driftAng) * Math.min(1, dt * (k?.rodou ? 1.5 : 5))
    if (Math.abs(eng.driftAng) < 0.01) eng.driftAng = 0
  } else {
    // DRIFT COM CONTROLE: o ângulo é do jogador
    const dir = k.dir
    const gas = eng.gasF > 0.6
    const volante = steerInput * dir // > 0 para dentro da curva, < 0 contra-esterço
    let ang = Math.max(0, eng.driftAng * dir)
    ang += ((gas ? TOUGE.abreGas : -TOUGE.fechaSemGas)
      + (volante > 0 ? volante * TOUGE.paraDentro : volante * TOUGE.contra)
      + Math.abs(curva) * 0.03) * dt
    k.curvaT += dt
    if (ang > TOUGE.roda) {
      // RODOU: perde vida e velocidade, o carro gira e o drift acaba
      k.rodou = true
      tg.vidaVoce = Math.max(0, tg.vidaVoce - 15)
      eng.speed *= 0.55
      eng.shakeT = Math.max(eng.shakeT, 0.5)
      eng.driftAng = dir * 1.7
      eng.floaters.push({ text: "RODOU!", color: "#ef4444", y: H * 0.3, life: 1.1, big: true })
      eng.audio.crash()
      return 1
    }
    const naZona = ang >= TOUGE.zona[0] && ang <= TOUGE.zona[1]
    if (naZona) k.zonaT += dt
    // na faixa verde a força da curva some (o carro segura a linha); fora dela,
    // segura menos; quase reto, a aderência volta e ele sai de frente
    const segura = naZona ? 1 : ang < TOUGE.perde ? 0.2 : 0.6
    eng.playerX += centrif * segura * dt
    eng.speed = Math.max(0, eng.speed + (naZona && gas ? 1.5 : -9) * dt)
    eng.driftAng = dir * ang
    emitSmoke(eng, naZona ? 4 : 2, "#e5e7eb")
    if (Math.random() < 0.5) emitSmoke(eng, 1, "#1f2937") // borracha queimada
    lento = Math.min(lento, TOUGE.lentoDrift)
    chiado = naZona ? 1 : 0.7
  }
  eng.escalaTempo += (lento - eng.escalaTempo) * Math.min(1, dt * 6)
  return chiado
}

/** Ângulo do drift em relação à curva (0 fora de drift): para o medidor. */
export function anguloDrift(eng: AutoDashEngine): { ang: number; c: CurvaTouge } | null {
  const tg = eng.touge
  if (!tg || tg.fase !== "batalha") return null
  const playerZ = eng.position + PLAYER_Z
  const k = tg.curvas.find(q => q.nota && q.nota !== "erro" && !q.rodou && wrapDz(eng, q.entradaZ, playerZ) <= 0 && wrapDz(eng, q.fimZ, playerZ) > 0)
  return k ? { ang: Math.max(0, eng.driftAng * k.dir), c: k } : null
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
  // fim: o rival sai de cena (perdeu: fica para trás; ganhou: some na frente)
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
