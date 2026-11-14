// AutoDash — physics/troca.ts. Como a troca de marcha SE SENTE: o giro durante
// a troca e o tipo de câmbio. Só sensação (conta-giros, som, câmera): durante a
// troca a força já é zero e nada da física lê o giro (docs/pesquisa/fisica-carro.md, R1).
import type { CambioTipo, CarSpec } from "../data"
import { type MotorFisico, faixa, taxaSolto } from "./motores"

/** Tipo de câmbio do carro (padrão: manual H). */
export function cambioDe(spec: CarSpec): CambioTipo {
  return spec.cambio ?? "H"
}

// Quanto mais rápido que o giro solto o motor chega no giro novo: no H a
// embreagem fica aberta e o motor cai sozinho; no DCT a outra embreagem já puxa.
export const K_TROCA: Record<CambioTipo, number> = { H: 1, seq: 2, dct: 4, conv: 1.5 }

// "Blip" na redução: o motor sobe um pouco acima do giro novo, como o pé
// dando o punta-tacco (ou o câmbio fazendo sozinho).
export const BLIP_FRAC = 0.04

/**
 * Giro num quadro de troca (embreagem aberta): anda até `alvo`, o giro da marcha
 * nova, na rapidez do giro solto do motor × o fator do câmbio. Com `blip`, mira
 * um pouco acima (sem passar do corte).
 */
export function giroNaTroca(m: MotorFisico, rpm: number, alvo: number, dt: number, tipo: CambioTipo, blip: boolean): number {
  const meta = blip ? Math.max(alvo, Math.min(alvo + BLIP_FRAC * faixa(m), m.corte - 0.02 * faixa(m))) : alvo
  const taxa = taxaSolto(m, meta > rpm) * K_TROCA[tipo]
  return rpm + (meta - rpm) * Math.min(1, dt * taxa)
}
