// AutoDash — render/hud-torque.ts. Torque na tela (pendência do ADR 0012,
// entra na Fase 7): mini curva de força do motor ao lado do conta-giros, com
// um ponto no giro atual. Mostra ONDE o motor tem força (V8 embaixo, VTEC em
// cima, turbo que só enche depois do spool), que é o que muda a troca ideal.
//
// Só leitura da física (physics/motores.ts): nada aqui altera o carro.
import type { AutoDashEngine } from "../engine"
import { W, H } from "../engine"
import { glass } from "../ui/widgets"
import { motorDe, forcaEm, curvaEm, ganhoMotor, type MotorFisico } from "../physics/motores"
import { giroVisto } from "../physics/rpm"
import { clamp } from "../math"

export const TORQUE_PONTOS = 24

/** Giro onde a curva (boost cheio) é máxima: a "faixa de força" do motor. */
export function giroDeForcaMaxima(m: MotorFisico): number {
  let melhor = m.idle, v = -1
  for (let i = 0; i <= 96; i++) {
    const rpm = m.idle + (m.corte - m.idle) * (i / 96)
    const f = curvaEm(m, rpm)
    if (f > v) { v = f; melhor = rpm }
  }
  return melhor
}

/** Painel do torque. Fica fora no celular (os botões de toque ocupam o canto). */
export function renderTorqueHud(eng: AutoDashEngine) {
  if (eng.isTouch) return
  if (eng.state !== "racing" && eng.state !== "paused") return
  const ctx = eng.ctx
  const m = motorDe(eng)
  const x = W - 334, y = H - 66, w = 126, h = 54
  glass(eng, x, y, w, h, 10)
  const gx = x + 8, gy = y + 16, gw = w - 16, gh = h - 24
  const topo = ganhoMotor(m) // força máxima possível (boost cheio)
  const px = (rpm: number) => gx + gw * clamp((rpm - m.idle) / (m.corte - m.idle), 0, 1)
  const py = (f: number) => gy + gh - gh * clamp(f / topo, 0, 1)

  // faixa de força máxima (mais clara)
  const pico = giroDeForcaMaxima(m)
  ctx.fillStyle = "rgba(74,222,128,0.12)"
  ctx.fillRect(px(pico) - 6, gy, 12, gh)

  // curva com boost cheio (fraca) e com o boost de agora (forte)
  const curva = (boost: number) => {
    ctx.beginPath()
    for (let i = 0; i <= TORQUE_PONTOS; i++) {
      const rpm = m.idle + (m.corte - 1 - m.idle) * (i / TORQUE_PONTOS)
      const X = px(rpm), Y = py(forcaEm(m, rpm, boost))
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y)
    }
    ctx.stroke()
  }
  ctx.lineWidth = 1.5
  if (m.turbo) { ctx.strokeStyle = "rgba(148,163,184,0.45)"; curva(1) }
  ctx.strokeStyle = "#38bdf8"
  curva(m.turbo ? eng.boost : 1)

  // ponto no giro atual
  const giro = giroVisto(eng)
  const f = forcaEm(m, Math.min(giro, m.corte - 1), m.turbo ? eng.boost : 1)
  ctx.fillStyle = giro >= m.redline ? "#ef4444" : "#f8fafc"
  ctx.beginPath(); ctx.arc(px(giro), py(f), 3.5, 0, Math.PI * 2); ctx.fill()

  ctx.fillStyle = "rgba(248,250,252,0.7)"
  ctx.font = "bold 10px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("TORQUE", x + 8, y + 12)
  ctx.textAlign = "right"
  ctx.fillText(`${Math.round(100 * f / topo)}%`, x + w - 8, y + 12)
  ctx.textAlign = "left"
}
