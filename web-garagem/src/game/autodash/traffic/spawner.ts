// AutoDash — traffic/spawner.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { crash } from "../modes/solo"
import { burst } from "../fx/particles"
import { AutoDashEngine, PLAYER_Z, W, H } from "../engine"
import { DRAW_DIST, SEG_LEN, CARS } from "../data"
import { type TrafficKind, KINDS, TRAFFIC_COLORS, type WorldView } from "./types"
import { DRIVERS } from "./driver"
import { segAt } from "../world/track"
import { RACHA } from "../world/racha"
import { infracao } from "../world/policia"
import { perderDrift } from "../world/drift"
import { emDuelo } from "../world/touge"
import { intensidade, carrosAlvo, chanceOnda, tipoPorIntensidade, estagio, INTENSIDADE } from "./intensidade"
import { FECHA_Z, faixasDoCivil, indiceFaixa, inicioMaoDupla, naMaoDupla } from "./faixas"

export function seedTraffic(eng: AutoDashEngine, count: number) {
  eng.traffic = []
  for (let i = 0; i < count; i++) spawnTraffic(eng, (i + 1) * (DRAW_DIST * SEG_LEN / count) + 6000)
}

/**
 * O desafiante do racha anda na beirada da janela onde o trânsito nasce. Um
 * carro que nasce (ou é reciclado) logo à frente dele na mesma faixa não dá
 * tempo de frear e ele entra no carro. Fica livre a distância de freio dele.
 */
export function naFrenteDoRacha(eng: AutoDashEngine, z: number, lane: number): boolean {
  for (const t of eng.traffic) {
    if (t.role !== "racha") continue
    if (Math.abs(t.offset - lane) > 0.55 && Math.abs(t.targetOffset - lane) > 0.55) continue
    const d = wrapDz(eng, z, t.z)
    if (d > -600 && d < RACHA.livreNaFrente) return true
  }
  return false
}

export function spawnTraffic(eng: AutoDashEngine, relAhead: number) {
  const ki = intensidade(eng)
  // onda: 2 ou 3 veículos lado a lado, sobrando uma faixa (fica mais comum com os pontos)
  if (eng.mode !== "race" && Math.random() < chanceOnda(ki)) { spawnOnda(eng, relAhead, ki); return }
  const kind: TrafficKind = eng.mode === "race"
    ? (Math.random() < 0.7 ? "car" : "truck")
    : tipoPorIntensidade(ki, Math.random())
  const k = KINDS[kind]
  const z = ((eng.position + relAhead) % eng.trackLen + eng.trackLen) % eng.trackLen
  const lane = sortearFaixa(eng, z)
  // não nasce em cima de outro nem na cara do desafiante do racha
  if (naFrenteDoRacha(eng, z, lane) || fechariaTudo(eng, z, lane)) return
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

/**
 * Nascer em `lane` no ponto `z` fecharia as 4 faixas? (as outras 3 já têm alguém
 * a menos de FECHA_Z): o trânsito bravo nunca vira parede, sempre sobra uma.
 */
function fechariaTudo(eng: AutoDashEngine, z: number, lane: number): boolean {
  const ocupadas = new Set<number>([indiceFaixa(lane)])
  for (const t of eng.traffic) {
    if (t.parked || Math.abs(wrapDz(eng, t.z, z)) > FECHA_Z) continue
    ocupadas.add(indiceFaixa(t.offset))
    ocupadas.add(indiceFaixa(t.targetOffset))
  }
  return faixasDoCivil(naMaoDupla(eng, z)).every(f => ocupadas.has(f))
}

/** Sorteia uma faixa onde o civil pode nascer em `z` (na mão dupla, só as da direita). */
function sortearFaixa(eng: AutoDashEngine, z: number): number {
  const ok = faixasDoCivil(naMaoDupla(eng, z))
  return eng.laneCenters[ok[Math.floor(Math.random() * ok.length)]]
}

/** Onda (bíblia de cenários 1.5): um pelotão lado a lado no mesmo ritmo, com uma faixa livre. */
function spawnOnda(eng: AutoDashEngine, relAhead: number, ki: number) {
  const n = ki > 0.5 && Math.random() < 0.6 ? 3 : 2
  const livre = Math.floor(Math.random() * 4)
  const faixas = [0, 1, 2, 3].filter(i => i !== livre).sort(() => Math.random() - 0.5).slice(0, n)
  const z0 = ((eng.position + relAhead) % eng.trackLen + eng.trackLen) % eng.trackLen
  const vel = 82 + Math.random() * 22
  for (const f of faixas) {
    const lane = eng.laneCenters[f]
    const kind = tipoPorIntensidade(ki, Math.random())
    const z = ((z0 + Math.random() * 500) % eng.trackLen + eng.trackLen) % eng.trackLen
    if (!faixasDoCivil(naMaoDupla(eng, z)).includes(f)) continue // a esquerda da mão dupla é contramão
    if (naFrenteDoRacha(eng, z, lane) || fechariaTudo(eng, z, lane)) continue
    if (eng.traffic.some(t => Math.abs(t.offset - lane) < 0.3 && Math.abs(wrapDz(eng, t.z, z)) < KINDS[kind].len + KINDS[t.kind].len)) continue
    eng.traffic.push({
      z, offset: lane, targetOffset: lane, speed: kind === "truck" ? Math.min(vel, 86) : vel, kind, role: "civilian",
      color: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
      blinkT: 0, prevD: wrapDz(eng, z, eng.position + PLAYER_Z),
    })
  }
}

export function wrapDz(eng: AutoDashEngine, a: number, b: number) : number {
  let d = a - b
  if (d > eng.trackLen / 2) d -= eng.trackLen
  if (d < -eng.trackLen / 2) d += eng.trackLen
  return d
}

const ultimaBuzina = new WeakMap<AutoDashEngine, number>()

export function updateTraffic(eng: AutoDashEngine, dt: number, playerZ: number, demo: boolean) {
  // no circuito o desafio é o traçado, não a quantidade de carro: bem menos
  // trânsito, e sem escalar com nível (a corrida tem duração fixa em voltas)
  // solo: a quantidade (e o jeito) segue a intensidade pelos pontos (traffic/intensidade.ts)
  const ki = intensidade(eng)
  const target = eng.testeMotor ? 0 : eng.mode === "race"
      ? 5
      : carrosAlvo(ki) + Math.min(4, Math.floor(eng.km * 0.4))
  if (eng.mode === "solo" && !demo) {
    const e = estagio(ki)
    if (e > eng.estagioTransito) {
      const s = INTENSIDADE.estagios[e]
      eng.floaters.push({ text: `TRÂNSITO ${s.nome}`, color: s.cor, y: H * 0.4, life: 2, big: true })
    }
    eng.estagioTransito = e
  }
  if (eng.traffic.length < target && !emDuelo(eng)) spawnTraffic(eng, DRAW_DIST * SEG_LEN * (0.6 + Math.random() * 0.4))
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
    maoDupla: z => naMaoDupla(eng, z),
    inicioMaoDupla: z => inicioMaoDupla(eng, z),
    obstaculos: eng.obstacles,
    curvaEm: z => segAt(eng, z).curve,
    intensidade: ki,
    // civil preso atrás de você: uma buzina por vez, no máximo a cada 1,2 s
    buzinar: () => {
      if (eng.somT - (ultimaBuzina.get(eng) ?? -9) < 1.2) return
      ultimaBuzina.set(eng, eng.somT)
      eng.audio.buzinaCivil()
    },
  }
  for (const t of eng.traffic) {
    const k = KINDS[t.kind]
    // a IA do papel do veículo decide faixa/velocidade e o move
    // (estacionado não tem IA — cenografia de blitz)
    const spd = t.parked ? 0 : DRIVERS[t.role].drive(t, world, dt)
    t.vReal = spd

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
          eng.combo = 0; perderDrift(eng) // encostão ou cone no meio do drift perde os pontos
          // janela de recuperação: sem isso vira pinball, um encostão atrás do
          // outro sem o jogador conseguir voltar pra pista
          eng.policeHitT = 1.2
          // TODAS as viaturas recuam (não só a que bateu), senão a de trás
          // emenda o combo assim que o cooldown expira
          for (const o of eng.traffic) if (o.role === "police") o.backoffT = 1.3
          // acabou de levar encostão: obviamente não despistou ninguém
          eng.policeEscapeT = 0
          infracao(eng, "encostao") // resistir esquenta (Fase 6)
          eng.audio.crash()
          burst(eng, W / 2 + dir * 60, H - 110, 14, ["#60a5fa", "#e2e8f0"])
          eng.floaters.push({ text: "ENCOSTÃO! 🚔", color: "#60a5fa", y: H * 0.42, life: 1, big: false })
          if (Math.abs(eng.playerX) > 1.05) crash(eng, true) // te jogaram pra fora = preso
        }
      } else if (hit && t.role === "racha") {
        // desafiante do racha: encostar empurra e custa velocidade, não mata
        // (é disputa lado a lado, e ele fecha a porta de propósito — E7)
        if (eng.immuneT <= 0) {
          const dir = Math.sign(eng.playerX - t.offset) || 1
          eng.playerX += dir * 0.12
          eng.steerVel += dir * 1.0
          eng.speed *= 0.93
          t.speed *= 0.97
          eng.shakeT = Math.max(eng.shakeT, 0.3)
          eng.immuneT = 0.5
          eng.combo = 0; perderDrift(eng) // encostão ou cone no meio do drift perde os pontos
          eng.audio.crash()
          burst(eng, W / 2 + dir * 60, H - 110, 12, ["#fde047", "#e2e8f0"])
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
          crash(eng, t.role === "police") // viatura parada (blitz, bloqueio) = preso
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
    if (t.parked || t.role === "oncoming" || t.role === "comboio") {
      const rel = wrapDz(eng, t.z, eng.position)
      // o limite à frente passa do ponto em que os eventos nascem (1,7 × a
      // distância de desenho, world/events.ts): com DRAW_DIST + 140 as viaturas
      // da blitz e do radar morriam no quadro em que nasciam. +300: os carros do
      // posto ficam no meio dele, ~250 segmentos depois do começo (Fase 8.2)
      if (rel < -40 * SEG_LEN || rel > (DRAW_DIST * 2 + 300) * SEG_LEN) t.dead = true
    } else if (t.role === "civilian" && !t.viaduto && !t.posto && !t.saindoPosto) {
      // civil que ficou longe: sai de cena e o spawnTraffic repõe, com as regras
      // de nascimento (sem nascer em cima de outro, sem fechar as 4 faixas, sem
      // cair na contramão). Antes ele era teleportado numa faixa sorteada às cegas.
      const rel = wrapDz(eng, t.z, eng.position)
      if (rel < -40 * SEG_LEN || rel > (DRAW_DIST + 80) * SEG_LEN) t.dead = true
    } else if (t.role !== "police" && t.role !== "racha") {
      const rel = wrapDz(eng, t.z, eng.position)
      if (rel < -40 * SEG_LEN || rel > (DRAW_DIST + 80) * SEG_LEN) {
        t.z = ((eng.position + (DRAW_DIST * 0.55 + Math.random() * DRAW_DIST * 0.4) * SEG_LEN) % eng.trackLen + eng.trackLen) % eng.trackLen
        let lane = sortearFaixa(eng, t.z)
        // na cara do desafiante: outra faixa (só sorteia de novo se houver racha)
        for (let k = 0; k < 4 && naFrenteDoRacha(eng, t.z, lane); k++) lane = eng.laneCenters[(eng.laneCenters.indexOf(lane) + 1) % 4]
        if (naFrenteDoRacha(eng, t.z, lane)) t.z = ((t.z - RACHA.livreNaFrente * 2) % eng.trackLen + eng.trackLen) % eng.trackLen
        t.offset = lane; t.targetOffset = lane
        t.viaduto = undefined; t.presoT = 0 // reciclado não leva o estado de antes
        const kk = KINDS[t.kind]
        t.speed = kk.spd[0] + Math.random() * (kk.spd[1] - kk.spd[0])
        t.prevD = wrapDz(eng, t.z, playerZ)
      }
    }
  }
  // despiste, calor e estrelas da polícia: world/policia.ts (atualizarPolicia)

  if (eng.traffic.some(t => t.dead)) eng.traffic = eng.traffic.filter(t => !t.dead)
}
