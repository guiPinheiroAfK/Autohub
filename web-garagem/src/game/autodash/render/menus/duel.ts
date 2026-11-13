// AutoDash — render/menus/duel.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { toMenu } from "../../flow"
import { AutoDashEngine, W } from "../../engine"
import { dim } from "./main"
import { pill, glass } from "../../ui/widgets"
import { duelCreate, duelJoin, duelRematch } from "../../modes/duel"

export function renderDuelLobby(eng: AutoDashEngine) {
  const ctx = eng.ctx
  dim(eng, 0.62)
  ctx.textAlign = "center"
  ctx.fillStyle = "#38bdf8"
  ctx.font = "900 44px 'Space Grotesk', sans-serif"
  ctx.fillText("DUELO ONLINE", W / 2, 150)
  ctx.fillStyle = "rgba(248,250,252,0.75)"
  ctx.font = "15px 'Space Grotesk', sans-serif"
  ctx.fillText("dois pilotos, mesma pista, largada junta.", W / 2, 186)
  ctx.fillText("quem for mais longe sem bater, leva.", W / 2, 208)
  ctx.textAlign = "left"
  pill(eng, "CRIAR SALA", W / 2 - 150, 260, 300, () => duelCreate(eng), { primary: true, h: 44, font: 17 })
  pill(eng, "TENHO UM CÓDIGO", W / 2 - 150, 316, 300, () => { eng.codeBuf = ""; eng.state = "duelcode"; eng.audio.ui() }, { h: 38, font: 15 })
  pill(eng, "← voltar  [ESC]", W / 2 - 150, 368, 300, () => toMenu(eng), { h: 30 })
}

export function renderDuelCode(eng: AutoDashEngine) {
  const ctx = eng.ctx
  dim(eng, 0.7)
  glass(eng, W / 2 - 210, 150, 420, 250, 20)
  ctx.textAlign = "center"
  ctx.fillStyle = "#38bdf8"
  ctx.font = "900 30px 'Space Grotesk', sans-serif"
  ctx.fillText("CÓDIGO DA SALA", W / 2, 204)
  const cursor = Math.floor(performance.now() / 400) % 2 === 0 ? "▌" : " "
  ctx.fillStyle = "#f8fafc"
  ctx.font = "bold 44px 'Consolas', monospace"
  ctx.fillText(eng.codeBuf + cursor, W / 2, 282)
  ctx.fillStyle = "rgba(255,255,255,0.25)"
  ctx.fillRect(W / 2 - 90, 296, 180, 2)
  ctx.textAlign = "left"
  pill(eng, "ENTRAR  [ENTER]", W / 2 - 110, 330, 220, () => duelJoin(eng), { primary: true, h: 34, font: 14 })
  pill(eng, "← voltar", W / 2 - 110, 372, 220, () => { eng.state = "duellobby" }, { h: 26 })
}

export function renderDuelWaiting(eng: AutoDashEngine) {
  const ctx = eng.ctx
  const d = eng.duel
  dim(eng, 0.66)
  ctx.textAlign = "center"
  if (!d) { eng.state = "duellobby"; return }
  if (d.startAtLocal === null) {
    const dots = ".".repeat(1 + (Math.floor(performance.now() / 400) % 3))
    if (d.rematch) {
      ctx.fillStyle = "#fde047"
      ctx.font = "900 40px 'Space Grotesk', sans-serif"
      ctx.fillText("⚔ REVANCHE!", W / 2, 220)
      ctx.fillStyle = "rgba(248,250,252,0.75)"
      ctx.font = "16px 'Space Grotesk', sans-serif"
      ctx.fillText(`esperando ${d.oppName || "o rival"} topar${dots}`, W / 2, 268)
    } else {
      ctx.fillStyle = "rgba(248,250,252,0.8)"
      ctx.font = "16px 'Space Grotesk', sans-serif"
      ctx.fillText(d.code === "...." ? "criando sala..." : "manda esse código pro seu rival:", W / 2, 170)
      ctx.fillStyle = "#fde047"
      ctx.font = "900 84px 'Consolas', monospace"
      if (d.code !== "....") ctx.fillText(d.code, W / 2, 268)
      ctx.fillStyle = "rgba(248,250,252,0.6)"
      ctx.font = "16px 'Space Grotesk', sans-serif"
      ctx.fillText(`esperando oponente${dots}`, W / 2, 330)
    }
    ctx.textAlign = "left"
    pill(eng, "cancelar  [ESC]", W / 2 - 100, 370, 200, () => toMenu(eng), { h: 28 })
  } else {
    const secs = Math.max(0, (d.startAtLocal - performance.now()) / 1000)
    ctx.fillStyle = "#4ade80"
    ctx.font = "900 40px 'Space Grotesk', sans-serif"
    ctx.fillText(`${d.oppName} ENTROU!`, W / 2, 220)
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 64px 'Space Grotesk', sans-serif"
    ctx.fillText(secs.toFixed(1), W / 2, 300)
    ctx.fillStyle = "rgba(248,250,252,0.7)"
    ctx.font = "15px 'Space Grotesk', sans-serif"
    ctx.fillText("prepara o dedo no acelerador...", W / 2, 340)
    ctx.textAlign = "left"
  }
}

export function renderDuelSpectate(eng: AutoDashEngine) {
  const ctx = eng.ctx
  const d = eng.duel
  dim(eng, 0.55)
  ctx.textAlign = "center"
  ctx.fillStyle = "#ef4444"
  ctx.font = "900 44px 'Space Grotesk', sans-serif"
  ctx.fillText("VOCÊ BATEU!", W / 2, 170)
  ctx.fillStyle = "#f8fafc"
  ctx.font = "bold 22px 'Space Grotesk', sans-serif"
  ctx.fillText(`sua marca: ${eng.km.toFixed(2)} km · ${Math.floor(eng.score).toLocaleString("pt-BR")} pts`, W / 2, 220)
  if (d) {
    const dots = ".".repeat(1 + (Math.floor(performance.now() / 400) % 3))
    ctx.fillStyle = "#f472b6"
    ctx.font = "bold 26px 'Space Grotesk', sans-serif"
    ctx.fillText(`${d.oppName || "RIVAL"} ainda está correndo${dots}`, W / 2, 290)
    ctx.fillStyle = "rgba(248,250,252,0.85)"
    ctx.font = "bold 34px 'Space Grotesk', sans-serif"
    ctx.fillText(`${d.oppD.toFixed(2)} km`, W / 2, 336)
    const lead = eng.km - d.oppD
    ctx.font = "15px 'Space Grotesk', sans-serif"
    ctx.fillStyle = lead > 0 ? "#4ade80" : "#ef4444"
    ctx.fillText(lead > 0 ? `ele ainda precisa de ${Math.round(lead * 1000)}m pra te passar` : "ele já passou a sua marca...", W / 2, 372)
  }
  ctx.textAlign = "left"
}

export function renderDuelResult(eng: AutoDashEngine) {
  const ctx = eng.ctx
  const d = eng.duel
  dim(eng, 0.66)
  ctx.textAlign = "center"
  const win = d?.result === "win"
  ctx.fillStyle = win ? "#4ade80" : "#ef4444"
  ctx.font = "900 72px 'Space Grotesk', sans-serif"
  ctx.fillText(win ? "VITÓRIA!" : "DERROTA", W / 2, 190)
  if (d) {
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 22px 'Space Grotesk', sans-serif"
    ctx.fillText(`você: ${eng.km.toFixed(2)} km   ·   ${d.oppName || "rival"}: ${d.oppD.toFixed(2)} km`, W / 2, 250)
    if (d.msg) {
      ctx.fillStyle = "rgba(248,250,252,0.6)"
      ctx.font = "14px 'Space Grotesk', sans-serif"
      ctx.fillText(d.msg, W / 2, 284)
    }
  }
  ctx.textAlign = "left"
  pill(eng, "⚔ REVANCHE  [ENTER]", W / 2 - 240, 340, 240, () => duelRematch(eng), { primary: true, h: 40, font: 15 })
  pill(eng, "MENU", W / 2 + 20, 340, 220, () => toMenu(eng), { h: 40, font: 15 })
}
