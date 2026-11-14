// AutoDash — render/policia.ts. Desenho da polícia por estrelas (Fase 6):
// HUD de estrelas, pregos, placa, bloqueio e helicóptero. As regras moram em world/policia.ts.
import { AutoDashEngine, W, H, PLAYER_Z } from "../engine"
import { glass } from "../ui/widgets"
import { clamp, shade } from "../math"
import { rr } from "./primitives"
import { estrelasDe, nivelDe, ESTRELAS, ESFRIA_S, HOLOFOTE_X } from "../world/policia"
import { wrapDz } from "../traffic/spawner"

const FONTE = "'Space Grotesk', 'Segoe UI', sans-serif"

function estrela(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const raio = i % 2 === 0 ? r : r * 0.45
    const x = cx + Math.cos(a) * raio, y = cy + Math.sin(a) * raio
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

/**
 * Estrelas de procurado no topo da tela. Só aparece com calor (sem perseguição
 * nem esfriamento, nada é desenhado). Embaixo, o estado: te viram (giroflex
 * vermelho/azul), despistando (barra enchendo) ou esfriando (estrelas piscam).
 */
export function renderEstrelas(eng: AutoDashEngine) {
  const p = eng.policia
  const py = eng.mode === "duel" ? 62 : 10
  avisos(eng, py + 58)
  if (p.calor <= 0) return
  const ctx = eng.ctx
  const n = estrelasDe(p.calor)
  const perseguindo = eng.traffic.some(t => t.role === "police" && !t.parked)
  const esfriando = !perseguindo
  const agora = performance.now()
  // à direita do retrovisor (288 px no centro do topo, só na perseguição) e
  // abaixo da barra do duelo
  const pw = 196, ph = 50
  const px = W / 2 + 156
  const mx = px + pw / 2
  glass(eng, px, py, pw, ph, 12)

  // estrelas: cheias até n; a próxima mostra o progresso do calor
  const r = 11, gap = 30, x0 = mx - gap * 2, cy = py + 18
  const giro = Math.floor(agora / 180) % 2 === 0
  const piscaApaga = esfriando && Math.floor(agora / 300) % 2 === 0
  for (let i = 0; i < 5; i++) {
    const cx = x0 + i * gap
    estrela(ctx, cx, cy, r)
    ctx.fillStyle = "rgba(148,163,184,0.25)"
    ctx.fill()
    if (i < n) {
      if (piscaApaga && i === n - 1) continue // a que vai cair pisca
      ctx.fillStyle = esfriando ? "#94a3b8" : p.visto ? (giro ? "#f87171" : "#60a5fa") : "#fbbf24"
      estrela(ctx, cx, cy, r)
      ctx.fill()
    } else if (i === n && perseguindo) {
      // progresso para a próxima estrela: preenche de baixo para cima
      const f = p.calor - n
      if (f > 0.01) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(cx - r, cy + r - 2 * r * f, 2 * r, 2 * r * f)
        ctx.clip()
        ctx.fillStyle = "rgba(248,113,113,0.55)"
        estrela(ctx, cx, cy, r)
        ctx.fill()
        ctx.restore()
      }
    }
  }

  // linha de estado
  const by = py + 36, bw = pw - 28, bx = px + 14
  ctx.font = `bold 11px ${FONTE}`
  ctx.textAlign = "center"
  if (esfriando) {
    ctx.fillStyle = "#94a3b8"
    ctx.fillText("ESFRIANDO", mx, by + 4)
    ctx.fillStyle = "rgba(148,163,184,0.3)"
    ctx.fillRect(bx, by + 8, bw, 3)
    ctx.fillStyle = "#94a3b8"
    ctx.fillRect(bx, by + 8, bw * clamp(1 - p.esfriaT / ESFRIA_S, 0, 1), 3)
  } else if (p.visto) {
    ctx.fillStyle = giro ? "#f87171" : "#60a5fa"
    ctx.fillText("TE VIRAM", mx, by + 4)
  } else {
    const nivel = nivelDe(n) ?? ESTRELAS[0]
    ctx.fillStyle = "#4ade80"
    ctx.fillText("DESPISTANDO", mx, by + 4)
    ctx.fillStyle = "rgba(74,222,128,0.25)"
    ctx.fillRect(bx, by + 8, bw, 3)
    ctx.fillStyle = "#4ade80"
    ctx.fillRect(bx, by + 8, bw * clamp(eng.policeEscapeT / nivel.despisteS, 0, 1), 3)
  }
  ctx.textAlign = "left"
}



/** Avisos curtos sob o painel de estrelas (pneu furado, helicóptero). */
function avisos(eng: AutoDashEngine, y: number) {
  const ctx = eng.ctx
  const p = eng.policia
  const linhas: { t: string; c: string }[] = []
  if (p.furadoT > 0) linhas.push({ t: `PNEU FURADO ${Math.ceil(p.furadoT)}s`, c: "#fb923c" })
  if (p.heli) {
    const t = p.holofote ? "🚁 NO HOLOFOTE" : p.heli.cegoT > 0 ? "🚁 TE PERDEU DE VISTA" : "🚁 FORA DO HOLOFOTE"
    linhas.push({ t, c: p.holofote ? "#fde047" : "#cbd5e1" })
  }
  if (!linhas.length) return
  ctx.font = `bold 12px ${FONTE}`
  ctx.textAlign = "center"
  for (const l of linhas) {
    ctx.fillStyle = l.c
    ctx.fillText(l.t, W / 2 + 254, y + 10)
    y += 16
  }
  ctx.textAlign = "left"
}

// ---------- mundo (chamados por render/objects.ts) ----------

/**
 * Tapete de pregos (E8): faixa prateada rente ao chão com reflexos âmbar
 * piscando — o âmbar é a cor de perigo reservada (pesquisa visual 1.8) e
 * aparece de longe mesmo à noite.
 */
export function drawPregos(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, amb: number) {
  const h = Math.max(1.5, w * 0.05)
  ctx.fillStyle = "rgba(0,0,0,0.35)"
  ctx.fillRect(x - w / 2, y - h * 0.2, w, h * 0.9)
  ctx.fillStyle = shade("#9ca3af", Math.max(0.55, amb))
  ctx.fillRect(x - w / 2, y - h, w, h)
  if (w < 8) return
  // dentes e reflexo âmbar alternando (pisca em fase com a posição)
  const n = Math.max(4, Math.floor(w / 9))
  const fase = Math.floor(performance.now() / 160)
  for (let i = 0; i < n; i++) {
    const px = x - w / 2 + (i + 0.5) * (w / n)
    ctx.fillStyle = shade("#e5e7eb", Math.max(0.6, amb))
    ctx.beginPath()
    ctx.moveTo(px - h * 0.5, y - h); ctx.lineTo(px, y - h * 2.1); ctx.lineTo(px + h * 0.5, y - h)
    ctx.closePath(); ctx.fill()
    if ((i + fase) % 3 === 0) {
      ctx.fillStyle = "rgba(255,159,28,0.9)"
      ctx.fillRect(px - h * 0.6, y - h * 0.8, h * 1.2, h * 0.6)
    }
  }
}

/** Placa de polícia: octógono vermelho "PARE" (usada por pregos e bloqueio). */
export function drawPlacaPolicia(ctx: CanvasRenderingContext2D, x: number, cy: number, r: number, amb: number) {
  ctx.fillStyle = shade("#dc2626", Math.max(0.55, amb))
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4
    const px = x + Math.cos(a) * r * 1.05, py = cy + Math.sin(a) * r * 1.05
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
  }
  ctx.closePath(); ctx.fill()
  if (r > 6) {
    ctx.fillStyle = "#f8fafc"
    ctx.font = `bold ${Math.max(6, Math.round(r * 0.62))}px ${FONTE}`
    ctx.textAlign = "center"
    ctx.fillText("PARE", x, cy + r * 0.22)
    ctx.textAlign = "left"
  }
}


/**
 * Viatura ATRAVESSADA do bloqueio (E10): de lado para você, com rodas,
 * faixa branca e giroflex. O giroflex é emissivo: aparece no horizonte antes
 * do corpo do carro (leitura de longe, pesquisa visual seção 3).
 */
export function drawViaturaAtravessada(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, amb: number) {
  const on = Math.floor(performance.now() / 110) % 2 === 0
  // halo do giroflex primeiro: lava o asfalto em volta, mesmo longe
  const barY = y - h * 1.05
  if (w > 2) {
    const c = on ? "239,68,68" : "59,130,246"
    const gr = w * 0.9
    const glow = ctx.createRadialGradient(x, barY, 0, x, barY, gr)
    glow.addColorStop(0, `rgba(${c},${0.3 + (1 - amb) * 0.45})`)
    glow.addColorStop(1, `rgba(${c},0)`)
    ctx.fillStyle = glow
    ctx.beginPath(); ctx.ellipse(x, barY, gr, gr * 0.55, 0, 0, Math.PI * 2); ctx.fill()
  }
  if (w < 4) {
    ctx.fillStyle = on ? "#ef4444" : "#3b82f6"
    ctx.fillRect(x - 1, barY - 1, 2, 2)
    return
  }
  ctx.fillStyle = "rgba(0,0,0,0.35)"
  ctx.beginPath(); ctx.ellipse(x, y, w * 0.58, w * 0.08, 0, 0, Math.PI * 2); ctx.fill()
  // carroceria de perfil: caixa baixa + cabine
  const bx = x - w / 2
  ctx.fillStyle = shade("#1d4ed8", amb * 0.95)
  rr(ctx, bx, y - h * 0.62, w, h * 0.45, h * 0.12)
  ctx.fillStyle = shade("#1e3a8a", amb * 0.9)
  rr(ctx, bx + w * 0.26, y - h * 0.95, w * 0.46, h * 0.36, h * 0.1)
  ctx.fillStyle = shade("#0f172a", Math.max(0.5, amb))
  rr(ctx, bx + w * 0.30, y - h * 0.9, w * 0.17, h * 0.26, h * 0.05)
  rr(ctx, bx + w * 0.51, y - h * 0.9, w * 0.17, h * 0.26, h * 0.05)
  // faixa branca da polícia
  ctx.fillStyle = `rgba(241,245,249,${0.55 + amb * 0.35})`
  ctx.fillRect(bx, y - h * 0.42, w, h * 0.09)
  // rodas
  ctx.fillStyle = "#0b0f19"
  ctx.beginPath(); ctx.arc(bx + w * 0.2, y - h * 0.16, h * 0.17, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(bx + w * 0.8, y - h * 0.16, h * 0.17, 0, Math.PI * 2); ctx.fill()
  // giroflex
  const barW = w * 0.34, barH = Math.max(2, h * 0.1)
  ctx.fillStyle = on ? "#ef4444" : "#1e293b"
  rr(ctx, x - barW / 2, barY, barW / 2, barH, barH * 0.35)
  ctx.fillStyle = on ? "#1e293b" : "#3b82f6"
  rr(ctx, x, barY, barW / 2, barH, barH * 0.35)
}

// ---------- helicóptero (chamados por render/road.ts) ----------

export interface PontoTela { x: number; y: number; w: number }

/**
 * Círculo do holofote no asfalto (E13). Somado com "lighter": clareia o que
 * já está lá em vez de pintar por cima. Um gradiente por quadro, só em 5★.
 */
export function drawHolofote(ctx: CanvasRenderingContext2D, s: PontoTela) {
  const rx = s.w * HOLOFOTE_X * 1.15, ry = Math.max(3, rx * 0.32)
  if (rx < 3) return
  ctx.save()
  ctx.globalCompositeOperation = "lighter"
  ctx.translate(s.x, s.y)
  ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  g.addColorStop(0, "rgba(255,250,215,0.42)")
  g.addColorStop(0.7, "rgba(255,250,215,0.22)")
  g.addColorStop(1, "rgba(255,250,215,0)")
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

/**
 * Helicóptero no céu sobre o ponto de luz, com o facho até o asfalto. Quando
 * a luz ficou para trás (você fugiu dela), ele sai da tela por cima.
 */
export function drawHelicoptero(eng: AutoDashEngine, luz: PontoTela | null) {
  const h = eng.policia.heli
  if (!h) return
  const ctx = eng.ctx
  const dz = wrapDz(eng, h.z, eng.position + PLAYER_Z)
  if (dz < -1500) return // passou por cima e ficou para trás
  const agora = performance.now()
  const x = luz ? luz.x : W / 2 + (h.x - eng.playerX) * 260
  const y = H * 0.22 + Math.sin(agora / 420) * 3 // abaixo do retrovisor (topo, 10..96)
  // facho: trapézio translúcido do helicóptero até o círculo
  if (luz && h.cegoT <= 0) {
    const rx = luz.w * HOLOFOTE_X * 1.15
    ctx.save()
    ctx.globalCompositeOperation = "lighter"
    const g = ctx.createLinearGradient(0, y, 0, luz.y)
    g.addColorStop(0, "rgba(255,250,215,0.12)")
    g.addColorStop(1, "rgba(255,250,215,0.05)")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(x - 3, y + 6); ctx.lineTo(x + 3, y + 6)
    ctx.lineTo(luz.x + rx, luz.y); ctx.lineTo(luz.x - rx, luz.y)
    ctx.closePath(); ctx.fill()
    ctx.restore()
  }
  // corpo, cauda, esquis e rotor borrado
  ctx.fillStyle = "#0b1020"
  ctx.beginPath(); ctx.ellipse(x, y, 17, 8, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillRect(x + 12, y - 2, 26, 3)
  ctx.fillRect(x + 36, y - 7, 3, 9)
  ctx.fillRect(x - 12, y + 11, 24, 2)
  ctx.fillRect(x - 8, y + 7, 2, 5); ctx.fillRect(x + 6, y + 7, 2, 5)
  ctx.fillStyle = "rgba(148,163,184,0.55)"
  const giro = (agora / 30) % 2 < 1 ? 1 : 0.6
  ctx.fillRect(x - 34 * giro, y - 11, 68 * giro, 2)
  // farol do holofote aceso embaixo do corpo: é o que se lê no céu escuro
  if (h.cegoT <= 0) {
    ctx.fillStyle = "#fff7d6"
    ctx.beginPath(); ctx.arc(x - 4, y + 6, 2.6, 0, Math.PI * 2); ctx.fill()
  }
  // luz anticolisão piscando
  if (Math.floor(agora / 400) % 2 === 0) {
    ctx.fillStyle = "#ef4444"
    ctx.beginPath(); ctx.arc(x, y - 9, 2.2, 0, Math.PI * 2); ctx.fill()
  }
}
