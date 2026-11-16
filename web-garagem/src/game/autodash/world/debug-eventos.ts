// AutoDash — world/debug-eventos.ts. Teclas de playtest dos eventos da Fase 5
// (só no solo, correndo). Ficam ativas, como as outras de debug (GUIA, seção 3).
import { type AutoDashEngine, H } from "../engine"
import { COMBUSTIVEL } from "./combustivel"
import { saveConfig } from "../data"
import { startRace } from "../modes/race"
import { spawnPosto } from "./posto"
import { convidarRacha } from "../modes/racha"
import { spawnEvent } from "./events"
import { trocarRegiao } from "./regiao"

/**
 * Atalho de teste da Fase 5 (garagem → J), como o [Z] do teste de motor: largada
 * normal no solo com o tanque em 40% (o posto abre já no primeiro quadro), o
 * convite de racha 4 s depois do verde e o primeiro evento sorteado aos 25 s.
 */
export function iniciarTesteFase5(eng: AutoDashEngine) {
  eng.testeMotor = false
  eng.testeFase5 = true
  saveConfig(eng.cfg)
  startRace(eng)
}

/** Chamado pela largada (modes/race.ts) quando o atalho está ligado. */
export function prepararTesteFase5(eng: AutoDashEngine) {
  eng.combustivel = 0.4
  eng.rachaT = 4
  eng.eventTimer = 25
  eng.floaters.push({ text: "TESTE DA FASE 5: posto e racha logo à frente", color: "#94a3b8", y: H * 0.5, life: 2.4, big: false })
}

export function teclaDebugEvento(eng: AutoDashEngine, k: string) {
  // no dev server, a primeira tecla de debug expõe o engine para inspeção no console
  if (import.meta.env.DEV && /^[0-9]$/.test(k)) (globalThis as { __autodash?: AutoDashEngine }).__autodash = eng
  if (eng.mode !== "solo" || eng.testeMotor || eng.state !== "racing") return
  const aviso = (t: string) => eng.floaters.push({ text: t, color: "#94a3b8", y: H * 0.5, life: 1, big: false })
  if (k === "1" && !spawnPosto(eng)) aviso("posto não coube agora")
  if (k === "2" && !convidarRacha(eng)) aviso("racha não coube agora")
  if (k === "3") spawnEvent(eng, "obra")
  if (k === "4") spawnEvent(eng, "comboio")
  if (k === "5") spawnEvent(eng, "oleo")
  if (k === "6") { eng.combustivel = Math.min(eng.combustivel, COMBUSTIVEL.reserva + 0.01); aviso("tanque na reserva") }
  if (k === "7") { // viaduto com elevado (Fase 8.6): não empilha com outro evento à frente
    if (eng.zones.some(z => z.end > eng.position)) aviso("evento à frente: tente depois")
    else spawnEvent(eng, "viaduct")
  }
  if (k === "0") { // zona de drift (16/11)
    if (eng.zones.some(z => z.end > eng.position)) aviso("evento à frente: tente depois")
    else spawnEvent(eng, "drift")
  }
  if (k === "9") trocarRegiao(eng) // próxima região (Fase 8.5)
  if (k === "8") { // túnel raro (Fase 8.7)
    if (eng.zones.some(z => z.end > eng.position)) aviso("evento à frente: tente depois")
    else spawnEvent(eng, "tunnel")
  }
}
