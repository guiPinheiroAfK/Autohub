// AutoDash — render/serra.ts. Efeitos de tela da viagem da serra (world/montanha.ts).
//
// Respingo da cachoeira: passando rente ao paredão onde a água cai, o vento
// joga gotas no "para-brisa" (a câmera). Gotas translúcidas em posições fixas
// por índice (sem sorteio por quadro), um véu de névoa leve, e tudo some junto
// com `eng.respingoT`. Escorrem um pouco para baixo enquanto somem.
import { type AutoDashEngine, W, H } from "../engine"
import { hash01 } from "../world/cenario"
import { MOMENTOS_SERRA } from "../world/montanha"
import { climaAtual } from "../sim/clima"

const GOTAS = 22
const GOTAS_NEVOA = 26

/**
 * Gotinhas de névoa no "para-brisa" enquanto a neblina enche (qualquer região, não só a
 * serra). Posições fixas por índice, escorrendo devagar; a quantidade e o brilho seguem a
 * névoa em vigor (misturada na troca de clima).
 */
export function drawGotasDeNevoa(eng: AutoDashEngine) {
  if (eng.dentroTunel) return
  const k = 1 - climaAtual(eng).visib
  if (k < 0.25) return // só neblina de verdade (nublado e chuva não têm)
  const a = Math.min(1, (k - 0.25) / 0.3)
  const ctx = eng.ctx
  const n = Math.round(GOTAS_NEVOA * a)
  ctx.save()
  for (let i = 0; i < n; i++) {
    const x = hash01(i, 81) * W
    const r = 3 + hash01(i, 82) * 9
    // escorre devagar e volta ao topo (cada gota com a sua fase)
    const y = ((hash01(i, 83) * H * 0.9 + eng.camT * (4 + hash01(i, 84) * 7)) % (H * 0.92)) + 4
    ctx.fillStyle = `rgba(215,232,248,${0.2 * a})`
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = `rgba(120,150,180,${0.22 * a})`
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke()
    ctx.fillStyle = `rgba(255,255,255,${0.45 * a})`
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, Math.max(1, r * 0.2), 0, Math.PI * 2); ctx.fill()
    if (i % 4 === 0) { ctx.fillStyle = `rgba(215,232,248,${0.1 * a})`; ctx.fillRect(x - r * 0.12, y - 14 - r, r * 0.24, 14 + r) }
  }
  ctx.restore()
}

/** Gotas da cachoeira na tela; não desenha nada com `respingoT` zerado. */
export function drawRespingos(eng: AutoDashEngine) {
  if (eng.respingoT <= 0) return
  const ctx = eng.ctx
  const a = Math.min(1, eng.respingoT / MOMENTOS_SERRA.respingoS)
  const escorre = 1 - a // 0 quando acabou de molhar, 1 quando secou
  ctx.save()
  // véu de água no ar
  ctx.fillStyle = `rgba(226,240,255,${0.1 * a})`
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < GOTAS; i++) {
    const x = hash01(i, 71) * W
    const r = 4 + hash01(i, 72) * 12
    const y = hash01(i, 73) * H * 0.85 + escorre * (10 + r * 2.5)
    // a gota: corpo claro, borda mais escura embaixo e o brilho em cima
    ctx.fillStyle = `rgba(210,230,250,${0.22 * a})`
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (1 + escorre * 0.5), 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = `rgba(120,150,180,${0.25 * a})`
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke()
    ctx.fillStyle = `rgba(255,255,255,${0.5 * a})`
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, Math.max(1, r * 0.22), 0, Math.PI * 2); ctx.fill()
    // rastro de quem escorreu
    if (escorre > 0.1 && i % 3 === 0) {
      ctx.fillStyle = `rgba(210,230,250,${0.14 * a})`
      ctx.fillRect(x - r * 0.15, y - escorre * (10 + r * 2.5), r * 0.3, escorre * (10 + r * 2.5))
    }
  }
  ctx.restore()
}
