// AutoDash — world/regiao.ts. O bioma muda ao longo da partida (Fase 8.5).
//
// Playtest 16/11: "as regiões às vezes ficam muito curtas". Antes trocava a cada
// 3 níveis, e o nível sobe pelos pontos (combo, racha e touge davam pontos de
// uma vez: a região durava pouquíssimo). Agora a região dura uma DISTÂNCIA
// (REGIAO.km), e a ordem é a viagem de 24 h da bíblia de cenários: cidade (noite)
// → rodovia → serra → praia (costa) → cidade. A serra é a viagem da montanha
// (world/montanha.ts) e acaba sozinha, na praia.
//
// Na troca, céu e fundo mudam aos poucos, o cenário na tela fica até o
// horizonte, e as curvas FORA da tela são reescaladas pelo traçado do bioma novo.
// Os morros ficam: mudar a altura de segmento já construído quebraria o relevo.
import { type AutoDashEngine, H } from "../engine"
import { DRAW_DIST, SEG_LEN } from "../data"
import { biomeById } from "./biomes"
import { gerarTrechos, tipoNoSeg } from "./cenario"
import { spawnMontanha, esquecerMontanha, aplanarSerraPassada } from "./montanha"

export const REGIAO = {
  km: 9,           // km rodados em cada região (a ~180 km/h, uns 3 minutos)
  ordem: ["cidade", "rodovia", "serra", "costa"],
  manterSegs: 60,  // segmentos além do horizonte em que o cenário de antes continua
}

/** A próxima região da viagem. */
export function proximaRegiao(id: string): string {
  const i = REGIAO.ordem.indexOf(id)
  return REGIAO.ordem[(i + 1) % REGIAO.ordem.length]
}

/** Troca para a próxima região (ou `id`). Só faz sentido no solo. */
export function trocarRegiao(eng: AutoDashEngine, id?: string, comMontanha = true) {
  const atual = eng.bioma
  const nova = biomeById(id ?? proximaRegiao(atual.id))
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
  eng.kmRegiao = 0
  eng.cenario = gerarTrechos(N, eng.pistaSeed, nova.id)
  const fim = Math.min(N, base + DRAW_DIST + REGIAO.manterSegs)
  if (base < fim) eng.cenario.unshift({ a: base, b: fim, tipo: tipoAqui })
  // a montanha é da serra: saindo dela, acaba a neblina imposta; chegando, ela abre à frente
  esquecerMontanha(eng)
  eng.climaForcado = null
  if (nova.id === "serra" && comMontanha) spawnMontanha(eng)
  eng.floaters.push({ text: `NOVA REGIÃO: ${nova.nome.toUpperCase()}`, color: "#38bdf8", y: H * 0.26, life: 2.4, big: true })
  eng.audio.ui()
}

/**
 * Um quadro (solo): soma a distância e troca de região quando ela acaba. Na
 * serra, a viagem segura a região até a praia (e, se a montanha não coube ainda
 * por estar perto do fim da volta, tenta de novo).
 */
export function regiaoPorDistancia(eng: AutoDashEngine, dt: number) {
  if (eng.mode !== "solo" || eng.testeMotor || eng.state !== "racing") return
  aplanarSerraPassada(eng) // o relevo da serra que já passou não volta na próxima volta
  eng.kmRegiao += eng.speed * dt / 3600
  if (eng.bioma.id === "serra") {
    if (!eng.montanha) spawnMontanha(eng)
    return // a serra acaba na praia (world/montanha.ts troca para a costa)
  }
  if (eng.kmRegiao >= REGIAO.km) trocarRegiao(eng)
}
