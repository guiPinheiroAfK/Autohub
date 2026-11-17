// AutoDash — world/roteiro-teste.ts. Roteiro de playtest: pausa [P] e depois [3].
//
// Roda em sequência, sozinho, tudo o que o jogo tem (eventos de mapa, cada região
// encurtada, a serra curta com o duelo e a serra completa com túnel e viaduto),
// para conferir a pista inteira numa tacada só. O trânsito natural e o sorteio
// de eventos ficam desligados (os eventos vêm um por vez, na ordem), o carro fica
// imune a batida e o tanque cheio. [P] [3] de novo cancela; [ ] ] pula o passo.
import { type AutoDashEngine, H, PLAYER_Z } from "../engine"
import { wrapDz } from "../traffic/spawner"
import { spawnEvent, type EventoMapa } from "./events"
import { spawnPosto } from "./posto"
import { convidarRacha } from "../modes/racha"
import { trocarRegiao } from "./regiao"
import { spawnMontanha, esquecerMontanha } from "./montanha"

interface Passo {
  nome: string
  /** Começa o passo. Devolve false se não coube agora (o passo é pulado). */
  inicia: (eng: AutoDashEngine) => boolean | void
  /** Espera mínima (s) antes de poder terminar. */
  minS: number
  /** Teto (s): passado dele o roteiro segue de qualquer jeito. */
  maxS: number
  /** Fim extra além de "sem evento à frente". Sem isto, vale só o evento acabar. */
  fim?: (eng: AutoDashEngine) => boolean
}

export interface RoteiroTeste {
  i: number
  t: number
  passos: Passo[]
}

const evento = (nome: string, kind: EventoMapa, minS = 4): Passo =>
  ({ nome, inicia: eng => { spawnEvent(eng, kind) }, minS, maxS: 120 })

const regiao = (nome: string, id: string, s = 10): Passo => ({
  nome,
  inicia: eng => { trocarRegiao(eng, id, false) },
  minS: s,
  maxS: s,
  fim: () => true,
})

/** Passos do roteiro, na ordem: eventos de mapa, regiões encurtadas, serra curta e serra completa. */
function montarPassos(): Passo[] {
  const naPraia = (eng: AutoDashEngine) => eng.bioma.id === "costa" && !eng.touge
  return [
    { nome: "POSTO", inicia: eng => { eng.combustivel = 0.4; return spawnPosto(eng) }, minS: 6, maxS: 60 },
    { nome: "CONVITE DE RACHA", inicia: eng => convidarRacha(eng), minS: 10, maxS: 40, fim: eng => !eng.racha },
    evento("OBRA", "obra"),
    evento("COMBOIO", "comboio", 12),
    evento("ÓLEO NA PISTA", "oleo", 8),
    evento("OBSTÁCULOS (CONES)", "obstacles", 14),
    evento("MÃO DUPLA", "wrongway"),
    evento("BLITZ", "blitz"),
    evento("RADAR", "speedtrap"),
    evento("PONTE", "bridge"),
    evento("VIADUTO COM ELEVADO", "viaduct"),
    evento("TÚNEL", "tunnel"),
    regiao("REGIÃO: CIDADE", "cidade"),
    regiao("REGIÃO: RODOVIA", "rodovia"),
    {
      nome: "SERRA CURTA + DUELO",
      inicia: eng => {
        trocarRegiao(eng, "serra", false)
        esquecerMontanha(eng)
        return spawnMontanha(eng, true)
      },
      minS: 5, maxS: 240, fim: naPraia,
    },
    regiao("REGIÃO: COSTA (SAÍDA DA SERRA)", "costa", 12),
    regiao("REGIÃO: CIDADE", "cidade", 6),
    {
      nome: "SERRA COMPLETA: TÚNEL, VIADUTO E DUELO",
      inicia: eng => { trocarRegiao(eng, "serra", true) },
      minS: 5, maxS: 600, fim: naPraia,
    },
  ]
}

export function roteiroAtivo(eng: AutoDashEngine): boolean {
  return eng.roteiro !== null
}

/** [P] [3]: liga o roteiro (ou desliga, se já estava rodando). Só no solo. */
export function alternarRoteiro(eng: AutoDashEngine) {
  if (eng.roteiro) { encerrar(eng, "ROTEIRO DE TESTE CANCELADO"); return }
  if (eng.mode !== "solo" || eng.testeMotor || eng.testePolicia) return
  eng.roteiro = { i: -1, t: 0, passos: montarPassos() }
  // começa limpo: sem evento ou obstáculo antigo à frente
  eng.zones = []; eng.obstacles = []; eng.roadSigns = []; eng.ramais = []
  eng.traffic = eng.traffic.filter(t => wrapDz(eng, t.z, eng.position + PLAYER_Z) < -2000)
  eng.eventTimer = 1e9
  eng.floaters.push({ text: "ROTEIRO DE TESTE: [ ] ] pula o passo, [P][3] cancela", color: "#38bdf8", y: H * 0.45, life: 3, big: false })
  proximoPasso(eng)
}

/** [ ] ] durante o roteiro: pula o passo atual. */
export function pularPasso(eng: AutoDashEngine) {
  if (eng.roteiro) proximoPasso(eng)
}

function encerrar(eng: AutoDashEngine, msg: string) {
  eng.roteiro = null
  eng.eventTimer = 12
  eng.floaters.push({ text: msg, color: "#38bdf8", y: H * 0.4, life: 2.6, big: true })
}

function proximoPasso(eng: AutoDashEngine) {
  const r = eng.roteiro
  if (!r) return
  // passos que não couberam agora (início devolve false) são pulados
  for (;;) {
    r.i++
    r.t = 0
    if (r.i >= r.passos.length) { encerrar(eng, "ROTEIRO COMPLETO"); return }
    const p = r.passos[r.i]
    eng.floaters.push({ text: `TESTE ${r.i + 1}/${r.passos.length}: ${p.nome}`, color: "#38bdf8", y: H * 0.34, life: 2.4, big: true })
    if (p.inicia(eng) !== false) return
    eng.floaters.push({ text: `${p.nome}: não coube agora, pulado`, color: "#94a3b8", y: H * 0.5, life: 1.6, big: false })
  }
}

/** Um quadro (solo, correndo): mantém o carro seguro e avança o roteiro quando o passo acaba. */
export function atualizarRoteiro(eng: AutoDashEngine, dt: number, playerZ: number) {
  const r = eng.roteiro
  if (!r) return
  if (eng.mode !== "solo" || eng.crashed) { eng.roteiro = null; return }
  eng.immuneT = Math.max(eng.immuneT, 0.6)
  eng.eventTimer = 1e9 // o sorteio natural espera o roteiro
  const p = r.passos[r.i]
  if (p.nome !== "POSTO") eng.combustivel = 1
  r.t += dt
  if (r.t < p.minS) return
  const eventoRolando = eng.zones.some(z => wrapDz(eng, z.end, playerZ) > 0) || eng.avisos.some(a => a.saindo < 0)
  const acabou = r.t >= p.maxS || (p.fim ? p.fim(eng) : !eventoRolando)
  if (acabou) proximoPasso(eng)
}
