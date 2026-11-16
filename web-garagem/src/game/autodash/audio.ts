// AutoDash — áudio via WebAudio: motor por modelo físico + gravações reais CC0
// (public/autodash/som/, créditos em CREDITOS.md); o resto é sintetizado.
import { type EngineSoundProfile, ENGINE_PROFILES, GRAVACAO_DO_PERFIL, TEXTURA } from "./sound/profiles"
import { graosDoJson } from "./sound/motor-gravado"
import type { Turbo } from "./physics/motores"
import { eixoDoSom, GatilhoAlivio } from "./sound/turbo-synth"

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
  ambGain: GainNode       // eco do ambiente (aberto x viaduto/túnel)
  synthGain: GainNode     // modelo físico (guias de onda)
  gravHp: BiquadFilterNode // gravação real: banda cheia (motor gravado) ou só agudos (textura)
  gravEq: BiquadFilterNode // corpo do escape (pico em 80–250 Hz), por gravação
  gravLp: BiquadFilterNode // corta o chiado de cofre acima de `topoHz`, por gravação
  gravGain: GainNode
  fx: GainNode            // estouros
  soproGain: GainNode     // sopro do nitro (o turbo inteiro vem do worklet, sound/turbo-synth.ts)
  whine: OscillatorNode   // compressor mecânico
  whineGain: GainNode
  pops: AudioBuffer[]
  // bancos de grãos deste worklet: já entregues e ainda baixando (um worklet
  // novo começa sem nenhum)
  bancos: Set<string>
  carregando: Set<string>
  faixas: Map<string, { rpm: [number, number]; nivel: number }> // giro que cada gravação cobre e o nível dela
}

// nível de referência das gravações (RMS dos grãos de carga do Renault, tools/som/nivel.py)
const NIVEL_REF = 0.135

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
  private eixo = 0          // rotação do eixo da turbina, 0..1 (tem inércia própria)
  private turbo: Turbo | null = null
  private gatilho = new GatilhoAlivio()
  private corteMotor = 7900
  private lastT = 0
  private lastGas = 0
  private gasAltoT = -1     // último instante com pé no fundo em giro alto
  private estouroAte = 0
  private proxEstouro = 0
  private cortaCargaAte = 0
  private partidaBuf: AudioBuffer | null = null
  private partidaAte = 0               // motor mudo enquanto o motor de arranque gira

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
    // limitador na saída: motor, ambiente, música e efeitos (pickup, nitro) somam
    // direto no master; sem ele, um efeito em cima do motor alto passava de 0 dBFS
    // e o navegador ceifava seco (o "bug" no áudio ao pegar powerup)
    const lim = this.ctx.createDynamicsCompressor()
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20
    lim.attack.value = 0.002; lim.release.value = 0.12
    this.master.connect(lim)
    lim.connect(this.ctx.destination)
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
        src.buffer = this.ruido()
        const hp = ctx.createBiquadFilter()
        hp.type = "highpass"
        hp.frequency.value = 7000
        const hg = ctx.createGain()
        hg.gain.setValueAtTime(0.25, t)
        hg.gain.exponentialRampToValueAtTime(0.01, t + 0.05)
        src.connect(hp); hp.connect(hg); hg.connect(g)
        src.start(t, this.trechoRuido(0.06)); src.stop(t + 0.06)
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
    // o motor e os instantes marcados pertencem ao contexto fechado: um ensure()
    // depois daqui começa do zero (senão o relógio novo, que volta a 0, ficaria
    // mudo até alcançar o `partidaAte` antigo)
    this.motor = null; this.ruidoFx = null
    this.partidaAte = 0; this.cortaCargaAte = 0; this.estouroAte = 0; this.proxEstouro = 0
    this.lastT = 0; this.gasAltoT = -1
  }

  // ruído compartilhado pelos efeitos curtos (estalo, alívio, chimbal): cada
  // disparo toca um trecho sorteado em vez de gerar um buffer novo
  private ruidoFx: AudioBuffer | null = null
  private static readonly RUIDO_FX_S = 2
  private ruido(): AudioBuffer {
    return this.ruidoFx ??= this.noiseBuffer(AudioBus.RUIDO_FX_S)
  }
  /** Início sorteado no ruído compartilhado para tocar `dur` segundos. */
  private trechoRuido(dur: number): number {
    return Math.random() * Math.max(0, AudioBus.RUIDO_FX_S - dur)
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
    // saída 0: modelo físico (escape, admissão); saída 1: gravação real; saída 2: turbo
    const node = new AudioWorkletNode(ctx, "autodash-motor", { numberOfInputs: 0, numberOfOutputs: 3, outputChannelCount: [2, 1, 1] })
    const split = ctx.createChannelSplitter(2)
    node.connect(split)
    // escape: tira DC, corpo, coletor, abafador e brilho
    const hp = f("highpass", 35, 0.7), boom = f("peaking", 90, 1, 6), coletor = f("peaking", 360, 1.4, 3)
    const lp = f("lowpass", 2000, 0.5), brilho = f("highshelf", 2400, undefined, 3)
    split.connect(hp, 0); hp.connect(boom); boom.connect(coletor); coletor.connect(lp); lp.connect(brilho)
    // gravação: não passa pelo "escape" do sintetizador (o timbre já é real)
    const gravHp = f("highpass", 30, 0.7), gravGain = ctx.createGain(), synthGain = ctx.createGain()
    gravGain.gain.value = 0
    const gravEq = f("peaking", 120, 0.9, 0), gravLp = f("lowpass", 20000, 0.7)
    node.connect(gravHp, 1); gravHp.connect(gravEq); gravEq.connect(gravLp); gravLp.connect(gravGain)
    // admissão: só aparece no alto giro com pé no fundo
    const admHp = f("highpass", 300, 0.7), admBp = f("bandpass", 1000, 1.4), admGain = ctx.createGain()
    admGain.gain.value = 0
    split.connect(admHp, 1); admHp.connect(admBp); admBp.connect(admGain)
    // saturação leve (tanh) + compressor: cola os pulsos num ronco só
    const mix = ctx.createGain()
    brilho.connect(synthGain); synthGain.connect(mix); admGain.connect(mix); gravGain.connect(mix)
    // o WaveShaper só aceita ±1 e corta seco acima (os transientes de W16/V12 ao
    // pisar passam de 2): entra pela metade numa curva que cobre ±2. Até ±1 é a
    // mesma tanh de antes; acima, satura macio em vez de ceifar
    const sh = ctx.createWaveShaper(), pre = ctx.createGain()
    pre.gain.value = 0.5
    const curva = new Float32Array(4096)
    for (let i = 0; i < 4096; i++) { const x = 2 * (i / 2048 - 1); curva[i] = Math.tanh(0.8 * x) / Math.tanh(0.8) }
    sh.curve = curva
    sh.oversample = "2x"
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -20; comp.ratio.value = 3; comp.knee.value = 12; comp.attack.value = 0.015; comp.release.value = 0.3
    const out = ctx.createGain()
    out.gain.value = 0
    mix.connect(pre); pre.connect(sh); sh.connect(comp); comp.connect(out); out.connect(this.master)
    // ambiente: reflexo no asfalto + ecos curtos (guard-rail, prédios). Embaixo do
    // viaduto/túnel o eco cresce (ambiente()); o motor seco soa "de estúdio"
    const amb = ctx.createConvolver(), ambGain = ctx.createGain()
    amb.normalize = false
    amb.buffer = this.respostaAmbiente()
    ambGain.gain.value = 0.18
    out.connect(amb); amb.connect(ambGain); ambGain.connect(this.master)
    // efeitos de alívio passam pela mesma saturação (soam "do escape")
    const fx = ctx.createGain()
    fx.connect(pre)
    // turbo (apito, sopro, blow-off e flutter) sai pronto do worklet, na mesma escala dos ganhos antigos
    node.connect(out, 2)
    // sopro do nitro
    const ruido = ctx.createBufferSource(); ruido.buffer = this.noiseBuffer(2); ruido.loop = true
    const sopro = f("bandpass", 2600, 1.2), soproGain = ctx.createGain(); soproGain.gain.value = 0
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
    this.motor = { node, boom, coletor, lp, admBp, admGain, out, ambGain, synthGain, gravHp, gravEq, gravLp, gravGain, fx, soproGain, whine, whineGain, pops, bancos: new Set(), carregando: new Set(), faixas: new Map() }
    this.aplicarPerfil()
    void this.carregarPartida()
    // o motor antigo sai de cena
    this.engGain?.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
  }

  /** Resposta ao impulso do ambiente: chão a ~1,5 ms (abafado) + ecos esparsos
   *  de 12 a 90 ms que decaem, e uma cauda curta de ruído. Gerada uma vez. */
  private respostaAmbiente(): AudioBuffer {
    const ctx = this.ctx!, sr = ctx.sampleRate, len = Math.floor(sr * 0.6)
    const b = ctx.createBuffer(2, len, sr)
    let seed = 0x5eed
    const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296 }
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c)
      // reflexo do asfalto: atraso curto, ganho alto, agudos perdidos
      const chao = Math.floor(sr * (0.0014 + c * 0.0002))
      for (let k = 0; k < 12; k++) d[chao + k] += 0.35 * Math.exp(-k / 3) / 2.2
      // ecos discretos (cada lado diferente: abre o estéreo)
      for (let e = 0; e < 9; e++) {
        const t = 0.012 + rnd() * 0.08, i = Math.floor(t * sr)
        d[i] += (rnd() < 0.5 ? -1 : 1) * 0.22 * Math.exp(-t / 0.05)
      }
      // cauda difusa, escura (passa-baixa simples)
      let lp = 0
      for (let i = Math.floor(sr * 0.02); i < len; i++) {
        lp += ((rnd() * 2 - 1) - lp) * 0.25
        d[i] += lp * 0.05 * Math.exp(-(i / sr - 0.02) / 0.12)
      }
    }
    return b
  }

  /** Ambiente acústico: "aberto" (estrada) ou "fechado" (viaduto, túnel: eco forte). */
  ambiente(tipo: "aberto" | "fechado") {
    const m = this.motor, ctx = this.ctx
    if (!m || !ctx) return
    m.ambGain.gain.setTargetAtTime(tipo === "fechado" ? 0.75 : 0.18, ctx.currentTime, 0.25)
  }

  /** Turbina do motor atual (physics/motores.ts) e o corte, que escala a energia do escape. */
  setTurbo(t: Turbo | null | undefined, corte: number) {
    this.turbo = t ?? null
    this.corteMotor = corte
    this.enviarTurbo()
  }

  // config do turbo no worklet: turbina da física + perfil de som (indução e cilindros).
  // Chamado a cada quadro (setTurbo): só manda quando muda.
  private turboEnviado = ""
  private enviarTurbo() {
    const m = this.motor
    if (!m) return
    const p = this.perfil, tb = this.turbo
    const usa = !!tb && (p.inducao === "turbo" || p.inducao === "biturbo")
    const cfg = usa ? { apito: tb.apito, turbinas: tb.turbinas ?? 1, cilindros: p.eventos.length, flutter: p.inducao === "turbo" } : null
    const chave = JSON.stringify(cfg)
    if (chave === this.turboEnviado) return
    this.turboEnviado = chave
    m.node.port.postMessage({ turbo: cfg })
  }

  /** Troca o motor (perfil de som) do carro atual. Barato se não mudou. */
  setProfile(p: EngineSoundProfile) {
    if (p.id === this.perfil.id) return
    this.perfil = p
    this.aplicarPerfil()
  }

  private base(arq: string): string {
    return `${import.meta.env.BASE_URL ?? "/"}autodash/som/${arq}`
  }

  /** Baixa e decodifica um banco de grãos (tools/som) e manda para o worklet.
   *  Só conta como pronto depois de entregue: até lá o modelo físico toca sozinho. */
  private async carregarBanco(nome: string) {
    const ctx = this.ctx, m = this.motor
    if (!ctx || !m || m.bancos.has(nome) || m.carregando.has(nome)) return
    m.carregando.add(nome)
    try {
      const [j, bin] = await Promise.all([
        fetch(this.base(`${nome}.json`)).then(r => r.json() as Promise<{ arquivo: string; clique: number; voltasPorGrao?: number; nivel?: number; graos: number[][] }>),
        fetch(this.base(`${nome}.mp3`)).then(r => r.arrayBuffer()),
      ])
      const buf = await ctx.decodeAudioData(bin)
      if (this.motor !== m) return // contexto fechado ou worklet refeito no meio do caminho
      const dados = buf.getChannelData(0).slice()
      // o MP3 pode chegar atrasado (atraso do codificador): acha o clique de
      // alinhamento e desloca os grãos para bater com o áudio decodificado
      let pk = 0, pi = 0
      const ate = Math.min(dados.length, Math.floor(buf.sampleRate * (j.clique + 0.08)))
      for (let i = 0; i < ate; i++) if (Math.abs(dados[i]) > pk) { pk = Math.abs(dados[i]); pi = i }
      const desvio = pi / buf.sampleRate - j.clique
      const graos = graosDoJson(j.graos)
      for (let i = 0; i < graos.length; i += 6) graos[i] += desvio
      const voltasPorGrao = j.voltasPorGrao ?? 0.5
      // faixa gravada em rpm (2% e 98% dos grãos), para devolver à síntese fora dela
      const hz = j.graos.map(g => g[3]).sort((a, b) => a - b)
      m.faixas.set(nome, {
        rpm: [hz[Math.floor(hz.length * 0.02)] * 60 * voltasPorGrao, hz[Math.floor(hz.length * 0.98)] * 60 * voltasPorGrao],
        // gravações de níveis diferentes: iguala ao Renault (0,135 nos grãos de carga), a referência da mixagem
        // os bancos do simulador saem mais altos (nível ~0,43): piso 0,25 para igualá-los
        nivel: Math.min(3.5, Math.max(0.25, NIVEL_REF / (j.nivel ?? NIVEL_REF))),
      })
      m.node.port.postMessage({ banco: { nome, sr: buf.sampleRate, dados, graos, voltasPorGrao } }, [dados.buffer, graos.buffer])
      m.bancos.add(nome)
      this.aplicarPerfil()
    } catch {
      // fica só o modelo físico; tenta de novo na próxima troca de motor
    } finally {
      m.carregando.delete(nome)
    }
  }

  private async carregarPartida() {
    const ctx = this.ctx
    if (!ctx || this.partidaBuf) return
    try {
      const bin = await fetch(this.base("partida.mp3")).then(r => r.arrayBuffer())
      this.partidaBuf = await ctx.decodeAudioData(bin)
    } catch { /* sem partida: o motor só liga */ }
  }

  /** Motor de arranque + pegada (gravação real). O ronco entra quando o motor pega. */
  partida(ligaEm?: number) {
    const ctx = this.ctx, m = this.motor
    if (!ctx || !m || !this.partidaBuf || !this.enabled) return
    const src = ctx.createBufferSource(), g = ctx.createGain()
    src.buffer = this.partidaBuf
    // motor grande: arranque mais pesado
    src.playbackRate.value = this.perfil.eventos.length >= 8 ? 0.88 : this.perfil.eventos.length >= 6 ? 0.94 : 1
    // a gravação pega por volta de 1,2 s e segue em lenta até 2,6 s: o ronco do
    // jogo assume logo depois da pegada e a lenta gravada sai (sem duas lentas)
    const r = src.playbackRate.value, t0 = ctx.currentTime
    g.gain.setValueAtTime(0.55, t0)
    g.gain.setValueAtTime(0.55, t0 + 1.2 / r)
    g.gain.linearRampToValueAtTime(0, t0 + 1.75 / r)
    src.connect(g); g.connect(this.master!)
    src.start(); src.stop(t0 + 1.8 / r)
    this.partidaAte = t0 + (ligaEm ?? 1.15 / r) // com `ligaEm`, o ronco entra junto com a etapa de partida do jogo
  }

  // gravação em uso: própria do motor ou só textura; mix e faixa de giro coberta
  private grav: { proprio: boolean; mix: number; sint?: number; burble: number; faixa: [number, number]; nivel: number } | null = null
  private ultimoRpm = 2000

  /** Mistura gravação × modelo físico. Dentro da faixa gravada vale o `mix` do
   *  perfil; fora dela (giro que a gravação não alcança) a gravação sai aos
   *  poucos e a síntese assume, em vez de tocar o grão reamostrado e esganiçado. */
  private misturarGravacao(rpm: number, tau: number) {
    const m = this.motor, ctx = this.ctx
    if (!m || !ctx) return
    const t = ctx.currentTime, gv = this.grav
    if (!gv) {
      m.gravGain.gain.setTargetAtTime(0, t, tau); m.synthGain.gain.setTargetAtTime(1, t, tau)
      return
    }
    const [lo, hi] = gv.faixa
    const sobe = Math.min(1, Math.max(0, (hi * 1.35 - rpm) / (hi * 0.27)))  // 1 até hi×1,08, 0 em hi×1,35
    const desce = Math.min(1, Math.max(0, (rpm - lo * 0.7) / (lo * 0.2)))   // 1 a partir de lo×0,9
    const cob = Math.min(sobe, desce)
    // a gravação sai ~2× mais forte que o modelo físico no pé no fundo (medido offline)
    m.gravGain.gain.setTargetAtTime(gv.mix * (gv.proprio ? 0.6 : 0.9) * gv.nivel * cob, t, tau)
    // `sint`: o que sobra do modelo físico dentro da faixa gravada (padrão: 1 − 0,7·mix)
    m.synthGain.gain.setTargetAtTime(gv.proprio ? 1 - (1 - (gv.sint ?? 1 - gv.mix * 0.7)) * cob : 1, t, tau)
  }

  private aplicarPerfil() {
    const m = this.motor, ctx = this.ctx
    if (!m || !ctx) return
    const p = this.perfil, t = ctx.currentTime
    m.node.port.postMessage({ perfil: p.id })
    this.enviarTurbo()
    // gravação real: motor gravado (mesma família) ou só a textura mecânica
    const grav = GRAVACAO_DO_PERFIL[p.id], g = grav ?? TEXTURA
    const pronto = m.bancos.has(g.banco)
    if (!pronto) void this.carregarBanco(g.banco)
    else m.node.port.postMessage({ usar: g.banco })
    m.node.port.postMessage({ gravado: pronto })
    m.gravHp.frequency.setTargetAtTime(grav ? 30 : 1800, t, 0.05)
    // EQ de escape da gravação (por banco): corpo em 80–250 Hz e teto contra o chiado de cofre
    m.gravEq.frequency.setTargetAtTime(g.corpo?.[0] ?? 120, t, 0.05); m.gravEq.gain.setTargetAtTime(g.corpo?.[1] ?? 0, t, 0.05)
    m.gravLp.frequency.setTargetAtTime(g.topoHz ?? 20000, t, 0.05)
    const fx = m.faixas.get(g.banco)
    this.grav = pronto ? { proprio: !!grav, mix: g.mix, sint: g.sint, burble: g.burble ?? 0, faixa: fx?.rpm ?? [0, 1e9], nivel: fx?.nivel ?? 1 } : null
    this.misturarGravacao(this.ultimoRpm, 0.1)
    // o timbre agora vem dos dutos do modelo físico: os filtros só dão um toque
    m.boom.frequency.setTargetAtTime(p.boomHz, t, 0.05); m.boom.gain.setTargetAtTime(p.boomDb * 0.35, t, 0.05)
    m.coletor.frequency.setTargetAtTime(p.coletorHz, t, 0.05); m.coletor.gain.setTargetAtTime(0, t, 0.05)
  }

  private estouro(vol: number, burble = 0) {
    const m = this.motor, ctx = this.ctx
    if (!m || !ctx) return
    const src = ctx.createBufferSource()
    src.buffer = m.pops[Math.floor(Math.random() * m.pops.length)]
    src.playbackRate.value = (0.85 + Math.random() * 0.35) * (1 - 0.3 * burble) // burble: estouro mais grave, "blub"
    const g = ctx.createGain(); g.gain.value = vol
    src.connect(g); g.connect(m.fx); src.start()
  }

  /** Motor por pulsos: chamado a cada quadro por engine(). */
  private motorFrame(rpm: number, gas: number, nitro: boolean, running: boolean, noCorte: boolean, boostFisico: number, troca: boolean) {
    const m = this.motor!, ctx = this.ctx!, p = this.perfil, t = ctx.currentTime
    const dt = Math.min(0.1, Math.max(0, t - this.lastT)); this.lastT = t
    const corte = noCorte && gas > 0.5
    // na troca a carga só afunda (não zera): zerar trocava o motor gravado para
    // os grãos de alívio e o som "cortava" a cada marcha
    const carga = t < this.cortaCargaAte ? Math.min(gas, 0.45) : gas
    m.node.port.postMessage({ st: { rpm, carga, ligado: running, corte } })
    // volume cresce com o giro (o pulso individual encolhe em giro alto; o motor
    // de verdade fica mais alto em cima). Calibrado para a mesma faixa do antigo.
    // motor de arranque girando: o ronco espera o motor pegar
    this.ultimoRpm = rpm
    if (this.grav && running) this.misturarGravacao(rpm, 0.05)
    const ligado = running && t >= this.partidaAte
    m.out.gain.setTargetAtTime(ligado ? 0.5 * (0.85 + 0.35 * Math.min(rpm, 8000) / 7000) : 0, t, ligado ? (this.partidaAte > t - 0.5 ? 0.12 : 0.05) : 0.15)
    if (!running) {
      this.lastGas = 0
      if (this.turbo) m.node.port.postMessage({ tb: { eixo: 0, boost: 0, carga: 0, ligado: false } })
      return
    }
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
    // EIXO DA TURBINA: gira com a energia do escape e tem inércia própria
    // (eixoDoSom). O som do turbo (apito, sopro, blow-off, flutter) é feito no
    // worklet (sound/turbo-synth.ts) a partir do eixo, da pressão e do pé.
    // Na troca de marcha a borboleta fecha mesmo com o W apertado: para o turbo
    // é um alívio (pssh, apito morrendo) e a marcha seguinte reenche. Antes o
    // turbo via o pé no fundo e ficava cheio na troca, como antilag (playtest 15/11).
    const cargaTurbo = troca ? 0 : carga
    this.eixo = eixoDoSom(this.eixo, boostFisico, rpm, this.corteMotor, cargaTurbo, dt, this.turbo)
    if (turbo) {
      // tirou o pé (ou trocou) com pressão no coletor: alivia (turbo simples = flutter, biturbo = blow-off)
      const alivio = this.gatilho.passo(troca ? 0 : gas, this.eixo)
      const tb = { eixo: this.eixo, boost: this.boost, carga: cargaTurbo, rpm, ligado: true }
      m.node.port.postMessage(alivio ? { tb, alivio } : { tb })
    }
    m.soproGain.gain.setTargetAtTime(nitro ? 0.03 : 0, t, 0.06)
    if (p.inducao === "roots" || p.inducao === "centrifugo") {
      // zumbido preso ao giro: polia ~2,4× × lóbulos/palhetas (estimativa); centrífugo só cresce em cima
      const hz = rpm / 60 * (p.inducao === "roots" ? 2.4 * 6 : 2.4 * 12)
      m.whine.frequency.setTargetAtTime(hz, t, 0.03)
      const k = p.inducao === "roots" ? 0.02 + 0.03 * gas : 0.04 * alto
      m.whineGain.gain.setTargetAtTime(k * Math.min(1, rpm / 3000), t, 0.05)
    } else m.whineGain.gain.setTargetAtTime(0, t, 0.05)

    // estouros ao tirar o pé em giro alto (combustível queimando no escape)
    const burble = this.grav?.burble ?? 0 // V8 cruzado: borbulha ao tirar o pé, já em giro médio
    if (gas > 0.6 && rpm > (burble > 0 ? 2300 : 3300)) this.gasAltoT = t
    if (this.lastGas > 0.5 && gas < 0.15 && t - this.gasAltoT < 0.5 && Math.random() < p.pops + 0.2 + burble * 0.3) {
      this.estouroAte = t + 0.4 + Math.random() * 0.8 * p.pops * (1 + burble)
      this.proxEstouro = t
    }
    if (gas > 0.3) this.estouroAte = 0
    if (t < this.estouroAte && rpm > 1800 && t >= this.proxEstouro) {
      this.estouro((0.3 + Math.random() * 0.45) * Math.min(1, p.pops + 0.3), burble)
      this.proxEstouro = t + 0.04 + Math.random() * (Math.random() < 0.25 ? 0.25 : 0.11) * (1 - 0.35 * burble)
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
  // `troca`: marcha sendo trocada (borboleta fechada para o turbo).
  engine(rpm: number, throttle: number, nitro: boolean, running: boolean, corte = false, boost = -1, troca = false) {
    if (this.motor && this.ctx) { this.motorFrame(rpm, throttle, nitro, running, corte, boost, troca); return }
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
    // ataque de 4 ms: começar direto no volume cheio dá um estalo (degrau)
    g.gain.setValueAtTime(0, ctx.currentTime)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(vol, t0 + 0.004)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + ms / 1000)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t0)
    osc.stop(t0 + ms / 1000)
  }

  private burst(ms: number, vol: number, freq = 1000, type: BiquadFilterType = "lowpass") {
    if (!this.ctx || !this.master || !this.enabled) return
    const ctx = this.ctx
    const src = ctx.createBufferSource(), dur = ms / 1000 + 0.05
    src.buffer = this.ruido()
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(0, this.trechoRuido(dur))
    src.stop(ctx.currentTime + dur)
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
  // estampido do corte (uma vez por pulso, quando a ignição religa): baque grave
  // no escape. Era chiado agudo (passa-alta em 2600 Hz) e somava ao "glitch".
  limiter() { this.burst(30, 0.05, 420, "lowpass") }
  horn() { this.blip(420, 350, 0.12, "square"); this.blip(530, 350, 0.12, "square") }
  nearMiss() { this.burst(200, 0.3, 1600, "bandpass") }
  nitro() { this.burst(500, 0.35, 800, "lowpass"); this.blip(300, 400, 0.2, "sawtooth") }
  crash() {
    this.burst(600, 0.7, 500, "lowpass")
    this.blip(60, 500, 0.5, "sine")
  }
  pickup() { this.blip(660, 70, 0.22); this.blip(880, 70, 0.22, "sine", 70); this.blip(1180, 140, 0.28, "sine", 140) }
  flash() { this.blip(1250, 55, 0.18); this.blip(1250, 55, 0.18, "sine", 110) }
  /** Sinal do cartão de aviso: duas notas que sobem (polícia mais grave e áspera). */
  aviso(nivel: "perigo" | "policia" | "info") {
    if (nivel === "policia") { this.blip(587, 110, 0.12, "square"); this.blip(784, 160, 0.12, "square", 120); return }
    const base = nivel === "info" ? 784 : 659
    this.blip(base, 90, 0.13, "triangle"); this.blip(base * 1.335, 150, 0.13, "triangle", 110)
  }
  warn() { this.blip(980, 80, 0.16, "square"); this.blip(980, 80, 0.12, "square", 150) }
  levelUp() { this.blip(440, 110, 0.26, "square"); this.blip(554, 110, 0.26, "square", 110); this.blip(659, 110, 0.26, "square", 220); this.blip(880, 300, 0.3, "square", 330) }
  shieldBreak() { this.blip(700, 80, 0.3); this.blip(500, 80, 0.3, "sine", 80); this.blip(350, 160, 0.3, "sine", 160) }
  semaphoreRed() { this.blip(440, 120, 0.25, "square") }
  semaphoreGreen() { this.blip(880, 300, 0.3, "square") }
  perfectLaunch() { this.blip(660, 90, 0.25); this.blip(880, 90, 0.25); this.blip(1100, 160, 0.3) }
  score() { this.blip(1300, 80, 0.2) }
  offroad() { this.burst(120, 0.15, 300, "lowpass") }
}
