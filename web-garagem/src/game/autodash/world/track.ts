// AutoDash — world/track.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, type Seg } from "../engine"
import { mulberry32 } from "../math"
import { SEG_LEN } from "../data"
import { biomeById, biomeDaCorrida } from "./biomes"
import { gerarTrechos } from "./cenario"

export function buildTrack(eng: AutoDashEngine, seed = Math.floor(Math.random() * 2 ** 31), corrida = false) {
  const rnd = mulberry32(seed)
  // bioma: a corrida usa o bioma fixo do lobby; o solo usa a escolha do jogador
  eng.bioma = corrida ? biomeDaCorrida() : biomeById(eng.cfg.biome)
  // pista procedural não tem circuito fixo, ramais nem trechos com nome
  eng.pistaId = null; eng.ramais = []; eng.trechos = []
  eng.segments = []
  let lastY = 0
  const seg = (curve: number, y: number) => { eng.segments.push({ curve, y1: lastY, y2: y }); lastY = y }
  const easeIO = (a: number, b: number, p: number) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5)
  // traçado do bioma (Fase 8.5): só no corpo da pista procedural do solo, nunca na
  // reta de largada nem no fechamento do loop. Sem `tracado`, nada muda.
  const tr = corrida ? undefined : eng.bioma.tracado
  let comTracado = false
  const addRoad = (enter: number, hold: number, leave: number, curve: number, dy: number) => {
    if (comTracado && tr) {
      curve *= tr.curva; dy *= tr.morro
      if (curve === 0) hold = Math.round(hold * tr.reta)
    }
    const y0 = lastY, total = enter + hold + leave
    let i = 0
    for (let n = 0; n < enter; n++, i++) seg(curve * (n / enter), easeIO(y0, y0 + dy, i / total))
    for (let n = 0; n < hold; n++, i++) seg(curve, easeIO(y0, y0 + dy, i / total))
    for (let n = 0; n < leave; n++, i++) seg(curve * (1 - n / leave), easeIO(y0, y0 + dy, i / total))
  }
  const r = (lo: number, hi: number) => lo + rnd() * (hi - lo)
  const ri = (lo: number, hi: number) => Math.floor(r(lo, hi + 1))

  addRoad(30, 80, 30, 0, 0) // reta de largada
  // ~3200 segmentos = volta de ~35 s a 210 km/h. Com 1800 a volta durava 14 s
  // e o jogador nem percebia que tinha fechado uma — parecia que a corrida
  // acabava sozinha.
  const alvoSegs = corrida ? 3200 : 4000
  comTracado = true
  while (eng.segments.length < alvoSegs) {
    const roll = rnd()
    const hill = r(-1, 1) * r(600, 2600)
    if (corrida) {
      // Circuito de VELOCIDADE: retas longas pra esticar marcha e curvas que
      // dá pra fazer em ritmo. O grampo saiu — fazer um U a 200 km/h não é
      // corrida, é parede; e a entrada larga das curvas dá tempo de frear.
      if (roll < 0.42) addRoad(30, ri(120, 240), 30, 0, r(-1, 1) * r(300, 1100)) // retão
      else if (roll < 0.72) {
        const c = (rnd() < 0.5 ? -1 : 1) * r(2.5, 4.2)           // curva aberta
        addRoad(ri(26, 40), ri(40, 80), ri(26, 40), c, hill * 0.45)
      } else if (roll < 0.92) {
        const c = (rnd() < 0.5 ? -1 : 1) * r(3, 4.8)             // esse suave
        addRoad(22, ri(30, 50), 22, c, hill * 0.3)
        addRoad(22, ri(30, 50), 22, -c, -hill * 0.3)
      } else {
        const c = (rnd() < 0.5 ? -1 : 1) * r(4.5, 6)             // a mais fechada do traçado
        addRoad(24, ri(30, 50), 24, c, 0)
        addRoad(26, ri(60, 110), 26, 0, hill * 0.2)              // respiro longo depois
      }
    } else if (roll < 0.10) addRoad(30, ri(110, 220), 30, 0, r(-1, 1) * r(400, 1600)) // retão pra esticar as marchas
    else if (roll < 0.30) addRoad(ri(20, 40), ri(30, 70), ri(20, 40), 0, hill)
    else if (roll < 0.62) {
      const c = (rnd() < 0.5 ? -1 : 1) * r(2, 5)
      addRoad(ri(25, 45), ri(30, 70), ri(25, 45), c, hill * 0.6)
    } else if (roll < 0.86) {
      const c = (rnd() < 0.5 ? -1 : 1) * r(2.5, 4.5)
      addRoad(25, 40, 25, c, hill * 0.4)
      addRoad(25, 40, 25, -c, -hill * 0.4)
    } else addRoad(ri(15, 25), ri(20, 40), ri(15, 25), (rnd() < 0.5 ? -1 : 1) * r(4.5, 6), 0)
  }
  comTracado = false
  addRoad(40, 40, 40, 0, -lastY) // fecha o loop plano
  eng.trackLen = eng.segments.length * SEG_LEN
  // cenário de beira por trechos (Fase 8.4): hash da seed, não mexe no sorteio da pista
  eng.cenario = gerarTrechos(eng.segments.length, seed, eng.bioma.id)
  eng.pistaSeed = seed

  sinalizarCurvas(eng, corrida)
  if (corrida) conesDeCurva(eng)
}

// Placas de chevron antes de curvas fechadas. No circuito o limiar é mais
// baixo e a fila de placas é mais longa: como as curvas são bem mais bravas,
// o jogador precisa ler a curva de longe pra escolher onde frear.
export function sinalizarCurvas(eng: AutoDashEngine, corrida: boolean) {
  const limiar = corrida ? 2.5 : 4
  const inicioPlacas = corrida ? 70 : 46
  for (let i = inicioPlacas; i < eng.segments.length; i++) {
    const c = eng.segments[i].curve
    if (Math.abs(c) >= limiar && Math.abs(eng.segments[i - 1].curve) < limiar) {
      const ate = corrida ? 70 : 46
      for (let k = 22; k <= ate; k += 8) {
        eng.segments[i - k].sign = c > 0 ? 1 : -1
      }
    }
  }
}

// No circuito, cones marcam a parte interna das curvas bravas: viram
// referência de traçado (dá pra "raspar" a curva) e punem quem entra torto.
export function conesDeCurva(eng: AutoDashEngine) {
  eng.obstacles = []
  for (let i = 60; i < eng.segments.length - 30; i++) {
    const c = eng.segments[i].curve
    if (Math.abs(c) < 5 || Math.abs(eng.segments[i - 1].curve) >= 5) continue
    const lado = c > 0 ? 1 : -1 // interno da curva
    for (let k = 0; k < 5; k++) {
      eng.obstacles.push({
        z: ((i + k * 6) * SEG_LEN) % eng.trackLen,
        offset: lado * 0.92, kind: "cone", w: 0.10, len: 90,
      })
    }
  }
}

export function segAt(eng: AutoDashEngine, z: number) : Seg {
  const n = eng.segments.length
  return eng.segments[Math.floor(((z % eng.trackLen) + eng.trackLen) % eng.trackLen / SEG_LEN) % n]
}
