// AutoDash — modes/solo.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, H, W } from "../engine"
import { burst } from "../fx/particles"
import { CARS, type ScoreEntry, submitScore } from "../data"
import { wheelspinK } from "../physics/traction"
import { motorDe, fracGiro } from "../physics/motores"
import { postState } from "../net"
import { myTelemetry, duelFinish } from "./duel"
import { perderDrift } from "../world/drift"

export function launch(eng: AutoDashEngine) {
  // qualidade da largada pela zona de RPM segurada no verde
  eng.gear = 1
  // janela pela fração da faixa do motor (antes 3600–6300 de um motor 900–7900)
  const f = fracGiro(motorDe(eng), eng.rpm)
  if (f >= 0.386 && f <= 0.771) {
    eng.speed = 52
    eng.nitroMeter = Math.min(100, eng.nitroMeter + 30)
    eng.floaters.push({ text: "LARGADA PERFEITA!", color: "#fde047", y: H * 0.35, life: 1.6, big: true })
    eng.audio.perfectLaunch()
  } else if (f > 0.843) {
    eng.speed = 18
    eng.wheelspinT = 1.3 * wheelspinK(CARS[eng.cfg.carIdx])
    eng.floaters.push({ text: "PATINOU!", color: "#fb923c", y: H * 0.35, life: 1.4, big: true })
  } else if (f < 0.186) {
    eng.speed = 10
    eng.bogT = 1.1
    eng.floaters.push({ text: "ENGASGOU...", color: "#94a3b8", y: H * 0.35, life: 1.4, big: true })
    eng.audio.bog()
  } else {
    eng.speed = 32
  }
}

export function crash(eng: AutoDashEngine, byPolice = false) {
  perderDrift(eng)
  // NA CORRIDA NÃO SE MORRE: bater custa quase toda a velocidade e o tempo
  // de retomar — que numa disputa por voltas já é punição suficiente. Encerrar
  // a prova por uma batida tirava o jogador da corrida inteira.
  if (eng.mode === "race" && eng.race && !eng.race.finished) {
    eng.speed *= 0.1
    eng.steerVel = 0
    eng.wheelspinT = 0.5 * wheelspinK(CARS[eng.cfg.carIdx])
    eng.combo = 0
    eng.shakeT = 0.55
    eng.immuneT = Math.max(eng.immuneT, 1.3) // respiro pra não bater em cadeia
    eng.audio.crash()
    burst(eng, W / 2, H - 110, 30, ["#fb923c", "#ef4444"])
    eng.floaters.push({ text: "RODOU!", color: "#fb923c", y: H * 0.4, life: 1.3, big: true })
    return
  }
  eng.crashed = true
  eng.crashByPolice = byPolice
  eng.audio.crash()
  eng.shakeT = 0.6
  burst(eng, W / 2, H - 110, 40, ["#fb923c", "#ef4444"])
  const entry: ScoreEntry = {
    name: (eng.cfg.pilotName || "PILOTO").trim(),
    score: Math.floor(eng.score),
    km: Math.round(eng.km * 10) / 10,
  }
  eng.newRecord = entry.score > 300 && (eng.scores.length === 0 || entry.score > eng.scores[0].score)
  if (entry.score > 300) {
    if (eng.duel) eng.duel.scoreSent = true
    void submitScore(entry).then((scores) => {
      if (!eng.destroyed && scores.length) eng.scores = scores
    })
  }

  if (eng.mode === "duel" && eng.duel) {
    const d = eng.duel
    d.iCrashed = true
    void postState(d.code, d.role, myTelemetry(eng, true))
        .then((r) => { if (r.opp) { d.opp = r.opp; d.oppD = r.opp.d; d.lastSeen = performance.now() } })
        .catch(() => { /* spectate segue tentando */ })
    if (d.opp?.c) duelFinish(eng, eng.km > d.oppD)
    else eng.state = "duelspectate"
    return
  }

  eng.state = "gameover"
}
