// AutoDash — áudio 100% sintetizado via WebAudio (sem assets externos).

export class AudioBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null

  // motor
  private engOsc1: OscillatorNode | null = null
  private engOsc2: OscillatorNode | null = null
  private engGain: GainNode | null = null
  private engFilter: BiquadFilterNode | null = null

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

  /** Chamado a cada frame: afina o ronco do motor pelo RPM. */
  engine(rpm: number, throttle: number, nitro: boolean, running: boolean) {
    if (!this.ctx || !this.engOsc1 || !this.engOsc2 || !this.engGain || !this.engFilter) return
    const t = this.ctx.currentTime
    if (!running) {
      this.engGain.gain.setTargetAtTime(0, t, 0.1)
      return
    }
    const f = 28 + rpm / 26
    this.engOsc1.frequency.setTargetAtTime(f, t, 0.03)
    this.engOsc2.frequency.setTargetAtTime(f / 2, t, 0.03)
    this.engFilter.frequency.setTargetAtTime(300 + rpm / 4 + (nitro ? 900 : 0), t, 0.05)
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
  shift() { this.burst(90, 0.25, 2200, "bandpass"); this.blip(190, 60, 0.2, "square") }
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
