import { describe, it, expect } from "vitest"
import { mulberry32, hexToRgb, mix, shade, clamp } from "../math"

describe("mulberry32", () => {
  it("mesma seed gera a mesma sequência (pista idêntica no duelo)", () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = Array.from({ length: 50 }, () => a())
    const seqB = Array.from({ length: 50 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it("seeds diferentes geram sequências diferentes", () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    expect(a()).not.toBe(b())
  })

  it("valores ficam em [0, 1)", () => {
    const r = mulberry32(7)
    for (let i = 0; i < 10_000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe("cores", () => {
  it("hexToRgb converte #rrggbb", () => {
    expect(hexToRgb("#000000")).toEqual([0, 0, 0])
    expect(hexToRgb("#ffffff")).toEqual([255, 255, 255])
    expect(hexToRgb("#38bdf8")).toEqual([0x38, 0xbd, 0xf8])
  })

  it("mix interpola entre duas cores (p=0 é a primeira, p=1 é a segunda)", () => {
    expect(mix("#000000", "#ffffff", 0)).toBe("rgb(0,0,0)")
    expect(mix("#000000", "#ffffff", 1)).toBe("rgb(255,255,255)")
    expect(mix("#000000", "#ffffff", 0.5)).toBe("rgb(128,128,128)")
  })

  it("shade escurece (f<1) ou clareia (f>1) sem passar de 255", () => {
    expect(shade("#ff8000", 0.5)).toBe("rgb(128,64,0)")
    expect(shade("#ffffff", 0)).toBe("rgb(0,0,0)")
  })
})

describe("clamp", () => {
  it("prende o valor no intervalo", () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(42, 0, 10)).toBe(10)
  })
})
