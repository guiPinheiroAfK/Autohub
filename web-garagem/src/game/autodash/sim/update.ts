// AutoDash — sim/update.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, PLAYER_Z, H, W, PU_NITRO, PU_SHIELD, PU_X2 } from "../engine"
import { CARS, KMH2UPS, RPM_IDLE, RPM_LIMITER, GEAR_RATIOS, SEG_LEN, RPM_PER_KMH, DRAW_DIST } from "../data"
import { duelNet } from "../modes/duel"
import { startRace } from "../modes/race"
import { segAt } from "../world/track"
import { updateTraffic, wrapDz } from "../traffic/spawner"
import { updateFx, emitSmoke, emitFlame, burst, initRain } from "../fx/particles"
import { launch } from "../modes/solo"
import { clamp } from "../math"
import { rpmFor, powerCurve } from "../physics/rpm"
import { shiftUp, shiftDown } from "../physics/gearbox"
import { updateEventSpawner } from "../world/events"
import { updateZones } from "../world/zones"
import { updateObstacles } from "../world/obstacles"

export function update(eng: AutoDashEngine, dt: number) {
  const spec = CARS[eng.cfg.carIdx]
  const voice = AutoDashEngine.ENGINE_VOICE[spec.body] ?? [1, 1]
  eng.audio.setEngine(voice[0], voice[1])

  duelNet(eng, dt)

  // sala de espera: consulta quem entrou e detecta a largada dada pelo dono
  if (eng.state === "racewait" && eng.race) {
    eng.race.update(dt, 0, 0, 0, false, eng.trackLen)
    if (eng.race.phase === "countdown") { startRace(eng, eng.race.cfg.seed) }
  }

  if (["menu", "garage", "duellobby", "duelcode", "duelwaiting", "duelresult",
    "racelobby", "racecode", "racewait", "raceresult"].includes(eng.state)) {
    // demo: câmera passeia pela pista
    eng.demoT += dt
    eng.speed = 95
    eng.position = (eng.position + eng.speed * KMH2UPS * dt) % eng.trackLen
    eng.playerX = Math.sin(eng.demoT * 0.3) * 0.2
    eng.bgShift += segAt(eng, eng.position + PLAYER_Z).curve * eng.speed * dt * 0.6
    updateTraffic(eng, dt, eng.position + PLAYER_Z, true)
    updateFx(eng, dt) // floaters/partículas sobrando da corrida ainda precisam morrer
    eng.audio.engine(0, 0, false, false)
    return
  }
  if (eng.state === "paused" || eng.state === "gameover" || eng.state === "nameentry" || eng.state === "duelspectate") {
    updateFx(eng, dt)
    eng.audio.engine(0, 0, false, false)
    eng.audio.skid(0)
    return
  }

  let throttle = eng.mouseGas || eng.touchThrottle || eng.keys.has("w") || eng.keys.has("arrowup") ? 1 : 0
  const braking = eng.mouseBrake || eng.touchBrake || eng.keys.has("s") || eng.keys.has("arrowdown")
  // corrida terminada: neutro, gás cortado — o carro faz a volta de
  // desaceleração e não pode mais acelerar (bug: a física acelerava antes de
  // o bloco de chegada zerar a marcha)
  if (eng.raceFinished) throttle = 0

  if (eng.state === "countdown") {
    eng.countT += dt
    // rev livre no grid
    const targetRpm = RPM_IDLE + throttle * (7500 - RPM_IDLE)
    eng.rpm += (targetRpm - eng.rpm) * Math.min(1, dt * 5)
    if (eng.rpm > RPM_LIMITER) eng.rpm = RPM_LIMITER - Math.random() * 300
    // burnout no grid: acelerando no ponto morto, pneu fuma (só na corrida)
    if (eng.mode === "race" && throttle > 0.5 && eng.rpm > 4500 && Math.random() < 0.6) {
      emitSmoke(eng, 2, "#d8dbe2")
    }
    if (eng.countT >= eng.greenAt) {
      eng.greenFired = true
      eng.audio.semaphoreGreen()
      launch(eng)
      eng.goFlashT = 1.2
      eng.state = "racing"
    } else {
      for (const tl of [0.8, 1.6, 2.4]) {
        if (eng.countT >= tl && eng.countT - dt < tl) eng.audio.semaphoreRed()
      }
    }
    eng.audio.engine(eng.rpm, throttle, false, true)
    updateFx(eng, dt)
    return
  }

  // ---------- racing ----------
  const grip = spec.grip * (eng.raining ? 0.62 : 1)
  const playerZ = eng.position + PLAYER_Z
  const seg = segAt(eng, playerZ)

  // direção — input suavizado, mais firme em alta velocidade
  let steerInput = 0
  if (eng.cfg.steering === "mouse") {
    steerInput = clamp(((eng.mouseXn * 2 - 1) * 1.25 - eng.playerX) * 2.2, -1, 1)
  } else {
    if (eng.keys.has("a") || eng.keys.has("arrowleft") || eng.touchSteerLeft) steerInput -= 1
    if (eng.keys.has("d") || eng.keys.has("arrowright") || eng.touchSteerRight) steerInput += 1
  }
  const speedF = Math.min(1, eng.speed / 240)
  const maxSteer = (0.95 + grip * 0.85) * (1 - 0.38 * speedF) * (0.35 + 0.65 * Math.min(1, eng.speed / 55))
  eng.steerVel += (steerInput * maxSteer - eng.steerVel) * Math.min(1, dt * 9)
  if (eng.levelUpT > 0) eng.steerVel += Math.sin(eng.levelUpT * 22) * 0.9 * dt // rabeio da virada de nível
  eng.playerX += eng.steerVel * dt

  // força centrífuga — curva média se segura no volante; fechada em vmax pede freio
  const centrif = seg.curve * Math.pow(eng.speed / 240, 2.2) * (0.42 - grip * 0.22)
  eng.playerX -= centrif * dt
  const slip = Math.abs(centrif) * speedF
  eng.audio.skid(slip > 0.3 ? slip : 0)
  if (slip > 0.45 && Math.abs(eng.steerVel) > 0.3 && Math.random() < 0.5) emitSmoke(eng, 1, "#6b7280")
  eng.bgShift += seg.curve * eng.speed * dt * 0.6

  // transferência de peso: sobe o bico na freada, agacha no gás
  const pitchTarget = braking && eng.speed > 20 ? -4 : throttle ? 1.5 : 0
  eng.pitchY += (pitchTarget - eng.pitchY) * Math.min(1, dt * 8)

  // fora da pista
  if (Math.abs(eng.playerX) > 1.05) {
    eng.offroadT += dt
    eng.speed = Math.max(Math.min(eng.speed, 60), eng.speed - 160 * dt)
    eng.shakeT = 0.1
    eng.combo = 0
    if (Math.random() < 0.3) eng.audio.offroad()
    emitSmoke(eng, 3, "#a3a3a3")
  } else eng.offroadT = 0
  eng.playerX = clamp(eng.playerX, -1.6, 1.6)

  // ---------- motor ----------
  if (eng.shiftT > 0) eng.shiftT -= dt
  if (eng.wheelspinT > 0) eng.wheelspinT -= dt
  if (eng.bogT > 0) eng.bogT -= dt

  if (eng.gear >= 1) eng.rpm = rpmFor(eng, eng.speed, eng.gear)
  else {
    const targetRpm = RPM_IDLE + throttle * (7500 - RPM_IDLE)
    eng.rpm += (targetRpm - eng.rpm) * Math.min(1, dt * 5)
  }

  // câmbio automático
  if (eng.cfg.transmission === "auto" && eng.gear >= 1 && eng.shiftT <= 0) {
    if (throttle && eng.rpm > 6900 && eng.gear < 6) shiftUp(eng)
    else if (eng.rpm < 2000 && eng.gear > 1) shiftDown(eng)
  }

  let accel = 0
  if (eng.gear >= 1 && throttle && eng.shiftT <= 0) {
    const gearF = Math.pow(GEAR_RATIOS[eng.gear - 1] / GEAR_RATIOS[0], 0.9)
    accel = spec.power * powerCurve(eng, eng.rpm) * gearF
    if (eng.rpm >= RPM_LIMITER - 50) { accel = 0; if (Math.random() < 0.4) eng.audio.limiter() }
    if (eng.wheelspinT > 0) { accel *= 0.35; emitSmoke(eng, 2, "#e2e8f0") }
    if (eng.bogT > 0) accel *= 0.5
  }
  if (eng.nitroOn && eng.nitroMeter > 1 && eng.gear >= 1) {
    accel += 42
    eng.nitroMeter = Math.max(0, eng.nitroMeter - 38 * dt)
    emitFlame(eng)
  }
  const nitroActive = eng.nitroOn && eng.nitroMeter > 1

  eng.speed += accel * dt
  if (braking) eng.speed -= (eng.raining ? 78 : 105) * dt
  eng.speed -= (5 + eng.speed * 0.028) * dt // arrasto

  // FÍSICA DE LADEIRA: descida empurra o carro (dá pra passar do top speed —
  // segura no freio), subida cobra potência. O limite por marcha logo abaixo
  // age como freio motor: descer em marcha baixa segura o carro sozinho.
  const grade = (seg.y2 - seg.y1) / SEG_LEN // ~±0.13 nas ladeiras fortes
  if (grade < 0) eng.speed += -grade * 210 * dt
  else eng.speed -= grade * 120 * dt

  const maxSpd = spec.topSpeed * (nitroActive ? 1.12 : 1) + (grade < 0 ? -grade * 420 : 0)
  eng.speed = clamp(eng.speed, 0, maxSpd)
  // limite por marcha (estourou o giro = não anda mais) — e freio motor na descida
  if (eng.gear >= 1) {
    const gearTop = (RPM_LIMITER - RPM_IDLE) / (GEAR_RATIOS[eng.gear - 1] * RPM_PER_KMH)
    eng.speed = Math.min(eng.speed, gearTop)
  }

  eng.position = ((eng.position + eng.speed * KMH2UPS * dt) % eng.trackLen + eng.trackLen) % eng.trackLen
  eng.km += eng.speed * dt / 3600

  if (eng.goFlashT > 0) eng.goFlashT -= dt
  if (eng.mult2T > 0) eng.mult2T -= dt
  if (eng.beamT > 0) eng.beamT -= dt
  if (eng.beamCdT > 0) eng.beamCdT -= dt

  // pontuação e combo
  const mult = (1 + eng.combo) * (eng.mult2T > 0 ? 2 : 1)
  eng.score += eng.speed * dt * 0.35 * mult
  if (eng.comboT > 0) { eng.comboT -= dt; if (eng.comboT <= 0) eng.combo = 0 }

  // a cada 10k pontos o jogo sobe de nível: rabeio comemorativo e trânsito mais bravo
  const newLevel = Math.floor(eng.score / 10000)
  if (newLevel > eng.level && eng.mode != "race") {
    eng.level = newLevel
    eng.levelUpT = 1.5
    eng.audio.levelUp()
    eng.floaters.push({ text: `NÍVEL ${newLevel + 1} — TRÂNSITO MAIS BRAVO!`, color: "#fb923c", y: H * 0.32, life: 2.2, big: true })
  }
  if (eng.levelUpT > 0) {
    eng.levelUpT -= dt
    if (Math.random() < 0.6) emitSmoke(eng, 2, "#e2e8f0")
  }

  // modo corrida: adianta bots/rede, conta voltas e aplica o empurrão entre
  // carros (autoridade local — eu me afasto, o cliente dele faz o mesmo)
  if (eng.race && eng.mode === "race") {
    const r = eng.race
    const voltaAntes = r.lap
    // os bots enxergam o MESMO trânsito que você: sem isso eles atravessavam
    // os carros e nunca eram segurados, então sumiam na frente
    r.update(dt, playerZ, eng.speed, eng.playerX, eng.crashed, eng.trackLen, {
      aFrente: (z, x, alcance) => {
        let melhor: { dz: number; v: number } | null = null
        for (const t of eng.traffic) {
          if (t.role === "oncoming") continue
          const dz = wrapDz(eng, t.z, z)
          if (dz <= 0 || dz > alcance) continue
          if (Math.abs(t.offset - x) > 0.32) continue
          if (!melhor || dz < melhor.dz) melhor = { dz, v: t.speed }
        }
        return melhor
      },
      faixaLivre: (z, x, alcance) => {
        for (const t of eng.traffic) {
          if (Math.abs(wrapDz(eng, t.z, z)) > alcance) continue
          if (Math.abs(t.offset - x) < 0.3 || Math.abs(t.targetOffset - x) < 0.3) return false
        }
        return true
      },
    })
    // cruzou a linha: anúncio grande, som e tremida — o jogador tem que
    // SENTIR que fechou uma volta, não descobrir olhando o placar
    // não anuncia na chegada: ali o lap vira voltas+1 e sairia "VOLTA 4/3"
    if (r.lap > voltaAntes && !r.finished) {
      const ultima = r.lap === r.cfg.voltas - 1
      eng.floaters.push({
        text: ultima ? "ÚLTIMA VOLTA!" : `VOLTA ${r.lap + 1}/${r.cfg.voltas}`,
        color: ultima ? "#ef4444" : "#fde047", y: H * 0.3, life: 2.2, big: true,
      })
      eng.floaters.push({
        text: `${r.minhaPosicao()}º lugar`,
        color: "#f8fafc", y: H * 0.38, life: 2, big: false,
      })
      eng.audio.levelUp()
      eng.shakeT = Math.max(eng.shakeT, 0.18)
    }
    if (!eng.crashed && eng.immuneT <= 0) {
      const spec0 = CARS[eng.cfg.carIdx]
      const shove = r.empurrao(playerZ, eng.playerX, (0.28 + spec0.width) / 2, eng.trackLen)
      if (shove !== 0) {
        eng.playerX += shove
        eng.steerVel += shove * 8
        eng.speed *= 0.94
        eng.shakeT = Math.max(eng.shakeT, 0.3)
        eng.immuneT = 0.5
        eng.audio.crash()
        burst(eng, W / 2 + Math.sign(shove) * 60, H - 110, 12, ["#fde047", "#e2e8f0"])
      }
    }
    // Cruzou a linha: ponto morto, coast até parar, e vira ESPECTADOR dos
    // rivais até a corrida acabar de verdade. NÃO retorna — o mundo continua
    // rodando (rivais correndo, seu carro desacelerando).
    if (r.finished) {
      if (!eng.raceFinished) {
        eng.raceFinished = true
        eng.raceSpectT = 0
        eng.gear = 0
        eng.nitroOn = false
        eng.floaters.push({ text: "🏁 CHEGOU!", color: "#fde047", y: H * 0.3, life: 2.4, big: true })
        eng.floaters.push({ text: `${r.minhaPosicao()}º lugar`, color: "#f8fafc", y: H * 0.38, life: 2.4, big: false })
      }
      eng.raceSpectT += dt
      // vai pro pódio quando TODOS os rivais terminam (ou um teto de 22 s pra
      // não travar se alguém ficar pra trás)
      const todosAcabaram = r.rivais.length > 0 && r.rivais.every((rv) => rv.finished)
      if (todosAcabaram || eng.raceSpectT > 22) { eng.state = "raceresult"; eng.fadeT = 0.22 }
    }
  }

  updateEventSpawner(eng, dt, playerZ)

  // powerups na pista
  eng.puTimer -= dt
  if (eng.puTimer <= 0) {
    eng.puTimer = 7 + Math.random() * 6
    eng.powerups.push({
      z: ((eng.position + DRAW_DIST * (0.55 + Math.random() * 0.3) * SEG_LEN) % eng.trackLen + eng.trackLen) % eng.trackLen,
      offset: eng.laneCenters[Math.floor(Math.random() * 4)],
      type: Math.floor(Math.random() * 3),
      pulse: 0,
    })
  }
  for (const p of eng.powerups) {
    p.pulse += dt * 6
    const d = wrapDz(eng, p.z, playerZ)
    if (!p.taken && Math.abs(d) < 160 && Math.abs(p.offset - eng.playerX) < 0.30) {
      p.taken = true
      eng.audio.pickup()
      if (p.type === PU_NITRO) { eng.nitroMeter = Math.min(100, eng.nitroMeter + 40); eng.floaters.push({ text: "+NOS", color: "#38bdf8", y: H * 0.45, life: 1, big: false }) }
      if (p.type === PU_SHIELD) { eng.shield = true; eng.floaters.push({ text: "ESCUDO!", color: "#60a5fa", y: H * 0.45, life: 1, big: false }) }
      if (p.type === PU_X2) { eng.mult2T = 8; eng.floaters.push({ text: "PONTOS EM DOBRO!", color: "#fde047", y: H * 0.45, life: 1.2, big: false }) }
    }
  }
  eng.powerups = eng.powerups.filter(p => !p.taken && wrapDz(eng, p.z, eng.position) > -20 * SEG_LEN)

  // fumaça de escape / arrancada
  if (throttle && eng.speed < 40 && eng.gear >= 1) emitSmoke(eng, 2, "#cbd5e1")
  else if (throttle && Math.random() < 0.3) emitSmoke(eng, 1, "#64748b")

  // clima
  eng.rainRollT += dt
  if (eng.rainRollT > 18) {
    eng.rainRollT = 0
    if (!eng.raining && Math.random() < 0.18) { eng.raining = true; eng.rainT = 22 + Math.random() * 20; initRain(eng); eng.audio.rain(true) }
  }
  if (eng.raining) {
    eng.rainT -= dt
    if (eng.rainT <= 0) { eng.raining = false; eng.audio.rain(false) }
  }

  updateTraffic(eng, dt, playerZ, false)
  updateZones(eng, dt, playerZ)
  updateObstacles(eng, playerZ)

  // aviso de curva fechada à frente
  eng.curveWarn = 0
  const lookStart = Math.floor(playerZ / SEG_LEN)
  for (let n = 25; n < 95; n++) {
    const s = eng.segments[(lookStart + n) % eng.segments.length]
    if (Math.abs(s.curve) >= 4) { eng.curveWarn = Math.sign(s.curve); eng.curveWarnDist = n; break }
  }
  eng.curveBeepT -= dt
  if (eng.curveWarn !== 0 && eng.curveWarnDist < 70 && eng.speed > 170 && eng.curveBeepT <= 0) {
    eng.curveBeepT = 1.1
    eng.audio.warn()
  }

  // aviso de colisão: veículo lento na sua faixa
  eng.collWarn = null
  let bestD = Infinity
  for (const t of eng.traffic) {
    const d = wrapDz(eng, t.z, playerZ)
    if (d > 200 && d < 3600 && Math.abs(t.offset - eng.playerX) < 0.30 && eng.speed > t.speed + 45 && d < bestD) {
      bestD = d
      eng.collWarn = t
    }
  }
  eng.collBeepT -= dt
  if (eng.collWarn && bestD < 2400 && eng.collBeepT <= 0) {
    eng.collBeepT = 0.65
    eng.audio.warn()
  }

  updateFx(eng, dt)
  eng.audio.engine(eng.rpm, throttle, nitroActive, true)
}
