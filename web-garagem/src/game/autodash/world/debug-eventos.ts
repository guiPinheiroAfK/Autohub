// AutoDash — world/debug-eventos.ts. Teclas de playtest dos eventos da Fase 5
// (só no solo, correndo). Ficam ativas, como as outras de debug (GUIA, seção 3).
import { type AutoDashEngine, H } from "../engine"
import { COMBUSTIVEL } from "./combustivel"
import { spawnPosto } from "./posto"
import { convidarRacha } from "../modes/racha"

export function teclaDebugEvento(eng: AutoDashEngine, k: string) {
  // no dev server, a primeira tecla de debug expõe o engine para inspeção no console
  if (import.meta.env.DEV && /^[0-9]$/.test(k)) (globalThis as { __autodash?: AutoDashEngine }).__autodash = eng
  if (eng.mode !== "solo" || eng.testeMotor || eng.state !== "racing") return
  const aviso = (t: string) => eng.floaters.push({ text: t, color: "#94a3b8", y: H * 0.5, life: 1, big: false })
  if (k === "1" && !spawnPosto(eng)) aviso("posto não coube agora")
  if (k === "2" && !convidarRacha(eng)) aviso("racha não coube agora")
  if (k === "6") { eng.combustivel = Math.min(eng.combustivel, COMBUSTIVEL.reserva + 0.01); aviso("tanque na reserva") }
}
