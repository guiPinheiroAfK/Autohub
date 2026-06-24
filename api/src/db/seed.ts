/**
 * seed.ts — popula o banco com a garagem real do Gui (RX-8 K24 + Civic),
 * que antes vivia hardcoded em web-garagem/src/data/*.ts.
 *
 * Roda depois das migrations (`bun run migrate && bun run seed`).
 * Idempotente: se o usuário seed já existe, não faz nada — seguro rodar
 * em todo `docker compose up`.
 */

import { sql } from "./client"
import bcrypt from "bcryptjs"

const SEED_EMAIL = "guilherme@pinedevs.com.br"
// Senha só pra dev local. Troca depois de logar, ou muda aqui antes do
// primeiro `docker compose up` se quiser outra.
const SEED_PASSWORD = "autohub_dev_2026"

async function inserirFase(
  veiculoId: string,
  titulo: string,
  ordem: number,
  status: "planejado" | "andamento" | "concluido",
  orcamentoMin: number,
  orcamentoMax: number,
  moeda: "BRL" | "USD" | "PYG",
  nota: string | null = null
): Promise<string> {
  const [fase] = await sql`
    INSERT INTO fases (veiculo_id, titulo, ordem, status, orcamento_min, orcamento_max, moeda, nota)
    VALUES (${veiculoId}, ${titulo}, ${ordem}, ${status}, ${orcamentoMin}, ${orcamentoMax}, ${moeda}, ${nota})
    RETURNING id
  `
  return fase.id
}

async function inserirItem(
  faseId: string,
  nome: string,
  detalhe: string | null,
  precoMin: number,
  precoMax: number,
  moeda: "BRL" | "USD" | "PYG",
  status: "planejado" | "andamento" | "concluido",
  fornecedorId: string | null = null
): Promise<void> {
  await sql`
    INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id)
    VALUES (${faseId}, ${nome}, ${detalhe}, ${precoMin}, ${precoMax}, ${moeda}, ${status}, ${fornecedorId})
  `
}

async function seed() {
  console.log("▶ Rodando seed...")

  const [existing] = await sql`SELECT id FROM usuarios WHERE email = ${SEED_EMAIL} LIMIT 1`
  if (existing) {
    console.log("✔ Seed já aplicado antes — pulando.")
    await sql.end()
    return
  }

  const hashed = await bcrypt.hash(SEED_PASSWORD, 12)

  const [usuario] = await sql`
    INSERT INTO usuarios (nome, email, hashed_password)
    VALUES ('Guilherme Vargas', ${SEED_EMAIL}, ${hashed})
    RETURNING id
  `

  const [garagem] = await sql`
    INSERT INTO garagens (usuario_id, nome, slug, bio)
    VALUES (
      ${usuario.id}, 'Garagem do Gui', 'gui',
      'Builds de fim de semana entre Foz do Iguaçu e Ciudad del Este.'
    )
    RETURNING id
  `

  // ── Fornecedores ────────────────────────────────────────────────────────
  const [cde] = await sql`
    INSERT INTO fornecedores (usuario_id, nome, pais, avaliacao, observacoes)
    VALUES (${usuario.id}, 'CDE Performance', 'Paraguai', 4.7, 'Tornearia e montagem do bloco — Ciudad del Este')
    RETURNING id
  `
  const [rockauto] = await sql`
    INSERT INTO fornecedores (usuario_id, nome, pais, avaliacao, link_rastreio)
    VALUES (${usuario.id}, 'RockAuto', 'Estados Unidos', 4.5, 'https://rockauto.com')
    RETURNING id
  `
  const [oficinaFoz] = await sql`
    INSERT INTO fornecedores (usuario_id, nome, pais, avaliacao)
    VALUES (${usuario.id}, 'Oficina Central Foz', 'Brasil', 4.8)
    RETURNING id
  `

  // ── Veículo 1: RX-8 K24 ───────────────────────────────────────────────
  const [rx8] = await sql`
    INSERT INTO veiculos (
      garagem_id, apelido, marca, modelo, ano_fabricacao, ano_modelo,
      perfil, status, visibilidade, meta_potencia_whp
    ) VALUES (
      ${garagem.id}, 'RX-8 K24', 'Mazda', 'RX-8', 2006, 2006,
      'street_build', 'em_andamento', 'publico', 370
    )
    RETURNING id
  `

  const fa01 = await inserirFase(rx8.id, "Fase 1 — Mecânica e swap", 1, "andamento", 7200, 9800, "USD")
  const fa02 = await inserirFase(rx8.id, "Fase 1b — Combustível e arrefecimento", 2, "planejado", 1530, 2040, "USD")
  const fa03 = await inserirFase(rx8.id, "Fase 1c — Eletrônica e integração", 3, "planejado", 1450, 2000, "USD")
  const fa04 = await inserirFase(rx8.id, "Fase 1d — Mão de obra (Ciudad del Este)", 4, "planejado", 1500, 2450, "USD")
  const fa05 = await inserirFase(
    rx8.id, "Fase 2 — Estética", 5, "planejado", 800, 1500, "USD",
    "Bodykit depois que o motor estiver 100% — não faz sentido colocar antes de abrir o cofre para ajustes."
  )
  const fa06 = await inserirFase(
    rx8.id, "Fase 3 — Turbo (meta 370 whp)", 6, "planejado", 1990, 3070, "USD",
    "Só após 6–9 meses dominando o carro no aspirado. Sistema de combustível já dimensionado desde a fase 1."
  )

  // Fase 1 — Mecânica e swap
  await inserirItem(fa01, "Mazda RX-8 rolling shell", "Motor rotativo quebrado, preferencialmente manual", 2500, 3500, "USD", "andamento")
  await inserirItem(fa01, "Bloco Honda K24", "K24A2 ou K24A4 (Accord / CR-V)", 600, 800, "USD", "planejado")
  await inserirItem(fa01, "Cabeçote Honda K20", "K20Z3 ou K20A2 — fluxo cruzado com VTC", 500, 700, "USD", "planejado")
  await inserirItem(fa01, "Câmbio BMW ZF6", "E36/E46 — 6 marchas para uso diário", 300, 500, "USD", "planejado")
  await inserirItem(fa01, "Kit adapter plate K-Series → ZF", "Flange de alumínio + volante customizado", 500, 650, "USD", "planejado", cde.id)
  await inserirItem(fa01, "Kit de embreagem", "Platô alta carga + disco com estria BMW", 350, 450, "USD", "planejado")
  await inserirItem(fa01, "Eixo cardã customizado", "Balanceado a laser — tornearia CDE", 200, 300, "USD", "planejado", cde.id)
  await inserirItem(fa01, "PPF delete + suporte diferencial", "Viga tubular — atenção estrutural obrigatória", 150, 250, "USD", "planejado")
  await inserirItem(fa01, "Suportes de motor e câmbio", "Coxins PU + aço tubular sob medida", 200, 300, "USD", "planejado")

  // Fase 1b — Combustível e arrefecimento
  await inserirItem(fa02, "Bicos injetores 1000cc", "Bosch EV14 alta impedância — future-proof turbo", 350, 450, "USD", "planejado", rockauto.id)
  await inserirItem(fa02, "Bomba Walbro / AEM 340 LPH", "Compatível com E100", 130, 160, "USD", "planejado")
  await inserirItem(fa02, "Flauta alumínio billet AN8", "Alto fluxo", 80, 120, "USD", "planejado")
  await inserirItem(fa02, "Dosador combustível 1:1", "Aeromotive ou FuelTech", 120, 160, "USD", "planejado")
  await inserirItem(fa02, "Linhas PTFE AN8/AN6", "Malha inox — zero cheiro na cabine", 150, 200, "USD", "planejado")
  await inserirItem(fa02, "Radiador alumínio upgrade", "Alta capacidade + ventoinhas SPAL finas", 200, 300, "USD", "planejado")
  await inserirItem(fa02, "Oil cooler AN (track day)", "Crítico para uso em pista — não estava no plano original", 150, 250, "USD", "planejado")
  await inserirItem(fa02, "Termostato de abertura baixa", "Abertura mais cedo para arrefecimento eficiente", 30, 50, "USD", "planejado")
  await inserirItem(fa02, "Adaptação ar-condicionado", "Suporte compressor K24 + mangueiras Mazda", 150, 250, "USD", "planejado", oficinaFoz.id)

  // Fase 1c — Eletrônica e integração
  await inserirItem(fa03, "MaxxECU Race", "Logging completo via celular/tablet — sem display dedicado", 800, 1200, "USD", "planejado")
  await inserirItem(fa03, "Módulo CAN Bus RX-8", "Integração painel + direção elétrica — verificar expertise Mazda em CDE", 150, 300, "USD", "planejado", cde.id)
  await inserirItem(fa03, "Sonda lambda wideband", "Bosch LSU 4.9 + condicionador Nano", 150, 200, "USD", "planejado")
  await inserirItem(fa03, "Chicote elétrico custom (wire tuck)", "Malha náutica, relés estado sólido, conectores novos", 200, 300, "USD", "planejado")
  await inserirItem(fa03, "Mantas térmicas + fita titânio", "Isolamento de calor + proteção ao passageiro", 80, 120, "USD", "planejado")

  // Fase 1d — Mão de obra (Ciudad del Este)
  await inserirItem(fa04, "Montagem do bloco", "Medição de folgas, ring gapping, torquímetro de precisão", 300, 500, "USD", "planejado", cde.id)
  await inserirItem(fa04, "Mecânica geral do swap", "Retirar rotativo, alinhar K24+ZF, periféricos", 500, 800, "USD", "planejado", cde.id)
  await inserirItem(fa04, "Elétrica e chicote", "Fiação náutica do zero, MaxxECU integrada à rede CAN", 300, 500, "USD", "planejado", cde.id)
  await inserirItem(fa04, "Tornearia e solda TIG/MIG", "Adaptações imprevistas + PPF delete final", 150, 250, "USD", "planejado", cde.id)
  await inserirItem(fa04, "Acerto de injeção — dyno aspirado", "Mapa partida a frio + mapa base aspirado", 250, 400, "USD", "planejado")

  // Fase 2 — Estética
  await inserirItem(fa05, "Bodykit réplica RE Amemiya (FRP)", "Para-choque dianteiro + saias + traseiro", 600, 1000, "USD", "planejado")
  await inserirItem(fa05, "Aerofólio GT Wing", "Pescoço baixo e largo — proporcional ao perfil do RX-8", 150, 300, "USD", "planejado")
  await inserirItem(fa05, "Envelope / wrap", "Preto cetim como base — a definir após pesquisa de referência", 400, 700, "USD", "planejado")

  // Fase 3 — Turbo
  await inserirItem(fa06, "Turbina Pulsar G30-770", "Médio porte — torque rápido sem lag absurdo", 600, 900, "USD", "planejado")
  await inserirItem(fa06, "Coletor turbo inox", "Sidewinder ou bottom mount — desviando da coluna de direção", 400, 600, "USD", "planejado")
  await inserirItem(fa06, "Wastegate 44/45mm V-Band", "TiAL ou Turbosmart", 150, 250, "USD", "planejado")
  await inserirItem(fa06, "BOV 50mm", "Alívio de pressão ao soltar o acelerador", 100, 150, "USD", "planejado")
  await inserirItem(fa06, "Intercooler frontal FMIC", "Bar and plate alta densidade para o para-choque do RX-8", 150, 250, "USD", "planejado")
  await inserirItem(fa06, "Kit piping pressurização", "Alumínio + mangotes silicone + T-clamp", 150, 200, "USD", "planejado")
  await inserirItem(fa06, "Linhas óleo turbina AN4/AN10", "Alimentação e retorno para o cárter", 60, 100, "USD", "planejado")
  await inserirItem(fa06, "Downpipe + escape inox 3pol", "Dois abafadores — som saudável, não de trator", 400, 600, "USD", "planejado")
  await inserirItem(fa06, "Acerto dyno fase turbo", "Mapa completo em E100 com margem de segurança", 250, 400, "USD", "planejado")

  // ── Veículo 2: Civic do dia a dia ──────────────────────────────────────
  const [civic] = await sql`
    INSERT INTO veiculos (
      garagem_id, apelido, marca, modelo, ano_fabricacao, ano_modelo,
      perfil, status, visibilidade
    ) VALUES (
      ${garagem.id}, 'Civic do dia a dia', 'Honda', 'Civic LXS', 2019, 2019,
      'daily', 'concluido', 'privado'
    )
    RETURNING id
  `

  const fa07 = await inserirFase(civic.id, "Revisão geral e itens de conforto", 1, "concluido", 2200, 2200, "BRL")

  await inserirItem(fa07, "Kit revisão completa", "Filtros, óleo sintético, velas", 850, 850, "BRL", "concluido", oficinaFoz.id)
  await inserirItem(fa07, "Som e multimídia", "Central multimídia + par de alto-falantes", 900, 900, "BRL", "concluido")
  await inserirItem(fa07, "Película e insulfilm", "Vidros + para-brisa", 450, 450, "BRL", "concluido")

  console.log("✔ Seed concluído.")
  console.log(`  Login: ${SEED_EMAIL} / ${SEED_PASSWORD}`)
  await sql.end()
}

seed().catch((err) => {
  console.error("✖ Seed falhou:", err)
  process.exit(1)
})
