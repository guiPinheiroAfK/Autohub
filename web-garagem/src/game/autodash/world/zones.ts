// AutoDash — world/zones.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { AutoDashEngine, H } from "../engine"
import { wrapDz } from "../traffic/spawner"
import { DRAW_DIST, SEG_LEN } from "../data"
import { type TrafficKind, TRAFFIC_COLORS, KINDS } from "../traffic/types"

export function updateZones(eng: AutoDashEngine, dt: number, playerZ: number) {
  for (const zn of eng.zones) {
    const toStart = wrapDz(eng, zn.z, playerZ) // >0: início à frente
    const toEnd = wrapDz(eng, zn.end, playerZ)

    if (zn.type === "wrongway") {
      // ativa um pouco antes (você vê os carros vindo) e morre no fim da zona
      if (toStart < 9000 && toEnd > 0) {
        zn.spawnT -= dt
        if (zn.spawnT <= 0) {
          zn.spawnT = 0.5 + Math.random() * 0.7
          // nasce no horizonte visível — clampado pra DENTRO da zona (o
          // horizonte pode estar além do fim dela, e aí nada nascia)
          let z = ((playerZ + DRAW_DIST * SEG_LEN * 0.85) % eng.trackLen + eng.trackLen) % eng.trackLen
          if (wrapDz(eng, zn.end, z) < 0) z = ((zn.end - 400) % eng.trackLen + eng.trackLen) % eng.trackLen
          if (wrapDz(eng, z, zn.z) > 0 && wrapDz(eng, zn.end, z) > 0) {
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
        // o trânsito do SEU sentido se adapta: quem está na esquerda dentro
        // da zona migra pra uma faixa da direita LIVRE (checando os outros e
        // o jogador — mandar às cegas fazia eles se jogarem em cima de tudo).
        // Sem vaga? Freia e espera abrir.
        for (const t of eng.traffic) {
          if (t.role !== "civilian" || t.parked) continue
          const d = wrapDz(eng, t.z, zn.z)
          if (d > -6000 && wrapDz(eng, zn.end, t.z) > 0 && t.targetOffset < 0.1) {
            let moved = false
            for (const lane of [0.25, 0.75]) {
              let clear = true
              for (const o of eng.traffic) {
                if (o === t) continue
                if (Math.abs(wrapDz(eng, o.z, t.z)) < 1100 && (Math.abs(o.offset - lane) < 0.3 || Math.abs(o.targetOffset - lane) < 0.3)) { clear = false; break }
              }
              if (clear && Math.abs(wrapDz(eng, playerZ, t.z)) < 2200 && Math.abs(eng.playerX - lane) < 0.3) clear = false
              if (clear) { t.targetOffset = lane; t.blinkT = Math.max(t.blinkT, 0.5); moved = true; break }
            }
            if (!moved) t.speed = Math.max(55, t.speed - 50 * dt)
          }
        }
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
          eng.spawnPoliceChase()
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
