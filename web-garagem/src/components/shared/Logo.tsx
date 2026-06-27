/** Roda de 5 raios GTI hollow — ícone do AutoHub */
export function Logo({ className = "size-5" }: { className?: string }) {
  const spoke =
    "M 63 50 Q 70 27 77.96 20.01 A 41 41 0 0 1 90.94 47.85 Q 82 57 63 50 Z " +
    "M 66 50 Q 72 35 77.07 24.77 A 37 37 0 0 1 86.86 46.78 Q 80 55 66 50 Z"
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Aro externo */}
      <circle cx="50" cy="50" r="43.5" stroke="currentColor" strokeWidth="5" />
      {/* 5 raios curvados GTI, hollow via evenodd */}
      <g fill="currentColor" fillRule="evenodd" transform="rotate(-90,50,50)">
        <path d={spoke} />
        <path d={spoke} transform="rotate(72,50,50)" />
        <path d={spoke} transform="rotate(144,50,50)" />
        <path d={spoke} transform="rotate(216,50,50)" />
        <path d={spoke} transform="rotate(288,50,50)" />
      </g>
      {/* Hub: anel + ponto central */}
      <circle cx="50" cy="50" r="13.5" stroke="currentColor" strokeWidth="4.5" />
      <circle cx="50" cy="50" r="4" fill="currentColor" />
    </svg>
  )
}
