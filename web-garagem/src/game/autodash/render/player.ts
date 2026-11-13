// AutoDash — render/player.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, W, H, PLAYER_Z } from "../engine"
import { CARS, PAINTS } from "../data"
import { clamp, shade } from "../math"
import { drawPlayerCar, rr } from "./primitives"
import { type Traffic, KINDS } from "../traffic/types"
import { wrapDz } from "../traffic/spawner"

export function renderPlayer(eng: AutoDashEngine, amb: number) {
  if (eng.state === "menu" || eng.state === "garage") return
  const ctx = eng.ctx
  const spec = CARS[eng.cfg.carIdx]
  const custom = eng.cfg.customs[eng.cfg.carIdx]
  const steer = clamp(eng.steerVel * 1.1, -1, 1)
  const braking = eng.mouseBrake || eng.touchBrake || eng.keys.has("s") || eng.keys.has("arrowdown")
  const bounce = Math.sin(eng.position * 0.03) * Math.min(3, eng.speed / 60) + eng.pitchY
  // neon do jogador na corrida: sua cor de identificação (azul) lavando o chão
  if (eng.mode === "race" && (eng.state === "racing" || eng.state === "countdown")) {
    const pw = spec.width * 640
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300)
    const g = ctx.createRadialGradient(W / 2, H - 40 + bounce, 8, W / 2, H - 40 + bounce, pw * 1.15)
    g.addColorStop(0, `rgba(56,189,248,${0.32 + pulse * 0.12})`)
    g.addColorStop(0.55, "rgba(56,189,248,0.14)")
    g.addColorStop(1, "rgba(56,189,248,0)")
    ctx.fillStyle = g
    ctx.beginPath(); ctx.ellipse(W / 2, H - 40 + bounce, pw * 1.15, 46, 0, 0, Math.PI * 2); ctx.fill()
  }
  if (eng.shield) {
    const pw = spec.width * 640
    ctx.fillStyle = "rgba(96,165,250,0.14)"
    ctx.strokeStyle = "rgba(96,165,250,0.65)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(W / 2, H - 68 + bounce, pw * 0.75, 62, 0, 0, Math.PI * 2)
    ctx.fill(); ctx.stroke()
  }
  const blinkT = Math.max(eng.immuneT, eng.policeHitT)
  const immuneBlink = blinkT > 0 && Math.floor(blinkT * 8) % 2 === 0
  if (immuneBlink) ctx.globalAlpha = 0.35
  drawPlayerCar(ctx, W / 2, H - 34 + bounce, spec, custom, steer, braking, amb, eng.nitroOn && eng.nitroMeter > 1)
  if (immuneBlink) ctx.globalAlpha = 1

  // sensação de velocidade: streaks varrendo as bordas. No nitro viram ciano
  // e muito mais densos — o "túnel de velocidade" dos filmes.
  const nitro = eng.nitroOn && eng.nitroMeter > 1
  if ((eng.speed > 165 || nitro) && eng.state === "racing") {
    const inten = Math.min(1, (eng.speed - 150) / 90)
    const n = nitro ? 22 : 9
    ctx.strokeStyle = nitro
        ? `rgba(120,220,255,${0.22 + inten * 0.2})`
        : `rgba(220,235,255,${0.08 + inten * 0.16})`
    ctx.lineWidth = nitro ? 2.5 : 2
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? 1 : -1
      const spread = nitro ? 0.14 : 0.30
      const x = W / 2 + side * (W * spread + Math.random() * W * 0.34)
      const y = Math.random() * H
      const len = (nitro ? 90 : 40) + Math.random() * 120 * inten
      ctx.moveTo(x, y)
      ctx.lineTo(x + side * (nitro ? 3 : 6), y + len)
    }
    ctx.stroke()

    // brilho ciano lambendo as bordas da tela no nitro
    if (nitro) {
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 90)
      for (const s of [-1, 1]) {
        const gx = s < 0 ? 0 : W
        const g = ctx.createLinearGradient(gx, 0, gx - s * W * 0.22, 0)
        g.addColorStop(0, `rgba(56,189,248,${0.28 * pulse})`)
        g.addColorStop(1, "rgba(56,189,248,0)")
        ctx.fillStyle = g
        ctx.fillRect(s < 0 ? 0 : W * 0.78, 0, W * 0.22, H)
      }
    }
  }
}

export function renderRearView(eng: AutoDashEngine) {
  // na contagem o painel do traçado ocupa o topo — os dois se sobrepunham e
  // viravam um borrão ilegível. Antes de largar não há o que ver atrás.
  if (eng.state !== "racing") return
  // aparece na perseguição E na corrida (aí serve pra ver quem vem te pegar)
  const naCorrida = eng.mode === "race" && !!eng.race
  if (!naCorrida && !eng.traffic.some(t => t.role === "police" && !t.parked)) return
  const ctx = eng.ctx
  const mw = 288, mh = 86, mx = W / 2 - mw / 2, my = 10
  const playerZ = eng.position + PLAYER_Z
  const D_MIN = 500, D_MAX = 14000
  const cx = mx + mw / 2
  const hy = my + mh * 0.30          // horizonte
  const by = my + mh                 // base = mais perto de você
  const fOf = (d: number) => clamp(D_MIN / Math.max(d, D_MIN), 0, 1)
  const yOf = (f: number) => hy + (by - hy) * f
  const halfOf = (f: number) => mw * 0.52 * f + 1.5

  eng.glass(mx, my, mw, mh, 10)
  ctx.save()
  ctx.beginPath(); ctx.roundRect(mx + 2, my + 2, mw - 4, mh - 4, 9); ctx.clip()

  // FUNDO OPACO: o painel de vidro tem 55% de opacidade, então a cena 3D
  // atrás (placas de curva, pista, prédios) vazava através e se misturava com
  // o conteúdo do espelho — virava um borrão ilegível. O retrovisor precisa
  // ser uma superfície própria, não uma janela.
  const ceu = ctx.createLinearGradient(0, my, 0, my + mh)
  ceu.addColorStop(0, "#0b1220")
  ceu.addColorStop(1, "#131c2e")
  ctx.fillStyle = ceu
  ctx.fillRect(mx, my, mw, mh)

  // asfalto: trapézio do horizonte até a base, deslocado pela sua posição na
  // pista (se você está na faixa da direita, a pista abre pra esquerda)
  const fN = 1, fF = fOf(D_MAX)
  const yN = yOf(fN), yF = yOf(fF), hN = halfOf(fN), hF = halfOf(fF)
  const cN = cx - eng.playerX * hN, cF = cx - eng.playerX * hF
  ctx.fillStyle = "#262c3b"
  ctx.beginPath()
  ctx.moveTo(cN - hN, yN); ctx.lineTo(cN + hN, yN)
  ctx.lineTo(cF + hF, yF); ctx.lineTo(cF - hF, yF)
  ctx.closePath(); ctx.fill()

  // veículos atrás, do mais longe pro mais perto (perto desenha por cima).
  // Na corrida os rivais entram junto — é justamente pra ver quem vem colando.
  const candidatos: Traffic[] = [...eng.traffic]
  if (eng.race && eng.mode === "race") {
    for (const r of eng.race.rivais) {
      if (r.finished) continue
      candidatos.push({
        z: ((r.z % eng.trackLen) + eng.trackLen) % eng.trackLen,
        offset: r.x, targetOffset: r.x, speed: r.v, kind: "car", role: "civilian",
        color: PAINTS[clamp(Math.floor(r.paint), 0, PAINTS.length - 1)],
        blinkT: 0, prevD: 1,
        label: r.nome, accent: r.cor,
      })
    }
  }
  const atras = candidatos
      .map(t => ({ t, d: -wrapDz(eng, t.z, playerZ) }))
      .filter(v => v.d > 0 && v.d <= D_MAX)
      .sort((a, b) => b.d - a.d)
  for (const { t, d } of atras) {
    const f = fOf(d), y = yOf(f), half = halfOf(f)
    const x = cx + (t.offset - eng.playerX) * half
    const w = Math.max(2, half * KINDS[t.kind].w * 2)
    const h = Math.max(2, w * 0.62)
    ctx.fillStyle = t.role === "police" ? "#3b82f6" : shade(t.color, 0.75)
    rr(ctx, x - w / 2, y - h, w, h, Math.max(1, w * 0.18))
    if (t.role === "police") {
      // giroflex: alterna vermelho/azul pra ler de relance
      const on = Math.floor(performance.now() / 120) % 2 === 0
      ctx.fillStyle = on ? "#ef4444" : "#e0f2fe"
      const lh = Math.max(1, h * 0.22)
      ctx.fillRect(x - w * 0.32, y - h - lh, w * 0.64, lh)
    }
  }
  ctx.restore()
}

export function renderRearThreat(eng: AutoDashEngine) {
  if (eng.state !== "racing" && eng.state !== "countdown") return
  const ctx = eng.ctx
  const playerZ = eng.position + PLAYER_Z
  const RANGE = 5000
  for (const t of eng.traffic) {
    if (t.role !== "police" || t.parked) continue
    const d = wrapDz(eng, t.z, playerZ)
    if (d >= 0 || d < -RANGE) continue // só quem está atrás e dentro do alcance
    const prox = 1 - -d / RANGE // 0 = longe, 1 = colada
    const x = clamp(W / 2 + (t.offset - eng.playerX) * (W * 0.34), 24, W - 24)
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() / (80 + (1 - prox) * 240))
    const s = 12 + 18 * prox
    ctx.fillStyle = `rgba(239,68,68,${(0.2 + 0.7 * prox) * pulse})`
    ctx.beginPath()
    ctx.moveTo(x, H - 4)
    ctx.lineTo(x - s * 0.6, H - 4 - s)
    ctx.lineTo(x + s * 0.6, H - 4 - s)
    ctx.closePath()
    ctx.fill()
  }
}
