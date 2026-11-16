// AutoDash — render/menus/race.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { toMenu } from "../../flow"
import { AutoDashEngine, W, H, type Seg } from "../../engine"
import { dim } from "./main"
import { arrowBtn, pill, glass } from "../../ui/widgets"
import { CARS, saveConfig } from "../../data"
import { rr, drawPlayerCar } from "../primitives"
import { clamp } from "../../math"
import { correrComBots, abrirCodigoSala, reconhecerPista, sairReconhecimento } from "../../modes/race"
import { ramalNoSeg, type Ramal } from "../../world/ramais"
import { CIRCUITS, montarCircuito, type CircuitoMontado } from "../../world/circuits"
import { biomeById } from "../../world/biomes"
import { HORA_NOME, proximaHora } from "../../world/clock"
import { proximoClima } from "../../world/weather"
import { SEG_LEN, KMH2UPS } from "../../data"

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
  // horário e clima da corrida com bots (ADR 0013). Sala online usa noite + sorteio.
  pill(eng, `horário: ${HORA_NOME[eng.cfg.horaCorrida]} [O]`, W / 2 - 160, 486, 155, () => { eng.cfg.horaCorrida = proximaHora(eng.cfg.horaCorrida); saveConfig(eng.cfg); eng.audio.ui() }, { h: 26, font: 12 })
  pill(eng, `clima: ${eng.cfg.climaCorrida} [K]`, W / 2 + 5, 486, 155, () => { eng.cfg.climaCorrida = proximoClima(eng.cfg.climaCorrida); saveConfig(eng.cfg); eng.audio.ui() }, { h: 26, font: 12 })

  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(248,250,252,0.5)"
  ctx.font = "13px 'Space Grotesk', 'Segoe UI', sans-serif"
  if (eng.raceErro) { ctx.fillStyle = "#f87171"; ctx.fillText(eng.raceErro, W / 2, 470) }
  else ctx.fillText("← → carro · P pista · R reconhecer · ESC menu", W / 2, 470)
  ctx.textAlign = "left"
  renderPainelPista(eng)
}

// montagem do circuito para a prévia do lobby, em cache (é pura e determinística)
const cacheCircuito = new Map<string, CircuitoMontado>()
function circuitoMontado(i: number): CircuitoMontado {
  const def = CIRCUITS[i]
  let m = cacheCircuito.get(def.id)
  if (!m) { m = montarCircuito(def); cacheCircuito.set(def.id, m) }
  return m
}

export function mudarPista(eng: AutoDashEngine, dir: -1 | 1) {
  const n = CIRCUITS.length + 1 // 0 = procedural
  eng.racePista = (eng.racePista + n + dir) % n
  eng.audio.ui()
}

/** Painel da pista escolhida: traçado, extensão, curvas, atalhos e bioma. */
function renderPainelPista(eng: AutoDashEngine) {
  const ctx = eng.ctx
  const px = 690, py = 96, pw = 244, ph = 380
  glass(eng, px, py, pw, ph, 14)
  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(248,250,252,0.5)"
  ctx.font = "bold 10px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("PISTA  [P]", px + pw / 2, py + 22)
  arrowBtn(eng, px + 8, py + 30, -1, () => mudarPista(eng, -1))
  arrowBtn(eng, px + pw - 54, py + 30, 1, () => mudarPista(eng, 1))
  ctx.textAlign = "center" // arrowBtn deixa o alinhamento em "left"
  const def = eng.racePista > 0 ? CIRCUITS[eng.racePista - 1] : null
  ctx.fillStyle = "#f8fafc"
  ctx.font = "bold 16px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(def ? def.nome : "Aleatória", px + pw / 2, py + 58)
  if (!def) {
    ctx.fillStyle = "rgba(248,250,252,0.6)"
    ctx.font = "13px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("Um traçado novo a cada corrida.", px + pw / 2, py + 160)
    ctx.fillText("Sem atalhos. Cidade à noite.", px + pw / 2, py + 182)
    ctx.textAlign = "left"
    return
  }
  const m = circuitoMontado(eng.racePista - 1)
  const pts = tracadoCompleto(eng, px + pw / 2, py + 148, pw - 56, 150, m.segments)
  desenharTracado(eng, pts, 4, m.ramais)
  // estatísticas
  let curvas = 0
  for (let i = 1; i < m.segments.length; i++) {
    if (Math.abs(m.segments[i].curve) >= 4.5 && Math.abs(m.segments[i - 1].curve) < 4.5) curvas++
  }
  const km = (m.segments.length * SEG_LEN) / KMH2UPS / 3600
  ctx.fillStyle = "rgba(248,250,252,0.75)"
  ctx.font = "13px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(`${km.toFixed(2).replace(".", ",")} km · ${curvas} curvas fechadas`, px + pw / 2, py + 252)
  ctx.fillText(`${m.ramais.length} ${m.ramais.length === 1 ? "atalho" : "atalhos"} · ${biomeById(def.bioma).nome}`, px + pw / 2, py + 272)
  ctx.fillStyle = "rgba(248,250,252,0.5)"
  ctx.font = "italic 12px 'Space Grotesk', 'Segoe UI', sans-serif"
  // descrição quebrada em duas linhas
  let l1 = "", l2 = ""
  for (const w of def.descricao.split(" ")) {
    if (!l2 && (l1 + " " + w).trim().length <= 32) l1 = (l1 + " " + w).trim()
    else l2 = (l2 + " " + w).trim()
  }
  ctx.fillText(l1, px + pw / 2, py + 300)
  if (l2) ctx.fillText(l2, px + pw / 2, py + 318)
  ctx.textAlign = "left"
  pill(eng, "RECONHECER  [R]", px + 28, py + 332, pw - 56, () => reconhecerPista(eng), { h: 34, font: 13 })
}

/** Sobrevoo de reconhecimento: nome do trecho, atalho e posição no traçado. */
export function renderRaceRecon(eng: AutoDashEngine) {
  const ctx = eng.ctx
  const N = eng.segments.length
  const idx = Math.floor(eng.position / SEG_LEN) % N
  let trecho = ""
  for (const t of eng.trechos) { if (t.ini <= idx + 40) trecho = t.nome }
  const q = ramalNoSeg(eng.ramais, idx)
  const def = CIRCUITS[eng.racePista - 1]
  glass(eng, W / 2 - 220, 14, 440, 74, 12)
  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(248,250,252,0.5)"
  ctx.font = "bold 11px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(`RECONHECIMENTO · ${(def?.nome ?? "").toUpperCase()}`, W / 2, 34)
  ctx.fillStyle = "#f8fafc"
  ctx.font = "bold 24px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(trecho || "Reta dos Boxes", W / 2, 62)
  if (q) {
    ctx.fillStyle = "#22d3ee"
    ctx.font = "bold 13px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(`ATALHO À ${q.r.lado > 0 ? "DIREITA" : "ESQUERDA"}: ${q.r.nome} (+${Math.round((q.r.ganho - 1) * 100)}%)`, W / 2, 82)
  }
  // minimapa com a posição do sobrevoo
  glass(eng, 16, H - 206, 210, 190, 12)
  const pts = tracadoCompleto(eng, 121, H - 110, 168, 140)
  desenharTracado(eng, pts, 4)
  const alvo = pts.reduce((a, p) => Math.abs(p.i - idx) < Math.abs(a.i - idx) ? p : a, pts[0])
  ctx.fillStyle = "#38bdf8"
  ctx.beginPath(); ctx.arc(alvo.x, alvo.y, 5, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.textAlign = "left"
  pill(eng, "VOLTAR  [ESC]", W - 176, H - 56, 160, () => sairReconhecimento(eng), { primary: true, h: 38, font: 14 })
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

export function tracadoCompleto(eng: AutoDashEngine, cx: number, cy: number, cw: number, ch: number, segs: Seg[] = eng.segments) {
  // `i` (segmento) e `h` (rumo) servem para desenhar ramais e marcar a posição
  const pts: { x: number; y: number; c: number; i: number; h: number }[] = []
  let x = 0, y = 0, h = 0
  const passo = 3
  for (let i = 0; i < segs.length; i += passo) {
    const s = segs[i]
    h += s.curve * 0.0125 * passo
    x += Math.sin(h); y -= Math.cos(h)
    pts.push({ x, y, c: Math.abs(s.curve), i, h })
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
  }
  const esc = Math.min(cw / Math.max(1, maxX - minX), ch / Math.max(1, maxY - minY))
  const offX = cx - ((minX + maxX) / 2) * esc
  const offY = cy - ((minY + maxY) / 2) * esc
  return pts.map(p => ({ x: offX + p.x * esc, y: offY + p.y * esc, c: p.c, i: p.i, h: p.h }))
}

type PontoTracado = ReturnType<typeof tracadoCompleto>[number]

/**
 * Desenha o traçado (colorido por severidade da curva), os ramais em ciano
 * tracejado e a largada. Usado na contagem, no lobby e no reconhecimento.
 */
export function desenharTracado(eng: AutoDashEngine, pts: PontoTracado[], grosso = 6, ramais: Ramal[] = eng.ramais) {
  const ctx = eng.ctx
  // traço grosso escuro por baixo dá contorno e legibilidade
  ctx.strokeStyle = "rgba(2,6,23,0.75)"
  ctx.lineWidth = grosso + 5; ctx.lineJoin = "round"; ctx.lineCap = "round"
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
  for (const p of pts) ctx.lineTo(p.x, p.y)
  ctx.closePath(); ctx.stroke()
  // por cima, colorido por severidade: onde dá pra ir com tudo x onde freia
  ctx.lineWidth = grosso
  for (let i = 1; i < pts.length; i++) {
    const sev = clamp(pts[i].c / 8, 0, 1)
    ctx.strokeStyle = sev > 0.62 ? "#ef4444" : sev > 0.3 ? "#fbbf24" : "#4ade80"
    ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke()
  }
  // ramais (atalhos): linha ciano tracejada ao lado da pista, do lado do ramal
  if (ramais.length) {
    ctx.strokeStyle = "#22d3ee"
    ctx.lineWidth = Math.max(2, grosso * 0.5)
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    let aberto = false
    for (const p of pts) {
      const q = ramalNoSeg(ramais, p.i)
      if (!q || q.p.w <= 0) { aberto = false; continue }
      const off = (grosso * 0.4 + grosso * 1.1 * q.p.f) * q.r.lado
      const px = p.x + Math.cos(p.h) * off, py = p.y + Math.sin(p.h) * off
      if (aberto) ctx.lineTo(px, py); else { ctx.moveTo(px, py); aberto = true }
    }
    ctx.stroke()
    ctx.setLineDash([])
  }
  // largada (quem chama já deixou o textAlign em "center")
  ctx.fillStyle = "#f8fafc"
  ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, grosso, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = "#0f172a"
  ctx.font = "bold 10px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("S", pts[0].x, pts[0].y + 3.5)
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
  desenharTracado(eng, pts)

  // legenda
  const ly = by + bh + 22
  const itens: [string, string][] = [["#4ade80", "acelera"], ["#fbbf24", "atenção"], ["#ef4444", "freia"]]
  if (eng.ramais.length) itens.push(["#22d3ee", "atalho"])
  let lx = W / 2 - (eng.ramais.length ? 200 : 150)
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
