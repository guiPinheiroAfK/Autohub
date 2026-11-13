// AutoDash — ui/widgets.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine } from "../engine"
import { rr } from "../render/primitives"

export function glass(eng: AutoDashEngine, x: number, y: number, w: number, h: number, r = 14) {
  const ctx = eng.ctx
  ctx.fillStyle = "rgba(8,13,26,0.55)"
  rr(ctx, x, y, w, h, r)
  const hl = ctx.createLinearGradient(0, y, 0, y + h * 0.55)
  hl.addColorStop(0, "rgba(255,255,255,0.10)")
  hl.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = hl
  rr(ctx, x, y, w, h * 0.55, r)
  ctx.strokeStyle = "rgba(255,255,255,0.14)"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r)
  ctx.stroke()
}

export function isHover(eng: AutoDashEngine, x: number, y: number, w: number, h: number) {
  return eng.mousePx.x >= x && eng.mousePx.x <= x + w && eng.mousePx.y >= y && eng.mousePx.y <= y + h
}

export function pill(eng: AutoDashEngine, label: string, x: number, y: number, w: number, act: () => void, opts: { primary?: boolean; h?: number; font?: number } = {}) {
  const ctx = eng.ctx
  const h = opts.h ?? 28
  const hov = isHover(eng, x, y, w, h)
  ctx.fillStyle = opts.primary
      ? (hov ? "#fde047" : "#facc15")
      : (hov ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.10)")
  rr(ctx, x, y, w, h, h / 2)
  ctx.strokeStyle = hov ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.18)"
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, h / 2); ctx.stroke()
  ctx.fillStyle = opts.primary ? "#1c1917" : "#f8fafc"
  ctx.font = `bold ${opts.font ?? 13}px 'Space Grotesk', 'Segoe UI', sans-serif`
  ctx.textAlign = "center"
  ctx.fillText(label, x + w / 2, y + h / 2 + (opts.font ?? 13) * 0.36)
  ctx.textAlign = "left"
  eng.uiRegions.push({ x, y, w, h, act })
}

export function arrowBtn(eng: AutoDashEngine, x: number, y: number, dir: -1 | 1, act: () => void) {
  const ctx = eng.ctx
  const s = 46
  const hov = isHover(eng, x, y, s, s)
  ctx.fillStyle = hov ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.10)"
  rr(ctx, x, y, s, s, 12)
  ctx.fillStyle = "#f8fafc"
  ctx.font = "bold 22px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.textAlign = "center"
  ctx.fillText(dir < 0 ? "◀" : "▶", x + s / 2, y + s / 2 + 8)
  ctx.textAlign = "left"
  eng.uiRegions.push({ x, y, w: s, h: s, act })
}
