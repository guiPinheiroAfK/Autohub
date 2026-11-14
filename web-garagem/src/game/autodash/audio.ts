// AutoDash — áudio 100% sintetizado via WebAudio (sem assets externos).
import { type EngineSoundProfile, ENGINE_PROFILES } from "./sound/profiles"

// Motor por pulsos (sound/engine-synth.ts) rodando num AudioWorklet, com a
// cadeia de mixagem do escape: corpo → coletor → abafador → saturação →
// compressor. Indução (turbo/compressor), estouros e alívio por cima.
interface Motor {
  node: AudioWorkletNode
  boom: BiquadFilterNode
  coletor: BiquadFilterNode
  lp: BiquadFilterNode
  admBp: BiquadFilterNode
  admGain: GainNode
  out: GainNode
  fx: GainNode            // estouros, flutter e blow-off
  apito: OscillatorNode   // eixo do turbo
  apito2: OscillatorNode
  apitoGain: GainNode
  sopro: BiquadFilterNode // "whoosh" do turbo
  soproGain: GainNode
  whine: OscillatorNode   // compressor mecânico
  whineGain: GainNode
  pops: AudioBuffer[]
}

export class AudioBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null

  // motor
  private engOsc1: OscillatorNode | null = null
  private engOsc2: OscillatorNode | null = null
  private engGain: GainNode | null = null
  private engFilter: BiquadFilterNode | null = null

  // motor por pulsos (null = navegador sem AudioWorklet: usa os osciladores)
  private motor: Motor | null = null
  private perfil: EngineSoundProfile = ENGINE_PROFILES.i4
  private boost = 0
  private eixo = 0          // rotação do eixo do turbo (atrasa o boost)
  private lastT = 0
  private lastGas = 0
  private gasAltoT = -1     // último instante com pé no fundo em giro alto
  private estouroAte = 0
  private proxEstouro = 0
  private cortaCargaAte = 0

  // loops de ruído (derrapagem / chuva)
  private skidGain: GainNode | null = null
  private rainGain: GainNode | null = null

  // música
  private musicGain: GainNode | null = null
  private musicTimer: number | null = null
  private musicNextT = 0
  private musicStep = 0

  enabled = true

  /** Precisa ser chamado a partir de um gesto do usuário (clique/tecla). */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume()
      return
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.5
    this.master.connect(this.ctx.destination)
    this.buildEngine()
    void this.buildMotor()
    this.buildLoops()
    this.startMusic()
  }

  setMuted(muted: boolean) {
    this.enabled = !muted
    if (this.master) this.master.gain.value = muted ? 0 : 0.5
  }

  // ---------- música synthwave (sequencer com lookahead) ----------
  private startMusic() {
    const ctx = this.ctx
    if (!ctx || this.musicTimer !== null) return
    this.musicGain = ctx.createGain()
    this.musicGain.gain.value = 0.06
    this.musicGain.connect(this.master!)
    this.musicNextT = ctx.currentTime + 0.1
    this.musicStep = 0

    const STEP = 60 / 128 / 2 // 128 BPM, colcheias
    // baixo em Lá menor: A1 A1 C2 A1 · D2 A1 E2 D2 (2 compassos)
    const BASS = [55, 55, 65.41, 55, 73.42, 55, 82.41, 73.42, 55, 55, 65.41, 55, 98, 82.41, 73.42, 65.41]

    const scheduleStep = (step: number, t: number) => {
      const g = this.musicGain!
      // baixo
      const f = BASS[step % BASS.length]
      const osc = ctx.createOscillator()
      osc.type = "sawtooth"
      osc.frequency.value = f
      const lp = ctx.createBiquadFilter()
      lp.type = "lowpass"
      lp.frequency.setValueAtTime(600, t)
      lp.frequency.exponentialRampToValueAtTime(180, t + STEP * 0.9)
      const eg = ctx.createGain()
      eg.gain.setValueAtTime(0.9, t)
      eg.gain.exponentialRampToValueAtTime(0.02, t + STEP * 0.95)
      osc.connect(lp); lp.connect(eg); eg.connect(g)
      osc.start(t); osc.stop(t + STEP)
      // bumbo surdo a cada 4 passos
      if (step % 4 === 0) {
        const k = ctx.createOscillator()
        k.type = "sine"
        k.frequency.setValueAtTime(120, t)
        k.frequency.exponentialRampToValueAtTime(40, t + 0.12)
        const kg = ctx.createGain()
        kg.gain.setValueAtTime(0.8, t)
        kg.gain.exponentialRampToValueAtTime(0.01, t + 0.14)
        k.connect(kg); kg.connect(g)
        k.start(t); k.stop(t + 0.15)
      }
      // chimbal nos contratempos
      if (step % 4 === 2) {
        const src = ctx.createBufferSource()
        src.buffer = this.noiseBuffer(0.06)
        const hp = ctx.createBiquadFilter()
        hp.type = "highpass"
        hp.frequency.value = 7000
        const hg = ctx.createGain()
        hg.gain.setValueAtTime(0.25, t)
        hg.gain.exponentialRampToValueAtTime(0.01, t + 0.05)
        src.connect(hp); hp.connect(hg); hg.connect(g)
        src.start(t)
      }
    }

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx) return
      while (this.musicNextT < this.ctx.currentTime + 0.35) {
        scheduleStep(this.musicStep, this.musicNextT)
        this.musicStep = (this.musicStep + 1) % 64
        this.musicNextT += STEP
      }
    }, 120)
  }

  /** Intensidade da música: corrida = mais presente, menus = fundo. */
  music(intense: boolean) {
    if (this.musicGain && this.ctx)
      this.musicGain.gain.setTargetAtTime(intense ? 0.085 : 0.045, this.ctx.currentTime, 0.6)
  }

  stopMusic() {
    if (this.musicTimer !== null) { clearInterval(this.musicTimer); this.musicTimer = null }
    this.musicGain?.disconnect()
    this.musicGain = null
  }

  dispose() {
    this.stopMusic()
    void this.ctx?.close().catch(() => { /* já fechado */ })
    this.ctx = null
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  private buildEngine() {
    const ctx = this.ctx!
    this.engOsc1 = ctx.createOscillator()
    this.engOsc1.type = "sawtooth"
    this.engOsc2 = ctx.createOscillator()
    this.engOsc2.type = "square"
    this.engFilter = ctx.createBiquadFilter()
    this.engFilter.type = "lowpass"
    this.engFilter.frequency.value = 600
    this.engGain = ctx.createGain()
    this.engGain.gain.value = 0

    const sub = ctx.createGain()
    sub.gain.value = 0.5
    this.engOsc2.connect(sub)
    sub.connect(this.engFilter)
    this.engOsc1.connect(this.engFilter)
    this.engFilter.connect(this.engGain)
    this.engGain.connect(this.master!)
    this.engOsc1.start()
    this.engOsc2.start()
  }

  private async buildMotor() {
    const ctx = this.ctx
    if (!ctx || !ctx.audioWorklet) return
    try {
      const { default: url } = await import("./sound/engine-worklet.ts?worker&url")
      await ctx.audioWorklet.addModule(url)
    } catch { return } // sem worklet: fica o motor de osciladores
    if (this.ctx !== ctx || !this.master) return
    const f = (type: BiquadFilterType, fr: number, q?: number, gain?: number) => {
      const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = fr
      if (q !== undefined) b.Q.value = q
      if (gain !== undefined) b.gain.value = gain
      return b
    }
    const node = new AudioWorkletNode(ctx, "autodash-motor", { numberOfInputs: 0, outputChannelCount: [2] })
    const split = ctx.createChannelSplitter(2)
    node.connect(split)
    // escape: tira DC, corpo, coletor, abafador e brilho
    const hp = f("highpass", 35, 0.7), boom = f("peaking", 90, 1, 6), coletor = f("peaking", 360, 1.4, 3)
    const lp = f("lowpass", 2000, 0.5), brilho = f("highshelf", 2400, undefined, 3)
    split.connect(hp, 0); hp.connect(boom); boom.connect(coletor); coletor.connect(lp); lp.connect(brilho)
    // admissão: só aparece no alto giro com pé no fundo
    const admHp = f("highpass", 300, 0.7), admBp = f("bandpass", 1000, 1.4), admGain = ctx.createGain()
    admGain.gain.value = 0
    split.connect(admHp, 1); admHp.connect(admBp); admBp.connect(admGain)
    // saturação leve (tanh) + compressor: cola os pulsos num ronco só
    const mix = ctx.createGain()
    brilho.connect(mix); admGain.connect(mix)
    const sh = ctx.createWaveShaper()
    const curva = new Float32Array(2048)
    for (let i = 0; i < 2048; i++) { const x = i / 1024 - 1; curva[i] = Math.tanh(0.8 * x) / Math.tanh(0.8) }
    sh.curve = curva
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -20; comp.ratio.value = 3; comp.knee.value = 12; comp.attack.value = 0.015; comp.release.value = 0.3
    const out = ctx.createGain()
    out.gain.value = 0
    mix.connect(sh); sh.connect(comp); comp.connect(out); out.connect(this.master)
    // efeitos de alívio passam pela mesma saturação (soam "do escape")
    const fx = ctx.createGain()
    fx.connect(sh)
    // turbo: apito do eixo (seno + harmônico inarmônico) e sopro filtrado
    const apito = ctx.createOscillator(), apito2 = ctx.createOscillator(), apito2g = ctx.createGain(), apitoGain = ctx.createGain()
    apito.type = "sine"; apito2.type = "sine"; apito2g.gain.value = 0.18; apitoGain.gain.value = 0
    apito.connect(apitoGain); apito2.connect(apito2g); apito2g.connect(apitoGain); apitoGain.connect(out)
    apito.start(); apito2.start()
    const ruido = ctx.createBufferSource(); ruido.buffer = this.noiseBuffer(2); ruido.loop = true
    const sopro = f("lowpass", 2600, 4), soproGain = ctx.createGain(); soproGain.gain.value = 0
    ruido.connect(sopro); sopro.connect(soproGain); soproGain.connect(out); ruido.start()
    // compressor mecânico (Roots/centrífugo): zumbido preso ao giro
    const whine = ctx.createOscillator(), whineBp = f("bandpass", 1500, 6), whineGain = ctx.createGain()
    whine.type = "sawtooth"; whineGain.gain.value = 0
    whine.connect(whineBp); whineBp.connect(whineGain); whineGain.connect(out); whine.start()
    // estouros: 4 variações pré-renderizadas (seno grave que cai + ruído curto)
    const sr = ctx.sampleRate
    const pops = [0, 1, 2, 3].map(k => {
      const len = Math.floor(sr * 0.12), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0)
      const f0 = 70 + k * 22, tn = 0.006 + k * 0.003, mixN = [0.75, 0.55, 0.4, 0.65][k]
      let lpS = 0, pk = 0
      for (let i = 0; i < len; i++) {
        const t = i / sr
        lpS += (Math.random() * 2 - 1 - lpS) * (0.35 + 0.15 * k)
        d[i] = (1 - mixN) * Math.sin(2 * Math.PI * f0 * t * (1 - t * 2)) * Math.exp(-t / 0.03) + mixN * lpS * Math.exp(-t / tn) * 1.8
        pk = Math.max(pk, Math.abs(d[i]))
      }
      for (let i = 0; i < len; i++) d[i] = d[i] / pk * 0.6
      return b
    })
    this.motor = { node, boom, coletor, lp, admBp, admGain, out, fx, apito, apito2, apitoGain, sopro, soproGain, whine, whineGain, pops }
    this.aplicarPerfil()
    // o motor antigo sai de cena
    this.engGain?.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
  }

  /** Troca o motor (perfil de som) do carro atual. Barato se não mudou. */
  setProfile(p: EngineSoundProfile) {
    if (p.id === this.perfil.id) return
    this.perfil = p
    this.aplicarPerfil()
  }

  private aplicarPerfil() {
    const m = this.motor, ctx = this.ctx
    if (!m || !ctx) return
    const p = this.perfil, t = ctx.currentTime
    m.node.port.postMessage({ perfil: p.id })
    // o timbre agora vem dos dutos do modelo físico: os filtros só dão um toque
    m.boom.frequency.setTargetAtTime(p.boomHz, t, 0.05); m.boom.gain.setTargetAtTime(p.boomDb * 0.35, t, 0.05)
    m.coletor.frequency.setTargetAtTime(p.coletorHz, t, 0.05); m.coletor.gain.setTargetAtTime(0, t, 0.05)
  }

  private estouro(vol: number) {
    const m = this.motor, ctx = this.ctx
    if (!m || !ctx) return
    const src = ctx.createBufferSource()
    src.buffer = m.pops[Math.floor(Math.random() * m.pops.length)]
    src.playbackRate.value = 0.85 + Math.random() * 0.35
    const g = ctx.createGain(); g.gain.value = vol
    src.connect(g); g.connect(m.fx); src.start()
  }

  // alívio do turbo: flutter ("tututu", surto do compressor) ou blow-off ("pssh")
  private alivio(nivel: number, flutter: boolean) {
    const m = this.motor, ctx = this.ctx
    if (!m || !ctx) return
    const t0 = ctx.currentTime
    const ruido = this.noiseBuffer(0.6)
    if (!flutter) {
      const src = ctx.createBufferSource(); src.buffer = ruido
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 3000
      const pk = ctx.createBiquadFilter(); pk.type = "peaking"; pk.frequency.value = 6500; pk.gain.value = 4; pk.Q.value = 0.8
      const g = ctx.createGain(), d = 0.15 + 0.15 * nivel
      g.gain.setValueAtTime(0.3 * nivel, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d)
      src.connect(hp); hp.connect(pk); pk.connect(g); g.connect(m.fx); src.start(t0); src.stop(t0 + d + 0.05)
      return
    }
    let at = t0 + 0.015, hz = 13
    const fim = t0 + 0.45 + nivel * 0.45
    while (at < fim) {
      const iv = 1 / hz, fase = (at - t0) / (fim - t0)
      const src = ctx.createBufferSource(); src.buffer = ruido
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2800 * (1 - 0.55 * fase); bp.Q.value = 1.8
      const g = ctx.createGain(), a = 0.34 * nivel * (1 - 0.75 * fase) * (0.85 + Math.random() * 0.3)
      g.gain.setValueAtTime(a, at); g.gain.linearRampToValueAtTime(0.0001, at + iv * 0.9)
      src.connect(bp); bp.connect(g); g.connect(m.fx); src.start(at, Math.random() * 0.4); src.stop(at + iv)
      at += iv; hz = Math.max(7.5, hz * 0.95)
    }
  }

  /** Motor por pulsos: chamado a cada quadro por engine(). */
  private motorFrame(rpm: number, gas: number, nitro: boolean, running: boolean, noCorte: boolean, boostFisico: number) {
    const m = this.motor!, ctx = this.ctx!, p = this.perfil, t = ctx.currentTime
    const dt = Math.min(0.1, Math.max(0, t - this.lastT)); this.lastT = t
    const corte = noCorte && gas > 0.5
    const carga = t < this.cortaCargaAte ? 0 : gas
    m.node.port.postMessage({ st: { rpm, carga, ligado: running, corte } })
    // volume cresce com o giro (o pulso individual encolhe em giro alto; o motor
    // de verdade fica mais alto em cima). Calibrado para a mesma faixa do antigo.
    m.out.gain.setTargetAtTime(running ? 0.5 * (0.85 + 0.35 * Math.min(rpm, 8000) / 7000) : 0, t, running ? 0.05 : 0.15)
    if (!running) { this.lastGas = 0; return }
    // abafador abre com o giro e com o pé
    // abafador mais aberto: o modelo físico já tem o próprio abafador
    m.lp.frequency.setTargetAtTime(Math.min(9000, 2500 + rpm * 0.5 + gas * 1500 + (nitro ? 800 : 0)), t, 0.03)
    const alto = Math.min(1, Math.max(0, (rpm - 4200) / 2600))
    m.admBp.frequency.setTargetAtTime(Math.min(1500, 600 + rpm * 0.12), t, 0.03)
    // a admissão já vem misturada no modelo físico; a camada extra fica bem baixa
    m.admGain.gain.setTargetAtTime(gas * alto * alto * p.admissao * 0.15, t, 0.04)

    // indução: boost sobe com giro e pé (atraso do turbo), cai rápido ao aliviar
    const turbo = p.inducao === "turbo" || p.inducao === "biturbo"
    if (boostFisico >= 0) this.boost = boostFisico // mesmo atraso que o jogador sente
    else {
      const alvo = gas * Math.min(1, Math.max(0, (rpm - 2200) / 2600))
      this.boost += (alvo - this.boost) * Math.min(1, dt / (alvo > this.boost ? 0.35 : 0.07))
    }
    this.eixo += (this.boost - this.eixo) * Math.min(1, dt / (this.boost > this.eixo ? 0.25 : 0.35))
    if (turbo) {
      const hz = 1100 + this.eixo * 2300, vib = 1 + 0.004 * Math.sin(t * 37)
      m.apito.frequency.setTargetAtTime(hz * vib, t, 0.04); m.apito2.frequency.setTargetAtTime(hz * 2.27 * vib, t, 0.04)
      m.apitoGain.gain.setTargetAtTime(this.eixo * this.eixo * (0.015 + 0.04 * gas), t, 0.05)
      m.sopro.frequency.setTargetAtTime(2000 + this.boost * 1800, t, 0.08)
      m.soproGain.gain.setTargetAtTime(this.boost * gas * 0.035 + (nitro ? 0.03 : 0), t, 0.06)
      // tirou o pé com pressão no coletor: alivia (turbo simples = flutter, biturbo = blow-off)
      if (this.lastGas > 0.5 && gas < 0.3 && this.eixo > 0.35) this.alivio(Math.max(0.5, this.eixo), p.inducao === "turbo")
    } else {
      m.apitoGain.gain.setTargetAtTime(0, t, 0.05)
      m.soproGain.gain.setTargetAtTime(nitro ? 0.03 : 0, t, 0.06)
    }
    if (p.inducao === "roots" || p.inducao === "centrifugo") {
      // zumbido preso ao giro: polia ~2,4× × lóbulos/palhetas (estimativa); centrífugo só cresce em cima
      const hz = rpm / 60 * (p.inducao === "roots" ? 2.4 * 6 : 2.4 * 12)
      m.whine.frequency.setTargetAtTime(hz, t, 0.03)
      const k = p.inducao === "roots" ? 0.02 + 0.03 * gas : 0.04 * alto
      m.whineGain.gain.setTargetAtTime(k * Math.min(1, rpm / 3000), t, 0.05)
    } else m.whineGain.gain.setTargetAtTime(0, t, 0.05)

    // estouros ao tirar o pé em giro alto (combustível queimando no escape)
    if (gas > 0.6 && rpm > 3300) this.gasAltoT = t
    if (this.lastGas > 0.5 && gas < 0.15 && t - this.gasAltoT < 0.5 && Math.random() < p.pops + 0.2) {
      this.estouroAte = t + 0.4 + Math.random() * 0.8 * p.pops
      this.proxEstouro = t
    }
    if (gas > 0.3) this.estouroAte = 0
    if (t < this.estouroAte && rpm > 1800 && t >= this.proxEstouro) {
      this.estouro((0.3 + Math.random() * 0.45) * Math.min(1, p.pops + 0.3))
      this.proxEstouro = t + 0.04 + Math.random() * (Math.random() < 0.25 ? 0.25 : 0.11)
    }
    this.lastGas = gas
  }

  private buildLoops() {
    const ctx = this.ctx!
    const mkLoop = (filterType: BiquadFilterType, freq: number) => {
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuffer(2)
      src.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = filterType
      filter.frequency.value = freq
      const gain = ctx.createGain()
      gain.gain.value = 0
      src.connect(filter)
      filter.connect(gain)
      gain.connect(this.master!)
      src.start()
      return gain
    }
    this.skidGain = mkLoop("bandpass", 900)
    this.rainGain = mkLoop("highpass", 3000)
  }

  // caráter do motor por carro: pitch (grave V8 <1, agudo rotativo/4cil >1) e
  // brilho do filtro (encorpado x metálico). Default = motor "genérico".
  private engPitch = 1
  private engBright = 1
  setEngine(pitch: number, bright: number) {
    this.engPitch = pitch
    this.engBright = bright
  }

  /** Chamado a cada frame: afina o ronco do motor pelo RPM. */
  // `corte`: o motor está no limitador (cada motor corta num giro, physics/motores.ts).
  // `boost`: pressão do turbo vinda da física (0..1); −1 = o áudio estima sozinho.
  engine(rpm: number, throttle: number, nitro: boolean, running: boolean, corte = false, boost = -1) {
    if (this.motor && this.ctx) { this.motorFrame(rpm, throttle, nitro, running, corte, boost); return }
    if (!this.ctx || !this.engOsc1 || !this.engOsc2 || !this.engGain || !this.engFilter) return
    const t = this.ctx.currentTime
    if (!running) {
      this.engGain.gain.setTargetAtTime(0, t, 0.1)
      return
    }
    const f = (28 + rpm / 26) * this.engPitch
    this.engOsc1.frequency.setTargetAtTime(f, t, 0.03)
    this.engOsc2.frequency.setTargetAtTime(f / 2, t, 0.03)
    this.engFilter.frequency.setTargetAtTime((300 + rpm / 4 + (nitro ? 900 : 0)) * this.engBright, t, 0.05)
    const vol = 0.05 + throttle * 0.10 + rpm / 80000 + (nitro ? 0.05 : 0)
    this.engGain.gain.setTargetAtTime(vol, t, 0.05)
  }

  skid(intensity: number) {
    if (this.skidGain && this.ctx)
      this.skidGain.gain.setTargetAtTime(Math.min(0.25, intensity * 0.25), this.ctx.currentTime, 0.08)
  }

  rain(on: boolean) {
    if (this.rainGain && this.ctx)
      this.rainGain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.5)
  }

  private blip(freq: number, ms: number, vol: number, type: OscillatorType = "sine", delayMs = 0) {
    if (!this.ctx || !this.master || !this.enabled) return
    const ctx = this.ctx
    const t0 = ctx.currentTime + delayMs / 1000
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + ms / 1000)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t0)
    osc.stop(t0 + ms / 1000)
  }

  private burst(ms: number, vol: number, freq = 1000, type: BiquadFilterType = "lowpass") {
    if (!this.ctx || !this.master || !this.enabled) return
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(ms / 1000 + 0.05)
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start()
    src.stop(ctx.currentTime + ms / 1000 + 0.05)
  }

  ui() { this.blip(880, 70, 0.15) }
  uiLow() { this.blip(560, 70, 0.15) }
  shift() {
    if (this.motor && this.ctx) {
      // troca com o motor por pulsos: corte de ignição curto (a carga cai) e um
      // clique seco, mais baixo que o antigo
      this.cortaCargaAte = this.ctx.currentTime + 0.09
      this.burst(60, 0.1, 2200, "bandpass")
      return
    }
    this.burst(90, 0.25, 2200, "bandpass"); this.blip(190, 60, 0.2, "square")
  }
  bog() { this.blip(120, 300, 0.25, "sawtooth") }
  limiter() { this.burst(45, 0.2, 3000, "highpass") }
  horn() { this.blip(420, 350, 0.12, "square"); this.blip(530, 350, 0.12, "square") }
  nearMiss() { this.burst(200, 0.3, 1600, "bandpass") }
  nitro() { this.burst(500, 0.35, 800, "lowpass"); this.blip(300, 400, 0.2, "sawtooth") }
  crash() {
    this.burst(600, 0.7, 500, "lowpass")
    this.blip(60, 500, 0.5, "sine")
  }
  pickup() { this.blip(660, 70, 0.22); this.blip(880, 70, 0.22, "sine", 70); this.blip(1180, 140, 0.28, "sine", 140) }
  flash() { this.blip(1250, 55, 0.18); this.blip(1250, 55, 0.18, "sine", 110) }
  warn() { this.blip(980, 80, 0.16, "square"); this.blip(980, 80, 0.12, "square", 150) }
  levelUp() { this.blip(440, 110, 0.26, "square"); this.blip(554, 110, 0.26, "square", 110); this.blip(659, 110, 0.26, "square", 220); this.blip(880, 300, 0.3, "square", 330) }
  shieldBreak() { this.blip(700, 80, 0.3); this.blip(500, 80, 0.3, "sine", 80); this.blip(350, 160, 0.3, "sine", 160) }
  semaphoreRed() { this.blip(440, 120, 0.25, "square") }
  semaphoreGreen() { this.blip(880, 300, 0.3, "square") }
  perfectLaunch() { this.blip(660, 90, 0.25); this.blip(880, 90, 0.25); this.blip(1100, 160, 0.3) }
  score() { this.blip(1300, 80, 0.2) }
  offroad() { this.burst(120, 0.15, 300, "lowpass") }
}
