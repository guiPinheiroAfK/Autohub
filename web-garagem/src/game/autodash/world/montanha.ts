// AutoDash — world/montanha.ts. A SERRA como viagem (playtest 16/11; doc
// docs/specs/autodash/MONTANHA-COSTA-PRAIA.md): "um caminho extenso até em cima,
// pique de rodovia subindo a lateral de uma montanha, depois a serra descendo e,
// lá embaixo, uma rodovia do lado do mar caindo na praia".
//
// Chegando na serra, a pista ALÉM DO HORIZONTE é trocada pela viagem (a volta
// cresce para caber; o que está na tela e atrás não muda):
//   PORTAL       arco de pedra "SERRA DO MAR", a subida começa devagar
//   PÉ           curvas suaves, a mata fecha
//   SUBIDA       rodovia longa pela lateral da montanha: a encosta (paredão,
//                cachoeira) de um lado, o VALE caindo do outro com guard-rail;
//                comboios de caminhão; um banco de neblina no miolo
//   MIRANTE      a mata abre, curva aberta, o mar aparece no fundo
//   DESCIDA      caracol: é aqui que o rival do touge chama
//   BASE         a descida amansa
//   COSTEIRA     rodovia beira-mar até a praia; no fim a região vira a costa
// Depois a pista religa no começo da volta (o relevo volta ao nível de lá).
import { type AutoDashEngine, type Seg, H } from "../engine"
import { DRAW_DIST, SEG_LEN } from "../data"
import { avisar } from "./avisos"
import { hash01, gerarTrechos, tipoNoSeg, type TipoTrecho, type Trecho } from "./cenario"
import { spawnTouge } from "./touge"
import { spawnComboio } from "./comboio"
import { trocarRegiao } from "./regiao"

type Fases = [TipoTrecho, number][]
export const MONTANHA = {
  // [fase, segmentos] (~79 segmentos por segundo a 120 km/h)
  completa: [["portal", 200], ["serraPe", 400], ["serraMeio", 2800], ["mirante", 400], ["serraDescida", 1300], ["serraBase", 300], ["costeira", 1200]] as Fases,
  // tecla 0: subida curta e direto para o mirante e a descida do touge
  curta: [["portal", 120], ["serraPe", 300], ["mirante", 300], ["serraDescida", 1300], ["serraBase", 300], ["costeira", 600]] as Fases,
  altura: 26000,     // u no alto (a curta fica com um terço)
  religa: 300,       // segmentos para voltar ao relevo do começo da volta
  comboioCadaS: 9,   // s entre comboios de caminhão na subida
  lateral: 2.6,      // curva das curvas longas da subida pela lateral
  caracol: 6.4,      // curva da descida (o touge reescreve a dele por cima)
  neblinaNoMeio: true,
}

/** Lado da encosta (fixo por viagem): o vale com guard-rail fica do outro. */
export function ladoParedao(eng: AutoDashEngine): -1 | 1 { return eng.montanha?.lado ?? -1 }

export interface Montanha { a: number; lado: -1 | 1; fases: Fases; total: number; tougeFeito: boolean; comboioT: number; praia: boolean }

/** Início (em segmentos desde `a`) e fim de cada fase. */
function limites(fases: Fases): Record<string, [number, number]> {
  const lim: Record<string, [number, number]> = {}
  let acc = 0
  for (const [f, n] of fases) { lim[f] = [acc, acc + n]; acc += n }
  return lim
}

/** Fase da viagem no segmento `idx` (null fora dela). */
export function faseNoSeg(eng: AutoDashEngine, idx: number): TipoTrecho | null {
  const m = eng.montanha
  if (!m) return null
  const d = idx - m.a
  if (d < 0) return null
  let acc = 0
  for (const [f, n] of m.fases) { if (d < acc + n) return f; acc += n }
  return null
}

/** No miolo do meio da subida (o terço do meio): onde fica o banco de neblina. */
export function noMiolo(eng: AutoDashEngine, idx: number): boolean {
  const m = eng.montanha
  if (!m) return false
  const l = limites(m.fases).serraMeio
  if (!l) return false
  const d = idx - m.a, n = l[1] - l[0]
  return d >= l[0] + n / 3 && d < l[0] + (2 * n) / 3
}

/** O jogador está na viagem ou a até 2 distâncias de desenho antes dela? */
export function pertoDaMontanha(eng: AutoDashEngine, idx: number): boolean {
  const m = eng.montanha
  if (!m) return false
  const d = idx - m.a
  return d >= -2 * DRAW_DIST && d < m.total
}

/** Lado do vale neste segmento (0: sem vale). A subida pela lateral tem vale do lado de fora. */
export function ladoDoVale(eng: AutoDashEngine, idx: number): -1 | 0 | 1 {
  const f = faseNoSeg(eng, idx)
  return f === "serraMeio" || f === "serraPe" ? (-ladoParedao(eng) as -1 | 1) : 0
}

/**
 * Troca a pista além do horizonte pela viagem da serra. A volta cresce (ou
 * encolhe) para caber; o que está na tela e atrás fica igual. Devolve false se
 * não deu agora (perto do fim da volta: tenta de novo depois).
 */
export function spawnMontanha(eng: AutoDashEngine, curta = false): boolean {
  if (eng.montanha || eng.mode !== "solo") return false
  const N0 = eng.segments.length
  const base = Math.floor(eng.position / SEG_LEN) % N0
  const a = base + DRAW_DIST + 20
  if (a >= N0 - 1) return false
  const fases = curta ? MONTANHA.curta : MONTANHA.completa
  const total = fases.reduce((s, [, n]) => s + n, 0)
  const lim = limites(fases)
  const lado: -1 | 1 = hash01(a, 5) < 0.5 ? -1 : 1
  const altura = curta ? MONTANHA.altura / 3 : MONTANHA.altura
  const fimSubida = lim.mirante[0], [iniDesc] = lim.serraDescida, [, fimDesc] = lim.serraBase
  const suave = (t: number) => t * t * (3 - 2 * t)
  // relevo da viagem, somado ao nível em que a pista estava no começo dela
  const P = (k: number) => {
    if (k <= lim.portal[0]) return 0
    if (k < fimSubida) return altura * suave((k - lim.portal[0]) / (fimSubida - lim.portal[0]))
    if (k < iniDesc) return altura
    if (k < fimDesc) return altura * (1 - suave((k - iniDesc) / (fimDesc - iniDesc)))
    return 0
  }
  // corta a volta logo depois do horizonte e monta a viagem ali
  const y0 = eng.segments[a - 1].y2
  eng.segments.length = a
  const novo = (curve: number, y1: number, y2: number): Seg => ({ curve, y1, y2 })
  for (let k = 0; k < total; k++) {
    const f = fases.find(([ff]) => k >= lim[ff][0] && k < lim[ff][1])![0]
    const kk = k - lim[f][0], n = lim[f][1] - lim[f][0]
    const borda = Math.min(1, kk / 40, (n - kk) / 40)
    let c = 0
    if (f === "portal") c = 0
    else if (f === "serraPe") c = Math.sin(kk / 70) * 2 * borda
    else if (f === "serraMeio") {
      // rodovia pela lateral: curvas longas para o lado da montanha e de volta,
      // e de vez em quando um cotovelo mais fechado
      const cotovelo = Math.sin(kk / 260) > 0.92 ? 1.8 : 1
      c = Math.sin(kk / 120) * MONTANHA.lateral * cotovelo * borda
    } else if (f === "mirante") c = 1.6 * -lado * borda
    else if (f === "serraDescida") c = Math.sign(Math.sin(kk / 45)) * MONTANHA.caracol * Math.min(1, Math.abs(Math.sin(kk / 45)) * 3)
    else if (f === "serraBase") c = Math.sin(kk / 80) * 2 * borda
    else c = Math.sin(kk / 150) * 1.4 * borda // costeira: curvas abertas beira-mar
    eng.segments.push(novo(c, y0 + P(k), y0 + P(k + 1)))
  }
  // religa no relevo do começo da volta
  const yFim = y0, yVolta = eng.segments[0].y1
  for (let k = 0; k < MONTANHA.religa; k++) {
    const t0 = k / MONTANHA.religa, t1 = (k + 1) / MONTANHA.religa
    eng.segments.push(novo(0, yFim + (yVolta - yFim) * suave(t0), yFim + (yVolta - yFim) * suave(t1)))
  }
  const N = eng.segments.length
  eng.trackLen = N * SEG_LEN
  // o que estava além do horizonte (trânsito, eventos, placas) ia para a pista velha
  const corte = a * SEG_LEN
  eng.traffic = eng.traffic.filter(t => t.z < corte)
  eng.obstacles = eng.obstacles.filter(o => o.z < corte)
  eng.powerups = eng.powerups.filter(p => p.z < corte)
  eng.roadSigns = eng.roadSigns.filter(s => s.z < corte)
  eng.zones = eng.zones.filter(z => z.z < corte && z.end < corte && z.end >= z.z)
  eng.ramais = eng.ramais.filter(r => r.b < a)
  if (eng.comboio && eng.comboio.membros.some(t => !eng.traffic.includes(t))) eng.comboio = null
  if (eng.racha && !eng.traffic.includes(eng.racha.rival)) eng.racha = null
  // cenário: o que está na tela fica; a viagem por cima; o resto do bioma
  const tipoAqui = tipoNoSeg(eng.cenario, base)
  const tr: Trecho[] = [{ a: base, b: a, tipo: tipoAqui }]
  for (const [f] of fases) tr.push({ a: a + lim[f][0], b: a + lim[f][1], tipo: f })
  eng.cenario = [...tr, ...gerarTrechos(N, eng.pistaSeed, eng.bioma.id)]
  eng.montanha = { a, lado, fases, total, tougeFeito: false, comboioT: 3, praia: false }
  const at = (k: number) => ((a + k) % N) * SEG_LEN
  eng.roadSigns.push(
    { z: at(lim.portal[0] + 30), type: "serra", label: "SERRA DO MAR" },
    { z: at(lim.serraPe[0] + 40), type: "serra", label: "SERRA: REDUZA" },
    ...(lim.serraMeio ? [{ z: at(lim.serraMeio[0] + 20), type: "serra" as const, label: "SUBIDA LONGA: CAMINHÕES" }] : []),
    { z: at(lim.mirante[0] - 30), type: "serra", label: "MIRANTE" },
    { z: at(iniDesc - 40), type: "serra", label: "DESCIDA: USE O FREIO MOTOR" },
    { z: at(lim.costeira[0] + 20), type: "serra", label: "RODOVIA DO MAR" },
  )
  avisar(eng, { icone: "⛰️", titulo: "SERRA DO MAR", dica: "subida longa pela montanha", nivel: "info", z: at(0), fim: at(lim.mirante[0]) })
  return true
}

/** Segmento do portal da serra (arco de pedra sobre a pista), ou -1. */
export function segPortal(eng: AutoDashEngine): number {
  const m = eng.montanha
  return m ? m.a + 60 : -1
}

/** Um quadro: clima, comboios, o rival no mirante e a chegada na praia. */
export function atualizarMontanha(eng: AutoDashEngine, playerZ: number, dt = 0) {
  const m = eng.montanha
  if (!m) return
  const N = eng.segments.length
  const idx = Math.floor(playerZ / SEG_LEN) % N
  const f = faseNoSeg(eng, idx)
  // clima fixo na viagem toda (playtest 16/11: "o clima muda sozinho"): céu
  // limpo, e um banco de neblina só no miolo da subida (entra e sai devagar)
  eng.climaForcado = f ? (MONTANHA.neblinaNoMeio && noMiolo(eng, idx) ? "neblina" : "limpo") : null
  // a subida é de caminhão: comboio atrás de comboio
  if (f === "serraMeio" && !eng.comboio) {
    m.comboioT -= dt
    if (m.comboioT <= 0) { spawnComboio(eng, eng.rngEv); m.comboioT = MONTANHA.comboioCadaS }
  }
  // no fim do mirante, o rival da serra chama para descer (o touge cobre a descida)
  if (f === "mirante" && !m.tougeFeito) {
    const fimMirante = m.a + limites(m.fases).mirante[1]
    if (fimMirante - idx < DRAW_DIST * 1.2 && !eng.touge) { spawnTouge(eng); m.tougeFeito = true }
  }
  // fim da costeira: chegou na praia (a região vira a costa)
  const fimCosteira = m.a + limites(m.fases).costeira[1]
  if (!m.praia && idx >= fimCosteira - DRAW_DIST && idx < fimCosteira + 50) {
    m.praia = true
    eng.floaters.push({ text: "BEM-VINDO À PRAIA", color: "#fbbf24", y: H * 0.3, life: 2.4, big: true })
    trocarRegiao(eng, "costa", false)
  }
}
