// AutoDash — render/avisos.ts. Cartões de aviso dos eventos (world/avisos.ts).
// Ficam à esquerda, embaixo do placar: longe do centro (onde está o perigo) e
// do painel do racha. Cor pelo tipo: âmbar = perigo (paleta 1.8), vermelho e
// azul = polícia, verde = informação (ponte, posto).
import { type AutoDashEngine, PLAYER_Z } from "../engine"
import { glass } from "../ui/widgets"
import { rr } from "./primitives"
import { clamp } from "../math"
import { AVISO, distancias, segundosAte, type Aviso } from "../world/avisos"
import { PERIGO, piscaAlerta } from "./eventos"

const X = 14, Y = 84, LARG = 262, ALT = 56, VAO = 8
const FONTE = "'Space Grotesk', 'Segoe UI', sans-serif"

function corDo(a: Aviso): string {
  if (a.nivel === "policia") return piscaAlerta() ? "#ef4444" : "#3b82f6"
  return a.nivel === "info" ? "#4ade80" : PERIGO.ambar
}

const suave = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3)

export function renderAvisos(eng: AutoDashEngine) {
  if (eng.avisos.length === 0 || eng.mode !== "solo") return
  const ctx = eng.ctx
  const playerZ = eng.position + PLAYER_Z
  let y = Y
  for (const a of eng.avisos) {
    const entra = suave(a.t / AVISO.entradaS)
    const sai = a.saindo >= 0 ? suave(a.saindo / AVISO.saidaS) : 0
    const x = X - (1 - entra) * (LARG + 20) - sai * (LARG + 20)
    ctx.globalAlpha = 1 - sai
    const { ate, fim } = distancias(eng, a, playerZ)
    const dentro = ate <= 0 && fim !== null
    const s = segundosAte(eng, dentro ? Math.max(0, fim!) : Math.max(0, ate))
    const agora = !dentro && s < AVISO.agoraS
    const cor = corDo(a)

    glass(eng, x, y, LARG, ALT, 10)
    // faixa de cor à esquerda (pisca quando está chegando)
    ctx.fillStyle = agora && !piscaAlerta() ? PERIGO.branco : cor
    rr(ctx, x + 4, y + 6, 4, ALT - 12, 2)

    ctx.font = `22px ${FONTE}`
    ctx.textAlign = "center"
    ctx.fillStyle = "#f8fafc"
    ctx.fillText(a.icone, x + 30, y + 30)
    ctx.textAlign = "left"
    ctx.font = `bold 15px ${FONTE}`
    ctx.fillStyle = cor
    ctx.fillText(a.titulo, x + 50, y + 22)
    ctx.font = `12px ${FONTE}`
    ctx.fillStyle = "rgba(248,250,252,0.75)"
    ctx.fillText(a.dica, x + 50, y + 39)

    // quanto falta: segundos até chegar, "AGORA" piscando, ou o que resta do trecho
    ctx.textAlign = "right"
    ctx.font = `bold 14px ${FONTE}`
    if (agora) {
      ctx.fillStyle = piscaAlerta() ? PERIGO.pisca : PERIGO.branco
      ctx.fillText("AGORA", x + LARG - 10, y + 22)
    } else {
      ctx.fillStyle = "rgba(248,250,252,0.9)"
      ctx.fillText(dentro ? `fim ${Math.ceil(s)} s` : `${Math.ceil(s)} s`, x + LARG - 10, y + 22)
    }
    ctx.textAlign = "left"

    // barra: enche até o começo do evento; dentro do trecho, esvazia até o fim
    const p = dentro
      ? clamp(Math.max(0, fim!) / (a.trecho0 ?? Math.max(1, fim!)), 0, 1)
      : clamp(1 - ate / a.dist0, 0, 1)
    const bx = x + 50, bw = LARG - 62, by = y + ALT - 9
    ctx.fillStyle = "rgba(148,163,184,0.25)"
    ctx.fillRect(bx, by, bw, 3)
    ctx.fillStyle = cor
    ctx.fillRect(bx, by, bw * p, 3)

    ctx.globalAlpha = 1
    y += (ALT + VAO) * (1 - sai)
  }
}
