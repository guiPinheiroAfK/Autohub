// AutoDash — traffic/spawner.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { burst } from "../fx/particles"
import { AutoDashEngine, PLAYER_Z, W, H } from "../engine"
import { DRAW_DIST, SEG_LEN, CARS } from "../data"
import { type TrafficKind, KINDS, TRAFFIC_COLORS, type WorldView } from "./types"
import { DRIVERS } from "./driver"

export function seedTraffic(eng: AutoDashEngine, count: number) {
  eng.traffic = []
  for (let i = 0; i < count; i++) spawnTraffic(eng, (i + 1) * (DRAW_DIST * SEG_LEN / count) + 6000)
}

export function spawnTraffic(eng: AutoDashEngine, relAhead: number) {
  const roll = Math.random()
  const kind: TrafficKind = roll < 0.52 ? "car" : roll < 0.68 ? "moto" : roll < 0.87 ? "truck" : "bus"
  const k = KINDS[kind]
  const lane = eng.laneCenters[Math.floor(Math.random() * 4)]
  const z = ((eng.position + relAhead) % eng.trackLen + eng.trackLen) % eng.trackLen
  // não nasce em cima de outro
  for (const t of eng.traffic) {
    if (Math.abs(t.offset - lane) < 0.3 && Math.abs(wrapDz(eng, t.z, z)) < k.len + KINDS[t.kind].len) return
  }
  eng.traffic.push({
    z, offset: lane, targetOffset: lane,
    speed: k.spd[0] + Math.random() * (k.spd[1] - k.spd[0]),
    kind, role: "civilian",
    color: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
    // prevD REAL (não o sentinela 1): a varredura de colisão compara prevD com
    // d pra saber se o veículo cruzou você neste frame. Com prevD=1, qualquer
    // carro atrás na sua faixa parecia "acabou de cruzar" e te matava na hora.
    blinkT: 0, prevD: wrapDz(eng, z, eng.position + PLAYER_Z),
  })
}

export function wrapDz(eng: AutoDashEngine, a: number, b: number) : number {
  let d = a - b
  if (d > eng.trackLen / 2) d -= eng.trackLen
  if (d < -eng.trackLen / 2) d += eng.trackLen
  return d
}

export function updateTraffic(eng: AutoDashEngine, dt: number, playerZ: number, demo: boolean) {
  // no circuito o desafio é o traçado, não a quantidade de carro: bem menos
  // trânsito, e sem escalar com nível (a corrida tem duração fixa em voltas)
  const target = eng.mode === "race"
      ? 5
      : 14 + Math.min(14, Math.floor(eng.km * 1.3)) + eng.level * 3
  if (eng.traffic.length < target) spawnTraffic(eng, DRAW_DIST * SEG_LEN * (0.6 + Math.random() * 0.4))
  if (eng.immuneT > 0) eng.immuneT -= dt
  if (eng.policeHitT > 0) eng.policeHitT -= dt

  const spec = CARS[eng.cfg.carIdx]
  // visão read-only do mundo que as IAs consomem (ver ./traffic/driver.ts)
  const world: WorldView = {
    traffic: eng.traffic,
    playerX: eng.playerX,
    playerZ,
    playerSpeed: eng.speed,
    trackLen: eng.trackLen,
    demo,
    wrapDz: (a, b) => wrapDz(eng, a, b),
  }
  for (const t of eng.traffic) {
    const k = KINDS[t.kind]
    // a IA do papel do veículo decide faixa/velocidade e o move
    // (estacionado não tem IA — cenografia de blitz)
    const spd = t.parked ? 0 : DRIVERS[t.role].drive(t, world, dt)

    const d = wrapDz(eng, t.z, playerZ)
    if (!demo) {
      // soma das meia-larguras (casa com os sprites), com margem de perdão de
      // arcade: um tico mais estreita que o teórico pra matar "bati no nada"
      const halfSum = (k.w + spec.width) / 2 * 0.85
      // colisão. Dois cooldowns SEPARADOS de propósito: immuneT (escudo) vale
      // contra tudo; policeHitT vale só contra viatura. Se o encostão desse
      // imunidade geral, ser jogado em cima do trânsito faria você atravessar
      // os carros — e é justamente aí que a perseguição tem que doer.
      // janela em Z OU cruzamento no frame (varredura): na contramão a
      // velocidade de fechamento passa de 600 unidades/frame e o veículo
      // atravessaria a janela entre dois frames sem nunca "estar" nela
      // ...e o salto tem que ser FISICAMENTE plausível pra um frame: sem isso,
      // um prevD errado (ou um veículo teleportado) vira "cruzou você agora"
      const swept = t.prevD > 0 && d <= 0 && t.prevD < 1200 && t.prevD - d < 2000
      const hit = (Math.abs(d) < k.len / 2 + 40 || swept) && Math.abs(t.offset - eng.playerX) < halfSum && !eng.crashed
      if (hit && t.role === "police" && !t.parked) {
        // Encostão de viatura NÃO mata: empurra pro lado. O engine só desenha
        // o que está à frente, então uma viatura atrás é invisível — morrer
        // por ela seria injusto. Ela te espreme até te jogar fora da pista,
        // e É ISSO que prende. Não consome escudo (não é batida letal).
        if (eng.immuneT <= 0 && eng.policeHitT <= 0) {
          const dir = Math.sign(eng.playerX - t.offset) || (Math.random() < 0.5 ? -1 : 1)
          eng.playerX += dir * 0.16
          eng.steerVel += dir * 1.4
          eng.speed *= 0.9
          eng.shakeT = Math.max(eng.shakeT, 0.4)
          eng.combo = 0
          // janela de recuperação: sem isso vira pinball, um encostão atrás do
          // outro sem o jogador conseguir voltar pra pista
          eng.policeHitT = 1.2
          // TODAS as viaturas recuam (não só a que bateu), senão a de trás
          // emenda o combo assim que o cooldown expira
          for (const o of eng.traffic) if (o.role === "police") o.backoffT = 1.3
          // acabou de levar encostão: obviamente não despistou ninguém
          eng.policeEscapeT = 0
          eng.audio.crash()
          burst(eng, W / 2 + dir * 60, H - 110, 14, ["#60a5fa", "#e2e8f0"])
          eng.floaters.push({ text: "ENCOSTÃO! 🚔", color: "#60a5fa", y: H * 0.42, life: 1, big: false })
          if (Math.abs(eng.playerX) > 1.05) eng.crash(true) // te jogaram pra fora = preso
        }
      } else if (hit && eng.immuneT <= 0) {
        if (eng.shield) {
          eng.shield = false
          eng.immuneT = 2.0
          t.dead = true
          eng.audio.shieldBreak()
          burst(eng, W / 2, H - 110, 20, ["#60a5fa", "#bfdbfe"])
          eng.floaters.push({ text: "ESCUDO QUEBROU!", color: "#60a5fa", y: H * 0.4, life: 1.3, big: false })
        } else {
          eng.crash()
        }
      }
      // near miss: acabou de passar por ele
      if (t.prevD > 0 && d <= 0 && !eng.crashed) {
        const gap = Math.abs(t.offset - eng.playerX)
        if (gap < halfSum + 0.20 && eng.speed > spd + 15) {
          eng.combo = Math.min(7, eng.combo + 1)
          eng.comboT = 4
          const mult = (1 + eng.combo) * (eng.mult2T > 0 ? 2 : 1)
          const pts = 200 * mult
          eng.score += pts
          eng.nitroMeter = Math.min(100, eng.nitroMeter + 14)
          eng.floaters.push({ text: `QUASE! +${pts}  x${mult}`, color: "#fde047", y: H * 0.42, life: 1.2, big: false })
          burst(eng, W / 2 + (t.offset > eng.playerX ? 72 : -72), H - 100, 9, ["#fde047", "#fff7c0"])
          eng.shakeT = Math.max(eng.shakeT, 0.08)
          eng.audio.nearMiss()
          if (Math.random() < 0.3) eng.audio.horn()
        }
      }
    }
    t.prevD = d

    // Recicla quem ficou muito longe — MAS a polícia é ENTIDADE, não população
    // de cenário: ela nunca é teleportada. Reciclar uma viatura que você
    // deixou pra trás a jogava lá na frente numa faixa aleatória, e ela caía
    // de volta em cima de você — era isso que parecia "pulo" depois de
    // ultrapassar. Quem perde a perseguição some pelo despiste, ali embaixo.
    // Estacionados (blitz) e contramão também não reciclam: cenografia que
    // ficou pra trás simplesmente some.
    if (t.parked || t.role === "oncoming") {
      const rel = wrapDz(eng, t.z, eng.position)
      if (rel < -40 * SEG_LEN || rel > (DRAW_DIST + 140) * SEG_LEN) t.dead = true
    } else if (t.role !== "police") {
      const rel = wrapDz(eng, t.z, eng.position)
      if (rel < -40 * SEG_LEN || rel > (DRAW_DIST + 80) * SEG_LEN) {
        t.z = ((eng.position + (DRAW_DIST * 0.55 + Math.random() * DRAW_DIST * 0.4) * SEG_LEN) % eng.trackLen + eng.trackLen) % eng.trackLen
        const lane = eng.laneCenters[Math.floor(Math.random() * 4)]
        t.offset = lane; t.targetOffset = lane
        const kk = KINDS[t.kind]
        t.speed = kk.spd[0] + Math.random() * (kk.spd[1] - kk.spd[0])
        t.prevD = wrapDz(eng, t.z, playerZ)
      }
    }
  }
  // despiste da polícia (protótipo do sistema tipo "estrelas" do GTA): se o
  // jogador mantém distância grande de TODAS as viaturas por alguns segundos,
  // elas desistem. Fugir = abrir gap em reta limpa ou perder eles no trânsito.
  if (!demo) {
    let nearestPolice = Infinity
    let hasPolice = false
    let anyBackoff = false
    for (const t of eng.traffic) {
      if (t.role !== "police" || t.parked) continue // estacionada não é perseguição
      hasPolice = true
      if (t.backoffT && t.backoffT > 0) anyBackoff = true
      nearestPolice = Math.min(nearestPolice, Math.abs(wrapDz(eng, t.z, playerZ)))
    }
    if (hasPolice) {
      eng.policeChaseT += dt
      // aquecimento: nos primeiros segundos a caçada não pode ser despistada —
      // elas acabaram de chegar, insistem. Recuo pós-encostão também não conta
      // como fuga: elas aliviaram, você não escapou.
      if (nearestPolice > 10000 && !anyBackoff && eng.policeChaseT > 6) {
        eng.policeEscapeT += dt
        if (eng.policeEscapeT >= 3) {
          for (const t of eng.traffic) if (t.role === "police") t.dead = true
          eng.floaters.push({ text: "DESPISTOU A POLÍCIA! 🚔💨", color: "#4ade80", y: H * 0.34, life: 2.4, big: true })
          eng.audio.levelUp()
          eng.policeEscapeT = 0
        }
      } else {
        eng.policeEscapeT = Math.max(0, eng.policeEscapeT - dt * 0.5)
      }
    } else {
      eng.policeEscapeT = 0
      eng.policeChaseT = 0
    }
  }

  if (eng.traffic.some(t => t.dead)) eng.traffic = eng.traffic.filter(t => !t.dead)
}
