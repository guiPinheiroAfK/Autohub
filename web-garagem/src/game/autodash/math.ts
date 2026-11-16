// AutoDash — math.ts. Extraído de engine.ts (refactor sem mudança de comportamento).

// RNG determinístico — no duelo os dois recebem a mesma pista via seed
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function mix(a: string, b: string, p: number): string {
  const ca = hexToRgb(a), cb = hexToRgb(b)
  return `rgb(${Math.round(ca[0] + (cb[0] - ca[0]) * p)},${Math.round(ca[1] + (cb[1] - ca[1]) * p)},${Math.round(ca[2] + (cb[2] - ca[2]) * p)})`
}

/** Cor em "#rrggbb" ou "rgb(r,g,b)" para [r, g, b]. */
export function anyToRgb(c: string): [number, number, number] {
  if (c.startsWith("#")) return hexToRgb(c)
  const m = c.match(/\d+(\.\d+)?/g)
  return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : [0, 0, 0]
}

/** Como `mix`, mas aceita hex ou rgb() nas entradas e devolve hex. */
export function mixHex(a: string, b: string, p: number): string {
  const ca = anyToRgb(a), cb = anyToRgb(b)
  const h = (i: number) => Math.round(ca[i] + (cb[i] - ca[i]) * p).toString(16).padStart(2, "0")
  return `#${h(0)}${h(1)}${h(2)}`
}

export function shade(hex: string, f: number): string {
  const c = hexToRgb(hex)
  return `rgb(${Math.round(c[0] * f)},${Math.round(c[1] * f)},${Math.round(c[2] * f)})`
}

export function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v }
