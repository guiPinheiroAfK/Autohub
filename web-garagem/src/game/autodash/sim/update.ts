// AutoDash — sim/update.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, PLAYER_Z, H, W, PU_NITRO, PU_SHIELD, PU_X2 } from "../engine"
import { CARS, KMH2UPS, SEG_LEN, DRAW_DIST } from "../data"
import { fatorMarcha } from "../physics/cambio"
import { duelNet } from "../modes/duel"
import { startRace } from "../modes/race"
import { segAt } from "../world/track"
import { updateTraffic, wrapDz } from "../traffic/spawner"
import { updateFx, emitSmoke, emitEscape, burst } from "../fx/particles"
import { climaAtual, tickTempo } from "./clima"
import { perfilDoCarro, REV_AMOSTRA_S } from "../sound/profiles"
import { motorDe, giroNaFrac, boostAlvo, passoBoost, giroSolto, suavizarGiro, giroDoSom, rampaGas, SOLTO_SOBE_S } from "../physics/motores"
import { launch } from "../modes/solo"
import { clamp } from "../math"
import { powerCurve, giroVisto } from "../physics/rpm"
import { steerK, tyreOf } from "../physics/traction"
import { passoLongitudinal } from "./longitudinal"
import { passoCamera } from "../render/camera"
import { updateEventSpawner } from "../world/events"
import { updateZones } from "../world/zones"
import { updateObstacles } from "../world/obstacles"
import { atualizarPolicia, aderenciaPolicia } from "../world/policia"
import { ramalNoSeg, sobreRamal, ganhoRamal, ramalCentro, elevacao, elevacaoEm } from "../world/ramais"

// altura (unidades de mundo) a partir da qual o elevado tem mureta
const MURETA_ALT = 150
export const ELEV_LADEIRA = 0.6 // fração da rampa do elevado que vira ladeira na física
import { atualizarCombustivel, peDoCombustivel } from "../world/posto"
import { passoDrift, perderDrift } from "../world/drift"
import { emDuelo } from "../world/touge"
import { atualizarRacha } from "../modes/racha"
import { atualizarObras } from "../world/obra"
import { atualizarComboio } from "../world/comboio"
import { atualizarAvisos } from "../world/avisos"
import { aderenciaOleo, passoOleo } from "../world/oleo"
import { giroDaPartida } from "./partida"
import { aplicarVacuo, specComVacuo, forcaTeto } from "./vacuo"
import { atualizarSomEventos } from "../world/somEventos"
import { regiaoPorDistancia } from "../world/regiao"

export function update(eng: AutoDashEngine, dt: number) {
  // câmera lenta do duelo de touge (world/touge.ts): o mundo inteiro anda mais devagar
  if (eng.state === "racing" && eng.escalaTempo < 1) dt *= eng.escalaTempo
  const spec = CARS[eng.cfg.carIdx]
  const voice = AutoDashEngine.ENGINE_VOICE[spec.body] ?? [1, 1]
  eng.audio.setEngine(voice[0], voice[1])
  eng.audio.setProfile(perfilDoCarro(spec.body, eng.cfg.customs[eng.cfg.carIdx]?.motor))
  // lado físico do mesmo motor: lenta, faixa vermelha, corte, curva e turbo
  const mf = motorDe(eng)
  eng.audio.setTurbo(mf.turbo, mf.corte)
  eng.somT += dt // relógio do som (limitador batendo, lenta irregular)
  passoCamera(eng, dt) // trauma, ruído e rampa do nitro da câmera

  duelNet(eng, dt)

  // sala de espera: consulta quem entrou e detecta a largada dada pelo dono
  if (eng.state === "racewait" && eng.race) {
    eng.race.update(dt, 0, 0, 0, false, eng.trackLen)
    if (eng.race.phase === "countdown") { startRace(eng, eng.race.cfg.seed) }
  }

  // reconhecimento de percurso: a câmera faz uma volta sozinha (sem rivais nem trânsito)
  if (eng.state === "racerecon") {
    eng.demoT += dt
    eng.speed = 200
    eng.position = (eng.position + eng.speed * KMH2UPS * dt) % eng.trackLen
    eng.playerX = 0
    eng.bgShift += segAt(eng, eng.position + PLAYER_Z).curve * eng.speed * dt * 0.6
    updateFx(eng, dt)
    eng.audio.engine(0, 0, false, false)
    return
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
    if (eng.state === "garage" && eng.revAmostraT > 0) acelerarAmostra(eng, dt)
    else eng.audio.engine(0, 0, false, false)
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
  // duelo de touge (playtest 16/11: "o carro perde velocidade demais sem trocar de
  // marcha; tinha que acelerar sozinho e ir trocando"): o gás é automático (só o
  // freio tira) e o câmbio vira automático (sim/longitudinal.ts)
  if (emDuelo(eng) && !braking) throttle = 1
  // pane seca (Fase 5): sem combustível o motor engasga e o pé efetivo cai
  throttle *= peDoCombustivel(eng)

  if (eng.state === "countdown" && eng.partidaT > 0) {
    // partida: só animação. Sem semáforo, sem pé no gás, motor mudo até pegar
    eng.partidaT = Math.max(0, eng.partidaT - dt)
    eng.gasF = rampaGas(mf, eng.gasF, 0, dt)
    eng.rpm = giroDaPartida(mf.idle, eng.partidaT)
    eng.boost = 0; eng.eixo = 0
    eng.giroSom = eng.rpm
    eng.audio.engine(eng.rpm, 0, false, eng.partidaT <= 0, false, 0)
    updateFx(eng, dt)
    return
  }

  if (eng.state === "countdown") {
    eng.countT += dt
    eng.gasF = rampaGas(mf, eng.gasF, throttle, dt) // pé no fundo no grid: no verde já está em 1
    // rev livre no grid
    const targetRpm = mf.idle + throttle * (mf.corte + 20 - mf.idle) // pé no fundo bate no corte (antes parava em 94% da faixa)
    // giro solto: motor leve sobe e cai rápido, motor pesado é preguiçoso
    eng.rpm = giroSolto(mf, eng.rpm, targetRpm, dt)
    if (eng.rpm > mf.corte) eng.rpm = mf.corte // o bate-volta do corte é do som e do ponteiro (giroDoSom)
    // em ponto morto o turbo quase não enche (sem carga)
    eng.boost = passoBoost(mf, eng.boost, boostAlvo(mf, eng.rpm, throttle) * 0.35, dt, eng.rpm)
    eng.eixo = eng.boost // no verde o eixo parte da pressão do grid
    // burnout no grid: acelerando no ponto morto, pneu fuma (só na corrida)
    if (eng.mode === "race" && throttle > 0.5 && eng.rpm > giroNaFrac(mf, 0.514) && Math.random() < 0.6) {
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
    const corteGrid = eng.rpm >= mf.corte - 60
    eng.giroSom = suavizarGiro(eng.giroSom, eng.rpm, dt)
    eng.audio.engine(giroDoSom(mf, eng.giroSom, throttle, corteGrid, eng.somT), throttle, false, true, corteGrid, eng.boost)
    updateFx(eng, dt)
    return
  }

  // ---------- racing ----------
  // óleo (E15): aderência cai por um instante em cima da mancha; pneu furado
  // pelos pregos (Fase 6) também
  const grip = spec.grip * tyreOf(spec).grip * climaAtual(eng).grip * aderenciaOleo(eng) * aderenciaPolicia(eng)
  const playerZ = eng.position + PLAYER_Z
  const seg = segAt(eng, playerZ)
  // ramal (atalho) neste ponto da pista, se houver (ADR 0014). Sem ramais: null.
  const ramal = eng.ramais.length
    ? ramalNoSeg(eng.ramais, Math.floor(playerZ / SEG_LEN) % eng.segments.length) : null

  // direção — input suavizado, mais firme em alta velocidade
  let steerInput = 0
  if (eng.cfg.steering === "mouse") {
    steerInput = clamp(((eng.mouseXn * 2 - 1) * 1.25 - eng.playerX) * 2.2, -1, 1)
  } else {
    if (eng.keys.has("a") || eng.keys.has("arrowleft") || eng.touchSteerLeft) steerInput -= 1
    if (eng.keys.has("d") || eng.keys.has("arrowright") || eng.touchSteerRight) steerInput += 1
  }
  const speedF = Math.min(1, eng.speed / 240)
  // tração na direção: dianteira com torque abre a curva no gás e fecha ao aliviar
  // (ADR 0012). Usa o giro do quadro anterior; RWD devolve 1 e nada muda.
  const aNdir = throttle && eng.gear >= 1 && eng.shiftT <= 0
    ? powerCurve(eng, eng.rpm) * fatorMarcha(eng, eng.gear) : 0
  const maxSteer = (0.95 + grip * 0.85) * (1 - 0.38 * speedF) * (0.35 + 0.65 * Math.min(1, eng.speed / 55)) * steerK(spec, aNdir)
  eng.steerVel += (steerInput * maxSteer - eng.steerVel) * Math.min(1, dt * 9)
  if (eng.levelUpT > 0) eng.steerVel += Math.sin(eng.levelUpT * 22) * 0.9 * dt // rabeio da virada de nível
  eng.playerX += eng.steerVel * dt

  // força centrífuga — curva média se segura no volante; fechada em vmax pede freio
  const centrif = seg.curve * Math.pow(eng.speed / 240, 2.2) * (0.42 - grip * 0.22)
  eng.playerX -= centrif * dt
  // drift com freio de mão (world/drift.ts): segura parte da curva, fuma e pontua
  const drift = passoDrift(eng, dt, steerInput, seg.curve, centrif)
  const slip = Math.abs(centrif) * speedF
  // chiado de curva ou de patinada no gás (eng.patina, do quadro anterior)
  eng.audio.skid(Math.max(slip > 0.3 ? slip : 0, eng.patina, eng.oleoT > 0 ? 0.6 : 0, drift))
  passoOleo(eng, dt)
  if (slip > 0.45 && Math.abs(eng.steerVel) > 0.3 && Math.random() < 0.5) emitSmoke(eng, 1, "#6b7280")
  eng.bgShift += seg.curve * eng.speed * dt * 0.6

  // transferência de peso: sobe o bico na freada, agacha no gás
  const pitchTarget = braking && eng.speed > 20 ? -4 : throttle ? 1.5 : 0
  eng.pitchY += (pitchTarget - eng.pitchY) * Math.min(1, dt * 8)

  // fora da pista
  if (Math.abs(eng.playerX) > 1.05 && !(ramal && sobreRamal(ramal, eng.playerX))) {
    eng.offroadT += dt
    perderDrift(eng)
    eng.speed = Math.max(Math.min(eng.speed, 60), eng.speed - 160 * dt)
    eng.shakeT = 0.1
    eng.combo = 0
    if (Math.random() < 0.3) eng.audio.offroad()
    emitSmoke(eng, 3, "#a3a3a3")
  } else eng.offroadT = 0
  if (ramal) {
    // do lado do ramal a pista é mais larga: o limite vai até depois dele
    const lim = Math.max(1.6, ramal.outer + 0.45)
    eng.playerX = ramal.r.lado > 0 ? clamp(eng.playerX, -1.6, lim) : clamp(eng.playerX, -lim, 1.6)
  } else eng.playerX = clamp(eng.playerX, -1.6, 1.6)

  // elevado do viaduto (Fase 8.6): mureta dos dois lados enquanto está alto. Em
  // cima, não cai; embaixo, não entra nos pilares. Raspar na mureta segura o carro.
  const idxP = Math.floor(playerZ / SEG_LEN) % eng.segments.length
  if (ramal && ramal.r.alto && elevacao(ramal.r, idxP) > MURETA_ALT) {
    const xs = eng.playerX * ramal.r.lado
    // em cima = já estava no tabuleiro no quadro anterior (entra pela rampa,
    // ainda baixa, e a partir daí a mureta segura)
    const emCima = eng.elevJogador > 0
    const c = emCima ? clamp(xs, ramal.inner + 0.06, ramal.outer - 0.06) : Math.min(xs, ramal.inner - 0.12)
    if (c !== xs) {
      eng.playerX = c * ramal.r.lado
      eng.speed = Math.max(0, eng.speed - 90 * dt)
      eng.steerVel *= 0.3
      eng.shakeT = Math.max(eng.shakeT, 0.12)
      if (Math.random() < 0.5) emitSmoke(eng, 2, "#fde047")
    }
  }
  eng.elevJogador = elevacaoEm(eng.ramais, idxP, eng.playerX)

  // ---------- motor, câmbio, força e velocidade (sim/longitudinal.ts) ----------
  // ~±0.13 nas ladeiras fortes. Em cima do elevado soma a rampa dele (playtest
  // 16/11: "saindo do viaduto o carro nem embala"): antes a altura do elevado
  // era só da câmera. ELEV_LADEIRA amacia a rampa (até ~0,18 no meio dela).
  let grade = (seg.y2 - seg.y1) / SEG_LEN
  if (ramal && ramal.r.alto && eng.elevJogador > 0) grade += ELEV_LADEIRA * (elevacao(ramal.r, idxP + 1) - elevacao(ramal.r, idxP)) / SEG_LEN
  // vácuo (E9) do quadro anterior sobe o teto em até 4% (sim/vacuo.ts)
  const nitroActive = passoLongitudinal(eng, specComVacuo(spec, forcaTeto(eng)), mf, { throttle, braking, centrif, grade, dt })
  // combustível (só no solo): gasta pelo pé, giro e nitro; abastece no posto
  atualizarCombustivel(eng, dt, eng.gasF, nitroActive)
  // vácuo (E9): colado atrás de alguém rápido, empurrão até +4% da máxima
  aplicarVacuo(eng, spec, throttle, dt)

  // no miolo do ramal o avanço rende mais (linha de dentro). Fora dele, ganho = 1.
  const ganho = ganhoRamal(ramal, eng.playerX)
  if (ganho !== 1 && !eng.noRamal && ramal) {
    const pct = Math.round((ganho - 1) * 100)
    eng.floaters.push({
      text: `${ramal.r.nome.toUpperCase()}  ${pct >= 0 ? "+" : ""}${pct}%`,
      color: "#4ade80", y: H * 0.3, life: 1.6, big: false,
    })
  }
  eng.noRamal = ganho !== 1
  eng.position = ((eng.position + eng.speed * KMH2UPS * dt * ganho) % eng.trackLen + eng.trackLen) % eng.trackLen
  eng.km += eng.speed * dt / 3600
  regiaoPorDistancia(eng, dt) // a região dura uma distância (world/regiao.ts)

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
      ramal: (z) => {
        if (!eng.ramais.length) return null
        const idx = Math.floor(z / SEG_LEN) % eng.segments.length
        const q = ramalNoSeg(eng.ramais, idx)
        if (!q) return null
        return {
          centro: ramalCentro(q), ganho: q.r.ganho, miolo: q.p.f > 0.5,
          voltar: idx > (q.r.a + q.r.b) / 2 && q.p.f === 0,
        }
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
  atualizarAvisos(eng, dt, playerZ)
  atualizarRacha(eng, dt) // convite de racha (Fase 5, só no solo)

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
  if (throttle && eng.speed < 40 && eng.gear >= 1) emitEscape(eng, 2, "#cbd5e1")
  else if (throttle && Math.random() < 0.3) emitEscape(eng, 1, "#64748b")

  // relógio e clima (ADR 0013): o clima só vira na janela de ticks
  tickTempo(eng, dt)

  updateTraffic(eng, dt, playerZ, false)
  updateZones(eng, dt, playerZ)
  atualizarObras(eng, dt, playerZ)              // E4: trânsito sai do lado fechado
  atualizarComboio(eng, dt, playerZ, eng.rngEv) // E6: a fresta anda
  atualizarSomEventos(eng, dt, playerZ)          // Fase 8.3: britadeira, buzina a ar, sirene
  updateObstacles(eng, playerZ)
  atualizarPolicia(eng, dt, playerZ)

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
  const noCorte = throttle > 0 && eng.rpm >= mf.corte - 60
  eng.giroSom = suavizarGiro(eng.giroSom, eng.rpm, dt)
  eng.audio.engine(giroDoSom(mf, giroVisto(eng), throttle, noCorte, eng.somT), throttle, nitroActive, true, noCorte, eng.boost, eng.gear >= 1 && eng.shiftT > 0)
}

// Acelerada de amostra na garagem: lenta, pé no fundo até ~6800 rpm e solta
// (dá pra ouvir o ronco, o turbo aliviando e os estouros do motor escolhido).
function acelerarAmostra(eng: AutoDashEngine, dt: number) {
  eng.revAmostraT = Math.max(0, eng.revAmostraT - dt)
  const e = REV_AMOSTRA_S - eng.revAmostraT
  // lenta → pé no fundo até o corte (na rapidez de giro do motor) → segura no
  // limitador → solta e o giro cai na rapidez do motor
  const m = motorDe(eng), solto = m.solto ?? [5, 5]
  const sobe = 0.15 + SOLTO_SOBE_S / solto[0], segura = sobe + 0.45 // mesma subida do giro solto (giroSolto)
  let rpm = m.idle, gas = 0, corte = false
  if (e > 0.15 && e < sobe) { gas = 1; rpm = m.idle + (m.corte - m.idle) * Math.pow((e - 0.15) / (sobe - 0.15), 0.85) }
  else if (e >= sobe && e < segura) { gas = 1; rpm = m.corte; corte = true }
  else if (e >= segura) rpm = m.idle + (m.corte - m.idle) * Math.exp(-(e - segura) * solto[1] * 0.8)
  eng.audio.engine(giroDoSom(m, rpm, gas, corte, eng.somT), gas, false, true, corte, -1)
}
