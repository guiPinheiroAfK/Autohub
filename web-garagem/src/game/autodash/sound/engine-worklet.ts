// AutoDash — sound/engine-worklet.ts. Processador de AudioWorklet que roda o
// sintetizador de motor (guias de onda) na thread de áudio (sem travar o jogo). Carregado por audio.ts via
// `?worker&url`; recebe giro, carga e perfil por mensagem a cada quadro.

import { type EngineSynthState, estadoFinito } from "./engine-synth"
import { WaveguideSynth } from "./waveguide-synth"
import { ENGINE_PROFILES } from "./profiles"
import { MotorGravado, type BancoGraos } from "./motor-gravado"

// O escopo do AudioWorklet não está nas libs do TypeScript.
declare const sampleRate: number
declare function registerProcessor(name: string, ctor: unknown): void
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}

interface Msg { perfil?: string; st?: Partial<EngineSynthState>; banco?: BancoGraos; usar?: string; gravado?: boolean }

class MotorProcessor extends AudioWorkletProcessor {
  // modelo físico por guias de onda (sound/waveguide-synth.ts)
  private synth = new WaveguideSynth(sampleRate, ENGINE_PROFILES.i4, 1234)
  private sobra = new Float32Array(128)
  // gravação real (sound/motor-gravado.ts), na 2ª saída; só roda quando o perfil usa
  private gravado = new MotorGravado(sampleRate, 99)
  private usaGravado = false
  // bancos já recebidos (cada um chega uma vez; trocar de carro só escolhe outro)
  private bancos = new Map<string, BancoGraos>()

  constructor() {
    super()
    this.port.onmessage = (e: MessageEvent<Msg>) => {
      const m = e.data
      if (m.perfil && ENGINE_PROFILES[m.perfil]) this.synth.setPerfil(ENGINE_PROFILES[m.perfil])
      if (m.st) { const st = estadoFinito(m.st); Object.assign(this.synth.st, st); Object.assign(this.gravado.st, st) }
      if (m.banco) this.bancos.set(m.banco.nome, m.banco)
      if (m.usar) {
        const b = this.bancos.get(m.usar)
        if (b && this.gravado.banco !== m.usar) this.gravado.setBanco(b)
      }
      if (m.gravado !== undefined) this.usaGravado = m.gravado
    }
  }

  process(_in: Float32Array[][], outputs: Float32Array[][]): boolean {
    const o = outputs[0]
    if (!o || !o[0]) return true
    if (this.sobra.length < o[0].length) this.sobra = new Float32Array(o[0].length)
    this.synth.render(o[0], o[1] ?? this.sobra, o[0].length)
    const g = outputs[1]?.[0]
    if (g) {
      if (this.usaGravado && this.gravado.pronto) this.gravado.render(g, g.length)
      else g.fill(0)
    }
    return true
  }
}

registerProcessor("autodash-motor", MotorProcessor)
