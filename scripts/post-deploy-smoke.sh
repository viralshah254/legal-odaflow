#!/usr/bin/env bash
# Post-deploy smoke checklist — unauthenticated checks only.
# Auth-required checks: scripts/post-deploy-smoke-auth.sh
set -euo pipefail

API_URL="${API_URL:-http://localhost:4000}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local code="$2"
  if [ "$code" -ge 200 ] && [ "$code" -lt 400 ]; then
    echo "✓ $name ($code)"
    PASS=$((PASS + 1))
  else
    echo "✗ $name ($code)"
    FAIL=$((FAIL + 1))
  fi
}

check_expected() {
  local name="$1"
  local code="$2"
  local expected="$3"
  if [ "$code" -eq "$expected" ]; then
    echo "✓ $name ($code, expected $expected)"
    PASS=$((PASS + 1))
  else
    echo "✗ $name ($code, expected $expected)"
    FAIL=$((FAIL + 1))
  fi
}

echo "Smoke (unauthenticated): API=$API_URL WEB=$WEB_URL"
echo "For authenticated API checks, run: TEST_EMAIL=... TEST_PASSWORD=... ./scripts/post-deploy-smoke-auth.sh"
echo ""

code=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/v1/health" || echo 000)
check "API health" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/v1/health/readiness" || echo 000)
check "API readiness" "$code"

code=$(curl -sL -o /dev/null -w "%{http_code}" "$WEB_URL/legal-issue-checker/" || echo 000)
check "Web issue checker" "$code"

code=$(curl -sL -o /dev/null -w "%{http_code}" "$WEB_URL/auth/sign-in/" || echo 000)
check "Web sign-in" "$code"

code=$(curl -sL -o /dev/null -w "%{http_code}" "$WEB_URL/pricing/" || echo 000)
check "Web pricing" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/v1/public/issue-checker/schema" || echo 000)
check "Public issue-checker schema" "$code"

code=$(curl -sL -o /dev/null -w "%{http_code}" "$WEB_URL/admin/dashboard/" || echo 000)
check "Web admin dashboard" "$code"

code=$(curl -sL -o /dev/null -w "%{http_code}" "$WEB_URL/app/dashboard/" || echo 000)
check "Web app dashboard" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/v1/pricing/plans" || echo 000)
check "API pricing plans" "$code"

# Unified search requires auth — 401 means route exists and is protected
code=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/v1/search/unified?q=test" || echo 000)
check_expected "API unified search (auth enforced)" "$code" 401

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{}' || echo 000)
if [ "$code" -eq 400 ] || [ "$code" -eq 401 ] || [ "$code" -eq 422 ]; then
  check "API auth login route" "200"
else
  check "API auth login route" "$code"
fi

echo ""
echo "Passed: $PASS Failed: $FAIL"
[ "$FAIL" -eq 0 ]
