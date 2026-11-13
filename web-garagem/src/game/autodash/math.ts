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

export function shade(hex: string, f: number): string {
  const c = hexToRgb(hex)
  return `rgb(${Math.round(c[0] * f)},${Math.round(c[1] * f)},${Math.round(c[2] * f)})`
}

export function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v }
