// AutoDash — world/montanha.ts. A MONTANHA da serra (playtest 16/11, doc
// docs/specs/autodash/MONTANHA-COSTA-PRAIA.md): ao chegar na serra, a pista à
// frente (além do horizonte) vira uma viagem de subida e descida, em fases:
//   PÉ DA SERRA   curvas suaves, placa "SERRA: REDUZA", a mata fecha
//   MEIO          serpentinas em S, paredão de pedra com cachoeira de um lado,
//                 guard-rail e barranco do outro, neblina na altura da pista
//   MIRANTE       a mata abre, curva aberta e longa, o mar aparece no fundo
//   DESCIDA       caracol de curvas fechadas: é aqui que o rival do touge chama
//   BASE          volta ao nível de antes
// O relevo é um "morro" somado ao que já existe (começa e termina em zero, sem
// degrau) e a pista dentro da tela nunca muda.
import { type AutoDashEngine, H } from "../engine"
import { DRAW_DIST, SEG_LEN } from "../data"
import { avisar } from "./avisos"
import { hash01, type TipoTrecho } from "./cenario"
import { spawnTouge } from "./touge"

type Fases = [TipoTrecho, number][]
export const MONTANHA = {
  // [fase, segmentos]
  completa: [["serraPe", 420], ["serraMeio", 1150], ["mirante", 340], ["serraDescida", 760], ["serraBase", 260]] as Fases,
  // tecla 0: subida curta, mirante e a descida do touge (para testar sem esperar)
  curta: [["serraPe", 320], ["mirante", 260], ["serraDescida", 760], ["serraBase", 260]] as Fases,
  rampaSobe: 0.075, // inclinação média da subida (a altura sai dela)
  rampaDesce: 0.06, // inclinação média da descida (mais suave: descer embala muito)
  serpentina: 4.6, // curva das serpentinas do meio
  caracol: 6.4,    // curva da descida (o touge reescreve a dele por cima)
  neblinaNoMeio: true,
}

/** Lado do paredão (fixo por montanha): o barranco com guard-rail fica do outro. */
export function ladoParedao(eng: AutoDashEngine): -1 | 1 { return eng.montanha?.lado ?? -1 }

export interface Montanha { a: number; lado: -1 | 1; fases: Fases; total: number; tougeFeito: boolean }

/** Fase da montanha no segmento `idx` (null fora dela). */
export function faseNoSeg(eng: AutoDashEngine, idx: number): TipoTrecho | null {
  const m = eng.montanha
  if (!m) return null
  const N = eng.segments.length
  const d = ((idx - m.a) % N + N) % N
  let acc = 0
  for (const [f, n] of m.fases) { if (d < acc + n) return f; acc += n }
  return null
}

/** O jogador está na montanha ou a até 2 distâncias de desenho antes dela? */
export function pertoDaMontanha(eng: AutoDashEngine, idx: number): boolean {
  const m = eng.montanha
  if (!m) return false
  const N = eng.segments.length
  const d = ((idx - m.a) % N + N) % N
  return d < m.total || d > N - 3 * DRAW_DIST
}

/** Abre a montanha além do horizonte. Devolve false se não coube na volta. */
export function spawnMontanha(eng: AutoDashEngine, curta = false): boolean {
  const N = eng.segments.length
  const fases = curta ? MONTANHA.curta : MONTANHA.completa
  const MONTANHA_SEGS = fases.reduce((s, [, n]) => s + n, 0)
  if (eng.montanha || MONTANHA_SEGS > N - 2 * DRAW_DIST - 40) return false
  const base = Math.floor(eng.position / SEG_LEN)
  const a = (base + DRAW_DIST + 20) % N
  const seg = (k: number) => eng.segments[(a + k) % N]
  const lado: -1 | 1 = hash01(a, 5) < 0.5 ? -1 : 1
  // limites de cada fase
  const lim: Record<string, [number, number]> = {}
  let acc = 0
  for (const [f, n] of fases) { lim[f] = [acc, acc + n]; acc += n }
  const fimSubida = lim.mirante[0]
  const [iniDesc] = lim.serraDescida, [, fimDesc] = lim.serraBase
  const altura = Math.min(fimSubida * MONTANHA.rampaSobe, (fimDesc - iniDesc) * MONTANHA.rampaDesce) * SEG_LEN
  const suave = (t: number) => t * t * (3 - 2 * t)
  const P = (k: number) => {
    if (k <= 0 || k >= MONTANHA_SEGS) return 0
    if (k < fimSubida) return altura * suave(k / fimSubida)
    if (k < iniDesc) return altura // mirante: platô
    return altura * (1 - suave((k - iniDesc) / (fimDesc - iniDesc)))
  }
  for (let k = 0; k < MONTANHA_SEGS; k++) {
    const s = seg(k)
    s.y1 += P(k); s.y2 += P(k + 1)
    s.sign = undefined
    // traçado de cada fase
    const f = k < lim.serraPe[1] ? "pe" : lim.serraMeio && k < lim.serraMeio[1] ? "meio" : k < lim.mirante[1] ? "mirante" : k < lim.serraDescida[1] ? "desc" : "base"
    const borda = Math.min(1, k / 40, (MONTANHA_SEGS - k) / 40)
    if (f === "pe") s.curve = Math.sin(k / 70) * 2.4 * borda
    else if (f === "meio") s.curve = Math.sin((k - lim.serraMeio[0]) / 38) * MONTANHA.serpentina
    else if (f === "mirante") s.curve = 1.6 * -lado // curva aberta longa, o mar à vista
    else if (f === "desc") s.curve = Math.sign(Math.sin((k - iniDesc) / 45)) * MONTANHA.caracol * Math.min(1, Math.abs(Math.sin((k - iniDesc) / 45)) * 3)
    else s.curve = Math.sin(k / 80) * 2 * borda
  }
  // os segmentos depois da montanha seguem no relevo de antes (P volta a 0)
  eng.montanha = { a, lado, fases, total: MONTANHA_SEGS, tougeFeito: false }
  // trechos de cenário da montanha (por cima dos do bioma)
  acc = 0
  const tr: { a: number; b: number; tipo: TipoTrecho }[] = []
  for (const [f, n] of fases) {
    const ia = (a + acc) % N
    if (ia + n <= N) tr.push({ a: ia, b: ia + n, tipo: f })
    else { tr.push({ a: ia, b: N, tipo: f }); tr.push({ a: 0, b: (ia + n) % N, tipo: f }) }
    acc += n
  }
  eng.cenario = [...tr, ...eng.cenario]
  const at = (k: number) => ((a + k) % N) * SEG_LEN
  eng.roadSigns.push(
    { z: at(-60), type: "serra", label: "SERRA: REDUZA" },
    ...(lim.serraMeio ? [{ z: at(lim.serraMeio[0] - 20), type: "serra" as const, label: "CURVAS SINUOSAS" }] : []),
    { z: at(lim.mirante[0] - 30), type: "serra", label: "MIRANTE" },
    { z: at(iniDesc - 40), type: "serra", label: "DESCIDA: USE O FREIO MOTOR" },
  )
  avisar(eng, { icone: "⛰️", titulo: "SERRA", dica: "subida longa: segure a marcha", nivel: "info", z: at(0), fim: at(MONTANHA_SEGS) })
  return true
}

/** Um quadro: neblina no meio da serra; touge chamando no fim do mirante; fim. */
export function atualizarMontanha(eng: AutoDashEngine, playerZ: number) {
  const m = eng.montanha
  if (!m) return
  const N = eng.segments.length
  const idx = Math.floor(playerZ / SEG_LEN) % N
  const f = faseNoSeg(eng, idx)
  // neblina na altura da pista no meio da subida (passa aos poucos: setClima suave)
  eng.climaForcado = MONTANHA.neblinaNoMeio && f === "serraMeio" ? "neblina" : null
  // no mirante, o rival da serra chama para descer (o touge cobre a descida)
  if (f === "mirante" && !m.tougeFeito) {
    let fimMirante = 0
    for (const [ff, n] of m.fases) { fimMirante += n; if (ff === "mirante") break }
    const falta = ((m.a + fimMirante - idx) % N + N) % N
    if (falta < DRAW_DIST * 1.2 && !eng.touge) { spawnTouge(eng); m.tougeFeito = true }
  }
  // passou da base: a montanha fica na pista (o relevo é dela); na próxima volta
  // o rival chama de novo
  const d = ((idx - m.a) % N + N) % N
  if (d >= m.total && d < m.total + 50 && m.tougeFeito) {
    m.tougeFeito = false
    eng.floaters.push({ text: "VOCÊ ATRAVESSOU A SERRA", color: "#4ade80", y: H * 0.3, life: 2, big: false })
  }
}
