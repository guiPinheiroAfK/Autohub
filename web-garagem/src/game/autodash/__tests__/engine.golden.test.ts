// Golden master do engine do AutoDash.
//
// Roda uma partida inteira de forma DETERMINÍSTICA (Math.random com seed,
// relógio falso, teclas injetadas, rAF controlado) e grava um hash de tudo que
// o engine desenha no canvas + o estado de cada frame. Qualquer refatoração
// que mude comportamento ou ordem de desenho muda o hash e o teste falha.
//
// Não é teste de "tela bonita": é teste de equivalência. Se o hash mudar de
// propósito (mudança de gameplay), atualize o snapshot conscientemente.

import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createHash } from "node:crypto"

type Sink = (line: string) => void

// Mapa de proxies falsos -> caminho (para logar argumentos de forma legível)
const fakePaths = new WeakMap<object, string>()

function fmt(v: unknown): string {
  if (v !== null && (typeof v === "object" || typeof v === "function") && fakePaths.has(v as object)) {
    return `<${fakePaths.get(v as object)}>`
  }
  if (typeof v === "string") return JSON.stringify(v)
  if (v === undefined) return "undefined"
  if (v === null) return "null"
  if (Array.isArray(v)) return `[${v.map(fmt).join(",")}]`
  if (typeof v === "object") return "{obj}"
  return String(v)
}

// Objeto falso que aceita qualquer leitura, chamada e atribuição. Chamadas e
// atribuições são logadas; leituras devolvem outro falso (que vira 0 em aritmética).
function makeFake(path: string, sink: Sink): any {
  const target = function () {}
  const proxy: any = new Proxy(target, {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive) return () => 0
      if (typeof prop === "symbol") return undefined
      if (prop === "then") return undefined
      if (prop === "valueOf") return () => 0
      if (prop === "toString") return () => "[fake]"
      return makeFake(`${path}.${prop}`, sink)
    },
    set(_t, prop, value) {
      sink(`${path}.${String(prop)}=${fmt(value)}`)
      return true
    },
    apply(_t, _this, args) {
      sink(`${path}(${args.map(fmt).join(",")})`)
      return makeFake(`${path}()`, sink)
    },
  })
  fakePaths.set(proxy, path)
  return proxy
}

function makeCanvasLike(name: string, sink: Sink) {
  return {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    setAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    getContext: () => makeFake(`${name}.ctx`, sink),
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FRAME_MS = 1000 / 60
const FRAMES = 1200

describe("AutoDash engine — golden master", () => {
  const g = globalThis as any
  const originalRandom = Math.random
  const originalDescriptors: Record<string, PropertyDescriptor | undefined> = {}
  const globalsToStub = ["window", "navigator", "localStorage", "performance", "fetch", "requestAnimationFrame", "cancelAnimationFrame", "document"]

  beforeAll(() => {
    for (const k of globalsToStub) originalDescriptors[k] = Object.getOwnPropertyDescriptor(g, k)
  })

  afterAll(() => {
    Math.random = originalRandom
    for (const k of globalsToStub) {
      const d = originalDescriptors[k]
      if (d) Object.defineProperty(g, k, d)
      else delete g[k]
    }
  })

  it("partida solo determinística (menu -> nome -> garagem -> largada -> pista)", async () => {
    const hash = createHash("sha256")
    let calls = 0
    const sink: Sink = (line) => {
      hash.update(line)
      hash.update("\n")
      calls++
    }

    // ---- ambiente falso ----
    Math.random = mulberry32(20240613)
    const clock = { now: 0 }
    let pending: ((t: number) => void) | null = null
    const listeners = new Map<string, Array<(e: any) => void>>()
    let texCount = 0
    const memStorage = new Map<string, string>()

    const define = (k: string, v: unknown) => Object.defineProperty(g, k, { value: v, configurable: true, writable: true })
    define("window", g)
    g.addEventListener = (type: string, fn: (e: any) => void) => {
      const arr = listeners.get(type) ?? []
      arr.push(fn)
      listeners.set(type, arr)
    }
    g.removeEventListener = (type: string, fn: (e: any) => void) => {
      listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn))
    }
    define("navigator", { maxTouchPoints: 0 })
    define("localStorage", {
      getItem: (k: string) => memStorage.get(k) ?? null,
      setItem: (k: string, v: string) => { memStorage.set(k, String(v)) },
      removeItem: (k: string) => { memStorage.delete(k) },
    })
    define("performance", { now: () => clock.now })
    define("fetch", () => new Promise(() => {})) // nunca resolve: nada assíncrono muda o replay
    define("requestAnimationFrame", (cb: (t: number) => void) => { pending = cb; return 1 })
    define("cancelAnimationFrame", () => {})
    define("document", {
      body: makeFake("document.body", sink),
      createElement: (tag: string) => makeCanvasLike(tag === "canvas" ? `tex${texCount++}` : `el${texCount++}`, sink),
    })

    const dispatch = (type: string, key: string) => {
      for (const fn of listeners.get(type) ?? []) fn({ key, preventDefault() {} })
    }
    const tap = (key: string) => { dispatch("keydown", key); dispatch("keyup", key) }

    // ---- engine ----
    const { AutoDashEngine } = await import("../engine")
    const canvas = makeCanvasLike("canvas", sink)
    const engine: any = new AutoDashEngine(canvas as any)

    const step = (i: number) => {
      clock.now += FRAME_MS
      const cb = pending
      pending = null
      cb?.(clock.now)
      hash.update(JSON.stringify([engine.state, String(engine.speed), String(engine.rpm), String(engine.gear)]))
      hash.update(`|f${i}\n`)
    }

    // ---- roteiro determinístico ----
    for (let i = 0; i < FRAMES; i++) {
      if (i === 10) tap("Enter")                       // menu -> pede nome
      if (i >= 12 && i <= 16) tap("TESTE"[i - 12])     // digita o nome
      if (i === 18) tap("Enter")                       // confirma nome -> garagem
      if (i === 25) tap("Enter")                       // garagem -> largada solo
      if (i === 27) dispatch("keydown", "w")           // acelera (segura)
      if (i > 60 && i % 120 === 0) { dispatch("keyup", "a"); dispatch("keydown", "d") }
      if (i > 60 && i % 120 === 60) { dispatch("keyup", "d"); dispatch("keydown", "a") }
      if (i > 0 && i % 150 === 0) tap("e")             // sobe marcha
      if (i > 0 && i % 300 === 250) tap("q")           // desce marcha
      step(i)
    }

    engine.destroy?.()

    expect({
      frames: FRAMES,
      calls,
      hash: hash.digest("hex"),
      finalState: engine.state,
      finalMode: engine.mode,
    }).toMatchSnapshot()
  }, 180_000)
})
