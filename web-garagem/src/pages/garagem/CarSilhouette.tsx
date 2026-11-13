import { useVoltaSimulada } from "./useVoltaSimulada"

export function CarSilhouette() {
  const { pct } = useVoltaSimulada()

  // Ponto na circunferência (ângulo em graus, sentido horário SVG)
  const ap = (cx: number, cy: number, r: number, deg: number) => [
    cx + r * Math.cos((deg * Math.PI) / 180),
    cy + r * Math.sin((deg * Math.PI) / 180),
  ] as const

  // Renderiza um gauge como JSX (não componente — evita re-mount em cada frame)
  const gauge = (cx: number, cy: number, R: number, val: number, label: string) => {
    const S = 135, T = 270                          // 7h → 5h, 270° de varredura
    const [sx, sy] = ap(cx, cy, R, S)              // início do arco
    const [ex, ey] = ap(cx, cy, R, S + T)          // fim do arco
    const [fx, fy] = ap(cx, cy, R, S + val * T)    // ponteiro — arco cheio
    const [nx, ny] = ap(cx, cy, R - 14, S + val * T) // ponta do ponteiro
    const [rx, ry] = ap(cx, cy, R, S + 0.82 * T)  // início da zona vermelha
    const laf = val * T > 180 ? 1 : 0              // large-arc-flag

    return (
      <g>
        {/* Brilho ambiente */}
        <circle cx={cx} cy={cy} r={R + 10} fill="rgba(127,119,221,0.04)" />
        <circle cx={cx} cy={cy} r={R + 2} fill="none"
          stroke="rgba(127,119,221,0.07)" strokeWidth="1" />

        {/* Trilha */}
        <path d={`M${sx} ${sy}A${R} ${R} 0 1 1 ${ex} ${ey}`}
          fill="none" stroke="rgba(127,119,221,0.13)" strokeWidth="8" strokeLinecap="round" />

        {/* Zona vermelha — últimos 18% */}
        <path d={`M${rx} ${ry}A${R} ${R} 0 0 1 ${ex} ${ey}`}
          fill="none" stroke="rgba(210,50,50,0.4)" strokeWidth="8" strokeLinecap="round" />

        {/* Arco de preenchimento */}
        {val > 0.005 && (
          <path d={`M${sx} ${sy}A${R} ${R} 0 ${laf} 1 ${fx} ${fy}`}
            fill="none" stroke="rgba(127,119,221,0.88)" strokeWidth="8" strokeLinecap="round" />
        )}

        {/* Face interna escura */}
        <circle cx={cx} cy={cy} r={R - 18} fill="rgba(6,6,14,0.85)" />

        {/* Marcações (10 ticks: 4 major + 6 minor) */}
        {Array.from({ length: 10 }, (_, i) => {
          const deg = S + (i / 9) * T
          const major = i % 3 === 0
          const [ax, ay] = ap(cx, cy, R - (major ? 15 : 10), deg)
          const [bx, by] = ap(cx, cy, R - 2, deg)
          return (
            <line key={i} x1={ax} y1={ay} x2={bx} y2={by}
              stroke={`rgba(255,255,255,${major ? 0.3 : 0.1})`}
              strokeWidth={major ? 1.5 : 1} strokeLinecap="round" />
          )
        })}

        {/* Ponteiro */}
        {val > 0 && (
          <line x1={cx} y1={cy} x2={nx} y2={ny}
            stroke="rgba(255,255,255,0.92)" strokeWidth="2" strokeLinecap="round" />
        )}

        {/* Hub */}
        <circle cx={cx} cy={cy} r="5" fill="rgba(127,119,221,0.9)" />
        <circle cx={cx} cy={cy} r="2" fill="rgba(255,255,255,0.6)" />

        {/* Label dentro da face */}
        <text x={cx} y={cy + 20} textAnchor="middle"
          fontSize="7" fontWeight="600" letterSpacing="1.5"
          fill="rgba(127,119,221,0.45)" fontFamily="ui-monospace,monospace">
          {label}
        </text>
      </g>
    )
  }

  const speedKmh = Math.round(pct.s * 280)
  const rpmStr   = (pct.r * 9).toFixed(1)

  return (
    <svg viewBox="0 0 340 132" fill="none" xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[320px]">

      {/* Painel de fundo */}
      <rect x="0.5" y="0.5" width="339" height="131" rx="12"
        fill="rgba(8,8,18,0.55)" stroke="rgba(127,119,221,0.1)" strokeWidth="1" />

      {/* Tacômetro (esquerda) */}
      {gauge(78, 65, 50, pct.r, "RPM")}

      {/* Velocímetro (direita) */}
      {gauge(262, 65, 50, pct.s, "KM/H")}

      {/* Display digital central */}
      <text x="170" y="56" textAnchor="middle"
        fontSize="36" fontWeight="700" fill="rgba(255,255,255,0.92)"
        fontFamily="ui-monospace,monospace">
        {speedKmh}
      </text>
      <text x="170" y="71" textAnchor="middle"
        fontSize="7.5" fontWeight="600" letterSpacing="3"
        fill="rgba(127,119,221,0.55)" fontFamily="ui-monospace,monospace">
        KM / H
      </text>
      <line x1="148" y1="80" x2="192" y2="80"
        stroke="rgba(127,119,221,0.15)" strokeWidth="1" />
      <text x="170" y="93" textAnchor="middle"
        fontSize="9" fontWeight="500" letterSpacing="0.8"
        fill="rgba(127,119,221,0.38)" fontFamily="ui-monospace,monospace">
        {rpmStr}k RPM
      </text>
    </svg>
  )
}
