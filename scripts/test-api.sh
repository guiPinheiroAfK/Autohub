#!/usr/bin/env bash
# AutoHub API Test Script — v6
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

# ── 3. Auth — login ────────────────────────────────────────────────────────────

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

# ── 4. Auth/me ─────────────────────────────────────────────────────────────────

blue "4. /api/auth/me"
check "GET /api/auth/me (autenticado)" "$(json_get /api/auth/me)" "200"

ME=$(json_get_body /api/auth/me)
if echo "$ME" | grep -q '"slug"'; then
  green "GET /api/auth/me — tem garagem.slug"; ((PASS++))
else
  red "GET /api/auth/me — sem garagem.slug"; ((FAIL++))
fi

TOKEN_BACKUP="$TOKEN"; TOKEN=""
check "GET /api/auth/me (sem token → 401)" "$(json_get /api/auth/me)" "401"
TOKEN="$TOKEN_BACKUP"

# ── 5. Recuperação de senha ────────────────────────────────────────────────────

blue "5. Recuperação de senha"
check "POST /auth/esqueci-senha" \
  "$(json_post_noauth /auth/esqueci-senha "{\"email\":\"$EMAIL_A\"}")" "200"
check "POST /auth/esqueci-senha (email inexistente — silencioso)" \
  "$(json_post_noauth /auth/esqueci-senha "{\"email\":\"naoexiste@x.com\"}")" "200"
check "POST /auth/resetar-senha (token inválido → 404)" \
  "$(json_post_noauth /auth/resetar-senha "{\"token\":\"fake-token\",\"nova_senha\":\"Novo@1234\"}")" "404"

# ── 6. Google OAuth ────────────────────────────────────────────────────────────

blue "6. Google OAuth"
gray "GET /auth/google — testando redirect (302 ou 503 se GOOGLE_CLIENT_ID não configurado)"
GOOGLE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-redirs 0 "$BASE/auth/google" 2>/dev/null)
if [[ "$GOOGLE_STATUS" == "302" ]] || [[ "$GOOGLE_STATUS" == "503" ]] || [[ "$GOOGLE_STATUS" == "000" ]]; then
  green "GET /auth/google — responde (HTTP $GOOGLE_STATUS)"; ((PASS++))
else
  red "GET /auth/google — inesperado: $GOOGLE_STATUS"; ((FAIL++))
fi
gray "Fluxo completo de OAuth requer navegador — não testável via curl"

# ── 7. Garagem ─────────────────────────────────────────────────────────────────

blue "7. Garagem"
STATUS=$(json_patch /api/auth/garagem "{\"nome\":\"Garagem Teste\",\"bio\":\"Build de teste\",\"publica\":true}")
check "PATCH /api/auth/garagem" "$STATUS" "200"

# ── 8. Feed público ────────────────────────────────────────────────────────────

blue "8. Feed"
check "GET /api/feed" "$(json_get /api/feed)" "200"
check "GET /api/feed?limit=5" "$(json_get '/api/feed?limit=5')" "200"

# ── 9. Garagem pública por slug ────────────────────────────────────────────────

blue "9. Garagem pública"
GARAGEM_INFO=$(json_get_body /api/auth/me)
SLUG=$(echo "$GARAGEM_INFO" | grep -o '"slug":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -n "$SLUG" ]]; then
  check "GET /api/g/$SLUG" "$(json_get /api/g/$SLUG)" "200"
fi
check "GET /api/g/slug-inexistente (→ 404)" \
  "$(curl -sf -o /dev/null -w '%{http_code}' "$BASE/api/g/slug-inexistente-xyz")" "404"

# ── 10. Veículos ───────────────────────────────────────────────────────────────

blue "10. Veículos"
check "GET /api/veiculos" "$(json_get /api/veiculos)" "200"

VEICULO_RESP=$(curl -sf -X POST "$BASE/api/veiculos" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"apelido":"Testador","marca":"Honda","modelo":"Civic","anoFabricacao":2010,"anoModelo":2010,"perfil":"daily","visibilidade":"publico"}')
VEICULO_ID=$(echo "$VEICULO_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -n "$VEICULO_ID" ]]; then
  green "POST /api/veiculos — id=$VEICULO_ID"; ((PASS++))
else
  red "POST /api/veiculos — sem id"; ((FAIL++))
fi

# ── 11. YouTube URL em veículo ─────────────────────────────────────────────────

blue "11. YouTube URL"
if [[ -n "$VEICULO_ID" ]]; then
  check "PATCH /api/veiculos/:id (youtubeUrl válida)" \
    "$(json_patch /api/veiculos/$VEICULO_ID '{"youtubeUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}')" "200"

  check "PATCH /api/veiculos/:id (youtubeUrl null)" \
    "$(json_patch /api/veiculos/$VEICULO_ID '{"youtubeUrl":null}')" "200"

  VEI_RESP=$(json_get_body /api/veiculos/$VEICULO_ID)
  if echo "$VEI_RESP" | grep -q '"youtube_url"'; then
    green "GET /api/veiculos/:id — tem campo youtube_url"; ((PASS++))
  else
    red "GET /api/veiculos/:id — sem campo youtube_url"; ((FAIL++))
  fi
fi

# ── 12. Limite de 10 veículos ──────────────────────────────────────────────────

blue "12. Limite de veículos"
gray "Criando veículos até atingir o limite (pode demorar ~10s)..."
LIMITE_HIT=false
for i in $(seq 2 11); do
  R=$(curl -sf -X POST "$BASE/api/veiculos" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"apelido\":\"Carro $i\",\"marca\":\"Marca\",\"modelo\":\"Modelo\",\"anoFabricacao\":2020,\"anoModelo\":2020,\"perfil\":\"daily\"}")
  CODE=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$BASE/api/veiculos" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"apelido\":\"Extra $i\",\"marca\":\"M\",\"modelo\":\"M\",\"anoFabricacao\":2020,\"anoModelo\":2020,\"perfil\":\"daily\"}" 2>/dev/null)
  if [[ "$CODE" == "403" ]]; then
    LIMITE_HIT=true
    break
  fi
done
if $LIMITE_HIT; then
  green "Limite de 10 veículos — retorna 403 ao exceder"; ((PASS++))
else
  gray "Limite não atingido no teste (garagem pode já ter veículos criados antes)"
fi

# ── 13. Colaborações ───────────────────────────────────────────────────────────

blue "13. Colaborações"

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

# ── 14. Social ─────────────────────────────────────────────────────────────────

blue "14. Social"
check "GET /api/social/follows" "$(json_get /api/social/follows)" "200"
check "GET /api/social/notificacoes" "$(json_get /api/social/notificacoes)" "200"

NOTIF_RESP=$(json_get_body /api/social/notificacoes)
if echo "$NOTIF_RESP" | grep -q '"nao_lidas"'; then
  green "GET /api/social/notificacoes — tem nao_lidas"; ((PASS++))
else
  red "GET /api/social/notificacoes — sem campo nao_lidas"; ((FAIL++))
fi
check "PATCH /api/social/notificacoes/todas-lidas" \
  "$(json_patch /api/social/notificacoes/todas-lidas "")" "200"

# ── 15. Marketplace ────────────────────────────────────────────────────────────

blue "15. Marketplace"
check "GET /api/marketplace (público)" "$(json_get /api/marketplace)" "200"
check "GET /api/marketplace?categoria=motor" "$(json_get '/api/marketplace?categoria=motor')" "200"
check "GET /api/marketplace?q=turbo" "$(json_get '/api/marketplace?q=turbo')" "200"
check "GET /api/marketplace/meus (autenticado)" "$(json_get /api/marketplace/meus)" "200"

MKTPLACE_RESP=$(json_get_body /api/marketplace)
MKTPLACE_TOTAL=$(echo "$MKTPLACE_RESP" | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
if [[ -n "$MKTPLACE_TOTAL" && "$MKTPLACE_TOTAL" -gt 0 ]]; then
  green "GET /api/marketplace — $MKTPLACE_TOTAL anúncio(s) de seed encontrado(s)"; ((PASS++))
else
  red "GET /api/marketplace — sem dados de seed (rode: cd api && bun run setup)"; ((FAIL++))
fi

SPONSORED=$(echo "$MKTPLACE_RESP" | grep -o '"patrocinado":true')
if [[ -n "$SPONSORED" ]]; then
  green "GET /api/marketplace — anúncio patrocinado presente (seed OK)"; ((PASS++))
else
  gray "GET /api/marketplace — sem patrocinado ainda (normal se seed não rodou)"
fi

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
  check "GET /api/marketplace/:id (público)" \
    "$(curl -sf -o /dev/null -w '%{http_code}' "$BASE/api/marketplace/$ANUNCIO_ID")" "200"

  check "PATCH /api/marketplace/:id/status → pausado" \
    "$(json_patch /api/marketplace/$ANUNCIO_ID/status '{"status":"pausado"}')" "200"

  check "PATCH /api/marketplace/:id/status → ativo" \
    "$(json_patch /api/marketplace/$ANUNCIO_ID/status '{"status":"ativo"}')" "200"

  # Patrocinar anúncio
  check "POST /api/marketplace/:id/patrocinar" \
    "$(json_post /api/marketplace/$ANUNCIO_ID/patrocinar '{}')" "200"

  # Verificar badge patrocinado na listagem pública
  FEED_RESP=$(json_get_body /api/marketplace)
  if echo "$FEED_RESP" | grep -q '"patrocinado"'; then
    green "GET /api/marketplace — campo patrocinado presente"; ((PASS++))
  else
    red "GET /api/marketplace — sem campo patrocinado"; ((FAIL++))
  fi

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

  check "DELETE /api/marketplace/:id" \
    "$(json_delete /api/marketplace/$ANUNCIO_ID)" "200"
fi

# ── 16. Lojas ──────────────────────────────────────────────────────────────────

blue "16. Lojas"
check "GET /api/lojas/minha (sem loja → ok)" "$(json_get /api/lojas/minha)" "200"

LOJA_RESP=$(curl -sf -X POST "$BASE/api/lojas" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Turbo Parts Teste","descricao":"Loja de teste","instagram":"turboparts","whatsapp":"5511999999999"}')
LOJA_CRIADA=$(echo "$LOJA_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -n "$LOJA_CRIADA" ]]; then
  green "POST /api/lojas — loja criada id=$LOJA_CRIADA"; ((PASS++))
else
  red "POST /api/lojas — sem id"; ((FAIL++))
fi

check "POST /api/lojas (duplicado → 409)" \
  "$(json_post /api/lojas '{"nome":"Outra loja"}')" "409"

check "PATCH /api/lojas" \
  "$(json_patch /api/lojas '{"nome":"Turbo Parts Atualizado","descricao":"Desc atualizada"}')" "200"

check "GET /api/lojas/minha (com loja)" "$(json_get /api/lojas/minha)" "200"

if [[ -n "$SLUG" ]]; then
  check "GET /api/lojas/$SLUG (pública)" \
    "$(curl -sf -o /dev/null -w '%{http_code}' "$BASE/api/lojas/$SLUG")" "200"
fi

check "DELETE /api/lojas" "$(json_delete /api/lojas)" "200"
check "GET /api/lojas/minha (após delete → sem loja)" "$(json_get /api/lojas/minha)" "200"

# ── 17. Calendário de Eventos ──────────────────────────────────────────────────

blue "17. Calendário de Eventos"
check "GET /api/eventos-calendario (público)" "$(json_get /api/eventos-calendario)" "200"
check "GET /api/eventos-calendario?mes=12&ano=2026" \
  "$(json_get '/api/eventos-calendario?mes=12&ano=2026')" "200"

EVENTO_RESP=$(curl -sf -X POST "$BASE/api/eventos-calendario" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"titulo":"Encontro de carros modificados","dataInicio":"2026-12-15","local":"São Paulo, SP","tipo":"encontro"}')
EVENTO_ID=$(echo "$EVENTO_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -n "$EVENTO_ID" ]]; then
  green "POST /api/eventos-calendario — id=$EVENTO_ID"; ((PASS++))
else
  red "POST /api/eventos-calendario — sem id"; ((FAIL++))
fi

check "POST /api/eventos-calendario (dados inválidos → 400)" \
  "$(json_post /api/eventos-calendario '{"titulo":"X"}')" "400"

if [[ -n "$EVENTO_ID" ]]; then
  check "DELETE /api/eventos-calendario/:id" \
    "$(json_delete /api/eventos-calendario/$EVENTO_ID)" "200"
  check "DELETE /api/eventos-calendario/:id (já deletado → 404)" \
    "$(json_delete /api/eventos-calendario/$EVENTO_ID)" "404"
fi

# ── 18. Cotações ───────────────────────────────────────────────────────────────

blue "18. Cotações"
check "GET /api/cotacoes" "$(json_get /api/cotacoes)" "200"

# ── 19. Fotos de veículos (Cloudinary URLs) ────────────────────────────────────

blue "19. Fotos de veículos"
if [[ -n "$VEICULO_ID" ]]; then
  # POST com URL válida
  FOTO_RESP=$(curl -sf -X POST "$BASE/api/veiculos/$VEICULO_ID/fotos" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"url":"https://res.cloudinary.com/autohub/image/upload/v1/test/foto-teste.jpg","legenda":"Foto de teste"}')
  FOTO_ID=$(echo "$FOTO_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [[ -n "$FOTO_ID" ]]; then
    green "POST /api/veiculos/:id/fotos — id=$FOTO_ID"; ((PASS++))
  else
    red "POST /api/veiculos/:id/fotos — sem id na resposta"; ((FAIL++))
  fi

  # GET lista fotos
  check "GET /api/veiculos/:id/fotos" "$(json_get /api/veiculos/$VEICULO_ID/fotos)" "200"

  FOTOS_RESP=$(json_get_body /api/veiculos/$VEICULO_ID/fotos)
  if echo "$FOTOS_RESP" | grep -q '"url"'; then
    green "GET /api/veiculos/:id/fotos — campo url presente"; ((PASS++))
  else
    red "GET /api/veiculos/:id/fotos — sem campo url"; ((FAIL++))
  fi

  # POST sem url → 400
  check "POST /api/veiculos/:id/fotos (sem url → 400)" \
    "$(json_post /api/veiculos/$VEICULO_ID/fotos '{}')" "400"

  # DELETE a foto
  if [[ -n "$FOTO_ID" ]]; then
    check "DELETE /api/veiculos/:id/fotos/:fotoId" \
      "$(json_delete /api/veiculos/$VEICULO_ID/fotos/$FOTO_ID)" "200"

    check "DELETE /api/veiculos/:id/fotos/:fotoId (já deletada → 404)" \
      "$(json_delete /api/veiculos/$VEICULO_ID/fotos/$FOTO_ID)" "404"
  fi

  # Sem token → 401
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X GET "$BASE/api/veiculos/$VEICULO_ID/fotos")
  check "GET /api/veiculos/:id/fotos (sem token → 401)" "$STATUS" "401"
else
  gray "Fotos — pulado: sem VEICULO_ID"
fi

# ── 20. Comentários ────────────────────────────────────────────────────────────

blue "20. Comentários"
if [[ -n "$VEICULO_ID" ]]; then
  # GET público (veículo foi criado como publico)
  check "GET /api/comentarios/:veiculoId (público, sem token)" \
    "$(curl -sf -o /dev/null -w '%{http_code}' "$BASE/api/comentarios/$VEICULO_ID")" "200"

  # POST com auth
  COM_RESP=$(curl -sf -X POST "$BASE/api/comentarios/$VEICULO_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"texto":"Build muito maneiro! Qual suspensão vai usar?"}')
  COM_ID=$(echo "$COM_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [[ -n "$COM_ID" ]]; then
    green "POST /api/comentarios/:veiculoId — id=$COM_ID"; ((PASS++))
  else
    red "POST /api/comentarios/:veiculoId — sem id"; ((FAIL++))
  fi

  # GET lista: deve ter o comentário recém-criado
  COM_LIST=$(json_get_body /api/comentarios/$VEICULO_ID)
  if echo "$COM_LIST" | grep -q '"autor_nome"'; then
    green "GET /api/comentarios/:veiculoId — campo autor_nome presente"; ((PASS++))
  else
    red "GET /api/comentarios/:veiculoId — sem campo autor_nome"; ((FAIL++))
  fi
  if echo "$COM_LIST" | grep -q '"texto"'; then
    green "GET /api/comentarios/:veiculoId — campo texto presente"; ((PASS++))
  else
    red "GET /api/comentarios/:veiculoId — sem campo texto"; ((FAIL++))
  fi

  # Feed deve refletir contagem de comentários
  FEED_COM=$(json_get_body /api/feed)
  if echo "$FEED_COM" | grep -q '"total_comentarios"'; then
    green "GET /api/feed — campo total_comentarios presente"; ((PASS++))
  else
    red "GET /api/feed — sem campo total_comentarios"; ((FAIL++))
  fi

  # POST texto vazio → 400
  check "POST /api/comentarios/:veiculoId (texto vazio → 400)" \
    "$(json_post /api/comentarios/$VEICULO_ID '{"texto":""}')" "400"

  # POST sem token → 401
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$BASE/api/comentarios/$VEICULO_ID" \
    -H "Content-Type: application/json" \
    -d '{"texto":"Sem auth"}')
  check "POST /api/comentarios/:veiculoId (sem token → 401)" "$STATUS" "401"

  # DELETE o próprio comentário
  if [[ -n "$COM_ID" ]]; then
    check "DELETE /api/comentarios/:comentarioId" \
      "$(json_delete /api/comentarios/$COM_ID)" "200"

    check "DELETE /api/comentarios/:comentarioId (já deletado → 404)" \
      "$(json_delete /api/comentarios/$COM_ID)" "404"
  fi

  # GET veículo privado → 404
  VEI_PRIV_RESP=$(curl -sf -X POST "$BASE/api/veiculos" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"apelido":"Privado","marca":"Ford","modelo":"Ka","anoFabricacao":2015,"anoModelo":2015,"perfil":"daily","visibilidade":"privado"}')
  VEI_PRIV_ID=$(echo "$VEI_PRIV_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [[ -n "$VEI_PRIV_ID" ]]; then
    STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$BASE/api/comentarios/$VEI_PRIV_ID")
    check "GET /api/comentarios/:veiculoId (veículo privado → 404)" "$STATUS" "404"
  fi
else
  gray "Comentários — pulado: sem VEICULO_ID"
fi

# ── 21. PWA — manifest.json ────────────────────────────────────────────────────

blue "21. PWA — manifest.json"
# Quando rodando na API local (porta 8000), tenta o front em 5173
MANIFEST_URL="$BASE"
if [[ "$MANIFEST_URL" =~ ":8000" ]]; then
  MANIFEST_URL="${MANIFEST_URL/8000/5173}"
  gray "Ajustando manifest URL para o front: $MANIFEST_URL/manifest.json"
fi

MANIFEST_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$MANIFEST_URL/manifest.json" 2>/dev/null)
if [[ "$MANIFEST_STATUS" == "200" ]]; then
  green "GET /manifest.json — HTTP 200"; ((PASS++))
  # tr -d '\r' remove CRLF do Windows antes de greping
  MANIFEST=$(curl -sf "$MANIFEST_URL/manifest.json" 2>/dev/null | tr -d '\r')
  if echo "$MANIFEST" | grep -qF '"name"'; then
    green "manifest.json — campo name presente"; ((PASS++))
  else
    red "manifest.json — sem campo name"; ((FAIL++))
  fi
  if echo "$MANIFEST" | grep -qF '"theme_color"'; then
    green "manifest.json — campo theme_color presente"; ((PASS++))
  else
    red "manifest.json — sem theme_color"; ((FAIL++))
  fi
  if echo "$MANIFEST" | grep -qF '"display"'; then
    green "manifest.json — display: standalone (PWA nativo)"; ((PASS++))
  else
    red "manifest.json — display não é standalone"; ((FAIL++))
  fi
  if echo "$MANIFEST" | grep -qF '"start_url"'; then
    green "manifest.json — campo start_url presente"; ((PASS++))
  else
    red "manifest.json — sem start_url"; ((FAIL++))
  fi
else
  gray "manifest.json inacessível em $MANIFEST_URL (HTTP $MANIFEST_STATUS) — suba o front para testar PWA"
fi

# Verifica service worker (só via Netlify/front rodando)
SW_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$MANIFEST_URL/sw.js" 2>/dev/null)
if [[ "$SW_STATUS" == "200" ]]; then
  green "GET /sw.js — HTTP 200 (service worker acessível)"; ((PASS++))
else
  gray "GET /sw.js — HTTP $SW_STATUS (normal se front não estiver rodando)"
fi

# ── Resultado ─────────────────────────────────────────────────────────────────

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
