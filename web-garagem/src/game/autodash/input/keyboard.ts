// AutoDash — input/keyboard.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { biomeById, proximoBioma } from "../world/biomes"
import { proximaHora } from "../world/clock"
import { proximoClima } from "../world/weather"
import { infracao, definirEstrelas } from "../world/policia"
import { enterFromMenu } from "../flow"
import { confirmName } from "../flow"
import { toMenu } from "../flow"
import { flashBeam } from "../flow"
import { ensureAudio, trocarMotor, trocarMotorTeste } from "../flow"
import { startRace } from "../modes/race"
import { abrirRaceLobby, reconhecerPista, sairReconhecimento } from "../modes/race"
import { mudarPista } from "../render/menus/race"
import { correrComBots } from "../modes/race"
import { abrirCodigoSala } from "../modes/race"
import { duelRematch } from "../modes/duel"
import { duelJoin } from "../modes/duel"
import { AutoDashEngine, H } from "../engine"
import { saveConfig, CARS, PAINTS, STRIPES, NEONS, WHEELS, WINGS } from "../data"
import { shiftUp, shiftDown } from "../physics/gearbox"

export function toggleMute(eng: AutoDashEngine) {
  eng.cfg.sound = !eng.cfg.sound
  saveConfig(eng.cfg)
  eng.audio.setMuted(!eng.cfg.sound)
  eng.floaters.push({
    text: eng.cfg.sound ? "🔊 som ligado" : "🔇 som desligado",
    color: "#94a3b8", y: H * 0.52, life: 1, big: false,
  })
}

export function tryShift(eng: AutoDashEngine, dir: 1 | -1) {
  if (eng.cfg.transmission !== "manual" && eng.gear !== 0) return
  if (eng.state !== "racing" && eng.state !== "countdown") return
  if (dir === 1) shiftUp(eng); else shiftDown(eng)
}

export function toNeutral(eng: AutoDashEngine) {
  if (eng.state !== "racing") return
  eng.gear = 0
  eng.audio.shift()
}

export function onKeyDown(eng: AutoDashEngine, e: KeyboardEvent) {
  const k = e.key.toLowerCase()
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault()
  ensureAudio(eng)

  if (eng.state === "nameentry") {
    if (k === "enter") {
      confirmName(eng)
    } else if (k === "backspace") eng.nameBuf = eng.nameBuf.slice(0, -1)
    else if (/^[a-z0-9 _-]$/i.test(e.key) && eng.nameBuf.length < 12) eng.nameBuf += e.key.toUpperCase()
    return
  }
  if (eng.state === "duelcode") {
    if (k === "enter") duelJoin(eng)
    else if (k === "escape") eng.state = "duellobby"
    else if (k === "backspace") eng.codeBuf = eng.codeBuf.slice(0, -1)
    else if (/^[a-z0-9]$/i.test(e.key) && eng.codeBuf.length < 4) eng.codeBuf += e.key.toUpperCase()
    return
  }

  eng.keys.add(k)
  if (k === " ") eng.nitroOn = true
  // [M] alterna o som (menos em pause/game over, onde M = menu)
  if (k === "m" && ["racing", "countdown", "menu", "garage", "duellobby"].includes(eng.state)) {
    toggleMute(eng)
    return
  }

  switch (eng.state) {
    case "menu":
      if (k === "enter") enterFromMenu(eng, "garage")
      if (k === "d") enterFromMenu(eng, "duellobby")
      if (k === "c") abrirRaceLobby(eng)
      break
    case "racelobby":
      if (k === "enter") correrComBots(eng)
      if (k === "h") void eng.criarSalaOnline()
      if (k === "j") abrirCodigoSala(eng)
      if (k === "arrowleft") { eng.cfg.carIdx = (eng.cfg.carIdx + CARS.length - 1) % CARS.length; saveConfig(eng.cfg); eng.audio.ui() }
      if (k === "arrowright") { eng.cfg.carIdx = (eng.cfg.carIdx + 1) % CARS.length; saveConfig(eng.cfg); eng.audio.ui() }
      if (k === "arrowdown") eng.raceVoltas = Math.max(1, eng.raceVoltas - 1)
      if (k === "arrowup") eng.raceVoltas = Math.min(9, eng.raceVoltas + 1)
      if (k === "p") mudarPista(eng, 1)
      if (k === "o") { eng.cfg.horaCorrida = proximaHora(eng.cfg.horaCorrida); saveConfig(eng.cfg); eng.audio.ui() }
      if (k === "k") { eng.cfg.climaCorrida = proximoClima(eng.cfg.climaCorrida); saveConfig(eng.cfg); eng.audio.ui() }
      if (k === "r") reconhecerPista(eng)
      if (k === "escape") toMenu(eng)
      break
    case "racerecon":
      sairReconhecimento(eng) // qualquer tecla volta ao lobby
      break
    case "racecode":
      if (k === "enter") void eng.entrarSalaOnline()
      else if (k === "backspace") eng.codeBuf = eng.codeBuf.slice(0, -1)
      else if (k === "escape") { eng.state = "racelobby"; eng.raceErro = null }
      else if (/^[a-z0-9]$/i.test(e.key) && eng.codeBuf.length < 4) eng.codeBuf += e.key.toUpperCase()
      break
    case "racewait":
      if (k === "enter" && eng.race?.cfg.souDono) void eng.race.largar()
      if (k === "escape") { eng.race = null; eng.mode = "solo"; eng.state = "racelobby" }
      break
    case "raceresult":
      if (k === "enter") correrComBots(eng)
      if (k === "m" || k === "escape") toMenu(eng)
      break
    case "duellobby":
      if (k === "escape") toMenu(eng)
      break
    case "duelwaiting":
      if (k === "escape") toMenu(eng)
      break
    case "duelresult":
      if (k === "enter") duelRematch(eng)
      if (k === "m" || k === "escape") toMenu(eng)
      break
    case "garage": {
      const custom = eng.cfg.customs[eng.cfg.carIdx]
      if (k === "arrowleft") { eng.cfg.carIdx = (eng.cfg.carIdx + CARS.length - 1) % CARS.length; eng.audio.ui() }
      if (k === "arrowright") { eng.cfg.carIdx = (eng.cfg.carIdx + 1) % CARS.length; eng.audio.ui() }
      if (k === "c") { custom.paint = (custom.paint + 1) % PAINTS.length; eng.audio.ui() }
      if (k === "v") { custom.stripe = (custom.stripe + 1) % STRIPES.length; eng.audio.ui() }
      if (k === "b") { custom.neon = (custom.neon + 1) % NEONS.length; eng.audio.ui() }
      if (k === "r") { custom.wheel = (custom.wheel + 1) % WHEELS.length; eng.audio.ui() }
      if (k === "g") { custom.wing = (custom.wing + 1) % WINGS.length; eng.audio.ui() }
      if (k === "t") { eng.cfg.transmission = eng.cfg.transmission === "auto" ? "manual" : "auto"; eng.audio.ui() }
      if (k === "y") { eng.cfg.steering = eng.cfg.steering === "mouse" ? "keyboard" : "mouse"; eng.audio.ui() }
      if (k === "x") { eng.cfg.biome = proximoBioma(eng.cfg.biome); eng.bioma = biomeById(eng.cfg.biome); eng.audio.ui() }
      if (k === "o") { eng.cfg.hora = proximaHora(eng.cfg.hora); eng.audio.ui() }
      if (k === "e") trocarMotor(eng)
      if (k === "k") { eng.cfg.clima = proximoClima(eng.cfg.clima); eng.audio.ui() }
      if (k === "n") { eng.nameBuf = eng.cfg.pilotName; eng.afterName = "garage"; eng.state = "nameentry"; eng.audio.ui() }
      if (["c", "v", "b", "r", "g", "t", "y", "x"].includes(k) || k.startsWith("arrow")) saveConfig(eng.cfg)
      if (k === "enter") { eng.testeMotor = false; eng.testePolicia = false; startAndSave(eng) }
      // teste de motor: pista vazia, sem trânsito; [ e ] (ou , e .) trocam o motor andando
      if (k === "z") { eng.testeMotor = true; eng.testePolicia = false; startAndSave(eng) }
      // teste de polícia: larga já perseguido, sem eventos de mapa; 0–5 definem as estrelas
      if (k === "p") { eng.testeMotor = false; eng.testePolicia = true; startAndSave(eng) }
      if (k === "escape") eng.state = "menu"
      break
    }
    case "racing":
    case "countdown":
      if (k === "escape" || k === "p") {
        if (eng.mode === "duel") {
          eng.floaters.push({ text: "sem pause no duelo! 😅", color: "#f472b6", y: H * 0.4, life: 1.2, big: false })
        } else {
          eng.state = "paused"
          eng.audio.uiLow()
        }
      }
      if (k === "q") tryShift(eng, -1)
      if (k === "e") tryShift(eng, 1)
      if (k === "n") toNeutral(eng)
      if (k === "f") flashBeam(eng)
      if (eng.testeMotor && (k === "]" || k === ".")) trocarMotorTeste(eng, 1)
      if (eng.testeMotor && (k === "[" || k === ",")) trocarMotorTeste(eng, -1)
      // (as teclas de debug de playtest — L nível, B/V/J/K/I/U eventos — foram
      // removidas: tudo isso agora é sorteado pelo próprio jogo em
      // updateEventSpawner). O voltou na Fase 6: sobe uma estrela de procurado.
      if (k === "o" && eng.mode === "solo" && eng.state === "racing" && !eng.testeMotor) infracao(eng, "debug")
      if (eng.testePolicia && eng.state === "racing" && /^[0-5]$/.test(k)) definirEstrelas(eng, Number(k))
      break
    case "paused":
      if (k === "escape" || k === "p" || k === "enter") eng.state = "racing"
      if (k === "r") startRace(eng)
      if (k === "m") eng.state = "menu"
      break
    case "gameover":
      if (k === "enter") startRace(eng)
      if (k === "g") { eng.testeMotor = false; eng.testePolicia = false; eng.state = "garage" }
      if (k === "m") eng.state = "menu"
      break
  }

  function startAndSave(self: AutoDashEngine) {
    saveConfig(self.cfg)
    startRace(self)
  }
}

export function onKeyUp(eng: AutoDashEngine, e: KeyboardEvent) {
  const k = e.key.toLowerCase()
  eng.keys.delete(k)
  if (k === " ") eng.nitroOn = false
}
