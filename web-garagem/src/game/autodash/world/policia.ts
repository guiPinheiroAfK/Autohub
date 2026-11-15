// AutoDash — world/policia.ts. Polícia por estrelas (Fase 6 do GUIA-V2).
//
// O nível de procurado é um CALOR de 0 a 5,99; as estrelas são a parte
// inteira. Infração e tempo de perseguição esquentam; despistar (ninguém te vê
// por alguns segundos) encerra a caçada e o calor esfria uma estrela por vez.
// Tudo que é número de jogo mora nas tabelas ESTRELAS e INFRACOES.
//
// As viaturas continuam sendo tráfego com a IA PoliceDriver (ADR 0008); aqui só
// se decide QUANTAS existem e com que teto e arrancada elas andam.
import { AutoDashEngine, H, W, PLAYER_Z } from "../engine"
import { CARS, DRAW_DIST, SEG_LEN, KMH2UPS } from "../data"
import { burst } from "../fx/particles"
import { wrapDz } from "../traffic/spawner"
import { type Traffic } from "../traffic/types"
import { clamp } from "../math"

export interface NivelEstrela {
  viaturas: number   // viaturas em perseguição neste nível
  teto: number       // km/h, teto da viatura (antes do limite do carro)
  arrancada: number  // km/h por segundo
  despisteS: number  // segundos sem ser visto para despistar
  eventos: readonly EventoPolicia[] // eventos da estrela, em rodízio
  eventoCadaS: number // intervalo entre eventos (s)
  helicoptero: boolean // E13: helicóptero com holofote
}

/** Eventos lançados à frente durante a caçada (pesquisa visual 4.5). */
export type EventoPolicia = "pregos" | "bloqueio"

/** Uma linha por estrela (índice 0 = ★). Fonte: GUIA-V2, Fase 6. */
export const ESTRELAS: readonly NivelEstrela[] = [
  { viaturas: 1, teto: 205, arrancada: 50, despisteS: 3, eventos: [], eventoCadaS: 0, helicoptero: false },
  { viaturas: 2, teto: 215, arrancada: 55, despisteS: 4, eventos: [], eventoCadaS: 0, helicoptero: false },
  { viaturas: 3, teto: 222, arrancada: 60, despisteS: 5, eventos: ["pregos"], eventoCadaS: 22, helicoptero: false },
  { viaturas: 4, teto: 228, arrancada: 65, despisteS: 6, eventos: ["bloqueio", "pregos"], eventoCadaS: 20, helicoptero: false },
  { viaturas: 4, teto: 234, arrancada: 70, despisteS: 7, eventos: ["bloqueio", "pregos"], eventoCadaS: 18, helicoptero: true },
]

export type Infracao = "radar" | "blitz" | "encostao" | "bloqueio" | "debug"
/** Calor somado por infração (1 = uma estrela). */
export const INFRACOES: Record<Infracao, number> = {
  radar: 1,
  blitz: 2,
  encostao: 0.25,
  bloqueio: 0.5, // furou o bloqueio (fresta ou acostamento)
  debug: 1,      // tecla O
}

export const MAX_CALOR = 5.99
export const VISAO = 10000          // u: viatura mais perto que isso te vê
export const SOBE_POR_TEMPO_S = 30  // s sendo visto para ganhar uma estrela
export const AQUECIMENTO_S = 6      // s iniciais em que não dá para despistar
export const ESFRIA_S = 8           // s por estrela no esfriamento depois do despiste
export const MARGEM_FUGA = 8        // km/h: a viatura nunca alcança o teto do carro
export const BONUS_DESPISTE = 1500  // pontos por estrela ao despistar
export const PRIMEIRO_EVENTO_S = 6  // s até o primeiro evento de uma estrela com eventos
export const PNEU_FURADO_S = 8      // E8: duração do pneu furado
export const FURADO_TETO = 0.75     // fração do topSpeed com o pneu furado
export const FURADO_GRIP = 0.8      // aderência da direção com o pneu furado
export const FURADO_FREIO = 90      // km/h/s: como o carro cai até o teto do furado
export const BONUS_FRESTA = 2500    // E10: passar na fresta do bloqueio
export const HELI_TETO = 230        // E13: km/h do helicóptero (antes do limite do carro)
export const HELI_MARGEM = 10       // km/h: o helicóptero nunca alcança o teto do carro
export const HELI_ALVO = 1000       // u: o holofote mira logo à frente do carro (cai no capô)
export const HOLOFOTE_Z = 1600      // u: meia-profundidade do círculo de luz
export const HOLOFOTE_X = 0.42      // meia-largura do círculo (fração da meia-pista)
export const HELI_CEGO_S = 4        // s sem te ver depois de passar embaixo do viaduto

export interface Procurado {
  calor: number     // 0..MAX_CALOR
  visto: boolean    // alguém te vê neste quadro
  esfriaT: number   // s até perder a próxima estrela (só sem perseguição)
  sirene: number    // 0..1, viatura mais perto (gancho para o som; ver GUIA)
  eventoT: number   // s até o próximo evento da estrela
  eventoIdx: number // rodízio dos eventos da estrela
  furadoT: number   // E8: s de pneu furado restantes
  faiscaT: number   // E8: s até a próxima faísca do aro
  ladoFurado: number // -1 ou 1: de que lado sai a faísca
  testeLargou: boolean // teste de polícia: a caçada inicial já foi chamada
  bloqueios: Bloqueio[] // E10: bloqueios à frente (para o bônus da fresta)
  heli: Heli | null // E13: helicóptero (só em 5★)
  holofote: boolean // E13: o carro está dentro do círculo de luz
}

/** z e x são do PONTO DE LUZ no asfalto; o helicóptero voa sobre ele. */
export interface Heli { z: number; x: number; v: number; cegoT: number }

export interface Bloqueio { z: number; fresta: number; checado: boolean }

export function novoProcurado(): Procurado {
  return {
    calor: 0, visto: false, esfriaT: 0, sirene: 0,
    eventoT: PRIMEIRO_EVENTO_S, eventoIdx: 0, furadoT: 0, faiscaT: 0, ladoFurado: 1,
    bloqueios: [], heli: null, holofote: false, testeLargou: false,
  }
}

/** Estrelas (0..5) de um calor. */
export function estrelasDe(calor: number): number {
  return clamp(Math.floor(calor), 0, 5)
}

/** Linha da tabela para um número de estrelas (null em 0★). */
export function nivelDe(estrelas: number): NivelEstrela | null {
  return estrelas >= 1 ? ESTRELAS[Math.min(estrelas, 5) - 1] : null
}

/** Teto da viatura: o da estrela, mas sempre abaixo do carro (fuga honesta, ADR 0008). */
export function tetoViatura(nivel: NivelEstrela, topCarro: number): number {
  return Math.min(nivel.teto, topCarro - MARGEM_FUGA)
}

/** Soma o calor de uma infração, sem passar do máximo. */
export function somarCalor(calor: number, inf: Infracao): number {
  return Math.min(MAX_CALOR, calor + INFRACOES[inf])
}

const ehViatura = (t: Traffic) => t.role === "police" && !t.parked

function anunciarEstrelas(eng: AutoDashEngine, n: number) {
  // estrela nova substitui o anúncio anterior (subidas seguidas não se empilham)
  eng.floaters = eng.floaters.filter(f => !f.text.endsWith("PROCURADO"))
  eng.floaters.push({ text: `${"★".repeat(n)}  PROCURADO`, color: "#f87171", y: H * 0.26, life: 2.2, big: true })
}

/** Ajusta teto e arrancada das viaturas e chama reforço por trás até o número da estrela. */
function aplicarNivel(eng: AutoDashEngine, estrelas: number) {
  const nivel = nivelDe(estrelas)
  if (!nivel) return
  const top = tetoViatura(nivel, CARS[eng.cfg.carIdx].topSpeed)
  let n = 0
  for (const t of eng.traffic) {
    if (!ehViatura(t)) continue
    t.top = top; t.accel = nivel.arrancada
    n++
  }
  const lanes = [-0.5, 0, 0.5]
  for (let i = n; i < nivel.viaturas; i++) {
    // ATRÁS, escalonadas: vêm te alcançar. Nunca nascem na frente (sem teleporte).
    const behind = 2500 + (i - n) * 1200
    const z = ((eng.position - behind) % eng.trackLen + eng.trackLen) % eng.trackLen
    eng.traffic.push({
      z, offset: lanes[i % 3], targetOffset: lanes[i % 3],
      speed: clamp(eng.speed, 150, top), kind: "police", role: "police",
      color: "#1d4ed8", blinkT: 0, prevD: wrapDz(eng, z, eng.position + PLAYER_Z),
      top, accel: nivel.arrancada,
    })
  }
}

/** Infração: esquenta, reabre a caçada (se esfriando) e chama as viaturas da estrela. */
export function infracao(eng: AutoDashEngine, inf: Infracao) {
  const p = eng.policia
  const antes = estrelasDe(p.calor)
  const perseguindo = eng.traffic.some(ehViatura)
  p.calor = somarCalor(p.calor, inf)
  p.esfriaT = 0
  const depois = estrelasDe(p.calor)
  if (!perseguindo) {
    eng.policeChaseT = 0
    eng.policeEscapeT = 0
    eng.floaters.push({ text: "🚓 PERSEGUIÇÃO!", color: "#60a5fa", y: H * 0.34, life: 2, big: true })
    eng.audio.horn()
  }
  if (depois > antes) anunciarEstrelas(eng, depois)
  if (!perseguindo || depois > antes) aplicarNivel(eng, depois)
}

/** Um quadro da polícia: calor por tempo, despiste, esfriamento e sirene. */
export function atualizarPolicia(eng: AutoDashEngine, dt: number, playerZ: number) {
  const p = eng.policia
  // teste de polícia (garagem → L): já larga perseguido em 1★
  if (eng.testePolicia && !p.testeLargou) { p.testeLargou = true; definirEstrelas(eng, 1) }
  if (p.furadoT > 0) passoPneuFurado(eng, dt)
  if (p.bloqueios.length) passoBloqueios(eng, playerZ)
  let nearest = Infinity
  let viaturas = 0
  let anyBackoff = false
  for (const t of eng.traffic) {
    if (!ehViatura(t)) continue
    viaturas++
    if (t.backoffT && t.backoffT > 0) anyBackoff = true
    nearest = Math.min(nearest, Math.abs(wrapDz(eng, t.z, playerZ)))
  }
  p.sirene = viaturas ? clamp(1 - nearest / 12000, 0, 1) : 0

  if (!viaturas) {
    p.visto = false
    p.heli = null
    p.holofote = false
    eng.policeEscapeT = 0
    eng.policeChaseT = 0
    // esfriamento: sem caçada, perde uma estrela a cada ESFRIA_S
    if (p.calor > 0) {
      p.esfriaT -= dt
      if (p.esfriaT <= 0) {
        p.calor = Math.max(0, Math.ceil(p.calor) - 1)
        p.esfriaT = p.calor > 0 ? ESFRIA_S : 0
      }
    }
    return
  }

  eng.policeChaseT += dt
  // E13: em 5★ o helicóptero chega por trás; dentro do holofote você é visto
  if (nivelDe(estrelasDe(p.calor))?.helicoptero && !p.heli) {
    p.heli = { z: ((playerZ - 2500) % eng.trackLen + eng.trackLen) % eng.trackLen, x: eng.playerX, v: Math.max(150, eng.speed), cegoT: 0 }
    eng.floaters.push({ text: "🚁 HELICÓPTERO!", color: "#fde047", y: H * 0.3, life: 2, big: true })
  }
  p.holofote = p.heli ? passoHeli(eng, dt, playerZ) : false
  p.visto = nearest <= VISAO || p.holofote
  // sendo visto, a caçada esquenta com o tempo (no teste, só as teclas mudam a estrela)
  if (p.visto && !eng.testePolicia) {
    const antes = estrelasDe(p.calor)
    p.calor = Math.min(MAX_CALOR, p.calor + dt / SOBE_POR_TEMPO_S)
    const depois = estrelasDe(p.calor)
    if (depois > antes) { anunciarEstrelas(eng, depois); aplicarNivel(eng, depois) }
  }
  const nivel = nivelDe(estrelasDe(p.calor)) ?? ESTRELAS[0]
  // eventos da estrela, à frente e além do horizonte (nunca no para-brisa)
  if (nivel.eventos.length) {
    p.eventoT -= dt
    if (p.eventoT <= 0) {
      // não empilha com evento de mapa em andamento (ponte, mão dupla, blitz...)
      if (eng.zones.some(z => wrapDz(eng, z.end, playerZ) > 0)) p.eventoT = 4
      else {
        const ev = nivel.eventos[p.eventoIdx++ % nivel.eventos.length]
        p.eventoT = nivel.eventoCadaS
        if (ev === "pregos") lancarPregos(eng, estrelasDe(p.calor) >= 4 ? 3 : 2)
        else lancarBloqueio(eng)
      }
    }
  }
  // aquecimento: nos primeiros segundos a caçada não pode ser despistada.
  // Recuo pós-encostão também não conta: elas aliviaram, você não escapou.
  if (!p.visto && !anyBackoff && eng.policeChaseT > AQUECIMENTO_S) {
    eng.policeEscapeT += dt
    if (eng.policeEscapeT >= nivel.despisteS) despistar(eng)
  } else {
    eng.policeEscapeT = Math.max(0, eng.policeEscapeT - dt * 0.5)
  }
}

/** Despiste: viaturas desistem, pontos pela estrela, o calor começa a esfriar. */
function despistar(eng: AutoDashEngine) {
  const p = eng.policia
  const n = Math.max(1, estrelasDe(p.calor))
  // some já (a poda do fim do updateTraffic rodou antes, neste quadro)
  eng.traffic = eng.traffic.filter(t => !ehViatura(t))
  const pts = BONUS_DESPISTE * n
  eng.score += pts
  eng.floaters.push({ text: "DESPISTOU A POLÍCIA! 🚔💨", color: "#4ade80", y: H * 0.34, life: 2.4, big: true })
  eng.floaters.push({ text: `+${pts}`, color: "#4ade80", y: H * 0.41, life: 2, big: false })
  eng.audio.levelUp()
  eng.policeEscapeT = 0
  p.calor = n // perde o progresso fracionário
  p.esfriaT = ESFRIA_S
  p.visto = false
  p.heli = null
  p.holofote = false
}

// ---------- eventos por estrela ----------

const VIEW = DRAW_DIST * SEG_LEN // o que cabe na tela
const START = VIEW * 1.7         // onde o evento nasce (mesma regra de world/events.ts)

function noTracado(eng: AutoDashEngine, d: number) {
  return ((eng.position + d) % eng.trackLen + eng.trackLen) % eng.trackLen
}

/** Trinca de placas de polícia entrando em cena antes do perigo. */
function placas(eng: AutoDashEngine, labels: [string, string, string]) {
  eng.roadSigns.push(
    { z: noTracado(eng, START - VIEW * 0.95), type: "policia", label: labels[0] },
    { z: noTracado(eng, START - VIEW * 0.60), type: "policia", label: labels[1] },
    { z: noTracado(eng, START - VIEW * 0.28), type: "policia", label: labels[2] },
  )
}

function viaturaParada(eng: AutoDashEngine, z: number, offset: number, kind: Traffic["kind"] = "police") {
  eng.traffic.push({
    z, offset, targetOffset: offset, speed: 0, kind, role: "police", parked: true,
    color: "#1d4ed8", blinkT: 0, prevD: wrapDz(eng, z, eng.position + PLAYER_Z),
  })
}

/**
 * E8 — tapete de pregos em 2 ou 3 faixas, com SEMPRE uma faixa livre, e uma
 * viatura parada no acostamento do outro lado. Cada faixa coberta é um
 * obstáculo "pregos" (meia-largura de faixa): a faixa livre fica a 0,5 do
 * pedaço vizinho, folga de sobra para o carro passar.
 */
export function lancarPregos(eng: AutoDashEngine, faixas: 2 | 3) {
  const livre = Math.floor(Math.random() * 4)
  const cobre = [0, 1, 2, 3].filter(i => i !== livre)
  if (faixas < 3) cobre.splice(Math.floor(Math.random() * cobre.length), 1)
  const z = noTracado(eng, START)
  for (const i of cobre) eng.obstacles.push({ z, offset: eng.laneCenters[i], kind: "pregos", w: 0.5, len: 120 })
  const lado = livre < 2 ? 1 : -1
  viaturaParada(eng, noTracado(eng, START - 400), lado * 1.18)
  placas(eng, ["PREGOS 2 km", "PREGOS 1 km", "PARE"])
  eng.floaters.push({ text: "⚠️ PREGOS À FRENTE — ache a faixa livre!", color: "#fbbf24", y: H * 0.38, life: 1.8, big: false })
}

/** Passou por cima dos pregos: pneu furado. Não para nem teleporta (D6). */
export function furarPneu(eng: AutoDashEngine) {
  const p = eng.policia
  if (p.furadoT <= 0) {
    eng.floaters.push({ text: "PNEU FURADO! 🛞", color: "#fb923c", y: H * 0.42, life: 1.6, big: true })
    eng.audio.offroad()
    eng.shakeT = Math.max(eng.shakeT, 0.35)
    eng.combo = 0
    p.ladoFurado = Math.random() < 0.5 ? -1 : 1
  }
  p.furadoT = PNEU_FURADO_S
}

/** Pneu furado: teto menor (cai devagar até ele) e faísca no aro. */
function passoPneuFurado(eng: AutoDashEngine, dt: number) {
  const p = eng.policia
  p.furadoT = Math.max(0, p.furadoT - dt)
  const teto = CARS[eng.cfg.carIdx].topSpeed * FURADO_TETO
  if (eng.speed > teto) eng.speed = Math.max(teto, eng.speed - FURADO_FREIO * dt)
  p.faiscaT -= dt
  if (p.faiscaT <= 0 && eng.speed > 30) {
    p.faiscaT = 0.07
    burst(eng, W / 2 + p.ladoFurado * 58, H - 78, 2, ["#fde047", "#fb923c", "#fff7c0"])
  }
}

/** Fator de aderência da direção vindo da polícia (1 = normal). */
export function aderenciaPolicia(eng: AutoDashEngine): number {
  return eng.policia.furadoT > 0 ? FURADO_GRIP : 1
}

/**
 * E10 — bloqueio: três viaturas atravessadas e a FRESTA numa faixa do meio,
 * mais o acostamento livre dos dois lados. O giroflex aparece no horizonte
 * antes do corpo dos carros. Bater numa delas = preso (colisão do tráfego).
 */
export function lancarBloqueio(eng: AutoDashEngine) {
  const fresta = 1 + Math.floor(Math.random() * 2) // faixa 1 ou 2: um vão ENTRE viaturas
  const z = noTracado(eng, START)
  for (let i = 0; i < 4; i++) if (i !== fresta) viaturaParada(eng, z, eng.laneCenters[i], "roadblock")
  placas(eng, ["BLOQUEIO 2 km", "BLOQUEIO 1 km", "PARE"])
  // civis no trecho do bloqueio somem: ele nasce além do horizonte, ninguém vê
  for (const t of eng.traffic) {
    if (t.role !== "civilian") continue
    const d = wrapDz(eng, t.z, z)
    if (d > -8000 && d < 1500) t.dead = true
  }
  eng.policia.bloqueios.push({ z, fresta: eng.laneCenters[fresta], checado: false })
  eng.floaters.push({ text: "🚧 BLOQUEIO À FRENTE — ache a fresta!", color: "#fbbf24", y: H * 0.38, life: 1.8, big: false })
}

/** Civis que chegam ao bloqueio encostam na fresta; cruzar o bloqueio dá bônus ou esquenta. */
function passoBloqueios(eng: AutoDashEngine, playerZ: number) {
  const p = eng.policia
  for (const b of p.bloqueios) {
    if (wrapDz(eng, b.z, playerZ) > 0) {
      for (const t of eng.traffic) {
        if (t.role !== "civilian" || t.parked || t.blinkT > 0) continue
        const d = wrapDz(eng, b.z, t.z)
        if (d > 0 && d < 6000 && Math.abs(t.targetOffset - b.fresta) > 0.2) { t.targetOffset = b.fresta; t.blinkT = 0.6 }
      }
    } else if (!b.checado) {
      b.checado = true
      if (eng.crashed) continue
      if (Math.abs(eng.playerX - b.fresta) < 0.3) {
        eng.score += BONUS_FRESTA
        eng.floaters.push({ text: `PASSOU NA FRESTA! +${BONUS_FRESTA}`, color: "#4ade80", y: H * 0.34, life: 2, big: true })
        eng.audio.nearMiss()
      } else if (Math.abs(eng.playerX) > 1) {
        eng.floaters.push({ text: "PELO ACOSTAMENTO!", color: "#fbbf24", y: H * 0.34, life: 1.6, big: true })
      }
      infracao(eng, "bloqueio")
    }
  }
  if (p.bloqueios.some(b => wrapDz(eng, b.z, playerZ) < -20000)) {
    p.bloqueios = p.bloqueios.filter(b => wrapDz(eng, b.z, playerZ) >= -20000)
  }
}

/**
 * E13 — o ponto de luz persegue um alvo logo à frente do carro, com atraso
 * (rampa de velocidade) e teto abaixo do carro: em reta limpa e pé no fundo
 * o círculo fica para trás. Embaixo do viaduto o helicóptero te perde por
 * HELI_CEGO_S. Devolve se o carro está dentro do círculo.
 */
function passoHeli(eng: AutoDashEngine, dt: number, playerZ: number): boolean {
  const h = eng.policia.heli!
  const dz = wrapDz(eng, playerZ + HELI_ALVO, h.z) // >0: o alvo está à frente da luz
  const teto = Math.min(HELI_TETO, CARS[eng.cfg.carIdx].topSpeed - HELI_MARGEM)
  const vAlvo = clamp(eng.speed + dz / 30, 0, teto)
  h.v += clamp(vAlvo - h.v, -80 * dt, 60 * dt)
  h.z = ((h.z + h.v * KMH2UPS * dt) % eng.trackLen + eng.trackLen) % eng.trackLen
  h.x += clamp(eng.playerX - h.x, -0.6 * dt, 0.6 * dt)
  if (eng.sobViaduto) h.cegoT = HELI_CEGO_S
  else if (h.cegoT > 0) h.cegoT = Math.max(0, h.cegoT - dt)
  return h.cegoT <= 0
    && Math.abs(wrapDz(eng, playerZ, h.z)) < HOLOFOTE_Z
    && Math.abs(eng.playerX - h.x) < HOLOFOTE_X
}

/**
 * Teste de polícia (garagem → L): põe a caçada direto em `n` estrelas (0 encerra).
 * Viaturas a mais saem, as que faltam chegam por trás, o helicóptero só fica
 * em 5★, e o próximo evento da estrela vem logo.
 */
export function definirEstrelas(eng: AutoDashEngine, n: number) {
  const p = eng.policia
  n = clamp(Math.floor(n), 0, 5)
  if (n === 0) {
    eng.traffic = eng.traffic.filter(t => !ehViatura(t))
    p.calor = 0; p.esfriaT = 0; p.heli = null; p.holofote = false; p.visto = false
    eng.policeChaseT = 0; eng.policeEscapeT = 0
    eng.floaters.push({ text: "teste: sem polícia", color: "#94a3b8", y: H * 0.34, life: 1.2, big: false })
    return
  }
  const nivel = nivelDe(n)!
  let sobra = eng.traffic.filter(ehViatura).length - nivel.viaturas
  if (sobra > 0) eng.traffic = eng.traffic.filter(t => !(ehViatura(t) && sobra-- > 0))
  if (!nivel.helicoptero) { p.heli = null; p.holofote = false }
  if (!eng.traffic.some(ehViatura)) { eng.policeChaseT = 0; eng.policeEscapeT = 0 }
  p.calor = n
  p.esfriaT = 0
  p.eventoT = Math.min(p.eventoT, 2)
  anunciarEstrelas(eng, n)
  aplicarNivel(eng, n)
}
