// AutoDash — flow.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, PLAYER_Z } from "./engine"
import { startDuelLobby } from "./modes/duel"
import { saveConfig } from "./data"
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

export function toMenu(eng: AutoDashEngine) {
  eng.mode = "solo"
  eng.duel = null
  eng.floaters = []
  eng.state = "menu"
}

export function flashBeam(eng: AutoDashEngine) {
  if (eng.state !== "racing" || eng.beamCdT > 0) return
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
