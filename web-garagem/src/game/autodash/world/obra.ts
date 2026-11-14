// AutoDash — world/obra.ts. E4: obra com estreitamento e seta luminosa (Fase 5).
//
// Duas faixas de um lado fecham por um trecho. Leitura antecipada: placas de
// obra, seta luminosa piscando no começo do funil (paleta de perigo), cones na
// divisa e cavaletes no lado fechado. Contra-jogada: entrar cedo na faixa livre;
// quem fura no último segundo arrisca o cone (tranco, sem morte). O trânsito
// civil migra para o lado livre antes do funil, como na mão dupla.
import { type AutoDashEngine, H } from "../engine"
import { DRAW_DIST, SEG_LEN } from "../data"
import { wrapDz } from "../traffic/spawner"

export const OBRA = {
  comprimento: 80000, // unidades de mundo (~3 s a 200 km/h)
  funil: 3600,        // afunilamento de cones antes do trecho
  conesCada: 1600,    // cones na divisa
  cavaleteCada: 9000, // cavaletes no lado fechado
  divisa: 0.04,       // offset da linha de cones (do lado fechado)
  migraAntes: 14000,  // o trânsito começa a sair do lado fechado esta distância antes
}

/** Monta a obra além do horizonte. `lado` = lado fechado (1 direita, -1 esquerda). */
export function spawnObra(eng: AutoDashEngine, lado: 1 | -1) {
  const VIEW = DRAW_DIST * SEG_LEN
  const START = VIEW * 1.7
  const at = (d: number) => ((eng.position + d) % eng.trackLen + eng.trackLen) % eng.trackLen
  const ini = START + OBRA.funil // começo do trecho estreito (depois do funil)
  eng.zones.push({ type: "obra", z: at(START), end: at(ini + OBRA.comprimento), spawnT: 0, lado })
  eng.roadSigns.push(
      { z: at(START - VIEW * 0.95), type: "works", label: "OBRAS 2 km" },
      { z: at(START - VIEW * 0.60), type: "works", label: "OBRAS 1 km" },
      { z: at(START - VIEW * 0.28), type: "works", label: "ESTREITA" },
  )
  // seta luminosa no começo do funil, na faixa de fora do lado fechado
  eng.obstacles.push({ z: at(START - 400), offset: lado * 0.62, kind: "seta", w: 0.4, len: 160, lado })
  // funil: cones da borda até a divisa
  for (let i = 0; i <= 6; i++) {
    const f = i / 6
    eng.obstacles.push({ z: at(START + OBRA.funil * f), offset: lado * (0.95 - (0.95 - OBRA.divisa) * f), kind: "cone", w: 0.10, len: 90 })
  }
  // divisa e cavaletes no trecho fechado
  for (let d = OBRA.conesCada; d <= OBRA.comprimento; d += OBRA.conesCada) {
    eng.obstacles.push({ z: at(ini + d), offset: lado * OBRA.divisa, kind: "cone", w: 0.10, len: 90 })
  }
  for (let d = OBRA.cavaleteCada / 2; d < OBRA.comprimento; d += OBRA.cavaleteCada) {
    eng.obstacles.push({ z: at(ini + d), offset: lado * 0.5, kind: "barrier", w: 0.55, len: 140 })
  }
  eng.floaters.push({ text: `🚧 obra à frente — faixas da ${lado > 0 ? "direita" : "esquerda"} fechadas`, color: "#FF9F1C", y: H * 0.38, life: 1.8, big: false })
}

/** O trânsito civil sai do lado fechado antes do funil (ou freia esperando vaga). */
export function atualizarObras(eng: AutoDashEngine, dt: number, playerZ: number) {
  for (const zn of eng.zones) {
    if (zn.type !== "obra" || !zn.lado) continue
    if (wrapDz(eng, zn.end, playerZ) < 0) continue // já passou
    const lado = zn.lado
    for (const t of eng.traffic) {
      if (t.role !== "civilian" || t.parked) continue
      const d = wrapDz(eng, t.z, zn.z)
      if (d < -OBRA.migraAntes || wrapDz(eng, zn.end, t.z) < 0) continue
      if (t.targetOffset * lado <= 0) continue // já está do lado livre
      let moved = false
      for (const lane of [-lado * 0.25, -lado * 0.75]) {
        let livre = true
        for (const o of eng.traffic) {
          if (o === t) continue
          if (Math.abs(wrapDz(eng, o.z, t.z)) < 1100 && (Math.abs(o.offset - lane) < 0.3 || Math.abs(o.targetOffset - lane) < 0.3)) { livre = false; break }
        }
        if (livre && Math.abs(wrapDz(eng, playerZ, t.z)) < 2200 && Math.abs(eng.playerX - lane) < 0.3) livre = false
        if (livre) { t.targetOffset = lane; t.blinkT = Math.max(t.blinkT, 0.6); moved = true; break }
      }
      // sem vaga: segura antes do funil (não entra na obra)
      if (!moved && d > -3000) t.speed = Math.max(40, t.speed - 50 * dt)
    }
  }
}
