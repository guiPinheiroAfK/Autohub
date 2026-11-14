// AutoDash — sound/engine-worklet.ts. Processador de AudioWorklet que roda o
// sintetizador de motor (guias de onda) na thread de áudio (sem travar o jogo). Carregado por audio.ts via
// `?worker&url`; recebe giro, carga e perfil por mensagem a cada quadro.

import { type EngineSynthState } from "./engine-synth"
import { WaveguideSynth } from "./waveguide-synth"
import { ENGINE_PROFILES } from "./profiles"

// O escopo do AudioWorklet não está nas libs do TypeScript.
declare const sampleRate: number
declare function registerProcessor(name: string, ctor: unknown): void
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}

interface Msg { perfil?: string; st?: Partial<EngineSynthState> }

class MotorProcessor extends AudioWorkletProcessor {
  // modelo físico por guias de onda (sound/waveguide-synth.ts)
  private synth = new WaveguideSynth(sampleRate, ENGINE_PROFILES.i4, 1234)
  private sobra = new Float32Array(128)

  constructor() {
    super()
    this.port.onmessage = (e: MessageEvent<Msg>) => {
      const m = e.data
      if (m.perfil && ENGINE_PROFILES[m.perfil]) this.synth.setPerfil(ENGINE_PROFILES[m.perfil])
      if (m.st) Object.assign(this.synth.st, m.st)
    }
  }

  process(_in: Float32Array[][], outputs: Float32Array[][]): boolean {
    const o = outputs[0]
    if (!o || !o[0]) return true
    if (this.sobra.length < o[0].length) this.sobra = new Float32Array(o[0].length)
    this.synth.render(o[0], o[1] ?? this.sobra, o[0].length)
    return true
  }
}

registerProcessor("autodash-motor", MotorProcessor)
