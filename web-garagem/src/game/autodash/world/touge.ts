// AutoDash — world/touge.ts. Duelo de TOUGE (playtest 16/11: "o drift ficou
// confuso; melhor algo mais fechado, tipo batalha de chefe: aperta na hora certa
// e escorrega", e "o Touge!").
//
// Um rival (o "chefe" da serra) desafia você numa descida de curvas fechadas.
// Cada curva tem um PONTO DE ENTRADA marcado na pista e um anel na tela que fecha
// até ele: aperte [Shift] (freio de mão) na hora em que o anel fecha.
//   PERFEITO (±0,12 s): o carro escorrega redondo pela curva, sem perder
//     velocidade, e o rival perde vida.
//   BOM (±0,30 s): escorrega, perde um pouco, o rival perde menos.
//   ERROU (cedo, tarde ou nada): o carro sai de frente, perde velocidade e VOCÊ
//     perde vida.
// Cada um tem uma barra de vida; quem zerar primeiro perde. O rival anda colado
// à sua frente: a distância dele segue a diferença entre as barras (ganhando,
// você encosta e passa; perdendo, ele some na curva).
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
  retaSegs: 48,       // reta entre curvas
  curva: 6.8,         // curva cheia (a mais fechada do traçado normal é 6)
  perfeito: 0.12,     // s de folga para o PERFEITO
  bom: 0.3,           // s de folga para o BOM
  anelS: 1.6,         // o anel aparece este tanto antes do ponto de entrada
  dano: { perfeito: 25, bom: 12, erro: 30 },
  gapBase: 800,       // u: o rival começa a esta distância à sua frente
  gapPorPonto: 9,     // u de distância por ponto de diferença entre as barras
  pontosVitoria: 3000,
  chance: 0.35,       // chance de entrar no sorteio de cada evento
  biomas: ["serra"] as readonly string[], // onde aparece sozinho (a tecla 0 abre em qualquer um)
  rivais: [
    { nome: "RYO", cor: "#f97316", pintura: "#f8fafc" },
    { nome: "KEN", cor: "#facc15", pintura: "#111827" },
    { nome: "NAOMI", cor: "#ec4899", pintura: "#7c3aed" },
  ],
}

export type Nota = "perfeito" | "bom" | "erro"

export interface CurvaTouge { entradaZ: number; fimZ: number; dir: number; nota: Nota | null }

export interface Touge {
  fase: "batalha" | "fim"
  curvas: CurvaTouge[]
  atual: number          // índice da próxima curva a julgar
  vidaVoce: number
  vidaRival: number
  rival: Traffic
  nome: string
  cor: string
  z: number; end: number // trecho do duelo
  notaT: number          // s mostrando a última nota
  ultimaNota: Nota | null
}

/** Segundos até o carro chegar no ponto de entrada da curva (negativo: já passou). */
export function tempoAteEntrada(eng: AutoDashEngine, c: CurvaTouge): number {
  const v = Math.max(20, eng.speed) * KMH2UPS
  return wrapDz(eng, c.entradaZ, eng.position + PLAYER_Z) / v
}

/**
 * Abre o duelo além do horizonte: reta de aproximação e TOUGE.curvas curvas
 * fechadas alternando de lado, com placa. O rival aparece à sua frente.
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
    curvas.push({ entradaZ: ((a + entra) % N) * SEG_LEN, fimZ: ((a + fim) % N) * SEG_LEN, dir, nota: null })
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
  // a serra é do duelo: tira o trânsito da frente
  eng.traffic = eng.traffic.filter(t => t.role === "police" || wrapDz(eng, t.z, playerZ) < 0)
  eng.traffic.push(rival)
  eng.touge = { fase: "batalha", curvas, atual: 0, vidaVoce: 100, vidaRival: 100, rival, nome: def.nome, cor: def.cor, z: z0, end, notaT: 0, ultimaNota: null }
  eng.roadSigns.push(
    { z: at(START - VIEW * 0.8), type: "drift", label: `TOUGE: ${def.nome}` },
    { z: at(START - VIEW * 0.3), type: "drift", label: "SHIFT NA ENTRADA DA CURVA" },
  )
  for (const c of curvas) eng.roadSigns.push({ z: c.entradaZ, type: "drift", label: c.dir > 0 ? "▶ ▶" : "◀ ◀", lado: -c.dir })
  avisar(eng, { icone: "⛰️", titulo: `TOUGE · ${def.nome}`, dica: "aperte Shift quando o anel fechar", nivel: "info", z: z0, fim: end })
  eng.floaters.push({ text: `${def.nome} te desafiou na serra!`, color: def.cor, y: H * 0.36, life: 2.4, big: true })
  eng.audio.horn()
  return true
}

/** Julga um aperto de Shift contra a próxima curva. Chamado pelo teclado. */
export function apertouShift(eng: AutoDashEngine) {
  const tg = eng.touge
  if (!tg || tg.fase !== "batalha") return
  const c = tg.curvas[tg.atual]
  if (!c || c.nota) return
  const t = tempoAteEntrada(eng, c)
  if (t > TOUGE.anelS) return // longe demais: nem conta (não pune aperto à toa na reta)
  const d = Math.abs(t)
  julgar(eng, d <= TOUGE.perfeito ? "perfeito" : d <= TOUGE.bom ? "bom" : "erro")
}

function julgar(eng: AutoDashEngine, nota: Nota) {
  const tg = eng.touge!
  const c = tg.curvas[tg.atual]
  c.nota = nota
  tg.atual++ // o anel passa para a próxima curva
  tg.ultimaNota = nota; tg.notaT = 1.1
  if (nota === "erro") tg.vidaVoce = Math.max(0, tg.vidaVoce - TOUGE.dano.erro)
  else tg.vidaRival = Math.max(0, tg.vidaRival - TOUGE.dano[nota])
  const txt = nota === "perfeito" ? "PERFEITO!" : nota === "bom" ? "BOM" : "ERROU"
  const cor = nota === "perfeito" ? "#4ade80" : nota === "bom" ? "#facc15" : "#ef4444"
  eng.floaters.push({ text: txt, color: cor, y: H * 0.3, life: 1, big: nota !== "bom" })
  if (nota === "erro") { eng.shakeT = Math.max(eng.shakeT, 0.25); eng.audio.offroad() }
  else eng.audio.ui()
}

/**
 * Um quadro do duelo dentro da física (sim/update.ts, logo depois da força da
 * curva). Faz o drift "de roteiro" da curva julgada. Devolve a intensidade do
 * chiado (0..1).
 */
export function passoTouge(eng: AutoDashEngine, dt: number, curva: number, centrif: number): number {
  const tg = eng.touge
  if (!tg || tg.fase !== "batalha") return 0
  const playerZ = eng.position + PLAYER_Z
  // passou do ponto de entrada sem apertar: tarde
  const prox = tg.curvas[tg.atual]
  if (prox && !prox.nota && tempoAteEntrada(eng, prox) < -TOUGE.bom) julgar(eng, "erro")
  // dentro de alguma curva já julgada?
  const c = tg.curvas.find(k => k.nota && wrapDz(eng, k.entradaZ, playerZ) <= 0 && wrapDz(eng, k.fimZ, playerZ) > 0)
  if (!c) {
    eng.driftAng += (0 - eng.driftAng) * Math.min(1, dt * 5)
    if (Math.abs(eng.driftAng) < 0.01) eng.driftAng = 0
    return 0
  }
  if (c.nota === "erro") {
    // sai de frente: a curva joga para fora mais forte e a velocidade cai
    eng.playerX -= centrif * 0.5 * dt
    eng.speed = Math.max(0, eng.speed - 22 * dt)
    eng.driftAng += (0 - eng.driftAng) * Math.min(1, dt * 5)
    return 0.4
  }
  // drift de roteiro: a traseira abre para fora da curva e a força da curva é anulada
  const perf = c.nota === "perfeito"
  eng.playerX += centrif * (perf ? 1 : 0.75) * dt
  // puxa para o meio da pista (a linha do drift), sem tirar o volante do jogador
  eng.playerX += (0 - eng.playerX) * Math.min(1, dt * (perf ? 1.2 : 0.6))
  eng.speed = Math.max(0, eng.speed + (perf ? 2 : -6) * dt)
  const alvo = Math.sign(curva || c.dir) * (perf ? 0.55 : 0.4)
  eng.driftAng += (alvo - eng.driftAng) * Math.min(1, dt * 7)
  if (Math.random() < 0.85) emitSmoke(eng, 2, "#e5e7eb")
  return perf ? 1 : 0.8
}

/** Um quadro do duelo fora da física: rival, fim e saída do rival. */
export function atualizarTouge(eng: AutoDashEngine, dt: number, playerZ: number) {
  const tg = eng.touge
  if (!tg) return
  if (tg.notaT > 0) tg.notaT -= dt
  const r = tg.rival
  const gap = wrapDz(eng, r.z, playerZ)
  if (tg.fase === "batalha") {
    // pista fora: perde vida devagar
    if (eng.offroadT > 0) tg.vidaVoce = Math.max(0, tg.vidaVoce - 8 * dt)
    // o rival segue a diferença entre as barras: ganhando você encosta
    const alvoGap = TOUGE.gapBase + (tg.vidaRival - tg.vidaVoce) * TOUGE.gapPorPonto - (100 - tg.vidaRival) * 6
    r.speed = Math.max(0, eng.speed + Math.max(-45, Math.min(45, (alvoGap - gap) / 18)))
    // fim: uma barra zerou, ou passou a última curva
    const ultima = tg.curvas[tg.curvas.length - 1]
    const acabou = tg.vidaVoce <= 0 || tg.vidaRival <= 0 || (ultima.nota && wrapDz(eng, ultima.fimZ, playerZ) < 0)
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
  tg.rival.alerta = venceu // (só marca para o lado da saída: perdedor fica para trás)
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
