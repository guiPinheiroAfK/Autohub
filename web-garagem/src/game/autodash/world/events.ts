// AutoDash — world/events.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, H, type RoadSign, PLAYER_Z } from "../engine"
import { DRAW_DIST, SEG_LEN } from "../data"
import { TRAFFIC_COLORS } from "../traffic/types"
import { wrapDz } from "../traffic/spawner"
import { clamp } from "../math"

export function spawnEvent(eng: AutoDashEngine, kind: "bridge" | "viaduct" | "obstacles" | "wrongway" | "blitz" | "speedtrap") {
  const at = (d: number) => ((eng.position + d) % eng.trackLen + eng.trackLen) % eng.trackLen
  const note = (text: string) => eng.floaters.push({ text, color: "#fbbf24", y: H * 0.38, life: 1.6, big: false })
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
    note("🌉 ponte à frente")
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
        speed: 84 + Math.random() * 22, kind: "car", role: "civilian",
        color: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
        blinkT: 1.1 + i * 0.5, prevD: wrapDz(eng, cz, eng.position + PLAYER_Z),
      })
    }
    note("🛣️ viaduto à frente — carros entrando!")
  } else if (kind === "obstacles") {
    // padrão e lado sorteados; a obra começa além do horizonte e é anunciada
    const base = START + Math.floor(Math.random() * 3000)
    const side = Math.random() < 0.5 ? 1 : -1 // 1 = direita, -1 = esquerda
    avisos("works", ["OBRAS 2 km", "OBRAS 1 km", "OBRAS"])
    const roll = Math.random()
    if (roll < 0.4) {
      // funil de cones fechando uma borda + barreira nas 2 faixas desse lado
      for (let i = 0; i < 5; i++) eng.obstacles.push({ z: at(base + i * 300), offset: side * (0.85 - i * 0.06), kind: "cone", w: 0.10, len: 90 })
      eng.obstacles.push({ z: at(base + 1900), offset: side * 0.5, kind: "barrier", w: 0.55, len: 140 })
    } else if (roll < 0.72) {
      // slalom: cones alternando de lado pelo meio da pista
      for (let i = 0; i < 6; i++) eng.obstacles.push({ z: at(base + i * 650), offset: (i % 2 === 0 ? 1 : -1) * (0.2 + Math.random() * 0.25), kind: "cone", w: 0.10, len: 90 })
    } else {
      // obra: barreira numa faixa do meio + cones sinalizando antes
      const lane = side * 0.25
      for (let i = 0; i < 3; i++) eng.obstacles.push({ z: at(base + i * 350), offset: lane, kind: "cone", w: 0.10, len: 90 })
      eng.obstacles.push({ z: at(base + 1400), offset: lane, kind: "barrier", w: 0.3, len: 140 })
    }
    note("🚧 obstáculos à frente")
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
    note("⛔ MÃO DUPLA à frente — 2 km!")
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
    note("👮 BLITZ à frente — reduza pra 60!")
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
    note("📸 RADAR à frente — limite 90!")
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

  eng.eventTimer -= dt
  if (eng.eventTimer > 0) return

  // já tem evento rolando à frente? não empilha — espera acabar
  if (eng.zones.some(z => wrapDz(eng, z.end, playerZ) > 0)) { eng.eventTimer = 5; return }
  eng.eventTimer = 15 + Math.random() * 15

  // blitz e radar só a partir do nível 4 (regra combinada: perseguição não cai
  // em cima de quem ainda está começando)
  const pool = eng.level >= 3
      ? (["obstacles", "obstacles", "viaduct", "wrongway", "bridge", "blitz", "speedtrap"] as const)
      : (["obstacles", "obstacles", "obstacles", "viaduct", "wrongway", "bridge"] as const)
  spawnEvent(eng, pool[Math.floor(Math.random() * pool.length)])
}
