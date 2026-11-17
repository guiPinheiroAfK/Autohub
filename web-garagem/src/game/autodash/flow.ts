// AutoDash — flow.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, PLAYER_Z } from "./engine"
import { startDuelLobby } from "./modes/duel"
import { saveConfig } from "./data"
import { proximoMotor, motorAnterior, REV_AMOSTRA_S } from "./sound/profiles"
import { wrapDz } from "./traffic/spawner"

export function enterFromMenu(eng: AutoDashEngine, dest: "garage" | "duellobby" = "garage") {
  eng.audio.ui()
  if (!eng.cfg.pilotName) {
    eng.nameBuf = ""
    eng.afterName = dest
    eng.state = "nameentry"
  } else if (dest === "duellobby") {
    startDuelLobby(eng)
  } else {
    // garage é a porta do SOLO — reseta o modo, senão uma corrida anterior
    // deixava mode="race" e o "bora correr" virava circuito
    eng.mode = "solo"
    eng.race = null
    limparTestes(eng)
    eng.state = "garage"
  }
}

export function confirmName(eng: AutoDashEngine) {
  eng.cfg.pilotName = (eng.nameBuf.trim() || "PILOTO").slice(0, 12)
  saveConfig(eng.cfg)
  eng.audio.ui()
  if (eng.afterName === "duellobby") startDuelLobby(eng)
  else { eng.mode = "solo"; eng.race = null; eng.state = "garage" }
  eng.afterName = "garage"
}

/** Desliga todos os atalhos de teste da garagem (motor, Fase 5, polícia). */
export function limparTestes(eng: AutoDashEngine) {
  eng.testeMotor = false
  eng.testeFase5 = false
  eng.testePolicia = false
  eng.roteiro = null
}

export function toMenu(eng: AutoDashEngine) {
  limparTestes(eng)
  eng.mode = "solo"
  eng.duel = null
  eng.floaters = []
  eng.state = "menu"
}

/**
 * [F] liga e desliga o farol alto (17/11: "um botão de liga e desliga, não só o que pisca").
 * Ao ligar ainda dá o clarão que pede passagem (e que aceita o convite de racha), com o
 * mesmo intervalo de antes; ligado, abre caminho aos poucos (pulsoFarolAlto) e clareia a pista.
 */
export function alternarFarolAlto(eng: AutoDashEngine) {
  if (eng.state !== "racing") return
  eng.farolAlto = !eng.farolAlto
  eng.farolPulsoT = 0
  if (eng.farolAlto) flashBeam(eng, true)
  else { eng.beamT = Math.max(eng.beamT, 0.55); eng.audio.flash() } // desligar também "pisca" (aceita o racha como antes)
}

/** Farol alto ligado: de tempos em tempos quem está na sua faixa, à frente, cede (mais leve que o clarão). */
export function pulsoFarolAlto(eng: AutoDashEngine, dt: number) {
  if (!eng.farolAlto) return
  eng.farolPulsoT -= dt
  if (eng.farolPulsoT > 0) return
  eng.farolPulsoT = 1.4
  const playerZ = eng.position + PLAYER_Z
  for (const t of eng.traffic) {
    const d = wrapDz(eng, t.z, playerZ)
    if (d > 300 && d < 5000 && Math.abs(t.offset - eng.playerX) < 0.35 && !t.parked && t.role === "civilian") t.yieldT = Math.max(t.yieldT ?? 0, 0.9)
  }
}

export function flashBeam(eng: AutoDashEngine, ignorarPause = false) {
  if ((eng.state !== "racing" && !ignorarPause) || eng.beamCdT > 0) return
  eng.beamCdT = 2.2
  eng.beamT = 0.55
  eng.audio.flash()
  const playerZ = eng.position + PLAYER_Z
  for (const t of eng.traffic) {
    const d = wrapDz(eng, t.z, playerZ)
    if (d > 200 && d < 7000 && Math.abs(t.offset - eng.playerX) < 0.35) t.yieldT = 1.4
  }
}

export function ensureAudio(eng: AutoDashEngine) {
  eng.audio.ensure()
  if (!eng.audioInit) {
    eng.audioInit = true
    eng.audio.setMuted(!eng.cfg.sound)
  }
}

/** Garagem: troca o som do motor do carro atual e dá uma acelerada de amostra. */
/** Teste de motor: troca o motor do carro com o carro andando (sem a acelerada de amostra). */
export function trocarMotorTeste(eng: AutoDashEngine, passo: 1 | -1) {
  const c = eng.cfg.customs[eng.cfg.carIdx]
  c.motor = passo > 0 ? proximoMotor(c.motor) : motorAnterior(c.motor)
  saveConfig(eng.cfg)
  eng.boost = 0
  eng.audio.ui()
}

export function trocarMotor(eng: AutoDashEngine) {
  const c = eng.cfg.customs[eng.cfg.carIdx]
  c.motor = proximoMotor(c.motor)
  saveConfig(eng.cfg)
  ensureAudio(eng)
  eng.revAmostraT = REV_AMOSTRA_S
}
