// Fase 8.1: o civil enxerga o jogador. Antes ele só via os outros carros e
// chegava na sua traseira com você parado ou lento na faixa dele.
import { describe, it, expect } from "vitest"
import { CivilianDriver, ComboioDriver, CIVIL } from "../traffic/driver"
import { KINDS, type Traffic, type WorldView } from "../traffic/types"
import { KMH2UPS } from "../data"

const LEN = 1_000_000
const mundo = (traffic: Traffic[], playerZ: number, playerSpeed: number, playerX: number, buzinas: Traffic[] = []): WorldView => ({
  traffic, playerX, playerZ, playerSpeed, trackLen: LEN, demo: false,
  wrapDz(a, b) { let d = (a - b) % LEN; if (d > LEN / 2) d -= LEN; if (d < -LEN / 2) d += LEN; return d },
  buzinar: t => { buzinas.push(t) },
})
const civil = (z: number, offset: number, speed: number, extra: Partial<Traffic> = {}): Traffic =>
  ({ z, offset, targetOffset: offset, speed, kind: "car", role: "civilian", color: "#fff", blinkT: 0, prevD: 0, ...extra })
const corpo = (KINDS.car.len + KINDS.car.len) / 2

describe("civil e o jogador na faixa", () => {
  it("freia a tempo e para atrás do jogador parado, com a luz de freio acesa", () => {
    const c = civil(20_000, 0.25, 110)
    // faixas vizinhas cheias: ele não tem para onde ir
    const vizinhos = [-0.25, 0.75].flatMap(o => [0, 3000, 6000, 9000, 12000].map(z => civil(18_000 + z, o, 0)))
    const d = new CivilianDriver(), dt = 1 / 60
    const playerZ = 30_000
    let luz = false, menor = Infinity
    for (let i = 0; i < 60 * 12; i++) {
      d.drive(c, mundo([c, ...vizinhos], playerZ, 0, 0.25), dt)
      if (c.freioT && c.freioT > 0) luz = true
      menor = Math.min(menor, playerZ - c.z)
    }
    expect(menor, "entrou no jogador").toBeGreaterThan(corpo)
    expect(playerZ - c.z, "parou longe demais").toBeLessThan(corpo + CIVIL.folga + 400)
    expect(luz).toBe(true)
  })

  it("alcança o jogador lento sem encostar (segue atrás ou passa pela outra faixa)", () => {
    const c = civil(10_000, 0.25, 120)
    const d = new CivilianDriver(), dt = 1 / 60
    let playerZ = 16_000, dentro = 0
    for (let i = 0; i < 60 * 10; i++) {
      d.drive(c, mundo([c], playerZ, 40, 0.25), dt)
      playerZ += 40 * KMH2UPS * dt
      if (Math.abs(c.offset - 0.25) < 0.3 && Math.abs(playerZ - c.z) < corpo) dentro++
    }
    expect(dentro).toBe(0)
  })

  it("preso atrás de você: buzina e passa pela faixa livre", () => {
    const c = civil(20_000, 0.25, 110)
    const buzinas: Traffic[] = []
    const d = new CivilianDriver(), dt = 1 / 60
    let trocou = false
    for (let i = 0; i < 60 * 15; i++) {
      d.drive(c, mundo([c], 22_000, 0, 0.25, buzinas), dt)
      if (c.targetOffset !== 0.25 || c.offset !== 0.25) trocou = true
    }
    expect(buzinas.length).toBeGreaterThan(0)
    expect(trocou).toBe(true)
  })

  it("jogador em outra faixa não segura o civil", () => {
    const c = civil(20_000, 0.25, 110)
    const d = new CivilianDriver(), dt = 1 / 60
    const z0 = c.z
    for (let i = 0; i < 60; i++) d.drive(c, mundo([c], 23_000, 0, -0.25), dt)
    expect(c.z - z0).toBeCloseTo(110 * KMH2UPS, -2)
  })

  it("comboio também para atrás do jogador", () => {
    const c: Traffic = { ...civil(20_000, 0.25, 90), kind: "truck", role: "comboio" }
    const d = new ComboioDriver(), dt = 1 / 60
    let menor = Infinity
    for (let i = 0; i < 60 * 12; i++) { d.drive(c, mundo([c], 30_000, 0, 0.25), dt); menor = Math.min(menor, 30_000 - c.z) }
    expect(menor).toBeGreaterThan((KINDS.truck.len + KINDS.car.len) / 2)
  })
})
