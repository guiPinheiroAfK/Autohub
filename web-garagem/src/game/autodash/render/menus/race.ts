// AutoDash — render/menus/race.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { toMenu } from "../../flow"
import { AutoDashEngine, W, H } from "../../engine"
import { dim } from "./main"
import { arrowBtn, pill, glass } from "../../ui/widgets"
import { CARS, saveConfig } from "../../data"
import { rr, drawPlayerCar } from "../primitives"
import { clamp } from "../../math"
import { correrComBots, abrirCodigoSala } from "../../modes/race"

export function renderRaceLobby(eng: AutoDashEngine) {
  const ctx = eng.ctx
  dim(eng, 0.6)
  ctx.textAlign = "center"
  ctx.fillStyle = "#f8fafc"
  ctx.font = "900 46px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("🏁 CORRIDA", W / 2, 108)
  ctx.font = "16px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillStyle = "rgba(248,250,252,0.7)"
  ctx.fillText("até 4 pilotos · por voltas · quem cruzar primeiro leva", W / 2, 140)
  ctx.textAlign = "left"

  // seletor de voltas
  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(248,250,252,0.85)"
  ctx.font = "bold 16px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(`VOLTAS: ${eng.raceVoltas}`, W / 2, 196)
  ctx.textAlign = "left"
  arrowBtn(eng, W / 2 - 108, 180, -1, () => { eng.raceVoltas = Math.max(1, eng.raceVoltas - 1); eng.audio.ui() })
  arrowBtn(eng, W / 2 + 84, 180, 1, () => { eng.raceVoltas = Math.min(9, eng.raceVoltas + 1); eng.audio.ui() })

  // seletor de bots
  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(248,250,252,0.85)"
  ctx.fillText(`ADVERSÁRIOS (BOTS): ${eng.raceBots}`, W / 2, 244)
  ctx.textAlign = "left"
  arrowBtn(eng, W / 2 - 148, 228, -1, () => { eng.raceBots = Math.max(1, eng.raceBots - 1); eng.audio.ui() })
  arrowBtn(eng, W / 2 + 124, 228, 1, () => { eng.raceBots = Math.min(3, eng.raceBots + 1); eng.audio.ui() })

  // seletor de CARRO — a escolha vive aqui, não na garagem, porque é aqui
  // que se monta a corrida
  const spec = CARS[eng.cfg.carIdx]
  ctx.textAlign = "center"
  ctx.fillStyle = "#f8fafc"
  ctx.font = "bold 18px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(spec.name, W / 2, 296)
  ctx.fillStyle = "rgba(248,250,252,0.55)"
  ctx.font = "12px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(spec.desc, W / 2, 316)
  ctx.textAlign = "left"
  arrowBtn(eng, W / 2 - 190, 280, -1, () => {
    eng.cfg.carIdx = (eng.cfg.carIdx + CARS.length - 1) % CARS.length; saveConfig(eng.cfg); eng.audio.ui()
  })
  arrowBtn(eng, W / 2 + 166, 280, 1, () => {
    eng.cfg.carIdx = (eng.cfg.carIdx + 1) % CARS.length; saveConfig(eng.cfg); eng.audio.ui()
  })
  // barrinhas de atributo, pra comparar sem decorar número
  const barra = (rot: string, frac: number, x: number) => {
    ctx.fillStyle = "rgba(248,250,252,0.45)"
    ctx.font = "9px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(rot, x, 334)
    ctx.fillStyle = "rgba(255,255,255,0.14)"
    rr(ctx, x, 340, 92, 6, 3)
    ctx.fillStyle = "#38bdf8"
    rr(ctx, x, 340, 92 * clamp(frac, 0.06, 1), 6, 3)
  }
  barra("POTÊNCIA", spec.power / 58, W / 2 - 190)
  barra("ADERÊNCIA", spec.grip / 0.95, W / 2 - 46)
  barra("VELOCIDADE", spec.topSpeed / 262, W / 2 + 98)

  pill(eng, "🏁 CORRER COM BOTS  [ENTER]", W / 2 - 160, 366, 320, () => correrComBots(eng), { primary: true, h: 44, font: 16 })
  pill(eng, "CRIAR SALA  [H]", W / 2 - 160, 416, 155, () => void eng.criarSalaOnline(), { h: 36, font: 13 })
  pill(eng, "ENTRAR  [J]", W / 2 + 5, 416, 155, () => abrirCodigoSala(eng), { h: 36, font: 13 })

  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(248,250,252,0.5)"
  ctx.font = "13px 'Space Grotesk', 'Segoe UI', sans-serif"
  if (eng.raceErro) { ctx.fillStyle = "#f87171"; ctx.fillText(eng.raceErro, W / 2, 470) }
  else ctx.fillText("← → trocam o carro · ESC volta pro menu", W / 2, 470)
  ctx.textAlign = "left"
}

export function renderRaceCode(eng: AutoDashEngine) {
  const ctx = eng.ctx
  dim(eng, 0.62)
  ctx.textAlign = "center"
  ctx.fillStyle = "#f8fafc"
  ctx.font = "900 34px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("CÓDIGO DA SALA", W / 2, 180)
  ctx.font = "900 62px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillStyle = "#fde047"
  ctx.fillText((eng.codeBuf + "____").slice(0, 4).split("").join(" "), W / 2, 260)
  ctx.font = "14px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillStyle = eng.raceErro ? "#f87171" : "rgba(248,250,252,0.6)"
  ctx.fillText(eng.raceErro ?? "digite as 4 letras · ENTER entra · ESC volta", W / 2, 310)
  ctx.textAlign = "left"
}

export function renderRaceWait(eng: AutoDashEngine) {
  const ctx = eng.ctx
  const r = eng.race
  dim(eng, 0.62)
  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(248,250,252,0.7)"
  ctx.font = "14px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("CÓDIGO DA SALA — passe pros seus amigos", W / 2, 132)
  ctx.fillStyle = "#fde047"
  ctx.font = "900 66px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText((r?.cfg.code ?? "----").split("").join(" "), W / 2, 200)

  ctx.font = "bold 14px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillStyle = "rgba(248,250,252,0.6)"
  ctx.fillText(`PILOTOS (${(r?.lobbyNomes.length ?? 1)}/4)`, W / 2, 248)
  let y = 280
  const nomes = r?.lobbyNomes.length ? r.lobbyNomes : [eng.cfg.pilotName || "VOCÊ"]
  for (const n of nomes) {
    ctx.fillStyle = "#f8fafc"
    ctx.font = "18px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(n, W / 2, y); y += 26
  }
  ctx.textAlign = "left"
  if (r?.cfg.souDono) {
    pill(eng, "🏁 LARGAR  [ENTER]", W / 2 - 120, y + 12, 240, () => void r.largar(), { primary: true, h: 44, font: 16 })
  } else {
    ctx.textAlign = "center"
    ctx.fillStyle = "rgba(248,250,252,0.6)"
    ctx.font = "15px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("esperando o dono da sala largar…", W / 2, y + 32)
    ctx.textAlign = "left"
  }
  ctx.textAlign = "center"
  ctx.fillStyle = r?.erro ? "#f87171" : "rgba(248,250,252,0.45)"
  ctx.font = "13px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(r?.erro ?? "ESC sai da sala", W / 2, H - 40)
  ctx.textAlign = "left"
}

export function renderRaceResult(eng: AutoDashEngine) {
  const ctx = eng.ctx
  const r = eng.race
  const grid = r?.grid() ?? []
  const eu = grid.findIndex(g => g.eu) + 1
  const venceu = eu === 1
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`

  // fundo: gradiente escuro roxo + holofote atrás do carro
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, "rgba(8,4,20,0.92)")
  bg.addColorStop(1, "rgba(24,10,40,0.92)")
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  const cor = venceu ? "#fde047" : "#38bdf8"
  const spot = ctx.createRadialGradient(W / 2, H * 0.66, 20, W / 2, H * 0.66, W * 0.42)
  spot.addColorStop(0, cor + "33"); spot.addColorStop(1, cor + "00")
  ctx.fillStyle = spot; ctx.fillRect(0, 0, W, H)

  // título
  ctx.textAlign = "center"
  ctx.fillStyle = cor
  ctx.font = "900 60px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.shadowColor = cor; ctx.shadowBlur = venceu ? 28 : 12
  ctx.fillText(venceu ? "VITÓRIA!" : `${eu}º LUGAR`, W / 2, 96)
  ctx.shadowBlur = 0

  // teu carro no holofote, girando de leve
  const spec = CARS[eng.cfg.carIdx]
  const custom = eng.cfg.customs[eng.cfg.carIdx]
  ctx.save()
  ctx.translate(W / 2, H * 0.6)
  ctx.rotate(Math.sin(performance.now() / 900) * 0.06)
  // neon sob o carro na cor da colocação
  const und = ctx.createRadialGradient(0, 30, 6, 0, 30, 150)
  und.addColorStop(0, cor + "88"); und.addColorStop(1, cor + "00")
  ctx.fillStyle = und
  ctx.beginPath(); ctx.ellipse(0, 30, 150, 34, 0, 0, Math.PI * 2); ctx.fill()
  drawPlayerCar(ctx, 0, 0, spec, custom, 0, false, 1, false, 1.7)
  ctx.restore()

  // tempo total + melhor volta
  if (r) {
    const melhor = r.lapTimes.length ? Math.min(...r.lapTimes) : 0
    ctx.fillStyle = "rgba(248,250,252,0.55)"
    ctx.font = "bold 11px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("TEMPO TOTAL", W * 0.36, 150)
    ctx.fillText("MELHOR VOLTA", W * 0.64, 150)
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 26px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(fmt(r.raceClock), W * 0.36, 180)
    ctx.fillStyle = "#4ade80"
    ctx.fillText(melhor ? fmt(melhor) : "—", W * 0.64, 180)
  }

  // grid final, colunas nas laterais
  let y = 232
  for (let i = 0; i < grid.length; i++) {
    const g = grid[i]
    const gx = W * 0.5 - 150
    ctx.textAlign = "left"
    if (g.eu) { ctx.fillStyle = "rgba(253,224,71,0.14)"; rr(ctx, gx - 10, y - 17, 300, 24, 6) }
    ctx.fillStyle = i === 0 ? "#fde047" : "rgba(248,250,252,0.5)"
    ctx.font = "bold 15px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(`${i + 1}º`, gx, y)
    if (!g.eu && g.cor) { ctx.fillStyle = g.cor; ctx.beginPath(); ctx.arc(gx + 34, y - 5, 3.5, 0, Math.PI * 2); ctx.fill() }
    ctx.fillStyle = g.eu ? "#fde047" : "rgba(248,250,252,0.85)"
    ctx.font = `${g.eu ? "bold " : ""}16px 'Space Grotesk', 'Segoe UI', sans-serif`
    ctx.fillText(`${g.nome}${g.bot ? " 🤖" : ""}`, gx + 46, y)
    if (!g.finished) { ctx.fillStyle = "rgba(248,113,113,0.7)"; ctx.font = "12px 'Space Grotesk', 'Segoe UI', sans-serif"; ctx.textAlign = "right"; ctx.fillText("DNF", gx + 290, y) }
    y += 27
  }
  ctx.textAlign = "left"
  pill(eng, "CORRER DE NOVO  [ENTER]", W / 2 - 230, H - 56, 220, () => correrComBots(eng), { primary: true, h: 42, font: 16 })
  pill(eng, "MENU  [M]", W / 2 + 10, H - 56, 220, () => toMenu(eng), { h: 42, font: 16 })
}

export function tracadoCompleto(eng: AutoDashEngine, cx: number, cy: number, cw: number, ch: number) {
  const pts: { x: number; y: number; c: number }[] = []
  let x = 0, y = 0, h = 0
  const passo = 3
  for (let i = 0; i < eng.segments.length; i += passo) {
    const s = eng.segments[i]
    h += s.curve * 0.0125 * passo
    x += Math.sin(h); y -= Math.cos(h)
    pts.push({ x, y, c: Math.abs(s.curve) })
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
  }
  const esc = Math.min(cw / Math.max(1, maxX - minX), ch / Math.max(1, maxY - minY))
  const offX = cx - ((minX + maxX) / 2) * esc
  const offY = cy - ((minY + maxY) / 2) * esc
  return pts.map(p => ({ x: offX + p.x * esc, y: offY + p.y * esc, c: p.c }))
}

export function renderTrackPreview(eng: AutoDashEngine) {
  const ctx = eng.ctx
  const bw = 420, bh = 300
  const bx = W / 2 - bw / 2, by = 96
  glass(eng, bx - 14, by - 14, bw + 28, bh + 66, 14)
  ctx.textAlign = "center"
  ctx.fillStyle = "#f8fafc"
  ctx.font = "bold 20px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("CONHEÇA O CIRCUITO", W / 2, by + 6)

  const pts = tracadoCompleto(eng, W / 2, by + 26 + bh / 2 - 14, bw - 40, bh - 60)
  // traço grosso escuro por baixo dá contorno e legibilidade
  ctx.strokeStyle = "rgba(2,6,23,0.75)"
  ctx.lineWidth = 11; ctx.lineJoin = "round"; ctx.lineCap = "round"
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
  for (const p of pts) ctx.lineTo(p.x, p.y)
  ctx.closePath(); ctx.stroke()
  // por cima, colorido por severidade: onde dá pra ir com tudo x onde freia
  ctx.lineWidth = 6
  for (let i = 1; i < pts.length; i++) {
    const sev = clamp(pts[i].c / 8, 0, 1)
    ctx.strokeStyle = sev > 0.62 ? "#ef4444" : sev > 0.3 ? "#fbbf24" : "#4ade80"
    ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke()
  }
  // largada
  ctx.fillStyle = "#f8fafc"
  ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 6, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = "#0f172a"
  ctx.font = "bold 10px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("S", pts[0].x, pts[0].y + 3.5)

  // legenda
  const ly = by + bh + 22
  const itens: [string, string][] = [["#4ade80", "acelera"], ["#fbbf24", "atenção"], ["#ef4444", "freia"]]
  let lx = W / 2 - 150
  ctx.textAlign = "left"
  ctx.font = "13px 'Space Grotesk', 'Segoe UI', sans-serif"
  for (const [cor, txt] of itens) {
    ctx.fillStyle = cor
    ctx.fillRect(lx, ly - 8, 18, 5)
    ctx.fillStyle = "rgba(248,250,252,0.8)"
    ctx.fillText(txt, lx + 24, ly - 2)
    lx += 100
  }
  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(248,250,252,0.6)"
  ctx.font = "13px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(`${eng.race?.cfg.voltas ?? 0} voltas`, W / 2, ly + 20)
  ctx.textAlign = "left"
}
