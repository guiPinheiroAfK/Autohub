// AutoDash — world/events.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, H, type RoadSign, PLAYER_Z } from "../engine"
import { DRAW_DIST, SEG_LEN } from "../data"
import { TRAFFIC_COLORS } from "../traffic/types"
import { wrapDz } from "../traffic/spawner"
import { clamp } from "../math"
import { postoPedido } from "./posto"
import { spawnObra } from "./obra"
import { spawnComboio } from "./comboio"
import { spawnOleo } from "./oleo"
import { avisar } from "./avisos"

export type EventoMapa = "bridge" | "viaduct" | "obstacles" | "wrongway" | "blitz" | "speedtrap" | "obra" | "comboio" | "oleo"

/**
 * Ritmo dos eventos (um diretor de intensidade simples, pesquisa 4.2):
 * - o intervalo só conta depois que o evento anterior ACABA (respiro de verdade:
 *   antes o relógio corria durante a ponte de 130 mil unidades e o próximo
 *   evento saía colado no fim dela);
 * - o intervalo encurta com o nível (dente de serra: a virada de nível dá um
 *   respiro garantido e o nível seguinte aperta);
 * - o mesmo evento não sai duas vezes em seguida (nem um dos dois últimos).
 */
export const RITMO = {
  primeiroS: 12,                       // primeiro evento depois da largada
  intervaloS: [20, 30] as const,       // no nível 1
  encurtaPorNivelS: 2.5,               // cada nível tira isto das duas pontas
  intervaloMinS: [9, 16] as const,     // piso
  viradaS: 8,                          // respiro mínimo na virada de nível
  semRepetir: 2,                       // não repete nenhum dos últimos N
}

/** Próximo intervalo entre eventos no nível dado (s), com o sorteio `u` em [0, 1). */
export function intervaloEventos(level: number, u: number): number {
  const lo = Math.max(RITMO.intervaloMinS[0], RITMO.intervaloS[0] - RITMO.encurtaPorNivelS * level)
  const hi = Math.max(RITMO.intervaloMinS[1], RITMO.intervaloS[1] - RITMO.encurtaPorNivelS * level)
  return lo + u * (hi - lo)
}

/** Sorteia o próximo evento do pool sem repetir os últimos. */
export function sortearEvento(pool: readonly EventoMapa[], ultimos: readonly EventoMapa[], u: number): EventoMapa {
  const livres = pool.filter(k => !ultimos.includes(k))
  const de = livres.length > 0 ? livres : pool
  return de[Math.floor(u * de.length)]
}

export function spawnEvent(eng: AutoDashEngine, kind: EventoMapa) {
  // eventos da Fase 5: módulos próprios e sorteio próprio (eng.rngEv)
  if (kind === "obra") { spawnObra(eng, eng.rngEv() < 0.5 ? 1 : -1); return }
  if (kind === "comboio") { spawnComboio(eng, eng.rngEv); return }
  if (kind === "oleo") { spawnOleo(eng, eng.rngEv() < 0.5 ? 1 : -1, eng.rngEv()); return }
  const at = (d: number) => ((eng.position + d) % eng.trackLen + eng.trackLen) % eng.trackLen
  // O perigo SEMPRE nasce além do horizonte de render (VIEW), e as placas
  // entram em cena antes dele. Sem isso o obstáculo brota no para-brisa: a
  // 200 km/h (26.400 u/s) as antigas 4.200 unidades eram 0,16 s de aviso.
  const VIEW = DRAW_DIST * SEG_LEN            // ~60.000 = o que cabe na tela
  const START = VIEW * 1.7                    // onde o evento começa
  // trinca de placas de aproximação, entrando em cena bem antes do perigo
  const avisos = (type: RoadSign["type"], labels: [string, string, string]) => {
    eng.roadSigns.push(
        { z: at(START - VIEW * 0.95), type, label: labels[0] },
        { z: at(START - VIEW * 0.60), type, label: labels[1] },
        { z: at(START - VIEW * 0.28), type, label: labels[2] },
    )
  }
  if (kind === "bridge") {
    // ponte suspensa (Golden Gate): você dirige EM CIMA — e ela SOBE: rampa,
    // vão alto entre as torres, descida. Água, guarda-corpo, torres vermelhas.
    const LEN = 130000, AMP = 1400
    const z = at(START)
    eng.zones.push({ type: "bridge", z, end: at(START + LEN), spawnT: 0 })
    // O vão é RETO e limpo: substitui o relevo/curva do traçado no trecho por
    // uma rampa->arco->rampa que interpola do y de entrada ao de saída (assim
    // emenda sem degrau nas duas pontas) e zera a curva. Antes a ponte herdava
    // morro e curva da pista e ficava torta.
    const a = Math.floor(z / SEG_LEN), nSegs = Math.floor(LEN / SEG_LEN), N = eng.segments.length
    const yStart = eng.segments[a % N].y1
    const yEnd = eng.segments[(a + nSegs) % N].y1
    for (let i = 0; i < nSegs; i++) {
      const s = eng.segments[(a + i) % N]
      const p0 = i / nSegs, p1 = (i + 1) / nSegs
      s.y1 = yStart + (yEnd - yStart) * p0 + AMP * Math.sin(Math.PI * p0)
      s.y2 = yStart + (yEnd - yStart) * p1 + AMP * Math.sin(Math.PI * p1)
      s.curve = 0
      s.sign = undefined // sem chevron de curva em cima da ponte
    }
    avisos("bridgewarn", ["PONTE 2 km", "PONTE 1 km", "PONTE"])
    avisar(eng, { icone: "🌉", titulo: "PONTE", dica: "subida e vão reto, sem curva", nivel: "info", z, fim: at(START + LEN) })
  } else if (kind === "viaduct") {
    // viaduto grandão cruzando por cima + carros saindo dele e entrando na
    // sua via (merge pela direita, com seta). Longe o bastante pra você ver
    // ele crescer no horizonte em vez de nascer em cima
    const z = at(START)
    eng.zones.push({ type: "viaduct", z, end: at(START + 400), spawnT: 0 })
    avisos("merge", ["ACESSO 2 km", "ACESSO 1 km", "ENTRADA"])
    // carros descendo a alça: nascem NA faixa de aceleração (offset ~1.3) e
    // fundem na via ao longo dela, escalonados — trânsito entrando de verdade
    for (let i = 0; i < 4; i++) {
      const cz = at(START + 1400 + i * 1700)
      eng.traffic.push({
        z: cz, offset: 1.32, targetOffset: 0.75,
        speed: 84 + eng.rngEv() * 22, kind: "car", role: "civilian",
        color: TRAFFIC_COLORS[Math.floor(eng.rngEv() * TRAFFIC_COLORS.length)],
        blinkT: 1.1 + i * 0.5, prevD: wrapDz(eng, cz, eng.position + PLAYER_Z),
      })
    }
    avisar(eng, { icone: "🛣️", titulo: "ACESSO DE VIADUTO", dica: "carros entrando pela direita", nivel: "perigo", z: at(START + 1400) })
  } else if (kind === "obstacles") {
    // padrão e lado sorteados; a obra começa além do horizonte e é anunciada
    const base = START + Math.floor(eng.rngEv() * 3000)
    const side = eng.rngEv() < 0.5 ? 1 : -1 // 1 = direita, -1 = esquerda
    avisos("works", ["OBRAS 2 km", "OBRAS 1 km", "OBRAS"])
    const roll = eng.rngEv()
    if (roll < 0.4) {
      // funil de cones fechando uma borda + barreira nas 2 faixas desse lado
      for (let i = 0; i < 5; i++) eng.obstacles.push({ z: at(base + i * 300), offset: side * (0.85 - i * 0.06), kind: "cone", w: 0.10, len: 90 })
      eng.obstacles.push({ z: at(base + 1900), offset: side * 0.5, kind: "barrier", w: 0.55, len: 140 })
    } else if (roll < 0.72) {
      // slalom: cones alternando de lado pelo meio da pista
      for (let i = 0; i < 6; i++) eng.obstacles.push({ z: at(base + i * 650), offset: (i % 2 === 0 ? 1 : -1) * (0.2 + eng.rngEv() * 0.25), kind: "cone", w: 0.10, len: 90 })
    } else {
      // obra: barreira numa faixa do meio + cones sinalizando antes
      const lane = side * 0.25
      for (let i = 0; i < 3; i++) eng.obstacles.push({ z: at(base + i * 350), offset: lane, kind: "cone", w: 0.10, len: 90 })
      eng.obstacles.push({ z: at(base + 1400), offset: lane, kind: "barrier", w: 0.3, len: 140 })
    }
    avisar(eng, { icone: "🚧", titulo: "OBRAS", dica: roll < 0.4 ? `fechado à ${side > 0 ? "direita" : "esquerda"}` : roll < 0.72 ? "cones no meio: costure" : `faixa ${side > 0 ? "direita" : "esquerda"} do meio fechada`, nivel: "perigo", z: at(base) })
  } else if (kind === "wrongway") {
    // MÃO DUPLA: as 2 faixas da esquerda viram contramão por um trecho longo;
    // placas avisam a extensão e o trânsito do seu lado se espreme na direita
    const LEN = 260000
    const z = at(START)
    eng.zones.push({ type: "wrongway", z, end: at(START + LEN), spawnT: 0 })
    // contagem regressiva de aproximação, como em rodovia de verdade...
    avisos("wrongway", ["MÃO DUPLA 2 km", "MÃO DUPLA 1 km", "MÃO DUPLA"])
    // ...e placas repetidas por todo o trecho, pra você não esquecer
    for (let d = 9000; d < LEN; d += 9000) eng.roadSigns.push({ z: at(START + d), type: "wrongway" })
    avisar(eng, { icone: "⛔", titulo: "MÃO DUPLA", dica: "faixas da esquerda na contramão", nivel: "perigo", z, fim: at(START + LEN) })
  } else if (kind === "blitz") {
    // blitz: aqui é 60! placas, funil de cones, barreira nas 2 faixas da
    // esquerda, viaturas paradas — e TODO o trânsito reduz junto.
    // Furar acima de ~65 = perseguição
    const z = at(START)
    eng.zones.push({ type: "blitz", z, end: at(START + 2400), spawnT: 0 })
    avisos("limit60", ["BLITZ 2 km", "BLITZ 1 km", "PARE 60"])
    // funil de cones ANTES da barreira, dentro do campo de visão
    for (let i = 0; i < 8; i++) eng.obstacles.push({ z: at(START - 4000 + i * 500), offset: -0.95 + i * 0.07, kind: "cone", w: 0.10, len: 90 })
    eng.obstacles.push({ z, offset: -0.5, kind: "barrier", w: 0.6, len: 140 })
    for (let i = 0; i < 2; i++) {
      const pz2 = at(START + 400 + i * 550)
      eng.traffic.push({
        z: pz2, offset: -0.5, targetOffset: -0.5, speed: 0,
        kind: "police", role: "police", parked: true,
        color: "#1d4ed8", blinkT: 0, prevD: wrapDz(eng, pz2, eng.position + PLAYER_Z),
      })
    }
    avisar(eng, { icone: "👮", titulo: "BLITZ", dica: "passe a 60 pela direita", nivel: "policia", z: at(START - 4000), fim: at(START + 2400) })
  } else {
    // radar (o evento da placa 90): polícia de tocaia no acostamento, todo o
    // trânsito baixa pra ≤90 — passar voando = eles vão atrás
    const z = at(START)
    eng.zones.push({ type: "speedtrap", z, end: at(START + 3000), spawnT: 0 })
    avisos("limit90", ["RADAR 2 km", "RADAR 1 km", "LIMITE 90"])
    for (let i = 0; i < 2; i++) {
      const pz2 = at(START - 200 + i * 500)
      eng.traffic.push({
        z: pz2, offset: 1.18, targetOffset: 1.18, speed: 0,
        kind: "police", role: "police", parked: true,
        color: "#1d4ed8", blinkT: 0, prevD: wrapDz(eng, pz2, eng.position + PLAYER_Z),
      })
    }
    avisar(eng, { icone: "📸", titulo: "RADAR", dica: "limite 90, polícia de tocaia", nivel: "policia", z, fim: at(START + 3000) })
  }
}

export function spawnPoliceChase(eng: AutoDashEngine) {
  const lanes = [-0.5, 0, 0.5]
  for (let i = 0; i < 3; i++) {
    // ATRÁS, escalonadas: elas vêm te alcançar. Só dá pra fazer isso agora que
    // (a) o campo próximo desenha quem está atrás e (b) a polícia não passa
    // pelo reciclador — antes elas eram invisíveis e ainda eram teleportadas.
    const behind = 2500 + i * 1200
    const z = ((eng.position - behind) % eng.trackLen + eng.trackLen) % eng.trackLen
    eng.traffic.push({
      z, offset: lanes[i], targetOffset: lanes[i],
      speed: clamp(eng.speed, 150, 215), kind: "police", role: "police",
      color: "#1d4ed8", blinkT: 0, prevD: wrapDz(eng, z, eng.position + PLAYER_Z),
    })
  }
  eng.floaters.push({ text: "🚓 PERSEGUIÇÃO!", color: "#60a5fa", y: H * 0.34, life: 2, big: true })
  eng.audio.horn()
}

export function updateEventSpawner(eng: AutoDashEngine, dt: number, playerZ: number) {
  // poda o que ficou muito atrás (sem isso os arrays crescem sem limite)
  const atras = (z: number) => wrapDz(eng, z, playerZ) < -60 * SEG_LEN
  if (eng.zones.some(z => atras(z.end))) eng.zones = eng.zones.filter(z => !atras(z.end))
  if (eng.roadSigns.some(s => atras(s.z))) eng.roadSigns = eng.roadSigns.filter(s => !atras(s.z))

  // tanque pedindo posto (Fase 5): segura os eventos sorteados até ele abrir
  if (postoPedido(eng)) return

  // virada de nível: respiro garantido antes do nível que aperta
  if (eng.levelUpT > 0) eng.eventTimer = Math.max(eng.eventTimer, RITMO.viradaS)
  // evento rolando (zona à frente ou cartão de aviso ativo): o relógio espera ele acabar
  if (eng.zones.some(z => wrapDz(eng, z.end, playerZ) > 0) || eng.avisos.some(a => a.saindo < 0)) return
  eng.eventTimer -= dt
  if (eng.eventTimer > 0) return
  eng.eventTimer = intervaloEventos(eng.level, eng.rngEv())

  // blitz e radar só a partir do nível 4 (regra combinada: perseguição não cai
  // em cima de quem ainda está começando)
  // Fase 5: obra (E4), comboio (E6) e óleo (E15) entram no sorteio de todos os níveis
  const pool: readonly EventoMapa[] = eng.level >= 3
      ? ["obstacles", "viaduct", "wrongway", "bridge", "blitz", "speedtrap", "obra", "comboio", "oleo"]
      : ["obstacles", "viaduct", "wrongway", "bridge", "obra", "comboio", "oleo"]
  const kind = sortearEvento(pool, eng.ultimosEventos, eng.rngEv())
  eng.ultimosEventos = [kind, ...eng.ultimosEventos].slice(0, RITMO.semRepetir)
  spawnEvent(eng, kind)
}
