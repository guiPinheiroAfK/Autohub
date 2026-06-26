-- ============================================================
-- AutoHub — Seed de Garagens de Teste
-- Execute no Neon (SQL Editor) ou via psql
-- ============================================================
-- Cria 2 usuários com garagens públicas e 2 veículos cada.
-- Senhas: Autohub@123 (bcrypt hash pré-gerado)
-- ============================================================

BEGIN;

-- ── Usuário 1: Pedro Motta ────────────────────────────────────────────────────

INSERT INTO usuarios (id, nome, email, hashed_password, email_verificado)
VALUES (
  'seed-usr-pedro-0001',
  'Pedro Motta',
  'pedro.motta@test.autohub.app',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TIdp5B6Y3hILv3v7p2Z3EHX0wGm6', -- Autohub@123
  true
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO garagens (id, usuario_id, nome, slug, bio, publica)
VALUES (
  'seed-grg-pedro-0001',
  'seed-usr-pedro-0001',
  'Garagem do Pedro',
  'garagem-do-pedro',
  'Apaixonado por builds clássicos brasileiros. Fusca, Opala e tudo que tem história. 🇧🇷',
  true
)
ON CONFLICT (usuario_id) DO NOTHING;

-- Veículo 1 — Fusca Restomod
INSERT INTO veiculos (id, garagem_id, apelido, marca, modelo, ano_fabricacao, ano_modelo, perfil, status, visibilidade, meta_potencia_whp)
VALUES (
  'seed-vei-fusca-0001',
  'seed-grg-pedro-0001',
  'Fusca Restomod 73',
  'Volkswagen',
  'Fusca',
  1973, 1973,
  'restomod',
  'em_andamento',
  'publico',
  110
)
ON CONFLICT DO NOTHING;

INSERT INTO fases (id, veiculo_id, nome, ordem) VALUES
  ('seed-fas-fusca-01', 'seed-vei-fusca-0001', 'Motor AP 1.8 Turbo', 1),
  ('seed-fas-fusca-02', 'seed-vei-fusca-0001', 'Suspensão rebaixada + Monroe', 2),
  ('seed-fas-fusca-03', 'seed-vei-fusca-0001', 'Interior vintage restaurado', 3)
ON CONFLICT DO NOTHING;

INSERT INTO itens (id, fase_id, nome, status) VALUES
  ('seed-ite-f01-01', 'seed-fas-fusca-01', 'Bloco AP 1.8 preparado', 'concluido'),
  ('seed-ite-f01-02', 'seed-fas-fusca-01', 'Turbo GT28 + manifold', 'concluido'),
  ('seed-ite-f01-03', 'seed-fas-fusca-01', 'Intercooler frontal', 'em_andamento'),
  ('seed-ite-f01-04', 'seed-fas-fusca-01', 'Injeção programada', 'pendente'),
  ('seed-ite-f02-01', 'seed-fas-fusca-02', 'Molas esportivas -60mm', 'concluido'),
  ('seed-ite-f02-02', 'seed-fas-fusca-02', 'Amortecedores Monroe', 'concluido'),
  ('seed-ite-f02-03', 'seed-fas-fusca-02', 'Barras estabilizadoras', 'pendente'),
  ('seed-ite-f03-01', 'seed-fas-fusca-03', 'Bancos Recaro reestofados', 'concluido'),
  ('seed-ite-f03-02', 'seed-fas-fusca-03', 'Painel de madeira e gauges', 'em_andamento'),
  ('seed-ite-f03-03', 'seed-fas-fusca-03', 'Teto vinílico + som vintage', 'pendente')
ON CONFLICT DO NOTHING;

-- Veículo 2 — Opala SS Project
INSERT INTO veiculos (id, garagem_id, apelido, marca, modelo, ano_fabricacao, ano_modelo, perfil, status, visibilidade)
VALUES (
  'seed-vei-opala-0001',
  'seed-grg-pedro-0001',
  'Opala SS Project',
  'Chevrolet',
  'Opala',
  1975, 1975,
  'project',
  'planejamento',
  'publico'
)
ON CONFLICT DO NOTHING;

INSERT INTO fases (id, veiculo_id, nome, ordem) VALUES
  ('seed-fas-opala-01', 'seed-vei-opala-0001', 'Avaliação e compra de peças', 1),
  ('seed-fas-opala-02', 'seed-vei-opala-0001', 'Carroceria e funilaria', 2)
ON CONFLICT DO NOTHING;

INSERT INTO itens (id, fase_id, nome, status) VALUES
  ('seed-ite-o01-01', 'seed-fas-opala-01', 'Motor 4100 original localizado', 'concluido'),
  ('seed-ite-o01-02', 'seed-fas-opala-01', 'Kit SS original (emblemas/grade)', 'em_andamento'),
  ('seed-ite-o01-03', 'seed-fas-opala-01', 'Rodas Mangels 14" originais', 'pendente'),
  ('seed-ite-o02-01', 'seed-fas-opala-02', 'Avaliação de funileiro', 'pendente'),
  ('seed-ite-o02-02', 'seed-fas-opala-02', 'Trocas de soleiras', 'pendente')
ON CONFLICT DO NOTHING;

-- ── Usuário 2: Circuit Club SP ────────────────────────────────────────────────

INSERT INTO usuarios (id, nome, email, hashed_password, email_verificado)
VALUES (
  'seed-usr-circuit-0001',
  'Lucas Circuit',
  'lucas.circuit@test.autohub.app',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TIdp5B6Y3hILv3v7p2Z3EHX0wGm6', -- Autohub@123
  true
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO garagens (id, usuario_id, nome, slug, bio, publica)
VALUES (
  'seed-grg-circuit-0001',
  'seed-usr-circuit-0001',
  'Circuit Club SP',
  'circuit-club-sp',
  'Track builds e preparações de pista em São Paulo. Honda, Subaru e qualquer coisa que roda rápido. 🏁',
  true
)
ON CONFLICT (usuario_id) DO NOTHING;

-- Veículo 1 — Civic EG Track
INSERT INTO veiculos (id, garagem_id, apelido, marca, modelo, ano_fabricacao, ano_modelo, perfil, status, visibilidade, meta_potencia_whp)
VALUES (
  'seed-vei-civic-0001',
  'seed-grg-circuit-0001',
  'Civic EG Track',
  'Honda',
  'Civic',
  1994, 1994,
  'track',
  'concluido',
  'publico',
  185
)
ON CONFLICT DO NOTHING;

INSERT INTO fases (id, veiculo_id, nome, ordem) VALUES
  ('seed-fas-civic-01', 'seed-vei-civic-0001', 'Motor B18C preparado', 1),
  ('seed-fas-civic-02', 'seed-vei-civic-0001', 'Coilover + geometria de pista', 2),
  ('seed-fas-civic-03', 'seed-vei-civic-0001', 'Freios e segurança', 3),
  ('seed-fas-civic-04', 'seed-vei-civic-0001', 'Aerodinâmica', 4)
ON CONFLICT DO NOTHING;

INSERT INTO itens (id, fase_id, nome, status) VALUES
  ('seed-ite-c01-01', 'seed-fas-civic-01', 'B18C rebuild completo', 'concluido'),
  ('seed-ite-c01-02', 'seed-fas-civic-01', 'Cabeçote polido + cams Toda', 'concluido'),
  ('seed-ite-c01-03', 'seed-fas-civic-01', 'Injeção standalone Haltech', 'concluido'),
  ('seed-ite-c01-04', 'seed-fas-civic-01', 'Escapamento 4-1 Toda Racing', 'concluido'),
  ('seed-ite-c02-01', 'seed-fas-civic-02', 'Coilover Tein Flex Z', 'concluido'),
  ('seed-ite-c02-02', 'seed-fas-civic-02', 'Alinhamento e cambagem -2.5°', 'concluido'),
  ('seed-ite-c02-03', 'seed-fas-civic-02', 'Barra anti-rolagem dianteira', 'concluido'),
  ('seed-ite-c03-01', 'seed-fas-civic-03', 'Freios EBC + Brembo traseiro', 'concluido'),
  ('seed-ite-c03-02', 'seed-fas-civic-03', 'Gaiola FIA homologada', 'concluido'),
  ('seed-ite-c03-03', 'seed-fas-civic-03', 'Extinguidor + cinto 6 pontos', 'concluido'),
  ('seed-ite-c04-01', 'seed-fas-civic-04', 'Spoiler traseiro FRP', 'concluido'),
  ('seed-ite-c04-02', 'seed-fas-civic-04', 'Splitter dianteiro', 'concluido')
ON CONFLICT DO NOTHING;

-- Veículo 2 — Gol GTI Street
INSERT INTO veiculos (id, garagem_id, apelido, marca, modelo, ano_fabricacao, ano_modelo, perfil, status, visibilidade, meta_potencia_whp)
VALUES (
  'seed-vei-gol-0001',
  'seed-grg-circuit-0001',
  'Gol GTI Street Build',
  'Volkswagen',
  'Gol',
  1994, 1994,
  'street_build',
  'em_andamento',
  'publico',
  145
)
ON CONFLICT DO NOTHING;

INSERT INTO fases (id, veiculo_id, nome, ordem) VALUES
  ('seed-fas-gol-01', 'seed-vei-gol-0001', 'Motor AP 2.0 8v preparado', 1),
  ('seed-fas-gol-02', 'seed-vei-gol-0001', 'Suspensão e visual', 2),
  ('seed-fas-gol-03', 'seed-vei-gol-0001', 'Mídias e conforto', 3)
ON CONFLICT DO NOTHING;

INSERT INTO itens (id, fase_id, nome, status) VALUES
  ('seed-ite-g01-01', 'seed-fas-gol-01', 'AP 2.0 polido + pistões forjados', 'concluido'),
  ('seed-ite-g01-02', 'seed-fas-gol-01', 'Carburador Dell''Orto 45', 'concluido'),
  ('seed-ite-g01-03', 'seed-fas-gol-01', 'Escapamento 4-2-1 SuperSprint', 'concluido'),
  ('seed-ite-g01-04', 'seed-fas-gol-01', 'Filtro esportivo K&N', 'concluido'),
  ('seed-ite-g02-01', 'seed-fas-gol-02', 'Molas esportivas -40mm', 'concluido'),
  ('seed-ite-g02-02', 'seed-fas-gol-02', 'Rodas BBS 15" 7J', 'em_andamento'),
  ('seed-ite-g02-03', 'seed-fas-gol-02', 'Adesivagem lateral retrô', 'pendente'),
  ('seed-ite-g03-01', 'seed-fas-gol-03', 'Central multimídia Pioneer', 'concluido'),
  ('seed-ite-g03-02', 'seed-fas-gol-03', 'Bancos esportivos Sparco', 'em_andamento'),
  ('seed-ite-g03-03', 'seed-fas-gol-03', 'Climatizador + vidros elétricos', 'pendente')
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================
-- Para checar:
-- SELECT g.slug, g.nome, g.publica, COUNT(v.id) veiculos
-- FROM garagens g LEFT JOIN veiculos v ON v.garagem_id = g.id
-- WHERE g.slug IN ('garagem-do-pedro', 'circuit-club-sp')
-- GROUP BY g.id;
-- ============================================================
