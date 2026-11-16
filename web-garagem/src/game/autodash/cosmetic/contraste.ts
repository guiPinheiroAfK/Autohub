// AutoDash — cosmetic/contraste.ts. Contraste da pintura contra o asfalto da
// cena (visual-e-desafio.md §1.4–1.5): razão WCAG entre as luminâncias
// relativas, com as cores já escurecidas pela luz da cena como no desenho.
import { shade } from "../math"

function canal(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** Componentes de `#rrggbb` ou `rgb(r,g,b)` (o formato que `shade` devolve). */
function rgbDe(cor: string): [number, number, number] {
  if (cor.startsWith("#")) {
    const n = parseInt(cor.slice(1, 7), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const m = cor.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0]
  return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0]
}

/** Luminância relativa de uma cor (WCAG 2). */
export function luminancia(cor: string): number {
  const [r, g, b] = rgbDe(cor)
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function razaoContraste(a: string, b: string): number {
  const la = luminancia(a), lb = luminancia(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// Mesmas contas do desenho: asfalto em render/road.ts, carroceria em drawPlayerCar.
export const ASFALTO = "#616167"

export interface LeituraPintura { razao: number; nota: "some" | "fraca" | "ok" | "destaca" }

/**
 * Contraste da pintura do jogador contra o asfalto com a luz `amb` da cena.
 * Faixas: < 2 some (o carro só aparece pela sombra e lanternas), < 3 fraca
 * (abaixo do piso de 3:1 do WCAG 1.4.11), < 4,5 ok, ≥ 4,5 destaca.
 */
export function leituraPintura(pintura: string, amb: number): LeituraPintura {
  const corpo = shade(pintura, Math.max(0.5, amb))
  const chao = shade(ASFALTO, amb)
  const razao = razaoContraste(corpo, chao)
  const nota = razao < 2 ? "some" : razao < 3 ? "fraca" : razao < 4.5 ? "ok" : "destaca"
  return { razao, nota }
}
