// Renderização offline do som do motor (diagnóstico e "antes/depois"). Só roda com
// RENDER_MOTOR=<pasta de saída>; no teste normal fica pulado.
//   RENDER_MOTOR=/caminho/saida [RENDER_PERFIS=v8-cruzado,v8-plano] [RENDER_TAG=antes] \
//     npx vitest run src/game/autodash/__tests__/render-motor.test.ts
// Reproduz a cadeia de audio.ts sem WebAudio: modelo físico (hp 35 → boom → lp
// → brilho) + gravação (hp 30), ganhos de misturarGravacao(), pre 0,5, tanh e o
// ganho de saída. Não tem o compressor, o eco nem os efeitos (turbo, estouros).
import { describe, it } from "vitest"
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { ENGINE_PROFILES, GRAVACAO_DO_PERFIL, TEXTURA } from "../sound/profiles"
import { WaveguideSynth } from "../sound/waveguide-synth"
import { MotorGravado, graosDoJson, type BancoGraos } from "../sound/motor-gravado"
import { MOTORES, giroDoSom } from "../physics/motores"

const SR = 48000
const NIVEL_REF = 0.135
// RENDER_SOM=<pasta> troca a pasta dos bancos (comparar um banco de outro branch)
const SOM = process.env.RENDER_SOM ? process.env.RENDER_SOM.replace(/[\\/]?$/, "/") : fileURLToPath(new URL("../../../../public/autodash/som/", import.meta.url))

function carregarBanco(nome: string): { banco: BancoGraos; faixa: [number, number]; nivel: number } {
  const j = JSON.parse(readFileSync(SOM + nome + ".json", "utf8"))
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", SOM + nome + ".mp3", "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 30 })
  const dados = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength - (raw.byteLength % 4)))
  let pk = 0, pi = 0
  const ate = Math.min(dados.length, Math.floor(SR * (j.clique + 0.08)))
  for (let i = 0; i < ate; i++) if (Math.abs(dados[i]) > pk) { pk = Math.abs(dados[i]); pi = i }
  const desvio = pi / SR - j.clique
  const graos = graosDoJson(j.graos)
  for (let i = 0; i < graos.length; i += 6) graos[i] += desvio
  const voltas = j.voltasPorGrao ?? 0.5
  const hz = j.graos.map((g: number[]) => g[3]).sort((a: number, b: number) => a - b)
  return {
    banco: { nome, sr: SR, dados, graos, voltasPorGrao: voltas },
    faixa: [hz[Math.floor(hz.length * 0.02)] * 60 * voltas, hz[Math.floor(hz.length * 0.98)] * 60 * voltas],
    nivel: Math.min(3.5, Math.max(0.4, NIVEL_REF / (j.nivel ?? NIVEL_REF))),
  }
}

// biquad RBJ
type Bq = (x: number) => number
function biquad(tipo: "hp" | "lp" | "peak" | "hshelf", f: number, q: number, gDb = 0): Bq {
  const w = 2 * Math.PI * Math.min(f, SR * 0.45) / SR, c = Math.cos(w), s = Math.sin(w), A = Math.pow(10, gDb / 40)
  const al = s / (2 * q)
  let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0
  if (tipo === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al }
  else if (tipo === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al }
  else if (tipo === "peak") { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A }
  else { const sq = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * c + sq); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - sq); a0 = (A + 1) - (A - 1) * c + sq; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - sq }
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  return (x) => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y }
}

const rampa = (x: number) => Math.min(1, Math.max(0, x))
export type Ponto = [number, number, number, number?] // t (s), rpm, carga, limitador (1 = no corte)

/** Renderiza a trajetória `pontos` (interpolada) com a cadeia do jogo. `soGrav`/`soSint` isolam uma camada. */
function renderizar(perfilId: string, pontos: Ponto[], opc: { soGrav?: boolean; soSint?: boolean } = {}): Float32Array {
  const perfil = ENGINE_PROFILES[perfilId]
  const grav = GRAVACAO_DO_PERFIL[perfilId], g = grav ?? TEXTURA
  const cb = carregarBanco(g.banco)
  const synth = new WaveguideSynth(SR, perfil, 1234)
  const mot = new MotorGravado(SR, 99); mot.setBanco(cb.banco)
  const motorF = MOTORES[perfilId]
  const dur = pontos[pontos.length - 1][0], N = Math.floor(dur * SR)
  const out = new Float32Array(N)
  const hpS = biquad("hp", 35, 0.7), boom = biquad("peak", perfil.boomHz, 1, perfil.boomDb * 0.35)
  let lp = biquad("lp", 2000, 0.5), lpF = 0
  const brilho = biquad("hshelf", 2400, 0.707, 3), hpG = biquad("hp", grav ? 30 : 1800, 0.7)
  const eqG = biquad("peak", g.corpo?.[0] ?? 120, 0.9, g.corpo?.[1] ?? 0), lpG = biquad("lp", g.topoHz ?? 20000, 0.7)
  const L = new Float32Array(128), R = new Float32Array(128), G = new Float32Array(128)
  const tanh08 = Math.tanh(0.8)
  let gg = 0, sg = 1, og = 0 // ganhos suavizados
  let k = 0
  for (let i = 0; i < N; i += 128) {
    const t = i / SR
    while (k < pontos.length - 2 && pontos[k + 1][0] < t) k++
    const [t0, r0, c0] = pontos[k], [t1, r1, c1] = pontos[k + 1]
    const u = rampa((t - t0) / (t1 - t0 || 1))
    const carga = c0 + (c1 - c0) * u
    // no corte o giro do som pulsa como no jogo (giroDoSom, sim/update.ts)
    const corte = !!pontos[k][3] && carga > 0.5
    const rpm = motorF ? giroDoSom(motorF, r0 + (r1 - r0) * u, carga, corte, t) : r0 + (r1 - r0) * u
    synth.st.rpm = rpm; synth.st.carga = carga; synth.st.ligado = true; synth.st.corte = corte
    mot.st.rpm = rpm; mot.st.carga = carga; mot.st.ligado = true; mot.st.corte = corte
    const n = Math.min(128, N - i)
    synth.render(L, R, n)
    mot.render(G, n)
    // ganhos de misturarGravacao()
    const [lo, hi] = cb.faixa
    const sobe = rampa((hi * 1.35 - rpm) / (hi * 0.27)), desce = rampa((rpm - lo * 0.7) / (lo * 0.2))
    const cob = Math.min(sobe, desce)
    const gAlvo = g.mix * (grav ? 0.6 : 0.9) * cb.nivel * cob
    const sAlvo = grav ? 1 - (1 - (g.sint ?? 1 - g.mix * 0.7)) * cob : 1
    const oAlvo = 0.5 * (0.85 + 0.35 * Math.min(rpm, 8000) / 7000)
    const lpAlvo = Math.min(9000, 2500 + rpm * 0.5 + carga * 1500)
    if (Math.abs(lpAlvo - lpF) > 80) { lp = biquad("lp", lpAlvo, 0.5); lpF = lpAlvo }
    for (let j = 0; j < n; j++) {
      gg += (gAlvo - gg) * 0.003; sg += (sAlvo - sg) * 0.003; og += (oAlvo - og) * 0.003
      const s = brilho(lp(boom(hpS(L[j]))))
      const gv = lpG(eqG(hpG(G[j])))
      let m = (opc.soGrav ? 0 : s * sg) + (opc.soSint ? 0 : gv * gg)
      m = Math.tanh(0.8 * (m * 0.5)) / tanh08
      out[i + j] = m * og
    }
  }
  return out
}

function wav(arq: string, x: Float32Array) {
  const b = Buffer.alloc(44 + x.length * 2)
  b.write("RIFF", 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28)
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(x.length * 2, 40)
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2)
  writeFileSync(arq, b)
}

const SAIDA = process.env.RENDER_MOTOR
describe.skipIf(!SAIDA)("render offline do motor", () => {
  const perfis = (process.env.RENDER_PERFIS ?? "v8-cruzado,v8-cruzado-ford,v8-plano").split(",")
  const tag = process.env.RENDER_TAG ?? "atual"
  it("giros fixos (com e sem carga) e varredura", () => {
    mkdirSync(SAIDA!, { recursive: true })
    for (const p of perfis) {
      for (const rpm of (process.env.RENDER_GIROS ?? "1500,3000,5000,6500").split(",").map(Number)) for (const carga of [0, 1]) {
        const pts: Ponto[] = [[0, rpm, carga], [3.5, rpm, carga]]
        const base = `${SAIDA}/${tag}_${p}_${rpm}_${carga ? "carga" : "livre"}`
        wav(base + "_mix.wav", renderizar(p, pts).subarray(Math.floor(0.8 * SR)))
        wav(base + "_grav.wav", renderizar(p, pts, { soGrav: true }).subarray(Math.floor(0.8 * SR)))
        wav(base + "_sint.wav", renderizar(p, pts, { soSint: true }).subarray(Math.floor(0.8 * SR)))
      }
      // varredura: lenta, acelerada no grid, puxada de 1800 até o corte do motor
      // em ~5 s, 1,5 s batendo no limitador (como no jogo), desacelerando
      const topo = MOTORES[p]?.corte ?? 6500
      const pts: Ponto[] = [[0, 900, 0], [1.5, 900, 0], [1.6, 3500, 1], [2.6, 900, 0], [3.5, 900, 0],
        [3.6, 1800, 1], [9.0, topo, 1, 1], [10.5, topo, 1], [10.6, topo, 0], [14, 1200, 0], [15, 900, 0]]
      wav(`${SAIDA}/${tag}_${p}_varredura.wav`, renderizar(p, pts))
    }
  }, 900_000)
})
