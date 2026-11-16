// Tabela de volume do motor por guias de onda: medir o próprio volume custa
// caro (V10/W16 travavam a thread de áudio ao trocar de carro), então a curva é
// pré-calculada aqui. Para regenerar depois de mexer em perfis ou no modelo:
//   GERAR_GANHOS=1 npx vitest run src/game/autodash/__tests__/ganhos-motor.test.ts
import { describe, it, expect } from "vitest"
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { ENGINE_PROFILES } from "../sound/profiles"
import { medirCurvaGanho, GANHO_SR } from "../sound/waveguide-synth"
import { GANHOS_MOTOR } from "../sound/ganhos-motor"

describe("tabela de volume por motor", () => {
  it("está atualizada para todos os perfis", () => {
    const novos: Record<string, number[]> = {}
    for (const id of Object.keys(ENGINE_PROFILES)) {
      novos[id] = medirCurvaGanho(GANHO_SR, ENGINE_PROFILES[id]).map(v => Math.round(v * 1000) / 1000)
    }
    if (process.env.GERAR_GANHOS) {
      const corpo = Object.entries(novos).map(([k, v]) => `  ${JSON.stringify(k)}: [${v.join(", ")}],`).join("\n")
      const arq = fileURLToPath(new URL("../sound/ganhos-motor.ts", import.meta.url))
      writeFileSync(arq, `// AutoDash — sound/ganhos-motor.ts. GERADO por __tests__/ganhos-motor.test.ts\n// (GERAR_GANHOS=1). Ganho de normalização do motor por guias de onda nos giros\n// de GIROS_MEDIDOS (waveguide-synth.ts). Não editar à mão.\nexport const GANHOS_MOTOR: Record<string, number[]> = {\n${corpo}\n}\n`)
      return
    }
    for (const id of Object.keys(ENGINE_PROFILES)) {
      expect(GANHOS_MOTOR[id], `${id} sem ganho: regenere a tabela`).toBeDefined()
      GANHOS_MOTOR[id].forEach((g, i) => expect(g, `${id}[${i}]`).toBeCloseTo(novos[id][i], 2))
    }
  })
})
