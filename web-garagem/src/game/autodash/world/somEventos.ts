// AutoDash — world/somEventos.ts. Sons curtos dos eventos (Fase 8.3): a
// britadeira perto da obra, a buzina a ar do comboio quando você encosta nele e
// a sirene curta na aproximação da blitz. Só no solo.
import { type AutoDashEngine } from "../engine"
import { wrapDz } from "../traffic/spawner"
import { hash01 } from "./cenario"

export const SOM_EVENTOS = {
  britadeiraAte: 9000,  // u: a britadeira se ouve até esta distância da obra
  sireneAntes: 9000,    // u antes da blitz em que a sirene toca (uma vez)
  comboioPerto: 3200,   // u atrás de um caminhão do comboio: buzina (uma vez por comboio)
}

let proxBritadeira = 0

/** Um quadro: decide que som de evento toca agora. */
export function atualizarSomEventos(eng: AutoDashEngine, dt: number, playerZ: number) {
  if (eng.mode !== "solo") return
  proxBritadeira -= dt
  for (const zn of eng.zones) {
    const ini = wrapDz(eng, zn.z, playerZ), fim = wrapDz(eng, zn.end, playerZ)
    if (zn.type === "obra" && fim > -SOM_EVENTOS.britadeiraAte && ini < SOM_EVENTOS.britadeiraAte && proxBritadeira <= 0) {
      const dist = ini > 0 ? ini : fim < 0 ? -fim : 0
      eng.audio.britadeira(1 - Math.min(1, dist / SOM_EVENTOS.britadeiraAte))
      // sem Math.random: o replay determinístico usa o mesmo gerador do trânsito
      proxBritadeira = 0.5 + hash01(Math.floor(eng.somT * 10), 3) * 0.9
    }
    if (zn.type === "blitz" && !zn.somFeito && ini > 0 && ini < SOM_EVENTOS.sireneAntes) {
      zn.somFeito = true
      eng.audio.sireneCurta()
    }
  }
  const c = eng.comboio
  if (c && !c.buzinou) {
    for (const m of c.membros) {
      const d = wrapDz(eng, m.z, playerZ)
      if (d > 0 && d < SOM_EVENTOS.comboioPerto) { c.buzinou = true; eng.audio.buzinaCaminhao(); break }
    }
  }
}
