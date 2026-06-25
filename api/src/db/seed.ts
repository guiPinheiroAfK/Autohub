/**
 * seed.ts — popula o banco com usuário, garagem, veículos, fases e itens reais.
 * Idempotente: verifica pelo e-mail antes de inserir qualquer coisa.
 * Roda via `bun run seed` (após migrate).
 */

import { sql } from "./client"
import bcrypt from "bcryptjs"

const SEED_EMAIL = "guilherme@pinedevs.com.br"
const SEED_NOME = "Guilherme Pinheiro"
const SEED_SENHA = "Guierme00!!"

async function seed() {
  console.log("▶ Rodando seed...")

  // ── Idempotência ──────────────────────────────────────────────────────────
  const [existe] = await sql`SELECT id FROM usuarios WHERE email = ${SEED_EMAIL}`
  if (existe) {
    console.log("✔ Seed já aplicado — nada a fazer.")
    await sql.end()
    return
  }

  // ── Usuário ───────────────────────────────────────────────────────────────
  const hashed = await bcrypt.hash(SEED_SENHA, 12)
  const [usuario] = await sql`
    INSERT INTO usuarios (nome, email, hashed_password)
    VALUES (${SEED_NOME}, ${SEED_EMAIL}, ${hashed})
      RETURNING id
  `
  const userId = usuario.id
  console.log(`  ✓ Usuário criado: ${SEED_EMAIL}`)

  // ── Garagem ───────────────────────────────────────────────────────────────
  const [garagem] = await sql`
    INSERT INTO garagens (usuario_id, nome, slug)
    VALUES (${userId}, ${"Garagem do Gui"}, ${"garagem-do-gui"})
      RETURNING id
  `
  const garagemId = garagem.id
  console.log(`  ✓ Garagem criada: Garagem do Gui`)

  // ── Fornecedores ──────────────────────────────────────────────────────────
  const [fCDE] = await sql`
    INSERT INTO fornecedores (usuario_id, nome, pais, avaliacao, observacoes)
    VALUES (${userId}, ${"CDE Performance"}, ${"PY"}, ${4.7}, ${"Tornearia e montagem do bloco — Ciudad del Este"})
      RETURNING id
  `
  const [fRockAuto] = await sql`
    INSERT INTO fornecedores (usuario_id, nome, pais, avaliacao, link_rastreio)
    VALUES (${userId}, ${"RockAuto"}, ${"US"}, ${4.5}, ${"https://rockauto.com"})
      RETURNING id
  `
  const [fOficina] = await sql`
    INSERT INTO fornecedores (usuario_id, nome, pais, avaliacao)
    VALUES (${userId}, ${"Oficina Central Foz"}, ${"BR"}, ${4.8})
      RETURNING id
  `
  console.log(`  ✓ 3 fornecedores criados`)

  const F = { cde: fCDE.id, rockauto: fRockAuto.id, oficina: fOficina.id }

  // ─────────────────────────────────────────────────────────────────────────
  // VEÍCULO 1 — RX-8 K24
  // ─────────────────────────────────────────────────────────────────────────
  const [rx8] = await sql`
    INSERT INTO veiculos (garagem_id, apelido, marca, modelo, ano_fabricacao, ano_modelo,
                          perfil, status, visibilidade, meta_potencia_whp)
    VALUES (${garagemId}, ${"RX-8 K24"}, ${"Mazda"}, ${"RX-8"},
            ${2006}, ${2006}, ${"street_build"}, ${"em_andamento"}, ${"publico"}, ${370})
      RETURNING id
  `
  const rx8Id = rx8.id
  console.log(`  ✓ Veículo: RX-8 K24`)

  // Fase 1 — Mecânica e swap
  const [fa01] = await sql`
    INSERT INTO fases (veiculo_id, titulo, ordem, status, orcamento_min, orcamento_max, moeda)
    VALUES (${rx8Id}, ${"Fase 1 — Mecânica e swap"}, ${1}, ${"andamento"}, ${7200}, ${9800}, ${"USD"})
      RETURNING id
  `
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa01.id}, ${"Mazda RX-8 rolling shell"}, ${"Motor rotativo quebrado, preferencialmente manual"}, ${2500}, ${3500}, ${"USD"}, ${"andamento"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa01.id}, ${"Bloco Honda K24"}, ${"K24A2 ou K24A4 (Accord / CR-V)"}, ${600}, ${800}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa01.id}, ${"Cabeçote Honda K20"}, ${"K20Z3 ou K20A2 — fluxo cruzado com VTC"}, ${500}, ${700}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa01.id}, ${"Câmbio BMW ZF6"}, ${"E36/E46 — 6 marchas para uso diário"}, ${300}, ${500}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id) VALUES
    (${fa01.id}, ${"Kit adapter plate K-Series → ZF"}, ${"Flange de alumínio + volante customizado"}, ${500}, ${650}, ${"USD"}, ${"planejado"}, ${F.cde})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa01.id}, ${"Kit de embreagem"}, ${"Platô alta carga + disco com estria BMW"}, ${350}, ${450}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id) VALUES
    (${fa01.id}, ${"Eixo cardã customizado"}, ${"Balanceado a laser — tornearia CDE"}, ${200}, ${300}, ${"USD"}, ${"planejado"}, ${F.cde})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa01.id}, ${"PPF delete + suporte diferencial"}, ${"Viga tubular — atenção estrutural obrigatória"}, ${150}, ${250}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa01.id}, ${"Suportes de motor e câmbio"}, ${"Coxins PU + aço tubular sob medida"}, ${200}, ${300}, ${"USD"}, ${"planejado"})`

  // Fase 1b — Combustível e arrefecimento
  const [fa02] = await sql`
    INSERT INTO fases (veiculo_id, titulo, ordem, status, orcamento_min, orcamento_max, moeda)
    VALUES (${rx8Id}, ${"Fase 1b — Combustível e arrefecimento"}, ${2}, ${"planejado"}, ${1530}, ${2040}, ${"USD"})
      RETURNING id
  `
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id) VALUES
    (${fa02.id}, ${"Bicos injetores 1000cc"}, ${"Bosch EV14 alta impedância — future-proof turbo"}, ${350}, ${450}, ${"USD"}, ${"planejado"}, ${F.rockauto})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa02.id}, ${"Bomba Walbro / AEM 340 LPH"}, ${"Compatível com E100"}, ${130}, ${160}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa02.id}, ${"Flauta alumínio billet AN8"}, ${"Alto fluxo"}, ${80}, ${120}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa02.id}, ${"Dosador combustível 1:1"}, ${"Aeromotive ou FuelTech"}, ${120}, ${160}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa02.id}, ${"Linhas PTFE AN8/AN6"}, ${"Malha inox — zero cheiro na cabine"}, ${150}, ${200}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa02.id}, ${"Radiador alumínio upgrade"}, ${"Alta capacidade + ventoinhas SPAL finas"}, ${200}, ${300}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa02.id}, ${"Oil cooler AN (track day)"}, ${"Crítico para uso em pista — não estava no plano original"}, ${150}, ${250}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa02.id}, ${"Termostato de abertura baixa"}, ${"Abertura mais cedo para arrefecimento eficiente"}, ${30}, ${50}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id) VALUES
    (${fa02.id}, ${"Adaptação ar-condicionado"}, ${"Suporte compressor K24 + mangueiras Mazda"}, ${150}, ${250}, ${"USD"}, ${"planejado"}, ${F.oficina})`

  // Fase 1c — Eletrônica e integração
  const [fa03] = await sql`
    INSERT INTO fases (veiculo_id, titulo, ordem, status, orcamento_min, orcamento_max, moeda)
    VALUES (${rx8Id}, ${"Fase 1c — Eletrônica e integração"}, ${3}, ${"planejado"}, ${1450}, ${2000}, ${"USD"})
      RETURNING id
  `
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa03.id}, ${"MaxxECU Race"}, ${"Logging completo via celular/tablet — sem display dedicado"}, ${800}, ${1200}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id) VALUES
    (${fa03.id}, ${"Módulo CAN Bus RX-8"}, ${"Integração painel + direção elétrica — verificar expertise Mazda em CDE"}, ${150}, ${300}, ${"USD"}, ${"planejado"}, ${F.cde})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa03.id}, ${"Sonda lambda wideband"}, ${"Bosch LSU 4.9 + condicionador Nano"}, ${150}, ${200}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa03.id}, ${"Chicote elétrico custom (wire tuck)"}, ${"Malha náutica, relés estado sólido, conectores novos"}, ${200}, ${300}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa03.id}, ${"Mantas térmicas + fita titânio"}, ${"Isolamento de calor + proteção ao passageiro"}, ${80}, ${120}, ${"USD"}, ${"planejado"})`

  // Fase 1d — Mão de obra
  const [fa04] = await sql`
    INSERT INTO fases (veiculo_id, titulo, ordem, status, orcamento_min, orcamento_max, moeda)
    VALUES (${rx8Id}, ${"Fase 1d — Mão de obra (Ciudad del Este)"}, ${4}, ${"planejado"}, ${1500}, ${2450}, ${"USD"})
      RETURNING id
  `
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id) VALUES
    (${fa04.id}, ${"Montagem do bloco"}, ${"Medição de folgas, ring gapping, torquímetro de precisão"}, ${300}, ${500}, ${"USD"}, ${"planejado"}, ${F.cde})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id) VALUES
    (${fa04.id}, ${"Mecânica geral do swap"}, ${"Retirar rotativo, alinhar K24+ZF, periféricos"}, ${500}, ${800}, ${"USD"}, ${"planejado"}, ${F.cde})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id) VALUES
    (${fa04.id}, ${"Elétrica e chicote"}, ${"Fiação náutica do zero, MaxxECU integrada à rede CAN"}, ${300}, ${500}, ${"USD"}, ${"planejado"}, ${F.cde})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id) VALUES
    (${fa04.id}, ${"Tornearia e solda TIG/MIG"}, ${"Adaptações imprevistas + PPF delete final"}, ${150}, ${250}, ${"USD"}, ${"planejado"}, ${F.cde})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa04.id}, ${"Acerto de injeção — dyno aspirado"}, ${"Mapa partida a frio + mapa base aspirado"}, ${250}, ${400}, ${"USD"}, ${"planejado"})`

  // Fase 2 — Estética
  const [fa05] = await sql`
    INSERT INTO fases (veiculo_id, titulo, ordem, status, orcamento_min, orcamento_max, moeda, nota)
    VALUES (${rx8Id}, ${"Fase 2 — Estética"}, ${5}, ${"planejado"}, ${800}, ${1500}, ${"USD"},
            ${"Bodykit depois que o motor estiver 100% — não faz sentido colocar antes de abrir o cofre para ajustes."})
      RETURNING id
  `
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa05.id}, ${"Bodykit réplica RE Amemiya (FRP)"}, ${"Para-choque dianteiro + saias + traseiro"}, ${600}, ${1000}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa05.id}, ${"Aerofólio GT Wing"}, ${"Pescoço baixo e largo — proporcional ao perfil do RX-8"}, ${150}, ${300}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa05.id}, ${"Envelope / wrap"}, ${"Preto cetim como base — a definir após pesquisa de referência"}, ${400}, ${700}, ${"USD"}, ${"planejado"})`

  // Fase 3 — Turbo
  const [fa06] = await sql`
    INSERT INTO fases (veiculo_id, titulo, ordem, status, orcamento_min, orcamento_max, moeda, nota)
    VALUES (${rx8Id}, ${"Fase 3 — Turbo (meta 370 whp)"}, ${6}, ${"planejado"}, ${1990}, ${3070}, ${"USD"},
            ${"Só após 6–9 meses dominando o carro no aspirado. Sistema de combustível já dimensionado desde a fase 1."})
      RETURNING id
  `
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa06.id}, ${"Turbina Pulsar G30-770"}, ${"Médio porte — torque rápido sem lag absurdo"}, ${600}, ${900}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa06.id}, ${"Coletor turbo inox"}, ${"Sidewinder ou bottom mount — desviando da coluna de direção"}, ${400}, ${600}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa06.id}, ${"Wastegate 44/45mm V-Band"}, ${"TiAL ou Turbosmart"}, ${150}, ${250}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa06.id}, ${"BOV 50mm"}, ${"Alívio de pressão ao soltar o acelerador"}, ${100}, ${150}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa06.id}, ${"Intercooler frontal FMIC"}, ${"Bar and plate alta densidade para o para-choque do RX-8"}, ${150}, ${250}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa06.id}, ${"Kit piping pressurização"}, ${"Alumínio + mangotes silicone + T-clamp"}, ${150}, ${200}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa06.id}, ${"Linhas óleo turbina AN4/AN10"}, ${"Alimentação e retorno para o cárter"}, ${60}, ${100}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa06.id}, ${"Downpipe + escape inox 3pol"}, ${"Dois abafadores — som saudável, não de trator"}, ${400}, ${600}, ${"USD"}, ${"planejado"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa06.id}, ${"Acerto dyno fase turbo"}, ${"Mapa completo em E100 com margem de segurança"}, ${250}, ${400}, ${"USD"}, ${"planejado"})`

  console.log(`  ✓ RX-8 K24: 6 fases, 40 itens`)

  // ─────────────────────────────────────────────────────────────────────────
  // VEÍCULO 2 — Civic do dia a dia
  // ─────────────────────────────────────────────────────────────────────────
  const [civic] = await sql`
    INSERT INTO veiculos (garagem_id, apelido, marca, modelo, ano_fabricacao, ano_modelo,
                          perfil, status, visibilidade)
    VALUES (${garagemId}, ${"Civic do dia a dia"}, ${"Honda"}, ${"Civic LXS"},
            ${2019}, ${2019}, ${"daily"}, ${"concluido"}, ${"privado"})
      RETURNING id
  `
  const civicId = civic.id

  const [fa07] = await sql`
    INSERT INTO fases (veiculo_id, titulo, ordem, status, orcamento_min, orcamento_max, moeda)
    VALUES (${civicId}, ${"Revisão geral e itens de conforto"}, ${1}, ${"concluido"}, ${2200}, ${2200}, ${"BRL"})
      RETURNING id
  `
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id) VALUES
    (${fa07.id}, ${"Kit revisão completa"}, ${"Filtros, óleo sintético, velas"}, ${850}, ${850}, ${"BRL"}, ${"concluido"}, ${F.oficina})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa07.id}, ${"Som e multimídia"}, ${"Central multimídia + par de alto-falantes"}, ${900}, ${900}, ${"BRL"}, ${"concluido"})`
  await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES
    (${fa07.id}, ${"Película e insulfilm"}, ${"Vidros + para-brisa"}, ${450}, ${450}, ${"BRL"}, ${"concluido"})`

  console.log(`  ✓ Civic do dia a dia: 1 fase, 3 itens`)
  console.log("✔ Seed concluído.")
  await sql.end()
}

seed().catch((err) => {
  console.error("✖ Seed falhou:", err)
  process.exit(1)
})
