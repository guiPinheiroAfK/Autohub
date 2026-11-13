/**
 * Função agendada — roda todo dia às 8h (horário de Brasília, UTC-3 = 11h UTC).
 * Busca cotações USD-BRL e PYG-BRL na AwesomeAPI (gratuita, sem chave)
 * e salva/atualiza na tabela `cotacoes` do Neon.
 *
 * Netlify Scheduled Functions v2: export config.schedule + export default handler
 * Usa o cliente Neon de src/db/client.ts (mesmo do resto da API) e Request/Response nativo.
 */

export const config = {
  schedule: "0 11 * * *",  // 8h BRT = 11h UTC
}

interface AwesomeQuote {
  bid: string
  ask: string
  code: string
  codein: string
}

export default async function handler(): Promise<Response> {
  if (!process.env.DATABASE_URL) {
    console.error("[cotacao-diaria] DATABASE_URL não definida")
    return new Response(JSON.stringify({ error: "DATABASE_URL ausente" }), { status: 500 })
  }

  // Import dinâmico: client.ts lança erro ao carregar sem DATABASE_URL, então
  // só importa depois da checagem acima (mantém a resposta 500 de antes).
  const { sql } = await import("../../src/db/client.ts")

  try {
    // AwesomeAPI — gratuita, sem chave, retorna cotações em tempo real
    const resp = await fetch(
      "https://economia.awesomeapi.com.br/json/last/USD-BRL,PYG-BRL",
      { signal: AbortSignal.timeout(10_000) }
    )

    if (!resp.ok) {
      throw new Error(`AwesomeAPI respondeu ${resp.status}`)
    }

    const data = await resp.json() as Record<string, AwesomeQuote>
    const hoje = new Date().toISOString().split("T")[0]

    const pares = [
      { par: "USD-BRL", key: "USDBRL" },
      { par: "PYG-BRL", key: "PYGBRL" },
    ]

    const salvos: string[] = []

    for (const { par, key } of pares) {
      const quote = data[key]
      if (!quote) {
        console.warn(`[cotacao-diaria] Par ${key} não encontrado na resposta`)
        continue
      }

      await sql`
        INSERT INTO cotacoes (data, par, taxa_compra, taxa_venda, fonte)
        VALUES (
          ${hoje}::date,
          ${par},
          ${Number(quote.bid)},
          ${Number(quote.ask)},
          'awesomeapi'
        )
        ON CONFLICT (data, par) DO UPDATE SET
          taxa_compra = EXCLUDED.taxa_compra,
          taxa_venda  = EXCLUDED.taxa_venda,
          criado_em   = now()
      `
      salvos.push(`${par}: compra ${quote.bid} / venda ${quote.ask}`)
    }

    console.log(`[cotacao-diaria] ${hoje} — ${salvos.join(" | ")}`)
    return new Response(JSON.stringify({ ok: true, data: hoje, salvos }), { status: 200 })

  } catch (err) {
    console.error("[cotacao-diaria] Erro:", err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
}
