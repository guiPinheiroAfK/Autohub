import { useState, useEffect } from "react"

// Simulação visual de uma volta de circuito (velocidade e RPM normalizados 0-1)
export function useVoltaSimulada() {
  const [pct, setPct] = useState({ s: 0, r: 0 })

  // Simulação de volta num circuito: aceleração, trocas de marcha, freadas, curvas
  useEffect(() => {
    const INTRO = 1200   // ms de subida inicial
    const TOTAL = 19000  // ms de volta completa (loop)

    // Keyframes: { t = ms na volta, s = velocidade 0-1, r = RPM 0-1 }
    // RPM cai brevemente em trocas de marcha; velocidade cai em freadas
    const KF = [
      { t: 0,     s: 0.12, r: 0.22 },  // saída de curva lenta
      { t: 1800,  s: 0.78, r: 0.87 },  // aceleração forte
      { t: 3000,  s: 0.85, r: 0.74 },  // troca de marcha (RPM despenca)
      { t: 3400,  s: 0.87, r: 0.89 },  // retoma após troca
      { t: 5000,  s: 0.91, r: 0.91 },  // reta a fundo
      { t: 5350,  s: 0.92, r: 0.78 },  // troca de marcha
      { t: 5750,  s: 0.93, r: 0.92 },  // fundo da reta
      { t: 7100,  s: 0.42, r: 0.50 },  // freada forte
      { t: 8100,  s: 0.32, r: 0.55 },  // curva lenta
      { t: 9300,  s: 0.68, r: 0.83 },  // aceleração
      { t: 10400, s: 0.78, r: 0.72 },  // troca de marcha
      { t: 10800, s: 0.80, r: 0.86 },  // retoma
      { t: 12600, s: 0.28, r: 0.46 },  // freada muito forte
      { t: 13600, s: 0.22, r: 0.50 },  // hairpin
      { t: 15800, s: 0.62, r: 0.80 },  // saída acelerando
      { t: 17200, s: 0.75, r: 0.86 },  // chegando na última curva
      { t: 19000, s: 0.12, r: 0.22 },  // fecha o loop
    ]

    let origin: number | null = null
    let raf: number

    const step = (now: number) => {
      if (origin === null) origin = now
      const total = now - origin

      let s: number, r: number

      if (total < INTRO) {
        // Arrancada inicial suave
        const e = 1 - (1 - total / INTRO) ** 3
        s = KF[0].s * e
        r = KF[0].r * e
      } else {
        const lap = (total - INTRO) % TOTAL

        // Interpola entre os dois keyframes vizinhos
        let a = KF[KF.length - 1], b = KF[0]
        for (let i = 0; i < KF.length - 1; i++) {
          if (lap >= KF[i].t && lap < KF[i + 1].t) { a = KF[i]; b = KF[i + 1]; break }
        }
        const seg = b.t - a.t
        const t   = seg > 0 ? (lap - a.t) / seg : 0
        const e   = t * t * (3 - 2 * t)  // smoothstep

        s = a.s + (b.s - a.s) * e
        r = a.r + (b.r - a.r) * e

        // Micro-vibração do motor (frequências diferentes para s e r = mais natural)
        r += Math.sin(now * 0.023) * 0.010
        s += Math.sin(now * 0.011) * 0.004
      }

      setPct({
        s: Math.max(0, Math.min(1, s)),
        r: Math.max(0, Math.min(1, r)),
      })
      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  return { pct }
}
