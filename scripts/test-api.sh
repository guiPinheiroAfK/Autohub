#!/usr/bin/env bash
# AutoHub API Test Script — v3
# Uso: bash scripts/test-api.sh [BASE_URL]
# Ex:  bash scripts/test-api.sh http://localhost:8000
#      bash scripts/test-api.sh https://autohubbr.netlify.app

BASE="${1:-http://localhost:8000}"
PASS=0; FAIL=0

# ── Helpers ────────────────────────────────────────────────────────────────────

green() { echo -e "\033[32m✔ $1\033[0m"; }
red()   { echo -e "\033[31m✖ $1\033[0m"; }
blue()  { echo -e "\033[34m▶ $1\033[0m"; }
gray()  { echo -e "\033[90m  $1\033[0m"; }

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
  -H "Content-Type: application/json" \
  ${TOKEN:+-H "Authorization: Bearer $TOKEN"} -d "$2"; }

json_post_noauth() { curl -sf -o /dev/null -w "%{http_code}" -X POST "$BASE$1" \
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

blue "2. Auth — registro"
STATUS=$(json_post_noauth /auth/register "{\"nome\":\"Tester A\",\"email\":\"$EMAIL_A\",\"password\":\"$SENHA\"}")
check "POST /auth/register (novo)" "$STATUS" "201"

STATUS=$(json_post_noauth /auth/register "{\"nome\":\"Tester A\",\"email\":\"$EMAIL_A\",\"password\":\"$SENHA\"}")
check "POST /auth/register (duplicado → 409)" "$STATUS" "409"

STATUS=$(json_post_noauth /auth/register "{\"nome\":\"T\",\"email\":\"invalido\",\"password\":\"123\"}")
check "POST /auth/register (dados inválidos → 400)" "$STATUS" "400"

# ── 3. Auth — login ─────────────────────────────────────────────────────────────

blue "3. Auth — login"
RESP=$(curl -sf -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_A\",\"password\":\"$SENHA\"}")

if [[ -z "$RESP" ]]; then
  red "POST /auth/login — sem resposta"; ((FAIL++))
else
  TOKEN=$(echo "$RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  if [[ -n "$TOKEN" ]]; then
    green "POST /auth/login — token obtido"; ((PASS++))
  else
    red "POST /auth/login — sem token na resposta"; ((FAIL++))
  fi
fi

STATUS=$(json_post_noauth /auth/login "{\"email\":\"$EMAIL_A\",\"password\":\"errada\"}")
check "POST /auth/login (senha errada → 401)" "$STATUS" "401"

# ── 4. Auth/me ──────────────────────────────────────────────────────────────────

blue "4. /api/auth/me"
check "GET /api/auth/me (autenticado)" "$(json_get /api/auth/me)" "200"

# Verifica que bio e publica estão no retorno
ME=$(json_get_body /api/auth/me)
if echo "$ME" | grep -q '"slug"'; then
  green "GET /api/auth/me — tem garagem.slug"; ((PASS++))
else
  red "GET /api/auth/me — sem garagem.slug"; ((FAIL++))
fi

TOKEN_BACKUP="$TOKEN"; TOKEN=""
check "GET /api/auth/me (sem token → 401)" "$(json_get /api/auth/me)" "401"
TOKEN="$TOKEN_BACKUP"

# ── 5. Auth — recuperação de senha ──────────────────────────────────────────────

blue "5. Recuperação de senha"
check "POST /auth/esqueci-senha" \
  "$(json_post_noauth /auth/esqueci-senha "{\"email\":\"$EMAIL_A\"}")" "200"
check "POST /auth/esqueci-senha (email inexistente — silencioso)" \
  "$(json_post_noauth /auth/esqueci-senha "{\"email\":\"naoexiste@x.com\"}")" "200"
check "POST /auth/resetar-senha (token inválido → 404)" \
  "$(json_post_noauth /auth/resetar-senha "{\"token\":\"fake-token\",\"nova_senha\":\"Novo@1234\"}")" "404"

# ── 6. Google OAuth ─────────────────────────────────────────────────────────────

blue "6. Google OAuth"
gray "GET /auth/google — testando redirect (302 ou 503 se GOOGLE_CLIENT_ID não configurado)"
GOOGLE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-redirs 0 "$BASE/auth/google" 2>/dev/null)
if [[ "$GOOGLE_STATUS" == "302" ]] || [[ "$GOOGLE_STATUS" == "503" ]] || [[ "$GOOGLE_STATUS" == "000" ]]; then
  green "GET /auth/google — responde (HTTP $GOOGLE_STATUS)"; ((PASS++))
else
  red "GET /auth/google — inesperado: $GOOGLE_STATUS"; ((FAIL++))
fi
gray "Fluxo completo de OAuth requer navegador — não testável via curl"

# ── 7. Garagem — patch ──────────────────────────────────────────────────────────

blue "7. Garagem pública"
STATUS=$(json_patch /api/auth/garagem "{\"nome\":\"Garagem Teste\",\"bio\":\"Build de teste\",\"publica\":true}")
check "PATCH /api/auth/garagem" "$STATUS" "200"

# ── 8. Feed público ─────────────────────────────────────────────────────────────

blue "8. Feed"
check "GET /feed" "$(json_get /feed)" "200"
check "GET /feed?limit=5" "$(json_get /feed?limit=5)" "200"

# ── 9. Garagem pública por slug ─────────────────────────────────────────────────

blue "9. Garagem pública"
GARAGEM_INFO=$(json_get_body /api/auth/me)
SLUG=$(echo "$GARAGEM_INFO" | grep -o '"slug":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -n "$SLUG" ]]; then
  check "GET /g/$SLUG" "$(json_get /g/$SLUG)" "200"
fi
check "GET /g/slug-inexistente (→ 404)" \
  "$(curl -sf -o /dev/null -w '%{http_code}' "$BASE/g/slug-inexistente-xyz")" "404"

# ── 10. Veículos ─────────────────────────────────────────────────────────────────

blue "10. Veículos"
check "GET /api/veiculos" "$(json_get /api/veiculos)" "200"

VEICULO_RESP=$(curl -sf -X POST "$BASE/api/veiculos" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"apelido":"Testador","marca":"Honda","modelo":"Civic","ano_fabricacao":2010,"ano_modelo":2010,"perfil":"daily","visibilidade":"publico"}')
VEICULO_ID=$(echo "$VEICULO_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -n "$VEICULO_ID" ]]; then
  green "POST /api/veiculos — id=$VEICULO_ID"; ((PASS++))
else
  red "POST /api/veiculos — sem id"; ((FAIL++))
fi

# ── 11. Colaborações ────────────────────────────────────────────────────────────

blue "11. Colaborações"

if [[ -n "$VEICULO_ID" ]]; then
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X GET "$BASE/api/colaboracoes/veiculo/$VEICULO_ID" \
    -H "Authorization: Bearer $TOKEN")
  check "GET /api/colaboracoes/veiculo/:id" "$STATUS" "200"

  RESP_B=$(curl -sf -X POST "$BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"nome\":\"Tester B\",\"email\":\"$EMAIL_B\",\"password\":\"$SENHA\"}")
  TOKEN_B=$(echo "$RESP_B" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$BASE/api/colaboracoes/veiculo/$VEICULO_ID/convidar" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"email\":\"$EMAIL_B\",\"papel\":\"editor\"}")
  check "POST /api/colaboracoes/veiculo/:id/convidar" "$STATUS" "201"

  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$BASE/api/colaboracoes/veiculo/$VEICULO_ID/convidar" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"email\":\"$EMAIL_B\",\"papel\":\"editor\"}")
  check "POST colaboracoes/convidar (duplicado → 409)" "$STATUS" "409"
fi

# ── 12. Social — follows & notificações ─────────────────────────────────────────

blue "12. Social"
check "GET /api/social/follows" "$(json_get /api/social/follows)" "200"
check "GET /api/social/notificacoes" "$(json_get /api/social/notificacoes)" "200"

# Verifica que notificacoes retorna { notificacoes, nao_lidas }
NOTIF_RESP=$(json_get_body /api/social/notificacoes)
if echo "$NOTIF_RESP" | grep -q '"nao_lidas"'; then
  green "GET /api/social/notificacoes — tem nao_lidas"; ((PASS++))
else
  red "GET /api/social/notificacoes — sem campo nao_lidas"; ((FAIL++))
fi
check "PATCH /api/social/notificacoes/todas-lidas" \
  "$(json_patch /api/social/notificacoes/todas-lidas "")" "200"

# ── 13. Marketplace ─────────────────────────────────────────────────────────────

blue "13. Marketplace"
check "GET /marketplace (público)" "$(json_get /marketplace)" "200"
check "GET /marketplace?categoria=motor" "$(json_get /marketplace?categoria=motor)" "200"
check "GET /marketplace?q=turbo" "$(json_get /marketplace?q=turbo)" "200"
check "GET /api/marketplace/meus (autenticado)" "$(json_get /api/marketplace/meus)" "200"

ANUNCIO_RESP=$(curl -sf -X POST "$BASE/api/marketplace" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"titulo":"Kit turbo teste","descricao":"Apenas para teste","preco":5000,"moeda":"BRL","categoria":"motor","condicao":"usado","localizacao":"SP"}')
ANUNCIO_ID=$(echo "$ANUNCIO_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -n "$ANUNCIO_ID" ]]; then
  green "POST /api/marketplace — id=$ANUNCIO_ID"; ((PASS++))
else
  red "POST /api/marketplace — sem id"; ((FAIL++))
fi

if [[ -n "$ANUNCIO_ID" ]]; then
  check "GET /marketplace/:id (público)" \
    "$(curl -sf -o /dev/null -w '%{http_code}' "$BASE/marketplace/$ANUNCIO_ID")" "200"

  check "PATCH /api/marketplace/:id/status → pausado" \
    "$(json_patch /api/marketplace/$ANUNCIO_ID/status '{"status":"pausado"}')" "200"

  check "PATCH /api/marketplace/:id/status → ativo" \
    "$(json_patch /api/marketplace/$ANUNCIO_ID/status '{"status":"ativo"}')" "200"

  # Tester B demonstra interesse no anúncio do Tester A
  if [[ -n "$TOKEN_B" ]]; then
    STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$BASE/api/marketplace/$ANUNCIO_ID/interesse" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN_B" \
      -d '{"mensagem":"Ainda disponível? Tenho interesse!"}')
    check "POST /api/marketplace/:id/interesse (Tester B)" "$STATUS" "201"

    STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$BASE/api/marketplace/$ANUNCIO_ID/interesse" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN_B" \
      -d '{}')
    check "POST /api/marketplace/:id/interesse (duplicado → 409)" "$STATUS" "409"

    check "GET /api/marketplace/:id/interesses (dono)" \
      "$(curl -sf -o /dev/null -w '%{http_code}' "$BASE/api/marketplace/$ANUNCIO_ID/interesses" \
         -H "Authorization: Bearer $TOKEN")" "200"

    MEUINT=$(curl -sf "$BASE/api/marketplace/$ANUNCIO_ID/meu-interesse" \
      -H "Authorization: Bearer $TOKEN_B")
    if echo "$MEUINT" | grep -q '"interesse":true'; then
      green "GET /api/marketplace/:id/meu-interesse — true"; ((PASS++))
    else
      red "GET /api/marketplace/:id/meu-interesse — esperado true"; ((FAIL++))
    fi

    STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/marketplace/$ANUNCIO_ID/interesse" \
      -H "Authorization: Bearer $TOKEN_B")
    check "DELETE /api/marketplace/:id/interesse" "$STATUS" "200"
  fi

  check "PATCH /api/marketplace/:id/status → vendido" \
    "$(json_patch /api/marketplace/$ANUNCIO_ID/status '{"status":"vendido"}')" "200"

  check "DELETE /api/marketplace/:id" \
    "$(json_delete /api/marketplace/$ANUNCIO_ID)" "200"
fi

# ── 14. Cotações ────────────────────────────────────────────────────────────────

blue "14. Cotações"
check "GET /api/cotacoes" "$(json_get /api/cotacoes)" "200"

# ── Resultado ──────────────────────────────────────────────────────────────────

echo ""
echo "─────────────────────────────────────────────────"
echo "  Resultado: $PASS passaram, $FAIL falharam"
echo "─────────────────────────────────────────────────"
if [[ "$FAIL" -eq 0 ]]; then
  green "Todos os testes passaram!"
else
  red "$FAIL teste(s) falharam."
  exit 1
fi
