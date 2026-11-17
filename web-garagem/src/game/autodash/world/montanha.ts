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
//                comboios de caminhão; um banco de neblina no miolo; QUEDA DE
//                BARREIRAS (pedras na faixa do paredão) e CAMINHÃO QUEBRADO (na
//                faixa do vale), sempre numa faixa só e com placa antes; a
//                cachoeira respinga na tela quando você passa
//   MIRANTE      a mata abre, curva aberta, o mar aparece no fundo
//   DESCIDA      caracol: é aqui que o rival do touge chama
//   BASE         a descida amansa
//   COSTEIRA     rodovia beira-mar até a praia; no fim a região vira a costa
// Depois a pista religa no começo da volta (o relevo volta ao nível de lá).
import { type AutoDashEngine, type Seg, H, PLAYER_Z } from "../engine"
import type { ClimaId } from "./weather"
import { DRAW_DIST, SEG_LEN } from "../data"
import { avisar } from "./avisos"
import { hash01, gerarTrechos, tipoNoSeg, type TipoTrecho, type Trecho } from "./cenario"
import { spawnTouge } from "./touge"
import { spawnComboio, desfazer as desfazerComboio } from "./comboio"
import { trocarRegiao } from "./regiao"
import { abrirTunel, TUNEL } from "./tunel"
import { wrapDz } from "../traffic/spawner"
import { TRAFFIC_COLORS } from "../traffic/types"
import { PAREDAO } from "../render/cenario"

type Fases = [TipoTrecho, number][]
export const MONTANHA = {
  // [fase, segmentos] (~79 segmentos por segundo a 120 km/h)
  completa: [["portal", 200], ["serraPe", 400], ["serraMeio", 2800], ["mirante", 400], ["serraDescida", 1900], ["serraBase", 300], ["costeira", 1200]] as Fases,
  // tecla 0: subida curta e direto para o mirante e a descida do touge
  curta: [["portal", 120], ["serraPe", 300], ["mirante", 300], ["serraDescida", 1900], ["serraBase", 300], ["costeira", 600]] as Fases,
  altura: 44000,     // u no alto (a curta fica com um terço). Playtest 16/11: "a serra precisava subir mais" (era 26 mil)
  religa: 300,       // segmentos para voltar ao relevo do começo da volta
  comboioCadaS: 9,   // s entre comboios de caminhão na subida
  lateral: 2.6,      // curva das curvas longas da subida pela lateral
  caracol: 6.4,      // curva da descida (o touge reescreve a dele por cima)
  neblinaNoMeio: true,
}

// Playtest 16/11: "a serra precisava ter mais coisa caótica, mais emoção, sem
// ser mais difícil". Momentos da subida: cada um fecha UMA faixa só, tem placa
// e cartão de aviso antes e nasce perto (a 1,1 × a distância de desenho; carro
// parado muito à frente é removido pelo spawner).
export const MOMENTOS_SERRA = {
  // [fração da serraMeio, tipo]
  // (fora do túnel e do viaduto, que ficam entre 50% e ~66%)
  lista: [[0.22, "barreira"], [0.4, "caminhao"], [0.76, "barreira"], [0.9, "caminhao"]] as [number, TipoMomento][],
  nasceA: 1.1,            // × DRAW_DIST segmentos à frente do jogador
  placaAntes: 70,         // segmentos entre a placa e o começo do momento
  pedras: [0, 9, 19, 30], // segmentos de cada pedra desde o começo da barreira
  trianguloAntes: 2500,   // u entre o triângulo e o caminhão
  comboioFolga: 1500,     // u: comboio a menos disto de um momento na tela se desfaz
  respingoS: 1.4,         // s de respingo na tela ao passar pela cachoeira
}

/**
 * O túnel e o viaduto da subida (pesquisa: a pista de descida da Imigrantes tem
 * 21 km com 3 túneis, quase 40% do trajeto, e viadutos de até 70 m na neblina).
 * Na curva de ritmo da serra: depois da tensão da subida (caminhões, barreira),
 * o túnel é o respiro fechado, escuro, com eco; a saída é a REVELAÇÃO: um
 * viaduto alto sobre o vale, os dois lados caindo, dentro da neblina.
 */
export const TUNEL_SERRA = {
  em: 0.5,           // fração da serraMeio onde fica a boca do túnel
  viadutoSegs: 220,  // viaduto logo na saída (segmentos)
  nasceA: 1.9,       // × DRAW_DIST: o túnel é aberto a esta distância (as placas vêm antes)
  pilarCada: 25,     // segmentos entre os pilares do viaduto
}

export type TipoMomento = "barreira" | "caminhao"
/** Momento da subida: `idx` é o segmento absoluto onde ele começa. */
export interface MomentoSerra { idx: number; tipo: TipoMomento; feito: boolean }

/** Lado da encosta (fixo por viagem): o vale com guard-rail fica do outro. */
export function ladoParedao(eng: AutoDashEngine): -1 | 1 { return eng.montanha?.lado ?? -1 }

export interface Montanha {
  a: number; lado: -1 | 1; fases: Fases; total: number; tougeFeito: boolean; comboioT: number; praia: boolean; clima: ClimaId; momentos: MomentoSerra[]
  tunel: { a: number; b: number; aberto: boolean } | null // segmentos absolutos
  viaduto: { a: number; b: number } | null
}

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

/** No miolo da subida: onde fica o banco de neblina. */
export function noMiolo(eng: AutoDashEngine, idx: number): boolean {
  const m = eng.montanha
  if (!m) return false
  const l = limites(m.fases).serraMeio
  if (!l) return false
  // (entre 25% e 45% da subida: antes do túnel; dentro dele neblina não faz sentido)
  const d = idx - m.a, n = l[1] - l[0]
  return d >= l[0] + n * 0.25 && d < l[0] + n * 0.45
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

/** No viaduto da serra: o vale cai dos DOIS lados (sem paredão nem chão). */
export function noViadutoDaSerra(eng: AutoDashEngine, idx: number): boolean {
  const v = eng.montanha?.viaduto
  return !!v && idx >= v.a && idx < v.b
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
  const fimSubida = lim.mirante[0], [iniDesc] = lim.serraDescida
  // a descida amansa até a metade da costeira (com 44 mil u de altura, acabar na
  // base dava rampa de 15%; assim fica perto de 11% no pior ponto)
  const fimDesc = lim.costeira[0] + Math.floor((lim.costeira[1] - lim.costeira[0]) / 2)
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
  // os momentos da subida (nascem perto, em atualizarMontanha); a curta não tem serraMeio
  const momentos: MomentoSerra[] = lim.serraMeio
    ? MOMENTOS_SERRA.lista.map(([fr, tipo]) => ({ idx: a + lim.serraMeio[0] + Math.round((lim.serraMeio[1] - lim.serraMeio[0]) * fr), tipo, feito: false }))
    : []
  // o túnel atravessa a montanha no meio da subida e sai num viaduto alto
  let tunel: Montanha["tunel"] = null, viaduto: Montanha["viaduto"] = null
  if (lim.serraMeio) {
    const ta = a + lim.serraMeio[0] + Math.round((lim.serraMeio[1] - lim.serraMeio[0]) * TUNEL_SERRA.em)
    const tb = ta + Math.floor(TUNEL.comprimento / SEG_LEN)
    tunel = { a: ta, b: tb, aberto: false }
    viaduto = { a: tb + 4, b: tb + 4 + TUNEL_SERRA.viadutoSegs }
    // o viaduto é reto e de curvas suaves (viaduto de serra é obra de engenharia)
    for (let k = viaduto.a; k < viaduto.b; k++) eng.segments[k % N].curve *= 0.35
  }
  eng.montanha = { a, lado, fases, total, tougeFeito: false, comboioT: 3, praia: false, clima: eng.clima, momentos, tunel, viaduto }
  const at = (k: number) => ((a + k) % N) * SEG_LEN
  eng.roadSigns.push(
    { z: at(lim.portal[0] + 30), type: "serra", label: "SERRA DO MAR" },
    { z: at(lim.serraPe[0] + 40), type: "serra", label: "SERRA: REDUZA" },
    ...(lim.serraMeio ? [{ z: at(lim.serraMeio[0] + 20), type: "serra" as const, label: "SUBIDA LONGA: CAMINHÕES" }] : []),
    ...(viaduto ? [{ z: viaduto.a * SEG_LEN, type: "serra" as const, label: "VIADUTO: VENTO LATERAL" }] : []),
    { z: at(lim.mirante[0] - 30), type: "serra", label: "MIRANTE" },
    { z: at(iniDesc - 40), type: "serra", label: "DESCIDA: USE O FREIO MOTOR" },
    { z: at(lim.costeira[0] + 20), type: "serra", label: "RODOVIA DO MAR" },
  )
  avisar(eng, { icone: "⛰️", titulo: "SERRA DO MAR", dica: "subida longa pela montanha", nivel: "info", z: at(0), fim: at(lim.mirante[0]) })
  return true
}

/**
 * A serra acabou (praia, troca de região ou nova serra): guarda onde ela ficou na
 * volta para aplanar depois. A viagem fica DENTRO da volta (segmentos `a` a
 * `a + total`), então sem isto a próxima passada pelo mesmo trecho subia a montanha
 * de novo, com o cenário da praia ou da cidade flutuando no morro e sem paredão
 * (playtest 17/11: "depois de sair da serra o terreno fica todo bugado").
 */
export function esquecerMontanha(eng: AutoDashEngine) {
  if (eng.montanha) eng.serraPassada = { a: eng.montanha.a, total: eng.montanha.total }
  eng.montanha = null
}

/**
 * Aplana o relevo e as curvas da serra que já passou, assim que o jogador está
 * fora dela e ela não aparece na tela (nem à frente: depois da volta, longe). Tira
 * também o que ficou na pista (pedras, placas, nitros).
 */
export function aplanarSerraPassada(eng: AutoDashEngine) {
  const v = eng.serraPassada
  if (!v) return
  const N = eng.segments.length
  if (v.a < 1 || v.a + v.total > N) { eng.serraPassada = null; return } // a volta mudou: não é mais esse trecho
  const idx = Math.floor((eng.position + PLAYER_Z) / SEG_LEN) % N
  if (idx >= v.a && idx < v.a + v.total) return // ainda dentro
  const ate = v.a - idx // segmentos até a entrada, à frente do jogador
  if (ate > 0 && ate < DRAW_DIST + 30) return // a entrada está quase na tela
  const y0 = eng.segments[v.a].y1
  for (let k = 0; k < v.total; k++) {
    const s = eng.segments[v.a + k]
    const borda = Math.min(1, k / 40, (v.total - k) / 40)
    s.y1 = y0; s.y2 = y0
    s.curve = Math.sin(k / 150) * 1.4 * borda // curvas abertas, como a costeira
    s.sign = undefined
  }
  const z0 = v.a * SEG_LEN, z1 = (v.a + v.total) * SEG_LEN
  const dentro = (z: number) => z >= z0 && z < z1
  eng.obstacles = eng.obstacles.filter(o => !dentro(o.z))
  eng.roadSigns = eng.roadSigns.filter(s => !dentro(s.z))
  eng.powerups = eng.powerups.filter(p => !dentro(p.z))
  eng.serraPassada = null
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
  // clima fixo na viagem toda (playtest 16/11: "o clima muda sozinho"): o que
  // estava valendo na entrada da serra (passando o portal, a neblina sumia: a
  // viagem forçava céu limpo), e um banco de neblina no miolo da subida
  // (e no viaduto da saída do túnel: "viadutos de 70 m na neblina")
  const v = m.viaduto
  const naNevoaDoViaduto = !!v && idx >= v.a - 60 && idx < v.b + 40
  eng.climaForcado = MONTANHA.neblinaNoMeio && (noMiolo(eng, idx) || naNevoaDoViaduto) ? "neblina" : m.clima
  // o túnel abre quando chega perto (as placas ficam antes da boca)
  const t = m.tunel
  if (t && !t.aberto && t.a - idx < DRAW_DIST * TUNEL_SERRA.nasceA) {
    t.aberto = true
    if (t.a - idx > DRAW_DIST * 1.02) abrirTunel(eng, t.a * SEG_LEN)
  }
  // os momentos da subida nascem quando chegam perto
  for (const mo of m.momentos) {
    if (mo.feito) continue
    const d = mo.idx - idx
    if (d > DRAW_DIST * MOMENTOS_SERRA.nasceA) continue
    mo.feito = true
    if (d <= 0) continue // passou direto (pulo de posição): não nasce atrás
    if (mo.tipo === "barreira") quedaDeBarreiras(eng, mo.idx)
    else caminhaoQuebrado(eng, mo.idx)
  }
  liberarFaixaDosMomentos(eng, playerZ)
  // passando pela cachoeira, o vento joga água na tela (render/serra.ts)
  eng.respingoT = Math.max(0, eng.respingoT - dt)
  if ((f === "serraMeio" || f === "serraDescida") && idx % PAREDAO.cachoeiraCada < 4) eng.respingoT = MOMENTOS_SERRA.respingoS
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

/** Faixa colada ao paredão (barreira) ou ao vale (caminhão). */
export function faixaDoMomento(eng: AutoDashEngine, tipo: TipoMomento): number {
  const lado = ladoParedao(eng)
  return tipo === "barreira" ? lado * 0.75 : -lado * 0.75
}

/** Pedras caídas na faixa do paredão, espalhadas; perdoáveis como cone (só tranco). */
function quedaDeBarreiras(eng: AutoDashEngine, idx: number) {
  const N = eng.segments.length
  const at = (k: number) => ((((idx + k) % N) + N) % N) * SEG_LEN
  const lado = ladoParedao(eng), faixa = faixaDoMomento(eng, "barreira")
  for (const [i, k] of MOMENTOS_SERRA.pedras.entries()) {
    // um pouco de variação dentro da faixa (a faixa tem 0,5 de largura)
    const off = faixa + (hash01(idx, 40 + i) - 0.5) * 0.12
    eng.obstacles.push({ z: at(k), offset: off, kind: "cone", visual: "pedra", w: 0.13 + hash01(idx, 50 + i) * 0.05, len: 90, lado })
  }
  // cascalho espalhado e um pedregulho maior no pé do paredão (só cenário)
  eng.obstacles.push({ z: at(4), offset: lado * 0.62, kind: "cena", visual: "detritos", w: 0.3, len: 60, lado })
  eng.obstacles.push({ z: at(14), offset: lado * 1.08, kind: "cena", visual: "pedra", w: 0.26, len: 60, lado })
  eng.roadSigns.push({ z: at(-MOMENTOS_SERRA.placaAntes), type: "serra", label: "QUEDA DE BARREIRAS" })
  const ultima = MOMENTOS_SERRA.pedras[MOMENTOS_SERRA.pedras.length - 1]
  avisar(eng, { icone: "🪨", titulo: "QUEDA DE BARREIRAS", dica: `pedras à ${lado > 0 ? "direita" : "esquerda"}: desvie`, nivel: "perigo", z: at(0), fim: at(ultima) })
}

/** Caminhão quebrado com pisca-alerta na faixa do vale, triângulo antes. */
function caminhaoQuebrado(eng: AutoDashEngine, idx: number) {
  const N = eng.segments.length
  const at = (k: number) => ((((idx + k) % N) + N) % N) * SEG_LEN
  const z = at(0), faixa = faixaDoMomento(eng, "caminhao"), lado = Math.sign(faixa)
  eng.traffic.push({
    z, offset: faixa, targetOffset: faixa, speed: 0,
    kind: "truck", role: "civilian", parked: true, alerta: true,
    color: TRAFFIC_COLORS[Math.floor(hash01(idx, 60) * TRAFFIC_COLORS.length)],
    blinkT: 0, prevD: wrapDz(eng, z, eng.position + PLAYER_Z),
  })
  const zt = ((z - MOMENTOS_SERRA.trianguloAntes) % eng.trackLen + eng.trackLen) % eng.trackLen
  eng.obstacles.push({ z: zt, offset: faixa, kind: "cena", visual: "triangulo", w: 0.1, len: 40, lado })
  eng.roadSigns.push({ z: at(-MOMENTOS_SERRA.placaAntes), type: "serra", label: "VEÍCULO PARADO" })
  avisar(eng, { icone: "🚚", titulo: "VEÍCULO PARADO", dica: `caminhão à ${lado > 0 ? "direita" : "esquerda"}: desvie`, nivel: "perigo", z })
}

/**
 * O trânsito civil sai da faixa fechada antes de chegar no momento (senão
 * atravessava as pedras e o caminhão): vai para a faixa vizinha, de dentro.
 * Comboio em cima de um momento na tela se desfaz.
 */
function liberarFaixaDosMomentos(eng: AutoDashEngine, playerZ: number) {
  const m = eng.montanha
  if (!m) return
  for (const mo of m.momentos) {
    if (!mo.feito) continue
    const z0 = mo.idx * SEG_LEN
    const comp = mo.tipo === "barreira" ? MOMENTOS_SERRA.pedras[MOMENTOS_SERRA.pedras.length - 1] * SEG_LEN : 0
    if (wrapDz(eng, z0 + comp, playerZ) < -40 * SEG_LEN) continue // já ficou para trás
    // comboio passando no momento que está na tela: se desfaz (três faixas
    // fechadas mais a do momento seria parede; não pode ficar mais difícil)
    const folga = MOMENTOS_SERRA.comboioFolga
    if (eng.comboio && wrapDz(eng, z0, playerZ) < DRAW_DIST * SEG_LEN
      && eng.comboio.membros.some(t => { const d = wrapDz(eng, t.z, z0); return d > -folga && d < comp + folga })) desfazerComboio(eng)
    const faixa = faixaDoMomento(eng, mo.tipo), dentro = faixa - Math.sign(faixa) * 0.5
    for (const t of eng.traffic) {
      if (t.role !== "civilian" || t.parked || Math.abs(t.targetOffset - faixa) > 0.3) continue
      const d = wrapDz(eng, z0, t.z) // >0: o momento está à frente do carro
      if (d < -comp - 400 || d > 9000) continue
      t.targetOffset = dentro; t.blinkT = Math.max(t.blinkT, 0.6)
    }
  }
}
