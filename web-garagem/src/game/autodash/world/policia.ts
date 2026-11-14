// AutoDash — world/policia.ts. Polícia por estrelas (Fase 6 do GUIA-V2).
//
// O nível de procurado é um CALOR de 0 a 5,99; as estrelas são a parte
// inteira. Infração e tempo de perseguição esquentam; despistar (ninguém te vê
// por alguns segundos) encerra a caçada e o calor esfria uma estrela por vez.
// Tudo que é número de jogo mora nas tabelas ESTRELAS e INFRACOES.
//
// As viaturas continuam sendo tráfego com a IA PoliceDriver (ADR 0008); aqui só
// se decide QUANTAS existem e com que teto e arrancada elas andam.
import { AutoDashEngine, H, PLAYER_Z } from "../engine"
import { CARS } from "../data"
import { wrapDz } from "../traffic/spawner"
import { type Traffic } from "../traffic/types"
import { clamp } from "../math"

export interface NivelEstrela {
  viaturas: number   // viaturas em perseguição neste nível
  teto: number       // km/h, teto da viatura (antes do limite do carro)
  arrancada: number  // km/h por segundo
  despisteS: number  // segundos sem ser visto para despistar
}

/** Uma linha por estrela (índice 0 = ★). Fonte: GUIA-V2, Fase 6. */
export const ESTRELAS: readonly NivelEstrela[] = [
  { viaturas: 1, teto: 205, arrancada: 50, despisteS: 3 },
  { viaturas: 2, teto: 215, arrancada: 55, despisteS: 4 },
  { viaturas: 3, teto: 222, arrancada: 60, despisteS: 5 },
  { viaturas: 4, teto: 228, arrancada: 65, despisteS: 6 },
  { viaturas: 4, teto: 234, arrancada: 70, despisteS: 7 },
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

export interface Procurado {
  calor: number     // 0..MAX_CALOR
  visto: boolean    // alguém te vê neste quadro
  esfriaT: number   // s até perder a próxima estrela (só sem perseguição)
  sirene: number    // 0..1, viatura mais perto (gancho para o som; ver GUIA)
}

export function novoProcurado(): Procurado {
  return { calor: 0, visto: false, esfriaT: 0, sirene: 0 }
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
  p.visto = nearest <= VISAO
  // sendo visto, a caçada esquenta com o tempo
  if (p.visto) {
    const antes = estrelasDe(p.calor)
    p.calor = Math.min(MAX_CALOR, p.calor + dt / SOBE_POR_TEMPO_S)
    const depois = estrelasDe(p.calor)
    if (depois > antes) { anunciarEstrelas(eng, depois); aplicarNivel(eng, depois) }
  }
  const nivel = nivelDe(estrelasDe(p.calor)) ?? ESTRELAS[0]
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
}
