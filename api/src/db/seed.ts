import { sql } from "./client.ts"
import bcrypt from "bcryptjs"

const SEED_EMAIL = "guilherme@pinedevs.com.br"
const SEED_NOME  = "Guilherme Pinheiro"
const SEED_SENHA = "Guierme00!!"

async function seed() {
  console.log("▶ Rodando seed...")

  // ── Guilherme ──────────────────────────────────────────────────────────────
  let [u] = await sql`SELECT id FROM usuarios WHERE email = ${SEED_EMAIL}`
  if (!u) {
    const h = await bcrypt.hash(SEED_SENHA, 12)
    ;[u] = await sql`
      INSERT INTO usuarios (nome, email, hashed_password)
      VALUES (${SEED_NOME}, ${SEED_EMAIL}, ${h})
      RETURNING id
    `
    console.log(`  ✓ Usuário criado: ${SEED_EMAIL}`)
  } else {
    console.log(`  · Usuário já existe: ${SEED_EMAIL}`)
  }
  const userId = u.id

  let [garagem] = await sql`SELECT id FROM garagens WHERE usuario_id = ${userId}`
  if (!garagem) {
    ;[garagem] = await sql`
      INSERT INTO garagens (usuario_id, nome, slug)
      VALUES (${userId}, ${"Garagem do Gui"}, ${"garagem-do-gui"})
      RETURNING id
    `
    console.log(`  ✓ Garagem criada`)
  }
  const garagemId = garagem.id

  // Fornecedores
  let fCDE: { id: string }, fRockAuto: { id: string }, fOficina: { id: string }
  const fornExist = await sql`SELECT id, nome FROM fornecedores WHERE usuario_id = ${userId}`
  if (fornExist.length === 0) {
    ;[fCDE] = await sql`
      INSERT INTO fornecedores (usuario_id, nome, pais, avaliacao, observacoes)
      VALUES (${userId}, ${"CDE Performance"}, ${"PY"}, ${4.7}, ${"Tornearia e montagem do bloco — Ciudad del Este"})
      RETURNING id
    `
    ;[fRockAuto] = await sql`
      INSERT INTO fornecedores (usuario_id, nome, pais, avaliacao, link_rastreio)
      VALUES (${userId}, ${"RockAuto"}, ${"US"}, ${4.5}, ${"https://rockauto.com"})
      RETURNING id
    `
    ;[fOficina] = await sql`
      INSERT INTO fornecedores (usuario_id, nome, pais, avaliacao)
      VALUES (${userId}, ${"Oficina Central Foz"}, ${"BR"}, ${4.8})
      RETURNING id
    `
    console.log(`  ✓ 3 fornecedores criados`)
  } else {
    fCDE      = fornExist.find((f: {nome: string; id: string}) => f.nome === "CDE Performance")     ?? fornExist[0]
    fRockAuto = fornExist.find((f: {nome: string; id: string}) => f.nome === "RockAuto")             ?? fornExist[0]
    fOficina  = fornExist.find((f: {nome: string; id: string}) => f.nome === "Oficina Central Foz") ?? fornExist[0]
  }
  const F = { cde: fCDE!.id, rockauto: fRockAuto!.id, oficina: fOficina!.id }

  // ── Veículos (só insere se a garagem está vazia) ──────────────────────────
  const [vCount] = await sql`SELECT COUNT(*)::int as n FROM veiculos WHERE garagem_id = ${garagemId}`
  if (vCount.n === 0) {
    const [rx8] = await sql`
      INSERT INTO veiculos (garagem_id, apelido, marca, modelo, ano_fabricacao, ano_modelo, perfil, status, visibilidade, meta_potencia_whp)
      VALUES (${garagemId}, ${"RX-8 K24"}, ${"Mazda"}, ${"RX-8"}, ${2006}, ${2006}, ${"street_build"}, ${"em_andamento"}, ${"publico"}, ${370})
      RETURNING id
    `
    const rx8Id = rx8.id

    const [fa01] = await sql`INSERT INTO fases (veiculo_id, titulo, ordem, status, orcamento_min, orcamento_max, moeda) VALUES (${rx8Id}, ${"Fase 1 — Mecânica e swap"}, ${1}, ${"andamento"}, ${7200}, ${9800}, ${"USD"}) RETURNING id`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa01.id}, ${"Mazda RX-8 rolling shell"}, ${"Motor rotativo quebrado, preferencialmente manual"}, ${2500}, ${3500}, ${"USD"}, ${"andamento"})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa01.id}, ${"Bloco Honda K24"}, ${"K24A2 ou K24A4"}, ${600}, ${800}, ${"USD"}, ${"planejado"})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa01.id}, ${"Cabeçote Honda K20"}, ${"K20Z3 ou K20A2"}, ${500}, ${700}, ${"USD"}, ${"planejado"})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa01.id}, ${"Câmbio BMW ZF6"}, ${"E36/E46 — 6 marchas"}, ${300}, ${500}, ${"USD"}, ${"planejado"})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id) VALUES (${fa01.id}, ${"Kit adapter plate K-Series → ZF"}, ${"Flange de alumínio + volante customizado"}, ${500}, ${650}, ${"USD"}, ${"planejado"}, ${F.cde})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa01.id}, ${"Kit de embreagem"}, ${"Platô alta carga"}, ${350}, ${450}, ${"USD"}, ${"planejado"})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id) VALUES (${fa01.id}, ${"Eixo cardã customizado"}, ${"Balanceado a laser — tornearia CDE"}, ${200}, ${300}, ${"USD"}, ${"planejado"}, ${F.cde})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa01.id}, ${"PPF delete + suporte diferencial"}, ${"Viga tubular"}, ${150}, ${250}, ${"USD"}, ${"planejado"})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa01.id}, ${"Suportes de motor e câmbio"}, ${"Coxins PU + aço tubular"}, ${200}, ${300}, ${"USD"}, ${"planejado"})`

    const [fa02] = await sql`INSERT INTO fases (veiculo_id, titulo, ordem, status, orcamento_min, orcamento_max, moeda) VALUES (${rx8Id}, ${"Fase 1b — Combustível e arrefecimento"}, ${2}, ${"planejado"}, ${1530}, ${2040}, ${"USD"}) RETURNING id`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id) VALUES (${fa02.id}, ${"Bicos injetores 1000cc"}, ${"Bosch EV14"}, ${350}, ${450}, ${"USD"}, ${"planejado"}, ${F.rockauto})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa02.id}, ${"Bomba Walbro 340 LPH"}, ${"Compatível com E100"}, ${130}, ${160}, ${"USD"}, ${"planejado"})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa02.id}, ${"Flauta alumínio billet AN8"}, ${"Alto fluxo"}, ${80}, ${120}, ${"USD"}, ${"planejado"})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa02.id}, ${"Radiador alumínio upgrade"}, ${"Alta capacidade + ventoinhas SPAL"}, ${200}, ${300}, ${"USD"}, ${"planejado"})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id) VALUES (${fa02.id}, ${"Adaptação ar-condicionado"}, ${"Suporte compressor K24"}, ${150}, ${250}, ${"USD"}, ${"planejado"}, ${F.oficina})`

    const [fa03] = await sql`INSERT INTO fases (veiculo_id, titulo, ordem, status, orcamento_min, orcamento_max, moeda) VALUES (${rx8Id}, ${"Fase 1c — Eletrônica"}, ${3}, ${"planejado"}, ${1450}, ${2000}, ${"USD"}) RETURNING id`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa03.id}, ${"MaxxECU Race"}, ${"Logging via celular"}, ${800}, ${1200}, ${"USD"}, ${"planejado"})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa03.id}, ${"Sonda lambda wideband"}, ${"Bosch LSU 4.9"}, ${150}, ${200}, ${"USD"}, ${"planejado"})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa03.id}, ${"Chicote elétrico custom"}, ${"Malha náutica, wire tuck"}, ${200}, ${300}, ${"USD"}, ${"planejado"})`

    const [fa06] = await sql`INSERT INTO fases (veiculo_id, titulo, ordem, status, orcamento_min, orcamento_max, moeda, nota) VALUES (${rx8Id}, ${"Fase 3 — Turbo (meta 370 whp)"}, ${6}, ${"planejado"}, ${1990}, ${3070}, ${"USD"}, ${"Só após 6–9 meses dominando o carro no aspirado."}) RETURNING id`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa06.id}, ${"Turbina Pulsar G30-770"}, ${"Torque rápido sem lag"}, ${600}, ${900}, ${"USD"}, ${"planejado"})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa06.id}, ${"Coletor turbo inox"}, ${"Sidewinder ou bottom mount"}, ${400}, ${600}, ${"USD"}, ${"planejado"})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa06.id}, ${"Wastegate 44mm V-Band"}, ${"TiAL ou Turbosmart"}, ${150}, ${250}, ${"USD"}, ${"planejado"})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa06.id}, ${"Intercooler frontal FMIC"}, ${"Bar and plate alta densidade"}, ${150}, ${250}, ${"USD"}, ${"planejado"})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa06.id}, ${"Downpipe + escape inox 3pol"}, ${"Dois abafadores"}, ${400}, ${600}, ${"USD"}, ${"planejado"})`

    const [civic] = await sql`
      INSERT INTO veiculos (garagem_id, apelido, marca, modelo, ano_fabricacao, ano_modelo, perfil, status, visibilidade)
      VALUES (${garagemId}, ${"Civic do dia a dia"}, ${"Honda"}, ${"Civic LXS"}, ${2019}, ${2019}, ${"daily"}, ${"concluido"}, ${"privado"})
      RETURNING id
    `
    const [fa07] = await sql`INSERT INTO fases (veiculo_id, titulo, ordem, status, orcamento_min, orcamento_max, moeda) VALUES (${civic.id}, ${"Revisão geral"}, ${1}, ${"concluido"}, ${2200}, ${2200}, ${"BRL"}) RETURNING id`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id) VALUES (${fa07.id}, ${"Kit revisão completa"}, ${"Filtros, óleo, velas"}, ${850}, ${850}, ${"BRL"}, ${"concluido"}, ${F.oficina})`
    await sql`INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status) VALUES (${fa07.id}, ${"Som e multimídia"}, ${"Central + alto-falantes"}, ${900}, ${900}, ${"BRL"}, ${"concluido"})`
    console.log(`  ✓ Veículos criados (RX-8 K24 + Civic)`)
  } else {
    console.log(`  · Veículos já existem (${vCount.n})`)
  }

  // ── Marketplace — Guilherme ────────────────────────────────────────────────
  const [aGui] = await sql`SELECT COUNT(*)::int as n FROM marketplace_anuncios WHERE garagem_id = ${garagemId}`
  if (aGui.n === 0) {
    await sql`
      INSERT INTO marketplace_anuncios (garagem_id, titulo, descricao, preco, moeda, categoria, condicao, localizacao, status)
      VALUES
        (${garagemId}, ${"Wastegate TiAL 44mm V-Band"}, ${"Usada 3 meses, excelente estado. Mola original + peças de reposição."}, ${850}, ${"BRL"}, ${"motor"}, ${"usado"}, ${"Foz do Iguaçu, PR"}, ${"ativo"}),
        (${garagemId}, ${"Câmbio BMW ZF6 E36 6 marchas"}, ${"Funcionando 100%. Ideal para swap K-Series. Acompanha alavanca e tapa-caixa."}, ${2200}, ${"BRL"}, ${"outro"}, ${"usado"}, ${"Foz do Iguaçu, PR"}, ${"ativo"})
    `
    console.log(`  ✓ 2 anúncios do Guilherme`)
  } else {
    console.log(`  · Anúncios do Guilherme já existem (${aGui.n})`)
  }

  // ── Lucas Mendes (SP) ─────────────────────────────────────────────────────
  let [lucas] = await sql`SELECT id FROM usuarios WHERE email = 'lucas.mendes@autohub.dev'`
  if (!lucas) {
    const h = await bcrypt.hash("Lucas@seed123", 10)
    ;[lucas] = await sql`
      INSERT INTO usuarios (nome, email, hashed_password, email_verificado)
      VALUES (${"Lucas Mendes"}, ${"lucas.mendes@autohub.dev"}, ${h}, ${true})
      RETURNING id
    `
    const [gLucas] = await sql`
      INSERT INTO garagens (usuario_id, nome, slug, publica, bio)
      VALUES (${lucas.id}, ${"LM Tuning SP"}, ${"lm-tuning-sp"}, ${true}, ${"Civic K-Swap e turbo builds. São Paulo capital."})
      RETURNING id
    `
    const expiry = new Date(Date.now() + 30 * 86400000).toISOString()
    await sql`
      INSERT INTO marketplace_anuncios (garagem_id, titulo, descricao, preco, moeda, categoria, condicao, localizacao, status, patrocinado, patrocinado_ate)
      VALUES
        (${gLucas.id}, ${"Kit turbo GT2860RS completo + piping alumínio"}, ${"Turbina Garrett GT2860RS, coletor inox, wastegate Turbosmart 40mm, downpipe 3\", piping 2.5\", silicones azuis. Nunca acertado em dyno."}, ${4500}, ${"BRL"}, ${"motor"}, ${"usado"}, ${"São Paulo, SP"}, ${"ativo"}, ${true}, ${expiry}),
        (${gLucas.id}, ${"Radiador alumínio 3 fileiras Civic 96-00"}, ${"Alta performance, sem vazamentos, testado."}, ${380}, ${"BRL"}, ${"motor"}, ${"usado"}, ${"São Paulo, SP"}, ${"ativo"}, ${false}, ${null}),
        (${gLucas.id}, ${"Bicos injetores Bosch 1000cc EV14 (jogo 4)"}, ${"Alta impedância, plug-and-play K-Series. Limpados e testados, flow match garantido."}, ${650}, ${"BRL"}, ${"motor"}, ${"usado"}, ${"São Paulo, SP"}, ${"ativo"}, ${false}, ${null})
    `
    console.log(`  ✓ Lucas Mendes + garagem + 3 anúncios (1 patrocinado)`)
  } else {
    console.log(`  · Lucas já existe`)
  }

  // ── Rafaela Costa (RJ) ───────────────────────────────────────────────────
  let [rafa] = await sql`SELECT id FROM usuarios WHERE email = 'rafaela.costa@autohub.dev'`
  if (!rafa) {
    const h = await bcrypt.hash("Rafa@seed123", 10)
    ;[rafa] = await sql`
      INSERT INTO usuarios (nome, email, hashed_password, email_verificado)
      VALUES (${"Rafaela Costa"}, ${"rafaela.costa@autohub.dev"}, ${h}, ${true})
      RETURNING id
    `
    const [gRafa] = await sql`
      INSERT INTO garagens (usuario_id, nome, slug, publica, bio)
      VALUES (${rafa.id}, ${"Rafa Builds"}, ${"rafa-builds"}, ${true}, ${"EK Civic time attack. Rio de Janeiro."})
      RETURNING id
    `
    await sql`
      INSERT INTO marketplace_anuncios (garagem_id, titulo, descricao, preco, moeda, categoria, condicao, localizacao, status)
      VALUES
        (${gRafa.id}, ${"Rodas ENKEI TS9 17x7 5x114 gunmetal (jogo 4)"}, ${"1 temporada de track day. Sem amassados. Pneus com 60% (Hankook RS4)."}, ${3200}, ${"BRL"}, ${"rodas"}, ${"usado"}, ${"Rio de Janeiro, RJ"}, ${"ativo"}),
        (${gRafa.id}, ${"Coilover Tein Flex Z Honda Civic EK/EJ"}, ${"Revisada com kits da Tein. Altura e amortecimento ajustáveis."}, ${2800}, ${"BRL"}, ${"suspensao"}, ${"recondicionado"}, ${"Rio de Janeiro, RJ"}, ${"ativo"}),
        (${gRafa.id}, ${"Kit freio esportivo traseiro Civic EK (novo)"}, ${"Discos perfurados+ranhados + pastilhas cerâmicas. Nunca instalado. NF disponível."}, ${950}, ${"BRL"}, ${"freios"}, ${"novo"}, ${"Rio de Janeiro, RJ"}, ${"ativo"})
    `
    console.log(`  ✓ Rafaela Costa + garagem + 3 anúncios`)
  } else {
    console.log(`  · Rafaela já existe`)
  }

  console.log("✔ Seed concluído.")
}

seed().catch((err) => {
  console.error("✖ Seed falhou:", err)
  process.exit(1)
})
