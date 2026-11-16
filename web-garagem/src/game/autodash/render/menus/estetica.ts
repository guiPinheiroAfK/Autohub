// AutoDash — render/menus/estetica.ts. Garagem da Fase 7: aba "estética"
// (bodykit, efeitos, câmera) e a prévia do carro na pista do bioma escolhido.
//
// Funções novas de propósito: renderGarage (menus/main.ts) só chama daqui, para
// o merge com as outras fases ficar fácil. Opções e teclas vêm de uma lista
// só (OPCOES), usada pelo clique, pelo toque e pelo teclado (input/keyboard.ts).
import { AutoDashEngine, W, H } from "../../engine"
import { CARS, PAINTS, WINGS, NEONS, NEON_NAMES, STRIPES, WHEELS, WHEEL_NAMES, saveConfig, type CarCustom } from "../../data"
import { KITS, AROS, ALTURAS, FUMACAS, CHAMAS, idx, proximo, aroDe } from "../../cosmetic/bodykit"
import { leituraPintura } from "../../cosmetic/contraste"
import { pill, glass } from "../../ui/widgets"
import { drawPlayerCar } from "../primitives"
import { skyNow } from "../backdrop"
import { biomeById, proximoBioma } from "../../world/biomes"
import { HORA_NOME, newClock, proximaHora } from "../../world/clock"
import { proximoClima } from "../../world/weather"
import { setClima } from "../../sim/clima"
import { emitEscape, emitFlame } from "../../fx/particles"

export type AbaGaragem = "carro" | "estetica"

const custom = (eng: AutoDashEngine): CarCustom => eng.cfg.customs[eng.cfg.carIdx]

interface Opcao {
  tecla: string
  rotulo: (eng: AutoDashEngine) => string
  acao: (eng: AutoDashEngine) => void
}

// Ordem = ordem na tela (duas colunas). As teclas antigas (G B V R) repetem as
// da aba do carro; as novas não colidem com nenhuma tecla da garagem.
export const OPCOES: Opcao[] = [
  { tecla: "s", rotulo: e => `kit: ${KITS[idx(custom(e).kit, KITS.length)].nome} [S]`, acao: e => { custom(e).kit = proximo(custom(e).kit, KITS.length) } },
  { tecla: "g", rotulo: e => `aerofólio: ${WINGS[custom(e).wing]} [G]`, acao: e => { custom(e).wing = (custom(e).wing + 1) % WINGS.length } },
  { tecla: "w", rotulo: e => `aro: ${aroDe(custom(e)).nome} [W]`, acao: e => { custom(e).aro = proximo(custom(e).aro, AROS.length) } },
  { tecla: "a", rotulo: e => `altura: ${ALTURAS[idx(custom(e).altura, ALTURAS.length)].nome} [A]`, acao: e => { custom(e).altura = proximo(custom(e).altura, ALTURAS.length) } },
  { tecla: "r", rotulo: e => `cor da roda: ${WHEEL_NAMES[custom(e).wheel]} [R]`, acao: e => { custom(e).wheel = (custom(e).wheel + 1) % WHEELS.length } },
  { tecla: "v", rotulo: e => `faixa: ${STRIPES[custom(e).stripe]} [V]`, acao: e => { custom(e).stripe = (custom(e).stripe + 1) % STRIPES.length } },
  { tecla: "b", rotulo: e => `neon por baixo: ${NEON_NAMES[custom(e).neon]} [B]`, acao: e => { custom(e).neon = (custom(e).neon + 1) % NEONS.length } },
  { tecla: "f", rotulo: e => `fumaça do escape: ${FUMACAS[idx(custom(e).fumaca, FUMACAS.length)].nome} [F]`, acao: e => { custom(e).fumaca = proximo(custom(e).fumaca, FUMACAS.length) } },
  { tecla: "q", rotulo: e => `chama do nitro: ${CHAMAS[idx(custom(e).chama, CHAMAS.length)].nome} [Q]`, acao: e => { custom(e).chama = proximo(custom(e).chama, CHAMAS.length) } },
  { tecla: "d", rotulo: e => `câmera: ${e.cfg.camera === "fixa" ? "fixa" : "FOV dinâmico"} [D]`, acao: e => { e.cfg.camera = e.cfg.camera === "fixa" ? "dinamica" : "fixa" } },
]

// ---------- vitrine: presets prontos para comparar rápido (tecla [1]) ----------
// Atalho de teste da customização, no espírito do [Z] do teste de motor: cada
// toque troca o carro inteiro por um visual pronto (a pintura fica a sua), e a
// volta ao início devolve exatamente o que você tinha. Funciona na prévia, para
// comparar contra o bioma.
type Visual = Pick<CarCustom, "stripe" | "neon" | "wing" | "kit" | "aro" | "altura" | "fumaca" | "chama">
export const VITRINE: { nome: string; v: Visual }[] = [
  { nome: "rua limpa", v: { stripe: 0, neon: 0, wing: 1, kit: 0, aro: 1, altura: 1, fumaca: 0, chama: 0 } },
  { nome: "drift JDM", v: { stripe: 3, neon: 2, wing: 2, kit: 1, aro: 2, altura: 2, fumaca: 1, chama: 1 } },
  { nome: "time attack", v: { stripe: 2, neon: 1, wing: 3, kit: 3, aro: 3, altura: 1, fumaca: 2, chama: 2 } },
  { nome: "neon noturno", v: { stripe: 1, neon: 4, wing: 0, kit: 2, aro: 1, altura: 2, fumaca: 4, chama: 3 } },
]
// estado da vitrine por engine: índice atual (-1 = o seu) e o seu visual guardado
const vitrine = new WeakMap<AutoDashEngine, { i: number; seu: Visual; carro: number }>()

function visualDe(c: CarCustom): Visual {
  return { stripe: c.stripe, neon: c.neon, wing: c.wing, kit: c.kit, aro: c.aro, altura: c.altura, fumaca: c.fumaca, chama: c.chama }
}

/** Nome do visual da vitrine em uso ("o seu" fora dela). */
export function nomeVitrine(eng: AutoDashEngine): string {
  const st = vitrine.get(eng)
  return st && st.i >= 0 && st.carro === eng.cfg.carIdx ? VITRINE[st.i].nome : "o seu"
}

/** Próximo visual da vitrine; depois do último, volta ao seu. */
export function proximaVitrine(eng: AutoDashEngine) {
  const c = custom(eng)
  let st = vitrine.get(eng)
  if (!st || st.carro !== eng.cfg.carIdx || st.i < 0) st = { i: -1, seu: visualDe(c), carro: eng.cfg.carIdx }
  st.i = st.i + 1 >= VITRINE.length ? -1 : st.i + 1
  Object.assign(c, st.i < 0 ? st.seu : VITRINE[st.i].v)
  vitrine.set(eng, st)
  saveConfig(eng.cfg)
  eng.audio.ui()
}

function aplicar(eng: AutoDashEngine, o: Opcao) {
  o.acao(eng)
  saveConfig(eng.cfg)
  eng.audio.ui()
}

/** Pills das abas, no canto de cima à direita (as duas abas mostram). */
export function abasGaragem(eng: AutoDashEngine) {
  const est = eng.abaGaragem === "estetica"
  pill(eng, "carro", 700, 22, 100, () => { eng.abaGaragem = "carro"; eng.audio.ui() }, { h: 28, font: 12, primary: !est })
  pill(eng, "estética  [H]", 808, 22, 134, () => { eng.abaGaragem = "estetica"; eng.audio.ui() }, { h: 28, font: 12, primary: est })
}

/** Painel da aba estética (dentro do vidro da garagem, x inicial `sx`). */
export function renderAbaEstetica(eng: AutoDashEngine, sx: number) {
  const ctx = eng.ctx
  const c = custom(eng)
  ctx.fillStyle = "rgba(248,250,252,0.9)"
  ctx.font = "bold 13px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("ESTÉTICA", sx, 94)
  ctx.fillStyle = "rgba(248,250,252,0.5)"
  ctx.font = "11px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("só visual: nada aqui muda a física do carro", sx + 74, 94)

  // pintura
  ctx.fillStyle = "rgba(248,250,252,0.75)"
  ctx.font = "bold 11px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("PINTURA [C]", sx, 120)
  for (let i = 0; i < PAINTS.length; i++) {
    const cxp = sx + 10 + i * 26, cyp = 138
    ctx.fillStyle = PAINTS[i]
    ctx.beginPath(); ctx.arc(cxp, cyp, 9, 0, Math.PI * 2); ctx.fill()
    if (i === c.paint) {
      ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(cxp, cyp, 12, 0, Math.PI * 2); ctx.stroke()
    }
    eng.uiRegions.push({ x: cxp - 12, y: cyp - 12, w: 24, h: 24, act: () => { c.paint = i; saveConfig(eng.cfg); eng.audio.ui() } })
  }

  // aros: ícone de frente (raios), clicáveis
  ctx.fillStyle = "rgba(248,250,252,0.75)"
  ctx.fillText("ARO [W]", sx + 290, 120)
  for (let i = 0; i < AROS.length; i++) {
    const cxp = sx + 300 + i * 34, cyp = 138
    iconeAro(ctx, cxp, cyp, 12, i, WHEELS[c.wheel])
    if (i === idx(c.aro, AROS.length)) {
      ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(cxp, cyp, 15, 0, Math.PI * 2); ctx.stroke()
    }
    eng.uiRegions.push({ x: cxp - 15, y: cyp - 15, w: 30, h: 30, act: () => { c.aro = i; saveConfig(eng.cfg); eng.audio.ui() } })
  }

  // opções em duas colunas
  OPCOES.forEach((o, i) => {
    const x = sx + (i % 2) * 216, y = 166 + Math.floor(i / 2) * 36
    pill(eng, o.rotulo(eng), x, y, 200, () => aplicar(eng, o), { h: 28, font: 11 })
  })

  pill(eng, `vitrine: ${nomeVitrine(eng)}  [1]  · visuais prontos para comparar`, sx, 344, 416, () => proximaVitrine(eng), { h: 28, font: 11 })

  // leitura da pintura na cena de trás da garagem
  const amb = skyNow(eng).amb
  const lp = leituraPintura(PAINTS[c.paint], amb)
  ctx.fillStyle = lp.nota === "some" ? "#f87171" : lp.nota === "fraca" ? "#fbbf24" : "#4ade80"
  ctx.font = "12px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(`pintura no asfalto desta cena: ${lp.razao.toFixed(1).replace(".", ",")}:1 (${notaTexto(lp.nota)})`, sx, 390)

  pill(eng, "VER NA PISTA  [P]", sx, 400, 416, () => entrarPrevia(eng), { primary: true, h: 34, font: 15 })
  ctx.fillStyle = "rgba(248,250,252,0.5)"
  ctx.font = "11px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("o carro no tamanho do jogo, no bioma, horário e clima escolhidos", sx, 446)
  ctx.fillText("bioma [X] · horário [O] · clima [K] trocam a cena da prévia", sx, 464)
  ctx.fillText("os rivais online veem só a sua pintura (por enquanto)", sx, 482)
}

function notaTexto(n: "some" | "fraca" | "ok" | "destaca"): string {
  return n === "some" ? "some no asfalto" : n === "fraca" ? "pouco contraste" : n === "ok" ? "boa leitura" : "destaca muito"
}

/** Ícone do aro visto de frente (garagem): raios, ou disco fechado no turbofan. */
export function iconeAro(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, i: number, cor: string) {
  const aro = AROS[i]
  ctx.fillStyle = "#0a0a0c"
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = cor
  const ra = r * (0.62 + aro.aba * 5)
  ctx.beginPath(); ctx.arc(x, y, ra, 0, Math.PI * 2); ctx.fill()
  // contorno claro: aro preto sobre pneu preto também tem que aparecer
  ctx.strokeStyle = "rgba(203,213,225,0.55)"; ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = "#0a0a0c"
  if (aro.raios === 0) {
    // turbofan: aletas curtas em volta do miolo
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2
      ctx.fillRect(x + Math.cos(a) * ra * 0.55 - 0.75, y + Math.sin(a) * ra * 0.55 - 0.75, 1.5, 1.5)
    }
  } else {
    // vãos entre os raios
    for (let k = 0; k < aro.raios; k++) {
      const a = (k / aro.raios) * Math.PI * 2 + Math.PI / aro.raios
      ctx.beginPath()
      ctx.arc(x + Math.cos(a) * ra * 0.55, y + Math.sin(a) * ra * 0.55, ra * (aro.raios > 6 ? 0.16 : 0.24), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.fillStyle = aro.pinca ? "#dc2626" : "#52525b"
  ctx.beginPath(); ctx.arc(x, y, ra * 0.2, 0, Math.PI * 2); ctx.fill()
}

// ---------- prévia na pista ----------

/** Faz a cena de trás da garagem seguir bioma, horário e clima escolhidos. */
export function aplicarCenaPrevia(eng: AutoDashEngine) {
  if (eng.bioma.id !== eng.cfg.biome) eng.bioma = biomeById(eng.cfg.biome)
  if (eng.horaModo !== eng.cfg.hora) { eng.clock = newClock(eng.cfg.hora); eng.horaModo = eng.cfg.hora }
  setClima(eng, eng.cfg.clima === "sorteio" ? "limpo" : eng.cfg.clima)
}

export function entrarPrevia(eng: AutoDashEngine) {
  eng.previaPista = true
  // a corrida pode ter deixado o modo "race" (céu neon fixo à noite); a prévia
  // mostra a cena do solo, que é onde as escolhas da garagem valem
  eng.mode = "solo"
  aplicarCenaPrevia(eng)
  eng.audio.ui()
}

export function sairPrevia(eng: AutoDashEngine) {
  eng.previaPista = false
  setClima(eng, "limpo") // para a chuva (e o som dela) fora da prévia
  eng.audio.ui()
}

/** Tela da prévia: sem painel, o carro no lugar e no tamanho de quando se dirige. */
export function renderPreviaPista(eng: AutoDashEngine) {
  aplicarCenaPrevia(eng)
  const ctx = eng.ctx
  const spec = CARS[eng.cfg.carIdx]
  const c = custom(eng)
  const amb = skyNow(eng).amb
  drawPlayerCar(ctx, W / 2, H - 34, spec, c, 0, eng.keys.has("s"), amb, eng.keys.has(" "))
  // efeitos ao vivo: [espaço] solta a chama, [W] acelera e solta fumaça
  if (eng.keys.has(" ")) emitFlame(eng)
  if (eng.keys.has("w") && Math.random() < 0.5) emitEscape(eng, 1, "#64748b")

  const lp = leituraPintura(PAINTS[c.paint], amb)
  glass(eng, 16, 16, 430, 92, 12)
  ctx.fillStyle = "#f8fafc"
  ctx.font = "bold 15px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText(`PRÉVIA · ${spec.name}`, 30, 40)
  ctx.font = "12px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillStyle = "rgba(248,250,252,0.75)"
  ctx.fillText(`${eng.bioma.nome} · ${HORA_NOME[eng.cfg.hora]} · ${eng.clima}`, 30, 60)
  ctx.fillStyle = lp.nota === "some" ? "#f87171" : lp.nota === "fraca" ? "#fbbf24" : "#4ade80"
  ctx.fillText(`pintura no asfalto: ${lp.razao.toFixed(1).replace(".", ",")}:1 — ${notaTexto(lp.nota)}`, 30, 78)
  ctx.fillStyle = "rgba(248,250,252,0.55)"
  ctx.font = "11px 'Space Grotesk', 'Segoe UI', sans-serif"
  ctx.fillText("segure [espaço] para a chama · [W] para a fumaça · [S] freio", 30, 97)

  const y = H - 46
  pill(eng, "voltar [P]", 16, y, 110, () => sairPrevia(eng), { h: 30, font: 12 })
  pill(eng, "pintura [C]", 134, y, 110, () => { c.paint = (c.paint + 1) % PAINTS.length; saveConfig(eng.cfg); eng.audio.ui() }, { h: 30, font: 12 })
  pill(eng, `vitrine: ${nomeVitrine(eng)} [1]`, 252, y, 170, () => proximaVitrine(eng), { h: 30, font: 12 })
  pill(eng, `bioma [X]`, W - 362, y, 110, () => { eng.cfg.biome = proximoBioma(eng.cfg.biome); saveConfig(eng.cfg); eng.audio.ui() }, { h: 30, font: 12 })
  pill(eng, `horário [O]`, W - 244, y, 110, () => { eng.cfg.hora = proximaHora(eng.cfg.hora); saveConfig(eng.cfg); eng.audio.ui() }, { h: 30, font: 12 })
  pill(eng, `clima [K]`, W - 126, y, 110, () => { eng.cfg.clima = proximoClima(eng.cfg.clima); saveConfig(eng.cfg); eng.audio.ui() }, { h: 30, font: 12 })
}

/**
 * Teclas da garagem da Fase 7. Devolve true se tratou a tecla (o chamador
 * então não repassa para as teclas antigas da garagem).
 */
export function teclaEstetica(eng: AutoDashEngine, k: string): boolean {
  if (eng.previaPista) {
    if (k === "p" || k === "escape") { sairPrevia(eng); return true }
    if (k === "enter") { eng.previaPista = false; return false } // larga normalmente
    if (k === "w" || k === "s" || k === " ") return true // aceleram e freiam a prévia
    if (k === "1") { proximaVitrine(eng); return true }
    return false
  }
  if (k === "h") { eng.abaGaragem = eng.abaGaragem === "estetica" ? "carro" : "estetica"; eng.audio.ui(); return true }
  if (k === "p") { entrarPrevia(eng); return true }
  if (k === "1") { proximaVitrine(eng); return true }
  // teclas novas valem nas duas abas; as antigas seguem no fluxo de sempre
  const o = OPCOES.find(op => op.tecla === k && "swaqfd".includes(k))
  if (o) { aplicar(eng, o); return true }
  return false
}
