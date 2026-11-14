// AutoDash — render/policia.ts. Desenho da polícia por estrelas (Fase 6):
// HUD de estrelas, pregos e placa. As regras moram em world/policia.ts.
import { AutoDashEngine, W } from "../engine"
import { glass } from "../ui/widgets"
import { clamp, shade } from "../math"
import { estrelasDe, nivelDe, ESTRELAS, ESFRIA_S } from "../world/policia"

const FONTE = "'Space Grotesk', 'Segoe UI', sans-serif"

function estrela(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 === 0 ? r : r * 0.45
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr
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



/** Avisos curtos sob o painel de estrelas (pneu furado). */
function avisos(eng: AutoDashEngine, y: number) {
  const ctx = eng.ctx
  const p = eng.policia
  const linhas: { t: string; c: string }[] = []
  if (p.furadoT > 0) linhas.push({ t: `PNEU FURADO ${Math.ceil(p.furadoT)}s`, c: "#fb923c" })
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

