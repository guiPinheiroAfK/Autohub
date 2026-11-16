// AutoDash — world/regiao.ts. O bioma muda ao longo da partida (Fase 8.5).
//
// A cada REGIAO.cadaNiveis níveis no solo a região troca (cidade → costa →
// serra → rodovia → ...): céu, fundo, árvore, trechos de cenário e climas. O
// traçado também muda: as curvas da pista FORA da tela são reescaladas pelo
// traçado do bioma novo (as que você está vendo ficam como estão, sem pulo).
// Os morros ficam: mudar a altura de segmento já construído quebraria o relevo.
import { type AutoDashEngine, H } from "../engine"
import { DRAW_DIST, SEG_LEN } from "../data"
import { biomeById, proximoBioma } from "./biomes"
import { gerarTrechos, tipoNoSeg } from "./cenario"

export const REGIAO = {
  cadaNiveis: 3, // troca de região a cada 3 níveis (nível 4, 7, 10...)
  manterSegs: 60, // segmentos além do horizonte em que o cenário de antes continua
}

/** Troca para a próxima região (ou `id`). Só faz sentido no solo. */
export function trocarRegiao(eng: AutoDashEngine, id?: string) {
  const atual = eng.bioma
  const nova = biomeById(id ?? proximoBioma(atual.id))
  if (nova.id === atual.id) return
  const k = (nova.tracado?.curva ?? 1) / (atual.tracado?.curva ?? 1)
  const N = eng.segments.length
  const base = Math.floor(eng.position / SEG_LEN)
  if (k !== 1) for (let i = DRAW_DIST + 10; i < N - 10; i++) eng.segments[(base + i) % N].curve *= k
  // o tipo de beira que está na tela continua até sair de vista (o bioma novo
  // só começa depois do horizonte); o céu e o fundo mudam aos poucos
  const tipoAqui = tipoNoSeg(eng.cenario, base % N)
  eng.biomaAnt = atual
  eng.biomaMix = 0
  eng.bioma = nova
  eng.cenario = gerarTrechos(N, eng.pistaSeed, nova.id)
  const fim = Math.min(N, base + DRAW_DIST + REGIAO.manterSegs)
  if (base < fim) eng.cenario.unshift({ a: base, b: fim, tipo: tipoAqui })
  eng.floaters.push({ text: `NOVA REGIÃO: ${nova.nome.toUpperCase()}`, color: "#38bdf8", y: H * 0.26, life: 2.4, big: true })
  eng.audio.ui()
}

/** Chamado na virada de nível: troca de região a cada REGIAO.cadaNiveis. */
export function regiaoNaVirada(eng: AutoDashEngine, nivel: number) {
  if (eng.mode !== "solo" || eng.testeMotor) return
  if (nivel > 0 && nivel % REGIAO.cadaNiveis === 0) trocarRegiao(eng)
}
