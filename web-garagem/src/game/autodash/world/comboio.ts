// AutoDash — world/comboio.ts. E6: comboio com fresta (Fase 5).
//
// Três veículos lado a lado no mesmo ritmo, uma faixa livre (sempre resta uma).
// A fresta ANDA: o vizinho dela dá seta por 1,3 s e fecha, abrindo outra onde
// ele estava. Leitura: lanternas em linha de longe e a seta de quem vai fechar.
// Contra-jogada: passar pela fresta no tempo certo (bônus ×3 de quase-batida)
// ou esperar atrás até o comboio se desfazer.
import { type AutoDashEngine, H, PLAYER_Z, W } from "../engine"
import { DRAW_DIST, SEG_LEN } from "../data"
import { type Traffic, type TrafficKind, TRAFFIC_COLORS } from "../traffic/types"
import { wrapDz } from "../traffic/spawner"
import { burst } from "../fx/particles"
import { avisar } from "./avisos"

export const COMBOIO = {
  velocidade: 92,                 // km/h, todos iguais
  fechaCadaS: [3, 4.5] as const,  // s entre um fechamento e o próximo
  setaS: 1.3,                     // seta antes de fechar (≥ 1,2 s de leitura)
  duracaoS: 18,                   // depois disso o comboio se desfaz
  bonus: 200 * 3,                 // pontos base da fresta (quase-batida × 3)
  nitro: 20,
}

const FAIXAS = [-0.75, -0.25, 0.25, 0.75]
const TIPOS: TrafficKind[] = ["truck", "car", "bus", "truck"]

export interface Comboio {
  buzinou?: boolean // a buzina a ar já tocou (world/somEventos.ts)
  membros: Traffic[]
  t: number
  proxT: number
  passou: boolean // o jogador já cruzou a linha (bônus pago)
}

/** Monta o comboio além do horizonte. `u` são sorteios em [0, 1). */
export function spawnComboio(eng: AutoDashEngine, u: () => number) {
  const VIEW = DRAW_DIST * SEG_LEN
  const z = ((eng.position + VIEW * 1.2) % eng.trackLen + eng.trackLen) % eng.trackLen
  const livre = Math.floor(u() * 4)
  const membros: Traffic[] = []
  for (let i = 0; i < 4; i++) {
    if (i === livre) continue
    const t: Traffic = {
      z, offset: FAIXAS[i], targetOffset: FAIXAS[i], speed: COMBOIO.velocidade,
      kind: TIPOS[(i + Math.floor(u() * 4)) % 4], role: "comboio",
      color: TRAFFIC_COLORS[Math.floor(u() * TRAFFIC_COLORS.length)],
      blinkT: 0, prevD: wrapDz(eng, z, eng.position + PLAYER_Z),
    }
    membros.push(t)
    eng.traffic.push(t)
  }
  // Fase 8.3: faixa "CARGA LONGA" nos caminhões e o batedor de giroflex âmbar
  // na frente, no acostamento (não é membro: não entra na fresta)
  for (const m of membros) if (m.kind === "truck") m.placa = "CARGA LONGA"
  const zb = ((z + 2600) % eng.trackLen + eng.trackLen) % eng.trackLen
  eng.traffic.push({
    z: zb, offset: 1.14, targetOffset: 1.14, speed: COMBOIO.velocidade,
    kind: "car", role: "comboio", color: "#facc15", giroflexAmbar: true,
    blinkT: 0, prevD: wrapDz(eng, zb, eng.position + PLAYER_Z),
  })
  eng.comboio = { membros, t: 0, proxT: 2, passou: false }
  const c = eng.comboio
  avisar(eng, { icone: "🚛", titulo: "COMBOIO", dica: "a fresta muda de faixa", nivel: "perigo", z, ref: membros[0], vivo: () => eng.comboio === c && !c.passou })
}

function desfazer(eng: AutoDashEngine) {
  const c = eng.comboio
  if (c) for (const m of c.membros) if (!m.dead) m.role = "civilian"
  eng.comboio = null
}

/** Um quadro do comboio: anda a fresta, paga o bônus e se desfaz no fim. */
export function atualizarComboio(eng: AutoDashEngine, dt: number, playerZ: number, u: () => number) {
  const c = eng.comboio
  if (!c) return
  c.membros = c.membros.filter(m => !m.dead && eng.traffic.includes(m))
  if (c.membros.length === 0) { eng.comboio = null; return }
  c.t += dt

  // troca abortada (alguém entrou na faixa) deixa o membro entre faixas: volta pro centro
  for (const m of c.membros) {
    if (m.targetOffset !== m.offset || m.blinkT > 0) continue
    const centro = FAIXAS.reduce((a, b) => Math.abs(b - m.offset) < Math.abs(a - m.offset) ? b : a)
    if (centro !== m.offset) m.targetOffset = centro
  }

  // anda a fresta: o vizinho dela dá seta e fecha (todos parados na faixa)
  c.proxT -= dt
  if (c.proxT <= 0 && c.membros.every(m => m.targetOffset === m.offset && m.blinkT <= 0)) {
    const ocupadas = new Set(c.membros.map(m => FAIXAS.indexOf(m.offset)))
    const livre = [0, 1, 2, 3].find(i => !ocupadas.has(i))
    if (livre !== undefined) {
      const vizinhos = c.membros.filter(m => Math.abs(m.offset - FAIXAS[livre]) < 0.6)
      const quem = vizinhos[Math.floor(u() * vizinhos.length)]
      if (quem) { quem.targetOffset = FAIXAS[livre]; quem.blinkT = COMBOIO.setaS }
    }
    const [a, b] = COMBOIO.fechaCadaS
    c.proxT = a + u() * (b - a)
  }

  // passou pela linha do comboio (todos ficaram para trás) sem bater: fresta!
  const frente = c.membros.some(m => wrapDz(eng, m.z, playerZ) > 0)
  if (!c.passou && !frente && !eng.crashed && c.membros.every(m => wrapDz(eng, m.z, playerZ) > -1500)) {
    c.passou = true
    eng.combo = Math.min(7, eng.combo + 1)
    eng.comboT = 4
    const mult = (1 + eng.combo) * (eng.mult2T > 0 ? 2 : 1)
    const pts = COMBOIO.bonus * mult
    eng.score += pts
    eng.nitroMeter = Math.min(100, eng.nitroMeter + COMBOIO.nitro)
    eng.floaters.push({ text: `FRESTA! +${pts}  x${mult}`, color: "#56B4E9", y: H * 0.4, life: 1.4, big: true })
    burst(eng, W / 2, H - 100, 14, ["#56B4E9", "#e0f2fe"])
    eng.audio.nearMiss()
  }

  // fim: tempo esgotado ou o jogador já deixou o comboio bem para trás
  const longe = c.membros.every(m => wrapDz(eng, m.z, playerZ) < -4000)
  if (c.t > COMBOIO.duracaoS || longe) desfazer(eng)
}
