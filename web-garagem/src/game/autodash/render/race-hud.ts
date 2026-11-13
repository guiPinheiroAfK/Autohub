// AutoDash — render/race-hud.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, W } from "../engine"
import { glass } from "../ui/widgets"

export function renderRaceHud(eng: AutoDashEngine) {
  const r = eng.race
  if (!r) return
  const ctx = eng.ctx
  // já terminei: faixa "ASSISTINDO" no topo enquanto os rivais fecham a prova
  if (eng.raceFinished) {
    ctx.textAlign = "center"
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 400)
    ctx.fillStyle = `rgba(56,189,248,${pulse})`
    ctx.font = "bold 20px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("🏁 VOCÊ CHEGOU — assistindo os rivais…", W / 2, 40)
    ctx.textAlign = "left"
  }
  const grid = r.grid()
  const bw = 208, bh = 56 + grid.length * 22
  const bx = 14, by = 88
  glass(eng, bx, by, bw, bh, 10)

  // VOLTA e POSIÇÃO em tamanho grande: são as duas informações que o piloto
  // consulta de relance, não dá pra deixar como linha miúda de cabeçalho
  const ultima = r.lap === r.cfg.voltas - 1
  ctx.fillStyle = "rgba(248,250,252,0.5)"
  ctx.font = "bold 10px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("VOLTA", bx + 12, by + 18)
  ctx.fillStyle = ultima ? "#ef4444" : "#f8fafc"
  ctx.font = "bold 26px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(`${Math.min(r.lap + 1, r.cfg.voltas)}`, bx + 12, by + 42)
  ctx.fillStyle = "rgba(248,250,252,0.55)"
  ctx.font = "bold 15px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(`/${r.cfg.voltas}`, bx + 34, by + 42)
  ctx.textAlign = "right"
  ctx.fillStyle = "rgba(248,250,252,0.5)"
  ctx.font = "bold 10px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("POSIÇÃO", bx + bw - 12, by + 18)
  ctx.fillStyle = "#fde047"
  ctx.font = "bold 26px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(`${r.minhaPosicao()}º`, bx + bw - 12, by + 42)
  ctx.textAlign = "left"
  let y = by + 68
  for (let i = 0; i < grid.length; i++) {
    const g = grid[i]
    // bolinha na cor do rival: mesma do mapa e da faixa no teto dele
    if (!g.eu && g.cor) {
      ctx.fillStyle = g.cor
      ctx.beginPath(); ctx.arc(bx + 17, y - 4, 3.2, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = g.eu ? "#fde047" : g.crashed ? "rgba(248,113,113,0.85)" : "rgba(248,250,252,0.75)"
    ctx.font = `${g.eu ? "bold " : ""}13px 'Space Grotesk', 'Segoe UI', sans-serif`
    ctx.fillText(`${i + 1}. ${g.nome}${g.finished ? " ✓" : ""}`, bx + (g.eu ? 12 : 25), y)
    ctx.textAlign = "right"
    ctx.fillText(`v${g.lap + 1}`, bx + bw - 12, y)
    ctx.textAlign = "left"
    y += 22
  }
}
