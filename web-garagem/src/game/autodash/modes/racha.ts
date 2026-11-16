// AutoDash — modes/racha.ts. Convite de racha no solo (Fase 5, D18).
//
// Fluxo: convite (desafiante ao lado com pisca-alerta) → corrida (sprint de
// distância fixa) → fim (reputação e pontos). Ignorar o convite recusa. O
// desafiante é um veículo do trânsito com papel "racha" e IA própria
// (RachaDriver em traffic/driver.ts); aqui fica só o placar e as transições.
import { type AutoDashEngine, H, PLAYER_Z } from "../engine"
import { CARS, DRAW_DIST, KMH2UPS, SEG_LEN, saveConfig } from "../data"
import { type Traffic } from "../traffic/types"
import { wrapDz } from "../traffic/spawner"
import { RACHA, type Desafiante, desafianteDe, venceuRacha } from "../world/racha"
import { COMBUSTIVEL } from "../world/combustivel"

export interface Racha {
  fase: "convite" | "corrida"
  t: number           // s na fase atual
  def: Desafiante
  rival: Traffic
  eu: number          // km desde a largada do racha
  ele: number
  meta: number        // km
  placaPosta: boolean // linha de chegada já foi posta na pista
}

const KM_U = KMH2UPS * 3600 // unidades de mundo por km (a escala do hodômetro)

/** Próximo intervalo até um convite, pelo sorteio dos eventos novos. */
function proximoConvite(eng: AutoDashEngine): number {
  const [a, b] = RACHA.intervaloS
  return a + eng.rngEv() * (b - a)
}

function faixaMaisPerto(x: number): number {
  return Math.max(-0.75, Math.min(0.75, Math.round((x - 0.25) / 0.5) * 0.5 + 0.25))
}

/** Tenta chamar o jogador para um racha. Devolve false se agora não dá. */
export function convidarRacha(eng: AutoDashEngine): boolean {
  if (eng.racha || eng.speed < 70) return false
  if (eng.traffic.some(t => t.role === "police" && !t.parked)) return false // perseguição tem prioridade
  if (eng.combustivel < COMBUSTIVEL.reserva) return false
  const playerZ = eng.position + PLAYER_Z
  const minha = faixaMaisPerto(eng.playerX)
  // faixa vizinha livre (do lado de dentro primeiro, para não espremer no acostamento)
  const lados = minha > 0 ? [-0.5, 0.5] : [0.5, -0.5]
  let faixa: number | null = null
  for (const d of lados) {
    const f = minha + d
    if (f < -0.8 || f > 0.8) continue
    const livre = !eng.traffic.some(t => Math.abs(t.offset - f) < 0.3 && Math.abs(wrapDz(eng, t.z, playerZ)) < 2600)
    if (livre) { faixa = f; break }
  }
  if (faixa === null) return false
  const def = desafianteDe(eng.rngEv())
  const vMax = CARS[eng.cfg.carIdx].topSpeed * def.ritmo
  // chega por trás e encosta do lado (o campo próximo desenha quem vem de trás)
  const z = ((playerZ - 1400) % eng.trackLen + eng.trackLen) % eng.trackLen
  const rival: Traffic = {
    z, offset: faixa, targetOffset: faixa, speed: eng.speed + 30,
    kind: "car", role: "racha", color: def.pintura,
    blinkT: 0, prevD: wrapDz(eng, z, playerZ),
    label: def.nome, accent: def.cor, alerta: true,
    racha: { fase: "convite", vMax, acel: def.acel, fecha: def.fecha, fechaT: 3, olharT: 0, alvoFaixa: null, base: faixa },
  }
  eng.traffic.push(rival)
  eng.racha = { fase: "convite", t: 0, def, rival, eu: 0, ele: 0, meta: RACHA.distanciaKm, placaPosta: false }
  eng.floaters.push({ text: `🏁 ${def.nome}: "${def.frase}"`, color: def.cor, y: H * 0.44, life: 2.6, big: false })
  eng.audio.horn()
  return true
}

function encerrar(eng: AutoDashEngine) {
  const r = eng.racha
  if (r && r.rival.racha) { r.rival.racha.fase = "saindo"; r.rival.alerta = false }
  eng.racha = null
  eng.rachaT = proximoConvite(eng)
}

/** Um quadro do racha (só no solo, correndo). */
export function atualizarRacha(eng: AutoDashEngine, dt: number) {
  if (eng.mode !== "solo" || eng.testeMotor) return
  const playerZ = eng.position + PLAYER_Z
  // desafiante que já foi embora some de vista
  for (const t of eng.traffic) {
    if (t.role === "racha" && t.racha?.fase === "saindo" && Math.abs(wrapDz(eng, t.z, playerZ)) > RACHA.some) t.dead = true
  }
  const r = eng.racha
  if (!r) {
    if (eng.touge) return // no meio do duelo de touge, ninguém chama para racha
    eng.rachaT -= dt
    if (eng.rachaT <= 0 && !convidarRacha(eng)) eng.rachaT = 5
    return
  }
  if (r.rival.dead || !eng.traffic.includes(r.rival)) { eng.racha = null; eng.rachaT = proximoConvite(eng); return }
  r.t += dt

  if (r.fase === "convite") {
    // piscou o farol (flashBeam acabou de acender): aceitou
    if (eng.beamT > 0.4 && r.t > 0.5) {
      r.fase = "corrida"; r.t = 0
      // largada lançada: quem está na frente já sai com a vantagem física
      r.eu = 0; r.ele = wrapDz(eng, r.rival.z, playerZ) / KM_U
      if (r.rival.racha) r.rival.racha.fase = "corrida"
      r.rival.alerta = false
      eng.floaters.push({ text: `VALENDO! ${r.def.nome} — ${String(r.meta).replace(".", ",")} km`, color: r.def.cor, y: H * 0.42, life: 2, big: true })
      eng.audio.semaphoreGreen()
    } else if (r.t > RACHA.conviteS) {
      eng.floaters.push({ text: `${r.def.nome} foi embora 💨`, color: "#94a3b8", y: H * 0.34, life: 1.6, big: false })
      eng.audio.horn()
      encerrar(eng)
    }
    return
  }

  // corrida: distância de cada um desde a largada
  r.eu += eng.speed * dt / 3600
  r.ele += r.rival.speed * dt / 3600
  // linha de chegada na pista quando ela entra no alcance de vista
  const faltaU = (r.meta - r.eu) * KM_U
  if (!r.placaPosta && faltaU < DRAW_DIST * SEG_LEN * 0.95) {
    r.placaPosta = true
    eng.roadSigns.push({ z: ((playerZ + faltaU) % eng.trackLen + eng.trackLen) % eng.trackLen, type: "chegada", label: "CHEGADA" })
  }
  const venceu = venceuRacha(r.eu, r.ele, r.meta)
  if (venceu === null) return
  if (venceu) {
    eng.cfg.reputacao = (eng.cfg.reputacao ?? 0) + RACHA.reputacaoVitoria
    saveConfig(eng.cfg)
    eng.score += RACHA.pontosVitoria
    eng.nitroMeter = Math.min(100, eng.nitroMeter + RACHA.nitroVitoria)
    eng.floaters.push({ text: `VENCEU O RACHA! +${RACHA.reputacaoVitoria} REP`, color: "#4ade80", y: H * 0.3, life: 2.4, big: true })
    eng.floaters.push({ text: `+${RACHA.pontosVitoria} pontos · reputação ${eng.cfg.reputacao}`, color: "#f8fafc", y: H * 0.38, life: 2.2, big: false })
    eng.audio.levelUp()
  } else {
    eng.floaters.push({ text: `${r.def.nome} VENCEU O RACHA`, color: "#ef4444", y: H * 0.3, life: 2.2, big: true })
    eng.audio.horn()
  }
  encerrar(eng)
}

/** Diferença em metros (positivo: você na frente), pela distância de cada um. */
export function vantagemM(r: Racha): number {
  return Math.round((r.eu - r.ele) * 1000)
}
