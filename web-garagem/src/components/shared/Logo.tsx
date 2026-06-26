/** Roda de 3 raios — ícone do AutoHub */
export function Logo({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Aro externo */}
      <circle cx="14" cy="14" r="11" stroke="currentColor" strokeWidth="2" />
      {/* Hub central */}
      <circle cx="14" cy="14" r="3" fill="currentColor" />
      {/* Raio topo (12h) */}
      <line x1="14" y1="11" x2="14" y2="3"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      {/* Raio direita-baixo (4h) */}
      <line x1="16.6" y1="15.5" x2="23.5" y2="19.5"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      {/* Raio esquerda-baixo (8h) */}
      <line x1="11.4" y1="15.5" x2="4.5" y2="19.5"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
