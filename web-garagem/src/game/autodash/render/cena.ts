// AutoDash — render/cena.ts. Cenografia dos eventos (Fase 8.3): o que dá vida à
// obra, ao acidente, à blitz e ao radar. Sprites em canvas; `w` é a largura do
// obstáculo na tela e (x, y) o pé dele no chão.
import { type AutoDashEngine, type Obstacle } from "../engine"
import { shade } from "../math"
import { rr } from "./primitives"

const pisca = (ms: number) => Math.floor(performance.now() / ms) % 2 === 0

/** Desenha um obstáculo com `visual`. Devolve false se não tem. */
export function drawCena(eng: AutoDashEngine, o: Obstacle, x: number, y: number, w: number, amb: number): boolean {
  if (!o.visual) return false
  if (w < 2) return true
  const ctx = eng.ctx
  const luz = Math.max(0.4, amb)
  const lado = o.lado ?? 1
  switch (o.visual) {
    case "maquina": {
      // retroescavadeira amarela: chassi, cabine, braço e concha (vira para a pista)
      const h = w * 0.55
      ctx.fillStyle = "rgba(0,0,0,0.3)"
      ctx.beginPath(); ctx.ellipse(x, y, w * 0.6, w * 0.08, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = shade("#1f2937", luz)
      ctx.beginPath(); ctx.arc(x - w * 0.28, y - w * 0.12, w * 0.13, 0, Math.PI * 2); ctx.arc(x + w * 0.28, y - w * 0.1, w * 0.1, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = shade("#eab308", luz)
      rr(ctx, x - w * 0.45, y - h * 0.62, w * 0.9, h * 0.38, w * 0.03)
      ctx.fillRect(x - w * 0.3, y - h * 1.2, w * 0.32, h * 0.6) // cabine
      ctx.fillStyle = shade("#93c5fd", luz)
      ctx.fillRect(x - w * 0.26, y - h * 1.12, w * 0.24, h * 0.3)
      // braço articulado e concha, do lado da pista
      const d = -lado
      ctx.strokeStyle = shade("#ca8a04", luz)
      ctx.lineWidth = Math.max(1.5, w * 0.06)
      ctx.beginPath()
      ctx.moveTo(x + d * w * 0.1, y - h * 0.9); ctx.lineTo(x + d * w * 0.55, y - h * 1.35); ctx.lineTo(x + d * w * 0.72, y - h * 0.45)
      ctx.stroke()
      ctx.fillStyle = shade("#374151", luz)
      ctx.beginPath(); ctx.moveTo(x + d * w * 0.62, y - h * 0.5); ctx.lineTo(x + d * w * 0.86, y - h * 0.5); ctx.lineTo(x + d * w * 0.78, y - h * 0.18); ctx.closePath(); ctx.fill()
      // giroflex âmbar no teto
      if (pisca(300)) { ctx.fillStyle = "#fbbf24"; ctx.fillRect(x - w * 0.18, y - h * 1.3, w * 0.08, h * 0.1) }
      return true
    }
    case "trabalhador": {
      // homem com colete laranja e capacete, balançando a bandeira
      const h = w * 2.2
      ctx.fillStyle = shade("#1e3a8a", luz) // calça
      ctx.fillRect(x - w * 0.18, y - h * 0.45, w * 0.14, h * 0.45)
      ctx.fillRect(x + w * 0.04, y - h * 0.45, w * 0.14, h * 0.45)
      ctx.fillStyle = shade("#f97316", Math.max(0.6, amb)) // colete
      ctx.fillRect(x - w * 0.24, y - h * 0.8, w * 0.48, h * 0.38)
      ctx.fillStyle = shade("#f8fafc", Math.max(0.6, amb)) // faixa refletiva
      ctx.fillRect(x - w * 0.24, y - h * 0.62, w * 0.48, h * 0.05)
      ctx.fillStyle = shade("#d6a77a", luz) // rosto
      ctx.beginPath(); ctx.arc(x, y - h * 0.88, w * 0.13, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = shade("#facc15", Math.max(0.6, amb)) // capacete
      ctx.beginPath(); ctx.arc(x, y - h * 0.92, w * 0.15, Math.PI, 0); ctx.fill()
      // bandeira: o braço sobe e desce (sinaliza "devagar")
      const ang = Math.sin(performance.now() / 260) * 0.5
      const bx = x - lado * w * 0.22, by = y - h * 0.74
      const tx = bx - lado * Math.cos(ang) * w * 0.55, ty = by - Math.sin(ang + 0.6) * w * 0.55
      ctx.strokeStyle = shade("#475569", luz); ctx.lineWidth = Math.max(1, w * 0.05)
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke()
      ctx.fillStyle = "#ef4444"
      ctx.fillRect(tx - w * 0.2, ty - w * 0.14, w * 0.2, w * 0.14)
      return true
    }
    case "triangulo": {
      // triângulo de sinalização no asfalto (refletivo)
      const h = w * 0.9
      ctx.strokeStyle = shade("#ef4444", Math.max(0.7, amb))
      ctx.lineWidth = Math.max(1.5, w * 0.14)
      ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w * 0.5, y - w * 0.05); ctx.lineTo(x - w * 0.5, y - w * 0.05); ctx.closePath(); ctx.stroke()
      return true
    }
    case "detritos": {
      // cacos e pedaços de para-choque espalhados
      ctx.fillStyle = shade("#1f2937", luz)
      for (let i = 0; i < 7; i++) {
        const dx = ((i * 37) % 11 - 5) / 5 * w * 0.5, dy = ((i * 23) % 5) / 5 * w * 0.08
        ctx.fillRect(x + dx, y - dy - w * 0.02, w * 0.08, Math.max(1, w * 0.03))
      }
      ctx.fillStyle = "rgba(191,219,254,0.7)"
      for (let i = 0; i < 5; i++) ctx.fillRect(x + ((i * 53) % 9 - 4) / 4 * w * 0.4, y - w * 0.02, Math.max(1, w * 0.03), Math.max(1, w * 0.02))
      return true
    }
    case "guarda": {
      // policial com colete refletivo e a lanterna de sinalizar
      const h = w * 2.2
      ctx.fillStyle = shade("#0f172a", luz)
      ctx.fillRect(x - w * 0.18, y - h * 0.45, w * 0.14, h * 0.45)
      ctx.fillRect(x + w * 0.04, y - h * 0.45, w * 0.14, h * 0.45)
      ctx.fillStyle = shade("#1e3a8a", luz)
      ctx.fillRect(x - w * 0.24, y - h * 0.8, w * 0.48, h * 0.38)
      ctx.fillStyle = shade("#a3e635", Math.max(0.7, amb)) // colete
      ctx.fillRect(x - w * 0.2, y - h * 0.76, w * 0.4, h * 0.3)
      ctx.fillStyle = shade("#d6a77a", luz)
      ctx.beginPath(); ctx.arc(x, y - h * 0.88, w * 0.13, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = shade("#0f172a", luz) // quepe
      ctx.fillRect(x - w * 0.15, y - h * 0.98, w * 0.3, h * 0.06)
      const lx = x + lado * -w * 0.32, ly = y - h * 0.7
      ctx.fillStyle = pisca(220) ? "#ef4444" : "#fca5a5"
      ctx.fillRect(lx - w * 0.04, ly - w * 0.35, w * 0.08, w * 0.35)
      if (amb < 0.75) {
        ctx.fillStyle = "rgba(239,68,68,0.2)"
        ctx.beginPath(); ctx.arc(lx, ly - w * 0.2, w * 0.4, 0, Math.PI * 2); ctx.fill()
      }
      return true
    }
    case "radar": {
      // poste do radar: braço sobre a faixa, a caixa da câmera e a placa 90
      const h = w * 4.2
      ctx.fillStyle = shade("#64748b", luz)
      ctx.fillRect(x - w * 0.05, y - h, w * 0.1, h)
      ctx.fillRect(x - lado * w * 0.9, y - h, w * 0.9, w * 0.08)
      ctx.fillStyle = shade("#e2e8f0", luz)
      rr(ctx, x - lado * w * 0.85 - w * 0.12, y - h + w * 0.08, w * 0.24, w * 0.2, w * 0.03)
      ctx.fillStyle = shade("#0f172a", luz)
      ctx.beginPath(); ctx.arc(x - lado * w * 0.85, y - h + w * 0.18, w * 0.06, 0, Math.PI * 2); ctx.fill()
      if (w > 6) {
        ctx.fillStyle = shade("#f8fafc", luz)
        ctx.beginPath(); ctx.arc(x, y - h * 0.55, w * 0.32, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = shade("#dc2626", luz); ctx.lineWidth = Math.max(1, w * 0.07)
        ctx.beginPath(); ctx.arc(x, y - h * 0.55, w * 0.27, 0, Math.PI * 2); ctx.stroke()
        if (w > 14) {
          ctx.fillStyle = "#0f172a"
          ctx.font = `bold ${Math.round(w * 0.3)}px 'Space Grotesk', 'Segoe UI', sans-serif`
          ctx.textAlign = "center"; ctx.fillText("90", x, y - h * 0.55 + w * 0.1); ctx.textAlign = "left"
        }
      }
      return true
    }
  }
  return false
}
