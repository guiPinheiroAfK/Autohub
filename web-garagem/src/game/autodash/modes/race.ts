// AutoDash — modes/race.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine } from "../engine"
import { buildTrack } from "../world/track"
import { seedTraffic } from "../traffic/spawner"
import { RPM_IDLE } from "../data"
import { RaceSession } from "../race/session"

export function startRace(eng: AutoDashEngine, seed?: number) {
  const corrida = eng.mode === "race"
  // limpa ANTES de construir: no circuito o buildTrack semeia os cones das
  // curvas, e zerar depois apagaria justamente eles
  eng.obstacles = []; eng.zones = []; eng.roadSigns = []; eng.eventTimer = corrida ? 1e9 : 12
  buildTrack(eng, seed, corrida)
  seedTraffic(eng, corrida ? 5 : 14)
  eng.position = 0
  eng.speed = 0
  eng.playerX = 0
  eng.steerVel = 0
  eng.gear = 0
  eng.rpm = RPM_IDLE
  eng.score = 0; eng.km = 0; eng.combo = 0; eng.comboT = 0
  eng.nitroMeter = 0; eng.nitroOn = false
  eng.shield = false; eng.immuneT = 0; eng.policeHitT = 0; eng.policeEscapeT = 0; eng.policeChaseT = 0; eng.mult2T = 0
  eng.level = 0; eng.levelUpT = 0
  eng.powerups = []; eng.puTimer = 6
  eng.curveWarn = 0; eng.collWarn = null
  eng.newRecord = false; eng.beamT = 0; eng.beamCdT = 0; eng.pitchY = 0
  eng.shiftT = 0; eng.wheelspinT = 0; eng.bogT = 0
  eng.crashed = false; eng.crashByPolice = false
  eng.raceFinished = false; eng.raceSpectT = 0
  eng.raining = false; eng.rainRollT = 0
  eng.audio.rain(false)
  eng.particles = []; eng.floaters = []
  eng.countT = 0
  // no duelo o verde é fixo pra manter os dois relógios alinhados
  eng.greenAt = eng.mode === "duel" ? 3.3 : 2.4 + 0.7 + Math.random() * 0.9
  eng.greenFired = false
  eng.state = "countdown"
}

export function abrirRaceLobby(eng: AutoDashEngine) {
  eng.audio.ui()
  eng.race = null
  eng.fadeT = 0.22
  eng.state = "racelobby"
}

export function correrComBots(eng: AutoDashEngine) {
  eng.audio.ui()
  eng.mode = "race"
  eng.race = RaceSession.soloComBots(eng.cfg.pilotName || "VOCÊ", eng.raceVoltas, eng.raceBots)
  startRace(eng, eng.race.cfg.seed)
}

export function abrirCodigoSala(eng: AutoDashEngine) {
  eng.audio.ui()
  eng.raceErro = null
  eng.codeBuf = ""
  eng.state = "racecode"
  eng.fadeT = 0.22
}
