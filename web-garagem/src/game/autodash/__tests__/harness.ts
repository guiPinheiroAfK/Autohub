// Harness de replay determinístico do engine do AutoDash (só para testes).
//
// Roda o engine REAL com: Math.random semeado, relógio falso, teclas injetadas,
// requestAnimationFrame controlado por quem chama, fetch que nunca resolve.
// Tudo que o engine desenha no canvas (e o estado de cada quadro) entra num hash
// SHA-256. Mudança de comportamento ou de ordem de desenho muda o hash.

import { createHash } from "node:crypto"

type Sink = (line: string) => void

// Proxies falsos -> caminho (para logar argumentos de forma legível)
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
// atribuições são logadas; leituras devolvem outro falso (vira 0 em aritmética).
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

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const FRAME_MS = 1000 / 60

export interface ScenarioApi {
  tap(key: string): void
  down(key: string): void
  up(key: string): void
}

export interface ScenarioResult {
  frames: number
  calls: number
  hash: string
  finalState: string
  finalMode: string
}

const g = globalThis as any
const STUBBED = ["window", "navigator", "localStorage", "performance", "fetch", "requestAnimationFrame", "cancelAnimationFrame", "document"]

/**
 * Executa um cenário completo. `script(i, api)` é chamado antes de cada quadro i.
 * Restaura Math.random e os globais ao final.
 */
export async function runScenario(
  frames: number,
  seed: number,
  script: (i: number, api: ScenarioApi) => void,
): Promise<ScenarioResult> {
  const originalRandom = Math.random
  const originalDescriptors: Record<string, PropertyDescriptor | undefined> = {}
  for (const k of STUBBED) originalDescriptors[k] = Object.getOwnPropertyDescriptor(g, k)

  try {
    const hash = createHash("sha256")
    let calls = 0
    const sink: Sink = (line) => {
      hash.update(line)
      hash.update("\n")
      calls++
    }

    Math.random = mulberry32(seed)
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
    define("fetch", () => new Promise(() => {}))
    define("requestAnimationFrame", (cb: (t: number) => void) => { pending = cb; return 1 })
    define("cancelAnimationFrame", () => {})
    define("document", {
      body: makeFake("document.body", sink),
      createElement: (tag: string) => makeCanvasLike(tag === "canvas" ? `tex${texCount++}` : `el${texCount++}`, sink),
    })

    const dispatch = (type: string, key: string) => {
      for (const fn of listeners.get(type) ?? []) fn({ key, preventDefault() {} })
    }
    const api: ScenarioApi = {
      tap: (key) => { dispatch("keydown", key); dispatch("keyup", key) },
      down: (key) => dispatch("keydown", key),
      up: (key) => dispatch("keyup", key),
    }

    const { AutoDashEngine } = await import("../engine")
    const canvas = makeCanvasLike("canvas", sink)
    const engine: any = new AutoDashEngine(canvas as any)

    for (let i = 0; i < frames; i++) {
      script(i, api)
      clock.now += FRAME_MS
      const cb = pending
      pending = null
      cb?.(clock.now)
      hash.update(JSON.stringify([engine.state, String(engine.speed), String(engine.rpm), String(engine.gear)]))
      hash.update(`|f${i}\n`)
    }

    engine.destroy?.()

    return {
      frames,
      calls,
      hash: hash.digest("hex"),
      finalState: engine.state,
      finalMode: engine.mode,
    }
  } finally {
    Math.random = originalRandom
    for (const k of STUBBED) {
      const d = originalDescriptors[k]
      if (d) Object.defineProperty(g, k, d)
      else delete g[k]
    }
  }
}

/** Padrão de direção usado nos cenários: segura acelerador e alterna volante. */
export function drive(i: number, api: ScenarioApi, startAt: number) {
  if (i === startAt) api.down("w")
  if (i > startAt + 60 && i % 120 === 0) { api.up("a"); api.down("d") }
  if (i > startAt + 60 && i % 120 === 60) { api.up("d"); api.down("a") }
  if (i > startAt && i % 150 === 0) api.tap("e")
  if (i > startAt && i % 300 === 250) api.tap("q")
}
