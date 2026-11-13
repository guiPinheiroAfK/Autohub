// AutoDash — modes/duel.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, type DuelSession, H } from "../engine"
import { rematchRoom, pollRoom, postState, type DuelTelemetry, createRoom, joinRoom } from "../net"
import { clamp } from "../math"
import { submitScore } from "../data"

export function duelNet(eng: AutoDashEngine, dt: number) {
  const d = eng.duel
  if (!d || eng.mode !== "duel") return
  d.postT -= dt
  // extrapola a distância do rival entre polls
  if (d.opp && !d.opp.c && !d.result) d.oppD += (d.opp.v / 3600) * dt

  if (eng.state === "duelwaiting") {
    if (d.startAtLocal === null && d.postT <= 0 && !d.busy) {
      d.postT = 1.5
      d.busy = true
      if (d.rematch) {
        // revanche: mesma sala; quando o rival topar, vem seed nova + largada
        rematchRoom(d.code, d.role).then((r) => {
          if (r.startInMs !== null && r.startInMs > 300) {
            d.seed = r.seed
            d.startAtLocal = performance.now() + r.startInMs
            d.opp = null; d.oppD = 0
            d.result = null; d.iCrashed = false; d.scoreSent = false
          }
        }).catch(() => { /* tenta de novo no próximo tick */ }).finally(() => { d.busy = false })
      } else {
        pollRoom(d.code).then((r) => {
          if (r.oppName && r.startInMs !== null) {
            d.oppName = r.oppName
            d.startAtLocal = performance.now() + r.startInMs
          }
        }).catch(() => { /* tenta de novo no próximo tick */ }).finally(() => { d.busy = false })
      }
    }
    if (d.startAtLocal !== null && performance.now() >= d.startAtLocal - 3300) {
      d.rematch = false
      eng.startRace(d.seed)
      // compensa a latência do poll: o verde acende no instante combinado,
      // mesmo que este cliente tenha descoberto a largada atrasado
      const remaining = (d.startAtLocal - performance.now()) / 1000
      eng.countT = clamp(3.3 - remaining, 0, 3.2)
    }
    return
  }

  if (eng.state === "racing" || eng.state === "countdown") {
    if (d.postT <= 0 && !d.busy) {
      d.postT = 1.1
      d.busy = true
      postState(d.code, d.role, myTelemetry(eng, false))
          .then((r) => {
            if (r.opp) { d.opp = r.opp; d.oppD = r.opp.d; d.lastSeen = performance.now() }
          })
          .catch(() => { /* rede piscou */ })
          .finally(() => { d.busy = false })
    }
    // rival bateu e você já passou a marca dele: vitória na hora
    if (eng.state === "racing" && d.opp?.c && eng.km > d.oppD + 0.005) {
      duelFinish(eng, true, "seu rival bateu antes da sua marca")
    }
    // rival sumiu da corrida
    if (d.opp && performance.now() - d.lastSeen > 20000) {
      duelFinish(eng, true, "seu rival caiu da conexão")
    }
    return
  }

  if (eng.state === "duelspectate") {
    if (d.postT <= 0 && !d.busy) {
      d.postT = 1.3
      d.busy = true
      postState(d.code, d.role, myTelemetry(eng, true))
          .then((r) => {
            if (r.opp) { d.opp = r.opp; d.oppD = r.opp.d; d.lastSeen = performance.now() }
          })
          .catch(() => { /* segue tentando */ })
          .finally(() => { d.busy = false })
    }
    if (d.opp?.c) duelFinish(eng, eng.km > d.oppD)
    else if (performance.now() - d.lastSeen > 20000) duelFinish(eng, true, "seu rival caiu da conexão")
  }
}

export function duelFinish(eng: AutoDashEngine, win: boolean, msg = "") {
  const d = eng.duel
  if (!d || d.result) return
  d.result = win ? "win" : "lose"
  d.msg = msg
  eng.floaters = []
  eng.combo = 0
  // aviso final pro rival: minha corrida acabou (senão ele espera à toa)
  void postState(d.code, d.role, myTelemetry(eng, true))
      .catch(() => { /* melhor esforço */ })
  if (!d.scoreSent && eng.score > 300) {
    d.scoreSent = true
    void submitScore({
      name: (eng.cfg.pilotName || "PILOTO").trim(),
      score: Math.floor(eng.score),
      km: Math.round(eng.km * 10) / 10,
    }).then((scores) => { if (!eng.destroyed && scores.length) eng.scores = scores })
  }
  eng.state = "duelresult"
  if (win) eng.audio.levelUp(); else eng.audio.bog()
}

export function startDuelLobby(eng: AutoDashEngine) {
  eng.mode = "duel"
  eng.duel = null
  eng.codeBuf = ""
  eng.state = "duellobby"
  eng.audio.ui()
}

export function newDuelSession(_eng: AutoDashEngine, code: string, seed: number, role: "host" | "guest", oppName = "", startInMs: number | null = null) : DuelSession {
  return {
    code, seed, role, oppName,
    startAtLocal: startInMs === null ? null : performance.now() + startInMs,
    opp: null, oppD: 0, postT: 0, busy: false,
    lastSeen: performance.now(), iCrashed: false, scoreSent: false,
    result: null, rematch: false, msg: "",
  }
}

export function myTelemetry(eng: AutoDashEngine, crashed: boolean) : DuelTelemetry {
  return {
    d: eng.km,
    s: Math.floor(eng.score),
    v: crashed ? 0 : eng.speed,
    x: eng.playerX,
    c: crashed,
    car: eng.cfg.carIdx,
    paint: eng.cfg.customs[eng.cfg.carIdx].paint,
  }
}

export function duelRematch(eng: AutoDashEngine) {
  const d = eng.duel
  if (!d) { startDuelLobby(eng); return }
  d.rematch = true
  d.startAtLocal = null
  d.postT = 0
  eng.state = "duelwaiting"
  eng.audio.ui()
}

export function duelCreate(eng: AutoDashEngine) {
  const nome = eng.cfg.pilotName || "PILOTO"
  eng.state = "duelwaiting"
  eng.duel = newDuelSession(eng, "....", 0, "host")
  createRoom(nome).then((r) => {
    if (eng.destroyed || eng.state !== "duelwaiting") return
    eng.duel = newDuelSession(eng, r.code, r.seed, "host")
  }).catch((e: Error) => {
    eng.state = "duellobby"
    eng.duel = null
    eng.floaters.push({ text: e.message || "erro ao criar sala", color: "#ef4444", y: H * 0.6, life: 2, big: false })
  })
}

export function duelJoin(eng: AutoDashEngine) {
  const code = eng.codeBuf.trim().toUpperCase()
  if (code.length !== 4) {
    eng.floaters.push({ text: "código tem 4 letras", color: "#ef4444", y: H * 0.68, life: 1.5, big: false })
    return
  }
  const nome = eng.cfg.pilotName || "PILOTO"
  joinRoom(code, nome).then((r) => {
    if (eng.destroyed) return
    eng.duel = newDuelSession(eng, code, r.seed, "guest", r.oppName, r.startInMs)
    eng.state = "duelwaiting"
    eng.audio.ui()
  }).catch((e: Error) => {
    eng.floaters.push({ text: e.message || "não rolou entrar", color: "#ef4444", y: H * 0.68, life: 2, big: false })
  })
}
