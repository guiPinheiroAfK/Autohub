// AutoDash — render/hud.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, W, H, PLAYER_Z } from "../engine"
import { glass } from "../ui/widgets"
import { clamp } from "../math"
import { skyNow } from "./backdrop"
import { rr } from "./primitives"
import { renderRearView } from "./player"
import { SEG_LEN, RPM_REDLINE } from "../data"
import { wrapDz } from "../traffic/spawner"

export function renderHud(eng: AutoDashEngine) {
  const ctx = eng.ctx
  // placar
  glass(eng, 14, 12, 210, 62)
  ctx.fillStyle = "#f8fafc"
  ctx.font = "bold 24px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(`${Math.floor(eng.score).toLocaleString("pt-BR")}`, 28, 40)
  ctx.font = "13px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillStyle = "rgba(248,250,252,0.65)"
  const best = eng.scores[0]
  ctx.fillText(`recorde ${best ? best.score.toLocaleString("pt-BR") : 0}  ·  ${eng.km.toFixed(1)} km`, 28, 62)

  // combo
  if (eng.combo > 0) {
    ctx.fillStyle = "#fde047"
    ctx.font = "bold 26px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(`x${1 + eng.combo}`, 240, 42)
    ctx.fillStyle = "rgba(253,224,71,0.35)"
    ctx.fillRect(240, 50, 52, 5)
    ctx.fillStyle = "#fde047"
    ctx.fillRect(240, 50, 52 * clamp(eng.comboT / 4, 0, 1), 5)
  }

  // clima/hora + badges
  const sky = skyNow(eng)
  ctx.textAlign = "right"
  ctx.font = "20px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(eng.raining ? "🌧" : sky.amb < 0.6 ? "🌙" : "☀️", W - 20, 34)
  ctx.font = "bold 13px 'Space Grotesk', 'Segoe UI', sans-serif"
  let by = 58
  ctx.fillStyle = "rgba(248,250,252,0.6)"
  ctx.fillText(`NÍVEL ${eng.level + 1}`, W - 20, by); by += 20
  if (eng.shield) { ctx.fillStyle = "#60a5fa"; ctx.fillText("● ESCUDO", W - 20, by); by += 20 }
  if (eng.mult2T > 0) { ctx.fillStyle = "#fde047"; ctx.fillText(`● 2X ${Math.ceil(eng.mult2T)}s`, W - 20, by); by += 20 }
  ctx.textAlign = "left"

  // aviso de curva fechada
  if (eng.curveWarn !== 0 && eng.speed > 120 && eng.state !== "paused") {
    const urgent = eng.curveWarnDist < 55
    if (!urgent || Math.floor(performance.now() / 180) % 2 === 0) {
      ctx.textAlign = "center"
      ctx.fillStyle = urgent ? "#ef4444" : "#facc15"
      ctx.font = "bold 24px 'Space Grotesk', 'Segoe UI', sans-serif"
      const arrows = eng.curveWarn > 0 ? "▶▶" : "◀◀"
      ctx.fillText(`${arrows}  CURVA ${eng.curveWarn > 0 ? "À DIREITA" : "À ESQUERDA"}  ${arrows}`, W / 2, 92)
      ctx.textAlign = "left"
    }
  }

  renderTacho(eng)

  // nitro — no celular sobe um pouco pra não ficar embaixo do botão de
  // direção touch (ainda encosta um pouco; ajuste fino pendente de ver
  // numa tela de verdade)
  const nx = 22, ny = eng.isTouch ? H - 230 : H - 160, nh = 120
  glass(eng, nx - 6, ny - 8, 34, nh + 34, 10)
  ctx.fillStyle = "rgba(148,163,184,0.3)"
  rr(ctx, nx, ny, 22, nh, 8)
  const nfill = nh * eng.nitroMeter / 100
  ctx.fillStyle = eng.nitroOn && eng.nitroMeter > 1 ? "#fb923c" : "#38bdf8"
  if (nfill > 2) rr(ctx, nx, ny + nh - nfill, 22, nfill, 8)
  ctx.fillStyle = "#f8fafc"
  ctx.font = "bold 11px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("NOS", nx + 1, ny + nh + 18)

  if (eng.mode === "duel" && eng.duel) renderDuelBar(eng)
  renderMinimap(eng)
  renderRearView(eng) // só aparece durante perseguição
}

export function renderMinimap(eng: AutoDashEngine) {
  const ctx = eng.ctx
  const bx = W - 122, byy = H - 296, bw = 104, bh = 88
  glass(eng, bx, byy, bw, bh, 10)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(bx + 3, byy + 3, bw - 6, bh - 6, 8)
  ctx.clip()

  const N = eng.segments.length
  const start = Math.floor((eng.position + PLAYER_Z) / SEG_LEN)
  const ox = bx + bw / 2, oy = byy + bh - 14
  let hx = 0, hy = 0, heading = 0
  ctx.strokeStyle = "rgba(248,250,252,0.75)"
  ctx.lineWidth = 4
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(ox, oy)
  const pts: { x: number; y: number }[] = [{ x: ox, y: oy }]
  for (let n = 0; n < 160; n += 2) {
    const s = eng.segments[(start + n) % N]
    // ângulo suave e travado a ~60°: o traçado sempre progride pra cima,
    // curvas viram inclinação (GPS), nunca cambalhota
    heading = clamp(heading + s.curve * 0.011 * 2, -1.05, 1.05)
    hx += Math.sin(heading) * 1.0
    hy -= Math.cos(heading) * 1.0
    ctx.lineTo(ox + hx, oy + hy)
    pts.push({ x: ox + hx, y: oy + hy })
  }
  ctx.stroke()
  ctx.lineWidth = 1

  // travessia d'água: o trecho de ponte aparece em azul no GPS (halo = lago)
  const bset = new Set<number>()
  for (const zn of eng.zones) {
    if (zn.type !== "bridge") continue
    const a = Math.floor(zn.z / SEG_LEN) % N
    const len = ((Math.floor(zn.end / SEG_LEN) - Math.floor(zn.z / SEG_LEN)) % N + N) % N
    for (let i = 0; i <= len; i++) bset.add((a + i) % N)
  }
  if (bset.size) {
    for (const pass of [{ w: 9, c: "rgba(56,189,248,0.22)" }, { w: 4, c: "rgba(56,189,248,0.95)" }]) {
      ctx.lineWidth = pass.w
      ctx.strokeStyle = pass.c
      ctx.beginPath()
      let drawing = false
      for (let k2 = 1; k2 < pts.length; k2++) {
        if (bset.has((start + k2 * 2) % N)) {
          if (!drawing) { ctx.moveTo(pts[k2 - 1].x, pts[k2 - 1].y); drawing = true }
          ctx.lineTo(pts[k2].x, pts[k2].y)
        } else drawing = false
      }
      ctx.stroke()
    }
    ctx.lineWidth = 1
  }

  // viaturas em perseguição: pontos vermelhos pulsantes (somem quando despista).
  // à frente ficam no traçado; atrás, logo abaixo da seta (te seguindo)
  const police = eng.traffic.filter(t => t.role === "police" && !t.parked)
  if (police.length) {
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 140)
    const playerZ = eng.position + PLAYER_Z
    ctx.fillStyle = `rgba(239,68,68,${pulse})`
    for (const t of police) {
      const sn = wrapDz(eng, t.z, playerZ) / SEG_LEN
      let px: number, py: number
      if (sn >= 0) {
        const p = pts[clamp(Math.round(sn / 2), 0, pts.length - 1)]
        px = p.x; py = p.y
      } else {
        px = ox; py = clamp(oy - sn * 0.6, oy, byy + bh - 5) // atrás = abaixo da seta
      }
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill()
    }
  }

  // rivais da corrida: ponto na cor de identificação dele (a MESMA da faixa
  // no teto do carro), pra bater o que está no mapa com o que está na pista
  if (eng.race && eng.mode === "race") {
    const playerZ2 = eng.position + PLAYER_Z
    for (const rv of eng.race.rivais) {
      if (rv.finished) continue
      const sn = wrapDz(eng, rv.z, playerZ2) / SEG_LEN
      let px: number, py: number
      if (sn >= 0) {
        const p = pts[clamp(Math.round(sn / 2), 0, pts.length - 1)]
        px = p.x; py = p.y
      } else {
        px = ox + (rv.x - eng.playerX) * 10
        py = clamp(oy - sn * 0.6, oy, byy + bh - 5)
      }
      // contorno primeiro e maior: assim o miolo colorido fica cheio em vez
      // de ser comido pelo traço num ponto de poucos pixels
      ctx.fillStyle = "rgba(8,13,26,0.8)"
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = rv.cor
      ctx.beginPath(); ctx.arc(px, py, 3.8, 0, Math.PI * 2); ctx.fill()
    }
  }

  // você (seta fixa apontando pra frente)
  ctx.fillStyle = "#38bdf8"
  ctx.beginPath()
  ctx.moveTo(ox, oy - 7)
  ctx.lineTo(ox + 5, oy + 4)
  ctx.lineTo(ox - 5, oy + 4)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function renderDuelBar(eng: AutoDashEngine) {
  const ctx = eng.ctx
  const d = eng.duel!
  const bw = 380, bx = W / 2 - bw / 2, byy = eng.state === "countdown" ? 128 : 10
  glass(eng, bx, byy, bw, 46, 12)
  const myName = (eng.cfg.pilotName || "VOCÊ").slice(0, 10)
  const oppName = (d.oppName || "RIVAL").slice(0, 10)
  const deltaM = Math.round((eng.km - d.oppD) * 1000)
  ctx.font = "bold 13px 'Space Grotesk', sans-serif"
  ctx.fillStyle = "#38bdf8"
  ctx.fillText(myName, bx + 14, byy + 19)
  ctx.font = "11px 'Space Grotesk', sans-serif"
  ctx.fillStyle = "rgba(248,250,252,0.8)"
  ctx.fillText(`${eng.km.toFixed(2)} km`, bx + 14, byy + 36)
  ctx.textAlign = "right"
  ctx.font = "bold 13px 'Space Grotesk', sans-serif"
  ctx.fillStyle = d.opp?.c ? "rgba(239,68,68,0.9)" : "#f472b6"
  ctx.fillText(d.opp?.c ? `${oppName} 💥` : oppName, bx + bw - 14, byy + 19)
  ctx.font = "11px 'Space Grotesk', sans-serif"
  ctx.fillStyle = "rgba(248,250,252,0.8)"
  ctx.fillText(d.opp ? `${d.oppD.toFixed(2)} km` : "conectando...", bx + bw - 14, byy + 36)
  ctx.textAlign = "center"
  ctx.font = "bold 15px 'Space Grotesk', sans-serif"
  ctx.fillStyle = deltaM >= 0 ? "#4ade80" : "#ef4444"
  ctx.fillText(deltaM >= 0 ? `+${deltaM}m` : `${deltaM}m`, bx + bw / 2, byy + 29)
  ctx.textAlign = "left"
}

export function renderTacho(eng: AutoDashEngine) {
  const ctx = eng.ctx
  // no celular, menor e um pouco mais alto — reduz (não elimina) a
  // sobreposição com os botões de gás/freio/marcha do canto direito
  const cx = eng.isTouch ? W - 96 : W - 108
  const cy = eng.isTouch ? H - 110 : H - 92
  const r = eng.isTouch ? 60 : 74
  const bg = ctx.createRadialGradient(cx, cy - 26, 8, cx, cy, r + 16)
  bg.addColorStop(0, "rgba(38,50,72,0.9)")
  bg.addColorStop(1, "rgba(4,8,20,0.9)")
  ctx.fillStyle = bg
  ctx.beginPath(); ctx.arc(cx, cy, r + 14, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.16)"
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(cx, cy, r + 13.5, 0, Math.PI * 2); ctx.stroke()

  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25
  // arco de giro preenchido até o RPM atual
  const redStart = a0 + (a1 - a0) * (RPM_REDLINE / 8000)
  ctx.strokeStyle = "rgba(148,163,184,0.35)"
  ctx.lineWidth = 7
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, redStart); ctx.stroke()
  ctx.strokeStyle = "rgba(239,68,68,0.6)"
  ctx.beginPath(); ctx.arc(cx, cy, r, redStart, a1); ctx.stroke()
  const jitter = eng.rpm >= RPM_REDLINE - 150 ? (Math.random() - 0.5) * 0.03 : 0
  const rpmA = a0 + (a1 - a0) * clamp(eng.rpm / 8000 + jitter, 0, 1)
  // "glow" com traço duplo — shadowBlur por frame derruba o FPS
  ctx.strokeStyle = eng.rpm > RPM_REDLINE ? "#ef4444" : eng.rpm > 6200 ? "#fb923c" : "#38bdf8"
  ctx.globalAlpha = 0.28
  ctx.lineWidth = 13
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, rpmA); ctx.stroke()
  ctx.globalAlpha = 1
  ctx.lineWidth = 7
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, rpmA); ctx.stroke()
  // ticks
  ctx.fillStyle = "rgba(248,250,252,0.7)"
  ctx.font = "10px 'Space Grotesk', 'Segoe UI', sans-serif"
  for (let i = 0; i <= 8; i++) {
    const a = a0 + (a1 - a0) * (i / 8)
    const tx = cx + Math.cos(a) * (r - 16), ty = cy + Math.sin(a) * (r - 16)
    ctx.textAlign = "center"
    ctx.fillText(String(i), tx, ty + 3)
  }
  // agulha (com tremida na limitadora)
  const na = rpmA
  ctx.strokeStyle = eng.rpm > RPM_REDLINE ? "#ef4444" : "#f8fafc"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(cx - Math.cos(na) * 10, cy - Math.sin(na) * 10)
  ctx.lineTo(cx + Math.cos(na) * (r - 8), cy + Math.sin(na) * (r - 8))
  ctx.stroke()
  ctx.fillStyle = "#0f172a"
  ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill()
  // marcha
  ctx.fillStyle = eng.shiftT > 0 ? "#fde047" : "#f8fafc"
  ctx.font = "bold 28px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.textAlign = "center"
  ctx.fillText(eng.gear === 0 ? "N" : String(eng.gear), cx, cy + 10)
  // velocidade
  ctx.fillStyle = "#f8fafc"
  ctx.font = "italic 900 23px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(String(Math.round(eng.speed)), cx, cy + r - 8)
  ctx.font = "10px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillStyle = "rgba(248,250,252,0.6)"
  ctx.fillText("km/h", cx, cy + r + 6)
  ctx.textAlign = "left"
  // modo de câmbio
  ctx.fillStyle = "rgba(248,250,252,0.5)"
  ctx.font = "bold 10px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(eng.cfg.transmission === "auto" ? "AUTO" : "SEQ", cx - 16, cy - r - 20)

  if (eng.goFlashT > 0) {
    // flash de largada na corrida: a tela toma um estouro verde->branco no
    // instante do verde, como o clarão de uma arrancada de racha
    if (eng.mode === "race") {
      const f = clamp((eng.goFlashT - 0.8) / 0.4, 0, 1) // só no pico (1.2→0.8)
      if (f > 0) {
        ctx.fillStyle = `rgba(180,255,200,${f * 0.5})`
        ctx.fillRect(0, 0, W, H)
      }
    }
    ctx.globalAlpha = clamp(eng.goFlashT, 0, 1)
    ctx.fillStyle = "#4ade80"
    ctx.font = "900 54px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("GO!", W / 2, H * 0.3)
    ctx.textAlign = "left"
    ctx.globalAlpha = 1
  }
}

export function renderSemaphore(eng: AutoDashEngine) {
  const ctx = eng.ctx
  const cx = W / 2, top = 46
  ctx.strokeStyle = "#1e293b"
  ctx.lineWidth = 6
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, top); ctx.stroke()
  ctx.fillStyle = "#0f172a"
  rr(ctx, cx - 78, top, 156, 54, 12)
  const lit = eng.greenFired ? 4 : eng.countT >= 2.4 ? 3 : eng.countT >= 1.6 ? 2 : eng.countT >= 0.8 ? 1 : 0
  for (let i = 0; i < 3; i++) {
    const on = !eng.greenFired && lit > i
    ctx.fillStyle = on ? "#ef4444" : "rgba(120,40,40,0.4)"
    ctx.beginPath(); ctx.arc(cx - 44 + i * 44, top + 27, 16, 0, Math.PI * 2); ctx.fill()
    if (on) { ctx.fillStyle = "rgba(239,68,68,0.3)"; ctx.beginPath(); ctx.arc(cx - 44 + i * 44, top + 27, 24, 0, Math.PI * 2); ctx.fill() }
  }
  if (eng.greenFired) {
    ctx.fillStyle = "#4ade80"
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx - 44 + i * 44, top + 27, 16, 0, Math.PI * 2); ctx.fill() }
    ctx.font = "bold 30px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("GO!", cx, top + 100)
    ctx.textAlign = "left"
  } else if (eng.countT > 0.5) {
    ctx.fillStyle = "rgba(248,250,252,0.85)"
    ctx.font = "bold 15px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("segura o giro na faixa verde e solta no verde!", cx, top + 82)
    const zx = cx - 90
    ctx.fillStyle = "rgba(148,163,184,0.3)"; rr(ctx, zx, top + 94, 180, 10, 5)
    ctx.fillStyle = "rgba(74,222,128,0.55)"
    rr(ctx, zx + 180 * (3600 / 8000), top + 94, 180 * ((6300 - 3600) / 8000), 10, 5)
    ctx.fillStyle = "#f8fafc"
    const rx = zx + 180 * clamp(eng.rpm / 8000, 0, 1)
    ctx.fillRect(rx - 2, top + 90, 4, 18)
    ctx.textAlign = "left"
  }
}
