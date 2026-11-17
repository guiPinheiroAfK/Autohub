// AutoDash — world/zones.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { infracao } from "./policia"
import { AutoDashEngine, H } from "../engine"
import { wrapDz } from "../traffic/spawner"
import { DRAW_DIST, SEG_LEN } from "../data"
import { type TrafficKind, TRAFFIC_COLORS, KINDS } from "../traffic/types"
import { RAMAL_ABRE, RAMAL_COLADO, ramalNoSeg, ramalCentro } from "./ramais"
import { atualizarTunel } from "./tunel"
import { atualizarTouge } from "./touge"
import { atualizarMontanha } from "./montanha"

/**
 * Elevado do viaduto (Fase 8.6): quem está nele segue o centro do ramal; no fim
 * colado, funde na faixa da direita. Antes dele, às vezes um civil da direita dá
 * seta e sai da pista subindo. O elevado que ficou para trás sai da lista.
 */
function atualizarElevado(eng: AutoDashEngine, playerZ: number) {
  const N = eng.segments.length
  for (const t of eng.traffic) {
    if (t.role !== "civilian" || t.parked) continue
    const idx = Math.floor(t.z / SEG_LEN) % N
    const q = ramalNoSeg(eng.ramais, idx)
    if (!q || !q.r.alto) continue
    if (t.viaduto) {
      // no fim colado (depois do cruzamento): seta e funde na pista
      if (q.p.f <= 0.01 && idx > (q.r.topo ?? 0)) {
        if (t.offset > 0.95) { t.targetOffset = 0.75; t.blinkT = Math.max(t.blinkT, 0.4) }
        else t.viaduto = undefined
        continue
      }
      // segue o centro do ramal (ele descola da pista mais rápido que a troca de
      // faixa); longe dele (acabou de dar seta), vai até lá pela troca normal
      const c = ramalCentro(q)
      if (Math.abs(t.offset - c) < 0.25) t.offset = c
      t.targetOffset = c
      continue
    }
    // na faixa colada de saída, antes de descolar: alguns da direita sobem
    const naSaida = idx > q.r.a + RAMAL_ABRE + 8 && idx < q.r.a + RAMAL_ABRE + RAMAL_COLADO - 30
    if (naSaida && t.offset > 0.5 && t.targetOffset === t.offset && t.blinkT <= 0 && Math.random() < 0.006) {
      const livre = !eng.traffic.some(o => o !== t && o.offset > 0.95 && Math.abs(wrapDz(eng, o.z, t.z)) < 900)
        && !(eng.playerX > 0.95 && Math.abs(wrapDz(eng, playerZ, t.z)) < 1500)
      if (livre) { t.targetOffset = ramalCentro(q); t.blinkT = 0.9; t.viaduto = "sobe" }
    }
  }
  // elevado que ficou para trás sai da lista de ramais
  const atras = (r: { alto?: number; b: number }) => !!r.alto && wrapDz(eng, r.b * SEG_LEN, playerZ) < -60 * SEG_LEN
  if (eng.ramais.some(atras)) eng.ramais = eng.ramais.filter(r => !atras(r))
}

export function updateZones(eng: AutoDashEngine, dt: number, playerZ: number) {
  if (eng.ramais.length) atualizarElevado(eng, playerZ)
  // embaixo do viaduto o ronco bate no concreto e volta (eco forte no áudio)
  const sob = eng.zones.some(zn => {
    if (zn.type !== "viaduct") return false
    const d = wrapDz(eng, zn.z, playerZ)
    return d < SEG_LEN * 1.5 && d > -SEG_LEN * 3
  })
  // túnel (Fase 8.7): o mesmo eco fechado, o trecho inteiro
  atualizarTunel(eng, dt, playerZ)
  atualizarTouge(eng, dt, playerZ)
  atualizarMontanha(eng, playerZ, dt)
  const fechado = sob || eng.dentroTunel
  // (o túnel tem o reverb longo próprio; embaixo do viaduto é o eco curto)
  if (fechado !== eng.sobViaduto || eng.dentroTunel !== eng.tunelSom) {
    eng.sobViaduto = fechado; eng.tunelSom = eng.dentroTunel
    eng.audio.ambiente(eng.dentroTunel ? "tunel" : fechado ? "fechado" : "aberto")
  }
  for (const zn of eng.zones) {
    const toStart = wrapDz(eng, zn.z, playerZ) // >0: início à frente
    const toEnd = wrapDz(eng, zn.end, playerZ)

    if (zn.type === "wrongway") {
      // ativa um pouco antes (você vê os carros vindo) e morre no fim da zona
      if (toStart < 9000 && toEnd > 0) {
        zn.spawnT -= dt
        if (zn.spawnT <= 0) {
          // contramão rala (17/11: vinham 4 fileiras seguidas): 1 carro a cada 2 a 3,5 s
          zn.spawnT = 2 + Math.random() * 1.5
          // nasce na borda do horizonte (sai da névoa, sem pipocar) — clampado pra DENTRO da zona (o
          // horizonte pode estar além do fim dela, e aí nada nascia)
          let z = ((playerZ + DRAW_DIST * SEG_LEN * 1.0) % eng.trackLen + eng.trackLen) % eng.trackLen
          if (wrapDz(eng, zn.end, z) < 0) z = ((zn.end - 400) % eng.trackLen + eng.trackLen) % eng.trackLen
          // nunca dois contramão perto um do outro (nem lado a lado): sem "fileira"
          const colado = eng.traffic.some(o => o.role === "oncoming" && Math.abs(wrapDz(eng, o.z, z)) < 14000)
          if (!colado && wrapDz(eng, z, zn.z) > 0 && wrapDz(eng, zn.end, z) > 0) {
            const kind: TrafficKind = Math.random() < 0.72 ? "car" : "truck"
            const lane = Math.random() < 0.5 ? -0.75 : -0.25 // mão dupla: DUAS faixas contra
            eng.traffic.push({
              z, offset: lane, targetOffset: lane,
              speed: -(70 + Math.random() * 45), // negativa: vem contra você
              kind, role: "oncoming",
              color: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
              blinkT: 0, prevD: wrapDz(eng, z, playerZ),
            })
          }
        }
        // (o trânsito do seu sentido vai para as 2 faixas da direita sozinho: CivilianDriver
        // sai da esquerda, uma faixa por vez; os que estavam além do horizonte já foram
        // arrumados no nascimento da mão dupla, em limparEsquerdaInvisivel)
      }
    } else if (zn.type === "blitz" || zn.type === "speedtrap") {
      const lim = zn.type === "blitz" ? 60 : 90
      // todo o trânsito civil reduz na aproximação (ninguém fura junto com você)
      if (toStart < 22000 && toEnd > -2000) {
        for (const t of eng.traffic) {
          if (t.role !== "civilian" || t.parked) continue
          const d = wrapDz(eng, t.z, zn.z)
          if (d > -20000 && wrapDz(eng, zn.end, t.z) > -1000 && t.speed > lim + 4) {
            t.speed = Math.max(lim - 4 + Math.random() * 8, t.speed - 80 * dt)
          }
        }
      }
      // depois da zona, o trânsito reacelera pro ritmo normal
      if (toEnd < 0 && toEnd > -22000) {
        for (const t of eng.traffic) {
          if (t.role !== "civilian" || t.parked) continue
          const kk = KINDS[t.kind]
          if (wrapDz(eng, t.z, zn.end) > 0 && t.speed < kk.spd[0]) t.speed = Math.min(kk.spd[1], t.speed + 24 * dt)
        }
      }
      // cruzou a linha: passou no limite ou virou caçada
      if (!zn.checked && wrapDz(eng, playerZ, zn.z) > 0 && wrapDz(eng, playerZ, zn.z) < 4000) {
        zn.checked = true
        const tol = lim + 6
        if (eng.speed > tol) {
          eng.floaters.push({
            text: zn.type === "blitz" ? "FUROU A BLITZ! 🚨" : "O RADAR TE VIU! 📸🚨",
            color: "#ef4444", y: H * 0.32, life: 2.2, big: true,
          })
          eng.audio.horn()
          // infração: esquenta o procurado e chama as viaturas da estrela (Fase 6)
          infracao(eng, zn.type === "blitz" ? "blitz" : "radar")
        } else {
          eng.floaters.push({
            text: zn.type === "blitz" ? "passou na blitz ✅" : "radar ok ✅",
            color: "#4ade80", y: H * 0.4, life: 1.4, big: false,
          })
        }
      }
    }
  }
}
