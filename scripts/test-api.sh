#!/usr/bin/env bash
# AutoHub API Test Script — v2
# Uso: bash scripts/test-api.sh [BASE_URL]
# Ex:  bash scripts/test-api.sh http://localhost:8000
#      bash scripts/test-api.sh https://autohubbr.netlify.app

BASE="${1:-http://localhost:8000}"
PASS=0; FAIL=0

# ── Helpers ────────────────────────────────────────────────────────────────────

green() { echo -e "\033[32m✔ $1\033[0m"; }
red()   { echo -e "\033[31m✖ $1\033[0m"; }
blue()  { echo -e "\033[34m▶ $1\033[0m"; }

check() {
  local label="$1" status="$2" expected="$3"
  if [[ "$status" == "$expected" ]]; then
    green "$label (HTTP $status)"
    ((PASS++))
  else
    red "$label — esperado $expected, got $status"
    ((FAIL++))
  fi
}

json_post() { curl -sf -o /dev/null -w "%{http_code}" -X POST "$BASE$1" \
  -H "Content-Type: application/json" -d "$2"; }

json_get()  { curl -sf -o /dev/null -w "%{http_code}" -X GET "$BASE$1" \
  ${TOKEN:+-H "Authorization: Bearer $TOKEN"}; }

json_get_body() { curl -sf -X GET "$BASE$1" \
  ${TOKEN:+-H "Authorization: Bearer $TOKEN"}; }

json_patch() { curl -sf -o /dev/null -w "%{http_code}" -X PATCH "$BASE$1" \
  -H "Content-Type: application/json" \
  ${TOKEN:+-H "Authorization: Bearer $TOKEN"} -d "$2"; }

json_delete() { curl -sf -o /dev/null -w "%{http_code}" -X DELETE "$BASE$1" \
  ${TOKEN:+-H "Authorization: Bearer $TOKEN"}; }

# ── Dados de teste ─────────────────────────────────────────────────────────────

TIMESTAMP=$(date +%s)
EMAIL_A="teste_a_${TIMESTAMP}@autohub.test"
EMAIL_B="teste_b_${TIMESTAMP}@autohub.test"
SENHA="Senha@123"

# ── 1. Healthcheck ─────────────────────────────────────────────────────────────

blue "1. Healthcheck"
check "GET /" "$(json_get /)" "200"

# ── 2. Auth — registro ─────────────────────────────────────────────────────────

blue "2. Auth"
STATUS=$(json_post /auth/register "{\"nome\":\"Tester A\",\"email\":\"$EMAIL_A\",\"password\":\"$SENHA\"}")
check "POST /auth/register (novo)" "$STATUS" "201"

STATUS=$(json_post /auth/register "{\"nome\":\"Tester A\",\"email\":\"$EMAIL_A\",\"password\":\"$SENHA\"}")
check "POST /auth/register (duplicado → 409)" "$STATUS" "409"

STATUS=$(json_post /auth/register "{\"nome\":\"T\",\"email\":\"invalido\",\"password\":\"123\"}")
check "POST /auth/register (dados inválidos → 400)" "$STATUS" "400"

# ── 3. Auth — login ─────────────────────────────────────────────────────────────

blue "3. Login"
RESP=$(curl -sf -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_A\",\"password\":\"$SENHA\"}")

if [[ -z "$RESP" ]]; then
  red "POST /auth/login — sem resposta"
  ((FAIL++))
else
  TOKEN=$(echo "$RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  if [[ -n "$TOKEN" ]]; then
    green "POST /auth/login — token obtido"
    ((PASS++))
  else
    red "POST /auth/login — sem token na resposta"
    ((FAIL++))
  fi
fi

STATUS=$(json_post /auth/login "{\"email\":\"$EMAIL_A\",\"password\":\"errada\"}")
check "POST /auth/login (senha errada → 401)" "$STATUS" "401"

# ── 4. Auth/me ──────────────────────────────────────────────────────────────────

blue "4. /api/auth/me"
check "GET /api/auth/me (autenticado)" "$(json_get /api/auth/me)" "200"

TOKEN_BACKUP="$TOKEN"; TOKEN=""
check "GET /api/auth/me (sem token → 401)" "$(json_get /api/auth/me)" "401"
TOKEN="$TOKEN_BACKUP"

# ── 5. Esqueci senha ────────────────────────────────────────────────────────────

blue "5. Recuperação de senha"
check "POST /auth/esqueci-senha" \
  "$(json_post /auth/esqueci-senha "{\"email\":\"$EMAIL_A\"}")" "200"
check "POST /auth/esqueci-senha (email inexistente — silencioso)" \
  "$(json_post /auth/esqueci-senha "{\"email\":\"naoexiste@x.com\"}")" "200"
check "POST /auth/resetar-senha (token inválido → 404)" \
  "$(json_post /auth/resetar-senha "{\"token\":\"fake-token\",\"nova_senha\":\"Novo@1234\"}")" "404"

# ── 6. Garagem — patch ──────────────────────────────────────────────────────────

blue "6. Garagem pública"
STATUS=$(json_patch /api/auth/garagem "{\"nome\":\"Garagem Teste\",\"bio\":\"Build de teste\",\"publica\":true}")
check "PATCH /api/auth/garagem" "$STATUS" "200"

# ── 7. Feed público ─────────────────────────────────────────────────────────────

blue "7. Feed"
check "GET /feed" "$(json_get /feed)" "200"
check "GET /feed?limit=5" "$(json_get /feed?limit=5)" "200"

# ── 8. Garagem pública por slug ─────────────────────────────────────────────────

blue "8. Garagem pública"
GARAGEM_INFO=$(json_get_body /api/auth/me)
SLUG=$(echo "$GARAGEM_INFO" | grep -o '"slug":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -n "$SLUG" ]]; then
  check "GET /g/$SLUG (garagem pública)" "$(json_get /g/$SLUG)" "200"
fi

check "GET /g/slug-inexistente (→ 404)" \
  "$(curl -sf -o /dev/null -w '%{http_code}' "$BASE/g/slug-inexistente-xyz")" "404"

# ── 9. Veículos ─────────────────────────────────────────────────────────────────

blue "9. Veículos"
check "GET /api/veiculos" "$(json_get /api/veiculos)" "200"

VEICULO_RESP=$(curl -sf -X POST "$BASE/api/veiculos" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"apelido":"Testador","marca":"Honda","modelo":"Civic","ano_fabricacao":2010,"ano_modelo":2010,"perfil":"daily","visibilidade":"publico"}')
VEICULO_ID=$(echo "$VEICULO_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -n "$VEICULO_ID" ]]; then
  green "POST /api/veiculos — id=$VEICULO_ID"
  ((PASS++))
else
  red "POST /api/veiculos — sem id"
  ((FAIL++))
fi

# ── 10. Colaborações ────────────────────────────────────────────────────────────

blue "10. Colaborações"

if [[ -n "$VEICULO_ID" ]]; then
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X GET "$BASE/api/colaboracoes/veiculo/$VEICULO_ID" \
    -H "Authorization: Bearer $TOKEN")
  check "GET /api/colaboracoes/veiculo/:id" "$STATUS" "200"

  # Registrar usuário B para testar convite
  RESP_B=$(curl -sf -X POST "$BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"nome\":\"Tester B\",\"email\":\"$EMAIL_B\",\"password\":\"$SENHA\"}")
  TOKEN_B=$(echo "$RESP_B" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$BASE/api/colaboracoes/veiculo/$VEICULO_ID/convidar" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"email\":\"$EMAIL_B\",\"papel\":\"editor\"}")
  check "POST /api/colaboracoes/veiculo/:id/convidar" "$STATUS" "201"

  # Convite duplicado deve dar 409
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$BASE/api/colaboracoes/veiculo/$VEICULO_ID/convidar" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"email\":\"$EMAIL_B\",\"papel\":\"editor\"}")
  check "POST /api/colaboracoes/veiculo/:id/convidar (duplicado → 409)" "$STATUS" "409"
fi

# ── 11. Social — follows ────────────────────────────────────────────────────────

blue "11. Social"
check "GET /api/social/follows" "$(json_get /api/social/follows)" "200"
check "GET /api/social/notificacoes" "$(json_get /api/social/notificacoes)" "200"

# ── 12. Cotações ────────────────────────────────────────────────────────────────

blue "12. Cotações"
check "GET /api/cotacoes" "$(json_get /api/cotacoes)" "200"

# ── 13. Tracks / Rotas (endpoints API) ─────────────────────────────────────────

blue "13. Tracks"
check "GET /api/tracks/rotas" "$(json_get /api/tracks/rotas)" "200"

# ── Resultado ──────────────────────────────────────────────────────────────────

echo ""
echo "─────────────────────────────────"
echo "  Resultado: $PASS passaram, $FAIL falharam"
if [[ "$FAIL" -eq 0 ]]; then
  green "Todos os testes passaram!"
else
  red "$FAIL teste(s) falharam."
  exit 1
fi
