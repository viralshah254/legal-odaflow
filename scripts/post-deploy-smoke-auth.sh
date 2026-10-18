#!/usr/bin/env bash
# Authenticated post-deploy smoke — requires test firm account credentials.
set -euo pipefail

API_URL="${API_URL:-https://legal-api.odaflow.com}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"
TEST_TENANT_ID="${TEST_TENANT_ID:-}"
TEST_MATTER_ID="${TEST_MATTER_ID:-}"
INTEGRATION_PROVIDER="${INTEGRATION_PROVIDER:-gmail}"

PASS=0
FAIL=0

pass() { echo "✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "✗ $1"; FAIL=$((FAIL + 1)); }

if [ -z "$TEST_EMAIL" ] || [ -z "$TEST_PASSWORD" ]; then
  echo "Set TEST_EMAIL and TEST_PASSWORD to run authenticated smoke checks."
  exit 1
fi

echo "Authenticated smoke: API=$API_URL user=$TEST_EMAIL"
echo ""

LOGIN_RESP=$(curl -sS -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" || echo '{}')

ACCESS_TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',''))" 2>/dev/null || true)
TENANT_ID=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); u=d.get('user',{}); print(u.get('tenantId',''))" 2>/dev/null || true)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "Login failed — cannot continue authenticated smoke."
  echo "$LOGIN_RESP" | head -c 500
  exit 1
fi

pass "Auth login returned accessToken"

if [ -n "$TEST_TENANT_ID" ]; then
  TENANT_ID="$TEST_TENANT_ID"
fi

AUTH_HEADERS=(-H "Authorization: Bearer $ACCESS_TOKEN")
if [ -n "$TENANT_ID" ]; then
  AUTH_HEADERS+=(-H "x-tenant-id: $TENANT_ID")
fi

code=$(curl -s -o /dev/null -w "%{http_code}" "${AUTH_HEADERS[@]}" \
  "$API_URL/api/v1/search/unified?q=test" || echo 000)
if [ "$code" -ge 200 ] && [ "$code" -lt 400 ]; then
  pass "Unified search (auth) ($code)"
else
  fail "Unified search (auth) ($code)"
fi

if [ -n "$TEST_MATTER_ID" ] && [ -n "$TENANT_ID" ]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" "${AUTH_HEADERS[@]}" \
    "$API_URL/api/v1/matters/$TEST_MATTER_ID/outcome/benchmarks" || echo 000)
  if [ "$code" -ge 200 ] && [ "$code" -lt 400 ]; then
    pass "Outcome benchmarks ($code)"
  else
    fail "Outcome benchmarks ($code)"
  fi
else
  echo "⊘ Outcome benchmarks skipped (set TEST_MATTER_ID)"
fi

if [ -n "$TENANT_ID" ]; then
  SYNC_RESP=$(curl -sS -X POST "${AUTH_HEADERS[@]}" \
    "$API_URL/api/v1/integrations/$INTEGRATION_PROVIDER/sync" || echo '{}')
  SYNC_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${AUTH_HEADERS[@]}" \
    "$API_URL/api/v1/integrations/$INTEGRATION_PROVIDER/sync" || echo 000)

  if [ "$SYNC_CODE" -ge 200 ] && [ "$SYNC_CODE" -lt 500 ]; then
    if echo "$SYNC_RESP" | grep -qi 'stub'; then
      fail "Integration sync returned stub response (provider may not be OAuth-connected)"
    else
      pass "Integration sync ($SYNC_CODE)"
    fi
  else
    fail "Integration sync ($SYNC_CODE)"
  fi
fi

echo ""
echo "=== Research readiness ==="
READINESS=$(curl -sS "${AUTH_HEADERS[@]}" "$API_URL/health/research-readiness" || echo '{}')
if echo "$READINESS" | grep -q '"researchReady":true'; then
  pass "Research readiness (IN corpus or live connector)"
else
  fail "Research readiness degraded"
fi

echo ""
echo "=== Legal research probes ==="
CASE_QUERY='What are similar cases in Indian law where arbitration clauses in partnership agreements were enforced or disputed, and what were the key outcomes?'
RESEARCH_RESP=$(curl -sS -X POST "${AUTH_HEADERS[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"query\":$(python3 -c "import json; print(json.dumps('$CASE_QUERY'))"),\"countryCode\":\"IN\",\"researchMode\":\"FAST\",\"requestedTaskKind\":\"CASE_SURVEY\",\"desiredOutput\":\"AUTHORITY_LIST\",\"knowledgeSources\":[\"statutes\",\"case_law\",\"web\"]}" \
  "$API_URL/api/v1/ai/research" || echo '{}')
if echo "$RESEARCH_RESP" | grep -q '"kind":"CASE_SURVEY"' &&
  ! echo "$RESEARCH_RESP" | grep -q '"mode":"gap_response"'; then
  pass "Partnership-arbitration case-survey probe retained survey policy"
else
  fail "Partnership-arbitration case-survey probe drifted or hard-aborted"
fi

FAKE_QUERY='Verify and explain the holding in Ramesh Kumar v Union of India, (2025) 14 SCC 999, said to create an absolute right to anticipatory bail.'
FAKE_RESP=$(curl -sS -X POST "${AUTH_HEADERS[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"query\":$(python3 -c "import json; print(json.dumps('$FAKE_QUERY'))"),\"countryCode\":\"IN\",\"researchMode\":\"FAST\"}" \
  "$API_URL/api/v1/ai/research" || echo '{}')
if echo "$FAKE_RESP" | grep -qi 'cannot responsibly\|unable to verify\|not locate\|gap_response\|insufficient'; then
  pass "Fabricated-citation abstention probe"
else
  fail "Fabricated-citation abstention probe did not abstain"
fi

echo ""
echo "Passed: $PASS Failed: $FAIL"
[ "$FAIL" -eq 0 ]
