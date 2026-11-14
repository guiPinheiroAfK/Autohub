import { describe, it, expect } from "vitest"
import { BIOMES, BIOME_IDS, biomeById, biomeDaCorrida, proximoBioma } from "../world/biomes"

describe("registro de biomas", () => {
  it("cada chave do registro é o id do próprio bioma e aceita pelo menos um clima", () => {
    for (const id of BIOME_IDS) {
      expect(BIOMES[id].id).toBe(id)
      expect(BIOMES[id].climas.length).toBeGreaterThan(0)
    }
  })

  it("as chaves de céu estão em ordem crescente de t dentro de 0..1 (a interpolação depende disso)", () => {
    for (const id of BIOME_IDS) {
      const ts = BIOMES[id].ceu.map(k => k.t)
      expect(ts.every(t => t > 0 && t < 1)).toBe(true)
      expect([...ts].sort((a, b) => a - b)).toEqual(ts)
    }
  })
})

describe("proximoBioma", () => {
  it("percorre todos os biomas e volta ao primeiro", () => {
    const visitados: string[] = []
    let id = BIOME_IDS[0]
    for (let i = 0; i < BIOME_IDS.length; i++) {
      visitados.push(id)
      id = proximoBioma(id)
    }
    expect([...visitados].sort()).toEqual([...BIOME_IDS].sort())
    expect(id).toBe(BIOME_IDS[0])
  })

  it("id desconhecido cai no primeiro bioma do registro", () => {
    expect(proximoBioma("marte")).toBe(BIOME_IDS[0])
  })
})

describe("biomeById", () => {
  it("devolve o bioma pedido", () => {
    expect(biomeById("costa").id).toBe("costa")
  })

  it("cai na cidade quando o id é ausente ou desconhecido", () => {
    expect(biomeById(undefined).id).toBe("cidade")
    expect(biomeById("").id).toBe("cidade")
    expect(biomeById("marte").id).toBe("cidade")
  })
})

describe("biomeDaCorrida", () => {
  it("sem circuito fixo, a corrida usa a cidade (o golden master depende disso)", () => {
    expect(biomeDaCorrida().id).toBe("cidade")
  })
})
